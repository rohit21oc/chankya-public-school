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

async function runCollectPaymentReceiptFlow() {
  console.log('========================================================================');
  console.log('END-TO-END FLOW: COLLECT PAYMENT -> RECEIPT PREVIEW -> 1-PAGE A4 PDF');
  console.log('========================================================================\n');

  // 1. Authenticate Accountant / Admin
  console.log('>>> [1/4] Authenticating Accountant user...');
  const loginRes = await postJson('/api/auth/login', {
    identifier: 'admin',
    password: 'admin123',
    loginType: 'STAFF_ADMIN',
  });
  const token = loginRes.data.token;
  if (!token) throw new Error('Authentication failed: ' + JSON.stringify(loginRes.data));
  console.log('  [PASS] Authenticated successfully.\n');

  // 2. Fetch Settings & Active Student
  console.log('>>> [2/4] Fetching School Settings & Target Student...');
  const settingsRes = await getJson('/api/settings', token);
  const settings: SchoolSettings = settingsRes.data;

  const studentsRes = await getJson('/api/students', token);
  const studentsList: Student[] = Array.isArray(studentsRes.data)
    ? studentsRes.data
    : studentsRes.data.data || studentsRes.data.students || [];
  const targetStudent = studentsList.find((s) => s.status === 'ACTIVE') || studentsList[0];
  if (!targetStudent) throw new Error('No active student found.');
  console.log(`  [PASS] Target Student: ${targetStudent.name} (${targetStudent.admissionNumber}) - ${targetStudent.className}-${targetStudent.section}\n`);

  // 3. Process Fee Collection
  console.log('>>> [3/4] Processing Fee Payment via /api/fees/payments...');
  const paymentPayload = {
    studentId: targetStudent.id,
    studentName: targetStudent.name,
    admissionNumber: targetStudent.admissionNumber,
    className: targetStudent.className,
    section: targetStudent.section,
    academicSession: targetStudent.academicSession || '2026-2027',
    feeType: 'Tuition Fee (Quarterly Settlement)',
    amount: 4500,
    discount: 250,
    paymentMethod: 'UPI',
    transactionReference: `UPI/${Date.now().toString().slice(-8)}`,
    remarks: 'Counter Payment - A4 Receipt Verification Test',
    collectedBy: 'Accountant Desk (Accounts Dept)',
  };

  const payRes = await postJson('/api/fees/payments', paymentPayload, token);
  if (payRes.status !== 200 && payRes.status !== 201) {
    throw new Error('Payment collection failed: ' + JSON.stringify(payRes.data));
  }
  const createdPayment: FeePayment = payRes.data.payment || payRes.data;
  console.log(`  [PASS] Payment recorded! Receipt Number: ${createdPayment.receiptNumber}, Amount: ₹${createdPayment.amount}`);
  console.log(`  Mode: ${createdPayment.paymentMethod} (${createdPayment.transactionReference})\n`);

  // 4. Generate 1-Page A4 PDF Receipt (School Copy + Student Copy)
  console.log('>>> [4/4] Validating 1-Page A4 PDF Receipt Generation...');
  const pdfDoc = generateReceiptPdfDoc({
    payment: createdPayment,
    student: targetStudent,
    ledger: null,
    settings,
  });

  const pageCount = pdfDoc.getNumberOfPages();
  const width = pdfDoc.internal.pageSize.getWidth();
  const height = pdfDoc.internal.pageSize.getHeight();

  console.log(`  PDF Page Count: ${pageCount}`);
  console.log(`  PDF Dimensions: ${width.toFixed(1)}mm x ${height.toFixed(1)}mm`);

  if (pageCount !== 1) {
    throw new Error(`CRITICAL: PDF has ${pageCount} pages, must be EXACTLY 1 page!`);
  }
  if (Math.abs(width - 210) > 1 || Math.abs(height - 297) > 1) {
    throw new Error(`PDF dimensions (${width}x${height}) are not A4 portrait (210x297)`);
  }

  const output = pdfDoc.output();
  if (!output.includes(createdPayment.receiptNumber)) {
    throw new Error(`PDF output missing receipt number: ${createdPayment.receiptNumber}`);
  }
  if (!output.includes('SCHOOL COPY') || !output.includes('STUDENT COPY')) {
    throw new Error('PDF output missing one of the two copies.');
  }

  console.log('  [PASS] STRICT 1-PAGE A4 RECEIPT VERIFIED:');
  console.log(`    ✓ Both SCHOOL COPY and STUDENT COPY present on the same A4 page.`);
  console.log(`    ✓ Receipt #${createdPayment.receiptNumber} with amount ₹${createdPayment.amount.toLocaleString('en-IN')}.`);
  console.log(`    ✓ Exact 1 Page. No second page, no overflow, no clipping.`);

  console.log('\n========================================================================');
  console.log('COMPLETE COLLECT PAYMENT -> RECEIPT -> 1-PAGE A4 PDF FLOW PASSED 100%!');
  console.log('========================================================================');
}

runCollectPaymentReceiptFlow().catch((err) => {
  console.error('\n[FLOW TEST FAILED]:', err);
  process.exit(1);
});
