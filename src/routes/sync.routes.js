// src/routes/sync.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery, rules } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';
import * as sync from '../controllers/sync.controller.js';

const router = Router();
router.use(requireAuth);

router.post('/push', wrap(sync.push));

router.get(
  '/pull',
  validateQuery({ since: rules.string({ max: 50 }) }),
  wrap(sync.pull)
);

router.get('/bootstrap', wrap(sync.bootstrap));
router.post('/heartbeat', wrap(sync.heartbeat));

export default router;