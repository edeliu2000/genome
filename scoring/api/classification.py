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

from tensorflow.keras.applications.resnet50 import ResNet50
from tensorflow.keras.applications.resnet50 import preprocess_input

tensorflow.compat.v1.disable_v2_behavior()

import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import AdaBoostRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.linear_model import LinearRegression
import xgboost
import shap
from .eli5.keras import explain_prediction
from .eli5.image import format_as_image


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

# routes
classification_api = Blueprint('classification_api', __name__)

explanation_api = Blueprint('explanation_api', __name__)

modelstore_api = os.environ['MODELSTORE']

logging.info("starting container with modelstore:" + modelstore_api)


cachedModels = {}
trainingModel = False


X,y = shap.datasets.adult()
X_multi,y_multi = shap.datasets.linnerud()
X_image,y_image = shap.datasets.imagenet50()


def zipdir(path, ziph):
    # ziph is zipfile handle
    for root, dirs, files in os.walk(path):
        for file in files:
            ziph.write(os.path.join(root, file))


def loadModel(meta):
    # first check with model store yada-yada
    model = None


    # post model metadata
    modelMeta = {
        "canonicalName": meta["canonicalName"] if "canonicalName" in meta else "modelPipeline",
        "application": meta["application"] if "application" in meta else "modelPipeline"
    }

    reqMeta = urllib.request.Request(modelstore_api + "/v1.0/genome/search")
    reqMeta.add_header(
        'Content-Type',
        'application/json',
    )

    responseMeta = urllib.request.urlopen(reqMeta, json.dumps(modelMeta).encode('utf-8'))
    data = responseMeta.read()
    modelMetaResp = json.loads(data)

    if not modelMetaResp or len(modelMetaResp) == 0:
        logging.info('No Model Found in ModelStore: ' + json.dumps(modelMeta))
        return model



    logging.info('Models Found in ModelStore: ' + json.dumps(modelMetaResp) + " len: " + str(len(modelMetaResp)))

    modelMetaArtifact =  modelMetaResp[0]
    model_id = modelMetaArtifact["artifactBlob"]["ref"]
    logging.info('Model Found in ModelStore: ' + json.dumps(modelMetaArtifact["artifactBlob"]))


    logging.info("fetching model from url: " + modelstore_api + "/v1.0/genome/blob/" + model_id)

    try:
        response = urllib.request.urlopen(modelstore_api + "/v1.0/genome/blob/" + model_id)
        model_file = response.read()

        if "keras" in modelMetaArtifact["framework"] or "tensorflow" in modelMetaArtifact["framework"]:
            logging.info("initializing keras model:" + model_id)
            tmpdir = tempfile.mkdtemp()
            z = zipfile.ZipFile(io.BytesIO(model_file))
            logging.info("files in zip:" + str(z.namelist()))
            z.extractall(tmpdir)
            model = tensorflow.keras.models.load_model(tmpdir)
        elif "tensorflow" in modelMetaArtifact["framework"]:
            logging.info("initializing tensorflow model:" + model_id)
            tmpdir = tempfile.mkdtemp()
            z = zipfile.ZipFile(io.BytesIO(model_file))
            logging.info("files in zip:" + str(z.namelist()))
            z.extractall(tmpdir)
            model = tensorflow.saved_model.load(tmpdir)

        else:
            model = pickle.loads(model_file)

        cachedModels[model_id] = model
        cachedModels[meta["canonicalName"]] = model

    except URLError as e:
        if hasattr(e, 'reason'):
            logging.info('We failed to reach a server.')
            logging.info('Reason: ' + e.reason)
        elif hasattr(e, 'code'):
            logging.info('The server couldn\'t fulfill the request.')
            logging.info('Error code: ' + str(e.code))

    return model


