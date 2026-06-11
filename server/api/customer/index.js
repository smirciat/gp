'use strict';

var express = require('express');
var controller = require('./customer.controller');
import * as auth from '../../auth/auth.service';

var router = express.Router();

router.get('/', auth.hasRole('user'), controller.index);
router.get('/:id', auth.hasRole('guest'), controller.show);
router.post('/', auth.hasRole('user'), controller.create);
router.post('/one', auth.hasRole('guest'), controller.one);
router.post('/query', auth.hasRole('guest'), controller.query);
router.post('/last', auth.hasRole('user'), controller.last);
router.put('/:id', auth.hasRole('guest'),  controller.update);
router.patch('/:id', auth.hasRole('guest'), controller.update);
router.delete('/:id', auth.hasRole('user'), controller.destroy);

module.exports = router;
