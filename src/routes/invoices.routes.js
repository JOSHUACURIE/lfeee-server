// src/routes/invoices.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery, rules } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';
import * as invoices from '../controllers/invoices.controller.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validateQuery({
    student_id: rules.uuid(),
    term_id: rules.uuid(),
    status: rules.oneOf(['pending', 'partial', 'paid']),
    limit: rules.number({ integer: true, min: 1, max: 500 }),
    offset: rules.number({ integer: true, min: 0 }),
  }),
  wrap(invoices.list)
);

// IMPORTANT: /student/:id must come BEFORE /:id
// otherwise Express matches "student" as the :id param
router.get('/student/:id', wrap(invoices.forStudent));

router.get('/:id', wrap(invoices.get));

export default router;