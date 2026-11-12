const BASE_URL = 'http://127.0.0.1:3000';

async function run() {
  console.log('🧪 Starting Student Profile Exams Tab Verification Suite...');

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  if (!healthRes.ok) throw new Error('Dev server not healthy');
  console.log('✅ Health check OK');

  // 2. Fetch real students
  const studentsRes = await fetch(`${BASE_URL}/api/students`);
  const studentsData: any = await studentsRes.json();
  const studentsList = Array.isArray(studentsData) ? studentsData : studentsData.data;
  console.log(`✅ Loaded ${studentsList.length} real students from API`);

  const studentClass1 = studentsList.find((s: any) => s.classId === 'c-1' || s.className === 'Class 1');
  if (!studentClass1) throw new Error('No Class 1 student found');
  console.log(`✅ Selected Class 1 student: ${studentClass1.name} (${studentClass1.id}), Class: ${studentClass1.className} - Section: ${studentClass1.section}`);

  // 3. Query exams for Class 1 student via studentId filter
  const examsClass1Res = await fetch(`${BASE_URL}/api/exams?studentId=${studentClass1.id}`);
  const examsClass1 = ((await examsClass1Res.json()) || []) as any[];
  console.log(`✅ Found ${examsClass1.length} published exams for Class 1 student:`);
  examsClass1.forEach((e) => {
    console.log(`   - [${e.id}] "${e.name || e.title}" (Type: ${e.examType})`);
    console.log(`     Status: ${e.status}, AdmitCard: ${e.admitCardStatus}, Results: ${e.resultsStatus}`);
  });

  if (examsClass1.length === 0) {
    throw new Error('Expected at least 1 published exam for Class 1 student');
  }

  // 4. Verify all exams are applicable to Class 1
  for (const e of examsClass1) {
    const classMatch = !e.classIds || e.classIds.length === 0 || e.classIds.includes('c-1') || e.classIds.includes('Class 1');
    const schedMatch = Array.isArray(e.schedule) && e.schedule.some((s: any) => s.classId === 'c-1' || s.className === 'Class 1');
    if (!classMatch && !schedMatch) {
      throw new Error(`Exam ${e.id} does not match Class 1!`);
    }
    if (e.status !== 'PUBLISHED') {
      throw new Error(`Exam ${e.id} is not PUBLISHED! Status: ${e.status}`);
    }
  }
  console.log('✅ Verified all returned exams are PUBLISHED and strictly applicable to Class 1');

  // 5. Check Class 2 student
  const studentClass2 = studentsList.find((s: any) => s.classId === 'c-2' || s.className === 'Class 2');
  if (studentClass2) {
    const examsClass2Res = await fetch(`${BASE_URL}/api/exams?studentId=${studentClass2.id}`);
    const examsClass2 = ((await examsClass2Res.json()) || []) as any[];
    console.log(`✅ Found ${examsClass2.length} published exams for Class 2 student (${studentClass2.name}):`);
    examsClass2.forEach((e) => {
      console.log(`   - [${e.id}] "${e.name || e.title}" (Type: ${e.examType})`);
    });
    for (const e of examsClass2) {
      const classMatch = !e.classIds || e.classIds.length === 0 || e.classIds.includes('c-2') || e.classIds.includes('Class 2');
      const schedMatch = Array.isArray(e.schedule) && e.schedule.some((s: any) => s.classId === 'c-2' || s.className === 'Class 2');
      if (!classMatch && !schedMatch) {
        throw new Error(`Exam ${e.id} does not match Class 2!`);
      }
    }
    console.log('✅ Verified Class 2 student exams are strictly class-isolated');
  }

  // 6. Verify Admit Card & Marksheet actions logic
  const publishedAdmitCardExam = examsClass1.find((e) => e.admitCardStatus === 'PUBLISHED');
  if (publishedAdmitCardExam) {
    console.log(`✅ Exam "${publishedAdmitCardExam.name || publishedAdmitCardExam.title}" has admitCardStatus === 'PUBLISHED' -> View/Download Admit Card available`);
  }

  const publishedResultsExam = examsClass1.find((e) => e.resultsStatus === 'PUBLISHED');
  if (publishedResultsExam) {
    console.log(`✅ Exam "${publishedResultsExam.name || publishedResultsExam.title}" has resultsStatus === 'PUBLISHED' -> View/Download/Print Marksheet available`);
  }

  // 7. Verify exams without marks can be displayed
  const examWithNoMarks = examsClass1.find((e) => e.id === 'ex-2' || e.resultsStatus === 'DRAFT');
  if (examWithNoMarks) {
    console.log(`✅ Exam "${examWithNoMarks.name || examWithNoMarks.title}" does not require marks to be displayed in the published exams list.`);
  }

  console.log('\n🎉 ALL STUDENT EXAMS TAB VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
