/**
 * Mobile App Phase 1 Verification Test Suite
 * RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
 *
 * Genuine Live-Backend End-to-End Tests:
 * 1. Backend Connectivity & Health Check (Render https://residentialpdsschool.onrender.com)
 * 2. Admin & Staff Common Login (no role dropdown, backend RBAC resolution)
 * 3. Student Portal Login (Admission No + DOB)
 * 4. Parent Portal Login (Registered Mobile + Child DOB + Multi-Child Switcher)
 * 5. Data Services Integration (Real Students & Institutional Settings)
 * 6. RBAC Module Scoping across SUPER_ADMIN, PRINCIPAL, TEACHER, ACCOUNTANT, HR_STAFF, PARENT, STUDENT
 * 7. Session Persistence, Expiration Checking & Clean Logout Invalidation
 * 8. Invalid Credentials Rejection & Error Formatting
 */

import { apiService } from '../src/services/apiService';
import { authStorage } from '../src/services/authStorage';
import { getAuthorizedModulesForUser, formatRoleLabel, hasUserPermission } from '../src/utils/rbac';
import { UserRole } from '../src/types';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function assert(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✅ PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, details: err?.message || String(err) });
    console.error(`  ❌ FAIL: ${name} ->`, err?.message || err);
  }
}

async function runMobileSuite() {
  console.log('================================================================');
  console.log('RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR - MOBILE APP PHASE 1 TESTS');
  console.log('================================================================\n');

  // 1. Backend Health & Connectivity
  console.log('--- 1. Backend Connectivity ---');
  await assert('Production Backend Connectivity (Render https://residentialpdsschool.onrender.com)', async () => {
    const res = await apiService.request('/api/health');
    if (!res.ok || !res.data) {
      throw new Error(`Health check failed: ${res.error || res.status}`);
    }
    if (!res.data.school?.includes('PDS PUBLIC SCHOOL')) {
      throw new Error(`Unexpected school name in health check: ${res.data.school}`);
    }
  });

  // 2. Staff & Admin Common Login
  console.log('\n--- 2. Staff / Admin Common Login Flows ---');

  await assert('Super Admin Authentication (residentialpdsschool)', async () => {
    await authStorage.clearSession();
    const res = await apiService.loginStaff('residentialpdsschool', 'Pdsschool@321', true);
    if (!res.success || !res.user || !res.token) {
      throw new Error(`Admin login failed: ${res.error}`);
    }
    if (res.user.role !== 'SUPER_ADMIN') {
      throw new Error(`Expected SUPER_ADMIN role, got ${res.user.role}`);
    }
    if (!authStorage.getToken()) {
      throw new Error('Token was not saved in authStorage');
    }
    if (authStorage.isTokenExpired()) {
      throw new Error('Freshly issued token should not be marked expired');
    }
  });

  await assert('Teacher Authentication (PDS0002 - Mrs. Sunita Verma)', async () => {
    await authStorage.clearSession();
    const res = await apiService.loginStaff('PDS0002', 'admin123', true);
    if (!res.success || !res.user || !res.token) {
      throw new Error(`Teacher login failed: ${res.error}`);
    }
    if (res.user.role !== 'TEACHER') {
      throw new Error(`Expected TEACHER role, got ${res.user.role}`);
    }
    if (res.user.employeeId !== 'PDS0002') {
      throw new Error(`Expected employeeId PDS0002, got ${res.user.employeeId}`);
    }
  });

  await assert('Invalid Staff Password Rejection', async () => {
    const res = await apiService.loginStaff('residentialpdsschool', 'WrongPassword!123', false);
    if (res.success) {
      throw new Error('Expected login to fail for invalid password');
    }
    if (!res.error || res.error.length < 5) {
      throw new Error('Expected readable error message on failed login');
    }
  });

  // 3. Student Portal Login
  console.log('\n--- 3. Student Portal Login Flows ---');

  await assert('Student Login with Admission Number (PDS2026NUR01 + DOB 10-04-2022)', async () => {
    await authStorage.clearSession();
    const res = await apiService.loginStudent('PDS2026NUR01', '10-04-2022', true);
    if (!res.success || !res.user || !res.token) {
      throw new Error(`Student login failed: ${res.error}`);
    }
    if (res.user.role !== 'STUDENT') {
      throw new Error(`Expected STUDENT role, got ${res.user.role}`);
    }
    if (!res.user.studentId) {
      throw new Error('Expected studentId in user payload');
    }
  });

  await assert('Student Invalid DOB Rejection', async () => {
    const res = await apiService.loginStudent('PDS2026NUR01', '01-01-2000', false);
    if (res.success) {
      throw new Error('Expected student login to fail for mismatched DOB');
    }
  });

  // 4. Parent Portal Login
  console.log('\n--- 4. Parent Portal Login Flows ---');

  await assert('Parent Login with Mobile + Child DOB (9876543210 + 10-04-2022)', async () => {
    await authStorage.clearSession();
    const res = await apiService.loginParent('9876543210', '10-04-2022', true);
    if (!res.success || !res.user || !res.token) {
      throw new Error(`Parent login failed: ${res.error}`);
    }
    if (res.user.role !== 'PARENT') {
      throw new Error(`Expected PARENT role, got ${res.user.role}`);
    }
    if (!res.user.linkedStudentIds || res.user.linkedStudentIds.length === 0) {
      throw new Error('Expected linkedStudentIds array in parent user');
    }
  });

  await assert('Parent Invalid Mobile Rejection (less than 10 digits)', async () => {
    const res = await apiService.loginParent('12345', '10-04-2022', false);
    if (res.success) {
      throw new Error('Expected validation failure for short mobile number');
    }
  });

  // 5. Live Authorized Data Services
  console.log('\n--- 5. Authorized Data Services ---');

  await assert('Super Admin Fetches Live School Settings (CBSE Affiliation 10030206405)', async () => {
    await apiService.loginStaff('residentialpdsschool', 'Pdsschool@321', true);
    const res = await apiService.getSchoolSettings();
    if (!res.ok || !res.data) {
      throw new Error(`Failed to fetch school settings: ${res.error}`);
    }
    if (!res.data.schoolName?.includes('PDS PUBLIC SCHOOL')) {
      throw new Error(`Unexpected school name: ${res.data.schoolName}`);
    }
  });

  await assert('Teacher Fetches Scoped Student Records', async () => {
    await apiService.loginStaff('PDS0002', 'admin123', true);
    const res = await apiService.getStudents(10);
    if (!res.ok || !Array.isArray(res.data)) {
      throw new Error(`Failed to fetch scoped students: ${res.error}`);
    }
    // Teacher should receive valid student records
    if (res.data.length === 0) {
      throw new Error('Expected at least one student in teacher scoped roster');
    }
    const student = res.data[0];
    if (!student.name || !student.admissionNumber) {
      throw new Error('Student record missing name or admission number');
    }
  });

  await assert('Super Admin Fetches Faculty & Staff Directory Records', async () => {
    await apiService.loginStaff('residentialpdsschool', 'Pdsschool@321', true);
    const res = await apiService.getStaffList(10);
    if (!res.ok || !Array.isArray(res.data)) {
      throw new Error(`Failed to fetch staff list: ${res.error}`);
    }
    if (res.data.length === 0) {
      throw new Error('Expected at least one faculty member in staff roster');
    }
    const faculty = res.data[0];
    if (!faculty.name || !faculty.employeeId) {
      throw new Error('Faculty member missing name or employeeId');
    }
  });

  await assert('Authenticated User Fetches Official Circulars / Notices', async () => {
    await apiService.loginStaff('residentialpdsschool', 'Pdsschool@321', true);
    const res = await apiService.getNotices();
    if (!res.ok || !Array.isArray(res.data)) {
      throw new Error(`Failed to fetch notices: ${res.error}`);
    }
  });

  // 6. RBAC Module Scoping Tests
  console.log('\n--- 6. RBAC Module Scoping & Role Isolation ---');

  const rolesToCheck: Array<{
    role: UserRole;
    shouldHave: string[];
    shouldNotHave: string[];
  }> = [
    {
      role: 'SUPER_ADMIN',
      shouldHave: ['dashboard', 'timetable', 'student-attendance', 'marks-entry', 'staff-attendance', 'my-payroll', 'my-id-card', 'profile'],
      shouldNotHave: [],
    },
    {
      role: 'TEACHER',
      shouldHave: ['dashboard', 'timetable', 'student-attendance', 'marks-entry', 'my-id-card', 'profile'],
      shouldNotHave: ['staff-attendance'],
    },
    {
      role: 'ACCOUNTANT',
      shouldHave: ['dashboard', 'timetable', 'my-payroll', 'my-id-card', 'profile'],
      shouldNotHave: ['marks-entry', 'student-attendance', 'staff-attendance'],
    },
    {
      role: 'HR_STAFF',
      shouldHave: ['dashboard', 'timetable', 'staff-attendance', 'my-payroll', 'my-id-card', 'profile'],
      shouldNotHave: ['marks-entry', 'student-attendance'],
    },
    {
      role: 'STUDENT',
      shouldHave: ['dashboard', 'timetable', 'student-attendance', 'profile'],
      shouldNotHave: ['marks-entry', 'staff-attendance', 'my-payroll', 'my-id-card'],
    },
    {
      role: 'PARENT',
      shouldHave: ['dashboard', 'timetable', 'student-attendance', 'profile'],
      shouldNotHave: ['marks-entry', 'staff-attendance', 'my-payroll', 'my-id-card'],
    },
  ];

  for (const item of rolesToCheck) {
    await assert(`RBAC Module Scoping for ${item.role} (${formatRoleLabel(item.role)})`, async () => {
      const mockUser: any = {
        id: `mock-${item.role.toLowerCase()}`,
        name: `Test ${item.role}`,
        username: `user_${item.role.toLowerCase()}`,
        role: item.role,
        permissions: item.role === 'SUPER_ADMIN' ? [] : ['students.view', 'staff.view', 'fees.view', 'attendance.view', 'exams.view', 'academics.view', 'timetable.view', 'communication.view', 'documents.view', 'payroll.view', 'settings.view', 'users.view', 'audit_logs.view'],
      };

      const modules = getAuthorizedModulesForUser(mockUser);
      const moduleIds = modules.map((m) => m.id);

      for (const required of item.shouldHave) {
        if (!moduleIds.includes(required)) {
          throw new Error(`Role ${item.role} missing authorized module: ${required}`);
        }
      }

      for (const forbidden of item.shouldNotHave) {
        if (moduleIds.includes(forbidden)) {
          throw new Error(`Role ${item.role} has unauthorized module: ${forbidden}`);
        }
      }
    });
  }

  // 7. Security Enforcement: Unauthorized Module Access Prevention
  console.log('\n--- 7. Security Enforcement: Unauthorized Module Access ---');

  await assert('Teacher Blocked from Accessing Settings Module (RBAC Check)', async () => {
    const teacherUser: any = {
      id: 't-2',
      name: 'Mrs. Sunita Verma',
      username: 'PDS0002',
      role: 'TEACHER',
      permissions: ['students.view', 'attendance.view', 'academics.view', 'timetable.view', 'communication.view', 'documents.view'],
    };

    const isPermitted = hasUserPermission(teacherUser, 'settings.view');
    if (isPermitted) {
      throw new Error('Teacher should NOT have settings.view permission');
    }
  });

  // 8. Session Persistence & Logout Invalidation
  console.log('\n--- 8. Session Persistence & Clean Logout ---');

  await assert('Session Persistence & Invalidation on Logout', async () => {
    // 1. Establish session
    await apiService.loginStaff('residentialpdsschool', 'Pdsschool@321', true);
    if (!authStorage.isAuthenticated()) {
      throw new Error('authStorage did not record session as authenticated');
    }

    // 2. Perform logout
    await apiService.logout();

    // 3. Confirm storage is wiped
    if (authStorage.isAuthenticated()) {
      throw new Error('authStorage still records session as authenticated after logout');
    }
    if (authStorage.getToken() !== null) {
      throw new Error('authStorage token was not cleared after logout');
    }
    if (authStorage.getUser() !== null) {
      throw new Error('authStorage user was not cleared after logout');
    }
  });

  // Final Summary
  console.log('\n================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`MOBILE APP PHASE 1 TEST RESULTS: ${passedCount} / ${totalCount} PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log('================================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runMobileSuite().catch((err) => {
  console.error('[TestSuite] Unhandled failure:', err);
  process.exit(1);
});
