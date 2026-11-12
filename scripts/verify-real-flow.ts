import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'residential_cps_sheohar_jwt_production_secret_key_2026';

async function verifyRealFlow() {
  console.log('====================================================');
  console.log('CHANAKYA PUBLIC SCHOOL & COACHING CENTRE - AUTH & SESSION TEST');
  console.log('====================================================\n');

  // STEP 1: Login as SUPER_ADMIN
  console.log('>>> STEP 1: Login -> Receive JWT Token');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    }),
  });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed with HTTP ${loginRes.status}`);
  }
  const loginData: any = await loginRes.json();
  if (!loginData.success || !loginData.token) {
    throw new Error('Login response missing token or success flag');
  }
  const token = loginData.token;
  console.log(`[PASS] Login successful as ${loginData.user.name} (${loginData.user.role}). Token acquired.\n`);

  // STEP 2: Fetch a student to update
  console.log('>>> STEP 2: Fetch Existing Student');
  const listRes = await fetch(`${BASE_URL}/api/students?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listJson: any = await listRes.json();
  const students = listJson.data || [];
  if (students.length === 0) {
    throw new Error('No students returned from API');
  }
  const targetStudent = students[0];
  console.log(`[PASS] Target student identified: ${targetStudent.name} (ID: ${targetStudent.id}, AdmNo: ${targetStudent.admissionNumber})\n`);

  // STEP 3: Protected Student PUT
  console.log('>>> STEP 3: Protected Student UPDATE (PUT /api/students/:id)');
  const updatedRemarks = `Verified real update at ${new Date().toISOString()}`;
  const putRes = await fetch(`${BASE_URL}/api/students/${targetStudent.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...targetStudent,
      remarks: updatedRemarks,
    }),
  });
  if (putRes.status !== 200) {
    const errText = await putRes.text();
    throw new Error(`Student PUT failed with HTTP ${putRes.status}: ${errText}`);
  }
  const updatedStudent: any = await putRes.json();
  if (updatedStudent.remarks !== updatedRemarks) {
    throw new Error('Student PUT response did not reflect updated remarks');
  }
  console.log(`[PASS] Student PUT successfully updated ${updatedStudent.name}. Remarks: "${updatedStudent.remarks}"\n`);

  // STEP 4: Protected Student DELETE (Create temporary student first, then DELETE)
  console.log('>>> STEP 4: Protected Student DELETE (/api/students/:id)');
  const createTempRes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Temp Student For Deletion',
      firstName: 'Temp',
      lastName: 'Student',
      rollNumber: '998',
      classId: 'c-1',
      className: 'Class 1',
      section: 'A',
      dob: '2016-08-20',
      gender: 'MALE',
      parentName: 'Delete Test Parent',
      parentPhone: '9876500000',
      address: 'Sheohar',
      status: 'ACTIVE',
    }),
  });
  if (createTempRes.status !== 201 && createTempRes.status !== 200) {
    throw new Error(`Temporary student creation failed with HTTP ${createTempRes.status}`);
  }
  const createdTemp: any = await createTempRes.json();
  const tempId = createdTemp.id;
  console.log(`  - Created temporary student ${createdTemp.name} (ID: ${tempId})`);

  const deleteRes = await fetch(`${BASE_URL}/api/students/${tempId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (deleteRes.status !== 200) {
    const errText = await deleteRes.text();
    throw new Error(`Student DELETE failed with HTTP ${deleteRes.status}: ${errText}`);
  }
  const deleteJson: any = await deleteRes.json();
  if (!deleteJson.success) {
    throw new Error('Student DELETE response missing success flag');
  }
  console.log(`[PASS] Student DELETE succeeded. Message: "${deleteJson.message}"\n`);

  // STEP 5: Call /api/auth/me
  console.log('>>> STEP 5: Verify Active Session (/api/auth/me)');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (meRes.status !== 200) {
    throw new Error(`/api/auth/me failed with HTTP ${meRes.status}`);
  }
  const meJson: any = await meRes.json();
  if (!meJson.success || !meJson.user) {
    throw new Error('/api/auth/me response missing user');
  }
  console.log(`[PASS] /api/auth/me succeeded: user=${meJson.user.name}, role=${meJson.user.role}\n`);

  // STEP 6: Simulate Browser Refresh -> Cold Session / Restart Recovery
  console.log('>>> STEP 6: Browser Refresh Simulation (Cold JWT verification without memory cache)');
  // Create cold JWT with same claims to simulate browser reload / server restart
  const coldToken = jwt.sign(
    {
      userId: loginData.user.id,
      role: loginData.user.role,
      employeeId: loginData.user.employeeId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7200,
    },
    JWT_SECRET
  );
  const refreshMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${coldToken}` },
  });
  if (refreshMeRes.status !== 200) {
    throw new Error(`Post-refresh /api/auth/me failed with HTTP ${refreshMeRes.status}`);
  }
  const refreshMeJson: any = await refreshMeRes.json();
  console.log(`[PASS] Post-refresh session restored: ${refreshMeJson.user.name} (${refreshMeJson.user.role})`);

  // STEP 7: Protected PUT after Browser Refresh
  console.log('>>> STEP 7: Protected Student PUT after Refresh');
  const postRefreshRemarks = `Verified post-refresh update at ${new Date().toISOString()}`;
  const postRefreshPutRes = await fetch(`${BASE_URL}/api/students/${targetStudent.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${coldToken}`,
    },
    body: JSON.stringify({
      ...targetStudent,
      remarks: postRefreshRemarks,
    }),
  });
  if (postRefreshPutRes.status !== 200) {
    const errText = await postRefreshPutRes.text();
    throw new Error(`Post-refresh PUT failed with HTTP ${postRefreshPutRes.status}: ${errText}`);
  }
  const postRefreshUpdated: any = await postRefreshPutRes.json();
  console.log(`[PASS] Protected PUT after refresh succeeded: "${postRefreshUpdated.remarks}"\n`);

  // STEP 8: Also test with CPS0014 (Rohit Kumar, SUPER_ADMIN)
  console.log('>>> STEP 8: Test CPS0014 (Rohit Kumar, Staff SUPER_ADMIN)');
  const cps0014Login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'CPS0014',
      password: 'Rohit@123',
      loginType: 'STAFF_ADMIN',
    }),
  });
  if (cps0014Login.status !== 200) {
    throw new Error(`CPS0014 login failed with HTTP ${cps0014Login.status}`);
  }
  const cps0014Data: any = await cps0014Login.json();
  console.log(`  - CPS0014 login OK: ${cps0014Data.user.name} (${cps0014Data.user.role})`);

  const cps0014Put = await fetch(`${BASE_URL}/api/students/${targetStudent.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cps0014Data.token}`,
    },
    body: JSON.stringify({
      ...targetStudent,
      remarks: `Updated by CPS0014 at ${new Date().toISOString()}`,
    }),
  });
  if (cps0014Put.status !== 200) {
    throw new Error(`CPS0014 Student PUT failed with HTTP ${cps0014Put.status}`);
  }
  console.log(`[PASS] CPS0014 Student PUT succeeded\n`);

  console.log('====================================================');
  console.log('ALL VERIFICATION STEPS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

verifyRealFlow().catch((err) => {
  console.error('\n[FAIL] Test failure:', err.message || err);
  process.exit(1);
});
