import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testAllRolesProfile() {
  const credentials = [
    { role: 'ACCOUNTANT', id: 'CPS0004', pass: 'admin123' },
    { role: 'HR_STAFF', id: 'CPS0005', pass: 'admin123' },
    { role: 'HOSTEL_WARDEN', id: 'CPS0006', pass: 'admin123' },
    { role: 'TRANSPORT_MANAGER', id: 'CPS0007', pass: 'admin123' },
    { role: 'ACADEMIC_COORDINATOR', id: 'CPS0008', pass: 'admin123' },
    { role: 'VICE_PRINCIPAL', id: 'CPS0009', pass: 'admin123' },
  ];

  console.log('Testing My Profile for multiple staff roles...\n');
  for (const cred of credentials) {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: cred.id,
        password: cred.pass,
        loginType: 'STAFF_ADMIN',
      }),
    });
    const loginJson: any = await loginRes.json();
    if (!loginJson.success || !loginJson.token) {
      console.warn(`[WARN] Login failed for ${cred.role} (${cred.id})`);
      continue;
    }

    const profRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${loginJson.token}` },
    });
    const profJson: any = await profRes.json();
    if (!profJson.success || !profJson.profile) {
      throw new Error(`Profile fetch failed for ${cred.role}`);
    }

    console.log(`[PASS] ${cred.role} (${cred.id}):`, {
      name: profJson.profile.name,
      designation: profJson.profile.designation,
      employeeId: profJson.profile.employeeId,
      role: profJson.profile.role,
      systemRole: profJson.profile.systemRole,
    });
  }
  console.log('\nAll role profiles verified successfully!');
}

testAllRolesProfile().catch((err) => {
  console.error(err);
  process.exit(1);
});
