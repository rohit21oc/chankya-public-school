/**
 * Offline checks for leave day counting, leave validation and fee-due summaries
 * (server/services/engagementRules.ts).
 *
 * Usage: npx tsx scripts/verify-engagement-rules.ts
 */
import { buildFeeDueText, leaveWorkingDates, summarizeFeeDues, validateLeaveInput, eachDate } from '../server/services/engagementRules.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

// October 2026: Sundays on 4, 11, 18, 25.
check('Mon–Sat is 6 working days', leaveWorkingDates('2026-10-19', '2026-10-24').length === 6);
check('Range over a Sunday skips it', leaveWorkingDates('2026-10-24', '2026-10-26').length === 2);
check('Holiday inside the range is skipped', leaveWorkingDates('2026-10-19', '2026-10-21', [{ date: '2026-10-20' }]).length === 2);
check('Multi-day holiday is skipped', leaveWorkingDates('2026-10-19', '2026-10-24', [{ date: '2026-10-20', endDate: '2026-10-22' }]).length === 3);
check('Month boundary is handled', eachDate('2026-10-30', '2026-11-02').join(',') === '2026-10-30,2026-10-31,2026-11-01,2026-11-02');
check('End before start → no days', leaveWorkingDates('2026-10-20', '2026-10-19').length === 0);

check('Valid leave passes', validateLeaveInput({ startDate: '2026-10-20', endDate: '2026-10-21', reason: 'Fever' }, 2) === null);
check('Missing reason is rejected', validateLeaveInput({ startDate: '2026-10-20', endDate: '2026-10-21', reason: '  ' }, 2) !== null);
check('Bad date is rejected', validateLeaveInput({ startDate: '2026-02-30', endDate: '2026-03-01', reason: 'x' }, 1) !== null);
check('Only Sunday → rejected', validateLeaveInput({ startDate: '2026-10-25', endDate: '2026-10-25', reason: 'x' }, 0) !== null);

const ledgers = [
  { id: 'a', studentId: 's', pendingAmount: 1500, dueDate: '2026-09-10', feeMonth: 'September 2026' },
  { id: 'b', studentId: 's', pendingAmount: 1500, dueDate: '2026-11-10', feeMonth: 'November 2026' },
  { id: 'c', studentId: 's', pendingAmount: 0, dueDate: '2026-08-10', feeMonth: 'August 2026' },
  { id: 'd', studentId: 's', status: 'WAIVED', pendingAmount: 900, dueDate: '2026-07-10' },
  { id: 'a', studentId: 's', pendingAmount: 1500, dueDate: '2026-09-10' }, // duplicate
  { id: 'e', studentId: 's', totalAmount: 2000, paidAmount: 500, dueDate: '2026-10-01', feeType: 'Exam Fee' },
];
const sum = summarizeFeeDues(ledgers, '2026-10-22');
check('Pending total skips paid, waived and duplicate ledgers', sum.totalPending === 4500, String(sum.totalPending));
check('Overdue counts only past due dates', sum.overdue === 3000 && sum.overdueCount === 2, `${sum.overdue}/${sum.overdueCount}`);
check('Items sorted by due date', sum.items.map((i) => i.label).join('|') === 'September 2026|Exam Fee|November 2026');
check('Nothing pending → zero', summarizeFeeDues([], '2026-10-22').totalPending === 0);
const text = buildFeeDueText('CPS', 'Aman', sum, 'Last date 30 Oct');
check('Alert text mentions amount, overdue and note', text.includes('Rs.4,500') && text.includes('Rs.3,000') && text.includes('Last date 30 Oct'), text);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll engagement rule checks passed.');
process.exit(failures ? 1 : 0);
