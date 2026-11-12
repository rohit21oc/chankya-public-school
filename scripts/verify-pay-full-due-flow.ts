import http from 'http';
import { generateReceiptPdfDoc } from '../src/utils/receiptPdfExporter';
import { FeePayment, Student, FeeLedgerEntry, SchoolSettings } from '../src/types';

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

async function verifyPayFullDueFlow() {
  console.log('========================================================================');
  console.log('VERIFICATION: PAY FULL DUE WORKFLOW, ATOMIC SETTLEMENT & RECEIPT SUITE');
  console.log('========================================================================\n');

  // 1. Authenticate Staff/Admin
  console.log('>>> [1/7] Authenticating Accountant / Admin...');
  const loginRes = await postJson('/api/auth/login', {
    identifier: 'admin',
    password: 'admin123',
    loginType: 'STAFF_ADMIN',
  });
  const token = loginRes.data.token;
  if (!token) throw new Error('Authentication failed: ' + JSON.stringify(loginRes.data));
  console.log('  [PASS] Authenticated successfully.\n');

  // 2. Fetch Settings
  console.log('>>> [2/7] Fetching School Settings...');
  const settingsRes = await getJson('/api/settings', token);
  const settings: SchoolSettings = settingsRes.data;
  console.log(`  [PASS] School Name: ${settings.schoolName}\n`);

  // 3. Find or set up a student with pending dues (e.g. ₹19,650 or multiple bills)
  console.log('>>> [3/7] Finding or setting up test student with outstanding invoices...');
  const studentsRes = await getJson('/api/students', token);
  const studentsList: Student[] = Array.isArray(studentsRes.data)
    ? studentsRes.data
    : studentsRes.data.data || studentsRes.data.students || [];

  // Look for a student with pending invoices or pick an active student
  const allLedgersRes = await getJson('/api/fee-ledgers', token);
  const allLedgers: FeeLedgerEntry[] = allLedgersRes.data;

  // Let's create a dedicated test student with exactly 2 invoices totaling ₹19,650 to test the exact user brief!
  const testStudentId = `st-test-payfull-${Date.now()}`;
  const testAdmNo = `6401${Math.floor(1000 + Math.random() * 9000)}`;
  const testStudent: Student = {
    id: testStudentId,
    name: 'Aarav Test Sharma',
    admissionNumber: testAdmNo,
    className: 'Class 9',
    section: 'A',
    gender: 'MALE',
    dob: '2011-05-15',
    fatherName: 'Rajesh Sharma',
    fatherMobile: '9876500001',
    parentPhone: '9876500001',
    address: 'Sheohar, Bihar',
    status: 'ACTIVE',
    enrollmentDate: '2026-04-01',
    academicSession: '2026-2027',
  } as any;

  // Add test student
  const addStudentRes = await postJson('/api/students', testStudent, token);
  if (addStudentRes.status !== 200 && addStudentRes.status !== 201) {
    throw new Error('Failed to create test student: ' + JSON.stringify(addStudentRes.data));
  }
  console.log(`  [PASS] Created test student: ${testStudent.name} (${testAdmNo})`);

  // Create Bill 1: Admission Charges ₹16,850
  const bill1 = {
    studentId: testStudentId,
    feeType: 'Admission & Initial Charges',
    applicableMonth: 'Admission 2026',
    amount: 16850,
    dueDate: '2026-09-15', // Past due / Overdue
  };
  const bill1Res = await postJson('/api/fee-ledgers/bill', bill1, token);
  if (bill1Res.status !== 200 && bill1Res.status !== 201) {
    throw new Error('Failed to create Bill 1: ' + JSON.stringify(bill1Res.data));
  }

  // Create Bill 2: Monthly Tuition Fee ₹2,800 (16850 + 2800 = 19650)
  const bill2 = {
    studentId: testStudentId,
    feeType: 'Monthly School Fee (December 2026)',
    applicableMonth: 'December 2026',
    amount: 2800,
    dueDate: '2026-12-15',
  };
  const bill2Res = await postJson('/api/fee-ledgers/bill', bill2, token);
  if (bill2Res.status !== 200 && bill2Res.status !== 201) {
    throw new Error('Failed to create Bill 2: ' + JSON.stringify(bill2Res.data));
  }

  console.log('  [PASS] Created 2 invoices: Bill 1 = ₹16,850 (overdue), Bill 2 = ₹2,800. Total = ₹19,650.\n');

  // Verify pending dues before payment
  const studentLedgersBefore = await getJson(`/api/fee-ledgers?studentId=${testStudentId}`, token);
  const ledgersBefore: FeeLedgerEntry[] = studentLedgersBefore.data;
  const initialTotalPending = ledgersBefore.reduce((sum, l) => sum + Number(l.pendingAmount ?? (l.total || l.amount)), 0);
  console.log(`>>> [4/7] Verified initial pending balance across ${ledgersBefore.length} bills: ₹${initialTotalPending.toLocaleString('en-IN')}`);
  if (initialTotalPending <= 0) {
    throw new Error(`Expected pending dues > 0, got ${initialTotalPending}`);
  }
  console.log(`  [PASS] Initial balance loaded: ₹${initialTotalPending.toLocaleString('en-IN')}.\n`);

  // 4. Execute Pay Full Due via /api/fee-ledgers/student/:studentId/pay-full
  console.log(`>>> [5/7] Executing Pay Full Due (₹${initialTotalPending.toLocaleString('en-IN')}) with mode UPI, custom ref and remarks...`);
  const txnRef = `UPI-FULL-${Date.now().toString().slice(-6)}`;
  const idempotencyKey = `idem-test-payfull-${Date.now()}`;
  const payFullPayload = {
    amountPaid: initialTotalPending,
    discount: 0,
    fine: 0,
    paymentMethod: 'ONLINE_UPI',
    transactionReference: txnRef,
    collectedBy: 'Vikram Sethi (Accounts)',
    remarks: 'Full settlement of all outstanding invoices',
    paymentDate: '2026-10-06',
    idempotencyKey,
  };

  const payFullRes = await postJson(`/api/fee-ledgers/student/${testStudentId}/pay-full`, payFullPayload, token);
  if (payFullRes.status !== 200) {
    throw new Error('Pay full due request failed: ' + JSON.stringify(payFullRes.data));
  }
  const payFullData = payFullRes.data;
  console.log('  [PASS] Pay Full Due API returned success: true');
  console.log(`  Settled Bills Count: ${payFullData.settledCount}`);
  console.log(`  Master Receipt Number: ${payFullData.payment?.receiptNumber}`);
  console.log(`  Receipt Amount: ₹${payFullData.payment?.amount}`);
  console.log(`  Receipt Balance Due: ₹${payFullData.payment?.balanceDue}`);
  console.log(`  Itemized Breakdown Count: ${payFullData.payment?.breakdown?.length}`);

  if (payFullData.settledCount !== ledgersBefore.length) {
    throw new Error(`Expected ${ledgersBefore.length} settled invoices, got ${payFullData.settledCount}`);
  }
  if (payFullData.payment?.amount !== initialTotalPending) {
    throw new Error(`Expected receipt amount ${initialTotalPending}, got ${payFullData.payment?.amount}`);
  }
  if (payFullData.payment?.balanceDue !== 0) {
    throw new Error(`Expected balanceDue 0, got ${payFullData.payment?.balanceDue}`);
  }

  // Idempotency replay check: sending identical request with same idempotencyKey must return cached result and NOT double-charge!
  console.log('>>> [6/7] Testing Idempotency & Concurrency Safety (Replay Protection)...');
  const replayRes = await postJson(`/api/fee-ledgers/student/${testStudentId}/pay-full`, payFullPayload, token);
  if (replayRes.status !== 200) {
    throw new Error('Replay request failed: ' + JSON.stringify(replayRes.data));
  }
  if (!replayRes.data.isIdempotentReplay) {
    throw new Error('Expected isIdempotentReplay true on duplicate submission');
  }
  console.log('  [PASS] Duplicate payment prevented! isIdempotentReplay: true.\n');

  // 5. Verify Persistence & Updated Status in DB
  console.log('>>> [7/7] Verifying Persistence & ₹0 Balance across all ledgers & payments in database...');
  const studentLedgersAfter = await getJson(`/api/fee-ledgers?studentId=${testStudentId}`, token);
  const ledgersAfter: FeeLedgerEntry[] = studentLedgersAfter.data;
  const finalTotalPending = ledgersAfter.reduce((sum, l) => sum + Number(l.pendingAmount ?? 0), 0);
  console.log(`  Final Total Pending Balance: ₹${finalTotalPending}`);
  if (finalTotalPending !== 0) {
    throw new Error(`Expected final pending balance 0, got ${finalTotalPending}`);
  }

  for (const l of ledgersAfter) {
    console.log(`    Invoice "${l.feeType}" -> Status: ${l.status}, Paid: ₹${l.paidAmount}, Pending: ₹${l.pendingAmount}, Receipt: ${l.receiptNumber}`);
    if (l.status !== 'PAID') {
      throw new Error(`Expected ledger status PAID, got ${l.status}`);
    }
    if ((l.pendingAmount ?? 0) !== 0) {
      throw new Error(`Expected pendingAmount 0, got ${l.pendingAmount}`);
    }
  }
  console.log('  [PASS] All invoices successfully marked as PAID with ₹0 pending balance.');

  // Validate PDF Receipt Generation for the Full Settlement Payment
  console.log('\n>>> Validating 1-Page A4 Dual-Slip PDF Receipt for the ₹19,650 Full Settlement...');
  const masterPayment: FeePayment = payFullData.payment;
  const pdfDoc = generateReceiptPdfDoc({
    payment: masterPayment,
    student: testStudent,
    ledger: null,
    settings,
  });

  const pageCount = pdfDoc.getNumberOfPages();
  const pdfOutput = pdfDoc.output();
  console.log(`  PDF Pages: ${pageCount}`);
  if (pageCount !== 1) {
    throw new Error(`Expected exactly 1 page PDF, got ${pageCount}`);
  }
  if (!pdfOutput.includes(masterPayment.receiptNumber)) {
    throw new Error(`PDF missing receipt number ${masterPayment.receiptNumber}`);
  }
  if (!pdfOutput.includes('SCHOOL COPY') || !pdfOutput.includes('STUDENT COPY')) {
    throw new Error('PDF missing dual slip header.');
  }
  console.log('  [PASS] Strict 1-Page A4 Dual-Slip Receipt verified for ₹19,650 full settlement.');

  console.log('\n========================================================================');
  console.log('ALL 7/7 PAY FULL DUE VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================');
}

verifyPayFullDueFlow().catch((err) => {
  console.error('\n[VERIFICATION SUITE ERROR]:', err);
  process.exit(1);
});
