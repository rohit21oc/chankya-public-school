/**
 * Offline checks (no server needed): login throttle behaviour over real HTTP with a stub login route,
 * and the audit policy (noise dropped, secrets redacted, before/after diff).
 * Run from repo root:  npx tsx scripts/verify-login-throttle-and-audit-policy.ts
 */
import express from 'express';
import http from 'node:http';
import { LoginThrottle, createLoginGuard, loginIdentity } from '../server/services/loginThrottle.ts';
import { NOISE_ACTIONS, buildMetadata, categoryOf, diffRecords, redact, shouldRecord } from '../server/services/auditPolicy.ts';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '  — ' + detail}`);
  if (!ok) failed++;
};

// ---------- login throttle over HTTP ----------
const app = express();
app.use(express.json());
const GOOD = 'right-password';
app.post('/api/auth/login', createLoginGuard(new LoginThrottle()), (req, res) => {
  if (!req.body.identifier) return res.status(400).json({ success: false, error: 'Login identifier is required.' });
  if (req.body.password === GOOD) return res.json({ success: true });
  if (req.body.password === 'db-down') return res.status(503).json({ success: false });
  res.status(401).json({ success: false, error: 'Invalid credentials.' });
});
const server = http.createServer(app);
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as any).port;
const login = async (identifier: string, password: string, ip = '10.0.0.1') => {
  const r = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ identifier, password }) });
  return { status: r.status, retry: r.headers.get('retry-after'), body: (await r.json()) as any };
};

for (let i = 0; i < 5; i++) await login('teacher1', 'wrong');
let r = await login('teacher1', 'wrong');
check('6th wrong attempt for one account is blocked with 429', r.status === 429);
check('429 carries Retry-After and a clear message', Number(r.retry) > 0 && /wait/i.test(r.body.error) && r.body.code === 'LOGIN_RATE_LIMITED', JSON.stringify(r.body));
r = await login('teacher1', GOOD);
check('even the right password waits out the cooldown (no guessing through the lock)', r.status === 429);
r = await login('teacher2', GOOD);
check('another account from the same network still logs in', r.status === 200);
r = await login('teacher1', GOOD, '10.0.0.77');
check('the locked account still works from the real owner\'s own network', r.status === 200);

for (let i = 0; i < 4; i++) await login('parent1', 'wrong', '10.1.1.1');
r = await login('parent1', GOOD, '10.1.1.1');
check('a correct login after a few typos succeeds', r.status === 200);
for (let i = 0; i < 4; i++) await login('parent1', 'wrong', '10.1.1.1');
r = await login('parent1', GOOD, '10.1.1.1');
check('and clears the counter (4 more typos do not lock)', r.status === 200);

for (let i = 0; i < 30; i++) await login(`ok-user-${i}`, GOOD, '10.2.2.2');
check('many different people succeeding behind one Wi-Fi is never blocked', (await login('ok-user-x', GOOD, '10.2.2.2')).status === 200);

for (let i = 0; i < 10; i++) await login('x', 'db-down', '10.3.3.3');
check('server-side errors (503) are not counted against the user', (await login('x', GOOD, '10.3.3.3')).status === 200);
check('a missing identifier is a 400 and is not counted', (await login('', 'x', '10.4.4.4')).status === 400);

for (let i = 0; i < 30; i++) await login(`guess-${i}`, 'wrong', '10.5.5.5');
check('guessing many different accounts from one network gets that network paused', (await login('someone-new', GOOD, '10.5.5.5')).status === 429);
check('without hurting other networks', (await login('someone-new', GOOD, '10.5.5.6')).status === 200);

// cooldown doubles on repeat, and expires
const t = new LoginThrottle();
const T0 = 1_000_000;
for (let i = 0; i < 5; i++) t.recordFailure('ip', 'acct', T0);
const first = t.check('ip', 'acct', T0 + 1000);
check('first lock is about a minute', first.blocked && first.retryAfterSec >= 58 && first.retryAfterSec <= 60);
check('lock ends after the cooldown', !t.check('ip', 'acct', T0 + 61_000).blocked);
for (let i = 0; i < 5; i++) t.recordFailure('ip', 'acct', T0 + 62_000);
const second = t.check('ip', 'acct', T0 + 63_000);
check('second lock is longer (doubles)', second.blocked && second.retryAfterSec > 100);
check('identity: phone formats collapse, text is lower-cased', loginIdentity({ identifier: '+91 98765-43210' }) === '9876543210' && loginIdentity({ identifier: 'CPS0002' }) === 'cps0002');
server.close();

// ---------- audit policy ----------
check('routine actions are not recorded', ['USER_LOGIN', 'USER_LOGOUT', 'ATTENDANCE_SCANNED', 'REPORT_VIEWED', 'MARKS_DRAFT_SAVED'].every((a) => !shouldRecord({ userName: 'a', action: a, entityId: 'e' }, [], 0)));
check('critical actions are recorded', ['FEE_PAYMENT_COLLECTED', 'EXAM_DELETED', 'STUDENT_DELETE', 'FEE_REFUND_PROCESSED', 'EXAM_UPDATED'].every((a) => shouldRecord({ userName: 'a', action: a, entityId: 'e' }, [], 0)));
const recent = [{ userName: 'u1', action: 'LOGIN_FAILED', entityId: 'x', at: 1000 }];
check('repeated failed logins collapse to one entry per person per 10 min', !shouldRecord({ userName: 'u1', action: 'LOGIN_FAILED', entityId: 'y' }, recent, 1000 + 5 * 60000) && shouldRecord({ userName: 'u1', action: 'LOGIN_FAILED', entityId: 'y' }, recent, 1000 + 11 * 60000) && shouldRecord({ userName: 'u2', action: 'LOGIN_FAILED', entityId: 'y' }, recent, 2000));
const rec2 = [{ userName: 'u1', action: 'STUDENT_UPDATED', entityId: 's1', at: 5000 }];
check('a browser-reported entry about a record the server just logged is a duplicate', !shouldRecord({ userName: 'u1', action: 'STUDENT_UPDATE', entityId: 's1' }, rec2, 6000, true) && shouldRecord({ userName: 'u1', action: 'STUDENT_UPDATE', entityId: 's1' }, rec2, 6000, false));

const secret = redact({ name: 'A', password: 'p', newPassword: 'n', passwordHash: 'h', token: 't', authToken: 'x', apiKey: 'k', nested: { otp: '1', resetToken: 'r', ok: 1 }, long: 'x'.repeat(500) });
check('passwords, tokens, hashes and keys are redacted, other fields kept', secret.password === '[redacted]' && secret.newPassword === '[redacted]' && secret.passwordHash === '[redacted]' && secret.token === '[redacted]' && secret.authToken === '[redacted]' && secret.apiKey === '[redacted]' && secret.nested.otp === '[redacted]' && secret.nested.resetToken === '[redacted]' && secret.nested.ok === 1 && secret.name === 'A');
check('long text is shortened', secret.long.length < 400);
const d = diffRecords({ amount: 100, dueDate: '2026-11-01', password: 'a', updatedAt: 1 }, { amount: 120, dueDate: '2026-11-01', password: 'b', updatedAt: 2 });
check('before/after keeps only what changed (and hides secrets)', Object.keys(d).sort().join() === 'amount,password' && d.amount.from === 100 && d.amount.to === 120 && d.password.to === '[redacted]');
const meta = buildMetadata('EXAM_UPDATED', 'Exam', { actorId: 'u1', before: { startDate: '2026-11-15' }, after: { startDate: '2026-11-18' } });
check('metadata has category, severity, actor and the change', meta.category === 'EXAM' && meta.severity === 'critical' && meta.actorId === 'u1' && meta.changes.startDate.to === '2026-11-18' && meta.before.startDate === '2026-11-15');
check('categories: deletion, finance, exam', categoryOf('USER_DELETED', 'Staff') === 'DATA_DELETION' && categoryOf('FEE_WAIVER_GRANTED', 'FeeLedger') === 'FINANCE' && categoryOf('EXAM_CREATED', 'Exam') === 'EXAM');
check('noise list does not swallow essential actions', !['FEE_PAYMENT_COLLECTED', 'EXAM_DELETED', 'MARKS_SUBMITTED', 'USER_DELETED'].some((a) => NOISE_ACTIONS.has(a)));

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll login throttle and audit policy checks passed.');
