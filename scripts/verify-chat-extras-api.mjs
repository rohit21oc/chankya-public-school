/**
 * Messages extras against a LOCAL server (started with PUSH_RECORD_FILE, see verify-push-api.mjs):
 * photos in chat lists, the parent card staff see (mobile, photo, children), fee-reminder search fields,
 * and the Emergency message (who may send, who receives, one phone alert per parent).
 *   PUSH_RECORD_FILE=/tmp/push.jsonl node dist/server.cjs   then   PUSH_RECORD_FILE=/tmp/push.jsonl node scripts/verify-chat-extras-api.mjs
 * Restore the dev data afterwards:  git checkout -- data; git clean -fdq data
 */
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('Refusing to run: BASE_URL must be localhost.'); process.exit(2); }
const REC = process.env.PUSH_RECORD_FILE;
if (!REC) { console.error('Set PUSH_RECORD_FILE to the same file the server was started with.'); process.exit(2); }
const S = process.env.JWT_SECRET || 'residential_cps_sheohar_jwt_production_secret_key_2026';
const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));

const admin = read('adminAccounts.json').find((a) => a.role === 'SUPER_ADMIN');
const accountant = read('staff.json').find((s) => s.role === 'ACCOUNTANT');
const teacher = read('staff.json').find((s) => s.role === 'TEACHER');
const parent = read('parentAccounts.json').find((p) => p.id === 'parent-9876543210');
const students = read('students.json');
const kid = students.find((s) => s.id === 'st-1');
if (!admin || !parent || !kid || !teacher) { console.error('Dev data lacks the accounts this test uses.'); process.exit(2); }
const tok = (id, role) => jwt.sign({ userId: id, role }, S, { expiresIn: '15m' });
const T = { admin: tok(admin.id, admin.role), teacher: tok(teacher.id, 'TEACHER'), parent: tok(parent.id, 'PARENT'), accountant: accountant ? tok(accountant.id, 'ACCOUNTANT') : null };

