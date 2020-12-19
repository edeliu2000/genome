from unittest import TestCase
from unittest.mock import patch, MagicMock

import sys
import io
import json
import pickle

import numpy as np

mock_tfload = MagicMock()
mock_keras = MagicMock()
mock_models = MagicMock()
mock_layers = MagicMock()
mock_preprocessors = MagicMock()

mock_tfload.saved_model = MagicMock()
mock_tfload.saved_model.load.return_value = {"id": "blob-123"}
sys.modules["tensorflow"] = mock_tfload
sys.modules["tensorflow.keras"] = mock_keras
sys.modules["tensorflow.keras.models"] = mock_models
sys.modules["tensorflow.keras.layers"] = mock_layers
sys.modules["tensorflow.keras.preprocessing.image"] = mock_preprocessors

sys.modules["six"] = MagicMock()
sys.modules["attr"] = MagicMock()


mock_numpy = MagicMock()
mock_numpy.saved_model = MagicMock()
mock_numpy.saved_model.load.return_value = {"id": "blob-123"}
sys.modules["numpy"] = mock_numpy


mock_shap = MagicMock()
mock_shap.TreeExplainer = MagicMock()
mock_shap.LinearExplainer = MagicMock()
mock_shap.TreeExplainer.shap_values.return_value = [2,2,2]
mock_shap.LinearExplainer.shap_values.return_value = [3,3,3]
sys.modules["shap"] = mock_shap


from ..modelstore import client
from ..modelstore import explainer
from ..modelstore import estimator

from ..modelstore.meta_extractor import SKMetaExtractor
from ..modelstore.meta_extractor import XGMetaExtractor
from ..modelstore.meta_extractor import TFMetaExtractor
from ..modelstore.meta_extractor import LightGBMMetaExtractor
from ..modelstore.meta_extractor import CatBoostMetaExtractor


class TestGenomeExplainer(TestCase):

    def test_tree_explainer(self):

        class sklearnTreeMock(MagicMock):
            pass

        estimatorMock = sklearnTreeMock()
        genomeExplainer = explainer.GenomeExplainer(estimatorMock, "tabular")

        self.assertEqual(genomeExplainer.model_type, "tree")

        genomeExplainer.explainer.shap_values.return_value = [2,2,2]
        res = genomeExplainer.explain([1,2,3])
        self.assertEqual(res, [2,2,2])


    def test_linear_explainer(self):

        class sklearnLinearMock(MagicMock):
            pass

        estimatorMock = sklearnLinearMock()
        genomeExplainer = explainer.GenomeExplainer(estimatorMock, "tabular")

        self.assertEqual(genomeExplainer.model_type, "linear")

        genomeExplainer.explainer.shap_values.return_value = [3,3,3]
        res = genomeExplainer.explain([1,2,3])
        self.assertEqual(res, [3,3,3])



    @patch(explainer.__name__ + ".explain_prediction")
    def test_image_explainer(self, mock_pred):

        class tensorflowImageMock(MagicMock):
            pass

        estimatorMock = tensorflowImageMock()
        genomeExplainer = explainer.GenomeExplainer(estimatorMock, "image")

        self.assertEqual(genomeExplainer.model_type, "nn")

        #mock_image_explain.explain_prediction.return_value = [2,2,2]
        mock_pred.return_value = [2,2,2]
        res = genomeExplainer.explain(np.array([[1,2,3],[1,2,3],[1,2,3]]))
        self.assertEqual(res, [2,2,2])




    @patch(explainer.__name__ + ".TextExplainer", create=True)
    @patch(explainer.__name__ + ".format_as_dict", create=True, side_effect=lambda x: x)
    def test_text_explainer(self, mock_format, mock_explainer):

        class tensorflowTextMock(MagicMock):
            pass


        mock_instance = mock_explainer.return_value
        mock_instance.fit = MagicMock()
        mock_instance.explain_prediction = MagicMock(return_value=[2,2,2])

        estimatorMock = tensorflowTextMock()
        estimatorMock.func_pred = MagicMock()
        estimatorMock.func_pred.return_value = 1
        genomeExplainer = explainer.GenomeExplainer(estimatorMock, "text", estimator_predict="func_pred")

        self.assertEqual(genomeExplainer.model_type, "nn")


        res = genomeExplainer.explain(np.array([[1,2,3],[1,2,3],[1,2,3]]), estimator=estimatorMock)
        self.assertEqual(res, [2,2,2])
        mock_instance.explain_prediction.assert_called()




    @patch(estimator.__name__ + ".GenomeExplainer")
    def test_genome_estimator(self, mock_explainer):

        class tensorflowTextMock(MagicMock):
            pass

        estimatorMock = tensorflowTextMock()
        estimatorMock.func_pred = MagicMock()
        estimatorMock.func_pred.return_value = 1

        mock_preprocessor = MagicMock()
        mock_instance = mock_explainer.return_value
        mock_instance.explain = MagicMock(return_value=[2,2,2])

        genomeEstimator = estimator.GenomeEstimator(estimatorMock,
           data_preprocessor = mock_preprocessor,
           modality="text",
           estimator_predict="func_pred")

        self.assertTrue(genomeEstimator.explainer != None)


        res = genomeEstimator.explain(np.array([[1,2,3],[1,2,3],[1,2,3]]))

        mock_preprocessor.assert_called()
        mock_instance.explain.assert_called()
        self.assertEqual(res, [2,2,2])






