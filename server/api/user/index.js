'use strict';

import {Router} from 'express';
import * as controller from './user.controller';
import * as auth from '../../auth/auth.service';

var router = new Router();

router.get('/', auth.hasRole('admin'), controller.index);
router.delete('/:id', auth.hasRole('admin'), controller.destroy);
router.get('/me', auth.isAuthenticated(), controller.me);
router.get('/company', auth.hasRole('user'), controller.company);
router.get('/company/:id', auth.hasRole('user'), controller.company);
router.patch('/reset', auth.hasRole('superadmin'), controller.reset);
router.put('/:id/changerole', auth.hasRole('admin'), controller.adminChangeRole);
router.put('/:id/password', auth.isAuthenticated(), controller.changePassword);
router.get('/:id', auth.isAuthenticated(), controller.show);
router.post('/', controller.create);
router.post('/up', controller.updateAllPasswords);

module.exports = router;
