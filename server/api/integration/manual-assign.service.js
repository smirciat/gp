'use strict';

import {newTransaction} from '../transaction/transaction.controller';
import {
  findCustomerByIdentifier,
  loadMembershipGroup
} from './membership.service';
import {buildDebitPlan, normalizeDateFlown} from './redeem.service';

function appendLegacyDescription(description, meta) {
  let text = description != null ? String(description) : '';
  if (meta.dateFlown || meta.booking || meta.route || meta.flight) {
    text +=
      '=>' +
      (meta.dateFlown || '') +
      ' ' +
      (meta.booking || '') +
      ' ' +
      (meta.route || '') +
      ' ' +
      (meta.flight || '');
    if (meta.lastUpdatedBy != null && meta.lastUpdatedBy !== 0) {
      text += ' Agent ID: ' + meta.lastUpdatedBy;
    }
  }
  return text.trim();
}

function readAssignInput(body) {
  return {
    userId: body.userId != null ? String(body.userId).trim() : '',
    points: Math.floor(Number(body.points)),
    awardRedeem: body.awardRedeem === 'redeem' ? 'redeem' : 'award',
    dateFlown: body.dateFlown != null ? String(body.dateFlown).trim() : '',
    booking: body.booking != null ? String(body.booking).trim() : '',
    route: body.route != null ? String(body.route).trim() : '',
    flight: body.flight != null ? String(body.flight).trim() : '',
    description: body.description != null ? String(body.description).trim() : '',
    lastUpdatedBy:
      body.lastUpdatedBy != null ? Math.floor(Number(body.lastUpdatedBy)) : 0
  };
}

async function postApprovedTransaction(input, debit, meta) {
  const accountCustomer = await findCustomerByIdentifier({userId: debit.userId});
  let account = '';
  if (accountCustomer) {
    const plain = accountCustomer.get
      ? accountCustomer.get({plain: true})
      : accountCustomer;
    account = plain.account || '';
  }

  const body = {
    userId: debit.userId,
    account: account,
    points: debit.points,
    awardRedeem: input.awardRedeem,
    status: 'Approved',
    date: new Date(),
    dateFlown: normalizeDateFlown(meta.dateFlown || input.dateFlown),
    booking: input.booking || '',
    route: input.route || '',
    flight: input.flight || '',
    description: appendLegacyDescription(input.description, meta),
    lastUpdatedBy: input.lastUpdatedBy
  };

  const result = await newTransaction({body: body}, null);
  if (typeof result === 'string' && result.indexOf('Successful') === -1) {
    const err = new Error(result);
    err.status = 500;
    throw err;
  }
  if (typeof result === 'string') {
    return Object.assign({}, body, {status: 'Approved'});
  }
  return result;
}

/**
 * Manual award or redeem (any positive integer points) — staff Assign Points.
 * Redeem uses primary pool debit when member is primary; otherwise own balance only.
 */
export async function assignManualPoints(body) {
  const input = readAssignInput(body || {});

  if (!input.userId || !Number.isFinite(input.points) || input.points < 1) {
    const err = new Error('userId and a positive integer points are required.');
    err.status = 400;
    throw err;
  }

  const seed = await findCustomerByIdentifier({userId: input.userId});
  if (!seed) {
    const err = new Error('Gold Points member not found');
    err.status = 404;
    throw err;
  }

  const membership = await loadMembershipGroup(seed);
  if (!membership) {
    const err = new Error('Gold Points membership could not be loaded');
    err.status = 404;
    throw err;
  }

  const meta = {
    dateFlown: input.dateFlown,
    booking: input.booking,
    route: input.route,
    flight: input.flight,
    lastUpdatedBy: input.lastUpdatedBy
  };

  const transactions = [];

  if (input.awardRedeem === 'award') {
    if (membership.member.suspended) {
      const err = new Error('Member is suspended');
      err.status = 409;
      throw err;
    }
    transactions.push(
      await postApprovedTransaction(
        input,
        {userId: input.userId, points: input.points},
        meta
      )
    );
  } else {
    const debitPlan = buildDebitPlan(membership, input.points);
    for (let i = 0; i < debitPlan.length; i++) {
      transactions.push(await postApprovedTransaction(input, debitPlan[i], meta));
    }
  }

  const refreshed = await loadMembershipGroup(seed);
  return {
    points: input.points,
    awardRedeem: input.awardRedeem,
    transactions: transactions,
    membership: refreshed
  };
}

export async function setMemberSuspension(userId, suspended) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) {
    const err = new Error('userId is required');
    err.status = 400;
    throw err;
  }
  const customer = await findCustomerByIdentifier({userId: id});
  if (!customer) {
    const err = new Error('Gold Points member not found');
    err.status = 404;
    throw err;
  }
  const next = suspended === true || suspended === 'true' || suspended === 1;
  await customer.update({suspended: next});
  const membership = await loadMembershipGroup(customer);
  return {userId: id, suspended: next, membership: membership};
}
