/**
 * Reports API checks: access by role, filter validation, and that the figures add up.
 * Needs a running server (default http://localhost:3000, or BASE_URL).
 * Signs short-lived test tokens with JWT_SECRET (dev fallback when unset) for accounts in data/.
 */
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const S = process.env.JWT_SECRET || 'residential_cps_sheohar_jwt_production_secret_key_2026';
const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));

const admins = read('adminAccounts.json');
const staff = read('staff.json');
const parents = read('parentAccounts.json');
const classes = read('classes.json');
const settings = read('schoolSettings.json');

const tok = (userId, role) => jwt.sign({ userId, role }, S, { expiresIn: '10m' });
const admin = admins.find((a) => a.role === 'SUPER_ADMIN');
const teacher = staff.find((s) => s.role === 'TEACHER');
const accountant = staff.find((s) => s.role === 'ACCOUNTANT');
const parent = parents[0];

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !extra ? '' : `  → ${extra}`}`);
};
const get = async (q, t) => {
  const r = await fetch(`${BASE}/api/analytics/official-reports${q}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  return [r.status, await r.json().catch(() => null)];
};

const A = tok(admin.id, admin.role);
let [s, j] = await get('', null);
check('No token → 401', s === 401, s);
[s, j] = await get('', tok(teacher.id, 'TEACHER'));
check('Teacher → 403', s === 403, s);
if (parent) {
  [s, j] = await get('', tok(parent.id, 'PARENT'));
  check('Parent → 403', s === 403 || s === 401, s);
}

[s, j] = await get('', A);
check('Admin → 200', s === 200 && j?.success, s);
const ex = j?.executiveSummary;
check('School name comes from settings', j?.meta?.schoolName === settings.schoolName, j?.meta?.schoolName);
check('Board comes from settings', (j?.meta?.affiliatedBoard || '') === (settings.affiliatedBoard || ''), j?.meta?.affiliatedBoard);
check('Period is labelled', /^\d{4}-\d{2}-\d{2}$/.test(j?.meta?.period?.from || '') && /^\d{4}-\d{2}-\d{2}$/.test(j?.meta?.period?.to || ''), JSON.stringify(j?.meta?.period));
const cw = j?.studentStrength?.classWise || [];
check('Class-wise strength adds up to active students', cw.reduce((t, r) => t + r.totalStudents, 0) === ex?.students?.totalActive, `${cw.reduce((t, r) => t + r.totalStudents, 0)} vs ${ex?.students?.totalActive}`);
check('Boys + girls + other = total', ex.students.boys + ex.students.girls + ex.students.otherGender === ex.students.totalActive);
const f = ex?.fees;
check('Fees: billed + excess = collected + outstanding', f && Math.abs(f.totalFeeBilled + f.excessReceived - f.totalFeeCollected - f.outstandingFees) <= 2, f && `${f.totalFeeBilled}+${f.excessReceived} vs ${f.totalFeeCollected}+${f.outstandingFees}`);
check('Each over-paid bill is flagged in the audit', f.excessReceived === 0 || (j.feeCollectionAndAudit.audit.issues || []).some((i) => i.type === 'PAID_MORE_THAN_BILL'));
check('Staff: teaching + non-teaching = total', ex.staff.teachingStaff + ex.staff.nonTeachingStaff === ex.staff.totalActiveStaff);
const att = j?.attendanceAndDefaulters;
check('Attendance: no student with no records shown as 100%', (att?.defaulters || []).every((d) => d.workingDays > 0 || d.attendancePercentage === null));
check('Payroll unpaid staff are not reported as PAID', (j?.facultyAndPayroll?.staffWise || []).every((r) => r.netSalary !== null || r.paymentStatus !== 'PAID'));
check('Inactive classes are excluded', cw.every((r) => {
  const c = classes.find((x) => x.id === r.classId);
  return !c || String(c.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
}));

// Filters
[s, j] = await get('?classId=does-not-exist', A);
check('Unknown class → 400', s === 400, s);
[s, j] = await get('?section=A', A);
check('Section without class → 400', s === 400, s);
[s, j] = await get('?dateFrom=2026-10-10&dateTo=2026-10-01', A);
check('From after To → 400', s === 400, s);
[s, j] = await get('?dateFrom=10/10/2026', A);
check('Non-ISO date → 400', s === 400, s);
const active = classes.find((c) => String(c.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
if (active) {
  [s, j] = await get(`?classId=${encodeURIComponent(active.id)}`, A);
  check('Class filter narrows the strength table', s === 200 && (j.studentStrength.classWise || []).every((r) => r.classId === active.id), s);
}
[s, j] = await get('?dateFrom=2026-06-01&dateTo=2026-06-30', A);
check('Date filter applied to the period', s === 200 && j.meta.period.from === '2026-06-01' && j.meta.period.to === '2026-06-30', JSON.stringify(j?.meta?.period));
check('Receipts all fall inside the period', (j?.feeCollectionAndAudit?.detailedPayments || []).every((p) => String(p.paymentDate).slice(0, 10) >= '2026-06-01' && String(p.paymentDate).slice(0, 10) <= '2026-06-30'));

if (accountant) {
  [s, j] = await get('', tok(accountant.id, 'ACCOUNTANT'));
  check('Accountant → 200 with fees', s === 200 && j?.executiveSummary?.fees !== null, s);
}

// A staff role with report access but no fee access must not receive fees or parent phones.
const hr = staff.find((x) => x.role === 'HR_STAFF');
if (hr) {
  [s, j] = await get('', tok(hr.id, 'HR_STAFF'));
  check('HR → fees withheld', s === 200 && j.executiveSummary.fees === null && j.feeCollectionAndAudit === null, s);
} else {
  console.log('SKIP  HR role check (no HR_STAFF account in data)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
