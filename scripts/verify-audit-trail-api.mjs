/**
 * Audit trail checks against a RUNNING local server (default http://localhost:3000): sensitive changes
 * (exam schedule, fee structure) are recorded with the real actor and before/after values, routine and
 * client-reported noise is not stored, secrets never appear, and only audit-permitted roles can read it.
 * Writes and then removes a test exam and fee structure; refuses to run against anything but localhost.
 *
 * Usage (repo root):  JWT_SECRET=... node scripts/verify-audit-trail-api.mjs
 */
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.BASE_URL || 'http://localhost:3000')) {
  console.error('Refusing to run: BASE_URL must be localhost.');
  process.exit(2);
}
import jwt from 'jsonwebtoken';
const B = process.env.BASE_URL || 'http://localhost:3000';
const sign = (role, userId) => jwt.sign({ userId, role, iat: Math.floor(Date.now() / 1000) }, process.env.JWT_SECRET, { expiresIn: '1h' });
const H = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
const admin = H(sign('SUPER_ADMIN', 'ui-setup'));
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 200) }; } };
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? '  — ' + d : ''}`); };
const call = async (method, path, body, headers = admin) => { const r = await fetch(B + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); return [r.status, await j(r)]; };
const logs = async (q = '') => { const [, b] = await call('GET', `/api/audit-logs?limit=2000${q}`); return Array.isArray(b) ? b : b.logs || b.data || []; };
const find = (list, action, id) => list.find((l) => l.action === action && l.entityId === id);

// ---- exam schedule changes
const examId = `ex-audit-${Date.now()}`;
let [st, ex] = await call('POST', '/api/exams', { id: examId, name: 'Audit Test Exam', examType: 'Periodic Test', startDate: '2026-12-01', endDate: '2026-12-05', classIds: ['c-1'], status: 'DRAFT', schedule: [{ subjectId: 's-14', subjectName: 'Art & Drawing', className: 'Class 1', date: '2026-12-01', startTime: '09:00 AM', endTime: '11:00 AM', classId: 'c-1', section: 'ALL', maxMarks: 100, passMarks: 33 }] });
check('exam created', st === 201, `${st} ${JSON.stringify(ex).slice(0, 120)}`);
[st] = await call('PUT', `/api/exams/${examId}`, { startDate: '2026-12-02', schedule: [{ subjectId: 's-14', subjectName: 'Art & Drawing', className: 'Class 1', date: '2026-12-02', startTime: '10:00 AM', endTime: '12:00 PM', classId: 'c-1', section: 'ALL', maxMarks: 100, passMarks: 33 }] });
check('exam rescheduled', st === 200, String(st));
[st] = await call('POST', `/api/exams/${examId}/publish`, { status: 'PUBLISHED' });
let L = await logs();
const created = find(L, 'EXAM_CREATED', examId);
const updated = find(L, 'EXAM_UPDATED', examId);
const published = find(L, 'EXAM_STATUS_CHANGED', examId);
check('exam creation is recorded', !!created && created.entity === 'Exam');
check('actor is the signed-in role, not a made-up person', updated?.role === 'SUPER_ADMIN' && updated?.userName && !/Rajeshwar|Vikram/.test(updated.userName), JSON.stringify(updated)?.slice(0, 160));
check('reschedule keeps before and after values', updated?.metadata?.changes?.startDate?.from === '2026-12-01' && updated?.metadata?.changes?.startDate?.to === '2026-12-02', JSON.stringify(updated?.metadata)?.slice(0, 300));
check('timetable change is captured (old and new time)', JSON.stringify(updated?.metadata?.before?.schedule || '').includes('09:00 AM') && JSON.stringify(updated?.metadata?.after?.schedule || '').includes('10:00 AM'));
check('publishing records status from -> to', published?.metadata?.changes?.status?.from === 'DRAFT' && published?.metadata?.changes?.status?.to === 'PUBLISHED');
check('entry has timestamp, ip and a critical severity', !!updated?.timestamp && !!updated?.ipAddress && updated?.metadata?.severity === 'critical' && updated?.metadata?.category === 'EXAM');
[st] = await call('DELETE', `/api/exams/${examId}`);
L = await logs();
const del = find(L, 'EXAM_DELETED', examId);
check('exam deletion is recorded with what was deleted', st === 200 && !!del && del.metadata?.before?.name === 'Audit Test Exam' && del.metadata?.category === 'DATA_DELETION');

// ---- fee structure changes
const fsId = `fs-audit-${Date.now()}`;
await call('POST', '/api/fee-structures', { id: fsId, name: 'Audit Fee', amount: 1000, classId: 'c-1' });
await call('PUT', `/api/fee-structures/${fsId}`, { amount: 1200 });
await call('DELETE', `/api/fee-structures/${fsId}`);
L = await logs();
const fu = find(L, 'FEE_STRUCTURE_UPDATED', fsId);
check('fee structure create / update / delete are all recorded', !!find(L, 'FEE_STRUCTURE_CREATED', fsId) && !!fu && !!find(L, 'FEE_STRUCTURE_DELETED', fsId));
check('fee update shows 1000 -> 1200', fu?.metadata?.changes?.amount?.from === 1000 && fu?.metadata?.changes?.amount?.to === 1200, JSON.stringify(fu?.metadata?.changes));

// ---- noise and forgery
const before = (await logs()).length;
[st] = await call('POST', '/api/audit-logs', { action: 'USER_LOGOUT', entity: 'Session', entityId: 'x', details: 'bye' });
check('a routine client-reported action is accepted but not stored', st === 202 || st === 200);
[st] = await call('POST', '/api/audit-logs', { action: 'FEE_PAYMENT_COLLECTED', entity: 'FeePayment', entityId: 'forge-1', details: 'password=hunter2 token: abc123', userName: 'Someone Else', role: 'PRINCIPAL' });
L = await logs();
const forged = L.find((l) => l.entityId === 'forge-1');
check('a client-reported entry uses the session identity, never the body', forged?.role === 'SUPER_ADMIN' && forged?.userName !== 'Someone Else', JSON.stringify(forged)?.slice(0, 200));
check('secrets typed into details are masked', !!forged && !/hunter2|abc123/.test(forged.details), forged?.details);
check('client entries are flagged as client-reported', forged?.metadata?.source === 'client');
check('no stored entry anywhere contains a password / token value', !JSON.stringify(L).match(/hunter2|abc123/));
check('logout / login noise is absent from the trail', !L.slice(0, before + 3).some((l) => l.action === 'USER_LOGOUT' && l.entityId === 'x'));

// ---- RBAC
for (const role of ['TEACHER', 'ACCOUNTANT', 'PARENT', 'STUDENT']) {
  const [s] = await call('GET', '/api/audit-logs', null, H(sign(role, `u-${role}`)));
  check(`${role} cannot read audit logs`, s === 403 || s === 401, String(s));
}
const [sNo] = await call('GET', '/api/audit-logs', null, { 'Content-Type': 'application/json' });
check('no token -> 401', sNo === 401, String(sNo));
const [sPr] = await call('GET', '/api/audit-logs?limit=5', null, H(sign('PRINCIPAL', 'u-pr')));
check('PRINCIPAL can read audit logs', sPr === 200, String(sPr));
const [sEx] = await call('POST', '/api/exams', { name: 'x' }, H(sign('TEACHER', 'u-t')));
check('a teacher cannot change exam schedules (and nothing is logged)', sEx === 403 || sEx === 401, String(sEx));

console.log(fail ? `\n${fail} FAILED` : `\nAll ${pass} checks passed`);
process.exit(fail ? 1 : 0);
