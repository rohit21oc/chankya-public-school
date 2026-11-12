/**
 * Offline checks for the parent portal's pure rules. No server, no network.
 *
 * Run: npx tsx scripts/verify-parent-portal-rules.ts
 */
import { summarizeStudentFees, kolkataDate, ledgerPending } from '../src/utils/parentFeeSummary';
import { classLabel, classSectionLabel } from '../src/utils/classLabel';
import {
  buildChildTimetable,
  homeworkForChild,
  homeworkDueStatus,
  upcomingCalendar,
  formatDisplayDate,
} from '../src/utils/parentPortalRules';
import { toBroadcastSafePayload } from '../server/services/realtimeRedaction';

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}${detail ? ` (${detail})` : ''}`); }
};

// 20 Oct 2026, 10:00 IST
const NOW = new Date('2026-10-20T04:30:00Z');

console.log('\n-- Fee summary (one balance on every parent screen)');
{
  const ledgers = [
    { totalAmount: 5000, paidAmount: 5000, pendingAmount: 0, status: 'PAID', dueDate: '2026-09-10' },
    { totalAmount: 3050, paidAmount: 0, pendingAmount: 3050, status: 'OVERDUE', dueDate: '2026-10-10' },
    { totalAmount: 3000, paidAmount: 1000, status: 'PARTIAL', dueDate: '2026-11-10' },
  ];
  const s = summarizeStudentFees(ledgers, [{ amount: 6000 }], NOW);
  check('billed = sum of ledger totals', s.totalBilled === 11050, String(s.totalBilled));
  check('pending uses pendingAmount, else total - paid', s.totalPending === 3050 + 2000, String(s.totalPending));
  check('paid = max(payments, ledger paid)', s.totalPaid === 6000, String(s.totalPaid));
  check('overdue counts OVERDUE / past-due pending only', s.overdue === 3050 && s.overdueCount === 1, `${s.overdue}/${s.overdueCount}`);
  check('current month due (Oct 2026)', s.currentMonthDue === 3050, String(s.currentMonthDue));
  const none = summarizeStudentFees([], [], NOW);
  check('no ledgers: nothing pending and ledgerCount 0 (screen says "No fee records")', none.totalPending === 0 && none.ledgerCount === 0);
  check('regression: structures are not used, so a child with ledgers is never "Cleared" by accident',
    summarizeStudentFees([{ amount: 1500, fine: 50 }], [], NOW).totalPending === 1550);
  check('late fee via fine counts when total missing', ledgerPending({ amount: 1500, fine: 50, paidAmount: 0 }) === 1550);
  check('fully paid ledger is not pending', ledgerPending({ totalAmount: 100, paidAmount: 100 }) === 0);
  check('bad numbers are treated as 0, never NaN', !Number.isNaN(summarizeStudentFees([{ totalAmount: 'abc' as any }], [], NOW).totalBilled));
  check('feeMonth of last year is not "current month"',
    summarizeStudentFees([{ totalAmount: 10, feeMonth: 'Oct 2025', status: 'OVERDUE' }], [], NOW).currentMonthDue === 0);
}

console.log('\n-- Asia/Kolkata date');
check('23:30 UTC on 19 Oct is 20 Oct in IST', kolkataDate(new Date('2026-10-19T23:30:00Z')) === '2026-10-20');
check('18:00 UTC on 19 Oct is 23:30 IST, still 19 Oct', kolkataDate(new Date('2026-10-19T18:00:00Z')) === '2026-10-19');

console.log('\n-- Class labels (no "Class Class 2", no invented class)');
check('"Class 2" stays', classLabel('Class 2') === 'Class 2');
check('"2" becomes "Class 2"', classLabel('2') === 'Class 2');
check('"Nursery" stays', classLabel('Nursery') === 'Nursery');
check('missing class is not invented', classLabel('') === 'Class not recorded' && classLabel(undefined) === 'Class not recorded');
check('section omitted when missing', classSectionLabel('Class 2', '') === 'Class 2' && classSectionLabel('Class 2', 'A') === 'Class 2 - A');

console.log('\n-- Child timetable');
{
  const slots = [
    { id: '1', classId: 'c-2', section: 'A', dayOfWeek: 'MONDAY', periodNumber: 2, subjectName: 'Math', academicSession: '2026-2027' },
    { id: '2', classId: 'c-2', section: 'A', dayOfWeek: 'Monday', periodNumber: 1, subjectName: 'English', academicSession: '2026-2027' },
    { id: '3', classId: 'c-2', section: 'B', dayOfWeek: 'Monday', periodNumber: 1, subjectName: 'Other section' },
    { id: '4', classId: 'c-8', section: 'A', dayOfWeek: 'Monday', periodNumber: 1, subjectName: 'Other class' },
    { id: '5', classId: 'c-2', section: 'A', dayOfWeek: 'Tuesday', periodNumber: 1, subjectName: 'Old session', academicSession: '2025-2026' },
  ];
  const w = buildChildTimetable(slots, { id: 's', classId: 'c-2', section: 'A' }, '2026-2027');
  check('only the child class + section + session', w.slotCount === 2, String(w.slotCount));
  check('ordered by period within a day', w.days[0].slots.map((s) => s.subjectName).join() === 'English,Math');
  check('periods derived from slots', w.periods.map((p) => p.number).join() === '1,2');
  check('six school days', w.days.length === 6);
  check('no class id on record falls back to class name', buildChildTimetable([{ className: 'Nursery', dayOfWeek: 'Fri', periodNumber: 1 }], { id: 's', className: 'nursery' }).slotCount === 1);
}

console.log('\n-- Homework (due-date status only; no fake "completed")');
{
  check('due today', homeworkDueStatus('2026-10-20', '2026-10-20') === 'DUE_TODAY');
  check('upcoming', homeworkDueStatus('2026-10-25', '2026-10-20') === 'UPCOMING');
  check('past due', homeworkDueStatus('2026-10-01', '2026-10-20') === 'PAST_DUE');
  check('missing date', homeworkDueStatus('', '2026-10-20') === 'NO_DUE_DATE');
  const list = homeworkForChild(
    [
      { id: 'a', classId: 'c-2', section: 'A', dueDate: '2026-10-25' },
      { id: 'b', classId: 'c-2', section: 'A', dueDate: '2026-10-20' },
      { id: 'c', classId: 'c-2', section: 'A', dueDate: '2026-10-01' },
      { id: 'd', classId: 'c-2', section: 'B', dueDate: '2026-10-22' },
      { id: 'e', classId: 'c-9', section: 'A', dueDate: '2026-10-22' },
      { id: 'f', classId: 'c-2', dueDate: '2026-10-23' },
    ],
    { id: 's', classId: 'c-2', section: 'A' },
    NOW
  );
  check('other class/section excluded; whole-class homework included', list.map((h) => h.id).sort().join() === 'a,b,c,f');
  check('due today first, then soonest upcoming, past last', list.map((h) => h.id).join() === 'b,f,a,c', list.map((h) => h.id).join());
}

console.log('\n-- Holidays & events');
{
  const items = upcomingCalendar(
    [
      { id: '1', name: 'Old', date: '2026-09-01' },
      { id: '2', name: 'Durga Puja', date: '2026-10-19', endDate: '2026-10-22' },
      { id: '3', name: 'Diwali', date: '2026-11-01' },
    ],
    [
      { id: 'e1', title: 'Science Fair', eventDate: '2026-10-24' },
      { id: 'e2', title: 'Hidden', eventDate: '2026-10-25', isActive: false },
      { id: 'e3', title: 'Past', eventDate: '2026-10-01' },
    ],
    NOW
  );
  check('past and inactive items excluded; ongoing holiday kept', items.map((i) => i.title).join() === 'Durga Puja,Science Fair,Diwali', items.map((i) => i.title).join());
  check('display date', formatDisplayDate('2026-10-24') === '24 Oct 2026');
}

console.log('\n-- Realtime redaction (no personal data to signed-out viewers)');
{
  const student = { id: 'stu-1', name: 'A Child', aadhaarNumber: '1234', fatherMobile: '9999999999', dob: '2015-01-01' };
  const u = toBroadcastSafePayload('STUDENT', 'UPDATE', student, 'Updated A Child');
  check('student update carries no record and no description', u.data === undefined && u.description === undefined);
  const d = toBroadcastSafePayload('STUDENT', 'DELETE', student);
  check('student delete keeps only the id', JSON.stringify(d.data) === '{"id":"stu-1"}');
  for (const e of ['FEE', 'FEE_PAYMENT', 'FEE_LEDGER', 'ATTENDANCE', 'EXAM_MARK', 'TEACHER', 'STAFF', 'STAFF_PAYROLL', 'DOCUMENT', 'HOSTEL', 'AUDIT_LOG', 'ADMIN_ACCOUNT', 'NOTICE']) {
    const r = toBroadcastSafePayload(e, 'CREATE', { id: 'x', amount: 500, studentName: 'A Child' }, 'Collected ₹500 for A Child');
    check(`${e} create is a bare signal`, r.data === undefined && r.description === undefined);
  }
  const settings = toBroadcastSafePayload('SETTINGS', 'UPDATE', { currentAcademicSession: '2026-2027', brevoApiKey: 'k', smtpPassword: 'p' });
  check('settings keep only session fields', JSON.stringify(settings.data) === '{"currentAcademicSession":"2026-2027"}');
  const cls = toBroadcastSafePayload('CLASS', 'UPDATE', { id: 'c-1', name: 'Class 1' }, 'Updated class');
  check('school-level entity (CLASS) is unchanged', cls.data?.name === 'Class 1' && cls.description === 'Updated class');
}

console.log(`\nPARENT PORTAL RULES: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
