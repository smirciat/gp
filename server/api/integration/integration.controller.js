'use strict';

import localEnv from '../../config/local.env';
import {listRewardTiers} from './rewards.service';
import {resolveMembership} from './membership.service';
import {redeemPoints} from './redeem.service';
import {verifyMemberCredentials} from './auth-verify.service';
import {requestGuestPasswordReset} from './password-reset.service';
import {upsertFlightManifestFromResBering} from './flight-manifest.service';
import {
  getCustomerMembership,
  listCustomersByPoints,
  queryCustomers
} from './customers.service';
import {queryTransactions} from './transactions.service';
import {
  deleteTransaction,
  listAllTransactions,
  updateTransaction
} from './transaction-ops.service';
import {enrollMember} from './members-enroll.service';
import {assignManualPoints, setMemberSuspension} from './manual-assign.service';
import {
  attachAssociates,
  deleteMember,
  patchMemberDetails,
  promoteAssociate,
  queryLegacyEvents,
  resendWelcome,
  transferHouseholdPoints,
  transferPoints
} from './member-ops.service';
import {
  consumeTransferCode,
  sendTransferSms
} from './transfer-sms.service';
import {
  auditMemberBalance,
  batchRepairMemberBalances,
  listStoredMismatches,
  runFullBalanceAudit
} from '../balance-audit/balance-audit.service';
import {resolveStaffAgentId} from './staff-agent.service';
const GP_BASE_URL = 'https://gp.beringair.com';

function integrationMeta(appName) {
  const meta = {
    app: appName,
    apiVersion: 'v1',
    service: 'gold-points',
    baseUrl: GP_BASE_URL
  };
  if (appName === 'bering_public') {
    meta.allowedRedemptionTypes = ['fare'];
  } else if (appName === 'resbering') {
    meta.allowedRedemptionTypes = ['fare', 'freight'];
  }
  return meta;
}

function readLookup(req) {
  return {
    email: req.query.email || req.body.email,
    userId: req.query.userId || req.body.userId
  };
}

function readRedeemBody(body) {
  return {
    email: body.email,
    userId: body.userId,
    tierPoints: body.tierPoints,
    redemptionType: body.redemptionType,
    booking: body.booking,
    route: body.route,
    flight: body.flight,
    dateFlown: body.dateFlown,
    description: body.description,
    lastUpdatedBy: body.lastUpdatedBy || 0
  };
}

function validateRedeemRequest(body, options) {
  options = options || {};
  if (!body.email && !body.userId) {
    return 'Provide email or userId for the member redeeming points.';
  }
  if (!body.tierPoints) {
    return 'tierPoints is required (10, 20, 50, 100, 200, 400, 800, or 1000).';
  }
  if (!body.redemptionType) {
    return 'redemptionType is required (fare or freight).';
  }
  if (options.fareOnly && body.redemptionType !== 'fare') {
    return 'bering_public only supports fare redemption.';
  }
  if (!body.booking) {
    return 'booking is required.';
  }
  return null;
}

function membershipForBeringPublic(membership) {
  return Object.assign({}, membership, {
    availableFreightRewards: [],
    availableRewards: membership.availableFareRewards || []
  });
}

export function metaResBering(req, res) {
  res.json(integrationMeta('resbering'));
}

export async function staffAgentIdResBering(req, res) {
  try {
    const body = req.body || {};
    const email =
      typeof req.query.email === 'string'
        ? req.query.email
        : typeof body.email === 'string'
          ? body.email
          : '';
    const result = await resolveStaffAgentId(email);
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Staff agent lookup failed'
    });
  }
}

export function metaBeringPublic(req, res) {
  res.json(integrationMeta('bering_public'));
}

export function rewardCatalog(req, res) {
  res.json({
    baseUrl: GP_BASE_URL,
    tiers: listRewardTiers()
  });
}

export async function membershipResBering(req, res) {
  try {
    const lookup = readLookup(req);
    if (!lookup.email && !lookup.userId) {
      return res.status(400).json({
        message: 'Provide email or userId to look up a Gold Points membership.'
      });
    }

    const membership = await resolveMembership(lookup);
    if (!membership) {
      return res.status(404).json({message: 'Gold Points member not found'});
    }

    res.json(membership);
  } catch (err) {
    console.log(err);
    res.status(500).json({message: 'Failed to load membership'});
  }
}

