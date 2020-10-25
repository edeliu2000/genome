const axios = require('axios');
const sequence = require('./api/sequence');


const processSchedules = (modelStoreLocation, sequencerLocation, shard) => {

  const scheduleQuery = {
    "nextRun": Date.now()
  }

  var pipelinesToRun = null;

  // get all active piplines with nextRun smaller then now
  var promise = axios.post( modelStoreLocation + "/v1.0/genome/search/activeSchedules", scheduleQuery)
  .then((response) => {
    console.log("got pipelines to run: ", response.data);
    pipelinesToRun = response.data || [];

    var nextRuns = pipelinesToRun.map((pipe) => {
      var nextRun = pipe.schedule + pipe.nextRun
      return axios.put(modelStoreLocation + "/v1.0/genome/pipeline/" + pipe.id + "/nextRun", {
        nextRun: sequence.calculateNextRun(pipe.schedule, pipe.nextRun);
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


const modelStoreLocation = process.env.MODELSTORE || 'http://modelstore:3000';
const sequencerLocation = process.env.COMPUTE || 'http://compute:3000';
const scheduleShard = process.env.SCHEDULE_SHARD || 'shard-1';


processSchedules(modelStoreLocation, sequencerLocation, scheduleShard);
