// src/services/assignments.service.js
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { nextInvoiceNumber } from '../lib/receiptNumbers.js';

/**
 * Preview which students will be assigned, without creating anything.
 */
export async function preview({ fee_structure_id, term_id }) {
  const structure = await prisma.feeStructure.findUnique({
    where: { id: fee_structure_id },
    include: {
      items: {
        include: {
          term_items: { where: { term_id } },
        },
      },
    },
  });
  if (!structure) throw new AppError('Fee structure not found.', 404, 'STRUCTURE_NOT_FOUND');
  if (!structure.is_active) {
    throw new AppError('This fee structure is inactive.', 400, 'STRUCTURE_INACTIVE');
  }

  const term = await prisma.term.findUnique({ where: { id: term_id } });
  if (!term) throw new AppError('Term not found.', 404, 'TERM_NOT_FOUND');

  const itemsWithAmount = structure.items.filter((i) => i.term_items[0]?.amount);
  if (itemsWithAmount.length === 0) {
    throw new AppError(
      'This fee structure has no priced items for the selected term.',
      400,
      'NO_PRICED_ITEMS'
    );
  }

  const students = await prisma.student.findMany({
    where: {
      class_name: structure.class_name,
      student_type: structure.student_type,
      is_active: true,
    },
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
  });

  // Which of these already have an invoice for this (structure, term)?
  const existing = await prisma.invoice.findMany({
    where: {
      fee_structure_id: structure.id,
      term_id: term.id,
      student_id: { in: students.map((s) => s.id) },
    },
    select: { student_id: true },
  });
  const alreadyBilled = new Set(existing.map((e) => e.student_id));

  const perStudentTotal = itemsWithAmount.reduce(
    (sum, i) => sum + Number(i.term_items[0].amount),
    0
  );

  return {
    structure: {
      id: structure.id,
      name: structure.structure_name,
      class_name: structure.class_name,
      student_type: structure.student_type,
    },
    term: {
      id: term.id,
      name: term.term_name,
      academic_year_id: term.academic_year_id,
    },
    perStudentTotal,
    matchedStudents: students.length,
    alreadyBilled: alreadyBilled.size,
    willBeBilled: students.length - alreadyBilled.size,
    students: students.map((s) => ({
      id: s.id,
      admission_number: s.admission_number,
      name: `${s.first_name} ${s.last_name}`,
      class_name: s.class_name,
      stream_name: s.stream_name,
      opening_balance: Number(s.credit_balance ?? 0),
      already_billed: alreadyBilled.has(s.id),
    })),
  };
}

/**
 * Assign the fee structure to all matching students for the term.
 * Creates one invoice per student, with one invoice item per priced fee item.
 * Includes an "Opening balance" line if the student has credit_balance > 0.
 */
