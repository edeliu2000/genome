from unittest import TestCase
from unittest.mock import patch, MagicMock

import sys
import io
import json
import pickle
import logging

import numpy as np

import joblib
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
import xgboost as xgb

from pyspark.ml.classification import DecisionTreeClassificationModel
from pyspark.sql import SparkSession
import pyspark

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)



from ..modelstore.viz3.sampled_sk_tree import SampledSKDecisionTree
from ..modelstore.viz3.sampled_xgb_tree import SampledXGBDecisionTree
from ..modelstore.viz3.sampled_spark_tree import SampledSparkDecisionTree


class TestGenomeXGBVisualizer(TestCase):

    def setUp(self):

        self.decision_tree = joblib.load("app/test/models/xgb_model_classifier.joblib")

        features = ["Pclass", "Age", "Fare", "Sex_label", "Cabin_label", "Embarked_label"]
        target = "Survived"
        target_classes = [0, 1]


        self.sampled_xgb_tree = SampledXGBDecisionTree(
            self.decision_tree,
            0,
            np.array([[1.0 for i in range(len(features))]]),
            np.array([1.0]),
            feature_names = features,
            target_name = target,
            class_names = target_classes)




    def test_feature_names(self):
        assert self.decision_tree.feature_names == ['Pclass', 'Age', 'Fare', 'Sex_label', 'Cabin_label', 'Embarked_label']


    def test_children_left(self):
        assert np.array_equal(self.sampled_xgb_tree.get_children_left(), np.array([1, 3, 5, -1, -1, -1, -1]))
        assert not np.array_equal(self.sampled_xgb_tree.get_children_left(), np.array([-1, -1, -1, -1, 1, 3, 5]))


    def test_right_children_left(self):
        assert np.array_equal(self.sampled_xgb_tree.get_children_right(), np.array([2, 4, 6, -1, -1, -1, -1]))


    def test_node_feature(self):
        assert self.sampled_xgb_tree.get_node_feature(3) == -2
        assert self.sampled_xgb_tree.get_node_feature(1) == 0
        assert self.sampled_xgb_tree.get_node_feature(0) == 3
        assert self.sampled_xgb_tree.get_node_feature(6) == -2
        assert self.sampled_xgb_tree.get_node_feature(2) == 4


    def test_features(self):
        assert np.array_equal(self.sampled_xgb_tree.get_features(), np.array([3, 0, 4, -2, -2, -2, -2]))



    def test_node_nsamples_by_cls(self):
        logging.info("xgb samples by class")
        logging.info(self.sampled_xgb_tree.get_node_nsamples_by_class(0))
        logging.info(self.sampled_xgb_tree.get_node_nsamples_by_class(1))
        logging.info(self.sampled_xgb_tree.get_node_nsamples_by_class(2))
        logging.info(self.sampled_xgb_tree.get_node_nsamples_by_class(5))

        assert np.array_equal(self.sampled_xgb_tree.get_node_nsamples_by_class(0), np.array([222.75, 0.]))
        assert np.array_equal(self.sampled_xgb_tree.get_node_nsamples_by_class(1), np.array([78.5, 0.]))
        assert np.round(self.sampled_xgb_tree.get_node_nsamples_by_class(5))[0] == 57.


    def test_prediction(self):
        logging.info("xgb prediction node 0")
        logging.info(self.sampled_xgb_tree.get_prediction(3))
        logging.info(self.sampled_xgb_tree.get_prediction(4))
        logging.info(self.sampled_xgb_tree.get_prediction(5))
        logging.info(self.sampled_xgb_tree.get_prediction(6))

        assert self.sampled_xgb_tree.get_prediction(3) == 0
        assert self.sampled_xgb_tree.get_prediction(4) == 0
        assert self.sampled_xgb_tree.get_prediction(5) == 1
        assert self.sampled_xgb_tree.get_prediction(6) == 0


    def test_nclasses(self):
        assert self.sampled_xgb_tree.nclasses() == 2


    def test_classes(self):
        assert self.sampled_xgb_tree.classes()[0] == 0
        assert self.sampled_xgb_tree.classes()[1] == 1

    def test_thresholds(self):
        assert np.array_equal(self.sampled_xgb_tree.get_thresholds(), np.array([1, 3, 4, -2, -2, -2, -2]))


    def test_classifier(self):
        assert self.sampled_xgb_tree.is_classifier() == True


    def test_leaf_sample_counts(self):
        leaf_ids, leaf_samples = self.sampled_xgb_tree.get_leaf_sample_counts()

        logging.info("getting - leaf-ids")
        logging.info(leaf_ids)
        logging.info("getting - leaf_samples")
        logging.info(leaf_samples)

        assert np.array_equal(leaf_ids, np.array([])), "Leaf ids should be empty"
        assert np.array_equal(leaf_samples, np.array([42.5, 36., 118.25, 26.])), "Leaf samples should be [42.5, 36., 118.25, 26.]"





