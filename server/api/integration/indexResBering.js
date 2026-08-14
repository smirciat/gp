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
router.get('/customers/roster', controller.listCustomersByPointsResBering);
router.get('/customers/:userId', controller.getCustomerResBering);
router.delete('/customers/:userId', controller.deleteMemberResBering);
router.post('/transactions/query', controller.queryTransactionsResBering);
router.post('/transactions/page', controller.listAllTransactionsResBering);
router.patch('/transactions/:transactionId', controller.patchTransactionResBering);
router.delete('/transactions/:transactionId', controller.deleteTransactionResBering);
router.post('/members/enroll', controller.enrollMemberResBering);
router.post('/transactions/assign', controller.assignManualPointsResBering);
router.patch('/customers/:userId/suspension', controller.setMemberSuspensionResBering);
router.patch('/customers/:userId', controller.patchMemberResBering);
router.post('/customers/:userId/welcome', controller.resendWelcomeResBering);
router.post('/customers/:userId/promote', controller.promoteAssociateResBering);
router.post('/members/attach-associates', controller.attachAssociatesResBering);
router.post('/events/query', controller.queryLegacyEventsResBering);
router.post('/points/transfer', controller.transferPointsResBering);
router.post('/redeem', controller.redeemResBering);
router.post('/flights/manifest', controller.importFlightManifestResBering);
router.get('/audit/mismatches', controller.listBalanceMismatchesResBering);
router.get('/audit/members/:userId', controller.getMemberBalanceAuditResBering);

module.exports = router;
