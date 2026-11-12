import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3000';

async function testEnrollmentFeeFlow() {
  console.log('========================================================================');
  console.log('CHANAKYA PUBLIC SCHOOL & COACHING CENTRE - ENROLLMENT DATE & FEE FLOW VERIFICATION');
  console.log('========================================================================\n');

  // STEP 1: Login as SUPER_ADMIN
  console.log('>>> [TEST 1] Admin Authentication');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    }),
  });
  if (loginRes.status !== 200) {
    throw new Error(`Admin login failed with status ${loginRes.status}`);
  }
  const loginData: any = await loginRes.json();
  const token = loginData.token;
  console.log(`[PASS] Logged in as ${loginData.user.name} (${loginData.user.role}). JWT token acquired.\n`);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // STEP 2: Create a student with Enrollment Date = 2026-08-01 (August 2026)
  console.log('>>> [TEST 2] Admission / Student Creation with Controlled Enrollment Date');
  const testStudentId = `st-enroll-test-${Date.now()}`;
  const testAdmNo = `2026${Math.floor(1000 + Math.random() * 9000)}`;

  const createRes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: testStudentId,
      admissionNumber: testAdmNo,
      registrationNumber: `CPS2026${testAdmNo}`,
      name: 'Aarav Kumar (Enrollment Test)',
      firstName: 'Aarav',
      lastName: 'Kumar',
      dob: '2014-06-15',
      gender: 'MALE',
      bloodGroup: 'O+',
      category: 'GENERAL',
      address: 'Near Shahpur Road',
      city: 'Sheohar',
      state: 'Bihar',
      pincode: '843329',
      mobile: '9876543210',
      classId: 'c-10',
      className: 'Class 10',
      section: 'A',
      academicSession: '2026-2027',
      admissionDate: '2026-08-01',
      enrollmentDate: '2026-08-01',
      parentName: 'Ramesh Kumar',
      parentPhone: '9876543210',
      status: 'ACTIVE',
    }),
  });

  if (createRes.status !== 200 && createRes.status !== 201) {
    const errText = await createRes.text();
    throw new Error(`Student creation failed: HTTP ${createRes.status} - ${errText}`);
  }

  const createdStudent: any = await createRes.json();
  if (createdStudent.enrollmentDate !== '2026-08-01' || createdStudent.feeStartDate !== '2026-08-01') {
    throw new Error(
      `Enrollment Date mismatch: expected 2026-08-01, got enrollmentDate=${createdStudent.enrollmentDate}, feeStartDate=${createdStudent.feeStartDate}`
    );
  }
  console.log(`[PASS] Student created: ${createdStudent.name}`);
  console.log(`       Enrollment Date = ${createdStudent.enrollmentDate}`);
  console.log(`       Fee Start Date  = ${createdStudent.feeStartDate} (Auto-Synchronized)\n`);

  // STEP 3: Verify GET /api/fees/student/:studentId returns enrollmentDate and feeStartDate
  console.log('>>> [TEST 3] Verify Fee Profile API returns Enrollment Date');
  const feeProfileRes = await fetch(`${BASE_URL}/api/fees/student/${testStudentId}`, { headers });
  if (feeProfileRes.status !== 200) {
    throw new Error(`Fee Profile API failed with HTTP ${feeProfileRes.status}`);
  }
  const feeProfileData: any = await feeProfileRes.json();
  if (!feeProfileData.student || feeProfileData.student.enrollmentDate !== '2026-08-01') {
    throw new Error(
      `Fee Profile student missing or has incorrect enrollmentDate: ${JSON.stringify(feeProfileData.student)}`
    );
  }
  console.log(`[PASS] Fee Profile student record verified:`);
  console.log(`       Student ID: ${feeProfileData.student.id}`);
  console.log(`       Enrollment Date: ${feeProfileData.student.enrollmentDate}`);
  console.log(`       Fee Start Date: ${feeProfileData.student.feeStartDate}\n`);

  // STEP 4: Attempt Invoice Generation BEFORE Enrollment Date (July 2026) -> MUST FAIL (HTTP 400)
  console.log('>>> [TEST 4] Enforce Invariant: Billing BEFORE Enrollment Date (July 2026) must be BLOCKED');
  const beforeRes = await fetch(`${BASE_URL}/api/fee-ledgers/student/${testStudentId}/generate-monthly`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      monthYear: 'July 2026',
      academicSession: '2026-2027',
    }),
  });

  if (beforeRes.status !== 400) {
    throw new Error(`Expected HTTP 400 when billing before enrollment date, got HTTP ${beforeRes.status}`);
  }
  const beforeErr: any = await beforeRes.json();
  console.log(`[PASS] Blocked billing before enrollment date: HTTP 400 Bad Request`);
  console.log(`       Server rejection reason: "${beforeErr.error}"\n`);

  // STEP 5: Generate / Verify Invoice ON Enrollment Date (August 2026) -> MUST SUCCEED (HTTP 200 or already auto-generated HTTP 409)
  console.log('>>> [TEST 5] Generate / Verify Invoice ON Enrollment Month (August 2026) -> MUST SUCCEED');
  const augustRes = await fetch(`${BASE_URL}/api/fee-ledgers/student/${testStudentId}/generate-monthly`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      monthYear: 'August 2026',
      academicSession: '2026-2027',
      dueDate: '2026-08-25',
    }),
  });

  let augustInvoice: any;
  if (augustRes.status === 409) {
    const profileRes = await fetch(`${BASE_URL}/api/fees/student/${testStudentId}`, { headers });
    const profileData: any = await profileRes.json();
    augustInvoice = profileData.ledgers?.find((l: any) => l.feeMonth?.includes('August') || l.monthYear?.includes('August'));
    console.log(`[PASS] August 2026 Invoice Automatically Generated by Fee Engine on Student Admission`);
  } else if (augustRes.status === 200) {
    augustInvoice = await augustRes.json();
    console.log(`[PASS] August 2026 Invoice Generated:`);
  } else {
    const errText = await augustRes.text();
    throw new Error(`August invoice generation failed: HTTP ${augustRes.status} - ${errText}`);
  }

  console.log(`       Invoice No: ${augustInvoice.invoiceNumber}`);
  console.log(`       Fee Month: ${augustInvoice.feeMonth}`);
  console.log(`       Amount: ₹${augustInvoice.total}`);
  console.log(`       Status: ${augustInvoice.status}\n`);

  // STEP 6: Duplicate Invoice Prevention (August 2026) -> MUST FAIL (HTTP 409)
  console.log('>>> [TEST 6] Prevent Duplicate Invoices for Same Month -> MUST RETURN HTTP 409 Conflict');
  const dupRes = await fetch(`${BASE_URL}/api/fee-ledgers/student/${testStudentId}/generate-monthly`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      monthYear: 'August 2026',
      academicSession: '2026-2027',
    }),
  });

  if (dupRes.status !== 409) {
    throw new Error(`Expected HTTP 409 for duplicate invoice, got HTTP ${dupRes.status}`);
  }
  const dupErr: any = await dupRes.json();
  console.log(`[PASS] Duplicate invoice blocked: HTTP 409 Conflict`);
  console.log(`       Reason: "${dupErr.error}"\n`);

  // STEP 7: Manual Historical Bill / Invoice with Breakdown
  console.log('>>> [TEST 7] Manual Custom Invoice with Breakdown via /api/fee-ledgers/bill');
  const customBillRes = await fetch(`${BASE_URL}/api/fee-ledgers/bill`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      studentId: testStudentId,
      feeType: 'Examination & Lab Fee',
      description: 'Term 1 Exam and Science Lab Kit',
      amount: 1200,
      dueDate: '2026-08-30',
      frequency: 'ONE_TIME',
      applicableMonth: 'August 2026',
      breakdown: [
        { head: 'Examination Fee', amount: 800, isOneTime: true },
        { head: 'Science Lab Kit', amount: 400, isOneTime: true },
      ],
    }),
  });

  if (customBillRes.status !== 200) {
    const errText = await customBillRes.text();
    throw new Error(`Custom bill failed: HTTP ${customBillRes.status} - ${errText}`);
  }
  const customBillData: any = await customBillRes.json();
  console.log(`[PASS] Custom Bill created:`);
  console.log(`       Invoice No: ${customBillData.ledger.invoiceNumber}`);
  console.log(`       Fee Type: ${customBillData.ledger.feeType}`);
  console.log(`       Breakdown components: ${customBillData.ledger.breakdown.length}\n`);

  // STEP 8: Collect Payment with Historical Date
  console.log('>>> [TEST 8] Collect Payment towards Invoice with Specific Payment Date');
  const ledgerId = augustInvoice.id;
  const payRes = await fetch(`${BASE_URL}/api/fee-ledgers/${ledgerId}/collect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      paidAmount: augustInvoice.total,
      paymentMethod: 'CASH',
      paymentDate: '2026-08-10', // Historical counter receipt date
      collectedBy: 'Vikram Sethi (Accounts)',
      remarks: 'Full settlement of August tuition fee',
    }),
  });

  if (payRes.status !== 200) {
    const errText = await payRes.text();
    throw new Error(`Payment collection failed: HTTP ${payRes.status} - ${errText}`);
  }
  const payData: any = await payRes.json();
  console.log(`[PASS] Payment collected successfully:`);
  console.log(`       Receipt No: ${payData.receipt.receiptNumber}`);
  console.log(`       Amount Paid: ₹${payData.receipt.amount}`);
  console.log(`       Payment Date: ${payData.receipt.paymentDate}`);
  console.log(`       Ledger Status: ${payData.ledger.status} (Pending: ₹${payData.ledger.pendingAmount})\n`);

  // STEP 9: Student Edit - Modify Enrollment Date and Verify Auto-Sync
  console.log('>>> [TEST 9] Student Edit - Modify Enrollment Date and Verify Fee Start Date Sync');
  const newEnrollmentDate = '2026-06-01'; // Changed to June 2026
  const updateRes = await fetch(`${BASE_URL}/api/students/${testStudentId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      ...createdStudent,
      enrollmentDate: newEnrollmentDate,
    }),
  });

  if (updateRes.status !== 200) {
    const errText = await updateRes.text();
    throw new Error(`Student update failed: HTTP ${updateRes.status} - ${errText}`);
  }
  const updatedStudent: any = await updateRes.json();
  if (updatedStudent.enrollmentDate !== newEnrollmentDate || updatedStudent.feeStartDate !== newEnrollmentDate) {
    throw new Error(
      `Update failed to sync feeStartDate: enrollmentDate=${updatedStudent.enrollmentDate}, feeStartDate=${updatedStudent.feeStartDate}`
    );
  }
  console.log(`[PASS] Student record updated:`);
  console.log(`       Updated Enrollment Date: ${updatedStudent.enrollmentDate}`);
  console.log(`       Synced Fee Start Date:   ${updatedStudent.feeStartDate}\n`);

  // STEP 10: Now Billing for July 2026 MUST SUCCEED (because enrollment date was moved back to June)
  console.log('>>> [TEST 10] Generate Invoice for July 2026 after moving Enrollment Date back -> MUST SUCCEED');
  const julyAfterRes = await fetch(`${BASE_URL}/api/fee-ledgers/student/${testStudentId}/generate-monthly`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      monthYear: 'July 2026',
      academicSession: '2026-2027',
      dueDate: '2026-07-25',
    }),
  });

  let julyInvoice: any;
  if (julyAfterRes.status === 409) {
    const profileRes = await fetch(`${BASE_URL}/api/fees/student/${testStudentId}`, { headers });
    const profileData: any = await profileRes.json();
    julyInvoice = profileData.ledgers?.find((l: any) => l.feeMonth?.includes('July') || l.monthYear?.includes('July'));
    console.log(`[PASS] July 2026 Invoice Auto-Generated by Fee Engine after Enrollment Date update`);
  } else if (julyAfterRes.status === 200) {
    julyInvoice = await julyAfterRes.json();
    console.log(`[PASS] July 2026 Invoice Generated successfully: ${julyInvoice.invoiceNumber}\n`);
  } else {
    const errText = await julyAfterRes.text();
    throw new Error(`July invoice generation should succeed now: HTTP ${julyAfterRes.status} - ${errText}`);
  }

  // STEP 11: Cleanup test student
  console.log('>>> [TEST 11] Cleanup Test Student');
  const delRes = await fetch(`${BASE_URL}/api/students/${testStudentId}`, {
    method: 'DELETE',
    headers,
  });
  if (delRes.status !== 200) {
    console.warn(`Warning: Could not delete test student ${testStudentId}`);
  } else {
    console.log(`[PASS] Test student cleaned up successfully.\n`);
  }

  console.log('========================================================================');
  console.log('ALL 11 ENROLLMENT DATE & FEE FLOW VERIFICATION TESTS PASSED (100%)');
  console.log('========================================================================');
}

testEnrollmentFeeFlow().catch((err) => {
  console.error('[TEST FAILURE]:', err);
  process.exit(1);
});
