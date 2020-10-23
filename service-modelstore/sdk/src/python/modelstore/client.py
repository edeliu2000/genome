from __future__ import print_function

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

import warnings

try:
    import tensorflow
except ImportError:
    warnings.warn('tensorflow could not be imported', ImportWarning)

from .meta_extractor import SKMetaExtractor
from .meta_extractor import XGMetaExtractor
from .meta_extractor import TFMetaExtractor
from .meta_extractor import LightGBMMetaExtractor
from .meta_extractor import CatBoostMetaExtractor

from .estimator import GenomeEstimator

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


modelstore_api = os.environ['MODELSTORE']
GENOME_FILE = '_genome_.p'

class ModelStore():

    def __init__(self):
        self.cachedModels = {}




    def loadModel(self, meta, withMeta=False):
        # first check with model store yada-yada
        model = None
        modelMetaArtifact = None

        canonicalName = meta["canonicalName"]

        if canonicalName in self.cachedModels and self.cachedModels[canonicalName]:
            logging.info("using cached model for: " + canonicalName)
            if withMeta:
                return self.cachedModels[canonicalName], self.cachedModels["/meta/" + canonicalName]

            return self.cachedModels[canonicalName]


        if "framework" not in meta or "artifactBlob" not in meta:

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
                if withMeta:
                  return model, None

                return model



            logging.info('Models Found in ModelStore: ' + json.dumps(modelMetaResp) + " len: " + str(len(modelMetaResp)))

            modelMetaArtifact =  modelMetaResp[0]
            model_id = modelMetaArtifact["artifactBlob"]["ref"]
            logging.info('Model Found in ModelStore: ' + json.dumps(modelMetaArtifact["artifactBlob"]))
        else:
            modelMetaArtifact = meta
            model_id = modelMetaArtifact["artifactBlob"]["ref"]



        logging.info("fetching model from url: " + modelstore_api + "/v1.0/genome/blob/" + model_id)

        try:
            response = urllib.request.urlopen(modelstore_api + "/v1.0/genome/blob/" + model_id)
            model_file = response.read()

            if "keras" in modelMetaArtifact["framework"]:

                logging.info("initializing keras/tensorflow model:" + model_id)
                tmpdir = tempfile.mkdtemp()
                z = zipfile.ZipFile(io.BytesIO(model_file))
                logging.info("files in zip:" + str(z.namelist()))
                z.extractall(tmpdir)
                tf_model = tensorflow.keras.models.load_model(tmpdir)
                if os.path.isfile(tmpdir + '/' + GENOME_FILE):
                    model = pickle.load( open( tmpdir + '/' + GENOME_FILE, "rb" ))
                    model.estimator = tf_model
                else:
                    model = tf_model


            elif "tensorflow" in modelMetaArtifact["framework"]:

                logging.info("initializing tensorflow model:" + model_id)
                tmpdir = tempfile.mkdtemp()
                z = zipfile.ZipFile(io.BytesIO(model_file))
                logging.info("files in zip:" + str(z.namelist()))
                z.extractall(tmpdir)
                tf_model = tensorflow.saved_model.load(tmpdir)
                if os.path.isfile(tmpdir + '/' + GENOME_FILE):
                    model = pickle.load( open( tmpdir + '/' + GENOME_FILE, "rb" ))
                    model.estimator = tf_model
                else:
                    model = tf_model


            else:
                model = pickle.loads(model_file)

            self.cachedModels[model_id] = model
            self.cachedModels["/meta/" + meta["canonicalName"]] = modelMetaArtifact
            self.cachedModels[meta["canonicalName"]] = model

        except URLError as e:
            if hasattr(e, 'reason'):
                logging.info('We failed to reach a server.')
                logging.info('Reason: ' + e.reason)
            elif hasattr(e, 'code'):
                logging.info('The server couldn\'t fulfill the request.')
                logging.info('Error code: ' + str(e.code))

        if withMeta:
            return (model, modelMetaArtifact)

        return model



    def saveModel(self, model, meta):

        # post model blob
        serializedModel = None
        modelClass = None
        ensembleRank = 1
        estimatorClassName = None

        estimator = model.estimator if isinstance(model, GenomeEstimator) else model

        predictionType = meta["predictionType"] if "predictionType" in meta else None


        if "keras" in str(type(estimator)) or "tensorflow" in str(type(estimator)):

            tmpdir = tempfile.mkdtemp()
            model_save_path = os.path.join(tmpdir, "model")
            tensorflow.saved_model.save(estimator, model_save_path)
            if isinstance(model, GenomeEstimator):
                # remove estimator to not pickle the tf model
                model.estimator = None
                pickle.dump(model, open(model_save_path + '/' + GENOME_FILE, "wb"))

            shutil.make_archive(os.path.join(tmpdir, 'model-file'), 'zip', model_save_path)
            fileobj = open(tmpdir + "/model-file.zip", 'rb')
            serializedModel = fileobj.read()

        else:

            serializedModel = pickle.dumps(model)



        extractedParams = None
        if "sklearn" in str(type(estimator)).lower():
            extractor = SKMetaExtractor()
            extractedParams = extractor.extract(estimator)
        elif "xgboost" in str(type(estimator)).lower():
            extractor = XGMetaExtractor()
            extractedParams = extractor.extract(estimator)
        elif "lightgbm" in str(type(estimator)).lower():
            extractor = LightGBMMetaExtractor()
            extractedParams = extractor.extract(estimator)
        elif "catboost" in str(type(estimator)).lower():
            extractor = CatBoostMetaExtractor()
            extractedParams = extractor.extract(estimator)

        elif "keras" in str(type(estimator)).lower():
            extractor = TFMetaExtractor()
            extractedParams = extractor.extract(estimator)
        elif "tensorflow" in str(type(estimator)).lower():
            extractor = TFMetaExtractor()
            extractedParams = extractor.extract(estimator)




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
            "inputModality": meta["inputModality"] if "inputModality" in meta else "tabular",
            "dataRefs": [{
              "ref": "s3:/dataset/uuid-123",
              "refType": "mllake"
            }],
        }

        if extractedParams or predictionType:
            modelMeta["parameters"] = {}

        if extractedParams:
            for key, val in extractedParams.items():
              modelMeta["parameters"][key] = val

        if predictionType:
            modelMeta["parameters"]["__prediction_type__"] = predictionType


        reqMeta = urllib.request.Request(modelstore_api + "/v1.0/genome/model")
        reqMeta.add_header(
            'Content-Type',
            'application/json',
        )

        try:
            responseMeta = urllib.request.urlopen(reqMeta, json.dumps(modelMeta).encode('utf-8'))
            data = responseMeta.read()
            modelMetaResp = json.loads(data)
            logging.info("model-id: " + str(modelMetaResp["id"]))
        except URLError as e:
            if hasattr(e, 'reason'):
                logging.info('We failed to reach a server.')
                logging.info('Reason: ' + e.reason)

            if hasattr(e, 'code'):
                logging.info('The server couldn\'t fulfill the request.')
                logging.info('Error code: ' + str(e.code))

            if hasattr(e, 'msg'):
                logging.info('The server couldn\'t fulfill the request.')
                logging.info('Error message: ' + str(e.msg))


            # still throw it
            raise e
