// src/controllers/feeStructures.controller.js
import * as fees from '../services/feeStructures.service.js';
import { q } from '../middleware/validate.js';

export async function list(req, res) {
  res.json({ structures: await fees.list(q(req)) });
}
export async function get(req, res) {
  res.json(await fees.get(req.params.id));
}
export async function create(req, res) {
  res.status(201).json(await fees.create(req.body));
}
export async function update(req, res) {
  res.json(await fees.update(req.params.id, req.body));
}
export async function remove(req, res) {
  res.json(await fees.remove(req.params.id));
}

// Items
export async function addItem(req, res) {
  res.status(201).json(await fees.addItem(req.params.id, req.body));
}
export async function updateItem(req, res) {
  res.json(await fees.updateItem(req.params.itemId, req.body));
}
export async function removeItem(req, res) {
  res.json(await fees.removeItem(req.params.itemId));
}

// Term amounts
export async function setTermAmount(req, res) {
  const { itemId, termId } = req.params;
  res.json(await fees.setTermAmount(itemId, termId, req.body.amount));
}
export async function removeTermAmount(req, res) {
  const { itemId, termId } = req.params;
  res.json(await fees.removeTermAmount(itemId, termId));
}