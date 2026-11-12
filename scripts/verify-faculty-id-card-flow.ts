import http from 'http';
import QRCode from 'qrcode';
import { configureIdCardQrSecret, createIdCardQrToken, parseIdCardQrToken } from '../server/services/idCardQr';
import { hasPermission } from '../src/utils/rbac';

const BASE_URL = 'http://127.0.0.1:3000';

function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; data: any; headers: any }> {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(body), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode || 500, data: body, headers: res.headers });
          }
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, data: e.message, headers: {} }));
    req.end();
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('FACULTY ID CARD GENERATION & AUTHORIZATION VERIFICATION SUITE');
  console.log('Project: CHANAKYA PUBLIC SCHOOL & COACHING CENTRE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean, extra?: any) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${desc}`);
    } else {
      console.error(`❌ [FAIL] ${desc}`, extra ? extra : '');
    }
  }

  // 1. Authorized session verification (SUPER_ADMIN)
  console.log('--- Step 1: Authorization & Staff List Loading ---');
  const adminHeaders = {
    'x-auth-user-id': 'admin-1',
    'x-auth-user-role': 'SUPER_ADMIN',
    'x-auth-employee-id': 'CPS0001',
  };

  const staffRes = await get('/api/teachers', adminHeaders);
  assert('Staff endpoint returns HTTP 200 for authenticated user', staffRes.status === 200);
  const staffList = Array.isArray(staffRes.data) ? staffRes.data : [];
  assert('Exactly 13 registered faculty members exist', staffList.length === 13, `Found ${staffList.length}`);
  console.log(`   Loaded ${staffList.length} faculty members.`);

  // 2. Single faculty member lookup endpoint (/api/teachers/:id)
  console.log('\n--- Step 2: Individual Faculty Member Direct Lookup ---');
  const sample1 = staffList[0];
  const singleStaffRes = await get(`/api/teachers/${encodeURIComponent(sample1.id)}`, adminHeaders);
  assert('Single faculty lookup by ID returns HTTP 200', singleStaffRes.status === 200);
  assert('Single faculty lookup returns correct staff member', singleStaffRes.data?.id === sample1.id && singleStaffRes.data?.name === sample1.name);

  // Lookup by employeeId
  const singleStaffByEmpId = await get(`/api/teachers/${encodeURIComponent(sample1.employeeId)}`, adminHeaders);
  assert('Single faculty lookup by employeeId returns HTTP 200', singleStaffByEmpId.status === 200);
  assert('Lookup by employeeId matches staff record', singleStaffByEmpId.data?.id === sample1.id);

  // Non-existent faculty member returns 404 cleanly
  const notFoundRes = await get('/api/teachers/non-existent-id-9999', adminHeaders);
  assert('Lookup for non-existent faculty ID returns HTTP 404 without crashing', notFoundRes.status === 404);

  // 3. Sequential and Repeated Faculty ID Card Actions (No slowdown)
  console.log('\n--- Step 3: Performance & Timing Verification Across Faculty Members ---');
  const timingResults: number[] = [];
  for (let i = 0; i < Math.min(8, staffList.length); i++) {
    const st = staffList[i];
    const t0 = performance.now();
    const res = await get(`/api/teachers/${encodeURIComponent(st.id)}`, adminHeaders);
    const duration = performance.now() - t0;
    timingResults.push(duration);
    assert(`Faculty #${i + 1} (${st.name}) loaded under 50ms`, res.status === 200 && duration < 50, `Took ${duration.toFixed(2)}ms`);
  }
  const avgTime = timingResults.reduce((a, b) => a + b, 0) / timingResults.length;
  assert('Average direct staff lookup duration is fast (< 25ms)', avgTime < 25, `Average: ${avgTime.toFixed(2)}ms`);
  console.log(`   Average lookup latency: ${avgTime.toFixed(2)}ms`);

  // 4. Signed QR code (holds only the record id and a signature)
  console.log('\n--- Step 4: Faculty QR Code (signed, no personal data) ---');
  const testStaff = staffList[0];
  configureIdCardQrSecret({ jwtSecret: 'faculty-id-card-flow-local-check' });
  const qrToken = createIdCardQrToken('STAFF', testStaff.id);
  const parsedQr = parseIdCardQrToken(qrToken);
  assert('Faculty QR token verifies and resolves to the staff id', parsedQr.ok === true && (parsedQr as any).id === testStaff.id);
  assert('Faculty QR token holds no name or phone', !qrToken.includes(testStaff.name || '~') && !qrToken.includes(testStaff.phone || '~'));
  const qrUrl1 = await QRCode.toDataURL(qrToken, { errorCorrectionLevel: 'M', margin: 1, width: 280 });
  assert('Faculty QR Code renders as a valid Data URL', qrUrl1.startsWith('data:image/png;base64,'));
  const tampered = qrToken.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  assert('Edited QR token is rejected', parseIdCardQrToken(tampered).ok === false);

  // 5. Asset resolution & CORS headers
  console.log('\n--- Step 5: Media Assets & Cross-Origin Accessibility ---');
  const logoRes = await get('/api/files/content?key=school/school-logo/logo.png');
  assert('School logo returns HTTP 200', logoRes.status === 200);
  assert('School logo sets Access-Control-Allow-Origin: *', logoRes.headers['access-control-allow-origin'] === '*');

  const sigRes = await get('/api/files/content?key=school/school-logo/principal-signature.png');
  assert('Principal signature returns HTTP 200', sigRes.status === 200);
  assert('Principal signature sets Access-Control-Allow-Origin: *', sigRes.headers['access-control-allow-origin'] === '*');

  // 6. RBAC Verification
  console.log('\n--- Step 6: RBAC Authorization Verification ---');
  const superAdminAuthorized = hasPermission({ role: 'SUPER_ADMIN' as any }, 'documents.generate');
  assert('SUPER_ADMIN is authorized for documents.generate', superAdminAuthorized === true);

  const principalAuthorized = hasPermission({ role: 'PRINCIPAL' as any }, 'documents.generate');
  assert('PRINCIPAL is authorized for documents.generate', principalAuthorized === true);

  const coordinatorAuthorized = hasPermission({ role: 'ACADEMIC_COORDINATOR' as any }, 'documents.generate');
  assert('ACADEMIC_COORDINATOR is authorized for documents.generate', coordinatorAuthorized === true);

  const studentAuthorized = hasPermission({ role: 'STUDENT' as any }, 'documents.generate');
  assert('STUDENT role is blocked from documents.generate', studentAuthorized === false);

  const parentAuthorized = hasPermission({ role: 'PARENT' as any }, 'documents.generate');
  assert('PARENT role is blocked from documents.generate', parentAuthorized === false);

  const anonymousAuthorized = hasPermission(null, 'documents.generate');
  assert('Unauthenticated user is blocked from documents.generate', anonymousAuthorized === false);

  // 7. Verify All Tabs in Report & ID Cards Module
  console.log('\n--- Step 7: Report & ID Cards Module Cross-Tab Verification ---');
  const studentsRes = await get('/api/students?limit=20');
  assert('Tab 1: Students dataset loaded for Student ID Cards', studentsRes.status === 200 && Array.isArray(studentsRes.data));

  const examsRes = await get('/api/exams');
  assert('Tab 3: Exams dataset loaded for CBSE Report Cards', examsRes.status === 200 && Array.isArray(examsRes.data));

  const marksRes = await get('/api/marks');
  assert('Tab 3: Marks dataset loaded for Report Cards', marksRes.status === 200 && Array.isArray(marksRes.data));

  const r2StatusRes = await get('/api/files/storage-status');
  assert('Tab 5: Digital Vault (R2) operational status returns HTTP 200', r2StatusRes.status === 200);

  console.log('\n================================================================');
  console.log(`TOTAL SUITE CHECKS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite();
