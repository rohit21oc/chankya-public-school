/**
 * Exam alerts on phones: publishing an exam schedule, admit cards and results pushes a notification to parents
 * (once, not on every re-save). Run against a LOCAL server started with PUSH_RECORD_FILE (see verify-push-api.mjs):
 *   PUSH_RECORD_FILE=/tmp/push.jsonl node dist/server.cjs   then   PUSH_RECORD_FILE=/tmp/push.jsonl node scripts/verify-exam-push-api.mjs
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
const parent = read('parentAccounts.json').find((p) => p.id === 'parent-9876543210');
const exam = read('exams.json')[0];
if (!admin || !parent || !exam) { console.error('Dev data lacks an admin, parent or exam.'); process.exit(2); }
const tok = (id, role) => jwt.sign({ userId: id, role }, S, { expiresIn: '15m' });
const A = tok(admin.id, admin.role);
const P = tok(parent.id, 'PARENT');

let fail = 0;
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  → ${x}`}`); };
const call = async (method, path, token, body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const recorded = () => (fs.existsSync(REC) ? fs.readFileSync(REC, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const toParent = async (from) => { await sleep(500); return recorded().slice(from).filter((l) => l.userId === parent.id); };

let r = await call('POST', '/api/push/register', P, { kind: 'EXPO', expoToken: 'ExponentPushToken[examparentexamparent01]', platform: 'android' });
check('Parent registers a phone', r.s === 200, r.s);

// Start from a clean state: everything unpublished.
for (const step of ['publish', 'publish-admit-card', 'publish-results']) await call('POST', `/api/exams/${exam.id}/${step}`, A, { status: 'DRAFT' });

let n = recorded().length;
r = await call('POST', `/api/exams/${exam.id}/publish`, A, { status: 'PUBLISHED' });
let got = await toParent(n);
check('Publishing the exam schedule notifies the parent', r.s === 200 && got.some((l) => /Exam schedule published/.test(l.payload?.title || l.title || JSON.stringify(l))), JSON.stringify(got.slice(0, 1)));

n = recorded().length;
await call('POST', `/api/exams/${exam.id}/publish`, A, { status: 'PUBLISHED' });
got = await toParent(n);
check('Saving the published schedule again does not notify twice', got.length === 0, got.length);

n = recorded().length;
r = await call('POST', `/api/exams/${exam.id}/publish-admit-card`, A, { status: 'PUBLISHED' });
got = await toParent(n);
check('Releasing admit cards notifies the parent', r.s === 200 && got.some((l) => /Admit cards released/.test(JSON.stringify(l))), JSON.stringify(got.slice(0, 1)));

n = recorded().length;
r = await call('POST', `/api/exams/${exam.id}/publish-results`, A, { status: 'PUBLISHED' });
got = await toParent(n);
check('Publishing results notifies the parent', r.s === 200 && got.some((l) => /Result declared/.test(JSON.stringify(l))), JSON.stringify(got.slice(0, 1)));

console.log(fail ? `\n${fail} FAILED` : '\nAll checks passed');
process.exit(fail ? 1 : 0);
