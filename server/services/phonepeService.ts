/**
 * PhonePe Payment Gateway — Standard Checkout (PG v2). Server-side only: never import in the website or the app.
 *
 * Official API (developer.phonepe.com → Payment Gateway → Website Integration → Standard Checkout):
 *   Auth token   POST {auth}/v1/oauth/token                        (x-www-form-urlencoded, client_credentials)
 *   Create pay   POST {pg}/checkout/v2/pay                          (Authorization: O-Bearer <token>)
 *   Order status GET  {pg}/checkout/v2/order/{merchantOrderId}/status?details=true
 *   Refund       POST {pg}/payments/v2/refund
 *   Refund state GET  {pg}/payments/v2/refund/{merchantRefundId}/status
 *   Webhook auth  "SHA" type: Authorization header = SHA256("<username>:<password>")
 *                 "HMAC" type: x-phonepe-checksum-signature over the raw body with the webhook secret key
 *
 * Credentials come only from env vars (see .env.example). PHONEPE_ENV picks sandbox (default) or production.
 */
import crypto from 'crypto';

export type PhonePeEnv = 'sandbox' | 'production';

const ENV: PhonePeEnv = String(process.env.PHONEPE_ENV || '').toLowerCase() === 'production' ? 'production' : 'sandbox';
const pick = (name: string): string =>
  (process.env[`PHONEPE_${ENV === 'production' ? 'PROD' : 'SANDBOX'}_${name}`] || process.env[`PHONEPE_${name}`] || '').trim();

const CLIENT_ID = pick('CLIENT_ID');
const CLIENT_SECRET = pick('CLIENT_SECRET');
const CLIENT_VERSION = pick('CLIENT_VERSION') || '1';
const WEBHOOK_USERNAME = pick('WEBHOOK_USERNAME');
const WEBHOOK_PASSWORD = pick('WEBHOOK_PASSWORD');
const WEBHOOK_HMAC_SECRET = pick('WEBHOOK_HMAC_SECRET');

const OFFICIAL = {
  sandbox: {
    auth: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    pg: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    checkoutScript: 'https://mercury-stg.phonepe.com/web/bundle/checkout.js',
  },
  production: {
    auth: 'https://api.phonepe.com/apis/identity-manager',
    pg: 'https://api.phonepe.com/apis/pg',
    checkoutScript: 'https://mercury.phonepe.com/web/bundle/checkout.js',
  },
}[ENV];

// Local tests may point at a fake PhonePe on this machine. Anything that is not a loopback address is ignored,
// so a real deployment only ever talks to PhonePe.
const TEST_API_URL = (process.env.PHONEPE_TEST_API_URL || '').replace(/\/+$/, '');
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(TEST_API_URL) ? TEST_API_URL : '';
const AUTH_BASE = LOCAL || OFFICIAL.auth;
const PG_BASE = LOCAL || OFFICIAL.pg;

export function getEnv(): PhonePeEnv {
  return ENV;
}
export function isConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}
export function isWebhookConfigured(): boolean {
  return !!((WEBHOOK_USERNAME && WEBHOOK_PASSWORD) || WEBHOOK_HMAC_SECRET);
}
/** Public, safe for the browser: PhonePe's checkout script for the active environment. */
export function checkoutScriptUrl(): string {
  return OFFICIAL.checkoutScript;
}

// ---------------------------------------------------------------------------
// Auth token (cached, refreshed a little before it expires)
// ---------------------------------------------------------------------------
let cachedToken: { token: string; expiresAt: number } | null = null;
let tokenInFlight: Promise<string> | null = null;

