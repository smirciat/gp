'use strict';

import {Event} from '../../sqldb';
import {
  findCustomerByIdentifier,
  loadMembershipGroup
} from './membership.service';
import {welcomeEmail} from '../thing/thing.controller.js';
import {assignManualPoints} from './manual-assign.service';

const ALLOWED_PATCH_FIELDS = [
  'fullName',
  'email',
  'phone',
  'dob',
  'address',
  'city',
  'state',
  'zip',
  'badEmail'
];

function eventSummary(row) {
  const plain = row.get ? row.get({plain: true}) : row;
  return {
    event_id: plain.event_id,
    account_id: plain.account_id || null,
    member_id: plain.member_id || null,
    status: plain.status || null,
    points: plain.points * 1 || 0,
    notes: plain.notes || null,
    comments: plain.comments || null,
    created: plain.created || null,
    modified: plain.modified || null
  };
}

/**
 * Legacy GP Event rows — history before the May 2026 Transaction ledger.
 * Keep this table separate from POST …/transactions/query.
 */
export async function queryLegacyEvents({userId} = {}) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) {
    const err = new Error('userId is required.');
    err.status = 400;
    throw err;
  }

  const rows = await Event.findAll({
    where: {member_id: id},
    order: [['event_id', 'ASC']]
  });

  let running = 0;
  const events = rows.map(function (row) {
    const summary = eventSummary(row);
    running += summary.points;
    summary.runningBalance = running;
    return summary;
  });

  return {
    count: events.length,
    userId: id,
    cutoff: '2026-05-01',
    events: events
  };
}

export async function patchMemberDetails(userId, body) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) {
    const err = new Error('userId is required.');
    err.status = 400;
    throw err;
  }
  const customer = await findCustomerByIdentifier({userId: id});
  if (!customer) {
    const err = new Error('Gold Points member not found');
    err.status = 404;
    throw err;
  }

  const patch = {};
  for (let i = 0; i < ALLOWED_PATCH_FIELDS.length; i++) {
    const key = ALLOWED_PATCH_FIELDS[i];
    if (body[key] === undefined) {
      continue;
    }
    if (key === 'badEmail') {
      patch.badEmail = !!body.badEmail;
      continue;
    }
    let value = body[key] == null ? '' : String(body[key]).trim();
    if (key === 'email') {
      value = value.toLowerCase();
    }
    if (key === 'phone') {
      value = value.replace(/\D/g, '');
    }
    patch[key] = value || null;
  }

  if (Object.keys(patch).length === 0) {
    const err = new Error('No member fields to update.');
    err.status = 400;
    throw err;
  }

  await customer.update(patch);
  const membership = await loadMembershipGroup(customer);
  return {userId: id, membership: membership};
}

export async function attachAssociates({primaryUserId, associateUserIds} = {}) {
  const primaryId =
    primaryUserId != null ? String(primaryUserId).trim() : '';
  const ids = Array.isArray(associateUserIds)
    ? associateUserIds
        .map(function (id) {
          return id != null ? String(id).trim() : '';
        })
        .filter(Boolean)
    : [];
  if (!primaryId || !ids.length) {
    const err = new Error(
      'primaryUserId and at least one associateUserId are required.'
    );
    err.status = 400;
    throw err;
  }

  const primary = await findCustomerByIdentifier({userId: primaryId});
  if (!primary) {
    const err = new Error('Primary member not found.');
    err.status = 404;
    throw err;
  }
  const primaryPlain = primary.get({plain: true});
  if (primaryPlain.gpType === 'Associate') {
    const err = new Error(
      'Suggested primary is already an associate — promote them first.'
    );
    err.status = 409;
    throw err;
  }

  let accounts = Array.isArray(primaryPlain.associatedAccounts)
    ? primaryPlain.associatedAccounts.filter(Boolean)
    : [];

  for (let i = 0; i < ids.length; i++) {
    const assId = ids[i];
    if (assId === primaryId) {
      continue;
    }
    const associate = await findCustomerByIdentifier({userId: assId});
    if (!associate) {
      const err = new Error('Associate member not found: ' + assId);
      err.status = 404;
      throw err;
    }
    await associate.update({
      gpType: 'Associate',
      primaryUserId: primaryId,
      associatedAccounts: []
    });
    if (accounts.indexOf(assId) === -1) {
      accounts.push(assId);
    }
  }

  await primary.update({
    gpType: 'Primary',
    primaryUserId: null,
    associatedAccounts: accounts
  });

  return loadMembershipGroup(primary);
}

