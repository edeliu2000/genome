from typing import Mapping, List, Tuple

from .explainer import GenomeExplainer
from .visualizer import Viz3Model

class GenomeEstimator():

    def __init__(self, estimator,
      estimator_predict = None,
      data_preprocessor = None,
      explainer = None,
      feature_names: List[str] = None,
      target_classes: List[str] = None,
      target_name: str = None,
      modality: ('tabular', 'image', 'text') = "tabular"):

        self.estimator = estimator
        self.data_preprocessor = data_preprocessor
        self.estimator_predict = estimator_predict
        self.feature_names = feature_names
        self.target_name = target_name
        self.target_classes = target_classes
        self.explainer = explainer

        if not explainer:
            self.explainer = GenomeExplainer(
                estimator,
                modality,
                estimator_predict=estimator_predict,
                feature_names=feature_names,
                target_name=target_name,
                target_classes=target_classes)





    def explain(self, input):
        processed = input
        if self.data_preprocessor:
            processed = self.data_preprocessor(input)

        return self.explainer.explain(processed, self.estimator)





    def viz3_graph(self, estimator, tree_index=0):

        viz3Model = Viz3Model(estimator,
                      feature_names = self.feature_names,
                      target_name = self.target_name,
                      target_classes = self.target_classes)

        return viz3Model.viz3_graph(estimator, tree_index=tree_index)
