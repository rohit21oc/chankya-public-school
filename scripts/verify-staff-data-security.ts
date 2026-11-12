/**
 * Security regression checks for staff data endpoints.
 *
 * Starts the real backend (server.ts) in a child process with a random, per-run
 * JWT signing secret, then checks authentication, role authorization, cross-teacher
 * isolation and sensitive-field exclusion. Writes are never sent except one
 * denied request. The data/ directory is snapshotted before the run and restored
 * afterwards, because the local backend rewrites JSON files on startup.
 *
 * Secrets are never printed. Failures report field NAMES or check names only.
 *
 * Run: npm run verify:staff-security
 */
import { spawn, ChildProcess } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const BASE = 'http://localhost:3000';
const JWT_SECRET = crypto.randomBytes(32).toString('hex');

// Fixture identities from the repository seed data (not credentials).
const TEACHER_SELF = { userId: 't-1789975305012', employeeId: 'CPS0010' };
const TEACHER_OTHER_ID = 't-2';

const SECRET_KEYS = [
  'passwordHash', 'initialPassword', 'passwordResetToken', 'passwordResetTokenHash',
  'passwordResetExpires', 'passwordResetEmail', 'lockoutUntil', 'failedLoginAttempts', '__v',
];
const FINANCIAL_KEYS = [
  'salary', 'monthlySalary', 'payrollHistory', 'bankAccountNo', 'bankName', 'bankBranch',
  'ifscCode', 'panNumber', 'uanNumber',
];
const DIRECTORY_KEYS = [
  'id', 'employeeId', 'name', 'designation', 'department', 'classTeacherOf',
  'photo', 'photoFileKey', 'status', 'subjectExpertise',
];

// ---------- helpers ----------
let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}${detail ? ` (${detail})` : ''}`); }
};

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
function signToken(payload: Record<string, unknown>): string {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
const TOKENS = {
  superAdmin: signToken({ userId: 'admin-1', role: 'SUPER_ADMIN' }),
  principal: signToken({ userId: 'principal-test', role: 'PRINCIPAL' }),
  hrStaff: signToken({ userId: 'hr-test', role: 'HR_STAFF' }),
  accountant: signToken({ userId: 'acct-test', role: 'ACCOUNTANT' }),
  teacher: signToken({ userId: TEACHER_SELF.userId, employeeId: TEACHER_SELF.employeeId, role: 'TEACHER' }),
  parent: signToken({ userId: 'parent-test', role: 'PARENT' }),
  student: signToken({ userId: 'student-test', role: 'STUDENT' }),
};

async function call(method: string, p: string, token?: string) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${p}`, { method, headers, body: method === 'POST' ? '{}' : undefined });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, text, json };
}

function collectKeys(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => collectKeys(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) { out.add(k); collectKeys(val, out); }
  }
  return out;
}
const rows = (json: any): any[] => (Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []);

// ---------- data snapshot (restore afterwards) ----------
function snapshotData(): Map<string, Buffer> {
  const snap = new Map<string, Buffer>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else snap.set(p, fs.readFileSync(p));
    }
  };
  walk(DATA_DIR);
  return snap;
}
function restoreData(snap: Map<string, Buffer>) {
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (!snap.has(p)) fs.unlinkSync(p);
    }
  };
  walk(DATA_DIR);
  for (const [p, buf] of snap) fs.writeFileSync(p, buf);
}

// Known secret VALUES from seed data, used only to assert they never appear in responses.
function secretValuesFromSeed(): string[] {
  const values = new Set<string>();
  const staff = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'staff.json'), 'utf8'));
  for (const s of staff) {
    for (const k of ['passwordHash', 'initialPassword', 'passwordResetTokenHash']) {
      if (typeof s[k] === 'string' && s[k].length >= 8) values.add(s[k]);
    }
  }
  return [...values];
}

