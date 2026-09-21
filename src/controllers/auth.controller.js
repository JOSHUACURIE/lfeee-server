// src/controllers/auth.controller.js
import * as authService from '../services/auth.service.js';

export async function register(req, res) {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function login(req, res) {
  const result = await authService.login(req.body);
  res.json(result);
}

export async function forgotPassword(req, res) {
  const result = await authService.forgotPassword(req.body.email);
  res.json(result);
}

export async function resetPassword(req, res) {
  const result = await authService.resetPassword(req.body);
  res.json(result);
}

export async function me(req, res) {
  const result = await authService.me(req.staff.id);
  res.json(result);
}

export async function updateProfile(req, res) {
  const result = await authService.updateProfile(req.staff.id, req.body);
  res.json(result);
}

export async function changePassword(req, res) {
  const result = await authService.changePassword(req.staff.id, req.body);
  res.json(result);
}

export async function registerDevice(req, res) {
  const result = await authService.registerDevice(req.staff.id, req.body.device_code);
  res.json(result);
}