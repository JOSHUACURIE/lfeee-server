// src/routes/academic.routes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateQuery, rules } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';
import * as academic from '../controllers/academic.controller.js';

const router = Router();
router.use(requireAuth);

// -------- Years --------
router.get('/years', wrap(academic.listYears));

router.post(
  '/years',
  requireRole('admin'),
  validate({
    year_name: rules.string({ min: 4, max: 20 }),
    start_date: rules.date(),
    end_date: rules.date(),
    is_current: rules.boolean(),
  }),
  wrap(academic.createYear)
);

router.patch(
  '/years/:id',
  requireRole('admin'),
  validate({
    year_name: rules.string({ min: 4, max: 20 }),
    start_date: rules.date(),
    end_date: rules.date(),
  }),
  wrap(academic.updateYear)
);

router.delete('/years/:id', requireRole('admin'), wrap(academic.deleteYear));

router.post(
  '/years/:id/current',
  requireRole('admin'),
  wrap(academic.setCurrentYear)
);

// -------- Terms --------
router.get(
  '/terms',
  validateQuery({ academic_year_id: rules.uuid() }),
  wrap(academic.listTerms)
);

router.post(
  '/terms',
  requireRole('admin'),
  validate({
    academic_year_id: rules.uuid(),
    term_name: rules.string({ min: 3, max: 20 }),
    start_date: rules.date(),
    end_date: rules.date(),
    is_current: rules.boolean(),
  }),
  wrap(academic.createTerm)
);

router.patch(
  '/terms/:id',
  requireRole('admin'),
  validate({
    term_name: rules.string({ min: 3, max: 20 }),
    start_date: rules.date(),
    end_date: rules.date(),
  }),
  wrap(academic.updateTerm)
);

router.delete('/terms/:id', requireRole('admin'), wrap(academic.deleteTerm));

router.post(
  '/terms/:id/current',
  requireRole('admin'),
  wrap(academic.setCurrentTerm)
);

export default router;