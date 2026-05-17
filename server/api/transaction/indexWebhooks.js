'use strict';

var express = require('express');
var controller = require('./transaction.controller');

var router = express.Router();

router.options('/', controller.webhookOptions);
router.post('/',controller.webhooks);

module.exports = router;
