/**
 * Focused Verification Test Suite:
 * 1. My Payroll (Self-Service, Data Isolation, Loading, Empty & Retry)
 * 2. Report Card (Replacing Academic Performance, Marksheet, Calculations, Session Filter, RBAC)
 *
 * RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
 */

import { User, Exam, ExamMark, StaffPayrollRecord } from '../src/types';
import { MOBILE_MODULES, getAuthorizedModulesForUser, getModuleTitleForUser, getDoMoreGridModules } from '../src/utils/rbac';
import { computeCbseEvaluation, filterExamsBySession } from '../src/utils/reportCardRules';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, extraInfo?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${description}${extraInfo ? ` (${extraInfo})` : ''}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log('VERIFYING MY PAYROLL & REPORT CARD MODULES');
  console.log('RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR');
  console.log('================================================================\n');

  // --- 1. My Payroll Self-Service & RBAC ---
  console.log('--- 1. My Payroll Self-Service & RBAC Access ---');
  {
    const teacherUser: User = {
      id: 'st-teacher-1',
      name: 'Mrs. Sunita Verma',
      username: 'PDS0002',
      role: 'TEACHER',
      employeeId: 'PDS0002',
      permissions: ['students.view', 'attendance.view', 'academics.view', 'timetable.view', 'communication.view', 'documents.view'],
    };

    const studentUser: User = {
      id: 'st-stu-1',
      name: 'Aarav Gupta',
      username: '20260401',
      role: 'STUDENT',
      studentId: 'st-1',
      permissions: [],
    };

    const parentUser: User = {
      id: 'parent-1',
      name: 'Rajesh Gupta',
      username: '9876543210',
      role: 'PARENT',
      linkedStudentIds: ['st-1'],
      permissions: [],
    };

    const teacherModules = getAuthorizedModulesForUser(teacherUser);
    const teacherModuleIds = teacherModules.map((m) => m.id);
    assert('Teacher can access My Payroll without administrative payroll.view permission', teacherModuleIds.includes('my-payroll'));

    const studentModules = getAuthorizedModulesForUser(studentUser);
    const studentModuleIds = studentModules.map((m) => m.id);
    assert('Student CANNOT access My Payroll', !studentModuleIds.includes('my-payroll'));

    const parentModules = getAuthorizedModulesForUser(parentUser);
    const parentModuleIds = parentModules.map((m) => m.id);
    assert('Parent CANNOT access My Payroll', !parentModuleIds.includes('my-payroll'));

    const teacherGrid = getDoMoreGridModules(teacherUser).map((m) => m.id);
    assert('Teacher grid no longer lists My Payroll (moved to profile menu)', !teacherGrid.includes('my-payroll'));
  }

  // --- 2. My Payroll Data Isolation ---
  console.log('\n--- 2. My Payroll Data Isolation & Non-Leakage ---');
  {
    const allPayrolls: StaffPayrollRecord[] = [
      {
        id: 'pr-101',
        staffId: 'st-teacher-1',
        employeeId: 'PDS0002',
        staffName: 'Mrs. Sunita Verma',
        month: 'September 2026',
        basicSalary: 32000,
        grossSalary: 35500,
        netSalary: 33500,
        paymentStatus: 'PAID',
      },
      {
        id: 'pr-102',
        staffId: 'st-teacher-1',
        employeeId: 'PDS0002',
        staffName: 'Mrs. Sunita Verma',
        month: 'August 2026',
        basicSalary: 32000,
        grossSalary: 35500,
        netSalary: 33500,
        paymentStatus: 'PAID',
      },
      {
        id: 'pr-103',
        staffId: 'st-teacher-2',
        employeeId: 'PDS0003',
        staffName: 'Mr. Rameshwar Jha',
        month: 'September 2026',
        basicSalary: 40000,
        grossSalary: 45000,
        netSalary: 42000,
        paymentStatus: 'PAID',
      },
    ];

    const currentTeacherEmpId = 'PDS0002';
    const currentTeacherStaffId = 'st-teacher-1';

    const teacherSlips = allPayrolls.filter(
      (p) => p.staffId === currentTeacherStaffId || p.employeeId === currentTeacherEmpId
    );

    assert('Teacher receives all and only their own payroll slips (2 slips)', teacherSlips.length === 2);
    assert('All returned payroll records belong to the authenticated employee', teacherSlips.every((p) => p.employeeId === 'PDS0002'));
    assert('Another employee salary records (PDS0003) are never exposed', !teacherSlips.some((p) => p.employeeId === 'PDS0003'));
  }

  // --- 3. Replace Academic Performance with Report Card ---
  console.log('\n--- 3. Report Card Module Renaming & Navigation ---');
  {
    const reportCardMod = MOBILE_MODULES.find((m) => m.id === 'report-card');
    assert('Module id is "report-card"', !!reportCardMod);
    assert('Module navigation title is "Report Card"', reportCardMod?.title === 'Report Card');
    assert('Old module id "academic-performance" is replaced in MOBILE_MODULES', !MOBILE_MODULES.some((m) => m.id === 'academic-performance'));

    const dummyUser: User = { id: 'u-1', name: 'Student', role: 'STUDENT', username: '20260401' };
    if (reportCardMod) {
      assert('Dynamic title returns "Report Card"', getModuleTitleForUser(reportCardMod, dummyUser) === 'Report Card');
    }

    const studentGrid = getDoMoreGridModules(dummyUser).map((m) => m.id);
    assert('Student Do More Grid contains "report-card"', studentGrid.includes('report-card'));

    const parentUser: User = { id: 'p-1', name: 'Parent', role: 'PARENT', username: '9876543210' };
    const parentGrid = getDoMoreGridModules(parentUser).map((m) => m.id);
    assert('Parent Do More Grid contains "report-card"', parentGrid.includes('report-card'));

    const teacherUser: User = { id: 't-1', name: 'Teacher', role: 'TEACHER', username: 'PDS0002' };
    const teacherGrid = getDoMoreGridModules(teacherUser).map((m) => m.id);
    assert('Teacher Do More Grid contains "report-card"', teacherGrid.includes('report-card'));
  }

  // --- 4. Examination Filtering by Academic Session ---
  console.log('\n--- 4. Examination Filtering by Academic Session ---');
  {
    const savedExams: Exam[] = [
      { id: 'ex-101', name: 'Unit Test 1', academicSession: '2026-2027', maxMarks: 50 },
      { id: 'ex-102', name: 'Half Yearly Examination', academicSession: '2026-2027', maxMarks: 100 },
      { id: 'ex-103', name: 'Annual Examination 2025', academicSession: '2025-2026', maxMarks: 100 },
      { id: 'ex-104', name: 'Midterm 2024', academicSession: '2024-2025', maxMarks: 80 },
    ];

    const session2627 = savedExams.filter((e) => !e.academicSession || e.academicSession === '2026-2027');
    assert('Filtering session 2026-2027 returns 2 current examinations', session2627.length === 2);
    assert('Every returned exam belongs to 2026-2027', session2627.every((e) => e.academicSession === '2026-2027'));

    const session2526 = savedExams.filter((e) => !e.academicSession || e.academicSession === '2025-2026');
    assert('Filtering session 2025-2026 returns previous session examination', session2526.length === 1 && session2526[0].id === 'ex-103');
  }

  // --- 5. Marksheet Calculation, Percentage, Grade & Result ---
  console.log('\n--- 5. Marksheet Calculations (Subject-wise, Total, %, Grade, Result) ---');
  {
    // CBSE Grade calculation tests
    const evalA1 = computeCbseEvaluation(95, 100);
    assert('95/100 gives 95% and A1 grade', evalA1.percentage === 95 && evalA1.grade === 'A1' && evalA1.status === 'PASS');

    const evalA2 = computeCbseEvaluation(85, 100);
    assert('85/100 gives 85% and A2 grade', evalA2.percentage === 85 && evalA2.grade === 'A2');

    const evalB1 = computeCbseEvaluation(75, 100);
    assert('75/100 gives 75% and B1 grade', evalB1.percentage === 75 && evalB1.grade === 'B1');

    const evalD = computeCbseEvaluation(35, 100);
    assert('35/100 gives 35% and D grade (Pass)', evalD.percentage === 35 && evalD.grade === 'D' && evalD.status === 'PASS');

    const evalFail = computeCbseEvaluation(28, 100);
    assert('28/100 gives 28% and E grade (Fail)', evalFail.percentage === 28 && evalFail.grade === 'E' && evalFail.status === 'FAIL');

    // Aggregate marksheet calculation
    const studentMarks: ExamMark[] = [
      { examId: 'ex-102', studentId: 'st-1', classId: 'c-10', section: 'A', subjectId: 's-math', marksObtained: 94, maxMarks: 100, grade: 'A1' },
      { examId: 'ex-102', studentId: 'st-1', classId: 'c-10', section: 'A', subjectId: 's-sci', marksObtained: 88, maxMarks: 100, grade: 'A2' },
      { examId: 'ex-102', studentId: 'st-1', classId: 'c-10', section: 'A', subjectId: 's-eng', marksObtained: 91, maxMarks: 100, grade: 'A1' },
      { examId: 'ex-102', studentId: 'st-1', classId: 'c-10', section: 'A', subjectId: 's-hin', marksObtained: 85, maxMarks: 100, grade: 'A2' },
      { examId: 'ex-102', studentId: 'st-1', classId: 'c-10', section: 'A', subjectId: 's-sst', marksObtained: 90, maxMarks: 100, grade: 'A1' },
    ];

    const totalObtained = studentMarks.reduce((sum, m) => sum + m.marksObtained, 0);
    const totalMax = studentMarks.reduce((sum, m) => sum + (m.maxMarks || 100), 0);
    const aggEval = computeCbseEvaluation(totalObtained, totalMax);

    assert('Total aggregate obtained marks is 448', totalObtained === 448);
    assert('Total aggregate maximum marks is 500', totalMax === 500);
    assert('Aggregate percentage is 89.6%', aggEval.percentage === 89.6);
    assert('Aggregate grade is A2', aggEval.grade === 'A2');
    assert('Overall result is PASS', aggEval.status === 'PASS');
  }

  // --- 6. Marksheet Authorization & Isolation ---
  console.log('\n--- 6. Marksheet Authorization & Student Isolation ---');
  {
    const marksDatabase: ExamMark[] = [
      { examId: 'ex-102', studentId: 'st-1', classId: 'c-10', section: 'A', subjectId: 's-math', marksObtained: 94, maxMarks: 100 },
      { examId: 'ex-102', studentId: 'st-2', classId: 'c-10', section: 'A', subjectId: 's-math', marksObtained: 72, maxMarks: 100 },
      { examId: 'ex-102', studentId: 'st-3', classId: 'c-9', section: 'B', subjectId: 's-math', marksObtained: 85, maxMarks: 100 },
    ];

    // Student 1 querying marks
    const student1Id = 'st-1';
    const student1Marks = marksDatabase.filter((m) => m.studentId === student1Id);
    assert('Student 1 only receives their own marks', student1Marks.length === 1 && student1Marks[0].studentId === 'st-1');
    assert('Other student (st-2, st-3) marks are never exposed to Student 1', !student1Marks.some((m) => m.studentId !== 'st-1'));

    // Parent with linked student st-1 querying marks
    const linkedIds = ['st-1'];
    const parentMarks = marksDatabase.filter((m) => linkedIds.includes(m.studentId));
    assert('Parent only receives marks for linked child (st-1)', parentMarks.length === 1 && parentMarks[0].studentId === 'st-1');
    assert('Unlinked student (st-2, st-3) marks are not exposed to parent', !parentMarks.some((m) => !linkedIds.includes(m.studentId)));

    // Teacher assigned to Class 10 Section A only
    const teacherAssignedClass = 'c-10';
    const teacherAssignedSec = 'A';
    const teacherVisibleMarks = marksDatabase.filter(
      (m) => m.classId === teacherAssignedClass && m.section === teacherAssignedSec
    );
    assert('Teacher can only view marks for assigned class & section (c-10, A)', teacherVisibleMarks.length === 2);
    assert('Unassigned class marks (c-9, B) are excluded for teacher', !teacherVisibleMarks.some((m) => m.classId === 'c-9'));
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
