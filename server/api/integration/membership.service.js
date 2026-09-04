'use strict';

import {Customer} from '../../sqldb';
const { Op } = require('sequelize');
import {
  availableRewards,
  availableRewardsByType
} from './rewards.service';
import {householdIncludesUserId} from './household-transfer';

export {householdIncludesUserId} from './household-transfer';

function normalizePoints(customer) {
  const row = customer.get ? customer.get({plain: true}) : customer;
  if (row.currentPoints !== 0) {
    row.currentPoints = row.currentPoints || row.points || 0;
  }
  if (!row.gpType) {
    row.gpType = 'Primary';
  }
  return row;
}

export function memberSummary(customer) {
  const row = normalizePoints(customer);
  return {
    _id: row._id,
    userId: row.userId,
    fullName: row.fullName,
    email: row.email,
    account: row.account || null,
    phone: row.phone || null,
    dob: row.dob || null,
    address: row.address || null,
    city: row.city || null,
    state: row.state || null,
    zip: row.zip || null,
    gpType: row.gpType,
    primaryUserId: row.primaryUserId || null,
    currentPoints: row.currentPoints * 1 || 0,
    suspended: !!row.suspended,
    active: row.active !== false,
    badEmail: !!row.badEmail
  };
}

export function memberRedeemsFromPool(member, primary) {
  return member.userId === primary.userId && member.gpType === 'Primary';
}

function enrichMembership(membership) {
  const redeemFromPool = memberRedeemsFromPool(membership.member, membership.primary);
  const redeemablePoints = redeemFromPool
    ? membership.combinedPoints
    : membership.member.currentPoints * 1 || 0;

  return Object.assign({}, membership, {
    redeemFromPool,
    redeemablePoints,
    availableRewards: availableRewards(redeemablePoints),
    availableFareRewards: availableRewardsByType(redeemablePoints, 'fare'),
    availableFreightRewards: availableRewardsByType(redeemablePoints, 'freight')
  });
}

export async function findCustomerByIdentifier({email, userId}) {
  if (userId) {
    return Customer.findOne({
      where: {userId: (userId * 1).toString()}
    });
  }
  if (email) {
    return Customer.findOne({
      where: {
        email: {[Op.iLike]: email.trim()}
      }
    });
  }
  return null;
}

export async function findCustomersByEmail(email) {
  return Customer.findAll({
    where: {
      email: {[Op.iLike]: email.trim()}
    }
  });
}

export async function loadMembershipGroup(seedCustomer) {
  if (!seedCustomer) {
    return null;
  }

  let primary = normalizePoints(seedCustomer);
  const associates = [];

  if (primary.gpType === 'Associate' && primary.primaryUserId) {
    const primaryRow = await Customer.findOne({
      where: {userId: primary.primaryUserId}
    });
    if (!primaryRow) {
      return enrichMembership({
        member: memberSummary(seedCustomer),
        primary: memberSummary(primary),
        associates: [],
        members: [memberSummary(primary)],
        combinedPoints: primary.currentPoints * 1 || 0
      });
    }
    primary = normalizePoints(primaryRow);
  }

  const associateIds = Array.isArray(primary.associatedAccounts)
    ? primary.associatedAccounts.filter(Boolean)
    : [];

  for (const associateId of associateIds) {
    const associate = await Customer.findOne({where: {userId: associateId}});
    if (associate) {
      associates.push(memberSummary(associate));
    }
  }

  const members = [memberSummary(primary), ...associates];
  const combinedPoints = members.reduce((sum, member) => sum + (member.currentPoints * 1 || 0), 0);

  return enrichMembership({
    member: memberSummary(seedCustomer),
    primary: memberSummary(primary),
    associates,
    members,
    combinedPoints
  });
}

export async function resolveMembership({email, userId}) {
  let customer = null;

  if (userId) {
    customer = await findCustomerByIdentifier({userId});
  } else if (email) {
    const matches = await findCustomersByEmail(email);
    if (matches.length === 1) {
      customer = matches[0];
    } else if (matches.length > 1) {
      customer = matches.find(row => normalizePoints(row).gpType === 'Primary') || matches[0];
    }
  }

  if (!customer) {
    return null;
  }

  return loadMembershipGroup(customer);
}
