import os
import json
import functools
import logging

import inspect
import ast


from .base import BaseRef, CodeRef, DataRef, BaseMetric

from .evaluationstore import EvaluationRun, TestRun, TaskRun
from .evaluationstore import EvaluationStore

from .evaluationtask import GenomeTask


# art of stealing :)
class GraphNode(object):
    def __init__(self, func_ast, decos, doc):
        self.name = func_ast.name
        self.func_lineno = func_ast.lineno
        self.decorators = decos
        self.doc = doc


class GraphVisitor(ast.NodeVisitor):

    def __init__(self, nodes, flow):
        self.nodes = nodes
        self.flow = flow
        super(GraphVisitor, self).__init__()


    def _is_task(self, decos):
        for dec in decos:
            if getattr(dec, "func", None) and (isinstance(dec.func, ast.Name)
               and dec.func.id in ['task']):
                # function decorated with step
                return True
            elif not getattr(dec, "func", None) and (isinstance(dec, ast.Name)
               and dec.id in ['task']):

                # function decorated with step
                return True


        return False

    def visit_FunctionDef(self, node):
        func = getattr(self.flow, node.name)
        if self._is_task(node.decorator_list):
            self.nodes[node.name] = GraphNode(node, node.decorator_list, func.__doc__)



"""
class representing an evaluation class definition
containing methods annotated with the @task decorator
"""
class EvaluationGraph(object):

    def __init__(self, flow):
        self.name = flow.__name__
        self.nodes = self._create_nodes(flow)

    def _create_nodes(self, flow):
        tree = ast.parse(inspect.getsource(flow)).body
        root = [n for n in tree\
                if isinstance(n, ast.ClassDef) and n.name == self.name][0]
        nodes = {}
        GraphVisitor(nodes, flow).visit(root)
        return nodes


    def __getitem__(self, x):
        return self.nodes[x]

    def __contains__(self, x):
        return x in self.nodes

    def __iter__(self):
        return iter(self.nodes.values())




class GenomeEvaluationRun():
    def __init__(self, store, target=None):
        self.store = store if store else EvaluationStore()
        self._graph = EvaluationGraph(self.__class__)

        self.tasks = []

        if target:
            self.target = {"ref": target, "refType": "model"}


    def add_task(self, task: GenomeTask):
        self.tasks.append(task)



    def to_run(self):
        #execute all tasks
        for t in self._graph:
            task_to_run = getattr(self, t.name)
            #empty args will be prefilled by decorators at runtime
            task_to_run(None, None)


        code = None
        if self.code and "ref" in self.code:
            code = CodeRef(self.code["ref"], "docker")

        targetModel = None
        if self.target and "ref" in self.target:
            targetModel = BaseRef(self.target["ref"], self.target["refType"])


        status = 1
        dsets = []
        metrics = []
        tasks = []
        for t in self.tasks:
            task_run = t.get_task()
            status = task_run.status if task_run.status < status else status
            dsets.append(t.dataset)
            tasks.append(task_run)
            for m in t.metrics:
                metrics.append(BaseMetric(m, t.metrics[m]))


        runCls = EvaluationRun
        if isinstance(evaluation, GenomeTestRun):
            runCls = TestRun

        run = runCls(

          canonicalName = self.canonicalName,
          application = self.application,
          versionName = self.versionName,
          inputModality = self.inputModality,
          framework = self.framework,
          status = status,

          code = code,
          parameters = self.parameters,
          dataRefs = dsets,
          tasks = tasks,

          pipelineName = self.pipelineName or "pipeline-a",
          pipelineStage = self.pipelineStage or "stage-a",
          pipelineRunId = self.pipelineRunId or "run-a",
          validationTarget = targetModel,
          validationMetrics = metrics
        )


        logging.info(run.to_json())
        self.store.save(run)

        #add tasks from run
        return run



class GenomeTestRun(GenomeEvaluationRun):
    def __init__(self, store, target=None):
        super().__init__(store, target=target)



def task(name="", dataset=None, segment=None):
    """
    decorator for test or evaluation tasks
    transform steps are always performed on isolated container/compute
    name: task name
    dataset: dataset definition to load
    """
    def deco_task(func):
        @functools.wraps(func)
        def wrapper_task(*args, **kwargs):

            func_name = func.__name__
            task_name = name if name else func_name
            logging.info(f"calling task: {task_name}")

            obj = args[0]
            data = None
            if dataset and "ref" in dataset:
                data = DataRef(dataset["ref"], "mllake")

            task = GenomeTask(name=task_name, dataset=data, segment=segment)

            result = func(obj, task, data, **kwargs)


            obj.add_task(task)
            for t in task.prototypes:
                obj.add_task(t)


            logging.info(f"completed task: {task_name}")



        return wrapper_task
    return deco_task



def evaluation(
  name = "",
  parameters = None,
  targetModel = None,
  application = None,
  versionName = None,
  code = None,
  pipelineName = None,
  pipelineStage = None,
  pipelineRunId = None,
  inputModality = None,
  framework = None):

    def f(cls):
        cls.canonicalName = name
        cls.parameters = parameters
        cls.target = {"ref": targetModel, "refType": "model"} if targetModel else None

        cls.application = application or os.getenv('APPLICATION')
        cls.versionName = versionName or os.getenv('versionName')

        if code:
            cls.code = {"ref":code, "refType":"docker"}
        else:
            cls.code = os.getenv('CODE')

        cls.pipelineName = pipelineName or os.getenv('PIPELINE_NAME')
        cls.pipelineStage = pipelineStage or os.getenv('STEP_NAME')
        cls.pipelineRunId = pipelineRunId or os.getenv('PIPELINE_RUNID')

        cls.inputModality = inputModality or os.getenv('inputModality')
        cls.framework = framework or os.getenv('framework')


        return cls

    return f
