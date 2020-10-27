const axios = require('axios');
const { processSchedules } = require('./api/processSchedules');


const modelStoreLocation = process.env.MODELSTORE || 'http://modelstore:3000';
const sequencerLocation = process.env.COMPUTE || 'http://compute:3000';
const scheduleShard = process.env.SCHEDULE_SHARD || 'shard-1';


processSchedules(modelStoreLocation, sequencerLocation, scheduleShard);
