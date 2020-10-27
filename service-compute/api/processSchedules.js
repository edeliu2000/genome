const axios = require('axios');
const sequence = require('./sequence');


const processSchedules = (modelStoreLocation, sequencerLocation, shard) => {

  const scheduleQuery = {
    "nextRun": Date.now(),
    "shard": shard
  }

  console.log("RUNNING JOB - trigger active sheduled pipelines with nextRun below: ", scheduleQuery.nextRun);

  var pipelinesToRun = null;

  // get all active piplines with nextRun smaller then now
  var promise = axios.post( modelStoreLocation + "/v1.0/genome/search/activeSchedules", scheduleQuery)
  .then((response) => {
    console.log("got pipelines to run: ", response.data);
    pipelinesToRun = response.data || [];

    var nextRuns = pipelinesToRun.map((pipe) => {
      return axios.put(modelStoreLocation + "/v1.0/genome/pipeline/" + pipe.id + "/nextRun", {
        nextRun: sequence.calculateNextRun(pipe.schedule, pipe.nextRun),
      })
    })

    // now update all nextRuns in the result from active pipeline
    return axios.all(nextRuns)

  }).then((responseArr) => {
    //construct calls to trigger pipelineRuns
    const runs = pipelinesToRun.map((pipe) => {
      var sequencerRun = {
        application: pipe.application,
        canonicalName: pipe.canonicalName,
        pipelineName: pipe.pipelineName,
        versionName: pipe.versionName,
        steps: pipe.recipeRef ? JSON.parse(pipe.recipeRef.ref || "[]") : []
      };
      return axios.post(sequencerLocation + "/v1.0/genome/sequencer/run", sequencerRun);
    })

    //now trigger pipelines
    return axios.all(runs)

  }).catch((err) => {
    console.log("ProcessNextRun error on processing active schedules: ", err)
  });
}


module.exports = {
  processSchedules: processSchedules,
}
