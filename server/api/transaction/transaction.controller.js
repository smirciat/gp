/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/transactions              ->  index
 * POST    /api/transactions              ->  create
 * GET     /api/transactions/:id          ->  show
 * PUT     /api/transactions/:id          ->  update
 * DELETE  /api/transactions/:id          ->  destroy
 */

'use strict';

import _ from 'lodash';
import localEnv from '../../config/local.env';
import {Transaction,Customer,sequelize} from '../../sqldb';
const { Op } = require('sequelize');
import https from 'https';

function respondWithResult(res, statusCode) {
  statusCode = statusCode || 200;
  return function(entity) {
    if (entity) {
      return res.status(statusCode).json(entity);
    }
    return null;
  };
}

function saveUpdates(updates) {
  return function(entity) {
    if(entity) {
      return entity.update(updates)
        .then(updated => {
          return updated;
        });
    }
  };
}

function removeEntity(res) {
  return function(entity) {
    if (entity) {
      return entity.destroy()
        .then(() => {
          res.status(204).end();
        });
    }
  };
}

function handleEntityNotFound(res) {
  return function(entity) {
    if (!entity) {
      res.status(404).end();
      return null;
    }
    return entity;
  };
}

function handleError(res, statusCode) {
  statusCode = statusCode || 500;
  return function(err) {
    console.log(err);
    res.status(statusCode).send(err);
  };
}

// Gets a list of Transactions from a query
export function query(req, res) {
  let queryUsers=req.body.queryUsers||[];
  if (req.body.userId&&!req.body.queryUsers) queryUsers=[req.body.userId];
  let q={where:{userId: { [Op.in]: queryUsers } } };
  return Transaction.findAll(q)
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a list of Transactions
export function index(req, res) {
  let offset=0;
  if (req.body&&req.body.offset) offset=req.body.offset;
  return Transaction.findAll({
    order: [['_id', 'DESC']],
    limit:1000,
    offset:offset*1000
  })
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Transaction from the DB
export function show(req, res) {
  return Transaction.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Creates a new Transaction in the DB
export function create(req, res) {
  return Transaction.create(req.body)
    .then(respondWithResult(res, 201))
    .catch(handleError(res));
}

// Creates a new Transaction in the DB and increments the customer points in accordance
export async function newTransaction(req, res) {
  if (!req.body||!req.body.userId) return res.status(500).json('Can`t create transaction');
  let transaction;
  try {
    transaction = await Transaction.create(req.body);
  }
  catch(err){
    console.log(err);
    return res.status(500).json('Sequelize Error while creating transaction');
  }
  let increment = req.body.points; //negative increment for redeem
  let string='COALESCE("currentPoints",0) - ' + increment;
  if (req.body.awardRedeem==='award') string='COALESCE("currentPoints",0) + ' + increment;
  return Customer.update(
    {
      lastTransaction : transaction._id,
      currentPoints : sequelize.literal(string)
    },
      {
        where:{userId:req.body.userId}
      }
    )
    .then(respondWithResult(res, 201))
    .catch(handleError(res));
  
}

// Updates an existing Transaction in the DB
export function update(req, res) {
  if (req.body._id) {
    delete req.body._id;
  }
  return Transaction.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(saveUpdates(req.body))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Deletes a Transaction from the DB
export function destroy(req, res) {
  return Transaction.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(removeEntity(res))
    .catch(handleError(res));
}

export function webhookOptions(req,res){
  if (req.headers&&req.headers['webhook-request-callback']&&req.headers[localEnv.WEBHOOK_KEY]===localEnv.WEBHOOK_VALUE) {
    console.log(req.headers);
    https.get(req.headers['webhook-request-callback'],(resp) => {
      let data = '';
    
      // A chunk of data has been received
      resp.on('data', (chunk) => {
        data += chunk;
      });
    
      // The whole response has been received
      resp.on('end', () => {
        console.log(data);
      });
    
    }).on('error', (err) => {
      console.log('Error: ' + err.message);
      return res.status(500);
    });
    return res.sendStatus(200);
  }
  else return res.status(401);
}

export function webhooks(req,res) {
  if (!req.headers||req.headers[localEnv.WEBHOOK_KEY] !== localEnv.WEBHOOK_VALUE) {
    return res.status(401).send('Unauthorized');
  }
  
  try {
    const event = req.body;

    // Basic validation
    if (!event.specversion || !event.type || !event.id) {
      return res.status(400).json({
        error: 'Invalid CloudEvent'
      });
    }

    console.log('CloudEvent received');
    console.log('ID:', event.id);
    console.log('Type:', event.type);
    console.log('Source:', event.source);
    console.log('Tenant:', event.tenantid);
    console.log('Subject:', event.subject);
    console.log('Time:', event.time);

    // Event payload
    const flight = event.data;

    console.log('Flight ID:', flight.id);
    console.log('Flight Number:', flight.flightNumber);
    console.log('Departure:', flight.scheduledDepartureTime);
    console.log('Arrival:', flight.scheduledArrivalTime);

    // Route by event type
    switch (event.type) {
      case 'Takeflite.Operations.AircraftControl.FlightCompleted':
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!Takeflite.Operations.AircraftControl.FlightCompleted');
        console.log(flight);
        flightCompleted(flight);
        break;
        
      default:
        console.log('Unhandled event type:', event.type);
    }

    res.status(204).send();
  
  } catch (err) {
    console.error('Webhook processing failed:', err);
    res.status(500).send();
  }
}

async function flightCompleted(flight){
  //test if flight has previously been completed by querying Flight
  
  //if Flight instance does not exist, make a new one, otherwise stop right here
  
  //Grab corresponding getManifest
  
  //Iterate passenger list and find matches with FFN field filled
  
  //try to match FFN with Customer record, if match generate new transaction
}
