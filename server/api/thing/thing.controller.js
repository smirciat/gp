/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/things              ->  index
 * POST    /api/things              ->  create
 * GET     /api/things/:id          ->  show
 * PUT     /api/things/:id          ->  update
 * DELETE  /api/things/:id          ->  destroy
 */

'use strict';

import _ from 'lodash';
import {Thing} from '../../sqldb';
import localEnv from '../../config/local.env';
let client = require('twilio')(
  localEnv.TWILIO_ACCOUNT_SID,
  localEnv.TWILIO_AUTH_TOKEN
);
import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // use false for STARTTLS; true for SSL on port 465
  auth: {
    user: localEnv.GMAIL_ADDRESS,
    pass: localEnv.GMAIL_APP_PASS,
  }
});

// Configure the mailoptions object
const mailOptions = {
  from: localEnv.GMAIL_ADDRESS,
  to: localEnv.GMAIL_AMBLER_ADDRESS,
  subject: 'Bering Air Gold Points',
  html: 'This is an automatically generated email, please do not reply to this address<br><br>'
};

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

// Gets a list of Things
export function index(req, res) {
  return Thing.findAll()
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Thing from the DB
export function show(req, res) {
  return Thing.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Creates a new Thing in the DB
export function create(req, res) {
  return Thing.create(req.body)
    .then(respondWithResult(res, 201))
    .catch(handleError(res));
}

// Updates an existing Thing in the DB
export function update(req, res) {
  if (req.body._id) {
    delete req.body._id;
  }
  return Thing.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(saveUpdates(req.body))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Deletes a Thing from the DB
export function destroy(req, res) {
  return Thing.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(removeEntity(res))
    .catch(handleError(res));
}

export async function email(req,res){
  //... The rest of the email you want to send
  let options=JSON.parse(JSON.stringify(mailOptions));
  options.html+= req.body.html;
  options.to=req.body.to;
  //Here is where the email gets sent
  try {
    const info = await transporter.sendMail(options);
    return res.status(200).json('Email Sent Successfully');
  } catch (error) {
    console.log(error);
    return res.status(500).json('Failed to Send Email');
  }
}

export async function sms(req,res){
  var params = {
    from: localEnv.TWILIO_PHONE_NUMBER,
    to: req.body.to,
    //mediaUrl:req.body.mediaUrl,
    body: req.body.body
  };
  client.messages
  .create(params)
  .then(message => {
    console.log('Twilio message sent successfully');
    return res.sendStatus(200);
  })
  .catch((error) => {
    // You can implement your fallback code here
    console.log(error);
    return res.status(500);
  });
}
