/**
 * Offline checks for the mobile Parent Portal: child selection, data rules,
 * back navigation, QR privacy and UI hygiene. No server, no network.
 *
 * Run: npx tsx test/verify-parent-portal.ts
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  authorizedChildren,
  chooseActiveChildId,
  classLabel,
  classSectionLabel,
  evaluateMarks,
  formatRupees,
  homeworkForChild,
  kolkataDate,
  ledgerState,
  publishedExamsForChild,
  shiftMonth,
  summarizeAttendance,
  summarizeFees,
  timetableForChild,
  upcomingCalendar,
  upcomingExamsForChild,
} from '../src/utils/parentRules';
import { buildStudentIdCardModel } from '../src/utils/idCardModel';
import { parentBackAction } from '../src/parent/routes';


let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}${detail ? ` (${detail})` : ''}`); }
};
const NOW = new Date('2026-10-20T04:30:00Z'); // 20 Oct 2026, 10:00 IST

console.log('\n-- Authorized children and active child');
{
  const server = [
    { id: 'a1', admissionNumber: 'ADM-1', name: 'Asha' },
    { id: 'a2', admissionNumber: 'ADM-2', name: 'Aman' },
    { id: 'x9', admissionNumber: 'ADM-9', name: 'Other family' },
    { id: 'a1', admissionNumber: 'ADM-1', name: 'Asha (duplicate)' },
  ];
  const own = authorizedChildren(server, ['a1', 'a2']);
  check('only linked children are kept', own.map((c) => c.id).join() === 'a1,a2');
  check('a record outside the linked list is dropped (defence in depth)', !own.some((c) => c.id === 'x9'));
  check('duplicates collapse', own.length === 2);
  check('linked by admission number also works', authorizedChildren([{ id: 'z', admissionNumber: 'ADM-7' }], ['ADM-7']).length === 1);
  check('empty linked list trusts the server-scoped list', authorizedChildren(server.slice(0, 2), []).length === 2);
  check('stored choice wins when still authorized', chooseActiveChildId(own, 'a2', 'a1') === 'a2');
  check('stored id of another family is ignored', chooseActiveChildId(own, 'x9', 'a1') === 'a1');
  check('stale stored id falls back to session child', chooseActiveChildId(own, 'gone', 'a2') === 'a2');
  check('nothing valid: first child', chooseActiveChildId(own, 'gone', 'gone2') === 'a1');
  check('single child: that child', chooseActiveChildId([own[0]], null, null) === 'a1');
  check('no children: null (empty state, never a guess)', chooseActiveChildId([], 'a1', 'a1') === null);
}

console.log('\n-- Labels never invent data');
check('"Class 2" stays', classLabel('Class 2') === 'Class 2');
check('"8" becomes "Class 8"', classLabel('8') === 'Class 8');
check('missing class is "Class not recorded"', classLabel('') === 'Class not recorded');
check('missing section is omitted', classSectionLabel('Nursery', '') === 'Nursery');
check('rupees format', formatRupees(32050) === '₹32,050' && formatRupees(undefined) === '—');

console.log('\n-- Attendance');
{
  const recs = [
    { studentId: 'a1', date: '2026-10-01', status: 'PRESENT' },
    { studentId: 'a1', date: '2026-10-02', status: 'ABSENT' },
    { studentId: 'a1', date: '2026-10-03', status: 'LATE' },
    { studentId: 'a1', date: '2026-10-05', status: 'LEAVE' },
    { studentId: 'a1', date: '2026-10-06', status: 'HOLIDAY' },
    { studentId: 'a1', date: '2026-09-30', status: 'PRESENT' },
    { studentId: 'x9', date: '2026-10-01', status: 'ABSENT' },
    { studentId: 'a1', date: 'bad', status: 'PRESENT' },
    { studentId: 'a1', date: '2026-10-07', status: 'MAYBE' },
  ];
  const oct = summarizeAttendance(recs, 'a1', '2026-10');
  check('month filter and other child excluded', oct.days.length === 5, String(oct.days.length));
  check('late counts as present', oct.present === 2 && oct.late === 1);
  check('holiday is not a school day', oct.total === 4);
  check('percentage = present / school days', oct.percentage === 50, String(oct.percentage));
  check('latest day first', oct.days[0].date === '2026-10-06');
  check('no records: percentage is null, never 100%', summarizeAttendance([], 'a1', '2026-10').percentage === null);
  check('month navigation', shiftMonth('2026-01', -1) === '2025-12' && shiftMonth('2026-12', 1) === '2027-01');
}

console.log('\n-- Fees (same rules as the website)');
{
  const ledgers = [
    { totalAmount: 5000, paidAmount: 5000, pendingAmount: 0, status: 'PAID', dueDate: '2026-09-10' },
    { totalAmount: 3050, paidAmount: 0, pendingAmount: 3050, status: 'OVERDUE', dueDate: '2026-10-10' },
    { totalAmount: 3000, paidAmount: 1000, status: 'PARTIAL', dueDate: '2026-11-10' },
  ];
  const s = summarizeFees(ledgers, [{ amount: 6000 }], NOW);
  check('pending from ledgers', s.totalPending === 5050, String(s.totalPending));
  check('paid = max(payments, ledger paid)', s.totalPaid === 6000);
  check('overdue only past-due pending', s.overdue === 3050 && s.overdueCount === 1);
  check('no ledgers: ledgerCount 0 (screen says "No fee records", not "Paid")', summarizeFees([], [], NOW).ledgerCount === 0);
  check('bill states', ledgerState(ledgers[0], NOW) === 'PAID' && ledgerState(ledgers[1], NOW) === 'OVERDUE' && ledgerState(ledgers[2], NOW) === 'PARTIAL');
}

console.log('\n-- Timetable, homework, calendar');
{
  const child = { id: 'a1', classId: 'c-2', section: 'A' };
  const tt = timetableForChild(
    [
      { classId: 'c-2', section: 'A', dayOfWeek: 'MONDAY', periodNumber: 2, subjectName: 'Math' },
      { classId: 'c-2', section: 'A', dayOfWeek: 'Monday', periodNumber: 1, subjectName: 'English' },
      { classId: 'c-2', section: 'B', dayOfWeek: 'Monday', periodNumber: 1, subjectName: 'Other section' },
      { classId: 'c-8', section: 'A', dayOfWeek: 'Monday', periodNumber: 1, subjectName: 'Other class' },
    ],
    child
  );
  check('timetable: only the child class and section, in period order', tt.slotCount === 2 && tt.days[0].slots.map((s) => s.subjectName).join() === 'English,Math');
  const hw = homeworkForChild(
    [
      { id: 'a', classId: 'c-2', section: 'A', dueDate: '2026-10-25' },
      { id: 'b', classId: 'c-2', section: 'A', dueDate: '2026-10-20' },
      { id: 'c', classId: 'c-2', section: 'A', dueDate: '2026-10-01' },
      { id: 'd', classId: 'c-9', section: 'A', dueDate: '2026-10-22' },
    ],
    child,
    NOW
  );
  check('homework: other class excluded, due today first, past last', hw.map((h) => h.id).join() === 'b,a,c');
  const cal = upcomingCalendar(
    [{ id: '1', name: 'Old', date: '2026-09-01' }, { id: '2', name: 'Diwali', date: '2026-11-01' }],
    [{ id: 'e', title: 'Fair', eventDate: '2026-10-24' }, { id: 'f', title: 'Hidden', eventDate: '2026-10-25', isActive: false }],
    NOW
  );
  check('calendar: past and inactive excluded, soonest first', cal.map((c) => c.title).join() === 'Fair,Diwali');
  check('IST date', kolkataDate(new Date('2026-10-19T23:30:00Z')) === '2026-10-20');
}

console.log('\n-- Exams and marks');
{
  const child = { id: 'a1', classId: 'c-2' };
  const exams = [
    { id: 'e1', academicSession: '2026-2027', classIds: ['c-2'], resultsStatus: 'PUBLISHED', status: 'COMPLETED', startDate: '2026-09-10' },
    { id: 'e2', academicSession: '2026-2027', classIds: ['c-2'], resultsStatus: 'DRAFT', status: 'COMPLETED', startDate: '2026-09-20' },
    { id: 'e3', academicSession: '2025-2026', classIds: ['c-2'], resultsStatus: 'PUBLISHED', status: 'COMPLETED', startDate: '2025-09-10' },
    { id: 'e4', academicSession: '2026-2027', classIds: ['c-8'], resultsStatus: 'PUBLISHED', status: 'COMPLETED', startDate: '2026-09-11' },
    { id: 'e5', academicSession: '2026-2027', classIds: ['c-2'], resultsStatus: 'PUBLISHED', status: 'DRAFT', startDate: '2026-09-12' },
  ];
  check('published, same session, own class, not draft', publishedExamsForChild(exams, child, '2026-2027').map((e) => e.id).join() === 'e1');
  check('changing session changes the exam list', publishedExamsForChild(exams, child, '2025-2026').map((e) => e.id).join() === 'e3');
  check('a completed exam with published results is shown (status need not be PUBLISHED)', publishedExamsForChild(exams, child, '2026-2027').some((e) => e.status === 'COMPLETED'));
  const up = upcomingExamsForChild([{ id: 'u1', classIds: ['c-2'], startDate: '2026-10-28', endDate: '2026-10-30', status: 'UPCOMING' }, { id: 'u2', classIds: ['c-2'], startDate: '2026-10-01', status: 'COMPLETED' }], child, NOW);
  check('the same exam saved twice is listed once', upcomingExamsForChild([{ id: 'd1', name: 'Half Yearly', classIds: [], startDate: '2026-11-10', endDate: '2026-11-20' }, { id: 'd2', name: 'Half Yearly', classIds: [], startDate: '2026-11-10', endDate: '2026-11-20' }], child, NOW).length === 1);
  check('upcoming exams exclude finished ones', up.map((e) => e.id).join() === 'u1');

  const marks = [
    { studentId: 'a1', examId: 'e1', subjectId: 's1', marksObtained: 42, maxMarks: 50 },
    { studentId: 'a1', examId: 'e1', subjectId: 's2', marksObtained: 18, maxMarks: 50 },
    { studentId: 'a1', examId: 'e1', subjectId: 's3', isAbsent: true, maxMarks: 50 },
    { studentId: 'x9', examId: 'e1', subjectId: 's1', marksObtained: 50, maxMarks: 50 },
    { studentId: 'a1', examId: 'e2', subjectId: 's1', marksObtained: 1, maxMarks: 50 },
    { studentId: 'a1', examId: 'e1', subjectId: 's4', marksObtained: 10 },
    { studentId: 'a1', examId: 'e1', subjectId: 's1', marksObtained: 0, maxMarks: 50 },
  ];
  const r = evaluateMarks(marks, 'a1', 'e1', { s1: 'Mathematics', s2: 'English', s3: 'Science' });
  check('other child and other exam marks are excluded', r.rows.length === 3, String(r.rows.length));
  check('a row without a real maximum is skipped, not assumed 100', !r.rows.some((x) => x.subjectId === 's4'));
  check('duplicate subject rows are not double counted', r.totalMax === 150 && r.totalObtained === 60, `${r.totalObtained}/${r.totalMax}`);
  check('absent shows as absent, not 0 marks', r.rows.find((x) => x.subjectId === 's3')?.obtained === null && r.rows.find((x) => x.subjectId === 's3')?.grade === 'AB');
  check('subject names from the school list', r.rows.some((x) => x.subject === 'Mathematics'));
  check('an absent subject means the result is not a pass', r.result === 'FAIL');
  check('no marks: no grade or percentage invented', evaluateMarks([], 'a1', 'e1', {}).percentage === null && evaluateMarks([], 'a1', 'e1', {}).grade === null);
}

console.log('\n-- Android back in the parent portal');
check('open screen closes first', parentBackAction(['timetable'], 'fees') === 'pop');
check('a tab other than Home goes to Home', parentBackAction([], 'fees') === 'home');
check('Home lets the app exit', parentBackAction([], 'home') === 'exit');

console.log('\n-- Student ID card QR privacy');
{
  const child = { id: 'st-1', admissionNumber: 'ADM-1', name: 'Asha', className: 'Class 2', section: 'A', rollNumber: '4', dob: '2015-01-01', fatherMobile: '9999999999', parentPhone: '9999999999' };
  const signed = 'PDS1.S.c3QtMQ.abcdefghijklmnopqrstuv';
  const m = buildStudentIdCardModel(child, {}, signed);
  check('QR shows the signed code from the server, nothing else', m.qrToken === signed);
  check('QR has no date of birth or phone number', !String(m.qrToken).includes('2015') && !String(m.qrToken).includes('9999999999'));
  check('no server code -> no QR (never a self-made one)', buildStudentIdCardModel(child, {}).qrToken === undefined);
}

console.log('\n-- UI hygiene (static checks over src/parent)');
{
  const dir = join(__dirname, '..', 'src', 'parent');
  const files: string[] = [];
  const walk = (d: string) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : /\.tsx?$/.test(e.name) && files.push(join(d, e.name))));
  walk(dir);
  const src = files.map((f) => ({ f, s: readFileSync(f, 'utf8') }));
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  check('no emoji used as icons', src.every(({ s }) => !emoji.test(s)), src.filter(({ s }) => emoji.test(s)).map(({ f }) => f.split('/').pop()).join(','));
  const switchers = src.filter(({ f, s }) => !f.endsWith('ParentChildContext.tsx') && /selectChild\(/.test(s)).map(({ f }) => f.split('/').pop());
  // My Children, and the portal itself when a fee notification for a second child is tapped.
  check('child switching is called only from My Children and from a tapped notification', [...switchers].sort().join() === 'ParentChildrenScreen.tsx,ParentPortal.tsx', switchers.join(','));
  check('no screen calls switchChild directly', src.every(({ f, s }) => f.endsWith('ParentChildContext.tsx') || !/switchChild\(/.test(s)));
  const tech = /(MongoDB|Atlas|Render server|Production Server|v1\.0|Lorem|dummy|sample data)/i;
  check('no technical or placeholder text', src.every(({ s }) => !tech.test(s)), src.filter(({ s }) => tech.test(s)).map(({ f }) => f.split('/').pop()).join(','));
  const nav = readFileSync(join(__dirname, '..', 'src', 'navigation', 'AppNavigator.tsx'), 'utf8');
  const api = readFileSync(join(__dirname, '..', 'src', 'services', 'apiService.ts'), 'utf8');
  check('response cache is keyed by session token (no cross-account data)', /cacheKey = `\$\{token \|\| 'anon'\}\|/.test(api));
  check('expired session clears cache and returns to login', /clearSession\(\);\s*this\.clearCache\(\);\s*if \(hadSession\) this\.notifySessionExpired\(\)/.test(api));
  const ctx = readFileSync(join(dir, 'ParentChildContext.tsx'), 'utf8');
  check('child switch is confirmed by the server before it takes effect', /await apiService\.switchChild\(/.test(ctx));
  check('cached data is cleared after a child switch', /switchChild[\s\S]{0,600}apiService\.clearCache\(\)/.test(ctx));
  check('parents are routed to the parent portal',/authUser\.role === 'PARENT'[\s\S]{0,80}<ParentPortal/.test(nav));
}

console.log(`\nMOBILE PARENT PORTAL: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
