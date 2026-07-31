'use strict';

import localEnv from '../../config/local.env';
import {listRewardTiers} from './rewards.service';
import {resolveMembership} from './membership.service';
import {redeemPoints} from './redeem.service';

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
