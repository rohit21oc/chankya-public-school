/**
 * usePhonePe — online fee payment on the website with PhonePe Standard Checkout.
 *
 * 1. Asks the server whether online payment is on (`/api/payments/phonepe/config`; no credentials ever reach
 *    the browser).
 * 2. `payLedger(ledgerId, studentId)` / `payFull(studentId)`: the server creates the order (it decides the
 *    amount from its own ledger) and returns PhonePe's PayPage URL, which opens in PhonePe's iframe
 *    (`PhonePeCheckout.transact`). If the script cannot load, the browser goes to the PayPage and PhonePe sends it
 *    back to `/fees?phonepeOrder=<id>`.
 * 3. Whatever the PayPage reports (CONCLUDED / USER_CANCEL), the fee status comes ONLY from the server, which
 *    asks PhonePe's Order Status API itself. A closed PayPage, a lost network or a refresh never marks a fee paid.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl, getAuthHeaders } from '../services/apiConfig';

declare global {
  interface Window {
    PhonePeCheckout?: {
      transact: (opts: { tokenUrl: string; callback?: (response: string) => void; type?: 'IFRAME' | string }) => void;
      closePage?: () => void;
    };
  }
}

interface PhonePeConfig {
  enabled: boolean;
  environment?: 'sandbox' | 'production';
  checkoutScript?: string;
  schoolName?: string;
}

export type OnlinePaymentStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED' | 'ERROR';

export interface PaymentResult {
  /** True ONLY when the school server verified the payment with PhonePe and booked it. */
  success: boolean;
  /** The server's verdict. PENDING = money may be on its way; the fee is NOT paid yet. */
  status?: OnlinePaymentStatus;
  orderId?: string;
  receiptNumber?: string;
  message?: string;
  payment?: any;
}

