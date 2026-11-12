/**
 * A tiny fake PhonePe (Standard Checkout PG v2) for local tests. It speaks just enough of the real API for the
 * school server: OAuth token, create payment, order status, refund, refund status. Test helpers play the part of
 * the customer and the bank (complete / fail / leave pending). Nothing here ever talks to the real PhonePe.
 *   node scripts/lib/fakePhonePe.mjs [port]
 */
import http from 'node:http';
import { fileURLToPath } from 'node:url';

export async function startFakePhonePe({ port = 4598, clientId = 'TEST_CLIENT', clientSecret = 'TEST_SECRET' } = {}) {
  const orders = new Map(); // merchantOrderId -> order
  const refunds = new Map();
  const tokens = new Set();
  let seq = 0;
  let statusCalls = 0;

  const attempt = (o, state, extra = {}) => {
    const a = { transactionId: `OM${++seq}T`, paymentMode: 'UPI_INTENT', timestamp: Date.now(), amount: o.amount, state, ...extra };
    if (state === 'FAILED') Object.assign(a, { errorCode: 'AUTHORIZATION_ERROR', detailedErrorCode: 'ZM' });
    o.paymentDetails.push(a);
    return a;
  };
  const helpers = {
    /** The payer pays and the bank confirms. amount lets a test fake a wrong amount report. */
    complete(moid, { amount } = {}) {
      const o = orders.get(moid);
      const pending = o.paymentDetails.find((p) => p.state === 'PENDING');
      if (pending) pending.state = 'COMPLETED';
      else attempt(o, 'COMPLETED');
      o.state = 'COMPLETED';
      if (amount !== undefined) o.amount = amount;
      return o;
    },
    /** Payment started, bank has not answered yet. */
    pending(moid) { const o = orders.get(moid); attempt(o, 'PENDING'); o.state = 'PENDING'; return o; },
    /** One attempt failed (the PayPage lets the payer retry). */
    failAttempt(moid) { const o = orders.get(moid); attempt(o, 'FAILED'); return o; },
    /** PhonePe ends the order as failed. */
    fail(moid) { const o = orders.get(moid); const p = o.paymentDetails.find((x) => x.state === 'PENDING'); if (p) p.state = 'FAILED'; else attempt(o, 'FAILED'); o.state = 'FAILED'; return o; },
    completeRefund(id) { const r = refunds.get(id); r.state = 'COMPLETED'; return r; },
    get statusCalls() { return statusCalls; },
  };

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.method === 'POST' && url.pathname === '/v1/oauth/token') {
        const f = new URLSearchParams(body);
        if (f.get('client_id') !== clientId || f.get('client_secret') !== clientSecret || f.get('grant_type') !== 'client_credentials' || !f.get('client_version')) {
          return send(401, { code: 'UNAUTHORIZED' });
        }
        const t = `tok_${++seq}`;
        tokens.add(t);
        const now = Math.floor(Date.now() / 1000);
        return send(200, { access_token: t, encrypted_access_token: 'x', expires_in: null, issued_at: now, expires_at: now + 3600, session_expires_at: now + 3600, token_type: 'O-Bearer' });
      }
      // Test-only: the "customer" on the fake PayPage (by PhonePe orderId, as in the PayPage URL).
      if (url.pathname === '/__act') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        const o = [...orders.values()].find((x) => x.orderId === url.searchParams.get('orderId'));
        if (!o) return send(404, { error: 'unknown order' });
        const what = url.searchParams.get('do');
        if (what === 'complete') helpers.complete(o.merchantOrderId);
        else if (what === 'fail') helpers.fail(o.merchantOrderId);
        else if (what === 'pending') helpers.pending(o.merchantOrderId);
        return send(200, { ok: true, merchantOrderId: o.merchantOrderId, state: o.state });
      }
      const auth = String(req.headers.authorization || '');
      if (!auth.startsWith('O-Bearer ') || !tokens.has(auth.slice(9))) return send(401, { code: 'UNAUTHORIZED' });
      if (req.method === 'POST' && url.pathname === '/checkout/v2/pay') {
        const b = JSON.parse(body || '{}');
        if (!/^[A-Za-z0-9_-]{1,63}$/.test(b.merchantOrderId || '') || !(b.amount >= 100) || b.paymentFlow?.type !== 'PG_CHECKOUT' || !b.paymentFlow?.merchantUrls?.redirectUrl) {
          return send(400, { code: 'BAD_REQUEST', message: 'Please check the inputs you have provided.' });
        }
        if (orders.has(b.merchantOrderId)) return send(400, { code: 'BAD_REQUEST', message: 'Please check the inputs you have provided.' });
        const o = { orderId: `OMO${++seq}`, merchantOrderId: b.merchantOrderId, state: 'PENDING', amount: b.amount, expireAt: Date.now() + (b.expireAfter || 1200) * 1000, metaInfo: b.metaInfo || {}, paymentDetails: [], redirectUrl: b.paymentFlow.merchantUrls.redirectUrl };
        orders.set(b.merchantOrderId, o);
        return send(200, { orderId: o.orderId, state: 'PENDING', expireAt: o.expireAt, redirectUrl: `http://127.0.0.1:${port}/paypage/${o.orderId}` });
      }
      let m = /^\/checkout\/v2\/order\/([^/]+)\/status$/.exec(url.pathname);
      if (req.method === 'GET' && m) {
        statusCalls++;
        const o = orders.get(decodeURIComponent(m[1]));
        if (!o) return send(400, { code: 'INVALID_MERCHANT_ORDER_ID', message: 'No entry found for given merchant order id' });
        const { redirectUrl, ...pub } = o;
        return send(200, pub);
      }
      if (req.method === 'POST' && url.pathname === '/payments/v2/refund') {
        const b = JSON.parse(body || '{}');
        const o = orders.get(b.originalMerchantOrderId);
        if (!o || o.state !== 'COMPLETED' || !(b.amount >= 100) || b.amount > o.amount || refunds.has(b.merchantRefundId)) return send(400, { code: 'BAD_REQUEST' });
        const r = { refundId: `OMR${++seq}`, merchantRefundId: b.merchantRefundId, originalMerchantOrderId: b.originalMerchantOrderId, amount: b.amount, state: 'PENDING' };
        refunds.set(b.merchantRefundId, r);
        return send(200, { refundId: r.refundId, amount: r.amount, state: r.state });
      }
      m = /^\/payments\/v2\/refund\/([^/]+)\/status$/.exec(url.pathname);
      if (req.method === 'GET' && m) {
        const r = refunds.get(decodeURIComponent(m[1]));
        return r ? send(200, r) : send(400, { code: 'INVALID_REFUND_ID' });
      }
      return send(404, { code: 'NOT_FOUND' });
    });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { orders, refunds, ...helpers, helpers, close: () => new Promise((r) => server.close(r)), port };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv[2] || process.env.FAKE_PORT || 4598);
  await startFakePhonePe({ port });
  console.log(`Fake PhonePe listening on http://127.0.0.1:${port}`);
}
