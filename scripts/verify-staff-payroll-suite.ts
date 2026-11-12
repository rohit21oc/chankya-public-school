import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('================================================================');
  console.log('=== VERIFYING STAFF REGISTRATION & AUTOMATED PAYROLL SUITE ===');
  console.log('================================================================');

  // 1. Authenticate Super Admin
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
  console.log('✓ 1. Admin authenticated successfully');

  // 2. Authenticate Teacher (PDS0002)
  const teacherLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'PDS0002',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    }),
  });
  if (!teacherLoginRes.ok) throw new Error(`Teacher login failed: ${teacherLoginRes.status}`);
  const teacherAuth: any = await teacherLoginRes.json();
  const teacherToken = teacherAuth.token;
  const teacherUser = teacherAuth.user;
  console.log(`✓ 2. Teacher PDS0002 authenticated: ${teacherUser.name} (${teacherUser.id})`);

  // 3. Register a new Staff Member with UAN Number, Father's Name, Mother's Name, Monthly Salary
  const testEmpId = `TEST${Date.now().toString().slice(-4)}`;
  const testStaffPayload = {
    name: 'Vikramaditya Roy',
    fatherName: 'Late Someshwar Roy',
    motherName: 'Suniti Roy',
    dob: '1988-06-15',
    gender: 'MALE',
    bloodGroup: 'O+',
    phone: '9876501234',
    email: `vikram.${Date.now()}@pdsschool.edu.in`,
    designation: 'Senior TGT Science Teacher',
    department: 'SCIENCE',
    qualification: 'M.Sc. Physics, B.Ed.',
    experienceYears: 7,
    joiningDate: '2026-04-01',
    monthlySalary: 36000,
    uanNumber: '100987654321',
    panNumber: 'ABCDE1234F',
    bankAccountNo: '9876543210987',
    bankName: 'State Bank of India',
    bankBranch: 'Sheohar Main Branch',
    ifscCode: 'SBIN0001234',
    portalRole: 'TEACHER',
    systemRole: 'TEACHER',
    role: 'TEACHER',
    status: 'ACTIVE',
  };

  const createStaffRes = await fetch(`${BASE_URL}/api/staff`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testStaffPayload),
  });
  const createStaffData: any = await createStaffRes.json();
  const createdStaff: any = createStaffData.staff || createStaffData;
  console.log(`✓ 3. Staff registration successful. ID: ${createdStaff.id}, EmpId: ${createdStaff.employeeId}`);

  // Verify created staff fields
  if (createdStaff.uanNumber !== '100987654321') {
    throw new Error(`Expected UAN Number 100987654321, got ${createdStaff.uanNumber}`);
  }
  if (createdStaff.fatherName !== 'Late Someshwar Roy') {
    throw new Error(`Expected Father's Name 'Late Someshwar Roy', got ${createdStaff.fatherName}`);
  }
  if (createdStaff.motherName !== 'Suniti Roy') {
    throw new Error(`Expected Mother's Name 'Suniti Roy', got ${createdStaff.motherName}`);
  }
  if (createdStaff.monthlySalary !== 36000) {
    throw new Error(`Expected Monthly Salary 36000, got ${createdStaff.monthlySalary}`);
  }
  console.log(`✓ 4. Verified UAN Number (${createdStaff.uanNumber}), Father's Name (${createdStaff.fatherName}), and Mother's Name (${createdStaff.motherName})`);

  // 4. Test Attendance & Deductions for September 2026:
  // Setup 2 late days and 1 unpaid leave day for this staff member
  const attRes1 = await fetch(`${BASE_URL}/api/staff-attendance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      date: '2026-09-02',
      records: [{ staffId: createdStaff.id, status: 'LATE' }],
    }),
  });
  if (!attRes1.ok) throw new Error(`Failed to log late attendance: ${attRes1.status}`);

  const attRes2 = await fetch(`${BASE_URL}/api/staff-attendance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      date: '2026-09-03',
      records: [{ staffId: createdStaff.id, status: 'LATE' }],
    }),
  });
  if (!attRes2.ok) throw new Error(`Failed to log late attendance 2: ${attRes2.status}`);

  const attRes3 = await fetch(`${BASE_URL}/api/staff-attendance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      date: '2026-09-04',
      records: [{ staffId: createdStaff.id, status: 'ABSENT' }], // Unpaid absence
    }),
  });
  if (!attRes3.ok) throw new Error(`Failed to log absent attendance: ${attRes3.status}`);
  console.log('✓ 5. Attendance marked: 2 LATE days, 1 ABSENT (unpaid) day in September 2026');

  // 5. Trigger automated payroll generation for September 2026
  const genRes = await fetch(`${BASE_URL}/api/staff-payroll/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      month: '2026-09',
      year: 2026,
      force: true,
    }),
  });
  if (!genRes.ok) throw new Error(`Payroll generation failed: ${genRes.status}`);
  const genData: any = await genRes.json();
  console.log(`✓ 6. Payroll generation executed: ${genData.message}`);

  // 6. Fetch payroll record for created staff member in September 2026
  const fetchPayrollRes = await fetch(`${BASE_URL}/api/staff-payroll?staffId=${createdStaff.id}&month=2026-09`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  if (!fetchPayrollRes.ok) throw new Error(`Failed to fetch payroll record: ${fetchPayrollRes.status}`);
  const payrollRecords: any = await fetchPayrollRes.json();
  const staffPayroll = payrollRecords.find((p: any) => p.staffId === createdStaff.id);
  if (!staffPayroll) throw new Error(`No payroll record found for staff ${createdStaff.id} in September 2026`);

  console.log('✓ 7. Retrieved payroll record for staff member:', {
    staffName: staffPayroll.staffName,
    monthlySalary: staffPayroll.monthlySalary,
    dailySalary: staffPayroll.dailySalary,
    lateDays: staffPayroll.lateDays,
    lateDeduction: staffPayroll.lateDeduction,
    unpaidLeaveDays: staffPayroll.unpaidLeaveDays,
    unpaidLeaveDeduction: staffPayroll.unpaidLeaveDeduction,
    totalDeductions: staffPayroll.totalDeductions,
    netSalary: staffPayroll.netSalary,
    paymentStatus: staffPayroll.paymentStatus,
  });

  // Verify Mathematical Deduction Invariants:
  // Monthly salary: 36,000
  // Daily salary: 36,000 / 30 = 1,200
  // Late days: 2 -> Late deduction = 1,200 * 0.25 * 2 = 600
  // Unpaid leave days: 1 -> Unpaid deduction = 1,200 * 1 = 1,200
  // Total deductions: 600 + 1,200 = 1,800
  // Net salary: 36,000 - 1,800 = 34,200
  const expectedDaily = 1200;
  const expectedLateDeduction = 600;
  const expectedUnpaidDeduction = 1200;
  const expectedNetSalary = 34200;

  if (Math.abs(staffPayroll.dailySalary - expectedDaily) > 0.01) {
    throw new Error(`Daily salary mismatch: expected ${expectedDaily}, got ${staffPayroll.dailySalary}`);
  }
  if (Math.abs(staffPayroll.lateDeduction - expectedLateDeduction) > 0.01) {
    throw new Error(`Late deduction mismatch (25% per late day): expected ${expectedLateDeduction}, got ${staffPayroll.lateDeduction}`);
  }
  if (Math.abs(staffPayroll.unpaidLeaveDeduction - expectedUnpaidDeduction) > 0.01) {
    throw new Error(`Unpaid leave deduction mismatch (100% per unpaid day): expected ${expectedUnpaidDeduction}, got ${staffPayroll.unpaidLeaveDeduction}`);
  }
  if (Math.abs(staffPayroll.netSalary - expectedNetSalary) > 0.01) {
    throw new Error(`Net salary mismatch: expected ${expectedNetSalary}, got ${staffPayroll.netSalary}`);
  }
  console.log('✓ 8. Deduction calculations verified mathematically: 25% daily deduction for late, 100% for unpaid leave');

  // 7. Duplicate Prevention Test:
  // Re-run payroll generation without force. Should skip existing record without creating duplicates.
  const reGenRes = await fetch(`${BASE_URL}/api/staff-payroll/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      month: '2026-09',
      year: 2026,
      force: false,
    }),
  });
  if (!reGenRes.ok) throw new Error(`Re-generation failed: ${reGenRes.status}`);
  const reGenData: any = await reGenRes.json();
  console.log(`✓ 9. Re-generation duplicate prevention verified: skipped ${reGenData.skippedCount || 0} existing records`);

  const countRes = await fetch(`${BASE_URL}/api/staff-payroll?staffId=${createdStaff.id}&month=2026-09`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const countRecords: any = await countRes.json();
  const matchingRecords = countRecords.filter((p: any) => p.staffId === createdStaff.id && p.payrollMonth === '2026-09');
  if (matchingRecords.length !== 1) {
    throw new Error(`Duplicate detected! Expected exactly 1 record for ${createdStaff.id} in 2026-09, found ${matchingRecords.length}`);
  }
  console.log('✓ 10. Duplicate check passed: exactly 1 payroll record exists');

  // 8. Test Recording Payment (Mark Salary Paid)
  const payRes = await fetch(`${BASE_URL}/api/staff-payroll/${staffPayroll.id}/pay`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: '2026-10-05',
      transactionReference: 'NEFT-SBI-202609001',
      remarks: 'Disbursed on time via CMS direct credit',
    }),
  });
  if (!payRes.ok) throw new Error(`Mark salary paid failed: ${payRes.status}`);
  const payData: any = await payRes.json();
  if (payData.record.paymentStatus !== 'PAID') {
    throw new Error(`Expected paymentStatus PAID, got ${payData.record.paymentStatus}`);
  }
  if (payData.record.transactionReference !== 'NEFT-SBI-202609001') {
    throw new Error(`Expected transactionReference NEFT-SBI-202609001, got ${payData.record.transactionReference}`);
  }
  console.log('✓ 11. Salary payment recorded successfully (Status: PAID, Ref: NEFT-SBI-202609001)');

  // 9. Test Self-Access & Salary Slip View for Teacher
  // Generate September 2026 payroll for teacher PDS0002
  const teacherHistoryRes = await fetch(`${BASE_URL}/api/staff-payroll/history/${teacherUser.id}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!teacherHistoryRes.ok) throw new Error(`Teacher failed to access own payroll history: ${teacherHistoryRes.status}`);
  const teacherHistory: any = await teacherHistoryRes.json();
  console.log(`✓ 12. Teacher can securely view own salary history (${teacherHistory.length} records)`);

  // Teacher CANNOT view another staff member's salary history (RBAC enforcement)
  const forbiddenHistoryRes = await fetch(`${BASE_URL}/api/staff-payroll/history/${createdStaff.id}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (forbiddenHistoryRes.status !== 403) {
    throw new Error(`Expected HTTP 403 when teacher accesses another staff member's payroll history, got ${forbiddenHistoryRes.status}`);
  }
  console.log('✓ 13. RBAC enforced: Teacher is blocked from viewing another staff member\'s payroll history (HTTP 403)');

  // 10. Staff Profile Update & Synchronization with Staff Salary
  const updatedUAN = '100987659999';
  const updatedName = 'Dr. Vikramaditya Roy';
  const updateStaffRes = await fetch(`${BASE_URL}/api/staff/${createdStaff.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: updatedName,
      uanNumber: updatedUAN,
    }),
  });
  if (!updateStaffRes.ok) throw new Error(`Update staff failed: ${updateStaffRes.status}`);
  const updatedStaff: any = await updateStaffRes.json();
  if (updatedStaff.uanNumber !== updatedUAN || updatedStaff.name !== updatedName) {
    throw new Error(`Staff update failed to persist UAN or name`);
  }

  // Check that staff payroll records reflect synchronized UAN and Name
  const syncCheckRes = await fetch(`${BASE_URL}/api/staff-payroll/${staffPayroll.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!syncCheckRes.ok) throw new Error(`Failed to fetch payroll record after sync: ${syncCheckRes.status}`);
  const syncedPayroll: any = await syncCheckRes.json();
  if (syncedPayroll.uanNumber !== updatedUAN) {
    throw new Error(`Synchronization failure: expected UAN ${updatedUAN} on payroll record, got ${syncedPayroll.uanNumber}`);
  }
  if (syncedPayroll.staffName !== updatedName) {
    throw new Error(`Synchronization failure: expected name ${updatedName} on payroll record, got ${syncedPayroll.staffName}`);
  }
  console.log(`✓ 14. Staff Profile <-> Staff Salary synchronization verified: UAN updated to ${syncedPayroll.uanNumber}, name to ${syncedPayroll.staffName}`);

  console.log('================================================================');
  console.log('=== ALL 14 TESTS PASSED (100% SUCCESS) ===');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
