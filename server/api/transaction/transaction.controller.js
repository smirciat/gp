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
import {Transaction,Customer,sequelize} from '../../sqldb';

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
  let userId=req.body.userId||'';
  let q={where:{userId:userId}};
  return Transaction.findAll(q)
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a list of Transactions
export function index(req, res) {
  return Transaction.findAll({order: [['_id', 'DESC']]})
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
