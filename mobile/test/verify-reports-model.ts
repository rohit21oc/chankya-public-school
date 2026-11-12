/**
 * Mobile reports: period presets, class options, withheld data and share text.
 * Run: npx tsx test/verify-reports-model.ts
 */
import { classOptions, presetRange, shareText, tabView } from '../src/utils/reportModel';
import { toIdentity } from '../src/utils/schoolIdentityModel';
import { getAuthorizedModulesForUser, getDoMoreGridModules } from '../src/utils/rbac';

let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || extra === undefined ? '' : `  → ${JSON.stringify(extra)}`}`);
};

// Periods
check('Whole session sends no dates', JSON.stringify(presetRange('SESSION', '2026-10-22')) === '{}');
check('This month', JSON.stringify(presetRange('THIS_MONTH', '2026-10-22')) === JSON.stringify({ dateFrom: '2026-10-01', dateTo: '2026-10-22' }));
check('Last month', JSON.stringify(presetRange('LAST_MONTH', '2026-10-22')) === JSON.stringify({ dateFrom: '2026-09-01', dateTo: '2026-09-30' }));
check('Last month across a year', JSON.stringify(presetRange('LAST_MONTH', '2027-01-05')) === JSON.stringify({ dateFrom: '2026-12-01', dateTo: '2026-12-31' }));
check('Last 30 days', JSON.stringify(presetRange('LAST_30', '2026-10-22')) === JSON.stringify({ dateFrom: '2026-09-23', dateTo: '2026-10-22' }));

// Classes
const opts = classOptions([
  { id: 'c2', name: 'Class 2', numericOrder: 2, sections: ['A', 'B'] },
  { id: 'c1', name: 'Class 1', numericOrder: 1, detailedSections: [{ name: 'a', status: 'ACTIVE' }, { name: 'B', status: 'INACTIVE' }] },
  { id: 'cx', name: 'Old class', status: 'INACTIVE', sections: ['A'] },
]);
check('Inactive classes left out', !opts.some((c) => c.id === 'cx'));
check('Ordered by class order', opts[0].id === 'c1');
check('Only active sections', JSON.stringify(opts[0].sections) === '["A"]', opts[0].sections);

// Withheld fees and salary
const restricted = {
  meta: { academicSession: '2026-2027', period: { from: '2026-04-01', to: '2027-03-31' } },
  executiveSummary: { students: { totalActive: 10, newAdmissions: 2 }, staff: { totalActiveStaff: 3, teachingStaff: 2 }, attendance: { overallAttendancePercentage: 0, totalMarked: 0 }, examination: { passPercentage: 0, appeared: 0 }, fees: null },
  feeCollectionAndAudit: null,
  facultyAndPayroll: { summary: { totalActiveFaculty: 3, teachingStaff: 2, nonTeachingStaff: 1, canViewPayroll: false }, staffWise: [{ employeeName: 'A', employeeId: 'E1', employmentStatus: 'ACTIVE', netSalary: 'CONFIDENTIAL' }] },
  trends: { monthlyAttendance: [] },
};
const sum = tabView('SUMMARY', restricted);
check('No fee cards when fees are withheld', !sum.kpis.some((k) => /Fee|Outstanding/.test(k.label)));
check('Notice explains withheld fees', /not shown/.test(sum.notice || ''));
check('Attendance with nothing marked has no tone', sum.kpis.find((k) => k.label === 'Attendance')!.tone === undefined);
check('Fees tab shows only the notice', tabView('FEES', restricted).kpis.length === 0 && /not available/.test(tabView('FEES', restricted).notice || ''));
const staff = tabView('STAFF', restricted);
check('No salary for non-payroll roles', !JSON.stringify(staff).includes('CONFIDENTIAL') && !staff.kpis.some((k) => /payroll/i.test(k.label)));

// Share text carries the saved identity, never invented values
const sid = toIdentity({ schoolName: 'RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR', affiliatedBoard: 'BSEB', affiliationNumber: '10030206405' } as any);
const txt = shareText('SUMMARY', restricted, sid, 'Session 2026-2027', 'Principal', new Date('2026-10-22T10:00:00Z'));
check('Share text has school name', txt.startsWith('RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR'));
check('Share text has BSEB affiliation', txt.includes('BSEB') && !txt.includes('CBSE'));
check('Share text has filters and author', txt.includes('Session 2026-2027') && txt.includes('by Principal'));
const blank = shareText('SUMMARY', restricted, toIdentity({} as any), '', 'X');
check('Missing name shows Not configured', blank.startsWith('Not configured'));

// Menu
const mk = (role: string) => ({ id: 'u', name: 'U', role, permissions: [] } as any);
check('Principal sees Reports', getDoMoreGridModules(mk('PRINCIPAL')).some((m) => m.id === 'reports'));
check('Accountant sees Reports', getDoMoreGridModules(mk('ACCOUNTANT')).some((m) => m.id === 'reports'));
check('Teacher does not see Reports', !getAuthorizedModulesForUser(mk('TEACHER')).some((m) => m.id === 'reports'));
check('Parent does not see Reports', !getAuthorizedModulesForUser(mk('PARENT')).some((m) => m.id === 'reports'));

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll mobile report checks passed.');
