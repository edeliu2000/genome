import json
import logging

from typing import Mapping, List, Tuple


class BaseRef():
    def __init__(self, ref:str, refType:str):
        self.ref = ref
        self.refType = refType


"""
Data related base objects, Datasets and Segments
"""
class DataRef(BaseRef):
    def __init__(self, ref:str, refType:str):
        super().__init__(ref, refType)


class SegmentFilter():
    def __init__(self, recipeType:str, recipe:str):
        self.recipeType = recipeType
        self.recipe = recipe


class Segment():
    def __init__(self, name:str, filters:List[SegmentFilter]):
        self.name = name
        self.filters = filters


"""
Metrics related base objects, NumericMetric, DistributionMetric, ...
"""


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



"""
Transformation related base objects, CodeRef
"""

class CodeRef(BaseRef):
    def __init__(self, ref:str, refType:str):
        super().__init__(ref, refType)
