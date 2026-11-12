import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Exam, ExamMark, SchoolSettings, Student, Subject } from '../types';
import { buildMarksheet } from './marksheetModel';
import { schoolIdentity } from './schoolIdentity';
import { fitPhotoToFrame, makeMarksheetQr } from './marksheetExtras';
import { printPdfBlob } from './attendanceRegisterPdf';
import {
  getDocumentImageBase64Async,
  preloadDocumentAssets,
  resolveStudentPhotoBase64,
  shrinkImageForPdf,
} from './documentImageHelper';

export interface ReportCardPdfOptions {
  student: Student;
  exam: Exam;
  settings: SchoolSettings;
  subjects: Subject[];
  marksList: ExamMark[];
  photoBase64?: string | null;
  logoBase64?: string | null;
  sigBase64?: string | null;
  /** 'public' = result page for visitors: no signatures, QR only. Default 'admin' (staff-issued, signed). */
  variant?: 'admin' | 'public';
}

export interface BulkReportCardPdfOptions {
  students: Student[];
  exam: Exam;
  settings: SchoolSettings;
  marksList: ExamMark[];
  getStudentSubjects: (student: Student) => Subject[];
  photosMap?: Map<string, string>;
  logoBase64?: string | null;
  sigBase64?: string | null;
}

let ctrlSigCache: { key: string; value: string | null } | null = null;
async function resolveControllerSignature(settings: SchoolSettings): Promise<string | null> {
  const key = settings.examControllerSignature || '';
  if (!key) return null;
  if (ctrlSigCache?.key === key) return ctrlSigCache.value;
  const value = await shrinkImageForPdf(await getDocumentImageBase64Async(key), 480);
  ctrlSigCache = { key, value };
  return value;
}

/**
 * Builds a single student marksheet page onto the jsPDF document.
 * Layout is computed from the number of subjects so the page is filled evenly (no big empty gap).
 */
