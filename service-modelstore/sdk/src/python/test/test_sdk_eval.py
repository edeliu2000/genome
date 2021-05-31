from unittest import TestCase
from unittest.mock import patch, MagicMock

import sys
import io
import json
import pickle
import logging

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)



from ..modelstore import evaluationstore





class TestEvaluationStoreSave(TestCase):
    @patch(evaluationstore.__name__ + '.urllib.request.urlopen')
    def test_save(self, mock_urlopen):

        cm = MagicMock()
        cm.getcode.return_value = 200
        cm.read.return_value = '{"id": "evaluation-run-123"}'
        cm.__enter__.return_value = cm


        mock_urlopen.side_effect = [cm]

        store = evaluationstore.EvaluationStore()
        evaluation = evaluationstore.Evaluation(
          canonicalName = "search/pipe-1",
          application = "search")
        store.save(evaluation.createRun())


        mock_urlopen.assert_called()
        # self.assertEqual(sum(2,3), 9)

        # testing metadata save being called with right extracted parameters
        evalRunMeta = json.loads(mock_urlopen.call_args_list[0][0][1])
        self.assertEqual(evalRunMeta["canonicalName"], "search/pipe-1")



    @patch(evaluationstore.__name__ + '.urllib.request.urlopen')
    def test_load_evaluation(self, mock_urlopen):

        cm = MagicMock()
        cm.getcode.return_value = 200
        cm.read.return_value = '[{"id": "eval-123", "application": "search", "canonicalName": "/search/pipeline", "framework":"sklearn", "artifactBlob":{"ref":"blob-123"}}]'
        cm.__enter__.return_value = cm


        mock_urlopen.side_effect = [cm]


        store = evaluationstore.EvaluationStore()


        evaluation = store.load({
          "canonicalName":"/search/pipeline",
          "application": "search"
        })

        mock_urlopen.assert_called()


        self.assertEqual(evaluation["id"], "eval-123")

        # self.assertEqual(sum(2,3), 9)

        # testing metadata call with right extracted parameters
        self.assertEqual(len(mock_urlopen.call_args_list), 1)

        modelMeta = json.loads(mock_urlopen.call_args_list[0][0][1])
        self.assertEqual(modelMeta["application"], "search")
        self.assertEqual(modelMeta["canonicalName"], "/search/pipeline")
