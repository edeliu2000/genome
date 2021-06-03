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

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

from .modelstore.client import ModelStore
from .modelstore.estimator import GenomeEstimator

from .modelstore.visualizer import Viz3Model
from .modelstore.visualizer import VisualizationNotSupported


# routes
visualization_api = Blueprint('visualization_api', __name__)
health_api = Blueprint('health_api', __name__)

modelstore_api = os.environ['MODELSTORE']

from sklearn.feature_extraction.text import CountVectorizer

model_store = ModelStore()


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

    model, modelMeta = model_store.load_model({
      "canonicalName":canonicalName,
      "application": application}, withMeta=True)

    logging.info("finished loading spark tree from model store:" + str(int(round(time.time() * 1000)) - start_milli) )


    # convert models to an intermediate representation (IR) for visualization
    # via Viz3Model
    viz_graph = None
    try:
        if isinstance(model, GenomeEstimator):
            viz_graph = model.viz3_graph(model.estimator, tree_index)

        else:
            viz3_model = Viz3Model(model,
                          feature_names = None,
                          target_classes = None)

            viz_graph = viz3_model.viz3_graph(model, tree_index=tree_index)

    except VisualizationNotSupported:
        logging.info("Visualization not supported error on model: " + canonicalName)






    if viz_graph == None:
        logging.info("Visualization not supported: no graph - error on model: " + canonicalName)
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



    resp = jsonify(viz_graph)
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
