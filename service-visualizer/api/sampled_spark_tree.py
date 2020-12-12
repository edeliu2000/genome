from abc import ABC
from collections import defaultdict
from typing import List, Mapping

import numpy as np
import warnings


try:
    import pyspark
except ImportError:
    warnings.warn('pyspark could not be imported', ImportWarning)


from .sampled_tree import SampledDecisionTree


class SampledSparkDecisionTree(SampledDecisionTree):

    def __init__(self, tree_model,
                 x_data,
                 y_data,
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):

        self.numNodes = tree_model.numNodes
        self.numClasses = tree_model.numClasses if self._is_classifier(tree_model) else 1
        self._pyspark_version = SampledSparkDecisionTree._get_pyspark_major_version()
        self.is_fit_ = self._is_fit(tree_model)
        self.is_classifier_ = self._is_classifier(tree_model)
        self.impurity_ = self._get_tree_model_parameter_value("impurity", tree_model, self._pyspark_version)
        self.maxDepth_ = self._get_tree_model_parameter_value("maxDepth", tree_model, self._pyspark_version)
        self.minInstancesPerNode_ = self._get_tree_model_parameter_value("minInstancesPerNode", tree_model, self._pyspark_version)
        self.tree_nodes, self.children_left, self.children_right = self._get_nodes_info(tree_model, self._pyspark_version)

        self.features_ = self._get_features()
        self.thresholds_ = self._get_thresholds()
        self.node_to_samples = None  # lazy initialization
        super().__init__(tree_model, x_data, y_data, feature_names, target_name, class_names)


        if feature_names == None:
            self.feature_names = ["f{" + str(f) + "}" for f in range(tree_model.numFeatures)]


        self.leaf_s_counts_ = self.get_leaf_sample_counts()


    def _get_nodes_info(self, tree_model, spark_version):
        tree_nodes = [None] * tree_model.numNodes
        children_left = [-1] * tree_model.numNodes
        children_right = [-1] * tree_model.numNodes
        node_index = 0

        def recur(node, node_id, version):
            nonlocal node_index

            node_cnt = 0
            node_impurity_stats = None
            impurity_stats = node.impurityStats()
            if version >= 3:
                node_cnt = impurity_stats.rawCount()
                node_impurity_stats = np.array(impurity_stats.stats())
            elif version >=2:
                node_cnt = impurity_stats.count()
                node_impurity_stats = np.array(list(impurity_stats.stats()))
            else:
                raise Exception("Only spark versions >= 2 supported")

            # create node
            tree_nodes[node_id] = {
              "type": "InternalNode" if "InternalNode" in node.toString() else "Leaf",
              "prediction": node.prediction(),
              "impurity": {
                "value": node.impurity(),
                "count": node_cnt,
                "stats": node_impurity_stats
              }
            }

            if "InternalNode" in node.toString():

                split = node.split()
                split_threshold = None
                splitType = None
                if "ContinuousSplit" in split.toString():
                    splitType = "ContinuousSplit"
                    split_threshold = split.threshold()
                elif "CategoricalSplit":
                    splitType = "CategoricalSplit"
                    split_threshold = (list(split.leftCategories()), list(split.rightCategories()))


                tree_nodes[node_id]["split"] = {
                  "type": splitType,
                  "threshold": split_threshold,
                  "featureIndex": split.featureIndex()
                }



            # now walk recursively
            if node.numDescendants() == 0:
                return
            else:
                node_index += 1
                children_left[node_id] = node_index
                recur(node.leftChild(), node_index, version)

                node_index += 1
                children_right[node_id] = node_index
                recur(node.rightChild(), node_index, version)



        recur(tree_model._call_java('rootNode'), 0, spark_version)
        return tree_nodes, children_left, children_right


    def _is_fit(self, tree_model) -> bool:
        if "DecisionTreeClassificationModel" in str(type(tree_model)) or "DecisionTreeRegressionModel" in str(type(tree_model)):
            return True
        return False

    def _is_classifier(self, tree_model) -> bool:
        return "DecisionTreeClassificationModel" in str(type(tree_model))


    def _get_thresholds(self) -> np.ndarray:
        node_thresholds = [-1] * self.numNodes
        for i in range(self.numNodes):
            node = self.tree_nodes[i]
            if "InternalNode" in node["type"]:
                node_thresholds[i] = node["split"]["threshold"]

        return np.array(node_thresholds)


    def _get_features(self) -> np.ndarray:
        feature_index = [-1] * self.numNodes
        for i in range(self.numNodes):
            if "InternalNode" in self.tree_nodes[i]["type"]:
                feature_index[i] = self.tree_nodes[i]["split"]["featureIndex"]
        return np.array(feature_index)



    @staticmethod
    def _get_pyspark_major_version():
        return int(pyspark.__version__.split(".")[0])

    def _get_tree_model_parameter_value(self, name, tree_model, spark_version):
        if spark_version >= 3:
            if name == "minInstancesPerNode":
                return tree_model.getMinInstancesPerNode()
            elif name == "maxDepth":
                return tree_model.getMaxDepth()
            elif name == "impurity":
                return tree_model.getImpurity().upper()
        elif spark_version >= 2:
            if name == "minInstancesPerNode":
                return tree_model.getOrDefault("minInstancesPerNode")
            elif name == "maxDepth":
                return tree_model.getOrDefault("maxDepth")
            elif name == "impurity":
                return tree_model.getOrDefault("impurity").upper()
        else:
            raise Exception("Only spark versions >= 2 supported")





    def model_type(self) -> str:
        return "tree"

    def is_fit(self) -> bool:
        return self.is_fit_

    def is_classifier(self) -> bool:
        return self.is_classifier_

    def is_categorical_split(self, id) -> bool:
        node = self.tree_nodes[id]
        if "InternalNode" in node["type"]:
            if "CategoricalSplit" in node["split"]["type"]:
                return True
        return False

    def get_class_weights(self):
        pass

    def get_class_weight(self):
        pass

    def get_thresholds(self) -> np.ndarray:
        return self.thresholds_

    def get_features(self) -> np.ndarray:
        return self.features_

    def get_leaf_sample_counts(self):
        # cache to speed up rendering of graphviz
        if getattr(self, "leaf_s_counts_", None):
            return self.leaf_s_counts_

        return super().get_leaf_sample_counts()


    def criterion(self) -> str:
        return self.impurity_

    def nclasses(self) -> int:
        if not self.is_classifier():
            return 1
        return self.numClasses

    # TODO
    # for this we need y_dataset to be specified, think how to solve it without specifing the y_data
    def classes(self) -> np.ndarray:
        if self.is_classifier():
            return np.unique(self.y_data)


    def get_node_nsamples(self, id):
        return self.tree_nodes[id]["impurity"]["count"]

    def get_children_left(self) -> np.ndarray:
        return np.array(self.children_left, dtype=int)

    def get_children_right(self):
        return np.array(self.children_right, dtype=int)

    def get_node_split(self, id) -> (int, float, list):
        return self.get_thresholds()[id]

    def get_node_feature(self, id) -> int:
        return self.get_features()[id]

    def get_node_nsamples_by_class(self, id):
        return self.tree_nodes[id]["impurity"]["stats"]

    def get_prediction(self, id):
        return self.tree_nodes[id]["prediction"]

    def nnodes(self) -> int:
        return self.numNodes

    def get_node_criterion(self, id):
        return self.tree_nodes[id]["impurity"]["value"]

    def get_node_impurity(self, id):
        return self.tree_nodes[id]["impurity"]["value"]

    def get_feature_path_importance(self, node_list):
        pass

    def get_max_depth(self) -> int:
        return self.maxDepth_

    def get_min_samples_leaf(self) -> (int, float):
        return self.minInstancesPerNode_

    def shouldGoLeftAtSplit(self, id, x):
        if self.is_categorical_split(id):
            return x in self.get_node_split(id)[0]
        return x < self.get_node_split(id)
