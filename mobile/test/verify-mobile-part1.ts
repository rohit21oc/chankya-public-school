import {
  MOBILE_MODULES,
  getAuthorizedModulesForUser,
  getModuleTitleForUser,
  formatRoleLabel,
} from '../src/utils/rbac';
import { User, UserRole } from '../src/types';
import { apiService } from '../src/services/apiService';

function runAssertions() {
  console.log('================================================================');
  console.log('MOBILE APP PART 1 VERIFICATION: UI/UX DESIGN & MODULE STRUCTURE');
  console.log('CHANAKYA PUBLIC SCHOOL & COACHING CENTRE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  ✅ PASS: ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`  ❌ FAIL: ${name} ->`, err?.message || err);
    }
  }

  // 1. Initial Allowed Modules Scope
  console.log('--- 1. Initial Release Modules Scope ---');
  test('Only authorized campus modules are present in MOBILE_MODULES', () => {
    const forbidden = [
      'fees',
      'admissions',
      'transport',
      'hostel',
      'library',
      'inventory',
      'website',
      'reports',
      'settings',
      'permissions',
      'audit-logs',
      'teachers',
    ];

    const moduleIds = new Set(MOBILE_MODULES.map((m) => m.id));
    for (const f of forbidden) {
      if (moduleIds.has(f)) {
        throw new Error(`Forbidden module "${f}" is present in initial navigation`);
      }
    }
  });

  test('Unrelated ERP modules are completely excluded from initial navigation', () => {
    const forbidden = [
      'fees',
      'admissions',
      'transport',
      'hostel',
      'library',
      'inventory',
      'website',
      'reports',
      'settings',
      'permissions',
      'audit-logs',
    ];
    const moduleIds = new Set(MOBILE_MODULES.map((m) => m.id));
    for (const f of forbidden) {
      if (moduleIds.has(f)) {
        throw new Error(`Forbidden module "${f}" is present in initial navigation`);
      }
    }
  });

  // 2. Role Scoping: TEACHER
  console.log('\n--- 2. Role-Based Module Scoping: TEACHER ---');
  const teacherUser: User = {
    id: 't-101',
    name: 'Anita Roy',
    username: 'anita.roy',
    role: 'TEACHER',
    employeeId: 'EMP-T101',
    permissions: ['timetable.view', 'attendance.view', 'exams.view', 'payroll.view'],
  };

  test('Teacher authorized modules include Dashboard, My Timetable, Student Attendance, Marks Entry, My ID Card, Profile', () => {
    const teacherModules = getAuthorizedModulesForUser(teacherUser);
    const ids = teacherModules.map((m) => m.id);

    if (!ids.includes('dashboard')) throw new Error('Teacher missing dashboard');
    if (!ids.includes('timetable')) throw new Error('Teacher missing timetable');
    if (!ids.includes('student-attendance')) throw new Error('Teacher missing student-attendance');
    if (!ids.includes('marks-entry')) throw new Error('Teacher missing marks-entry');
    if (!ids.includes('my-id-card')) throw new Error('Teacher missing my-id-card');
    if (!ids.includes('profile')) throw new Error('Teacher missing profile');
  });

  test('Teacher CANNOT access Staff Attendance', () => {
    const teacherModules = getAuthorizedModulesForUser(teacherUser);
    const ids = teacherModules.map((m) => m.id);
    if (ids.includes('staff-attendance')) {
      throw new Error('Security Violation: Teacher granted access to administrative staff-attendance!');
    }
  });

  test('Teacher dynamic title for timetable is "My Timetable"', () => {
    const timetableMod = MOBILE_MODULES.find((m) => m.id === 'timetable')!;
    const title = getModuleTitleForUser(timetableMod, teacherUser);
    if (title !== 'My Timetable') {
      throw new Error(`Expected "My Timetable", got "${title}"`);
    }
  });

  // 3. Role Scoping: SUPER_ADMIN / SCHOOL_ADMIN / PRINCIPAL
  console.log('\n--- 3. Role-Based Module Scoping: ADMINISTRATORS & PRINCIPAL ---');
  const principalUser: User = {
    id: 'p-01',
    name: 'Shri Ramakant Saxena',
    username: 'principal',
    role: 'PRINCIPAL',
    employeeId: 'EMP-P001',
    permissions: ['timetable.view', 'attendance.view', 'staff.manage', 'exams.view', 'payroll.view'],
  };

  test('Principal has access to Dashboard, Timetable, Staff Attendance, Student Attendance, Marks Entry, Profile', () => {
    const adminModules = getAuthorizedModulesForUser(principalUser);
    const ids = adminModules.map((m) => m.id);

    if (!ids.includes('dashboard')) throw new Error('Principal missing dashboard');
    if (!ids.includes('timetable')) throw new Error('Principal missing timetable');
    if (!ids.includes('staff-attendance')) throw new Error('Principal missing staff-attendance');
    if (!ids.includes('student-attendance')) throw new Error('Principal missing student-attendance');
    if (!ids.includes('marks-entry')) throw new Error('Principal missing marks-entry');
    if (!ids.includes('profile')) throw new Error('Principal missing profile');
  });

  test('Administrator dynamic title for timetable is "School Timetable"', () => {
    const timetableMod = MOBILE_MODULES.find((m) => m.id === 'timetable')!;
    const title = getModuleTitleForUser(timetableMod, principalUser);
    if (title !== 'School Timetable') {
      throw new Error(`Expected "School Timetable", got "${title}"`);
    }
  });

  // 4. Role Scoping: OTHER STAFF (Accountant, HR, Hostel Warden, Transport Manager)
  console.log('\n--- 4. Role-Based Module Scoping: NON-TEACHING STAFF ---');
  const accountantUser: User = {
    id: 'acc-01',
    name: 'Vikram Mehta',
    username: 'accountant',
    role: 'ACCOUNTANT',
    employeeId: 'EMP-A001',
    permissions: ['payroll.view'],
  };

  test('Accountant has access to Dashboard, My Payroll, My ID Card, Profile', () => {
    const accModules = getAuthorizedModulesForUser(accountantUser);
    const ids = accModules.map((m) => m.id);

    if (!ids.includes('dashboard')) throw new Error('Accountant missing dashboard');
    if (!ids.includes('my-payroll')) throw new Error('Accountant missing my-payroll');
    if (!ids.includes('my-id-card')) throw new Error('Accountant missing my-id-card');
    if (!ids.includes('profile')) throw new Error('Accountant missing profile');
  });

  test('Accountant CANNOT access Marks Entry or Student Attendance marking', () => {
    const accModules = getAuthorizedModulesForUser(accountantUser);
    const ids = accModules.map((m) => m.id);

    if (ids.includes('marks-entry')) {
      throw new Error('Security Violation: Accountant granted access to marks-entry!');
    }
    if (ids.includes('student-attendance')) {
      throw new Error('Security Violation: Accountant granted access to student-attendance!');
    }
  });

  // 5. Role Scoping: STUDENT & PARENT
  console.log('\n--- 5. Role-Based Module Scoping: STUDENT & PARENT ---');
  const studentUser: User = {
    id: 's-101',
    name: 'Aarav Sharma',
    username: 'CPS-2026-001',
    role: 'STUDENT',
    studentId: 's-101',
  };

  const parentUser: User = {
    id: 'p-101',
    name: 'Rajesh Sharma',
    username: '9876543210',
    role: 'PARENT',
    studentId: 's-101',
  };

  test('Student has access to Dashboard, My Timetable, Attendance Record, Profile', () => {
    const studentModules = getAuthorizedModulesForUser(studentUser);
    const ids = studentModules.map((m) => m.id);

    if (!ids.includes('dashboard')) throw new Error('Student missing dashboard');
    if (!ids.includes('timetable')) throw new Error('Student missing timetable');
    if (!ids.includes('student-attendance')) throw new Error('Student missing student-attendance');
    if (!ids.includes('profile')) throw new Error('Student missing profile');
  });

  test('Student and Parent CANNOT access Staff Attendance, My Payroll, My ID Card, or Marks Entry', () => {
    for (const u of [studentUser, parentUser]) {
      const mods = getAuthorizedModulesForUser(u);
      const ids = mods.map((m) => m.id);

      if (ids.includes('staff-attendance')) {
        throw new Error(`Security Violation: ${u.role} granted access to staff-attendance!`);
      }
      if (ids.includes('my-payroll')) {
        throw new Error(`Security Violation: ${u.role} granted access to my-payroll!`);
      }
      if (ids.includes('my-id-card')) {
        throw new Error(`Security Violation: ${u.role} granted access to my-id-card!`);
      }
      if (ids.includes('marks-entry')) {
        throw new Error(`Security Violation: ${u.role} granted access to marks-entry!`);
      }
    }
  });

  // 6. Service API Signatures & Integration
  console.log('\n--- 6. API Service Methods Verification ---');
  test('ApiService has required methods for all initial modules', () => {
    const methods = [
      'getClasses',
      'getSubjects',
      'getTimetables',
      'getAttendance',
      'saveAttendance',
      'getStaffAttendance',
      'saveStaffAttendance',
      'getExams',
      'getMarks',
      'saveMarks',
      'getStaffPayrollHistory',
      'getStaffIdCard',
      'getDashboardSummary',
    ];

    for (const m of methods) {
      if (typeof (apiService as any)[m] !== 'function') {
        throw new Error(`ApiService missing required method: ${m}`);
      }
    }
  });

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAssertions();