export interface OpenOnlinePayment {
  orderId: string;
  paymentStatus: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';
  amount: number;
  receiptNumber?: string | null;
  message?: string;
  createdAt?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Turns the server's order view into a PaymentResult. Only paymentStatus === 'SUCCESS' with a receipt means paid. */
export function resultFromServer(d: any, fallback: string): PaymentResult {
  const ps = d?.paymentStatus;
  if (ps === 'SUCCESS' && d?.receiptNumber) {
    return { success: true, status: 'SUCCESS', orderId: d.orderId, receiptNumber: d.receiptNumber, payment: d.payment, message: `Payment successful! Receipt: ${d.receiptNumber}` };
  }
  if (ps === 'SUCCESS') return { success: false, status: 'PENDING', orderId: d.orderId, message: d.message || 'Payment received. The school office will adjust it against your fees.' };
  if (ps === 'PENDING') return { success: false, status: 'PENDING', orderId: d.orderId, message: d.message || 'Your payment is being confirmed. Your fee will update automatically — please do not pay again.' };
  if (ps === 'CANCELLED' || ps === 'EXPIRED' || ps === 'INITIATED') return { success: false, status: 'CANCELLED', orderId: d?.orderId, message: ps === 'INITIATED' ? 'Payment not completed. No fee was marked as paid.' : d?.message || 'Payment cancelled. No fee was marked as paid.' };
  if (ps === 'FAILED') return { success: false, status: 'FAILED', orderId: d?.orderId, message: d?.message || 'Payment failed. No fee was marked as paid.' };
  return { success: false, status: 'ERROR', orderId: d?.orderId, message: d?.error || fallback };
}

async function fetchOrderStatus(orderId: string): Promise<any | null> {
  try {
    const res = await fetch(getApiUrl(`/api/payments/phonepe/orders/${encodeURIComponent(orderId)}`), { headers: getAuthHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Asks the server (which asks PhonePe) until the order is settled one way or the other, or time runs out. */
export async function pollOrder(orderId: string, tries = 10, gapMs = 3000): Promise<PaymentResult> {
  let last: any = null;
  for (let i = 0; i < tries; i++) {
    const d = await fetchOrderStatus(orderId);
    if (d) {
      last = d;
      if (['SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(d.paymentStatus)) break;
    }
    await sleep(gapMs);
  }
  if (last && last.paymentStatus === 'INITIATED') {
    return { success: false, status: 'PENDING', orderId, message: 'We have not received a confirmation from PhonePe yet. Your fee will update automatically if the payment went through — please do not pay again.' };
  }
  return last
    ? resultFromServer(last, 'Could not confirm the payment yet.')
    : { success: false, status: 'PENDING', orderId, message: 'We could not reach the school server. If money was deducted, your fee will update automatically — please do not pay again.' };
}

const scriptPromises = new Map<string, Promise<boolean>>();
function loadCheckoutScript(src: string): Promise<boolean> {
  if (window.PhonePeCheckout) return Promise.resolve(true);
  if (!/^https:\/\/mercury(-stg)?\.phonepe\.com\//.test(src)) return Promise.resolve(false);
  const existing = scriptPromises.get(src);
  if (existing) return existing;
  const p = new Promise<boolean>((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(!!window.PhonePeCheckout);
    s.onerror = () => { scriptPromises.delete(src); resolve(false); };
    document.body.appendChild(s);
  });
  scriptPromises.set(src, p);
  return p;
}

export function usePhonePe() {
  const [config, setConfig] = useState<PhonePeConfig>({ enabled: false });
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/payments/phonepe/config'), { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setConfig(data);
        }
      } catch {
        // online payment just won't be offered
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (config.enabled && config.checkoutScript) void loadCheckoutScript(config.checkoutScript);
  }, [config.enabled, config.checkoutScript]);

  const runPayment = useCallback(async (target: { ledgerId?: string; studentId: string; payAll?: boolean }): Promise<PaymentResult> => {
    const cfg = configRef.current;
    if (!cfg.enabled) {
      const r: PaymentResult = { success: false, status: 'ERROR', message: 'Online payment is not enabled.' };
      setPaymentResult(r);
      return r;
    }
    setPaying(true);
    setPaymentResult(null);
    try {
      const orderRes = await fetch(getApiUrl('/api/payments/phonepe/create-order'), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(target.payAll ? { studentId: target.studentId, payAll: true, channel: 'web' } : { ledgerId: target.ledgerId, studentId: target.studentId, channel: 'web' }),
      });
      const order = await orderRes.json().catch(() => null);
      if (!orderRes.ok || !order?.success || !order.checkoutUrl) {
        if (orderRes.status === 409) {
          const r: PaymentResult = { success: false, status: 'PENDING', orderId: order?.pendingOrderId, message: order?.error };
          setPaymentResult(r);
          return r;
        }
        throw new Error(order?.error || 'Could not start the payment.');
      }
      const orderId: string = order.orderId;

      const scriptOk = await loadCheckoutScript(order.checkoutScript || cfg.checkoutScript || '');
      if (!scriptOk || !window.PhonePeCheckout) {
        // Fallback: full-page PayPage. PhonePe brings the browser back to /fees?phonepeOrder=<id>, where the
        // page asks the server for the verified result.
        window.location.assign(order.checkoutUrl);
        return { success: false, status: 'PENDING', orderId, message: 'Opening PhonePe…' };
      }

      const outcome = await new Promise<'CONCLUDED' | 'USER_CANCEL' | string>((resolve) => {
        let done = false;
        window.PhonePeCheckout!.transact({
          tokenUrl: order.checkoutUrl,
          type: 'IFRAME',
          callback: (response: string) => {
            if (done) return;
            done = true;
            resolve(response);
          },
        });
      });

      let result: PaymentResult;
      if (outcome === 'USER_CANCEL') {
        // Closing the PayPage never clears a fee. The server double-checks with PhonePe in case it went through.
        try {
          const res = await fetch(getApiUrl(`/api/payments/phonepe/orders/${encodeURIComponent(orderId)}/cancel`), {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'dismissed' }),
          });
          result = resultFromServer(await res.json().catch(() => null), 'Payment cancelled. No fee was marked as paid.');
        } catch {
          result = { success: false, status: 'CANCELLED', orderId, message: 'Payment cancelled. No fee was marked as paid.' };
        }
      } else {
        result = await pollOrder(orderId);
      }
      setPaymentResult(result);
      return result;
    } catch (err: any) {
      const result: PaymentResult = { success: false, status: 'ERROR', message: err?.message || 'An error occurred during payment.' };
      setPaymentResult(result);
      return result;
    } finally {
      setPaying(false);
    }
  }, []);

  const payLedger = useCallback((ledgerId: string, studentId: string) => runPayment({ ledgerId, studentId }), [runPayment]);
  const payFull = useCallback((studentId: string) => runPayment({ studentId, payAll: true }), [runPayment]);

  /** Online payments of this child that the server has not finished (e.g. the tab was closed while paying). */
  const fetchOpenPayments = useCallback(async (studentId: string): Promise<OpenOnlinePayment[]> => {
    if (!studentId) return [];
    try {
      const res = await fetch(getApiUrl(`/api/payments/phonepe/orders?studentId=${encodeURIComponent(studentId)}`), { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d?.open) ? d.open : [];
    } catch {
      return [];
    }
  }, []);

  /** Re-checks one order with the server (which re-checks with PhonePe). */
  const refreshPayment = useCallback(async (orderId: string): Promise<PaymentResult> => {
    const d = await fetchOrderStatus(orderId);
    return d ? resultFromServer(d, 'Could not check the payment.') : { success: false, status: 'PENDING', orderId, message: 'Could not reach the school server.' };
  }, []);

  return {
    enabled: config.enabled,
    environment: config.environment,
    loading,
    paying,
    paymentResult,
    clearResult: () => setPaymentResult(null),
    setPaymentResult,
    payLedger,
    payFull,
    fetchOpenPayments,
    refreshPayment,
  };
}
