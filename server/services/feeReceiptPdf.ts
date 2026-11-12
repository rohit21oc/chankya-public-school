import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { amountInWords, type PayslipSchool } from './payslipPdf.ts';

/**
 * Fee receipt PDF built from one stored payment record. Web and mobile both download these exact bytes from
 * the server. A payment that settled several bills (a full settlement) carries a `breakdown` with one line
 * per bill, and every line is printed; an ordinary payment prints as a single line.
 */

export type ReceiptSchool = PayslipSchool;

export interface ReceiptPayment {
  receiptNumber?: string;
  studentName?: string;
  admissionNumber?: string;
  className?: string;
  section?: string;
  academicSession?: string;
  amount?: number;
  feeType?: string;
  feeMonth?: string;
  billingPeriod?: string;
  paymentMethod?: string;
  paymentMode?: string;
  /** Set on PhonePe receipts: the gateway and how the parent paid (UPI_INTENT, CARD, NET_BANKING …). */
  gateway?: string;
  onlinePaymentMode?: string;
  transactionReference?: string;
  paymentDate?: string;
  collectedBy?: string;
  balanceDue?: number;
  fine?: number;
  discount?: number;
  breakdown?: { head?: string; amount?: number }[];
}

const money = (n: number) =>
  `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const METHOD: Record<string, string> = {
  ONLINE: 'Online',
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  CARD: 'Card',
};

export function feeReceiptFileName(payment: ReceiptPayment): string {
  const no = String(payment.receiptNumber || 'receipt').replace(/[^A-Za-z0-9_-]/g, '');
  return `Fee-Receipt-${no}.pdf`;
}

/** The lines printed in the table: the per-bill breakdown when there is one, else one line for the payment. */
export function receiptLines(payment: ReceiptPayment): { head: string; amount: number }[] {
  const fromBreakdown = (payment.breakdown || [])
    .map((b) => ({ head: String(b.head || '').trim() || 'School fee', amount: Number(b.amount) || 0 }))
    .filter((b) => b.amount > 0);
  if (fromBreakdown.length > 0) return fromBreakdown;
  const label = Array.from(new Set([payment.feeType, payment.feeMonth || payment.billingPeriod].map((x) => String(x || '').trim()).filter(Boolean))).join(' - ');
  return [{ head: label || 'School fee', amount: Number(payment.amount) || 0 }];
}

export function buildFeeReceiptPdf(payment: ReceiptPayment, school: ReceiptSchool = {}): Buffer {
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
  doc.text('FEE RECEIPT', W / 2, 26, { align: 'center' });

  // ---- Student + payment details
  const rawMode = String(payment.paymentMethod || payment.paymentMode || '');
  const viaPhonePe = String(payment.gateway || '').toUpperCase() === 'PHONEPE';
  const onlineHow = String(payment.onlinePaymentMode || '').replace(/_/g, ' ').replace(/\b(INTENT|COLLECT|QR)\b/g, '').trim();
  const mode = viaPhonePe
    ? `Online - PhonePe${onlineHow ? ` (${onlineHow})` : ''}`
    : METHOD[rawMode.toUpperCase()] || rawMode || '-';
  const classText = [payment.className, payment.section ? `Sec ${payment.section}` : ''].filter(Boolean).join(' - ') || '-';
  const left: [string, string][] = [
    ['Student Name', String(payment.studentName || '-')],
    ['Admission No.', String(payment.admissionNumber || '-')],
    ['Class', classText],
    ['Session', String(payment.academicSession || '-')],
  ];
  const right: [string, string][] = [
    ['Receipt No.', String(payment.receiptNumber || '-')],
    ['Payment Date', String(payment.paymentDate || '-')],
    ['Payment Mode', mode],
    ['Reference No.', String(payment.transactionReference || '-')],
  ];
  doc.setTextColor(30, 41, 59);
  autoTable(doc, {
    startY: 36,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.4, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 30 },
      3: { cellWidth: 'auto' },
    },
    body: left.map((l, i) => [l[0], l[1], right[i][0], right[i][1]]),
    margin: { left: M, right: M },
  });

  // ---- What was paid
  const lines = receiptLines(payment);
  const lineTotal = lines.reduce((a, l) => a + l.amount, 0);
  const total = Number(payment.amount) > 0 ? Number(payment.amount) : lineTotal;
  const extra: string[][] = [];
  if (Number(payment.fine) > 0) extra.push(['', 'Late fee', money(Number(payment.fine))]);
  if (Number(payment.discount) > 0) extra.push(['', 'Concession', `- ${money(Number(payment.discount))}`]);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.1, textColor: [30, 41, 59] },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [['#', 'Fee', 'Amount Paid']],
    body: [...lines.map((l, i) => [String(i + 1), l.head, money(l.amount)]), ...extra],
    foot: [['', 'Total', money(total)]],
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'right', cellWidth: 45 } },
    margin: { left: M, right: M },
    showFoot: 'lastPage',
  });
  let y = (doc as any).lastAutoTable.finalY + 6;

  // ---- Total paid
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(M, y, W - 2 * M, 20, 2, 2, 'FD');
  doc.setTextColor(6, 78, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL AMOUNT PAID', M + 4, y + 7);
  doc.setFontSize(14);
  doc.text(money(total), W - M - 4, y + 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`In words: ${amountInWords(total)}`, M + 4, y + 15, { maxWidth: W - 2 * M - 8 });
  y += 28;

  if (typeof payment.balanceDue === 'number') {
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(payment.balanceDue > 0 ? `Balance still due after this payment: ${money(payment.balanceDue)}` : 'No balance is due after this payment.', M, y);
    y += 8;
  }

  // ---- Footer
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text('This is a computer generated receipt and does not need a signature.', W / 2, y + 6, { align: 'center' });
  if (payment.collectedBy) doc.text(`Received by: ${payment.collectedBy}`, W / 2, y + 11, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
