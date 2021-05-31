const { Client } = require('@elastic/elasticsearch')
const elastic = process.env.ES_ENDPOINT || 'http://docker.for.mac.localhost:9200';
const client = new Client({
  node: elastic,
  auth: {
    username:"elastic",
    password:process.env.ES_PASS
  },
  ssl: {
    ca: process.env.ES_CERT
  }

})


const createError = (status, message, err) => {
  var error = err || new Error(message);
  error.status = status;
  error.message = message;
  return error;
};



const searchByKeywords = function(req, res, next){

  if(!req.body.query){
    return next(createError(400, 'query field missing'));
  }

  var artifactTypeProperty = req.body.artifactType || "testRun";
  var sortPropertyDesc = req.query.sortDesc || "created";
  var sortProperty = {};
  var sortList = [];
  var fieldsToSearch = ["canonicalName", "versionName", "framework" , "_id"];

  sortProperty[sortPropertyDesc] = {"order":"desc"}
  sortList.push(sortProperty)

  if(artifactTypeProperty === "testRun" || artifactTypeProperty === "evaluationRun" ){
    fieldsToSearch.push("pipelineStage")
    fieldsToSearch.push("pipelineName")
    fieldsToSearch.push("pipelineRunId")
  }

  var fromDate = Number(req.query.from || Date.now() - (1000 * 60 * 60 * 24 * 7));
  var toDate = Number(req.query.to || Date.now());

  console.log("date range:", fromDate, toDate)

  var query = {
    index: 'validation-artifacts',
    body: {
      from : 0,
      size: 10,
      sort: sortList,
      query: { bool: { must: [
        {term: {"artifactType": artifactTypeProperty}},
        {range : {
          created : {
            gte : fromDate,
            lte : toDate
          }
        }},
        {multi_match : {
            query : req.body.query,
            fields : fieldsToSearch
        }}
        ]}
      }}
  };


  client.search(query, (err, result) => {
      if (err) {
        console.log(JSON.stringify(err, null, 4));
        return next(createError(
          500,
          'error during storing of ' + artifactTypeProperty + ': ',
          err));
      }

      var arr = [];
      if(result.body.hits && result.body.hits.hits){
        result.body.hits.hits.forEach((item, i) => {
          item._source.id = item._id;
          arr.push(item._source);
        });
      }
      return res.json(arr);
  })
};




const search = function(req, res, next){


  var sortPropertyDesc = req.query.sortDesc || "created";
  var sortProperty = {};
  var sortList = [];
  sortProperty[sortPropertyDesc] = {"order":"desc"}
  sortList.push(sortProperty)

  var fromDate = Number(req.query.from || Date.now() - (1000 * 60 * 60 * 24 * 7));
  var toDate = Number(req.query.to || Date.now());

  if(!req.body.application){
    return next(createError(400, 'application field missing'));
  }

  console.log("query for search", req.body, fromDate, toDate);

  var artifactTypeProperty = req.body.artifactType || "testRun";

  var query = {
    index: 'validation-artifacts',
    body: {
      from : 0,
      size: 10,
      sort: sortList,
      query: { bool: {
        filter: [
          {term: {"artifactType": artifactTypeProperty}},
          {term: {"application": req.body.application}}
        ]},
    }}
  };

  if(req.body.validationTarget && req.body.validationTarget.ref){
    query.body.query.bool.filter.push({
      term: {"validationTarget.ref": req.body.validationTarget.ref}
    });
  }

  if(req.body.pipelineName){
    query.body.query.bool.filter.push({
      term: {"pipelineName": req.body.pipelineName}
    });
  }

  if(req.body.canonicalName){
    query.body.query.bool.filter.push({
      term: {"canonicalName": req.body.canonicalName}
    });
  }

  if(req.body.parameters && req.body.parameters.__type__){
    query.body.query.bool.filter.push({
      term: {"parameters.__type__": req.body.parameters.__type__}
    });
  }

  if(req.body.versionName){
    query.body.query.bool.filter.push({
      term: {"versionName": req.body.versionName}
    });
  }

  if(artifactTypeProperty.toLowerCase().indexOf("run") && req.body.pipelineStage){
    query.body.query.bool.filter.push({
      term: {"pipelineStage": req.body.pipelineStage}
    });
  }

  if(artifactTypeProperty.toLowerCase().indexOf("run") >= 0 && req.body.pipelineRunId){
    query.body.query.bool.filter.push({
      term: {"pipelineRunId": req.body.pipelineRunId}
    });
  }

  //add time range
  query.body.query.bool.filter.push({range : {
    created : {
      gte : fromDate,
      lte : toDate
    }
  }});

  client.search(query, (err, result) => {

    if (err) {
      console.log(JSON.stringify(err, null, 4));
      return next(createError(500, 'error during storing of ' + artifactTypeProperty + ': ', err));
    }

    var arr = [];
    if(result.body.hits && result.body.hits.hits){
      result.body.hits.hits.forEach((item, i) => {
        item._source.id = item._id;
        arr.push(item._source);
      });
    }

    return res.json(arr);
  })
};


module.exports = {
  search: search,
  searchByKeywords: searchByKeywords
}
