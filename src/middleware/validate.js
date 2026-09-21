// src/middleware/validate.js
import { AppError } from './errorHandler.js';

export const rules = {
  string({ min = 0, max = 255, trim = true } = {}) {
    return (value, field) => {
      if (value === undefined || value === null) return undefined;
      let s = String(value);
      if (trim) s = s.trim();
      if (s.length < min) {
        throw `${field} must be at least ${min} character${min === 1 ? '' : 's'}.`;
      }
      if (s.length > max) {
        throw `${field} must be at most ${max} characters.`;
      }
      return s;
    };
  },

  email() {
    return (value, field) => {
      if (value === undefined || value === null) return undefined;
      const s = String(value).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
        throw `${field} must be a valid email address.`;
      }
      return s;
    };
  },

  uuid() {
    return (value, field) => {
      if (value === undefined || value === null) return undefined;
      const s = String(value).trim();
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
      ) {
        throw `${field} must be a valid UUID.`;
      }
      return s;
    };
  },

  number({ min = -Infinity, max = Infinity, integer = false } = {}) {
    return (value, field) => {
      if (value === undefined || value === null || value === '') return undefined;
      const n = Number(value);
      if (!Number.isFinite(n)) throw `${field} must be a number.`;
      if (integer && !Number.isInteger(n)) {
        throw `${field} must be a whole number.`;
      }
      if (n < min) throw `${field} must be at least ${min}.`;
      if (n > max) throw `${field} must be at most ${max}.`;
      return n;
    };
  },

  boolean() {
    return (value, field) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'boolean') return value;
      const s = String(value).toLowerCase();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
      throw `${field} must be true or false.`;
    };
  },

  oneOf(allowed) {
    return (value, field) => {
      if (value === undefined || value === null) return undefined;
      const s = String(value);
      if (!allowed.includes(s)) {
        throw `${field} must be one of: ${allowed.join(', ')}.`;
      }
      return s;
    };
  },

  date() {
    return (value, field) => {
      if (value === undefined || value === null || value === '') return undefined;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) throw `${field} must be a valid date.`;
      return d;
    };
  },

  compose(...fns) {
    return (value, field) => {
      let out = value;
      for (const fn of fns) {
        const result = fn(out, field);
        if (result !== undefined) out = result;
      }
      return out;
    };
  },
};

/**
 * Validate req.body — the cleaned object is assigned to req.body.
 * (req.body is writable by default in Express.)
 */
export function validate(schema, { allowUnknown = true } = {}) {
  return (req, _res, next) => {
    try {
      const input = req.body ?? {};
      const output = clean(input, schema);
      if (allowUnknown) {
        for (const [k, v] of Object.entries(input)) {
          if (!(k in output)) output[k] = v;
        }
      }
      req.body = output;
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Validate req.query — the cleaned object is assigned to req.validatedQuery.
 * On Node 20+ req.query is a getter-only property, so we must not reassign it.
 */
export function validateQuery(schema, { allowUnknown = true } = {}) {
  return (req, _res, next) => {
    try {
      const input = req.query ?? {};
      const output = clean(input, schema);
      if (allowUnknown) {
        for (const [k, v] of Object.entries(input)) {
          if (!(k in output)) output[k] = v;
        }
      }
      req.validatedQuery = output;
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Run each field through its rule. First error aborts with 400.
 */
function clean(input, schema) {
  const output = {};
  for (const [field, rule] of Object.entries(schema)) {
    try {
      const value = rule(input[field], field);
      if (value !== undefined) output[field] = value;
    } catch (msg) {
      throw new AppError(String(msg), 400, 'VALIDATION');
    }
  }
  return output;
}

/**
 * Helper: get query params from the validated slot, falling back to raw query.
 * Use in controllers so they don't care which one exists.
 */
export function q(req) {
  return req.validatedQuery ?? req.query ?? {};
}