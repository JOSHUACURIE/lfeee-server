// src/services/students.service.js
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

function buildWhere({ q, class_name, student_type, is_active }) {
  const where = {};

  if (is_active === 'true' || is_active === true) where.is_active = true;
  if (is_active === 'false' || is_active === false) where.is_active = false;

  if (class_name) where.class_name = class_name;
  if (student_type) where.student_type = student_type;

  if (q && String(q).trim()) {
    const term = String(q).trim();
    where.OR = [
      { first_name: { contains: term, mode: 'insensitive' } },
      { last_name: { contains: term, mode: 'insensitive' } },
      { admission_number: { contains: term, mode: 'insensitive' } },
      { class_name: { contains: term, mode: 'insensitive' } },
    ];
  }

  return where;
}

export async function listStudents(params = {}) {
  const {
    q,
    class_name,
    student_type,
    is_active = 'true',
    with_balance,
    limit = 500,
    offset = 0,
  } = params;

  const where = buildWhere({ q, class_name, student_type, is_active });

  const students = await prisma.student.findMany({
    where,
    orderBy: [{ class_name: 'asc' }, { last_name: 'asc' }, { first_name: 'asc' }],
    take: Math.min(Number(limit) || 500, 2000),
    skip: Number(offset) || 0,
  });

  if (with_balance !== 'true' && with_balance !== true) {
    return { students, total: students.length };
  }

  const ids = students.map((s) => s.id);
  if (ids.length === 0) {
    return { students: [], total: 0 };
  }

  const agg = await prisma.invoice.groupBy({
    by: ['student_id'],
    where: { student_id: { in: ids } },
    _sum: { total_amount: true, amount_paid: true, balance: true },
  });

  const byStudent = new Map();
  for (const row of agg) {
    byStudent.set(row.student_id, {
      billed: Number(row._sum.total_amount ?? 0),
      paid: Number(row._sum.amount_paid ?? 0),
      balance: Number(row._sum.balance ?? 0),
    });
  }

  const enriched = students.map((s) => {
    const totals = byStudent.get(s.id) ?? { billed: 0, paid: 0, balance: 0 };
    const openingBalance = Number(s.opening_balance ?? 0);
    const creditBalance = Number(s.credit_balance ?? 0);
    const net = openingBalance + totals.balance - creditBalance;

    return {
      ...s,
      billed: totals.billed,
      paid: totals.paid,
      balance: Math.max(net, 0),
      credit: Math.max(-net, 0),
      opening_balance: openingBalance,
      credit_balance: creditBalance,
    };
  });

  return { students: enriched, total: enriched.length };
}

export async function getStudent(id) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      invoices: {
        orderBy: [{ invoice_date: 'desc' }],
        include: { items: true, term: true },
      },
      payments: {
        orderBy: [{ created_at: 'desc' }],
        take: 50,
      },
    },
  });

  if (!student) {
    throw new AppError('Student not found.', 404, 'NOT_FOUND');
  }

  const invoiceTotals = student.invoices.reduce(
    (acc, inv) => {
      acc.billed += Number(inv.total_amount);
      acc.paid += Number(inv.amount_paid);
      acc.balance += Number(inv.balance);
      return acc;
    },
    { billed: 0, paid: 0, balance: 0 }
  );

  const openingBalance = Number(student.opening_balance ?? 0);
  const creditBalance = Number(student.credit_balance ?? 0);
  const net = openingBalance + invoiceTotals.balance - creditBalance;

  const totals = {
    billed: invoiceTotals.billed,
    paid: invoiceTotals.paid,
    balance: Math.max(net, 0),
    credit: Math.max(-net, 0),
    opening_balance: openingBalance,
    credit_balance: creditBalance,
  };

  return { ...student, totals };
}

export async function listClasses() {
  const rows = await prisma.student.findMany({
    where: { is_active: true, class_name: { not: null } },
    select: { class_name: true },
    distinct: ['class_name'],
    orderBy: { class_name: 'asc' },
  });
  return rows.map((r) => r.class_name).filter(Boolean);
}

export async function counts(params = {}) {
  const where = buildWhere({
    q: params.q,
    class_name: params.class_name,
    student_type: params.student_type,
    is_active: 'true',
  });

  const students = await prisma.student.findMany({
    where,
    select: { id: true, opening_balance: true, credit_balance: true },
  });

  const ids = students.map((s) => s.id);
  if (ids.length === 0) {
    return { all: 0, owing: 0, cleared: 0, credit: 0, unbilled: 0 };
  }

  const agg = await prisma.invoice.groupBy({
    by: ['student_id'],
    where: { student_id: { in: ids } },
    _sum: { total_amount: true, balance: true },
  });

  const byStudent = new Map();
  for (const r of agg) {
    byStudent.set(r.student_id, {
      billed: Number(r._sum.total_amount ?? 0),
      balance: Number(r._sum.balance ?? 0),
    });
  }

  let owing = 0;
  let cleared = 0;
  let credit = 0;
  let unbilled = 0;

  for (const s of students) {
    const totals = byStudent.get(s.id) ?? { billed: 0, balance: 0 };
    const opening = Number(s.opening_balance ?? 0);
    const creditBal = Number(s.credit_balance ?? 0);
    const net = opening + totals.balance - creditBal;

    if (totals.billed === 0 && opening === 0) {
      unbilled++;
    } else if (net < 0) {
      credit++;
    } else if (net > 0) {
      owing++;
    } else {
      cleared++;
    }
  }

  return {
    all: students.length,
    owing,
    cleared,
    credit,
    unbilled,
  };
}

export async function bulkUpsert(students) {
  if (!Array.isArray(students) || students.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  let inserted = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const s of students) {
      if (!s.admission_number || !s.first_name || !s.last_name) continue;

      const existing = await tx.student.findUnique({
        where: { admission_number: s.admission_number },
        select: { id: true },
      });

      // Mapping rule:
      //   If the source explicitly provides opening_balance, use it.
      //   Otherwise, treat a legacy credit_balance as the opening balance.
      const openingBalance =
        s.opening_balance !== undefined
          ? Number(s.opening_balance)
          : Number(s.credit_balance ?? 0);

      const creditBalance =
        s.opening_balance !== undefined
          ? Number(s.credit_balance ?? 0)
          : 0;

      const data = {
        admission_number: s.admission_number,
        first_name: s.first_name,
        last_name: s.last_name,
        class_name: s.class_name ?? null,
        stream_name: s.stream_name ?? null,
        student_type: s.student_type ?? 'day_scholar',
        opening_balance: openingBalance,
        credit_balance: creditBalance,
        is_active: s.is_active ?? true,
        external_id: s.external_id ?? null,
      };

      if (existing) {
        await tx.student.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await tx.student.create({ data });
        inserted++;
      }
    }
  });

  return { inserted, updated, total: inserted + updated };
}