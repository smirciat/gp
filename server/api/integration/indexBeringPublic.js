'use strict';

var express = require('express');
var controller = require('./integration.controller');
import {requireBeringPublicIntegration} from './integration.auth';

var router = express.Router();

router.use(requireBeringPublicIntegration());

router.get('/meta', controller.metaBeringPublic);
router.get('/rewards', controller.rewardCatalog);
router.get('/membership', controller.membershipBeringPublic);
router.post('/membership', controller.membershipBeringPublic);
router.post('/redeem', controller.redeemBeringPublic);

module.exports = router;
