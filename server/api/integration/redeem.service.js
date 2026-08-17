'use strict';

import {newTransaction} from '../transaction/transaction.controller';
import {
  loadMembershipGroup,
  findCustomerByIdentifier,
  memberRedeemsFromPool
} from './membership.service';
import {validateTierRedemption} from './rewards.service';
import {
  ensureMemberBalanceAlignedForSpend,
  ensureMembershipBalancesAlignedForSpend
} from '../balance-audit/balance-audit.service';

function buildDescription(meta) {
  let description = meta.description || '';
  if (meta.tier) {
    description += ' tier:' + meta.tier.points;
    if (meta.appliedBenefit) {
      description += ' benefit:' + JSON.stringify(meta.appliedBenefit);
    }
  }
  if (meta.booking) {
    description += ' booking:' + meta.booking;
  }
  if (meta.dateFlown || meta.route || meta.flight) {
    description += '=>' + (meta.dateFlown || '') + ' ' + (meta.route || '') + ' ' + (meta.flight || '');
  }
  if (meta.redemptionType) {
    description += ' [' + meta.redemptionType + ']';
  }
  if (meta.sourceApp) {
    description += ' via ' + meta.sourceApp;
  }
  return description.trim();
}

function normalizeDateFlown(dateFlown) {
  if (!dateFlown) {
    return new Date().toLocaleDateString();
  }
  const parts = dateFlown.split('/');
  if (parts.length === 2) {
    return dateFlown + '/' + new Date().getFullYear();
  }
  if (parts.length < 2) {
    return new Date().toLocaleDateString();
  }
  return dateFlown;
}

function buildPoolDebitPlan(membership, points) {
  const plan = [];
  let remaining = points * 1;
  const primary = membership.members.find(member => member.userId === membership.primary.userId);

  if (!primary) {
    throw new Error('Primary member not found for redemption');
  }
  if (primary.suspended) {
    const err = new Error('Primary member is suspended');
    err.status = 409;
    throw err;
  }

  if (primary.currentPoints > 0 && remaining > 0) {
    const debit = Math.min(primary.currentPoints, remaining);
    plan.push({userId: primary.userId, points: debit});
    remaining -= debit;
  }

  if (remaining > 0) {
    for (const associate of membership.associates) {
      if (remaining <= 0) {
        break;
      }
      if (associate.currentPoints <= 0 || associate.suspended) {
        continue;
      }
      const debit = Math.min(associate.currentPoints, remaining);
      plan.push({userId: associate.userId, points: debit});
      remaining -= debit;
    }
  }

  if (remaining > 0) {
    const err = new Error('Not enough points for this redemption');
    err.status = 409;
    throw err;
  }

  return plan;
}

function buildOwnDebitPlan(membership, points) {
  const member = membership.member;
  if (member.suspended) {
    const err = new Error('Member is suspended');
    err.status = 409;
    throw err;
  }
  if ((member.currentPoints * 1 || 0) < points) {
    const err = new Error('Not enough points for this redemption');
    err.status = 409;
    throw err;
  }
  return [{userId: member.userId, points: points * 1}];
}

function buildDebitPlan(membership, points) {
  if (memberRedeemsFromPool(membership.member, membership.primary)) {
    return buildPoolDebitPlan(membership, points);
  }
  return buildOwnDebitPlan(membership, points);
}

export { buildDebitPlan, normalizeDateFlown };

export async function redeemPoints({
  email,
  userId,
  tierPoints,
  redemptionType,
  booking,
  route,
  flight,
  dateFlown,
  description,
  lastUpdatedBy,
  sourceApp
}) {
  if (!booking) {
    const err = new Error('booking is required for tier redemption');
    err.status = 400;
    throw err;
  }

  const tierResult = validateTierRedemption(tierPoints, redemptionType);
  const redeemAmount = tierResult.tier.points;

  const seedCustomer = await findCustomerByIdentifier({email, userId});
  if (!seedCustomer) {
    const err = new Error('Gold Points member not found');
    err.status = 404;
    throw err;
  }

  let membership = await loadMembershipGroup(seedCustomer);
  if (!membership) {
    const err = new Error('Gold Points membership could not be loaded');
    err.status = 404;
    throw err;
  }

  const balanceRepairs = await ensureMembershipBalancesAlignedForSpend(membership);
  if (balanceRepairs.length) {
    membership = await loadMembershipGroup(seedCustomer);
    if (!membership) {
      const err = new Error('Gold Points membership could not be reloaded after balance repair');
      err.status = 500;
      throw err;
    }
  }

  if (membership.redeemablePoints < redeemAmount) {
    const err = new Error('Not enough points for this redemption');
    err.status = 409;
    throw err;
  }

  const debitPlan = buildDebitPlan(membership, redeemAmount);
  const transactions = [];
  const meta = {
    booking,
    route,
    flight,
    dateFlown,
    description,
    redemptionType,
    sourceApp,
    tier: tierResult.tier,
    appliedBenefit: tierResult.appliedBenefit
  };

  for (const debit of debitPlan) {
    const body = {
      userId: debit.userId,
      points: debit.points,
      awardRedeem: 'redeem',
      status: 'Approved',
      date: new Date(),
      dateFlown: normalizeDateFlown(dateFlown),
      booking: booking,
      route: route || '',
      flight: flight || '',
      description: buildDescription(meta),
      lastUpdatedBy: lastUpdatedBy || 0
    };

    const result = await newTransaction({body}, null);
    if (typeof result === 'string') {
      if (result.indexOf('Successful') === -1) {
        const err = new Error(result);
        err.status = 500;
        throw err;
      }
      transactions.push({userId: debit.userId, points: debit.points, status: 'Approved'});
    } else {
      transactions.push(result);
    }
  }

  const refreshed = await loadMembershipGroup(seedCustomer);
  return {
    redeemedPoints: redeemAmount,
    tier: tierResult.tier,
    appliedBenefit: tierResult.appliedBenefit,
    redemptionType,
    booking,
    redeemFromPool: memberRedeemsFromPool(membership.member, membership.primary),
    transactions,
    membership: refreshed
  };
}
