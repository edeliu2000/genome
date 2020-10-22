const axios = require('axios');


const processSchedules = (modelStoreLocation, shard) => {

  const scheduleQuery = {
    "activeSchedules": 123
  }

  // create a pipeline in ModelStore
  var promise = axios.post( modelStoreLocation + "/v1.0/genome/pipeline", pipelineMeta)
  .then(function(response){
    console.log("created pipeline: ", response.data);
    var pipelineId = response.data.id
    return res.status(200).json({id:pipelineId, nextRun: pipelineMeta["nextRun"]})
  }).catch((err) => {
    console.log("err on pipeline creation:", err)
    return next(err);
  });


}


const modelStoreLocation = process.env.MODELSTORE || 'http://modelstore:3000';
const scheduleShard = process.env.SCHEDULE_SHARD || 'shard-1';


processSchedules(modelStoreLocation, scheduleShard);