export class PhonePeError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function fetchToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_version: CLIENT_VERSION,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const res = await fetch(`${AUTH_BASE}/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok || !data?.access_token) {
    // Never log the secret; the response body has no credentials in it.
    throw new PhonePeError(`PhonePe auth failed (${res.status})`, res.status, data?.code);
  }
  const expiresAt = Number(data.expires_at) > 0 ? Number(data.expires_at) * 1000 : Date.now() + 10 * 60 * 1000;
  cachedToken = { token: String(data.access_token), expiresAt };
  return cachedToken.token;
}

async function getToken(force = false): Promise<string> {
  if (!isConfigured()) throw new PhonePeError('PhonePe is not configured.', 503);
  if (!force && cachedToken && cachedToken.expiresAt - Date.now() > 2 * 60 * 1000) return cachedToken.token;
  if (!tokenInFlight) tokenInFlight = fetchToken().finally(() => { tokenInFlight = null; });
  return tokenInFlight;
}

async function pgCall<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${PG_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && !retried) {
    cachedToken = null;
    return pgCall<T>(method, path, body, true);
  }
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    throw new PhonePeError(`PhonePe ${method} ${path.split('?')[0]} failed (${res.status}${data?.code ? ` ${data.code}` : ''})`, res.status, data?.code);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Types (only the fields this school uses; unknown fields are ignored on purpose)
// ---------------------------------------------------------------------------
export interface PhonePePaymentAttempt {
  transactionId?: string;
  paymentMode?: string;
  timestamp?: number;
  amount?: number | string;
  state?: 'PENDING' | 'COMPLETED' | 'FAILED' | string;
  errorCode?: string;
  detailedErrorCode?: string;
}

export interface PhonePeOrderStatus {
  orderId?: string;
  merchantOrderId?: string;
  state: 'PENDING' | 'COMPLETED' | 'FAILED' | string;
  amount?: number | string;
  expireAt?: number;
  metaInfo?: Record<string, string>;
  paymentDetails?: PhonePePaymentAttempt[];
  errorCode?: string;
  detailedErrorCode?: string;
}

export interface CreatePaymentInput {
  merchantOrderId: string;
  amountPaise: number;
  redirectUrl: string;
  expireAfterSeconds?: number;
  metaInfo?: Record<string, string>;
}

/** Merchant order / refund ids: max 63 chars, letters, digits, "_" and "-" only (PhonePe rule). */
export function isValidMerchantId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,63}$/.test(id);
}

export function newMerchantOrderId(prefix = 'CPS'): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`.slice(0, 63);
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
export async function createPayment(input: CreatePaymentInput): Promise<{ orderId: string; state: string; expireAt?: number; redirectUrl: string }> {
  if (!isValidMerchantId(input.merchantOrderId)) throw new PhonePeError('Invalid merchant order id.', 400);
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) throw new PhonePeError('Amount must be at least ₹1.', 400);
  const expireAfter = Math.min(3600, Math.max(300, Math.round(input.expireAfterSeconds || 1800)));
  const metaInfo: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.metaInfo || {})) {
    if (/^udf([1-9]|10)$/.test(k)) metaInfo[k] = String(v).slice(0, 256);
  }
  const data = await pgCall<any>('POST', '/checkout/v2/pay', {
    merchantOrderId: input.merchantOrderId,
    amount: input.amountPaise,
    expireAfter,
    metaInfo,
    paymentFlow: {
      type: 'PG_CHECKOUT',
      message: 'School fee payment',
      merchantUrls: { redirectUrl: input.redirectUrl },
    },
  });
  if (!data?.redirectUrl || !data?.orderId) throw new PhonePeError('PhonePe did not return a payment page.', 502);
  return { orderId: String(data.orderId), state: String(data.state || 'PENDING'), expireAt: data.expireAt ?? data.expiryAt, redirectUrl: String(data.redirectUrl) };
}

/** The source of truth for whether an order was paid. Always asked by the server itself. */
export async function getOrderStatus(merchantOrderId: string): Promise<PhonePeOrderStatus> {
  if (!isValidMerchantId(merchantOrderId)) throw new PhonePeError('Invalid merchant order id.', 400);
  return pgCall<PhonePeOrderStatus>('GET', `/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=true&errorContext=true`);
}

export async function initiateRefund(input: { merchantRefundId: string; originalMerchantOrderId: string; amountPaise: number }): Promise<{ refundId?: string; amount?: number; state: string }> {
  if (!isValidMerchantId(input.merchantRefundId) || !isValidMerchantId(input.originalMerchantOrderId)) throw new PhonePeError('Invalid refund id.', 400);
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) throw new PhonePeError('Refund must be at least ₹1.', 400);
  return pgCall<any>('POST', '/payments/v2/refund', {
    merchantRefundId: input.merchantRefundId,
    originalMerchantOrderId: input.originalMerchantOrderId,
    amount: input.amountPaise,
  });
}

export async function getRefundStatus(merchantRefundId: string): Promise<{ state: string; amount?: number; refundId?: string; errorCode?: string }> {
  if (!isValidMerchantId(merchantRefundId)) throw new PhonePeError('Invalid refund id.', 400);
  return pgCall<any>('GET', `/payments/v2/refund/${encodeURIComponent(merchantRefundId)}/status`);
}

// ---------------------------------------------------------------------------
// Webhook authentication
// ---------------------------------------------------------------------------
const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Is this webhook really from PhonePe? Accepts the dashboard's "SHA" type (Authorization header equal to
 * SHA256 of "username:password") and its "HMAC" type (HMAC-SHA256 of the raw body with the webhook secret key,
 * hex or base64). Returns false when nothing is configured: an unauthenticated webhook is never processed.
 * Even an authentic webhook only makes the server ask PhonePe's Order Status API; it never books a fee by itself.
 */
export function verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean {
  const h = (name: string) => {
    const v = headers[name.toLowerCase()];
    return Array.isArray(v) ? String(v[0] || '') : String(v || '');
  };
  if (WEBHOOK_USERNAME && WEBHOOK_PASSWORD) {
    const got = h('authorization').trim().replace(/^(SHA256|Bearer)\s+/i, '').toLowerCase();
    const want = crypto.createHash('sha256').update(`${WEBHOOK_USERNAME}:${WEBHOOK_PASSWORD}`).digest('hex');
    if (got && safeEqual(got, want)) return true;
  }
  if (WEBHOOK_HMAC_SECRET) {
    const sig = h('x-phonepe-checksum-signature').trim();
    if (sig) {
      const mac = crypto.createHmac('sha256', WEBHOOK_HMAC_SECRET).update(rawBody);
      const digest = mac.digest();
      if (safeEqual(sig.toLowerCase(), digest.toString('hex')) || safeEqual(sig, digest.toString('base64'))) return true;
    }
  }
  return false;
}
