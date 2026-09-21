// src/routes/students.routes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateQuery, rules } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';
import * as students from '../controllers/students.controller.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/students
 *   ?q=grace            search name / adm / class
 *   ?class_name=Grade 6
 *   ?student_type=boarder
 *   ?is_active=true     default true
 *   ?with_balance=true  attach billed/paid/balance per student
 *   ?limit=500&offset=0
 */
router.get(
  '/',
  validateQuery({
    q: rules.string({ max: 100 }),
    class_name: rules.string({ max: 50 }),
    student_type: rules.oneOf(['boarder', 'day_scholar']),
    is_active: rules.oneOf(['true', 'false']),
    with_balance: rules.oneOf(['true', 'false']),
    limit: rules.number({ integer: true, min: 1, max: 2000 }),
    offset: rules.number({ integer: true, min: 0 }),
  }),
  wrap(students.list)
);

/**
 * GET /api/students/meta/classes
 * Registered BEFORE /:id so "meta" isn't captured as an id.
 */
router.get('/meta/classes', wrap(students.classes));
router.get('/meta/counts', wrap(students.counts));

/**
 * GET /api/students/:id
 * Includes invoices + recent payments + totals.
 */
router.get(
  '/:id',
  validate({}, { source: 'params' }), // no-op, keeps shape
  wrap(students.get)
);

/**
 * POST /api/students/bulk
 * Only admins and bursars can import.
 * Body: { students: [...] }  OR  [...] directly
 */
router.post(
  '/bulk',
  requireRole('admin', 'bursar'),
  wrap(students.bulkUpsert)
);

export default router;