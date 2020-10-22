import sys
import logging
import warnings

try:
    from sklearn.base import BaseEstimator
except ImportError:
    warnings.warn('sklearn could not be imported', ImportWarning)


try:
    import xgboost
except ImportError:
    warnings.warn('xgboost could not be imported', ImportWarning)


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)



class ModelMetaExtractor():

    def extract(self, model):
        pass


# sklearn
class SKMetaExtractor(ModelMetaExtractor):

    def _modelClass(self, estimator):

        modelClass = None
        artifact = estimator

        if "ensemble" in str(type(estimator)).lower():
            modelClass = "ensemble"
        elif "tree" in str(type(estimator)).lower():
            modelClass = "tree"
        elif "linear" in str(type(estimator)).lower():
            modelClass = "linear"
        elif "svm." in str(type(estimator)).lower():
            modelClass = "svm"
        elif "pipeline" in str(type(estimator)).lower():
            modelClass = "pipeline" if not modelClass else modelClass
            logging.info("sklearn pipeline transform-class: " + str(type(estimator)))

            for transformation in estimator:
                if isinstance(transformation, BaseEstimator):
                    cls, child_transform = self._modelClass(transformation)
                    if cls:
                        modelClass = cls
                        artifact = child_transform
                        logging.info("pipeline model-class: " + str(modelClass))


        return (modelClass, artifact)



    def extract(self, estimator):
        meta = {}

        modelClass, child_estimator = self._modelClass(estimator)
        ensembleRank = len(child_estimator.estimators_) if "ensemble" == modelClass else 1
        estimatorClassName = str(type(child_estimator).__name__.split(".")[-1])


        meta["__estimator_category__"] = "ensemble"
        meta["__num_estimators__"] = ensembleRank
        meta["__estimator_class_name__"] = estimatorClassName
        return meta


# xg boost
class XGMetaExtractor(ModelMetaExtractor):

    def extract(self, estimator):
        meta = {}
        meta["__estimator_category__"] = "ensemble"
        boosted_trees = estimator.get_dump()
        ensembleRank = len(boosted_trees)
        meta["__num_estimators__"] = ensembleRank
        meta["__estimator_class_name__"] = "XGBoost"
        return meta


# tensorflow
class TFMetaExtractor(ModelMetaExtractor):

    def extract(self, estimator):
        meta = {}
        meta["__estimator_category__"] = "neural-network"
        meta["__estimator_class_name__"] = "NeuralNetwork"
        return meta


# lightgbm
class LightGBMMetaExtractor(ModelMetaExtractor):

    def extract(self, estimator):
        meta = {}
        meta["__estimator_category__"] = "ensemble"
        meta["__estimator_class_name__"] = "LightGBM"
        meta["__num_estimators__"] = 1
        return meta


# cat boost
class CatBoostMetaExtractor(ModelMetaExtractor):

    def extract(self, estimator):
        meta = {}
        meta["__estimator_category__"] = "ensemble"
        meta["__estimator_class_name__"] = "CatBoost"
        meta["__num_estimators__"] = 1

        return meta
