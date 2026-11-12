/**
 * Offline unit checks for the salary calculation (server/services/payrollService.ts).
 * Expected values are worked out independently from the documented school rules:
 *   daily rate = monthly / 30; late = 25% of a day per late day; unpaid absence = 1 day per day;
 *   holidays and weekly offs (days not in School Working Days, default Sunday) are not deducted; a
 *   working day with no attendance mark is cut like an absence from UNMARKED_SALARY_CUT_FROM on (only
 *   days before "today"); of the approved leave taken in a month only
 *   1 day (SICK preferred) is forgiven, every further leave day is deducted at monthly / 30.
 *
 * Usage: npx tsx scripts/verify-payroll-calculations.ts
 */
import { calculateStaffSalaryForMonth, getConfiguredMonthlySalary } from '../server/services/payrollService.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

const base = { id: 's1', employeeId: 'CPS9001', name: 'Test Teacher', status: 'ACTIVE', joiningDate: '2026-01-01', monthlySalary: 30000 };
const att = (date: string, status: string, extra: any = {}) => ({ id: `${date}-${status}`, date, staffId: 's1', employeeId: 'CPS9001', status, ...extra });
const leave = (start: string, end: string, status: string, leaveType = 'CASUAL', extra: any = {}) => ({
  id: `${start}-${status}-${leaveType}`, staffId: 's1', employeeId: 'CPS9001', startDate: start, endDate: end, status, leaveType, ...extra,
});
const run = (opts: { staff?: any; attendance?: any[]; leaves?: any[]; holidays?: any[]; month?: number }) =>
  calculateStaffSalaryForMonth({
    staff: opts.staff || base,
    year: 2026,
    monthIndex: opts.month || 9,
    attendanceRecords: (opts.attendance || []) as any,
    leaves: (opts.leaves || []) as any,
    holidays: (opts.holidays || []) as any,
  });