class TestGenomeSKVisualizer(TestCase):

    def setUp(self):

        self.decision_tree = joblib.load("app/test/models/sk_decision_tree_classifier.joblib")

        features = ["Pclass", "Age", "Fare", "Sex_label", "Cabin_label", "Embarked_label"]
        target = "Survived"
        class_names = list(self.decision_tree.classes_)



        self.sampled_sk_tree = SampledSKDecisionTree(self.decision_tree,
            np.array([[1.0 for i in range(self.decision_tree.n_features_)]]),
            np.array([1.0]),
            feature_names = features,
            target_name = target,
            class_names = class_names)


    def test_feat_number(self):

        self.assertEqual(self.sampled_sk_tree.feature_names, ['Pclass', 'Age', 'Fare', 'Sex_label', 'Cabin_label', 'Embarked_label'])


    def test_fit(self):
        self.assertEqual(self.sampled_sk_tree.is_fit(), True)


    def test_classifier(self):
        self.assertEqual(self.sampled_sk_tree.is_classifier(), True)


    def test_class_weight(self):
        self.assertEqual(self.sampled_sk_tree.get_class_weight(), None)


    def test_criterion(self):
        self.assertEqual(self.sampled_sk_tree.criterion(), "GINI")


    def test_nclasses(self):
        self.assertEqual(self.sampled_sk_tree.nclasses(), 2)

    def test_classes(self):
        self.assertEqual(self.sampled_sk_tree.classes()[0], 0)
        self.assertEqual(self.sampled_sk_tree.classes()[1], 1)


    def test_class_weights(self):
        assert np.array_equal(self.sampled_sk_tree.get_class_weights(), None)


    def test_tree_nodes(self):
        assert [node.id for node in self.sampled_sk_tree.leaves] == [3, 4, 6, 7, 10, 11, 13, 14]
        assert [node.id for node in self.sampled_sk_tree.internal] == [2, 5, 1, 9, 12, 8, 0]


    def test_children_left(self):
        assert np.array_equal(self.sampled_sk_tree.get_children_left(),
                              np.array([1, 2, 3, -1, -1, 6, -1, -1, 9, 10, -1, -1, 13, -1, -1]))


    def test_children_right(self):
        assert np.array_equal(self.sampled_sk_tree.get_children_right(),
                              np.array([8, 5, 4, -1, -1, 7, -1, -1, 12, 11, -1, -1, 14, -1, -1]))


    def test_node_split(self):
        assert self.sampled_sk_tree.get_node_split(0) == 0.5
        assert self.sampled_sk_tree.get_node_split(1) == 2.5
        assert self.sampled_sk_tree.get_node_split(3) == -2
        assert self.sampled_sk_tree.get_node_split(12) == 17.5


    def test_node_feature(self):
        assert self.sampled_sk_tree.get_node_feature(0) == 3
        assert self.sampled_sk_tree.get_node_feature(2) == 1
        assert self.sampled_sk_tree.get_node_feature(4) == -2
        assert self.sampled_sk_tree.get_node_feature(8) == 4
        assert self.sampled_sk_tree.get_node_feature(12) == 1


    def test_max_depth(self):
        assert self.sampled_sk_tree.get_max_depth() == 3, "Max depth should be 3"


    def test_min_samples_leaf(self):
        assert self.sampled_sk_tree.get_min_samples_leaf() == 1, "min_samples_leaf should be 1"


    def test_nnodes(self):
        assert self.sampled_sk_tree.nnodes() == 15, "number of nodes should be 15"


    def test_leaf_sample_counts(self):
        leaf_ids, leaf_samples = self.sampled_sk_tree.get_leaf_sample_counts()
        logging.info("getting - leaf-ids")
        logging.info(leaf_ids)
        logging.info("getting - leaf_samples")
        logging.info(leaf_samples)

        assert np.array_equal(leaf_ids,
                              np.array([3, 4, 6, 7, 10, 11, 13, 14])), "Leaf ids should be [3, 4, 6, 7, 10, 11, 13, 14]"
        assert np.array_equal(leaf_samples,
                              np.array([2, 168, 117, 27, 14, 459, 8, 96])), "Leaf samples should be [0, 5, 6, 0, 2, 6, 0, 1]"


    def test_thresholds(self):
        assert list(self.sampled_sk_tree.get_thresholds()) == [0.5, 2.5, 2.5, -2.0, -2.0, 23.350000381469727, -2.0, -2.0, 3.5,
                                                          3.5, -2.0, -2.0, 17.5, -2.0, -2.0]


    def test_prediction(self):
        assert self.sampled_sk_tree.get_prediction(3) == 0, "Prediction for leaf=3 should be 0"
        assert self.sampled_sk_tree.get_prediction(4) == 1, "Prediction for leaf=4 should be 1"
        assert self.sampled_sk_tree.get_prediction(6) == 1, "Prediction for leaf=6 should be 1"
        assert self.sampled_sk_tree.get_prediction(7) == 0, "Prediction for leaf=7 should be 0"
        assert self.sampled_sk_tree.get_prediction(10) == 1, "Prediction for leaf=10 should be 1"
        assert self.sampled_sk_tree.get_prediction(11) == 0, "Prediction for leaf=11 should be 0"
        assert self.sampled_sk_tree.get_prediction(13) == 1, "Prediction for leaf=13 should be 1"
        assert self.sampled_sk_tree.get_prediction(14) == 0, "Prediction for leaf=14 should be 0"


    def test_node_nsamples_by_cls(self):
        assert np.array_equal(self.sampled_sk_tree.get_node_nsamples_by_class(0), np.array([549, 342]))
        assert np.array_equal(self.sampled_sk_tree.get_node_nsamples_by_class(1), np.array([81, 233]))
        assert np.array_equal(self.sampled_sk_tree.get_node_nsamples_by_class(3), np.array([1, 1]))
        assert np.array_equal(self.sampled_sk_tree.get_node_nsamples_by_class(5), np.array([72, 72]))
        assert np.array_equal(self.sampled_sk_tree.get_node_nsamples_by_class(10), np.array([5, 9]))
        assert np.array_equal(self.sampled_sk_tree.get_node_nsamples_by_class(11), np.array([404, 55]))




