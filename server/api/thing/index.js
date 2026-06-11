'use strict';

var express = require('express');
var controller = require('./thing.controller');
import * as auth from '../../auth/auth.service';

var router = express.Router();

router.get('/', auth.hasRole('user'), controller.index);
router.get('/:id', auth.hasRole('user'), controller.show);
router.post('/sms', auth.hasRole('user'), controller.sms);
router.post('/verify', auth.isAuthenticated(), controller.verify);
router.post('/twoFA', auth.isAuthenticated(), controller.twoFA);
router.post('/welcomeEmail', auth.hasRole('user'), controller.welcomeEmail);
router.post('/email', auth.hasRole('user'), controller.email);
router.post('/getManifest', auth.hasRole('user'), controller.getManifest);
router.post('/', auth.hasRole('user'), controller.create);
router.put('/:id', auth.hasRole('user'), controller.update);
router.patch('/:id', auth.hasRole('user'), controller.update);
router.delete('/:id', auth.hasRole('user'), controller.destroy);

module.exports = router;
