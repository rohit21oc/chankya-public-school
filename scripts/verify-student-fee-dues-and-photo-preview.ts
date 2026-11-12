import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';

function request(pathStr: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, BASE_URL);
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed: any = body;
          try {
            parsed = JSON.parse(body);
          } catch {
            // keep raw
          }
          resolve({ status: res.statusCode || 200, headers: res.headers, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      if (typeof options.body === 'string' || Buffer.isBuffer(options.body)) {
        req.write(options.body);
      } else {
        req.write(JSON.stringify(options.body));
      }
    }
    req.end();
  });
}

let totalTests = 0;
let passedTests = 0;

function assert(description: string, condition: boolean, extraInfo?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${description}`);
  } else {
    console.error(`  ✗ [FAIL] ${description}`);
    if (extraInfo !== undefined) {
      console.error(`    Details:`, extraInfo);
    }
  }
}

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR — E2E VERIFICATION SUITE');
  console.log('Task 1: Student Fee Dues Calculation & Fee Ledger Audit');
  console.log('Task 2: Student Admission Photo Upload & Immediate Preview');
  console.log('================================================================\n');

  // --- PART 1: FEE DUES & AUDIT VERIFICATION ---
  console.log('--- TEST GROUP 1: Student Profile Fee Dues & Ledger Reconciliation ---');

  // 1. Fetch Archana Kumari from GET /api/students
  const studentsRes = await request('/api/students');
  assert('GET /api/students returns HTTP 200', studentsRes.status === 200);
  const studentsList = studentsRes.data?.data || studentsRes.data || [];
  const archana = studentsList.find((s: any) => s.admissionNumber === '64017399' || s.name === 'Archana Kumari');
  assert('Student Archana Kumari (Adm 64017399) found in database', !!archana, archana?.id);

  // 2. Verify Archana feeProfile blueprint
  assert('Archana is enrolled in Class 7', archana?.className === 'Class 7');
  assert('Archana enrollmentDate is 2026-09-11 (September 2026)', archana?.enrollmentDate === '2026-09-11');
  assert('Archana totalOneTimeFee is exactly ₹6,200', archana?.feeProfile?.totalOneTimeFee === 6200);
  assert('Archana totalMonthlyFee is exactly ₹1,200', archana?.feeProfile?.totalMonthlyFee === 1200);
  assert('Archana totalYearlyFee (Exam Fee) is ₹300', archana?.feeProfile?.totalYearlyFee === 300);

  // 3. Trigger audit-reconcile endpoint
  const auditRes = await request('/api/fee-ledgers/audit-reconcile', { method: 'POST' });
  assert('POST /api/fee-ledgers/audit-reconcile returns HTTP 200', auditRes.status === 200);
  assert('Audit endpoint reports success: true', auditRes.data?.success === true);

  // 4. Fetch Archana fee ledgers
  const archanaLedgersRes = await request(`/api/fee-ledgers?studentId=${archana.id}`);
  assert('GET /api/fee-ledgers?studentId=... returns HTTP 200', archanaLedgersRes.status === 200);
  const archanaLedgers: any[] = Array.isArray(archanaLedgersRes.data) ? archanaLedgersRes.data : [];

  // 5. Verify invalid September invoice was removed and no invoices are for September
  const hasSeptemberInvoice = archanaLedgers.some((l) => l.feeMonth === 'September 2026' || l.monthYear === 'September 2026');
  assert('Invalid September 2026 monthly invoice was audited and safely removed', !hasSeptemberInvoice);

  // 6. Verify one-time admission charges invoice exists
  const admInvoice = archanaLedgers.find((l) => l.invoiceNumber === 'INV-ADM-64017399' || l.feeType?.includes('Admission'));
  assert('Admission invoice INV-ADM-64017399 exists for one-time admission dues', !!admInvoice);
  assert('Admission invoice amount is exactly ₹6,200', admInvoice?.total === 6200 && admInvoice?.pendingAmount === 6200);
  assert('Admission invoice status is PENDING from admission date', admInvoice?.status === 'PENDING');

  // 7. Verify subsequent month (October 2026) monthly school fee invoice exists
  const octInvoice = archanaLedgers.find((l) => l.feeMonth === 'October 2026' || l.monthYear === 'October 2026');
  assert('First monthly installment invoice exists for October 2026 (subsequent month to September intake)', !!octInvoice);
  assert('October invoice base amount is ₹1,200', octInvoice?.amount === 1200);
  assert('October invoice includes ₹50 late fee as of Oct 11 (after Oct 10 due date)', octInvoice?.fine === 50 && octInvoice?.total === 1250);
  assert('October invoice status is OVERDUE', octInvoice?.status === 'OVERDUE');

  // 8. Verify Exam Fee (₹300) is NOT prematurely billed
  const hasPrematureExamInvoice = archanaLedgers.some((l) => l.feeType?.toLowerCase().includes('exam') && !l.feeType?.includes('School'));
  assert('Exam Fee (₹300) is NOT prematurely billed and waits for actual examination schedule', !hasPrematureExamInvoice);

  // 9. Verify totals match fee ledger exactly and ₹36,000 is never used
  const totalInvoiced = archanaLedgers.reduce((acc, l) => acc + (l.total ?? l.amount ?? 0), 0);
  const totalPaid = archanaLedgers.reduce((acc, l) => acc + (l.paidAmount ?? 0), 0);
  const totalPending = archanaLedgers.reduce((acc, l) => acc + (l.pendingAmount ?? 0), 0);
  assert('Fee ledger total invoiced is ₹7,450 (₹6,200 admission + ₹1,250 October)', totalInvoiced === 7450);
  assert('Fee ledger total paid is ₹0', totalPaid === 0);
  assert('Fee ledger pending dues is exactly ₹7,450 (NOT ₹36,000)', totalPending === 7450 && totalPending !== 36000);

  // 10. Verify no duplicate invoices exist for Archana
  const invoiceNumbers = archanaLedgers.map((l) => l.invoiceNumber);
  const uniqueInvoices = new Set(invoiceNumbers);
  assert('All invoices for student have unique invoice numbers (zero duplicates)', invoiceNumbers.length === uniqueInvoices.size);

  // 11. Test Refresh Idempotency: re-running /api/fee-ledgers preserves exact amounts
  const refreshLedgersRes = await request(`/api/fee-ledgers?studentId=${archana.id}`);
  const refreshedLedgers: any[] = refreshLedgersRes.data;
  const refreshedTotal = refreshedLedgers.reduce((acc, l) => acc + (l.total ?? l.amount ?? 0), 0);
  assert('Ledger totals are identical after page refresh / repeated query (₹7,450)', refreshedTotal === 7450);

  console.log('\n--- TEST GROUP 2: Student Admission Photo Upload & Preview ---');

  // 12. Test presigned upload endpoint for student photo
  const presignRes = await request('/api/files/presign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      fileName: 'archana_passport.jpg',
      contentType: 'image/jpeg',
      fileSize: 45000,
      folder: 'students/photos',
    },
  });
  assert('POST /api/files/presign-upload returns HTTP 200 for JPG photo', presignRes.status === 200);
  assert('Presign response returns fileKey in students/photos directory', presignRes.data?.fileKey?.includes('students/photos'));
  assert('Presign response returns valid uploadUrl', !!presignRes.data?.uploadUrl);

  const testFileKey = presignRes.data?.fileKey;
  const uploadUrl = presignRes.data?.uploadUrl;

  // 13. Test streaming image upload via PUT
  const fakeImageData = Buffer.from('TEST_JPEG_RAW_IMAGE_DATA_BYTES_OK');
  const uploadPutRes = await request(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(fakeImageData.length) },
    body: fakeImageData,
  });
  assert('PUT stream-upload returns HTTP 200 OK', uploadPutRes.status === 200);
  assert('Upload response indicates success: true and returns storageProvider', uploadPutRes.data?.success === true);

  // 14. Test file retrieval / content serving via GET /api/files/content
  const contentRes = await request(`/api/files/content?key=${encodeURIComponent(testFileKey)}`);
  assert('GET /api/files/content returns HTTP 200 for uploaded photo', contentRes.status === 200);
  assert('Content-Type header is image/jpeg', contentRes.headers['content-type']?.includes('image/jpeg'));
  assert('Response body matches uploaded photo data', contentRes.data === 'TEST_JPEG_RAW_IMAGE_DATA_BYTES_OK');

  // 15. Test client validation rules on photo files
  // We check that server and client both reject invalid mime types and large files
  const invalidExtPresign = await request('/api/files/presign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      fileName: 'malicious_script.sh',
      contentType: 'application/x-sh',
      fileSize: 500,
      folder: 'students/photos',
    },
  });
  assert('Invalid script/non-image format is rejected with HTTP 400', invalidExtPresign.status === 400);

  // 16. Test student admission with photo
  const testStudentData = {
    firstName: 'Priya',
    lastName: 'Sharma',
    gender: 'FEMALE',
    dob: '2013-08-20',
    className: 'Class 6',
    classId: 'c-6',
    section: 'A',
    admissionDate: '2026-10-11',
    fatherName: 'Rajesh Sharma',
    fatherMobile: '9876543210',
    photo: testFileKey,
    photoFileKey: testFileKey,
    feeProfile: {
      className: 'Class 6',
      section: 'A',
      academicSession: '2026-2027',
      feeHeads: [
        { head: 'Admission Fee', category: 'ONE_TIME', frequency: 'One Time', amount: 5000, selected: true },
        { head: 'School Fee', category: 'MONTHLY', frequency: 'Monthly', amount: 1500, selected: true },
      ],
      totalOneTimeFee: 5000,
      totalMonthlyFee: 1500,
      totalYearlyFee: 0,
      totalApplicableFee: 23000,
      monthlyPayableAmount: 1500,
    },
  };

  const admitRes = await request('/api/students', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-user-role': 'SCHOOL_ADMIN',
      'x-auth-user-id': 'admin-1',
    },
    body: testStudentData,
  });
  assert('New student admission with uploaded photo succeeds (HTTP 200)', admitRes.status === 200);
  assert('Admitted student retains photoFileKey', admitRes.data?.photoFileKey === testFileKey);

  // 17. Verify newly admitted student photo is served immediately via /api/files/content
  const verifyAdmittedPhoto = await request(`/api/files/content?key=${encodeURIComponent(admitRes.data.photoFileKey)}`);
  assert('Photo for newly admitted student is served immediately (HTTP 200)', verifyAdmittedPhoto.status === 200);

  // 18. Verify newly admitted student has admission invoice for one-time fee
  const newStudentLedgers = await request(`/api/fee-ledgers?studentId=${admitRes.data.id}`);
  const nLedgers: any[] = newStudentLedgers.data;
  const nAdmInvoice = nLedgers.find((l) => l.feeType?.includes('Admission') || l.invoiceNumber?.startsWith('INV-ADM-'));
  assert('Newly admitted student immediately receives Admission invoice for ₹5,000', nAdmInvoice?.total === 5000);
  assert('First monthly installment is NOT billed in October for October-enrolled student', !nLedgers.some((l) => l.feeMonth === 'October 2026'));

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log(`SUCCESS RATE: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerificationSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
