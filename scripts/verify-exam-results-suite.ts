import dotenv from 'dotenv';
dotenv.config();
import { generateResultSheetHtml, generateBulkMarksheetHtml } from '../src/utils/resultSheetGenerator';
import { calculateEvaluation } from '../src/utils/grading';

const BASE_URL = 'http://localhost:3000';

async function runExamResultsSuite() {
  console.log('========================================================================');
  console.log('RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR - EXAM RESULTS & TABULATION SUITE');
  console.log('========================================================================\n');

  // 1. Authenticate as Staff/Admin
  console.log('>>> [1/7] Authenticating as Administrator...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    }),
  });
  if (!loginRes.ok) throw new Error(`Admin login failed: ${loginRes.status}`);
  const { token, user } = await loginRes.json();
  console.log(`[PASS] Admin authenticated as ${user.name} (${user.role})\n`);

  // 2. Verify Deduplication and Dynamic Loading of Exams
  console.log('>>> [2/7] Testing Exam Loading & Zero Duplicates from MongoDB/API...');
  const examsRes = await fetch(`${BASE_URL}/api/exams`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!examsRes.ok) throw new Error(`Fetch exams failed: ${examsRes.status}`);
  const exams: any[] = await examsRes.json();
  const examIds = new Set<string>();
  for (const e of exams) {
    if (examIds.has(e.id)) {
      throw new Error(`Duplicate exam detected: ${e.id} (${e.name})`);
    }
    examIds.add(e.id);
  }
  console.log(`[PASS] Verified ${exams.length} examinations. All IDs are strictly unique, zero duplicates.\n`);

  // 3. Test Real Classes: Nursery, LKG, UKG, Class 1, Class 5
  console.log('>>> [3/7] Verifying Class -> Subject Mapping for Real Classes (Nursery, LKG, UKG, Class 1, Class 5)...');
  const targetClasses = [
    { id: 'c-nur', name: 'Nursery' },
    { id: 'c-lkg', name: 'LKG' },
    { id: 'c-ukg', name: 'UKG' },
    { id: 'c-1', name: 'Class 1' },
    { id: 'c-5', name: 'Class 5' },
  ];

  const classDataMap: Record<string, { subjects: any[]; students: any[] }> = {};

  for (const tc of targetClasses) {
    // A. Class subjects verification
    const subRes = await fetch(`${BASE_URL}/api/classes/${tc.id}/subjects`);
    if (!subRes.ok) throw new Error(`Fetch subjects failed for ${tc.name}`);
    const subs: any[] = await subRes.json();

    if (!Array.isArray(subs) || subs.length === 0) {
      throw new Error(`No active subjects assigned to class ${tc.name} (${tc.id})`);
    }

    // Verify all subjects are strictly active, assigned to this class, and unique
    const seenSubIds = new Set<string>();
    for (const s of subs) {
      if ((s.status || 'ACTIVE') !== 'ACTIVE') {
        throw new Error(`Inactive subject ${s.name} returned for ${tc.name}`);
      }
      if (!Array.isArray(s.classIds) || !s.classIds.includes(tc.id)) {
        throw new Error(`Subject ${s.name} is not assigned to class ${tc.name} (classIds: ${JSON.stringify(s.classIds)})`);
      }
      if (seenSubIds.has(s.id)) {
        throw new Error(`Duplicate subject ${s.name} (${s.id}) returned for ${tc.name}`);
      }
      seenSubIds.add(s.id);
    }

    // B. Enrolled students verification
    const stuRes = await fetch(`${BASE_URL}/api/students?classId=${tc.id}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const stuJson = await stuRes.json();
    const students: any[] = stuJson.data || stuJson || [];

    if (students.length === 0) {
      throw new Error(`No enrolled students in class ${tc.name} (${tc.id})`);
    }

    // Ensure all students belong to this class
    for (const st of students) {
      if (st.classId !== tc.id) {
        throw new Error(`Student ${st.name} has classId ${st.classId}, expected ${tc.id}`);
      }
    }

    classDataMap[tc.id] = { subjects: subs, students };
    console.log(`[PASS] ${tc.name} (${tc.id}): ${subs.length} active assigned subjects, ${students.length} enrolled students.`);
    console.log(`       Subjects: ${subs.map((s) => s.name).join(', ')}`);
  }
  console.log('');

  // 4. Verify Grading Rules: Exactly 32% FAIL, 33% PASS
  console.log('>>> [4/7] Verifying Strict Grading System (32% = FAIL, 33% = PASS)...');
  const grade95 = calculateEvaluation(95, 100);
  const grade33 = calculateEvaluation(33, 100);
  const grade32 = calculateEvaluation(32, 100);
  const grade32_9 = calculateEvaluation(32.9, 100);
  const grade0 = calculateEvaluation(0, 100);

  if (grade95.grade !== 'A1' || grade95.status !== 'PASS') {
    throw new Error(`95% evaluation failed: ${JSON.stringify(grade95)}`);
  }
  if (grade33.grade !== 'D' || grade33.status !== 'PASS') {
    throw new Error(`33% evaluation failed: ${JSON.stringify(grade33)}`);
  }
  if (grade32.grade !== 'E/F' || grade32.status !== 'FAIL') {
    throw new Error(`32% evaluation failed (must be FAIL): ${JSON.stringify(grade32)}`);
  }
  if (grade32_9.status !== 'FAIL') {
    throw new Error(`32.9% evaluation failed (must be FAIL): ${JSON.stringify(grade32_9)}`);
  }
  if (grade0.status !== 'FAIL') {
    throw new Error(`0% evaluation failed: ${JSON.stringify(grade0)}`);
  }
  console.log(`[PASS] 95% -> Grade ${grade95.grade} (${grade95.status})`);
  console.log(`[PASS] 33% -> Grade ${grade33.grade} (${grade33.status})`);
  console.log(`[PASS] 32% -> Grade ${grade32.grade} (${grade32.status}) [CONFIRMED FAIL]`);
  console.log(`[PASS] 32.9% -> Grade ${grade32_9.grade} (${grade32_9.status}) [CONFIRMED FAIL]\n`);

  // 5. Create Unified Evaluation Exam and Record Real Marks
  console.log('>>> [5/7] Creating Comprehensive Exam & Recording Real Marks Across Classes...');
  const examId = `exam-evaluation-${Date.now()}`;
  const examPayload = {
    id: examId,
    name: 'Mid-Term Tabulation Evaluation 2026',
    title: 'Mid-Term Tabulation Evaluation 2026',
    academicSession: '2026-2027',
    examType: 'MID_TERM',
    classIds: targetClasses.map((c) => c.id),
    status: 'PUBLISHED',
    admitCardStatus: 'PUBLISHED',
    resultsStatus: 'PUBLISHED',
    schedule: [],
  };

  const createExamRes = await fetch(`${BASE_URL}/api/exams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(examPayload),
  });
  if (!createExamRes.ok) throw new Error(`Create exam failed: ${createExamRes.status}`);
  const createdExam = await createExamRes.json();
  console.log(`[PASS] Created and published examination: ${createdExam.name} (${createdExam.id})`);

  // Record marks for each class testing PASS, FAIL (32%), and High (95%)
  const allRecordedMarks: any[] = [];
  for (const tc of targetClasses) {
    const { subjects, students } = classDataMap[tc.id];
    const sub1 = subjects[0];
    const sub2 = subjects[1] || subjects[0];

    const student1 = students[0];
    const student2 = students[1] || students[0];

    const marksForClass = [
      // Student 1: High score in sub1 (92%), Pass score in sub2 (35%)
      {
        examId,
        studentId: student1.id,
        studentName: student1.name,
        admissionNumber: student1.admissionNumber,
        rollNumber: student1.rollNumber,
        classId: tc.id,
        section: student1.section || 'A',
        subjectId: sub1.id,
        subjectName: sub1.name,
        marksObtained: 92,
        maxMarks: 100,
        passMarks: 33,
        isAbsent: false,
      },
      {
        examId,
        studentId: student1.id,
        studentName: student1.name,
        admissionNumber: student1.admissionNumber,
        rollNumber: student1.rollNumber,
        classId: tc.id,
        section: student1.section || 'A',
        subjectId: sub2.id,
        subjectName: sub2.name,
        marksObtained: 35,
        maxMarks: 100,
        passMarks: 33,
        isAbsent: false,
      },
    ];

    if (student2.id !== student1.id) {
      // Student 2: Sub 1 has 32% (FAIL), Sub 2 has Absent
      marksForClass.push(
        {
          examId,
          studentId: student2.id,
          studentName: student2.name,
          admissionNumber: student2.admissionNumber,
          rollNumber: student2.rollNumber,
          classId: tc.id,
          section: student2.section || 'A',
          subjectId: sub1.id,
          subjectName: sub1.name,
          marksObtained: 32, // Essential repeat
          maxMarks: 100,
          passMarks: 33,
          isAbsent: false,
        },
        {
          examId,
          studentId: student2.id,
          studentName: student2.name,
          admissionNumber: student2.admissionNumber,
          rollNumber: student2.rollNumber,
          classId: tc.id,
          section: student2.section || 'A',
          subjectId: sub2.id,
          subjectName: sub2.name,
          marksObtained: 0,
          maxMarks: 100,
          passMarks: 33,
          isAbsent: true, // Absent
        }
      );
    }

    const postMarksRes = await fetch(`${BASE_URL}/api/marks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ examId, marksList: marksForClass }),
    });
    if (!postMarksRes.ok) throw new Error(`Post marks failed for ${tc.name}: ${postMarksRes.status}`);
    allRecordedMarks.push(...marksForClass);
    console.log(`[PASS] Recorded ${marksForClass.length} mark entries for ${tc.name}.`);
  }
  console.log('');

  // 6. Test Result Sheet HTML Generation for All 5 Classes
  console.log('>>> [6/7] Verifying Result Sheet HTML Generation for Nursery, LKG, UKG, Class 1, Class 5...');
  const fakeSettings: any = {
    schoolName: 'RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR',
    schoolAddress: 'BRC Near Shahpur Road, Sheohar, Bihar - 843329',
    affiliatedBoard: 'CBSE',
    affiliationCode: '10030206405',
    schoolCode: 'PDS-7821',
    currentAcademicSession: '2026-2027',
  };

  for (const tc of targetClasses) {
    const { subjects, students } = classDataMap[tc.id];
    const html = generateResultSheetHtml({
      settings: fakeSettings,
      exam: createdExam,
      selectedClass: { id: tc.id, name: tc.name, sections: ['A'] } as any,
      section: 'A',
      subjects,
      students,
      marksList: allRecordedMarks,
    });

    // Validations on generated Result Sheet HTML
    if (!html.includes('Official Tabulation & Result Sheet')) {
      throw new Error(`Result sheet HTML for ${tc.name} missing official title`);
    }
    if (!html.includes('10030206405')) {
      throw new Error(`Result sheet HTML for ${tc.name} missing affiliation code`);
    }
    if (!html.includes(tc.name)) {
      throw new Error(`Result sheet HTML missing class name ${tc.name}`);
    }
    for (const sub of subjects) {
      if (!html.includes(sub.code || sub.name)) {
        throw new Error(`Result sheet HTML for ${tc.name} missing subject ${sub.name}`);
      }
    }
    for (const st of students) {
      if (!html.includes(st.name)) {
        throw new Error(`Result sheet HTML for ${tc.name} missing student ${st.name}`);
      }
    }
    if (!html.includes('Class Teacher') || !html.includes('Tabulator') || !html.includes('Principal')) {
      throw new Error(`Result sheet HTML for ${tc.name} missing official signature blocks`);
    }
    if (!html.includes('@page { size: A4 landscape; margin: 8mm; }')) {
      throw new Error(`Result sheet HTML for ${tc.name} missing A4 landscape print specification`);
    }
    console.log(`[PASS] Result sheet generated for ${tc.name}: A4 Landscape, ${subjects.length} subjects, ${students.length} students, signatures intact.`);
  }
  console.log('');

  // 7. Test Bulk & Single Marksheet Generation
  console.log('>>> [7/7] Verifying Bulk & Single Marksheet Generation (1 Student Per Page, No Duplicates)...');
  for (const tc of targetClasses) {
    const { subjects, students } = classDataMap[tc.id];
    const bulkHtml = generateBulkMarksheetHtml({
      settings: fakeSettings,
      exam: createdExam,
      students,
      marksList: allRecordedMarks,
      getStudentSubjects: () => subjects,
      getStudentAttendance: () => ({ percentage: 98 }),
    });

    if (!bulkHtml.includes('Official Examination Marksheet')) {
      throw new Error(`Bulk marksheet HTML for ${tc.name} missing title`);
    }
    if (!bulkHtml.includes('page-break-after: always') && !bulkHtml.includes('break-after: page')) {
      throw new Error(`Bulk marksheet HTML for ${tc.name} missing page-break CSS`);
    }
    for (const st of students) {
      if (!bulkHtml.includes(st.name)) {
        throw new Error(`Bulk marksheet HTML for ${tc.name} missing student ${st.name}`);
      }
      if (!bulkHtml.includes(st.admissionNumber)) {
        throw new Error(`Bulk marksheet HTML for ${tc.name} missing admission number ${st.admissionNumber}`);
      }
    }
    console.log(`[PASS] Bulk marksheet verified for ${tc.name}: 1 student per page, ${students.length} students.`);
  }

  console.log('\n========================================================================');
  console.log('ALL 7 EXAM RESULTS & TABULATION SUITE TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================\n');
}

runExamResultsSuite().catch((err) => {
  console.error('\n[FAIL] Exam results suite failed:', err);
  process.exit(1);
});
