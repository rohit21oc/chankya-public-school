import assert from 'assert';

const BASE_URL = 'http://127.0.0.1:3000';
const PROD_FRONTEND_ORIGIN = 'https://residentialpdsschool.in';
const AI_STUDIO_DEV_ORIGIN = 'https://ais-dev-ajiw6cywequ5jq45d3ssxu-783761109390.asia-southeast1.run.app';

async function main() {
  console.log('====================================================');
  console.log('VERIFYING CORS & TIMETABLE BULK PERSISTENCE PIPELINE');
  console.log('====================================================\n');

  // 1. Test OPTIONS Preflight Request from Production Origin
  console.log('Test 1a: OPTIONS Preflight Request from Production Origin');
  const preflightRes = await fetch(`${BASE_URL}/api/timetables/bulk`, {
    method: 'OPTIONS',
    headers: {
      Origin: PROD_FRONTEND_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type, authorization, x-auth-employee-id, x-auth-user-id, x-auth-user-role',
    },
  });

  console.log(`  Preflight HTTP Status: ${preflightRes.status} (expected 204)`);
  assert.strictEqual(preflightRes.status, 204, 'OPTIONS preflight should return 204');

  const allowOrigin = preflightRes.headers.get('access-control-allow-origin');
  console.log(`  Access-Control-Allow-Origin: ${allowOrigin}`);
  assert.strictEqual(allowOrigin, PROD_FRONTEND_ORIGIN, 'Allowed origin must match frontend origin exactly');
  assert.notStrictEqual(allowOrigin, '*', 'Allowed origin must NEVER be wildcard * with credentials');

  const allowCredentials = preflightRes.headers.get('access-control-allow-credentials');
  console.log(`  Access-Control-Allow-Credentials: ${allowCredentials}`);
  assert.strictEqual(allowCredentials, 'true', 'Allow credentials must be true');

  const allowMethods = preflightRes.headers.get('access-control-allow-methods');
  console.log(`  Access-Control-Allow-Methods: ${allowMethods}`);
  assert(allowMethods?.includes('POST'), 'Allowed methods must include POST');
  assert(allowMethods?.includes('OPTIONS'), 'Allowed methods must include OPTIONS');

  const allowHeaders = preflightRes.headers.get('access-control-allow-headers') || '';
  console.log(`  Access-Control-Allow-Headers: ${allowHeaders}`);
  assert(
    allowHeaders.toLowerCase().includes('x-auth-employee-id'),
    'Access-Control-Allow-Headers must explicitly include x-auth-employee-id'
  );
  assert(
    allowHeaders.toLowerCase().includes('content-type'),
    'Access-Control-Allow-Headers must explicitly include content-type'
  );
  assert(
    allowHeaders.toLowerCase().includes('authorization'),
    'Access-Control-Allow-Headers must explicitly include authorization'
  );
  assert(
    allowHeaders.toLowerCase().includes('x-auth-user-id'),
    'Access-Control-Allow-Headers must explicitly include x-auth-user-id'
  );
  assert(
    allowHeaders.toLowerCase().includes('x-auth-user-role'),
    'Access-Control-Allow-Headers must explicitly include x-auth-user-role'
  );
  console.log('  -> PASS: Production preflight correctly allows x-auth-employee-id and all required headers without wildcards.\n');

  // 1b. Test OPTIONS Preflight Request from AI Studio Cloud Run Dev Origin
  console.log('Test 1b: OPTIONS Preflight Request from AI Studio Cloud Run Origin');
  const aiStudioPreflightRes = await fetch(`${BASE_URL}/api/timetables/bulk`, {
    method: 'OPTIONS',
    headers: {
      Origin: AI_STUDIO_DEV_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type, authorization, x-auth-employee-id, x-auth-user-id, x-auth-user-role',
    },
  });

  console.log(`  AI Studio Preflight HTTP Status: ${aiStudioPreflightRes.status} (expected 204)`);
  assert.strictEqual(aiStudioPreflightRes.status, 204, 'AI Studio OPTIONS preflight should return 204');
  const aiStudioAllowOrigin = aiStudioPreflightRes.headers.get('access-control-allow-origin');
  console.log(`  Access-Control-Allow-Origin: ${aiStudioAllowOrigin}`);
  assert.strictEqual(aiStudioAllowOrigin, AI_STUDIO_DEV_ORIGIN, 'Allowed origin must match AI Studio origin exactly');
  assert.strictEqual(aiStudioPreflightRes.headers.get('access-control-allow-credentials'), 'true');
  console.log('  -> PASS: AI Studio origin preflight correctly allowed.\n');

  // 2. Test Unauthorized POST Request (Protection Verification)
  console.log('Test 2: Unauthorized POST Request without Auth Headers');
  const unauthRes = await fetch(`${BASE_URL}/api/timetables/bulk`, {
    method: 'POST',
    headers: {
      Origin: PROD_FRONTEND_ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      classId: 'c-10',
      section: 'A',
      slots: [],
    }),
  });

  console.log(`  Unauthenticated POST Status: ${unauthRes.status} (expected 401)`);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be rejected with 401');
  const unauthAllowOrigin = unauthRes.headers.get('access-control-allow-origin');
  assert.strictEqual(unauthAllowOrigin, PROD_FRONTEND_ORIGIN, 'CORS headers must be preserved on 401');
  console.log('  -> PASS: Unauthorized POST is securely rejected with 401 and CORS intact.\n');

  // 3. Test Student Role Forbidden POST Request
  console.log('Test 3: Forbidden POST Request with Student Role');
  const forbiddenRes = await fetch(`${BASE_URL}/api/timetables/bulk`, {
    method: 'POST',
    headers: {
      Origin: PROD_FRONTEND_ORIGIN,
      'Content-Type': 'application/json',
      'x-auth-user-id': 'std-test-1',
      'x-auth-user-role': 'STUDENT',
    },
    body: JSON.stringify({
      classId: 'c-10',
      section: 'A',
      slots: [],
    }),
  });

  console.log(`  Student POST Status: ${forbiddenRes.status} (expected 403)`);
  assert.strictEqual(forbiddenRes.status, 403, 'Student request must be rejected with 403 Forbidden');
  console.log('  -> PASS: Non-staff role is rejected with 403 Forbidden.\n');

  // 4. Test Authenticated POST from AI Studio Origin with x-auth-employee-id
  console.log('Test 4: Authenticated POST from AI Studio Origin with x-auth-employee-id');
  const testSlots = [
    {
      id: `tt-test-${Date.now()}-1`,
      dayOfWeek: 'Monday',
      periodNumber: 1,
      startTime: '08:00 AM',
      endTime: '08:45 AM',
      subjectId: 's-1',
      subjectName: 'Mathematics',
      teacherId: 't-1790251665650',
      teacherName: 'Rohit Kumar',
      roomNumber: 'Room 201',
    },
    {
      id: `tt-test-${Date.now()}-2`,
      dayOfWeek: 'Monday',
      periodNumber: 2,
      startTime: '08:45 AM',
      endTime: '09:30 AM',
      subjectId: 's-2',
      subjectName: 'Science',
      teacherId: 't-1790251665650',
      teacherName: 'Rohit Kumar',
      roomNumber: 'Room 201',
    },
  ];

  const aiStudioSaveRes = await fetch(`${BASE_URL}/api/timetables/bulk`, {
    method: 'POST',
    headers: {
      Origin: AI_STUDIO_DEV_ORIGIN,
      'Content-Type': 'application/json',
      'x-auth-user-id': 'admin-1',
      'x-auth-user-role': 'SUPER_ADMIN',
      'x-auth-employee-id': 'PDS0001',
    },
    body: JSON.stringify({
      classId: 'c-10',
      section: 'A',
      session: '2026-2027',
      slots: testSlots,
    }),
  });

  console.log(`  AI Studio Save HTTP Status: ${aiStudioSaveRes.status} (expected 200)`);
  assert.strictEqual(aiStudioSaveRes.status, 200, 'AI Studio save should return 200');
  const aiStudioSavedAllowOrigin = aiStudioSaveRes.headers.get('access-control-allow-origin');
  console.log(`  Response Access-Control-Allow-Origin: ${aiStudioSavedAllowOrigin}`);
  assert.strictEqual(aiStudioSavedAllowOrigin, AI_STUDIO_DEV_ORIGIN, 'CORS origin must match AI Studio dev origin');
  assert.strictEqual(aiStudioSaveRes.headers.get('access-control-allow-credentials'), 'true');

  const saveJson = await aiStudioSaveRes.json();
  console.log(`  Save response: success=${saveJson.success}, count=${saveJson.count}`);
  assert.strictEqual(saveJson.success, true, 'Response must have success: true');
  assert(Array.isArray(saveJson.slots), 'Response must include saved slots array');
  console.log('  -> PASS: Bulk save from AI Studio origin succeeded with 200 and correct CORS headers.\n');

  // 5. Verify Timetable was saved and can be retrieved
  console.log('Test 5: Verify Saved Timetable via GET /api/timetables');
  const getRes = await fetch(`${BASE_URL}/api/timetables?classId=c-10&section=A&academicSession=2026-2027`);
  assert.strictEqual(getRes.status, 200);
  const slotsFromDb = await getRes.json();
  console.log(`  Retrieved ${slotsFromDb.length} slots for Class c-10 (A)`);
  const mathSlot = slotsFromDb.find((s: any) => s.subjectName === 'Mathematics' && s.dayOfWeek === 'Monday');
  assert(Boolean(mathSlot), 'Mathematics slot must be present in retrieved timetable');
  console.log('  -> PASS: Timetable verified in database storage.\n');

  // 6. Verify Conflict Detection on /api/timetables/bulk
  console.log('Test 6: Verify Conflict Detection (Intra-Class Clash)');
  const conflictSlots = [
    {
      dayOfWeek: 'Monday',
      periodNumber: 1,
      subjectName: 'Mathematics',
      subjectId: 's-1',
    },
    {
      dayOfWeek: 'Monday',
      periodNumber: 1,
      subjectName: 'English',
      subjectId: 's-3',
    },
  ];
  const conflictRes = await fetch(`${BASE_URL}/api/timetables/bulk`, {
    method: 'POST',
    headers: {
      Origin: AI_STUDIO_DEV_ORIGIN,
      'Content-Type': 'application/json',
      'x-auth-user-id': 'admin-1',
      'x-auth-user-role': 'SUPER_ADMIN',
      'x-auth-employee-id': 'PDS0001',
    },
    body: JSON.stringify({
      classId: 'c-10',
      section: 'A',
      session: '2026-2027',
      slots: conflictSlots,
    }),
  });
  console.log(`  Conflict response status: ${conflictRes.status} (expected 409)`);
  assert.strictEqual(conflictRes.status, 409, 'Conflict must return 409');
  const conflictJson = await conflictRes.json();
  console.log(`  Conflict error code: ${conflictJson.error}`);
  assert.strictEqual(conflictJson.error, 'INTRA_CLASS_CONFLICT');
  assert.strictEqual(conflictRes.headers.get('access-control-allow-origin'), AI_STUDIO_DEV_ORIGIN);
  console.log('  -> PASS: Intra-class clash detected with CORS preserved.\n');

  console.log('====================================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
