'use strict';

import {Customer} from '../../sqldb';
const {Op} = require('sequelize');
import {
  findCustomerByIdentifier,
  loadMembershipGroup,
  memberSummary
} from './membership.service';
import {
  buildFreeTextNameOrWhere,
  buildFullNameSearchWhere,
} from '../customer/name-search';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function capLimit(limit) {
  const n = Math.floor(Number(limit));
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(n, MAX_LIMIT);
}

function buildStructuredWhere(query) {
  const q = query || {};
  const where = {};

  if (q.account) {
    where.account = {[Op.iLike]: '%' + q.account + '%'};
  }
  if (q.id || q.userId) {
    where.userId = {[Op.iLike]: '%' + String(q.id || q.userId) + '%'};
  }

  let firstName = q.firstName;
  let lastName = q.lastName;
  const suffixRe = /^(jr|sr|jnr|snr|ii|iii|iv|v|2nd|3rd|4th|5th)\.?$/i;
  function stripSuffixes(value) {
    const tokens = String(value || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    while (tokens.length && suffixRe.test(tokens[tokens.length - 1])) {
      tokens.pop();
    }
    return tokens.join(' ');
  }
  if (firstName) firstName = stripSuffixes(firstName);
  if (lastName) lastName = stripSuffixes(lastName);
  if (firstName && !lastName) {
    const parts = String(firstName).trim().split(/\s+/);
    if (parts.length > 1) {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
  } else if (!firstName && lastName) {
    const parts = String(lastName).trim().split(/\s+/);
    const remainder = parts.slice(1);
    const remainderIsSuffixes =
      remainder.length > 0 && remainder.every((token) => suffixRe.test(token));
    if (parts.length > 1 && !remainderIsSuffixes) {
      firstName = parts[0];
      lastName = remainder.join(' ');
    }
  }

  const fullNameWhere = buildFullNameSearchWhere(firstName, lastName);
  if (fullNameWhere) {
    where.fullName = fullNameWhere;
  }

  if (q.email) {
    where.email = {[Op.iLike]: '%' + String(q.email).trim() + '%'};
  }

  if (q.ca) {
    where.ca = {[Op.iLike]: '%' + String(q.ca).trim() + '%'};
  }

  return where;
}

function buildFreeTextWhere(q) {
  const orWhere = buildFreeTextNameOrWhere(String(q).trim());
  if (orWhere) return orWhere;
  const term = '%' + String(q).trim() + '%';
  return {
    [Op.or]: [
      {userId: {[Op.iLike]: term}},
      {email: {[Op.iLike]: term}},
      {fullName: {[Op.iLike]: term}},
      {account: {[Op.iLike]: term}}
    ]
  };
}

/**
 * Staff-style member search for resBering (read-only summaries).
 * Accepts free-text `q` / `search` and/or structured `query` fields
 * (id/userId, email, firstName, lastName, account).
 */
export async function queryCustomers({q, search, query, limit} = {}) {
  const capped = capLimit(limit);
  const freeText = (q != null && String(q).trim())
    ? String(q).trim()
    : (search != null && String(search).trim() ? String(search).trim() : '');

  let where = null;
  if (freeText) {
    where = buildFreeTextWhere(freeText);
  } else {
    const structured = buildStructuredWhere(query);
    if (Object.keys(structured).length > 0) {
      where = structured;
    }
  }

  if (!where) {
    const err = new Error(
      'Provide q/search or query fields (id/userId, email, firstName, lastName, account).'
    );
    err.status = 400;
    throw err;
  }

  const rows = await Customer.findAll({
    where,
    limit: capped,
    order: [['fullName', 'ASC'], ['userId', 'ASC']]
  });

  return {
    count: rows.length,
    limit: capped,
    customers: rows.map(memberSummary)
  };
}

/**
 * Membership detail for one member (primary + associates), same shape as /membership.
 */
/**
 * Full roster sorted by currentPoints descending (legacy List By Points).
 */
export async function listCustomersByPoints() {
  const rows = await Customer.findAll({
    order: [
      ['currentPoints', 'DESC'],
      ['userId', 'ASC']
    ]
  });

  return {
    count: rows.length,
    customers: rows.map(memberSummary)
  };
}

export async function getCustomerMembership(userId) {
  if (userId == null || String(userId).trim() === '') {
    const err = new Error('userId is required');
    err.status = 400;
    throw err;
  }

  const customer = await findCustomerByIdentifier({userId: String(userId).trim()});
  if (!customer) {
    return null;
  }

  return loadMembershipGroup(customer);
}
