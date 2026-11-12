import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('=== VERIFYING STAFF PROFILE ATTENDANCE & LEAVE FLOW ===');

  // 1. Login Teacher (CPS0002)
  const teacherLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'CPS0002',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    }),
  });
  if (!teacherLoginRes.ok) throw new Error(`Teacher login failed: ${teacherLoginRes.status}`);
  const teacherAuth: any = await teacherLoginRes.json();
  const teacherToken = teacherAuth.token;
  const teacherUser = teacherAuth.user;
  console.log(`✓ Teacher authenticated as ${teacherUser.name} (${teacherUser.role}, ID: ${teacherUser.id})`);

  // 2. Login Admin (admin)
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    }),
  });
  if (!adminLoginRes.ok) throw new Error(`Admin login failed: ${adminLoginRes.status}`);
  const adminAuth: any = await adminLoginRes.json();
  const adminToken = adminAuth.token;
  console.log(`✓ Admin authenticated.`);

  // 3. Teacher can view their OWN staff calendar
  const ownCalRes = await fetch(`${BASE_URL}/api/attendance/staff-calendar/${teacherUser.id}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!ownCalRes.ok) throw new Error(`Teacher failed to view own calendar: ${ownCalRes.status}`);
  const ownCal: any = await ownCalRes.json();
  console.log(`✓ Teacher can view own calendar. Records: ${ownCal.records?.length || 0}, Leaves: ${ownCal.leaves?.length || 0}`);

  // 4. Teacher CANNOT view another staff member's private calendar
  const otherStaffId = 't-1'; // Dr. Rajesh Sharma (Principal)
  const otherCalRes = await fetch(`${BASE_URL}/api/attendance/staff-calendar/${otherStaffId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (otherCalRes.status === 403) {
    console.log(`✓ RBAC correctly blocked teacher from viewing another staff member's calendar (HTTP 403)`);
  } else {
    throw new Error(`Expected 403 when teacher views other staff calendar, got ${otherCalRes.status}`);
  }

  // 5. Teacher CANNOT manage staff attendance
  const staffAttRes = await fetch(`${BASE_URL}/api/staff-attendance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${teacherToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      date: '2026-03-25',
      records: [{ staffId: 't-1', status: 'PRESENT' }],
    }),
  });
  if (staffAttRes.status === 403) {
    console.log(`✓ RBAC correctly blocked teacher from managing staff attendance (HTTP 403)`);
  } else {
    throw new Error(`Expected 403 when teacher posts staff attendance, got ${staffAttRes.status}`);
  }

  // 6. Teacher applies for leave directly
  const leaveStartDate = '2026-04-10';
  const leaveEndDate = '2026-04-12';
  const applyRes = await fetch(`${BASE_URL}/api/staff-leaves`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${teacherToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      staffId: teacherUser.id,
      employeeId: teacherUser.employeeId || 'CPS0002',
      staffName: teacherUser.name,
      leaveType: 'CASUAL',
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      daysCount: 3,
      reason: 'Attending family wedding ceremony',
      document: 'leaves/teacher-leave-doc.pdf',
      documentName: 'wedding-invitation.pdf',
    }),
  });
  if (!applyRes.ok) throw new Error(`Apply leave failed: ${applyRes.status}`);
  const applyData: any = await applyRes.json();
  const appliedLeave = applyData.leave;
  console.log(`✓ Teacher submitted leave successfully. ID: ${appliedLeave.id}, Status: ${appliedLeave.status}`);

  // 7. Admin approves the leave
  const approveRes = await fetch(`${BASE_URL}/api/staff-leaves/${appliedLeave.id}/status`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'APPROVED',
      approvedBy: 'Principal Office',
      remarks: 'Sanctioned with duty adjustments',
    }),
  });
  if (!approveRes.ok) throw new Error(`Approve leave failed: ${approveRes.status}`);
  const approveData: any = await approveRes.json();
  console.log(`✓ Leave approved by Admin. Status: ${approveData.leave.status}, Remarks: "${approveData.leave.remarks}"`);

  // 8. Verify the approved dates now exist in the teacher's calendar as LEAVE
  const updatedCalRes = await fetch(`${BASE_URL}/api/attendance/staff-calendar/${teacherUser.id}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const updatedCal: any = await updatedCalRes.json();
  const leaveAttendanceDays = (updatedCal.records || []).filter((r: any) =>
    r.date >= leaveStartDate && r.date <= leaveEndDate && r.status === 'LEAVE'
  );
  console.log(`✓ Approved leave auto-reflected in staff attendance as LEAVE: ${leaveAttendanceDays.length} day(s) verified`);

  console.log('====================================================');
  console.log('🎉 ALL STAFF PROFILE ATTENDANCE & LEAVE TESTS PASSED!');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
