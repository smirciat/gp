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

/** All legacy GP staff login users (role user/admin) with email — for resBering agent id sync. */
export async function listStaffAgentEmails() {
  const users = await User.findAll({
    where: {
      role: {[Op.in]: ['user', 'admin']},
      email: {[Op.ne]: null}
    },
    attributes: ['_id', 'email', 'role', 'name'],
    order: [['_id', 'ASC']]
  });

  return users
    .map((user) => {
      const email =
        user.email != null ? String(user.email).trim().toLowerCase() : '';
      if (!email) return null;
      return {
        agentId: user._id,
        email,
        role: user.role,
        name: user.name != null ? String(user.name).trim() : null
      };
    })
    .filter(Boolean);
}
