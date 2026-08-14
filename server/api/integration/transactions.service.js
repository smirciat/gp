'use strict';

import {Transaction} from '../../sqldb';
const {Op} = require('sequelize');

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

function capLimit(limit) {
  const n = Math.floor(Number(limit));
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(n, MAX_LIMIT);
}

export function transactionSummary(row) {
  const plain = row.get ? row.get({plain: true}) : row;
  return {
    _id: plain._id,
    userId: plain.userId,
    account: plain.account || null,
    date: plain.date || null,
    dateFlown: plain.dateFlown || null,
    booking: plain.booking || null,
    route: plain.route || null,
    flight: plain.flight || null,
    awardRedeem: plain.awardRedeem || null,
    points: plain.points * 1 || 0,
    pointsRedeemed: plain.pointsRedeemed * 1 || 0,
    pointsEarned: plain.pointsEarned * 1 || 0,
    status: plain.status || null,
    description: plain.description || null,
    lastUpdatedBy: plain.lastUpdatedBy != null ? plain.lastUpdatedBy : null
  };
}

/**
 * Read-only ledger rows for one or more member userIds (primary + associates).
 */
export async function queryTransactions({userId, queryUsers, limit} = {}) {
  const ids = [];
  if (Array.isArray(queryUsers)) {
    for (const id of queryUsers) {
      if (id != null && String(id).trim() !== '') {
        ids.push(String(id).trim());
      }
    }
  }
  if (userId != null && String(userId).trim() !== '') {
    ids.push(String(userId).trim());
  }
  const unique = [...new Set(ids)];
  if (!unique.length) {
    const err = new Error('Provide userId or queryUsers.');
    err.status = 400;
    throw err;
  }

  const capped = capLimit(limit);
  const rows = await Transaction.findAll({
    where: {userId: {[Op.in]: unique}},
    order: [['date', 'DESC'], ['_id', 'DESC']],
    limit: capped
  });

  return {
    count: rows.length,
    limit: capped,
    userIds: unique,
    transactions: rows.map(transactionSummary)
  };
}
