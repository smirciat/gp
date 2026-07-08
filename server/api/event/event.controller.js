/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/events              ->  index
 * POST    /api/events              ->  create
 * GET     /api/events/:id          ->  show
 * PUT     /api/events/:id          ->  update
 * DELETE  /api/events/:id          ->  destroy
 */

'use strict';

import _ from 'lodash';
import {Event} from '../../sqldb';

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
    res.status(statusCode).send(err);
  };
}

// Gets a list of Events
export function index(req, res) {
  return Event.findAll()
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a list of Events by attribute 'member_id'
export function query(req, res) {
  return Event.findAll({
    where: {
      member_id: (req.body.userId*1).toString()
    }
  })
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Event from the DB
export function show(req, res) {
  return Event.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Creates a new Event in the DB
export function create(req, res) {
  return Event.create(req.body)
    .then(respondWithResult(res, 201))
    .catch(handleError(res));
}

// Updates an existing Event in the DB
export function update(req, res) {
  if (req.body._id) {
    delete req.body._id;
  }
  return Event.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(saveUpdates(req.body))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Deletes a Event from the DB
export function destroy(req, res) {
  return Event.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(removeEntity(res))
    .catch(handleError(res));
}
export async function load(){
  const fs = require('fs');
  const path = require('path');
  console.log(__dirname);
  //const filePath = path.join(__dirname, 'your-folder', 'data.json');
  const filePath = path.join(__dirname, 'www1.gp_events.json');
  
  try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const events = JSON.parse(rawData);
      console.log(events);
      for (const event of events){
        try {
          await Event.create(event);
          console.log(event.event_id);
        }
        catch(err) {
          console.log(err);
        }
      }
  } catch (err) {
      console.error("Failed to load JSON synchronously:", err);
  }
}
