'use strict';

import {Customer, Transaction, sequelize} from '../../sqldb';
const {Op} = require('sequelize');
import {
  findCustomerByIdentifier,
  findCustomersByEmail,
  loadMembershipGroup
} from './membership.service';

const SIGNUP_POINTS = 10;

async function nextUserId() {
  const row = await Customer.findOne({
    attributes: [[sequelize.literal('CAST("userId" AS INTEGER)'), 'maxInt']],
    order: [[sequelize.literal('CAST("userId" AS INTEGER)'), 'DESC']],
    where: {
      userId: {[Op.ne]: null}
    }
  });
  let maxInt = 0;
  if (row) {
    if (row.get) {
      maxInt = row.get('maxInt');
    } else if (row.maxInt != null) {
      maxInt = row.maxInt;
    }
  }
  if (maxInt == null || maxInt === '') {
    maxInt = 0;
  }
  return String(Number(maxInt) + 1);
}

/** Match legacy GP `createNewMember` account string (date prefix + userId). */
function buildAccount(userId) {
  const datePart = Number(
    new Date().toISOString().split('T')[0].replace(/-/g, '')
  );
  return String(datePart) + userId;
}

function buildFullName(firstName, middleName, lastName) {
  let first = String(firstName || '').trim();
  if (first) {
    first += ' ';
  }
  const middle = String(middleName || '').trim();
  const middlePart = middle ? middle + ' ' : '';
  return first + middlePart + String(lastName || '').trim();
}

function readEnrollInput(body) {
  return {
    firstName: body.firstName != null ? String(body.firstName).trim() : '',
    middleName: body.middleName != null ? String(body.middleName).trim() : '',
    lastName: body.lastName != null ? String(body.lastName).trim() : '',
    email: body.email != null ? String(body.email).trim().toLowerCase() : '',
    phone: body.phone != null ? String(body.phone).trim() : '',
    dob: body.dob != null ? String(body.dob).trim() : '',
    address: body.address != null ? String(body.address).trim() : '',
    city: body.city != null ? String(body.city).trim() : '',
    state: body.state != null ? String(body.state).trim() : '',
    zip: body.zip != null ? String(body.zip).trim() : '',
    gpType: body.gpType === 'Associate' ? 'Associate' : 'Primary',
    primaryUserId:
      body.primaryUserId != null ? String(body.primaryUserId).trim() : '',
    allowDuplicate: !!body.allowDuplicate,
    lastUpdatedBy:
      body.lastUpdatedBy != null ? Math.floor(Number(body.lastUpdatedBy)) : 0
  };
}

/**
 * Create a new GP member (primary or associate) with signup bonus transaction.
 * Mirrors legacy staff Create Member flow without exposing raw POST /api/customers.
 */
export async function enrollMember(body) {
  const input = readEnrollInput(body || {});

  if (!input.firstName || !input.lastName || !input.email) {
    const err = new Error('firstName, lastName, and email are required.');
    err.status = 400;
    throw err;
  }

  if (input.gpType === 'Associate' && !input.primaryUserId) {
    const err = new Error(
      'primaryUserId is required when gpType is Associate.'
    );
    err.status = 400;
    throw err;
  }

  if (input.gpType === 'Associate') {
    const primary = await findCustomerByIdentifier({
      userId: input.primaryUserId
    });
    if (!primary) {
      const err = new Error('Primary member not found for primaryUserId.');
      err.status = 400;
      throw err;
    }
  }

  const duplicates = await findCustomersByEmail(input.email);
  if (duplicates.length && !input.allowDuplicate) {
    const err = new Error(
      'A Gold Points member already uses that email address.'
    );
    err.status = 409;
    err.duplicateCount = duplicates.length;
    throw err;
  }

  const userId = await nextUserId();
  const account = buildAccount(userId);
  const fullName = buildFullName(
    input.firstName,
    input.middleName,
    input.lastName
  );

  const customerPayload = {
    userId,
    account,
    fullName,
    firstName: input.firstName + ' ',
    middleName: input.middleName ? input.middleName + ' ' : '',
    lastName: input.lastName,
    email: input.email,
    phone: input.phone || null,
    dob: input.dob || null,
    address: input.address || null,
    city: input.city || null,
    state: input.state || null,
    zip: input.zip || null,
    gpType: input.gpType,
    primaryUserId:
      input.gpType === 'Associate' ? input.primaryUserId : null,
    points: SIGNUP_POINTS,
    currentPoints: SIGNUP_POINTS,
    active: true,
    suspended: false
  };

  const customer = await Customer.create(customerPayload);
  const plain = customer.get({plain: true});

  const transaction = await Transaction.create({
    userId: plain.userId,
    account: plain.account,
    awardRedeem: 'award',
    description: 'New GP Member Account Sign Up',
    date: new Date(),
    dateFlown: new Date().toLocaleDateString(),
    status: 'Approved',
    points: SIGNUP_POINTS,
    lastUpdatedBy: input.lastUpdatedBy
  });

  if (input.gpType === 'Associate') {
    const primary = await findCustomerByIdentifier({
      userId: input.primaryUserId
    });
    if (primary) {
      const primaryPlain = primary.get({plain: true});
      let accounts = Array.isArray(primaryPlain.associatedAccounts)
        ? primaryPlain.associatedAccounts.filter(Boolean)
        : [];
      if (accounts.indexOf(userId) === -1) {
        accounts.push(userId);
        await primary.update({associatedAccounts: accounts});
      }
    }
  }

  const membership = await loadMembershipGroup(customer);

  return {
    customer: plain,
    transaction: transaction.get({plain: true}),
    membership,
    duplicateEmail: input.allowDuplicate && duplicates.length > 0
  };
}
