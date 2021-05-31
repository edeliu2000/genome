import os
import json
import functools
import logging

import inspect
import ast


from .evaluationstore import EvaluationRun, TestRun, TaskRun
from .evaluationstore import EvaluationStore
from .evaluationstore import BaseRef, CodeRef, DataRef, BaseMetric


class TaskExpectation():

    def __init__(self, value, var=None):

        self.status = -1
        self.message = None


        self._expectationStruct = {
          "expect": ("{" + f"{var}:{value}" + "}") if var else f"{value}",
          "expect_value": value
        }

        self._check_types = {
          "to_be": {"name":"=", "func": lambda a, b: a == b},
          "to_be_less": {"name":"<", "func": lambda a, b: a < b},
          "to_be_less_or_equal": {"name":"<", "func": lambda a, b: a <= b},
          "to_be_greater": {"name":">", "func": lambda a, b: a > b},
          "to_be_greater_or_equal": {"name":">", "func": lambda a, b: a >= b},
          "to_contain": {"name":"in", "func": lambda a, b: b in a},
          "to_throw": {"name":"throws", "func": self.check_raise},
        }


    def expectation_str(self):

        check = list(filter(lambda a: not "expect" in a[0], self._expectationStruct.items()))
        check_str = ""

        if len(check):
            check_str = check[0][1]

        return str(self._expectationStruct["expect"]) + " " + str(check_str)



    def check_raise(self, f, err):
        try:
            f()
            return False
        except Exception as e:

            if not err:
                return True
            elif isinstance(err, Exception):
                return type(e) is type(err) and e.args == err.args
            elif isinstance(err, type):
                return type(e) == err

            return False



    def get_status(self):
        return self.status


    def check(self, value, var=None, check_type="to_be"):

        check = self._check_types[check_type]["name"]
        self._expectationStruct[check_type] = check + " " + (("{" + f"{var}:{value}" + "}") if var else f"{value}")

        #executing the check function
        check_result = self._check_types[check_type]["func"](self._expectationStruct["expect_value"], value)

        self.status = 1 if check_result else 0
        return self



    def toBe(self, value, var=None):
        return self.check(value, var=var)

    def toBeLess(self, value, var=None):
        return self.check(value, var=var, check_type="to_be_less")

    def toBeLessOrEqual(self, value, var=None):
        return self.check(value, var=var, check_type="to_be_less_or_equal")

    def toBeGreater(self, value, var=None):
        return self.check(value, var=var, check_type="to_be_greater")

    def toBeGreaterOrEqual(self, value, var=None):
        return self.check(value, var=var, check_type="to_be_greater_or_equal")

    def toContain(self, value, var=None):
        return self.check(value, var=var, check_type="to_contain")

    def toThrow(self, value, var=None):
        return self.check(value, var=var, check_type="to_throw")

    def toRaise(self, value, var=None):
        return self.check(value, var=var, check_type="to_throw")




class GenomeTask():

    def __init__(self, name=None, dataset=None, segment=None, proto=None):
        self.name = name
        self.dataset = dataset
        self.segment = segment
        self.proto = proto

        self.metrics = {}
        self.expectation = None

        self.prototypes = []


    def get_task(self):

        return TaskRun(
          name = self.name,
          dataRef = self.dataset,
          segment = self.segment,
          prototypeRef = BaseRef(self.proto["ref"], self.proto["refType"]) if self.proto else None,
          expectation = self.expectation.expectation_str(),
          status = self.expectation.get_status(),
          metrics = self.metrics
        )


    def to_json(self):

        return json.dumps({
          "name": self.name,
          "dataset": self.dataset.__dict__,
          "segment": self.segment.__dict__ if self.segment else None,
          "expectation": self.expectation.expectation_str(),
          "status": self.expectation.get_status(),
          "metrics": self.metrics
        })



    def prototype(self, name = None, ref = None, refType = "id"):

        logging.info(f"prototype creation: ref={ref}")

        clone = GenomeTask(name = name or self.name,
          dataset = self.dataset,
          segment = self.segment,
          proto = {"ref":ref, "refType": refType})

        self.prototypes.append(clone)

        logging.info(f"prototype created: ref={ref}")

        return clone

    def add_metric(self, name, val):
        self.metrics[name] = val
        return self


    def expect(self, value, var=None):
        self.expectation = TaskExpectation(value, var=var)
        return self.expectation



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
        module = __import__(flow.__module__)
        tree = ast.parse(inspect.getsource(module)).body
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
            status = t.expectation.get_status() if t.expectation and t.expectation.get_status() < status else status
            dsets.append(t.dataset)
            tasks.append(t.get_task())
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
