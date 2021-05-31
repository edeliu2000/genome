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

try:
    import shap
except ImportError:
    warnings.warn('shap could not be imported', ImportWarning)


try:
    from pyspark.ml import PipelineModel
    from pyspark.sql import SparkSession, SQLContext

    spark = SparkSession.builder.master("local[*]").appName("DTree-Classification-California-Housing").getOrCreate()
    sparkReader = PipelineModel.read().session(spark)

except ImportError:
    warnings.warn('Pyspark PipelineModel cannot be imported', ImportWarning)


from .meta_extractor import SKMetaExtractor
from .meta_extractor import SparkMetaExtractor
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


    def _getModelMeta(self, meta):

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
            return None


        logging.info('Models Found in ModelStore: ' + json.dumps(modelMetaResp) + " len: " + str(len(modelMetaResp)))

        modelMetaArtifact =  modelMetaResp[0]

        return modelMetaArtifact



    def _getModelBlob(self, model_id, modelMetaArtifact, explainer=False):

        model = None

        cacheSuffix = ""
        if explainer:
            cacheSuffix = "explainer"

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


            elif "spark" in modelMetaArtifact["framework"] and not explainer:


                logging.info("initializing spark model:" + model_id)
                start_milli = int(round(time.time() * 1000))
                logging.info("started loading spark model:" + str(start_milli))

                tmpdir = tempfile.mkdtemp()
                z = zipfile.ZipFile(io.BytesIO(model_file))
                logging.info("files in zip:" + str(z.namelist()))
                z.extractall(tmpdir)

                start_milli = int(round(time.time() * 1000))
                logging.info("started using load() model:" + str(start_milli))

                pipelineModel = sparkReader.load(tmpdir)

                logging.info("finished loading spark pipeline from model store:" + str(int(round(time.time() * 1000)) - start_milli) )


                if len(pipelineModel.stages) == 1:
                    pipelineModel = pipelineModel.stages[-1]

                if os.path.isfile(tmpdir + '/' + GENOME_FILE):
                    model = pickle.load(open( tmpdir + '/' + GENOME_FILE, "rb" ))
                    model.estimator = pipelineModel
                else:
                    model = pipelineModel

                logging.info("finished loading genome model from file:" + str(int(round(time.time() * 1000)) - start_milli) )

            else:

                model = pickle.loads(model_file)


            self.cachedModels[model_id] = model
            self.cachedModels[modelMetaArtifact["canonicalName"] + cacheSuffix] = model
            self.cachedModels[modelMetaArtifact["id"] + cacheSuffix] = model
            self.cachedModels["/meta/" + modelMetaArtifact["canonicalName"]] = modelMetaArtifact
            self.cachedModels["/meta/" + modelMetaArtifact["id"]] = modelMetaArtifact


        except URLError as e:
            if hasattr(e, 'reason'):
                logging.info('We failed to reach a server.')
                logging.info('Reason: ' + e.reason)
            elif hasattr(e, 'code'):
                logging.info('The server couldn\'t fulfill the request.')
                logging.info('Error code: ' + str(e.code))



        return model



    def _createBlob(self, blob):

        req = urllib.request.Request(modelstore_api + "/v1.0/genome/blob")
        req.add_header(
            'Content-Type',
            'application/octet-stream',
        )

        response = urllib.request.urlopen(req, blob)
        data = response.read()
        modelResp = json.loads(data)
        logging.info("created blob with blob-id: " + str(modelResp["id"]))

        return modelResp["id"]



    def _handleBlobProperty(self, m, prop:str, refs):
        if getattr(m, prop, None):

            serializedBlob = pickle.dumps(getattr(m, prop))
            setattr(m, prop, None)

            blobRefId = self._createBlob(serializedBlob)
            refs[prop + "Ref"] = blobRefId





    def loadModel(self, meta, withMeta=False, explainer=False):
        return self.load(meta, withMeta=withMeta)

    def loadExplainer(self, meta, withMeta=False):
        return self.load(meta, withMeta=withMeta, explainer=True)

    def load(self, meta, withMeta=False, explainer=False):
        # first check with model store yada-yada
        model = None
        modelMetaArtifact = None

        canonicalName = meta["canonicalName"]
        modelKey = meta["id"] if "id" in meta else None

        cacheKey = modelKey if modelKey else canonicalName
        cacheSuffix = ""
        metaCacheKey = "/meta/" + cacheKey

        blobRefName = "ref"
        if explainer:
            blobRefName = "explainerRef"
            cacheSuffix = "explainer"
            cacheKey = cacheKey + cacheSuffix


        # retrieve from cache if exists
        if metaCacheKey in self.cachedModels and self.cachedModels[metaCacheKey]:
            logging.info("using cached model for: " + metaCacheKey)

            modelMetaArtifact = self.cachedModels[metaCacheKey]

            if modelMetaArtifact["id"] + cacheSuffix in self.cachedModels:
                if withMeta:
                    return self.cachedModels[modelMetaArtifact["id"] + cacheSuffix], modelMetaArtifact

                return self.cachedModels[modelMetaArtifact["id"] + cacheSuffix]




        if "framework" not in meta or "artifactBlob" not in meta:
            if not modelMetaArtifact:
                modelMetaArtifact = self._getModelMeta(meta)

            if not modelMetaArtifact:
                if withMeta:
                    return None, None
                return None

            if blobRefName in modelMetaArtifact["artifactBlob"]:
                model_id = modelMetaArtifact["artifactBlob"][blobRefName]
                logging.info('Model Found in ModelStore: ' + json.dumps(modelMetaArtifact["artifactBlob"]))


        else:
            modelMetaArtifact = meta
            if blobRefName in modelMetaArtifact["artifactBlob"]:
                model_id = modelMetaArtifact["artifactBlob"][blobRefName]




        if model_id:
            logging.info("fetching model from url: " + modelstore_api + "/v1.0/genome/blob/" + model_id)
            model = self._getModelBlob(model_id, modelMetaArtifact, explainer=explainer)


        if withMeta:
            return (model, modelMetaArtifact)


        return model





    def saveModel(self, model, meta):

        # post model blob
        serializedModel = None
        modelClass = None
        ensembleRank = 1
        estimatorClassName = None
        artifactBlob = {}

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


        elif "pyspark" in str(type(estimator)).lower():
            tmpdir = tempfile.mkdtemp()
            model_save_path = os.path.join(tmpdir, "model")

            if not "pipeline" in str(type(estimator)).lower():
              pipe_model = PipelineModel([estimator])
              pipe_model.save(model_save_path)
            else:
              estimator.save(model_save_path)

            if isinstance(model, GenomeEstimator):
                # remove estimator to not pickle the spark model
                model.estimator = None

                # remove explainer to pickle separately
                # self._handleBlobProperty(model, "explainer", artifactBlob)

                # now pickle the model
                pickle.dump(model, open(model_save_path + '/' + GENOME_FILE, "wb"))



            shutil.make_archive(os.path.join(tmpdir, 'model-file'), 'zip', model_save_path)
            fileobj = open(tmpdir + "/model-file.zip", 'rb')
            serializedModel = fileobj.read()


        else:

            serializedModel = pickle.dumps(model)



        blobRefId = self._createBlob(serializedModel)
        artifactBlob["ref"] = blobRefId
        artifactBlob["refType"] = "modelstore"


        extractedParams = None
        if "sklearn" in str(type(estimator)).lower():
            extractor = SKMetaExtractor()
            extractedParams = extractor.extract(estimator)
        elif "pyspark" in str(type(estimator)).lower():
            extractor = SparkMetaExtractor()
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
            "artifactBlob": artifactBlob,
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
            return {"id": str(modelMetaResp["id"])}
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
