/**
 * PhonePe online fee payment against a running LOCAL server and a FAKE PhonePe started by this script.
 * Nothing reaches the real PhonePe.
 *
 *   PHONEPE_CLIENT_ID=TEST_CLIENT PHONEPE_CLIENT_SECRET=TEST_SECRET PHONEPE_CLIENT_VERSION=1 \
 *   PHONEPE_WEBHOOK_USERNAME=whuser PHONEPE_WEBHOOK_PASSWORD=whpass PHONEPE_WEBHOOK_HMAC_SECRET=hmacsecret \
 *   PHONEPE_TEST_API_URL=http://127.0.0.1:4598 env -u MONGODB_URI NODE_ENV=production npx tsx server.ts
 *   node scripts/verify-phonepe-payments.mjs
 *
 * Uses the dev data in data/*.json. Restore it afterwards:  git checkout -- data; git clean -fdq data
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
import { startFakePhonePe } from './lib/fakePhonePe.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('Refusing to run: BASE_URL must be localhost.'); process.exit(2); }
const S = process.env.JWT_SECRET || 'residential_pds_sheohar_jwt_production_secret_key_2026';
const WH_USER = process.env.PP_WEBHOOK_USERNAME || 'whuser';
const WH_PASS = process.env.PP_WEBHOOK_PASSWORD || 'whpass';
const WH_HMAC = process.env.PP_WEBHOOK_HMAC_SECRET || 'hmacsecret';
const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));

const admin = read('adminAccounts.json').find((a) => a.role === 'SUPER_ADMIN');
const parents = read('parentAccounts.json');
const parentA = parents.find((p) => p.id === 'parent-9876543210');
const parentB = parents.find((p) => p.id === 'parent-9879998877');
const tok = (id, role) => jwt.sign({ userId: id, role }, S, { expiresIn: '30m' });
const T = { admin: tok(admin.id, admin.role), pa: tok(parentA.id, 'PARENT'), pb: tok(parentB.id, 'PARENT') };
const KID_A = 'st-1';
const KID_B = 'st-sync-1791205503669';

let fail = 0;
let total = 0;
const check = (n, ok, x = '') => { total++; if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  → ${x}`}`); };
const section = (s) => console.log(`\n=== ${s} ===`);
const call = async (method, p, token, body, headers = {}) => {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  let j = null; try { j = JSON.parse(buf.toString('utf8')); } catch {}
  return { s: r.status, j, buf, text: buf.toString('utf8'), type: r.headers.get('content-type') || '' };
};
const fake = await startFakePhonePe({ port: Number(process.env.FAKE_PORT || 4598) });
const shaAuth = crypto.createHash('sha256').update(`${WH_USER}:${WH_PASS}`).digest('hex');
const webhook = (event, payload, { auth = shaAuth, hmac } = {}) => {
  const raw = JSON.stringify({ event, payload });
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = auth;
  if (hmac) headers['x-phonepe-checksum-signature'] = crypto.createHmac('sha256', hmac).update(raw).digest('hex');
  return fetch(`${BASE}/api/payments/phonepe/webhook`, { method: 'POST', headers, body: raw }).then(async (r) => ({ s: r.status, j: await r.json().catch(() => null), raw }));
};
const orderPayload = (moid, state) => {
  const o = fake.orders.get(moid);
  return { orderId: o?.orderId, merchantId: 'M', merchantOrderId: moid, state, amount: o?.amount, expireAt: o?.expireAt, paymentDetails: o?.paymentDetails || [] };
};
const pendingOf = (l) => (l.pendingAmount !== undefined && l.pendingAmount !== null ? Math.max(0, Number(l.pendingAmount)) : Math.max(0, Number(l.total ?? l.amount ?? 0) - Number(l.paidAmount || 0)));
const ledgers = async (token, sid) => (await call('GET', `/api/fee-ledgers?studentId=${encodeURIComponent(sid)}`, token)).j || [];
const ledger = async (token, sid, id) => (await ledgers(token, sid)).find((l) => l.id === id);
const receiptsFor = async (token, sid, moid) => ((await call('GET', `/api/fees/payments?studentId=${sid}`, token)).j || []).filter((p) => p.merchantOrderId === moid);
const create = (token, body) => call('POST', '/api/payments/phonepe/create-order', token, body);
const status = (token, moid) => call('GET', `/api/payments/phonepe/orders/${moid}`, token);
const same = (a, b) => a && b && a.status === b.status && pendingOf(a) === pendingOf(b) && Number(a.paidAmount || 0) === Number(b.paidAmount || 0);

try {
  section('Setup and access');
  const openA = (await ledgers(T.pa, KID_A)).filter((l) => pendingOf(l) > 0);
  const openB = (await ledgers(T.pb, KID_B)).filter((l) => pendingOf(l) > 0);
  check('Test data: parent A\'s child has 5+ unpaid bills, parent B\'s child 3+', openA.length >= 5 && openB.length >= 3, `${openA.length}/${openB.length}`);
  const [a1, a2, a3, a4, a5] = openA;
  const [b1, b2, b3] = openB;
  let r = await call('GET', '/api/payments/phonepe/config', T.pa);
  check('Online payment is on (sandbox) and the config carries no credentials', r.s === 200 && r.j.enabled === true && r.j.environment === 'sandbox' && !/TEST_SECRET|TEST_CLIENT|whpass|hmacsecret/.test(r.text), r.text);
  r = await create(null, { ledgerId: a1.id, studentId: KID_A });
  check('Starting a payment without signing in is refused', r.s === 401, r.s);
  r = await create(T.pb, { ledgerId: a1.id, studentId: KID_A });
  check('A parent cannot pay for someone else\'s child', r.s === 403, r.s);
  r = await create(T.pa, { ledgerId: b1.id, studentId: KID_A });
  check('A bill of another child cannot be paid under this child', r.s === 404, r.s);
  r = await call('POST', '/api/payments/razorpay/verify', T.pa, { razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'x' });
  check('The old gateway\'s routes are gone (nothing can be "verified" there)', r.s === 404, r.s);

  section('1. Successful payment → fee PAID, one receipt');
  r = await create(T.pa, { ledgerId: a1.id, studentId: KID_A, channel: 'web' });
  const o1 = r.j?.orderId;
  check('Order created: INITIATED, PayPage URL from PhonePe, amount = the bill', r.s === 200 && r.j.paymentStatus === 'INITIATED' && /^http:\/\/127\.0\.0\.1:\d+\/paypage\//.test(r.j.checkoutUrl) && r.j.amountPaise === Math.round(pendingOf(a1) * 100), JSON.stringify(r.j).slice(0, 220));
  const fo = fake.orders.get(o1);
  check('PhonePe was asked for exactly that amount, PG_CHECKOUT, returning to /fees', fo?.amount === r.j.amountPaise && /\/fees\?phonepeOrder=/.test(fo.redirectUrl) && fo.metaInfo.udf1 === KID_A, JSON.stringify(fo));
  check('The bill is still unpaid while the PayPage is open', same(await ledger(T.pa, KID_A, a1.id), a1));
  fake.complete(o1);
  r = await status(T.pa, o1);
  check('After PhonePe completes it, the status check books it: SUCCESS + receipt', r.s === 200 && r.j.paymentStatus === 'SUCCESS' && /^REC-\d{4}-\d+$/.test(r.j.receiptNumber || '') && r.j.transactionId, JSON.stringify(r.j).slice(0, 220));
  const rec1 = r.j.receipt;
  const a1After = await ledger(T.pa, KID_A, a1.id);
  check('The bill is PAID and points at the receipt', a1After.status === 'PAID' && pendingOf(a1After) === 0 && a1After.receiptNumber === r.j.receiptNumber);
  check('Receipt: PhonePe, merchant order id, PhonePe transaction id, amount', rec1?.gateway === 'PHONEPE' && rec1.merchantOrderId === o1 && rec1.phonepeTransactionId === r.j.transactionId && rec1.transactionReference === r.j.transactionId && rec1.amount === pendingOf(a1) && rec1.onlinePaymentMode === 'UPI_INTENT', JSON.stringify(rec1).slice(0, 300));
  r = await status(T.pa, o1);
  check('Checking again changes nothing (same receipt, still one record)', r.j.receiptNumber === rec1.receiptNumber && (await receiptsFor(T.pa, KID_A, o1)).length === 1);
  const link = await call('POST', `/api/fees/receipts/${rec1.receiptNumber}/link`, T.pa, {});
  const pdf = link.j?.url ? await call('GET', link.j.url, null) : { s: 0, buf: Buffer.alloc(0) };
  let pdfText = '';
  try { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rc-')), 'r.pdf'); fs.writeFileSync(f, pdf.buf); pdfText = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }); } catch {}
  check('Receipt PDF downloads and says PhonePe with the transaction id', pdf.s === 200 && pdf.buf.subarray(0, 5).toString() === '%PDF-' && /PhonePe/.test(pdfText) && pdfText.includes(rec1.phonepeTransactionId), pdfText.slice(0, 300));

  section('2. Failed payment → fee remains UNPAID');
  r = await create(T.pa, { ledgerId: a2.id, studentId: KID_A });
  const o2 = r.j.orderId;
  fake.fail(o2);
  r = await status(T.pa, o2);
  check('PhonePe FAILED → order FAILED, no receipt', r.j.paymentStatus === 'FAILED' && !r.j.receiptNumber, JSON.stringify(r.j).slice(0, 200));
  check('The bill is unchanged', same(await ledger(T.pa, KID_A, a2.id), a2));

  section('3. Cancel on the PayPage (USER_CANCEL) → UNPAID');
  r = await create(T.pa, { ledgerId: a2.id, studentId: KID_A });
  const o3 = r.j.orderId;
  check('A new order is made after a failed one', o3 && o3 !== o2);
  r = await call('POST', `/api/payments/phonepe/orders/${o3}/cancel`, T.pa, { reason: 'dismissed' });
  check('Server checks PhonePe (nothing paid) → CANCELLED', r.j.paymentStatus === 'CANCELLED', JSON.stringify(r.j).slice(0, 200));
  r = await call('POST', `/api/payments/phonepe/orders/${o3}/cancel`, T.pb, {});
  check('Another parent cannot touch this order', r.s === 403, r.s);
  check('The bill is unchanged', same(await ledger(T.pa, KID_A, a2.id), a2));

  section('4/5. Browser or app closed during payment → no false PAID; app return page');
  r = await create(T.pa, { ledgerId: a2.id, studentId: KID_A, channel: 'app' });
  const o4 = r.j.orderId;
  const appRedirect = fake.orders.get(o4).redirectUrl;
  check('App orders return the phone browser to the school\'s own return page (short-lived token, not the login token)', /\/api\/payments\/phonepe\/return\?mo=.+&t=/.test(appRedirect) && !appRedirect.includes(T.pa), appRedirect);
  let page = await call('GET', appRedirect.replace(/^https?:\/\/[^/]+/, ''), null);
  check('Return page before paying says "Confirming", never "successful"', page.s === 200 && /Confirming/.test(page.text) && !/Payment successful/.test(page.text), page.text.slice(0, 200));
  page = await call('GET', `/api/payments/phonepe/return?mo=${o4}&t=forged`, null);
  check('A forged return link shows nothing about the order', page.s === 200 && /link expired/i.test(page.text));
  r = await call('GET', `/api/payments/phonepe/orders?studentId=${KID_A}`, T.pa);
  check('Reopening Fees lists the order as not completed (INITIATED)', r.j.open.some((o) => o.orderId === o4 && o.paymentStatus === 'INITIATED'));
  check('The bill is unchanged', same(await ledger(T.pa, KID_A, a2.id), a2));

  section('6. Pending payment → not paid, no double payment, then completes');
  fake.pending(o4);
  r = await status(T.pa, o4);
  check('Bank still processing → PENDING, no receipt', r.j.paymentStatus === 'PENDING' && !r.j.receiptNumber, JSON.stringify(r.j).slice(0, 160));
  r = await create(T.pa, { ledgerId: a2.id, studentId: KID_A });
  check('A second payment for the same bill is blocked while one is pending', r.s === 409 && r.j.pendingOrderId === o4, `${r.s} ${JSON.stringify(r.j)}`);
  r = await create(T.pa, { studentId: KID_A, payAll: true });
  check('…and "pay full" (which includes that bill) is blocked too', r.s === 409, r.s);
  check('The bill is unchanged', same(await ledger(T.pa, KID_A, a2.id), a2));
  fake.complete(o4);
  page = await call('GET', appRedirect.replace(/^https?:\/\/[^/]+/, ''), null);
  check('When the bank confirms, the return page shows success (server verified)', /Payment successful/.test(page.text));
  check('The bill is PAID once', (await ledger(T.pa, KID_A, a2.id)).status === 'PAID' && (await receiptsFor(T.pa, KID_A, o4)).length === 1);

  section('7. Wrong amount reported → NOT booked');
  r = await create(T.pa, { ledgerId: a3.id, studentId: KID_A });
  const o7 = r.j.orderId;
  fake.complete(o7, { amount: 100 });
  r = await status(T.pa, o7);
  check('PhonePe says COMPLETED for ₹1 on a ₹2,250 order → not booked, flagged', r.j.paymentStatus === 'PENDING' && !r.j.receiptNumber && r.j.reconciliationRequired === true, JSON.stringify(r.j).slice(0, 200));
  check('The bill is unchanged', same(await ledger(T.pa, KID_A, a3.id), a3));

  section('8. Webhook authentication');
  r = await create(T.pa, { ledgerId: a3.id, studentId: KID_A });
  check('A wrong-amount order stays PENDING and blocks paying that bill again until it is resolved', r.s === 409);
  r = await create(T.pb, { ledgerId: b1.id, studentId: KID_B });
  const ob1 = r.j.orderId;
  fake.complete(ob1);
  let w = await webhook('checkout.order.completed', orderPayload(ob1, 'COMPLETED'), { auth: null });
  check('A webhook without authentication is rejected', w.s === 401);
  w = await webhook('checkout.order.completed', orderPayload(ob1, 'COMPLETED'), { auth: crypto.createHash('sha256').update('whuser:wrong').digest('hex') });
  check('A webhook with wrong credentials is rejected', w.s === 401);
  check('…and nothing was booked', same(await ledger(T.pb, KID_B, b1.id), b1));

  section('9. Payment completed but callback lost → webhook books it once (SHA auth)');
  w = await webhook('checkout.order.completed', orderPayload(ob1, 'COMPLETED'));
  check('Authentic webhook → server asks PhonePe → SUCCESS with receipt', w.s === 200 && w.j.outcome === 'success' && /^REC-/.test(w.j.receiptNumber || ''), JSON.stringify(w.j));
  check('The bill is PAID', (await ledger(T.pb, KID_B, b1.id)).status === 'PAID');
  const dup = await fetch(`${BASE}/api/payments/phonepe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: shaAuth }, body: w.raw }).then((x) => x.json());
  check('The same webhook again → "already processed", still one receipt', /already/i.test(dup.message || '') && (await receiptsFor(T.pb, KID_B, ob1)).length === 1, JSON.stringify(dup));
  r = await status(T.pb, ob1);
  check('The late browser status check returns the same receipt', r.j.receiptNumber === w.j.receiptNumber);

  section('10. Fake webhook body → server trusts PhonePe, not the body (HMAC auth)');
  r = await create(T.pb, { ledgerId: b2.id, studentId: KID_B });
  const ob2 = r.j.orderId;
  w = await webhook('checkout.order.completed', { ...orderPayload(ob2, 'COMPLETED'), state: 'COMPLETED', amount: 999999 }, { auth: null, hmac: WH_HMAC });
  check('HMAC-authenticated webhook claiming COMPLETED, but PhonePe says not paid → NOT booked', w.s === 200 && w.j.outcome === 'initiated' && same(await ledger(T.pb, KID_B, b2.id), b2), JSON.stringify(w.j));
  w = await webhook('checkout.order.completed', orderPayload(ob2, 'COMPLETED'), { auth: null, hmac: 'wrong-key' });
  check('A webhook with a wrong HMAC signature is rejected', w.s === 401);

  section('11. Simultaneous webhook and status checks → exactly one collection');
  fake.complete(ob2);
  const burst = await Promise.all([
    webhook('checkout.order.completed', { ...orderPayload(ob2, 'COMPLETED'), timestamp: 1 }),
    status(T.pb, ob2),
    status(T.pb, ob2),
    webhook('checkout.order.completed', { ...orderPayload(ob2, 'COMPLETED'), timestamp: 2 }),
    call('GET', `/api/payments/phonepe/orders?studentId=${KID_B}`, T.pb),
  ]);
  const rn = new Set([burst[0].j?.receiptNumber, burst[1].j?.receiptNumber, burst[2].j?.receiptNumber, burst[3].j?.receiptNumber].filter(Boolean));
  check('All concurrent calls agree on ONE receipt', rn.size === 1, JSON.stringify([...rn]));
  const b2After = await ledger(T.pb, KID_B, b2.id);
  check('One payment record; the bill collected exactly once', (await receiptsFor(T.pb, KID_B, ob2)).length === 1 && Number(b2After.paidAmount) === Number(b2.paidAmount || 0) + pendingOf(b2));

  section('12. Network interruption → reconciliation books it');
  r = await create(T.pb, { ledgerId: b3.id, studentId: KID_B, channel: 'app' });
  const ob3 = r.j.orderId;
  fake.complete(ob3); // paid; the phone lost the network and no webhook arrived
  check('Before anyone asks, the bill is still unpaid (nothing trusted)', same(await ledger(T.pb, KID_B, b3.id), b3));
  r = await call('GET', `/api/payments/phonepe/orders?studentId=${KID_B}`, T.pb);
  const l3 = r.j.orders.find((o) => o.orderId === ob3);
  check('Reopening Fees asks PhonePe → SUCCESS with receipt', l3?.paymentStatus === 'SUCCESS' && /^REC-/.test(l3.receiptNumber || ''), JSON.stringify(l3).slice(0, 200));
  r = await call('GET', `/api/payments/phonepe/orders?studentId=${KID_B}`, T.pa);
  check('Parent A cannot list parent B\'s payments', r.s === 403);

  section('13. Partial and full payments');
  r = await create(T.pa, { ledgerId: a4.id, studentId: KID_A, amount: 1000 });
  check('Part payment ₹1,000 of a ₹2,250 bill is allowed', r.s === 200 && r.j.amountPaise === 100000, JSON.stringify(r.j).slice(0, 120));
  const o13 = r.j.orderId;
  r = await create(T.pa, { ledgerId: a4.id, studentId: KID_A, amount: pendingOf(a4) + 1 });
  check('…but never more than what is owed', r.s === 400);
  fake.complete(o13);
  await status(T.pa, o13);
  let a4After = await ledger(T.pa, KID_A, a4.id);
  check('After ₹1,000 the bill is PARTIAL with ₹1,250 due', a4After.status === 'PARTIAL' && pendingOf(a4After) === pendingOf(a4) - 1000, JSON.stringify([a4After.status, a4After.pendingAmount]));
  r = await create(T.pa, { ledgerId: a4.id, studentId: KID_A });
  check('Next order is for exactly the remaining ₹1,250', r.j.amountPaise === Math.round((pendingOf(a4) - 1000) * 100));
  fake.complete(r.j.orderId);
  await status(T.pa, r.j.orderId);
  a4After = await ledger(T.pa, KID_A, a4.id);
  check('Paid in full: PAID, collected = the bill', a4After.status === 'PAID' && Number(a4After.paidAmount) === Number(a4.paidAmount || 0) + pendingOf(a4));
  r = await create(T.pa, { studentId: KID_A, payAll: true });
  check('"Pay full" stays blocked while the wrong-amount order (which includes a bill) is unresolved', r.s === 409, r.s);
  fake.fail(o7); // PhonePe later ends that order as failed
  await status(T.pa, o7);
  r = await create(T.pa, { studentId: KID_A, payAll: true, amount: 1 });
  const all = (await ledgers(T.pa, KID_A)).filter((l) => pendingOf(l) > 0);
  const allPaise = all.reduce((s, l) => s + Math.round(pendingOf(l) * 100), 0);
  check('Pay full: the server\'s own total of every open bill (a client amount is ignored)', r.s === 200 && r.j.payAll && r.j.amountPaise === allPaise && r.j.billCount === all.length, `${r.s} ${JSON.stringify(r.j).slice(0, 200)}`);
  fake.complete(r.j.orderId);
  r = await status(T.pa, r.j.orderId);
  check('…one receipt with a breakdown of every bill; nothing owed afterwards', r.j.paymentStatus === 'SUCCESS' && r.j.receipt?.breakdown?.length === all.length && (await ledgers(T.pa, KID_A)).every((l) => pendingOf(l) === 0));

  section('14. Refund through PhonePe');
  r = await call('POST', `/api/payments/phonepe/orders/${o1}/refund`, T.pa, {});
  check('A parent cannot refund', r.s === 403, r.s);
  r = await call('POST', `/api/payments/phonepe/orders/${o2}/refund`, T.admin, {});
  check('A failed payment cannot be refunded', r.s === 400, r.s);
  r = await call('POST', `/api/payments/phonepe/orders/${o1}/refund`, T.admin, {});
  check('Accounts office starts a refund → PhonePe PENDING', r.s === 200 && r.j.refund.state === 'PENDING' && r.j.order.paymentStatus === 'SUCCESS', `${r.s} ${JSON.stringify(r.j).slice(0, 200)}`);
  const refundId = r.j.refund.merchantRefundId;
  r = await call('POST', `/api/payments/phonepe/orders/${o1}/refund`, T.admin, {});
  check('A second refund for the same payment is refused', r.s === 409);
  fake.completeRefund(refundId);
  w = await webhook('pg.refund.completed', { merchantId: 'M', merchantRefundId: refundId, originalMerchantOrderId: o1, amount: 1, state: 'COMPLETED' });
  r = await status(T.pa, o1);
  check('Refund webhook (confirmed with PhonePe) → order REFUNDED; the receipt is kept and marked refunded', w.j?.outcome === 'refund completed' && r.j.paymentStatus === 'REFUNDED' && (await receiptsFor(T.pa, KID_A, o1))[0]?.refundStatus === 'REFUNDED', JSON.stringify([w.j, r.j.paymentStatus]));

  section('15. Records');
  await new Promise((res) => setTimeout(res, 500));
  const onDisk = read('paymentOrders.json');
  check('Payment orders are saved with gateway, lifecycle and attempts (survive a restart)', onDisk.filter((o) => o.gateway === 'PHONEPE' && (o.status === 'SUCCESS' || o.status === 'REFUNDED')).every((o) => o.paymentId && o.history.length >= 2 && o.attempts.length >= 1) && onDisk.some((o) => o.status === 'FAILED') && onDisk.some((o) => o.status === 'CANCELLED'));
  const ids = [...(await call('GET', `/api/fees/payments?studentId=${KID_A}`, T.admin)).j, ...(await call('GET', `/api/fees/payments?studentId=${KID_B}`, T.admin)).j].filter((p) => p.merchantOrderId).map((p) => p.merchantOrderId);
  check('No order appears on two receipts', new Set(ids).size === ids.length, ids.join(','));
  const auditText = JSON.stringify((await call('GET', '/api/audit-logs?limit=400', T.admin)).j);
  check('Audit log has the important events', ['PHONEPE_ORDER_CREATED', 'PHONEPE_PAYMENT_VERIFIED', 'PHONEPE_AMOUNT_MISMATCH', 'PHONEPE_WEBHOOK_REJECTED', 'PHONEPE_REFUND_REQUESTED', 'PHONEPE_ORDER_CANCELLED', 'PHONEPE_ORDER_FAILED'].every((a) => auditText.includes(a)), ['PHONEPE_ORDER_CREATED', 'PHONEPE_PAYMENT_VERIFIED', 'PHONEPE_AMOUNT_MISMATCH', 'PHONEPE_WEBHOOK_REJECTED', 'PHONEPE_REFUND_REQUESTED', 'PHONEPE_ORDER_CANCELLED', 'PHONEPE_ORDER_FAILED'].filter((a) => !auditText.includes(a)).join(','));
  check('No secret ever appears in the audit log', !/TEST_SECRET|whpass|hmacsecret/.test(auditText));
} finally {
  await fake.close();
}
console.log(fail ? `\n${fail} of ${total} FAILED` : `\nAll ${total} checks passed`);
process.exit(fail ? 1 : 0);
