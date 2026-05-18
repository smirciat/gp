/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/things              ->  index
 * POST    /api/things              ->  create
 * GET     /api/things/:id          ->  show
 * PUT     /api/things/:id          ->  update
 * DELETE  /api/things/:id          ->  destroy
 */

'use strict';

import FormData from "form-data";
import Mailgun from "mailgun.js";
const axios = require("axios");
import {Thing,User,Transaction,Customer} from '../../sqldb';
import localEnv from '../../config/local.env';
let bearer='';
let client = require('twilio')(
  localEnv.TWILIO_ACCOUNT_SID,
  localEnv.TWILIO_AUTH_TOKEN
);
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: "api",
  key: localEnv.MAILGUN_API_KEY,
  url: 'https://api.mailgun.net'
});
// Configure the mailoptions object
const mailOptions = {
  from: "Bering Air <postmaster@" + localEnv.MAILGUN_DOMAIN + ">",
  subject: 'Bering Air Gold Points',
  html: 'This is an automatically generated email, please do not reply to this address<br><br>'
};
let welcomeHtml="Congratulations! <br><br>You have just created a Bering Air Gold Points Membership!<br><br>";
welcomeHtml+="Please head over to gp.beringair.com to complete your sign in and access your account data. Your username is the same email address there that you used when you signed up for the Gold Points Membership.  Your temporary password is shown at the bottom of this email.  Once signed in, you will be able to see any future Gold Points transactions that are attached to this account.  Please let us know if you have any questions or difficulties. <br><br>Thank you for flying with Bering Air!";
    

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

export async function welcomeEmail(req,res){
  if (!req.body.to) {
    if (res) return res.status(500).json('No User Email!');
    return 'No User Email!';
  }
  //find the user by the email provided, and lookup tempPassword
  let user={};
  let html=welcomeHtml;
  try { 
    user=await User.findOne({where:{email:req.body.to}});
    html+="<br><br>Your temporary password is: " + user.tempPassword;
  }
  catch(err) {
    if (res) return res.status(500).json('User Email not found');
    return 'User Email not found';
  }
  if (req.body.skipIfNull&&!user.tempPassword) {
    if (res) return res.status(500).json('User does not have tempPassword');
    return 'User does not have tempPassword';
  }
  //... The rest of the email you want to send
  let options=JSON.parse(JSON.stringify(mailOptions));
  options.html+= html;
  options.to=req.body.to;
  //Here is where the email gets sent
  try {
    const info = await mg.messages.create(localEnv.MAILGUN_DOMAIN,options);
    if (res) return res.status(200).json(info);
    return info;
  } catch (error) {
    console.log(error);
    if (res) return res.status(500).json('Failed to Send Email');
    return 'Failed to Send Email';
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

export async function setBearer(){
  let info;
  let data = JSON.stringify({
    "client_id": localEnv.TF_ID,
    "client_secret": localEnv.TF_SECRET
  });
  let config = {
    method: 'post',
    url: 'https://api.tflite.com/authentication/oauth/token',
    headers: { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json',
      'api-version':'v1'
    },
    data : data
  };
  
  try{
    let response=await axios(config);
    bearer="Bearer "+response.data.access_token;
    console.log('Bearer Set!');
  }
  catch(err){return console.log(err)}
  try {
    //set up webhooks now
    let data = JSON.stringify({
      "name": localEnv.WEBHOOK_HANDLER,
      "url": localEnv.WEBHOOK_URL,
      "events": [
        "*",//"Takeflite.Operations.AircraftControl.FlightStatusChanged"//or "*"
      ],
      "deliveryAttributeMapping": [
        {
          "name": localEnv.WEBHOOK_KEY,
          "value": localEnv.WEBHOOK_VALUE,
          "isSecret": true
        }
      ]
    });
    config = {
      method: 'get',//get with no data to list, post with no handler to create a new one, delete with a handler and no data to delete one
      url: 'https://api.tflite.com/webhooks',//'+localEnv.WEBHOOK_HANDLER,
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json',
        'api-version': 'v1', 
        'Authorization': bearer
      },
      
    };
    if (!localEnv.STOP_WEBHOOKS) {
      info = await axios(config);
      console.log('Axios Completed Successfully');
      console.log(info.data);
    }
    return "TF Bearer Token Set Successfully";
  }
  catch(err){
    if (err.response) console.log(err.response.data);
    else console.log(err);
    return err;
  }
}

export async function getManifest(req,res){
  let date=new Date();
  let flightNum='860';
  if (req.body&&req.body.date) {
    date=new Date(req.body.date);
    flightNum=req.body.flightNum||flightNum;
  }
  date.setHours(0, 0, 0, 0);
  let startDate=date.toISOString();
  let config = {
    method: 'get',
    url: 'https://api.tflite.com/manifests/'+startDate+'/'+flightNum+'/:departureAirport',
    headers: { 
      'Accept': 'application/json', 
      'api-version': 'v1', 
      'Authorization': bearer
    }
  };
  try {
    let response=await axios(config);
    console.log(response.data);
    if (res) res.status(200).json(response.data);
    else return response.data;
  }
  catch(err){
    if (!err.response) err.response={data:err};
    console.log(err.response.data);
    setBearer();
    let secondResponse;
    if (err&&err.response&&err.response.data&&err.response.data.statusCode===401) {
      secondResponse=await getManifest(req);
      if (!res) return secondResponse;
      else return res.status(200).json(secondResponse);
    }
    if (res) return res.status(500).json(err.response.data);
    return err.response||err;
  }
}

export async function email(req,res){
  //... The rest of the email you want to send
  let options=JSON.parse(JSON.stringify(mailOptions));
  options.html+= req.body.html;
  options.to=req.body.to;
  //Here is where the email gets sent
  try {
    const info = await mg.messages.create(localEnv.MAILGUN_DOMAIN,options);
    return res.status(200).json(info);
  } catch (error) {
    console.log(error);
    return res.status(500).json('Failed to Send Email');
  }
}

export async function massEmail(req,res){
  let transactions=[];
  let users=[];
  try {
    transactions=await Transaction.findAll({ raw: true });
  }
  catch(err){
    console.log(err);
    return res.status(500).json('Failed to find all transactions');
  }
  transactions=transactions.filter(t=>t.awardRedeem!=='beginning');
  users=transactions.map(e=>e.userId);
  users=[...new Set(users)];
  for (const user of users){
    let customer={};
    try {
      customer=await Customer.findOne({
        where:{userId:user},
        raw:true
      });
    }
    catch(err){
      console.log('Didn`t find User ID ' + user);
    }
    try {
      await welcomeEmail({to:customer.email,skipIfNull:true});
    }
    catch(err){
      console.log('Couldn`t send welcome email for ID ' + user);
    }
  }
  res.send(200).json('Sent as many as possible!');
}