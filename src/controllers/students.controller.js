// src/controllers/students.controller.js
import * as studentsService from '../services/students.service.js';

export async function list(req, res) {
  const result = await studentsService.listStudents(req.query);
  res.json(result);
}

export async function get(req, res) {
  const student = await studentsService.getStudent(req.params.id);
  res.json(student);
}

export async function classes(req, res) {
  const list = await studentsService.listClasses();
  res.json({ classes: list });
}

export async function counts(req, res) {
  const result = await studentsService.counts(req.query);
  res.json(result);
}

export async function bulkUpsert(req, res) {
  const students = req.body?.students ?? req.body ?? [];
  const result = await studentsService.bulkUpsert(students);
  res.status(200).json(result);
}