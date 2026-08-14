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
import {Transaction,Customer,Flight,sequelize} from '../../sqldb';
import { getManifest } from '../thing/thing.controller.js';
import {
  normalizePoints,
  reverseBalanceDelta,
  signedBalanceDelta,
  validateTransactionPoints
} from './points-guard';
const { Op } = require('sequelize');
import https from 'https';

function newTransactionFailure(res, message, statusCode) {
  statusCode = statusCode || 400;
  if (res) {
    return res.status(statusCode).json(message);
  }
  return message;
}

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
  if (!req.body||!req.body.userId) {
    if (res) return res.status(500).json('Can`t create transaction');
    return 'Can`t create transaction';
  }

  const awardRedeem = req.body.awardRedeem || 'award';
  const validated = validateTransactionPoints(req.body.points, awardRedeem);
  if (!validated.ok) {
    return newTransactionFailure(res, validated.message, 400);
  }
  req.body.points = validated.points;

  let transaction;
  try {
    transaction = await Transaction.create(req.body);
  }
  catch(err){
    console.log(err);
    if (res) return res.status(500).json('Sequelize Error while creating transaction');
    return 'Sequelize Error while creating transaction';
  }

  if (validated.skipBalance) {
    if (res) return res.status(200).json(transaction);
    return 'New Transaction Successful';
  }

  const delta = signedBalanceDelta(awardRedeem, validated.points);
  if (delta === 0) {
    if (res) return res.status(200).json(transaction);
    return 'New Transaction Successful';
  }

  const string = 'COALESCE("currentPoints",0) + ' + delta;
  try {
    await Customer.update(
      {
        lastTransaction : transaction._id,
        currentPoints : sequelize.literal(string)
      },
        {
          where:{userId:req.body.userId}
        }
    );
    if (res) return res.status(200).json(transaction);
    return 'New Transaction Successful';
  }
  catch(err){
    console.log(err);
    if (res) return res.status(500).json('Sequelize Error while updating customer');
    return 'Sequelize Error while updating customer';
  }
}

// Updates an existing Transaction in the DB
export async function update(req, res) {
  //oldTransaction updates to newTransaction
  if (!req.body.newTransaction||!req.body.oldTransaction)  {
    if (res) return res.status(500).json('Please incude newTransaction and oldTransaction');
    return 'Please incude newTransaction and oldTransaction';
  }
  
  const newType = req.body.newTransaction.awardRedeem || 'award';
  const newValidated = validateTransactionPoints(
    req.body.newTransaction.points,
    newType
  );
  if (!newValidated.ok) {
    if (res) return res.status(400).json(newValidated.message);
    return newValidated.message;
  }
  req.body.newTransaction.points = newValidated.points;

  const pointsOrTypeChanged =
    req.body.newTransaction.points !== req.body.oldTransaction.points ||
    req.body.newTransaction.awardRedeem !== req.body.oldTransaction.awardRedeem;

  if (pointsOrTypeChanged) {
    const oldDelta = signedBalanceDelta(
      req.body.oldTransaction.awardRedeem,
      req.body.oldTransaction.points
    );
    const newDelta = newValidated.skipBalance
      ? 0
      : signedBalanceDelta(newType, newValidated.points);
    const increment = newDelta - oldDelta;
    if (increment !== 0) {
      const string = 'COALESCE("currentPoints",0) + ' + increment;
      try {
        await Customer.update(
          {
            lastTransaction: req.body.oldTransaction._id,
            currentPoints: sequelize.literal(string)
          },
          {
            where: { userId: req.body.oldTransaction.userId }
          }
        );
      } catch (err) {
        console.log(err);
        if (res) {
          return res
            .status(500)
            .json('Sequelize Error while updating customer currentPoints');
        }
        return 'Sequelize Error while updating customer currentPoints';
      }
    }
  }
  try {
    await Transaction.update(
      req.body.newTransaction,
      {
        where:{_id:req.body.oldTransaction._id}
      }
    );
    if (res) return res.status(200).json('Updated Transaction Successful');
    return 'Updated Transaction Successful';
  }
  catch(err){
      console.log(err);
      if (res) return res.status(500).json('Sequelize Error while updating transaction');
      return 'Sequelize Error while updating transaction';
    }
}

