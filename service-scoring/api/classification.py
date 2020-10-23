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

from .eli5.keras import explain_prediction
from .eli5.image import format_as_image
from .eli5.lime import TextExplainer
from .eli5.formatters.as_dict import format_as_dict
from .eli5.sklearn.explain_prediction import explain_prediction_linear_classifier

from .modelstore.client import ModelStore
from .modelstore.estimator import GenomeEstimator


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

# routes
classification_api = Blueprint('classification_api', __name__)
explanation_api = Blueprint('explanation_api', __name__)
health_api = Blueprint('health_api', __name__)

modelstore_api = os.environ['MODELSTORE']
is_train_job = os.environ['TRAIN_PARAMS'] if "TRAIN_PARAMS" in os.environ else False



logging.info("starting container with modelstore:" + modelstore_api)


cachedModels = {}
trainingModel = False

modelStore = ModelStore()

X,y = shap.datasets.adult()
X_multi,y_multi = shap.datasets.linnerud()
X_image,y_image = shap.datasets.imagenet50()



def getTrainedModel(modelMeta):
    canonicalName = modelMeta["canonicalName"]

    if canonicalName in cachedModels and cachedModels[canonicalName]:
        logging.info("using cached model for: " + canonicalName)
        return cachedModels[canonicalName]


    explainer = modelStore.loadModel(modelMeta)

    if not explainer:
        global trainingModel

        if trainingModel:
            return None

        trainingModel = True

        logging.info("started training XGBoost Model")
        # train XGBoost model
        model = xgboost.train({"learning_rate": 0.01}, xgboost.DMatrix(X.values, label=y), 100)

        # Fit regression model
        # regr_1 = AdaBoostRegressor(DecisionTreeRegressor(max_depth=4),
        #                  n_estimators=100)
        # regr_1 = LinearRegression()
        # regr_1.fit(X_multi, y_multi)

        # explain the model's predictions using SHAP
        # (same syntax works for LightGBM, CatBoost, scikit-learn and spark models)
        explainer = shap.TreeExplainer(model)

        # save model to file
        modelStore.saveModel(explainer, {
          "canonicalName": canonicalName,
          "application": "search",
          "pipelineName": "pipeline-test",
          "pipelineRunId": "run-id-1",
          "pipelineStage": "model",
          "framework": "xgboost",
          "inputModality": "tabular",
          "versionName": "xgboost.1.2.1"
        })

        logging.info("trained XGBoost Model")

    return explainer



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
      "application": "search",
      "pipelineName": "pipeline-keras-test",
      "pipelineRunId": "run-id-1",
      "pipelineStage": "model",
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
      "application": "search",
      "pipelineName": "pipeline-sklearn-text-classifier",
      "pipelineRunId": "run-id-1",
      "pipelineStage": "model",
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
      "application": "search",
      "pipelineName": "pipeline-test",
      "pipelineRunId": "run-id-1",
      "pipelineStage": "model",
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
            "number_labels": number_labels
        })

    # save model to file
    modelStore.saveModel(genome_model, {
      "canonicalName": canonicalName,
      "application": "search",
      "pipelineName": "pipeline-sklearn-housing",
      "pipelineRunId": "run-id-1",
      "pipelineStage": "model",
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




if is_train_job:


  trainTextClassifier({
    "canonicalName": "modelstore/text/svm/vectorizer/1",
    "application": "search"
  })

  trainAdultXGBoost({
      "canonicalName": "modelstore/tabular/xgboost/adult/1",
      "application": "search"
  })

  trainCaliforniaHousing({
      "canonicalName": "modelstore/tabular/forest/housing/1"
  })

  #trainVGG16()
  trainVGG16Eli5({
    "canonicalName": "modelstore/cnn/keras/resnet50/1",
    "application": "search"
  })



# API-s
@classification_api.route("/classification", methods=["POST"])
def classification():

    sample = json.loads(request.data)["text"]
    trainCNNMnist()

    return jsonify({"m":1, "text": sample})




@explanation_api.route("/explanation/samples", methods=["POST", "OPTIONS"])
def global_explanations():
    if request.method == "OPTIONS":
        response = jsonify({})
        originHeader = request.headers.get('Origin')
        response.headers.add('Access-Control-Allow-Origin', originHeader)
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        return response



    sample = json.loads(request.data)
    canonicalName = sample["canonicalName"]
    modelMeta = sample["modelMeta"] if "modelMeta" in sample else {
      "canonicalName": canonicalName,
    }
    entries = sample["entries"] if "entries" in sample else None

    explainer = getTrainedModel(modelMeta)
    logging.info("fetched model and explainer")

    explanations = {}
    if isinstance(explainer, GenomeEstimator) and getattr(explainer, "explanations", None):
        explanations = explainer.explanations




    response = jsonify(explanations)

    originHeader = request.headers.get('Origin')
    response.headers.add('Access-Control-Allow-Origin', originHeader)
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"

    return response



@explanation_api.route("/explain", methods=["POST", "OPTIONS"])
def explanation():

    if request.method == "OPTIONS":
        response = jsonify({})
        originHeader = request.headers.get('Origin')
        response.headers.add('Access-Control-Allow-Origin', originHeader)
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        return response


    startTime = time.time()

    sample = json.loads(request.data)
    canonicalName = sample["canonicalName"]
    modelMeta = sample["modelMeta"] if "modelMeta" in sample else {
      "canonicalName": canonicalName,
    }
    entries = sample["entries"] if "entries" in sample else None
    imageEntryBase64 = sample["image"] if "image" in sample else None
    textInput = sample["text"] if "text" in sample else None


    if entries:
        data_to_explain = convert_input(entries)


    explainer = getTrainedModel(modelMeta)
    logging.info("created explainer")

    expected_value = 0
    shap_values = None
    interaction_values = None
    number_labels = 1
    image_predicted_class = ""
    image_predicted_class_score = 0
    image_base64 = ""
    explanation = None
    metrics = None

    if imageEntryBase64:

       # explain image predictions via keras or tf CNN's
        dims = explainer.input_shape[1:3]
        logging.info("model takes input image of shape:" + str(dims))

        # we need to add manually padding
        # because of differences between js encode and python decode
        base64_decoded = base64.b64decode(imageEntryBase64 + "===")
        image_entry = Image.open(io.BytesIO(base64_decoded)).convert('RGB')
        image_entry.thumbnail(dims, Image.ANTIALIAS)
        #im = tensorflow.keras.preprocessing.image.load_img(image_entry, target_size=dims) # -> PIL image
        doc = tensorflow.keras.preprocessing.image.img_to_array(image_entry) # -> numpy array
        logging.info("doc is has shape:" + str(doc.shape))

        #reshape with batch size = 1
        doc = np.expand_dims(doc, axis=0)

        processed = preprocess_input(doc)

        logging.info("finished map_to_layer compute in: %d ms", int((time.time() - startTime) * 1000))
        predExplanation = explain_prediction(explainer, processed)
        class_names = getImageNetClasses()["classes"]
        logging.info("finished explanation compute in: %d ms", int((time.time() - startTime) * 1000))

        logging.info(predExplanation)

        image_predicted_class = class_names[str(predExplanation.targets[0].target)][1]
        image_predicted_class_score = predExplanation.targets[0].score.item()

        picExplanation = format_as_image(predExplanation)

        # get the names for the classes
        #index_names = np.vectorize(lambda x: class_names[str(x)][1])(indexes)

        # plot the explanations
        #pl.figure(figsize=(10,5))
        #shap.image_plot(shap_values, to_explain, index_names, width=5, show=False)

        buffered = io.BytesIO()
        #pl.savefig(picExplanation,  format='png')
        picExplanation.save(buffered, format='png')
        buffered.seek(0)
        image_base64 = base64.b64encode(buffered.read()).decode('utf-8')


    elif textInput:
        # explain text predictions via LIME
        # using eli5 lime to do the explanation of the text classifier
        textExplainer = TextExplainer(random_state=42)
        if explainer.estimator and explainer.estimator_predict:
            textExplainer.fit(textInput, getattr(explainer.estimator, explainer.estimator_predict))
        else:
            textExplainer.fit(textInput, explainer)


        if explainer.target_classes:
            number_labels = len(explainer.target_classes)
            explanation = textExplainer.explain_prediction(target_names=explainer.target_classes)
        else:
            number_labels = 1
            explanation = textExplainer.explain_prediction()


        metrics = textExplainer.metrics_


    else:


        explainer = explainer.explainer if isinstance(explainer, GenomeEstimator) else explainer


        # tabular data using shapley values.
        expected_value = explainer.expected_value
        shap_values = explainer.shap_values(data_to_explain)
        interaction_values = explainer.shap_interaction_values(data_to_explain)

        logging.info("expected: " + str(expected_value))
        logging.info("shap: " + str(shap_values))
        logging.info("shap interaction: " + str(interaction_values))


        #convert from numpy to python types
        if not isinstance(expected_value,np.ndarray):
            expected_value = expected_value.item() if isinstance(expected_value,np.float32) else expected_value
        else:
            expected_value = expected_value.tolist()

        shap_values = shap_values.tolist() if isinstance(shap_values, np.ndarray) else [a.tolist() for a in shap_values]
        interaction_values = interaction_values.tolist() if isinstance(interaction_values, np.ndarray) else [a.tolist() for a in interaction_values]
        number_labels = 1 if not isinstance(expected_value, list) else len(expected_value)





    diff = int((time.time() - startTime) * 1000)
    logging.info("finished compute in: %d ms", diff)


    response = jsonify({
      "number_labels": number_labels,
      "expected": expected_value,
      "shapley": shap_values,
      "shapley_interactions": interaction_values,
      "image": image_base64,
      "class": image_predicted_class,
      "score": image_predicted_class_score,
      "textExplanation": format_as_dict(explanation) if explanation else None,
      "metrics": metrics if metrics else None,
      "explainer": {
        "classifier": "log",
        "vectorizer": {"name": "CountVectorizer", "ngrams":[1,2]}
      } if metrics and explanation else None
    })

    originHeader = request.headers.get('Origin')
    response.headers.add('Access-Control-Allow-Origin', originHeader)
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"

    return response




@health_api.route("/healthz", methods=["GET", "POST"])
def explanation_health():
    return jsonify({
      "ping": "ping!"
    })
