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

from dtreeviz import trees
from .sampled_tree import _regr_leaf_viz
from .sampled_tree import _class_leaf_viz
from .sampled_tree import dtreeviz

# overriding the class/regr_leaf_viz methods to display sampled trees
# trees.regr_leaf_viz = _regr_leaf_viz
# trees.class_leaf_viz = _class_leaf_viz


from .sampled_tree import ShadowSampledSKDTree
from .sampled_tree import ShadowSampledXGBDTree

from .linear_model_tree import LinearSKShadowTree
from .pipeline_model import PipelineSKShadowTree

from .modelstore.client import ModelStore
from .modelstore.estimator import GenomeEstimator

# needs to be used for deserializing explainers :)
import shap

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

# routes
visualization_api = Blueprint('visualization_api', __name__)
health_api = Blueprint('health_api', __name__)

modelstore_api = os.environ['MODELSTORE']

from sklearn.feature_extraction.text import CountVectorizer

modelStore = ModelStore()


dataset_train=fetch_california_housing()

forest_model = RandomForestRegressor(n_estimators=25,max_depth=5)
forest_model = forest_model.fit(dataset_train.data, dataset_train.target)


linear_model = LinearRegression()
linear_model = linear_model.fit(dataset_train.data, dataset_train.target)


class VisualizationNotSupported(Exception):
    pass


def get_shadow_visualizer( model, category,
         feature_names=None, target_classes=None):

    if "ensemble" == category or "tree" == category:

        shadow_tree = ShadowSampledSKDTree(
            model,
            np.array([[1.0 for i in range(model.n_features_)]]),
            np.array([1.0]),
            feature_names=feature_names,
            target_name=target_classes[0] if target_classes else None,
            class_names=target_classes)

        return shadow_tree



    elif "linear" == category :

        linear_shadow_tree = LinearSKShadowTree(
               model,
               feature_names=feature_names,
               target_name=target_classes[0] if target_classes else None,
               class_names=target_classes)

        return shadow_tree



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

    model, modelMeta = modelStore.loadModel({
      "canonicalName":canonicalName,
      "application": application}, withMeta=True)

    viz = None

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


    # only sklearn models can be visualized for now
    if "framework" in modelMeta and modelMeta["framework"] == "sklearn":

        if "ensemble" == estimatorCategory:
            modelToVisualize = modelToVisualize.estimators_[tree_index]


        # create visualizer trees
        shadow_tree = get_shadow_visualizer(
                modelToVisualize,
                estimatorCategory,
                feature_names=feature_names,
                target_classes=target_classes)


        fake_input = np.array([[1.0 for i in range(shadow_tree.tree_model.n_features_)]]),


        # use dummy data, instead sample data from tree node stats
        viz = dtreeviz(shadow_tree,
               fake_input,
               np.array([1.0]),
               feature_names= feature_names,
               target_name= target_classes[0] if target_classes else None,
               class_names= target_classes,
               fancy=False,
               scale=scale)


        # if model is actually a pipline retrieve the last pipline transform
        if "pipeline" in type(estimator).__name__.lower():
            pipeline_viz = PipelineSKShadowTree(estimator, target_name="price_avg")
            full_dot = viz.dot[:viz.dot.rindex("}")] + pipeline_viz.to_dot().dot + "}"
            viz.dot = full_dot




    elif "framework" in modelMeta and modelMeta["framework"] == "xgboost":

        fake_input = np.array([[1.0 for i in range(14)]])

        start_milli = int(round(time.time() * 1000))
        logging.info("started creating shadow tree:" + str(start_milli))

        shadow_tree = ShadowSampledXGBDTree(
            modelToVisualize,
            tree_index,
            fake_input,
            np.array([1.0]),
            feature_names=feature_names,
            target_name=target_classes[0] if target_classes else None,
            class_names=target_classes)

        logging.info("finished creating shadow tree:" + str(int(round(time.time() * 1000)) - start_milli) )

        start_milli = int(round(time.time() * 1000))
        logging.info("started visualizing shadow tree:" + str(start_milli))
        # use dummy data, instead sample data from tree node stats
        viz = dtreeviz(shadow_tree,
               fake_input,
               np.array([1.0]),
               feature_names= feature_names,
               target_name= target_classes[0] if target_classes else None,
               class_names= target_classes,
               fancy=False,
               scale=scale)
        logging.info("finished visualizing shadow tree:" + str(int(round(time.time() * 1000)) - start_milli) )



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





    resp = Response(viz.svg())
    originHeader = request.headers.get('Origin')
    resp.headers.add('Access-Control-Allow-Origin', originHeader)
    resp.headers['Access-Control-Allow-Credentials'] = 'true'
    resp.headers['Content-type'] = 'image/svg+xml'
    resp.headers['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"

    return resp




@health_api.route("/healthz", methods=["GET", "POST"])
def visualization_health():
    return jsonify({
      "ping": "ping!"
    })
