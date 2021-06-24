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

from .base import BaseRef, CodeRef, DataRef, BaseMetric


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


modelstore_api = os.getenv('MODELSTORE')

class Task():

    def __init__(self,
      name: str = None,
      dataRef: DataRef = None,
      segment: str = None,
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



class TaskRun(Task):

    def __init__(self,
      name: str = None,
      dataRef: DataRef = None,
      segment: str = None,
      prototypeRef: BaseRef = None,
      expectations: List[str] = None,
      context: dict = None,
      status:int = 0,
      metrics:dict = None,
      message:str = None):

        super().__init__(
          name = name,
          dataRef = dataRef,
          segment = segment,
          prototypeRef = prototypeRef,
          expectations = expectations,
          context = context)

        self.status = status
        self.metrics = metrics
        self.message = message




class Validation():

    def __init__(self,
      canonicalName: str = None,
      application: str = None,
      versionName: str = None,
      code: CodeRef = None,
      parameters: dict = None,
      inputModality: str = None,
      framework: str = None):

        self.canonicalName = canonicalName
        self.application = application
        self.versionName = versionName
        self.code = code.__dict__ if code else None
        self.parameters = parameters
        self.inputModality = inputModality
        self.framework = framework



    def get_meta(self):
        """
        :return: a dict with all the metadata fields of the test/evaluation object
        """
        meta = {}

        # all props except weights blob and local file are metadata
        for k, v in self.__dict__.items():
            meta[k] = v


        return meta


    def to_json(self):
        return json.dumps(self.get_meta())



class Evaluation(Validation):

    def createRun(self,
      dataRefs: List[DataRef] = None,

      pipelineName: str = None,
      pipelineStage: str = None,
      pipelineRunId: str = None,
      validationTarget: BaseRef = None,
      validationMetrics: List[BaseMetric] = None,
      tasks: List[TaskRun] = None,

      status: int = None,
      context: dict = None,

      user: str = None):

        return EvaluationRun(
          canonicalName = self.canonicalName,
          application = self.application,
          versionName = self.versionName,
          code = self.code,
          parameters = self.parameters,
          inputModality = self.inputModality,
          framework = self.framework,

          dataRefs = dataRefs,
          pipelineName = pipelineName,
          pipelineStage = pipelineStage,
          pipelineRunId = pipelineRunId,
          validationTarget = validationTarget,
          validationMetrics = validationMetrics,
          tasks = tasks,

          status = status,
          context = context,

          user = user
        )





class Test(Evaluation):

    def __init__(self,
      canonicalName: str = None,
      application: str = None,
      versionName: str = None,
      code: CodeRef = None,
      parameters: dict = None,
      dataRefs: List[DataRef] = None,
      inputModality: str = None,
      framework: str = None):

        super().__init__(
          canonicalName = canonicalName,
          application = application,
          versionName = versionName,
          code = code,
          parameters = parameters,
          inputModality = inputModality,
          framework = framework)

        self.dataRefs = [ d.__dict__ for d in dataRefs ] if dataRefs else None



    def createRun(self,

      pipelineName: str = None,
      pipelineStage: str = None,
      pipelineRunId: str = None,
      validationTarget: BaseRef = None,
      validationMetrics: List[BaseMetric] = None,
      tasks: List[TaskRun] = None,

      status: int = None,
      context: dict = None,

      user: str = None):


        return TestRun(
          canonicalName = self.canonicalName,
          application = self.application,
          versionName = self.versionName,
          code = self.code,
          parameters = self.parameters,
          inputModality = self.inputModality,
          framework = self.framework,
          dataRefs = [DataRef(d["ref"], d["refType"]) for d in self.dataRefs] if self.dataRefs else None,

          pipelineName = pipelineName,
          pipelineStage = pipelineStage,
          pipelineRunId = pipelineRunId,
          validationTarget = validationTarget,
          validationMetrics = validationMetrics,
          tasks = tasks,

          status = status,
          context = context,

          user = user
        )




class EvaluationRun(Test):

    def __init__(self,
      canonicalName: str = None,
      application: str = None,
      versionName: str = None,
      code: CodeRef = None,
      parameters: dict = None,
      dataRefs: List[DataRef] = None,

      pipelineName: str = None,
      pipelineStage: str = None,
      pipelineRunId: str = None,
      validationTarget: BaseRef = None,
      validationMetrics: List[BaseMetric] = None,
      tasks: List[TaskRun] = None,

      inputModality: str = None,
      framework: str = None,
      status: int = None,
      context: dict = None,

      user: str = None):



        super().__init__(
          canonicalName = canonicalName,
          application = application,
          versionName = versionName,
          code = code,
          parameters = parameters,
          dataRefs = dataRefs)



        self.pipelineName = pipelineName
        self.pipelineStage = pipelineStage
        self.pipelineRunId = pipelineRunId

        self.validationTarget = validationTarget.__dict__ if validationTarget else None
        self.validationMetrics = [m.get_meta() for m in validationMetrics] if validationMetrics else []
        self.tasks = [task.get_meta() for task in tasks] if tasks else None

        self.inputModality = inputModality
        self.framework = framework
        self.status = status
        self.context = context if context else None
        self.user = user if user else None


    def add_metric(self, metric: BaseMetric):
        """
        :param metric: adds the provided metric object to overall list of metrics
        :return:
        """

        self.validationMetrics.append(metric.get_meta())


    def add_task(self, task: TaskRun):
        """
        :param task: adds the provided task run
        :return:
        """
        if self.tasks:
            self.tasks.append(task.get_meta())
        else:
            self.tasks = [task.get_meta()]



class TestRun(EvaluationRun):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)







class EvaluationStore():

    def __init__(self):
        self.cachedModels = {}


    def _getEvaluationMeta(self, meta):

        # post model metadata
        evaluationMeta = {
            "canonicalName": meta["canonicalName"] if "canonicalName" in meta else "modelPipeline",
            "artifactType": meta["artifactType"] if "artifactType" in meta else "testRun",
            "application": meta["application"] if "application" in meta else "modelPipeline"
        }

        reqMeta = urllib.request.Request(modelstore_api + "/v1.0/genome/search-validations")
        reqMeta.add_header(
            'Content-Type',
            'application/json',
        )

        responseMeta = urllib.request.urlopen(reqMeta, json.dumps(evaluationMeta).encode('utf-8'))
        data = responseMeta.read()
        evaluationMetaResp = json.loads(data)

        if not evaluationMetaResp or len(evaluationMetaResp) == 0:
            logging.info('No Test/Evaluation Found in EvaluationStore: ' + json.dumps(evaluationMeta))
            return None


        logging.info('Test/Evaluation Found in EvaluationStore: ' + json.dumps(evaluationMetaResp) + " len: " + str(len(evaluationMetaResp)))

        evaluationMetaArtifact = evaluationMetaResp[0]

        return evaluationMetaArtifact




    def load(self, meta):
        # first check with model store yada-yada
        evaluation = None
        evaluationMetaArtifact = None

        canonicalName = meta["canonicalName"]
        evaluationKey = meta["id"] if "id" in meta else None


        evaluationMetaArtifact = self._getEvaluationMeta(meta)

        return evaluationMetaArtifact





    def save(self, evaluation: Evaluation):

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
