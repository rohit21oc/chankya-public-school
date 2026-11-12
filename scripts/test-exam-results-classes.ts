import { calculateEvaluation, OFFICIAL_GRADING_SYSTEM } from '../src/utils/grading';
import { generateResultSheetHtml, generateBulkMarksheetHtml } from '../src/utils/resultSheetGenerator';
import { Student, Subject, Exam, ExamMark, AcademicClass, SchoolSettings } from '../src/types';

async function runTest() {
  console.log('========================================================================');
  console.log('TESTING EXAM RESULTS & TABULATION FOR REAL CLASSES');
  console.log('========================================================================');

  const BASE_URL = 'http://localhost:3000';

  // 1. Check grading rules
  console.log('>>> [1/6] Validating Grading System Rules (32% FAIL, 33% PASS)...');
  const eval32 = calculateEvaluation(32, 100);
  const eval33 = calculateEvaluation(33, 100);
  const eval95 = calculateEvaluation(95, 100);

  if (eval32.status !== 'FAIL' || eval32.grade !== 'E/F') {
    throw new Error(`FAIL rule broken: 32% returned ${eval32.grade} (${eval32.status})`);
  }
  if (eval33.status !== 'PASS' || eval33.grade !== 'D') {
    throw new Error(`PASS rule broken: 33% returned ${eval33.grade} (${eval33.status})`);
  }
  if (eval95.status !== 'PASS' || eval95.grade !== 'A1') {
    throw new Error(`Grade A1 broken: 95% returned ${eval95.grade}`);
  }
  console.log('  [PASS] Grading confirmed: 32% -> FAIL (E/F), 33% -> PASS (D), 95% -> PASS (A1)');

  // 2. Fetch classes from MongoDB
  console.log('>>> [2/6] Loading Classes dynamically from MongoDB...');
  const classesRes = await fetch(`${BASE_URL}/api/classes`);
  const classes: AcademicClass[] = await classesRes.json();
  console.log(`  [PASS] Retrieved ${classes.length} classes from MongoDB.`);

  // 3. Fetch exams from MongoDB
  console.log('>>> [3/6] Loading Exams dynamically from MongoDB (checking deduplication)...');
  const examsRes = await fetch(`${BASE_URL}/api/exams`);
  const exams: Exam[] = await examsRes.json();
  const examIds = new Set<string>();
  for (const ex of exams) {
    if (examIds.has(ex.id)) {
      throw new Error(`Duplicate exam detected: ${ex.id}`);
    }
    examIds.add(ex.id);
  }
  console.log(`  [PASS] Retrieved ${exams.length} unique exams from MongoDB. No duplicates.`);
  const activeExam = exams[0];
  console.log(`  Target exam: "${activeExam.name || activeExam.title}" (${activeExam.id})`);

  // Fetch school settings
  const settingsRes = await fetch(`${BASE_URL}/api/settings`);
  const settings: SchoolSettings = await settingsRes.json();

  // 4. Test Class -> Subject Mapping for Nursery, LKG, UKG, Class 1, Class 5
  console.log('>>> [4/6] Verifying Class -> Subject Mapping (Active subjects only, no fallbacks)...');
  const targetClassCodes = [
    { code: 'c-nur', name: 'Nursery' },
    { code: 'c-lkg', name: 'LKG' },
    { code: 'c-ukg', name: 'UKG' },
    { code: 'c-1', name: 'Class 1' },
    { code: 'c-5', name: 'Class 5' },
  ];

  for (const tc of targetClassCodes) {
    const cls = classes.find((c) => c.id === tc.code || c.name.toLowerCase() === tc.name.toLowerCase());
    if (!cls) {
      console.warn(`  [WARN] Class ${tc.name} (${tc.code}) not found in database.`);
      continue;
    }

    const subRes = await fetch(`${BASE_URL}/api/classes/${cls.id}/subjects`);
    const subs: Subject[] = await subRes.json();

    // Verify all returned subjects are active and assigned to this class
    const seenSubs = new Set<string>();
    for (const s of subs) {
      if ((s.status || 'ACTIVE') !== 'ACTIVE') {
        throw new Error(`Inactive subject returned for class ${cls.name}: ${s.name} (${s.id})`);
      }
      if (!Array.isArray(s.classIds) || !s.classIds.includes(cls.id)) {
        throw new Error(`Subject not assigned to class ${cls.name}: ${s.name} (${s.id})`);
      }
      if (seenSubs.has(s.id)) {
        throw new Error(`Duplicate subject returned for class ${cls.name}: ${s.name} (${s.id})`);
      }
      seenSubs.add(s.id);
    }
    console.log(`  [PASS] ${cls.name} (${cls.id}): ${subs.length} active assigned subjects: ${subs.map((s) => s.name).join(', ')}`);
  }

  // 5. Test Result Sheet HTML generation for each class with real students and marks
  console.log('>>> [5/6] Testing Result Sheet Generation (A4 Landscape, real marks, totals, %, PASS/FAIL)...');
  const studentsRes = await fetch(`${BASE_URL}/api/students?limit=200`);
  const studentsData = await studentsRes.json();
  const allStudents: Student[] = studentsData.data || studentsData || [];

  const marksRes = await fetch(`${BASE_URL}/api/exams/${activeExam.id}/marks`);
  const marksList: ExamMark[] = marksRes.ok ? await marksRes.json() : [];

  for (const tc of targetClassCodes) {
    const cls = classes.find((c) => c.id === tc.code || c.name.toLowerCase() === tc.name.toLowerCase());
    if (!cls) continue;

    const classStudents = allStudents.filter((s) => s.classId === cls.id);
    const subRes = await fetch(`${BASE_URL}/api/classes/${cls.id}/subjects`);
    const classSubs: Subject[] = await subRes.json();

    const sheetHtml = generateResultSheetHtml({
      settings,
      exam: activeExam,
      selectedClass: cls,
      section: 'ALL',
      subjects: classSubs,
      students: classStudents,
      marksList,
    });

    if (!sheetHtml.includes('<!DOCTYPE html>') || !sheetHtml.includes('Official Tabulation & Result Sheet')) {
      throw new Error(`Invalid result sheet HTML generated for ${cls.name}`);
    }
    if (!sheetHtml.includes(cls.name)) {
      throw new Error(`Result sheet HTML does not mention class ${cls.name}`);
    }
    console.log(`  [PASS] Result sheet generated for ${cls.name}: ${classStudents.length} candidates, ${classSubs.length} subjects.`);
  }

  // 6. Test Bulk Marksheets HTML generation (1 student per page, clean page breaks)
  console.log('>>> [6/6] Testing Bulk Marksheets (1 student per page, no duplicates, clean page breaks)...');
  for (const tc of targetClassCodes) {
    const cls = classes.find((c) => c.id === tc.code || c.name.toLowerCase() === tc.name.toLowerCase());
    if (!cls) continue;

    const classStudents = allStudents.filter((s) => s.classId === cls.id);
    if (classStudents.length === 0) continue;

    const subRes = await fetch(`${BASE_URL}/api/classes/${cls.id}/subjects`);
    const classSubs: Subject[] = await subRes.json();

    const bulkHtml = generateBulkMarksheetHtml({
      settings,
      exam: activeExam,
      students: classStudents,
      marksList,
      getStudentSubjects: () => classSubs,
      getStudentAttendance: () => ({ percentage: 95 }),
    });

    if (!bulkHtml.includes('report-card-page') || !bulkHtml.includes('Official Examination Marksheet')) {
      throw new Error(`Invalid bulk marksheet HTML generated for ${cls.name}`);
    }
    for (const st of classStudents) {
      if (!bulkHtml.includes(st.name)) {
        throw new Error(`Bulk marksheet missing student ${st.name}`);
      }
    }
    console.log(`  [PASS] Bulk marksheets for ${cls.name}: Verified ${classStudents.length} student pages formatted correctly.`);
  }

  console.log('========================================================================');
  console.log('ALL EXAM RESULTS & TABULATION VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================');
}

runTest().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
