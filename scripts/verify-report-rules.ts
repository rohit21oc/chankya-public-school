/**
 * Offline checks for the report formulas (server/services/reportRules.ts).
 * Usage: npx tsx scripts/verify-report-rules.ts
 */
import * as R from '../server/services/reportRules.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const sessions = [{ name: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31' }];
check('Saved session dates are used', JSON.stringify(R.sessionRange('2026-2027', sessions)) === JSON.stringify({ start: '2026-04-01', end: '2027-03-31' }));
check('"2026-27" matches the saved "2026-2027"', R.sessionRange('2026-27', sessions).start === '2026-04-01');
check('Unknown session falls back to 1 Apr – 31 Mar', JSON.stringify(R.sessionRange('2030-2031', [])) === JSON.stringify({ start: '2030-04-01', end: '2031-03-31' }));
check('Date filter narrows the period', JSON.stringify(R.reportPeriod({ start: '2026-04-01', end: '2027-03-31' }, '2026-10-01', '2026-10-31')) === JSON.stringify({ from: '2026-10-01', to: '2026-10-31' }));
check('Date filter outside the session is clamped', R.reportPeriod({ start: '2026-04-01', end: '2027-03-31' }, '2025-01-01', '2028-01-01').from === '2026-04-01');

check('Inactive class excluded', !R.isActiveClass({ status: 'INACTIVE' }) && R.isActiveClass({}) && !R.isActiveClass({ status: 'ACTIVE', isActive: false }));
check('Inactive section excluded', JSON.stringify(R.activeSectionsOf({ detailedSections: [{ name: 'A', status: 'ACTIVE' }, { name: 'B', status: 'INACTIVE' }] })) === '["A"]');

const f = R.ledgerFigures({ totalAmount: 1000, paidAmount: 400, pendingAmount: 600 });
check('Ledger: billed = paid + pending', f.billed === 1000 && f.paid === 400 && f.pending === 600);
check('Waived bill counts as zero', R.ledgerFigures({ status: 'WAIVED', totalAmount: 900, pendingAmount: 900 }).billed === 0);
check('Pending derived when missing', R.ledgerFigures({ total: 500, paidAmount: 200 }).pending === 300);
const over = R.ledgerFigures({ totalAmount: 850, paidAmount: 900, pendingAmount: 0 });
check('Paid over bill shows as excess', over.excess === 50 && over.billed + over.excess === over.paid + over.pending);
check('Normal bill has no excess', f.excess === 0);

check('No attendance marked → null, not 100%', R.attendancePct(0, 0) === null && R.attendanceBand(null) === 'No records');
check('Attendance bands', R.attendanceBand(80) === 'Good' && R.attendanceBand(70) === 'Warning' && R.attendanceBand(55) === 'Critical' && R.attendanceBand(40) === 'Severe');
check('Age uses the real date (birthday not yet reached)', R.ageOn('2016-12-27', '2026-10-22') === 9 && R.ageOn('2016-01-02', '2026-10-22') === 10);
check('Invalid DOB → null', R.ageOn('not-a-date', '2026-10-22') === null);
check('Percent rounding', R.pct(1, 3) === 33.3 && R.pct(5, 0) === 0);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll report rule checks passed.');
process.exit(failures ? 1 : 0);
