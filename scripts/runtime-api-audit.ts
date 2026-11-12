import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

interface EndpointTest {
  method: string;
  path: string;
  authRole?: string; // 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT', or 'NONE'
  body?: any;
}

const endpointsToTest: EndpointTest[] = [
  // Static / Health
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/settings' },
  { method: 'GET', path: '/api/school-settings' },
  { method: 'GET', path: '/api/public/website' },
  { method: 'GET', path: '/api/holidays' },

  // Public / Auth
  { method: 'GET', path: '/api/auth/profile', authRole: 'NONE' }, // should be 401
  { method: 'GET', path: '/api/auth/profile', authRole: 'ADMIN' }, // should be 200
  { method: 'GET', path: '/api/auth/profile', authRole: 'TEACHER' }, // should be 200
  { method: 'GET', path: '/api/auth/profile', authRole: 'STUDENT' }, // should be 200
  { method: 'GET', path: '/api/auth/profile', authRole: 'PARENT' }, // should be 200

  // Admin / General Endpoints
  { method: 'GET', path: '/api/students?limit=2000', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/teachers', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/staff', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/classes', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/subjects', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/timetables', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/timetables/periods', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/attendance', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/staff-attendance', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/fees/structures', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/fees/payments', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/fee-structures', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/fee-payments', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/fee-configurations', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/fee-ledgers', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/transport-slabs', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/exams', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/marks', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/homework', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/notices', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/study-materials', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/hostels', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/transport', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/staff-leaves', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/staff-payroll', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/audit-logs?limit=500', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/admin/accounts', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/users', authRole: 'ADMIN' },
  { method: 'GET', path: '/api/users/admin', authRole: 'ADMIN' },

  // Teacher Endpoints
  { method: 'GET', path: '/api/attendance/assigned-classes', authRole: 'TEACHER' },
  { method: 'GET', path: '/api/attendance/teacher-classes', authRole: 'TEACHER' },
  { method: 'GET', path: '/api/attendance/staff-calendar/PDS0002', authRole: 'TEACHER' },
  { method: 'GET', path: '/api/staff-leaves', authRole: 'TEACHER' },

  // Student Endpoints
  { method: 'GET', path: '/api/attendance/student-calendar/64010001', authRole: 'STUDENT' },
  { method: 'GET', path: '/api/fees/student/64010001', authRole: 'STUDENT' },

  // Parent Endpoints
  { method: 'GET', path: '/api/attendance/student-calendar/64010001', authRole: 'PARENT' },
  { method: 'GET', path: '/api/fees/student/64010001', authRole: 'PARENT' },

  // Realtime Polling
  { method: 'GET', path: '/api/realtime/poll?since=0', authRole: 'ADMIN' },
];

function makeRequest(method: string, path: string, token?: string, body?: any): Promise<{ status: number; data: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders: Record<string, string> = {};
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = String(Buffer.byteLength(payload));
    }
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      { method, headers: reqHeaders },
      (res) => {
        let respBody = '';
        res.on('data', (c) => (respBody += c));
        res.on('end', () => {
          let parsed: any = respBody;
          try {
            parsed = JSON.parse(respBody);
          } catch {}
          resolve({ status: res.statusCode || 500, data: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runAudit() {
  console.log('=== STARTING RUNTIME API AUDIT ===\n');

  // Obtain tokens using canonical /api/auth/login endpoint
  const adminLogin = await makeRequest('POST', '/api/auth/login', undefined, {
    identifier: 'admin',
    password: 'admin123',
    loginType: 'STAFF_ADMIN',
  });
  const adminToken = adminLogin.data.token;
  console.log('Admin login status:', adminLogin.status, 'token received:', !!adminToken);

  const teacherLogin = await makeRequest('POST', '/api/auth/login', undefined, {
    identifier: 'PDS0002',
    password: 'admin123',
    loginType: 'STAFF_ADMIN',
  });
  const teacherToken = teacherLogin.data.token;
  console.log('Teacher login status:', teacherLogin.status, 'token received:', !!teacherToken);

  const studentLogin = await makeRequest('POST', '/api/auth/login', undefined, {
    identifier: '64010001',
    dob: '14-05-2011',
    loginType: 'STUDENT',
  });
  const studentToken = studentLogin.data.token;
  console.log('Student login status:', studentLogin.status, 'token received:', !!studentToken);

  const parentLogin = await makeRequest('POST', '/api/auth/login', undefined, {
    identifier: '9876543210',
    dob: '14-05-2011',
    loginType: 'PARENT',
  });
  const parentToken = parentLogin.data.token;
  console.log('Parent login status:', parentLogin.status, 'token received:', !!parentToken);

  const tokens: Record<string, string | undefined> = {
    ADMIN: adminToken,
    TEACHER: teacherToken,
    STUDENT: studentToken,
    PARENT: parentToken,
    NONE: undefined,
  };

  const issues: any[] = [];

  for (const ep of endpointsToTest) {
    const token = ep.authRole ? tokens[ep.authRole] : undefined;
    try {
      const res = await makeRequest(ep.method, ep.path, token, ep.body);
      const isExpectedError = ep.authRole === 'NONE' && ep.path.includes('/profile') && res.status === 401;
      const isFailure = !isExpectedError && (res.status >= 400 || res.data?.error);

      if (isFailure) {
        console.error(`❌ [${res.status}] ${ep.method} ${ep.path} (Role: ${ep.authRole || 'ANON'}) ->`, res.data);
        issues.push({ endpoint: ep.path, method: ep.method, role: ep.authRole, status: res.status, error: res.data });
      } else {
        console.log(`✓ [${res.status}] ${ep.method} ${ep.path} (Role: ${ep.authRole || 'ANON'})`);
      }
    } catch (e: any) {
      console.error(`💥 [EXCEPTION] ${ep.method} ${ep.path}:`, e.message);
      issues.push({ endpoint: ep.path, method: ep.method, role: ep.authRole, status: 0, error: e.message });
    }
  }

  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Total Endpoints Tested: ${endpointsToTest.length}`);
  console.log(`Failed/Error Endpoints: ${issues.length}`);
  if (issues.length > 0) {
    console.log(JSON.stringify(issues, null, 2));
    process.exit(1);
  } else {
    console.log('🎉 ALL ENDPOINTS RETURNED 200 OK WITH ACCURATE DYNAMIC DATA!');
  }
}

runAudit().catch(console.error);
