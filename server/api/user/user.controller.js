'use strict';

import {User} from '../../sqldb';
import passport from 'passport';
import config from '../../config/environment';
import jwt from 'jsonwebtoken';

function validationError(res, statusCode) {
  console.log(res.data)
  statusCode = statusCode || 422;
  return function(err) {
    return res.status(statusCode).json(err);
  }
}

function handleError(res, statusCode) {
  statusCode = statusCode || 500;
  return function(err) {
    return res.status(statusCode).send(err);
  };
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
      'provider'
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
export function create(req, res, next) {
  if (!req.body.email) return validationError(res);
  req.body.email=req.body.email.toLowerCase();
  var newUser = User.build(req.body);
  newUser.setDataValue('provider', 'local');
  newUser.setDataValue('role', 'guest');
  return newUser.save()
    .then(function(user) {
      var token = jwt.sign({ _id: user._id }, config.secrets.session, {
        expiresIn: 60 * 60 * 5
      });
      res.json({ token });
    })
    .catch(err=>{
      console.log(err)
      validationError(res)
      
    });
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
      'job'
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
