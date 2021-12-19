from __future__ import print_function
from flask import Blueprint, request, jsonify

import json
import logging
import sys
import time
import os
import os.path
import warnings

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


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

#from .eli5.keras import explain_prediction
#from .eli5.image import format_as_image

try:
    from .modelstore.client import ModelStore
    from .modelstore.estimator import GenomeEstimator
    from .modelstore.explainer import GenomeExplainer
except ImportError:
    warnings.warn('relative modelstore client not be imported', ImportWarning)
    logging.info("importing modelstore --- --- ###")
    from modelstore.client import ModelStore
    from modelstore.estimator import GenomeEstimator
    from modelstore.explainer import GenomeExplainer
    logging.info("imported modelstore --- --- ###")


# routes
explanation_api = Blueprint('explanation_api', __name__)
health_api = Blueprint('health_api', __name__)

modelstore_api = os.getenv('MODELSTORE')
is_train_job = os.environ['TRAIN_PARAMS'] if "TRAIN_PARAMS" in os.environ else False



logging.info("starting container with modelstore:" + modelstore_api)


cachedModels = {}
trainingModel = False

model_store = ModelStore()


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
    canonical_name = sample["canonicalName"]
    model_meta = sample["modelMeta"] if "modelMeta" in sample else {
      "canonicalName": canonical_name,
    }
    entries = sample["entries"] if "entries" in sample else None

    model = model_store.load_model(model_meta)

    logging.info("fetched model and explainer")

    explanations = {}
    if isinstance(model.explainer, GenomeExplainer) and getattr(model.explainer, "explanations", None):
        explanations = model.explainer.explanations




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



    model = model_store.load_model(modelMeta)


    logging.info("created explainer")

    expected_value = 0
    shap_values = None
    number_labels = 1
    image_predicted_class = ""
    image_predicted_class_score = 0
    image_base64 = ""
    explanation = None
    metrics = None

    if imageEntryBase64:

       # explain image predictions via keras or tf CNN's
        dims = model.estimator.input_shape[1:3]
        logging.info("model takes input image of shape:" + str(dims))

        # we need to add manually padding
        # because of differences between js encode and python decode
        base64_decoded = base64.b64decode(imageEntryBase64 + "===")
        image_entry = Image.open(io.BytesIO(base64_decoded)).convert('RGB')
        image_entry.thumbnail(dims, Image.ANTIALIAS)

        import tensorflow
        #im = tensorflow.keras.preprocessing.image.load_img(image_entry, target_size=dims) # -> PIL image
        doc = tensorflow.keras.preprocessing.image.img_to_array(image_entry) # -> numpy array
        logging.info("doc is has shape:" + str(doc.shape))

        #reshape with batch size = 1
        doc = np.expand_dims(doc, axis=0)

        #processed = preprocess_input(doc)

        logging.info("finished map_to_layer compute in: %d ms", int((time.time() - startTime) * 1000))
        predExplanation = model.explain(doc)

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

        number_labels = 1
        logging.info("text length: " + str(len(textInput)))
        explanation = model.explain(textInput)
        # use the text explainer metrics under the hood
        metrics = model.explainer.explainer.metrics_

    else:

        # tabular data using shapley values.
        expected_value = model.explainer.explainer.expected_value
        shap_values = model.explain(data_to_explain)

        logging.info("expected: " + str(expected_value))
        logging.info("shap: " + str(shap_values))


        #convert from numpy to python types
        if not isinstance(expected_value,np.ndarray):
            expected_value = expected_value.item() if isinstance(expected_value,np.float32) else expected_value
        else:
            expected_value = expected_value.tolist()

        shap_values = shap_values.tolist() if isinstance(shap_values, np.ndarray) else [a.tolist() for a in shap_values]
        number_labels = 1 if not isinstance(expected_value, list) else len(expected_value)





    diff = int((time.time() - startTime) * 1000)
    logging.info("finished compute in: %d ms", diff)


    response = jsonify({
      "number_labels": number_labels,
      "expected": expected_value,
      "shapley": shap_values,
      "image": image_base64,
      "class": image_predicted_class,
      "score": image_predicted_class_score,
      "textExplanation": explanation if explanation else None,
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
