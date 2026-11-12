/**
 * Pure rules for paying a child's whole outstanding balance in one go.
 *
 * Everything is worked out in paise (whole numbers) so that rupees and paise never drift apart, and the
 * amount a parent is asked to pay is always the sum the server itself computes from the bills, never a
 * figure sent by the app or the browser.
 */

export interface BillLike {
  id: string;
  studentId?: string;
  dueDate?: string;
  createdAt?: string;
  pendingAmount?: number | null;
  total?: number | null;
  amount?: number | null;
  paidAmount?: number | null;
}

export interface Allocation {
  ledgerId: string;
  pendingBeforePaise: number;
  paidPaise: number;
  pendingAfterPaise: number;
}

export const toPaise = (rupees: unknown): number => Math.round((Number(rupees) || 0) * 100);
export const toRupees = (paise: number): number => Math.round(paise) / 100;

/** What is still owed on one bill, the same way the parent app and website work it out. */
export function billPendingPaise(bill: BillLike): number {
  if (bill.pendingAmount !== undefined && bill.pendingAmount !== null) return Math.max(0, toPaise(bill.pendingAmount));
  const total = bill.total ?? bill.amount ?? 0;
  return Math.max(0, toPaise(total) - toPaise(bill.paidAmount));
}

const byOldestFirst = (a: BillLike, b: BillLike): number => {
  const da = String(a.dueDate || '');
  const db = String(b.dueDate || '');
  if (da !== db) {
    if (!da) return 1; // bills without a due date go last
    if (!db) return -1;
    return da < db ? -1 : 1;
  }
  const ca = String(a.createdAt || '');
  const cb = String(b.createdAt || '');
  if (ca !== cb) return ca < cb ? -1 : 1;
  return String(a.id).localeCompare(String(b.id));
};

/** The child's bills that still have something to pay, oldest due date first, each bill counted once. */
export function openBillsOldestFirst<T extends BillLike>(bills: readonly T[], studentId: string): T[] {
  const seen = new Set<string>();
  const open: T[] = [];
  for (const bill of bills) {
    if (!bill || !bill.id || bill.studentId !== studentId || seen.has(bill.id)) continue;
    seen.add(bill.id);
    if (billPendingPaise(bill) > 0) open.push(bill);
  }
  return open.sort(byOldestFirst);
}

export function totalPendingPaise(bills: readonly BillLike[]): number {
  return bills.reduce((sum, bill) => sum + billPendingPaise(bill), 0);
}

/**
 * Spreads a received payment over the bills in the order given (oldest first). Each bill takes at most what
 * is still owed on it. Whatever is left over (the dues changed while the parent was paying) is returned
 * as `unallocatedPaise` so the school can settle it by hand; it is never silently lost.
 */
export function allocatePayment(bills: readonly BillLike[], paidPaise: number): { allocations: Allocation[]; unallocatedPaise: number } {
  let left = Math.max(0, Math.round(paidPaise));
  const allocations: Allocation[] = [];
  for (const bill of bills) {
    if (left <= 0) break;
    const pending = billPendingPaise(bill);
    if (pending <= 0) continue;
    const take = Math.min(left, pending);
    allocations.push({ ledgerId: bill.id, pendingBeforePaise: pending, paidPaise: take, pendingAfterPaise: pending - take });
    left -= take;
  }
  return { allocations, unallocatedPaise: left };
}

/** The payment gateway (PhonePe) does not take a payment below ₹1 (100 paise). */
export const MIN_ONLINE_PAYMENT_PAISE = 100;
