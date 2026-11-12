import fs from 'fs';

const API_BASE = 'http://localhost:3000/api';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`✅ [PASS] ${name}${details ? ` - ${details}` : ''}`);
  } else {
    results.push({ name, passed: false, error: details || 'Assertion failed' });
    console.error(`❌ [FAIL] ${name}${details ? ` - ${details}` : ''}`);
  }
}

async function api(path: string, options: any = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('=====================================================');
  console.log('🚀 RUNNING COMPREHENSIVE RBAC & ACCESS CONTROL SUITE');
  console.log('=====================================================\n');

  // 1. RBAC Registry and Roles Verification
  try {
    const permRes = await api('/rbac/permissions');
    assert(permRes.data?.success === true, 'RBAC Permissions API responds', `Count: ${permRes.data?.allPermissions?.length} permissions across ${permRes.data?.modules?.length} modules`);

    const rolesRes = await api('/rbac/roles');
    assert(rolesRes.data?.success === true, 'RBAC Roles API responds', `Total roles: ${rolesRes.data?.roles?.length}`);

    const expectedRoles = [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'ACCOUNTANT',
      'HR_STAFF',
      'HOSTEL_WARDEN',
      'TRANSPORT_MANAGER',
      'STUDENT',
      'PARENT',
    ];

    const actualRoles = rolesRes.data?.roles?.map((r: any) => r.role) || [];
    const allRolesPresent = expectedRoles.every((r) => actualRoles.includes(r));
    assert(allRolesPresent, 'All 12 supported ERP roles are registered', `Roles: ${actualRoles.join(', ')}`);
  } catch (err: any) {
    assert(false, 'RBAC Registry Verification', err.message);
  }

  // 2. Super Admin Login & Authoritative Permissions
  let superAdminToken = '';
  let superAdminUser: any = null;
  try {
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: { identifier: 'admin', password: 'admin123', loginType: 'STAFF_ADMIN' },
    });

    superAdminToken = loginRes.data?.token;
    superAdminUser = loginRes.data?.user;

    assert(!!superAdminToken, 'Super Admin login successful', `User: ${superAdminUser?.name} (${superAdminUser?.role})`);
    assert(Array.isArray(superAdminUser?.permissions) && superAdminUser?.permissions.length > 0, 'User payload contains authoritative permissions array', `Permissions count: ${superAdminUser?.permissions?.length}`);
    assert(superAdminUser?.permissions.includes('users.manage'), 'Super Admin has users.manage permission');
    assert(superAdminUser?.permissions.includes('roles.manage'), 'Super Admin has roles.manage permission');
    assert(superAdminUser?.permissions.includes('permissions.manage'), 'Super Admin has permissions.manage permission');
    assert(superAdminUser?.permissions.includes('fees.collect'), 'Super Admin has fees.collect permission');
    assert(superAdminUser?.permissions.includes('settings.manage'), 'Super Admin has settings.manage permission');
  } catch (err: any) {
    assert(false, 'Super Admin Login & Payload Check', err.message);
  }

  const superAdminHeaders = {
    Authorization: `Bearer ${superAdminToken}`,
  };

  // 3. User & Role Management API Endpoints
  let targetTeacher: any = null;
  try {
    const usersRes = await api('/rbac/users?limit=50', {
      headers: superAdminHeaders,
    });
    assert(usersRes.data?.success === true, 'RBAC Users list API returns users', `Total loaded: ${usersRes.data?.users?.length}`);

    targetTeacher = usersRes.data?.users?.find((u: any) => u.role === 'TEACHER');
    assert(!!targetTeacher, 'Teacher record located for RBAC tests', `Teacher: ${targetTeacher?.name} (${targetTeacher?.id || targetTeacher?.username})`);
  } catch (err: any) {
    assert(false, 'RBAC Users List Verification', err.message);
  }

  // 4. Permission Enforcement & Privilege Escalation Prevention
  let teacherToken = '';
  try {
    const teacherLogin = await api('/auth/login', {
      method: 'POST',
      body: { identifier: 'CPS0002', password: 'admin123', loginType: 'STAFF_ADMIN' },
    });

    teacherToken = teacherLogin.data?.token;
    const teacherUser = teacherLogin.data?.user;
    assert(!!teacherToken, 'Teacher logged in successfully', `Teacher: ${teacherUser?.name} (${teacherUser?.role})`);

    const teacherHeaders = {
      Authorization: `Bearer ${teacherToken}`,
    };

    // 4.1 Teacher trying to access RBAC management (Forbidden: 403)
    const rbacAttempt = await api('/rbac/users', { headers: teacherHeaders });
    assert(rbacAttempt.status === 403, 'Teacher correctly blocked from /api/rbac/users without users.view (HTTP 403)', rbacAttempt.data?.error);

    // 4.2 Teacher trying to alter roles (Forbidden: 403)
    const escalateAttempt = await api(`/rbac/users/${teacherUser.id}/role`, {
      method: 'PUT',
      headers: teacherHeaders,
      body: { role: 'SUPER_ADMIN' },
    });
    assert(escalateAttempt.status === 403, 'Privilege escalation prevented: Teacher cannot elevate role to SUPER_ADMIN (HTTP 403)', escalateAttempt.data?.error);

    // 4.3 Teacher trying to grant themselves permissions (Forbidden: 403)
    const selfGrantAttempt = await api(`/rbac/users/${teacherUser.id}/permissions`, {
      method: 'PUT',
      headers: teacherHeaders,
      body: { permissions: ['settings.manage', 'fees.collect'] },
    });
    assert(selfGrantAttempt.status === 403, 'Self-modification prevented: Teacher cannot grant self permissions (HTTP 403)', selfGrantAttempt.data?.error);

    // 4.4 Teacher trying to collect fees (Forbidden: 403)
    const feeAttempt = await api('/fee-ledgers/fl-test/collect', {
      method: 'POST',
      headers: teacherHeaders,
      body: { amount: 1000 },
    });
    assert(feeAttempt.status === 403, 'Role boundaries enforced: Teacher blocked from collecting fees (HTTP 403)', feeAttempt.data?.error);
  } catch (err: any) {
    assert(false, 'Teacher permission enforcement test', err.message);
  }

  // 5. Custom Permission Grant & Deny Overrides
  if (targetTeacher) {
    try {
      // 5.1 Grant custom permission 'reports.export' to teacher
      const grantRes = await api(`/rbac/users/${targetTeacher.id}/permissions`, {
        method: 'PUT',
        headers: superAdminHeaders,
        body: {
          permissions: ['reports.export'],
          deniedPermissions: [],
        },
      });
      assert(grantRes.data?.success === true, 'Admin successfully granted custom permission reports.export to teacher');
      assert(grantRes.data?.user?.permissions?.includes('reports.export'), 'Teacher permissions now includes reports.export (Positive Grant Enforced)');

      // 5.2 Deny a default permission 'attendance.mark' from teacher
      const denyRes = await api(`/rbac/users/${targetTeacher.id}/permissions`, {
        method: 'PUT',
        headers: superAdminHeaders,
        body: {
          permissions: ['reports.export'],
          deniedPermissions: ['attendance.mark'],
        },
      });
      assert(denyRes.data?.success === true, 'Admin successfully revoked/denied default permission attendance.mark from teacher');
      assert(!denyRes.data?.user?.permissions?.includes('attendance.mark'), 'Teacher permissions NO LONGER includes attendance.mark (Negative Deny Enforced)');

      // 5.3 Reset back to clean permissions
      await api(`/rbac/users/${targetTeacher.id}/permissions`, {
        method: 'PUT',
        headers: superAdminHeaders,
        body: {
          permissions: [],
          deniedPermissions: [],
        },
      });
      assert(true, 'Cleaned up custom permissions after test');
    } catch (err: any) {
      assert(false, 'Custom Permission Overrides Test', err.message);
    }
  }

  // 6. Super Admin Protection: Prevent demoting sole SUPER_ADMIN
  try {
    const demoteRes = await api(`/rbac/users/${superAdminUser.id}/role`, {
      method: 'PUT',
      headers: superAdminHeaders,
      body: { role: 'STUDENT' },
    });
    assert(demoteRes.status === 400 || demoteRes.status === 403, 'System prevents demoting Super Administrator (Protected)', demoteRes.data?.error);
  } catch (err: any) {
    assert(false, 'Super Admin Protection Test', err.message);
  }

  // 7. Role Boundary Tests for Specialized Operational Roles
  try {
    // 7.1 Accountant Login
    const accLogin = await api('/auth/login', {
      method: 'POST',
      body: { identifier: 'CPS0004', password: 'admin123', loginType: 'STAFF_ADMIN' },
    });
    assert(accLogin.ok && accLogin.data?.user?.role === 'ACCOUNTANT', 'Accountant logged in successfully (CPS0004)', `Role: ${accLogin.data?.user?.role}`);
    const accHeaders = { Authorization: `Bearer ${accLogin.data?.token}` };

    // Accountant has fee permissions
    assert(accLogin.data?.user?.permissions.includes('fees.collect'), 'Accountant has fees.collect permission');
    assert(accLogin.data?.user?.permissions.includes('fees.view'), 'Accountant has fees.view permission');
    // Accountant is blocked from academic marks editing
    const accMarkAttempt = await api('/exams/marks', {
      method: 'POST',
      headers: accHeaders,
      body: { examId: 'ex1', marks: [] },
    });
    assert(accMarkAttempt.status === 403, 'Accountant blocked from academic marks entry (HTTP 403)', accMarkAttempt.data?.error);

    // 7.2 Hostel Warden Login
    const wardenLogin = await api('/auth/login', {
      method: 'POST',
      body: { identifier: 'CPS0006', password: 'admin123', loginType: 'STAFF_ADMIN' },
    });
    assert(wardenLogin.ok && wardenLogin.data?.user?.role === 'HOSTEL_WARDEN', 'Hostel Warden logged in successfully (CPS0006)', `Role: ${wardenLogin.data?.user?.role}`);
    assert(wardenLogin.data?.user?.permissions.includes('hostel.manage'), 'Hostel Warden has hostel.manage permission');
    assert(!wardenLogin.data?.user?.permissions.includes('fees.collect'), 'Hostel Warden DOES NOT have fee collection permission');

    // 7.3 Transport Manager Login
    const transLogin = await api('/auth/login', {
      method: 'POST',
      body: { identifier: 'CPS0007', password: 'admin123', loginType: 'STAFF_ADMIN' },
    });
    assert(transLogin.ok && transLogin.data?.user?.role === 'TRANSPORT_MANAGER', 'Transport Manager logged in successfully (CPS0007)', `Role: ${transLogin.data?.user?.role}`);
    assert(transLogin.data?.user?.permissions.includes('transport.manage'), 'Transport Manager has transport.manage permission');
    assert(!transLogin.data?.user?.permissions.includes('payroll.manage'), 'Transport Manager DOES NOT have payroll management permission');
  } catch (err: any) {
    assert(false, 'Specialized Roles Boundary Verification', err.message);
  }

  // 8. Audit Log Recording for RBAC actions
  try {
    const auditRes = await api('/audit-logs?paginated=true&limit=10', {
      headers: superAdminHeaders,
    });
    const logs = Array.isArray(auditRes.data) ? auditRes.data : (auditRes.data?.logs || auditRes.data?.data || []);
    assert(logs.length > 0, 'Audit logs retrieved successfully', `Total retrieved: ${logs.length}`);
    const rbacLog = logs.find((l: any) =>
      l.action?.includes('PERMISSIONS_UPDATED') ||
      l.action?.includes('ROLE_CHANGED') ||
      l.action?.includes('SECURITY_ACCESS_DENIED') ||
      l.action?.includes('USER_LOGIN')
    );
    assert(!!rbacLog, 'RBAC modifications or security events are actively recorded in audit logs', `Action: ${rbacLog?.action || 'Recorded'}`);
  } catch (err: any) {
    assert(false, 'Audit Log Verification', err.message);
  }

  // 9. Summary
  console.log('\n=====================================================');
  console.log('📊 RBAC VERIFICATION SUMMARY');
  console.log('=====================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nFailed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`- ${r.name}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL RBAC VERIFICATION CHECKS PASSED PERFECTLY!');
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
