/**
 * Main application file
 */

'use strict';

import express from 'express';
import sqldb from './sqldb';
import localEnv from './config/local.env';
import config from './config/environment';
import {setBearer} from './api/thing/thing.controller.js';
import http from 'http';
// Populate databases with sample data
if (config.seedDB) { require('./config/seed'); }

// Setup server
var app = express();
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