async function buildSingleReportCardPage(
  doc: jsPDF,
  options: ReportCardPdfOptions,
  isFirstPage: boolean
): Promise<void> {
  const { student, exam, settings, subjects, marksList } = options;

  if (!isFirstPage) {
    doc.addPage('a4', 'portrait');
  }

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const innerL = margin + 5;
  const innerW = pageWidth - innerL * 2;

  // Resolve assets if not provided
  const logoBase64 =
    options.logoBase64
      ? options.logoBase64
      : await shrinkImageForPdf(await getDocumentImageBase64Async(settings.schoolLogo, true));

  const rawPhoto =
    options.photoBase64
      ? options.photoBase64
      : await resolveStudentPhotoBase64(student);

  const isPublic = options.variant === 'public';
  const sigBase64 = isPublic
    ? null
    : options.sigBase64
      ? options.sigBase64
      : await shrinkImageForPdf(await getDocumentImageBase64Async(settings.principalSignature), 480);
  const ctrlSigBase64 = isPublic ? null : await resolveControllerSignature(settings);

  // Marks, totals and result come from the same model as the on-screen marksheet
  const sheet = buildMarksheet(subjects, marksList.filter((m) => m.examId === exam.id && m.studentId === student.id));

  const PHOTO_W = 28;
  const PHOTO_H = 35;
  const [photoBase64, qrBase64] = await Promise.all([
    fitPhotoToFrame(rawPhoto, PHOTO_W, PHOTO_H),
    makeMarksheetQr(student, sheet),
  ]);

  // Outer border
  doc.setDrawColor(15, 23, 42); // slate-900
  doc.setLineWidth(1.0);
  doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

  // Inner subtle border
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.rect(margin + 1.8, margin + 1.8, pageWidth - (margin + 1.8) * 2, pageHeight - (margin + 1.8) * 2);

  let currentY = margin + 8;

  // School Header
  if (logoBase64) {
    try {
      const logoSize = 22;
      const format = logoBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoBase64, format, innerL + 2, currentY, logoSize, logoSize);
    } catch {}
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(11, 31, 75);
  const schoolName = (settings.schoolName || 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE').toUpperCase();
  doc.text(schoolName, pageWidth / 2 + 6, currentY + 7, { align: 'center', maxWidth: innerW - 30 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(settings.schoolAddress || '', pageWidth / 2 + 6, currentY + 13, { align: 'center', maxWidth: innerW - 30 });

  // Affiliation line (only what the school has actually configured)
  const affCode = settings.affiliationCode || settings.affiliationNumber || '';
  const affLine = [
    settings.affiliatedBoard ? `Affiliated to ${settings.affiliatedBoard}` : '',
    affCode ? `Affiliation No: ${affCode}` : '',
    settings.schoolCode ? `School Code: ${settings.schoolCode}` : '',
  ].filter(Boolean).join(' • ');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  if (affLine) doc.text(affLine, pageWidth / 2 + 6, currentY + 18.5, { align: 'center', maxWidth: innerW - 30 });

  currentY += 27;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(innerL, currentY, pageWidth - innerL, currentY);
  currentY += 5;

  // Title ribbon
  const examTitle = exam?.name || exam?.title || 'Academic Assessment';
  const session = exam?.academicSession || settings.currentAcademicSession || '2026-2027';
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  const badgeHeight = 8;
  doc.rect(innerL, currentY, innerW, badgeHeight, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`OFFICIAL EXAMINATION MARKSHEET • ACADEMIC SESSION ${session}`, pageWidth / 2, currentY + 5.4, { align: 'center' });
  currentY += badgeHeight + 5;

  // Student particulars
  const boxY = currentY;
  const boxH = PHOTO_H + 9;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.rect(innerL, boxY, innerW, boxH, 'FD');

  const photoX = innerL + 4;
  const photoY = boxY + 4.5;
  let photoAdded = false;
  if (photoBase64) {
    try {
      const format = photoBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(photoBase64, format, photoX, photoY, PHOTO_W, PHOTO_H);
      photoAdded = true;
    } catch {}
  }
  if (!photoAdded) {
    doc.setFillColor(226, 232, 240);
    doc.rect(photoX, photoY, PHOTO_W, PHOTO_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(71, 85, 105);
    doc.text(student.name.charAt(0).toUpperCase(), photoX + PHOTO_W / 2, photoY + PHOTO_H / 2 + 2, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('PHOTO', photoX + PHOTO_W / 2, photoY + PHOTO_H / 2 + 8, { align: 'center' });
  }
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.rect(photoX, photoY, PHOTO_W, PHOTO_H);

  const col1X = photoX + PHOTO_W + 7;
  const col2X = col1X + 78;
  const father = student.fatherName || student.parentName || '';
  const mother = student.motherName || '';
  const regNo = student.registrationNumber || `CPS${student.admissionNumber}`;

  const particularsLeft: [string, string][] = [
    ['Student Name', student.name.toUpperCase()],
    ['Class & Section', `${student.className || 'Class'} - ${student.section || 'A'}`],
    ['Admission No', student.admissionNumber],
    ['Roll No', student.rollNumber || '—'],
    ['Registration No', regNo],
  ];
  const particularsRight: [string, string][] = [
    ['Date of Birth', student.dob || '—'],
    ['Gender', (student.gender || '—').toString().toUpperCase()],
    ["Father's Name", (father || '—').toUpperCase()],
    ["Mother's Name", (mother || '—').toUpperCase()],
  ];

  const rowGap = (boxH - 13) / 4;
  let textY = boxY + 8;
  for (let i = 0; i < particularsLeft.length; i++) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(particularsLeft[i][0] + ':', col1X, textY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(particularsLeft[i][1], col1X + 29, textY, { maxWidth: 46 });

    if (particularsRight[i]) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(particularsRight[i][0] + ':', col2X, textY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(particularsRight[i][1], col2X + 25, textY, { maxWidth: pageWidth - innerL - 4 - (col2X + 25) });
    }
    textY += rowGap;
  }

  currentY = boxY + boxH + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`SCHOLASTIC PERFORMANCE (${examTitle.toUpperCase()})`, innerL, currentY);
  currentY += 2.5;

  const RESULT_LABEL: Record<string, string> = { PASS: 'Pass', FAIL: 'Fail', ABSENT: 'Absent', PENDING: 'Pending' };
  const tableBody = sheet.rows.map((r) => [
    r.subjectName,
    String(r.maxMarks),
    r.result === 'PENDING' ? '—' : r.isAbsent ? 'AB' : String(r.obtained),
    r.grade,
    RESULT_LABEL[r.result],
  ]);
  tableBody.push([
    'TOTAL',
    String(sheet.totalMax),
    String(sheet.totalObtained),
    sheet.grade,
    sheet.totalMax > 0 ? `${sheet.percentage.toFixed(1)}%` : '—',
  ]);

  // Bottom block (result strip + signatures/QR) has a fixed height; the table gets the rest, evenly.
  const QR_SIZE = 30;
  // The public copy carries a verification note under the QR, so its bottom block sits a little higher.
  const sigY = pageHeight - margin - (isPublic ? 21 : 14);
  const bottomBlockTop = sigY - QR_SIZE - 3;
  const resultStripH = 11;
  const tableBottomLimit = bottomBlockTop - resultStripH - 9;
  const rowsInTable = tableBody.length + 1; // + header
  const rowH = Math.max(7, Math.min(14, (tableBottomLimit - currentY) / rowsInTable));

  autoTable(doc, {
    startY: currentY,
    margin: { left: innerL, right: innerL, top: 0, bottom: 0 },
    tableWidth: innerW,
    head: [['Subject', 'Max Marks', 'Marks Obtained', 'Grade', 'Result']],
    body: tableBody,
    theme: 'grid',
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    styles: {
      fontSize: 9.5,
      cellPadding: 1.5,
      font: 'helvetica',
      textColor: [15, 23, 42],
      lineColor: [15, 23, 42],
      lineWidth: 0.2,
      minCellHeight: rowH,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 74, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.row.index === tableBody.length - 1 && data.section === 'body') {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      } else if (data.section === 'body' && data.column.index === 4) {
        const v = String(data.cell.raw);
        data.cell.styles.textColor = v === 'Pass' ? [22, 101, 52] : v === 'Pending' ? [100, 116, 139] : [185, 28, 28];
      }
    },
  });

  const finalTableY = (doc as any).lastAutoTable?.finalY || currentY + 50;
  currentY = Math.min(finalTableY + 5, bottomBlockTop - resultStripH - 2);

  // Result strip: result · obtained marks · percentage
  const resultText =
    sheet.result === 'INCOMPLETE'
      ? `INCOMPLETE (${sheet.pendingCount} PENDING)`
      : sheet.result === 'NO MARKS'
      ? 'NOT PUBLISHED'
      : sheet.result;
  const resultColor: [number, number, number] =
    sheet.result === 'PASS' ? [22, 101, 52] : sheet.result === 'FAIL' ? [185, 28, 28] : [180, 83, 9];
  const cellW = innerW / 3;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.rect(innerL, currentY, innerW, resultStripH, 'S');
  doc.line(innerL + cellW, currentY, innerL + cellW, currentY + resultStripH);
  doc.line(innerL + cellW * 2, currentY, innerL + cellW * 2, currentY + resultStripH);
  const stripItems: [string, string, [number, number, number]][] = [
    ['RESULT', resultText, resultColor],
    ['OBTAINED MARKS', sheet.totalMax > 0 ? `${sheet.totalObtained} / ${sheet.totalMax}` : '—', [15, 23, 42]],
    ['PERCENTAGE', sheet.totalMax > 0 ? `${sheet.percentage.toFixed(2)}%` : '—', [15, 23, 42]],
  ];
  stripItems.forEach(([label, value, color], i) => {
    const cx = innerL + cellW * i + cellW / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(label, cx, currentY + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, cx, currentY + 8.6, { align: 'center', maxWidth: cellW - 4 });
  });

  // Bottom: Controller of Examinations | QR (student details) | Principal. The public variant has the QR only.
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  if (!isPublic) {
    doc.line(innerL + 4, sigY, innerL + 50, sigY);
    if (ctrlSigBase64) {
      try {
        const f = ctrlSigBase64.includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(ctrlSigBase64, f, innerL + 11, sigY - 12, 32, 10);
      } catch {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(settings.examControllerName || 'Controller of Examinations', innerL + 27, sigY + 4.5, { align: 'center', maxWidth: 46 });
    if (settings.examControllerName) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Controller of Examinations', innerL + 27, sigY + 8.5, { align: 'center' });
    }
  }

  const qrX = pageWidth / 2 - QR_SIZE / 2;
  const qrY = sigY - QR_SIZE + 5;
  if (qrBase64) {
    try {
      doc.addImage(qrBase64, 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(qrX - 1, qrY - 1, QR_SIZE + 2, QR_SIZE + 2);
    } catch {}
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Scan to view student details', pageWidth / 2, sigY + 9.5, { align: 'center' });

  if (!isPublic) {
    const prinLineX2 = pageWidth - innerL - 4;
    const prinLineX1 = prinLineX2 - 46;
    doc.setDrawColor(148, 163, 184);
    doc.line(prinLineX1, sigY, prinLineX2, sigY);
    if (sigBase64) {
      try {
        const sigFormat = sigBase64.includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(sigBase64, sigFormat, prinLineX1 + 7, sigY - 12, 32, 10);
      } catch {}
    }
    const prinCx = (prinLineX1 + prinLineX2) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(settings.principalName || 'Principal', prinCx, sigY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Principal / Head of School', prinCx, sigY + 8.5, { align: 'center' });
  }

  if (isPublic) {
    // Verification note at the foot of the page.
    const phone = schoolIdentity(settings).phones[0];
    const note = `Computer-generated marksheet issued by ${settings.schoolName}.${phone ? ` For verification, contact the school office at ${phone}.` : ''}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(note, innerW - 6) as string[];
    doc.text(lines, pageWidth / 2, sigY + 14.5, { align: 'center' });

    // Faint diagonal "Copy Marksheet" watermark so a printout of the public copy is not mistaken for the signed original.
    const GState = (doc as any).GState;
    if (GState) doc.setGState(new GState({ opacity: 0.08 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(68);
    doc.setTextColor(15, 23, 42);
    const wmText = 'Copy Marksheet';
    const wmW = doc.getTextWidth(wmText);
    const c45 = Math.SQRT1_2;
    doc.text(wmText, pageWidth / 2 - (wmW / 2) * c45, pageHeight / 2 + (wmW / 2) * c45, { angle: 45 });
    if (GState) doc.setGState(new GState({ opacity: 1 }));
  }
}

/**
 * Generates and downloads a single student high-resolution Report Card PDF.
 * Strictly enforced to fit on exactly 1 A4 page.
 */
export async function exportReportCardToPdf(options: ReportCardPdfOptions, action: 'download' | 'print' = 'download'): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const [logoBase64, photoBase64, sigBase64] = await Promise.all([
      options.logoBase64
        ? options.logoBase64
        : getDocumentImageBase64Async(options.settings.schoolLogo, true).then((v) => shrinkImageForPdf(v)),
      options.photoBase64
        ? options.photoBase64
        : resolveStudentPhotoBase64(options.student),
      options.variant === 'public'
        ? Promise.resolve(null)
        : options.sigBase64
          ? options.sigBase64
          : getDocumentImageBase64Async(options.settings.principalSignature).then((v) => shrinkImageForPdf(v, 480)),
    ]);

    await buildSingleReportCardPage(
      doc,
      {
        ...options,
        logoBase64,
        photoBase64,
        sigBase64,
      },
      true
    );

    // Strict single page enforcement: Delete any extra page
    while (doc.getNumberOfPages() > 1) {
      doc.deletePage(doc.getNumberOfPages());
    }

    const cleanStudentName = options.student.name.replace(/[^a-zA-Z0-9]/g, '_');
    const examClean = (options.exam?.name || options.exam?.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `ReportCard_${options.student.admissionNumber}_${cleanStudentName}_${examClean}.pdf`;

    if (typeof window !== 'undefined') {
      if (action === 'print') await printPdfBlob(doc.output('blob'), filename);
      else doc.save(filename);
    } else {
      doc.output('arraybuffer');
    }
    return true;
  } catch (err) {
    console.error('[ReportCardPdfExporter] Single export error:', err);
    return false;
  }
}

/**
 * Generates and downloads a bulk PDF containing 1 page per student for all selected students.
 */
export async function exportBulkReportCardsToPdf(options: BulkReportCardPdfOptions, action: 'download' | 'print' = 'download'): Promise<boolean> {
  try {
    const { students, exam, settings, marksList, getStudentSubjects } = options;

    if (!students || students.length === 0) return false;

    // Deduplicate students
    const seen = new Set<string>();
    const uniqueStudents: Student[] = [];
    for (const s of students) {
      const key = s.id || s.admissionNumber;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueStudents.push(s);
      }
    }

    const { logoBase64, sigBase64, photosMap } = await preloadDocumentAssets(uniqueStudents, settings);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < uniqueStudents.length; i++) {
      const st = uniqueStudents[i];
      const subs = getStudentSubjects(st);
      const studentPhoto = photosMap.get(st.id) || photosMap.get(st.admissionNumber) || null;

      await buildSingleReportCardPage(
        doc,
        {
          student: st,
          exam,
          settings,
          subjects: subs,
          marksList,
          photoBase64: studentPhoto,
          logoBase64,
          sigBase64,
        },
        i === 0
      );
    }

    // Ensure total pages strictly equals unique students count
    while (doc.getNumberOfPages() > uniqueStudents.length) {
      doc.deletePage(doc.getNumberOfPages());
    }

    const schoolClean = (settings.schoolName || 'CPS_School').replace(/[^a-zA-Z0-9]/g, '_');
    const examClean = (exam?.name || exam?.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${schoolClean}_Class_ReportCards_${examClean}_${uniqueStudents.length}Students.pdf`;

    if (typeof window !== 'undefined') {
      if (action === 'print') await printPdfBlob(doc.output('blob'), filename);
      else doc.save(filename);
    } else {
      doc.output('arraybuffer');
    }
    return true;
  } catch (err) {
    console.error('[ReportCardPdfExporter] Bulk export error:', err);
    return false;
  }
}

