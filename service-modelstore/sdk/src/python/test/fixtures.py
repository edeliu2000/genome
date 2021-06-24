
import logging

from ..modelstore.evaluationspec import GenomeEvaluationRun, evaluation, task



@evaluation(
  name="test/skill/annotations/better-than-last",
  versionName="1.2.sklearn",
  code = "ensemble-training:local.1",
  targetModel="target-id")
class TrainTestEvaluation(GenomeEvaluationRun):


    @task(dataset={"ref": "mllake://datasets/test-benchmark/california-housing-test"})
    def evaluateTrainTestSplit(self, t, dataset):
        my_split = 0.7

        t.add_metric("f2", 2.34)
        t.expect(my_split, var="my_split").toBeLess(0.76)


    @task(dataset={"ref": "mllake://datasets/test-benchmark/california-housing-test"})
    def checkError(self, t, dataset):
        my_split = 0.7

        t.add_metric("f2", 2.34)
        t.expect(lambda: 5/0, var="myFunction").toThrow(ZeroDivisionError)


    @task(dataset={"ref": "mllake://datasets/test-benchmark/california-housing-test"})
    def prototypeTest(self, t, dataset):

        logging.info("running evaluation task:")
        logging.info(t)

        intersect = 0.82
        t.add_metric("intersection", intersect) \
          .expect(intersect, var="intersection") \
          .toBeGreater(0.52)

        # now prototypes
        for record in range(5):
            m = record * 1.24
            t.prototype(ref="id-123") \
              .add_metric("f1", record * 2.34) \
              .expect(m, var="f1") \
              .toBe([1,0], var="metric")