export async function promoteAssociate(userId) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) {
    const err = new Error('userId is required.');
    err.status = 400;
    throw err;
  }
  const customer = await findCustomerByIdentifier({userId: id});
  if (!customer) {
    const err = new Error('Gold Points member not found');
    err.status = 404;
    throw err;
  }
  const plain = customer.get({plain: true});
  if (plain.gpType !== 'Associate' || !plain.primaryUserId) {
    const err = new Error('Member is not an associate with a primary.');
    err.status = 400;
    throw err;
  }

  const oldPrimary = await findCustomerByIdentifier({
    userId: plain.primaryUserId
  });
  if (oldPrimary) {
    const oldPlain = oldPrimary.get({plain: true});
    let accounts = Array.isArray(oldPlain.associatedAccounts)
      ? oldPlain.associatedAccounts.filter(function (aid) {
          return aid && aid !== id;
        })
      : [];
    await oldPrimary.update({associatedAccounts: accounts});
  }

  const datePart = Number(
    new Date().toISOString().split('T')[0].replace(/-/g, '')
  );
  await customer.update({
    gpType: 'Primary',
    associatedAccounts: [],
    primaryUserId: null,
    account: String(datePart) + id
  });

  return loadMembershipGroup(customer);
}

export async function resendWelcome(userId) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) {
    const err = new Error('userId is required.');
    err.status = 400;
    throw err;
  }
  const customer = await findCustomerByIdentifier({userId: id});
  if (!customer) {
    const err = new Error('Gold Points member not found');
    err.status = 404;
    throw err;
  }
  const plain = customer.get({plain: true});
  if (!plain.email) {
    const err = new Error('Member has no email.');
    err.status = 400;
    throw err;
  }
  if (plain.badEmail) {
    const err = new Error(
      'Unable to send — this email address has previously failed.'
    );
    err.status = 409;
    throw err;
  }

  const result = await welcomeEmail({
    body: {to: plain.email, customer: plain}
  });
  if (result === 'Failed to Send Email' || result === 'No User Email!') {
    const err = new Error(result);
    err.status = 500;
    throw err;
  }
  return {sent: true, email: plain.email, userId: id};
}

/**
 * Staff transfer: redeem from source (pool if primary), award to destination.
 */
export async function transferPoints({
  fromUserId,
  toUserId,
  points,
  lastUpdatedBy
} = {}) {
  const fromId = fromUserId != null ? String(fromUserId).trim() : '';
  const toId = toUserId != null ? String(toUserId).trim() : '';
  const amount = Math.floor(Number(points));
  if (!fromId || !toId || !Number.isFinite(amount) || amount < 1) {
    const err = new Error(
      'fromUserId, toUserId, and a positive integer points are required.'
    );
    err.status = 400;
    throw err;
  }
  if (fromId === toId) {
    const err = new Error('Cannot transfer to the same member.');
    err.status = 400;
    throw err;
  }

  const dest = await findCustomerByIdentifier({userId: toId});
  if (!dest) {
    const err = new Error('Destination member not found.');
    err.status = 404;
    throw err;
  }
  const destPlain = dest.get({plain: true});
  const source = await findCustomerByIdentifier({userId: fromId});
  if (!source) {
    const err = new Error('Source member not found.');
    err.status = 404;
    throw err;
  }
  const sourcePlain = source.get({plain: true});

  const description =
    'GP Transfer from ' +
    (sourcePlain.fullName || fromId) +
    ', User ID: ' +
    fromId +
    ' to ' +
    (destPlain.fullName || toId) +
    ', User ID: ' +
    toId;

  const redeemResult = await assignManualPoints({
    userId: fromId,
    points: amount,
    awardRedeem: 'redeem',
    description: description,
    lastUpdatedBy: lastUpdatedBy
  });
  const awardResult = await assignManualPoints({
    userId: toId,
    points: amount,
    awardRedeem: 'award',
    description: description,
    lastUpdatedBy: lastUpdatedBy
  });

  return {
    points: amount,
    fromUserId: fromId,
    toUserId: toId,
    redeem: redeemResult,
    award: awardResult,
    membership: redeemResult.membership
  };
}
