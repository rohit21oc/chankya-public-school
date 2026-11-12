/**
 * Rules for online fee payments (PhonePe Standard Checkout). Pure functions only: no server state, no network.
 *
 * The one rule everything here protects:
 *   A fee becomes PAID only after the SERVER has asked PhonePe's Order Status API itself and PhonePe says the
 *   order the SERVER created for that student is COMPLETED for exactly the stored amount. A browser/app
 *   callback, a closed PayPage, a pending payment or an unauthenticated webhook can never clear a fee.
 */

export type PaymentOrderStatus =
  | 'INITIATED' // order created at PhonePe, PayPage not finished
  | 'PENDING' // a payment attempt is still processing at PhonePe / the bank
  | 'SUCCESS' // PhonePe Order Status = COMPLETED for the exact amount; fee ledger updated, receipt issued
  | 'FAILED' // the gateway reported the payment attempt failed
  | 'CANCELLED' // the payer closed the PayPage and PhonePe has no completed payment
  | 'EXPIRED' // never paid within the order's validity
  | 'REFUNDED'; // money returned at the gateway after SUCCESS

export const PAYMENT_ORDER_STATUSES: PaymentOrderStatus[] = ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'];

/** States in which the order may still turn into a completed payment. */
export const OPEN_STATUSES: PaymentOrderStatus[] = ['INITIATED', 'PENDING'];

/** How long an unpaid order stays usable before reconciliation may expire it. */
export const ORDER_TTL_MS = 30 * 60 * 1000;

export interface PaymentAttempt {
  transactionId: string;
  state: string; // PhonePe attempt state: PENDING | COMPLETED | FAILED
  amountPaise?: number;
  paymentMode?: string;
  errorCode?: string;
  at: string;
}

export interface PaymentOrderRecord {
  id: string;
  gateway: 'PHONEPE';
  orderId: string; // our merchantOrderId (unique) — what PhonePe's status API is asked about
  gatewayOrderId?: string; // PhonePe's own orderId
  studentId: string;
  studentName?: string;
  payAll: boolean;
  ledgerIds: string[]; // the bill(s) the order was created for
  amountPaise: number; // what the server asked PhonePe for
  currency: string; // always INR
  status: PaymentOrderStatus;
  paymentId?: string; // PhonePe transactionId of the completed attempt (unique once set)
  paymentMode?: string;
  receiptNumber?: string;
  paidPaise?: number;
  appliedPaise?: number;
  unappliedPaise?: number;
  reconciliationRequired?: boolean;
  reconciliationNote?: string;
  verifiedVia?: 'status' | 'webhook' | 'reconcile';
  refund?: { merchantRefundId: string; amountPaise: number; state: string; refundId?: string; requestedBy?: string; at: string };
  attempts: PaymentAttempt[];
  history: { from: PaymentOrderStatus | null; to: PaymentOrderStatus; at: string; reason: string }[];
  createdBy: { userId: string; role: string; name: string };
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  lastReconciledAt?: string;
}

/** Allowed moves. SUCCESS can only become REFUNDED; REFUNDED is final. A late capture may still rescue a
 * CANCELLED / EXPIRED / FAILED order (a webhook or the status check can arrive after the payer closed the
 * page) because money PhonePe confirmed must never be lost. */
