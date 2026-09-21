// src/services/academic.service.js
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

// ---------- Years ----------

export async function listYears() {
  return prisma.academicYear.findMany({
    orderBy: [{ start_date: 'desc' }],
    include: {
      _count: { select: { terms: true, structures: true } },
    },
  });
}

export async function createYear({ year_name, start_date, end_date, is_current }) {
  const existing = await prisma.academicYear.findUnique({ where: { year_name } });
  if (existing) {
    throw new AppError('That school year already exists.', 409, 'YEAR_TAKEN');
  }

  return prisma.$transaction(async (tx) => {
    if (is_current) {
      await tx.academicYear.updateMany({
        where: { is_current: true },
        data: { is_current: false },
      });
    }
    return tx.academicYear.create({
      data: {
        year_name,
        start_date,
        end_date,
        is_current: Boolean(is_current),
      },
    });
  });
}

export async function updateYear(id, { year_name, start_date, end_date }) {
  const year = await prisma.academicYear.findUnique({ where: { id } });
  if (!year) throw new AppError('School year not found.', 404, 'NOT_FOUND');

  return prisma.academicYear.update({
    where: { id },
    data: { year_name, start_date, end_date },
  });
}

export async function deleteYear(id) {
  const year = await prisma.academicYear.findUnique({
    where: { id },
    include: { _count: { select: { terms: true } } },
  });
  if (!year) throw new AppError('School year not found.', 404, 'NOT_FOUND');
  if (year._count.terms > 0) {
    throw new AppError(
      'This year has terms. Delete the terms first.',
      400,
      'HAS_CHILDREN'
    );
  }
  await prisma.academicYear.delete({ where: { id } });
  return { ok: true };
}

export async function setCurrentYear(id) {
  const year = await prisma.academicYear.findUnique({ where: { id } });
  if (!year) throw new AppError('School year not found.', 404, 'NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    await tx.academicYear.updateMany({
      where: { is_current: true },
      data: { is_current: false },
    });
    return tx.academicYear.update({
      where: { id },
      data: { is_current: true },
    });
  });
}

// ---------- Terms ----------

export async function listTerms({ academic_year_id }) {
  const where = academic_year_id ? { academic_year_id } : {};
  return prisma.term.findMany({
    where,
    orderBy: [{ start_date: 'asc' }],
    include: { academic_year: true },
  });
}

export async function createTerm({
  academic_year_id,
  term_name,
  start_date,
  end_date,
  is_current,
}) {
  const year = await prisma.academicYear.findUnique({ where: { id: academic_year_id } });
  if (!year) throw new AppError('School year not found.', 404, 'YEAR_NOT_FOUND');

  const existing = await prisma.term.findFirst({
    where: { academic_year_id, term_name },
  });
  if (existing) {
    throw new AppError('That term already exists in this year.', 409, 'TERM_TAKEN');
  }

  return prisma.$transaction(async (tx) => {
    if (is_current) {
      await tx.term.updateMany({
        where: { is_current: true },
        data: { is_current: false },
      });
    }
    return tx.term.create({
      data: {
        academic_year_id,
        term_name,
        start_date,
        end_date,
        is_current: Boolean(is_current),
      },
    });
  });
}

export async function updateTerm(id, { term_name, start_date, end_date }) {
  const term = await prisma.term.findUnique({ where: { id } });
  if (!term) throw new AppError('Term not found.', 404, 'NOT_FOUND');

  return prisma.term.update({
    where: { id },
    data: { term_name, start_date, end_date },
  });
}

export async function deleteTerm(id) {
  const term = await prisma.term.findUnique({
    where: { id },
    include: { _count: { select: { term_items: true, invoices: true } } },
  });
  if (!term) throw new AppError('Term not found.', 404, 'NOT_FOUND');
  if (term._count.invoices > 0) {
    throw new AppError(
      'This term has invoices. It cannot be deleted.',
      400,
      'HAS_INVOICES'
    );
  }
  await prisma.term.delete({ where: { id } });
  return { ok: true };
}

export async function setCurrentTerm(id) {
  const term = await prisma.term.findUnique({ where: { id } });
  if (!term) throw new AppError('Term not found.', 404, 'NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    await tx.term.updateMany({
      where: { is_current: true },
      data: { is_current: false },
    });
    const updated = await tx.term.update({
      where: { id },
      data: { is_current: true },
    });
    // Ensure its year is marked current too
    await tx.academicYear.updateMany({
      where: { is_current: true, id: { not: term.academic_year_id } },
      data: { is_current: false },
    });
    await tx.academicYear.update({
      where: { id: term.academic_year_id },
      data: { is_current: true },
    });
    return updated;
  });
}