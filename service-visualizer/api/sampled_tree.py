import numpy as np

import os
import logging
import sys
import time
import tempfile
from pathlib import Path
from sys import platform as PLATFORM

from abc import ABC, abstractmethod
from collections import Sequence
from typing import Mapping, List, Tuple
from numbers import Number

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


class SampledDecisionTree(ABC):


    def __init__(self,
                 tree_model,
                 x_data: (np.ndarray),
                 y_data: (np.ndarray),
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None):
        """
        Parameters
        ----------
        :param tree_model: sklearn.tree.DecisionTreeRegressor, sklearn.tree.DecisionTreeClassifier, xgboost.core.Booster
            The decision tree to be interpreted
        :param x_data: pd.DataFrame, np.ndarray
            Features values on which the shadow tree will be build.
        :param y_data: pd.Series, np.ndarray
            Target values on which the shadow tree will be build.
        :param feature_names: List[str]
            Features' names
        :param target_name: str
            Target's name
        :param class_names: List[str], Mapping[int, str]
            Class' names (in case of a classifier)
        """

        if not self.is_fit():
            raise Exception(f"Model {tree_model} is not fit.")

        self.feature_names = feature_names
        self.target_name = target_name
        self.class_names = class_names
        # self.class_weight = self.get_class_weight()
        self.x_data = x_data
        self.y_data = y_data
        # self.node_to_samples = self.get_node_samples()
        self.root, self.leaves, self.internal = self._get_tree_nodes()
        if class_names:
            self.class_names = self._get_class_names()

    @abstractmethod
    def model_type(self) -> str:
        """returns model type (ensemble, tree, linear, logistic)"""
        pass


    @abstractmethod
    def is_fit(self) -> bool:
        """Checks if the tree model is already trained."""
        pass


    @abstractmethod
    def is_classifier(self) -> bool:
        """Checks if the tree model is a classifier."""
        pass


    @abstractmethod
    def get_class_weights(self):
        """Returns the tree model's class weights."""
        pass


    @abstractmethod
    def get_thresholds(self) -> np.ndarray:
        """Returns split node/threshold values for tree's nodes.
        Ex. threshold[i] holds the split value/threshold for the node i.
        """
        pass

    @abstractmethod
    def get_features(self) -> np.ndarray:
        """Returns feature indexes for tree's nodes.
        Ex. features[i] holds the feature index to split on
        """
        pass


    @abstractmethod
    def criterion(self) -> str:
        """Returns the function to measure the quality of a split.
        Ex. Gini, entropy, MSE, MAE
        """
        pass


    @abstractmethod
    def get_class_weight(self):
        """
        TOOD - to be compared with get_class_weights
        :return:
        """
        pass


    @abstractmethod
    def nclasses(self) -> int:
        """Returns the number of classes.
        Ex. 2 for binary classification or 1 for regression.
        """
        pass


    @abstractmethod
    def classes(self) -> np.ndarray:
        """Returns the tree's classes values in case of classification.
        Ex. [0,1] in class of a binary classification
        """
        pass



    @abstractmethod
    def get_node_nsamples(self, id):
        """Returns number of samples for a specific node id."""
        pass


    @abstractmethod
    def get_children_left(self) -> np.ndarray:
        """Returns the node ids of the left child node.
        Ex. children_left[i] holds the node id of the left child of node i.
        """
        pass


    @abstractmethod
    def get_children_right(self) -> np.ndarray:
        """Returns the node ids of the right child node.
        Ex. children_right[i] holds the node id of the right child of node i.
        """
        pass


    @abstractmethod
    def get_node_split(self, id) -> (int, float):
        """Returns node split value.
        Parameters
        ----------
        id : int
            The node id.
        """
        pass


    @abstractmethod
    def get_node_feature(self, id) -> int:
        """Returns feature index from node id.
        Parameters
        ----------
        id : int
            The node id.
        """
        pass


    @abstractmethod
    def get_node_nsamples_by_class(self, id):
        """For a classification decision tree, returns the number of samples for each class from a specified node.
        Parameters
        ----------
        id : int
            The node id.
        """
        pass


    @abstractmethod
    def get_prediction(self, id):
        """Returns the constant prediction value for node id.
        Parameters
        ----------
        id : int
            The node id.
        """
        pass

    @abstractmethod
    def nnodes(self) -> int:
        "Returns the number of nodes (internal nodes + leaves) in the tree."
        pass

    @abstractmethod
    def get_node_criterion(self, id):
        """Returns the impurity (i.e., the value of the splitting criterion) at node id.
        Parameters
        ----------
        id : int
            The node id.
        """
        pass


    @abstractmethod
    def get_max_depth(self) -> int:
        """The max depth of the tree."""
        pass


    @abstractmethod
    def get_min_samples_leaf(self) -> (int, float):
        """Returns the minimum number of samples required to be at a leaf node."""
        pass

    @abstractmethod
    def shouldGoLeftAtSplit(self, id, x):
        """Return true if it should go to the left node child based on node split criterion and x value"""
        pass

    def is_categorical_split(self, id) -> bool:
        """Checks if the node split is a categorical one.
        This method needs to be overloaded only for shadow tree implementation which contain categorical splits,
        like Spark.
        """
        return False


    def predict(self, x: np.ndarray) -> Tuple[Number, List]:
        """
        Given an x - vector of features, return predicted class or value based upon this tree.
        Also return path from root to leaf as 2nd value in return tuple.
        Recursively walk down tree from root to appropriate leaf by comparing feature in x to node's split value.
        :param
        x: np.ndarray
            Feature vector to run down the tree to a  leaf.
        """

        def walk(t, x, path):
            if t is None:
                return None
            path.append(t)
            if t.isleaf():
                return t
            # if x[t.feature()] < t.split():
            # print(f"shadow node id, x {t.id} , {t.feature()}")
            if self.shouldGoLeftAtSplit(t.id, x[t.feature()]):
                return walk(t.left, x, path)
            return walk(t.right, x, path)

        path = []
        leaf = walk(self.root, x, path)
        return leaf.prediction(), path


    def get_leaf_sample_counts(self, min_samples=0, max_samples=None):
        """
        Get the number of samples for each leaf.
        There is the option to filter the leaves with samples between min_samples and max_samples.
        Parameters
        ----------
        min_samples: int
            Min number of samples for a leaf
        max_samples: int
            Max number of samples for a leaf
        :return: tuple
            Contains a numpy array of leaf ids and an array of leaf samples
        """

        max_samples = max_samples if max_samples else max([node.nsamples() for node in self.leaves])
        leaf_samples = [(node.id, node.nsamples()) for node in self.leaves if
                        min_samples <= node.nsamples() <= max_samples]
        x, y = zip(*leaf_samples)
        return np.array(x), np.array(y)


    def get_leaf_criterion(self):
        """Get criterion for each leaf
        For classification, supported criteria are “gini” for the Gini impurity and “entropy” for the information gain.
        For regression, supported criteria are “mse”, “friedman_mse”, “mae”.
        """

        leaf_criterion = [(node.id, node.criterion()) for node in self.leaves]
        x, y = zip(*leaf_criterion)
        return np.array(x), np.array(y)


    def get_leaf_sample_counts_by_class(self):
        """ Get the number of samples by class for each leaf.
        :return: tuple
            Contains a list of leaf ids and a two lists of leaf samples(one for each class)
        """

        leaf_samples = [(node.id, node.n_sample_classes()[0], node.n_sample_classes()[1]) for node in self.leaves]
        index, leaf_sample_0, leaf_samples_1 = zip(*leaf_samples)
        return index, leaf_sample_0, leaf_samples_1



    def _get_class_names(self):
        if self.is_classifier():
            if isinstance(self.class_names, dict):
                return self.class_names
            elif isinstance(self.class_names, Sequence):
                return {i: n for i, n in enumerate(self.class_names)}
            else:
                raise Exception(f"class_names must be dict or sequence, not {self.class_names.__class__.__name__}")


    def _get_tree_nodes(self):
        # use locals not args to walk() for recursion speed in python
        leaves = []
        internal = []  # non-leaf nodes
        children_left = self.get_children_left()
        children_right = self.get_children_right()

        def walk(node_id):
            if children_left[node_id] == -1 and children_right[node_id] == -1:  # leaf
                t = TreeNode(self, node_id)
                leaves.append(t)
                return t
            else:  # decision node
                left = walk(children_left[node_id])
                right = walk(children_right[node_id])
                t = TreeNode(self, node_id, left, right)
                internal.append(t)
                return t

        root_node_id = 0
        root = walk(root_node_id)
        return root, leaves, internal




    def modelGraph(self,
                 precision: int = 2,
                 show_root_edge_labels: bool = True,
                 show_node_labels: bool = False,
                 show_just_path: bool = False,
                 fancy: bool = True,
                 histtype: ('bar', 'barstacked', 'strip') = 'barstacked',
                 highlight_path: List[int] = [],
                 X: np.ndarray = None):

        """
        Given a decision tree regressor or classifier, create and return a tree visualization
        using the graphviz (DOT) language.
        We can call this function in two ways :
        1. by using shadow tree
            ex. dtreeviz(shadow_dtree)
            - we need to initialize shadow_tree before this call
                - ex. shadow_dtree = ShadowSKDTree(tree_model, dataset[features], dataset[target], features, target, [0, 1]))
            - the main advantage is that we can use the shadow_tree for other visualisations methods as well
        2. by using sklearn, xgboost tree
            ex. dtreeviz(tree_model, dataset[features], dataset[target], features, target, class_names=[0, 1])
            - maintain backward compatibility
        :param tree_model: A DecisionTreeRegressor or DecisionTreeClassifier that has been
                           fit to X_train, y_data.
        :param X_train: A data frame or 2-D matrix of feature vectors used to train the model.
        :param y_data: A pandas Series or 1-D vector with target values or classes.
        :param feature_names: A list of the feature names.
        :param target_name: The name of the target variable.
        :param class_names: [For classifiers] A dictionary or list of strings mapping class
                            value to class name.
        :param precision: When displaying floating-point numbers, how many digits to display
                          after the decimal point. Default is 2.
        :param show_root_edge_labels: Include < and >= on the edges emanating from the root?
        :param show_node_labels: Add "Node id" to top of each node in graph for educational purposes
        :param show_just_path: If True, it shows only the sample(X) prediction path
        :param fancy:
        :param highlight_path: A list of node IDs to highlight, default is [].
                               Useful for emphasizing node(s) in tree for discussion.
                               If X argument given then this is ignored.
        :type highlight_path: List[int]
        :param X: Instance to run down the tree; derived path to highlight from this vector.
                  Show feature vector with labels underneath leaf reached. highlight_path
                  is ignored if X is not None.
        :type X: np.ndarray
        :return: An object with nodes and edges that describes the decision tree.
        """


        def node_name(node):
            return f"node{node.id}"


        def node_label(node):
            return f'Node {node.id}'


        def internal_node(label, node_name, node_value):

            return {
                "id": node_name,
                "label": f'{label}@{node_value}',
                "count": int(node.nsamples())
            }


        def regr_leaf_node(node, label_fontsize: int = 12):

            # try this to get real training set sample count for this leaf
            leaf_impurity = node.decision_tree.get_node_impurity(node.id)

            return {
                "id": f'leaf{node.id}',
                "label": node_label(node),
                "leaf":True,
                "count": int(node.nsamples()),
                "mean": float(node.prediction()),
                "std": float(leaf_impurity)
            }


        def class_leaf_node(node, classes: List[str] = None, label_fontsize: int = 12):
            return {
                "id": f'leaf{node.id}',
                "label": node_label(node),
                "leaf":True,
                "count": int(node.nsamples()),
                "classes": [{
                  "name": classes[c] if classes else "f" + str(c),
                  "count": int(cnt)
                  } for c, cnt in enumerate(node.class_counts())]
            }



        def get_internal_nodes():
            if show_just_path and X is not None:
                _internal = []
                for _node in self.internal:
                    if _node.id in highlight_path:
                        _internal.append(_node)
                return _internal
            else:
                return self.internal



        def get_leaves():
            if show_just_path and X is not None:
                _leaves = []
                for _node in self.leaves:
                    if _node.id in highlight_path:
                        _leaves.append(_node)
                        break
                return _leaves
            else:
                return self.leaves


        if X is not None:
            pred, path = self.predict(X)
            highlight_path = [n.id for n in path]



        start_milli = int(round(time.time() * 1000))
        internal = []
        for node in get_internal_nodes():
            nname = node_name(node)
            gr_node = internal_node(node.feature_name(), nname, format(node.split(), '.' + str(precision) + 'f'))
            internal.append(gr_node)


        end_milli = int(round(time.time() * 1000))
        logging.info("setting up internal nodes " + str(end_milli - start_milli))


        start_milli = int(round(time.time() * 1000))
        leaves = []

        if self.is_classifier():
            for node in get_leaves():
                leaves.append(class_leaf_node(node, classes=self.class_names or None))

        else:
            for node in get_leaves():
                leaves.append(regr_leaf_node(node))

        end_milli = int(round(time.time() * 1000))
        logging.info("setting up leaf nodes " + str(end_milli - start_milli))


        if show_just_path:
            show_root_edge_labels = False
        show_edge_labels = False
        all_llabel = '&lt;' if show_edge_labels else ''
        all_rlabel = '&ge;' if show_edge_labels else ''
        root_llabel = '&lt;' if show_root_edge_labels else ''
        root_rlabel = '&ge;' if show_root_edge_labels else ''


        start_milli = int(round(time.time() * 1000))
        edges = []
        # non leaf edges with > and <=
        for node in get_internal_nodes():
            nname = node_name(node)
            if node.left.isleaf():
                left_node_name = 'leaf%d' % node.left.id
            else:
                left_node_name = node_name(node.left)
            if node.right.isleaf():
                right_node_name = 'leaf%d' % node.right.id
            else:
                right_node_name = node_name(node.right)

            if node == self.root:
                llabel = root_llabel
                rlabel = root_rlabel
            else:
                llabel = all_llabel
                rlabel = all_rlabel


            edges.append({
              "start": f'{nname}',
              "end": f'{left_node_name}',
              "label": llabel
            })

            edges.append({
              "start": f'{nname}',
              "end": f'{right_node_name}',
              "label": rlabel
            })

        end_milli = int(round(time.time() * 1000))
        logging.info("setting up edges: " + str(end_milli - start_milli))



        all_nodes = internal
        all_nodes.extend(leaves)


        vizGraph = {
          "nodes": all_nodes,
          "edges": edges
        }


        if self.is_classifier():
            class_values = self.class_names
            vizGraph["classifier"] = True
            vizGraph["legend"] = [a for _, a in (class_values.items() if class_values else [])]


        if self.model_type():
            vizGraph["model_type"] = self.model_type()



        return vizGraph



