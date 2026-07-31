'use strict';

import localEnv from '../../config/local.env';

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function readIntegrationKey(req) {
  return req.headers['x-gp-integration-key'] || readBearerToken(req);
}

export function requireResBeringIntegration() {
  return function(req, res, next) {
    const expected = localEnv.RESBERING_INTEGRATION_TOKEN;
    if (!expected) {
      return res.status(503).json({
        message: 'resBering integration is not configured (set RESBERING_INTEGRATION_TOKEN in local.env.js).'
      });
    }
    const provided = readIntegrationKey(req);
    if (!provided || provided !== expected) {
      return res.status(401).json({message: 'Unauthorized'});
    }
    req.integrationApp = 'resbering';
    next();
  };
}

export function requireBeringPublicIntegration() {
  return function(req, res, next) {
    const expected = localEnv.BERING_PUBLIC_INTEGRATION_TOKEN;
    if (!expected) {
      return res.status(503).json({
        message: 'bering_public integration is not configured (set BERING_PUBLIC_INTEGRATION_TOKEN in local.env.js).'
      });
    }
    const provided = readIntegrationKey(req);
    if (!provided || provided !== expected) {
      return res.status(401).json({message: 'Unauthorized'});
    }
    req.integrationApp = 'bering_public';
    next();
  };
}
