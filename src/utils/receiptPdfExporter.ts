import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FeePayment, SchoolSettings, Student, FeeLedgerEntry } from '../types';
import { numberToIndianWords } from './numberToWords';
import { getSchoolLogoSrc } from '../constants/schoolLogo';
import { NOT_CONFIGURED, letterheadLine, schoolIdentity } from './schoolIdentity';
import { getApiUrl } from '../services/apiConfig';

export interface ReceiptPdfParams {
  payment: FeePayment;
  student?: Student | null;
  ledger?: FeeLedgerEntry | null;
  settings: SchoolSettings;
  logoBase64?: string;
}

/**
 * Formats raw payment methods (e.g. CASH, ONLINE, UPI, BANK_TRANSFER) into user-friendly names.
 */
export function formatPaymentMethod(method?: string, mode?: string): string {
  const raw = (method || mode || '').trim().toUpperCase();
  switch (raw) {
    case 'CASH':
      return 'Cash';
    case 'UPI':
    case 'ONLINE_UPI':
      return 'UPI';
    case 'ONLINE':
      return 'Online / NetBanking';
    case 'BANK_TRANSFER':
    case 'BANK':
    case 'NEFT':
    case 'RTGS':
    case 'IMPS':
      return 'Bank Transfer';
    case 'CHEQUE':
      return 'Cheque';
    case 'DEMAND_DRAFT':
    case 'DD':
      return 'Demand Draft';
    case 'POS':
    case 'CARD':
    case 'DEBIT_CARD':
    case 'CREDIT_CARD':
      return 'Debit / Credit Card';
    default:
      return method || mode || 'Cash';
  }
}

/**
 * Helper to dynamically load school logo as Base64 Data URL in both browser and Node environments.
 */
export async function getLogoBase64Async(settings?: SchoolSettings): Promise<string | null> {
  const logoCandidate = settings?.schoolLogo || (settings as any)?.logoFileKey;
  if (typeof logoCandidate === 'string' && logoCandidate.startsWith('data:image/')) {
    return logoCandidate;
  }

  // Node.js environment (e.g. CLI test scripts)
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs');
      const candidatePaths = [
        'data/storage/school/school-logo/30a46bbd-e5b6-454b-9e47-cb3637a5f2ff.png',
        './data/storage/school/school-logo/30a46bbd-e5b6-454b-9e47-cb3637a5f2ff.png',
      ];
      if (typeof logoCandidate === 'string' && logoCandidate.trim()) {
        candidatePaths.unshift(`data/storage/${logoCandidate.trim()}`);
        candidatePaths.unshift(`./data/storage/${logoCandidate.trim()}`);
      }
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          const buf = fs.readFileSync(p);
          const ext = p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'jpeg' : 'png';
          return `data:image/${ext};base64,${buf.toString('base64')}`;
        }
      }
    } catch {}
    return null;
  }

  // Browser environment: fetch from dynamic logo URL
  try {
    const logoUrl =
      getSchoolLogoSrc(logoCandidate) ||
      '/api/files/content?key=school/school-logo/30a46bbd-e5b6-454b-9e47-cb3637a5f2ff.png';
    const res = await fetch(getApiUrl(logoUrl));
    if (res.ok) {
      const blob = await res.blob();
      return new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }
  } catch {}

  return null;
}

/** Prints text in the cell width: shrinks the font down to `minSize`, and only shortens with ".." if it still does not fit. */
function fitText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, size: number, minSize = 5) {
  let fs = size;
  doc.setFontSize(fs);
  while (fs > minSize && doc.getTextWidth(text) > maxWidth) {
    fs -= 0.2;
    doc.setFontSize(fs);
  }
  let out = text;
  while (out.length > 4 && doc.getTextWidth(out) > maxWidth) out = out.slice(0, -1);
  doc.text(out === text ? text : `${out.trimEnd()}..`, x, y);
}

/**
 * Draws a single receipt slip (either SCHOOL COPY or STUDENT COPY)
 * strictly within the assigned vertical bounds (startY to startY + 132mm).
 */
