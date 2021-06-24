import json
import logging



class BaseRef():
    def __init__(self, ref:str, refType:str):
        self.ref = ref
        self.refType = refType

class DataRef(BaseRef):
    def __init__(self, ref:str, refType:str):
        super().__init__(ref, refType)


class CodeRef(BaseRef):
    def __init__(self, ref:str, refType:str):
        super().__init__(ref, refType)


class BaseMetric():
    def __init__(self, name, value):
        self.name = name
        self.value = value


    def get_meta(self):
        """
        :return: a dict with the fields of the metric object
        """
        meta = {}

        # all props are metadata
        for k, v in self.__dict__.items():
            meta[k] = v


        return meta



class NumericMetric(BaseMetric):
    def __init__(self, name:str, value:float):
        super().__init__(name, value)
