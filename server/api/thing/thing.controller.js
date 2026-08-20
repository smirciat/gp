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
const crypto = require('crypto');
const axios = require("axios");
import {createUser} from '../user/user.controller.js';
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

let randomNumbers=[{userId:'',randomNumber:null}];

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
      await welcomeEmail({body:{to:customer.email,skipIfNull:true}});
    }
    catch(err){
      console.log('Couldn`t send welcome email for ID ' + user);
    }
  }
  res.send(200).json('Sent as many as possible!');
}

export async function welcomeEmail(req,res){
  if (!req.body.to) {
    if (res) return res.status(500).json('No User Email!');
    return 'No User Email!';
  }
  //find the user by the email provided, and lookup tempPassword
  let user={};
  let html=welcomeHtml;
  let attachPassword=true;
  //if true, this is a new customer and we need to create a User for them ******************Maybe not???
  if (req.body.customer){
    if (req.body.customer.badEmail){
      if (res) return res.status(500).json('Failed to Send Email due to bad email address');
      return 'Failed to Send Email due to bad email address';
    }
    let customer=req.body.customer;
    const emailLower = String(req.body.to || customer.email || '')
      .trim()
      .toLowerCase();
    const existingUser = emailLower
      ? await User.findOne({where:{email: emailLower}})
      : null;
    if (existingUser) {
      const temp = crypto.randomBytes(5).toString('hex');
      existingUser.password = temp;
      existingUser.tempPassword = temp;
      existingUser.forcePasswordChange = true;
      await existingUser.save();
      user = existingUser;
      attachPassword = true;
    } else {
      user = {name:customer.fullName,email:customer.email,forcePasswordChange:true};
      user.password = crypto.randomBytes(5).toString('hex');
      user.tempPassword=user.password;
      try {
        console.log('Creating New User');
        let resp = await createUser({body:user});
        if (resp&&resp.errors&&resp.errors.length>0) attachPassword=false;
        else attachPassword=true;
      }
      catch(err) {
        console.log(err);
        attachPassword=false;
      }
    }
  }
  if (attachPassword) {
    try {
      if (!user.email) {
        const emailLower = String(req.body.to || '').trim().toLowerCase();
        user = emailLower
          ? await User.findOne({where:{email: emailLower}})
          : null;
      }
      if (user && user.tempPassword) {
        html+="<br><br>Your temporary password is: " + user.tempPassword;
      } else if (user) {
        html+="<br><br>Your User profile does not contain a temporary password, you`ll need to contact Bering Air and have us perform a password reset for you.";
      }
    }
    catch(err) {
      console.log(err);
      console.log('User Email Not Found');
    }
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
    console.log(options.html)
    const info = await mg.messages.create(localEnv.MAILGUN_DOMAIN,options);
    if (res) return res.status(200).json(info);
    return info;
  } catch (error) {
    console.log(error);
    if (res) return res.status(500).json('Failed to Send Email');
    return 'Failed to Send Email';
  }
}

export async function verify(req,res) {
  if (!req.body.customer||!req.body.randomNumber) {
    return res.status(500).json('No customer or randomNumber included with req');
  }
  const index=randomNumbers.map(e=>e.userId).indexOf(req.body.customer.userId);
  if (index>-1) {
    if (req.body.randomNumber*1===randomNumbers[index].randomNumber*1) {
      randomNumbers.splice(index,1);
      return res.status(200).json('Verification Passed');
    }
    else {
      return res.status(500).json('Verification Failed');
    }
    
  }
  else return res.status(500).json('No random number available for this customer');
}

export async function twoFA(req,res) {
  if (!req.body.customer) {
    return res.status(500).json('No customer included with req');
  }
  const randomNumber = crypto.randomInt(100000, 1000000);
  const msg="NOREPLY: Bering Air Gold Points Authentication token is " + randomNumber + " Enter it in the browser to confirm your transfer.";
  //remove duplicates
  randomNumbers = [...new Map(randomNumbers.map(item => [item.userId, item])).values()];
  const index=randomNumbers.map(e=>e.userId).indexOf(req.body.customer.userId);
  if (index>-1) randomNumbers[index]={userId:req.body.customer.userId,randomNumber:randomNumber};
  else randomNumbers.push({userId:req.body.customer.userId,randomNumber:randomNumber});
  try {
    await sms({body:{to:req.body.customer.phone,body:msg}});
    res.status(200).json('Success');
  }
  catch(err){
    console.log(err);
    return res.status(500).json('SMS message failed to send');
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
    if (res) return res.sendStatus(200);
    return;
  })
  .catch((error) => {
    // You can implement your fallback code here
    console.log(error);
    if (res) return res.status(500);
    return;
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
        "Takeflite.Operations.AircraftControl.FlightStatusChanged",
        //"Takeflite.Reservations.FlightCancelled", 
        //"Takeflite.Scheduling.ScheduleChanged"//or "*"
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
      //data:data
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

