'use strict';

import sqldb from '../../sqldb';
const {sequelize, BalanceMismatch, Customer} = sqldb;
const {Op} = require('sequelize');
import {assignManualPoints} from '../integration/manual-assign.service';
import {newTransaction} from '../transaction/transaction.controller';

/**
 * Ledger sum for balance audit.
 * May 2026 cutover: opening balance was stored on Customer (currentPoints = points)
 * and mirrored as Transactions with awardRedeem='beginning' (+points, no balance bump
 * at post). Audit counts beginning like award.
 * awardRedeem='audit' = staff repair trail only (skipBalance, not in sum).
 */
const LEDGER_SUM_CASE = `
        CASE
          WHEN "awardRedeem" IN ('award', 'beginning') THEN COALESCE(points, 0)
          WHEN "awardRedeem" = 'redeem' THEN -COALESCE(points, 0)
          ELSE 0
        END`;

const LEDGER_AGG_SQL = `
    SELECT "userId",
      SUM(CASE WHEN "awardRedeem" = 'beginning' THEN COALESCE(points, 0) ELSE 0 END)::integer AS ledger_beginning,
      SUM(CASE WHEN "awardRedeem" = 'award' THEN COALESCE(points, 0) ELSE 0 END)::integer AS ledger_award,
      SUM(CASE WHEN "awardRedeem" = 'redeem' THEN COALESCE(points, 0) ELSE 0 END)::integer AS ledger_redeem,
      SUM(${LEDGER_SUM_CASE})::integer AS computed
    FROM "Transactions"
`;

const LEDGER_MISMATCH_SQL = `
  WITH ledger AS (
    ${LEDGER_AGG_SQL}
    GROUP BY "userId"
  )
  SELECT c."userId",
    c."fullName",
    COALESCE(c."currentPoints", 0)::integer AS stored,
    COALESCE(l.ledger_beginning, 0)::integer AS ledger_beginning,
    COALESCE(l.ledger_award, 0)::integer AS ledger_award,
    COALESCE(l.ledger_redeem, 0)::integer AS ledger_redeem,
    COALESCE(l.computed, 0)::integer AS computed
  FROM "Customers" c
  LEFT JOIN ledger l ON l."userId" = c."userId"
  WHERE COALESCE(c."currentPoints", 0) <> COALESCE(l.computed, 0)
`;

const MEMBER_AUDIT_SQL = `
  WITH ledger AS (
    ${LEDGER_AGG_SQL}
    WHERE "userId" = :userId
    GROUP BY "userId"
  )
  SELECT c."userId",
    c."fullName",
    COALESCE(c."currentPoints", 0)::integer AS stored,
    COALESCE(l.ledger_beginning, 0)::integer AS ledger_beginning,
    COALESCE(l.ledger_award, 0)::integer AS ledger_award,
    COALESCE(l.ledger_redeem, 0)::integer AS ledger_redeem,
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
    ledgerBeginning: row.ledger_beginning * 1 || 0,
    ledgerAward: row.ledger_award * 1 || 0,
    ledgerRedeem: row.ledger_redeem * 1 || 0,
    delta: stored - computed,
    mismatch: stored !== computed
  };
}

function auditRepairDescription(mode, audit) {
  return (
    'Balance audit repair (' +
    mode +
    '): stored ' +
    audit.storedPoints +
    ' corrected to ledger ' +
    audit.computedPoints
  );
}

/**
 * Post skipBalance AUDIT row documenting a stored-balance correction (trust_ledger).
 * Does not change ledger sum or currentPoints.
 */
async function postAuditRepairTrailTransaction(userId, audit, mode) {
  const points = Math.abs(audit.delta);
  if (!points) {
    return null;
  }

  const customer = await Customer.findOne({where: {userId: userId}});
  const account = customer ? customer.account || '' : '';
  const description = auditRepairDescription(mode, audit);

  const body = {
    userId: userId,
    account: account,
    points: points,
    awardRedeem: 'audit',
    status: 'Approved',
    date: new Date(),
    dateFlown: '',
    booking: 'AUDIT',
    route: '',
    flight: '',
    description: description,
    lastUpdatedBy: 0
  };

  const result = await newTransaction({body: body}, null);
  if (typeof result === 'string' && result.indexOf('Successful') === -1) {
    const err = new Error(result);
    err.status = 500;
    throw err;
  }

  return {
    points: points,
    awardRedeem: 'audit',
    description: description,
    transactionId: result && result._id != null ? result._id : null
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
      fullName: audit.fullName,
      repaired: false,
      reason: 'already_aligned',
      audit
    };
  }

  await Customer.update(
    {currentPoints: audit.computedPoints},
    {where: {userId: audit.userId}}
  );

  const trailTransaction = await postAuditRepairTrailTransaction(
    audit.userId,
    audit,
    'trust_ledger'
  );

  await BalanceMismatch.destroy({where: {userId: audit.userId}});

  return {
    userId: audit.userId,
    fullName: audit.fullName,
    repaired: true,
    mode: 'trust_ledger',
    previousStoredPoints: audit.storedPoints,
    computedPoints: audit.computedPoints,
    delta: audit.delta,
    trailTransaction: trailTransaction
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
      fullName: initial.fullName,
      repaired: false,
      reason: 'already_aligned',
      audit: initial
    };
  }

  const repairDescription = auditRepairDescription('trust_stored', initial);
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
      description: repairDescription,
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
    fullName: initial.fullName,
    repaired: !after.mismatch,
    mode: 'trust_stored',
    adjustmentCount: adjustments.length,
    adjustments: adjustments,
    previousStoredPoints: initial.storedPoints,
    previousComputedPoints: initial.computedPoints,
    computedPoints: after.computedPoints,
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
          fullName: audit.fullName,
          mismatch: audit.mismatch,
          storedPoints: audit.storedPoints,
          computedPoints: audit.computedPoints,
          ledgerBeginning: audit.ledgerBeginning,
          ledgerAward: audit.ledgerAward,
          ledgerRedeem: audit.ledgerRedeem,
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
