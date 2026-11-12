/** Offline regression tests: My Payroll mapping/ownership and unmarked attendance. */
import { normalizePayrollRecord, formatRupees, selectOwnPayroll } from '../src/utils/payrollRules';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAuthorizedModulesForUser } from '../src/utils/rbac';
import {
  buildInitialAttendance,
  countAttendance,
  buildAttendanceSubmission,
} from '../src/utils/attendanceRules';

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); } else { failed++; console.log(`  FAIL: ${name} ${detail}`); }
};

console.log('--- Payroll: server record shape ---');
const serverRec = {
  id: 'p1', staffId: 'staff-1', employeeId: 'CPS0002', month: 'September 2026',
  basicSalary: 20000, totalAllowances: 5000, totalDeductions: 1500, netSalary: 23500,
  paymentStatus: 'PAID', paymentMethod: 'BANK_TRANSFER', paymentDate: '2026-10-01',
};
const v = normalizePayrollRecord(serverRec);
check('reads totalDeductions (was always 0 before)', v.deductions === 1500);
check('reads totalAllowances', v.allowances === 5000);
check('reads paymentMethod', v.paymentMethod === 'BANK_TRANSFER');
check('missing grossSalary stays undefined (old code crashed)', v.gross === undefined);
check('missing amount renders as dash, not a fake number', formatRupees(v.gross) === '—');
check('real amount renders in INR', formatRupees(23500) === '₹23,500');
check('does not invent a payment method', normalizePayrollRecord({ ...serverRec, paymentMethod: undefined }).paymentMethod === undefined);
check('GENERATED status is kept as is', normalizePayrollRecord({ ...serverRec, paymentStatus: 'generated' }).status === 'GENERATED');
check('missing status is PENDING', normalizePayrollRecord({ ...serverRec, paymentStatus: undefined }).status === 'PENDING');
check('non-numeric amounts are dropped', normalizePayrollRecord({ ...serverRec, netSalary: 'abc' }).net === undefined);

console.log('--- Payroll: ownership ---');
const all = [
  { id: 'a', staffId: 'staff-1', employeeId: 'CPS0002' },
  { id: 'b', staffId: 'staff-2', employeeId: 'CPS0003' },
  { id: 'c', staffId: 'staff-3', employeeId: 'CPS0004' },
];
check('keeps only own records by employeeId', selectOwnPayroll(all, { id: 'u-9', employeeId: 'cps0003' }).map((r) => r.id).join() === 'b');
check('matches own record by staff id', selectOwnPayroll(all, { id: 'staff-1' }).map((r) => r.id).join() === 'a');
check("never returns other employees' records", !selectOwnPayroll(all, { id: 'u-9', employeeId: 'CPS0002' }).some((r) => r.id !== 'a'));
check('unresolvable identity returns nothing', selectOwnPayroll(all, { id: '', employeeId: '' }).length === 0);
check('no match returns nothing, not everyone', selectOwnPayroll(all, { id: 'u-1', employeeId: 'CPS9999' }).length === 0);

console.log('--- Attendance: unmarked by default ---');
const students = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
const fresh = buildInitialAttendance(students, []);
check('no saved records -> nobody is marked', Object.keys(fresh.map).length === 0);
check('no student defaults to PRESENT', !Object.values(fresh.map).includes('PRESENT' as any));
check('all counted as unmarked', countAttendance(students, fresh.map).unmarked === 3);
const blocked = buildAttendanceSubmission(students, fresh.map);
check('submit is blocked while unmarked', !blocked.ok && blocked.unmarkedCount === 3 && blocked.records.length === 0);

const partial = buildInitialAttendance(students, [
  { studentId: 's1', status: 'PRESENT' },
  { studentId: 's2', status: 'ABSENT' },
]);
check('saved records are loaded and flagged saved', partial.savedIds.length === 2);
check('student without saved record stays unmarked', countAttendance(students, partial.map).unmarked === 1);
check('one unmarked student still blocks submit', !buildAttendanceSubmission(students, partial.map).ok);
check('unmarked student is never silently sent as PRESENT', buildAttendanceSubmission(students, partial.map).records.length === 0);

const full = { ...partial.map, s3: 'LATE' as const };
const ok = buildAttendanceSubmission(students, full);
check('all marked -> submit allowed with exact statuses', ok.ok && ok.records.map((r) => r.status).join() === 'PRESENT,ABSENT,LATE');
check('invalid saved status is ignored (stays unmarked)', countAttendance(students, buildInitialAttendance(students, [{ studentId: 's1', status: 'MAYBE' }]).map).unmarked === 3);
check('records of students not in this class are ignored', Object.keys(buildInitialAttendance(students, [{ studentId: 'zz', status: 'PRESENT' }]).map).length === 0);
check('counts: present/absent/late', (() => { const c = countAttendance(students, full); return c.present === 1 && c.absent === 1 && c.late === 1 && c.marked === 3; })());

console.log('--- Sidebar: Assignment module removed ---');
const mk = (role: any) => ({ id: 'u1', name: 'T', username: 'CPS0002', role } as any);
for (const role of ['TEACHER', 'STUDENT', 'PARENT', 'PRINCIPAL', 'SUPER_ADMIN']) {
  const mods = getAuthorizedModulesForUser(mk(role));
  check(`${role}: no Assignment module in sidebar`, !mods.some((m) => m.id === 'assignments' || m.title === 'Assignment'));
}
const teacherMods = getAuthorizedModulesForUser(mk('TEACHER')).map((m) => m.id);
check('teacher keeps marks-entry, student-attendance, my-payroll, my-id-card',
  ['marks-entry', 'student-attendance', 'my-payroll', 'my-id-card'].every((id) => teacherMods.includes(id)));
check('student/parent never see staff payroll', !getAuthorizedModulesForUser(mk('STUDENT')).some((m) => m.id === 'my-payroll'));

console.log('--- ID card: no invented data ---');
const idSrc = ['src/screens/MyIdCardScreen.tsx', 'src/components/IdCard.tsx', 'src/utils/idCardModel.ts']
  .map((f) => readFileSync(join(__dirname, '..', f), 'utf8')).join('\n');
check('no hardcoded blood group', !/B\+ \(Verified\)/.test(idSrc));
check('no hardcoded principal name', !/Ramakant Saxena/.test(idSrc));
check('no fake QR glyph or biometric claim', !/▦|biometric/i.test(idSrc));
check('no hardcoded session badge', !/>2026-2027</.test(idSrc));
check('blood group is shown only when recorded', /!!model\.bloodGroup &&/.test(idSrc));

console.log(`\nPAYROLL + ATTENDANCE: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
