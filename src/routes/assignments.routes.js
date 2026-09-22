// src/routes/assignments.routes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateQuery, rules } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';
import * as assignments from '../controllers/assignments.controller.js';

const router = Router();
router.use(requireAuth);

// Who can assign? Admin and bursar.
router.post(
  '/preview',
  requireRole('admin', 'bursar'),
  validate({
    fee_structure_id: rules.uuid(),
    term_id: rules.uuid(),
  }),
  wrap(assignments.preview)
);

router.post(
  '/assign',
  requireRole('admin', 'bursar'),
  validate({
    fee_structure_id: rules.uuid(),
    term_id: rules.uuid(),
  }),
  wrap(assignments.assign)
);

router.get(
  '/term',
  validateQuery({ term_id: rules.uuid() }),
  wrap(assignments.listForTerm)
);

export default router;