// src/controllers/academic.controller.js
import * as academic from '../services/academic.service.js';
import { q } from '../middleware/validate.js';

// Years
export async function listYears(_req, res) {
  res.json({ years: await academic.listYears() });
}
export async function createYear(req, res) {
  res.status(201).json(await academic.createYear(req.body));
}
export async function updateYear(req, res) {
  res.json(await academic.updateYear(req.params.id, req.body));
}
export async function deleteYear(req, res) {
  res.json(await academic.deleteYear(req.params.id));
}
export async function setCurrentYear(req, res) {
  res.json(await academic.setCurrentYear(req.params.id));
}

// Terms
export async function listTerms(req, res) {
  res.json({ terms: await academic.listTerms(q(req)) });
}
export async function createTerm(req, res) {
  res.status(201).json(await academic.createTerm(req.body));
}
export async function updateTerm(req, res) {
  res.json(await academic.updateTerm(req.params.id, req.body));
}
export async function deleteTerm(req, res) {
  res.json(await academic.deleteTerm(req.params.id));
}
export async function setCurrentTerm(req, res) {
  res.json(await academic.setCurrentTerm(req.params.id));
}