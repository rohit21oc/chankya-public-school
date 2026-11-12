/**
 * Push notifications against a running LOCAL server started with
 *   PUSH_RECORD_FILE=<file> VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... npx tsx server.ts
 * Nothing is sent to Expo or any browser: the server writes each would-be push to PUSH_RECORD_FILE, and this
 * script checks who was (and was not) notified. Uses the dev data in data/*.json and signs its own tokens.
 * Env: BASE_URL (localhost only), JWT_SECRET, PUSH_RECORD_FILE (same path as the server).
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
const teacher = read('staff.json').find((s) => s.id === 't-3');
const parents = read('parentAccounts.json');
const students = read('students.json');
const parentA = parents.find((p) => p.id === 'parent-9876543210');
const parentB = parents.find((p) => p.id === 'parent-9879998877');
const tok = (id, role) => jwt.sign({ userId: id, role }, S, { expiresIn: '15m' });
const T = { admin: tok(admin.id, admin.role), teacher: tok(teacher.id, 'TEACHER'), pa: tok(parentA.id, 'PARENT'), pb: tok(parentB.id, 'PARENT') };

let fail = 0;
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  → ${x}`}`); };
const call = async (method, path, token, body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const recorded = () => (fs.existsSync(REC) ? fs.readFileSync(REC, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const mark = () => recorded().length;
const since = async (n) => { await sleep(500); return recorded().slice(n); };
const who = (lines) => new Set(lines.map((l) => l.userId));

const tokenOf = { admin: 'ExponentPushToken[adminadminadminadmin01]', teacher: 'ExponentPushToken[teacherteacherteach02]', pa: 'ExponentPushToken[parentAparentAparent03]', pb: 'ExponentPushToken[parentBparentBparent04]' };
const idOf = { admin: admin.id, teacher: teacher.id, pa: parentA.id, pb: parentB.id };
const kidA = students.find((s) => s.id === 'st-1');          // Class 1, parent A's child
const kidB = students.find((s) => s.id === 'st-sync-1791205503669'); // Class 2 A, parent B's child
if (!kidA || !kidB) { console.error('Dev data lacks the two students this test uses.'); process.exit(2); }

// ---------- registration ----------
let r = await call('POST', '/api/push/register', null, { kind: 'EXPO', expoToken: tokenOf.pa });
check('Registering without signing in is refused', r.s === 401, r.s);
r = await call('POST', '/api/push/register', T.pa, { kind: 'EXPO', expoToken: 'not-a-token' });
check('A malformed phone token is rejected', r.s === 400, `${r.s}`);
r = await call('POST', '/api/push/register', T.pa, { kind: 'WEB', subscription: { endpoint: 'http://127.0.0.1/x', keys: { p256dh: 'a', auth: 'b' } } });
check('A browser subscription pointing at an internal / non-HTTPS address is rejected', r.s === 400, `${r.s} ${r.j?.error || ''}`);
for (const k of ['admin', 'teacher', 'pa', 'pb']) {
  r = await call('POST', '/api/push/register', T[k], { kind: 'EXPO', expoToken: tokenOf[k], platform: 'android' });
  check(`${k} registers a phone`, r.s === 200, `${r.s} ${r.j?.error || ''}`);
}
const cfg = await call('GET', '/api/push/config', T.pa);
check('Config tells the browser whether web push is on, and gives only the public key', cfg.s === 200 && cfg.j?.web?.enabled === true && typeof cfg.j.web.publicKey === 'string' && !JSON.stringify(cfg.j).includes(process.env.VAPID_PRIVATE_KEY || '\u0000'), JSON.stringify(cfg.j));
r = await call('POST', '/api/push/register', T.pa, { kind: 'WEB', subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/parentA-browser-1', keys: { p256dh: 'BPublicKeyPlaceholder', auth: 'authsecret' } }, platform: 'web' });
check('Parent A also registers a browser', r.s === 200, `${r.s} ${r.j?.error || ''}`);
let st = await call('GET', '/api/push/status', T.pa);
check('Status shows 1 phone + 1 browser for parent A', st.j?.phone === 1 && st.j?.web === 1, JSON.stringify(st.j));

// ---------- chat: school -> parent ----------
let n = mark();
r = await call('POST', `/api/parent-chat/threads/${encodeURIComponent(`${kidA.id}::SCHOOL`)}/messages`, T.admin, { text: 'Please send the form tomorrow' });
check('Office writes to the parent of the child', r.s === 201, `${r.s} ${r.j?.error || ''}`);
let got = await since(n);
check('Only the child\'s parent is notified (phone + browser), not the other parent, teacher or the sender', who(got).size === 1 && who(got).has(idOf.pa) && got.length === 2, JSON.stringify(got.map((g) => [g.userId, g.kind])));
check('The push carries the message text and opens Messages', got[0]?.payload?.body === 'Please send the form tomorrow' && got[0]?.payload?.url === '/messages' && got[0]?.payload?.type === 'MESSAGE');
check('The push data holds only ids', JSON.stringify(Object.keys(got[0]?.payload?.data || {}).sort()) === JSON.stringify(['studentId', 'threadId']));

// ---------- chat: parent -> office ----------
n = mark();
r = await call('POST', `/api/parent-chat/threads/${encodeURIComponent(`${kidA.id}::SCHOOL`)}/messages`, T.pa, { text: 'Will do, thank you' });
check('Parent replies to the school office', r.s === 201, `${r.s} ${r.j?.error || ''}`);
got = await since(n);
check('Admin is notified; the parent themselves, the other parent and the teacher are not', who(got).has(idOf.admin) && !who(got).has(idOf.pa) && !who(got).has(idOf.pb) && !who(got).has(idOf.teacher), JSON.stringify([...who(got)]));

// ---------- notices ----------
const mk = (title, extra) => call('POST', '/api/notices', T.admin, { title, content: `${title} body`, noticeType: 'GENERAL', status: 'PUBLISHED', ...extra });
const uniq = Date.now();
n = mark();
r = await mk(`Parents meeting ${uniq}`, { targetAudience: 'PARENTS' });
check('Notice for PARENTS is published', r.s === 200 || r.s === 201, `${r.s} ${JSON.stringify(r.j).slice(0, 120)}`);
got = await since(n);
check('PARENTS notice reaches both parents, not the teacher, and not its own author', who(got).has(idOf.pa) && who(got).has(idOf.pb) && !who(got).has(idOf.teacher) && !who(got).has(idOf.admin), JSON.stringify([...who(got)]));

n = mark();
r = await mk(`Staff meeting ${uniq}`, { targetAudience: 'STAFF' });
got = await since(n);
check('STAFF notice reaches the teacher and no parent', who(got).has(idOf.teacher) && !who(got).has(idOf.pa) && !who(got).has(idOf.pb), JSON.stringify([...who(got)]));

n = mark();
r = await mk(`Class 2 outing ${uniq}`, { targetAudience: 'CLASS', targetClass: 'Class 2', targetClassId: 'c-2' });
got = await since(n);
check('A Class 2 notice reaches only the parent of a Class 2 child', who(got).has(idOf.pb) && !who(got).has(idOf.pa), JSON.stringify([...who(got)]) + ' ' + r.s);

n = mark();
r = await mk(`Draft only ${uniq}`, { targetAudience: 'ALL', status: 'DRAFT' });
got = await since(n);
check('A draft notice notifies nobody', got.length === 0, JSON.stringify(got.length));
const draftId = r.j?.id || r.j?.notice?.id;
if (draftId) {
  n = mark();
  r = await call('PUT', `/api/notices/${draftId}`, T.admin, { status: 'PUBLISHED' });
  got = await since(n);
  check('Publishing the draft later notifies the audience', r.s === 200 && who(got).has(idOf.pa) && who(got).has(idOf.pb), `${r.s} ${JSON.stringify([...who(got)])}`);
}

// ---------- homework ----------
n = mark();
const today = new Date().toISOString().slice(0, 10);
const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const subs = (await call('GET', '/api/classes/c-2/subjects', T.admin)).j;
const sub = (Array.isArray(subs) ? subs : subs?.subjects || [])[0];
r = await call('POST', '/api/homework', T.admin, { classId: 'c-2', section: 'A', subjectId: sub?.id, subjectName: sub?.name, title: `Chapter 3 ${uniq}`, description: 'Read and write', assignedDate: today, dueDate: due });
check('Homework for Class 2 A is assigned', r.s === 201, `${r.s} ${JSON.stringify(r.j).slice(0, 160)}`);
got = await since(n);
check('Only the parent of a Class 2 A child is notified of the homework', who(got).has(idOf.pb) && !who(got).has(idOf.pa) && got[0]?.payload?.url === '/homework', JSON.stringify([...who(got)]));

// ---------- fee due ----------
const dueKid = parentA.studentIds.map((id) => students.find((s) => s.id === id)).filter(Boolean);
n = mark();
r = await call('POST', '/api/fee-dues/notify', T.admin, { studentIds: dueKid.map((s) => s.id) });
got = await since(n);
if (r.j?.sent > 0) check('A fee reminder notifies only the parent of that child', who(got).has(idOf.pa) && !who(got).has(idOf.pb) && /Rs\.\d+ pending/.test(got[0]?.payload?.body || ''), JSON.stringify([...who(got)]));
else console.log('SKIP  fee reminder (no pending dues in the dev data for parent A\'s children)');

// ---------- self test + unregister ----------
n = mark();
r = await call('POST', '/api/push/test', T.pa);
got = await since(n);
check('"Send me a test" reaches only my own devices', r.s === 200 && got.length === 2 && who(got).size === 1 && who(got).has(idOf.pa), `${r.s} ${JSON.stringify(r.j)}`);
r = await call('POST', '/api/push/test', T.pa);
check('A second test right away is rate limited', r.s === 429, r.s);
r = await call('POST', '/api/push/unregister', T.pb, { expoToken: tokenOf.pa });
st = await call('GET', '/api/push/status', T.pa);
check('Another login cannot remove my device', r.j?.removed === 0 && st.j?.phone === 1, JSON.stringify([r.j, st.j]));
r = await call('POST', '/api/push/unregister', T.pa, { expoToken: tokenOf.pa });
st = await call('GET', '/api/push/status', T.pa);
check('Signing out removes my phone', r.j?.removed === 1 && st.j?.phone === 0 && st.j?.web === 1, JSON.stringify([r.j, st.j]));
n = mark();
await call('POST', `/api/parent-chat/threads/${encodeURIComponent(`${kidA.id}::SCHOOL`)}/messages`, T.admin, { text: 'After sign out' });
got = await since(n);
check('After sign-out only the browser still gets the push', got.length === 1 && got[0].kind === 'WEB', JSON.stringify(got.map((g) => g.kind)));

console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll push checks passed.');
process.exit(fail ? 1 : 0);
