// src/services/feeStructures.service.js
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export async function list({ academic_year_id }) {
  const where = academic_year_id ? { academic_year_id } : {};
  return prisma.feeStructure.findMany({
    where,
    orderBy: [{ class_name: 'asc' }, { student_type: 'asc' }],
    include: {
      items: {
        orderBy: { display_order: 'asc' },
        include: { term_items: { include: { term: true } } },
      },
      academic_year: true,
    },
  });
}

export async function get(id) {
  const s = await prisma.feeStructure.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { display_order: 'asc' },
        include: {
          term_items: { include: { term: true } },
        },
      },
      academic_year: true,
    },
  });
  if (!s) throw new AppError('Fee structure not found.', 404, 'NOT_FOUND');
  return s;
}

export async function create({
  structure_name,
  academic_year_id,
  class_name,
  student_type,
  description,
  is_active,
}) {
  const year = await prisma.academicYear.findUnique({ where: { id: academic_year_id } });
  if (!year) throw new AppError('School year not found.', 404, 'YEAR_NOT_FOUND');

  const existing = await prisma.feeStructure.findFirst({
    where: { academic_year_id, class_name, student_type },
  });
  if (existing) {
    throw new AppError(
      'A fee structure for that class and student type already exists this year.',
      409,
      'STRUCTURE_TAKEN'
    );
  }

  return prisma.feeStructure.create({
    data: {
      structure_name,
      academic_year_id,
      class_name,
      student_type,
      description: description ?? null,
      is_active: is_active !== false,
    },
  });
}

export async function update(id, data) {
  const s = await prisma.feeStructure.findUnique({ where: { id } });
  if (!s) throw new AppError('Fee structure not found.', 404, 'NOT_FOUND');

  return prisma.feeStructure.update({
    where: { id },
    data: {
      structure_name: data.structure_name,
      class_name: data.class_name,
      student_type: data.student_type,
      description: data.description,
      is_active: data.is_active,
    },
  });
}

export async function remove(id) {
  const s = await prisma.feeStructure.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true } } },
  });
  if (!s) throw new AppError('Fee structure not found.', 404, 'NOT_FOUND');
  if (s._count.invoices > 0) {
    throw new AppError(
      'This structure has invoices. Deactivate it instead of deleting.',
      400,
      'HAS_INVOICES'
    );
  }
  await prisma.feeStructure.delete({ where: { id } });
  return { ok: true };
}

// ---------- Items ----------

export async function addItem(structureId, { item_name, description, is_compulsory, display_order }) {
  const s = await prisma.feeStructure.findUnique({ where: { id: structureId } });
  if (!s) throw new AppError('Fee structure not found.', 404, 'NOT_FOUND');

  const dup = await prisma.feeItem.findFirst({
    where: { fee_structure_id: structureId, item_name },
  });
  if (dup) {
    throw new AppError('That item already exists in this structure.', 409, 'ITEM_TAKEN');
  }

  return prisma.feeItem.create({
    data: {
      fee_structure_id: structureId,
      item_name,
      description: description ?? null,
      is_compulsory: is_compulsory !== false,
      display_order: display_order ?? 0,
    },
  });
}

export async function updateItem(itemId, data) {
  const item = await prisma.feeItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError('Fee item not found.', 404, 'NOT_FOUND');

  return prisma.feeItem.update({
    where: { id: itemId },
    data: {
      item_name: data.item_name,
      description: data.description,
      is_compulsory: data.is_compulsory,
      display_order: data.display_order,
    },
  });
}

export async function removeItem(itemId) {
  const item = await prisma.feeItem.findUnique({
    where: { id: itemId },
    include: { _count: { select: { invoice_items: true } } },
  });
  if (!item) throw new AppError('Fee item not found.', 404, 'NOT_FOUND');
  if (item._count.invoice_items > 0) {
    throw new AppError(
      'This item is used on invoices. Remove those invoices first.',
      400,
      'HAS_INVOICES'
    );
  }
  await prisma.feeItem.delete({ where: { id: itemId } });
  return { ok: true };
}

// ---------- Term amounts ----------

export async function setTermAmount(itemId, termId, amount) {
  const item = await prisma.feeItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError('Fee item not found.', 404, 'NOT_FOUND');

  const term = await prisma.term.findUnique({ where: { id: termId } });
  if (!term) throw new AppError('Term not found.', 404, 'TERM_NOT_FOUND');

  return prisma.termFeeItem.upsert({
    where: { fee_item_id_term_id: { fee_item_id: itemId, term_id: termId } },
    update: { amount },
    create: { fee_item_id: itemId, term_id: termId, amount },
  });
}

export async function removeTermAmount(itemId, termId) {
  await prisma.termFeeItem.deleteMany({
    where: { fee_item_id: itemId, term_id: termId },
  });
  return { ok: true };
}