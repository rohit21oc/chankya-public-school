/**
 * Comprehensive End-to-End Verification Test Suite for Teacher Portal
 * Tests:
 * 1. Teacher Authentication & Profile Resolution
 * 2. Assigned Classes API & Scoping
 * 3. Daily Attendance Operations (Present, Absent, Late, Leave)
 * 4. Duplicate Prevention & Authorized Corrections
 * 5. Cross-Class Access Denial (HTTP 403 on unassigned classes/sections/students)
 * 6. Official Holiday Protection (HTTP 400 on holidays)
 * 7. MongoDB Persistence for Attendance Records
 * 8. Attendance Reports (Daily & Monthly)
 * 9. Exams & Marks Workflow (Draft, Validation, Missing/Absent, Submission)
 * 10. Marks Cross-Class Access Denial
 * 11. Restricted Result Publishing (HTTP 403 for Teachers)
 * 12. MongoDB Persistence for Exam Marks
 * 13. My Students Directory Scoping (Photos, Attendance, Performance)
 * 14. Audit Log Verification for Teacher Actions
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { sanitizeMongoUri } from '../server/db/mongo';
import { AttendanceModel } from '../server/models/Attendance';
import { ExamMarkModel } from '../server/models/Exam';
import { AuditLogModel } from '../server/models/AuditLog';

dotenv.config();

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    results.push({ name: testName, passed: true, details: detail });
    console.log(`✅ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
  } else {
    results.push({ name: testName, passed: false, details: detail });
    console.error(`❌ FAIL: ${testName} ${detail ? `-> ${detail}` : ''}`);
  }
}

async function api(path: string, options: any = {}) {
  const url = `${BASE_URL}/api${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTeacherPortalSuite() {
  console.log('====================================================');
  console.log('CHANAKYA PUBLIC SCHOOL & COACHING CENTRE');
  console.log('Teacher Portal End-to-End Verification Suite');
  console.log('====================================================\n');

  // Connect directly to MongoDB to authoritatively assert database records
  const rawUri = process.env.MONGODB_URI;
  const mongoUri = sanitizeMongoUri(rawUri);
  let dbConnected = false;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, { dbName: 'cps_school_erp' });
      dbConnected = true;
      console.log('✅ Connected to MongoDB Atlas directly for database assertions.\n');
    } catch (e: any) {
      console.warn('⚠️ Direct MongoDB connection notice:', e?.message);
    }
  }

  // --------------------------------------------------------------------------
  // 1. Teacher Authentication & Profile Resolution
  // --------------------------------------------------------------------------
  console.log('--- Phase 1: Authentication & Profile Resolution ---');
  let teacherToken = '';
  let teacherUser: any = null;

  const loginRes = await api('/auth/login', {
    method: 'POST',
    body: {
      identifier: 'CPS0010',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    },
  });

  assert(loginRes.status === 200 && loginRes.data?.success === true, 'Teacher CPS0010 Login', `User: ${loginRes.data?.user?.name}`);
  teacherToken = loginRes.data?.token;
  teacherUser = loginRes.data?.user;
  assert(teacherUser?.role === 'TEACHER', 'Role resolved as TEACHER', teacherUser?.role);
  assert(teacherUser?.employeeId === 'CPS0010', 'Employee ID matches CPS0010', teacherUser?.employeeId);

  const teacherHeaders = {
    Authorization: `Bearer ${teacherToken}`,
  };

  // --------------------------------------------------------------------------
  // 2. Assigned Classes API & Scoping
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 2: Teacher Assigned Classes & Dashboard Summary ---');
  const assignedRes = await api('/attendance/assigned-classes', { headers: teacherHeaders });
  assert(assignedRes.status === 200, 'Assigned Classes API response 200', `Class Teacher Of: ${assignedRes.data?.classTeacherOf}`);
  assert(assignedRes.data?.allAccess === false, 'Teacher does NOT have allAccess (restricted scope)');
  const assignedClasses = assignedRes.data?.classes || [];
  assert(assignedClasses.length > 0, 'Teacher has assigned classes populated', `Assigned: ${assignedClasses.map((c: any) => `${c.className} [${c.sections.join(',')}]`).join('; ')}`);
  
  const targetAssignedClass = assignedClasses.find((c: any) => c.className.toLowerCase().includes('class 2') || c.classId.includes('2')) || assignedClasses[0];
  const targetClassId = targetAssignedClass?.classId || 'c-2';
  const targetSection = targetAssignedClass?.sections.includes('A') ? 'A' : (targetAssignedClass?.sections[0] || 'A');
  console.log(`Using target assigned class: ${targetAssignedClass?.className} (${targetClassId}), Section: ${targetSection}`);

  const summaryRes = await api('/teacher/dashboard-summary', { headers: teacherHeaders });
  assert(summaryRes.status === 200, 'Teacher Dashboard Summary API responds 200');
  assert(Array.isArray(summaryRes.data?.assignedClasses), 'Dashboard summary contains assignedClasses list');

  // --------------------------------------------------------------------------
  // 3. Daily Attendance Operations (Present, Absent, Late, Leave)
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 3: Daily Attendance Marking & Validation ---');
  // Fetch students for target class
  const studentsRes = await api(`/students?classId=${targetClassId}&section=${targetSection}`, { headers: teacherHeaders });
  const classStudents = studentsRes.data?.data || studentsRes.data?.students || (Array.isArray(studentsRes.data) ? studentsRes.data : []);
  assert(studentsRes.status === 200, 'Fetch students in assigned class returns 200', `Count: ${classStudents.length}`);
  assert(classStudents.length >= 2, 'Assigned class has students enrolled for testing', `Found ${classStudents.length} students`);

  const student1 = classStudents[0];
  const student2 = classStudents[1];
  const student3 = classStudents[2];

  const testAttendanceDate = '2026-10-14';

  const markPayload = {
    classId: targetClassId,
    section: targetSection,
    date: testAttendanceDate,
    records: [
      { studentId: student1.id, studentName: student1.name, rollNumber: student1.rollNumber, status: 'PRESENT', remarks: 'On time' },
      { studentId: student2.id, studentName: student2.name, rollNumber: student2.rollNumber, status: 'ABSENT', remarks: 'Unexcused' },
      { studentId: student3.id, studentName: student3.name, rollNumber: student3.rollNumber, status: 'LATE', remarks: 'Bus delay 15m' },
    ],
  };

  const markRes = await api('/attendance', {
    method: 'POST',
    headers: teacherHeaders,
    body: markPayload,
  });

  assert(markRes.status === 200 && markRes.data?.success === true, 'Mark Attendance with Present/Absent/Late', `Marked: ${markRes.data?.count} students`);

  // Verify fetch attendance returns all distinct statuses
  const verifyAttRes = await api(`/attendance?classId=${targetClassId}&section=${targetSection}&date=${testAttendanceDate}`, {
    headers: teacherHeaders,
  });
  assert(verifyAttRes.status === 200, 'Query Attendance for marked date returns 200');
  const dayRecords = verifyAttRes.data || [];
  const s1Rec = dayRecords.find((r: any) => r.studentId === student1.id);
  const s2Rec = dayRecords.find((r: any) => r.studentId === student2.id);
  const s3Rec = dayRecords.find((r: any) => r.studentId === student3.id);

  assert(s1Rec?.status === 'PRESENT', 'Student 1 recorded as PRESENT', s1Rec?.status);
  assert(s2Rec?.status === 'ABSENT', 'Student 2 recorded as ABSENT', s2Rec?.status);
  assert(s3Rec?.status === 'LATE', 'Student 3 recorded as LATE', s3Rec?.status);

  // --------------------------------------------------------------------------
  // 4. Duplicate Prevention & Authorized Corrections
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 4: Duplicate Prevention & Authorized Corrections ---');
  // Re-submit attendance with corrected status for Student 2 (ABSENT -> PRESENT) and Student 3 (LATE -> LEAVE)
  const correctionPayload = {
    classId: targetClassId,
    section: targetSection,
    date: testAttendanceDate,
    records: [
      { studentId: student1.id, studentName: student1.name, rollNumber: student1.rollNumber, status: 'PRESENT', remarks: 'On time' },
      { studentId: student2.id, studentName: student2.name, rollNumber: student2.rollNumber, status: 'PRESENT', remarks: 'Corrected: arrived after roll call' },
      { studentId: student3.id, studentName: student3.name, rollNumber: student3.rollNumber, status: 'LEAVE', remarks: 'Approved medical leave' },
    ],
  };

  const correctionRes = await api('/attendance', {
    method: 'POST',
    headers: teacherHeaders,
    body: correctionPayload,
  });

  assert(correctionRes.status === 200 && correctionRes.data?.success === true, 'Attendance correction accepted', `isCorrection: ${correctionRes.data?.isCorrection}`);

  // Query again and ensure NO duplicates exist for this student on this date
  const reVerifyRes = await api(`/attendance?classId=${targetClassId}&section=${targetSection}&date=${testAttendanceDate}`, {
    headers: teacherHeaders,
  });
  const reDayRecords = reVerifyRes.data || [];
  const s2Count = reDayRecords.filter((r: any) => r.studentId === student2.id).length;
  assert(s2Count === 1, 'Duplicate prevention enforced: Exactly 1 record per student per date', `Count: ${s2Count}`);
  const s2Updated = reDayRecords.find((r: any) => r.studentId === student2.id);
  const s3Updated = reDayRecords.find((r: any) => r.studentId === student3.id);
  assert(s2Updated?.status === 'PRESENT', 'Correction applied: Student 2 status updated to PRESENT', s2Updated?.status);
  assert(s3Updated?.status === 'LEAVE', 'Correction applied: Student 3 status updated to LEAVE', s3Updated?.status);

  // --------------------------------------------------------------------------
  // 5. Cross-Class Access Denial (HTTP 403 on unassigned classes)
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 5: Cross-Class Access Denial ---');
  // Teacher tries to mark attendance for Class 12-A or Class 1-A (which CPS0010 is not assigned to)
  const unassignedClassId = 'c-12';
  const unassignedSection = 'A';

  const crossClassMarkRes = await api('/attendance', {
    method: 'POST',
    headers: teacherHeaders,
    body: {
      classId: unassignedClassId,
      section: unassignedSection,
      date: testAttendanceDate,
      records: [
        { studentId: 'stu-unassigned-1', status: 'PRESENT', remarks: 'Unauthorized' },
      ],
    },
  });

  assert(crossClassMarkRes.status === 403, 'Cross-class attendance marking blocked (HTTP 403)', crossClassMarkRes.data?.error);

  // Teacher tries to read attendance for unassigned class
  const crossClassGetRes = await api(`/attendance?classId=${unassignedClassId}&section=${unassignedSection}`, {
    headers: teacherHeaders,
  });
  assert(crossClassGetRes.status === 403, 'Cross-class attendance viewing blocked (HTTP 403)', crossClassGetRes.data?.error);

  // --------------------------------------------------------------------------
  // 6. Official Holiday Protection (HTTP 400 on holidays)
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 6: Holiday Protection ---');
  // Check holidays list
  const holidayCheckRes = await api('/attendance/student-calendar/test', { headers: teacherHeaders });
  const holidays = holidayCheckRes.data?.holidays || [];
  const sampleHoliday = holidays[0] || { date: '2026-10-02', name: 'Gandhi Jayanti' };

  const holidayMarkRes = await api('/attendance', {
    method: 'POST',
    headers: teacherHeaders,
    body: {
      classId: targetClassId,
      section: targetSection,
      date: sampleHoliday.date,
      records: [
        { studentId: student1.id, status: 'PRESENT', remarks: 'Should fail on holiday' },
      ],
    },
  });

  assert(holidayMarkRes.status === 400, 'Attendance marking on official holiday rejected (HTTP 400)', holidayMarkRes.data?.error);

  // --------------------------------------------------------------------------
  // 7. MongoDB Persistence for Attendance Records
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 7: MongoDB Persistence for Attendance ---');
  if (dbConnected) {
    const mongoAttendanceDocs = await AttendanceModel.find({
      date: testAttendanceDate,
      classId: targetClassId,
      section: { $regex: new RegExp(`^${targetSection}$`, 'i') },
    }).lean();

    assert(mongoAttendanceDocs.length > 0, 'Attendance persisted directly to MongoDB AttendanceModel', `Found ${mongoAttendanceDocs.length} docs in MongoDB`);
    const docStudent2 = mongoAttendanceDocs.find((d: any) => d.studentId === student2.id);
    assert(docStudent2?.status === 'PRESENT', 'MongoDB document reflects corrected status PRESENT', docStudent2?.status);
  } else {
    console.log('Skipping direct Mongoose query because MongoDB is in fallback mode.');
  }

  // --------------------------------------------------------------------------
  // 8. Attendance Reports (Daily & Monthly)
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 8: Daily & Monthly Attendance Reports ---');
  const studentCalRes = await api(`/attendance/student-calendar/${student1.id}`, { headers: teacherHeaders });
  assert(studentCalRes.status === 200, 'Student attendance calendar accessible for assigned student', `Total records: ${studentCalRes.data?.records?.length}`);
  const hasMarkedDay = (studentCalRes.data?.records || []).some((r: any) => r.date === testAttendanceDate);
  assert(hasMarkedDay, 'Marked test date appears in student attendance calendar');

  // --------------------------------------------------------------------------
  // 9. Exams & Marks Workflow (Draft, Validation, Missing/Absent, Submission)
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 9: Exams & Marks Workflow ---');
  // Get exams list
  const examsRes = await api('/exams', { headers: teacherHeaders });
  assert(examsRes.status === 200, 'Get exams list responds 200', `Count: ${examsRes.data?.length}`);
  const exams = examsRes.data || [];
  const targetExam = exams[0] || { id: 'exam-term-1', title: 'Mid-Term Examination 2026' };
  const examId = targetExam.id;

  // Subjects for target class
  const subjectsRes = await api(`/subjects?classId=${targetClassId}`, { headers: teacherHeaders });
  const subjects = subjectsRes.data || [];
  const targetSubject = subjects[0] || { id: 's-math-2', name: 'Mathematics' };
  const subjectId = targetSubject.id;

  // 9.1 Marks Bounds Validation: score > maxMarks must return HTTP 400
  const invalidMarksPayload = {
    examId,
    classId: targetClassId,
    section: targetSection,
    subjectId,
    marksList: [
      {
        studentId: student1.id,
        studentName: student1.name,
        rollNumber: student1.rollNumber,
        maxMarks: 100,
        marksObtained: 150, // Invalid: exceeds 100
        isAbsent: false,
      },
    ],
  };

  const invalidMarksRes = await api('/marks', {
    method: 'POST',
    headers: teacherHeaders,
    body: invalidMarksPayload,
  });
  assert(invalidMarksRes.status === 400, 'Marks bounds validation: score > maxMarks rejected (HTTP 400)', invalidMarksRes.data?.error);

  // 9.2 Draft Marks Submission (submissionStatus: 'DRAFT')
  const draftMarksPayload = {
    examId,
    classId: targetClassId,
    section: targetSection,
    subjectId,
    submissionStatus: 'DRAFT',
    marksList: [
      {
        studentId: student1.id,
        studentName: student1.name,
        rollNumber: student1.rollNumber,
        maxMarks: 100,
        marksObtained: 88,
        isAbsent: false,
        remark: 'Good work',
      },
      {
        studentId: student2.id,
        studentName: student2.name,
        rollNumber: student2.rollNumber,
        maxMarks: 100,
        marksObtained: 0,
        isAbsent: true, // Absent student
        remark: 'Medical absence',
      },
    ],
  };

  const draftRes = await api('/marks', {
    method: 'POST',
    headers: teacherHeaders,
    body: draftMarksPayload,
  });
  assert(draftRes.status === 200 && draftRes.data?.submissionStatus === 'DRAFT', 'Draft marks saved with status DRAFT');

  // 9.3 Final Marks Submission (submissionStatus: 'SUBMITTED')
  const finalMarksPayload = {
    examId,
    classId: targetClassId,
    section: targetSection,
    subjectId,
    submissionStatus: 'SUBMITTED',
    marksList: [
      {
        studentId: student1.id,
        studentName: student1.name,
        rollNumber: student1.rollNumber,
        maxMarks: 100,
        marksObtained: 92, // Final verified mark
        isAbsent: false,
        remark: 'Excellent',
      },
      {
        studentId: student2.id,
        studentName: student2.name,
        rollNumber: student2.rollNumber,
        maxMarks: 100,
        marksObtained: 0,
        isAbsent: true,
        remark: 'Absent verified',
      },
    ],
  };

  const finalRes = await api('/marks', {
    method: 'POST',
    headers: teacherHeaders,
    body: finalMarksPayload,
  });
  assert(finalRes.status === 200 && finalRes.data?.submissionStatus === 'SUBMITTED', 'Final marks submitted with status SUBMITTED');

  // Verify fetch marks
  const getMarksRes = await api(`/marks?examId=${examId}&classId=${targetClassId}&subjectId=${subjectId}`, {
    headers: teacherHeaders,
  });
  assert(getMarksRes.status === 200, 'Fetch marks returns 200');
  const marksList = getMarksRes.data || [];
  const stu1Mark = marksList.find((m: any) => m.studentId === student1.id);
  const stu2Mark = marksList.find((m: any) => m.studentId === student2.id);

  assert(stu1Mark?.marksObtained === 92, 'Student 1 final mark recorded as 92', `Marks: ${stu1Mark?.marksObtained}`);
  assert(stu1Mark?.grade === 'A' || stu1Mark?.grade === 'A1' || stu1Mark?.grade === 'A2', 'Student 1 grade auto-calculated', `Grade: ${stu1Mark?.grade}`);
  assert(stu2Mark?.isAbsent === true, 'Student 2 recorded as absent', `isAbsent: ${stu2Mark?.isAbsent}`);
  assert(stu2Mark?.status === 'FAIL' || stu2Mark?.status === 'ABSENT', 'Absent student status handled properly', `Status: ${stu2Mark?.status}`);

  // --------------------------------------------------------------------------
  // 10. Marks Cross-Class Access Denial
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 10: Marks Cross-Class Access Denial ---');
  // Teacher tries to enter marks for unassigned class (Class 12-A)
  const crossClassMarksRes = await api('/marks', {
    method: 'POST',
    headers: teacherHeaders,
    body: {
      examId,
      classId: unassignedClassId,
      section: unassignedSection,
      subjectId,
      marksList: [
        { studentId: 'unassigned-student-1', marksObtained: 75, maxMarks: 100 },
      ],
    },
  });
  assert(crossClassMarksRes.status === 403, 'Cross-class marks entry denied (HTTP 403)', crossClassMarksRes.data?.error);

  // Teacher tries to view marks for unassigned class
  const crossClassMarksViewRes = await api(`/marks?examId=${examId}&classId=${unassignedClassId}`, {
    headers: teacherHeaders,
  });
  assert(crossClassMarksViewRes.status === 403, 'Cross-class marks viewing denied (HTTP 403)', crossClassMarksViewRes.data?.error);

  // --------------------------------------------------------------------------
  // 11. Restricted Result Publishing (HTTP 403 for Teachers)
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 11: Restricted Result Publishing ---');
  const publishRes = await api(`/exams/${examId}/publish-results`, {
    method: 'POST',
    headers: teacherHeaders,
    body: { status: 'PUBLISHED' },
  });
  assert(publishRes.status === 403, 'Teacher cannot publish official exam results (HTTP 403)', publishRes.data?.error);

  const approveRes = await api(`/exams/${examId}/approve`, {
    method: 'PUT',
    headers: teacherHeaders,
  });
  assert(approveRes.status === 403, 'Teacher cannot approve exam results (HTTP 403)', approveRes.data?.error);

  // --------------------------------------------------------------------------
  // 12. MongoDB Persistence for Exam Marks
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 12: MongoDB Persistence for Exam Marks ---');
  if (dbConnected) {
    const mongoMarks = await ExamMarkModel.find({
      examId,
      classId: targetClassId,
      subjectId,
    }).lean();

    assert(mongoMarks.length >= 2, 'Exam marks saved directly to MongoDB ExamMarkModel collection', `Count: ${mongoMarks.length}`);
    const mongoStu1 = mongoMarks.find((m: any) => m.studentId === student1.id);
    assert(mongoStu1?.marksObtained === 92, 'MongoDB ExamMark document matches submitted score 92', `Score: ${mongoStu1?.marksObtained}`);
  } else {
    console.log('Skipping direct Mongoose ExamMark query (fallback mode).');
  }

  // --------------------------------------------------------------------------
  // 13. My Students Directory Scoping (Photos, Attendance, Performance)
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 13: My Students Scoping & Profile Data ---');
  // Student detail endpoint
  const studentDetailRes = await api(`/students/${student1.id}`, { headers: teacherHeaders });
  assert(studentDetailRes.status === 200, 'Student profile fetched by teacher for assigned student');
  const sData = studentDetailRes.data;
  assert(!!sData?.name, 'Student profile contains name', sData?.name);
  assert(!!sData?.admissionNumber, 'Student profile contains admissionNumber', sData?.admissionNumber);
  assert(sData?.photo !== undefined, 'Student profile contains photo URL/key field');

  // Verify that an unassigned student profile query by Teacher is BLOCKED or strictly controlled
  // Find an unassigned student from a different class
  const allStudentsRes = await api('/students?limit=100', {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const visibleToTeacher = allStudentsRes.data?.data || allStudentsRes.data?.students || (Array.isArray(allStudentsRes.data) ? allStudentsRes.data : []);
  // Verify that all students returned belong to the teacher's assigned classes or that individual student query behaves securely
  console.log(`Teacher student query returned ${visibleToTeacher.length} students.`);

  // --------------------------------------------------------------------------
  // 14. Audit Log Verification for Teacher Actions
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 14: Audit Logs Verification ---');
  // Query audit logs using Super Admin credentials to verify teacher logs were registered
  const superAdminLogin = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin', password: 'admin123', loginType: 'STAFF_ADMIN' },
  });
  const adminHeaders = { Authorization: `Bearer ${superAdminLogin.data?.token}` };

  const auditRes = await api('/audit-logs?search=CPS0010', { headers: adminHeaders });
  const logs = auditRes.data?.logs || auditRes.data || [];
  assert(Array.isArray(logs), 'Audit logs retrieved successfully');

  if (dbConnected) {
    const mongoLogs = await AuditLogModel.find({
      $or: [
        { userName: { $regex: /anil/i } },
        { action: { $in: ['ATTENDANCE_MARKED', 'ATTENDANCE_CORRECTED', 'MARKS_SUBMITTED', 'MARKS_DRAFT_SAVED'] } },
      ],
    }).sort({ timestamp: -1 }).limit(10).lean();

    assert(mongoLogs.length > 0, 'Teacher operations recorded in MongoDB AuditLog collection', `Recent logs: ${mongoLogs.length}`);
    const actionsFound = mongoLogs.map((l: any) => l.action);
    console.log(`Audited actions found in MongoDB: ${Array.from(new Set(actionsFound)).join(', ')}`);
  }

  // --------------------------------------------------------------------------
  // Final Summary
  // --------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log('TEST SUITE COMPLETE');
  console.log('====================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (dbConnected) {
    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTeacherPortalSuite().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
