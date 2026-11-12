/**
 * Dedicated Verification Suite for:
 * 1. Academic Structure — Read-Only for TEACHER Role
 * 2. Strict Teacher Assignment Enforcement (No Cross-Class, Cross-Section, or Cross-Subject Leakage)
 * 3. Preservation of Administrative Role Capabilities
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

async function runAcademicStructureTests() {
  console.log('====================================================');
  console.log('ACADEMIC STRUCTURE READ-ONLY & ASSIGNMENT ENFORCEMENT');
  console.log('====================================================\n');

  // 1. Authenticate as Teacher CPS0010
  console.log('--- Step 1: Teacher Authentication ---');
  const teacherLogin = await api('/auth/login', {
    method: 'POST',
    body: {
      identifier: 'CPS0010',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    },
  });

  assert(teacherLogin.status === 200 && teacherLogin.data?.token, 'Teacher Login CPS0010');
  const teacherToken = teacherLogin.data?.token;
  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };

  // 2. Authenticate as Admin for comparison
  console.log('\n--- Step 2: Administrator Authentication ---');
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: {
      identifier: 'admin',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    },
  });
  assert(adminLogin.status === 200 && adminLogin.data?.token, 'Admin Login');
  const adminToken = adminLogin.data?.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 3. Test Teacher Modification Block (HTTP 403 Forbidden for TEACHER role on all modification endpoints)
  console.log('\n--- Step 3: Teacher Forbidden from Academic Modifications (Backend API Enforcement) ---');

  // Class create
  const createClassRes = await api('/classes', {
    method: 'POST',
    headers: teacherHeaders,
    body: { name: 'Class Malicious', numericOrder: 99 },
  });
  assert(createClassRes.status === 403, 'Teacher cannot CREATE class (HTTP 403)', `Status: ${createClassRes.status}`);

  // Class edit / toggle status
  const editClassRes = await api('/classes/c-2', {
    method: 'PUT',
    headers: teacherHeaders,
    body: { status: 'INACTIVE' },
  });
  assert(editClassRes.status === 403, 'Teacher cannot EDIT / ACTIVATE / DEACTIVATE class (HTTP 403)', `Status: ${editClassRes.status}`);

  // Class delete
  const deleteClassRes = await api('/classes/c-2', {
    method: 'DELETE',
    headers: teacherHeaders,
  });
  assert(deleteClassRes.status === 403, 'Teacher cannot DELETE class (HTTP 403)', `Status: ${deleteClassRes.status}`);

  // Section create
  const createSecRes = await api('/classes/c-2/sections', {
    method: 'POST',
    headers: teacherHeaders,
    body: { name: 'Z', maxCapacity: 50 },
  });
  assert(createSecRes.status === 403, 'Teacher cannot CREATE section (HTTP 403)', `Status: ${createSecRes.status}`);

  // Section edit
  const editSecRes = await api('/classes/c-2/sections/sec-b', {
    method: 'PUT',
    headers: teacherHeaders,
    body: { maxCapacity: 100 },
  });
  assert(editSecRes.status === 403, 'Teacher cannot EDIT section (HTTP 403)', `Status: ${editSecRes.status}`);

  // Section delete
  const deleteSecRes = await api('/classes/c-2/sections/sec-b', {
    method: 'DELETE',
    headers: teacherHeaders,
  });
  assert(deleteSecRes.status === 403, 'Teacher cannot DELETE section (HTTP 403)', `Status: ${deleteSecRes.status}`);

  // Subject create
  const createSubRes = await api('/subjects', {
    method: 'POST',
    headers: teacherHeaders,
    body: { code: 'HACK-101', name: 'Unauthorized Subject' },
  });
  assert(createSubRes.status === 403, 'Teacher cannot CREATE subject (HTTP 403)', `Status: ${createSubRes.status}`);

  // Subject edit
  const editSubRes = await api('/subjects/s-math', {
    method: 'PUT',
    headers: teacherHeaders,
    body: { name: 'Compromised Math' },
  });
  assert(editSubRes.status === 403, 'Teacher cannot EDIT subject (HTTP 403)', `Status: ${editSubRes.status}`);

  // Subject delete
  const deleteSubRes = await api('/subjects/s-math', {
    method: 'DELETE',
    headers: teacherHeaders,
  });
  assert(deleteSubRes.status === 403, 'Teacher cannot DELETE subject (HTTP 403)', `Status: ${deleteSubRes.status}`);

  // Subject remove-class
  const removeClassSubRes = await api('/subjects/s-math/remove-class', {
    method: 'POST',
    headers: teacherHeaders,
    body: { classId: 'c-2' },
  });
  assert(removeClassSubRes.status === 403, 'Teacher cannot REMOVE CLASS from subject (HTTP 403)', `Status: ${removeClassSubRes.status}`);

  // Academic sessions create
  const createSesRes = await api('/academic-sessions', {
    method: 'POST',
    headers: teacherHeaders,
    body: { name: '2099-2100', startDate: '2099-04-01', endDate: '2100-03-31' },
  });
  assert(createSesRes.status === 403, 'Teacher cannot CREATE academic session (HTTP 403)', `Status: ${createSesRes.status}`);

  // Academic sessions activate
  const activateSesRes = await api('/academic-sessions/ses-1/activate', {
    method: 'POST',
    headers: teacherHeaders,
  });
  assert(activateSesRes.status === 403, 'Teacher cannot ACTIVATE academic session (HTTP 403)', `Status: ${activateSesRes.status}`);

  // Academic sessions delete
  const deleteSesRes = await api('/academic-sessions/ses-1', {
    method: 'DELETE',
    headers: teacherHeaders,
  });
  assert(deleteSesRes.status === 403, 'Teacher cannot DELETE academic session (HTTP 403)', `Status: ${deleteSesRes.status}`);

  // Settings / Grading scale update
  const updateSettingsRes = await api('/settings', {
    method: 'PUT',
    headers: teacherHeaders,
    body: { gradingSystem: [] },
  });
  assert(updateSettingsRes.status === 403, 'Teacher cannot MODIFY settings or grading scale (HTTP 403)', `Status: ${updateSettingsRes.status}`);

  // 4. Test Teacher Read Operations & Assignment Scoping
  console.log('\n--- Step 4: Teacher Assignment Scoping & Unauthorized Read Prevention ---');

  // Teacher GET /api/classes (must return ONLY assigned classes)
  const teacherClassesRes = await api('/classes', { headers: teacherHeaders });
  assert(teacherClassesRes.status === 200, 'Teacher GET /api/classes returns 200');
  const teacherClasses = teacherClassesRes.data || [];
  const teacherClassNames = teacherClasses.map((c: any) => c.name);
  console.log(`Teacher visible classes: ${teacherClassNames.join(', ')}`);
  
  // Unassigned classes (e.g. Class 12, Class 11, Class 10) must NOT be present
  const unassignedIncluded = teacherClassNames.some((name: string) =>
    ['Class 12', 'Class 11', 'Class 10', 'Class 9', 'Class 8'].includes(name)
  );
  assert(!unassignedIncluded, 'Unassigned classes are excluded from Teacher class list');

  // Section scoping within assigned class
  const class2Obj = teacherClasses.find((c: any) => c.name === 'Class 2' || c.id === 'c-2');
  if (class2Obj) {
    const visibleSecs = class2Obj.sections || [];
    assert(visibleSecs.includes('B'), 'Assigned section B is included for Class 2');
    console.log(`Class 2 visible sections for teacher: ${visibleSecs.join(', ')}`);
  }

  // Teacher direct GET /api/classes/:id for assigned class -> 200 OK
  const assignedClassId = class2Obj?.id || 'c-2';
  const directAssignedClassRes = await api(`/classes/${assignedClassId}`, { headers: teacherHeaders });
  assert(directAssignedClassRes.status === 200, 'Direct GET /api/classes/:id for assigned class succeeds (200 OK)');

  // Identify an actual unassigned class (e.g. Class 8 / c-8)
  const unassignedClassId = 'c-8';

  // Teacher direct GET /api/classes/:id for UNASSIGNED class (e.g. Class 8 / c-8) -> HTTP 403 Forbidden!
  const directUnassignedClassRes = await api(`/classes/${unassignedClassId}`, { headers: teacherHeaders });
  assert(
    directUnassignedClassRes.status === 403,
    'Direct GET /api/classes/:id for UNASSIGNED class returns 403 Forbidden',
    `Status: ${directUnassignedClassRes.status} (URL tampering prevention)`
  );

  // Teacher GET /api/classes/:id/sections for UNASSIGNED class -> 403 Forbidden
  const unassignedSecsRes = await api(`/classes/${unassignedClassId}/sections`, { headers: teacherHeaders });
  assert(unassignedSecsRes.status === 403, 'GET /api/classes/:id/sections for unassigned class returns 403 Forbidden');

  // Teacher GET /api/classes/:id/subjects for UNASSIGNED class -> 403 Forbidden
  const unassignedSubjectsRes = await api(`/classes/${unassignedClassId}/subjects`, { headers: teacherHeaders });
  assert(unassignedSubjectsRes.status === 403, 'GET /api/classes/:id/subjects for unassigned class returns 403 Forbidden');

  // Teacher GET /api/subjects (must return only authorized subjects)
  const teacherSubjectsRes = await api('/subjects', { headers: teacherHeaders });
  assert(teacherSubjectsRes.status === 200, 'Teacher GET /api/subjects returns 200');
  const teacherSubjects = teacherSubjectsRes.data || [];
  console.log(`Teacher visible subjects count: ${teacherSubjects.length} (${teacherSubjects.map((s: any) => s.name).join(', ')})`);

  // Admin GET /api/subjects (must return ALL subjects)
  const adminSubjectsRes = await api('/subjects', { headers: adminHeaders });
  assert(adminSubjectsRes.status === 200, 'Admin GET /api/subjects returns 200');
  const adminSubjects = adminSubjectsRes.data || [];
  console.log(`Admin visible subjects count: ${adminSubjects.length}`);
  assert(adminSubjects.length >= teacherSubjects.length, 'Admin sees full subject curriculum');

  // Teacher single subject authorized vs unauthorized access
  const authorizedSubject = teacherSubjects[0];
  const unassignedSubject = adminSubjects.find((as: any) => !teacherSubjects.some((ts: any) => ts.id === as.id));

  if (authorizedSubject) {
    const authSubRes = await api(`/subjects/${authorizedSubject.id}`, { headers: teacherHeaders });
    assert(authSubRes.status === 200, 'GET /api/subjects/:id for authorized subject succeeds (200 OK)', authorizedSubject.name);
  }

  if (unassignedSubject) {
    const unauthSubRes = await api(`/subjects/${unassignedSubject.id}`, { headers: teacherHeaders });
    assert(unauthSubRes.status === 403, 'GET /api/subjects/:id for UNASSIGNED subject returns 403 Forbidden', unassignedSubject.name);
  }

  // 5. Verify Administrative Access Preserved
  console.log('\n--- Step 5: Administrative Permissions Preserved ---');
  const adminClassesRes = await api('/classes', { headers: adminHeaders });
  assert(adminClassesRes.status === 200, 'Admin can view all classes (200 OK)', `Total classes: ${adminClassesRes.data?.length}`);
  assert(adminClassesRes.data?.length > teacherClasses.length, 'Admin sees all school classes, unconstrained by teaching assignment');

  const adminSessionsRes = await api('/academic-sessions', { headers: adminHeaders });
  assert(adminSessionsRes.status === 200, 'Admin can view academic sessions (200 OK)', `Sessions: ${adminSessionsRes.data?.length}`);

  console.log('\n====================================================');
  console.log('ACADEMIC STRUCTURE PERMISSION TEST RESULTS');
  console.log('====================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAcademicStructureTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
