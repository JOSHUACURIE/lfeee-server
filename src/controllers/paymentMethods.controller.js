// src/controllers/paymentMethods.controller.js
import * as methods from '../services/paymentMethods.service.js';

export async function list(_req, res) {
  res.json({ methods: await methods.list() });
}
export async function create(req, res) {
  res.status(201).json(await methods.create(req.body));
}
export async function update(req, res) {
  res.json(await methods.update(req.params.id, req.body));
}