class TestModelStoreSave(TestCase):
    @patch(client.__name__ + '.urllib.request.urlopen')
    def test_save(self, mock_urlopen):

        cm = MagicMock()
        cm.getcode.return_value = 200
        cm.read.return_value = '{"id": "blob-123"}'
        cm.__enter__.return_value = cm

        cm1 = MagicMock()
        cm1.getcode.return_value = 200
        cm1.read.return_value = '{"id": "model-123"}'
        cm1.__enter__.return_value = cm1


        mock_urlopen.side_effect = [cm, cm1]

        modelStore = client.ModelStore()
        modelStore.saveModel({}, {})


        mock_urlopen.assert_called()
        # self.assertEqual(sum(2,3), 9)

        # testing metadata save being called with right extracted parameters
        modelMeta = json.loads(mock_urlopen.call_args_list[1][0][1])
        self.assertEqual(modelMeta["application"], "modelPipeline")
        self.assertEqual(modelMeta["pipelineName"], "modelPipeline")
        self.assertEqual(modelMeta["framework"], "tensorflow")



    @patch(client.__name__ + '.urllib.request.urlopen')
    def test_load_model(self, mock_urlopen):

        cm = MagicMock()
        cm.getcode.return_value = 200
        cm.read.return_value = '[{"id": "model-123", "application": "search", "canonicalName": "/search/pipeline", "framework":"sklearn", "artifactBlob":{"ref":"blob-123"}}]'
        cm.__enter__.return_value = cm

        cm1 = MagicMock()
        cm1.getcode.return_value = 200
        cm1.read.return_value = pickle.dumps({"id": "blob-123"})
        cm1.__enter__.return_value = cm1


        mock_urlopen.side_effect = [cm, cm1]

        modelStore = client.ModelStore()

        model, meta = modelStore.loadModel({
          "canonicalName":"/search/pipeline",
          "application": "search"
        }, withMeta=True)

        mock_urlopen.assert_called()


        self.assertEqual(model["id"], "blob-123")
        self.assertEqual(meta["id"], "model-123")

        # self.assertEqual(sum(2,3), 9)

        # testing metadata call with right extracted parameters
        self.assertEqual(len(mock_urlopen.call_args_list), 2)

        modelMeta = json.loads(mock_urlopen.call_args_list[0][0][1])
        self.assertEqual(modelMeta["application"], "search")
        self.assertEqual(modelMeta["canonicalName"], "/search/pipeline")


    @patch(client.__name__ + '.zipfile.ZipFile')
    @patch(client.__name__ + '.urllib.request.urlopen')
    def test_load_tf_model(self, mock_urlopen, mock_zip):

        cm = MagicMock()
        cm.getcode.return_value = 200
        cm.read.return_value = '[{"id": "model-123", "application": "search", "canonicalName": "/search/pipeline", "framework":"tensorflow", "artifactBlob":{"ref":"blob-123"}}]'
        cm.__enter__.return_value = cm

        cm1 = MagicMock()
        cm1.getcode.return_value = 200
        cm1.read.return_value = b"Tensorflow Model: \x00\x01"
        cm1.__enter__.return_value = cm1


        mock_urlopen.side_effect = [cm, cm1]

        mock_zip.namelist.return_value = '["file-1"]'
        mock_zip.extractall.return_value = "no-op"

        modelStore = client.ModelStore()
        model, meta = modelStore.loadModel({
          "canonicalName":"/search/pipeline",
          "application": "search"
        }, withMeta=True)

        mock_urlopen.assert_called()


        self.assertEqual(model["id"], "blob-123")
        self.assertEqual(meta["id"], "model-123")

        # self.assertEqual(sum(2,3), 9)

        # testing metadata call with right extracted parameters
        self.assertEqual(len(mock_urlopen.call_args_list), 2)

        modelMeta = json.loads(mock_urlopen.call_args_list[0][0][1])
        self.assertEqual(modelMeta["application"], "search")
        self.assertEqual(modelMeta["canonicalName"], "/search/pipeline")




    def test_model_extractor(self):

        class sklearnEnsembleMock(MagicMock):
            pass
        class sklearnTreeMock(MagicMock):
            pass
        class sklearnLinearMock(MagicMock):
            pass
        class xgboostEnsembleMock(MagicMock):
            pass
        class lightgbmEnsembleMock(MagicMock):
            pass
        class catboostEnsembleMock(MagicMock):
            pass
        class tensorflowMock(MagicMock):
            pass
        class kerasMock(MagicMock):
            pass

        estimatorMock = sklearnEnsembleMock()
        estimatorMock.estimators_ = [1,2,7]
        extracted = SKMetaExtractor().extract(estimatorMock)
        self.assertEqual(extracted["__estimator_category__"], "ensemble")
        self.assertEqual(extracted["__num_estimators__"], 3)
        self.assertEqual(extracted["__estimator_class_name__"], "sklearnEnsembleMock")


        estimatorMock = xgboostEnsembleMock()
        estimatorMock.get_dump.return_value = [1,2,7]
        extracted = XGMetaExtractor().extract(estimatorMock)
        self.assertEqual(extracted["__estimator_category__"], "ensemble")
        self.assertEqual(extracted["__num_estimators__"], 3)
        self.assertEqual(extracted["__estimator_class_name__"], "XGBoost")


        estimatorMock = lightgbmEnsembleMock()
        extracted = LightGBMMetaExtractor().extract(estimatorMock)
        self.assertEqual(extracted["__estimator_category__"], "ensemble")
        self.assertEqual(extracted["__num_estimators__"], 1)
        self.assertEqual(extracted["__estimator_class_name__"], "LightGBM")


        estimatorMock = catboostEnsembleMock()
        extracted = CatBoostMetaExtractor().extract(estimatorMock)
        self.assertEqual(extracted["__estimator_category__"], "ensemble")
        self.assertEqual(extracted["__num_estimators__"], 1)
        self.assertEqual(extracted["__estimator_class_name__"], "CatBoost")


        estimatorMock = tensorflowMock()
        extracted = TFMetaExtractor().extract(estimatorMock)
        self.assertEqual(extracted["__estimator_category__"], "neural-network")
        self.assertEqual(extracted["__estimator_class_name__"], "NeuralNetwork")


        estimatorMock = kerasMock()
        extracted = TFMetaExtractor().extract(estimatorMock)
        self.assertEqual(extracted["__estimator_category__"], "neural-network")
        self.assertEqual(extracted["__estimator_class_name__"], "NeuralNetwork")
