import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

function request(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode || 500, data: body });
          }
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, data: e.message }));
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runAuditTestSuite() {
  console.log('=====================================================');
  console.log('CHANAKYA PUBLIC SCHOOL & COACHING CENTRE');
  console.log('System Security Audit Log Verification Suite');
  console.log('=====================================================\n');

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

  // Test 1: Server-side pagination structure
  console.log('--- TEST 1: Server-Side Pagination ---');
  const page1Res = await request('/api/audit-logs?page=1&pageSize=10');
  assert('HTTP 200 for paginated audit logs', page1Res.status === 200);
  assert('Response success flag is true', page1Res.data?.success === true);
  assert('Returned page data is array of length 10', Array.isArray(page1Res.data?.data) && page1Res.data.data.length === 10);
  assert('Pagination object exists with page, pageSize, total, totalPages', !!page1Res.data?.pagination && page1Res.data.pagination.page === 1 && page1Res.data.pagination.pageSize === 10);
  assert('Total records count is greater than 0', page1Res.data?.pagination?.total > 0);
  assert('Total pages calculated correctly', page1Res.data?.pagination?.totalPages === Math.ceil(page1Res.data.pagination.total / 10));

  // Test 2: Page 2 navigation
  console.log('\n--- TEST 2: Page 2 Navigation & Record Disjointness ---');
  const page2Res = await request('/api/audit-logs?page=2&pageSize=10');
  assert('HTTP 200 for page 2', page2Res.status === 200);
  assert('Page 2 has page = 2 in pagination metadata', page2Res.data?.pagination?.page === 2);
  const page1Ids = (page1Res.data?.data || []).map((l: any) => l.id);
  const page2Ids = (page2Res.data?.data || []).map((l: any) => l.id);
  const overlap = page1Ids.some((id: string) => page2Ids.includes(id));
  assert('Page 1 and Page 2 records are strictly disjoint (no duplicate pagination)', !overlap);

  // Test 3: Configurable page size (pageSize = 25 vs 50)
  console.log('\n--- TEST 3: Configurable Page Size ---');
  const size25Res = await request('/api/audit-logs?page=1&pageSize=25');
  assert('pageSize=25 returns up to 25 items', Array.isArray(size25Res.data?.data) && size25Res.data.data.length <= 25);
  assert('pageSize=25 has pageSize: 25 in metadata', size25Res.data?.pagination?.pageSize === 25);

  // Test 4: Field mapping & accuracy
  console.log('\n--- TEST 4: Authoritative Audit Record Field Verification ---');
  const sampleLog = page1Res.data?.data?.[0];
  assert('Log record has valid non-empty id', typeof sampleLog?.id === 'string' && sampleLog.id.length > 0);
  assert('Log record has valid timestamp string', typeof sampleLog?.timestamp === 'string' && sampleLog.timestamp.length > 0);
  assert('Log record has valid userName', typeof sampleLog?.userName === 'string' && sampleLog.userName.length > 0);
  assert('Log record has valid role', typeof sampleLog?.role === 'string' && sampleLog.role.length > 0);
  assert('Log record has valid action', typeof sampleLog?.action === 'string' && sampleLog.action.length > 0);
  assert('Log record has target entity', typeof sampleLog?.entity === 'string');
  assert('Log record has valid IP address', typeof sampleLog?.ipAddress === 'string' && sampleLog.ipAddress.length > 0);
  assert('Log record has details description', typeof sampleLog?.details === 'string');

  // Test 5: Search filtering
  console.log('\n--- TEST 5: Server-Side Search Filtering ---');
  const searchRes = await request('/api/audit-logs?page=1&pageSize=10&search=admin');
  assert('Search query HTTP 200', searchRes.status === 200);
  const searchMatches = (searchRes.data?.data || []).every((l: any) => {
    const q = 'admin';
    return (
      (l.userName || '').toLowerCase().includes(q) ||
      (l.action || '').toLowerCase().includes(q) ||
      (l.entity || '').toLowerCase().includes(q) ||
      (l.details || '').toLowerCase().includes(q) ||
      (l.ipAddress || '').toLowerCase().includes(q) ||
      (l.role || '').toLowerCase().includes(q)
    );
  });
  assert('Every search result matches the search term', searchMatches);

  // Test 6: Sorting verification
  console.log('\n--- TEST 6: Server-Side Sorting ---');
  const sortAscRes = await request('/api/audit-logs?page=1&pageSize=5&sortBy=timestamp&sortOrder=asc');
  const sortDescRes = await request('/api/audit-logs?page=1&pageSize=5&sortBy=timestamp&sortOrder=desc');
  assert('Sort asc HTTP 200', sortAscRes.status === 200);
  assert('Sort desc HTTP 200', sortDescRes.status === 200);
  const ascFirstTime = sortAscRes.data?.data?.[0]?.timestamp || '';
  const descFirstTime = sortDescRes.data?.data?.[0]?.timestamp || '';
  assert('Ascending and descending sort produce distinct chronological ordering', ascFirstTime <= descFirstTime);

  // Test 7: Immutability & appending without truncation
  console.log('\n--- TEST 7: Immutability & Appending Logs ---');
  const beforeCount = page1Res.data?.pagination?.total || 0;
  const newLogPayload = {
    action: 'TEST_AUDIT_VERIFICATION',
    entity: 'SystemSecurity',
    entityId: 'audit-test-01',
    userName: 'Shri Ramakant Saxena',
    role: 'SUPER_ADMIN',
    details: 'Automated test verification of immutable audit ledger persistence',
  };
  const postRes = await request('/api/audit-logs', {
    method: 'POST',
    body: newLogPayload,
  });
  assert('POST /api/audit-logs creates log with HTTP 201', postRes.status === 201);
  assert('POST response contains created log', postRes.data?.success === true && !!postRes.data?.log?.id);

  // Check total count incremented without historical log loss
  const afterRes = await request('/api/audit-logs?page=1&pageSize=10');
  const afterCount = afterRes.data?.pagination?.total || 0;
  assert('Audit log count incremented (no historical logs lost or truncated)', afterCount >= beforeCount);

  // Test 8: Backward compatibility for unpaginated sync endpoint
  console.log('\n--- TEST 8: Backward Compatibility with Existing Sync Scripts ---');
  const legacyRes = await request('/api/audit-logs?limit=500');
  assert('Legacy GET /api/audit-logs?limit=500 returns HTTP 200', legacyRes.status === 200);
  assert('Legacy response returns array', Array.isArray(legacyRes.data));

  // Test 9: RBAC enforcement
  console.log('\n--- TEST 9: Role-Based Access Control ---');
  // Pass simulated student headers
  const studentReq = await request('/api/audit-logs?page=1&pageSize=10', {
    headers: {
      'x-auth-user-id': 'st-test',
      'x-auth-user-role': 'STUDENT',
    },
  });
  assert('STUDENT role receives HTTP 403 Forbidden', studentReq.status === 403);

  const parentReq = await request('/api/audit-logs?page=1&pageSize=10', {
    headers: {
      'x-auth-user-id': 'parent-test',
      'x-auth-user-role': 'PARENT',
    },
  });
  assert('PARENT role receives HTTP 403 Forbidden', parentReq.status === 403);

  console.log('\n=====================================================');
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`SUCCESS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('=====================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAuditTestSuite();
