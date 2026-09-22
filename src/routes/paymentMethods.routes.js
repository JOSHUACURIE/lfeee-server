// src/routes/paymentMethods.routes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, rules } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';
import * as methods from '../controllers/paymentMethods.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', wrap(methods.list));

router.post(
  '/',
  requireRole('admin'),
  validate({
    method_name: rules.string({ min: 2, max: 50 }),
    display_name: rules.string({ min: 2, max: 100 }),
    is_active: rules.boolean(),
  }),
  wrap(methods.create)
);

router.patch(
  '/:id',
  requireRole('admin'),
  validate({
    display_name: rules.string({ min: 2, max: 100 }),
    is_active: rules.boolean(),
  }),
  wrap(methods.update)
);

export default router;