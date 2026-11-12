import { persistentStorage } from '../server/storage/persistentStorage.ts';
import { StudentModel, FeeLedgerModel } from '../server/models/index.ts';

async function runTest() {
  console.log('--- STARTING ENROLLMENT MONTH DUE DATE & FUTURE INVOICE VERIFICATION SUITE ---');

  await persistentStorage.initialize();
  const students = await persistentStorage.loadStudents();
  const ledgers = await persistentStorage.loadFeeLedgers();

  // Test 1: Check Aditya Roy (enrolled 15-01-2026)
  const aditya = students.find((s) => s.name?.includes('Aditya') || s.id?.includes('aditya'));
  if (!aditya) {
    throw new Error('Test student Aditya Roy not found');
  }

  console.log(`[Test 1] Verifying student ${aditya.name} (Enrollment: ${aditya.enrollmentDate})`);
  const adityaLedgers = ledgers.filter((l) => l.studentId === aditya.id);
  const janLedger = adityaLedgers.find((l) => l.feeMonth === 'January 2026');
  const febLedger = adityaLedgers.find((l) => l.feeMonth === 'February 2026');
  const octLedger = adityaLedgers.find((l) => l.feeMonth === 'October 2026');

  if (!janLedger) {
    throw new Error('January 2026 invoice not found for Aditya Roy');
  }

  console.log(`[Test 1.1] January 2026 invoice dueDate: ${janLedger.dueDate} (must NOT be 2026-01-10)`);
  if (janLedger.dueDate === '2026-01-10') {
    throw new Error('FAILED: January 2026 due date is 2026-01-10, which is BEFORE enrollment date 15-01-2026');
  }
  if (janLedger.dueDate < '2026-01-15') {
    throw new Error(`FAILED: January 2026 due date ${janLedger.dueDate} is before enrollment date 2026-01-15`);
  }
  if (janLedger.dueDate !== '2026-01-25') {
    throw new Error(`Expected January 2026 due date to be 2026-01-25 (10 days from enrollment), got ${janLedger.dueDate}`);
  }
  console.log('✓ PASS: January 2026 due date is correctly 2026-01-25 (not before enrollment date).');

  if (!febLedger) {
    throw new Error('February 2026 invoice not found for Aditya Roy');
  }
  console.log(`[Test 1.2] February 2026 invoice dueDate: ${febLedger.dueDate} (must be 2026-02-10)`);
  if (febLedger.dueDate !== '2026-02-10') {
    throw new Error(`FAILED: February 2026 due date is ${febLedger.dueDate}, expected 2026-02-10`);
  }
  console.log('✓ PASS: February 2026 due date is correctly 2026-02-10.');

  if (!octLedger) {
    throw new Error('October 2026 invoice not found for Aditya Roy');
  }
  console.log(`[Test 1.3] October 2026 invoice dueDate: ${octLedger.dueDate}, fine: ${octLedger.fine}, status: ${octLedger.status}`);
  if (octLedger.dueDate !== '2026-10-10') {
    throw new Error(`FAILED: October 2026 due date is ${octLedger.dueDate}, expected 2026-10-10`);
  }
  // On 11 October 2026 (today), the invoice whose due date is 2026-10-10 has passed the 10th and is overdue with fine of 50.
  // Through 10 October, fine is 0 and status is PENDING. From 11 October onward, fine is 50 and status is OVERDUE.
  const todayInKolkata = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const isAfter10th = todayInKolkata > octLedger.dueDate;
  if (isAfter10th) {
    if (octLedger.fine !== 50) {
      throw new Error(`FAILED: October 2026 fine is ${octLedger.fine}, expected 50 (overdue from 11th onward)`);
    }
    if (octLedger.status !== 'OVERDUE') {
      throw new Error(`FAILED: October 2026 status is ${octLedger.status}, expected OVERDUE`);
    }
    console.log('✓ PASS: October 2026 invoice has fine 50 and status OVERDUE as today is 11 October (past 10th).');
  } else {
    if (octLedger.fine !== 0) {
      throw new Error(`FAILED: October 2026 fine is ${octLedger.fine}, expected 0 (due period 1st-10th)`);
    }
    if (octLedger.status !== 'PENDING') {
      throw new Error(`FAILED: October 2026 status is ${octLedger.status}, expected PENDING`);
    }
    console.log('✓ PASS: October 2026 invoice has fine 0 and status PENDING within due period.');
  }

  // Test 2: Verify Future Enrollment Date Student
  // A student enrolled in a future date (e.g. 2026-12-01) must NOT have any invoices generated for months before December 2026
  console.log('[Test 2] Testing Future Enrolled Student protection');
  const futureStudentId = 'st-future-test-2026';
  await StudentModel.deleteMany({ $or: [{ id: futureStudentId }, { admissionNumber: 'FUT9999' }] });
  await FeeLedgerModel.deleteMany({ studentId: futureStudentId });

  const futureStudent = await StudentModel.create({
    id: futureStudentId,
    admissionNumber: 'FUT9999',
    rollNumber: '99',
    name: 'Future Student',
    className: 'Class 3',
    section: 'A',
    classId: 'c-3',
    dob: '2016-01-01',
    address: 'Sheohar, Bihar',
    mobile: '9876543210',
    parentName: 'Parent of Future',
    parentPhone: '9876543210',
    admissionDate: '2026-12-01',
    enrollmentDate: '01-12-2026',
    feeStartDate: '01-12-2026',
    status: 'ACTIVE',
    gender: 'MALE',
    academicSession: '2026-2027',
  });

  // Call API to run engine
  const res = await fetch('http://localhost:3000/api/fee-ledgers/run-engine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reload: true }),
  });
  const data = await res.json();
  console.log('Engine run output:', { generatedCount: data.generatedCount, updatedLateFeesCount: data.updatedLateFeesCount });

  const futureLedgers = await FeeLedgerModel.find({ studentId: futureStudentId }).lean();
  console.log(`Future student ledgers count: ${futureLedgers.length}`);
  if (futureLedgers.length > 0) {
    throw new Error(`FAILED: Invoices were generated for a student whose enrollment is in the future (December 2026): ${JSON.stringify(futureLedgers)}`);
  }
  console.log('✓ PASS: Zero invoices generated before student Fee Start Date / Enrollment Date (December 2026).');

  // Test 3: Verify Future Month Invoices have NO Late Fee
  console.log('[Test 3] Testing Future Month Invoice late fee immunity');
  const futureMonthLedgerId = 'fl-future-nov-test';
  await FeeLedgerModel.deleteOne({ id: futureMonthLedgerId });
  await FeeLedgerModel.create({
    id: futureMonthLedgerId,
    invoiceNumber: 'INV-202611-FUT-101',
    studentId: aditya.id,
    admissionNumber: aditya.admissionNumber,
    studentName: aditya.name,
    className: aditya.className,
    section: aditya.section,
    academicSession: '2026-2027',
    feeMonth: 'November 2026',
    monthYear: 'November 2026',
    billingPeriod: 'November 2026',
    feeType: 'Monthly School Fee (November 2026)',
    amount: 3300,
    discount: 0,
    fine: 50, // artificially set to test reconciliation
    total: 3350,
    totalAmount: 3350,
    paidAmount: 0,
    pendingAmount: 3350,
    status: 'OVERDUE',
    dueDate: '2026-11-10',
    lateFeeApplied: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  });

  // Trigger engine run
  await fetch('http://localhost:3000/api/fee-ledgers/run-engine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reload: true }),
  });
  const reconciledNov = await FeeLedgerModel.findOne({ id: futureMonthLedgerId }).lean();
  console.log('Reconciled November invoice:', {
    dueDate: reconciledNov?.dueDate,
    fine: reconciledNov?.fine,
    status: reconciledNov?.status,
    lateFeeApplied: reconciledNov?.lateFeeApplied,
  });

  if (reconciledNov?.fine !== 0) {
    throw new Error(`FAILED: Future invoice November 2026 retained fine: ${reconciledNov?.fine}`);
  }
  if (reconciledNov?.status !== 'PENDING') {
    throw new Error(`FAILED: Future invoice November 2026 has status: ${reconciledNov?.status}, expected PENDING`);
  }
  if (reconciledNov?.lateFeeApplied !== false) {
    throw new Error(`FAILED: Future invoice November 2026 has lateFeeApplied: ${reconciledNov?.lateFeeApplied}`);
  }
  console.log('✓ PASS: Future-month invoice verified. Fine is 0, lateFeeApplied is false, status is PENDING.');

  // Clean up test data
  await StudentModel.deleteOne({ id: futureStudentId });
  await FeeLedgerModel.deleteOne({ id: futureMonthLedgerId });

  // Test 4: Idempotency check
  const secondRun = await (await fetch('http://localhost:3000/api/fee-ledgers/run-engine', { method: 'POST' })).json();
  if (secondRun.generatedCount !== 0 || secondRun.updatedLateFeesCount !== 0) {
    throw new Error(`FAILED: Repeated engine call produced duplicate generation: ${JSON.stringify(secondRun)}`);
  }
  console.log('✓ PASS: Idempotency verified on repeated execution (0 new, 0 updated).');

  console.log('\n======================================================');
  console.log('ALL ENROLLMENT-MONTH DUE DATE & FEE LOGIC TESTS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
