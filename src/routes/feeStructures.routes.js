// src/routes/feeStructures.routes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateQuery, rules } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';
import * as fees from '../controllers/feeStructures.controller.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validateQuery({ academic_year_id: rules.uuid() }),
  wrap(fees.list)
);

router.get('/:id', wrap(fees.get));

router.post(
  '/',
  requireRole('admin'),
  validate({
    structure_name: rules.string({ min: 3, max: 100 }),
    academic_year_id: rules.uuid(),
    class_name: rules.string({ min: 1, max: 50 }),
    student_type: rules.oneOf(['boarder', 'day_scholar']),
    description: rules.string({ max: 500 }),
    is_active: rules.boolean(),
  }),
  wrap(fees.create)
);

router.patch(
  '/:id',
  requireRole('admin'),
  validate({
    structure_name: rules.string({ min: 3, max: 100 }),
    class_name: rules.string({ min: 1, max: 50 }),
    student_type: rules.oneOf(['boarder', 'day_scholar']),
    description: rules.string({ max: 500 }),
    is_active: rules.boolean(),
  }),
  wrap(fees.update)
);

router.delete('/:id', requireRole('admin'), wrap(fees.remove));

// Items
router.post(
  '/:id/items',
  requireRole('admin'),
  validate({
    item_name: rules.string({ min: 1, max: 100 }),
    description: rules.string({ max: 500 }),
    is_compulsory: rules.boolean(),
    display_order: rules.number({ integer: true, min: 0 }),
  }),
  wrap(fees.addItem)
);

router.patch(
  '/items/:itemId',
  requireRole('admin'),
  validate({
    item_name: rules.string({ min: 1, max: 100 }),
    description: rules.string({ max: 500 }),
    is_compulsory: rules.boolean(),
    display_order: rules.number({ integer: true, min: 0 }),
  }),
  wrap(fees.updateItem)
);

router.delete('/items/:itemId', requireRole('admin'), wrap(fees.removeItem));

// Term amounts
router.put(
  '/items/:itemId/terms/:termId',
  requireRole('admin'),
  validate({ amount: rules.number({ min: 0, max: 1_000_000 }) }),
  wrap(fees.setTermAmount)
);

router.delete(
  '/items/:itemId/terms/:termId',
  requireRole('admin'),
  wrap(fees.removeTermAmount)
);

export default router;