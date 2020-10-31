from __future__ import print_function
from flask import Blueprint, request, jsonify

import json
import logging
import sys
import time
import os
import os.path
import pickle
import urllib.request
from urllib.error import  URLError
import base64
import io
import glob
import tempfile
import zipfile
import shutil
from PIL import Image

import matplotlib
import matplotlib.pyplot as pl

import tensorflow
import tensorflow.keras
from tensorflow.keras.models import Model
from tensorflow.compat.v1.keras.backend import get_session


from tensorflow.keras.datasets import mnist
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, Flatten
from tensorflow.keras.layers import Conv2D, MaxPooling2D
from tensorflow.keras import backend as K

from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

tensorflow.compat.v1.disable_v2_behavior()

import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import AdaBoostRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.ensemble import RandomForestRegressor


from sklearn.datasets import fetch_20newsgroups
from sklearn.datasets import fetch_california_housing

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.decomposition import TruncatedSVD
from sklearn.pipeline import Pipeline, make_pipeline

import xgboost
import shap

from .modelstore.client import ModelStore
from .modelstore.estimator import GenomeEstimator


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

modelstore_api = os.environ['MODELSTORE']

# fetching step parameters from env variables
transform_parameters = os.environ['PARAMETERS'] if "PARAMETERS" in os.environ else "{\"ADULT_TRAIN\":true}"
logging.info("json parameters:" + transform_parameters)
transform_parameters = json.loads(transform_parameters)

is_adult_train_job = transform_parameters['ADULT_TRAIN'] if "ADULT_TRAIN" in transform_parameters else False
is_ca_housing_job = transform_parameters['CA_TRAIN'] if "CA_TRAIN" in transform_parameters else False
is_text_train_job = transform_parameters['TEXT_TRAIN'] if "TEXT_TRAIN" in transform_parameters else False
is_image_train_job = transform_parameters['IMAGE_TRAIN'] if "IMAGE_TRAIN" in transform_parameters else False

application_parameter = os.environ['APPLICATION'] if "APPLICATION" in os.environ else ""
pipelinerun_parameter = os.environ['PIPELINE_RUNID'] if "PIPELINE_RUNID" in os.environ else ""
pipelinename_parameter = os.environ['PIPELINE_NAME'] if "PIPELINE_NAME" in os.environ else ""
stepname_parameter = os.environ['STEP_NAME'] if "STEP_NAME" in os.environ else ""


logging.info("starting container with modelstore:" + modelstore_api)


cachedModels = {}
trainingModel = False

modelStore = ModelStore()

X,y = shap.datasets.adult()
X_multi,y_multi = shap.datasets.linnerud()
X_image,y_image = shap.datasets.imagenet50()




def trainVGG16():

    # load pre-trained model and choose two images to explain
    model = VGG16(weights='imagenet', include_top=True)

    # load the ImageNet class names
    url = "https://s3.amazonaws.com/deep-learning-models/image-models/imagenet_class_index.json"
    fname = shap.datasets.cache(url)
    with open(fname) as f:
        class_names = json.load(f)

    # explain how the input to the 7th layer of the model explains the top two classes
    def map2layer(x, layer):
        feed_dict = dict(zip([model.layers[0].input], [preprocess_input(x.copy())]))
        return get_session().run(model.layers[layer].input, feed_dict)

    explainer = shap.GradientExplainer(
        (model.layers[7].input, model.layers[-1].output),
        map2layer(X_image, 7),
        local_smoothing=0 # std dev of smoothing noise
        )

    cachedModels["model-vgg16"] = {"explainer": explainer, "model":model, "classes":class_names}



def getImageNetClasses():
    if "imagenet/classes" in cachedModels:
        return cachedModels["imagenet/classes"]
    # load the ImageNet class names
    url = "https://s3.amazonaws.com/deep-learning-models/image-models/imagenet_class_index.json"
    fname = shap.datasets.cache(url)
    with open(fname) as f:
        class_names = json.load(f)

        cachedModels["imagenet/classes"] = {"classes":class_names}

        return cachedModels["imagenet/classes"]






def trainVGG16Eli5(modelMeta):

    canonicalName = modelMeta["canonicalName"]

    # load pre-trained model and choose two images to explain
    model = MobileNetV2(weights='imagenet', include_top=True)

    # save model to file
    modelStore.saveModel(model, {
      "canonicalName": canonicalName,
      "application": application_parameter or "search",
      "pipelineName": pipelinename_parameter or "pipeline-keras-test",
      "pipelineRunId": pipelinerun_parameter,
      "pipelineStage": stepname_parameter or "model",
      "framework": "keras",
      "inputModality": "image",
      "versionName": "keras.1.2.2",
      "predictionType": "classification"
    })

    logging.info("trained MobileNetV2 Model and saved on ModelStore")



