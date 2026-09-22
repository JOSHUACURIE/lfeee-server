// src/services/sync.service.js
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { applyPaymentToInvoice } from './payments.service.js';

/**
 * Server-side handler for a push from a device.
 * Applies the queued operation idempotently.
 *
 * Payload shape (from mobile):
 *   {
 *     entity_type: 'payment',
 *     entity_id:   '<client-generated uuid>',
 *     operation:   'create' | 'update',
 *     payload:     { ...payment fields },
 *     client_time: '<iso>'
 *   }
 */
export async function applyPush(
  { entity_type, entity_id, operation, payload, client_time },
  staffId
) {
  if (entity_type === 'payment') {
    return applyPayment(payload, entity_id, staffId, client_time, operation);
  }

  throw new AppError(`Unknown entity type: ${entity_type}`, 400, 'UNKNOWN_ENTITY');
}

// ---------------------------------------------------------------------------
// Payment push
// ---------------------------------------------------------------------------

async function applyPayment(payload, entityId, staffId, clientTime, operation) {
  const deviceId = payload.device_id ?? 'unknown';

  // Idempotency #1: has this exact operation already been applied?
  const existingLog = await prisma.syncLog.findUnique({
    where: {
      device_id_entity_type_entity_id_operation: {
        device_id: deviceId,
        entity_type: 'payment',
        entity_id: entityId,
        operation: operation ?? 'create',
      },
    },
  });
  if (existingLog) {
    return {
      status: 'already_applied',
      sync_log_id: existingLog.id,
      server_time: existingLog.server_time,
    };
  }

  // Idempotency #2: has a payment with this client_id already been recorded?
  if (payload.client_id) {
    const existingPayment = await prisma.payment.findUnique({
      where: { client_id: payload.client_id },
    });
    if (existingPayment) {
      await prisma.syncLog.create({
        data: {
          device_id: deviceId,
          staff_id: staffId,
          entity_type: 'payment',
          entity_id: entityId,
          operation: operation ?? 'create',
          client_time: new Date(clientTime),
          status: 'applied',
        },
      });
      return { status: 'already_applied', payment_id: existingPayment.id };
    }
  }

  // Resolve payment method id
  let paymentMethodId = payload.payment_method_id;
  if (!paymentMethodId && payload.payment_method) {
    const method = await prisma.paymentMethod.findUnique({
      where: { method_name: String(payload.payment_method).toLowerCase() },
    });
    if (!method) {
      throw new AppError(
        `Unknown payment method: ${payload.payment_method}`,
        400,
        'UNKNOWN_PAYMENT_METHOD'
      );
    }
    paymentMethodId = method.id;
  }
  if (!paymentMethodId) {
    throw new AppError('Payment method is required.', 400, 'MISSING_METHOD');
  }

  // Apply the payment — the shared service handles:
  //   - invoice settlement
  //   - overpayment going to student credit
  //   - receipt number collision
  const result = await prisma.$transaction(async (tx) => {
    const applied = await applyPaymentToInvoice({
      tx,
      invoiceId: payload.invoice_id ?? null,
      studentId: payload.student_id,
      amount: payload.amount,
      staffId,
      deviceId: payload.device_id ?? 'A1',
      clientId: payload.client_id,
      receiptNumber: payload.receipt_number,
      paymentMethodId,
      transactionRef: payload.transaction_ref,
      payerName: payload.payer_name,
      payerPhone: payload.payer_phone,
      notes: payload.notes,
      paymentDate: payload.payment_date,
    });

    await tx.syncLog.create({
      data: {
        device_id: deviceId,
        staff_id: staffId,
        entity_type: 'payment',
        entity_id: entityId,
        operation: operation ?? 'create',
        client_time: new Date(clientTime),
        status: 'applied',
      },
    });

    return applied;
  });

  return {
    status: 'applied',
    payment_id: result.payment.id,
    applied_to_invoice: result.applied_to_invoice,
    applied_to_credit: result.applied_to_credit,
    receipt_number: result.receipt_number,
  };
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/**
 * Server-side handler for a pull from a device.
 * Returns everything changed since `since`.
 */
export async function getChangesSince(sinceIso) {
  const since = sinceIso ? new Date(sinceIso) : new Date('1970-01-01');
  const serverTime = new Date();

  const [students, invoices] = await Promise.all([
    prisma.student.findMany({
      where: { updated_at: { gt: since } },
    }),
    prisma.invoice.findMany({
      where: { updated_at: { gt: since } },
      include: { items: true },
    }),
  ]);

  // Enrich students with computed balances so the client can show them offline.
  const ids = students.map((s) => s.id);
  let enriched = students;
  if (ids.length > 0) {
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
    enriched = students.map((s) => {
      const totals = byStudent.get(s.id) ?? { billed: 0, paid: 0, balance: 0 };
      return {
        ...s,
        // The billed amount the school has invoiced
        billed: totals.billed,
        // Payments that have been applied to invoices
        paid: totals.paid,
        // What the student still owes on their invoices
        balance: totals.balance,
        // Legacy debt carried forward (not yet folded into an invoice)
        opening_balance: Number(s.opening_balance ?? 0),
        // Overpayment credit accumulated
        credit_balance: Number(s.credit_balance ?? 0),
      };
    });
  }

  return {
    students: enriched,
    invoices,
    server_time: serverTime.toISOString(),
  };
}