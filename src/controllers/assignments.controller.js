// src/controllers/assignments.controller.js
import * as assignments from '../services/assignments.service.js';
import { q } from '../middleware/validate.js';

export async function preview(req, res) {
  const result = await assignments.preview(req.body);
  res.json(result);
}

export async function assign(req, res) {
  const result = await assignments.assign(req.body, req.staff.id);
  res.status(201).json(result);
}

export async function listForTerm(req, res) {
  const result = await assignments.listForTerm(q(req));
  res.json({ invoices: result });
}