export async function membershipBeringPublic(req, res) {
  try {
    const lookup = readLookup(req);
    if (!lookup.email && !lookup.userId) {
      return res.status(400).json({
        message: 'email or userId is required for bering_public membership lookup.'
      });
    }

    const membership = await resolveMembership(lookup);
    if (!membership) {
      return res.status(404).json({message: 'Gold Points member not found'});
    }

    res.json(membershipForBeringPublic(membership));
  } catch (err) {
    console.log(err);
    res.status(500).json({message: 'Failed to load membership'});
  }
}

export async function redeemResBering(req, res) {
  try {
    const body = readRedeemBody(req.body || {});
    const validationError = validateRedeemRequest(body);
    if (validationError) {
      return res.status(400).json({message: validationError});
    }

    const result = await redeemPoints(Object.assign({}, body, {sourceApp: 'resbering'}));
    res.status(201).json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({message: err.message || 'Redemption failed'});
  }
}

export async function importFlightManifestResBering(req, res) {
  try {
    const result = await upsertFlightManifestFromResBering(req.body || {});
    res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({message: err.message || 'Flight manifest import failed'});
  }
}

export async function queryCustomersResBering(req, res) {
  try {
    const body = req.body || {};
    const result = await queryCustomers({
      q: body.q,
      search: body.search,
      query: body.query,
      limit: body.limit
    });
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({message: err.message || 'Customer query failed'});
  }
}

export async function getCustomerResBering(req, res) {
  try {
    const membership = await getCustomerMembership(req.params.userId);
    if (!membership) {
      return res.status(404).json({message: 'Gold Points member not found'});
    }
    res.json(membership);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({message: err.message || 'Failed to load customer'});
  }
}

export async function assignManualPointsResBering(req, res) {
  try {
    const result = await assignManualPoints(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Manual assign failed'
    });
  }
}

export async function setMemberSuspensionResBering(req, res) {
  try {
    const userId = req.params.userId;
    const suspended = req.body ? req.body.suspended : undefined;
    const result = await setMemberSuspension(userId, suspended);
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Suspension update failed'
    });
  }
}

export async function enrollMemberResBering(req, res) {
  try {
    const result = await enrollMember(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Enrollment failed',
      duplicateCount: err.duplicateCount
    });
  }
}

export async function queryLegacyEventsResBering(req, res) {
  try {
    const body = req.body || {};
    const result = await queryLegacyEvents({
      userId: body.userId || req.query.userId
    });
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Legacy event query failed'
    });
  }
}

export async function patchMemberResBering(req, res) {
  try {
    const result = await patchMemberDetails(req.params.userId, req.body || {});
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Member update failed'
    });
  }
}

export async function attachAssociatesResBering(req, res) {
  try {
    const body = req.body || {};
    const membership = await attachAssociates({
      primaryUserId: body.primaryUserId,
      associateUserIds: body.associateUserIds
    });
    res.json({membership: membership});
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Attach associates failed'
    });
  }
}

export async function promoteAssociateResBering(req, res) {
  try {
    const membership = await promoteAssociate(req.params.userId);
    res.json({membership: membership});
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Promote associate failed'
    });
  }
}

export async function resendWelcomeResBering(req, res) {
  try {
    const result = await resendWelcome(req.params.userId);
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Welcome email failed'
    });
  }
}

export async function transferPointsResBering(req, res) {
  try {
    const result = await transferPoints(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Transfer failed'
    });
  }
}

export async function queryTransactionsResBering(req, res) {
  try {
    const body = req.body || {};
    const result = await queryTransactions({
      userId: body.userId,
      queryUsers: body.queryUsers,
      limit: body.limit
    });
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Transaction query failed'
    });
  }
}

export async function queryTransactionsBeringPublic(req, res) {
  return queryTransactionsResBering(req, res);
}

export async function queryLegacyEventsBeringPublic(req, res) {
  return queryLegacyEventsResBering(req, res);
}

export async function listCustomersByPointsResBering(req, res) {
  try {
    const result = await listCustomersByPoints();
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Customer roster failed'
    });
  }
}

export async function listAllTransactionsResBering(req, res) {
  try {
    const body = req.body || {};
    const result = await listAllTransactions({offset: body.offset});
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Transaction list failed'
    });
  }
}

export async function patchTransactionResBering(req, res) {
  try {
    const body = req.body || {};
    const result = await updateTransaction({
      oldTransaction: body.oldTransaction,
      newTransaction: body.newTransaction
    });
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Transaction update failed'
    });
  }
}

