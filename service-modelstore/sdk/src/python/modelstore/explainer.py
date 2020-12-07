import warnings
import numpy as np

from typing import Mapping, List, Tuple

try:
    import shap
except ImportError:
    warnings.warn('shap could not be imported', ImportWarning)


try:
    from .eli5.lime import TextExplainer
    from .eli5.formatters.as_dict import format_as_dict
    from .eli5.sklearn.explain_prediction import explain_prediction_linear_classifier
except ImportError:
    warnings.warn('TextExplainer could not be imported', ImportWarning)


try:
    from .eli5.keras import explain_prediction
except ImportError:
    warnings.warn('keras explain_prediction could not be imported', ImportWarning)



# Wrapper to standardize interfaces of eplainer libraries
class GenomeExplainer():

    def __init__(self,
      estimator,
      modality,
      estimator_predict = None,
      feature_names: List[str] = None,
      target_classes: List[str] = None):

        self.estimator_predict = estimator_predict
        self.explainer = None
        self.explanations = None

        self.model_type = None
        self.modality = modality

        self.feature_names = feature_names
        self.target_classes = target_classes

        self.metrics_ = None


        if modality == "tabular":
            if "linear" == self._get_explainer_type(estimator):
                self.explainer = shap.LinearExplainer(estimator)
                self.model_type = "linear"
            elif "tree" == self._get_explainer_type(estimator):
                self.explainer = shap.TreeExplainer(estimator)
                self.model_type = "tree"


        elif modality == "text":
            self.model_type = "nn"
            self.explainer = TextExplainer(random_state=42)


        elif modality == "image":
            self.model_type = "nn"





    def explain(self, input, estimator=None):

        if self.modality == "text":
            # using LIME to train with similar inputs

            if self.estimator_predict:
                predict_func = getattr(estimator, self.estimator_predict)
                self.explainer.fit(input, predict_func)
            else:
                self.explainer.fit(input, self.estimator)



            explanation = None
            if self.target_classes:
                # now explain the prediction
                explanation = self.explainer.explain_prediction(target_names=self.target_classes)
            else:
                explanation = self.explainer.explain_prediction()


            return format_as_dict(explanation)




        elif self.modality == "image":
            # using GradCam to explain images
            return explain_prediction(estimator, input)




        elif self.modality == "tabular":
            return self.explainer.shap_values(input)





    def sampleExplanations(self, input: np.ndarray):

        expected_value = self.explainer.expected_value if self.modality == "tabular" else None

        #convert from numpy to python types for json serialization
        if not isinstance(expected_value, np.ndarray):
            expected_value = expected_value.item() if isinstance(expected_value,np.float32) else expected_value
        else:
            expected_value = expected_value.tolist()


        explanation_values = self.explain(input)
        explanation_values = explanation_values.tolist() if isinstance(explanation_values, np.ndarray) else [a.tolist() for a in explanation_values]

        number_labels = 1 if not isinstance(expected_value, list) else len(expected_value)


        self.explanations = {
           "expected_value": expected_value,
           "shap_values": explanation_values,
           "number_labels": number_labels,
           "feature_names": self.feature_names,
           "feature_values": input.tolist()
        }




    def _get_explainer_type(self, estimator):

        estimatorType = str(type(estimator)).lower()
        isTreeBased = "tree" in estimatorType or "forest" in estimatorType or "gbt" in estimatorType
        isLinear = "logistic" in estimatorType or "linear" in estimatorType

        if "sklearn" in estimatorType and isLinear:
            return "linear"
        elif "sklearn" in estimatorType and isTreeBased:
            return "tree"
        elif "xgboost" in estimatorType:
            return "tree"
        elif "pyspark" in estimatorType and isLinear:
            return "linear"
        elif "pyspark" in estimatorType and isTreeBased:
            return "tree"
        elif "lightgbm" in estimatorType:
            return "tree"
        elif "catboost" in estimatorType:
            return "tree"
