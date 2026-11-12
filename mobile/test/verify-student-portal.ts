import fs from 'node:fs';
import { join } from 'node:path';
import { classRollLine, daysUntil, greetingFor, holidayDatesInMonth, isNewNotice, monthGrid, noticeTabOf, noticesForTab, percentLabel, splitEvents } from '../src/utils/studentPortalRules';
import { isStudentTab, studentBackAction } from '../src/student/routes';
import { studentRouteForPush } from '../src/utils/pushRouting';

let fail = 0;
const check = (n: string, ok: boolean, x = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  -> ${x}`}`); };

// ---- calendar ----
const g = monthGrid('2026-10', { '2026-10-05': 'PRESENT', '2026-10-06': 'ABSENT', '2026-10-04': 'PRESENT' }, new Set(['2026-10-02', '2026-10-05']), '2026-10-22');
const flat = g.flat();
check('Every row has 7 cells', g.every((w) => w.length === 7));
check('October 2026 has 31 real days', flat.filter((c) => c.date).length === 31);
check('1 Oct 2026 is a Thursday, so the grid starts with 3 blank cells (Monday first)', g[0].slice(0, 3).every((c) => !c.date) && g[0][3].date === '2026-10-01');
check('A holiday shows as Holiday, but attendance on the same day wins', flat.find((c) => c.date === '2026-10-02')?.status === 'HOLIDAY' && flat.find((c) => c.date === '2026-10-05')?.status === 'PRESENT');
check('Today is marked, Sundays are flagged', flat.find((c) => c.date === '2026-10-22')?.isToday === true && flat.find((c) => c.date === '2026-10-04')?.isSunday === true);
check('A day with no record has no status', flat.find((c) => c.date === '2026-10-07')?.status === undefined);
check('A month that starts on Monday has no leading blanks (Jun 2026)', monthGrid('2026-06', {}, new Set(), '2026-06-01')[0][0].date === '2026-06-01');
check('February in a leap year has 29 days (2028)', monthGrid('2028-02', {}, new Set(), '').flat().filter((c) => c.date).length === 29);

const hol = holidayDatesInMonth([{ date: '2026-10-30', endDate: '2026-11-02' }, { date: '2026-10-02' }, { date: 'bad' }, {}], '2026-10');
check('A multi-day holiday is expanded and clipped to the month', hol.has('2026-10-30') && hol.has('2026-10-31') && !hol.has('2026-11-01') && hol.has('2026-10-02') && hol.size === 3);

// ---- text helpers ----
check('Greeting follows the Indian hour', greetingFor(new Date('2026-10-22T03:00:00Z')) === 'Good Morning' && greetingFor(new Date('2026-10-22T08:00:00Z')) === 'Good Afternoon' && greetingFor(new Date('2026-10-22T14:30:00Z')) === 'Good Evening');
check('Class line carries class, section and roll', classRollLine({ className: 'Class 5', section: 'A', rollNumber: '12' }) === 'Class 5 - A  |  Roll No. 12');
check('Class line copes with missing parts', classRollLine({ className: 'LKG' }) === 'LKG' && classRollLine(null) === '');
check('Percent label shows a dash when nothing is recorded', percentLabel(null) === '—' && percentLabel(0) === '0%' && percentLabel(92) === '92%');

// ---- notices ----
const notices = [
  { id: '1', title: 'Exam', category: 'EXAM', publishedDate: '2026-10-20', status: 'PUBLISHED' },
  { id: '2', title: 'Diwali', category: 'GENERAL', publishedDate: '2026-10-22', status: 'PUBLISHED' },
  { id: '3', title: 'Draft', category: 'GENERAL', publishedDate: '2026-10-23', status: 'DRAFT' },
  { id: '4', title: 'Result', category: 'RESULT', publishedDate: '2026-10-01', status: 'PUBLISHED' },
  { id: '5', title: 'Pinned', category: 'GENERAL', publishedDate: '2026-09-01', status: 'PUBLISHED', isPinned: true },
];
check('Exam and result notices are Academic, the rest General', noticeTabOf({ category: 'EXAM' }) === 'ACADEMIC' && noticeTabOf({ category: 'RESULT' }) === 'ACADEMIC' && noticeTabOf({ category: 'GENERAL' }) === 'GENERAL' && noticeTabOf({}) === 'GENERAL');
check('All: drafts are hidden, pinned first, then newest first', noticesForTab(notices, 'ALL').map((n) => n.id).join() === '5,2,1,4');
check('Academic tab only shows academic notices', noticesForTab(notices, 'ACADEMIC').map((n) => n.id).join() === '1,4');
check('General tab only shows the rest', noticesForTab(notices, 'GENERAL').map((n) => n.id).join() === '5,2');
check('A notice is New for 3 days only', isNewNotice({ publishedDate: '2026-10-22' }, '2026-10-23') && isNewNotice({ publishedDate: '2026-10-20' }, '2026-10-23') && !isNewNotice({ publishedDate: '2026-10-19' }, '2026-10-23') && !isNewNotice({}, '2026-10-23'));