// September 2026: 30 days, Sundays on 6, 13, 20, 27.
{
  const r = run({});
  check('No attendance marked → full salary, no deductions', r?.netSalary === 30000 && r?.totalDeductions === 0, `net ${r?.netSalary}`);
}
{
  const r = run({ attendance: [att('2026-09-01', 'LATE'), att('2026-09-02', 'LATE'), att('2026-09-03', 'LATE')] });
  check('3 late days → 3 × 25% of 1,000 = 750', r?.lateDeduction === 750 && r?.netSalary === 29250, `late ${r?.lateDeduction}`);
}
{
  const r = run({ attendance: [att('2026-09-01', 'ABSENT'), att('2026-09-02', 'HALF_DAY')] });
  check('Absent + half day → 1.5 days = 1,500', r?.unpaidLeaveDeduction === 1500, `${r?.unpaidLeaveDeduction}`);
}
{
  const r = run({ attendance: [att('2026-09-05', 'PRESENT')], leaves: [leave('2026-09-05', '2026-09-05', 'REJECTED')] });
  check('Rejected leave on a day the person worked → no deduction', r?.totalDeductions === 0, `${r?.totalDeductions}`);
}
{
  const r = run({ attendance: [att('2026-09-05', 'ABSENT')], leaves: [leave('2026-09-05', '2026-09-05', 'REJECTED')] });
  check('Rejected leave and marked absent → 1 day deducted (because of the absence)', r?.unpaidLeaveDeduction === 1000, `${r?.unpaidLeaveDeduction}`);
}
{
  const r = run({ leaves: [leave('2026-09-07', '2026-09-08', 'PENDING', 'LWP')] });
  check('Pending unpaid-leave application alone → no deduction', r?.totalDeductions === 0, `${r?.totalDeductions}`);
}
{
  const r = run({ leaves: [leave('2026-09-07', '2026-09-08', 'APPROVED', 'LWP')] });
  check('Approved unpaid leave (2 working days) → 2,000', r?.unpaidLeaveDeduction === 2000, `${r?.unpaidLeaveDeduction}`);
}
{
  const r = run({ attendance: [att('2026-09-07', 'PRESENT')], leaves: [leave('2026-09-07', '2026-09-07', 'APPROVED', 'LWP')] });
  check('Approved unpaid leave but the person worked that day → no deduction', r?.totalDeductions === 0, `${r?.totalDeductions}`);
}
{
  const r = run({ attendance: [att('2026-09-09', 'LEAVE')], leaves: [leave('2026-09-09', '2026-09-09', 'APPROVED', 'CASUAL')] });
  check('1 approved leave in the month → forgiven, not deducted', r?.totalDeductions === 0 && r?.approvedPaidLeaveDays === 1, `${r?.totalDeductions}`);
}
{
  // The school's own example: ₹30,000, 3 leave days → 1 forgiven (sick), 2 × ₹1,000 = ₹2,000 cut.
  const r = run({ leaves: [leave('2026-09-14', '2026-09-15', 'APPROVED', 'CASUAL'), leave('2026-09-16', '2026-09-16', 'APPROVED', 'SICK')] });
  check('3 leave days → 1 forgiven, 2 deducted = 2,000', r?.unpaidLeaveDeduction === 2000 && r?.netSalary === 28000 && (r as any)?.waivedLeaveDays === 1 && (r as any)?.chargeableLeaveDays === 2, `${r?.unpaidLeaveDeduction}`);
}
{
  const r = run({ leaves: [leave('2026-09-14', '2026-09-14', 'APPROVED', 'CASUAL'), leave('2026-09-16', '2026-09-16', 'APPROVED', 'SICK')] });
  check('Sick leave is the one forgiven when both types are taken', r?.unpaidLeaveDeduction === 1000 && (r as any)?.leaveDaysTaken === 2, `${r?.unpaidLeaveDeduction}`);
}
{
  const r = run({ leaves: [leave('2026-09-14', '2026-09-14', 'APPROVED', 'LWP'), leave('2026-09-16', '2026-09-16', 'APPROVED', 'SICK')] });
  check('Unpaid (LWP) leave is never forgiven; the sick day still is', r?.unpaidLeaveDeduction === 1000, `${r?.unpaidLeaveDeduction}`);
}
{
  const r = run({ leaves: [leave('2026-09-12', '2026-09-14', 'APPROVED', 'SICK')] });
  check('Leave spanning a Sunday counts only working days (2) → 1 deducted', r?.unpaidLeaveDeduction === 1000, `${r?.unpaidLeaveDeduction}`);
}
{
  const r = run({ attendance: [att('2026-09-09', 'LEAVE')] });
  check('On leave without an approved leave → 1 day deducted', r?.unpaidLeaveDeduction === 1000, `${r?.unpaidLeaveDeduction}`);
}
{
  const r = run({ attendance: [att('2026-09-06', 'ABSENT')] });
  check('Absent marked on a Sunday → not deducted', r?.totalDeductions === 0, `${r?.totalDeductions}`);
}
{
  const r = run({ attendance: [att('2026-09-10', 'ABSENT')], holidays: [{ id: 'h', date: '2026-09-10', endDate: '2026-09-10', name: 'Holiday' }] });
  check('Absent marked on a holiday → not deducted', r?.totalDeductions === 0, `${r?.totalDeductions}`);
}
{
  const r = run({ attendance: [att('2026-09-11', 'ABSENT'), { ...att('2026-09-11', 'ABSENT'), id: 'dup' }] });
  check('Duplicate attendance records for one day → counted once', r?.unpaidLeaveDeduction === 1000, `${r?.unpaidLeaveDeduction}`);
}
{
  const r = run({ staff: { ...base, monthlySalary: 35000 }, attendance: [att('2026-09-01', 'LATE'), att('2026-09-02', 'LATE'), att('2026-09-03', 'LATE')] });
  const expected = r2((35000 / 30) * 0.25 * 3);
  check('Rupee amounts are rounded to 2 decimals (35,000, 3 late)', r?.lateDeduction === expected && r?.netSalary === r2(35000 - expected), `${r?.lateDeduction} vs ${expected}`);
}
{
  const r = run({ staff: { ...base, monthlySalary: undefined, salary: undefined } });
  check('No configured salary → no payroll record (nothing assumed)', r === null && getConfiguredMonthlySalary({}) === 0);
}
{
  const r = run({ staff: { ...base, joiningDate: '2026-10-05' } });
  check('Joined after the month ended → no payroll record', r === null);
}
{
  const r = run({ staff: { ...base, status: 'INACTIVE' } });
  check('Inactive staff with no attendance in the month → no payroll record', r === null);
}
{
  const r = run({ staff: { ...base, status: 'RESIGNED' }, attendance: [att('2026-09-01', 'PRESENT')] });
  check('Resigned staff with attendance in the month → record is generated', !!r);
}
{
  const r = run({ attendance: [att('2026-09-01', 'ABSENT')], staff: { ...base, monthlySalary: 30000 } });
  check('Gross equals the configured monthly salary', r?.grossSalary === 30000 && r?.dailySalary === 1000);
  check('Record is PENDING when generated', r?.paymentStatus === 'PENDING');
}

