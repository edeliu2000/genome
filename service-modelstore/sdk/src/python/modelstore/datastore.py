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

from typing import Mapping, List, Tuple

from .base import BaseRef, CodeRef, DataRef, Segment, BaseMetric


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


modelstore_api = os.getenv('MODELSTORE')

class Dataset():

    def __init__(self,
      name: str = None,
      dataRef: DataRef = None,
      segment: Segment = None,
      prototypeRef: BaseRef = None,
      expectations: List[str] = None,
      context: dict = None):

        self.name = name
        self.dataRef = dataRef.__dict__ if dataRef else None
        self.segment = segment
        self.prototypeRef = prototypeRef.__dict__ if prototypeRef else None
        self.expectations = expectations
        self.context = context


    def get_meta(self):
        """
        :return: a dict with all the metadata fields of the task object
        """
        meta = {}

        # all props except weights blob and local file are metadata
        for k, v in self.__dict__.items():
            meta[k] = v


        return meta



class DataArtifact():

    def __init__(self,
      canonicalName: str = None,
      application: str = None,
      pipelineName: str = None,
      pipelineRunId: str = None,
      pipelineStage: str = None,
      versionName: str = None,
      dataset: Dataset = None,

      artifactRef: DataRef = None,

      dataRefs: List[DataRef] = None,
      context: dict = None,
      metrics:dict = None):

        self.canonicalName = canonicalName
        self.application = application
        self.pipelineName = pipelineName
        self.pipelineRunId = pipelineRunId
        self.pipelineStage = pipelineStage
        self.versionName = versionName

        self.dataset = dataset
        self.dataRefs = dataRefs
        self.context = context
        self.metrics = metrics


class DataStore():

    def __init__(self):
        pass


    def _get_dataset_meta(self, meta):

        # post model metadata
        data_query = {
            "canonicalName": meta["canonicalName"] if "canonicalName" in meta else "modelPipeline",
            "artifactType": meta["artifactType"] if "artifactType" in meta else "dataset",
            "application": meta["application"] if "application" in meta else "modelPipeline"
        }

        reqMeta = urllib.request.Request(modelstore_api + "/v1.0/genome/search-validations")
        reqMeta.add_header(
            'Content-Type',
            'application/json',
        )

        responseMeta = urllib.request.urlopen(reqMeta, json.dumps(data_query).encode('utf-8'))
        data = responseMeta.read()
        dataset_meta_resp = json.loads(data)

        if not dataset_meta_resp or len(dataset_meta_resp) == 0:
            logging.info('No dataset found in DataStore: ' + json.dumps(data_query))
            return None


        logging.info('dataset found in DataStore: ' + json.dumps(dataset_meta_resp) + " len: " + str(len(dataset_meta_resp)))

        datasetArtifact = dataset_meta_resp[0]

        return datasetArtifact




    def get_dataset(self, meta):
        # first check with model store yada-yada
        evaluation = None
        evaluationMetaArtifact = None

        canonicalName = meta["canonicalName"]
        evaluationKey = meta["id"] if "id" in meta else None


        datasetArtifact = self._get_dataset_meta(meta)

        return datasetArtifact


    def load_artifacts(self, dataset:Dataset, from = None, to = None, limit = None):
        # first check with model store yada-yada
        evaluation = None
        evaluationMetaArtifact = None

        canonicalName = meta["canonicalName"]
        datasetKey = meta["id"] if "id" in meta else None


        data_artifacts = self._get_dataset_meta(meta)
        # convert to pd.dataframe or spark dataframe

        return data_artifacts


    def _load_artifacts(self, artifacts: List[DataArtifact]):
        # first check with model store yada-yada
        evaluation = None
        evaluationMetaArtifact = None

        canonicalName = meta["canonicalName"]
        evaluationKey = meta["id"] if "id" in meta else None


        evaluationMetaArtifact = self._getEvaluationMeta(meta)

        return evaluationMetaArtifact



    def create_dataset(self, evaluation: Evaluation):

        # post model blob
        serializedModel = None
        modelClass = None
        ensembleRank = 1
        estimatorClassName = None
        artifactBlob = {}

        # post model metadata

        artifactType = "evaluationRun"
        if isinstance(evaluation, TestRun):
            artifactType = "testRun"
        elif isinstance(evaluation, EvaluationRun):
            artifactType = "evaluationRun"
        elif isinstance(evaluation, Test):
            artifactType = "test"
        elif isinstance(evaluation, Evaluation):
            artifactType = "evaluation"



        reqMeta = urllib.request.Request(modelstore_api + "/v1.0/genome/" + artifactType)
        reqMeta.add_header(
            'Content-Type',
            'application/json',
        )

        try:
            responseMeta = urllib.request.urlopen(reqMeta, evaluation.to_json().encode('utf-8'))
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
