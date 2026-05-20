'use strict';

var express = require('express');
var controller = require('./transaction.controller');

var router = express.Router();

router.get('/', controller.index);
router.get('/:id', controller.show);
router.post('/query', controller.query);
router.post('/many', controller.index);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id', controller.update);
router.post('/new', controller.newTransaction);
router.delete('/:id', controller.destroy);

module.exports = router;
