/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/customers              ->  index
 * POST    /api/customers              ->  create
 * GET     /api/customers/:id          ->  show
 * PUT     /api/customers/:id          ->  update
 * DELETE  /api/customers/:id          ->  destroy
 */

'use strict';

import _ from 'lodash';
import {Customer,sequelize} from '../../sqldb';
const { Op } = require('sequelize');

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

// Gets a list of Customers
export function last(req, res) {
  return Customer.findOne({
    // Cast and select the column
    attributes: [
      [sequelize.literal('CAST("userId" AS INTEGER)'), 'maxInt']
    ],
    // Order by casted value descending
    order: [
      [sequelize.literal('CAST("userId" AS INTEGER)'), 'DESC']
    ],
    // Ensure we only get non-null results for casting safety
    where: {
      userId: {
        [Op.ne]: null
      }
    }
  })
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a list of Customers
export function index(req, res) {
  return Customer.findAll({order: [['currentPoints', 'DESC']]})
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a list of Customers from a query
export function query(req, res) {
  let q=req.body.query||{};
  let newQ={where:{}};
  if (q) {
    if (q.account) newQ.where.account={[Op.iLike]:'%'+q.account+'%'};
    if (q.id) newQ.where.userId={[Op.iLike]:'%'+q.id+'%'};
    if (q.firstName&&q.lastName) {
      newQ.where.fullName={[Op.and]:[{[Op.iLike]:'%'+q.firstName+'%'},{[Op.iLike]:'%'+q.lastName+'%'}]};
    }
    else if (q.firstName) newQ.where.fullName={[Op.iLike]:'%'+q.firstName+'%'};
    else if (q.lastName) newQ.where.fullName={[Op.iLike]:'%'+q.lastName+'%'};
    if (q.email) newQ.where.email=q.email;
    if (q.ca) newQ.where.ca=q.ca;
  }
  return Customer.findAll(newQ)
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Customer from the DB by attribute 'userId'
export function one(req, res) {
  return Customer.findOne({
    where: {
      userId: (req.body.userId*1).toString()
    }
  })
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Customer from the DB
export function show(req, res) {
  return Customer.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Creates a new Customer in the DB
export function create(req, res) {
  return Customer.create(req.body)
    .then(respondWithResult(res, 201))
    .catch(handleError(res));
}

export function createApp(customer) {
  Customer.create(customer)
    .then(result=>{console.log('created new customer')})
    .catch(err=>{console.log(err)});
}

// Updates an existing Customer in the DB
export function update(req, res) {
  console.log(req.body)
  if (req.body._id) {
    delete req.body._id;
  }
  return Customer.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(saveUpdates(req.body))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Deletes a Customer from the DB
export function destroy(req, res) {
  return Customer.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(removeEntity(res))
    .catch(handleError(res));
}