class TreeNode():
    """
    A node in a SampledDecisionTree. Each node has left and right pointers to child nodes.
    """

    def __init__(self, decision_tree: SampledDecisionTree, id: int, left=None, right=None):
        self.decision_tree = decision_tree
        self.id = id
        self.left = left
        self.right = right


    def split(self) -> (int, float):
        """Returns the split value at this node."""

        return self.decision_tree.get_node_split(self.id)


    def feature(self) -> int:
        """Returns the feature index at this node"""

        return self.decision_tree.get_node_feature(self.id)


    def feature_name(self) -> (str, None):
        """Returns the feature at this node"""

        if self.decision_tree.feature_names is not None:
            return self.decision_tree.feature_names[self.feature()]
        return None


    def samples(self) -> List[int]:
        """Returns samples indexes from this node"""

        return self.decision_tree.get_node_samples()[self.id]


    def nsamples(self) -> int:
        """
        Return the number of samples associated with this node. If this is a leaf node, it indicates the samples
        used to compute the predicted value or class . If this is an internal node, it is the number of samples used
        to compute the split point.
        """

        return self.decision_tree.get_node_nsamples(self.id)

    # TODO
    # implementation should happen in shadow tree implementations, we already have methods for this
    # this implementation will work also for validation dataset.... think how to separate model interpretation using training vs validation dataset.
    def n_sample_classes(self):
        """Used for binary classification only.
        Returns the sample count values for each classes.
        """

        samples = np.array(self.samples())
        if samples.size == 0:
            return [0, 0]

        node_y_data = self.decision_tree.y_data[samples]
        unique, counts = np.unique(node_y_data, return_counts=True)

        if len(unique) == 2:
            return [counts[0], counts[1]]
        elif len(unique) == 1:  # one node can contain samples from only on class
            if unique[0] == 0:
                return [counts[0], 0]
            elif unique[0] == 1:
                return [0, counts[0]]


    def criterion(self):
        return self.decision_tree.get_node_criterion(self.id)


    def isleaf(self) -> bool:
        return self.left is None and self.right is None

    def isclassifier(self) -> bool:
        return self.decision_tree.is_classifier()

    def is_categorical_split(self) -> bool:
        return self.decision_tree.is_categorical_split(self.id)

    def prediction(self) -> (Number, None):
        """Returns leaf prediction.
        If the node is an internal node, returns None
        """

        if not self.isleaf():
            return None
        # if self.isclassifier():
        #     counts = self.shadow_tree.get_prediction_value(self.id)
        #     return np.argmax(counts)
        # else:
        #     return self.shadow_tree.get_prediction_value(self.id)
        return self.decision_tree.get_prediction(self.id)

    def prediction_name(self) -> (str, None):
        """
        If the tree model is a classifier and we know the class names, return the class name associated with the
        prediction for this leaf node.
        Return prediction class or value otherwise.
        """

        if self.isclassifier():
            if self.decision_tree.class_names is not None:
                return self.decision_tree.class_names[self.prediction()]
        return self.prediction()


    def class_counts(self) -> (List[int], None):
        """
        If this tree model is a classifier, return a list with the count associated with each class.
        """

        if self.isclassifier():
            if self.decision_tree.get_class_weight() is None:
                # return np.array(np.round(self.shadow_tree.tree_model.tree_.value[self.id][0]), dtype=int)
                return np.array(np.round(self.decision_tree.get_node_nsamples_by_class(self.id)), dtype=int)
            else:
                return np.round(
                    self.decision_tree.get_node_nsamples_by_class(self.id) / self.decision_tree.get_class_weights()).astype(
                    int)
        return None



    def __str__(self):
        if self.left is None and self.right is None:
            return "<pred={value},n={n}>".format(value=round(self.prediction(), 1), n=self.nsamples())
        else:
            return "({f}@{s} {left} {right})".format(f=self.feature_name(),
                                                     s=round(self.split(), 1),
                                                     left=self.left if self.left is not None else '',
                                                     right=self.right if self.right is not None else '')


class VisualisationNotSupported(Exception):
    def __init__(self, method, model_class):
        super().__init__(f'{method} is not implemented in {model_class}')
