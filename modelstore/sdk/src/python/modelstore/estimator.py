

class GenomeEstimator():

    def __init__(self, estimator,
      estimator_predict=None,
      feature_names=None,
      target_classes=None,
      explainer=None,
      explanations=None):

        self.estimator = estimator
        self.estimator_predict = estimator_predict
        self.feature_names = feature_names
        self.target_classes = target_classes
        self.explainer = explainer
        self.explanations = explanations
