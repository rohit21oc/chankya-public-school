/**
 * Checks for ID card QR codes and scan-to-mark attendance.
 *
 * Starts the real backend (server.ts) in a child process with a random, per-run
 * JWT secret and checks:
 *   1. Card QR tokens are only given to people allowed to see that card.
 *   2. The QR holds no personal data and cannot be forged or edited.
 *   3. Scan RBAC: teachers only for students of their classes, staff cards only
 *      for admin/HR roles, everyone else refused.
 *   4. A scan writes exactly one record, today's date, and a second scan changes nothing.
 *   5. Inactive students, wrong card type, old cards and holidays are refused.
 *   6. Existing Absent records: teachers cannot change them by scan, admins only with override.
 *   7. Teachers can still save the register after some students were scanned.
 *   8. The staff attendance file keeps other days after a scan.
 *
 * Any holiday on today's date is removed from data/ for the run so scans can be
 * tested; a holiday is then added through the API to test refusal. data/ is
 * snapshotted before the run and restored afterwards. No personal data is printed.
 *
 * Run: npm run verify:id-card-scan
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
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

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
  return { status: res.status, json };
}
const rows = (json: any): any[] => (Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.records) ? json.records : []);

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

const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
const writeJson = (f: string, v: unknown) => fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(v, null, 2));

/** Make today a normal school day with nothing marked yet. */
function prepareToday() {
  const holidays: any[] = readJson('holidays.json');
  writeJson('holidays.json', holidays.filter((h) => !(h.date === TODAY || (h.endDate && TODAY >= h.date && TODAY <= h.endDate))));
  writeJson('attendance.json', (readJson('attendance.json') as any[]).filter((a) => a.date !== TODAY));
  const staffAtt: any[] = readJson('staffAttendance.json');
  // Keep one record from another day so we can check the file is not truncated by a scan.
  const otherDay = staffAtt.filter((a) => a.date !== TODAY);
  const seed = otherDay.length ? otherDay : [{ id: 'sa-fixture-old', date: '2026-01-05', staffId: 't-2', staffName: 'Fixture', employeeId: 'PDS0002', status: 'PRESENT' }];
  writeJson('staffAttendance.json', seed);
  return seed.length;
}

