import logging
import time

import numpy as np
import warnings

from typing import Mapping, List, Tuple


try:
    from .viz3.sampled_sk_tree import SampledSKDecisionTree
    from .viz3.linear_model_tree import LinearSKTree
    from .viz3.pipeline_model import PipelineSKTree
except ImportError:
    warnings.warn('sklearn could not be imported', ImportWarning)


try:
    from .viz3.sampled_xgb_tree import SampledXGBDecisionTree
except ImportError:
    warnings.warn('xgb sampled tree could not be imported', ImportWarning)

try:
    from .viz3.sampled_spark_tree import SampledSparkDecisionTree
except ImportError:
    warnings.warn('SampledSparkDecisionTree could not be imported', ImportWarning)


from .meta_extractor import SparkMetaExtractor
from .meta_extractor import SKMetaExtractor


class VisualizationNotSupported(Exception):
    pass



class Viz3Model():

    def __init__(self, estimator,
      feature_names: List[str] = None,
      target_name: str = None,
      target_classes: List[str] = None):

      self.feature_names =feature_names
      self.target_name = target_name
      self.target_classes = target_classes

      # here calculate vizGraph for all indexes


    def _viz3_model(self, estimator, tree_index=0):
        viz3Model = None


        modelToVisualize = estimator[-1] if "pipeline" in type(estimator).__name__.lower() else estimator
        logging.info("type of model to visualize:" + type(estimator).__name__.lower())


        # sklearn models
        if "sklearn" in str(type(estimator)).lower():

            extractor = SKMetaExtractor()
            meta = extractor.extract(modelToVisualize)
            estimatorCategory = meta["__estimator_category__"]


            if "ensemble" == estimatorCategory:
                modelToVisualize = extractor.getTreeFromEnsemble(modelToVisualize, tree_index)


            if "ensemble" == estimatorCategory or "tree" == estimatorCategory:
                viz3Model = SampledSKDecisionTree(
                    modelToVisualize,
                    np.array([[1.0 for i in range(modelToVisualize.n_features_)]]),
                    np.array([1.0]),
                    feature_names = self.feature_names,
                    target_name = self.target_name,
                    class_names = self.target_classes)


            elif "linear" == estimatorCategory:

                viz3Model = LinearSKTree(
                       modelToVisualize,
                       feature_names = self.feature_names,
                       target_name = self.target_name,
                       class_names = self.target_classes)

            else:
                raise VisualizationNotSupported("Visualization not supported: ", estimatorCategory)



        # xgboost
        elif "xgboost" in str(type(estimator)).lower():

            fake_input = np.array([[1.0 for i in range(len(self.feature_names) or 10)]])

            viz3Model = SampledXGBDecisionTree(
               modelToVisualize,
               tree_index,
               fake_input,
               np.array([1.0]),
               feature_names = self.feature_names,
               target_name = self.target_name,
               class_names = self.target_classes)



        # spark
        elif "pyspark" in str(type(estimator)).lower():

            fake_input = np.array([[1.0 for i in range(14)]])

            start_milli = int(round(time.time() * 1000))
            logging.info("started creating shadow tree:" + str(start_milli))

            extractor = SparkMetaExtractor()
            meta = extractor.extract(modelToVisualize)
            estimatorCategory = meta["__estimator_category__"]


            if "ensemble" == estimatorCategory:
               modelToVisualize = extractor.getTreeFromEnsemble(modelToVisualize, tree_index)


            viz3Model = SampledSparkDecisionTree(
               modelToVisualize,
               fake_input,
               np.array([1.0]),
               feature_names = self.feature_names,
               target_name = self.target_name,
               class_names = self.target_classes)

            logging.info("finished creating shadow spark tree:" + str(int(round(time.time() * 1000)) - start_milli) )




        # now return the viz3 intermediate representation
        return viz3Model



    def viz3_graph(self, estimator, tree_index=0):

        vizGraph = None
        start_milli = int(round(time.time() * 1000))
        logging.info("type of model to visualize:" + type(estimator).__name__.lower())


        # sklearn models
        if "sklearn" in str(type(estimator)).lower():

            # use dummy data, instead sample data from tree node stats
            viz3Model = self._viz3_model(estimator, tree_index=tree_index)
            vizGraph = viz3Model.modelGraph(precision=2)


            # if model is actually a pipline retrieve the last pipline transform
            if "pipeline" in type(estimator).__name__.lower():
                pipelineTree = PipelineSKTree(estimator, target_name = self.target_name if self.target_name else "target")
                pipeGraph = pipelineTree.modelGraph(precision=2)
                vizGraph["pipeline"] = pipeGraph

        else:
            viz3Model = self._viz3_model(estimator, tree_index=tree_index)
            vizGraph = viz3Model.modelGraph()
            logging.info("finished visualizing shadow spark tree:" + str(int(round(time.time() * 1000)) - start_milli) )



        return vizGraph



    def predict(self, estimator, x: np.ndarray, tree_index:int=0):

        model = self._viz3_model(estimator, tree_index=tree_index)
        return model.predict(x)