// ---- Weekly offs from School Working Days, and working days without any attendance mark ----
// November 2026: 30 days, starts on a Sunday. Sundays 1, 8, 15, 22, 29; Mondays 2, 9, 16, 23, 30.
const runNov = (o: { attendance?: any[]; workingDays?: string[]; todayIso?: string; holidays?: any[]; leaves?: any[] }) =>
  calculateStaffSalaryForMonth({
    staff: base, year: 2026, monthIndex: 11,
    attendanceRecords: (o.attendance || []) as any, leaves: (o.leaves || []) as any, holidays: (o.holidays || []) as any,
    workingDays: o.workingDays, todayIso: o.todayIso || '2026-12-05',
  });
const allMarked = (except: string[] = [], offDay = 0) => {
  const list: any[] = [];
  for (let d = 1; d <= 30; d++) {
    const iso = `2026-11-${String(d).padStart(2, '0')}`;
    if (new Date(`${iso}T00:00:00Z`).getUTCDay() === offDay || except.includes(iso)) continue;
    list.push(att(iso, 'PRESENT'));
  }
  return list;
};
{
  const r = runNov({ attendance: allMarked() });
  check('Nov: every working day present → full salary, 5 Sundays off', r?.netSalary === 30000 && r?.weeklyOffDays === 5 && (r as any)?.notMarkedDays === 0, `net ${r?.netSalary} off ${r?.weeklyOffDays}`);
}
{
  const r = runNov({ attendance: allMarked(['2026-11-03', '2026-11-04']) });
  check('Nov: 2 working days not marked → 2 × 1,000 cut', (r as any)?.notMarkedDeduction === 2000 && r?.netSalary === 28000 && (r as any)?.notMarkedDays === 2, `${(r as any)?.notMarkedDeduction}`);
}
{
  const r = runNov({ attendance: [...allMarked(['2026-11-03']), att('2026-11-03', 'ABSENT')] });
  check('Nov: 1 absent → 1,000 cut, absentDays 1', r?.unpaidLeaveDeduction === 1000 && (r as any)?.absentDays === 1 && r?.netSalary === 29000, `${r?.unpaidLeaveDeduction}`);
}
{
  // Monday is the weekly off (Monday unticked, Sunday ticked).
  const wd = ['Sunday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const r = runNov({ attendance: allMarked([], 1), workingDays: wd });
  check('Nov, Monday off: Sundays worked, 5 Mondays off → full salary', r?.netSalary === 30000 && r?.weeklyOffDays === 5, `net ${r?.netSalary} off ${r?.weeklyOffDays}`);
  const r2b = runNov({ attendance: allMarked([], 0), workingDays: wd });
  check('Nov, Monday off: Mondays not marked are not cut; Sundays not marked are (5 days)', (r2b as any)?.notMarkedDays === 5 && r2b?.netSalary === 25000, `${(r2b as any)?.notMarkedDays} ${r2b?.netSalary}`);
}
{
  const r = runNov({ attendance: [], todayIso: '2026-11-05' });
  check('Nov mid-month (today 5th): only 2nd–4th charged (today and later not)', (r as any)?.notMarkedDays === 3, `${(r as any)?.notMarkedDays}`);
}
{
  const r = runNov({ attendance: allMarked(['2026-11-14']), holidays: [{ date: '2026-11-14', name: 'Children Day' }] });
  check('Nov: unmarked holiday → not cut', (r as any)?.notMarkedDays === 0 && r?.netSalary === 30000, `${(r as any)?.notMarkedDays}`);
}
{
  const r = runNov({ attendance: allMarked(['2026-11-18']), leaves: [leave('2026-11-18', '2026-11-18', 'APPROVED', 'SICK')] });
  check('Nov: approved leave day not marked → leave rules (1 forgiven), not "not marked"', (r as any)?.notMarkedDays === 0 && r?.netSalary === 30000, `${(r as any)?.notMarkedDays}`);
}
{
  const r = run({ attendance: [] });
  check('Before the rule start (Sep 2026): unmarked days not cut', r?.netSalary === 30000 && (r as any)?.notMarkedDays === 0);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll payroll calculation checks passed.');
process.exit(failures ? 1 : 0);
