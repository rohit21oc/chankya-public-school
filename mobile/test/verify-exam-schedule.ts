import { readFileSync } from 'fs';
import { buildSchedule, durationLabel, filterOptions, groupByDate, longDate, minutesOf, scheduleSummary, timeLabel } from '../src/utils/examScheduleModel';

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
};

const TODAY = '2026-11-16';
const exams: any[] = [
  { id: 'e1', name: 'Half Yearly', examType: 'Half Yearly', status: 'PUBLISHED', classIds: ['c5'], startDate: '2026-11-15', endDate: '2026-11-22',
    schedule: [
      { subjectName: 'Science', date: '2026-11-18', startTime: '09:00', endTime: '11:00', roomNumber: '5A', classId: 'c5', section: 'ALL' },
      { subjectName: 'Mathematics', date: '2026-11-15', startTime: '9:00 AM', endTime: '11:00 AM', classId: 'c5', section: 'ALL' },
      { subjectName: 'English', date: '2026-11-16', startTime: '09:00 AM', endTime: '10:30 AM', classId: 'c5', section: 'ALL', instructions: 'Bring ruler' },
      { subjectName: 'Hindi', date: '2026-11-22', startTime: '09:00 AM', classId: 'c5', section: 'B' },
      { subjectName: 'Class 6 paper', date: '2026-11-19', startTime: '09:00 AM', classId: 'c6', section: 'ALL' },
    ] },
  { id: 'e2', name: 'Periodic Test', examType: 'Periodic Test', status: 'PUBLISHED', classIds: ['c5'], startDate: '2026-12-02', endDate: '2026-12-04', schedule: [] },
  { id: 'e3', name: 'Draft Exam', examType: 'Periodic Test', status: 'DRAFT', classIds: ['c5'], startDate: '2026-12-10', schedule: [{ subjectName: 'X', date: '2026-12-10' }] },
  { id: 'e4', name: 'Class 9 Exam', examType: 'Annual', status: 'PUBLISHED', classIds: ['c9'], startDate: '2026-11-20', schedule: [{ subjectName: 'Physics', date: '2026-11-20' }] },
  { id: 'e1dup', name: 'Half Yearly', examType: 'Half Yearly', status: 'PUBLISHED', classIds: ['c5'], startDate: '2026-11-15', endDate: '2026-11-22', schedule: [{ subjectName: 'Dup', date: '2026-11-15' }] },
];

const a = buildSchedule(exams, { classId: 'c5', section: 'A' }, TODAY);
check('papers are sorted by date', a.papers.map((p) => p.subject).join() === 'Mathematics,English,Science');
check("another class's papers and other-section papers are left out", !a.papers.some((p) => p.subject === 'Class 6 paper' || p.subject === 'Hindi'));
check('section B sees its own paper', buildSchedule(exams, { classId: 'c5', section: 'B' }, TODAY).papers.some((p) => p.subject === 'Hindi'));
check('drafts and other-class exams are never shown', !a.papers.some((p) => ['X', 'Physics'].includes(p.subject)));
check('a duplicate saved exam counts once', !a.papers.some((p) => p.subject === 'Dup'));
check('phases: completed / today / upcoming', a.papers[0].phase === 'completed' && a.papers[1].phase === 'today' && a.papers[2].phase === 'upcoming');
check('exam without a timetable is listed with its dates', a.noTimetable.length === 1 && a.noTimetable[0].examName === 'Periodic Test' && a.noTimetable[0].startDate === '2026-12-02');
check('times are shown as 09:00 AM, duration is calculated', a.papers[2].startTime === '09:00 AM' && a.papers[2].durationLabel === '2 Hours' && a.papers[1].durationLabel === '1 Hour 30 Min');
check('room and instructions come only from the data', a.papers[2].room === '5A' && a.papers[1].instructions === 'Bring ruler' && a.papers[0].room === '');

check('filter by exam type', buildSchedule(exams, { classId: 'c5', examType: 'Periodic Test' }, TODAY).papers.length === 0 && buildSchedule(exams, { classId: 'c5', examType: 'Periodic Test' }, TODAY).noTimetable.length === 1);
check('filter by month', buildSchedule(exams, { classId: 'c5', month: '2026-12' }, TODAY).papers.length === 0);
const opts = filterOptions(exams, 'c5');
check('filter chips list real types and months only', opts.types.join() === 'Half Yearly,Periodic Test' && opts.months.join() === '2026-11,2026-12');

const groups = groupByDate(a.papers);
check('papers are grouped by day with a readable heading', groups.length === 3 && groups[0].title === 'Sunday, 15 Nov 2026');
const sum = scheduleSummary(a.papers);
check('summary: next paper is today\'s, subjects counted', sum.next?.subject === 'English' && sum.subjects === 3 && sum.total === 3);
check('all done -> no next paper', scheduleSummary(buildSchedule(exams, { classId: 'c5' }, '2027-01-01').papers).next === undefined);

check('time parsing', minutesOf('9:00 AM') === 540 && minutesOf('13:30') === 810 && minutesOf('12:00 AM') === 0 && minutesOf('abc') === null && timeLabel('1:30pm') === '01:30 PM' && timeLabel('soon') === 'soon');
check('duration is empty when times are missing or reversed', durationLabel('', '10:00') === '' && durationLabel('11:00', '10:00') === '' && durationLabel('09:00', '09:45') === '45 Min');
check('bad dates do not crash', longDate('') === 'Date not set' && buildSchedule([{ id: 'z', name: 'Z', status: 'PUBLISHED', schedule: [{ subjectName: 'S', date: 'tomorrow' }] }], {}, TODAY).papers.length === 0);
check('empty / null input is safe', buildSchedule(null, {}, TODAY).papers.length === 0 && filterOptions(undefined).types.length === 0);

// Screens are wired for all three roles
const read = (p: string) => readFileSync(p.replace(/^\.\.\//, ''), 'utf8'); // tests run from mobile/
check('staff Exam Schedule opens the real screen (not a placeholder)', /case 'exam-schedule':\s*return \(\s*<ExamScheduleScreen/.test(read('../src/navigation/AppNavigator.tsx')));
check('parent portal has an exams route reachable from Home and More', read('../src/parent/ParentPortal.tsx').includes("case 'exams'") && read('../src/parent/screens/ParentMoreScreen.tsx').includes("onNavigate('exams')") && read('../src/parent/screens/ParentHomeScreen.tsx').includes("onNavigate('exams')"));
check('student portal has an exams route in the menu and on Home', read('../src/student/StudentPortal.tsx').includes("case 'exams'") && read('../src/student/StudentDrawer.tsx').includes("route: 'exams'") && read('../src/student/screens/MyHome.tsx').includes("navigate('exams')"));
check('exam screens show loading, empty and error states', ['SkeletonList', 'No exams found', 'could not be loaded'].every((t) => read('../src/components/exam/ExamScheduleBody.tsx').includes(t)));

// Parent login: no "Forgot password"; staff keeps it
const login = read('../src/screens/LoginScreen.tsx');
check("Forgot password shows on the staff tab only (not parent, not student)", /\{activeTab === 'staff' && \(\s*<Pressable onPress=\{\(\) => setForgotOpen/.test(login));

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll exam schedule checks passed.');