// ---- events ----
const ev = splitEvents([{ id: 'a', eventDate: '2026-11-14' }, { id: 'b', eventDate: '2026-10-24' }, { id: 'c', eventDate: '2026-10-01' }, { id: 'd', eventDate: '2026-10-23' }, { id: 'e', eventDate: '2026-10-30', isActive: false }, { id: 'f' }], '2026-10-23');
check('Upcoming events (today or later) are soonest first', ev.upcoming.map((e) => e.id).join() === 'd,b,a');
check('Past events are latest first; hidden and undated events are dropped', ev.past.map((e) => e.id).join() === 'c');
check('Days until an event', daysUntil('2026-10-24', '2026-10-23') === 1 && daysUntil('2026-10-23', '2026-10-23') === 0 && daysUntil('2026-11-14', '2026-10-23') === 22);

// ---- navigation ----
check('Back closes the menu first, then the open screen, then goes Home, then exits', studentBackAction(['fees'], 'home', true) === 'close-menu' && studentBackAction(['fees'], 'attendance', false) === 'pop' && studentBackAction([], 'timetable', false) === 'home' && studentBackAction([], 'home', false) === 'exit');
check('Only Home, Attendance and Timetable are bottom-bar tabs', isStudentTab('home') && isStudentTab('attendance') && isStudentTab('timetable') && !isStudentTab('fees') && !isStudentTab('marks'));
check('Push: notice, homework and fee reminders open the right student screens', studentRouteForPush('NOTICE') === 'notices' && studentRouteForPush('HOMEWORK') === 'homework' && studentRouteForPush('FEE_DUE') === 'fees');
check('Push: students have no chat, the test push and junk open nothing', studentRouteForPush('MESSAGE') === null && studentRouteForPush('TEST') === null && studentRouteForPush('x') === null);

// ---- wiring (the pieces must actually be connected) ----
const nav = fs.readFileSync(join(__dirname, '..', 'src', 'navigation', 'AppNavigator.tsx'), 'utf8');
check('A STUDENT login opens the student portal', /role === 'STUDENT'[\s\S]{0,80}<StudentPortal/.test(nav));
const login = fs.readFileSync(join(__dirname, '..', 'src', 'screens', 'LoginScreen.tsx'), 'utf8');
check('The sign-in screen offers all three logins', ['StaffLoginForm', 'StudentLoginForm', 'ParentLoginForm'].every((f) => login.includes(`<${f}`)));
const drawer = fs.readFileSync(join(__dirname, '..', 'src', 'student', 'StudentDrawer.tsx'), 'utf8');
const portal = fs.readFileSync(join(__dirname, '..', 'src', 'student', 'StudentPortal.tsx'), 'utf8');
const routes = [...drawer.matchAll(/route: '(\w+)'/g)].map((m) => m[1]);
check('Every side-menu item opens a screen the portal renders', routes.every((r) => r === 'home' || r === 'attendance' || r === 'timetable' || portal.includes(`case '${r}'`)), routes.join());
check('Settings and Logout are in the menu', /go\('settings'\)/.test(drawer) && /onLogout/.test(drawer) && portal.includes("case 'settings'"));

console.log(fail ? `\n${fail} FAILED` : '\nAll student portal checks passed');
process.exit(fail ? 1 : 0);
