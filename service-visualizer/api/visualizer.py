from __future__ import print_function
from flask import Blueprint, request, jsonify, Response

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

import numpy as np
import matplotlib
import matplotlib.pyplot as pl


from sklearn.datasets import *
from sklearn import tree
from sklearn.ensemble import RandomForestRegressor
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LinearRegression
from sklearn.base import BaseEstimator

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.decomposition import TruncatedSVD
from sklearn.pipeline import Pipeline, make_pipeline

from .sampled_sk_tree import SampledSKDecisionTree
from .sampled_xgb_tree import SampledXGBDecisionTree
from .sampled_spark_tree import SampledSparkDecisionTree

from .linear_model_tree import LinearSKTree
from .pipeline_model import PipelineSKTree


from .modelstore.client import ModelStore
from .modelstore.estimator import GenomeEstimator

from .modelstore.meta_extractor import SparkMetaExtractor
from .modelstore.meta_extractor import SKMetaExtractor


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

# routes
visualization_api = Blueprint('visualization_api', __name__)
health_api = Blueprint('health_api', __name__)

modelstore_api = os.environ['MODELSTORE']

from sklearn.feature_extraction.text import CountVectorizer

modelStore = ModelStore()


class VisualizationNotSupported(Exception):
    pass


def model_visualizer( model, category,
         feature_names=None, target_classes=None):

    if "ensemble" == category or "tree" == category:

        shadow_tree = SampledSKDecisionTree(
            model,
            np.array([[1.0 for i in range(model.n_features_)]]),
            np.array([1.0]),
            feature_names=feature_names,
            target_name=target_classes[0] if target_classes else None,
            class_names=target_classes)

        return shadow_tree



    elif "linear" == category :

        linear_shadow_tree = LinearSKTree(
               model,
               feature_names=feature_names,
               target_name=target_classes[0] if target_classes else None,
               class_names=target_classes)


        return linear_shadow_tree



    raise VisualizationNotSupported("Visualization not supported: ", category)




# API-s
@visualization_api.route("/visualization", methods=["GET", "POST"])
def visualization():

    if request.method == "OPTIONS":
        response = jsonify({})
        originHeader = request.headers.get('Origin')
        response.headers.add('Access-Control-Allow-Origin', originHeader)
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        return response


    index_param = request.args.get('index')
    canonicalName = request.args.get('canonicalName')
    application = request.args.get('application')

    scale = int(request.args.get('scale')) or int(1.0)
    tree_index = int(index_param) if index_param else int(0)
    #regr = tree.DecisionTreeRegressor(max_depth=2)
    #boston = load_boston()
    #regr.fit(boston.data, boston.target)

    start_milli = int(round(time.time() * 1000))
    logging.info("started loading model from model store:" + str(start_milli))

    model, modelMeta = modelStore.loadModel({
      "canonicalName":canonicalName,
      "application": application}, withMeta=True)

    logging.info("finished loading spark tree from model store:" + str(int(round(time.time() * 1000)) - start_milli) )

    vizGraph = None

    estimator = model.estimator if isinstance(model, GenomeEstimator) else model
    modelToVisualize = estimator[-1] if "pipeline" in type(estimator).__name__.lower() else estimator

    feature_names = None
    target_classes = None
    estimatorCategory = None

    if "parameters" in modelMeta and modelMeta["parameters"]["__estimator_category__"]:
        estimatorCategory = modelMeta["parameters"]["__estimator_category__"]

    if isinstance(model, GenomeEstimator):
        feature_names = model.feature_names
        target_classes = model.target_classes


    # sklearn models can be visualized for now
    if "framework" in modelMeta and modelMeta["framework"] == "sklearn":

        if "ensemble" == estimatorCategory:
            extractor = SKMetaExtractor()
            modelToVisualize = extractor.getTreeFromEnsemble(modelToVisualize, tree_index)

        # create visualizer trees
        shadow_tree = model_visualizer(
                modelToVisualize,
                estimatorCategory,
                feature_names=feature_names,
                target_classes=target_classes)


        fake_input = np.array([[1.0 for i in range(shadow_tree.tree_model.n_features_)]]),


        # use dummy data, instead sample data from tree node stats
        vizGraph = shadow_tree.modelGraph(precision=2)


        # if model is actually a pipline retrieve the last pipline transform
        if "pipeline" in type(estimator).__name__.lower():
            pipelineTree = PipelineSKTree(estimator, target_name="price_avg")
            pipeGraph = pipelineTree.modelGraph(precision=2)
            vizGraph["pipeline"] = pipeGraph




    elif "framework" in modelMeta and modelMeta["framework"] == "xgboost":

        fake_input = np.array([[1.0 for i in range(14)]])

        shadow_tree = SampledXGBDecisionTree(
            modelToVisualize,
            tree_index,
            fake_input,
            np.array([1.0]),
            feature_names=feature_names,
            target_name=target_classes[0] if target_classes else None,
            class_names=target_classes)

        # use dummy data, instead sample data from tree node stats
        vizGraph = shadow_tree.modelGraph()




    elif "framework" in modelMeta and modelMeta["framework"] == "spark":

        fake_input = np.array([[1.0 for i in range(14)]])

        start_milli = int(round(time.time() * 1000))
        logging.info("started creating shadow tree:" + str(start_milli))

        if "ensemble" == estimatorCategory:
            extractor = SparkMetaExtractor()
            modelToVisualize = extractor.getTreeFromEnsemble(modelToVisualize, tree_index)


        shadow_tree = SampledSparkDecisionTree(
            modelToVisualize,
            fake_input,
            np.array([1.0]),
            feature_names=feature_names,
            target_name=target_classes[0] if target_classes else None,
            class_names=target_classes)

        logging.info("finished creating shadow spark tree:" + str(int(round(time.time() * 1000)) - start_milli) )

        start_milli = int(round(time.time() * 1000))
        logging.info("started visualizing shadow spark tree:" + str(start_milli))

        vizGraph = shadow_tree.modelGraph()

        logging.info("finished visualizing shadow spark tree:" + str(int(round(time.time() * 1000)) - start_milli) )



    else:
        originHeader = request.headers.get('Origin')
        respHeaders = {
            'Access-Control-Allow-Origin': originHeader,
            'Access-Control-Allow-Credentials': 'true',
            'Content-type': 'application/json',
            'Access-Control-Allow-Headers': "Origin, X-Requested-With, Content-Type, Accept, Authorization",
            }

        jsonResp = {
          "error": {
            "msg": "ML framework not supported for model visualization: " + (modelMeta["framework"] if "framework" in modelMeta else "")
          }
        }

        return jsonResp, 400, respHeaders



    resp = jsonify(vizGraph)
    originHeader = request.headers.get('Origin')
    resp.headers.add('Access-Control-Allow-Origin', originHeader)
    resp.headers['Access-Control-Allow-Credentials'] = 'true'
    resp.headers['Content-type'] = 'application/json'
    resp.headers['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"

    return resp




@health_api.route("/healthz", methods=["GET", "POST"])
def visualization_health():
    return jsonify({
      "ping": "ping!"
    })
