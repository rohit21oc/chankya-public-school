/**
 * Security regression checks for the website Parent Portal.
 *
 * Starts the real backend (server.ts) in a child process with a random, per-run
 * JWT signing secret and checks:
 *   1. Signed-out access to children's personal records is rejected.
 *   2. Parent authentication: forged / tampered tokens are rejected.
 *   3. A parent sees only their own children, everywhere.
 *   4. Another family's child is refused by ID on every endpoint (URL tampering).
 *   5. Fees privacy and fee-mutation guards.
 *   6. Multiple-child switching (own child allowed, other family refused).
 *   7. Report-card authorization and the public single-result lookup.
 *   8. Realtime events carry no personal data.
 *   9. Staff access still works.
 *
 * Parent identities come from repository seed data (IDs only, never credentials).
 * Writes are sent only as admin to set up one published result, plus denied
 * requests. data/ is snapshotted before the run and restored afterwards.
 * No phone number, date of birth or token is printed.
 *
 * Run: npm run verify:parent-portal
 */
import { spawn, ChildProcess } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const JWT_SECRET = crypto.randomBytes(32).toString('hex');

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}${detail ? ` (${detail})` : ''}`); }
};

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
function signToken(payload: Record<string, unknown>, secret = JWT_SECRET): string {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

async function call(method: string, p: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, text, json };
}
const rows = (json: any): any[] => {
  if (Array.isArray(json)) return json;
  for (const k of ['data', 'records', 'ledgers', 'payments', 'marks']) if (Array.isArray(json?.[k])) return json[k];
  return [];
};

// ---------- data snapshot ----------
function snapshotData(): Map<string, Buffer> {
  const snap = new Map<string, Buffer>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else snap.set(p, fs.readFileSync(p));
    }
  };
  walk(DATA_DIR);
  return snap;
}
function restoreData(snap: Map<string, Buffer>) {
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (!snap.has(p)) fs.unlinkSync(p);
    }
  };
  walk(DATA_DIR);
  for (const [p, buf] of snap) fs.writeFileSync(p, buf);
}

async function waitForHealth(timeoutMs = 150000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return true; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

// ---------- fixtures from seed data (IDs only) ----------
function loadFixtures() {
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
  const students: any[] = read('students.json');
  const accounts: any[] = read('parentAccounts.json');
  const exams: any[] = read('exams.json');
  const marks: any[] = read('examMarks.json');
  const byId = new Map(students.map((s) => [s.id, s]));
  const famA = accounts.find((p) => (p.studentIds || []).length >= 2 && p.studentIds.every((id: string) => byId.has(id)));
  const aIds = new Set<string>(famA.studentIds);
  const famB = accounts.find((p) => p !== famA && (p.studentIds || []).length >= 1 && p.studentIds.every((id: string) => byId.has(id) && !aIds.has(id)));
  // A child of family B that has marks, so report-card checks have something to refuse.
  const bWithMarks = famB.studentIds.find((id: string) => marks.some((m) => m.studentId === id)) || famB.studentIds[0];
  // An exam with marks, used to publish one result for the public lookup check.
  const markForLookup = marks.find((m) => byId.has(m.studentId));
  const draftExam = exams.find((e) => e.status === 'DRAFT');
  return { students, byId, famA, famB, bWithMarks, markForLookup, draftExam };
}

async function main() {
  console.log('\n=== Parent portal security checks ===');
  const snap = snapshotData();
  const fx = loadFixtures();
  const aIds = new Set<string>(fx.famA.studentIds);
  const bIds = new Set<string>(fx.famB.studentIds);
  const [a1, a2] = fx.famA.studentIds as string[];
  const b1 = fx.bWithMarks as string;

  const parentA = signToken({ userId: fx.famA.id, role: 'PARENT', studentId: a1, activeStudentId: a1, linkedStudentIds: [...aIds] });
  const admin = signToken({ userId: 'admin-test', role: 'SUPER_ADMIN' });
  const accountant = signToken({ userId: 'acct-test', role: 'ACCOUNTANT' });
  const forged = signToken({ userId: fx.famA.id, role: 'PARENT', linkedStudentIds: [...aIds, b1] }, 'not-the-server-secret');

  let server: ChildProcess | null = null;
  try {
    server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server.ts'], {
      cwd: ROOT,
      env: { ...process.env, JWT_SECRET, NODE_ENV: 'development', DISABLE_HMR: 'true', MONGODB_URI: '' },
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: true,
    });
    if (!(await waitForHealth())) throw new Error(`Backend did not become healthy on port ${PORT}.`);

    const personalPaths = [
      '/api/students', `/api/students/${a1}`, `/api/students/${a1}/id-card`,
      '/api/attendance', `/api/attendance?studentId=${a1}`, `/api/attendance/student-calendar/${a1}`,
      '/api/fee-ledgers', `/api/fee-ledgers/student/${a1}`, `/api/fees/student/${a1}`,
      '/api/fees/payments', '/api/fee-payments', '/api/marks', '/api/exam-marks', '/api/exams/marks',
    ];

    console.log('\n-- 1. Signed-out access to personal records is rejected');
    for (const p of personalPaths) {
      const r = await call('GET', p);
      check(`signed-out GET ${p.replace(a1, '<child>')} -> 401`, r.status === 401, `got ${r.status}`);
    }

    console.log('\n-- 2. Parent authentication');
    const f = await call('GET', '/api/students', forged);
    check('token signed with another secret -> 401', f.status === 401, `got ${f.status}`);
    const tampered = parentA.slice(0, -4) + (parentA.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    check('tampered parent token -> 401', (await call('GET', '/api/students', tampered)).status === 401);
    const me = await call('GET', '/api/students', parentA);
    check('valid parent token -> 200', me.status === 200, `got ${me.status}`);

    console.log('\n-- 3. A parent sees only their own children');
    const ownLists: Array<[string, string]> = [
      ['students', '/api/students?limit=2000'], ['attendance', '/api/attendance'], ['fee ledgers', '/api/fee-ledgers'],
      ['fee payments', '/api/fee-payments'], ['marks', '/api/marks'], ['exam-marks', '/api/exam-marks'],
    ];
    for (const [label, p] of ownLists) {
      const r = await call('GET', p, parentA);
      const ids = rows(r.json).map((x) => x.studentId || (label === 'students' ? x.id : undefined)).filter(Boolean);
      check(`${label}: 200 and only own children`, r.status === 200 && ids.every((id) => aIds.has(id)), `status ${r.status}, foreign rows ${ids.filter((id) => !aIds.has(id)).length}`);
    }
    const own = await call('GET', '/api/students?limit=2000', parentA);
    check('both linked children are returned', rows(own.json).filter((s) => aIds.has(s.id)).length === aIds.size);

    console.log('\n-- 4. Another family\'s child is refused by ID (URL tampering)');
    const byIdPaths = [
      `/api/students/${b1}`, `/api/students/${b1}/id-card`, `/api/attendance?studentId=${b1}`,
      `/api/attendance/student-calendar/${b1}`, `/api/fee-ledgers/student/${b1}`, `/api/fees/student/${b1}`,
      `/api/fee-ledgers?studentId=${b1}`, `/api/fee-payments?studentId=${b1}`, `/api/marks?studentId=${b1}`,
    ];
    for (const p of byIdPaths) {
      const r = await call('GET', p, parentA);
      const leaked = rows(r.json).some((x) => bIds.has(x.studentId) || bIds.has(x.id)) || (r.json && bIds.has(r.json.id));
      check(`parent GET ${p.replace(b1, '<other child>')} -> refused`, r.status === 403 || (r.status === 200 && !leaked && rows(r.json).length === 0), `got ${r.status}${leaked ? ', leaked rows' : ''}`);
    }

    console.log('\n-- 5. Fees privacy and fee-mutation guards');
    const led = await call('GET', `/api/fee-ledgers/student/${a1}`, parentA);
    check('own fee ledgers -> 200', led.status === 200);
    for (const [m, p] of [
      ['POST', `/api/fee-ledgers/student/${a1}/pay-full`], ['POST', '/api/fees/payments'],
      ['POST', `/api/fee-ledgers/student/${a1}/generate-monthly`], ['POST', '/api/fee-ledgers/run-engine'],
      ['POST', '/api/fee-ledgers/audit-reconcile'], ['POST', '/api/fee-ledgers/generate-monthly'],
    ] as const) {
      const r = await call(m, p, undefined, { amountPaid: 1 });
      check(`signed-out ${m} ${p.replace(a1, '<child>')} -> 401`, r.status === 401, `got ${r.status}`);
    }
    const pp = await call('POST', `/api/fee-ledgers/student/${a1}/pay-full`, parentA, { amountPaid: 1 });
    check('parent cannot record a fee payment -> 403', pp.status === 403, `got ${pp.status}`);

    console.log('\n-- 6. Multiple-child switching');
    const sw = await call('POST', '/api/auth/switch-child', parentA, { studentId: a2 });
    check('switch to own second child -> 200', sw.status === 200, `got ${sw.status}`);
    check('active child is the requested one', sw.json?.user?.activeStudentId === a2 || sw.json?.user?.studentId === a2);
    const swBad = await call('POST', '/api/auth/switch-child', parentA, { studentId: b1 });
    check('switch to another family\'s child -> 403', swBad.status === 403, `got ${swBad.status}`);
    const newToken = sw.json?.token || parentA;
    const afterSwitch = await call('GET', '/api/students?limit=2000', newToken);
    check('after switching, still only own children', rows(afterSwitch.json).every((s) => aIds.has(s.id)));

    console.log('\n-- 7. Report-card authorization and public result lookup');
    const bMarks = await call('GET', `/api/marks?studentId=${b1}`, parentA);
    check('marks of another family\'s child -> 403', bMarks.status === 403, `got ${bMarks.status}`);
    const allMarks = rows((await call('GET', '/api/marks', parentA)).json);
    check('unfiltered marks contain no other family', allMarks.every((m) => aIds.has(m.studentId)));
    if (fx.draftExam) {
      check('no marks from a DRAFT exam reach the parent', allMarks.every((m) => m.examId !== fx.draftExam.id));
    }
    const m = fx.markForLookup;
    const lookupStudent = fx.byId.get(m.studentId);
    const unpub = await call('GET', `/api/public/results/lookup?examId=${encodeURIComponent(m.examId)}&query=${encodeURIComponent(lookupStudent.admissionNumber)}`);
    const pubAlready = unpub.status === 200;
    if (!pubAlready) check('lookup for an unpublished exam -> 404', unpub.status === 404, `got ${unpub.status}`);
    const pubRes = await call('POST', `/api/exams/${encodeURIComponent(m.examId)}/publish-results`, admin, { status: 'PUBLISHED', resultsStatus: 'PUBLISHED' });
    check('admin can publish results (setup)', pubRes.status === 200, `got ${pubRes.status}`);
    const q = `/api/public/results/lookup?examId=${encodeURIComponent(m.examId)}&query=${encodeURIComponent(lookupStudent.admissionNumber)}`;
    const noDob = await call('GET', q);
    check('public lookup without DOB -> 200 with marks', noDob.status === 200 && Array.isArray(noDob.json?.marks) && noDob.json.marks.length > 0, `got ${noDob.status}`);
    check('no DOB: no date of birth or parent names returned', !noDob.json?.student?.dob && !noDob.json?.student?.fatherName && !noDob.json?.student?.motherName);
    check('lookup never returns phone, Aadhaar or address', !/aadhaar|mobile|phone|address/i.test(Object.keys(noDob.json?.student || {}).join(',')));
    check('lookup marks carry no student id', (noDob.json?.marks || []).every((x: any) => !('studentId' in x)));
    check('lookup marks belong to the requested exam only', (noDob.json?.marks || []).every((x: any) => x.examId === m.examId));
    const wrong = await call('GET', `${q}&dob=1990-01-01`);
    check('wrong DOB: not verified, DOB not returned', wrong.json?.dobVerified === false && !wrong.json?.student?.dob);
    const right = await call('GET', `${q}&dob=${encodeURIComponent(lookupStudent.dob)}`);
    check('matching DOB: verified', right.json?.dobVerified === true);
    const none = await call('GET', `/api/public/results/lookup?examId=${encodeURIComponent(m.examId)}&query=no-such-student-xyz`);
    check('unknown student -> 404', none.status === 404);

    console.log('\n-- 8. Realtime events carry no personal data');
    const target = fx.students.find((s) => aIds.has(s.id));
    const upd = await call('PATCH', `/api/students/${target.id}`, admin, { remarks: 'parent-portal security check' });
    check('admin student update (setup)', upd.status === 200, `got ${upd.status}`);
    const poll = await call('GET', '/api/realtime/poll');
    const personal = (poll.json?.events || []).filter((e: any) => ['STUDENT', 'FEE', 'FEE_PAYMENT', 'FEE_LEDGER', 'ATTENDANCE', 'EXAM_MARK', 'TEACHER', 'STAFF', 'STAFF_PAYROLL', 'SETTINGS'].includes(e.entity));
    check('poll returned the student event', personal.some((e: any) => e.entity === 'STUDENT'));
    check('personal events carry no fields beyond id', personal.filter((e: any) => e.entity !== 'SETTINGS').every((e: any) => !e.data || Object.keys(e.data).every((k) => k === 'id')));
    check('personal events carry no description', personal.filter((e: any) => e.entity !== 'SETTINGS').every((e: any) => !e.description));
    check('settings events carry only session fields', personal.filter((e: any) => e.entity === 'SETTINGS').every((e: any) => Object.keys(e.data || {}).every((k) => ['currentAcademicSession', 'academicSessions'].includes(k))));

    console.log('\n-- 9. Staff access still works');
    const adminStudents = await call('GET', '/api/students?limit=2000', admin);
    check('admin GET /api/students -> 200 with all students', adminStudents.status === 200 && rows(adminStudents.json).length === fx.students.length, `got ${adminStudents.status}, ${rows(adminStudents.json).length}`);
    const acctLedgers = await call('GET', '/api/fee-ledgers', accountant);
    check('accountant GET /api/fee-ledgers -> 200', acctLedgers.status === 200 && rows(acctLedgers.json).length > 0);
    const acctGen = await call('POST', `/api/fee-ledgers/student/${a1}/generate-monthly`, accountant, { monthYear: 'November 2026' });
    check('accountant generate-monthly is not blocked', acctGen.status !== 401 && acctGen.status !== 403, `got ${acctGen.status}`);

    console.log(`\nPARENT PORTAL SECURITY: ${passed} passed, ${failed} failed`);
  } finally {
    if (server && server.pid) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already exited */ }
    }
    await new Promise((r) => setTimeout(r, 1500));
    restoreData(snap);
    console.log('(data/ snapshot restored)');
  }
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Harness error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
