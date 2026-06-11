/**
 * Main application file
 */

'use strict';

import express from 'express';
import sqldb from './sqldb';
import localEnv from './config/local.env';
import config from './config/environment';
import {fixEmail} from './api/customer/customer.controller.js';
import {setBearer} from './api/thing/thing.controller.js';
import http from 'http';
import cors from 'cors';
// Populate databases with sample data
if (config.seedDB) { require('./config/seed'); }

// Setup server
var app = express();
const corsOptions = {
  origin: localEnv.FRONTEND,// Change to https://yourfrontend.com in production
  optionsSuccessStatus: 200 // For legacy browser support (IE11, various Smart TVs)
};
app.use(cors(corsOptions));
var server = http.createServer(app);
var socketio = require('socket.io')(server, {
  serveClient: config.env !== 'production',
  path: '/socket.io-client'
});
require('./config/socketio').default(socketio);
require('./config/express').default(app);
require('./routes').default(app);

// Start server
function startServer() {
  app.angularFullstack = server.listen(config.port, config.ip, function() {
    console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
    setBearer();
  });
}

sqldb.sequelize.sync()
  .then(startServer)
  .catch(function(err) {
    console.log('Server failed to start due to error: %s', err);
  });
  
// Listen for termination signals
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    // Close DB connections here if needed
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT (Ctrl+C) received');
  process.exit(0);
});  

  
// Expose app
exports = module.exports = app;