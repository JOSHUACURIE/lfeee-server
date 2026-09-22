// src/services/paymentMethods.service.js
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const DEFAULTS = [
  { method_name: 'cash',   display_name: 'Cash' },
  { method_name: 'mpesa',  display_name: 'M-Pesa' },
  { method_name: 'bank',   display_name: 'Bank transfer' },
  { method_name: 'cheque', display_name: 'Cheque' },
];

export async function list() {
  let rows = await prisma.paymentMethod.findMany({
    orderBy: [{ method_name: 'asc' }],
  });

  // Seed defaults on first call so the mobile app always has something.
  if (rows.length === 0) {
    await prisma.paymentMethod.createMany({ data: DEFAULTS });
    rows = await prisma.paymentMethod.findMany({
      orderBy: [{ method_name: 'asc' }],
    });
  }

  return rows;
}

export async function create({ method_name, display_name, is_active }) {
  const existing = await prisma.paymentMethod.findUnique({
    where: { method_name },
  });
  if (existing) throw new AppError('That method already exists.', 409, 'TAKEN');

  return prisma.paymentMethod.create({
    data: {
      method_name,
      display_name,
      is_active: is_active !== false,
    },
  });
}

export async function update(id, data) {
  const m = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!m) throw new AppError('Payment method not found.', 404, 'NOT_FOUND');

  return prisma.paymentMethod.update({
    where: { id },
    data: {
      display_name: data.display_name,
      is_active: data.is_active,
    },
  });
}