const BASE_URL = 'http://localhost:3000';

async function postJson(url: string, data: any, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const resData = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: resData };
}

async function testEndpoint() {
  console.log('--- STARTING REAL TEACHER AUTH VERIFICATION ---\n');

  // Test 1a: Teacher login with uppercase Employee ID (PDS0011) + current password (PdsTeacher@123)
  console.log('Test 1a: Teacher login with uppercase Employee ID (PDS0011) + current password (PdsTeacher@123)');
  const res1a = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'PDS0011',
    password: 'PdsTeacher@123',
    loginType: 'STAFF_ADMIN',
  });
  if (res1a.status !== 200 || !res1a.data?.success) {
    console.error('✗ Failed Test 1a:', res1a.status, res1a.data);
    process.exit(1);
  }
  console.log(`✓ Status: ${res1a.status}, Success: ${res1a.data.success}, Role: ${res1a.data.user.role}, Name: ${res1a.data.user.name}`);

  // Test 1b: Teacher login with lowercase Employee ID (pds0011) + current password
  console.log('\nTest 1b: Teacher login with lowercase Employee ID (pds0011) + current password');
  const res1b = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'pds0011',
    password: 'PdsTeacher@123',
    loginType: 'STAFF_ADMIN',
  });
  if (res1b.status !== 200 || !res1b.data?.success) {
    console.error('✗ Failed Test 1b:', res1b.status, res1b.data);
    process.exit(1);
  }
  console.log(`✓ Status: ${res1b.status}, Success: ${res1b.data.success}, Role: ${res1b.data.user.role}`);

  // Test 1c: Teacher login with Email (sunita.verma.school@gmail.com) + current password
  console.log('\nTest 1c: Teacher login with Email (sunita.verma.school@gmail.com) + current password');
  const res1c = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'sunita.verma.school@gmail.com',
    password: 'PdsTeacher@123',
    loginType: 'STAFF_ADMIN',
  });
  if (res1c.status !== 200 || !res1c.data?.success) {
    console.error('✗ Failed Test 1c:', res1c.status, res1c.data);
    process.exit(1);
  }
  console.log(`✓ Status: ${res1c.status}, Success: ${res1c.data.success}, Role: ${res1c.data.user.role}`);

  // Test 1d: Teacher login with Phone (9811223344) + current password
  console.log('\nTest 1d: Teacher login with Phone (9811223344) + current password');
  const res1d = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: '9811223344',
    password: 'PdsTeacher@123',
    loginType: 'STAFF_ADMIN',
  });
  if (res1d.status !== 200 || !res1d.data?.success) {
    console.error('✗ Failed Test 1d:', res1d.status, res1d.data);
    process.exit(1);
  }
  console.log(`✓ Status: ${res1d.status}, Success: ${res1d.data.success}, Role: ${res1d.data.user.role}`);

  // Test 2: Wrong password -> HTTP 401
  console.log('\nTest 2: Wrong password -> HTTP 401');
  const res2 = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'PDS0011',
    password: 'WrongPassword@999',
    loginType: 'STAFF_ADMIN',
  });
  if (res2.status === 401) {
    console.log(`✓ Correctly rejected with 401: ${res2.data?.error}`);
  } else {
    console.error('✗ Unexpected response for wrong password:', res2.status, res2.data);
    process.exit(1);
  }

  // Test 3: Admin changes Teacher password
  console.log('\nTest 3: Admin logs in and changes Teacher password');
  const adminLoginRes = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'admin',
    password: 'admin123',
    loginType: 'STAFF_ADMIN',
  });
  if (adminLoginRes.status !== 200 || !adminLoginRes.data?.token) {
    console.error('✗ Failed Admin login:', adminLoginRes.status, adminLoginRes.data);
    process.exit(1);
  }
  const adminToken = adminLoginRes.data.token;
  console.log(`✓ Admin logged in, acquired token.`);

  const NEW_PASSWORD = 'NewTeacherSecret@2026';
  console.log(`Admin resetting password for PDS0011 to "${NEW_PASSWORD}"...`);
  const resetRes = await postJson(
    `${BASE_URL}/api/admin/reset-password-direct`,
    {
      targetType: 'STAFF',
      targetId: 'PDS0011',
      newPassword: NEW_PASSWORD,
      sendEmail: false,
    },
    adminToken
  );
  if (resetRes.status !== 200 || !resetRes.data?.success) {
    console.error('✗ Failed to reset password:', resetRes.status, resetRes.data);
    process.exit(1);
  }
  console.log(`✓ Admin reset response:`, resetRes.data.message);

  // Test 4: Old password -> MUST FAIL (HTTP 401)
  console.log('\nTest 4: Old password -> MUST FAIL (HTTP 401)');
  const res4 = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'PDS0011',
    password: 'PdsTeacher@123',
    loginType: 'STAFF_ADMIN',
  });
  if (res4.status === 401) {
    console.log(`✓ Old password correctly rejected with 401: ${res4.data?.error}`);
  } else {
    console.error('✗ Error: Old password should have failed with 401! Received:', res4.status, res4.data);
    process.exit(1);
  }

  // Test 5: New password -> MUST LOGIN SUCCESSFULLY (HTTP 200)
  console.log('\nTest 5: New password -> MUST LOGIN SUCCESSFULLY (HTTP 200)');
  const res5 = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'PDS0011',
    password: NEW_PASSWORD,
    loginType: 'STAFF_ADMIN',
  });
  if (res5.status !== 200 || !res5.data?.success) {
    console.error('✗ Failed Test 5 with new password:', res5.status, res5.data);
    process.exit(1);
  }
  console.log(`✓ Status: ${res5.status}, Success: ${res5.data.success}, Role: ${res5.data.user.role}, Name: ${res5.data.user.name}`);

  // Test 6: Also test resetting via /api/teachers/:id/reset-password
  console.log('\nTest 6: Admin resets password via /api/teachers/:id/reset-password endpoint');
  const RESTORED_PASSWORD = 'PdsTeacher@123';
  const resetRes2 = await postJson(
    `${BASE_URL}/api/teachers/PDS0011/reset-password`,
    {
      newPassword: RESTORED_PASSWORD,
      sendEmail: false,
    },
    adminToken
  );
  if (resetRes2.status !== 200 || !resetRes2.data?.success) {
    console.error('✗ Failed to reset password via /api/teachers/:id/reset-password:', resetRes2.status, resetRes2.data);
    process.exit(1);
  }
  console.log(`✓ Endpoint reset response:`, resetRes2.data.message);

  // Test 7: Verify interim password fails and restored password works
  console.log('\nTest 7: Verify interim password fails (401) and restored password (PdsTeacher@123) works (200)');
  const res7a = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'PDS0011',
    password: NEW_PASSWORD,
    loginType: 'STAFF_ADMIN',
  });
  if (res7a.status === 401) {
    console.log(`✓ Interim password correctly rejected with 401: ${res7a.data?.error}`);
  } else {
    console.error('✗ Error: Interim password should have failed with 401! Received:', res7a.status, res7a.data);
    process.exit(1);
  }

  const res7b = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'PDS0011',
    password: RESTORED_PASSWORD,
    loginType: 'STAFF_ADMIN',
  });
  if (res7b.status !== 200 || !res7b.data?.success) {
    console.error('✗ Failed restore login:', res7b.status, res7b.data);
    process.exit(1);
  }
  console.log(`✓ Restored password login succeeded! Status: ${res7b.status}, User: ${res7b.data.user.name}`);

  // Test 8: Another real teacher account: Anil Kumar Mishra (PDS0010)
  console.log('\nTest 8: Real Teacher login for Anil Kumar Mishra (PDS0010 / 9876543210)');
  const res8a = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: 'PDS0010',
    password: 'admin123',
    loginType: 'STAFF_ADMIN',
  });
  if (res8a.status !== 200 || !res8a.data?.success) {
    console.error('✗ Failed Test 8a:', res8a.status, res8a.data);
    process.exit(1);
  }
  console.log(`✓ Status: ${res8a.status}, Success: ${res8a.data.success}, Role: ${res8a.data.user.role}, Name: ${res8a.data.user.name}`);

  // By mobile:
  const res8b = await postJson(`${BASE_URL}/api/auth/login`, {
    identifier: '9876543210',
    password: 'admin123',
    loginType: 'STAFF_ADMIN',
  });
  if (res8b.status !== 200 || !res8b.data?.success) {
    console.error('✗ Failed Test 8b (by mobile):', res8b.status, res8b.data);
    process.exit(1);
  }
  console.log(`✓ Status: ${res8b.status}, Success: ${res8b.data.success}, Role: ${res8b.data.user.role}, Name: ${res8b.data.user.name}`);

  console.log('\n======================================================');
  console.log('ALL MANDATORY REAL TEACHER AUTH VERIFICATION TESTS PASSED!');
  console.log('======================================================');
}

testEndpoint().catch((err) => {
  console.error('Unexpected error during verification:', err);
  process.exit(1);
});
