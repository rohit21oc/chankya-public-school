import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'residential_pds_sheohar_jwt_production_secret_key_2026';

interface RoleTestConfig {
  role: string;
  identifier: string;
  password: string;
  canManageStudents: boolean;
}

const ROLES_TO_TEST: RoleTestConfig[] = [
  { role: 'SUPER_ADMIN', identifier: 'admin', password: 'admin123', canManageStudents: true },
  { role: 'SCHOOL_ADMIN', identifier: 'schooladmin', password: 'admin123', canManageStudents: true },
  { role: 'PRINCIPAL', identifier: 'PDS0001', password: 'admin123', canManageStudents: true },
  { role: 'VICE_PRINCIPAL', identifier: 'PDS0009', password: 'admin123', canManageStudents: true },
  { role: 'ACADEMIC_COORDINATOR', identifier: 'PDS0008', password: 'admin123', canManageStudents: false },
  { role: 'ACCOUNTANT', identifier: 'PDS0004', password: 'admin123', canManageStudents: false },
  { role: 'TEACHER', identifier: 'PDS0002', password: 'admin123', canManageStudents: false },
  { role: 'HOSTEL_WARDEN', identifier: 'PDS0006', password: 'admin123', canManageStudents: false },
  { role: 'TRANSPORT_MANAGER', identifier: 'PDS0007', password: 'admin123', canManageStudents: false },
  { role: 'HR_STAFF', identifier: 'PDS0005', password: 'admin123', canManageStudents: false },
];

async function run() {
  console.log('====================================================');
  console.log('STARTING 10-ROLE COMPREHENSIVE AUTH & RBAC VERIFICATION');
  console.log('====================================================\n');

  // First fetch an existing student to update
  const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin123', loginType: 'STAFF_ADMIN' }),
  });
  const adminData: any = await adminLogin.json();
  const studentsRes = await fetch(`${BASE_URL}/api/students?limit=1`, {
    headers: { Authorization: `Bearer ${adminData.token}` },
  });
  const studentsJson: any = await studentsRes.json();
  const targetStudent = studentsJson.data[0];
  console.log(`Using target student: ${targetStudent.name} (${targetStudent.id}) for PUT tests\n`);

  let passedTests = 0;
  let totalTests = 0;

  for (const config of ROLES_TO_TEST) {
    console.log(`--- Testing Role: ${config.role} (${config.identifier}) ---`);

    // 1. Login
    totalTests++;
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: config.identifier,
        password: config.password,
        loginType: 'STAFF_ADMIN',
      }),
    });
    const loginData: any = await loginRes.json();
    if (loginRes.status === 200 && loginData.success) {
      console.log(`  ✓ Login HTTP 200 OK (returned role: ${loginData.user.role})`);
      passedTests++;
    } else {
      console.error(`  ✗ Login FAILED:`, loginData);
      continue;
    }

    const token = loginData.token;

    // 2. /api/auth/me
    totalTests++;
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData: any = await meRes.json();
    if (meRes.status === 200 && meData.success && meData.user.role === config.role) {
      console.log(`  ✓ /api/auth/me HTTP 200 OK (role verified: ${meData.user.role})`);
      passedTests++;
    } else {
      console.error(`  ✗ /api/auth/me FAILED:`, meRes.status, meData);
    }

    // 3. Cold JWT verification (fresh token directly signed, simulating restart)
    totalTests++;
    const coldToken = jwt.sign(
      {
        userId: loginData.user.id,
        role: loginData.user.role,
        employeeId: loginData.user.employeeId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET
    );
    const coldMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${coldToken}` },
    });
    const coldMeData: any = await coldMeRes.json();
    if (coldMeRes.status === 200 && coldMeData.success) {
      console.log(`  ✓ Cold JWT /api/auth/me HTTP 200 OK`);
      passedTests++;
    } else {
      console.error(`  ✗ Cold JWT /api/auth/me FAILED:`, coldMeRes.status, coldMeData);
    }

    // 4. Student PUT (RBAC test)
    totalTests++;
    const putRes = await fetch(`${BASE_URL}/api/students/${targetStudent.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...targetStudent,
        remarks: `Tested by ${config.role} at ${Date.now()}`,
      }),
    });
    const putData: any = await putRes.json();

    if (config.canManageStudents) {
      if (putRes.status === 200) {
        console.log(`  ✓ Student PUT HTTP 200 OK (Authorized as expected)`);
        passedTests++;
      } else {
        console.error(`  ✗ Student PUT FAILED for authorized role:`, putRes.status, putData);
      }
    } else {
      if (putRes.status === 403) {
        console.log(`  ✓ Student PUT HTTP 403 Forbidden (RBAC correctly denied access)`);
        passedTests++;
      } else {
        console.error(`  ✗ Student PUT unexpected status for unauthorized role:`, putRes.status, putData);
      }
    }
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
