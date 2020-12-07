from typing import Mapping, List, Tuple

from .explainer import GenomeExplainer

class GenomeEstimator():

    def __init__(self, estimator,
      estimator_predict = None,
      data_preprocessor = None,
      explainer = None,
      feature_names: List[str] = None,
      target_classes: List[str] = None,
      modality: ('tabular', 'image', 'text') = "tabular"):

        self.estimator = estimator
        self.data_preprocessor = data_preprocessor
        self.estimator_predict = estimator_predict
        self.feature_names = feature_names
        self.target_classes = target_classes
        self.explainer = explainer

        if not explainer:
            self.explainer = GenomeExplainer(
                estimator,
                modality,
                estimator_predict=estimator_predict,
                feature_names=feature_names,
                target_classes=target_classes)



    def explain(self, input):
        processed = input
        if self.data_preprocessor:
            processed = self.data_preprocessor(input)

        return self.explainer.explain(processed, self.estimator)
