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
router.post('/customers/query', controller.queryCustomersResBering);
router.get('/customers/:userId', controller.getCustomerResBering);
router.post('/transactions/query', controller.queryTransactionsResBering);
router.post('/members/enroll', controller.enrollMemberResBering);
router.post('/transactions/assign', controller.assignManualPointsResBering);
router.patch('/customers/:userId/suspension', controller.setMemberSuspensionResBering);
router.post('/redeem', controller.redeemResBering);
router.post('/flights/manifest', controller.importFlightManifestResBering);

module.exports = router;
