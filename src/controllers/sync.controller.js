// src/controllers/sync.controller.js
import * as syncService from '../services/sync.service.js';
import { q } from '../middleware/validate.js';

export async function push(req, res) {
  const result = await syncService.applyPush(req.body, req.staff.id);
  res.json(result);
}

export async function pull(req, res) {
  const since = q(req).since || null;
  const result = await syncService.getChangesSince(since);
  res.json(result);
}

export async function bootstrap(_req, res) {
  // Full dataset for a fresh device. Same as pull from epoch.
  const result = await syncService.getChangesSince(null);
  res.json(result);
}

export async function heartbeat(_req, res) {
  res.json({ ok: true, server_time: new Date().toISOString() });
}