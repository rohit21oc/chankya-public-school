/**
 * Class Incharge, attendance scope, payslip and exam-visibility checks against a RUNNING local server
 * (default http://localhost:3000) and its MongoDB. It creates three test teacher accounts, so it refuses to
 * run against anything but localhost. Never point it at production.
 *
 * Usage (repo root, .env loaded):  set -a; . ./.env; set +a; node scripts/verify-teacher-scope-api.mjs
 */
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.BASE_URL || 'http://localhost:3000')) {
  console.error('Refusing to run: BASE_URL must be localhost.');
  process.exit(2);
}
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';
const B = process.env.BASE_URL || 'http://localhost:3000';
const sign = (p) => jwt.sign({ iat: Math.floor(Date.now() / 1000), ...p }, process.env.JWT_SECRET, { expiresIn: '1h' });
const adminTok = sign({ userId: 'ui-setup', role: 'SUPER_ADMIN' });
const H = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const call = async (method, path, tok, body) => {
  const r = await fetch(B + path, { method, headers: tok ? H(tok) : { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 80) }; }
  return [r.status, j, r];
};
const stamp = Date.now() % 100000;
const pw = 'ScopeTest@2026x';

async function mkTeacher(label, phoneTail, cls, sec, clsName, subj, incharge) {
  const body = { name: `Scope ${label} ${stamp}`, phone: `91${String(stamp).padStart(5, '0')}${phoneTail}`, portalRole: 'TEACHER', designation: 'Teacher', department: 'ACADEMICS', initialPassword: pw, joiningDate: '2026-04-01', monthlySalary: 1,
    assignedClasses: [`${clsName}-${sec}`], classTeacherOf: incharge || undefined,
    teachingProfile: { assignedClassId: cls, assignedClassName: clsName, assignedSection: sec, assignedPrimarySubject: subj, isClassTeacher: false } };
  return call('POST', '/api/teachers', adminTok, body);
}

// ---- Class Incharge validation on save
let [s, b] = await mkTeacher('Incharge', '201', 'c-1', 'A', 'Class 1', 'Hindi Course-A', 'Class 1-A');
check('teacher can be Class Incharge of the class they teach', s === 200 || s === 201, `${s} ${b.error || ''}`);
const tI = b.staff;
[s, b] = await mkTeacher('Plain', '202', 'c-2', 'A', 'Class 2', 'English Language & Literature', '');
check('teacher without incharge is created', (s === 200 || s === 201) && !!b.staff, `${s} ${b.error || ''}`);
const tP = b.staff;
[s, b] = await mkTeacher('BadClass', '203', 'c-1', 'A', 'Class 1', 'Hindi Course-A', 'Class 5-A');
check('Class Incharge of a class the teacher is not assigned/qualified for is rejected', s === 400, `${s} ${b.error || ''}`);
[s, b] = await mkTeacher('BadSec', '204', 'c-1', 'A', 'Class 1', 'Hindi Course-A', 'Class 1-Z');
check('Class Incharge with a non-existent section is rejected', s === 400, `${s} ${b.error || ''}`);
[s, b] = await mkTeacher('NoClass', '205', 'c-1', 'A', 'Class 1', 'Hindi Course-A', 'Class 99-A');
check('Class Incharge of an unknown class is rejected', s === 400, `${s} ${b.error || ''}`);
[s, b] = await call('PUT', `/api/teachers/${tP.id}`, adminTok, { classTeacherOf: 'Class 7-B' });
check('editing a teacher to an unqualified incharge class is rejected', s === 400, `${s} ${b.error || ''}`);
[s, b] = await call('PUT', `/api/teachers/${tP.id}`, adminTok, { classTeacherOf: 'Class 2-A' });
check('editing a teacher to Class Incharge of their own class works', s === 200, `${s} ${b.error || ''}`);
[s, b] = await call('PUT', `/api/teachers/${tP.id}`, adminTok, { classTeacherOf: '' });
check('Class Incharge can be removed again', s === 200, `${s} ${b.error || ''}`);

const mongo = await MongoClient.connect(process.env.MONGODB_URI);
await mongo.db('pds_school_erp').collection('users').updateMany({ id: { $in: [tI.id, tP.id] } }, { $set: { mustChangePassword: false } });
const login = async (emp) => { const [st, bb] = await call('POST', '/api/auth/login', null, { identifier: emp, password: pw, loginType: 'STAFF' }); return bb.token || bb.accessToken; };
const tokI = await login(tI.employeeId), tokP = await login(tP.employeeId);
check('teachers sign in', !!tokI && !!tokP);

// ---- attendance scope
let [sa, ba] = await call('GET', '/api/attendance/assigned-classes?scope=incharge', tokI);
check('incharge teacher: attendance classes = exactly their Class Incharge class/section', sa === 200 && ba.classes.length === 1 && ba.classes[0].classId === 'c-1' && ba.classes[0].sections.join() === 'A', JSON.stringify(ba.classes));
[sa, ba] = await call('GET', '/api/attendance/assigned-classes?scope=incharge', tokP);
check('teacher who is not incharge anywhere: no attendance classes', sa === 200 && ba.classes.length === 0, JSON.stringify(ba.classes));
[sa, ba] = await call('GET', '/api/attendance/assigned-classes', tokP);
check('their teaching classes are still available for other modules (no scope)', sa === 200 && ba.classes.length >= 1);
[sa, ba] = await call('GET', '/api/attendance/assigned-classes?scope=incharge', adminTok);
check('admin still gets all active classes', sa === 200 && ba.allAccess === true && ba.classes.length > 5);

