// src/middleware/errorHandler.js
import { env } from '../config/env.js';

/**
 * Application-level error with an HTTP status attached.
 * Controllers and services should throw these instead of plain Error.
 */
export class AppError extends Error {
  constructor(message, status = 500, code = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.isOperational = true;
  }
}

/**
 * Wrap an async controller so a rejected promise is forwarded to Express's
 * error pipeline. Without this, async throws silently hang the request.
 *
 *   router.get('/', wrap(async (req, res) => { ... }));
 */
export function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Map Prisma's known error codes to friendly AppErrors.
 * Called by the terminal handler when err.code starts with "P".
 */
function prismaToAppError(err) {
  switch (err.code) {
    case 'P2002':
      return new AppError(
        `That ${err.meta?.target?.join?.(', ') ?? 'value'} is already taken.`,
        409,
        'CONFLICT'
      );
    case 'P2003':
      return new AppError(
        'That record is linked to something else and cannot be changed.',
        409,
        'FOREIGN_KEY'
      );
    case 'P2025':
      return new AppError('We could not find that record.', 404, 'NOT_FOUND');
    case 'P2000':
      return new AppError('One of the values is too long.', 400, 'BAD_INPUT');
    default:
      return null;
  }
}

/**
 * Terminal handler — Express calls this when any route throws.
 * Keep responses consistent: { error: "…", code?: "…" }
 */
export function errorHandler(err, req, res, _next) {
  // Translate Prisma codes first
  if (err?.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    const mapped = prismaToAppError(err);
    if (mapped) err = mapped;
  }

  const status = err.status || err.statusCode || 500;
  const isOperational = err.isOperational === true;

  // Log only the unexpected errors, at full detail.
  if (!isOperational) {
    console.error('[error]', {
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      stack: env.isDev ? err.stack : undefined,
    });
  }

  // Never leak internals in production.
  const message =
    isOperational || env.isDev
      ? err.message || 'Something went wrong.'
      : 'We could not complete that request.';

  const body = { error: message };
  if (err.code && typeof err.code === 'string') body.code = err.code;
  if (env.isDev && !isOperational) body.stack = err.stack;

  res.status(status).json(body);
}

/**
 * 404 for any route that didn't match.
 * Place this AFTER all routes, BEFORE errorHandler.
 */
export function notFound(req, res, _next) {
  res.status(404).json({
    error: `No route for ${req.method} ${req.originalUrl}.`,
    code: 'NOT_FOUND',
  });
}