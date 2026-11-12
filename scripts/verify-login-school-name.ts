// Automated verification script for Login Page School Name dynamic loading
import { api } from '../src/services/api';
import { getApiUrl } from '../src/services/apiConfig';

async function run() {
  console.log('--- Step 1: Login as SUPER_ADMIN to get auth token ---');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('✅ Logged in successfully as:', loginData.user.username);

  console.log('\n--- Step 2: Fetch current School Settings via GET /api/settings ---');
  const getRes = await fetch('http://localhost:3000/api/settings');
  const initialSettings = await getRes.json();
  const originalSchoolName = initialSettings.schoolName;
  console.log('✅ Current School Full Name:', originalSchoolName);

  if (!originalSchoolName) {
    throw new Error('schoolName is missing from initial settings');
  }

  console.log('\n--- Step 3: Change School Full Name in School Settings via PUT /api/settings ---');
  const testSchoolName = 'RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR - VERIFIED TEST CAMPUS';
  const updateRes = await fetch('http://localhost:3000/api/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...initialSettings,
      schoolName: testSchoolName,
    }),
  });

  if (!updateRes.ok) {
    throw new Error(`Failed to update settings: ${updateRes.status} ${await updateRes.text()}`);
  }

  const updatedSettings = await updateRes.json();
  console.log('✅ School Settings updated successfully:', updatedSettings.schoolName);
  if (updatedSettings.schoolName !== testSchoolName) {
    throw new Error(`Expected updated schoolName to be "${testSchoolName}", got "${updatedSettings.schoolName}"`);
  }

  console.log('\n--- Step 4: Simulate Login Page refresh (GET /api/settings / syncSettings) ---');
  const refreshRes = await fetch('http://localhost:3000/api/settings');
  const refreshedSettings = await refreshRes.json();
  console.log('✅ Login Page refreshed name from /api/settings:', refreshedSettings.schoolName);
  if (refreshedSettings.schoolName !== testSchoolName) {
    throw new Error(`Refreshed name does not match test name! Got: "${refreshedSettings.schoolName}"`);
  }

  console.log('\n--- Step 5: Restore original School Full Name in School Settings ---');
  const restoreRes = await fetch('http://localhost:3000/api/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...updatedSettings,
      schoolName: originalSchoolName,
    }),
  });

  if (!restoreRes.ok) {
    throw new Error(`Failed to restore settings: ${restoreRes.status}`);
  }

  const restoredSettings = await restoreRes.json();
  console.log('✅ School Settings restored to:', restoredSettings.schoolName);
  if (restoredSettings.schoolName !== originalSchoolName) {
    throw new Error(`Expected restored schoolName to be "${originalSchoolName}", got "${restoredSettings.schoolName}"`);
  }

  console.log('\n--- Step 6: Verify Login Page after restore ---');
  const finalRes = await fetch('http://localhost:3000/api/settings');
  const finalSettings = await finalRes.json();
  console.log('✅ Login Page final confirmed name:', finalSettings.schoolName);

  console.log('\n🎉 ALL LOGIN SCHOOL NAME DYNAMIC VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
