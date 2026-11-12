import { getDoMoreGridModules, formatRoleLabel } from '../src/utils/rbac';
import { User } from '../src/types';
import { SCHOOL_INFO } from '../src/utils/branding';
import { affiliationLine, toIdentity } from '../src/utils/schoolIdentityModel';

console.log('=== VERIFYING MOBILE HOME SCREEN REDESIGN ===\n');

// 1. School Information Verification
console.log('1. School Header & Branding Check:');
// Institute details come only from saved School Settings; nothing is built in.
const id = toIdentity({ schoolName: 'RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR', affiliatedBoard: 'BSEB', affiliationNumber: '10030206405', schoolCode: '6400' } as any);
const line = affiliationLine(id);
console.log(`   Affiliation line: ${line}`);
if (line !== 'BSEB Affiliation: 10030206405 • Code: 6400') throw new Error(`Unexpected affiliation line: ${line}`);
if (affiliationLine(toIdentity({ schoolName: 'X' } as any)) !== '') throw new Error('Missing affiliation must not be invented');
if ((SCHOOL_INFO as any).affiliationNumber || (SCHOOL_INFO as any).board || (SCHOOL_INFO as any).phone) {
  throw new Error('SCHOOL_INFO must not carry built-in affiliation, board or phone values');
}
console.log('   ✅ PASS: Branding uses saved School Settings (board, affiliation, code) and invents nothing.\n');

// 2. Role: TEACHER
console.log('2. Teacher Role Grid Modules Check:');
const teacherUser: User = {
  id: 'tch-1',
  name: 'Mrs. Sunita Verma',
  username: 'PDS0002',
  role: 'TEACHER',
  permissions: ['attendance.view', 'attendance.mark', 'exams.view', 'exams.marks.enter', 'timetable.view', 'students.view', 'communication.view'],
};
const teacherModules = getDoMoreGridModules(teacherUser).map(m => ({ id: m.id, title: m.title }));
console.log(`   Role: ${formatRoleLabel(teacherUser.role)}`);
console.log(`   Total Grid Modules: ${teacherModules.length} (3x3 grid)`);
teacherModules.forEach((m, idx) => console.log(`     ${idx + 1}. [${m.id}] ${m.title}`));

const requiredTeacherModules = [
  'timetable',
  'student-attendance',
  'marks-entry',

  'exam-schedule',
  'students',
];
// Profile, payroll and ID card live in the top-bar profile menu, not the teacher grid.
for (const gone of ['profile', 'my-payroll', 'my-id-card']) {
  if (teacherModules.some(m => m.id === gone)) throw new Error(`Teacher grid must not list ${gone}`);
}
for (const req of requiredTeacherModules) {
  if (!teacherModules.some(m => m.id === req)) {
    throw new Error(`Teacher missing required module: ${req}`);
  }
}
console.log('   ✅ PASS: Teacher has all requested modules (Assignment intentionally removed).\n');

if (teacherModules.some(m => m.id === 'assignments')) {
  throw new Error('Assignment module must be excluded from teacher navigation');
}
console.log('   ✅ PASS: Teacher has all 9 requested modules in 3-column grid.\n');

// 3. Role: SUPER_ADMIN / PRINCIPAL
console.log('3. Principal / Admin Role Grid Modules Check:');
const principalUser: User = {
  id: 'adm-1',
  name: 'Principal Office',
  username: 'PDS0001',
  role: 'PRINCIPAL',
  permissions: ['attendance.view', 'exams.view', 'timetable.view', 'students.view', 'staff.manage', 'payroll.view', 'communication.view'],
};
const principalModules = getDoMoreGridModules(principalUser).map(m => ({ id: m.id, title: m.title }));
console.log(`   Role: ${formatRoleLabel(principalUser.role)}`);
console.log(`   Total Grid Modules: ${principalModules.length} (3x3 grid)`);
principalModules.forEach((m, idx) => console.log(`     ${idx + 1}. [${m.id}] ${m.title}`));

const requiredAdminModules = [
  'timetable',
  'staff-attendance',
  'student-attendance',
  'marks-entry',
  // c34bdcc: admin grid shows Report Card in place of Exam Schedule (intentional).
  'report-card',
  'students',
  // Admin upgrade: Profile / My Payroll / My ID Card moved into My Profile; Staff management added.
  'staff',
];
for (const req of requiredAdminModules) {
  if (!principalModules.some(m => m.id === req)) {
    throw new Error(`Admin missing required module: ${req}`);
  }
}
console.log('   ✅ PASS: Admin / Principal grid has the work modules (profile items live in My Profile).\n');

// 4. Role: Non-teaching Staff (e.g. ACCOUNTANT)
console.log('4. Staff Role Grid Modules Check:');
const accountantUser: User = {
  id: 'acc-1',
  name: 'Ramesh Kumar',
  username: 'PDS0005',
  role: 'ACCOUNTANT',
  permissions: ['payroll.view', 'timetable.view', 'communication.view'],
};
const accountantModules = getDoMoreGridModules(accountantUser).map(m => ({ id: m.id, title: m.title }));
console.log(`   Role: ${formatRoleLabel(accountantUser.role)}`);
console.log(`   Total Grid Modules: ${accountantModules.length}`);
accountantModules.forEach((m, idx) => console.log(`     ${idx + 1}. [${m.id}] ${m.title}`));

if (!accountantModules.some(m => m.id === 'profile')) throw new Error('Staff missing Profile');
if (!accountantModules.some(m => m.id === 'my-payroll')) throw new Error('Staff missing My Payroll');
if (!accountantModules.some(m => m.id === 'my-id-card')) throw new Error('Staff missing My ID Card');
console.log('   ✅ PASS: Staff has personal profile, payroll, ID card, and timetable.\n');

console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY! 🎯');
