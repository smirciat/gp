'use strict';

var express = require('express');
var controller = require('./transaction.controller');
import * as auth from '../../auth/auth.service';

var router = express.Router();

router.get('/', auth.hasRole('user'), controller.index);
router.get('/:id', auth.hasRole('guest'), controller.show);
router.post('/query', auth.hasRole('guest'), controller.query);
router.post('/many', auth.hasRole('user'), controller.index);
router.post('/', auth.hasRole('user'), controller.create);
router.put('/:id', auth.hasRole('user'), controller.update);
router.patch('/:id', auth.hasRole('user'), controller.update);
router.post('/new', auth.hasRole('guest'), controller.newTransaction);
router.delete('/:id', auth.hasRole('user'), controller.destroy);

module.exports = router;