def trainTextClassifier(modelMeta):

    canonicalName = modelMeta["canonicalName"]


    categories = ['alt.atheism', 'soc.religion.christian',
              'comp.graphics', 'sci.med']

    twenty_train = fetch_20newsgroups(
      subset='train',
      categories=categories,
      shuffle=True,
      random_state=42,
      remove=('headers', 'footers'),
    )

    #pipeline is composed out of tfid +LSA
    vec = TfidfVectorizer(min_df=3, stop_words='english',
                      ngram_range=(1, 2))
    svd = TruncatedSVD(n_components=100, n_iter=7, random_state=42)
    lsa = make_pipeline(vec, svd)

    #clf = SVC(C=150, gamma=2e-2, probability=True)
    forest_model = RandomForestClassifier(n_estimators=205,max_depth=5)

    pipe = make_pipeline(lsa, forest_model)

    # fit and score
    pipe.fit(twenty_train.data, twenty_train.target)

    model = GenomeEstimator(pipe,
        estimator_predict="predict_proba",
        target_classes=twenty_train.target_names)


    # save model to file
    modelStore.saveModel(model, {
      "canonicalName": canonicalName,
      "application": application_parameter or "search",
      "pipelineName": pipelinename_parameter or "pipeline-keras-test",
      "pipelineRunId": pipelinerun_parameter,
      "pipelineStage": stepname_parameter or "model",
      "framework": "sklearn",
      "inputModality": "text",
      "versionName": "sklearn-text.1.2.2",
      "predictionType": "classification"
    })

    logging.info("trained text classifier Model and saved on ModelStore")



def trainAdultXGBoost(modelMeta):
    canonicalName = modelMeta["canonicalName"]

    logging.info("started training XGBoost Model")
    # train XGBoost model
    model = xgboost.train({"learning_rate": 0.01}, xgboost.DMatrix(X.values, label=y), 100)


    # explain the model's predictions using SHAP
    # (same syntax works for LightGBM, CatBoost, scikit-learn and spark models)
    explainer = shap.TreeExplainer(model)

    genome_model = GenomeEstimator(model,
        target_classes=["over_50k"],
        explainer=explainer)


    # save model to file
    modelStore.saveModel(genome_model, {
      "canonicalName": canonicalName,
      "application": application_parameter or "search",
      "pipelineName": pipelinename_parameter or "pipeline-keras-test",
      "pipelineRunId": pipelinerun_parameter,
      "pipelineStage": stepname_parameter or "model",
      "framework": "xgboost",
      "inputModality": "tabular",
      "versionName": "xgboost.1.2.1"
    })

    logging.info("trained and saved XGBoost Model")



def trainCaliforniaHousing(modelMeta):

    canonicalName = modelMeta["canonicalName"]

    logging.info("started training Housing Model")


    dataset_train=fetch_california_housing()

    forest_model = RandomForestRegressor(n_estimators=120,max_depth=5)
    forest_model = forest_model.fit(dataset_train.data, dataset_train.target)



    explainer = shap.TreeExplainer(forest_model)

    # create global model explanations
    # for a global explanations view of the model
    expected_value = explainer.expected_value
    data_to_explain = dataset_train.data[np.random.choice(dataset_train.data.shape[0], 1200, replace=False), :]
    shap_values = explainer.shap_values(data_to_explain)
    shap_values = shap_values.tolist() if isinstance(shap_values, np.ndarray) else [a.tolist() for a in shap_values]
    #convert from numpy to python types
    if not isinstance(expected_value,np.ndarray):
        expected_value = expected_value.item() if isinstance(expected_value,np.float32) else expected_value
    else:
        expected_value = expected_value.tolist()

    number_labels = 1 if not isinstance(expected_value, list) else len(expected_value)




    genome_model = GenomeEstimator(forest_model,
        target_classes=["price"],
        feature_names=dataset_train.feature_names,
        explainer=explainer,
        explanations={
            "expected_value": expected_value,
            "shap_values": shap_values,
            "number_labels": number_labels,
            "feature_values": data_to_explain.tolist(),
            "feature_names": dataset_train.feature_names,
        })

    # save model to file
    modelStore.saveModel(genome_model, {
      "canonicalName": canonicalName,
      "application": application_parameter or "search",
      "pipelineName": pipelinename_parameter or "pipeline-keras-test",
      "pipelineRunId": pipelinerun_parameter,
      "pipelineStage": stepname_parameter or "model",
      "framework": "sklearn",
      "inputModality": "tabular",
      "versionName": "1.2.3"
    })

    logging.info("trained and saved Housing Model")





def convert_input(entries):
    if entries and isinstance(entries, list):
        try:
            entries = np.asarray(entries)
            return entries
        except Error as e:
            logging.error("failed to parse entries into numpy array: " + str(e))
            try:
                entries = pd.DataFrame(entries)
                return entries
            except Error as pdError:
                logging.error("failed to parse entries into panda df: " + str(e))

    return None




# training test models
#getTrainedModel({
#    "canonicalName": "tree/explainer/xgboost-1",
#    "application": "search"
#})




if is_text_train_job:
  trainTextClassifier({
    "canonicalName": "modelstore/text/svm/vectorizer/1",
    "application": "search"
  })

elif is_adult_train_job:
  trainAdultXGBoost({
      "canonicalName": "modelstore/tabular/xgboost/adult/1",
      "application": "search"
  })

elif is_ca_housing_job:
  trainCaliforniaHousing({
      "canonicalName": "modelstore/tabular/forest/housing/1"
  })


elif is_image_train_job:
  trainVGG16Eli5({
    "canonicalName": "modelstore/cnn/keras/resnet50/1",
    "application": "search"
  })