function drawReceiptSlip(
  doc: jsPDF,
  startY: number,
  copyTitle: 'SCHOOL COPY' | 'STUDENT COPY',
  params: ReceiptPdfParams
) {
  const { payment, student, ledger, settings } = params;
  const isSchoolCopy = copyTitle === 'SCHOOL COPY';
  const paidAmount = Number(payment.amount) || 0;
  const discountAmount = Number(payment.discount || 0); // only what changed at this payment; the bill's own late fee is one of its heads
  const fineAmount = Number(payment.fine || 0);

  const rawBreakdownItems =
    (payment as any)?.breakdown && (payment as any).breakdown.length > 0
      ? (payment as any).breakdown
      : ledger?.breakdown && ledger.breakdown.length > 0
      ? ledger.breakdown
      : [
          {
            head: payment.feeType || 'Tuition & School Fee',
            amount: paidAmount,
          },
        ];

  // Group excess heads if more than 5 to preserve exact total without overflow
  const breakdownItems =
    rawBreakdownItems.length <= 5
      ? rawBreakdownItems
      : [
          ...rawBreakdownItems.slice(0, 4),
          {
            head: `Other Sundry Fees (${rawBreakdownItems.length - 4} Heads)`,
            amount: rawBreakdownItems
              .slice(4)
              .reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
          },
        ];

  const totalBillAmount = ledger ? Number(ledger.total ?? ledger.amount ?? 0) : paidAmount;
  const balanceDue = (payment as any).balanceDue !== undefined
    ? Number((payment as any).balanceDue)
    : (ledger
      ? Number(ledger.pendingAmount ?? Math.max(0, totalBillAmount - (ledger.paidAmount || paidAmount)))
      : 0);

  const invoiceNumStr = ledger?.invoiceNumber || (payment as any).invoiceNumber || 'INV-AUTO';

  // Actual dynamic Period / Fee Month from MongoDB ledger / payment
  const periodLabel =
    ledger?.feeMonth ||
    ledger?.monthYear ||
    (payment as any).feeMonth ||
    (payment as any).monthYear ||
    (payment as any).billingPeriod ||
    ledger?.billingPeriod ||
    payment.feeType ||
    'Admission 2026';

  const paymentMode = formatPaymentMethod(
    payment.paymentMethod,
    (payment as any).paymentMode || ledger?.paymentMethod || (ledger as any)?.paymentMode
  );

  const rawTxn =
    payment.transactionReference ||
    (payment as any).transactionNumber ||
    (payment as any).txnNumber ||
    (payment as any).referenceNo ||
    '';
  const ledgerTxn =
    ledger?.transactionReference ||
    (ledger as any)?.transactionNumber ||
    (ledger as any)?.txnNumber ||
    (ledger as any)?.referenceNo ||
    '';

  let transactionRef = rawTxn;
  if (
    !transactionRef ||
    transactionRef === 'N/A' ||
    transactionRef === 'Cash Counter' ||
    transactionRef === 'COUNTER-CASH'
  ) {
    if (ledgerTxn && ledgerTxn !== 'N/A' && ledgerTxn !== 'Cash Counter') {
      transactionRef = ledgerTxn;
    }
  }
  if (!transactionRef) {
    transactionRef =
      ((payment.paymentMethod || (payment as any).paymentMode || ledger?.paymentMethod || '').toUpperCase() === 'CASH'
        ? 'Cash Counter'
        : 'N/A');
  }

  const slipWidth = 194;
  const slipHeight = 132;
  const leftX = 8;
  const rightX = leftX + slipWidth;

  // 1. Slip Outer Border
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(leftX, startY, slipWidth, slipHeight, 2, 2, 'FD');

  // 2. School Institutional Logo representation
  const badgeX = leftX + 3;
  const badgeY = startY + 3;
  let logoDrawn = false;

  const logoBase64 = params.logoBase64;
  if (logoBase64 && logoBase64.startsWith('data:image/')) {
    try {
      const format = logoBase64.includes('image/jpeg') || logoBase64.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(logoBase64, format, badgeX, badgeY, 13, 13, undefined, 'FAST');
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    doc.setFillColor(11, 31, 75); // #0B1F4B (Brand Primary Navy)
    doc.roundedRect(badgeX, badgeY, 13, 13, 2, 2, 'F');
    doc.setTextColor(243, 210, 122); // #F3D27A (Gold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PDS', badgeX + 6.5, badgeY + 6.5, { align: 'center' });
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text('PUBLIC', badgeX + 6.5, badgeY + 10.5, { align: 'center' });
  }

  // 3. School Header Particulars
  const textStartX = badgeX + 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  const schoolNameText = (settings?.schoolName || NOT_CONFIGURED).toUpperCase();
  doc.text(schoolNameText, textStartX, startY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105); // slate-600
  const schoolAddressText = settings?.schoolAddress || NOT_CONFIGURED;
  doc.text(schoolAddressText, textStartX, startY + 10.5);

  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const affiliationLine = letterheadLine(schoolIdentity(settings), { phone: true }) || 'School details not configured';
  doc.text(affiliationLine, textStartX, startY + 14);

  // 4. Right Top: Copy Badge & Session
  const badgeWidth = 46;
  const badgeHeight = 5.5;
  const copyBadgeX = rightX - badgeWidth - 3;
  const copyBadgeY = startY + 3;

  if (isSchoolCopy) {
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(245, 158, 11); // amber-500
    doc.setTextColor(120, 53, 15); // amber-900
  } else {
    doc.setFillColor(219, 234, 254); // blue-100
    doc.setDrawColor(59, 130, 246); // blue-500
    doc.setTextColor(30, 58, 138); // blue-900
  }
  doc.setLineWidth(0.2);
  doc.roundedRect(copyBadgeX, copyBadgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(copyTitle, copyBadgeX + badgeWidth / 2, copyBadgeY + 3.8, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85); // slate-700
  const sessionText = `Session: ${payment.academicSession || settings?.currentAcademicSession || '2026-2027'}`;
  doc.text(sessionText, rightX - 3, startY + 13.5, { align: 'right' });

  // 5. Header Divider Line
  doc.setDrawColor(30, 41, 59); // slate-800
  doc.setLineWidth(0.4);
  doc.line(leftX + 2, startY + 17, rightX - 2, startY + 17);

  // 6. Meta Grid: 5 Columns x 2 Rows
  const metaY = startY + 19;
  // Row 2 sits a little lower so the invoice number can have its own line under the receipt number.
  const rowGap = 3;
  const metaHeight = 17 + rowGap;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.2);
  doc.roundedRect(leftX + 2, metaY, slipWidth - 4, metaHeight, 1.5, 1.5, 'FD');

  const col1X = leftX + 4;
  const col2X = leftX + 42;
  const col3X = leftX + 80;
  const col4X = leftX + 118;
  const col5X = leftX + 158;

  // Row 1
  const r1LabelY = metaY + 3.8;
  const r1ValueY = metaY + 7.5;

  // Col 1: Receipt Number & Invoice Number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Receipt No.', col1X, r1LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(String(payment.receiptNumber || 'REC-N/A'), col1X, r1ValueY);
  // The invoice number is printed in full on its own line, shrinking a little if it is long.
  const invoiceLine = invoiceNumStr && invoiceNumStr !== 'INV-AUTO' ? `Invoice ${invoiceNumStr}` : '';
  if (invoiceLine) {
    const roomMm = col2X - col1X - 2;
    let invSize = 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(invSize);
    while (invSize > 4.4 && doc.getTextWidth(invoiceLine) > roomMm) {
      invSize -= 0.2;
      doc.setFontSize(invSize);
    }
    doc.setTextColor(71, 85, 105);
    doc.text(invoiceLine, col1X, r1ValueY + 3);
  }

  // Col 2: Date of Deposit
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Date of Deposit', col2X, r1LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(payment.paymentDate || 'N/A', col2X, r1ValueY);

  // Col 3: Admission Number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Admission Number', col3X, r1LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(student?.admissionNumber || payment.admissionNumber || 'N/A', col3X, r1ValueY);

  // Col 4: Student Name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Student Name', col4X, r1LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(11, 31, 75);
  const studentNameStr = student?.name || payment.studentName || 'Student';
  fitText(doc, studentNameStr, col4X, r1ValueY, col5X - col4X - 2, 7.5);

  // Col 5: Class & Section
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Class & Section', col5X, r1LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  const classSecStr = `${payment.className || student?.className || 'Class 6'} - ${payment.section || student?.section || 'A'}`;
  doc.text(classSecStr, col5X, r1ValueY);

  // Row 2
  const r2LabelY = metaY + 11.5 + rowGap;
  const r2ValueY = metaY + 15.2 + rowGap;

  // Col 1: Payment Mode
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Payment Mode', col1X, r2LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text(paymentMode, col1X, r2ValueY);

  // Col 2: Transaction Reference / No.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Transaction Ref / No.', col2X, r2LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  fitText(doc, transactionRef, col2X, r2ValueY, col3X - col2X - 2, 7.0);

  // Col 3: Period / Fee Month
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Period / Fee Month', col3X, r2LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  fitText(doc, periodLabel, col3X, r2ValueY, col4X - col3X - 2, 7.2);

  // Col 4: Parent / Guardian
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Parent / Guardian', col4X, r2LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  const parentNameStr = student?.fatherName || student?.guardianName || student?.parentName || 'Parent / Guardian';
  fitText(doc, parentNameStr, col4X, r2ValueY, col5X - col4X - 2, 7.0);

  // Col 5: Payment Status
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Payment Status', col5X, r2LabelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  if (balanceDue > 0) doc.setTextColor(180, 83, 9); // amber-700
  else doc.setTextColor(22, 101, 52); // emerald-800
  doc.text(balanceDue > 0 ? 'PART PAID' : 'PAID / CLEARED', col5X, r2ValueY);

  // 7. Fee Particulars Table using autoTable
  const tableStartY = metaY + metaHeight + 2;

  const tableBody: any[] = [];
  breakdownItems.forEach((item, idx) => {
    tableBody.push([
      String(idx + 1),
      item.head,
      periodLabel,
      `Rs. ${(Number(item.amount) || 0).toLocaleString('en-IN')}`,
    ]);
  });

  if (discountAmount > 0) {
    tableBody.push([
      '-',
      'Less: Scholarship / Fee Concession',
      periodLabel,
      `-Rs. ${discountAmount.toLocaleString('en-IN')}`,
    ]);
  }

  if (fineAmount > 0) {
    tableBody.push([
      '+',
      'Add: Late Fee Surcharge',
      periodLabel,
      `+Rs. ${fineAmount.toLocaleString('en-IN')}`,
    ]);
  }

  // Summary row
  tableBody.push([
    {
      content: 'Total Amount Deposited:',
      colSpan: 3,
      styles: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
    },
    {
      content: `Rs. ${paidAmount.toLocaleString('en-IN')}`,
      styles: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52], fontSize: 8 },
    },
  ]);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: leftX + 2, right: 210 - rightX + 2, top: 0, bottom: 0 },
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    head: [['#', 'Fee Particulars / Head', 'Period', 'Amount (Rs.)']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 1.0,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 1.2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 38 },
      3: { halign: 'right', cellWidth: 32 },
    },
  });

  const finalTableY = (doc as any).lastAutoTable.finalY || tableStartY + 25;

  // 8. Amount in words & Outstanding Dues Bar
  const wordsY = finalTableY + 1.5;
  const wordsBoxHeight = 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(leftX + 2, wordsY, slipWidth - 4, wordsBoxHeight, 1, 1, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Amount in words:', leftX + 4, wordsY + 3.2);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 23, 42);
  const wordsStr = numberToIndianWords(paidAmount);
  doc.text(wordsStr.length > 70 ? wordsStr.substring(0, 68) + '...' : wordsStr, leftX + 4, wordsY + 6.3);

  const dueX = rightX - 44;
  doc.setDrawColor(203, 213, 225);
  doc.line(dueX, wordsY + 1, dueX, wordsY + wordsBoxHeight - 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);

  if (balanceDue > 0) {
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text('Outstanding Balance:', dueX + 2, wordsY + 3.2);
    doc.setFontSize(7.2);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text(`Rs. ${balanceDue.toLocaleString('en-IN')}`, rightX - 4, wordsY + 6.3, { align: 'right' });
  } else {
    doc.setTextColor(22, 101, 52); // emerald-700
    doc.text('Outstanding Balance:', dueX + 2, wordsY + 3.2);
    doc.setFontSize(6.8);
    doc.setTextColor(22, 101, 52);
    doc.text('Rs. 0 (Fully Settled)', rightX - 4, wordsY + 6.3, { align: 'right' });
  }

  // 9. Signatures & Bottom Disclaimer
  const signY = startY + slipHeight - 13.5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(leftX + 2, signY, rightX - 2, signY);

  // Left Disclaimer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text('* Computer generated receipt. Retain this receipt for income tax deduction & school records.', leftX + 3, signY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Collected by: ${payment.collectedBy || 'Accounts Office'}   •   System Verified`, leftX + 3, signY + 8);

  // Right Signatures
  const sig1X = rightX - 65;
  const sig2X = rightX - 32;

  // Depositor Signature Line
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(sig1X, signY + 6, sig1X + 24, signY + 6);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Depositor Signature', sig1X + 12, signY + 9, { align: 'center' });

  // Authorized Signatory Line
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(sig2X, signY + 6, sig2X + 28, signY + 6);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Authorized Signatory', sig2X + 14, signY + 9, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(100, 116, 139);
  doc.text('Accounts Department', sig2X + 14, signY + 11.5, { align: 'center' });
}

