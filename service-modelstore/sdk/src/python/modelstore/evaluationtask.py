import logging


from .base import BaseRef, CodeRef, DataRef, BaseMetric
from .evaluationstore import TaskRun



class TaskExecutor():

    def execute(self, dataset:DataRef, parameters: dict):
        pass

class PandasExecutor(TaskExecutor):

    def __init__(self, execution_engine, recipe:str):
        self.engine = execution_engine
        self.recipe = recipe


class SparkSQLExecutor(TaskExecutor):

    def __init__(self, execution_engine, recipe:str):
        self.engine = execution_engine
        self.recipe = recipe

    def execute(self, dataset:DataRef, parameters: dict):

        parquetFile = self.engine.read.parquet(dataset.ref)
        view_name = "DatasetTempView"
        # Parquet files can also be used to create a temporary view and then used in SQL statements.
        parquetFile.createOrReplaceTempView(view_name)

        configs = {
           "DATASET":view_name,
           "PARAMETERS": parameters
        }

        df = self.engine.sql(self.recipe.format(**configs))

        #convert to dict with first and second columns as key/values
        values_dict = df.rdd.map(lambda x: {x[0]: x[1]}).collect()

        final_dict = {}
        # flatten list of objects into a single object
        # example [{a:b}, {c:d}] -> {a:b, c:d}
        for entry in values_dict:
            for key in entry:
                final_dict[key] = entry[key]


        return final_dict





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
        self.expectations = []

        self.prototypes = []


    def get_task(self):

        expectation_statuses = [exp.get_status() for exp in self.expectations] or [-1]

        return TaskRun(
          name = self.name,
          dataRef = self.dataset,
          segment = self.segment,
          prototypeRef = BaseRef(self.proto["ref"], self.proto["refType"]) if self.proto else None,
          expectations = [{
            "__type__":"genome_recipe",
            "recipe": exp.expectation_str()} for exp in self.expectations],
          status = 0 if 0 in expectation_statuses else min(expectation_statuses),
          metrics = self.metrics
        )


    def to_json(self):

        expectation_statuses = [exp.get_status() for exp in self.expectations] or [-1]

        return json.dumps({
          "name": self.name,
          "dataset": self.dataset.__dict__,
          "segment": self.segment.__dict__ if self.segment else None,
          "expectations": [{
            "__type__":"genome_recipe",
            "recipe": exp.expectation_str()} for exp in self.expectations],
          "status": 0 if 0 in expectation_statuses else min(expectation_statuses),
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
        t = TaskExpectation(value, var=var)
        self.expectations.append(t)
        return t