async function main() {
  console.log('\n=== ID card QR and scan attendance checks ===');
  const snap = snapshotData();
  const otherDayStaffRecords = prepareToday();
  const staffDir: any[] = readJson('staff.json');
  const parents: any[] = readJson('parentAccounts.json');
  const studentRows: any[] = readJson('students.json');
  const activeIn = (cto: string) => studentRows.filter((x) => x.status === 'ACTIVE' && `${x.className}-${String(x.section || 'A').toUpperCase()}` === String(cto).trim().toUpperCase().replace(/^CLASS /, 'Class ')).length;
  // The teacher must be Class Incharge of a class-section that has at least two active students.
  const teacherRec = staffDir.find((s) => s.portalRole === 'TEACHER' && s.status === 'ACTIVE' && s.classTeacherOf && activeIn(s.classTeacherOf) >= 2);
  const staffCardOwner = staffDir.find((s) => s.status === 'ACTIVE' && s.id !== teacherRec.id && s.portalRole === 'TEACHER') || staffDir.find((s) => s.id !== teacherRec.id);
  const parent = parents.find((p) => (p.studentIds || []).length > 0);

  const admin = signToken({ userId: 'admin-test', role: 'SUPER_ADMIN' });
  const teacher = signToken({ userId: teacherRec.id, role: 'TEACHER', employeeId: teacherRec.employeeId });
  const hr = signToken({ userId: 'hr-test', role: 'HR_STAFF' });
  const accountant = signToken({ userId: 'acct-test', role: 'ACCOUNTANT' });
  const coordinator = signToken({ userId: 'coord-test', role: 'ACADEMIC_COORDINATOR' });
  const parentTok = signToken({ userId: parent.id, role: 'PARENT', linkedStudentIds: parent.studentIds, studentId: parent.studentIds[0] });

  let server: ChildProcess | null = null;
  try {
    server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server.ts'], {
      cwd: ROOT,
      env: { ...process.env, JWT_SECRET, ID_CARD_QR_SECRET: '', NODE_ENV: 'development', DISABLE_HMR: 'true', MONGODB_URI: '' },
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: true,
    });
    if (!(await waitForHealth())) throw new Error(`Backend did not become healthy on port ${PORT}.`);

    // Fixtures from the live API: the teacher's classes and the students in them.
    const assigned = await call('GET', '/api/attendance/assigned-classes?scope=incharge', teacher);
    const classes: any[] = assigned.json?.classes || [];
    const allStudents = rows((await call('GET', '/api/students?limit=2000', admin)).json);
    const inClass = (s: any) => classes.some((c) => (c.classId === s.classId || c.className === s.className) && (c.sections || []).map((x: string) => x.toUpperCase()).includes(String(s.section || 'A').toUpperCase()));
    const ownStudents = allStudents.filter((s) => s.status === 'ACTIVE' && inClass(s));
    const own = ownStudents[0];
    const own2 = ownStudents[1];
    const foreign = allStudents.find((s) => s.status === 'ACTIVE' && !inClass(s));
    const inactive = allStudents.find((s) => s.status && s.status !== 'ACTIVE');
    check('fixtures: teacher has an assigned class with 2+ students, plus a foreign and an inactive student', !!own && !!own2 && !!foreign && !!inactive,
      `classes ${classes.length}, own ${ownStudents.length}, foreign ${!!foreign}, inactive ${!!inactive}`);
    if (!own || !own2 || !foreign || !inactive) throw new Error('Fixtures missing.');

    console.log('\n-- 1. QR tokens only for people allowed to see the card');
    const ownCard = await call('GET', `/api/students/${own.id}/id-card`, teacher);
    const ownToken: string = ownCard.json?.qrToken;
    check('teacher gets QR token for own student card', ownCard.status === 200 && typeof ownToken === 'string' && ownToken.startsWith('PDS1.S.'));
    const foreignCard = await call('GET', `/api/students/${foreign.id}/id-card`, teacher);
    check('teacher refused for foreign student card (no token)', foreignCard.status === 403 && !foreignCard.json?.qrToken, `got ${foreignCard.status}`);
    const batchT = await call('POST', '/api/id-cards/qr-tokens', teacher, { items: [{ kind: 'STUDENT', id: own.id }, { kind: 'STUDENT', id: foreign.id }, { kind: 'STAFF', id: staffCardOwner.id }] });
    const tt = batchT.json?.tokens || {};
    check('batch (teacher): own student yes, foreign student and other staff no', !!tt[`STUDENT:${own.id}`] && !tt[`STUDENT:${foreign.id}`] && !tt[`STAFF:${staffCardOwner.id}`]);
    const batchA = await call('POST', '/api/id-cards/qr-tokens', admin, { items: [{ kind: 'STUDENT', id: foreign.id }, { kind: 'STUDENT', id: own2.id }, { kind: 'STUDENT', id: inactive.id }, { kind: 'STAFF', id: staffCardOwner.id }, { kind: 'STAFF', id: teacherRec.id }] });
    const ta = batchA.json?.tokens || {};
    check('batch (admin): all requested tokens returned', ['STUDENT:' + foreign.id, 'STUDENT:' + own2.id, 'STUDENT:' + inactive.id, 'STAFF:' + staffCardOwner.id, 'STAFF:' + teacherRec.id].every((k) => typeof ta[k] === 'string'));
    const batchP = await call('POST', '/api/id-cards/qr-tokens', parentTok, { items: [{ kind: 'STUDENT', id: parent.studentIds[0] }, { kind: 'STUDENT', id: foreign.id === parent.studentIds[0] ? own.id : foreign.id }] });
    const tp = batchP.json?.tokens || {};
    check('batch (parent): own child only', !!tp[`STUDENT:${parent.studentIds[0]}`] && Object.keys(tp).length === 1);
    const ownStaffCard = await call('GET', `/api/staff/${teacherRec.id}/id-card`, teacher);
    check('teacher gets own staff card token', ownStaffCard.status === 200 && String(ownStaffCard.json?.qrToken || '').startsWith('PDS1.T.'));
    check('signed-out batch -> 401', (await call('POST', '/api/id-cards/qr-tokens', undefined, { items: [] })).status === 401);

    console.log('\n-- 2. QR holds no personal data and cannot be forged');
    const decodedId = Buffer.from(ownToken.split('.')[2], 'base64url').toString('utf8');
    check('QR carries only the record id', decodedId === own.id && ownToken.length < 120);
    const personal = [own.name, own.dob, own.parentPhone, own.fatherMobile, own.fatherName].filter(Boolean).map(String);
    check('QR contains no name, DOB, phone or parent name', personal.every((v) => !ownToken.includes(v) && !decodedId.includes(v)));
    const [p0, p1, , sig] = ownToken.split('.');
    const swapped = `${p0}.${p1}.${b64u(foreign.id)}.${sig}`;
    const fakeSig = crypto.createHmac('sha256', 'attacker-secret').update(`PDS1.S.${b64u(foreign.id)}`).digest('base64url').slice(0, 22);
    const kindSwap = `${p0}.T.${ownToken.split('.')[2]}.${sig}`;
    for (const [label, code] of [
      ['edited record id', swapped], ['signed with another secret', `PDS1.S.${b64u(foreign.id)}.${fakeSig}`],
      ['student card relabelled as staff', kindSwap], ['random text', 'hello world'], ['empty', ''],
    ] as const) {
      const r = await call('POST', '/api/attendance/scan', admin, { code });
      check(`scan ${label} -> 400 INVALID_CODE`, r.status === 400 && r.json?.code === 'INVALID_CODE', `got ${r.status} ${r.json?.code}`);
    }
    const legacy = await call('POST', '/api/attendance/scan', admin, { code: JSON.stringify({ type: 'VERIFIED_STUDENT_ID', admNo: own.admissionNumber, verified: true }) });
    check('old card QR -> 400 LEGACY_CARD', legacy.status === 400 && legacy.json?.code === 'LEGACY_CARD');

    console.log('\n-- 3. Scan RBAC');
    check('signed-out scan -> 401', (await call('POST', '/api/attendance/scan', undefined, { code: ownToken })).status === 401);
    for (const [label, tok] of [['parent', parentTok], ['accountant', accountant]] as const) {
      const r = await call('POST', '/api/attendance/scan', tok, { code: ownToken });
      check(`${label} scan -> 403`, r.status === 403, `got ${r.status}`);
    }
    const tForeign = await call('POST', '/api/attendance/scan', teacher, { code: ta[`STUDENT:${foreign.id}`] });
    check('teacher scans foreign student -> 403 NOT_YOUR_CLASS', tForeign.status === 403 && tForeign.json?.code === 'NOT_YOUR_CLASS');
    const tStaff = await call('POST', '/api/attendance/scan', teacher, { code: ta[`STAFF:${staffCardOwner.id}`] });
    check('teacher scans staff card -> 403', tStaff.status === 403, `got ${tStaff.status}`);
    const hrStudent = await call('POST', '/api/attendance/scan', hr, { code: ownToken });
    check('HR scans student card -> 403', hrStudent.status === 403, `got ${hrStudent.status}`);

    console.log('\n-- 4. One record, today, idempotent');
    const s1 = await call('POST', '/api/attendance/scan', teacher, { code: ownToken, expect: 'STUDENT' });
    check('teacher scans own student -> 200 PRESENT', s1.status === 200 && s1.json?.success && s1.json?.status === 'PRESENT' && s1.json?.alreadyMarked === false, `got ${s1.status} ${s1.json?.code || ''}`);
    check('response date is today (India time)', s1.json?.date === TODAY);
    check('response carries no DOB or phone', !/dob|phone|mobile|address/i.test(Object.keys(s1.json?.person || {}).join(',')));
    let today = rows((await call('GET', `/api/attendance?date=${TODAY}`, admin)).json).filter((a) => a.date === TODAY);
    check('exactly one attendance record for today', today.length === 1 && today[0].studentId === own.id && today[0].status === 'PRESENT', `records ${today.length}`);
    const s2 = await call('POST', '/api/attendance/scan', teacher, { code: ownToken });
    check('second scan -> alreadyMarked, nothing changed', s2.status === 200 && s2.json?.alreadyMarked === true);
    today = rows((await call('GET', `/api/attendance?date=${TODAY}`, admin)).json).filter((a) => a.date === TODAY);
    check('still exactly one record', today.length === 1);
    const late = await call('POST', '/api/attendance/scan', teacher, { code: ta[`STUDENT:${own2.id}`], status: 'LATE' });
    check('scan with Late -> 200 LATE', late.status === 200 && late.json?.status === 'LATE', `got ${late.status} ${late.json?.code || ''}`);

    console.log('\n-- 5. Refusals');
    const wrong = await call('POST', '/api/attendance/scan', admin, { code: ta[`STAFF:${staffCardOwner.id}`], expect: 'STUDENT' });
    check('staff card in student scanner -> 400 WRONG_CARD_TYPE', wrong.status === 400 && wrong.json?.code === 'WRONG_CARD_TYPE');
    const inact = await call('POST', '/api/attendance/scan', admin, { code: ta[`STUDENT:${inactive.id}`] });
    check('inactive student -> 409 INACTIVE', inact.status === 409 && inact.json?.code === 'INACTIVE');
    today = rows((await call('GET', `/api/attendance?date=${TODAY}`, admin)).json).filter((a) => a.date === TODAY);
    check('refused scans wrote nothing', today.length === 2 && today.every((a) => a.studentId === own.id || a.studentId === own2.id), `records ${today.length}`);

    console.log('\n-- 7. Register still works after scans');
    const cls = classes.find((c) => c.classId === own.classId || c.className === own.className);
    const roster = allStudents.filter((s) => (s.classId === own.classId || s.className === own.className) && String(s.section || 'A').toUpperCase() === String(own.section || 'A').toUpperCase());
    const loaded = new Map(today.map((a) => [a.studentId, a]));
    const reg = roster.map((s) => ({ studentId: s.id, status: loaded.get(s.id)?.status || 'PRESENT', remarks: loaded.get(s.id)?.remarks || '' }));
    const save1 = await call('POST', '/api/attendance', teacher, { classId: cls.classId, section: own.section, date: TODAY, records: reg });
    check('teacher saves register keeping scanned records -> 200 (not a correction)', save1.status === 200 && save1.json?.isCorrection === false, `got ${save1.status} ${save1.json?.error || ''}`);
    const change = reg.map((r) => (r.studentId === own.id ? { ...r, status: 'ABSENT' } : r));
    const save2 = await call('POST', '/api/attendance', teacher, { classId: cls.classId, section: own.section, date: TODAY, records: change });
    // Teachers hold attendance.edit by default, so this is an allowed, audited correction.
    check('teacher changing a scanned record counts as a correction', save2.status === 200 && save2.json?.isCorrection === true, `got ${save2.status}`);

    console.log('\n-- 6. Existing Absent record');
    const adminSave = await call('POST', '/api/attendance', admin, { classId: cls.classId, section: own.section, date: TODAY, records: change });
    check('admin marks the student Absent (setup)', adminSave.status === 200);
    const cAbs = await call('POST', '/api/attendance/scan', coordinator, { code: ownToken });
    check('role without attendance.edit cannot overwrite Absent -> 409 ALREADY_MARKED', cAbs.status === 409 && cAbs.json?.code === 'ALREADY_MARKED', `got ${cAbs.status} ${cAbs.json?.code}`);
    const tAbs = await call('POST', '/api/attendance/scan', teacher, { code: ownToken });
    check('teacher scan over Absent asks for confirmation -> 409 CONFIRM_OVERRIDE', tAbs.status === 409 && tAbs.json?.code === 'CONFIRM_OVERRIDE');
    const aAbs = await call('POST', '/api/attendance/scan', admin, { code: ownToken });
    check('admin scan without override -> 409 CONFIRM_OVERRIDE', aAbs.status === 409 && aAbs.json?.code === 'CONFIRM_OVERRIDE' && aAbs.json?.previousStatus === 'ABSENT');
    const aOvr = await call('POST', '/api/attendance/scan', admin, { code: ownToken, override: true });
    check('admin scan with override -> 200 corrected from ABSENT', aOvr.status === 200 && aOvr.json?.corrected === true && aOvr.json?.previousStatus === 'ABSENT');
    const after = rows((await call('GET', `/api/attendance?date=${TODAY}&studentId=${own.id}`, admin)).json).filter((a) => a.date === TODAY && a.studentId === own.id);
    check('student now Present, single record', after.length === 1 && after[0].status === 'PRESENT');

    console.log('\n-- 8. Staff scans');
    const st1 = await call('POST', '/api/attendance/scan', admin, { code: ta[`STAFF:${staffCardOwner.id}`], expect: 'STAFF' });
    check('admin scans staff card -> 200 with check-in time', st1.status === 200 && st1.json?.status === 'PRESENT' && /\d{2}:\d{2} (AM|PM)/.test(st1.json?.checkInTime || ''), `got ${st1.status} ${st1.json?.code || ''}`);
    const st2 = await call('POST', '/api/attendance/scan', hr, { code: ta[`STAFF:${staffCardOwner.id}`] });
    check('second staff scan (by HR) -> alreadyMarked', st2.status === 200 && st2.json?.alreadyMarked === true);
    const st3 = await call('POST', '/api/attendance/scan', hr, { code: ta[`STAFF:${teacherRec.id}`] });
    check('HR scans another staff card -> 200', st3.status === 200 && st3.json?.alreadyMarked === false);
    const staffToday = rows((await call('GET', `/api/staff-attendance?date=${TODAY}`, admin)).json);
    check('exactly two staff records today', staffToday.length === 2, `got ${staffToday.length}`);
    const fileRecords: any[] = readJson('staffAttendance.json');
    check('staff attendance file keeps other days', fileRecords.filter((a) => a.date !== TODAY).length === otherDayStaffRecords && fileRecords.filter((a) => a.date === TODAY).length === 2,
      `other days ${fileRecords.filter((a) => a.date !== TODAY).length}/${otherDayStaffRecords}`);

    console.log('\n-- 5b. Holiday');
    const hol = await call('POST', '/api/holidays', admin, { name: 'Scan test holiday', date: TODAY });
    check('admin adds a holiday for today (setup)', hol.status === 200 || hol.status === 201, `got ${hol.status}`);
    const hs = await call('POST', '/api/attendance/scan', admin, { code: ta[`STUDENT:${foreign.id}`] });
    check('scan on a holiday -> 409 HOLIDAY', hs.status === 409 && hs.json?.code === 'HOLIDAY');

    console.log(`\nID CARD SCAN: ${passed} passed, ${failed} failed`);
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
