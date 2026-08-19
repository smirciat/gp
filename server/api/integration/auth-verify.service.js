'use strict';

const {Op} = require('sequelize');
import {User} from '../../sqldb';
import {resolveMembership} from './membership.service';

const INVALID = {
  ok: false,
  status: 401,
  code: 'invalid_credentials',
  message: 'Invalid email or password.'
};

function authenticateUser(user, password) {
  return new Promise((resolve, reject) => {
    user.authenticate(password, user.salt, function(err, authenticated) {
      if (err) {
        return reject(err);
      }
      resolve(!!authenticated);
    });
  });
}

/**
 * Server-to-server member login for bering-public (Phase B).
 * Verifies golddb User password; does not create a GP browser session.
 * Never returns password or salt.
 */
export async function verifyMemberCredentials({email, password} = {}) {
  const trimmed = email != null ? String(email).trim() : '';
  const pwd = password != null ? String(password) : '';
  if (!trimmed || !pwd) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_request',
      message: 'email and password are required.'
    };
  }

  const user = await User.findOne({
    where: {email: {[Op.iLike]: trimmed}}
  });
  if (!user) {
    return INVALID;
  }

  const authenticated = await authenticateUser(user, pwd);
  if (!authenticated) {
    return INVALID;
  }

  const role = user.role || 'guest';
  if (role !== 'guest') {
    return INVALID;
  }

  const membership = await resolveMembership({email: user.email});
  const member = membership && membership.member;
  if (!member || !member.userId) {
    return INVALID;
  }

  if (member.suspended) {
    return {
      ok: false,
      status: 403,
      code: 'suspended',
      message: 'This Gold Points account is suspended.'
    };
  }

  return {
    ok: true,
    member: {
      gpUserId: String(member.userId),
      email: member.email || user.email,
      phone: member.phone || null,
      fullName: member.fullName || user.name || '',
      gpType: member.gpType || null,
      suspended: false
    }
  };
}
