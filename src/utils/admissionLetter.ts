import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ClassFeeConfiguration, SchoolSettings, Student, StudentApplicableFeeHead } from '../types';

/**
 * Admission letter: one data model used by the on-screen letter, the PDF download and the PDF
 * emailed to parents, so all three always show the same facts.
 *
 * Only recorded data is used. Missing values show "—"; fee amounts come from the student's saved fee
 * profile (or the class fee configuration); bank/UPI details come only from School Settings. Login
 * passwords are never printed.
 */

export interface AdmissionLetterFeeRow {
  head: string;
  category: string;
  frequency: string;
  amount: number;
}

export interface AdmissionLetterModel {
  school: {
    name: string;
    address: string;
    contactLine: string;
    boardLine: string;
  };
  referenceNo: string;
  letterDate: string; // dd Mon yyyy
  student: {
    name: string;
    admissionNumber: string;
    registrationNumber: string;
    classSection: string;
    rollNumber: string;
    academicSession: string;
    admissionDate: string;
    dob: string;
    gender: string;
    category: string;
    bloodGroup: string;
    fatherLine: string;
    motherLine: string;
    mobile: string;
    addressLine: string;
    transportLine: string;
    hostelLine: string;
  };
  parentSalutation: string;
  fees: {
    configured: boolean;
    source: 'STUDENT_PROFILE' | 'CLASS_CONFIGURATION' | 'NONE';
    oneTime: AdmissionLetterFeeRow[];
    monthly: AdmissionLetterFeeRow[];
    periodic: AdmissionLetterFeeRow[];
    totalOneTime: number;
    totalMonthly: number;
    totalPeriodic: number;
  };
  payment: {
    configured: boolean;
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    branch: string;
    upiId: string;
    instructions: string;
  };
  portal: {
    studentLoginId: string;
    parentLoginId: string;
  };
  principalName: string;
}

const DASH = '—';
const text = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v).trim();
  return s || DASH;
};

export function formatLetterDate(value?: string | Date): string {
  if (!value) return DASH;
  const d = typeof value === 'string' ? new Date(`${value.substring(0, 10)}T12:00:00Z`) : value;
  if (Number.isNaN(d.getTime())) return text(value as string);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);
}

export function formatRupees(amount: number, symbol = '₹'): string {
  return `${symbol}${(Number(amount) || 0).toLocaleString('en-IN')}`;
}

function titleCase(v?: string): string {
  if (!v) return DASH;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function feeRowsFromProfile(heads: StudentApplicableFeeHead[]): AdmissionLetterFeeRow[] {
  return heads
    .filter((h) => h && h.selected !== false && Number(h.amount) > 0)
    .map((h) => ({
      head: String(h.head || 'Fee'),
      category: String(h.category || ''),
      frequency: String(h.frequency || ''),
      amount: Number(h.amount) || 0,
    }));
}

/** Builds fee rows from the class fee configuration, using only amounts that are actually configured. */
function feeRowsFromConfig(cfg: ClassFeeConfiguration, student: Student): AdmissionLetterFeeRow[] {
  const c: any = cfg;
  const rows: AdmissionLetterFeeRow[] = [];
  const add = (head: string, category: string, frequency: string, value: any) => {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) rows.push({ head, category, frequency, amount });
  };
  add('Admission Fee', 'ONE_TIME', 'One Time', c.admissionFee);
  add('School Fee', 'MONTHLY', 'Monthly', c.monthlySchoolFee);
  add('Tuition Fee', 'MONTHLY', 'Monthly', c.monthlyTuitionFee);
  add('Exam Fee', 'EXAMINATION', 'Yearly', c.examFee);
  add('Computer / Smart Class', 'MONTHLY', 'Monthly', c.computerFee);
  add('Sports Fee', 'YEARLY', 'Yearly', c.sportsFee);
  add('Uniform / Dress Code', 'ONE_TIME', 'One Time', c.dressCodeFee);
  add('Books & Stationery', 'ONE_TIME', 'One Time', c.booksFee);
  add('ID Card Fee', 'ONE_TIME', 'One Time', c.idCardFee);
  add('Medical / Health Care', 'YEARLY', 'Yearly', c.medicalFee);
  if (student.transportRequired) add('Transport Fee', 'FACILITY', 'Monthly', student.transportMonthlyFee);
  if (student.hostelRequired) {
    add('Hostel Residency Fee', 'FACILITY', 'Monthly', student.hostelMonthlyFee ?? c.hostelFee);
    add('Hostel Mess Fee', 'FACILITY', 'Monthly', student.messMonthlyFee ?? c.messFee);
  }
  return rows;
}

