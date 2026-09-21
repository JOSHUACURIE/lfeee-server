// src/middleware/validate.js
import { AppError } from './errorHandler.js';

/**
 * A rule is a function that takes a value and either:
 *   - returns the cleaned value, or
 *   - throws a string describing what's wrong.
 *
 * Pre-built rules below cover the common cases. Compose them with `v.rules([...])`
 * or by writing your own.
 */
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
      if (!Number.isFinite(n)) {
        throw `${field} must be a number.`;
      }
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
      if (Number.isNaN(d.getTime())) {
        throw `${field} must be a valid date.`;
      }
      return d;
    };
  },

  /**
   * Compose several rules for the same field.
   * The first rule that returns a value wins; others still validate.
   *   rules.compose(rules.string({ trim: true }), rules.oneOf(['cash', 'mpesa']))
   */
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
 * Validate req.body against a schema.
 *
 *   const schema = {
 *     email: rules.email(),
 *     password: rules.string({ min: 6 }),
 *     role: rules.oneOf(['admin', 'bursar']),
 *   };
 *   router.post('/login', validate(schema), handler);
 *
 * The cleaned object is assigned back to req.body.
 * Any rule that throws aborts with 400 and a clear message.
 */
export function validate(schema, { source = 'body', allowUnknown = true } = {}) {
  return (req, _res, next) => {
    try {
      const input = req[source] ?? {};
      const output = {};

      for (const [field, rule] of Object.entries(schema)) {
        try {
          const cleaned = rule(input[field], field);
          if (cleaned !== undefined) output[field] = cleaned;
        } catch (msg) {
          throw new AppError(String(msg), 400, 'VALIDATION');
        }
      }

      if (allowUnknown) {
        for (const [k, v] of Object.entries(input)) {
          if (!(k in output)) output[k] = v;
        }
      }

      req[source] = output;
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Validate req.query with the same rules.
 *   router.get('/', validateQuery({ term_id: rules.uuid() }), handler);
 */
export function validateQuery(schema) {
  return validate(schema, { source: 'query', allowUnknown: true });
}