/** Offline tests: mobile Homework rules/RBAC and the unmarked-by-default attendance rules. */
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAuthorizedModulesForUser, getDoMoreGridModules } from '../src/utils/rbac';
import {
  buildStaffAttendanceMap,
  buildStaffSubmission,
  countUnmarkedStaff,
} from '../src/utils/attendanceRules';
import {
  addDays,
  buildHomeworkPayload,
  canAssignHomework,
  dueStatus,
  isValidDate,
  sortAndFilterHomework,
  todayInIndia,
  validateHomeworkForm,
  HomeworkClassOption,
  HomeworkForm,
} from '../src/utils/homeworkRules';

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); } else { failed++; console.log(`  FAIL: ${name} ${detail}`); }
};
const read = (f: string) => readFileSync(join(__dirname, '..', 'src', f), 'utf8');

console.log('--- Staff attendance: nothing preselected ---');
const staff = [{ id: 's1', employeeId: 'E1' }, { id: 's2', employeeId: 'E2' }, { employeeId: 'E3' }];
check('no saved records -> everyone unmarked', countUnmarkedStaff(staff, buildStaffAttendanceMap([])) === 3);
check('no saved records -> nothing is submitted', buildStaffSubmission(staff, buildStaffAttendanceMap([])).length === 0);
const saved = buildStaffAttendanceMap([{ staffId: 's1', status: 'ABSENT' }, { employeeId: 'E3', status: 'PRESENT' }, { staffId: 's2', status: 'MAYBE' }]);
check('saved records are shown, invalid status ignored', saved.s1 === 'ABSENT' && saved.E3 === 'PRESENT' && saved.s2 === undefined);
check('only marked staff are submitted', buildStaffSubmission(staff, saved).map((r) => r.status).join() === 'ABSENT,PRESENT');
check('unmarked count', countUnmarkedStaff(staff, saved) === 1);
const staffScreen = read('screens/StaffAttendanceScreen.tsx');
check('staff screen has no Clear / Reset button', !/Clear \/ Reset|Reset All|Clear All/i.test(staffScreen));
check("staff screen never falls back to 'PRESENT'", !/\|\|\s*'PRESENT'\s*;/.test(staffScreen) && !/\]\s*\|\|\s*'PRESENT'/.test(staffScreen));
check('student screen has no Reset All button', !/Reset All|handleResetAll|Clear All/i.test(read('screens/StudentAttendanceScreen.tsx')));

console.log('--- Sidebar: no module subtitles ---');
const drawer = read('components/AppDrawer.tsx');
check('drawer does not render module descriptions', !/module\.description/.test(drawer) && !/menuDesc/.test(drawer));
check('drawer keeps module title and icon', /getModuleTitleForUser/.test(drawer) && /module\.iconName/.test(drawer));

console.log('--- Homework: module access ---');
const mk = (role: any) => ({ id: 'u1', name: 'U', username: 'CPS0002', role } as any);
for (const role of ['TEACHER', 'STUDENT', 'PRINCIPAL', 'SUPER_ADMIN', 'SCHOOL_ADMIN']) {
  check(`${role} sees Homework in the sidebar`, getAuthorizedModulesForUser(mk(role)).some((m) => m.id === 'homework' && m.title === 'Homework'));
}
for (const role of ['ACCOUNTANT', 'HR_STAFF', 'HOSTEL_WARDEN']) {
  check(`${role} does not see Homework`, !getAuthorizedModulesForUser(mk(role)).some((m) => m.id === 'homework'));
}
check('old "Assignment" module is still absent', !getAuthorizedModulesForUser(mk('TEACHER')).some((m) => m.id === 'assignments' || m.title === 'Assignment'));
check('teacher home grid has Homework', getDoMoreGridModules(mk('TEACHER')).some((m) => m.id === 'homework'));
check('student home grid has Homework', getDoMoreGridModules(mk('STUDENT')).some((m) => m.id === 'homework'));
check('only staff roles can assign', canAssignHomework('TEACHER') && canAssignHomework('PRINCIPAL') && !canAssignHomework('STUDENT') && !canAssignHomework('PARENT'));

