// src/lib/jwt.js
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Sign a JWT for an authenticated staff member.
 * Keep the payload small — anything you put here is visible to the client.
 */
export function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'lerafee',
  });
}

/**
 * Verify a JWT and return its decoded payload.
 * Throws if the token is invalid, expired, or signed with the wrong key.
 */
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'lerafee',
  });
}

/**
 * Extract the Bearer token from an Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearer(header) {
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim() || null;
}

/**
 * Build the JWT payload for a staff member.
 * Use this so the shape is consistent everywhere it's signed.
 */
export function buildStaffPayload(staff) {
  return {
    sub: staff.id,
    email: staff.email,
    role: staff.role,
    device_code: staff.device_code ?? null,
  };
}