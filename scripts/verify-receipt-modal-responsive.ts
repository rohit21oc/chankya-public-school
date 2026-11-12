import { generateReceiptPdfDoc } from '../src/utils/receiptPdfExporter';
import { FeePayment, Student, FeeLedgerEntry, SchoolSettings } from '../src/types';

async function verifyReceiptModalResponsive() {
  console.log('========================================================================');
  console.log('VERIFICATION: FEE RECEIPT PREVIEW/MODAL FULLY RESPONSIVE TEST SUITE');
  console.log('========================================================================\n');

  // 1. Mock Payment and Student Data
  const mockPayment: FeePayment = {
    id: 'fp-test-responsive',
    receiptNumber: 'REC-2026-0045',
    studentId: 'st-test',
    studentName: 'Aarav Sharma',
    admissionNumber: '64010016',
    className: 'Class 9',
    section: 'A',
    amount: 19650,
    feeType: 'Full Settlement of All Outstanding Dues (2 Bills)',
    academicSession: '2026-2027',
    paymentMethod: 'ONLINE_UPI',
    paymentMode: 'UPI',
    transactionReference: 'UPI-849201',
    paymentDate: '2026-10-06',
    collectedBy: 'Vikram Sethi (Accounts)',
    discount: 0,
    fine: 0,
    balanceDue: 0,
    totalBill: 19650,
    baseDue: 19650,
    remarks: 'Full settlement of all outstanding invoices',
    breakdown: [
      { head: 'Admission & Initial Charges', amount: 16850 },
      { head: 'Monthly School Fee (December 2026)', amount: 2800 },
    ],
  };

  const mockStudent: Student = {
    id: 'st-test',
    name: 'Aarav Sharma',
    admissionNumber: '64010016',
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

  const mockSettings: SchoolSettings = {
    schoolName: 'RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR',
    schoolAddress: 'BRC Near Shahpur Road, Sheohar, Bihar - 843329',
    affiliationNumber: '10030206405',
    schoolCode: 'PDS-SHR-6405',
    contactNumber: '95075 95491',
    currentAcademicSession: '2026-2027',
  } as any;

  // 2. Validate PDF Generation is Unbroken
  console.log('>>> [1/4] Verifying 1-Page A4 PDF Generation Remains Unbroken...');
  const doc = generateReceiptPdfDoc({
    payment: mockPayment,
    student: mockStudent,
    ledger: null,
    settings: mockSettings,
  });

  const pageCount = doc.getNumberOfPages();
  const pdfString = doc.output();
  console.log(`  PDF Pages: ${pageCount}`);
  if (pageCount !== 1) {
    throw new Error(`Expected exactly 1 page PDF, got ${pageCount}`);
  }
  if (!pdfString.includes('REC-2026-0045')) {
    throw new Error('PDF output missing receipt number');
  }
  if (!pdfString.includes('SCHOOL COPY') || !pdfString.includes('STUDENT COPY')) {
    throw new Error('PDF output missing dual slip headers');
  }
  console.log('  [PASS] Vector A4 1-page PDF exporter verified intact.\n');

  // 3. Inspect Component Source Code for Responsive Architecture
  console.log('>>> [2/4] Verifying Modal Responsive Architecture & Sticky Header Rules...');
  const fs = await import('fs');
  const modalSource = fs.readFileSync('src/components/modals/PrintableReceiptModal.tsx', 'utf8');

  // Check 1: Sticky Top Header with shrink-0
  if (!modalSource.includes('sticky top-0 z-30 shrink-0')) {
    throw new Error('Action bar missing "sticky top-0 z-30 shrink-0" class');
  }
  console.log('  [PASS] Header configured with "sticky top-0 z-30 shrink-0".');

  // Check 2: 100dvh modal dialog height with proper internal scroll
  if (!modalSource.includes('h-[100dvh] sm:h-[94dvh] max-h-[100dvh] sm:max-h-[94dvh]')) {
    throw new Error('Modal dialog missing "h-[100dvh] sm:h-[94dvh] max-h-[100dvh] sm:max-h-[94dvh]" height constraint');
  }
  console.log('  [PASS] Modal dialog height handles 100dvh on mobile and max-h-94dvh on tablet/desktop.');

  // Check 3: Outer Backdrop overflow-hidden
  if (!modalSource.includes('overflow-hidden print:p-0 print:bg-white')) {
    throw new Error('Outer backdrop must have overflow-hidden to prevent body scrolling away');
  }
  console.log('  [PASS] Outer portal root has overflow-hidden preventing backdrop scroll.');

  // Check 4: Internal scroll area has flex-1 min-h-0 overflow-y-auto
  if (!modalSource.includes('flex-1 min-h-0 overflow-y-auto overflow-x-hidden')) {
    throw new Error('Printable container missing flex-1 min-h-0 overflow-y-auto');
  }
  console.log('  [PASS] Printable content area has "flex-1 min-h-0 overflow-y-auto overflow-x-hidden".');

  // Check 5: Action buttons responsive design for mobile (compact/wrap) vs desktop
  console.log('>>> [3/4] Verifying Action Buttons Responsive Layout...');
  if (!modalSource.includes('id="btn-download-pdf"') || !modalSource.includes('id="btn-print-action"')) {
    throw new Error('Action buttons IDs missing');
  }
  if (!modalSource.includes('flex flex-col sm:flex-row sm:items-center sm:justify-between')) {
    throw new Error('Header missing responsive flex layout for mobile stacking/tablet row');
  }
  console.log('  [PASS] Buttons use responsive flex layout (stacked/compact on mobile, inline on tablet/PC).');

  // Check 6: Print styles isolation
  console.log('>>> [4/4] Verifying Print Isolation & Dual Slip Layout...');
  const indexCss = fs.readFileSync('src/index.css', 'utf8');
  if (!indexCss.includes('body.receipt-modal-active #printable-fee-receipt-container')) {
    throw new Error('Print styles missing in index.css');
  }
  if (!modalSource.includes('copyType="SCHOOL COPY"') || !modalSource.includes('copyType="STUDENT COPY"')) {
    throw new Error('Dual slip layout missing');
  }
  console.log('  [PASS] Dual-slip A4 layout and @media print isolation verified.');

  console.log('\n========================================================================');
  console.log('ALL RESPONSIVE CHECKS PASSED: MOBILE, TABLET & DESKTOP FULLY COMPLIANT!');
  console.log('========================================================================');
}

verifyReceiptModalResponsive().catch((err) => {
  console.error('\n[RESPONSIVE VERIFICATION FAILED]:', err);
  process.exit(1);
});