const isOneTime = (r: AdmissionLetterFeeRow) => r.category === 'ONE_TIME' || /one\s*time/i.test(r.frequency);
const isMonthly = (r: AdmissionLetterFeeRow) => r.category === 'MONTHLY' || /monthly/i.test(r.frequency);

export function buildAdmissionLetterModel(
  student: Student,
  settings: Partial<SchoolSettings> | undefined,
  classFeeConfig?: ClassFeeConfiguration | null,
  now: Date = new Date()
): AdmissionLetterModel {
  const s: any = settings || {};
  const contacts: string[] = Array.isArray(s.headerContacts) && s.headerContacts.length ? s.headerContacts : s.contactNumber ? [s.contactNumber] : [];
  const contactParts = [
    contacts.length ? `Phone: ${contacts.join(', ')}` : '',
    s.email ? `Email: ${s.email}` : '',
    s.website ? `Web: ${String(s.website).replace(/^https?:\/\//, '')}` : '',
  ].filter(Boolean);
  const affiliationNo = s.affiliationNumber || s.affiliationCode;
  const boardParts = [
    s.affiliatedBoard ? `${s.affiliatedBoard} affiliated` : '',
    affiliationNo ? `Affiliation No. ${affiliationNo}` : '',
    s.schoolCode ? `School Code ${s.schoolCode}` : '',
  ].filter(Boolean);

  let source: AdmissionLetterModel['fees']['source'] = 'NONE';
  let rows: AdmissionLetterFeeRow[] = [];
  if (student.feeProfile && Array.isArray(student.feeProfile.feeHeads) && student.feeProfile.feeHeads.length > 0) {
    rows = feeRowsFromProfile(student.feeProfile.feeHeads);
    source = 'STUDENT_PROFILE';
  } else if (classFeeConfig) {
    rows = feeRowsFromConfig(classFeeConfig, student);
    source = 'CLASS_CONFIGURATION';
  }
  const oneTime = rows.filter(isOneTime);
  const monthly = rows.filter((r) => !isOneTime(r) && isMonthly(r));
  const periodic = rows.filter((r) => !isOneTime(r) && !isMonthly(r));
  const sum = (list: AdmissionLetterFeeRow[]) => list.reduce((a, r) => a + r.amount, 0);

  const p: any = s.paymentOptions || {};
  const paymentConfigured = Boolean((p.accountNumber && p.ifsc) || p.upiId);

  const fatherName = student.fatherName || student.parentName || student.guardianName || '';
  const fatherOcc = student.fatherOccupation || student.parentOccupation || '';
  const motherOcc = student.motherOccupation || '';
  const addressParts = [student.address, student.city, student.state].map((v) => String(v || '').trim()).filter(Boolean);
  const addressLine = addressParts.length
    ? `${addressParts.join(', ')}${student.pincode ? ` - ${student.pincode}` : ''}`
    : DASH;

  const transportLine = student.transportRequired
    ? ['School transport', student.transportStopName ? `stop: ${student.transportStopName}` : '', student.vehicleNumber ? `vehicle ${student.vehicleNumber}` : '']
        .filter(Boolean)
        .join(', ')
    : 'Not opted';
  const hostelLine = student.hostelRequired
    ? ['Hostel', student.hostelName, student.hostelBedNumber ? `bed ${student.hostelBedNumber}` : ''].filter(Boolean).join(', ')
    : 'Day scholar';

  return {
    school: {
      name: text(s.schoolName),
      address: text(s.schoolAddress),
      contactLine: contactParts.join('  •  '),
      boardLine: boardParts.join('  •  '),
    },
    referenceNo: `CPS/ADM/${student.admissionNumber}`,
    letterDate: formatLetterDate(now),
    student: {
      name: text(student.name),
      admissionNumber: text(student.admissionNumber),
      registrationNumber: text(student.registrationNumber),
      classSection: [student.className, student.section ? `Section ${student.section}` : ''].filter(Boolean).join(' – ') || DASH,
      rollNumber: text(student.rollNumber),
      academicSession: text(student.academicSession),
      admissionDate: formatLetterDate(student.admissionDate),
      dob: formatLetterDate(student.dob),
      gender: titleCase(student.gender),
      category: text(student.category),
      bloodGroup: text(student.bloodGroup),
      fatherLine: fatherName ? `${fatherName}${fatherOcc ? ` (${fatherOcc})` : ''}` : DASH,
      motherLine: student.motherName ? `${student.motherName}${motherOcc ? ` (${motherOcc})` : ''}` : DASH,
      mobile: text(student.fatherMobile || student.parentPhone || student.motherMobile || student.mobile),
      addressLine,
      transportLine,
      hostelLine,
    },
    parentSalutation: fatherName || student.motherName || 'Parent / Guardian',
    fees: {
      configured: rows.length > 0,
      source,
      oneTime,
      monthly,
      periodic,
      totalOneTime: sum(oneTime),
      totalMonthly: sum(monthly),
      totalPeriodic: sum(periodic),
    },
    payment: {
      configured: paymentConfigured,
      accountHolderName: text(p.accountHolderName),
      bankName: text(p.bankName),
      accountNumber: text(p.accountNumber),
      ifsc: text(p.ifsc),
      branch: text(p.branch),
      upiId: String(p.upiId || '').trim(),
      instructions: String(p.instructions || '').trim(),
    },
    portal: {
      studentLoginId: text(student.admissionNumber),
      parentLoginId: text(student.fatherMobile || student.parentPhone || student.mobile),
    },
    principalName: String(s.principalName || '').trim(),
  };
}

