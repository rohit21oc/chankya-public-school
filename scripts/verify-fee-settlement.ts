/**
 * Offline checks for paying a child's whole balance online: how a payment is spread over bills, and the
 * receipt PDF. No server, no network.   npx tsx scripts/verify-fee-settlement.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MIN_ONLINE_PAYMENT_PAISE,
  allocatePayment,
  billPendingPaise,
  openBillsOldestFirst,
  toPaise,
  toRupees,
  totalPendingPaise,
} from '../server/services/feeSettlement';
import { buildFeeReceiptPdf, feeReceiptFileName, receiptLines } from '../server/services/feeReceiptPdf';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('PASS', name); };

const bill = (id: string, dueDate: string | undefined, pending: number | undefined, extra: any = {}) =>
  ({ id, studentId: 's1', dueDate, pendingAmount: pending, ...extra });

// ---------- what is owed ----------
t('pending comes from pendingAmount, else total minus paid, never negative', () => {
  assert.equal(billPendingPaise(bill('a', '2026-01-01', 2250)), 225000);
  assert.equal(billPendingPaise({ id: 'b', total: 3000, paidAmount: 1200.5 } as any), 179950);
  assert.equal(billPendingPaise({ id: 'c', amount: 500, paidAmount: 900 } as any), 0);
  assert.equal(billPendingPaise(bill('d', '2026-01-01', 0)), 0);
  assert.equal(billPendingPaise({ id: 'e' } as any), 0);
});
t('paise arithmetic does not drift (0.1 + 0.2 style sums)', () => {
  assert.equal(toPaise(0.1) + toPaise(0.2), toPaise(0.3));
  assert.equal(toPaise(1234.565), 123457); // rounds, never 123456.49999
  assert.equal(toRupees(123457), 1234.57);
  assert.equal(totalPendingPaise([bill('a', 'x', 0.1), bill('b', 'x', 0.2)]), 30);
});

// ---------- which bills, in what order ----------
const bills = [
  bill('oct', '2026-10-10', 3350),
  bill('apr', '2026-04-10', 2250),
  bill('paid', '2026-05-10', 0),
  bill('nodate', undefined, 100),
  bill('jul', '2026-07-10', 2250),
  bill('other-child', '2026-01-01', 999, { studentId: 's2' }),
  bill('jul', '2026-07-10', 2250), // duplicate row of the same bill
];
t('only this child\'s unpaid bills, each once, oldest due date first, undated last', () => {
  assert.deepEqual(openBillsOldestFirst(bills, 's1').map((b) => b.id), ['apr', 'jul', 'oct', 'nodate']);
});
t('same due date falls back to creation time, then id (stable order)', () => {
  const same = [
    bill('z', '2026-01-01', 10, { createdAt: '2026-01-02' }),
    bill('b', '2026-01-01', 10, { createdAt: '2026-01-01' }),
    bill('a', '2026-01-01', 10, { createdAt: '2026-01-01' }),
  ];
  assert.deepEqual(openBillsOldestFirst(same, 's1').map((b) => b.id), ['a', 'b', 'z']);
});
t('the total asked for is the sum of the open bills only', () => {
  assert.equal(totalPendingPaise(openBillsOldestFirst(bills, 's1')), toPaise(2250 + 2250 + 3350 + 100));
});

// ---------- spreading a payment ----------
const open = openBillsOldestFirst(bills, 's1');
const total = totalPendingPaise(open);
t('paying the full balance clears every bill and leaves nothing over', () => {
  const r = allocatePayment(open, total);
  assert.equal(r.allocations.length, 4);
  assert.equal(r.unallocatedPaise, 0);
  assert.ok(r.allocations.every((a) => a.pendingAfterPaise === 0 && a.paidPaise === a.pendingBeforePaise));
  assert.equal(r.allocations.reduce((s, a) => s + a.paidPaise, 0), total);
});
t('a payment smaller than the balance fills the oldest bills first', () => {
  const r = allocatePayment(open, toPaise(2250 + 1000));
  assert.deepEqual(r.allocations.map((a) => [a.ledgerId, a.paidPaise, a.pendingAfterPaise]), [['apr', 225000, 0], ['jul', 100000, 125000]]);
  assert.equal(r.unallocatedPaise, 0);
});
t('a payment larger than the balance clears the bills and reports the rest instead of losing it', () => {
  const r = allocatePayment(open, total + 5000);
  assert.equal(r.allocations.reduce((s, a) => s + a.paidPaise, 0), total);
  assert.equal(r.unallocatedPaise, 5000);
});
t('nothing to allocate when no bill is open or the payment is zero', () => {
  assert.deepEqual(allocatePayment([], 100000), { allocations: [], unallocatedPaise: 100000 });
  assert.deepEqual(allocatePayment(open, 0), { allocations: [], unallocatedPaise: 0 });
  assert.deepEqual(allocatePayment(open, -50), { allocations: [], unallocatedPaise: 0 });
});
t('the online minimum is one rupee', () => assert.equal(MIN_ONLINE_PAYMENT_PAISE, 100));

// ---------- receipt PDF ----------
const school = { schoolName: 'Test Residential School', schoolAddress: 'Sheohar, Bihar', affiliatedBoard: 'CBSE', affiliationNumber: '10030206405' };
const full: any = {
  receiptNumber: 'REC-2026-0099',
  studentName: 'ROHIT KUMAR',
  admissionNumber: 'ADM-001',
  className: 'Class 1',
  section: 'A',
  academicSession: '2026-2027',
  amount: 11250,
  feeType: 'Full Settlement of All Outstanding Dues (5 Bills)',
  paymentMethod: 'ONLINE',
  transactionReference: 'OM2610231234TESTREF',
  gateway: 'PHONEPE',
  onlinePaymentMode: 'UPI_INTENT',
  paymentDate: '2026-10-23',
  collectedBy: 'PhonePe Online',
  balanceDue: 0,
  breakdown: ['April 2026', 'May 2026', 'June 2026', 'July 2026', 'August 2026'].map((head) => ({ head, amount: 2250 })),
};
const pdfText = (bytes: Buffer): string => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rcpt-')), 'r.pdf');
  fs.writeFileSync(f, bytes);
  try { return execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }); } catch { return ''; }
};
t('receipt lines come from the breakdown, else one line for the payment', () => {
  assert.equal(receiptLines(full).length, 5);
  assert.deepEqual(receiptLines({ amount: 700, feeType: 'Tuition', feeMonth: 'Tuition' } as any), [{ head: 'Tuition', amount: 700 }]);
  assert.deepEqual(receiptLines({ amount: 700 } as any), [{ head: 'School fee', amount: 700 }]);
});
t('file name is safe and carries the receipt number', () => {
  assert.equal(feeReceiptFileName(full), 'Fee-Receipt-REC-2026-0099.pdf');
  assert.equal(feeReceiptFileName({ receiptNumber: '../../etc/passwd' } as any), 'Fee-Receipt-etcpasswd.pdf');
});
t('a full-settlement receipt is a real one-page A4 PDF listing every bill, the total and the reference', () => {
  const bytes = buildFeeReceiptPdf(full, school);
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const text = pdfText(bytes);
  assert.ok(text.length > 0, 'pdftotext produced nothing');
  for (const want of ['FEE RECEIPT', 'Test Residential School', 'REC-2026-0099', 'ROHIT KUMAR', 'ADM-001', 'OM2610231234TESTREF', 'Online - PhonePe (UPI)',
    'April 2026', 'May 2026', 'June 2026', 'July 2026', 'August 2026', '11,250.00', 'Eleven Thousand Two Hundred Fifty Rupees Only', 'No balance is due']) {
    assert.ok(text.includes(want), `missing "${want}" in:\n${text}`);
  }
  assert.equal((text.match(/\f/g) || []).length, 1, 'receipt should fit on one page');
});
t('an ordinary payment (no breakdown, with fine and concession, balance left) prints correctly', () => {
  const text = pdfText(buildFeeReceiptPdf({ receiptNumber: 'REC-2026-0100', studentName: 'A B', amount: 1000, feeType: 'Tuition', feeMonth: 'July 2026', paymentMethod: 'CASH', paymentDate: '2026-07-01', fine: 50, discount: 20, balanceDue: 1250 }, school));
  for (const want of ['Tuition - July 2026', 'Cash', 'Late fee', 'Concession', 'Balance still due after this payment: Rs. 1,250.00']) assert.ok(text.includes(want), `missing "${want}"`);
});
t('a payment with no optional fields still produces a PDF', () => {
  const bytes = buildFeeReceiptPdf({ receiptNumber: 'X', amount: 1 } as any, {});
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
});

console.log(`\n${n} checks passed`);
