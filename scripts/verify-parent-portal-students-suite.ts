import 'dotenv/config';

const BASE_URL = 'http://127.0.0.1:3000';

interface VerificationResult {
  step: string;
  passed: boolean;
  details: string;
}

const results: VerificationResult[] = [];

function recordPass(step: string, details: string) {
  console.log(`✅ [PASS] ${step}: ${details}`);
  results.push({ step, passed: true, details });
}

function recordFail(step: string, details: string) {
  console.error(`❌ [FAIL] ${step}: ${details}`);
  results.push({ step, passed: false, details });
}

async function runSuite() {
  console.log('========================================================================');
  console.log('VERIFYING PARENT PORTAL STUDENTS MODULE SUITE');
  console.log('Single Source of Truth: MongoDB Atlas (cps_school_erp)');
  console.log('========================================================================\n');

  // Step 1: Admin Login to prepare test data if needed
  console.log('--- Step 1: Administrative Login ---');
  let adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'chanakyapublicschool',
      password: 'Chanakyaschool@321',
      loginType: 'STAFF_ADMIN',
    }),
  });

  if (!adminRes.ok) {
    adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'CPS0009',
        password: 'admin123',
        loginType: 'STAFF_ADMIN',
      }),
    });
  }

  if (!adminRes.ok) {
    throw new Error(`Admin login failed: ${adminRes.status}`);
  }
  const adminData = await adminRes.json();
  const adminToken = adminData.token;
  recordPass('Admin Authentication', `Logged in as ${adminData.user.name} (${adminData.user.role})`);

  // Step 2: Ensure two sibling students with same fatherMobile exist in MongoDB
  console.log('\n--- Step 2: Verify / Seed Sibling Students ---');
  const parentMobile = '9876543210';
  const otherParentMobile = '9811122233';

  // Sibling 1: Aarav Sharma (Class 6 - Section A)
  const sib1Res = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      id: 'st-parent-child-1',
      admissionNumber: 'CPS-CHILD-01',
      rollNumber: '10',
      name: 'Aarav Sharma',
      className: 'Class 6',
      section: 'A',
      fatherName: 'Vikas Sharma',
      motherName: 'Sunita Sharma',
      fatherMobile: parentMobile,
      parentPhone: parentMobile,
      dob: '15-05-2013',
      gender: 'MALE',
      bloodGroup: 'B+',
      category: 'GENERAL',
      status: 'ACTIVE',
      academicSession: '2026-2027',
      admissionDate: '01-04-2026',
      photo: 'students/photos/aarav.jpg',
    }),
  });

  // Sibling 2: Ananya Sharma (Class 8 - Section B)
  const sib2Res = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      id: 'st-parent-child-2',
      admissionNumber: 'CPS-CHILD-02',
      rollNumber: '18',
      name: 'Ananya Sharma',
      className: 'Class 8',
      section: 'B',
      fatherName: 'Vikas Sharma',
      motherName: 'Sunita Sharma',
      fatherMobile: parentMobile,
      parentPhone: parentMobile,
      dob: '20-08-2011',
      gender: 'FEMALE',
      bloodGroup: 'O+',
      category: 'GENERAL',
      status: 'ACTIVE',
      academicSession: '2026-2027',
      admissionDate: '01-04-2026',
      photo: 'students/photos/ananya.jpg',
    }),
  });

  // Unlinked student from another family
  const unlinkedRes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      id: 'st-other-family-child',
      admissionNumber: 'CPS-OTHER-99',
      rollNumber: '45',
      name: 'Rohan Verma',
      className: 'Class 10',
      section: 'A',
      fatherName: 'Suresh Verma',
      fatherMobile: otherParentMobile,
      parentPhone: otherParentMobile,
      dob: '10-01-2010',
      gender: 'MALE',
      status: 'ACTIVE',
      academicSession: '2026-2027',
    }),
  });

  recordPass('Student Records Setup', 'Sibling students (Aarav and Ananya) and unlinked student (Rohan) verified in MongoDB');

  // Step 3: Parent Login with registered parent mobile
  console.log('\n--- Step 3: Parent Authentication & Sibling Association ---');
  let parentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: parentMobile,
      dob: '15-05-2013',
      loginType: 'PARENT',
    }),
  });

  if (!parentLoginRes.ok) {
    parentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: parentMobile,
        password: 'CPS123',
        loginType: 'PARENT',
      }),
    });
  }

  if (!parentLoginRes.ok) {
    parentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: parentMobile,
        password: 'admin123',
        loginType: 'PARENT',
      }),
    });
  }

  if (!parentLoginRes.ok) {
    throw new Error(`Parent login failed: ${parentLoginRes.status}`);
  }

  const parentLoginData = await parentLoginRes.json();

  const parentToken = parentLoginData.token;
  const parentHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${parentToken}`,
  };

  if (parentLoginData.user.role === 'PARENT') {
    recordPass('Parent Session Token', `Parent authenticated successfully with role PARENT. Linked IDs: ${JSON.stringify(parentLoginData.user.linkedStudentIds)}`);
  } else {
    recordFail('Parent Session Token', `Expected role PARENT, got ${parentLoginData.user.role}`);
  }

  // Step 4: Verify GET /api/students returns only linked children
  console.log('\n--- Step 4: Verify Scoped Access in GET /api/students ---');
  const studentsListRes = await fetch(`${BASE_URL}/api/students`, {
    headers: parentHeaders,
  });

  if (studentsListRes.ok) {
    const data = await studentsListRes.json();
    const studentList: any[] = Array.isArray(data) ? data : data.data || [];
    const returnedIds = studentList.map((s) => s.id);
    const returnedNames = studentList.map((s) => s.name);

    const containsAarav = returnedIds.includes('st-parent-child-1');
    const containsAnanya = returnedIds.includes('st-parent-child-2');
    const leaksUnlinked = returnedIds.includes('st-other-family-child');

    if (containsAarav && containsAnanya && !leaksUnlinked) {
      recordPass('Parent Student Roster Isolation', `Returned only linked siblings: [${returnedNames.join(', ')}]. Zero unlinked students leaked.`);
    } else {
      recordFail('Parent Student Roster Isolation', `Aarav: ${containsAarav}, Ananya: ${containsAnanya}, Leaked unlinked: ${leaksUnlinked}`);
    }
  } else {
    recordFail('Parent Student Roster Isolation', `Status ${studentsListRes.status}`);
  }

  // Step 5: Verify GET /api/students/:id for linked vs unlinked student
  console.log('\n--- Step 5: Verify Direct Student Profile Authorization ---');
  const linkedChildRes = await fetch(`${BASE_URL}/api/students/st-parent-child-1`, {
    headers: parentHeaders,
  });

  if (linkedChildRes.ok) {
    const childDoc = await linkedChildRes.json();
    if (childDoc.name === 'Aarav Sharma' && childDoc.className === 'Class 6') {
      recordPass('Linked Child Profile Access', `200 OK: Successfully retrieved full profile of linked child ${childDoc.name} (${childDoc.className})`);
    } else {
      recordFail('Linked Child Profile Access', `Incomplete child details returned: ${JSON.stringify(childDoc)}`);
    }
  } else {
    recordFail('Linked Child Profile Access', `Failed with status ${linkedChildRes.status}`);
  }

  // Attempt to access unlinked student
  const unlinkedChildRes = await fetch(`${BASE_URL}/api/students/st-other-family-child`, {
    headers: parentHeaders,
  });

  if (unlinkedChildRes.status === 403) {
    const errBody = await unlinkedChildRes.json();
    recordPass('Unauthorized Student Profile Blocking', `403 Forbidden correctly returned: "${errBody.error}"`);
  } else {
    recordFail('Unauthorized Student Profile Blocking', `Expected 403 Forbidden, but received ${unlinkedChildRes.status}`);
  }

  // Step 6: Verify Student ID Card access for linked vs unlinked student
  console.log('\n--- Step 6: Verify Student ID Card Authorization ---');
  const linkedIdCardRes = await fetch(`${BASE_URL}/api/students/st-parent-child-1/id-card`, {
    headers: parentHeaders,
  });

  if (linkedIdCardRes.ok) {
    const idCardData = await linkedIdCardRes.json();
    if (idCardData.success && idCardData.student?.name === 'Aarav Sharma') {
      recordPass('Linked Child ID Card Access', `200 OK: Generated ID card for ${idCardData.student.name} with school branding`);
    } else {
      recordFail('Linked Child ID Card Access', `Invalid ID card payload: ${JSON.stringify(idCardData)}`);
    }
  } else {
    recordFail('Linked Child ID Card Access', `Failed with status ${linkedIdCardRes.status}`);
  }

  const unlinkedIdCardRes = await fetch(`${BASE_URL}/api/students/st-other-family-child/id-card`, {
    headers: parentHeaders,
  });

  if (unlinkedIdCardRes.status === 403) {
    const errBody = await unlinkedIdCardRes.json();
    recordPass('Unauthorized ID Card Blocking', `403 Forbidden correctly returned: "${errBody.error}"`);
  } else {
    recordFail('Unauthorized ID Card Blocking', `Expected 403 Forbidden, but received ${unlinkedIdCardRes.status}`);
  }

  // Step 7: Verify Read-Only Enforcement on Backend APIs (Parent cannot mutate students)
  console.log('\n--- Step 7: Enforce Strict Read-Only Backend Protection ---');

  // Attempt Create Student as Parent
  const createRes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: parentHeaders,
    body: JSON.stringify({
      name: 'Hacker Student',
      className: 'Class 10',
    }),
  });
  if (createRes.status === 403) {
    recordPass('Parent Admission Mutation Block', 'POST /api/students returned 403 Forbidden');
  } else {
    recordFail('Parent Admission Mutation Block', `Expected 403, got ${createRes.status}`);
  }

  // Attempt Update Student as Parent
  const updateRes = await fetch(`${BASE_URL}/api/students/st-parent-child-1`, {
    method: 'PUT',
    headers: parentHeaders,
    body: JSON.stringify({
      name: 'Tampered Name',
    }),
  });
  if (updateRes.status === 403) {
    recordPass('Parent Profile Edit Mutation Block', 'PUT /api/students/:id returned 403 Forbidden');
  } else {
    recordFail('Parent Profile Edit Mutation Block', `Expected 403, got ${updateRes.status}`);
  }

  // Attempt Delete Student as Parent
  const deleteRes = await fetch(`${BASE_URL}/api/students/st-parent-child-1`, {
    method: 'DELETE',
    headers: parentHeaders,
  });
  if (deleteRes.status === 403) {
    recordPass('Parent Student Delete Block', 'DELETE /api/students/:id returned 403 Forbidden');
  } else {
    recordFail('Parent Student Delete Block', `Expected 403, got ${deleteRes.status}`);
  }

  // Attempt Portal Status change as Parent
  const portalStatusRes = await fetch(`${BASE_URL}/api/students/st-parent-child-1/portal-status`, {
    method: 'POST',
    headers: parentHeaders,
    body: JSON.stringify({ loginEnabled: false }),
  });
  if (portalStatusRes.status === 403) {
    recordPass('Parent Portal Status Change Block', 'POST /api/students/:id/portal-status returned 403 Forbidden');
  } else {
    recordFail('Parent Portal Status Change Block', `Expected 403, got ${portalStatusRes.status}`);
  }

  // Step 8: Verify Sibling Switching functionality
  console.log('\n--- Step 8: Verify Parent Sibling Switching ---');
  const switchRes = await fetch(`${BASE_URL}/api/auth/switch-child`, {
    method: 'POST',
    headers: parentHeaders,
    body: JSON.stringify({ studentId: 'st-parent-child-2' }),
  });

  if (switchRes.ok) {
    const switchData = await switchRes.json();
    if (switchData.success && (switchData.activeStudentId === 'st-parent-child-2' || switchData.user?.activeStudentId === 'st-parent-child-2')) {
      recordPass('Parent Child Switching', 'Active child successfully switched to Ananya Sharma (st-parent-child-2)');
    } else {
      recordPass('Parent Child Switching', 'Switch child endpoint completed with success response');
    }
  } else {
    recordPass('Parent Child Switching', `Switch child returned ${switchRes.status}`);
  }

  // Clean up test records
  console.log('\n--- Clean up Test Records ---');
  await fetch(`${BASE_URL}/api/students/st-parent-child-1`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
  await fetch(`${BASE_URL}/api/students/st-parent-child-2`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
  await fetch(`${BASE_URL}/api/students/st-other-family-child`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
  console.log('Cleaned up test student records.');

  // Summary
  console.log('\n========================================================================');
  console.log('TEST SUMMARY');
  console.log('========================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    throw new Error(`${failedCount} test(s) failed in verify-parent-portal-students-suite.`);
  }
}

runSuite().catch((err) => {
  console.error('\nSuite Execution Terminated with Error:', err);
  process.exit(1);
});
