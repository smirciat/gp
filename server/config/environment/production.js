'use strict';

import localEnv from '../local.env.js';

// Production specific configuration
// =================================
module.exports = {
  // Server IP
  ip:  '127.0.0.1',//   '0.0.0.0',

  // Server port
  port:   58778,

  sequelize: {
    uri:  localEnv.SEQUELIZE_URI ||
          'sqlite://',
    options: {
      logging: false,
      storage: 'dist.sqlite',
      define: {
        timestamps: false
      }
    }
  }
};