def saveModel(model, meta):

    # post model blob
    serializedModel = None
    if "sklearn" in str(type(model)):
        serializedModel = pickle.dumps(model)
    elif "xgboost" in str(type(model)):
        serializedModel = pickle.dumps(model)
    elif "lightgbm" in str(type(model)).lower():
        serializedModel = pickle.dumps(model)
    elif "catboost" in str(type(model)).lower():
        serializedModel = pickle.dumps(model)

    elif "keras" in str(type(model)):
        tmpdir = tempfile.mkdtemp()
        kerasmodel_save_path = os.path.join(tmpdir, "model")
        tensorflow.saved_model.save(model, kerasmodel_save_path)
        shutil.make_archive(os.path.join(tmpdir, 'model-file'), 'zip', kerasmodel_save_path)
        fileobj = open(tmpdir + "/model-file.zip", 'rb')
        serializedModel = fileobj.read()

    elif "tensorflow" in str(type(model)):
        tmpdir = tempfile.mkdtemp()
        tfmodel_save_path = os.path.join(tmpdir, "model")
        tensorflow.saved_model.save(model, tfmodel_save_path)
        shutil.make_archive(os.path.join(tmpdir, 'model-file'), 'zip', tfmodel_save_path)
        fileobj = open(tmpdir + "/model-file.zip", 'rb')
        serializedModel = fileobj.read()

    else:
        logging.info("Could not find the main library this model is from. Pickling the entire object")
        serializedModel = pickle.dumps(model)




    req = urllib.request.Request(modelstore_api + "/v1.0/genome/blob")
    req.add_header(
        'Content-Type',
        'application/octet-stream',
    )

    response = urllib.request.urlopen(req, serializedModel)
    data = response.read()
    modelResp = json.loads(data)
    logging.info("blob-id: " + str(modelResp["id"]))


    # post model metadata
    modelMeta = {
        "canonicalName": meta["canonicalName"] if "canonicalName" in meta else "modelPipeline",
        "application": meta["application"] if "application" in meta else "modelPipeline",
        "pipelineName": meta["pipelineName"] if "pipelineName" in meta else "modelPipeline",
        "pipelineRunId": meta["pipelineRunId"] if "pipelineRunId" in meta else "modelPipeline",
        "pipelineStage": meta["pipelineStage"] if "pipelineStage" in meta else "modelPipeline",
        "code": meta["code"] if "code" in meta else {"ref":"noref", "refType":"nocode"},
        "framework": meta["framework"] if "framework" in meta else "tensorflow",
        "versionName": "1.2.3",
        "artifactBlob": {"ref": modelResp["id"], "refType": "modelstore"},
        "dataRefs": [{
          "ref": "s3:/dataset/uuid-123",
          "refType": "mllake"
        }],

    }
    reqMeta = urllib.request.Request(modelstore_api + "/v1.0/genome/model")
    reqMeta.add_header(
        'Content-Type',
        'application/json',
    )

    responseMeta = urllib.request.urlopen(reqMeta, json.dumps(modelMeta).encode('utf-8'))
    data = responseMeta.read()
    modelMetaResp = json.loads(data)
    logging.info("model-id: " + str(modelMetaResp["id"]))




def getTrainedModel(canonicalName):
    if canonicalName in cachedModels and cachedModels[canonicalName]:
        logging.info("using cached model for: " + canonicalName)
        return cachedModels[canonicalName]


    explainer = loadModel({
      "canonicalName": canonicalName,
      "application": "search"
    })

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
        saveModel(explainer, {
          "canonicalName": canonicalName,
          "application": "search",
          "pipelineName": "pipeline-test",
          "pipelineRunId": "run-id-1",
          "pipelineStage": "model",
          "framework": "xgboost",
          "versionName": "xgboost.1.2.1"
        })

        logging.info("trained XGBoost Model")

    return explainer


'''Trains a simple convnet on the MNIST dataset.
Gets to 99.25% test accuracy after 12 epochs
(there is still a lot of margin for parameter tuning).
16 seconds per epoch on a GRID K520 GPU.
'''


batch_size = 128
num_classes = 10
epochs = 2

# input image dimensions
img_rows, img_cols = 28, 28

# the data, split between train and test sets
(x_train, y_train), (x_test, y_test) = mnist.load_data()

if K.image_data_format() == 'channels_first':
    x_train = x_train.reshape(x_train.shape[0], 1, img_rows, img_cols)
    x_test = x_test.reshape(x_test.shape[0], 1, img_rows, img_cols)
    input_shape = (1, img_rows, img_cols)
else:
    x_train = x_train.reshape(x_train.shape[0], img_rows, img_cols, 1)
    x_test = x_test.reshape(x_test.shape[0], img_rows, img_cols, 1)
    input_shape = (img_rows, img_cols, 1)

x_train = x_train.astype('float32')
x_test = x_test.astype('float32')
x_train /= 255
x_test /= 255
print('x_train shape:', x_train.shape)
print(x_train.shape[0], 'train samples')
print(x_test.shape[0], 'test samples')