console.log('--- Homework: dates ---');
check('valid / invalid dates', isValidDate('2026-10-21') && !isValidDate('2026-02-30') && !isValidDate('21-10-2026') && !isValidDate(''));
check('today in India crosses midnight UTC+5:30', todayInIndia(new Date('2026-10-20T19:00:00Z')) === '2026-10-21' && todayInIndia(new Date('2026-10-20T17:00:00Z')) === '2026-10-20');
check('addDays', addDays('2026-10-30', 3) === '2026-11-02');
check('due status', dueStatus('2026-10-21', '2026-10-21') === 'DUE_TODAY' && dueStatus('2026-10-22', '2026-10-21') === 'UPCOMING' && dueStatus('2026-10-20', '2026-10-21') === 'PAST_DUE' && dueStatus('', '2026-10-21') === 'NO_DUE_DATE');

console.log('--- Homework: form ---');
const options: HomeworkClassOption[] = [
  { classId: 'c-8', className: 'Class 8', sections: [{ name: 'A', subjects: [{ id: 'sub-1', name: 'Maths' }] }, { name: 'B', subjects: [{ id: 'sub-2', name: 'Science' }] }] },
];
const good: HomeworkForm = { classId: 'c-8', section: 'A', subjectId: 'sub-1', title: 'Exercise 4.1', instructions: ' Solve all. ', assignedDate: '2026-10-21', dueDate: '2026-10-23' };
check('a valid form passes', validateHomeworkForm(good, options) === null);
check('class required', !!validateHomeworkForm({ ...good, classId: '' }, options));
check('subject must belong to the chosen section', !!validateHomeworkForm({ ...good, section: 'B' }, options));
check('short title rejected', !!validateHomeworkForm({ ...good, title: 'ab' }, options));
check('blank instructions rejected', !!validateHomeworkForm({ ...good, instructions: '   ' }, options));
check('due before assigned rejected', !!validateHomeworkForm({ ...good, dueDate: '2026-10-20' }, options));
check('invalid due date rejected', !!validateHomeworkForm({ ...good, dueDate: '2026-13-01' }, options));
const payload = buildHomeworkPayload(good) as any;
check('payload is trimmed', payload.instructions === 'Solve all.' && payload.title === 'Exercise 4.1');
check('payload never carries attachment fields (editing keeps the web attachment)', !('attachmentFileKey' in payload) && !('attachmentName' in payload));

console.log('--- Homework: list ---');
const list: any[] = [
  { id: 'a', classId: 'c-8', section: 'A', title: 'past', dueDate: '2026-10-10', assignedDate: '2026-10-01' },
  { id: 'b', classId: 'c-8', section: 'A', title: 'later', dueDate: '2026-10-30', assignedDate: '2026-10-20' },
  { id: 'c', classId: 'c-7', section: 'A', title: 'today', dueDate: '2026-10-21', assignedDate: '2026-10-20' },
  { id: 'd', classId: 'c-8', section: 'A', title: 'soon', dueDate: '2026-10-23', assignedDate: '2026-10-20' },
];
check('current list hides past and orders by urgency', sortAndFilterHomework(list, '2026-10-21').map((h) => h.id).join() === 'c,d,b');
check('all list shows past last', sortAndFilterHomework(list, '2026-10-21', { includePast: true }).map((h) => h.id).join() === 'c,d,b,a');
check('class filter', sortAndFilterHomework(list, '2026-10-21', { includePast: true, classId: 'c-7' }).length === 1);

console.log('--- Homework: wiring ---');
const nav = read('navigation/AppNavigator.tsx');
check("navigator routes 'homework' to HomeworkScreen", /case 'homework':[\s\S]*?<HomeworkScreen/.test(nav));
const api = read('services/apiService.ts');
check('api uses /api/homework and /api/homework/options', /\/api\/homework'/.test(api) && /\/api\/homework\/options/.test(api));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
