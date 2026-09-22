// src/services/invoices.service.js
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export async function list({ student_id, term_id, status, limit = 100, offset = 0 }) {
  const where = {};
  if (student_id) where.student_id = student_id;
  if (term_id) where.term_id = term_id;
  if (status) where.status = status;

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      items: true,
      student: {
        select: {
          id: true,
          admission_number: true,
          first_name: true,
          last_name: true,
          class_name: true,
          stream_name: true,
        },
      },
      term: {
        select: { id: true, term_name: true },
      },
    },
    orderBy: { created_at: 'desc' },
    take: Math.min(Number(limit) || 100, 500),
    skip: Number(offset) || 0,
  });

  return { invoices, total: invoices.length };
}

export async function get(id) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { created_at: 'asc' } },
      student: true,
      term: true,
      academic_year: true,
      fee_structure: true,
      payments: {
        orderBy: { created_at: 'desc' },
        include: {
          staff: { select: { id: true, full_name: true } },
        },
      },
    },
  });
  if (!invoice) throw new AppError('Invoice not found.', 404, 'NOT_FOUND');
  return invoice;
}

/**
 * All invoices for one student, newest term first.
 * This is what the Record screen calls when a student is picked.
 */
export async function forStudent(studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) throw new AppError('Student not found.', 404, 'STUDENT_NOT_FOUND');

  const invoices = await prisma.invoice.findMany({
    where: { student_id: studentId },
    include: {
      items: true,
      term: { select: { id: true, term_name: true, is_current: true } },
    },
    orderBy: [{ term: { start_date: 'desc' } }, { created_at: 'desc' }],
  });

  const totals = invoices.reduce(
    (acc, inv) => {
      acc.billed += Number(inv.total_amount);
      acc.paid += Number(inv.amount_paid);
      acc.balance += Number(inv.balance);
      return acc;
    },
    { billed: 0, paid: 0, balance: 0 }
  );

  return { invoices, totals };
}