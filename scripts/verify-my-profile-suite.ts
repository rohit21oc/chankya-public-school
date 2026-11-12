import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3000';

async function runTestSuite() {
  console.log('========================================================');
  console.log('RUNNING COMPLETE "MY PROFILE" VERIFICATION TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      process.exitCode = 1;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Real SUPER_ADMIN Account Login & Profile
  // ----------------------------------------------------
  console.log('\n--- 1. Testing Real SUPER_ADMIN Account (admin) ---');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin123', loginType: 'STAFF_ADMIN' }),
  });
  const adminLoginData: any = await adminLoginRes.json();
  assert(adminLoginRes.status === 200 && adminLoginData.success, 'SUPER_ADMIN login succeeded (HTTP 200)');
  assert(!!adminLoginData.token, 'SUPER_ADMIN received valid JWT session token');

  const adminProfileRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${adminLoginData.token}` },
  });
  const adminProfileData: any = await adminProfileRes.json();
  assert(adminProfileRes.status === 200 && adminProfileData.success, 'GET /api/auth/profile for SUPER_ADMIN succeeded');
  assert(adminProfileData.role === 'SUPER_ADMIN', 'Profile role correctly reflects SUPER_ADMIN');
  assert(!!adminProfileData.profile.name, `SUPER_ADMIN profile has real name: "${adminProfileData.profile.name}"`);
  assert(adminProfileData.profile.status === 'ACTIVE', 'SUPER_ADMIN account status is ACTIVE');

  // ----------------------------------------------------
  // TEST 2: SUPER_ADMIN Edit Details Saves Correctly
  // ----------------------------------------------------
  console.log('\n--- 2. Testing SUPER_ADMIN Profile Edit ---');
  const testAddress = `BRC Campus Block ${Date.now().toString().slice(-4)}, Sheohar, Bihar - 843329`;
  const adminUpdateRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLoginData.token}`,
    },
    body: JSON.stringify({
      address: testAddress,
      city: 'Sheohar',
      state: 'Bihar',
      pincode: '843329',
    }),
  });
  const adminUpdateData: any = await adminUpdateRes.json();
  assert(adminUpdateRes.status === 200 && adminUpdateData.success, 'SUPER_ADMIN PUT /api/auth/profile succeeded');

  // Verify updated data persisted
  const adminProfileRecheck = await fetch(`${BASE_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${adminLoginData.token}` },
  });
  const adminRecheckData: any = await adminProfileRecheck.json();
  assert(
    adminRecheckData.profile.address === testAddress || adminRecheckData.profile.permanentAddress === testAddress,
    'SUPER_ADMIN updated address persisted dynamically in database'
  );

  // ----------------------------------------------------
  // TEST 3: Real Teacher Account Login & Dynamic Profile
  // ----------------------------------------------------
  console.log('\n--- 3. Testing Real Teacher Account (PDS0011 / Sunita Verma) ---');
  const teacherLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'PDS0011', password: 'PdsTeacher@123', loginType: 'STAFF_ADMIN' }),
  });
  const teacherLoginData: any = await teacherLoginRes.json();
  assert(teacherLoginRes.status === 200 && teacherLoginData.success, 'Teacher login succeeded (HTTP 200)');
  assert(!!teacherLoginData.token, 'Teacher received valid session token');

  const teacherProfileRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${teacherLoginData.token}` },
  });
  const teacherProfileData: any = await teacherProfileRes.json();
  assert(teacherProfileRes.status === 200 && teacherProfileData.success, 'GET /api/auth/profile for Teacher succeeded');
  assert(teacherProfileData.profile.employeeId === 'PDS0011', 'Teacher employee ID matches PDS0011 dynamically');
  assert(teacherProfileData.profile.name === 'Sunita Verma', 'Teacher name matches "Sunita Verma" from MongoDB');
  assert(
    Array.isArray(teacherProfileData.profile.documents),
    `Teacher profile contains dynamic documents array (Count: ${teacherProfileData.profile.documents?.length || 0})`
  );
  assert(
    teacherProfileData.profile.department === 'Science' || teacherProfileData.profile.department === 'ACADEMICS',
    `Teacher department correctly loaded: ${teacherProfileData.profile.department}`
  );

  // ----------------------------------------------------
  // TEST 4: Teacher Edit Details & Security Restriction Check
  // ----------------------------------------------------
  console.log('\n--- 4. Testing Teacher Edit Details & Role Tamper Protection ---');
  const testContact = '9811223399';
  const teacherUpdateRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherLoginData.token}`,
    },
    body: JSON.stringify({
      emergencyContact: testContact,
      alternatePhone: '9876543210',
      bloodGroup: 'O+',
      // Attempting to escalate role or employeeId must be blocked/ignored
      role: 'SUPER_ADMIN',
      systemRole: 'SUPER_ADMIN',
      employeeId: 'HACKED999',
    }),
  });
  const teacherUpdateData: any = await teacherUpdateRes.json();
  assert(teacherUpdateRes.status === 200 && teacherUpdateData.success, 'Teacher PUT /api/auth/profile succeeded for permitted fields');

  // Verify permitted fields updated, but protected fields (role, employeeId) were untouched
  const teacherRecheckRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${teacherLoginData.token}` },
  });
  const teacherRecheckData: any = await teacherRecheckRes.json();
  assert(teacherRecheckData.profile.emergencyContact === testContact, 'Permitted emergencyContact updated in MongoDB');
  assert(teacherRecheckData.profile.bloodGroup === 'O+', 'Permitted bloodGroup updated in MongoDB');
  assert(teacherRecheckData.profile.employeeId === 'PDS0011', 'PROTECTED employeeId was NOT changed');
  assert(teacherRecheckData.profile.systemRole === 'TEACHER' || teacherRecheckData.role === 'TEACHER', 'PROTECTED role was NOT escalated');

  // ----------------------------------------------------
  // TEST 5: Change Password API & Immediate Verification
  // ----------------------------------------------------
  console.log('\n--- 5. Testing Change Password Flow ---');
  const newSecret = 'NewTeacherSecret@2026';
  const changePassRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherLoginData.token}`,
    },
    body: JSON.stringify({
      currentPassword: 'PdsTeacher@123',
      newPassword: newSecret,
    }),
  });
  const changePassData: any = await changePassRes.json();
  assert(changePassRes.status === 200 && changePassData.success, 'POST /api/auth/change-password succeeded (HTTP 200)');

  // Old password MUST fail immediately
  const oldLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'PDS0011', password: 'PdsTeacher@123', loginType: 'STAFF_ADMIN' }),
  });
  assert(oldLoginRes.status === 401, 'Old password FAILS immediately after change (HTTP 401)');

  // New password MUST work immediately
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'PDS0011', password: newSecret, loginType: 'STAFF_ADMIN' }),
  });
  const newLoginData: any = await newLoginRes.json();
  assert(newLoginRes.status === 200 && newLoginData.success, 'New password SUCCEEDS immediately upon login (HTTP 200)');

  // Restore teacher password back to PdsTeacher@123
  const restorePassRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${newLoginData.token}`,
    },
    body: JSON.stringify({
      currentPassword: newSecret,
      newPassword: 'PdsTeacher@123',
    }),
  });
  const restorePassData: any = await restorePassRes.json();
  assert(restorePassRes.status === 200 && restorePassData.success, 'Restored password back to baseline for continuous regression passes');

  // ----------------------------------------------------
  // TEST 6: Page Refresh Simulation (/api/auth/me)
  // ----------------------------------------------------
  console.log('\n--- 6. Testing Page Refresh Session Hydration ---');
  const refreshRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${adminLoginData.token}` },
  });
  const refreshData: any = await refreshRes.json();
  assert(refreshRes.status === 200 && refreshData.success, 'Cold session hydration via /api/auth/me succeeded');
  assert(refreshData.user.id === adminLoginData.user.id, 'Hydrated user identity matches logged-in user');

  console.log('\n========================================================');
  console.log(`MY PROFILE SUITE RESULTS: ${passed} / ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
