// src/lib/receiptNumbers.js
import { prisma } from './prisma.js';

/**
 * Invoice numbers: INV-2025-00001
 * Receipt numbers: RCT-<DEVICE>-2025-00001
 *
 * Both formats are:
 *   - year-scoped (resets on 1 Jan)
 *   - zero-padded to 5 digits
 *   - unique at the DB level (the caller passes them into unique columns)
 *
 * Generation is done inside a transaction so concurrent saves never collide.
 * Postgres would also reject duplicates on the unique index, but this avoids
 * the round-trip error and the retry loop.
 */

function yearPrefix(date = new Date()) {
  return String(date.getFullYear());
}

function pad(n, width = 5) {
  return String(n).padStart(width, '0');
}

function firstDayOfYearIso(date = new Date()) {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Next invoice number for the current year.
 * Callable inside an existing $transaction by passing `tx`.
 */
export async function nextInvoiceNumber(tx = prisma) {
  const year = yearPrefix();
  const count = await tx.invoice.count({
    where: {
      created_at: { gte: firstDayOfYearIso() },
    },
  });
  return `INV-${year}-${pad(count + 1)}`;
}

/**
 * Next receipt number for the current year and a device code.
 * Devices use short codes like A1, A2, B1 so receipt numbers never collide
 * between two tablets that were both offline.
 * Callable inside an existing $transaction by passing `tx`.
 */
export async function nextReceiptNumber(deviceCode = 'A1', tx = prisma) {
  const year = yearPrefix();
  const prefix = `RCT-${deviceCode}-${year}-`;

  // Count how many receipts this device has issued this year.
  // We look for the highest existing sequence for this prefix, then +1.
  // That way, if some receipts were voided or deleted, we don't reuse a number.
  const last = await tx.payment.findFirst({
    where: {
      receipt_number: { startsWith: prefix },
    },
    orderBy: { receipt_number: 'desc' },
    select: { receipt_number: true },
  });

  let next = 1;
  if (last?.receipt_number) {
    const tail = last.receipt_number.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (Number.isFinite(parsed)) next = parsed + 1;
  }

  return `${prefix}${pad(next)}`;
}

/**
 * Convenience: build both numbers in one call, inside one transaction.
 * Use this from the payment recording service.
 *
 *   const { invoiceNumber, receiptNumber } = await buildNumbers({
 *     deviceCode: 'A1',
 *     needInvoice: true,
 *   });
 */
export async function buildNumbers({ deviceCode = 'A1', needInvoice = true } = {}) {
  return prisma.$transaction(async (tx) => {
    const receiptNumber = await nextReceiptNumber(deviceCode, tx);
    const invoiceNumber = needInvoice ? await nextInvoiceNumber(tx) : null;
    return { receiptNumber, invoiceNumber };
  });
}

/**
 * Whether a string looks like a receipt number this system produced.
 * Useful for validation before trusting a client-sent reference.
 */
export function isReceiptNumber(value) {
  return typeof value === 'string' && /^RCT-[A-Z0-9]{1,4}-\d{4}-\d{5}$/.test(value);
}

/**
 * Same for invoice numbers.
 */
export function isInvoiceNumber(value) {
  return typeof value === 'string' && /^INV-\d{4}-\d{5}$/.test(value);
}

/**
 * Extract the year from an INV-... or RCT-... string. Returns null if invalid.
 */
export function yearFromNumber(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/-(\d{4})-/);
  return m ? Number(m[1]) : null;
}