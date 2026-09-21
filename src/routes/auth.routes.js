// src/routes/auth.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate, rules } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';
import * as auth from '../controllers/auth.controller.js';

const router = Router();

// Public
router.post(
  '/register',
  validate({
    email: rules.email(),
    password: rules.string({ min: 6, max: 100 }),
    full_name: rules.string({ min: 2, max: 200 }),
    role: rules.oneOf(['admin', 'bursar', 'clerk']),
  }),
  wrap(auth.register)
);

router.post(
  '/login',
  validate({
    email: rules.email(),
    password: rules.string({ min: 1, max: 100 }),
  }),
  wrap(auth.login)
);

router.post(
  '/forgot-password',
  validate({ email: rules.email() }),
  wrap(auth.forgotPassword)
);

router.post(
  '/reset-password',
  validate({
    token: rules.string({ min: 10, max: 200 }),
    password: rules.string({ min: 6, max: 100 }),
  }),
  wrap(auth.resetPassword)
);

// Protected
router.get('/me', requireAuth, wrap(auth.me));

router.patch(
  '/profile',
  requireAuth,
  validate({
    full_name: rules.string({ min: 2, max: 200 }),
    email: rules.email(),
  }),
  wrap(auth.updateProfile)
);

router.post(
  '/change-password',
  requireAuth,
  validate({
    current_password: rules.string({ min: 1, max: 100 }),
    new_password: rules.string({ min: 6, max: 100 }),
  }),
  wrap(auth.changePassword)
);

router.post(
  '/register-device',
  requireAuth,
  validate({ device_code: rules.string({ min: 1, max: 20 }) }),
  wrap(auth.registerDevice)
);

export default router;