class TestGenomeSparkVisualizer(TestCase):

    def setUp(self):


        SparkSession.builder \
          .master("local[2]") \
          .appName("dtreeviz_sparkml") \
          .getOrCreate()

        spark_major_version = int(pyspark.__version__.split(".")[0])
        if spark_major_version >= 3:
            self.decision_tree = DecisionTreeClassificationModel.load("app/test/models/spark_3_model")
        elif spark_major_version >= 2:
            self.decision_tree = DecisionTreeClassificationModel.load("app/test/models/spark_2_model")


        features = ["Pclass", "Age", "Fare", "Sex_label", "Cabin_label", "Embarked_label"]
        target = "Survived"
        target_classes = [0, 1]


        self.sampled_spark_tree = SampledSparkDecisionTree(
            self.decision_tree,
            np.array([[1.0 for i in range(len(features))]]),
            np.array([1.0]),
            feature_names = features,
            target_name = target,
            class_names = target_classes)



    def test_is_fit(self):
        assert self.sampled_spark_tree.is_fit() is True


    def test_classifier(self):
        assert self.sampled_spark_tree.is_classifier() is True, "Spark decision tree should be classifier"


    def test_children_left(self):
        assert np.array_equal(self.sampled_spark_tree.get_children_left(),
                              np.array([1, 2, 3, -1, -1, -1, 7, 8, 9, -1, -1, -1, 13, 14, -1, -1, -1]))


    def test_children_right(self):
        assert np.array_equal(self.sampled_spark_tree.get_children_right(),
                              np.array([6, 5, 4, -1, -1, -1, 12, 11, 10, -1, -1, -1, 16, 15, -1, -1, -1]))


    def test_node_nsamples(self):
        assert self.sampled_spark_tree.get_node_nsamples(0) == 891, "Node samples for node 0 should be 891"
        assert self.sampled_spark_tree.get_node_nsamples(1) == 577, "Node samples for node 1 should be 577"
        assert self.sampled_spark_tree.get_node_nsamples(5) == 559, "Node samples for node 5 should be 559"
        assert self.sampled_spark_tree.get_node_nsamples(8) == 3, "Node samples for node 3 should be 3"
        assert self.sampled_spark_tree.get_node_nsamples(12) == 144, "Node samples for node 12 should be 144"
        assert self.sampled_spark_tree.get_node_nsamples(10) == 2, "Node samples node node 10 should be 2"
        assert self.sampled_spark_tree.get_node_nsamples(16) == 23, "Node samples for node 16 should be 23"


    def test_features(self):
        assert np.array_equal(self.sampled_spark_tree.get_features(),
                              np.array([1, 3, 4, -1, -1, -1, 0, 3, 0, -1, -1, -1, 6, 2, -1, -1,
                                        -1])), "Feature indexes should be [1, 3, 4, -1, -1, -1, 0, 3, 0, -1, -1, -1, 6, 2, -1, -1, -1]"


    def test_nclasses(self):
        assert self.sampled_spark_tree.nclasses() == 2, "n classes should be 2"


    def test_node_feature(self):
        assert self.sampled_spark_tree.get_node_feature(0) == 1, "Feature index for node 0 should be 1"
        assert self.sampled_spark_tree.get_node_feature(1) == 3, "Feature index for node 1 should be 3"
        assert self.sampled_spark_tree.get_node_feature(3) == -1, "Feature index for node 3 should be -1"
        assert self.sampled_spark_tree.get_node_feature(7) == 3, "Feature index for node 7 should be 3"
        assert self.sampled_spark_tree.get_node_feature(8) == 0, "Feature index for node 8 should be 0"
        assert self.sampled_spark_tree.get_node_feature(12) == 6, "Feature index for node 12 should be 6"
        assert self.sampled_spark_tree.get_node_feature(16) == -1, "Feature index for node 16 should be -1"


    def test_node_nsamples_by_cls(self):
        assert np.array_equal(self.sampled_spark_tree.get_node_nsamples_by_class(0), np.array([549.0, 342.0]))
        assert np.array_equal(self.sampled_spark_tree.get_node_nsamples_by_class(1), np.array([468.0, 109.0]))
        assert np.array_equal(self.sampled_spark_tree.get_node_nsamples_by_class(5), np.array([463.0, 96.0]))
        assert np.array_equal(self.sampled_spark_tree.get_node_nsamples_by_class(8), np.array([1.0, 2.0]))
        assert np.array_equal(self.sampled_spark_tree.get_node_nsamples_by_class(11), np.array([8.0, 159.0]))
        assert np.array_equal(self.sampled_spark_tree.get_node_nsamples_by_class(13), np.array([51.0, 70.0]))
        assert np.array_equal(self.sampled_spark_tree.get_node_nsamples_by_class(16), np.array([21.0, 2.0]))


    def test_prediction(self):
        assert self.sampled_spark_tree.get_prediction(0) == 0, "Prediction value for node 0 should be 0"
        assert self.sampled_spark_tree.get_prediction(1) == 0, "Prediction value for node 1 should be 0"
        assert self.sampled_spark_tree.get_prediction(4) == 0, "Prediction value for node 4 should be 0"
        assert self.sampled_spark_tree.get_prediction(6) == 1, "Prediction value for node 6 should be 1"
        assert self.sampled_spark_tree.get_prediction(8) == 1, "Prediction value for node 8 should be 1"
        assert self.sampled_spark_tree.get_prediction(10) == 1, "Prediction value for node 10 should be 1"
        assert self.sampled_spark_tree.get_prediction(12) == 0, "Prediction value for node 12 should be 0"
        assert self.sampled_spark_tree.get_prediction(14) == 1, "Prediction value for node 14 should be 1"
        assert self.sampled_spark_tree.get_prediction(15) == 0, "Prediction value for node 15 should be 0"


    def test_nnodes(self):
        assert self.sampled_spark_tree.nnodes() == 17, "Number of nodes from tree should be 17"


    def test_max_depth(self):
        assert self.sampled_spark_tree.get_max_depth() == 4, "Max depth should be 4"


    def test_min_samples_leaf(self):
        assert self.sampled_spark_tree.get_min_samples_leaf() == 1, "Min sample leaf should be 1"


    def test_thresholds(self):
        assert np.array_equal(self.sampled_spark_tree.get_thresholds(),
                              np.array([(list([0.0]), list([1.0, 2.0])), 3.5, 2.5, -1, -1, -1, 2.5, 3.5, 1.5, -1, -1, -1,
                                        24.808349999999997,
                                        (list([1.0, 2.0]), list([0.0, 3.0])), -1, -1, -1]))
        # assert np.array_equal(spark_dtree.get_thresholds(),
        #                       np.array([list([0.0]), 3.5, 2.5, -1, -1, -1, 2.5, 3.5, 1.5, -1, -1, -1, 24.808349999999997,
        #                                 list([1.0, 2.0]), -1, -1, -1]))



    def test_categorical_split(self):
        assert self.sampled_spark_tree.is_categorical_split(1) is False
        assert self.sampled_spark_tree.is_categorical_split(0) is True
        assert self.sampled_spark_tree.is_categorical_split(5) is False
        assert self.sampled_spark_tree.is_categorical_split(12) is False
        assert self.sampled_spark_tree.is_categorical_split(13) is True
