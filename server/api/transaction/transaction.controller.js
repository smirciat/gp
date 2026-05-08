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
import {Transaction} from '../../sqldb';

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
      return entity.updateAttributes(updates)
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
    console.log(err)
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
  return Transaction.findAll()
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Transaction from the DB
export function show(req, res) {
  return Transaction.find({
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

// Updates an existing Transaction in the DB
export function update(req, res) {
  if (req.body._id) {
    delete req.body._id;
  }
  return Transaction.find({
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
  return Transaction.find({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(removeEntity(res))
    .catch(handleError(res));
}
