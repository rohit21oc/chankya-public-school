/**
 * Teacher Home Dashboard — view-model verification.
 *
 * Offline: exercises the pure mapping helpers in src/utils/teacherHomeModel.ts with
 * synthetic API-shaped inputs. It does not call the backend and ships nothing to the app.
 * Run with: npx tsx test/verify-teacher-home-model.ts
 */
import {
  buildPendingTasks,
  buildSummaryCards,
  buildTimetableView,
  classLabel,
  firstNameOf,
  formatHeaderDate,
  formatNoticeDate,
  greetingForHour,
  initialsOf,
} from '../src/utils/teacherHomeModel';
import type { TeacherAssignedSectionSummary, TeacherPendingMarksTask, TeacherTodaySlot } from '../src/types/teacher';

let failures = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ PASS: ${name}`);
  } else {
    failures++;
    console.error(`  ❌ FAIL: ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
};

const slot = (over: Partial<TeacherTodaySlot>): TeacherTodaySlot => ({
  id: 's',
  periodNumber: 1,
  status: 'UPCOMING',
  ...over,
});

console.log('=== TEACHER HOME VIEW-MODEL ===\n');

console.log('Greeting & names');
check('morning < 12', greetingForHour(9), 'Good Morning');
check('afternoon 12–16', greetingForHour(14), 'Good Afternoon');
check('evening >= 17', greetingForHour(18), 'Good Evening');
check('first name skips Mrs.', firstNameOf('Mrs. Sunita Verma'), 'Sunita');
check('first name plain', firstNameOf('Ananya Sharma'), 'Ananya');
check('first name empty', firstNameOf(''), '');
check('initials skip title', initialsOf('Dr. Ravi Kumar'), 'RK');
check('initials fallback', initialsOf(''), 'T');

console.log('\nDates');
check(
  'header date uses server date + session',
  formatHeaderDate('2026-10-19', '2026-2027'),
  'MONDAY, 19 OCTOBER 2026 \u00B7 SESSION 2026\u20132027'
);
check('header date without session', formatHeaderDate('2026-10-19'), 'MONDAY, 19 OCTOBER 2026');
check('header date invalid', formatHeaderDate('nope', undefined), '');
check('notice date', formatNoticeDate('2026-10-18T10:00:00'), '18 Oct 2026');
check('notice date invalid', formatNoticeDate('garbage'), '');

console.log('\nTimetable card');
const active = slot({
  id: 'a',
  periodNumber: 2,
  status: 'ACTIVE',
  startTime: '09:30',
  endTime: '10:10',
  subjectName: 'Mathematics',
  className: 'VII',
  section: 'A',
  roomNumber: '204',
});
const next = slot({
  id: 'b',
  periodNumber: 3,
  status: 'UPCOMING',
  startTime: '10:20',
  subjectName: 'Mathematics',
  className: 'VII',
  section: 'B',
  roomNumber: '205',
});
const done = slot({ id: 'c', periodNumber: 1, status: 'COMPLETED', startTime: '08:40' });

const withActive = buildTimetableView([next, done, active]);
check('badge counts all periods', withActive.badge, '3 classes');
check('headline is the active slot', withActive.headline, {
  kind: 'NOW',
  timeLabel: 'NOW \u00B7 09:30\u201310:10',
  title: 'Mathematics \u00B7 VII A',
  meta: 'Section A \u00B7 Room 204',
});
check('following is first upcoming', withActive.following, 'Next 10:20 \u00B7 VII B \u00B7 Room 205');

const noActive = buildTimetableView([done, next]);
check('no active: headline is next slot', noActive.headline?.kind, 'NEXT');
check('no active: nothing follows a single upcoming', noActive.following, '');

const allDone = buildTimetableView([done]);
check('all completed', allDone.headline?.kind, 'DONE');
check('single period badge is singular', allDone.badge, '1 class');

const empty = buildTimetableView([]);
check('empty has no headline', empty.headline, null);
check('empty message', empty.emptyText, 'No periods scheduled for today.');
check('null input is safe', buildTimetableView(null).count, 0);
check(
  'missing room/section falls back to period number',
  buildTimetableView([slot({ status: 'ACTIVE', periodNumber: 4, subjectName: 'Science', className: 'VI' })]).headline?.meta,
  'Period 4'
);

console.log('\nPending tasks');
const sections: TeacherAssignedSectionSummary[] = [
  {
    classId: 'c7',
    className: 'VII',
    section: 'A',
    isClassTeacher: true,
    studentCount: 32,
    subjects: [],
    attendance: { isMarked: false, present: 0, absent: 0, late: 0, leave: 0 },
  },
  {
    classId: 'c7',
    className: 'VII',
    section: 'B',
    isClassTeacher: false,
    studentCount: 1,
    subjects: [],
    attendance: { isMarked: true, present: 1, absent: 0, late: 0, leave: 0 },
  },
];
const marks: TeacherPendingMarksTask[] = [
  {
    examId: 'e1',
    examTitle: 'Term I',
    classId: 'c7',
    className: 'VII',
    section: 'A',
    subjectId: 'm',
    subjectName: 'Mathematics',
    totalStudents: 32,
    enteredCount: 5,
    missingCount: 27,
    status: 'IN_PROGRESS',
  },
  {
    examId: 'e1',
    examTitle: 'Term I',
    classId: 'c7',
    className: 'VII',
    section: 'B',
    subjectId: 'm',
    subjectName: 'Mathematics',
    totalStudents: 30,
    enteredCount: 0,
    missingCount: 30,
    status: 'PENDING',
  },
];
const rows = buildPendingTasks(sections, marks);
check('only unmarked sections produce attendance rows', rows.filter((r) => r.kind === 'ATTENDANCE').length, 1);
check('attendance row text', [rows[0].title, rows[0].subtitle, rows[0].badge, rows[0].moduleId], [
  'Submit VII A attendance',
  '32 students \u00B7 Pending today',
  'Due',
  'student-attendance',
]);
check('marks row text', [rows[1].title, rows[1].subtitle, rows[1].badge, rows[1].moduleId], [
  'Complete Term I marks',
  'VII A \u00B7 Mathematics \u00B7 5 of 32 entered',
  'In progress',
  'marks-entry',
]);
check('untouched marks task is Pending', rows[2].badge, 'Pending');
check('null inputs are safe', buildPendingTasks(null, undefined), []);
check('classLabel joins parts', classLabel('VII', 'A'), 'VII A');

console.log('\nSummary cards');
const cards = buildSummaryCards({
  totalAssignedStudents: 96,
  assignedClassesCount: 3,
  assignedSubjectsCount: 2,
  scheduledPeriodsToday: 3,
  completedPeriodsToday: 1,
  pendingAttendanceCount: 1,
  pendingMarksCount: 2,
  leaveBalance: 24,
});
check('cards map quickStats in design order', cards.map((c) => [c.label, c.value]), [
  ['Assigned classes', 3],
  ['Students', 96],
  ['Attendance task', 1],
  ['Marks pending', 2],
]);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
