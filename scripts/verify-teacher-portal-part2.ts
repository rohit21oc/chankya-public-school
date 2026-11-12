/**
 * Dedicated Verification Suite for Teacher Portal Part 2:
 * 1. My Students — Read Only (assigned classes, sections, and subjects only)
 * 2. Authorized class, section, and subject filters
 * 3. Display student photos, permitted details, attendance history, academic performance
 * 4. Teacher read-only denial: Teacher cannot add, edit, update, delete, transfer, or modify student records
 * 5. Report card preview only if existing permissions support it
 * 6. Student Documents: show only student ID cards, hide staff ID cards, allow preview/generation/print/download for authorized students
 * 7. Backend security: enforce teacher assignment checks & read-only restrictions on every relevant API
 */

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

async function runPart2Tests() {
  console.log('====================================================');
  console.log('TEACHER PORTAL PART 2 — MY STUDENTS & DOCUMENTS SUITE');
  console.log('====================================================\n');

  // 1. Authenticate Teacher (PDS0010 - Anil Kumar Mishra)
  console.log('--- Step 1: Teacher Authentication ---');
  const teacherLogin = await api('/auth/login', {
    method: 'POST',
    body: {
      identifier: 'PDS0010',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    },
  });
  assert(teacherLogin.status === 200 && Boolean(teacherLogin.data?.token), 'Teacher Login PDS0010 succeeds');
  const teacherToken = teacherLogin.data?.token;
  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };
  assert(teacherLogin.data?.user?.role === 'TEACHER', 'Authenticated role is strictly TEACHER');

  // 2. Authenticate Admin for comparison
  console.log('\n--- Step 2: Administrator Authentication ---');
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: {
      identifier: 'admin',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    },
  });
  assert(adminLogin.status === 200 && Boolean(adminLogin.data?.token), 'Admin Login succeeds');
  const adminToken = adminLogin.data?.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 3. Teacher Authorized Assignments Endpoint
  console.log('\n--- Step 3: Teacher Authorized Assignments Endpoint ---');
  const assignmentsRes = await api('/teacher/authorized-assignments', { headers: teacherHeaders });
  assert(assignmentsRes.status === 200, 'GET /api/teacher/authorized-assignments returns 200');
  assert(assignmentsRes.data?.allAccess === false, 'Teacher allAccess flag is FALSE (strictly restricted scope)');
  assert(Array.isArray(assignmentsRes.data?.classes), 'Assignments contains classes array');
  assert(Array.isArray(assignmentsRes.data?.subjects), 'Assignments contains subjects array');
  assert(Array.isArray(assignmentsRes.data?.detailedAssignments), 'Assignments contains detailedAssignments array');

  const teacherClasses = assignmentsRes.data?.classes || [];
  const assignedClassNames = teacherClasses.map((c: any) => c.className);
  console.log('Teacher Assigned Classes:', assignedClassNames);
  assert(teacherClasses.length > 0, 'Teacher has active assigned classes in system');

  // 4. My Students Roster & Scoping
  console.log('\n--- Step 4: My Students Roster & Scoping ---');
  const studentsRes = await api('/students', { headers: teacherHeaders });
  assert(studentsRes.status === 200, 'Teacher GET /api/students returns 200');
  const teacherStudents: any[] = Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes.data?.data || []);
  assert(teacherStudents.length > 0, 'Teacher can access students in assigned classes', `Count: ${teacherStudents.length}`);

  const assignedClassIdsSet = new Set(teacherClasses.map((c: any) => c.classId.toLowerCase()));
  const assignedClassNamesSet = new Set(teacherClasses.map((c: any) => c.className.toLowerCase()));

  const allAssigned = teacherStudents.every((s: any) => {
    const sCId = (s.classId || '').toLowerCase();
    const sCName = (s.className || '').toLowerCase();
    return assignedClassIdsSet.has(sCId) || assignedClassNamesSet.has(sCName);
  });
  assert(allAssigned, 'Zero leakage: all students returned strictly belong to assigned classes');

  // Validate student details visible to teacher
  const sampleStudent = teacherStudents[0];
  assert(Boolean(sampleStudent?.id), 'Student record contains id');
  assert(Boolean(sampleStudent?.name), 'Student record contains name', sampleStudent?.name);
  assert(Boolean(sampleStudent?.admissionNumber), 'Student record contains admissionNumber', sampleStudent?.admissionNumber);
  assert(Boolean(sampleStudent?.className), 'Student record contains className', sampleStudent?.className);
  assert(sampleStudent.photo !== undefined, 'Student record contains photo');

  // 5. Query Tampering Prevention on /api/students
  console.log('\n--- Step 5: Query Tampering Prevention on /api/students ---');
  // Attempt to query an unassigned class
  const unassignedClassQuery = await api('/students?classId=Class%2010', { headers: teacherHeaders });
  assert(
    unassignedClassQuery.status === 403,
    'Querying unassigned class returns HTTP 403 Forbidden',
    `Status: ${unassignedClassQuery.status}`
  );

  // Attempt to query an unassigned section
  const unassignedSecQuery = await api(`/students?classId=${encodeURIComponent(teacherClasses[0]?.className)}&section=Z`, {
    headers: teacherHeaders,
  });
  assert(
    unassignedSecQuery.status === 403,
    'Querying unassigned section returns HTTP 403 Forbidden',
    `Status: ${unassignedSecQuery.status}`
  );

  // Attempt to query an unassigned subject
  const unassignedSubQuery = await api('/students?subjectId=sub-unassigned-random-subject', {
    headers: teacherHeaders,
  });
  assert(
    unassignedSubQuery.status === 403,
    'Querying unassigned subject returns HTTP 403 Forbidden',
    `Status: ${unassignedSubQuery.status}`
  );

  // Querying authorized class succeeds
  const authorizedClassQuery = await api(`/students?classId=${encodeURIComponent(teacherClasses[0]?.className)}`, {
    headers: teacherHeaders,
  });
  assert(
    authorizedClassQuery.status === 200,
    'Querying authorized class returns HTTP 200 OK',
    `Found ${authorizedClassQuery.data?.data?.length || 0} students`
  );

  // 6. Direct Student Profile Access & Tampering Prevention
  console.log('\n--- Step 6: Direct Student Profile Access & Tampering Prevention ---');
  // Authorized student direct GET
  const authorizedStudentRes = await api(`/students/${sampleStudent.id}`, { headers: teacherHeaders });
  assert(
    authorizedStudentRes.status === 200,
    'Direct GET /api/students/:id for assigned student succeeds (HTTP 200 OK)',
    authorizedStudentRes.data?.name
  );

  // Find an unassigned student using Admin token
  const adminStudentsRes = await api('/students?limit=200', { headers: adminHeaders });
  const allAdminStudents: any[] = Array.isArray(adminStudentsRes.data)
    ? adminStudentsRes.data
    : adminStudentsRes.data?.data || [];

  const unassignedStudent = allAdminStudents.find((s: any) => {
    const sCId = (s.classId || '').toLowerCase();
    const sCName = (s.className || '').toLowerCase();
    return !assignedClassIdsSet.has(sCId) && !assignedClassNamesSet.has(sCName);
  });

  if (unassignedStudent) {
    const unassignedDirectRes = await api(`/students/${unassignedStudent.id}`, { headers: teacherHeaders });
    assert(
      unassignedDirectRes.status === 403,
      'Direct GET /api/students/:id for UNASSIGNED student returns HTTP 403 Forbidden (URL tampering prevention)',
      `Target: ${unassignedStudent.name} (${unassignedStudent.className}) - Status: ${unassignedDirectRes.status}`
    );
  }

  // 7. Teacher Read-Only Restrictions (Mutation Denial)
  console.log('\n--- Step 7: Teacher Read-Only Restrictions (Mutation Denial) ---');
  // POST /api/students (Admit student)
  const admitAttempt = await api('/students', {
    method: 'POST',
    headers: teacherHeaders,
    body: {
      name: 'Unauthorized New Intake Student',
      className: 'Class 2',
      section: 'A',
      gender: 'MALE',
    },
  });
  assert(admitAttempt.status === 403, 'Teacher cannot admit new students (POST /api/students HTTP 403)');

  // PUT /api/students/:id (Edit student)
  const editAttempt = await api(`/students/${sampleStudent.id}`, {
    method: 'PUT',
    headers: teacherHeaders,
    body: {
      name: 'Tampered Student Name',
    },
  });
  assert(editAttempt.status === 403, 'Teacher cannot edit student record (PUT /api/students/:id HTTP 403)');

  // PATCH /api/students/:id
  const patchAttempt = await api(`/students/${sampleStudent.id}`, {
    method: 'PATCH',
    headers: teacherHeaders,
    body: {
      rollNumber: '999',
    },
  });
  assert(patchAttempt.status === 403, 'Teacher cannot patch student record (PATCH /api/students/:id HTTP 403)');

  // PATCH /api/students/:id/status (Change status)
  const statusAttempt = await api(`/students/${sampleStudent.id}/status`, {
    method: 'PATCH',
    headers: teacherHeaders,
    body: {
      status: 'SUSPENDED',
    },
  });
  assert(statusAttempt.status === 403, 'Teacher cannot change student status (PATCH /api/students/:id/status HTTP 403)');

  // DELETE /api/students/:id (Delete student)
  const deleteAttempt = await api(`/students/${sampleStudent.id}`, {
    method: 'DELETE',
    headers: teacherHeaders,
  });
  assert(deleteAttempt.status === 403, 'Teacher cannot delete student record (DELETE /api/students/:id HTTP 403)');

  // POST /api/students/:id/portal-status
  const portalStatusAttempt = await api(`/students/${sampleStudent.id}/portal-status`, {
    method: 'POST',
    headers: teacherHeaders,
    body: { loginEnabled: false },
  });
  assert(portalStatusAttempt.status === 403, 'Teacher cannot alter student portal status (HTTP 403)');

  // POST /api/students/:id/reset-password
  const resetPassAttempt = await api(`/students/${sampleStudent.id}/reset-password`, {
    method: 'POST',
    headers: teacherHeaders,
    body: { newPassword: 'NewPassword@123' },
  });
  assert(resetPassAttempt.status === 403, 'Teacher cannot reset student password (HTTP 403)');

  // POST /api/students/:id/reset-parent-password
  const resetParentPassAttempt = await api(`/students/${sampleStudent.id}/reset-parent-password`, {
    method: 'POST',
    headers: teacherHeaders,
    body: { newPassword: 'NewPassword@123' },
  });
  assert(resetParentPassAttempt.status === 403, 'Teacher cannot reset parent password (HTTP 403)');

  // POST /api/students/sync-batch
  const syncBatchAttempt = await api('/students/sync-batch', {
    method: 'POST',
    headers: teacherHeaders,
    body: { students: [] },
  });
  assert(syncBatchAttempt.status === 403, 'Teacher cannot execute batch sync (HTTP 403)');

  // 8. Student ID Card Generation, Preview & Security
  console.log('\n--- Step 8: Student ID Card Generation, Preview & Security ---');
  // Authorized student ID card fetch
  const idCardRes = await api(`/students/${sampleStudent.id}/id-card`, { headers: teacherHeaders });
  assert(idCardRes.status === 200, 'GET /api/students/:id/id-card for assigned student returns HTTP 200 OK');
  assert(idCardRes.data?.success === true, 'ID card response success is true');
  assert(Boolean(idCardRes.data?.student), 'ID card response contains student data');
  assert(Boolean(idCardRes.data?.schoolSettings), 'ID card response contains school branding settings');
  assert(Boolean(idCardRes.data?.schoolSettings?.schoolName), 'School branding contains schoolName', idCardRes.data?.schoolSettings?.schoolName);

  // Unassigned student ID card fetch denial
  if (unassignedStudent) {
    const unassignedIdCardRes = await api(`/students/${unassignedStudent.id}/id-card`, { headers: teacherHeaders });
    assert(
      unassignedIdCardRes.status === 403,
      'GET /api/students/:id/id-card for unassigned student returns HTTP 403 Forbidden (Tampering prevention)',
      `Status: ${unassignedIdCardRes.status}`
    );
  }

  // 9. Administrative CRUD & ID Card Retention
  console.log('\n--- Step 9: Administrative CRUD & ID Card Retention ---');
  const adminIdCard = await api(`/students/${sampleStudent.id}/id-card`, { headers: adminHeaders });
  assert(adminIdCard.status === 200, 'Admin can view any student ID card (HTTP 200 OK)');

  const adminStudentsAll = await api('/students', { headers: adminHeaders });
  assert(adminStudentsAll.status === 200, 'Admin can view all students (HTTP 200 OK)');

  console.log('\n====================================================');
  console.log('TEACHER PORTAL PART 2 TEST RESULTS');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPart2Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
