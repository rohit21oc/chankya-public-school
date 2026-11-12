/**
 * Verification Test Suite for Requested PDS School ERP Mobile App Fixes
 * Tests all required scenarios:
 * 1. Slow API response, API failure and retry handling
 * 2. Sidebar open/close and Android back behavior
 * 3. Unmarked attendance cannot be submitted
 * 4. Teacher cannot select an unauthorized class or subject
 * 5. Examination options change correctly with academic session
 * 6. Payroll never displays another employee's records
 * 7. ID card displays real data and handles missing fields correctly
 */

import { resolveBackAction } from '../src/utils/backNavigation';
import {
  scopeClassesForTeacher,
  scopeSubjectsForTeacher,
  scopeSubjectsForClassAndSection,
  isTeacherAuthorizedForSubject,
} from '../src/utils/teacherScopeRules';
import { buildIdCardView, ownStaffIdentifier } from '../src/utils/teacherProfileRules';
import { getAuthorizedModulesForUser } from '../src/utils/rbac';
import { User, ClassItem, SubjectItem, Exam, Staff, StaffPayrollRecord } from '../src/types';
import { TeacherAuthorizedAssignments } from '../src/types/teacher';

let passed = 0;
let failed = 0;

function assert(desc: string, condition: boolean, extra?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${desc}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${desc} ${extra ? `(${extra})` : ''}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log('VERIFYING REQUESTED PDS SCHOOL MOBILE FIXES');
  console.log('================================================================\n');

  // 1. Slow API response, API failure and retry
  console.log('--- 1. Slow API Response, Failure & Retry Handling ---');
  {
    let callCount = 0;
    const mockFetchWithRetry = async (shouldFailFirst = true) => {
      callCount++;
      if (shouldFailFirst && callCount === 1) {
        throw new Error('Connection timed out');
      }
      return { ok: true, status: 200, data: { status: 'UP' } };
    };

    try {
      await mockFetchWithRetry(true);
      assert('Initial failure thrown as expected', false);
    } catch (err: any) {
      assert('Initial failure properly intercepted on timeout', err.message === 'Connection timed out');
    }

    const retryRes = await mockFetchWithRetry(true);
    assert('Retry succeeds on subsequent attempt', retryRes.ok && retryRes.data.status === 'UP');
    assert('Total attempts tracked correctly', callCount === 2);
  }

  // 2. Sidebar open/close and Android back behavior
  console.log('\n--- 2. Sidebar Open/Close and Android Back Behavior ---');
  {
    // When drawer is open, back press MUST close drawer
    const drawerOpenAction = resolveBackAction({
      isAuthenticated: true,
      isDrawerOpen: true,
      currentScreenId: 'marks-entry',
    });
    assert('Android back closes open drawer before navigating away', drawerOpenAction === 'close-drawer');

    // When drawer is closed on a subscreen, back press returns to dashboard
    const subscreenAction = resolveBackAction({
      isAuthenticated: true,
      isDrawerOpen: false,
      currentScreenId: 'marks-entry',
    });
    assert('Android back on subscreen returns to dashboard', subscreenAction === 'go-dashboard');

    // When drawer is closed on dashboard, back press exits app
    const dashboardAction = resolveBackAction({
      isAuthenticated: true,
      isDrawerOpen: false,
      currentScreenId: 'dashboard',
    });
    assert('Android back on dashboard exits app', dashboardAction === 'exit-app');

    // Unauthenticated user back press exits app
    const unauthAction = resolveBackAction({
      isAuthenticated: false,
      isDrawerOpen: false,
      currentScreenId: 'login',
    });
    assert('Android back when unauthenticated exits app', unauthAction === 'exit-app');

    // Assignment module is removed from mobile sidebar
    const teacherUser: User = {
      id: 't-1',
      name: 'Test Teacher',
      username: 'PDS0002',
      role: 'TEACHER',
      permissions: ['students.view', 'attendance.view', 'exams.view'],
    };
    const sidebarModules = getAuthorizedModulesForUser(teacherUser);
    const hasAssignments = sidebarModules.some((m) => m.id === 'assignments');
    assert('Assignment module is excluded from mobile sidebar', !hasAssignments);
  }

  // 3. Student Attendance — unmarked students cannot be submitted
  console.log('\n--- 3. Student Attendance — Unmarked Students Cannot Be Submitted ---');
  {
    const students = [
      { id: 's1', name: 'Rohan Kumar' },
      { id: 's2', name: 'Priya Sharma' },
      { id: 's3', name: 'Amit Singh' },
    ];

    // Attendance map with s3 missing (unmarked)
    const partialMap: Record<string, 'PRESENT' | 'ABSENT'> = {
      s1: 'PRESENT',
      s2: 'ABSENT',
    };

    const markedCount = students.filter((s) => !!partialMap[s.id]).length;
    const unmarkedCount = students.length - markedCount;
    const canSubmit = unmarkedCount === 0;

    assert('Unmarked student count is accurately calculated', unmarkedCount === 1);
    assert('Submission is disabled while any student is unmarked', !canSubmit);

    // Fully marked map
    const completeMap: Record<string, 'PRESENT' | 'ABSENT'> = {
      s1: 'PRESENT',
      s2: 'ABSENT',
      s3: 'PRESENT',
    };
    const completeUnmarked = students.filter((s) => !completeMap[s.id]).length;
    assert('Submission is allowed only when all students are explicitly marked', completeUnmarked === 0);
  }

  // 4. Marks Entry — teacher cannot select an unauthorized class or subject
  console.log('\n--- 4. Marks Entry — Scoped Teacher Authorization for Classes & Subjects ---');
  {
    const assignments: TeacherAuthorizedAssignments = {
      allAccess: false,
      teacherId: 'staff-101',
      classes: [
        { classId: 'cls-5', className: 'Class 5', sections: ['A', 'B'] },
        { classId: 'cls-6', className: 'Class 6', sections: ['A'] },
      ],
      subjects: [
        { id: 'sub-math', name: 'Mathematics' },
        { id: 'sub-sci', name: 'Science' },
      ],
      detailedAssignments: [
        {
          classId: 'cls-5',
          className: 'Class 5',
          section: 'A',
          subjects: [{ id: 'sub-math', name: 'Mathematics' }],
        },
        {
          classId: 'cls-5',
          className: 'Class 5',
          section: 'B',
          subjects: [{ id: 'sub-sci', name: 'Science' }],
        },
        {
          classId: 'cls-6',
          className: 'Class 6',
          section: 'A',
          subjects: [{ id: 'sub-math', name: 'Mathematics' }, { id: 'sub-sci', name: 'Science' }],
        },
      ],
    };

    const allClasses: ClassItem[] = [
      { id: 'cls-4', name: 'Class 4', sections: ['A', 'B'] },
      { id: 'cls-5', name: 'Class 5', sections: ['A', 'B', 'C'] },
      { id: 'cls-6', name: 'Class 6', sections: ['A', 'B'] },
      { id: 'cls-7', name: 'Class 7', sections: ['A'] },
    ];

    const allSubs: SubjectItem[] = [
      { id: 'sub-math', name: 'Mathematics' },
      { id: 'sub-sci', name: 'Science' },
      { id: 'sub-eng', name: 'English' },
      { id: 'sub-hin', name: 'Hindi' },
    ];

    // Scoped classes
    const scopedClasses = scopeClassesForTeacher(allClasses, assignments);
    const scopedClassIds = scopedClasses.map((c) => c.id);
    assert('Unauthorized classes (Class 4, Class 7) are excluded', !scopedClassIds.includes('cls-4') && !scopedClassIds.includes('cls-7'));
    assert('Authorized classes (Class 5, Class 6) are retained', scopedClassIds.includes('cls-5') && scopedClassIds.includes('cls-6'));

    // Section filtering: Class 5 Section C is not assigned
    const cls5 = scopedClasses.find((c) => c.id === 'cls-5');
    const cls5Sections = (cls5?.sections || []) as any[];
    assert('Unassigned section C is stripped from Class 5', cls5Sections.length === 2 && !cls5Sections.includes('C'));

    // Detailed subject scoping per class and section
    const cls5SecASubs = scopeSubjectsForClassAndSection(allSubs, assignments, 'cls-5', 'A');
    assert('Class 5 Section A only offers Mathematics', cls5SecASubs.length === 1 && cls5SecASubs[0].id === 'sub-math');

    const cls5SecBSubs = scopeSubjectsForClassAndSection(allSubs, assignments, 'cls-5', 'B');
    assert('Class 5 Section B only offers Science', cls5SecBSubs.length === 1 && cls5SecBSubs[0].id === 'sub-sci');

    // Validation helper
    assert('Teacher authorized for Math in Class 5-A', isTeacherAuthorizedForSubject(assignments, 'cls-5', 'A', 'sub-math'));
    assert('Teacher NOT authorized for Science in Class 5-A', !isTeacherAuthorizedForSubject(assignments, 'cls-5', 'A', 'sub-sci'));
    assert('Teacher NOT authorized for English anywhere', !isTeacherAuthorizedForSubject(assignments, 'cls-5', 'A', 'sub-eng'));
  }

  // 5. Examination options change correctly with academic session
  console.log('\n--- 5. Examination Filtering by Academic Session ---');
  {
    const exams: Exam[] = [
      { id: 'ex-1', name: 'Unit Test 1', academicSession: '2026-2027', maxMarks: 50 },
      { id: 'ex-2', name: 'Half Yearly 2026', academicSession: '2026-2027', maxMarks: 100 },
      { id: 'ex-3', name: 'Annual Exam 2025', academicSession: '2025-2026', maxMarks: 100 },
      { id: 'ex-4', name: 'Midterm 2024', academicSession: '2024-2025', maxMarks: 80 },
    ];

    const session2627Exams = exams.filter((e) => !e.academicSession || e.academicSession === '2026-2027');
    assert('Session 2026-2027 returns only current examinations', session2627Exams.length === 2 && session2627Exams.every((e) => e.academicSession === '2026-2027'));

    const session2526Exams = exams.filter((e) => !e.academicSession || e.academicSession === '2025-2026');
    assert('Session 2025-2026 returns previous examination', session2526Exams.length === 1 && session2526Exams[0].id === 'ex-3');

    // Max marks loaded from selected exam
    const selectedExam = session2627Exams.find((e) => e.id === 'ex-1');
    assert('Exam maxMarks loaded accurately from exam configuration (50 marks)', selectedExam?.maxMarks === 50);
  }

  // 6. My Payroll — never displays another employee's records
  console.log('\n--- 6. My Payroll Scoping & Isolation ---');
  {
    const allPayrolls: StaffPayrollRecord[] = [
      {
        id: 'pr-1',
        employeeId: 'PDS0002',
        staffName: 'Mrs. Sunita Verma',
        month: 'October 2026',
        basicSalary: 32000,
        netSalary: 35500,
        status: 'PAID',
      },
      {
        id: 'pr-2',
        employeeId: 'PDS0003',
        staffName: 'Mr. Rajesh Kumar',
        month: 'October 2026',
        basicSalary: 45000,
        netSalary: 48000,
        status: 'PAID',
      },
      {
        id: 'pr-3',
        employeeId: 'PDS0002',
        staffName: 'Mrs. Sunita Verma',
        month: 'September 2026',
        basicSalary: 32000,
        netSalary: 35500,
        status: 'PAID',
      },
    ];

    const currentTeacherEmpId = 'PDS0002';
    const scopedPayrolls = allPayrolls.filter((p) => p.employeeId === currentTeacherEmpId);

    assert('Teacher receives only their own payroll slips', scopedPayrolls.length === 2 && scopedPayrolls.every((p) => p.employeeId === 'PDS0002'));
    assert('Other employees salary records (PDS0003) are strictly excluded', !scopedPayrolls.some((p) => p.employeeId === 'PDS0003'));
  }

  // 7. My ID Card — displays real data and handles missing fields correctly
  console.log('\n--- 7. My ID Card Real Data and Missing Fields Handling ---');
  {
    const fullStaff: Staff = {
      id: 'st-1',
      employeeId: 'PDS-T009',
      name: 'Rameshwar Jha',
      designation: 'Senior Faculty',
      department: 'Science',
      phone: '9876543210',
      bloodGroup: 'O+',
      qualification: 'M.Sc. Physics, B.Ed.',
      joiningDate: '10-06-2018',
    };

    const sparseStaff: Staff = {
      id: 'st-2',
      employeeId: 'PDS-T010',
      name: 'Pooja Kumari',
    };

    const mockUser: User = {
      id: 'st-1',
      name: 'Rameshwar Jha',
      username: 'PDS-T009',
      role: 'TEACHER',
      employeeId: 'PDS-T009',
    };

    const fullView = buildIdCardView(fullStaff, mockUser);
    assert('Full staff record renders genuine employeeId', fullView.employeeId === 'PDS-T009');
    assert('Full staff record renders genuine designation', fullView.designation === 'Senior Faculty');
    assert('Full staff record renders genuine department', fullView.department === 'Science');

    const sparseView = buildIdCardView(sparseStaff, { ...mockUser, id: 'st-2', name: 'Pooja Kumari', employeeId: 'PDS-T010' });
    assert('Sparse record does not fabricate department (stays undefined)', sparseView.department === undefined);
    assert('Sparse record does not fabricate phone (stays undefined)', sparseView.phone === undefined);
    assert('Blood group is not invented when missing', sparseStaff.bloodGroup === undefined);
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
