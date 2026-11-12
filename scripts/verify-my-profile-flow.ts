import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function postJson(url: string, data: any, token?: string): Promise<{ status: number; ok: boolean; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const json: any = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

async function getJson(url: string, token: string): Promise<{ status: number; ok: boolean; data: any }> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const json: any = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

async function putJson(url: string, data: any, token: string): Promise<{ status: number; ok: boolean; data: any }> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const json: any = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

async function runMyProfileVerification() {
  console.log('================================================================');
  console.log('MY PROFILE DYNAMIC MONGODB & CHANGE-PASSWORD VERIFICATION SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TEST 1: SUPER_ADMIN LOGIN & DYNAMIC PROFILE
  // -------------------------------------------------------------
  console.log('--- TEST 1: SUPER_ADMIN Login & Dynamic Profile ---');
  const adminLogin = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'admin',
    password: 'admin123',
    loginType: 'STAFF_ADMIN',
  });
  if (!adminLogin.ok || !adminLogin.data?.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  }
  const adminToken = adminLogin.data.token;
  console.log(`[PASS] Admin logged in. Name: ${adminLogin.data.user.name}, Role: ${adminLogin.data.user.role}`);

  console.log('Fetching Admin Profile via GET /api/auth/profile...');
  const adminProfile = await getJson(`${BASE_URL}/api/auth/profile`, adminToken);
  if (!adminProfile.ok || !adminProfile.data?.success) {
    throw new Error(`Admin get profile failed: ${JSON.stringify(adminProfile.data)}`);
  }
  const adminData = adminProfile.data.profile;
  console.log(`[PASS] Admin Profile loaded dynamically:`, {
    name: adminData.name,
    role: adminData.role,
    employeeId: adminData.employeeId,
    email: adminData.email,
    department: adminData.department,
    qualification: adminData.qualification,
  });

  // Admin edit test
  console.log('\nTesting Admin Profile Update via PUT /api/auth/profile...');
  const testEmergencyContact = '9876543210';
  const adminUpdate = await putJson(
    `${BASE_URL}/api/auth/profile`,
    {
      emergencyContact: testEmergencyContact,
      alternateMobile: '9123456780',
    },
    adminToken
  );
  if (!adminUpdate.ok || !adminUpdate.data?.success) {
    throw new Error(`Admin update profile failed: ${JSON.stringify(adminUpdate.data)}`);
  }
  console.log(`[PASS] Admin update succeeded: ${adminUpdate.data.message}`);

  // Refetch admin profile to verify persistence in MongoDB
  const adminProfileAfterUpdate = await getJson(`${BASE_URL}/api/auth/profile`, adminToken);
  if (adminProfileAfterUpdate.data.profile.emergencyContact !== testEmergencyContact) {
    throw new Error(`Emergency contact not persisted! Expected ${testEmergencyContact}, got ${adminProfileAfterUpdate.data.profile.emergencyContact}`);
  }
  console.log(`[PASS] Admin profile changes verified persistent in MongoDB.`);

  // -------------------------------------------------------------
  // TEST 2: TEACHER LOGIN & FULL FACULTY PROFILE
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: TEACHER (CPS0011) Login & Dynamic Profile ---');
  const teacherLogin = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'CPS0011',
    password: 'CpsTeacher@123',
    loginType: 'STAFF_ADMIN',
  });
  if (!teacherLogin.ok || !teacherLogin.data?.token) {
    throw new Error(`Teacher login failed: ${JSON.stringify(teacherLogin.data)}`);
  }
  let teacherToken = teacherLogin.data.token;
  console.log(`[PASS] Teacher logged in: ${teacherLogin.data.user.name} (${teacherLogin.data.user.employeeId}), Role: ${teacherLogin.data.user.role}`);

  console.log('Fetching Teacher Profile via GET /api/auth/profile...');
  const teacherProfile = await getJson(`${BASE_URL}/api/auth/profile`, teacherToken);
  if (!teacherProfile.ok || !teacherProfile.data?.success) {
    throw new Error(`Teacher profile fetch failed: ${JSON.stringify(teacherProfile.data)}`);
  }
  const teacherData = teacherProfile.data.profile;
  console.log(`[PASS] Teacher profile retrieved with full details:`, {
    employeeId: teacherData.employeeId,
    name: teacherData.name,
    designation: teacherData.designation,
    department: teacherData.department,
    qualification: teacherData.qualification,
    experience: teacherData.experience,
    subjects: teacherData.subjects,
    assignedClass: teacherData.assignedClass,
    assignedSection: teacherData.assignedSection,
    classesTeaching: teacherData.classesTeaching,
    teachingWorkload: teacherData.teachingWorkload,
    documentsCount: teacherData.documents?.length || 0,
    grossSalary: teacherData.grossSalary,
  });

  // Verify non-empty teacher fields from DB
  if (!teacherData.employeeId || teacherData.employeeId !== 'CPS0011') {
    throw new Error(`Teacher profile employeeId mismatch: expected CPS0011, got ${teacherData.employeeId}`);
  }
  if (!teacherData.qualification) {
    throw new Error('Teacher qualification missing from dynamic profile');
  }

  // -------------------------------------------------------------
  // TEST 3: TEACHER PROFILE EDITING & SECURITY RESTRICTIONS
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Teacher Profile Editing & Security Boundaries ---');
  const newPhone = '9876500011';
  const newAddress = 'Flat 402, Green Valley Apartments, Sheohar';

  console.log('Updating permitted teacher fields (phone, address, emergencyContact)...');
  const teacherUpdate = await putJson(
    `${BASE_URL}/api/auth/profile`,
    {
      phone: newPhone,
      currentAddress: newAddress,
      residentialAddress: newAddress,
      emergencyContact: '9876543299',
      // Malicious attempts to escalate role or employeeId
      role: 'SUPER_ADMIN',
      employeeId: 'CPS_HACKED',
      grossSalary: 999999,
    },
    teacherToken
  );
  if (!teacherUpdate.ok || !teacherUpdate.data?.success) {
    throw new Error(`Teacher profile update failed: ${JSON.stringify(teacherUpdate.data)}`);
  }
  console.log(`[PASS] Teacher profile update responded: ${teacherUpdate.data.message}`);

  // Fetch updated teacher profile
  const teacherProfileAfter = await getJson(`${BASE_URL}/api/auth/profile`, teacherToken);
  const updatedT = teacherProfileAfter.data.profile;

  // Verify permitted fields updated
  if (updatedT.phone !== newPhone) {
    throw new Error(`Permitted field 'phone' not updated. Expected ${newPhone}, got ${updatedT.phone}`);
  }
  console.log(`[PASS] Permitted field phone updated to ${updatedT.phone}`);

  // Verify protected fields were NOT modified
  if (updatedT.role !== 'TEACHER') {
    throw new Error(`SECURITY BREACH: Teacher modified their own role to ${updatedT.role}!`);
  }
  if (updatedT.employeeId !== 'CPS0011') {
    throw new Error(`SECURITY BREACH: Teacher modified their own employeeId to ${updatedT.employeeId}!`);
  }
  if (updatedT.grossSalary === 999999) {
    throw new Error(`SECURITY BREACH: Teacher modified their own grossSalary!`);
  }
  console.log(`[PASS] Protected fields (role, employeeId, grossSalary) remained strictly protected.`);

  // -------------------------------------------------------------
  // TEST 4: CHANGE ACCOUNT PASSWORD FLOW
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Change Account Password Flow ---');
  const oldPassword = 'CpsTeacher@123';
  const newPassword = 'CpsTeacher@NewPassword2026!';

  console.log(`Changing password from ${oldPassword} to ${newPassword}...`);
  const changeRes = await postJson(
    `${BASE_URL}/api/auth/change-password`,
    {
      currentPassword: oldPassword,
      newPassword: newPassword,
      confirmPassword: newPassword,
    },
    teacherToken
  );
  if (!changeRes.ok || !changeRes.data?.success) {
    throw new Error(`Change password failed: ${JSON.stringify(changeRes.data)}`);
  }
  console.log(`[PASS] Change password API returned success: ${changeRes.data.message}`);

  console.log('\nVerifying OLD password now FAILS...');
  const oldLoginRes = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'CPS0011',
    password: oldPassword,
    loginType: 'STAFF_ADMIN',
  });
  if (oldLoginRes.ok && oldLoginRes.data?.success) {
    throw new Error('SECURITY FAILURE: Old password still succeeded after password change!');
  }
  console.log(`[PASS] Old password correctly failed with status ${oldLoginRes.status}.`);

  console.log('\nVerifying NEW password immediately WORKS...');
  const newLoginRes = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'CPS0011',
    password: newPassword,
    loginType: 'STAFF_ADMIN',
  });
  if (!newLoginRes.ok || !newLoginRes.data?.success || !newLoginRes.data?.token) {
    throw new Error(`New password login failed: ${JSON.stringify(newLoginRes.data)}`);
  }
  console.log(`[PASS] New password login succeeded! Received fresh token for ${newLoginRes.data.user.name}.`);
  teacherToken = newLoginRes.data.token;

  // Restore original password so test suite is clean and reproducible
  console.log('\nRestoring original password back to CpsTeacher@123 for test cleanliness...');
  const restoreRes = await postJson(
    `${BASE_URL}/api/auth/change-password`,
    {
      currentPassword: newPassword,
      newPassword: oldPassword,
      confirmPassword: oldPassword,
    },
    teacherToken
  );
  if (!restoreRes.ok || !restoreRes.data?.success) {
    throw new Error(`Password restoration failed: ${JSON.stringify(restoreRes.data)}`);
  }
  console.log(`[PASS] Password restored back to ${oldPassword}.`);

  // Verify original password works again
  const finalCheck = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'CPS0011',
    password: oldPassword,
    loginType: 'STAFF_ADMIN',
  });
  if (!finalCheck.ok || !finalCheck.data?.success) {
    throw new Error(`Original password check failed: ${JSON.stringify(finalCheck.data)}`);
  }
  console.log(`[PASS] Original password confirmed active and working.`);

  console.log('\n================================================================');
  console.log('ALL MY PROFILE & AUTH VERIFICATIONS PASSED SUCCESSFULLY (100%)');
  console.log('================================================================');
}

runMyProfileVerification().catch((err) => {
  console.error('\n[FAIL] Verification error:', err);
  process.exit(1);
});
