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

async function verifyAttendance() {
  console.log('=== STARTING COMPREHENSIVE ATTENDANCE & HOLIDAY VERIFICATION ===\n');

  // 1. Authenticate Admin and Teacher
  const adminLogin = await postJson('/api/auth/login', { identifier: 'admin', password: 'admin123', loginType: 'STAFF_ADMIN' });
  const adminToken = adminLogin.data.token;
  if (!adminToken) throw new Error('Admin login failed');

  const teacherLogin = await postJson('/api/auth/login', { identifier: 'CPS0002', password: 'admin123', loginType: 'STAFF_ADMIN' });
  const teacherToken = teacherLogin.data.token;
  if (!teacherToken) throw new Error('Teacher login failed');

  console.log('✓ Admin and Teacher authenticated.');

  // 2. Test Assigned Classes Endpoint
  const adminClasses = await getJson('/api/attendance/assigned-classes', adminToken);
  if (!adminClasses.data.allAccess) throw new Error('Admin should have allAccess: true');
  console.log('✓ Admin assigned classes returns allAccess: true');

  const teacherClasses = await getJson('/api/attendance/assigned-classes', teacherToken);
  if (teacherClasses.data.allAccess) throw new Error('Teacher should NOT have allAccess: true');
  console.log('✓ Teacher assigned classes returns assigned classes count:', teacherClasses.data.classes?.length);

  // 3. Test Teacher Class Authorization
  const assigned = teacherClasses.data.classes[0];
  if (assigned) {
    const validSubmit = await postJson('/api/attendance', {
      classId: assigned.classId,
      section: assigned.sections[0] || 'A',
      date: '2026-10-15',
      records: [{ studentId: 'st-101', status: 'PRESENT', remarks: 'Present in class' }],
    }, teacherToken);
    console.log('✓ Teacher marks attendance for assigned class/section. Status:', validSubmit.status);
  }

  // Teacher attempts to mark attendance for non-assigned class
  const invalidSubmit = await postJson('/api/attendance', {
    classId: 'c-unassigned-999',
    section: 'Z',
    date: '2026-10-15',
    records: [{ studentId: 'st-999', status: 'PRESENT' }],
  }, teacherToken);
  if (invalidSubmit.status !== 403) throw new Error(`Expected 403 for unassigned class, got ${invalidSubmit.status}`);
  console.log('✓ Teacher rejected with 403 when attempting to mark unassigned class/section.');

  // 4. Test Holiday Creation & Holiday Attendance Blocking
  const holidayCreate = await postJson('/api/holidays', {
    name: 'National Holiday Test',
    date: '2026-10-20',
    type: 'NATIONAL',
    description: 'Test Holiday for Attendance Blocking',
  }, adminToken);
  console.log('✓ Holiday created by Admin. Status:', holidayCreate.status);

  // Attempt to mark regular attendance on holiday
  const holidayAttSubmit = await postJson('/api/attendance', {
    classId: assigned?.classId || 'c-10',
    section: assigned?.sections[0] || 'A',
    date: '2026-10-20',
    records: [{ studentId: 'st-101', status: 'PRESENT' }],
  }, adminToken);
  if (holidayAttSubmit.status !== 400) throw new Error(`Expected 400 for attendance on holiday, got ${holidayAttSubmit.status}`);
  console.log('✓ Attendance marking blocked on official school holiday with 400 Bad Request.');

  // 5. Test Student Attendance Calendar Endpoint
  const studentCal = await getJson('/api/attendance/student-calendar/st-101', adminToken);
  if (studentCal.status !== 200 || !studentCal.data.records) throw new Error('Student calendar failed');
  console.log('✓ Student attendance calendar returned records count:', studentCal.data.records.length, 'holidays count:', studentCal.data.holidays?.length);

  // 6. Test Staff Attendance Separation & RBAC
  // Teacher attempts to manage staff attendance -> MUST be 403
  const teacherStaffAtt = await postJson('/api/staff-attendance', {
    date: '2026-10-15',
    records: [{ staffId: 't-1', status: 'PRESENT' }],
  }, teacherToken);
  if (teacherStaffAtt.status !== 403) throw new Error(`Expected 403 for teacher managing staff attendance, got ${teacherStaffAtt.status}`);
  console.log('✓ Teacher rejected with 403 when trying to manage staff attendance.');

  // Admin manages staff attendance
  const adminStaffAtt = await postJson('/api/staff-attendance', {
    date: '2026-10-15',
    records: [{ staffId: 't-1', employeeId: 'CPS0001', status: 'PRESENT', checkInTime: '08:00 AM' }],
  }, adminToken);
  if (adminStaffAtt.status !== 200) throw new Error(`Admin staff attendance failed: ${JSON.stringify(adminStaffAtt.data)}`);
  console.log('✓ Admin successfully recorded staff attendance. Count:', adminStaffAtt.data.count);

  // 7. Test Staff Leave Application & Automatic Attendance Reflection
  const applyLeave = await postJson('/api/staff-leaves', {
    staffId: 't-2',
    employeeId: 'CPS0002',
    staffName: 'Mrs. Sunita Verma',
    leaveType: 'CASUAL',
    startDate: '2026-11-02',
    endDate: '2026-11-03',
    daysCount: 2,
    reason: 'Family wedding event',
  }, teacherToken);
  if (applyLeave.status !== 201) throw new Error(`Teacher leave application failed: ${JSON.stringify(applyLeave.data)}`);
  const leaveId = applyLeave.data.leave.id;
  console.log('✓ Teacher applied for leave successfully. ID:', leaveId);

  // Admin approves leave
  const approveLeave = await putJson(`/api/staff-leaves/${leaveId}/status`, {
    status: 'APPROVED',
    remarks: 'Approved by Principal',
  }, adminToken);
  if (approveLeave.status !== 200) throw new Error(`Leave approval failed: ${JSON.stringify(approveLeave.data)}`);
  console.log('✓ Leave approved by Admin/Principal.');

  // Check staff attendance on 2026-11-02 to confirm auto-reflected
  const checkStaffAtt = await getJson('/api/staff-attendance?date=2026-11-02&staffId=CPS0002', adminToken);
  const foundLeaveAtt = checkStaffAtt.data.find((a: any) => a.employeeId === 'CPS0002' && a.status === 'LEAVE');
  if (!foundLeaveAtt) throw new Error('Approved leave did not automatically reflect in staff attendance!');
  console.log('✓ Approved leave automatically reflected in staff attendance records as LEAVE!');

  // 8. Staff Calendar Endpoint
  const staffCal = await getJson('/api/attendance/staff-calendar/CPS0002', teacherToken);
  if (staffCal.status !== 200 || !staffCal.data.records) throw new Error('Staff calendar failed');
  console.log('✓ Staff attendance calendar returned records:', staffCal.data.records.length, 'leaves:', staffCal.data.leaves.length);

  console.log('\n====================================================');
  console.log('🎉 ALL DYNAMIC ROLE-BASED ATTENDANCE & HOLIDAY TESTS PASSED!');
  console.log('====================================================');
}

verifyAttendance().catch((err) => {
  console.error('❌ Attendance verification error:', err);
  process.exit(1);
});
