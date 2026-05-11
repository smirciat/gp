/**
 * Sequelize initialization module
 */

'use strict';

import path from 'path';
import config from '../config/environment';
import Sequelize from 'sequelize';

var db = {
  Sequelize,
  sequelize: new Sequelize(config.sequelize.uri, config.sequelize.options)
};

// Insert models below
db.Flight = require('../api/flight/flight.model').default(db.sequelize, Sequelize.DataTypes);
db.Transaction = require('../api/transaction/transaction.model').default(db.sequelize, Sequelize.DataTypes);
db.Customer = require('../api/customer/customer.model').default(db.sequelize, Sequelize.DataTypes);
db.Thing = require('../api/thing/thing.model').default(db.sequelize, Sequelize.DataTypes);
db.User = require('../api/user/user.model')(db.sequelize, Sequelize.DataTypes);

module.exports = db;
