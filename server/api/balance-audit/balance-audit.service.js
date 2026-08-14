'use strict';

import sqldb from '../../sqldb';
const {sequelize, BalanceMismatch} = sqldb;
const {Op} = require('sequelize');

const LEDGER_MISMATCH_SQL = `
  WITH ledger AS (
    SELECT "userId",
      SUM(
        CASE
          WHEN "awardRedeem" = 'award' THEN COALESCE(points, 0)
          WHEN "awardRedeem" = 'redeem' THEN -COALESCE(points, 0)
          ELSE 0
        END
      )::integer AS computed
    FROM "Transactions"
    GROUP BY "userId"
  )
  SELECT c."userId",
    c."fullName",
    COALESCE(c."currentPoints", 0)::integer AS stored,
    COALESCE(l.computed, 0)::integer AS computed
  FROM "Customers" c
  LEFT JOIN ledger l ON l."userId" = c."userId"
  WHERE COALESCE(c."currentPoints", 0) <> COALESCE(l.computed, 0)
`;

const MEMBER_AUDIT_SQL = `
  WITH ledger AS (
    SELECT "userId",
      SUM(
        CASE
          WHEN "awardRedeem" = 'award' THEN COALESCE(points, 0)
          WHEN "awardRedeem" = 'redeem' THEN -COALESCE(points, 0)
          ELSE 0
        END
      )::integer AS computed
    FROM "Transactions"
    WHERE "userId" = :userId
    GROUP BY "userId"
  )
  SELECT c."userId",
    c."fullName",
    COALESCE(c."currentPoints", 0)::integer AS stored,
    COALESCE(l.computed, 0)::integer AS computed
  FROM "Customers" c
  LEFT JOIN ledger l ON l."userId" = c."userId"
  WHERE c."userId" = :userId
  LIMIT 1
`;

function normalizeAuditRow(row) {
  const stored = row.stored * 1 || 0;
  const computed = row.computed * 1 || 0;
  return {
    userId: row.userId,
    fullName: row.fullName || null,
    storedPoints: stored,
    computedPoints: computed,
    delta: stored - computed,
    mismatch: stored !== computed
  };
}

export async function findAllLedgerMismatches() {
  const [rows] = await sequelize.query(LEDGER_MISMATCH_SQL);
  return rows.map(normalizeAuditRow);
}

export async function auditMemberBalance(userId) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) {
    const err = new Error('userId is required.');
    err.status = 400;
    throw err;
  }

  const [rows] = await sequelize.query(MEMBER_AUDIT_SQL, {
    replacements: {userId: id}
  });
  if (!rows.length) {
    const err = new Error('Member not found.');
    err.status = 404;
    throw err;
  }

  const audit = normalizeAuditRow(rows[0]);
  const open = await BalanceMismatch.findByPk(id);
  return Object.assign({}, audit, {
    checkedAt: open ? open.checkedAt : new Date().toISOString(),
    firstDetectedAt: open ? open.firstDetectedAt : null
  });
}

/**
 * Nightly alert-only sync: upsert open mismatches, drop rows that reconciled.
 */
export async function runFullBalanceAudit() {
  const mismatches = await findAllLedgerMismatches();
  const now = new Date();
  const openUserIds = [];

  for (const row of mismatches) {
    openUserIds.push(row.userId);
    const existing = await BalanceMismatch.findByPk(row.userId);
    await BalanceMismatch.upsert({
      userId: row.userId,
      fullName: row.fullName,
      storedPoints: row.storedPoints,
      computedPoints: row.computedPoints,
      delta: row.delta,
      checkedAt: now,
      firstDetectedAt: existing ? existing.firstDetectedAt : now
    });
  }

  if (openUserIds.length) {
    await BalanceMismatch.destroy({
      where: {userId: {[Op.notIn]: openUserIds}}
    });
  } else {
    await BalanceMismatch.destroy({where: {}});
  }

  return {
    checkedAt: now.toISOString(),
    mismatchCount: mismatches.length
  };
}

export async function listStoredMismatches({limit, offset} = {}) {
  const capped = Math.min(Math.max(Math.floor(Number(limit)) || 50, 1), 200);
  const skip = Math.max(Math.floor(Number(offset)) || 0, 0);

  const {rows, count} = await BalanceMismatch.findAndCountAll({
    order: [['delta', 'DESC'], ['userId', 'ASC']],
    limit: capped,
    offset: skip
  });

  return {
    count,
    limit: capped,
    offset: skip,
    mismatches: rows.map((row) => {
      const plain = row.get({plain: true});
      return {
        userId: plain.userId,
        fullName: plain.fullName || null,
        storedPoints: plain.storedPoints * 1 || 0,
        computedPoints: plain.computedPoints * 1 || 0,
        delta: plain.delta * 1 || 0,
        checkedAt: plain.checkedAt,
        firstDetectedAt: plain.firstDetectedAt
      };
    })
  };
}
