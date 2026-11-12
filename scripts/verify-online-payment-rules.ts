/**
 * Offline checks for the online-payment rules and PhonePe webhook authentication (no server, no network):
 *   npx tsx scripts/verify-online-payment-rules.ts
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  KeyedMutex,
  ORDER_TTL_MS,
  canTransition,
  checkCompletedOrder,
  nextOpenStatus,
  summarizeAttempts,
  transition,
  type PaymentOrderRecord,
} from '../server/services/onlinePayments';

let n = 0;
const t = async (name: string, fn: () => void | Promise<void>) => { await fn(); n++; console.log('PASS', name); };

const order = (o: Partial<PaymentOrderRecord> = {}): PaymentOrderRecord => ({
  id: 'po-1', gateway: 'PHONEPE', orderId: 'PDS-1-a', studentId: 's1', payAll: false, ledgerIds: ['l1'], amountPaise: 225000, currency: 'INR',
  status: 'INITIATED', attempts: [], history: [], createdBy: { userId: 'u', role: 'PARENT', name: 'P' },
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ORDER_TTL_MS).toISOString(), ...o,
});
const done = (o: any = {}) => ({ merchantOrderId: 'PDS-1-a', state: 'COMPLETED', amount: 225000, paymentDetails: [{ transactionId: 'OM1', paymentMode: 'UPI_QR', amount: 225000, state: 'COMPLETED' }], ...o });

await t('only PhonePe COMPLETED for the exact amount, for this order, with a completed transaction passes', () => {
  const ok = checkCompletedOrder(order(), done()) as any;
  assert.equal(ok.ok, true);
  assert.equal(ok.transactionId, 'OM1');
  assert.equal(ok.paymentMode, 'UPI_QR');
  assert.equal((checkCompletedOrder(order(), done({ state: 'PENDING' })) as any).code, 'NOT_COMPLETED');
  assert.equal((checkCompletedOrder(order(), done({ state: 'FAILED' })) as any).code, 'NOT_COMPLETED');
  assert.equal((checkCompletedOrder(order(), done({ amount: 100 })) as any).code, 'AMOUNT_MISMATCH');
  assert.equal((checkCompletedOrder(order(), done({ amount: '225001' })) as any).code, 'AMOUNT_MISMATCH');
  assert.equal((checkCompletedOrder(order(), done({ amount: '225000' })) as any).ok, true, 'amount may arrive as a string');
  assert.equal((checkCompletedOrder(order(), done({ merchantOrderId: 'PDS-OTHER' })) as any).code, 'ORDER_MISMATCH');
  assert.equal((checkCompletedOrder(order(), done({ paymentDetails: [{ transactionId: 'OM1', state: 'FAILED' }] })) as any).code, 'NO_TRANSACTION');
  assert.equal((checkCompletedOrder(order(), null as any) as any).ok, false);
});

await t('SUCCESS can never go back to pending/failed/cancelled; REFUNDED is final', () => {
  for (const to of ['INITIATED', 'PENDING', 'FAILED', 'CANCELLED', 'EXPIRED'] as const) assert.equal(canTransition('SUCCESS', to), false, to);
  assert.equal(canTransition('SUCCESS', 'REFUNDED'), true);
  for (const to of ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED'] as const) assert.equal(canTransition('REFUNDED', to), false, to);
  const s = order({ status: 'SUCCESS' });
  assert.equal(transition(s, 'FAILED', 'x'), s, 'a refused move returns the same record');
});

await t('a late confirmation can still rescue a cancelled / expired / failed order (money is never lost)', () => {
  for (const from of ['FAILED', 'CANCELLED', 'EXPIRED', 'INITIATED', 'PENDING'] as const) assert.equal(canTransition(from, 'SUCCESS'), true, from);
  const moved = transition(order({ status: 'CANCELLED' }), 'SUCCESS', 'late');
  assert.equal(moved.status, 'SUCCESS');
  assert.equal(moved.history.at(-1)?.from, 'CANCELLED');
});

await t('what the payer says can only make an order LESS paid; money on its way is never "cancelled"', () => {
  const none = { state: 'PENDING', paymentDetails: [] };
  assert.equal(nextOpenStatus(order(), none, { payerSaid: 'dismissed' }), 'CANCELLED');
  assert.equal(nextOpenStatus(order(), { state: 'PENDING', paymentDetails: [{ state: 'FAILED' }] }, { payerSaid: 'failed' }), 'FAILED');
  assert.equal(nextOpenStatus(order(), { state: 'PENDING', paymentDetails: [{ state: 'PENDING' }] }, { payerSaid: 'dismissed' }), 'PENDING');
  assert.equal(nextOpenStatus(order(), none), 'INITIATED');
  assert.equal(nextOpenStatus(order(), { state: 'FAILED' }), 'FAILED');
});

await t('an abandoned order expires; a failed attempt alone lets the payer retry; a pending one that failed reopens', () => {
  const old = order({ createdAt: new Date(Date.now() - ORDER_TTL_MS - 1000).toISOString() });
  assert.equal(nextOpenStatus(old, { state: 'PENDING', paymentDetails: [] }), 'EXPIRED');
  assert.equal(nextOpenStatus(order(), { state: 'PENDING', expireAt: Date.now() - 1, paymentDetails: [] }), 'EXPIRED', 'PhonePe expireAt counts too');
  assert.equal(nextOpenStatus(order(), { state: 'PENDING', paymentDetails: [{ state: 'FAILED' }] }), 'INITIATED');
  assert.equal(nextOpenStatus(order({ status: 'PENDING' }), { state: 'PENDING', paymentDetails: [{ state: 'FAILED' }] }), 'INITIATED');
  assert.equal(canTransition('PENDING', 'INITIATED'), true);
  assert.deepEqual(summarizeAttempts({ state: 'PENDING', paymentDetails: [{ state: 'PENDING' }, { state: 'FAILED' }] }), { pending: true, failed: true, anyAttempt: true });
});

await t('KeyedMutex runs tasks for one key strictly one after another (and other keys in parallel)', async () => {
  const m = new KeyedMutex();
  const log: string[] = [];
  const job = (k: string, id: string, ms: number) => m.run(k, async () => { log.push(`start ${id}`); await new Promise((r) => setTimeout(r, ms)); log.push(`end ${id}`); return id; });
  const out = await Promise.all([job('s1', 'a', 30), job('s1', 'b', 1), job('s1', 'c', 1), job('s2', 'x', 1)]);
  assert.deepEqual(out, ['a', 'b', 'c', 'x']);
  assert.deepEqual(log.filter((l) => /[abc]$/.test(l)), ['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  assert.ok(log.indexOf('end x') < log.indexOf('end a'), 'another child is not held up');
  await assert.rejects(m.run('s1', async () => { throw new Error('boom'); }));
  assert.equal(await m.run('s1', async () => 'after'), 'after');
});

await t('PhonePe webhook authentication: SHA256(username:password) or HMAC of the raw body; nothing else', async () => {
  process.env.PHONEPE_CLIENT_ID = 'cid';
  process.env.PHONEPE_CLIENT_SECRET = 'csecret';
  process.env.PHONEPE_WEBHOOK_USERNAME = 'user1';
  process.env.PHONEPE_WEBHOOK_PASSWORD = 'pass1';
  process.env.PHONEPE_WEBHOOK_HMAC_SECRET = 'hkey';
  const pp = await import('../server/services/phonepeService');
  const raw = Buffer.from('{"event":"checkout.order.completed","payload":{}}');
  const sha = crypto.createHash('sha256').update('user1:pass1').digest('hex');
  assert.equal(pp.verifyWebhook({ authorization: sha }, raw), true);
  assert.equal(pp.verifyWebhook({ authorization: sha.toUpperCase() }, raw), true);
  assert.equal(pp.verifyWebhook({ authorization: `SHA256 ${sha}` }, raw), true);
  assert.equal(pp.verifyWebhook({ authorization: crypto.createHash('sha256').update('user1:nope').digest('hex') }, raw), false);
  assert.equal(pp.verifyWebhook({}, raw), false);
  const mac = crypto.createHmac('sha256', 'hkey').update(raw).digest();
  assert.equal(pp.verifyWebhook({ 'x-phonepe-checksum-signature': mac.toString('hex') }, raw), true);
  assert.equal(pp.verifyWebhook({ 'x-phonepe-checksum-signature': mac.toString('base64') }, raw), true);
  assert.equal(pp.verifyWebhook({ 'x-phonepe-checksum-signature': mac.toString('hex') }, Buffer.from(raw.toString() + ' ')), false, 'the raw body must be byte-identical');
  assert.equal(pp.getEnv(), 'sandbox');
  assert.equal(pp.checkoutScriptUrl(), 'https://mercury-stg.phonepe.com/web/bundle/checkout.js');
  assert.equal(pp.isValidMerchantId(pp.newMerchantOrderId()), true);
  assert.equal(pp.isValidMerchantId('bad id!'), false);
  assert.equal(pp.isValidMerchantId('x'.repeat(64)), false);
});

console.log(`\n${n} checks passed`);
