from unittest import TestCase, TestSuite, TextTestRunner
from unittest.mock import patch, MagicMock

import sys
import io
import json
import pickle
import logging

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


from .fixtures import TrainTestEvaluation


class TestEvaluationRunSpec(TestCase):

    def test_spec_run(self):

        store = MagicMock()
        store.save.return_value = {}
        eval_ml = TrainTestEvaluation(store, target = "model-uuid")
        eval_run = eval_ml.to_run()

        store.save.assert_called()
        # self.assertEqual(sum(2,3), 9)

        num_tasks = len(eval_run.tasks)

        # 3 tasks from functions plus 5 from prototypes
        self.assertEqual(num_tasks, 8)

        self.assertEqual(eval_run.tasks[0]["name"], "evaluateTrainTestSplit")
        self.assertEqual(eval_run.tasks[0]["metrics"]["f2"], 2.34)
        self.assertEqual(len(eval_run.tasks[0]["expectations"]), 1)

        self.assertEqual(eval_run.canonicalName, "test/skill/annotations/better-than-last")
        self.assertEqual(eval_run.validationTarget["ref"], "model-uuid")
