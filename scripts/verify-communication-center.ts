import 'dotenv/config';

const BASE_URL = 'http://127.0.0.1:3000';

async function main() {
  console.log('========================================================================');
  console.log('COMMUNICATION CENTER & SMS GATEWAY AUTOMATED VERIFICATION');
  console.log('CHANAKYA PUBLIC SCHOOL & COACHING CENTRE');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. Authenticate as SUPER_ADMIN
  console.log('--- Step 1: Authentication & RBAC Tokens ---');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin',
      password: 'admin123',
      loginType: 'STAFF_ADMIN',
    }),
  });

  const loginData: any = await loginRes.json();
  assert(loginRes.ok && Boolean(loginData.token), 'Admin login succeeds and returns JWT token');
  const adminToken = loginData.token;
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  // 2. RBAC Enforcement: Unauthorized unauthenticated attempt to create notice must be blocked
  console.log('\n--- Step 2: RBAC Security Enforcement ---');
  const unauthRes = await fetch(`${BASE_URL}/api/notices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Hacked Notice',
      content: 'This should be blocked',
    }),
  });
  assert(unauthRes.status === 401 || unauthRes.status === 403, 'Unauthenticated POST /api/notices blocked with 401/403');

  // 3. Notice CRUD & Lifecycle
  console.log('\n--- Step 3: Notice Lifecycle (Draft -> Edit -> Publish -> Expire) ---');
  const testNoticeId = `test-nt-${Date.now()}`;
  const createDraftRes = await fetch(`${BASE_URL}/api/notices`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: testNoticeId,
      title: 'Annual Science Exhibition 2026',
      content: 'Initial draft version for review by principal.',
      noticeType: 'ACADEMIC',
      targetAudience: 'ALL',
      priority: 'IMPORTANT',
      status: 'DRAFT',
      force: true,
    }),
  });

  const createdDraft: any = await createDraftRes.json();
  assert(createDraftRes.status === 201, 'Notice created successfully');
  assert(createdDraft.status === 'DRAFT', 'Notice created with status DRAFT');

  // Public / unauthenticated user must NOT see DRAFT notices
  const publicNoticesRes = await fetch(`${BASE_URL}/api/notices`);
  const publicNotices: any[] = await publicNoticesRes.json();
  const draftInPublic = publicNotices.find((n) => n.id === testNoticeId);
  assert(!draftInPublic, 'Draft notice is strictly hidden from public notice board');

  // Edit the notice & Publish it
  const updateRes = await fetch(`${BASE_URL}/api/notices/${testNoticeId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Annual Science Exhibition 2026 - Approved Guidelines',
      content: 'Official approved guidelines for all students, parents, and faculty.',
      status: 'PUBLISHED',
      priority: 'URGENT',
    }),
  });
  const updatedNotice: any = await updateRes.json();
  assert(updateRes.ok, 'Notice successfully updated');
  assert(updatedNotice.status === 'PUBLISHED', 'Notice status updated to PUBLISHED');
  assert(updatedNotice.priority === 'URGENT', 'Notice priority updated to URGENT');

  // Now public notices must contain the published notice
  const publicNoticesAfterPub = await (await fetch(`${BASE_URL}/api/notices`)).json();
  const publishedInPublic = publicNoticesAfterPub.find((n: any) => n.id === testNoticeId);
  assert(Boolean(publishedInPublic), 'Published notice dynamically appears on public board');

  // Dynamic Expiration: set expiry date to yesterday
  const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
  const expireRes = await fetch(`${BASE_URL}/api/notices/${testNoticeId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      expiryDate: yesterday,
    }),
  });
  const expiredNotice: any = await expireRes.json();
  assert(expiredNotice.status === 'EXPIRED', 'Notice automatically evaluated as EXPIRED when expiryDate < today');

  // 4. Clean up test notice
  const deleteRes = await fetch(`${BASE_URL}/api/notices/${testNoticeId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert(deleteRes.ok, 'Notice deleted cleanly from database');

  // 5. SMS Quick Trigger Preview
  console.log('\n--- Step 4: SMS Quick Triggers & Previews ---');
  const previewRes = await fetch(`${BASE_URL}/api/sms/quick-triggers/preview?triggerType=DAILY_ABSENTEE`, {
    headers: adminHeaders,
  });
  const previewData: any = await previewRes.json();
  assert(previewRes.ok, 'Quick trigger preview returned successfully');
  assert(typeof previewData.recipientsCount === 'number', 'Preview computes recipient counts');
  assert(typeof previewData.validRecipientsCount === 'number', 'Preview validates Indian mobile numbers');
  assert(Boolean(previewData.templateMessage), 'Preview returns institutional template');

  // 6. SMS Dispatch & Strict Server-Side Idempotency
  console.log('\n--- Step 5: SMS Dispatch & Idempotency Protection ---');
  const testPhone = '9876543210';
  const testIdempotencyKey = `idempotency-test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const dispatch1 = await fetch(`${BASE_URL}/api/sms/send`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      recipients: [
        {
          phone: testPhone,
          recipientName: 'Test Parent',
          studentName: 'Test Ward',
          idempotencyKey: testIdempotencyKey,
        },
      ],
      message: 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE: Verification alert. Idempotency test.',
      triggerType: 'CUSTOM',
    }),
  });

  const res1: any = await dispatch1.json();
  assert(dispatch1.ok, 'First SMS dispatch succeeds');
  assert(res1.sent === 1, 'First dispatch sent count === 1');
  assert(res1.duplicatesSkipped === 0, 'First dispatch duplicatesSkipped === 0');

  // Now dispatch the EXACT SAME message with the SAME idempotency key (simulating retry / page refresh)
  const dispatch2 = await fetch(`${BASE_URL}/api/sms/send`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      recipients: [
        {
          phone: testPhone,
          recipientName: 'Test Parent',
          studentName: 'Test Ward',
          idempotencyKey: testIdempotencyKey,
        },
      ],
      message: 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE: Verification alert. Idempotency test.',
      triggerType: 'CUSTOM',
    }),
  });

  const res2: any = await dispatch2.json();
  assert(dispatch2.ok, 'Repeated dispatch request completes without error');
  assert(res2.sent === 0, 'Repeated dispatch sent count === 0 (zero double sends)');
  assert(res2.duplicatesSkipped === 1, 'Repeated dispatch correctly identified as duplicate and skipped');

  // 7. Invalid Mobile Number Safety Handling
  console.log('\n--- Step 6: Invalid Mobile Number Validation & Safety ---');
  const invalidDispatch = await fetch(`${BASE_URL}/api/sms/send`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      recipients: [
        {
          phone: '12345', // Invalid
          recipientName: 'Invalid Number Parent',
          idempotencyKey: `invalid-test-${Date.now()}`,
        },
      ],
      message: 'Test message for invalid number',
      triggerType: 'CUSTOM',
    }),
  });

  const invalidRes: any = await invalidDispatch.json();
  assert(invalidDispatch.ok, 'Invalid mobile request handled gracefully');
  assert(invalidRes.failed === 1, 'Invalid mobile number identified and marked as failed');

  // 8. SMS History Query & Pagination
  console.log('\n--- Step 7: SMS History & MongoDB Telemetry ---');
  const historyRes = await fetch(`${BASE_URL}/api/sms/history?limit=10&page=1`, {
    headers: adminHeaders,
  });
  const historyData: any = await historyRes.json();
  assert(historyRes.ok, 'SMS history retrieved from MongoDB Atlas');
  assert(Array.isArray(historyData.logs), 'SMS history contains logs array');
  assert(historyData.total > 0, 'SMS history total count reflects dispatched messages');

  // Verify the sent log contains our idempotency key
  const loggedItem = historyData.logs.find((l: any) => l.idempotencyKey === testIdempotencyKey);
  assert(Boolean(loggedItem), 'Dispatched SMS is persistently stored in MongoDB Atlas');
  assert(
    loggedItem.status === 'SUBMITTED' || loggedItem.status === 'SENT',
    'Persistent record status correctly reflects gateway submission (SUBMITTED / SENT) rather than falsely claiming delivery'
  );

  // Test Delivery Status Check endpoint
  const checkDelivRes = await fetch(`${BASE_URL}/api/sms/${loggedItem.id}/check-delivery`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const checkDelivData: any = await checkDelivRes.json();
  assert(checkDelivRes.ok && checkDelivData.success, 'POST /api/sms/:id/check-delivery endpoint operational');
  assert(
    checkDelivData.status === 'SUBMITTED' || checkDelivData.status === 'SENT' || checkDelivData.status === 'DELIVERED',
    'Check delivery returned valid carrier/gateway status'
  );

  // Test DLR Webhook: Simulate carrier delivery report (DLR)
  console.log('\n--- Step 7b: External DLR Webhook & Real Delivery Verification ---');
  const dlrRes = await fetch(`${BASE_URL}/api/sms/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: testIdempotencyKey,
      status: 'DELIVERED',
      delivered_at: new Date().toISOString(),
    }),
  });
  const dlrData: any = await dlrRes.json();
  assert(dlrRes.ok && dlrData.updated === true, 'DLR webhook processed and updated SMS log record');

  // Verify that the record is now confirmed DELIVERED
  const checkUpdatedDeliv = await fetch(`${BASE_URL}/api/sms/${loggedItem.id}/check-delivery`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const updatedDelivData: any = await checkUpdatedDeliv.json();
  assert(updatedDelivData.status === 'DELIVERED', 'Status verified as DELIVERED only upon explicit carrier DLR confirmation');

  // 9. SMS Statistics
  const statsRes = await fetch(`${BASE_URL}/api/sms/stats`, {
    headers: adminHeaders,
  });
  const statsData: any = await statsRes.json();
  assert(statsRes.ok, 'SMS stats endpoint operational');
  assert(statsData.todaySent >= 1, 'Stats accurately reflect today’s dispatched SMS');

  // 10. Deduplication Cleanup
  console.log('\n--- Step 8: Deduplication Cleanup Endpoint ---');
  const cleanRes = await fetch(`${BASE_URL}/api/notices/cleanup-duplicates`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const cleanData: any = await cleanRes.json();
  assert(cleanRes.ok && cleanData.success === true, 'Duplicate notices cleanup endpoint executed cleanly');

  // 11. Exam / Admit Card / Result Notices Automatic Integration
  console.log('\n--- Step 9: Exam, Admit Card & Result Auto-Circular Integrations ---');
  const testExamId = `exam-comm-${Date.now()}`;
  const createExamRes = await fetch(`${BASE_URL}/api/exams`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: testExamId,
      name: 'Half Yearly Examination 2026',
      title: 'Half Yearly Examination 2026',
      academicSession: '2026-2027',
      examType: 'HALF_YEARLY',
      startDate: '2026-11-10',
      endDate: '2026-11-20',
      status: 'PUBLISHED',
      admitCardStatus: 'DRAFT',
      resultsStatus: 'DRAFT',
    }),
  });
  assert(createExamRes.ok, 'Exam created and published');

  // Verify Exam Notice was generated automatically
  const noticesAfterExam = await (await fetch(`${BASE_URL}/api/notices`, { headers: adminHeaders })).json();
  const examNotice = noticesAfterExam.find((n: any) => n.id === `notice-exam-${testExamId}`);
  assert(Boolean(examNotice), 'Exam timetable circular automatically created upon exam publication');
  assert(examNotice.noticeType === 'EXAM' && examNotice.status === 'PUBLISHED', 'Exam circular marked as EXAM type and PUBLISHED');

  // Publish Admit Card for this exam
  const pubAdmitRes = await fetch(`${BASE_URL}/api/exams/${testExamId}/publish-admit-card`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  assert(pubAdmitRes.ok, 'Admit card publish endpoint executed');

  const noticesAfterAdmit = await (await fetch(`${BASE_URL}/api/notices`, { headers: adminHeaders })).json();
  const admitNotice = noticesAfterAdmit.find((n: any) => n.id === `notice-admitcard-${testExamId}`);
  assert(Boolean(admitNotice), 'Admit Card release circular automatically generated upon admit card publication');
  assert(admitNotice.status === 'PUBLISHED', 'Admit card circular status is PUBLISHED');

  // Publish Results for this exam
  const pubResultsRes = await fetch(`${BASE_URL}/api/exams/${testExamId}/publish-results`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  assert(pubResultsRes.ok, 'Results publish endpoint executed');

  const noticesAfterResults = await (await fetch(`${BASE_URL}/api/notices`, { headers: adminHeaders })).json();
  const resultNotice = noticesAfterResults.find((n: any) => n.id === `notice-result-${testExamId}`);
  assert(Boolean(resultNotice), 'Result declaration circular automatically generated upon result publication');
  assert(resultNotice.noticeType === 'RESULT' && resultNotice.status === 'PUBLISHED', 'Result circular marked as RESULT type and PUBLISHED');

  // Clean up test exam
  const deleteExamRes = await fetch(`${BASE_URL}/api/exams/${testExamId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert(deleteExamRes.ok, 'Test exam and associated notices cleaned up cleanly');

  // 12. End-to-End Multi-Portal Notice Delivery & RBAC Isolation Verification
  console.log('\n--- Step 10: Multi-Portal Delivery (Admin -> API -> MongoDB -> Student / Parent / Public) ---');

  // Authenticate as Student 1 (ROHIT KUMAR, Admission No: 64010001, Class 1 Section A)
  const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '64010001',
      dob: '2003-12-27',
      loginType: 'STUDENT',
    }),
  });
  const studentLoginData: any = await studentLoginRes.json();
  assert(studentLoginRes.ok && Boolean(studentLoginData.token), 'Student portal login succeeds with valid JWT');
  const studentHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${studentLoginData.token}`,
  };

  // Authenticate as Parent 1 (Mobile: 9876543210, Parent of Rohit Kumar)
  const parentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '9876543210',
      dob: '2003-12-27',
      loginType: 'PARENT',
    }),
  });
  const parentLoginData: any = await parentLoginRes.json();
  assert(parentLoginRes.ok && Boolean(parentLoginData.token), 'Parent portal login succeeds with valid JWT');
  const parentHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${parentLoginData.token}`,
  };

  // Test Case A: Create an ALL audience notice
  const noticeAllId = `test-nt-all-${Date.now()}`;
  const createAllRes = await fetch(`${BASE_URL}/api/notices`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: noticeAllId,
      title: 'Grand Sports Day 2026 Announcement',
      content: 'All students, parents, and community members are warmly invited.',
      targetAudience: 'ALL',
      isPublic: true,
      status: 'PUBLISHED',
      force: true,
    }),
  });
  assert(createAllRes.status === 201, 'ALL-audience notice created by Admin');

  // Verify Notice ALL delivery:
  // 1. Public Portal
  const publicNoticesList: any[] = await (await fetch(`${BASE_URL}/api/notices/public`)).json();
  assert(publicNoticesList.some((n) => n.id === noticeAllId), 'ALL notice delivered to Public Portal');

  // 2. Student Portal
  const studentNoticesList: any[] = await (await fetch(`${BASE_URL}/api/student/notices`, { headers: studentHeaders })).json();
  assert(studentNoticesList.some((n) => n.id === noticeAllId), 'ALL notice delivered to Student Portal');

  // 3. Parent Portal
  const parentNoticesList: any[] = await (await fetch(`${BASE_URL}/api/parent/notices`, { headers: parentHeaders })).json();
  assert(parentNoticesList.some((n) => n.id === noticeAllId), 'ALL notice delivered to Parent Portal');

  // Test Case B: Create Class-Targeted Notice (Class 1, Section A)
  const noticeClass1Id = `test-nt-c1-${Date.now()}`;
  const createC1Res = await fetch(`${BASE_URL}/api/notices`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: noticeClass1Id,
      title: 'Class 1-A Special Project Submission',
      content: 'Important submission instructions for Class 1 Section A.',
      targetAudience: 'CLASS',
      targetClass: 'Class 1',
      targetSection: 'A',
      isPublic: false,
      status: 'PUBLISHED',
      force: true,
    }),
  });
  assert(createC1Res.status === 201, 'Class 1-A targeted notice created by Admin');

  // Verify Class 1 Notice delivery:
  // Student in Class 1 MUST see it
  const studentNoticesAfterC1: any[] = await (await fetch(`${BASE_URL}/api/student/notices`, { headers: studentHeaders })).json();
  assert(studentNoticesAfterC1.some((n) => n.id === noticeClass1Id), 'Class 1 student correctly receives Class 1 targeted notice');

  // Parent with child in Class 1 MUST see it
  const parentNoticesAfterC1: any[] = await (await fetch(`${BASE_URL}/api/parent/notices`, { headers: parentHeaders })).json();
  assert(parentNoticesAfterC1.some((n) => n.id === noticeClass1Id), 'Parent with child in Class 1 correctly receives notice');

  // Public portal must NOT see Class-specific non-public notice
  const publicAfterC1: any[] = await (await fetch(`${BASE_URL}/api/notices/public`)).json();
  assert(!publicAfterC1.some((n) => n.id === noticeClass1Id), 'Class-targeted private notice hidden from Public Portal');

  // Test Case C: Create Class 10 Notice (Class 1 student must NOT see it)
  const noticeClass10Id = `test-nt-c10-${Date.now()}`;
  await fetch(`${BASE_URL}/api/notices`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: noticeClass10Id,
      title: 'Class 10 Board Registration Notice',
      content: 'Strictly for Class 10 students.',
      targetAudience: 'CLASS',
      targetClass: 'Class 10',
      targetSection: 'ALL',
      isPublic: false,
      status: 'PUBLISHED',
      force: true,
    }),
  });

  const studentNoticesAfterC10: any[] = await (await fetch(`${BASE_URL}/api/student/notices`, { headers: studentHeaders })).json();
  assert(!studentNoticesAfterC10.some((n) => n.id === noticeClass10Id), 'Class 1 student correctly isolated from Class 10 notice');

  // Test Case D: Individual Student Targeting (Targeted specifically to Rohit Kumar: st-1)
  const noticeIndivId = `test-nt-indiv-${Date.now()}`;
  await fetch(`${BASE_URL}/api/notices`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: noticeIndivId,
      title: 'Personal Merit Scholarship Award Notification',
      content: 'Congratulations on your merit scholarship award.',
      targetAudience: 'INDIVIDUAL',
      targetStudentIds: ['st-1'],
      isPublic: false,
      status: 'PUBLISHED',
      force: true,
    }),
  });

  // Targeted student MUST see it
  const studentIndivNotices: any[] = await (await fetch(`${BASE_URL}/api/student/notices`, { headers: studentHeaders })).json();
  assert(studentIndivNotices.some((n) => n.id === noticeIndivId), 'Individually targeted student receives personal notice');

  // Parent of targeted student MUST see it
  const parentIndivNotices: any[] = await (await fetch(`${BASE_URL}/api/parent/notices`, { headers: parentHeaders })).json();
  assert(parentIndivNotices.some((n) => n.id === noticeIndivId), 'Parent of targeted student receives personal notice');

  // Test Case E: Section-specific targeting (Class 1 Section B - Rohit is in Section A)
  const noticeSectionBId = `test-nt-secb-${Date.now()}`;
  await fetch(`${BASE_URL}/api/notices`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: noticeSectionBId,
      title: 'Class 1-B Only Lab Timings',
      content: 'Strictly for Section B students.',
      targetAudience: 'SECTION',
      targetClass: 'Class 1',
      targetSection: 'B',
      isPublic: false,
      status: 'PUBLISHED',
      force: true,
    }),
  });
  const studentNoticesAfterSecB: any[] = await (await fetch(`${BASE_URL}/api/student/notices`, { headers: studentHeaders })).json();
  assert(!studentNoticesAfterSecB.some((n) => n.id === noticeSectionBId), 'Section A student correctly isolated from Section B targeted notice');

  // Test Case F: PARENTS audience targeting
  const noticeParentsOnlyId = `test-nt-parentsonly-${Date.now()}`;
  await fetch(`${BASE_URL}/api/notices`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: noticeParentsOnlyId,
      title: 'Annual General Parent Meeting Notice',
      content: 'Important meeting for all parents.',
      targetAudience: 'PARENTS',
      isPublic: false,
      status: 'PUBLISHED',
      force: true,
    }),
  });
  const parentNoticesAfterParentsOnly: any[] = await (await fetch(`${BASE_URL}/api/parent/notices`, { headers: parentHeaders })).json();
  assert(parentNoticesAfterParentsOnly.some((n) => n.id === noticeParentsOnlyId), 'Parent correctly receives PARENTS audience notice');
  const studentNoticesAfterParentsOnly: any[] = await (await fetch(`${BASE_URL}/api/student/notices`, { headers: studentHeaders })).json();
  assert(!studentNoticesAfterParentsOnly.some((n) => n.id === noticeParentsOnlyId), 'Student correctly isolated from PARENTS-only notice');

  // Clean up all multi-portal test notices
  for (const nId of [noticeAllId, noticeClass1Id, noticeClass10Id, noticeIndivId, noticeSectionBId, noticeParentsOnlyId]) {
    await fetch(`${BASE_URL}/api/notices/${nId}`, { method: 'DELETE', headers: adminHeaders });
  }

  console.log('\n========================================================================');
  console.log(`ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY: ${passedTests}/${totalTests} PASSED`);
  console.log('========================================================================');
}

main().catch((err) => {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
});
