import 'dotenv/config';

const BASE_URL = 'http://127.0.0.1:3000';

async function main() {
  console.log('========================================================================');
  console.log('TESTING PARENT LOGIN ID AUTO-SYNC ON FATHER MOBILE UPDATE');
  console.log('========================================================================\n');

  // 1. Admin login
  let adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'chanakyapublicschool',
      password: 'Chanakyaschool@321',
      loginType: 'STAFF_ADMIN',
    }),
  });
  if (!adminLoginRes.ok) {
    adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'CPS0009',
        password: 'admin123',
        loginType: 'STAFF_ADMIN',
      }),
    });
  }
  const adminLoginData: any = await adminLoginRes.json();
  const adminToken = adminLoginData.token;
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  // 2. Create test student with initial father mobile
  const oldFatherMobile = '9871112233';
  const newFatherMobile = '9879998877';
  const testStudentId = `st-sync-${Date.now()}`;

  const createStudentRes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: testStudentId,
      name: 'Rohan Sharma',
      admissionNumber: `ADM-${Date.now().toString().slice(-4)}`,
      rollNumber: '88',
      className: 'Class 8th',
      section: 'A',
      fatherName: 'Rajesh Sharma',
      fatherMobile: oldFatherMobile,
      parentPhone: oldFatherMobile,
      parentName: 'Rajesh Sharma',
      enrollmentDate: '2026-04-01',
      status: 'ACTIVE',
    }),
  });

  const createdStudent: any = await createStudentRes.json();
  console.log('Created student with initial fatherMobile:', oldFatherMobile);

  // 3. Parent logs in using OLD father mobile
  const parentLogin1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: oldFatherMobile,
      password: 'admin123',
      loginType: 'PARENT',
    }),
  });
  const parentData1: any = await parentLogin1.json();
  console.log(`Parent login with old mobile (${oldFatherMobile}): status ${parentLogin1.status}, success: ${parentData1.success}`);
  if (!parentData1.success) {
    throw new Error('Initial parent login failed');
  }

  // 4. Update student with NEW father mobile
  console.log(`\nUpdating student fatherMobile to: ${newFatherMobile}...`);
  const updateStudentRes = await fetch(`${BASE_URL}/api/students/${createdStudent.id || testStudentId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      fatherMobile: newFatherMobile,
      parentPhone: newFatherMobile,
      fatherName: 'Rajesh Sharma',
    }),
  });
  const updatedStudent: any = await updateStudentRes.json();
  console.log('Update student response status:', updateStudentRes.status);

  // 5. Parent login with OLD father mobile MUST FAIL (401)
  console.log('\nVerifying old father mobile can no longer log in...');
  const oldLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: oldFatherMobile,
      password: 'admin123',
      loginType: 'PARENT',
    }),
  });
  console.log('Old mobile login status:', oldLoginRes.status);
  if (oldLoginRes.status === 200) {
    throw new Error('Old mobile should NOT be able to log in after mobile change');
  }
  console.log('✅ [PASS] Old father mobile is invalidated for login.');

  // 6. Parent login with NEW father mobile MUST SUCCEED (200)
  console.log('\nVerifying new father mobile logs in successfully...');
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: newFatherMobile,
      password: 'admin123',
      loginType: 'PARENT',
    }),
  });
  const newData: any = await newLoginRes.json();
  console.log('New mobile login status:', newLoginRes.status, 'User:', newData?.user?.name, 'Role:', newData?.user?.role);
  if (newLoginRes.status !== 200 || !newData.success) {
    throw new Error('New father mobile login failed');
  }
  console.log('✅ [PASS] Parent Login ID successfully migrated to new father mobile number!');

  // Cleanup test student
  await fetch(`${BASE_URL}/api/students/${createdStudent.id || testStudentId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  console.log('Cleaned up test student.');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