// ---------- server lifecycle ----------
async function waitForHealth(timeoutMs = 120000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function main() {
  console.log('\n=== Staff data security checks ===');
  const snap = snapshotData();
  const secretValues = secretValuesFromSeed();

  let server: ChildProcess | null = null;
  try {
    server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server.ts'], {
      cwd: ROOT,
      env: { ...process.env, JWT_SECRET, NODE_ENV: 'development' },
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: true,
    });
    const up = await waitForHealth();
    if (!up) throw new Error('Backend did not become healthy on port 3000.');

    const bodiesSeen: string[] = [];
    const noSecretsIn = (label: string, text: string) => {
      const hit = secretValues.find((v) => text.includes(v));
      check(`${label}: no secret value in response`, !hit);
      bodiesSeen.push(text);
    };

    console.log('\n-- 1. Unauthenticated access is rejected');
    const unauthPaths = [
      '/api/teachers', '/api/staff', `/api/teachers/${TEACHER_OTHER_ID}`, `/api/staff/${TEACHER_OTHER_ID}`,
      '/api/staff-attendance', `/api/teachers/${TEACHER_OTHER_ID}/id-card`,
      `/api/attendance/staff-calendar/${TEACHER_OTHER_ID}`, '/api/staff-leaves', '/api/staff-payroll',
    ];
    for (const p of unauthPaths) {
      const r = await call('GET', p);
      check(`unauthenticated GET ${p} -> 401`, r.status === 401, `got ${r.status}`);
      if (r.status === 200) noSecretsIn(`unauth ${p}`, r.text);
    }

    console.log('\n-- 2. Teacher: directory list only, no secrets or financial data');
    const tList = await call('GET', '/api/teachers', TOKENS.teacher);
    check('teacher GET /api/teachers -> 200', tList.status === 200, `got ${tList.status}`);
    const tKeys = collectKeys(tList.json);
    check('teacher list has no secret fields', !SECRET_KEYS.some((k) => tKeys.has(k)),
      SECRET_KEYS.filter((k) => tKeys.has(k)).join(','));
    check('teacher list has no financial fields', !FINANCIAL_KEYS.some((k) => tKeys.has(k)),
      FINANCIAL_KEYS.filter((k) => tKeys.has(k)).join(','));
    const nonDirectory = [...tKeys].filter((k) => !DIRECTORY_KEYS.includes(k) && !/^\d+$/.test(k));
    check('teacher list uses directory projection only', nonDirectory.length === 0,
      nonDirectory.slice(0, 8).join(','));
    noSecretsIn('teacher list', tList.text);

    console.log('\n-- 3. Teacher: cross-employee isolation');
    const crossSingle = await call('GET', `/api/teachers/${TEACHER_OTHER_ID}`, TOKENS.teacher);
    check(`teacher GET /api/teachers/${TEACHER_OTHER_ID} (other) -> 403`, crossSingle.status === 403, `got ${crossSingle.status}`);
    const crossStaffAlias = await call('GET', `/api/staff/${TEACHER_OTHER_ID}`, TOKENS.teacher);
    check(`teacher GET /api/staff/${TEACHER_OTHER_ID} (other) -> 403`, crossStaffAlias.status === 403, `got ${crossStaffAlias.status}`);

    const selfSingle = await call('GET', `/api/teachers/${TEACHER_SELF.userId}`, TOKENS.teacher);
    check('teacher GET own record -> 200', selfSingle.status === 200, `got ${selfSingle.status}`);
    const selfKeys = collectKeys(selfSingle.json);
    check('own record has no secret fields', !SECRET_KEYS.some((k) => selfKeys.has(k)));
    check('own record has no financial fields', !FINANCIAL_KEYS.some((k) => selfKeys.has(k)));
    noSecretsIn('teacher own record', selfSingle.text);

    const crossCard = await call('GET', `/api/teachers/${TEACHER_OTHER_ID}/id-card`, TOKENS.teacher);
    check(`teacher ID card of other (${TEACHER_OTHER_ID}) -> 403`, crossCard.status === 403, `got ${crossCard.status}`);
    const ownCard = await call('GET', `/api/teachers/${TEACHER_SELF.userId}/id-card`, TOKENS.teacher);
    check('teacher own ID card -> 200', ownCard.status === 200, `got ${ownCard.status}`);
    const ownCardKeys = collectKeys(ownCard.json);
    check('own ID card has no secret/financial fields',
      !SECRET_KEYS.some((k) => ownCardKeys.has(k)) && !FINANCIAL_KEYS.some((k) => ownCardKeys.has(k)));
    noSecretsIn('teacher own ID card', ownCard.text);

    const crossCal = await call('GET', `/api/attendance/staff-calendar/${TEACHER_OTHER_ID}`, TOKENS.teacher);
    check(`teacher staff calendar of other -> 403`, crossCal.status === 403, `got ${crossCal.status}`);

    console.log('\n-- 4. Teacher: attendance and leave records are own-only');
    const tAtt = await call('GET', '/api/staff-attendance', TOKENS.teacher);
    check('teacher GET /api/staff-attendance -> 200', tAtt.status === 200, `got ${tAtt.status}`);
    const foreignAtt = rows(tAtt.json).filter((r) => r.staffId !== TEACHER_SELF.userId && r.employeeId !== TEACHER_SELF.employeeId);
    check('teacher attendance contains no other staff rows', foreignAtt.length === 0, `${foreignAtt.length} foreign rows`);
    const tAttOther = await call('GET', `/api/staff-attendance?staffId=${TEACHER_OTHER_ID}`, TOKENS.teacher);
    check('teacher attendance filtered to other staff -> 403', tAttOther.status === 403, `got ${tAttOther.status}`);
    const tLeaves = await call('GET', '/api/staff-leaves', TOKENS.teacher);
    const foreignLeaves = rows(tLeaves.json).filter((r) => r.staffId !== TEACHER_SELF.userId && r.employeeId !== TEACHER_SELF.employeeId);
    check('teacher GET /api/staff-leaves returns no other staff rows', tLeaves.status !== 200 || foreignLeaves.length === 0,
      `status ${tLeaves.status}, foreign ${foreignLeaves.length}`);
    const tPay = await call('GET', '/api/staff-payroll', TOKENS.teacher);
    check('teacher GET /api/staff-payroll is not allowed to list all payroll', tPay.status !== 200 || rows(tPay.json).every((r) => r.staffId === TEACHER_SELF.userId || r.employeeId === TEACHER_SELF.employeeId),
      `status ${tPay.status}`);

    console.log('\n-- 5. Teacher and others cannot mark staff attendance');
    const tMark = await call('POST', '/api/staff-attendance', TOKENS.teacher);
    check('teacher POST /api/staff-attendance -> 403', tMark.status === 403, `got ${tMark.status}`);
    const pMark = await call('POST', '/api/staff-attendance', TOKENS.parent);
    check('parent POST /api/staff-attendance -> 403', pMark.status === 403, `got ${pMark.status}`);

    console.log('\n-- 6. Students and parents cannot enumerate staff');
    for (const [label, tok] of [['parent', TOKENS.parent], ['student', TOKENS.student]] as const) {
      const list = await call('GET', '/api/teachers', tok);
      check(`${label} GET /api/teachers -> 403`, list.status === 403, `got ${list.status}`);
      const single = await call('GET', `/api/teachers/${TEACHER_OTHER_ID}`, tok);
      check(`${label} GET /api/teachers/:id -> 403`, single.status === 403, `got ${single.status}`);
    }

    console.log('\n-- 7. Authorized admin workflows still work');
    const aList = await call('GET', '/api/teachers', TOKENS.superAdmin);
    check('super admin GET /api/teachers -> 200 array', aList.status === 200 && Array.isArray(aList.json), `got ${aList.status}`);
    const aKeys = collectKeys(aList.json);
    check('admin list has no secret fields', !SECRET_KEYS.some((k) => aKeys.has(k)), SECRET_KEYS.filter((k) => aKeys.has(k)).join(','));
    check('admin list still includes contact details (phone)', aKeys.has('phone'));
    noSecretsIn('admin list', aList.text);
    const aSingle = await call('GET', `/api/teachers/${TEACHER_OTHER_ID}`, TOKENS.superAdmin);
    check('super admin GET /api/teachers/:id (other) -> 200', aSingle.status === 200, `got ${aSingle.status}`);
    check('admin single record has no secret fields', !SECRET_KEYS.some((k) => collectKeys(aSingle.json).has(k)));
    const aCal = await call('GET', `/api/attendance/staff-calendar/${TEACHER_OTHER_ID}`, TOKENS.superAdmin);
    check('super admin staff calendar -> 200', aCal.status === 200, `got ${aCal.status}`);
    const aAtt = await call('GET', '/api/staff-attendance', TOKENS.superAdmin);
    check('super admin GET /api/staff-attendance -> 200 array', aAtt.status === 200 && Array.isArray(aAtt.json), `got ${aAtt.status}`);
    const aCard = await call('GET', `/api/teachers/${TEACHER_OTHER_ID}/id-card`, TOKENS.superAdmin);
    check('super admin ID card of other staff -> 200', aCard.status === 200, `got ${aCard.status}`);
    check('admin ID card has no secret fields', !SECRET_KEYS.some((k) => collectKeys(aCard.json).has(k)));
    const hrList = await call('GET', '/api/teachers', TOKENS.hrStaff);
    check('HR staff GET /api/teachers -> 200', hrList.status === 200, `got ${hrList.status}`);
    const prList = await call('GET', '/api/teachers', TOKENS.principal);
    check('principal GET /api/teachers -> 200', prList.status === 200, `got ${prList.status}`);
    check('principal list has no financial fields', !FINANCIAL_KEYS.some((k) => collectKeys(prList.json).has(k)));
    const acList = await call('GET', '/api/teachers', TOKENS.accountant);
    check('accountant GET /api/teachers -> 200', acList.status === 200, `got ${acList.status}`);
    check('accountant list has no secret fields', !SECRET_KEYS.some((k) => collectKeys(acList.json).has(k)));
    const aPay = await call('GET', '/api/staff-payroll', TOKENS.superAdmin);
    check('super admin GET /api/staff-payroll -> 200', aPay.status === 200, `got ${aPay.status}`);
    noSecretsIn('admin payroll', aPay.text);

    console.log(`\nSTAFF DATA SECURITY: ${passed} passed, ${failed} failed`);
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
