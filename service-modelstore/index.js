const path = require('path');
const express = require('express');
const body_parser = require('body-parser');
const genome = require('./api/create');
const search = require('./api/search');
const blob = require('./api/blob');
const auth = require('./auth/auth');

const app = express();

var isMultipart = /^multipart\//i;


function errorHandler (err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }
  res.status(err.status || 500).json({ error: {status: err.status, message: err.message }})
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/Bearer (.+)/);

  if (!match) {
    throw {status:401, message:'Unauthorized:no token'};
  }

  const accessToken = match[1];

  return auth.verifyToken(accessToken, auth.getScope(req, "search"))
    .then((jwt) => {
      req.jwt = jwt;
      next();
    })
    .catch((err) => {
      console.log("err on jwt token:", JSON.stringify(err, null, 4))
      return next({status:401, message:err.message});
    });
}

// parse JSON (application/json content-type)
app.use(body_parser.json());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use('/static', express.static('dist'))

const PORT = process.env.PORT || 3000;
const elastic = process.env.ES_ENDPOINT;

app.post('/v1.0/genome/model', genome.createModel);
app.post('/v1.0/genome/pipeline', genome.createPipeline);
app.put('/v1.0/genome/pipeline/:pipelineId/nextRun', genome.updatePipelineNextRun);
app.post('/v1.0/genome/pipelineRun', genome.createPipelineRun);
app.post('/v1.0/genome/pipelineRun/:runId/status', genome.createPipelineRunStatus);
app.post('/v1.0/genome/search', search.search);
app.post('/v1.0/genome/search/activeSchedules', search.queryPipelinesToRun);
app.post('/v1.0/genome/searchkeywords', authRequired, search.searchByKeywords);
app.post('/v1.0/genome/blob', blob.blob);
app.get('/v1.0/genome/blob/:id', blob.get);

app.get('/v1.0/genome/healthz', (req, res) => {
  res.send('ping!\n');
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`ModelStore app listening on port ${PORT}!`);
})
