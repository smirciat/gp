'use strict';

var express = require('express');
var controller = require('./integration.controller');
import {requireBeringPublicIntegration} from './integration.auth';

var router = express.Router();

router.use(requireBeringPublicIntegration());

router.get('/meta', controller.metaBeringPublic);
router.post('/auth/login', controller.loginBeringPublic);
router.post('/auth/password-reset', controller.requestPasswordResetBeringPublic);
router.post('/transfer/sms', controller.sendTransferSmsBeringPublic);
router.post('/transfer', controller.transferHouseholdBeringPublic);
router.get('/rewards', controller.rewardCatalog);
router.get('/membership', controller.membershipBeringPublic);
router.post('/membership', controller.membershipBeringPublic);
router.post('/transactions/query', controller.queryTransactionsBeringPublic);
router.post('/events/query', controller.queryLegacyEventsBeringPublic);
router.post('/redeem', controller.redeemBeringPublic);

module.exports = router;