// Deletes a Transaction from the DB and reverses its effect on currentPoints
export async function destroy(req, res) {
  try {
    const row = await Transaction.findOne({
      where: { _id: req.params.id }
    });
    if (!row) {
      res.status(404).end();
      return;
    }

    const plain = row.get({ plain: true });
    const delta = reverseBalanceDelta(plain.awardRedeem, plain.points);
    if (delta !== 0) {
      const customer = await Customer.findOne({
        where: { userId: plain.userId }
      });
      if (customer) {
        const cp = normalizePoints(customer.get({ plain: true }).currentPoints) || 0;
        await customer.update({ currentPoints: cp + delta });
      }
    }

    await row.destroy();
    res.status(204).end();
  } catch (err) {
    handleError(res)(err);
  }
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
    // Event payload
    const flight = event.data;
    // Route by event type
    switch (event.type) {
        
      case 'Takeflite.Operations.AircraftControl.FlightStatusChanged':
        //console.log(flight);
        console.log('Event Takeflite.Operations.AircraftControl.FlightStatusChanged has fired');
        flightCompleted(flight);
        break;
        
      default:
        console.log('Unhandled event type:', event.type);
        break;
    }

    res.status(204).send();
  
  } catch (err) {
    console.error('Webhook processing failed:', err);
    res.status(500).send();
  }
}

async function flightCompleted(flight){
  let date = new Date(flight.scheduledDepartureTime);//departureDate);
  let dateString=date.toLocaleDateString();
  let manifest={};
  let flightArray=[];
  if (!flight.flightNumber||flight.flightNumber.length<2) return;
  if (flight.status!=="Completed") return;
  let f={
    dateString:dateString,
    date:date,
    flight:flight,
    flightNumber:flight.flightNumber.split('.')[0]
  };
  //test if flight has previously been completed by querying Flight
  try {
    flightArray = await Flight.findAll({
      where: {
        dateString:dateString,
        flightNumber:f.flightNumber
      },
      raw:true
    });
    if (flightArray.length>0) return;
  }
  catch(err){
    console.log(err);
    return;
  }
  //if Flight instance does not exist, make a new one, otherwise stop right here
  console.log(dateString);
  console.log(f.flightNumber)
  //Grab corresponding getManifest
  try {
    manifest=await getManifest({
      body:{
        date:dateString,
        flightNum:f.flightNumber
      }
    });
    manifest=manifest.flight;
  }
  catch(err){
    console.log(err);
    return;
  }
  //Iterate passenger list and find matches with FFN field filled
  let passengers=[];
  manifest.flightLegs.forEach(leg=>{
    let origin = leg.origin.name;
    leg.passengers.forEach(passenger=>{
      //**************************************************************Watch for 3 or more legs with a passenger riding through!
      if (passenger.boardPoint.name!==origin) return;
      passenger.description = dateString + ' ' + passenger.bookingNumber + ' ' + passenger.boardPoint.code + '-' + passenger.offPoint.code;
      passenger.description += ' ' + f.flightNumber + ' Assigned after Takeflite Webhook';
      if (passenger.name) {
        let arr=[];
        if (!passenger.name.firstName&&passenger.name.lastName) {
          arr=passenger.name.lastName.split(' ');
          passenger.name.firstName=arr.shift();
          passenger.name.lastName=arr.join(' ');
        }
        if (passenger.name.firstName&&!passenger.name.lastName) {
          arr=passenger.name.firstName.split(' ');
          passenger.name.firstName=arr.shift();
          passenger.name.lastName=arr.join(' ');
        }
      }
      passengers.push(passenger);
    });
    manifest.passengers=passengers;
  });
  
  f.flight=manifest;
  try {
    await Flight.create(f);
  }
  catch(err){
    console.log(err);
    return;
  }
  
}