export function admissionLetterFileName(student: Pick<Student, 'admissionNumber' | 'name'>): string {
  const safe = (v: string) => String(v || '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `Admission-Letter-${safe(student.admissionNumber)}${student.name ? `-${safe(student.name)}` : ''}.pdf`;
}

export interface AdmissionLetterPdfImages {
  logoDataUrl?: string | null;
  signatureDataUrl?: string | null;
  upiQrDataUrl?: string | null;
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG';
}

/** Renders the admission letter as an A4 portrait PDF. Tables break across pages when needed. */
export function generateAdmissionLetterPdf(model: AdmissionLetterModel, images: AdmissionLetterPdfImages = {}): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const rs = (n: number) => formatRupees(n, 'Rs. ');
  const navy: [number, number, number] = [11, 31, 75];
  let y = margin;

  // Header
  if (images.logoDataUrl) {
    try {
      doc.addImage(images.logoDataUrl, imageFormat(images.logoDataUrl), margin, y, 20, 20);
    } catch {
      /* logo is optional */
    }
  }
  const headerX = images.logoDataUrl ? margin + 24 : margin;
  const headerW = pageW - margin - headerX;
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(doc.splitTextToSize(model.school.name.toUpperCase(), headerW), headerX, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  let hy = y + 12;
  for (const line of [model.school.boardLine, model.school.address, model.school.contactLine].filter((l) => l && l !== DASH)) {
    const wrapped = doc.splitTextToSize(line, headerW);
    doc.text(wrapped, headerX, hy);
    hy += 4 * wrapped.length;
  }
  y = Math.max(y + 20, hy) + 0.5;
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Title + reference
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...navy);
  doc.text('ADMISSION LETTER', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Ref. No.: ${model.referenceNo}`, margin, y);
  doc.text(`Date: ${model.letterDate}`, pageW - margin, y, { align: 'right' });
  y += 7;

  // Greeting
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9.5);
  doc.text(`Dear ${model.parentSalutation},`, margin, y);
  y += 5.5;
  const para = `We are pleased to confirm the admission of ${model.student.name} to ${model.student.classSection} for the academic session ${model.student.academicSession}. The admission details and the applicable fees are given below.`;
  const paraLines = doc.splitTextToSize(para, contentW);
  doc.text(paraLines, margin, y);
  y += paraLines.length * 4.4 + 2;

  const tableTheme = {
    theme: 'grid' as const,
    styles: { font: 'helvetica', fontSize: 7.8, cellPadding: { top: 0.85, bottom: 0.85, left: 1.6, right: 1.6 }, lineColor: [203, 213, 225] as [number, number, number], lineWidth: 0.2, textColor: [30, 41, 59] as [number, number, number], overflow: 'linebreak' as const },
    headStyles: { fillColor: navy, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
    margin: { left: margin, right: margin },
    rowPageBreak: 'avoid' as const,
  };
  // Small sections are kept in one piece: start them on a new page if they would be split.
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 12) {
      doc.addPage();
      y = margin;
    }
  };

  // Section A: student particulars (two label/value pairs per row)
  const st = model.student;
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [[{ content: 'A. Student Details', colSpan: 4 }]],
    body: [
      ['Admission No.', st.admissionNumber, 'Registration No.', st.registrationNumber],
      ['Student Name', st.name, 'Class & Section', st.classSection],
      ['Roll No.', st.rollNumber, 'Date of Admission', st.admissionDate],
      ['Date of Birth', st.dob, 'Gender', st.gender],
      ['Category', st.category, 'Blood Group', st.bloodGroup],
      ['Father / Guardian', st.fatherLine, 'Mother', st.motherLine],
      ['Registered Mobile', st.mobile, 'Academic Session', st.academicSession],
      ['Address', { content: st.addressLine, colSpan: 3 }],
      ['Transport', st.transportLine, 'Residence', st.hostelLine],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 32 },
      1: { cellWidth: contentW / 2 - 32 },
      2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 32 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Section B: fees
  const feeBody: any[] = [];
  const pushGroup = (title: string, list: AdmissionLetterFeeRow[]) => {
    if (!list.length) return;
    feeBody.push([{ content: title, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } }]);
    list.forEach((r) => feeBody.push([r.head, r.frequency || DASH, { content: rs(r.amount), styles: { halign: 'right' } }]));
  };
  if (model.fees.configured) {
    pushGroup('One-time charges (payable at admission)', model.fees.oneTime);
    pushGroup('Monthly charges (payable from the 1st to the 10th of each month)', model.fees.monthly);
    pushGroup('Yearly / periodic charges', model.fees.periodic);
  } else {
    feeBody.push([{ content: 'The fee structure for this class has not been set up yet. Please contact the accounts office.', colSpan: 3 }]);
  }
  const feeFoot: any[] = model.fees.configured
    ? [
        ['Total one-time charges', '', { content: rs(model.fees.totalOneTime), styles: { halign: 'right' } }],
        ['Total monthly charges', '', { content: `${rs(model.fees.totalMonthly)} / month`, styles: { halign: 'right' } }],
        ...(model.fees.totalPeriodic ? [['Total yearly / periodic charges', '', { content: rs(model.fees.totalPeriodic), styles: { halign: 'right' } }]] : []),
      ]
    : [];
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['B. Fee Details', 'Schedule', { content: 'Amount', styles: { halign: 'right' } }]],
    body: feeBody,
    foot: feeFoot,
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    showFoot: 'lastPage',
    columnStyles: { 1: { cellWidth: 30 }, 2: { cellWidth: 38 } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Section C: payment channels (only when configured in School Settings)
  if (model.payment.configured) {
    const pay = model.payment;
    const payRows: any[] = [];
    ensureSpace(8 + 5.2 * 5);
    if (pay.accountNumber !== DASH) {
      payRows.push(['Account Holder', pay.accountHolderName, 'Bank', pay.bankName]);
      payRows.push(['Account No.', pay.accountNumber, 'IFSC', pay.ifsc]);
      payRows.push(['Branch', { content: pay.branch, colSpan: 3 }]);
    }
    if (pay.upiId) payRows.push(['UPI ID', { content: pay.upiId, colSpan: 3 }]);
    if (pay.instructions) payRows.push(['Note', { content: pay.instructions, colSpan: 3 }]);
    const qrSize = images.upiQrDataUrl ? 30 : 0;
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [[{ content: 'C. Fee Payment Details', colSpan: 4 }]],
      body: payRows,
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 28 },
        2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 20 },
      },
      margin: { left: margin, right: margin + (qrSize ? qrSize + 4 : 0) },
    });
    const tableTop = y;
    y = (doc as any).lastAutoTable.finalY;
    if (images.upiQrDataUrl) {
      try {
        doc.addImage(images.upiQrDataUrl, imageFormat(images.upiQrDataUrl), pageW - margin - qrSize, tableTop + 1, qrSize, qrSize);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Scan to pay (UPI)', pageW - margin - qrSize / 2, tableTop + qrSize + 4, { align: 'center' });
        y = Math.max(y, tableTop + qrSize + 5);
      } catch {
        /* QR is optional */
      }
    }
    y += 4;
  }

  // Portal access (login IDs only; passwords are never printed) — kept on the same page as the signatures.
  ensureSpace(27);
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Portal access:', margin, y + 3);
  doc.setFont('helvetica', 'normal');
  const portalLine = `Student login ID ${model.portal.studentLoginId}  •  Parent login ID ${model.portal.parentLoginId}  •  Passwords are shared separately by the school office; please change them after the first login.`;
  const portalLines = doc.splitTextToSize(portalLine, contentW - 22);
  doc.text(portalLines, margin + 22, y + 3);
  y += 3 + portalLines.length * 3.8 + 11;

  // Signatures
  if (y + 6 > pageH - 12) {
    doc.addPage();
    y = margin + 18;
  }
  const colW = contentW / 3;
  if (images.signatureDataUrl) {
    try {
      doc.addImage(images.signatureDataUrl, imageFormat(images.signatureDataUrl), margin + colW * 2 + colW / 2 - 15, y - 13, 30, 11);
    } catch {
      /* signature is optional */
    }
  }
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const sigLabels = ['Parent / Guardian', 'Admissions Office', model.principalName ? `Principal (${model.principalName})` : 'Principal'];
  sigLabels.forEach((label, i) => {
    const x0 = margin + colW * i + 4;
    doc.line(x0, y, x0 + colW - 8, y);
    doc.text(label, x0 + (colW - 8) / 2, y + 4.5, { align: 'center' });
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${model.referenceNo}  •  Page ${i} of ${pages}`, pageW / 2, pageH - 7, { align: 'center' });
  }
  return doc;
}

/** Returns the PDF as base64 (no data: prefix), as sent to the email endpoint. */
export function admissionLetterPdfBase64(model: AdmissionLetterModel, images: AdmissionLetterPdfImages = {}): string {
  const dataUri = generateAdmissionLetterPdf(model, images).output('datauristring');
  return dataUri.substring(dataUri.indexOf(',') + 1);
}
