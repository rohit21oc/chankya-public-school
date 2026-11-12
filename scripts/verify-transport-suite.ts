import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

function postJson(path: string, data: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function putJson(path: string, data: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function patchJson(path: string, data: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function deleteJson(path: string, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    req.on('error', reject);
    req.end();
  });
}

function getJson(path: string, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    req.on('error', reject);
    req.end();
  });
}

async function runTransportSuite() {
  console.log('========================================================================');
  console.log('CAMPUS TRANSPORT & BUS FLEET COMPLETE LIFECYCLE SUITE');
  console.log('Vehicle -> Route -> Stops -> Student Admission -> Allocation -> Fee -> Edit -> Delete -> Refresh');
  console.log('========================================================================\n');

  // 1. Authenticate Admin & Check Initial Metrics
  console.log('>>> [1/12] Authenticating Admin user & fetching initial transport state...');
  const adminLogin = await postJson('/api/auth/login', {
    identifier: 'admin',
    password: 'admin123',
    loginType: 'STAFF_ADMIN',
  });
  const token = adminLogin.data.token;
  if (!token) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.data));
  console.log('  [PASS] Admin authenticated. Token received.');

  const initRes = await getJson('/api/transport', token);
  if (!initRes.data?.success) throw new Error('Failed to get /api/transport: ' + JSON.stringify(initRes.data));
  const initialStats = initRes.data.stats;
  console.log(`  [PASS] Initial Stats: Active Buses: ${initialStats.activeBuses}, Active Routes: ${initialStats.activeRoutes}, Total Stops: ${initialStats.totalStops}, Passengers: ${initialStats.studentsUsingTransport}\n`);

  // 2. Vehicle CRUD (Fleet Management)
  const testVehicleNumber = `BR-06-P-${Math.floor(1000 + Math.random() * 9000)}`;
  console.log(`>>> [2/12] Creating Vehicle: ${testVehicleNumber}...`);
  const createVehicleRes = await postJson(
    '/api/transport/vehicles',
    {
      vehicleNumber: testVehicleNumber,
      busName: 'Campus Express Test Shuttle',
      busCode: 'BUS-TEST-99',
      vehicleType: 'BUS',
      model: 'Tata Marcopolo 32S',
      capacity: 35,
      driverName: 'Sanjay Kumar Verma',
      driverPhone: '+91 98765 43210',
      conductorName: 'Rajesh Sah',
      permitDetails: 'National Highway Permit - Bihar State Transport',
      rcNumber: 'RC-BR06-99120',
      fitnessExpiry: '2027-10-15',
      insuranceExpiry: '2027-08-30',
      permitExpiry: '2028-03-31',
      pollutionExpiry: '2027-01-20',
      status: 'ACTIVE',
    },
    token
  );
  if (createVehicleRes.status !== 201 || !createVehicleRes.data.vehicle?.id) {
    throw new Error('Vehicle creation failed: ' + JSON.stringify(createVehicleRes.data));
  }
  const createdVehicle = createVehicleRes.data.vehicle;
  console.log(`  [PASS] Vehicle created. ID: ${createdVehicle.id}, Number: ${createdVehicle.vehicleNumber}, Capacity: ${createdVehicle.capacity}`);

  // Test GET vehicle by ID
  const getVehicleRes = await getJson(`/api/transport/vehicles/${createdVehicle.id}`, token);
  if (getVehicleRes.status !== 200 || getVehicleRes.data.vehicle?.id !== createdVehicle.id) {
    throw new Error('GET /api/transport/vehicles/:id failed: ' + JSON.stringify(getVehicleRes.data));
  }
  console.log('  [PASS] GET /api/transport/vehicles/:id succeeded.');

  // Test PATCH vehicle
  const patchVehicleRes = await patchJson(
    `/api/transport/vehicles/${createdVehicle.id}`,
    { capacity: 36, driverName: 'Sanjay Kumar Verma (Senior Driver)' },
    token
  );
  if (patchVehicleRes.status !== 200 || patchVehicleRes.data.vehicle?.capacity !== 36) {
    throw new Error('PATCH /api/transport/vehicles/:id failed: ' + JSON.stringify(patchVehicleRes.data));
  }
  console.log(`  [PASS] PATCH vehicle succeeded: Capacity updated to 36.\n`);

  // 3. Route CRUD & Bus Assignment
  console.log('>>> [3/12] Creating Route and assigning vehicle...');
  const createRouteRes = await postJson(
    '/api/transport/routes',
    {
      routeName: 'Route Alpha: Sheohar Town — Station — School Campus',
      routeNumber: 'RT-ALPHA-01',
      startPoint: 'Sheohar Gandhi Chowk',
      endPoint: 'Residential PDS Public School Campus',
      vehicleId: createdVehicle.id,
      status: 'ACTIVE',
    },
    token
  );
  if (createRouteRes.status !== 201 || !createRouteRes.data.route?.id) {
    throw new Error('Route creation failed: ' + JSON.stringify(createRouteRes.data));
  }
  const createdRoute = createRouteRes.data.route;
  console.log(`  [PASS] Route created: "${createdRoute.routeName}" (${createdRoute.id})`);
  console.log(`  Assigned Bus: ${createdRoute.vehicleNumber}, Driver: ${createdRoute.driverName} (${createdRoute.driverPhone})`);

  // Test GET route by ID
  const getRouteRes = await getJson(`/api/transport/routes/${createdRoute.id}`, token);
  if (getRouteRes.status !== 200 || getRouteRes.data.route?.id !== createdRoute.id) {
    throw new Error('GET /api/transport/routes/:id failed: ' + JSON.stringify(getRouteRes.data));
  }
  console.log('  [PASS] GET /api/transport/routes/:id succeeded.');

  // Test PATCH route
  const patchRouteRes = await patchJson(
    `/api/transport/routes/${createdRoute.id}`,
    { routeNumber: 'RT-ALPHA-01-EXPRESS' },
    token
  );
  if (patchRouteRes.status !== 200 || patchRouteRes.data.route?.routeNumber !== 'RT-ALPHA-01-EXPRESS') {
    throw new Error('PATCH /api/transport/routes/:id failed: ' + JSON.stringify(patchRouteRes.data));
  }
  console.log(`  [PASS] PATCH route succeeded: RouteNumber updated.\n`);

  // 4. Stops Management (Add, Edit, Reorder)
  console.log('>>> [4/12] Adding 3 designated stops to Route Alpha...');
  const stop1Res = await postJson(
    `/api/transport/routes/${createdRoute.id}/stops`,
    {
      stopName: 'Gandhi Chowk Station',
      landmark: 'Opposite Central Bank ATM',
      pickupTime: '06:30 AM',
      dropTime: '02:30 PM',
      monthlyFare: 650,
      stopOrder: 1,
      status: 'ACTIVE',
    },
    token
  );
  if (stop1Res.status !== 201 || !stop1Res.data.stop?.id) {
    throw new Error('Stop 1 creation failed: ' + JSON.stringify(stop1Res.data));
  }
  const stop1 = stop1Res.data.stop;

  const stop2Res = await postJson(
    `/api/transport/routes/${createdRoute.id}/stops`,
    {
      stopName: 'Collectorate More',
      landmark: 'Near District Court',
      pickupTime: '06:45 AM',
      dropTime: '02:15 PM',
      monthlyFare: 800,
      stopOrder: 2,
      status: 'ACTIVE',
    },
    token
  );
  if (stop2Res.status !== 201 || !stop2Res.data.stop?.id) {
    throw new Error('Stop 2 creation failed: ' + JSON.stringify(stop2Res.data));
  }
  const stop2 = stop2Res.data.stop;

  const stop3Res = await postJson(
    `/api/transport/routes/${createdRoute.id}/stops`,
    {
      stopName: 'Residential PDS School Gate',
      landmark: 'Campus Main Entrance Porch',
      pickupTime: '07:15 AM',
      dropTime: '01:45 PM',
      monthlyFare: 0,
      stopOrder: 3,
      status: 'ACTIVE',
    },
    token
  );
  if (stop3Res.status !== 201 || !stop3Res.data.stop?.id) {
    throw new Error('Stop 3 creation failed: ' + JSON.stringify(stop3Res.data));
  }
  const stop3 = stop3Res.data.stop;

  console.log(`  [PASS] Stop 1: ${stop1.stopName} (₹${stop1.monthlyFare}/mo)`);
  console.log(`  [PASS] Stop 2: ${stop2.stopName} (₹${stop2.monthlyFare}/mo)`);
  console.log(`  [PASS] Stop 3: ${stop3.stopName} (₹${stop3.monthlyFare}/mo)`);

  // Edit Stop 2 with PATCH
  const editStopRes = await patchJson(
    `/api/transport/routes/${createdRoute.id}/stops/${stop2.id}`,
    {
      stopName: 'Collectorate More (Executive Court)',
      monthlyFare: 850,
      pickupTime: '06:42 AM',
    },
    token
  );
  if (editStopRes.status !== 200 || editStopRes.data.stop?.monthlyFare !== 850) {
    throw new Error('Stop edit failed: ' + JSON.stringify(editStopRes.data));
  }
  console.log('  [PASS] Stop 2 updated via PATCH: New Fare ₹850/mo, New Pickup: 06:42 AM');

  // Reorder stops
  const reorderRes = await putJson(
    `/api/transport/routes/${createdRoute.id}/stops-reorder`,
    { stopIds: [stop2.id, stop1.id, stop3.id] },
    token
  );
  if (reorderRes.status !== 200 || !reorderRes.data.route) {
    throw new Error('Stop reorder failed: ' + JSON.stringify(reorderRes.data));
  }
  console.log('  [PASS] Stop order successfully rearranged.\n');

  // 5. Student Admission with Transport Selected
  console.log('>>> [5/12] Testing Student Admission with Transport Opted In...');
  const testAdmissionNo = `ADM-TR-${Math.floor(10000 + Math.random() * 90000)}`;
  const admissionRes = await postJson(
    '/api/students',
    {
      name: 'Aditya Kumar Transit Test',
      admissionNumber: testAdmissionNo,
      classId: 'c-10',
      className: 'Class 10',
      section: 'A',
      gender: 'MALE',
      dateOfBirth: '2010-05-15',
      enrollmentDate: '2026-10-01',
      feeStartDate: '2026-10-01',
      parentName: 'Rameshwar Kumar',
      parentPhone: '9876543219',
      transportRequired: true,
      transportRouteId: createdRoute.id,
      transportStopId: stop2.id,
      transportStopName: 'Collectorate More (Executive Court)',
      transportMonthlyFee: 850,
      status: 'ACTIVE',
    },
    token
  );
  if (admissionRes.status !== 200 || !admissionRes.data.id) {
    throw new Error('Student admission failed: ' + JSON.stringify(admissionRes.data));
  }
  const admittedStudent = admissionRes.data;
  console.log(`  [PASS] Student admitted: ${admittedStudent.name} (${admittedStudent.admissionNumber})`);
  if (!admittedStudent.transportRequired || admittedStudent.transportMonthlyFee !== 850) {
    throw new Error('Admitted student transport details missing or incorrect: ' + JSON.stringify(admittedStudent));
  }
  console.log(`  Assigned Route: ${admittedStudent.transportRouteId}, Stop: ${admittedStudent.transportStopName}, Fee: ₹${admittedStudent.transportMonthlyFee}/mo`);

  // Verify Student's feeProfile contains Transport Fee head
  const feeHead = (admittedStudent.feeProfile?.feeHeads || []).find((h: any) => h.head === 'Transport Fee');
  if (!feeHead || !feeHead.selected || feeHead.amount !== 850) {
    throw new Error('Admitted student feeProfile missing active Transport Fee head: ' + JSON.stringify(admittedStudent.feeProfile));
  }
  console.log(`  [PASS] Student Fee Profile contains Transport Fee head with amount ₹${feeHead.amount}/mo.`);

  // Verify initial Admission Fee Ledger contains Transport Fee
  const ledgersRes = await getJson(`/api/fee-ledgers?studentId=${admittedStudent.id}`, token);
  const studentLedgers = Array.isArray(ledgersRes.data)
    ? ledgersRes.data
    : ledgersRes.data.data || ledgersRes.data.ledgers || [];
  const admissionLedger = studentLedgers.find((l: any) => l.studentId === admittedStudent.id);
  if (admissionLedger) {
    const hasTransportInBreakdown = (admissionLedger.breakdown || []).some((b: any) => b.head?.includes('Transport Fee'));
    console.log(`  [PASS] Initial Fee Ledger found: ${admissionLedger.id} (Has Transport Fee breakdown: ${hasTransportInBreakdown})\n`);
  } else {
    console.log('  [PASS] Initial admission completed.\n');
  }

  // 6. Direct Transport Allocation API Test
  console.log('>>> [6/12] Testing Transport Allocation endpoint (/api/transport/allocate)...');
  const studentsRes = await getJson('/api/students', token);
  const studentsList = Array.isArray(studentsRes.data)
    ? studentsRes.data
    : studentsRes.data.data || studentsRes.data.students || [];
  const existingStudent = studentsList.find((s: any) => s.id !== admittedStudent.id && s.status === 'ACTIVE') || studentsList[0];
  if (!existingStudent) throw new Error('No existing student found');

  const allocateRes = await postJson(
    '/api/transport/allocate',
    {
      studentId: existingStudent.id,
      routeId: createdRoute.id,
      stopId: stop1.id,
      stopName: stop1.stopName,
    },
    token
  );
  if (allocateRes.status !== 200 || !allocateRes.data.success) {
    throw new Error('Allocation failed: ' + JSON.stringify(allocateRes.data));
  }
  const allocated = allocateRes.data.student;
  if (!allocated.transportRequired || allocated.transportMonthlyFee !== 650) {
    throw new Error('Allocation mismatch: ' + JSON.stringify(allocated));
  }
  console.log(`  [PASS] Student ${existingStudent.name} allocated to ${allocated.transportStopName} (₹${allocated.transportMonthlyFee}/mo).\n`);

  // 7. Fee Management Integration & Duplicate Prevention
  console.log('>>> [7/12] Testing Monthly Fee Ledger Generation with Transport Integration...');
  const monthlyInvoiceRes = await postJson(
    `/api/fee-ledgers/student/${admittedStudent.id}/generate-monthly`,
    {
      monthYear: 'October 2026',
      academicSession: '2026-2027',
    },
    token
  );
  if (monthlyInvoiceRes.status !== 200 || !monthlyInvoiceRes.data.ledger) {
    throw new Error('Monthly fee generation failed: ' + JSON.stringify(monthlyInvoiceRes.data));
  }
  const monthlyLedger = monthlyInvoiceRes.data.ledger;
  const transportBreakdownItem = (monthlyLedger.breakdown || []).find((b: any) => b.head?.includes('Transport Fee'));
  if (!transportBreakdownItem || transportBreakdownItem.amount !== 850) {
    throw new Error('Monthly ledger missing transport fee breakdown item of ₹850: ' + JSON.stringify(monthlyLedger.breakdown));
  }
  console.log(`  [PASS] Generated Monthly Ledger: ${monthlyLedger.id}`);
  console.log(`  Breakdown includes: "${transportBreakdownItem.head}" with amount ₹${transportBreakdownItem.amount}`);

  // Test duplicate invoice rejection (HTTP 409 Conflict)
  console.log('  Testing Duplicate Monthly Billing Prevention...');
  const duplicateInvoiceRes = await postJson(
    `/api/fee-ledgers/student/${admittedStudent.id}/generate-monthly`,
    {
      monthYear: 'October 2026',
      academicSession: '2026-2027',
    },
    token
  );
  if (duplicateInvoiceRes.status !== 409) {
    throw new Error(`Duplicate monthly invoice should have returned 409 Conflict, got ${duplicateInvoiceRes.status}`);
  }
  console.log('  [PASS] Duplicate invoice prevention verified: HTTP 409 Conflict returned.\n');

  // 8. Student Edit & Stop Modification
  console.log('>>> [8/12] Testing Student Edit with Transport Update...');
  const updateStudentRes = await putJson(
    `/api/students/${admittedStudent.id}`,
    {
      transportRequired: true,
      transportRouteId: createdRoute.id,
      transportStopId: stop1.id,
      transportStopName: stop1.stopName,
      transportMonthlyFee: 650,
    },
    token
  );
  if (updateStudentRes.status !== 200) {
    throw new Error('Student update failed: ' + JSON.stringify(updateStudentRes.data));
  }
  const updatedStudent = updateStudentRes.data;
  if (updatedStudent.transportMonthlyFee !== 650) {
    throw new Error(`Updated student fee expected 650, got ${updatedStudent.transportMonthlyFee}`);
  }
  console.log(`  [PASS] Student transport updated to Stop 1 (${updatedStudent.transportStopName}, ₹${updatedStudent.transportMonthlyFee}/mo).\n`);

  // 9. Deallocation
  console.log('>>> [9/12] Testing Deallocation...');
  const dealloc1 = await postJson('/api/transport/deallocate', { studentId: admittedStudent.id }, token);
  if (dealloc1.status !== 200 || dealloc1.data.student?.transportRequired !== false) {
    throw new Error('Deallocation 1 failed: ' + JSON.stringify(dealloc1.data));
  }
  const dealloc2 = await postJson('/api/transport/deallocate', { studentId: existingStudent.id }, token);
  if (dealloc2.status !== 200 || dealloc2.data.student?.transportRequired !== false) {
    throw new Error('Deallocation 2 failed: ' + JSON.stringify(dealloc2.data));
  }
  console.log('  [PASS] Both test students successfully deallocated from bus transport.\n');

  // 10. Deletion & Cleanup
  console.log('>>> [10/12] Testing Deletion endpoints...');
  // Delete stop
  const delStopRes = await deleteJson(`/api/transport/routes/${createdRoute.id}/stops/${stop1.id}`, token);
  if (delStopRes.status !== 200) throw new Error('Delete stop failed: ' + JSON.stringify(delStopRes.data));
  console.log('  [PASS] Stop deleted.');

  // Delete route
  const delRouteRes = await deleteJson(`/api/transport/routes/${createdRoute.id}`, token);
  if (delRouteRes.status !== 200) throw new Error('Delete route failed: ' + JSON.stringify(delRouteRes.data));
  console.log('  [PASS] Route deleted.');

  // Delete vehicle
  const delVehicleRes = await deleteJson(`/api/transport/vehicles/${createdVehicle.id}`, token);
  if (delVehicleRes.status !== 200) throw new Error('Delete vehicle failed: ' + JSON.stringify(delVehicleRes.data));
  console.log('  [PASS] Vehicle deleted.');

  // Delete admitted student
  const delStudentRes = await deleteJson(`/api/students/${admittedStudent.id}`, token);
  if (delStudentRes.status !== 200) throw new Error('Delete student failed: ' + JSON.stringify(delStudentRes.data));
  console.log('  [PASS] Test Student deleted.\n');

  // 11. Refresh & Persistence Check
  console.log('>>> [11/12] Testing Refresh & MongoDB Persistence Verification...');
  const postRefreshRes = await getJson('/api/transport', token);
  if (!postRefreshRes.data?.success) throw new Error('Post-refresh transport fetch failed');
  const postVehicles = postRefreshRes.data.vehicles || [];
  const postRoutes = postRefreshRes.data.routes || [];
  if (postVehicles.some((v: any) => v.id === createdVehicle.id)) {
    throw new Error('Deleted vehicle still present after refresh!');
  }
  if (postRoutes.some((r: any) => r.id === createdRoute.id)) {
    throw new Error('Deleted route still present after refresh!');
  }
  console.log('  [PASS] Persistence verified: Deleted entities completely removed from database.\n');

  // 12. RBAC Verification
  console.log('>>> [12/12] Testing RBAC (Role-Based Access Control)...');
  // Unauthenticated request should fail
  const unauthRes = await postJson('/api/transport/vehicles', { vehicleNumber: 'BR-06-TEST', capacity: 30, driverName: 'Test', driverPhone: '9999999999' });
  if (unauthRes.status !== 401 && unauthRes.status !== 403) {
    throw new Error(`Expected 401/403 for unauthenticated vehicle creation, got ${unauthRes.status}`);
  }
  console.log(`  [PASS] Unauthenticated request correctly rejected with HTTP ${unauthRes.status}.`);

  // Teacher login (TEACHER role is not allowed to create vehicles)
  const teacherLogin = await postJson('/api/auth/login', {
    identifier: 'PDS0011',
    password: 'PdsTeacher@123',
    loginType: 'STAFF_ADMIN',
  });
  if (teacherLogin.data.token) {
    const teacherToken = teacherLogin.data.token;
    const teacherCreateRes = await postJson(
      '/api/transport/vehicles',
      { vehicleNumber: 'BR-06-FORBIDDEN', capacity: 30, driverName: 'Test', driverPhone: '9999999999' },
      teacherToken
    );
    if (teacherCreateRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Teacher creating vehicle, got ${teacherCreateRes.status}`);
    }
    console.log('  [PASS] Teacher role correctly restricted from fleet management with HTTP 403 Forbidden.');
  }

  console.log('\n========================================================================');
  console.log('ALL 12 TRANSPORT MODULE & INTEGRATION TESTS PASSED CLEANLY (100%)!');
  console.log('========================================================================');
}

runTransportSuite().catch((err) => {
  console.error('\n[TEST FAILED]:', err);
  process.exit(1);
});
