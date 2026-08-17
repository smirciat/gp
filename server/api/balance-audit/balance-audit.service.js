'use strict';

import sqldb from '../../sqldb';
const {sequelize, BalanceMismatch, Customer} = sqldb;
const {Op} = require('sequelize');
import {assignManualPoints} from '../integration/manual-assign.service';

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

/**
 * Set Customer.currentPoints to ledger sum (trust transaction history).
 */
export async function repairMemberBalanceToLedger(userId) {
  const audit = await auditMemberBalance(userId);
  if (!audit.mismatch) {
    return {
      userId: audit.userId,
      repaired: false,
      reason: 'already_aligned',
      audit
    };
  }

  await Customer.update(
    {currentPoints: audit.computedPoints},
    {where: {userId: audit.userId}}
  );
  await BalanceMismatch.destroy({where: {userId: audit.userId}});

  return {
    userId: audit.userId,
    repaired: true,
    mode: 'trust_ledger',
    previousStoredPoints: audit.storedPoints,
    computedPoints: audit.computedPoints,
    delta: audit.delta
  };
}

/**
 * Post Approved award/redeem rows so ledger sum matches stored balance.
 * Chunks adjustments to respect per-transaction caps (100 award / 1000 redeem).
 */
export async function repairMemberBalanceViaTransaction(userId) {
  const initial = await auditMemberBalance(userId);
  if (!initial.mismatch) {
    return {
      userId: initial.userId,
      repaired: false,
      reason: 'already_aligned',
      audit: initial
    };
  }

  const adjustments = [];
  let iterations = 0;
  const maxIterations = 50;

  while (iterations < maxIterations) {
    const audit = await auditMemberBalance(userId);
    if (!audit.mismatch) {
      break;
    }
    const delta = audit.delta;
    const points = Math.abs(delta);
    const awardRedeem = delta > 0 ? 'award' : 'redeem';
    const cap = awardRedeem === 'award' ? 100 : 1000;
    const chunk = Math.min(points, cap);

    await assignManualPoints({
      userId: audit.userId,
      points: chunk,
      awardRedeem: awardRedeem,
      description: 'Balance audit repair',
      booking: 'AUDIT',
      route: '',
      flight: '',
      dateFlown: '',
      lastUpdatedBy: 0
    });

    adjustments.push({points: chunk, awardRedeem: awardRedeem});
    iterations += 1;
  }

  await BalanceMismatch.destroy({where: {userId: initial.userId}});
  const after = await auditMemberBalance(userId);

  return {
    userId: initial.userId,
    repaired: !after.mismatch,
    mode: 'trust_stored',
    adjustmentCount: adjustments.length,
    adjustments: adjustments,
    previousStoredPoints: initial.storedPoints,
    previousComputedPoints: initial.computedPoints,
    after
  };
}

/**
 * Batch repair open audit mismatches.
 * @param {object} options
 * @param {string} [options.mode] trust_ledger | trust_stored
 * @param {string[]} [options.userIds] subset; default all current mismatches
 * @param {number} [options.maxCount] safety cap (default 25, max 100)
 * @param {boolean} [options.dryRun] preview only
 */
export async function batchRepairMemberBalances(options) {
  options = options || {};
  const mode = options.mode === 'trust_stored' ? 'trust_stored' : 'trust_ledger';
  const max = Math.min(Math.max(Math.floor(Number(options.maxCount)) || 25, 1), 100);
  const dryRun = !!options.dryRun;

  let targets = [];
  if (options.userIds && options.userIds.length) {
    targets = options.userIds
      .map(function (id) {
        return id != null ? String(id).trim() : '';
      })
      .filter(Boolean)
      .slice(0, max);
  } else {
    const mismatches = await findAllLedgerMismatches();
    targets = mismatches.slice(0, max).map(function (row) {
      return row.userId;
    });
  }

  if (dryRun) {
    const previews = [];
    for (let i = 0; i < targets.length; i++) {
      const userId = targets[i];
      try {
        const audit = await auditMemberBalance(userId);
        previews.push({
          userId: userId,
          mismatch: audit.mismatch,
          storedPoints: audit.storedPoints,
          computedPoints: audit.computedPoints,
          delta: audit.delta,
          plannedMode: mode
        });
      } catch (err) {
        previews.push({
          userId: userId,
          error: err.message || String(err)
        });
      }
    }
    return {
      dryRun: true,
      mode: mode,
      count: previews.length,
      previews: previews
    };
  }

  const results = [];
  for (let j = 0; j < targets.length; j++) {
    const id = targets[j];
    try {
      const row =
        mode === 'trust_stored'
          ? await repairMemberBalanceViaTransaction(id)
          : await repairMemberBalanceToLedger(id);
      results.push(row);
    } catch (err) {
      results.push({
        userId: id,
        repaired: false,
        error: err.message || String(err)
      });
    }
  }

  return {
    dryRun: false,
    mode: mode,
    count: results.length,
    repairedCount: results.filter(function (r) {
      return r.repaired;
    }).length,
    results: results
  };
}

/**
 * Before spend (redeem / transfer / manual redeem): align stored balance to ledger
 * for every member in the household. Fixes stale currentPoints so redeemable balance
 * matches real ledger capacity.
 */
export async function ensureMembershipBalancesAlignedForSpend(membership) {
  const repairs = [];
  const members = membership && membership.members ? membership.members : [];
  const seen = {};

  for (let i = 0; i < members.length; i++) {
    const uid = members[i].userId;
    if (!uid || seen[uid]) {
      continue;
    }
    seen[uid] = true;
    const audit = await auditMemberBalance(uid);
    if (!audit.mismatch) {
      continue;
    }
    const repair = await repairMemberBalanceToLedger(uid);
    repairs.push(repair);
  }

  return repairs;
}

export async function ensureMemberBalanceAlignedForSpend(userId) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) {
    const err = new Error('userId is required.');
    err.status = 400;
    throw err;
  }
  const audit = await auditMemberBalance(id);
  if (!audit.mismatch) {
    return {userId: id, repaired: false, reason: 'already_aligned'};
  }
  return repairMemberBalanceToLedger(id);
}
