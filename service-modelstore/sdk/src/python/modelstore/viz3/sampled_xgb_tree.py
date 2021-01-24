import json
import math
from collections import defaultdict
from typing import List, Mapping

import numpy as np
import warnings

from .sampled_tree import SampledModelTree
from .sampled_tree import VisualisationNotSupported

from xgboost.core import Booster



# XGBoost Booster to dataframe output format
#   Tree  Node    ID                          Feature  Split   Yes    No Missing        Gain     Cover
#0      0     0   0-0                           tenure   17.0   0-1   0-2     0-1  671.161072  1595.500
#1      0     1   0-1      InternetService_Fiber optic    1.0   0-3   0-4     0-3  343.489227   621.125
#2      0     2   0-2      InternetService_Fiber optic    1.0   0-5   0-6     0-5  293.603149   974.375
#3      0     3   0-3                           tenure    4.0   0-7   0-8     0-7   95.604340   333.750
#4      0     4   0-4                     TotalCharges  120.0   0-9  0-10     0-9   27.897919   287.375
#5      0     5   0-5                Contract_Two year    1.0  0-11  0-12    0-11   32.057739   512.625
#6      0     6   0-6                           tenure   60.0  0-13  0-14    0-13  120.693176   461.750
#7      0     7   0-7  TechSupport_No internet service    1.0  0-15  0-16    0-15   37.326447   149.750
#8      0     8   0-8  TechSupport_No internet service    1.0  0-17  0-18    0-17   34.968536   184.000
#9      0     9   0-9                  TechSupport_Yes    1.0  0-19  0-20    0-19    0.766754    65.500
#10     0    10  0-10                MultipleLines_Yes    1.0  0-21  0-22    0-21   19.335510   221.875
#11     0    11  0-11                 PhoneService_Yes    1.0  0-23  0-24    0-23   19.035950   281.125
#12     0    12  0-12                             Leaf    NaN   NaN   NaN     NaN   -0.191398   231.500
#13     0    13  0-13   PaymentMethod_Electronic check    1.0  0-25  0-26    0-25   43.379410   320.875
#14     0    14  0-14                Contract_Two year    1.0  0-27  0-28    0-27   13.401367   140.875
#15     0    15  0-15                             Leaf    NaN   NaN   NaN     NaN    0.050262    94.500
#16     0    16  0-16                             Leaf    NaN   NaN   NaN     NaN   -0.052444    55.250
#17     0    17  0-17                             Leaf    NaN   NaN   NaN     NaN   -0.058929   111.000
#18     0    18  0-18                             Leaf    NaN   NaN   NaN     NaN   -0.148649    73.000
#19     0    19  0-19                             Leaf    NaN   NaN   NaN     NaN    0.161464    63.875


