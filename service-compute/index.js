const path = require('path');
const express = require('express');
const body_parser = require('body-parser');
const sequence = require('./api/sequence');
const auth = require('./auth/auth');
const axios = require('axios');


const app = express();


function errorHandler (err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }
  res.status(err.status || 500).json({ error: {status: err.status, message: err.message }})
}

function authRequired(req, res, next) {
  console.log("sequence checking auth: ")

  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/Bearer (.+)/);

  if (!match) {
    throw {status:401, message:'Unauthorized:no token'};
  }

  const accessToken = match[1];

  return auth.verifyToken(accessToken, auth.getScope(req, "sequence"))
    .then((jwt) => {
      req.jwt = jwt;
      next();
    })
    .catch((err) => {
      console.log("err on jwt token:", err)
      return next({status:401, message:err.message});
    });
}

// parse JSON (application/json content-type)
app.use(body_parser.json({limit: "25mb"}));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Credentials", "true"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});


const PORT = process.env.PORT || 3000;
const elastic = process.env.ES_ENDPOINT;

app.post('/v1.0/genome/sequence', sequence.scheduleSequence);
app.post('/v1.0/genome/sequence/run', sequence.sequence);

app.get('/v1.0/genome/healthz', (req, res) => {
  res.send('ping!\n');
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Router app listening on port ${PORT}!`);
})