const TRANSITIONS: Record<PaymentOrderStatus, PaymentOrderStatus[]> = {
  INITIATED: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED'],
  PENDING: ['INITIATED', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED'], // back to INITIATED when a pending attempt failed and the PayPage allows a retry
  FAILED: ['PENDING', 'SUCCESS', 'CANCELLED', 'EXPIRED'],
  CANCELLED: ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'],
  EXPIRED: ['PENDING', 'SUCCESS'],
  SUCCESS: ['REFUNDED'],
  REFUNDED: [],
};

export function canTransition(from: PaymentOrderStatus, to: PaymentOrderStatus): boolean {
  if (from === to) return false;
  return (TRANSITIONS[from] || []).includes(to);
}

/** Returns a copy of the record moved to `to`, or the same record when the move is not allowed. */
export function transition(rec: PaymentOrderRecord, to: PaymentOrderStatus, reason: string, now = new Date()): PaymentOrderRecord {
  if (!canTransition(rec.status, to)) return rec;
  const at = now.toISOString();
  return { ...rec, status: to, updatedAt: at, history: [...(rec.history || []), { from: rec.status, to, at, reason }] };
}

export function isOpen(rec: Pick<PaymentOrderRecord, 'status'>): boolean {
  return OPEN_STATUSES.includes(rec.status);
}

export interface GatewayOrderStatus {
  merchantOrderId?: string;
  state?: string; // PENDING | COMPLETED | FAILED
  amount?: number | string;
  expireAt?: number;
  paymentDetails?: Array<{ transactionId?: string; paymentMode?: string; amount?: number | string; state?: string; errorCode?: string; timestamp?: number }>;
}

export type CompletionCheck =
  | { ok: true; transactionId: string; paymentMode: string; amountPaise: number }
  | { ok: false; code: 'NOT_COMPLETED' | 'AMOUNT_MISMATCH' | 'ORDER_MISMATCH' | 'NO_TRANSACTION'; message: string };

/**
 * Does PhonePe's Order Status answer prove that THIS order was paid in full? Compared only with the order record
 * the server stored when it created the order — never with anything the browser, the app or a webhook body said.
 */
export function checkCompletedOrder(order: Pick<PaymentOrderRecord, 'orderId' | 'amountPaise'>, status: GatewayOrderStatus): CompletionCheck {
  if (!status) return { ok: false, code: 'NOT_COMPLETED', message: 'No status from PhonePe.' };
  if (status.merchantOrderId && status.merchantOrderId !== order.orderId) {
    return { ok: false, code: 'ORDER_MISMATCH', message: 'PhonePe answered for a different order.' };
  }
  if (status.state !== 'COMPLETED') {
    return { ok: false, code: 'NOT_COMPLETED', message: `Payment is ${String(status.state || 'pending').toLowerCase()}; the fee is not paid until PhonePe confirms it.` };
  }
  const amount = Math.round(Number(status.amount));
  if (amount !== Math.round(Number(order.amountPaise))) {
    return { ok: false, code: 'AMOUNT_MISMATCH', message: 'The amount paid does not match the amount of the order.' };
  }
  const done = (status.paymentDetails || []).find((p) => p && p.state === 'COMPLETED' && p.transactionId);
  if (!done) return { ok: false, code: 'NO_TRANSACTION', message: 'PhonePe reported the order completed without a completed transaction.' };
  return { ok: true, transactionId: String(done.transactionId), paymentMode: String(done.paymentMode || 'ONLINE'), amountPaise: amount };
}

/** What the order's attempts say when it is not completed. */
export function summarizeAttempts(status: GatewayOrderStatus): { pending: boolean; failed: boolean; anyAttempt: boolean } {
  const list = Array.isArray(status?.paymentDetails) ? status.paymentDetails : [];
  return {
    pending: list.some((p) => p?.state === 'PENDING'),
    failed: status?.state === 'FAILED' || list.some((p) => p?.state === 'FAILED'),
    anyAttempt: list.length > 0,
  };
}

/**
 * Where an open order should go when PhonePe says it is NOT completed.
 * `payerSaid` is what the browser/app reported; it can only ever make the status LESS paid, never more.
 */
export function nextOpenStatus(
  rec: Pick<PaymentOrderRecord, 'status' | 'createdAt'>,
  status: GatewayOrderStatus,
  opts: { payerSaid?: 'dismissed' | 'failed'; now?: Date; ttlMs?: number } = {}
): PaymentOrderStatus {
  const a = summarizeAttempts(status);
  if (status?.state === 'FAILED') return 'FAILED'; // PhonePe ended the order
  if (a.pending) return 'PENDING'; // money may be on its way: never "cancelled"
  const now = (opts.now || new Date()).getTime();
  const expired = (status?.expireAt && Number(status.expireAt) < now) || now - new Date(rec.createdAt).getTime() > (opts.ttlMs ?? ORDER_TTL_MS);
  if (opts.payerSaid === 'failed') return a.failed ? 'FAILED' : 'CANCELLED';
  if (opts.payerSaid === 'dismissed') return 'CANCELLED';
  if (expired) return a.failed ? 'FAILED' : 'EXPIRED';
  return rec.status === 'PENDING' ? 'INITIATED' : rec.status;
}

/** Runs async tasks one at a time per key, so verify + webhook + reconcile for one child never interleave. */
export class KeyedMutex {
  private tails = new Map<string, Promise<unknown>>();
  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) || Promise.resolve();
    const next = prev.then(task, task);
    const tail = next.catch(() => undefined);
    this.tails.set(key, tail);
    tail.then(() => { if (this.tails.get(key) === tail) this.tails.delete(key); });
    return next;
  }
}
