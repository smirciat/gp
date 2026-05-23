'use strict';

import {User,sequelize} from '../../sqldb';
const { Op } = require('sequelize');
import { welcomeEmail } from '../thing/thing.controller.js';
import localEnv from '../../config/local.env.js';
import passport from 'passport';
import config from '../../config/environment';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

function validationError(res, statusCode) {
  statusCode = statusCode || 422;
  return function(err) {
    console.log(err.name);
    return res.status(statusCode).json(err);
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
    console.log(err.data)
    return res.status(statusCode).send(err);
  };
}

export function company(req, res) {
  let where={role: 'guest' };
  let order=[
    [sequelize.literal('"name" COLLATE "en_US"'), 'ASC']
    //['email', 'DESC']
  ];
  if (!req.params||!req.params.id) {
    where={
        [Op.or]: [
          {role:{ [Op.ne]: 'guest' }},
          {_id:{ [Op.gt]: 10512 }}
        ]
    };
  }
  return User.findAll({
    attributes: [
      '_id',
      'name',
      'email',
      'role',
      'provider',
      'forcePasswordChange'
    ],
    where:where,order:order
  }
  )
    .then(users => {
      res.status(200).json(users);
    })
    .catch(handleError(res));
}

/**
 * Get list of users
 * restriction: 'admin'
 */
export function index(req, res) {
  return User.findAll({
    attributes: [
      '_id',
      'name',
      'email',
      'role',
      'provider',
      'forcePasswordChange'
    ]
  })
    .then(users => {
      res.status(200).json(users);
    })
    .catch(handleError(res));
}

/**
 * Creates a new user
 */
export function createUser(req, res, next) {
  if (!req.body.email) {
    if (res) return validationError(res);
    else return 'no email!';
  }
  req.body.email=req.body.email.toLowerCase();
  var newUser = User.build(req.body);
  newUser.setDataValue('provider', 'local');
  newUser.setDataValue('role', 'guest');
  if (res) {
    return newUser.save()
      .then(function(user) {
        var token = jwt.sign({ _id: user._id }, config.secrets.session, {
          expiresIn: 60 * 60 * 5
        });
        res.json({ token });
      })
      .catch(err=>{
        console.log(err);
        res.status(500).json(err.name||err);
      });
  }
  else {
    return newUser.save()
      .then(user=>{
        return ('success');
      })
      .catch(err=>{
        console.log(err);
        return err;
      });
  }
}

/**
 * Get a single user
 */
export function show(req, res, next) {
  var userId = req.params.id;

  return User.findOne({
    where: {
      _id: userId
    }
  })
    .then(user => {
      if (!user) {
        return res.status(404).end();
      }
      res.json(user.profile);
    })
    .catch(err => next(err));
}

// Updates an existing User in the DB, limited parameters
export function update(req, res) {
  let user={name:req.body.name};
  return User.findOne({
    where: {
      _id: req.params.id
    }
  })
    .then(handleEntityNotFound(res))
    .then(saveUpdates(user))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

/**
 * Deletes a user
 * restriction: 'admin'
 */
export function destroy(req, res) {
  return User.destroy({where:{ _id: req.params.id }})
    .then(function() {
      res.status(204).end();
    })
    .catch(err=>{
      console.log(err);
      handleError(res);
    });
}

export function adminChangeRole(req, res, next) {
  var userId = req.body.user;
  var newRole = req.body.role;

  User.findOne({
    where: {
      _id: userId
    }
  })
    .then(user => {
      if (true) {
        user.role = newRole;
        console.log(user);
        return user.save()
          .then(() => {
            res.status(204).end();
          })
          .catch(err=>{
            console.log(err);
            (validationError(res));
          });
      } else {
        return res.status(403).end();
      }
    });
}

/**
 * Change a users password
 */
export function changePasswordToTemp(req, res, next) {
  var userId = req.user._id;
  return User.findOne({
    where: {
      _id: userId
    }
  })
    .then(user => {
        user.password = user.tempPassword||'test';
        user.forcePasswordChange=true;
        
        return user.save()
          .then(() => {
            if (res) return res.status(204).end();
          })
          .catch(validationError(res));
     
    });
}

export async function updateAllPasswords(req,res){
  try {
    for (let x=70;x<=10512;x++){
      console.log(x);
      try {
        await changePasswordToTemp({user:{_id:x}});
      }
      catch(err){
        console.log(err);
      }
    }
    res.status(200).json('Complete');
  }
  catch(err){
    console.log(err);
    res.status(500).json('Error');
  }
}

/**
 * Change a users password
 */
export function changePassword(req, res, next) {
  var userId = req.user._id;
  var oldPass = String(req.body.oldPassword);
  var newPass = String(req.body.newPassword);
  return User.findOne({
    where: {
      _id: userId
    }
  })
    .then(user => {
      if (user.authenticate(oldPass,user.salt)) {
        user.password = newPass;
        user.forcePasswordChange=false;
        user.tempPassword=null;
        return user.save()
          .then(() => {
            res.status(204).end();
          })
          .catch(validationError(res));
      } else {
        return res.status(403).end();
      }
    });
}

/**
 * Get my info
 */
export function me(req, res, next) {
  var userId = req.user._id;

  return User.findOne({
    where: {
      _id: userId
    },
    attributes: [
      '_id',
      'name',
      'email',
      'role',
      'provider',
      'job',
      'forcePasswordChange'
    ]
  })
    .then(user => { // don't ever give out the password or salt
      if (!user) {
        return res.status(401).end();
      }
      res.json(user);
    })
    .catch(err => next(err));
}

/**
 * Authentication callback
 */
export function authCallback(req, res, next) {
  res.redirect('/');
}

export function query(req,res){
  if (!req.body||!req.body.email) return res.status(400).json('Bad Request');
  return User.findOne({
    where: {
      email:req.body.email
    },
    attributes: [
      '_id',
      'name',
      'email',
      'role',
      'provider',
      'job',
      'forcePasswordChange'
    ]
  })
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Resets Password to default for a User
export async function reset(req, res) {
  let user = {};
  let email="";
  try {
    user = await User.findOne({
      where: {
        _id: req.body._id
      }
    });
    email=user.email;
    user.password = crypto.randomBytes(5).toString('hex');
    user.tempPassword=user.password;
    user.forcePasswordChange=true;
    await user.save();
    console.log('User saved with new temp password');
  }
  catch(err){
    console.log(err);
    return res.status(500).json('Could not find that user id');
  }
  try {
    await welcomeEmail({body:{to:email,skipIfNull:true}});
    return res.status(200).json('User saved with temp password, and welcome email sent successfully');
  }
  catch(err){
    console.log(err);
    return res.status(500).json('Failed to send email');
  }

}