# convert class vectors to binary class matrices
y_train = tensorflow.keras.utils.to_categorical(y_train, num_classes)
y_test = tensorflow.keras.utils.to_categorical(y_test, num_classes)

# select a set of background examples to take an expectation over
background = x_train[np.random.choice(x_train.shape[0], 100, replace=False)]

logging.info("finished data prep for mnist")


def trainCNNMnist():

    global trainingModel
    if trainingModel:
        return

    trainingModel = True

    logging.info("start training cnn for mnist")
    model = Sequential()
    model.add(Conv2D(32, kernel_size=(3, 3),
                 activation='relu',
                 input_shape=input_shape))
    model.add(Conv2D(64, (3, 3), activation='relu'))
    model.add(MaxPooling2D(pool_size=(2, 2)))
    model.add(Dropout(0.25))
    model.add(Flatten())
    model.add(Dense(128, activation='relu'))
    model.add(Dropout(0.5))
    model.add(Dense(num_classes, activation='softmax'))

    model.compile(loss=tensorflow.keras.losses.categorical_crossentropy,
              optimizer=tensorflow.keras.optimizers.Adadelta(),
              metrics=['accuracy'])

    model.fit(x_train, y_train,
          batch_size=batch_size,
          epochs=epochs,
          verbose=1,
          validation_data=(x_test, y_test))

    logging.info("finished training cnn for mnist")

    score = model.evaluate(x_test, y_test, verbose=0)

    logging.info("cnn test loss: %.6f  test accuracy: %.6f", score[0], score[1])

    startInit = time.time()

    logging.info("before cnn explainer init in: %d ms", int((time.time() - startInit) * 1000))

    # explain predictions of the model on four images
    explainer = shap.DeepExplainer(Model(model.layers[0].input, model.layers[-1].output), background)
    logging.info("cnn explainer init in: %d ms", int((time.time() - startInit) * 1000))


    cachedModels["model-cnn"] = explainer




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



def trainVGG16Eli5(canonicalName):

    # load pre-trained model and choose two images to explain
    model = ResNet50(weights='imagenet', include_top=True)

    # load the ImageNet class names
    url = "https://s3.amazonaws.com/deep-learning-models/image-models/imagenet_class_index.json"
    fname = shap.datasets.cache(url)
    with open(fname) as f:
        class_names = json.load(f)

    # save model to file
    saveModel(model, {
      "canonicalName": canonicalName,
      "application": "search",
      "pipelineName": "pipeline-keras-test",
      "pipelineRunId": "run-id-1",
      "pipelineStage": "model",
      "framework": "keras",
      "versionName": "keras.1.2.2"
    })

    logging.info("trained VGG16 Model and saved on ModelStore")

    cachedModels["imagenet/classes"] = {"classes":class_names}




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
getTrainedModel("tree/explainer/xgboost-1")
#trainVGG16()
trainVGG16Eli5("modelstore/cnn/keras/resnet50/1")



# API-s
@classification_api.route("/classification", methods=["POST"])
def classification():

    sample = json.loads(request.data)["text"]
    trainCNNMnist()

    return jsonify({"m":1, "text": sample})



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
    entries = sample["entries"] if "entries" in sample else None
    imageEntryBase64 = sample["image"] if "image" in sample else None

    if entries:
        data_to_explain = convert_input(entries)


    explainer = getTrainedModel(canonicalName)
    logging.info("created explainer")

    expected_value = 0
    shap_values = None
    interaction_values = None
    number_labels = 1
    image_predicted_class = ""
    image_predicted_class_score = 0
    image_base64 = ""

    if imageEntryBase64:

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
        explanation = explain_prediction(explainer, processed)
        class_names = cachedModels["imagenet/classes"]["classes"]
        logging.info("finished explanation compute in: %d ms", int((time.time() - startTime) * 1000))

        logging.info(explanation)

        image_predicted_class = class_names[str(explanation.targets[0].target)][1]
        image_predicted_class_score = explanation.targets[0].score.item()

        picExplanation = format_as_image(explanation)

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


    else:

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
    logging.info("finished shap compute in: %d ms", diff)


    response = jsonify({
      "number_labels": number_labels,
      "expected": expected_value,
      "shapley": shap_values,
      "shapley_interactions": interaction_values,
      "image": image_base64,
      "class": image_predicted_class,
      "score": image_predicted_class_score
      })

    originHeader = request.headers.get('Origin')
    response.headers.add('Access-Control-Allow-Origin', originHeader)
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"

    return response