export async function assign({ fee_structure_id, term_id }, staffId) {
  const structure = await prisma.feeStructure.findUnique({
    where: { id: fee_structure_id },
    include: {
      items: {
        orderBy: { display_order: 'asc' },
        include: {
          term_items: { where: { term_id } },
        },
      },
    },
  });
  if (!structure) throw new AppError('Fee structure not found.', 404, 'STRUCTURE_NOT_FOUND');
  if (!structure.is_active) {
    throw new AppError('This fee structure is inactive.', 400, 'STRUCTURE_INACTIVE');
  }

  const term = await prisma.term.findUnique({ where: { id: term_id } });
  if (!term) throw new AppError('Term not found.', 404, 'TERM_NOT_FOUND');

  const pricedItems = structure.items.filter((i) => i.term_items[0]?.amount);
  if (pricedItems.length === 0) {
    throw new AppError(
      'This fee structure has no priced items for the selected term.',
      400,
      'NO_PRICED_ITEMS'
    );
  }

  const students = await prisma.student.findMany({
    where: {
      class_name: structure.class_name,
      student_type: structure.student_type,
      is_active: true,
    },
  });

  if (students.length === 0) {
    return {
      matched: 0,
      assigned: 0,
      skipped: 0,
      total_billed: 0,
      per_student_total: 0,
    };
  }

  // Skip students who already have an invoice from this structure for this term
  const existing = await prisma.invoice.findMany({
    where: {
      fee_structure_id: structure.id,
      term_id: term.id,
      student_id: { in: students.map((s) => s.id) },
    },
    select: { student_id: true },
  });
  const alreadyBilled = new Set(existing.map((e) => e.student_id));

  let assigned = 0;
  let skipped = 0;
  let totalBilled = 0;

  for (const student of students) {
    if (alreadyBilled.has(student.id)) {
      skipped++;
      continue;
    }

    const perStudentTotal = pricedItems.reduce(
      (sum, i) => sum + Number(i.term_items[0].amount),
      0
    );
    const openingBalance = Number(student.credit_balance ?? 0);
    const totalAmount = perStudentTotal + openingBalance;
// Inside assign(), for each student:
await prisma.$transaction(async (tx) => {
  const invoiceNumber = await nextInvoiceNumber(tx);

  const credit = Number(student.credit_balance ?? 0);
  const grossTotal = perStudentTotal + openingBalance;
  const appliedCredit = Math.min(credit, grossTotal);
  const netBalance = grossTotal - appliedCredit;

  // Create the invoice with the credit already applied
  const invoice = await tx.invoice.create({
    data: {
      invoice_number: invoiceNumber,
      student_id: student.id,
      academic_year_id: term.academic_year_id,
      term_id: term.id,
      fee_structure_id: structure.id,
      total_amount: grossTotal,
      amount_paid: appliedCredit,
      balance: netBalance,
      invoice_date: new Date(),
      due_date: term.end_date,
      status: netBalance <= 0 ? 'paid' : appliedCredit > 0 ? 'partial' : 'pending',
    },
  });

  // Invoice items: one per fee item
  for (const item of pricedItems) {
    const termItem = item.term_items[0];
    await tx.invoiceItem.create({
      data: {
        invoice_id: invoice.id,
        fee_item_id: item.id,
        term_fee_item_id: termItem.id,
        item_name: item.item_name,
        amount: Number(termItem.amount),
      },
    });
  }

  // Opening balance line (moving credit_balance onto the invoice)
  if (openingBalance > 0) {
    await tx.invoiceItem.create({
      data: {
        invoice_id: invoice.id,
        item_name: 'Opening balance',
        amount: openingBalance,
      },
    });
  }

  // Applied credit line (so the invoice itself shows why it's partially paid)
  if (appliedCredit > 0) {
    await tx.invoiceItem.create({
      data: {
        invoice_id: invoice.id,
        item_name: 'Credit applied',
        amount: -appliedCredit, // negative = reduces total
      },
    });
  }

  // Consume the credit on the student
  if (appliedCredit > 0) {
    await tx.student.update({
      where: { id: student.id },
      data: { credit_balance: credit - appliedCredit },
    });
  }

  // Zero out any opening balance that was folded into the invoice
  if (openingBalance > 0) {
    await tx.student.update({
      where: { id: student.id },
      data: { credit_balance: { decrement: openingBalance } },
    });
  }
});

    assigned++;
    totalBilled += totalAmount;
  }

  return {
    matched: students.length,
    assigned,
    skipped,
    per_student_total: pricedItems.reduce(
      (sum, i) => sum + Number(i.term_items[0].amount),
      0
    ),
    total_billed: totalBilled,
  };
}

/**
 * List assignments for a term (i.e. invoices created by assignments).
 */
export async function listForTerm({ term_id }) {
  const where = term_id ? { term_id } : {};
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
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
      fee_structure: {
        select: { id: true, structure_name: true, class_name: true, student_type: true },
      },
      items: true,
    },
    orderBy: { created_at: 'desc' },
    take: 500,
  });
  return invoices;
}