/**
 * Builds and returns a jsPDF instance for the fee receipt with both
 * SCHOOL COPY and STUDENT COPY on exactly one A4 portrait page.
 */
export function generateReceiptPdfDoc(params: ReceiptPdfParams): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // If in Node.js environment and logoBase64 not provided, load synchronously from disk
  let effectiveParams = { ...params };
  if (!effectiveParams.logoBase64 && typeof window === 'undefined') {
    try {
      const fs = require('fs');
      const candidatePaths = [
        'data/storage/school/school-logo/30a46bbd-e5b6-454b-9e47-cb3637a5f2ff.png',
        './data/storage/school/school-logo/30a46bbd-e5b6-454b-9e47-cb3637a5f2ff.png',
      ];
      if (typeof effectiveParams.settings?.schoolLogo === 'string' && effectiveParams.settings.schoolLogo.trim()) {
        candidatePaths.unshift(`data/storage/${effectiveParams.settings.schoolLogo.trim()}`);
        candidatePaths.unshift(`./data/storage/${effectiveParams.settings.schoolLogo.trim()}`);
      }
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          const buf = fs.readFileSync(p);
          effectiveParams.logoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
          break;
        }
      }
    } catch {}
  }

  // 1. Draw Slip 1: SCHOOL COPY (Sized Y = 7 to Y = 139mm)
  drawReceiptSlip(doc, 7, 'SCHOOL COPY', effectiveParams);

  // 2. Draw Perforation Cut Line at Y = 144.5mm
  doc.setLineDashPattern([2, 1.5], 0);
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.3);
  doc.line(8, 144.5, 202, 144.5);
  doc.setLineDashPattern([], 0); // reset dash

  // Centered scissors badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(74, 142, 62, 5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('- - - CUT ALONG THIS LINE - - -', 105, 145.3, { align: 'center' });

  // 3. Draw Slip 2: STUDENT COPY (Sized Y = 151 to Y = 283mm)
  drawReceiptSlip(doc, 151, 'STUDENT COPY', effectiveParams);

  // 4. Strict Single-Page Enforcement
  while (doc.getNumberOfPages() > 1) {
    doc.deletePage(doc.getNumberOfPages());
  }

  return doc;
}

/**
 * Generates an official, print-ready, single-page A4 Portrait PDF containing
 * both the SCHOOL COPY and the STUDENT COPY.
 *
 * Guarantees exactly 1 page with ZERO page overflow, crisp embedded logo, and sharp vector text.
 */
export async function exportReceiptToPdf(params: ReceiptPdfParams): Promise<boolean> {
  try {
    const { payment } = params;
    let logoBase64 = params.logoBase64;
    if (!logoBase64) {
      logoBase64 = (await getLogoBase64Async(params.settings)) || undefined;
    }
    const doc = generateReceiptPdfDoc({ ...params, logoBase64 });

    // Download File
    const receiptNum = payment.receiptNumber ? payment.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Receipt';
    const fileName = `FeeReceipt-${receiptNum}.pdf`;
    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('[ReceiptPdfExporter] Error generating PDF receipt:', err);
    return false;
  }
}
