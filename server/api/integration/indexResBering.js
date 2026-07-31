'use strict';

var express = require('express');
var controller = require('./integration.controller');
import {requireResBeringIntegration} from './integration.auth';

var router = express.Router();

router.use(requireResBeringIntegration());

router.get('/meta', controller.metaResBering);
router.get('/rewards', controller.rewardCatalog);
router.get('/membership', controller.membershipResBering);
router.post('/membership', controller.membershipResBering);
router.post('/redeem', controller.redeemResBering);

module.exports = router;
