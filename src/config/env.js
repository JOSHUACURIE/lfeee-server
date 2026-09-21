// src/config/env.js
import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || String(value).trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Add it to your .env file.`
    );
  }
  return value;
}

function optional(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || String(value).trim() === '') return fallback;
  return value;
}

function asInt(name, fallback) {
  const raw = optional(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Environment variable ${name} must be a number.`);
  }
  return n;
}

export const env = {
  // Runtime
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: asInt('PORT', 4000),
  HOST: optional('HOST', '0.0.0.0'),

  // Database
  DATABASE_URL: required('DATABASE_URL'),

  // Auth
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '30d'),

  // Optional — future integrations
  MPESA_CONSUMER_KEY: optional('MPESA_CONSUMER_KEY'),
  MPESA_CONSUMER_SECRET: optional('MPESA_CONSUMER_SECRET'),

  // Convenience flags
  isDev: optional('NODE_ENV', 'development') !== 'production',
  isProd: optional('NODE_ENV', 'development') === 'production',
};

// Print a one-line sanity check on boot (never log secret values).
if (env.isDev) {
  console.log(
    `[env] ${env.NODE_ENV} · port ${env.PORT} · db ${env.DATABASE_URL.split('@')[1] ?? 'configured'}`
  );
}