export async function deleteTransactionResBering(req, res) {
  try {
    const result = await deleteTransaction(req.params.transactionId);
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Transaction delete failed'
    });
  }
}

export async function deleteMemberResBering(req, res) {
  try {
    const result = await deleteMember(req.params.userId);
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Member delete failed'
    });
  }
}

export async function listBalanceMismatchesResBering(req, res) {
  try {
    const limit =
      req.query.limit != null ? Number(req.query.limit) : undefined;
    const offset =
      req.query.offset != null ? Number(req.query.offset) : undefined;
    const result = await listStoredMismatches({limit, offset});
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Balance audit list failed'
    });
  }
}

export async function getMemberBalanceAuditResBering(req, res) {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
    if (!userId) {
      return res.status(400).json({message: 'userId is required.'});
    }
    const audit = await auditMemberBalance(userId);
    res.json(audit);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Balance audit lookup failed'
    });
  }
}

export async function batchRepairBalanceAuditResBering(req, res) {
  try {
    const body = req.body || {};
    const userIds = Array.isArray(body.userIds)
      ? body.userIds
      : undefined;
    const result = await batchRepairMemberBalances({
      mode: body.mode,
      userIds: userIds,
      maxCount: body.maxCount,
      dryRun: body.dryRun
    });
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Balance audit batch repair failed'
    });
  }
}

export async function runBalanceAuditResBering(req, res) {
  try {
    const result = await runFullBalanceAudit();
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Balance audit run failed'
    });
  }
}

export async function loginBeringPublic(req, res) {
  try {
    const body = req.body || {};
    const result = await verifyMemberCredentials({
      email: body.email,
      password: body.password
    });
    if (!result.ok) {
      return res.status(result.status).json({
        message: result.message,
        code: result.code
      });
    }
    res.json({member: result.member});
  } catch (err) {
    console.log(err);
    res.status(500).json({message: 'Login verify failed'});
  }
}

export async function requestPasswordResetBeringPublic(req, res) {
  try {
    const result = await requestGuestPasswordReset({
      email: req.body && req.body.email
    });
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Password reset failed',
      code: err.code
    });
  }
}

export async function sendTransferSmsBeringPublic(req, res) {
  try {
    const userId =
      req.body && req.body.userId != null ? String(req.body.userId).trim() : '';
    if (!userId) {
      return res.status(400).json({
        message: 'userId is required.',
        code: 'invalid_request'
      });
    }
    const membership = await resolveMembership({userId});
    if (!membership || !membership.member) {
      return res.status(404).json({
        message: 'Gold Points member not found.',
        code: 'not_found'
      });
    }
    if (membership.member.suspended) {
      return res.status(403).json({
        message: 'Need to remove customer suspension first',
        code: 'suspended'
      });
    }
    const phone =
      (membership.member.phone && String(membership.member.phone).trim()) ||
      (membership.primary &&
        membership.primary.phone &&
        String(membership.primary.phone).trim()) ||
      '';
    if (!phone) {
      return res.status(400).json({
        message:
          'We need a phone number associated with your account to authenticate a transfer.',
        code: 'no_phone'
      });
    }
    const result = await sendTransferSms({userId, phone});
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'SMS failed',
      code: err.code
    });
  }
}

export async function transferHouseholdBeringPublic(req, res) {
  try {
    const body = req.body || {};
    const fromUserId =
      body.fromUserId != null ? String(body.fromUserId).trim() : '';
    const toUserId = body.toUserId != null ? String(body.toUserId).trim() : '';
    const code = body.code;
    if (!fromUserId || !toUserId) {
      return res.status(400).json({
        message: 'fromUserId and toUserId are required.',
        code: 'invalid_request'
      });
    }
    consumeTransferCode(fromUserId, code);
    const result = await transferHouseholdPoints({
      actorUserId: fromUserId,
      toUserId,
      points: body.points,
      lastUpdatedBy: 'bering-public'
    });
    res.status(201).json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({
      message: err.message || 'Transfer failed',
      code: err.code
    });
  }
}

export async function redeemBeringPublic(req, res) {
  try {
    const body = readRedeemBody(req.body || {});
    const validationError = validateRedeemRequest(body, {fareOnly: true});
    if (validationError) {
      return res.status(400).json({message: validationError});
    }

    const result = await redeemPoints(Object.assign({}, body, {sourceApp: 'bering_public'}));
    res.status(201).json(result);
  } catch (err) {
    console.log(err);
    res.status(err.status || 500).json({message: err.message || 'Redemption failed'});
  }
}
