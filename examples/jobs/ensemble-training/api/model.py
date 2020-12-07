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


from pyspark import SparkConf, SparkContext
from pyspark.sql import SparkSession, SQLContext
from pyspark.sql.types import *
import pyspark.sql.functions as F
from pyspark.sql.functions import udf, col
from pyspark.ml.feature import StringIndexer, VectorIndexer, VectorAssembler, StandardScaler

from pyspark.ml.regression import RandomForestRegressor as SparkRandomForestRegressor


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
is_ca_spark_housing_job = transform_parameters['CA_SPARK_TRAIN'] if "CA_SPARK_TRAIN" in transform_parameters else False

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

    genome = GenomeEstimator(model,
        data_preprocessor = preprocess_input,
        modality = "image")


    # save model to file
    modelStore.saveModel(genome, {
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
        estimator_predict = "predict_proba",
        target_classes = twenty_train.target_names,
        modality = "text")


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
    genome_model = GenomeEstimator(model,
        target_classes=["over_50k"],
        feature_names=[
          "Age", "Workclass", "Education-Num", "Marital Status",
          "Occupation", "Relationship", "Race",
          "Sex", "Capital Gain", "Capital Loss",
          "Hours per week", "Country",
        ],
        modality="tabular")


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


    # create global model explanations
    # for a global explanations view of the model
    data_to_explain = dataset_train.data[np.random.choice(dataset_train.data.shape[0], 1200, replace=False), :]



    genome_model = GenomeEstimator(forest_model,
        target_classes=["price"],
        feature_names=dataset_train.feature_names,
        modality="tabular")

    genome_model.explainer.sampleExplanations(data_to_explain)

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



def trainSparkCaliforniaHousing(modelMeta):

    canonicalName = modelMeta["canonicalName"]

    logging.info("started training Housing Model")

    rnd_seed=23
    dataset_train=fetch_california_housing()

    spark = SparkSession.builder.master("local[2]").appName("DTree-Classification-California-Housing").getOrCreate()
    sc = spark.sparkContext
    sqlContext = SQLContext(spark.sparkContext)

    schema = StructType([
        StructField("long", FloatType(), nullable=True),
        StructField("lat", FloatType(), nullable=True),
        StructField("medage", FloatType(), nullable=True),
        StructField("totrooms", FloatType(), nullable=True),
        StructField("totbdrms", FloatType(), nullable=True),
        StructField("pop", FloatType(), nullable=True),
        StructField("houshlds", FloatType(), nullable=True),
        StructField("medinc", FloatType(), nullable=True),
        StructField("medhv", FloatType(), nullable=True)]
        )

    HOUSING_DATA = '/api/api/data/cal_housing.data'
    housing_df = spark.read.csv(path=HOUSING_DATA, schema=schema).cache()
    #scale target variable
    housing_df = housing_df.withColumn("medhv", col("medhv")/100000)
    housing_df = (housing_df.withColumn("rmsperhh", F.round(col("totrooms")/col("houshlds"), 2))
                   .withColumn("popperhh", F.round(col("pop")/col("houshlds"), 2))
                   .withColumn("bdrmsperrm", F.round(col("totbdrms")/col("totrooms"), 2)))

    housing_df = housing_df.select("medhv",
                              "totbdrms",
                              "pop",
                              "houshlds",
                              "medinc",
                              "rmsperhh",
                              "popperhh",
                              "bdrmsperrm")

    featureCols = ["totbdrms", "pop", "houshlds", "medinc", "rmsperhh", "popperhh", "bdrmsperrm"]
    assembler = VectorAssembler(inputCols=featureCols, outputCol="features")
    assembled_df = assembler.transform(housing_df)
    standardScaler = StandardScaler(inputCol="features", outputCol="features_scaled")
    scaled_df = standardScaler.fit(assembled_df).transform(assembled_df)
    train_ca_data, test_ca_data = scaled_df.randomSplit([.8,.2], seed=rnd_seed)
    rf = SparkRandomForestRegressor(featuresCol = "features_scaled", labelCol="medhv")
    rf_model = rf.fit(train_ca_data)



    genome_model = GenomeEstimator(rf_model,
        target_classes=["medhv"],
        feature_names=featureCols,
        modality="tabular"
    )


    # save model to file
    modelStore.saveModel(genome_model, {
      "canonicalName": canonicalName,
      "application": application_parameter or "search",
      "pipelineName": pipelinename_parameter or "pipeline-spark-test",
      "pipelineRunId": pipelinerun_parameter,
      "pipelineStage": stepname_parameter or "model",
      "framework": "spark",
      "inputModality": "tabular",
      "versionName": "1.2.3"
    })

    logging.info("trained and saved Spark Housing Model")



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

elif is_ca_spark_housing_job:
  trainSparkCaliforniaHousing({
      "canonicalName": "modelstore/tabular/spark/forest/housing/1",
      "application": "search"
  })

elif is_image_train_job:
  trainVGG16Eli5({
    "canonicalName": "modelstore/cnn/keras/resnet50/1",
    "application": "search"
  })
