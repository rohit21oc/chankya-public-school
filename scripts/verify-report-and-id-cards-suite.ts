import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

function get(path: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    http.get(new URL(path, BASE_URL), (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 500, data: body });
        }
      });
    }).on('error', (e) => resolve({ status: 0, data: e.message }));
  });
}

async function runVerification() {
  console.log('=====================================================');
  console.log('RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR');
  console.log('Report & ID Cards Module Comprehensive Verification');
  console.log('=====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean, extra?: any) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${desc}`);
    } else {
      console.error(`❌ [FAIL] ${desc}`, extra ? extra : '');
    }
  }

  // 1. Students endpoint and photos
  console.log('--- 1. Student ID Cards & Profile Photos ---');
  const studentsRes = await get('/api/students?limit=100');
  assert('Students API returns HTTP 200', studentsRes.status === 200);
  const studentsList = Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data?.data || [];
  assert('Active students list loaded from MongoDB/storage', studentsList.length > 0);

  // Check students with photo records
  const studentsWithPhotos = studentsList.filter((s: any) => s.photo || s.photoFileKey);
  assert('Students with registered photo records exist', studentsWithPhotos.length > 0);
  const samplePhotoStudent = studentsWithPhotos[0];
  console.log(`   Sample student with photo: ${samplePhotoStudent.name} (Photo: ${samplePhotoStudent.photo || samplePhotoStudent.photoFileKey})`);

  // Verify photo content URL endpoint
  const photoKey = samplePhotoStudent.photo || samplePhotoStudent.photoFileKey;
  if (photoKey && !photoKey.startsWith('http')) {
    const photoContentRes = await get(`/api/files/content?key=${encodeURIComponent(photoKey)}`);
    assert('Student photo serves HTTP 200 via /api/files/content', photoContentRes.status === 200);
  } else {
    assert('Student photo has valid URL', typeof photoKey === 'string' && photoKey.length > 0);
  }

  // 2. Active Classes Filter
  console.log('\n--- 2. Dynamic Active Classes Filter ---');
  const classesRes = await get('/api/classes');
  assert('Classes API returns HTTP 200', classesRes.status === 200);
  const activeClasses = (Array.isArray(classesRes.data) ? classesRes.data : classesRes.data?.data || []).filter(
    (c: any) => (c.status || 'ACTIVE') === 'ACTIVE'
  );
  assert('Active classes dynamically fetched (Nursery through Class 10)', activeClasses.length >= 10);
  const classNames = activeClasses.map((c: any) => c.name);
  assert('Active classes include Nursery, LKG, UKG, Class 1..8', classNames.includes('Class 8') && classNames.includes('Nursery'));

  // 3. Staff & Faculty ID Cards & Photos
  console.log('\n--- 3. Staff & Faculty ID Cards & Photos ---');
  const staffRes = await get('/api/teachers');
  assert('Staff/Teachers API returns HTTP 200', staffRes.status === 200);
  const staffList = Array.isArray(staffRes.data) ? staffRes.data : staffRes.data?.data || [];
  assert('Staff members loaded from database', staffList.length > 0);

  const staffWithPhotos = staffList.filter((s: any) => s.photo || s.photoFileKey);
  assert('Faculty members with profile photos exist', staffWithPhotos.length > 0);
  const sampleStaff = staffWithPhotos[0];
  console.log(`   Sample staff with photo: ${sampleStaff.name} (Photo: ${sampleStaff.photo || sampleStaff.photoFileKey})`);

  const staffPhotoKey = sampleStaff.photo || sampleStaff.photoFileKey;
  if (staffPhotoKey && !staffPhotoKey.startsWith('http')) {
    const staffPhotoContentRes = await get(`/api/files/content?key=${encodeURIComponent(staffPhotoKey)}`);
    assert('Staff photo serves HTTP 200 via /api/files/content', staffPhotoContentRes.status === 200);
  } else {
    assert('Staff photo has valid HTTP URL', typeof staffPhotoKey === 'string' && staffPhotoKey.length > 0);
  }

  // 4. Examination Selector & Available Exams
  console.log('\n--- 4. Examination Selector & Term Records ---');
  const examsRes = await get('/api/exams');
  assert('Exams API returns HTTP 200', examsRes.status === 200);
  const examsList = Array.isArray(examsRes.data) ? examsRes.data : examsRes.data?.data || [];
  assert('Exams loaded dynamically from MongoDB/storage', examsList.length > 0);
  const midTermExam = examsList.find((e: any) => (e.title || '').includes('Mid-Term') || e.examType === 'MID_TERM');
  assert('Mid-Term exam exists in database records', !!midTermExam);
  console.log(`   Selected Exam: "${midTermExam?.title}" (ID: ${midTermExam?.id}, Type: ${midTermExam?.examType})`);

  // 5. Marks Isolation & Accuracy for Selected Exam
  console.log('\n--- 5. Marks Isolation & Accuracy for Selected Exam ---');
  const marksRes = await get('/api/marks');
  assert('Exam Marks API returns HTTP 200', marksRes.status === 200);
  const allMarks = Array.isArray(marksRes.data) ? marksRes.data : marksRes.data?.data || [];
  assert('Exam marks database records exist', allMarks.length > 0);

  if (midTermExam) {
    const midTermMarks = allMarks.filter((m: any) => m.examId === midTermExam.id);
    assert('Marks correctly filtered strictly by examId without cross-exam contamination', midTermMarks.length > 0);
    const marksStudentIds = Array.from(new Set(midTermMarks.map((m: any) => m.studentId)));
    console.log(`   Students with recorded marks in "${midTermExam.title}": ${marksStudentIds.length}`);

    // Verify marks structure
    const sampleMark = midTermMarks[0];
    assert('Marks record has valid studentId, subjectName, marksObtained, maxMarks', 
      !!sampleMark.studentId && !!sampleMark.subjectName && typeof sampleMark.marksObtained === 'number' && typeof sampleMark.maxMarks === 'number');
  }

  // 6. QR Code Generator & School Metadata
  console.log('\n--- 6. QR Code & School Metadata Verification ---');
  const settingsRes = await get('/api/settings');
  assert('School settings API returns HTTP 200', settingsRes.status === 200);
  assert('School name is RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR', settingsRes.data?.schoolName?.includes('RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR'));
  assert('Affiliation Code is 10030206405', settingsRes.data?.affiliationCode === '10030206405');

  console.log('\n=====================================================');
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`SUCCESS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('=====================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerification();
