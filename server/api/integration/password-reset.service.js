'use strict';

const crypto = require('crypto');
const {Op} = require('sequelize');
import {User} from '../../sqldb';
import {findCustomersByEmail} from './membership.service';
import {welcomeEmail} from '../thing/thing.controller.js';

const GENERIC = {
  message: 'If that email is on file, we sent a temporary password.'
};

function isGuestRole(role) {
  return !role || role === 'guest';
}

async function sendTempPasswordEmail(to) {
  const result = await welcomeEmail({
    body: {to, skipIfNull: true}
  });
  if (result === 'Failed to Send Email' || result === 'No User Email!') {
    const err = new Error('Unable to send email. Try again in a moment.');
    err.status = 502;
    err.code = 'email_failed';
    throw err;
  }
  return result;
}

/**
 * Guest password reset for bering-public (Phase B slice 6).
 * Same writes as staff POST /api/users/reset: golddb User temp password + Mailgun.
 * Never returns the password. Unknown / staff emails get the generic success.
 */
export async function requestGuestPasswordReset({email} = {}) {
  const trimmed = email != null ? String(email).trim() : '';
  if (!trimmed) {
    const err = new Error('email is required.');
    err.status = 400;
    err.code = 'invalid_request';
    throw err;
  }

  const user = await User.findOne({
    where: {email: {[Op.iLike]: trimmed}}
  });

  if (user) {
    if (!isGuestRole(user.role)) {
      return GENERIC;
    }
    const temp = crypto.randomBytes(5).toString('hex');
    user.password = temp;
    user.tempPassword = temp;
    user.forcePasswordChange = true;
    await user.save();
    await sendTempPasswordEmail(user.email);
    return GENERIC;
  }

  const matches = await findCustomersByEmail(trimmed);
  const customer = matches && matches[0];
  if (customer) {
    const plain = customer.get ? customer.get({plain: true}) : customer;
    if (plain.badEmail) {
      return GENERIC;
    }
    const to = plain.email || trimmed;
    const result = await welcomeEmail({
      body: {to, customer: plain}
    });
    if (result === 'Failed to Send Email' || result === 'No User Email!') {
      const err = new Error('Unable to send email. Try again in a moment.');
      err.status = 502;
      err.code = 'email_failed';
      throw err;
    }
    return GENERIC;
  }

  return GENERIC;
}
