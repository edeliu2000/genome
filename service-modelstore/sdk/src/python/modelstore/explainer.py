
try:
    import shap
except ImportError:
    warnings.warn('shap could not be imported', ImportWarning)


class GenomeExplainer():
    def __init__(self, estimator):

        self.explainer = None

        isTreeBased = "tree" in str(type(estimator)).lower() or "forest" in str(type(estimator)).lower()

        if "sklearn" in str(type(estimator)).lower() and isTreeBased:
            self.explainer = shap.TreeExplainer(estimator)
        elif "xgboost" in str(type(estimator)).lower():
            self.explainer = shap.TreeExplainer(estimator)
        elif "lightgbm" in str(type(estimator)).lower():
            self.explainer = shap.TreeExplainer(estimator)
        elif "catboost" in str(type(estimator)).lower():
            self.explainer = shap.TreeExplainer(estimator)
        
