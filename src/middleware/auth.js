// src/middleware/auth.js
import { extractBearer, verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';

/**
 * Require a valid JWT.
 * On success: req.staff = { id, email, role, device_code }
 * On failure: throws AppError(401)
 *
 * Use on every route that needs the caller to be logged in.
 */
export async function requireAuth(req, _res, next) {
  try {
    const token = extractBearer(req.headers.authorization);
    if (!token) {
      throw new AppError('Sign in to continue.', 401, 'NO_TOKEN');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      const msg =
        e.name === 'TokenExpiredError'
          ? 'Your session has expired. Sign in again.'
          : 'Your session is not valid. Sign in again.';
      throw new AppError(msg, 401, 'BAD_TOKEN');
    }

    // Confirm the account still exists and is active.
    const staff = await prisma.staff.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        device_code: true,
        is_active: true,
      },
    });

    if (!staff || !staff.is_active) {
      throw new AppError('This account is no longer active.', 401, 'INACTIVE');
    }

    req.staff = staff;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Require one of the given roles.
 * Use AFTER requireAuth.
 *
 *   router.post('/', requireAuth, requireRole('admin', 'bursar'), handler);
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.staff) {
      return next(new AppError('Sign in to continue.', 401, 'NO_TOKEN'));
    }
    if (!roles.includes(req.staff.role)) {
      return next(
        new AppError(
          'You do not have permission to do that.',
          403,
          'FORBIDDEN'
        )
      );
    }
    next();
  };
}