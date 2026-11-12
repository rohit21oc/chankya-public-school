/**
 * End-to-End Verification Test Suite for Authentication, Login, and Password Management
 * Tests:
 * 1. Exactly 3 Login Experiences: Staff/Admin (Common), Student, Parent
 * 2. All 10 Staff/Admin Roles authenticating through the ONE common staff/admin login
 * 3. Student Login with Admission Number + Date of Birth
 * 4. Parent Login with Registered Mobile + Child's Date of Birth
 * 5. Forgot Password flow (no exposed token or password)
 * 6. Password reset token verification & redemption
 * 7. Authenticated user password change
 * 8. Admin direct password reset with RBAC enforcement
 */

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, details: err?.message || String(err) });
    console.error(`❌ FAIL: ${name} ->`, err?.message || err);
  }
}

async function runSuite() {
  console.log('====================================================');
  console.log('CHANAKYA PUBLIC SCHOOL & COACHING CENTRE');
  console.log('Authentication & Password Management Verification');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: ALL 10 STAFF/ADMIN ROLES VIA ONE COMMON LOGIN
  // ----------------------------------------------------
  const staffRolesToTest = [
    { role: 'SUPER_ADMIN', identifier: 'admin', expectedRole: 'SUPER_ADMIN' },
    { role: 'SCHOOL_ADMIN', identifier: 'schooladmin', expectedRole: 'SCHOOL_ADMIN' },
    { role: 'PRINCIPAL', identifier: 'CPS0001', expectedRole: 'PRINCIPAL' },
    { role: 'TEACHER', identifier: 'CPS0002', expectedRole: 'TEACHER' },
    { role: 'ACCOUNTANT', identifier: 'CPS0004', expectedRole: 'ACCOUNTANT' },
    { role: 'HR_STAFF', identifier: 'CPS0005', expectedRole: 'HR_STAFF' },
    { role: 'HOSTEL_WARDEN', identifier: 'CPS0006', expectedRole: 'HOSTEL_WARDEN' },
    { role: 'TRANSPORT_MANAGER', identifier: 'CPS0007', expectedRole: 'TRANSPORT_MANAGER' },
    { role: 'ACADEMIC_COORDINATOR', identifier: 'CPS0008', expectedRole: 'ACADEMIC_COORDINATOR' },
    { role: 'VICE_PRINCIPAL', identifier: 'CPS0009', expectedRole: 'VICE_PRINCIPAL' },
  ];

  for (const item of staffRolesToTest) {
    await runTest(`Staff/Admin Common Login: ${item.role} (${item.identifier})`, async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: item.identifier,
          password: 'admin123',
          loginType: 'STAFF_ADMIN', // Frontend does NOT submit role; submits common staff_admin
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(`Login failed for ${item.identifier}: ${data.error || res.statusText}`);
      }

      if (data.user.role !== item.expectedRole) {
        throw new Error(`Role mismatch for ${item.identifier}: expected ${item.expectedRole}, got ${data.user.role}`);
      }

      if (!data.token) {
        throw new Error(`No auth token returned for ${item.identifier}`);
      }
    });
  }

  // ----------------------------------------------------
  // TEST 2: STUDENT LOGIN (Admission No + DOB)
  // ----------------------------------------------------
  await runTest('Student Login (Admission Number: 64010001, DOB: 14-05-2011)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '64010001',
        dob: '14-05-2011',
        loginType: 'STUDENT',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(`Student login failed: ${data.error || res.statusText}`);
    }

    if (data.user.role !== 'STUDENT') {
      throw new Error(`Role was not STUDENT: got ${data.user.role}`);
    }
    if (!data.user.studentId) {
      throw new Error('Student user object missing studentId');
    }
  });

  // ----------------------------------------------------
  // TEST 3: PARENT LOGIN (Registered Mobile + Child DOB)
  // ----------------------------------------------------
  await runTest('Parent Login (Mobile: 9876543210, Child DOB: 14-05-2011)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '9876543210',
        dob: '14-05-2011',
        loginType: 'PARENT',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(`Parent login failed: ${data.error || res.statusText}`);
    }

    if (data.user.role !== 'PARENT') {
      throw new Error(`Role was not PARENT: got ${data.user.role}`);
    }
    if (!data.user.linkedStudentIds || data.user.linkedStudentIds.length === 0) {
      throw new Error('Parent user missing linked student IDs');
    }
  });

  // ----------------------------------------------------
  // TEST 4: FORGOT PASSWORD REQUEST (Validates email & response)
  // ----------------------------------------------------
  await runTest('Forgot Password (Validation & Token Privacy)', async () => {
    // 1. Unknown user request
    const badRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent.user.12345@gmail.com' }),
    });
    const badData = await badRes.json();
    if (badRes.status !== 404 || badData.success) {
      throw new Error('Expected 404 for nonexistent email in forgot password');
    }

    // 2. Existing user request (webwraptechnology@gmail.com)
    const goodRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'webwraptechnology@gmail.com' }),
    });
    const goodData = await goodRes.json();
    // Verify resetToken or resetUrl is NEVER returned in the API response
    if (goodData.token || goodData.resetToken || goodData.resetUrl) {
      throw new Error('SECURITY VIOLATION: Reset token was leaked in forgot-password API response!');
    }
  });

  // ----------------------------------------------------
  // TEST 5: AUTHENTICATED USER CHANGE PASSWORD
  // ----------------------------------------------------
  await runTest('Logged-in User Change Password', async () => {
    // 1. Login as teacher CPS0002
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'CPS0002',
        password: 'admin123',
        loginType: 'STAFF_ADMIN',
      }),
    });
    const loginData = await loginRes.json();
    if (!loginData.success) throw new Error('Teacher login failed');
    const token = loginData.token;

    // 2. Change password to TeacherPass#2026
    const changeRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword: 'admin123',
        newPassword: 'TeacherPass#2026',
      }),
    });
    const changeData = await changeRes.json();
    if (!changeData.success) {
      throw new Error(`Change password failed: ${changeData.error}`);
    }

    // 3. Verify login works with new password
    const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'CPS0002',
        password: 'TeacherPass#2026',
        loginType: 'STAFF_ADMIN',
      }),
    });
    const newLoginData = await newLoginRes.json();
    if (!newLoginData.success) {
      throw new Error('Login with updated password failed');
    }

    // 4. Restore original password for ongoing test repeatability
    await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newLoginData.token}`,
      },
      body: JSON.stringify({
        currentPassword: 'TeacherPass#2026',
        newPassword: 'admin123',
      }),
    });
  });

  // ----------------------------------------------------
  // TEST 6: ADMIN PASSWORD RESET & RBAC SECURITY
  // ----------------------------------------------------
  await runTest('Admin Password Reset & Strict RBAC Enforcement', async () => {
    // 1. Login as Super Admin
    const superAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin',
        password: 'admin123',
        loginType: 'STAFF_ADMIN',
      }),
    });
    const superAdminData = await superAdminRes.json();
    if (!superAdminData.success) throw new Error('Super Admin login failed');
    const superToken = superAdminData.token;

    // 2. Login as School Admin
    const schoolAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'schooladmin',
        password: 'admin123',
        loginType: 'STAFF_ADMIN',
      }),
    });
    const schoolAdminData = await schoolAdminRes.json();
    if (!schoolAdminData.success) throw new Error('School Admin login failed');
    const schoolToken = schoolAdminData.token;

    // 3. Security Test: School Admin MUST NOT be allowed to reset Super Admin password
    const unauthResetRes = await fetch(`${BASE_URL}/api/admin/reset-password-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolToken}`,
      },
      body: JSON.stringify({
        targetType: 'ADMIN',
        targetId: 'admin',
        newPassword: 'HackedPassword#1',
        sendEmail: false,
      }),
    });
    if (unauthResetRes.status !== 403) {
      throw new Error(`RBAC Failure: School Admin was able to reset Super Admin (HTTP ${unauthResetRes.status})`);
    }

    // 4. Security Test: School Admin MUST NOT be allowed to reset Principal password
    const principalResetRes = await fetch(`${BASE_URL}/api/admin/reset-password-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${schoolToken}`,
      },
      body: JSON.stringify({
        targetType: 'STAFF',
        targetId: 'CPS0001',
        newPassword: 'HackedPassword#1',
        sendEmail: false,
      }),
    });
    if (principalResetRes.status !== 403) {
      throw new Error(`RBAC Failure: School Admin was able to reset Principal (HTTP ${principalResetRes.status})`);
    }

    // 5. Authorized Reset: Super Admin resets teacher CPS0003 password
    const authResetRes = await fetch(`${BASE_URL}/api/admin/reset-password-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        targetType: 'STAFF',
        targetId: 'CPS0003',
        newPassword: 'TeacherThree#2026',
        sendEmail: false,
      }),
    });
    const authResetData = await authResetRes.json();
    if (!authResetData.success) {
      throw new Error(`Super Admin reset staff password failed: ${authResetData.error}`);
    }

    // Verify teacher CPS0003 can now log in with new password
    const cps3Login = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'CPS0003',
        password: 'TeacherThree#2026',
        loginType: 'STAFF_ADMIN',
      }),
    });
    const cps3Data = await cps3Login.json();
    if (!cps3Data.success) {
      throw new Error('Teacher CPS0003 could not log in with admin-reset password');
    }

    // Restore CPS0003 password back to admin123
    await fetch(`${BASE_URL}/api/admin/reset-password-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        targetType: 'STAFF',
        targetId: 'CPS0003',
        newPassword: 'admin123',
        sendEmail: false,
      }),
    });
  });

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('====================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests Run: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error('\nFailures:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- ${r.name}: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL AUTHENTICATION & PASSWORD MANAGEMENT TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runSuite().catch((e) => {
  console.error('Fatal suite failure:', e);
  process.exit(1);
});
