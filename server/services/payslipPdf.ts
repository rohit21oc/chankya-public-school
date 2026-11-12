import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

/**
 * Payslip PDF built from a stored PAID payroll record. Web and mobile both download these exact bytes
 * from the server, so the document is the same everywhere. Every figure comes from the record; nothing is
 * recalculated except an "Other adjustments" row that makes the listed lines add up to the stored totals.
 */

export interface PayslipSchool {
  schoolName?: string;
  schoolAddress?: string;
  affiliationNumber?: string;
  affiliatedBoard?: string;
  phone?: string;
  email?: string;
}

const money = (n: number) =>
  `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const below1000 = (n: number) => `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${below100(n % 100)}`;

export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.max(0, amount));
  const paise = Math.round((Math.max(0, amount) - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  let words = `${parts.join(' ')} Rupees`;
  if (paise) words += ` and ${below100(paise)} Paise`;
  return `${words} Only`;
}

const LABELS: Record<string, string> = {
  hra: 'House Rent Allowance (HRA)',
  da: 'Dearness Allowance (DA)',
  ta: 'Travel Allowance (TA)',
  special: 'Special Allowance',
  other: 'Other',
  pf: 'Provident Fund (PF)',
  tds: 'Tax Deducted at Source (TDS)',
  insurance: 'Insurance',
  leaveDeduction: 'Leave Deduction',
};

const METHOD: Record<string, string> = { BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', UPI: 'UPI', CASH: 'Cash' };

export function payslipFileName(record: { employeeId?: string; payrollMonth?: string; month?: string }): string {
  const emp = String(record.employeeId || 'staff').replace(/[^A-Za-z0-9_-]/g, '');
  const period = String(record.payrollMonth || record.month || 'payslip').replace(/[^A-Za-z0-9_-]+/g, '-');
  return `Payslip-${emp}-${period}.pdf`;
}

export function buildPayslipPdf(record: any, school: PayslipSchool = {}): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const NAVY: [number, number, number] = [18, 59, 140];

  // ---- Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(school.schoolName || 'School', W / 2, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const sub = [school.schoolAddress, school.affiliationNumber ? `${school.affiliatedBoard || 'Affiliation'} No. ${school.affiliationNumber}` : '']
    .filter(Boolean)
    .join('  |  ');
  if (sub) doc.text(sub, W / 2, 18, { align: 'center', maxWidth: W - 2 * M });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`PAYSLIP - ${String(record.month || record.payrollMonth || '').toUpperCase()}`, W / 2, 26, { align: 'center' });

  // ---- Employee + payment details
  doc.setTextColor(30, 41, 59);
  const periodText = record.salaryPeriodStart && record.salaryPeriodEnd ? `${record.salaryPeriodStart} to ${record.salaryPeriodEnd}` : String(record.month || '');
  const left: [string, string][] = [
    ['Employee Name', String(record.staffName || '-')],
    ['Employee ID', String(record.employeeId || '-')],
    ['Designation', String(record.designation || '-')],
    ['Department', String(record.department || '-')],
    ...(record.uanNumber ? ([['UAN', String(record.uanNumber)]] as [string, string][]) : []),
  ];
  const right: [string, string][] = [
    ['Payslip No.', String(record.salarySlipNumber || record.id || '-')],
    ['Pay Period', periodText],
    ['Payment Date', String(record.paymentDate || '-')],
    ['Payment Mode', METHOD[record.paymentMethod] || String(record.paymentMethod || '-')],
    ['Reference No.', String(record.transactionReference || (record.paymentMethod === 'CASH' ? 'Cash payment' : '-'))],
  ];
  autoTable(doc, {
    startY: 36,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.4, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 57 },
      2: { fontStyle: 'bold', cellWidth: 30 },
      3: { cellWidth: 'auto' },
    },
    body: left.map((l, i) => [l[0], l[1], right[i]?.[0] || '', right[i]?.[1] || '']).concat(
      right.length > left.length ? right.slice(left.length).map((r) => ['', '', r[0], r[1]]) : []
    ),
    margin: { left: M, right: M },
  });

  // ---- Attendance summary (only values present on the record)
  const att: [string, unknown][] = [
    ['Present', record.presentDays],
    ['Late', record.lateDays],
    ['Leave taken', record.leaveDaysTaken ?? record.approvedPaidLeaveDays],
    ['Leave forgiven', record.waivedLeaveDays ?? record.approvedPaidLeaveDays],
    ['Unpaid leave', record.unpaidLeaveDays],
    ['Holidays', record.holidayDays],
    ['Weekly off', record.weeklyOffDays],
    ...(Number(record.notEmployedDays) > 0 ? ([['Before salary start', record.notEmployedDays]] as [string, unknown][]) : []),
  ];
  const attShown = att.filter(([, v]) => v !== undefined && v !== null);
  let y = (doc as any).lastAutoTable.finalY + 3;
  if (attShown.length) {
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8.5, halign: 'center', cellPadding: 1.6, lineColor: [203, 213, 225], lineWidth: 0.1 },
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
      head: [attShown.map(([k]) => k)],
      body: [attShown.map(([, v]) => String(v))],
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ---- Earnings / deductions
  // One "Monthly Salary" line unless the record really carries an allowance split (older records may).
  const allowanceRows = Object.entries(record.allowances || {}).filter(([, v]) => Number(v));
  const earnings: [string, number][] = allowanceRows.length
    ? [['Basic Salary', Number(record.basicSalary) || 0], ...allowanceRows.map(([k, v]) => [LABELS[k] || k, Number(v)] as [string, number])]
    : [['Monthly Salary', Number(record.monthlySalary ?? record.basicSalary) || 0]];

  // Deductions from the named fields the payroll engine stores; the generic object only for old records.
  const deductions: [string, number][] = [];
  const named: [string, number][] = [
    [`Late arrival (${Number(record.lateDays) || 0} day${Number(record.lateDays) === 1 ? '' : 's'} x 25%)`, Number(record.lateDeduction) || 0],
    [`Unpaid leave / absence (${Number(record.unpaidLeaveDays) || 0} day${Number(record.unpaidLeaveDays) === 1 ? '' : 's'})`, Number(record.unpaidLeaveDeduction) || 0],
    [`Before salary start (${Number(record.notEmployedDays) || 0} day${Number(record.notEmployedDays) === 1 ? '' : 's'})`, Number(record.notEmployedDeduction) || 0],
    ['Other deductions', Number(record.otherDeductions) || 0],
  ];
  if (record.lateDeduction !== undefined || record.unpaidLeaveDeduction !== undefined) {
    for (const [label, v] of named) if (v) deductions.push([label, v]);
  } else {
    for (const [k, v] of Object.entries(record.deductions || {})) if (Number(v)) deductions.push([LABELS[k] || k, Number(v)]);
  }

  const earnTotal = allowanceRows.length
    ? (Number(record.basicSalary) || 0) + (Number(record.totalAllowances) || 0)
    : Number(record.monthlySalary ?? record.basicSalary) || 0;
  const earnListed = earnings.reduce((a, [, v]) => a + v, 0);
  if (Math.abs(earnTotal - earnListed) >= 0.01) earnings.push(['Other adjustments', Math.round((earnTotal - earnListed) * 100) / 100]);
  const dedTotal = Number(record.totalDeductions) || 0;
  const dedListed = deductions.reduce((a, [, v]) => a + v, 0);
  if (Math.abs(dedTotal - dedListed) >= 0.01) deductions.push(['Other adjustments', Math.round((dedTotal - dedListed) * 100) / 100]);

  const rows = Math.max(earnings.length, deductions.length);
  const body: string[][] = [];
  for (let i = 0; i < rows; i++) {
    body.push([earnings[i]?.[0] || '', earnings[i] ? money(earnings[i][1]) : '', deductions[i]?.[0] || '', deductions[i] ? money(deductions[i][1]) : '']);
  }
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.1, textColor: [30, 41, 59] },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
    body,
    foot: [['Gross Earnings', money(earnTotal), 'Total Deductions', money(dedTotal)]],
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: M, right: M },
    showFoot: 'lastPage',
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ---- Net pay
  const net = Number(record.netSalary) || 0;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(M, y, W - 2 * M, 20, 2, 2, 'FD');
  doc.setTextColor(6, 78, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('NET SALARY PAID', M + 4, y + 7);
  doc.setFontSize(14);
  doc.text(money(net), W - M - 4, y + 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`In words: ${amountInWords(net)}`, M + 4, y + 15, { maxWidth: W - 2 * M - 8 });

  // ---- Footer
  const H = doc.internal.pageSize.getHeight();
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  if (record.paidByName) doc.text(`Recorded by: ${record.paidByName}`, M, H - 22);
  doc.line(W - M - 50, H - 24, W - M, H - 24);
  doc.text('Authorised Signatory', W - M - 25, H - 20, { align: 'center' });
  doc.text('This is a computer-generated payslip for a salary that has been paid.', W / 2, H - 10, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
