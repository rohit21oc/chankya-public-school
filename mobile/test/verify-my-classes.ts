/**
 * My Classes display model and navigation wiring. Offline: no network, no access decisions.
 * Run: npx tsx test/verify-my-classes.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildMyClasses, toClassCard } from '../src/utils/teacherClassesModel';
import { getAuthorizedModulesForUser, getDrawerModulesForUser } from '../src/utils/rbac';
import type { TeacherAuthorizedAssignments, TeacherClassGroup } from '../src/types/teacher';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${name} ${ok ? '' : detail}`);
};

const g = (over: Partial<TeacherClassGroup>): TeacherClassGroup => ({
  classId: 'c-5', className: 'Class 5', isClassTeacher: false, studentCount: 24,
  sections: [{ section: 'B', isClassTeacher: false, studentCount: 10 }, { section: 'A', isClassTeacher: false, studentCount: 14 }],
  subjects: ['Mathematics', 'Science'], ...over,
});

const card = toClassCard(g({}));
check('Title lists sections in order', card.title === 'Class 5 - A, B', card.title);
check('Subjects are joined', card.subjectsText === 'Mathematics, Science');
check('Student count is pluralised', card.studentsText === '24 Students' && toClassCard(g({ studentCount: 1 })).studentsText === '1 Student');
check('No subjects says so honestly', toClassCard(g({ subjects: [] })).subjectsText === 'No subjects selected');
check('Class without sections shows just the class name', toClassCard(g({ sections: [] })).title === 'Class 5');

const data: TeacherAuthorizedAssignments = {
  allAccess: false, classes: [], subjects: [],
  assignedClasses: [g({ classId: 'c-10', className: 'Class 10', subjects: ['English'] }), g({ classId: 'c-2', className: 'Class 2', isClassTeacher: true })],
  qualifiedOnlyClasses: [g({ classId: 'c-6', className: 'Class 6', subjects: ['Hindi'] })],
};
const m = buildMyClasses(data);
check('Counts match the lists', m.assignedCount === 2 && m.qualifiedCount === 1);
check('Classes sort naturally (Class 2 before Class 10)', m.assigned[0].classId === 'c-2' && m.assigned[1].classId === 'c-10');
check('Class teacher flag is kept', m.assigned[0].isClassTeacher === true && m.assigned[1].isClassTeacher === false);
check('Search by subject', buildMyClasses(data, 'hindi').qualified.length === 1 && buildMyClasses(data, 'hindi').assigned.length === 0);
check('Search by class', buildMyClasses(data, 'class 10').assigned.length === 1);
check('Search keeps the tab counts', buildMyClasses(data, 'zzz').assignedCount === 2);
check('Missing server fields give empty lists, not a crash', buildMyClasses(null).assignedCount === 0 && buildMyClasses({ allAccess: false, classes: [], subjects: [] }).qualified.length === 0);

const teacher: any = { id: 't', role: 'TEACHER', name: 'T', permissions: [] };
check('Teacher gets My Classes', getAuthorizedModulesForUser(teacher).some((x) => x.id === 'my-classes'));
check('My Classes is in the teacher side menu', getDrawerModulesForUser(teacher).some((x) => x.id === 'my-classes'));
for (const role of ['STUDENT', 'PARENT', 'ACCOUNTANT', 'HR_STAFF', 'HOSTEL_WARDEN']) {
  check(`${role} does not get My Classes`, !getAuthorizedModulesForUser({ ...teacher, role } as any).some((x) => x.id === 'my-classes'));
}

const nav = fs.readFileSync(path.join(__dirname, '../src/navigation/AppNavigator.tsx'), 'utf8');
check('Navigator opens My Classes', /case 'my-classes'/.test(nav) && /MyClassesScreen/.test(nav));
check('Notices, Messages and Live Events share the tab strip', ['CommunicationScreen', 'MessagesScreen', 'LiveEventsScreen'].every((n) => new RegExp(`<${n}[\\s\\S]*?onNavigateModule=\\{handleNavigate\\}`).test(nav)));

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll My Classes checks passed.');
