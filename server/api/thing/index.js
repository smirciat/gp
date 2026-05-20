'use strict';

var express = require('express');
var controller = require('./thing.controller');
import * as auth from '../../auth/auth.service';

var router = express.Router();

router.get('/', controller.index);
router.get('/:id', controller.show);
router.post('/sms', auth.isAuthenticated(), controller.sms);
router.post('/verify', auth.isAuthenticated(), controller.verify);
router.post('/twoFA', auth.isAuthenticated(), controller.twoFA);
router.post('/welcomeEmail', auth.hasRole('user'), controller.welcomeEmail);
router.post('/email', auth.isAuthenticated(), controller.email);
router.post('/getManifest', auth.hasRole('user'), controller.getManifest);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;
