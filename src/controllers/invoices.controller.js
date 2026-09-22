// src/controllers/invoices.controller.js
import * as invoices from '../services/invoices.service.js';
import { q } from '../middleware/validate.js';

export async function list(req, res) {
  const result = await invoices.list(q(req));
  res.json(result);
}

export async function get(req, res) {
  const result = await invoices.get(req.params.id);
  res.json(result);
}

export async function forStudent(req, res) {
  const result = await invoices.forStudent(req.params.id);
  res.json(result);
}