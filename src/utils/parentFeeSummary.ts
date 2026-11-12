/**
 * One fee summary for a student, used by every parent-facing screen (Dashboard,
 * My Children, Fees) so the same child never shows two different balances.
 *
 * Source of truth is the fee ledger (Rules.md §10): each ledger row carries its own
 * total, paid and pending amounts, including late fees and concessions. Fee
 * structures are NOT used here: parents cannot read them, and a structure total
 * minus payments ignores late fees, concessions and enrolment-month rules.
 */

export interface LedgerLike {
  amount?: number | string;
  total?: number | string;
  totalAmount?: number | string;
  fine?: number | string;
  paidAmount?: number | string;
  pendingAmount?: number | string;
  status?: string;
  dueDate?: string;
  monthYear?: string;
  feeMonth?: string;
}

export interface PaymentLike {
  amount?: number | string;
}

export interface StudentFeeSummary {
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  overdue: number;
  overdueCount: number;
  currentMonthDue: number;
  ledgerCount: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function ledgerTotal(l: LedgerLike): number {
  if (l.total !== undefined && l.total !== null && l.total !== '') return num(l.total);
  if (l.totalAmount !== undefined && l.totalAmount !== null && l.totalAmount !== '') return num(l.totalAmount);
  return num(l.amount) + num(l.fine);
}

export function ledgerPending(l: LedgerLike): number {
  if (l.pendingAmount !== undefined && l.pendingAmount !== null && l.pendingAmount !== '') {
    return Math.max(0, num(l.pendingAmount));
  }
  return Math.max(0, ledgerTotal(l) - num(l.paidAmount));
}

/** Calendar date (YYYY-MM-DD) in Asia/Kolkata, the school's billing timezone. */
export function kolkataDate(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist.toISOString().substring(0, 10);
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function summarizeStudentFees(
  ledgers: LedgerLike[] | null | undefined,
  payments: PaymentLike[] | null | undefined,
  now: Date = new Date()
): StudentFeeSummary {
  const rows = Array.isArray(ledgers) ? ledgers : [];
  const pays = Array.isArray(payments) ? payments : [];
  const today = kolkataDate(now);
  const monthPrefix = today.substring(0, 7);
  const monthShort = MONTHS_SHORT[Number(today.substring(5, 7)) - 1];
  const year = today.substring(0, 4);

  const totalBilled = rows.reduce((s, l) => s + ledgerTotal(l), 0);
  const paidFromPayments = pays.reduce((s, p) => s + num(p.amount), 0);
  const paidFromLedgers = rows.reduce((s, l) => s + num(l.paidAmount), 0);
  const totalPaid = Math.max(paidFromPayments, paidFromLedgers);
  const totalPending = rows.reduce((s, l) => s + ledgerPending(l), 0);

  let overdue = 0;
  let overdueCount = 0;
  let currentMonthDue = 0;
  for (const l of rows) {
    const pending = ledgerPending(l);
    if (pending <= 0) continue;
    if (l.status === 'OVERDUE' || (!!l.dueDate && l.dueDate < today)) {
      overdue += pending;
      overdueCount++;
    }
    const isCurrentMonth =
      (!!l.monthYear && l.monthYear.startsWith(monthPrefix)) ||
      (!!l.feeMonth && l.feeMonth.includes(monthShort) && l.feeMonth.includes(year)) ||
      (!!l.dueDate && l.dueDate.startsWith(monthPrefix));
    if (isCurrentMonth) currentMonthDue += pending;
  }

  return {
    totalBilled,
    totalPaid,
    totalPending,
    overdue,
    overdueCount,
    currentMonthDue,
    ledgerCount: rows.length,
  };
}
