from unittest import TestCase
from unittest.mock import patch, MagicMock

import sys
import io
import json
import pickle

mock_tfload = MagicMock()
mock_tfload.saved_model = MagicMock()
mock_tfload.saved_model.load.return_value = {"id": "blob-123"}
sys.modules["tensorflow"] = mock_tfload

from ..modelstore import client

from ..modelstore.meta_extractor import SKMetaExtractor
from ..modelstore.meta_extractor import XGMetaExtractor
from ..modelstore.meta_extractor import TFMetaExtractor
from ..modelstore.meta_extractor import LightGBMMetaExtractor
from ..modelstore.meta_extractor import CatBoostMetaExtractor



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
        cm.read.return_value = '[{"id": "model-123", "framework":"sklearn",  "artifactBlob":{"ref":"blob-123"}}]'
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
        cm.read.return_value = '[{"id": "model-123", "framework":"tensorflow",  "artifactBlob":{"ref":"blob-123"}}]'
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
