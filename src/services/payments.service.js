// src/services/payments.service.js
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { nextReceiptNumber } from '../lib/receiptNumbers.js';

/**
 * Apply a payment to an invoice.
 *
 * If the payment exceeds the invoice's remaining balance, the invoice is
 * settled and the excess goes onto the student's credit_balance.
 *
 * If no invoice_id is provided, the entire payment goes to credit.
 *
 * Must be called inside a Prisma transaction (`tx`) so the invoice and
 * student rows stay consistent.
 */
export async function applyPaymentToInvoice({
  tx,
  invoiceId,
  studentId,
  amount,
  staffId,
  deviceId = 'A1',
  clientId,
  receiptNumber: providedReceiptNumber,
  paymentMethodId,
  transactionRef,
  payerName,
  payerPhone,
  notes,
  paymentDate,
}) {
  const paymentAmount = Number(amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new AppError('Payment amount must be positive.', 400, 'BAD_AMOUNT');
  }

  // Validate student
  const student = await tx.student.findUnique({ where: { id: studentId } });
  if (!student) throw new AppError('Student not found.', 404, 'STUDENT_NOT_FOUND');

  // Resolve the invoice, if any
  let invoice = null;
  if (invoiceId) {
    invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      // The client sent an invoice_id we don't recognise.
      // Treat the payment as a credit-only deposit.
      invoice = null;
    } else if (invoice.student_id !== studentId) {
      throw new AppError(
        'That invoice does not belong to this student.',
        400,
        'INVOICE_MISMATCH'
      );
    }
  }

  // Receipt number — dedupe if the client sent one that's taken
  let receiptNumber = providedReceiptNumber;
  if (receiptNumber) {
    const clash = await tx.payment.findUnique({
      where: { receipt_number: receiptNumber },
    });
    if (clash) {
      receiptNumber = await nextReceiptNumber(deviceId, tx);
    }
  } else {
    receiptNumber = await nextReceiptNumber(deviceId, tx);
  }

  // ---------- Split logic ----------
  let appliedToInvoice = 0;
  let appliedToCredit = 0;

  if (invoice) {
    const invoiceTotal = Number(invoice.total_amount);
    const currentPaid = Number(invoice.amount_paid);
    const remaining = Math.max(invoiceTotal - currentPaid, 0);

    if (paymentAmount <= remaining) {
      // Fully absorbed by the invoice
      appliedToInvoice = paymentAmount;
      appliedToCredit = 0;
    } else {
      // Settle the invoice, rest goes to credit
      appliedToInvoice = remaining;
      appliedToCredit = paymentAmount - remaining;
    }
  } else {
    // No invoice — entire payment goes to credit
    appliedToInvoice = 0;
    appliedToCredit = paymentAmount;
  }

  // ---------- Write the payment row ----------
  const payment = await tx.payment.create({
    data: {
      client_id: clientId ?? null,
      device_id: deviceId,
      receipt_number: receiptNumber,
      student_id: studentId,
      invoice_id: invoice?.id ?? null,
      term_id: invoice?.term_id ?? null,
      amount: paymentAmount,
      payment_method_id: paymentMethodId,
      transaction_ref: transactionRef ?? null,
      payer_name: payerName ?? null,
      payer_phone: payerPhone ?? null,
      notes: notes ?? null,
      recorded_by: staffId,
      payment_date: paymentDate ? new Date(paymentDate) : new Date(),
      synced_at: new Date(),
    },
  });

  // ---------- Update the invoice, if any ----------
  if (invoice) {
    const newPaid = Number(invoice.amount_paid) + appliedToInvoice;
    const newBalance = Math.max(Number(invoice.total_amount) - newPaid, 0);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amount_paid: newPaid,
        balance: newBalance,
        status: newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending',
      },
    });
  }

  // ---------- Update the student's credit if there's an excess ----------
  if (appliedToCredit > 0) {
    await tx.student.update({
      where: { id: studentId },
      data: {
        credit_balance: {
          increment: appliedToCredit,
        },
      },
    });
  }

  return {
    payment,
    applied_to_invoice: appliedToInvoice,
    applied_to_credit: appliedToCredit,
    receipt_number: receiptNumber,
  };
}

/**
 * Record a payment with optional invoice application.
 * Wraps the apply call in a transaction and returns a summary.
 */
export async function recordPayment(input, staffId) {
  return prisma.$transaction(async (tx) => {
    return applyPaymentToInvoice({
      tx,
      staffId,
      invoiceId: input.invoice_id ?? input.invoiceId ?? null,
      studentId: input.student_id ?? input.studentId,
      amount: input.amount,
      deviceId: input.device_id ?? input.deviceId ?? 'A1',
      clientId: input.client_id ?? input.clientId ?? null,
      receiptNumber: input.receipt_number ?? input.receiptNumber ?? null,
      paymentMethodId: input.payment_method_id ?? input.paymentMethodId ?? null,
      transactionRef: input.transaction_ref ?? input.transactionRef ?? null,
      payerName: input.payer_name ?? input.payerName ?? null,
      payerPhone: input.payer_phone ?? input.payerPhone ?? null,
      notes: input.notes,
      paymentDate: input.payment_date ?? input.paymentDate ?? null,
    });
  });
}

/**
 * List payments with filters.
 */
export async function listPayments({ student_id, from, to, limit = 100, offset = 0 }) {
  const where = {};
  if (student_id) where.student_id = student_id;
  if (from || to) {
    where.payment_date = {};
    if (from) where.payment_date.gte = new Date(from);
    if (to) where.payment_date.lte = new Date(to);
  }

  return prisma.payment.findMany({
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
      invoice: {
        select: { id: true, invoice_number: true, term_id: true },
      },
    },
    orderBy: { created_at: 'desc' },
    take: Math.min(Number(limit) || 100, 500),
    skip: Number(offset) || 0,
  });
}