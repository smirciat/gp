/**
 * Main application file
 */

'use strict';

import express from 'express';
import sqldb from './sqldb';
import config from './config/environment';
import http from 'http';
//import {createApp} from './api/user/user.controller.js';

//const csv = require('csv-parser');
//const fs = require('fs');
//export const results = [];

//fs.createReadStream('./emp.csv')
//  .pipe(csv())
//  .on('data', (data) => results.push(data))
//  .on('end', () => {
//    console.log(results);
    // Process your data here
//  });



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
    //results.forEach(result=>{
      //if (result['Job Title']!=="CSA"&&result['Job Title']!=="Security Coordinator"&&result['Job Title']!=="STMGR"&&result['Job Title']!=="OFFICE") return;
      //let customer={};
      //customer.name=result['First Name'] + ' ' + result['Last Name'];
      //customer.email=result['Primary Email'];
      //customer.role='user';
      //customer.provider='local';
    //  customer.userName=result.Username;
    //  customer.userId=result['User ID'];
    //  customer.points=result.Points;
      //console.log(customer)
      //createApp(customer);
    //});
  });
}

sqldb.sequelize.sync()
  .then(startServer)
  .catch(function(err) {
    console.log('Server failed to start due to error: %s', err);
  });

// Expose app
exports = module.exports = app;