class SampledXGBDecisionTree(SampledModelTree):
    LEFT_CHILDREN_COLUMN = "Yes"
    RIGHT_CHILDREN_COLUMN = "No"
    NO_CHILDREN = -1
    NO_SPLIT = -2
    NO_FEATURE = -2
    ROOT_NODE = 0

    def __init__(self, booster,
                 tree_index: int,
                 x_data,
                 y_data,
                 feature_names: List[str] = None,
                 target_name: str = None,
                 class_names: (List[str], Mapping[int, str]) = None
                 ):
        self.booster = booster
        self.tree_index = tree_index
        self.tree_to_dataframe = self._get_tree_dataframe()
        self.children_left = self._calculate_children(self.__class__.LEFT_CHILDREN_COLUMN)
        self.children_right = self._calculate_children(self.__class__.RIGHT_CHILDREN_COLUMN)
        self.config = json.loads(self.booster.save_config())
        self.node_to_samples = None  # lazy initialized
        self.features = None  # lazy initialized

        super().__init__(booster, x_data, y_data, feature_names, target_name, class_names)


        if feature_names == None:
            # checks for n_features attribute in booster or sets n_features to 500
            self.feature_names = ["f{" + str(f) + "}" for f in range(booster.attr("n_features_") or 500)]


        self.leaf_s_counts_ = self.get_leaf_sample_counts()


    def model_type(self) -> str:
        return "ensemble"

    def is_fit(self):
        return isinstance(self.booster, Booster)

    def get_children_left(self):
        return self.children_left

    def get_children_right(self):
        return self.children_right

    def get_node_split(self, id) -> (float):
        """
        Split values could not be the same like in plot_tree(booster). This is because xgb_model_classifier.joblib.trees_to_dataframe()
        get data using dump_format = text from xgb_model_classifier.joblib.get_dump()
        """
        node_split = self._get_column_value("Split")[id]
        return node_split if not math.isnan(node_split) else self.__class__.NO_SPLIT

    def get_node_feature(self, id) -> int:
        feature_name = self._get_column_value("Feature")[id]
        try:
            return self.booster.feature_names.index(feature_name)
        except ValueError as error:
            return self.__class__.NO_FEATURE


    def get_features(self):
        if self.features is not None:
            return self.features

        feature_index = [self.get_node_feature(i) for i in range(0, self.nnodes())]
        self.features = np.array(feature_index)
        return self.features


    def get_node_nsamples(self, id):
        # calculation based on cover
        node_coverage = self._get_column_value("Cover")[id]
        return node_coverage


    def get_leaf_sample_counts(self):
        # cache to speed up rendering of graphviz
        if getattr(self, "leaf_s_counts_", None):
            return self.leaf_s_counts_

        return [np.array([]), self.tree_to_dataframe.query(f"Feature == 'Leaf'")["Cover"].to_numpy()]


    def _get_tree_dataframe(self):
        return self.booster.trees_to_dataframe().query(f"Tree == {self.tree_index}")


    def _get_column_value(self, column_name):
        return self.tree_to_dataframe[column_name].to_numpy()


    def _split_column_value(self, column_name):
        def split_value(value):
            if isinstance(value, str):
                return value.split("-")[1]
            else:
                return value

        return self.tree_to_dataframe.apply(lambda row: split_value(row.get(f"{column_name}")), axis=1)


    def _change_no_children_value(self, children):
        return children.fillna(self.__class__.NO_CHILDREN)


    def _calculate_children(self, column_name):
        children = self._split_column_value(column_name)
        children = self._change_no_children_value(children)
        return children.to_numpy(dtype=int)


    def get_thresholds(self):
        thresholds = [self.get_node_split(i) for i in range(0, self.nnodes())]
        return np.array(thresholds)



    def get_node_impurity(self, id):

        # impurity and gain have a relationship,
        # simply using exp(gain) does make intuitive sense for the reasons below:
        #  - for lower gains, impurity is lower,
        #  - higher gain leads to higher impurity
        #  - negative gain is converted to a positive value by the exp transformation
        # this needs further study to check whether its theoretically correct
        node_gain = self._get_column_value("Gain")[id]
        return np.exp(node_gain)



    def get_prediction(self, id):
        if self.is_classifier():
            class_nsamples = [np.round(a) for a in self.get_node_nsamples_by_class(id)]
            return np.argmax(class_nsamples)

        else:
            # regression case
            # just spit out leaf values (gains)
            node_gain = self._get_column_value("Gain")[id]
            return node_gain


            #node_samples = [node.samples() for node in all_nodes if node.id == id][0]
            #return np.mean(self.y_data[node_samples])


    def get_node_nsamples_by_class(self, id):
        if self.is_classifier():
            node_gain = self._get_column_value("Gain")[id]
            class_probability = 1 / (1 + np.exp(-node_gain))
            node_cover = self._get_column_value("Cover")[id]

            class_nsamples = class_probability * node_cover, (1 - class_probability) * node_cover

            return np.array(class_nsamples)


    def is_classifier(self):
        objective_name = self.config["learner"]["objective"]["name"].split(":")[0]
        if objective_name == "binary":
            return True
        elif objective_name == "reg":
            return False
        return None


    def nnodes(self):
        return self.tree_to_dataframe.shape[0]


    def nclasses(self):
        if not self.is_classifier():
            return 1
        else:
            return len(self.class_names)


    def classes(self):
        if self.is_classifier():
            return self.class_names


    def get_max_depth(self):
        return int(self.config["learner"]["gradient_booster"]["updater"]["prune"]["train_param"]["max_depth"])


    def shouldGoLeftAtSplit(self, id, x):
        return x < self.get_node_split(id)



    def get_class_weights(self):
        return None

    def get_class_weight(self):
        return None

    def criterion(self):
        raise VisualisationNotSupported("criterion()", "XGBoost")

    def get_node_criterion(self):
        raise VisualisationNotSupported("get_node_criterion()", "XGBoost")

    def get_min_samples_leaf(self):
        raise VisualisationNotSupported("get_min_samples_leaf()", "XGBoost")
