from collections import defaultdict
from typing import List, Mapping

import numpy as np

from .sampled_tree import SampledModelTree


class SampledSKDecisionTree(SampledModelTree):
    def __init__(self, tree_model,
                 x_data,
                 y_data,
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):

        self.is_fit_ =  getattr(tree_model, 'tree_') is not None
        self.thresholds_ =  tree_model.tree_.threshold
        self.features_ = tree_model.tree_.feature
        self.tree_model = tree_model

        super().__init__(tree_model, x_data, y_data, feature_names, target_name, class_names)

        if feature_names == None:
            self.feature_names = ["f{" + str(f) + "}" for f in range(tree_model.n_features_)]


        self.leaf_s_counts_ = self.get_leaf_sample_counts()


    def model_type(self) -> str:
        return "tree"


    def is_fit(self):
        return self.is_fit_


    def is_classifier(self):
        return self.nclasses() > 1


    def get_thresholds(self):
        return self.thresholds_


    def get_features(self):
        return self.features_


    def criterion(self):
        return self.tree_model.criterion.upper()


    def get_class_weights(self):
        pass

    def get_class_weight(self):
        return self.tree_model.class_weight


    def nclasses(self):
        return self.tree_model.tree_.n_classes[0]


    def classes(self):
        if self.is_classifier():
            return self.tree_model.classes_

    def get_node_nsamples(self, id):
        return self.tree_model.tree_.n_node_samples[id]

    def get_node_impurity(self, id):
        return self.tree_model.tree_.impurity[id]

    def get_children_left(self):
        return self.tree_model.tree_.children_left

    def get_children_right(self):
        return self.tree_model.tree_.children_right

    def get_node_split(self, id) -> (int, float):
        return self.tree_model.tree_.threshold[id]

    def get_node_feature(self, id) -> int:
        return self.tree_model.tree_.feature[id]

    def get_node_nsamples_by_class(self, id):
        if self.is_classifier():
            return self.tree_model.tree_.value[id][0]


    def get_leaf_sample_counts(self):
        # cache to speed up rendering of graphviz
        if getattr(self, "leaf_s_counts_", None):
            return self.leaf_s_counts_

        return super().get_leaf_sample_counts()


    def get_prediction(self, id):
        if self.is_classifier():
            counts = self.tree_model.tree_.value[id][0]
            return np.argmax(counts)
        else:
            return self.tree_model.tree_.value[id][0][0]

    def nnodes(self):
        return self.tree_model.tree_.node_count

    def get_node_criterion(self, id):
        return self.tree_model.tree_.impurity[id]

    def get_max_depth(self):
        return self.tree_model.max_depth

    def get_min_samples_leaf(self):
        return self.tree_model.min_samples_leaf

    def shouldGoLeftAtSplit(self, id, x):
        return x < self.get_node_split(id)
