'use strict';

import {User} from '../../sqldb';
const {Op} = require('sequelize');

/**
 * Legacy GP staff login User._id — stored on transactions as lastUpdatedBy / Agent id.
 */
export async function resolveStaffAgentId(email) {
  const normalized = email != null ? String(email).trim().toLowerCase() : '';
  if (!normalized) {
    const err = new Error('email is required.');
    err.status = 400;
    throw err;
  }

  const user = await User.findOne({
    where: {
      email: {[Op.iLike]: normalized},
      role: {[Op.in]: ['user', 'admin']}
    },
    attributes: ['_id', 'email', 'role']
  });

  if (!user) {
    const err = new Error('No GP staff user matches that email.');
    err.status = 404;
    throw err;
  }

  return {
    agentId: user._id,
    email: user.email,
    role: user.role
  };
}