let fail = 0;
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  → ${x}`}`); };
const call = async (method, path, token, body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const recorded = () => (fs.existsSync(REC) ? fs.readFileSync(REC, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

// ---------- photos + parent card ----------
let r = await call('GET', `/api/parent-chat/start?studentId=${kid.id}`, T.admin);
check('Admin opens a chat with the parents of a student', r.s === 200 && !!r.j?.threadId, r.s);
const tid = r.j?.threadId;
r = await call('GET', `/api/parent-chat/threads/${encodeURIComponent(tid)}/messages`, T.admin);
check('Conversation gives the student photo', r.s === 200 && 'photo' in (r.j?.student || {}) && !!r.j.student.photo, JSON.stringify(r.j?.student));
check('Staff see the parent mobile number', !!r.j?.parent?.phone && r.j.parent.phone.endsWith(parent.phone.slice(-10)), JSON.stringify(r.j?.parent));
check('Staff see all of the parent’s children, this one included', Array.isArray(r.j?.parent?.children) && r.j.parent.children.length > 1 && r.j.parent.children.some((c) => c.id === kid.id), r.j?.parent?.children?.length);
check('Inactive children are left out of the parent card', !r.j?.parent?.children?.some((c) => students.find((s) => s.id === c.id)?.status === 'SUSPENDED'));

await call('POST', `/api/parent-chat/threads/${encodeURIComponent(tid)}/messages`, T.admin, { text: 'Hello from the office' });
r = await call('GET', '/api/parent-chat/threads', T.admin);
const row = (r.j?.data || []).find((t) => t.threadId === tid);
check('Chat list rows carry the student photo', !!row?.studentPhoto, JSON.stringify(row || {}).slice(0, 200));

r = await call('GET', `/api/parent-chat/contacts?studentId=${kid.id}`, T.parent);
const pThread = (r.j?.data || []).find((c) => c.threadId === tid);
check('Parent sees the thread', r.s === 200 && !!pThread, r.s);
r = await call('GET', `/api/parent-chat/threads/${encodeURIComponent(tid)}/messages`, T.parent);
check('Parent side does not get the parent card about themselves', r.s === 200 && r.j?.parent === undefined, JSON.stringify(r.j?.parent));

// ---------- parent sets own profile photo → staff see it in chat ----------
r = await call('PUT', '/api/auth/profile', T.parent, { avatar: 'school/parents/photos/test-parent.png', photo: 'school/parents/photos/test-parent.png' });
check('Parent can save a profile photo', r.s === 200 && r.j?.success !== false, `${r.s} ${r.j?.error || ''}`);
r = await call('GET', `/api/parent-chat/threads/${encodeURIComponent(tid)}/messages`, T.admin);
check('Staff see the parent’s own photo on the parent card', r.j?.parent?.photo === 'school/parents/photos/test-parent.png', JSON.stringify(r.j?.parent?.photo));

// ---------- fee reminders: search fields ----------
if (T.accountant) {
  r = await call('GET', '/api/fee-dues/summary', T.accountant);
  const any = (r.j?.data || [])[0];
  check('Fee reminder rows have photo and father’s name for search', r.s === 200 && !!any && 'studentPhoto' in any && 'fatherName' in any, JSON.stringify(any || {}).slice(0, 200));
}

// ---------- fee reminder: notification text + Pay now button ----------
if (T.accountant) {
  await call('POST', '/api/push/register', T.parent, { kind: 'EXPO', expoToken: 'ExponentPushToken[emergencyparent00001]', platform: 'android' });
  const dues = await call('GET', '/api/fee-dues/summary', T.accountant);
  const mine = (dues.j?.data || []).find((d) => d.studentId === kid.id) || (dues.j?.data || [])[0];
  if (mine) {
    const before = recorded().length;
    r = await call('POST', '/api/fee-dues/notify', T.accountant, { studentIds: [mine.studentId] });
    check('Fee reminder is sent', r.s === 200 && r.j?.sent === 1, `${r.s} ${JSON.stringify(r.j)}`);
    await sleep(500);
    const fee = recorded().slice(before).map((l) => l.payload).find((p) => p.type === 'FEE_DUE');
    check('Fee notification names the child and the amount', !!fee && /Fee payment due/.test(fee.title) && /₹[\d,]+/.test(fee.body), JSON.stringify(fee));
    check('Fee notification carries the Pay now category and the child id', fee?.category === 'fee_due' && fee?.data?.studentId === mine.studentId, JSON.stringify(fee));
    check('Fee notification text has no SMS wording', !/sms/i.test(`${fee?.title} ${fee?.body}`));
  }
}

// ---------- emergency ----------
r = await call('POST', '/api/push/register', T.parent, { kind: 'EXPO', expoToken: 'ExponentPushToken[emergencyparent00001]', platform: 'android' });
check('Parent registers a phone', r.s === 200, r.s);
r = await call('POST', '/api/parent-chat/emergency', T.teacher, { scope: 'ALL', text: 'test' });
check('A teacher cannot send an emergency message', r.s === 403, r.s);
if (T.accountant) {
  r = await call('POST', '/api/parent-chat/emergency', T.accountant, { scope: 'ALL', text: 'test' });
  check('An accountant cannot send an emergency message', r.s === 403, r.s);
}
r = await call('POST', '/api/parent-chat/emergency', T.admin, { scope: 'ALL', text: '   ' });
check('Empty message is refused', r.s === 400, r.s);
r = await call('POST', '/api/parent-chat/emergency', T.admin, { scope: 'CLASS', classIds: [], text: 'x' });
check('Class scope without a class is refused', r.s === 400, r.s);

const activeIn = (cls) => students.filter((s) => (s.classId === cls || s.className === cls) && String(s.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
let n = recorded().length;
r = await call('POST', '/api/parent-chat/emergency', T.admin, { scope: 'CLASS', classIds: ['c-1'], text: 'School closes at 12 today due to rain.' });
check('Admin sends to one class: one message per active student of that class', r.s === 200 && r.j?.sent === activeIn('c-1'), `${r.s} sent=${r.j?.sent} want=${activeIn('c-1')}`);
await sleep(500);
let toParent = recorded().slice(n).filter((l) => l.userId === parent.id);
check('The parent gets exactly one phone alert', toParent.length === 1, toParent.length);

r = await call('GET', `/api/parent-chat/threads/${encodeURIComponent(`${kid.id}::SCHOOL`)}/messages`, T.parent);
check('Parent finds the emergency message in the School office chat', r.s === 200 && (r.j?.data || []).some((m) => m.kind === 'EMERGENCY' && /rain/.test(m.text)), r.s);

n = recorded().length;
const many = students.filter((s) => s.id === kid.id || s.id === 'st-8').map((s) => s.id);
r = await call('POST', '/api/parent-chat/emergency', T.admin, { scope: 'STUDENTS', studentIds: many, text: 'Please call the office.' });
check('Individual students: one message each', r.s === 200 && r.j?.sent === many.length, `${r.s} ${r.j?.sent}`);
await sleep(500);
toParent = recorded().slice(n).filter((l) => l.userId === parent.id);
check('A parent of both picked children still gets one alert', toParent.length === 1, toParent.length);

console.log(fail ? `\n${fail} FAILED` : '\nAll checks passed');
process.exit(fail ? 1 : 0);