const stuList = await call('GET', '/api/students?limit=2000', adminTok);
const all = Array.isArray(stuList[1]) ? stuList[1] : stuList[1].students || stuList[1].data || stuList[1].items || [];
const inC1 = all.filter((x) => x.classId === 'c-1' && (x.section || 'A') === 'A' && x.status === 'ACTIVE')[0];
const inC2 = all.filter((x) => x.classId === 'c-2' && (x.section || 'A') === 'A' && x.status === 'ACTIVE')[0];
const date = '2026-10-15';
const rec = (st) => ({ studentId: st.id, studentName: st.name, rollNumber: st.rollNumber, status: 'PRESENT' });
[s, b] = await call('POST', '/api/attendance', tokI, { classId: 'c-1', section: 'A', date, records: [rec(inC1)] });
check('incharge marks attendance for their own class', s === 200, `${s} ${b.error || ''}`);
[s, b] = await call('POST', '/api/attendance', tokI, { classId: 'c-2', section: 'A', date, records: [rec(inC2)] });
check('incharge cannot mark another class', s === 403, `${s} ${b.error || ''}`);
[s, b] = await call('POST', '/api/attendance', tokP, { classId: 'c-2', section: 'A', date, records: [rec(inC2)] });
check('teacher who teaches Class 2-A but is not its incharge cannot mark it', s === 403, `${s} ${b.error || ''}`);
[s, b] = await call('POST', '/api/attendance', adminTok, { classId: 'c-2', section: 'A', date, records: [rec(inC2)] });
check('admin can mark any class', s === 200, `${s} ${b.error || ''}`);
[s, b] = await call('GET', `/api/attendance?classId=c-2&section=A&date=${date}`, tokI);
check('incharge teacher cannot read another class attendance', s === 403, `${s}`);
[s, b] = await call('GET', `/api/attendance?classId=c-2&section=A&date=${date}`, tokP);
check('non-incharge teacher cannot read attendance registers', s === 403, `${s}`);
[s, b] = await call('GET', `/api/attendance?classId=c-1&section=A&date=${date}`, tokI);
check('incharge teacher reads their own class attendance', s === 200);
[s, b] = await call('GET', `/api/attendance?date=${date}`, tokI);
const rowsIn = Array.isArray(b) ? b : b.records || b.data || [];
check('unfiltered attendance list for a teacher holds only their class', s === 200 && rowsIn.every((r) => r.classId === 'c-1'), `${rowsIn.length} rows`);

// ---- payslip
const [, pl] = await call('GET', '/api/staff-payroll', adminTok);
const payroll = Array.isArray(pl) ? pl : pl.records || pl.data || [];
const paid = payroll.find((p) => p.paymentStatus === 'PAID');
const pending = payroll.find((p) => p.paymentStatus !== 'PAID');
if (!paid) {
  check('payslip: a PAID record exists in the test database', false, 'pay one salary first (Salary > Mark as paid), then re-run');
} else {
  const rawGet = await fetch(`${B}/api/staff-payroll/${paid.id}/payslip`, { headers: H(adminTok) });
  const buf = Buffer.from(await rawGet.arrayBuffer());
  check('admin downloads a PDF payslip for a PAID record', rawGet.status === 200 && buf.subarray(0, 5).toString() === '%PDF-' && /attachment; filename="Payslip-/.test(rawGet.headers.get('content-disposition') || ''), `${rawGet.status} ${buf.length} bytes`);
  check('no token -> 401', (await call('GET', `/api/staff-payroll/${paid.id}/payslip`, null))[0] === 401);
  check('another teacher cannot download it', (await call('GET', `/api/staff-payroll/${paid.id}/payslip`, tokI))[0] === 403);
  const ownerTok = sign({ userId: paid.staffId, role: 'TEACHER' });
  const own = await fetch(`${B}/api/staff-payroll/${paid.id}/payslip`, { headers: H(ownerTok) });
  check('the staff member who was paid can download their own payslip', own.status === 200, `${own.status}`);
  const [sl, bl] = await call('POST', `/api/staff-payroll/${paid.id}/payslip-link`, adminTok);
  check('payslip link is issued', sl === 200 && /^\/api\/payslips\/download\?token=/.test(bl.url || ''));
  const viaLink = await fetch(B + bl.url);
  const lb = Buffer.from(await viaLink.arrayBuffer());
  check('the link downloads the same PDF without an auth header', viaLink.status === 200 && lb.length === buf.length && lb.subarray(0, 5).toString() === '%PDF-', `${viaLink.status} ${lb.length} vs ${buf.length}`);
  check('tampered link -> 401', (await fetch(B + bl.url + 'x')).status === 401);
  check('link request by another teacher -> 403', (await call('POST', `/api/staff-payroll/${paid.id}/payslip-link`, tokI))[0] === 403);
}
if (pending) {
  check('payslip of an unpaid record -> 409', (await call('GET', `/api/staff-payroll/${pending.id}/payslip`, adminTok))[0] === 409);
}

// ---- exams: teachers never see drafts
const [, ex] = await call('GET', '/api/exams', tokI);
const exams = Array.isArray(ex) ? ex : ex.exams || ex.data || [];
check('teacher exam list has no DRAFT exams', exams.every((e) => e.status !== 'DRAFT'), `${exams.length} exams`);

await mongo.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
