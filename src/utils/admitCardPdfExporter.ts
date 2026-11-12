import { printPdfBlob } from './attendanceRegisterPdf';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Exam, ExamScheduleItem, SchoolSettings, Student } from '../types';
import {
  ensureRasterJpegOrPng,
  getDocumentImageBase64Async,
  preloadDocumentAssets,
  resolveStudentPhotoBase64,
} from './documentImageHelper';

export interface AdmitCardPdfOptions {
  student: Student;
  exam: Exam;
  settings: SchoolSettings;
  schedule?: ExamScheduleItem[];
  photoBase64?: string | null;
  logoBase64?: string | null;
  sigBase64?: string | null;
}

export interface BulkAdmitCardPdfOptions {
  students: Student[];
  exam: Exam;
  settings: SchoolSettings;
  getStudentSchedule?: (student: Student) => ExamScheduleItem[];
  photosMap?: Map<string, string>;
  logoBase64?: string | null;
  sigBase64?: string | null;
}

/**
 * Filter schedule items applicable to this student's class and section.
 */
export function getApplicableSchedule(st: Student, exam: Exam): ExamScheduleItem[] {
  if (!exam.schedule || exam.schedule.length === 0) return [];
  return exam.schedule.filter((item) => {
    const matchClass =
      !item.classId ||
      item.classId === st.classId ||
      (st.className && item.className === st.className);
    const matchSection =
      !item.section ||
      item.section === 'ALL' ||
      !st.section ||
      item.section === st.section;
    return matchClass && matchSection;
  });
}

/**
 * Builds a single student admit card page onto the jsPDF document.
 * Strictly formatted for exactly 1 A4 portrait page (210mm x 297mm).
 */
async function buildSingleAdmitCardPage(
  doc: jsPDF,
  options: AdmitCardPdfOptions,
  isFirstPage: boolean
): Promise<void> {
  const { student, exam, settings } = options;

  if (!isFirstPage) {
    doc.addPage('a4', 'portrait');
  }

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;

  // Resolve assets if not preloaded
  const rawLogo =
    options.logoBase64
      ? options.logoBase64
      : await getDocumentImageBase64Async(settings.schoolLogo, true);

  const rawPhoto =
    options.photoBase64
      ? options.photoBase64
      : await resolveStudentPhotoBase64(student);

  const rawSig =
    options.sigBase64
      ? options.sigBase64
      : await getDocumentImageBase64Async(settings.principalSignature);

  const [logoBase64, photoBase64, sigBase64] = await Promise.all([
    ensureRasterJpegOrPng(rawLogo),
    ensureRasterJpegOrPng(rawPhoto),
    ensureRasterJpegOrPng(rawSig),
  ]);

  // Outer institutional double border
  doc.setDrawColor(11, 31, 75); // Deep Navy #0B1F4B
  doc.setLineWidth(1.0);
  doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.3);
  doc.rect(margin + 2, margin + 2, pageWidth - (margin + 2) * 2, pageHeight - (margin + 2) * 2);

  let currentY = margin + 5;

  // 1. School Header
  const logoSize = 17;
  const logoX = margin + 6;
  const logoY = currentY;

  if (logoBase64) {
    try {
      const format = logoBase64.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(logoBase64, format, logoX, logoY, logoSize, logoSize);
    } catch {
      // Graceful fallback
    }
  }

  // School Details (Centered between logo and right badge)
  doc.setFont('times', 'bold');
  doc.setTextColor(11, 31, 75);
  const schoolName = (settings.schoolName || 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE').toUpperCase();
  // Keep the name inside the space between the logo and the badge: shrink until it fits.
  const nameMaxWidth = pageWidth - margin * 2 - 22 - 40;
  let nameSize = 15;
  doc.setFontSize(nameSize);
  while (nameSize > 9 && doc.getTextWidth(schoolName) > nameMaxWidth) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  doc.text(schoolName, margin + 22 + nameMaxWidth / 2, currentY + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(settings.schoolAddress || 'Sheohar, Bihar - 843329', margin + 22 + nameMaxWidth / 2, currentY + 8.5, {
    align: 'center',
  });

  const affCode = settings.affiliationCode || settings.affiliationNumber || '';
  const schCode = settings.schoolCode || '';
  const board = settings.affiliatedBoard || '';
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  const affLine = [board ? `Affiliated to ${board}` : '', affCode ? `Affiliation No: ${affCode}` : '', schCode ? `School Code: ${schCode}` : ''].filter(Boolean).join('  |  ');
  if (affLine) doc.text(affLine, margin + 22 + nameMaxWidth / 2, currentY + 12.5, { align: 'center', maxWidth: nameMaxWidth });

  // Top Right Badge
  const session = exam?.academicSession || settings.currentAcademicSession || '2026-2027';
  doc.setFillColor(254, 243, 199); // Amber-100
  doc.setDrawColor(217, 119, 6); // Amber-600
  doc.setLineWidth(0.3);
  doc.rect(pageWidth - margin - 38, currentY, 32, 6.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(146, 64, 14); // Amber-800
  doc.text('OFFICIAL HALL TICKET', pageWidth - margin - 22, currentY + 4.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Session ${session}`, pageWidth - margin - 22, currentY + 10, { align: 'center' });

  currentY += 16;

  // Thin header rule
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin + 4, currentY, pageWidth - margin - 4, currentY);
  currentY += 3;

  // 2. Admit Card Title Ribbon
  const examNameClean = (exam?.name || exam?.title || 'Examination').toUpperCase();
  const examTypeClean = (exam?.examType ? exam.examType.replace('_', ' ') : 'ANNUAL').toUpperCase();
  const ribbonText = `ADMIT CARD: ${examNameClean} (${examTypeClean})`;

  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(15, 23, 42); // slate-900
  doc.setLineWidth(0.4);
  const ribbonWidth = 160;
  const ribbonHeight = 6.5;
  const ribbonX = (pageWidth - ribbonWidth) / 2;
  doc.rect(ribbonX, currentY, ribbonWidth, ribbonHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(ribbonText, pageWidth / 2, currentY + 4.5, { align: 'center' });

  currentY += ribbonHeight + 4;

  // 3. Student Particulars & Photo Card
  const cardY = currentY;
  const cardHeight = 33;
  const cardWidth = pageWidth - (margin + 4) * 2;

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.rect(margin + 4, cardY, cardWidth, cardHeight, 'FD');

  // Photo
  const photoW = 20;
  const photoH = 25;
  const photoX = margin + 8;
  const photoY = cardY + 3;

  let photoRendered = false;
  if (photoBase64 && photoBase64.startsWith('data:image/')) {
    try {
      const isPng = photoBase64.startsWith('data:image/png');
      const format = isPng ? 'PNG' : 'JPEG';
      doc.addImage(photoBase64, format, photoX, photoY, photoW, photoH);
      photoRendered = true;
    } catch (err) {
      console.warn('[AdmitCardPdfExporter] Primary addImage failed, attempting raster fallback:', err);
      try {
        const fallbackRaster = await ensureRasterJpegOrPng(photoBase64);
        if (fallbackRaster && fallbackRaster.startsWith('data:image/')) {
          doc.addImage(fallbackRaster, 'JPEG', photoX, photoY, photoW, photoH);
          photoRendered = true;
        }
      } catch {}
    }
  }

  if (!photoRendered) {
    doc.setFillColor(226, 232, 240);
    doc.rect(photoX, photoY, photoW, photoH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105);
    doc.text(student.name.charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 + 3, {
      align: 'center',
    });
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('PHOTO', photoX + photoW / 2, photoY + photoH / 2 + 8, { align: 'center' });
  }

  // Photo outline
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.rect(photoX, photoY, photoW, photoH);

  // Roll number below photo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Roll No: ${student.rollNumber || '—'}`, photoX + photoW / 2, photoY + photoH + 3.5, {
    align: 'center',
  });

  // Demographic Matrix (Two columns)
  const col1X = photoX + photoW + 6;
  const col2X = col1X + 75;
  let textY = cardY + 6;
  const rowSpacing = 6;

  const fatherName = student.fatherName || student.parentName || 'Guardian';
  const regNo = student.registrationNumber || student.admissionNumber;

  const demoCol1: [string, string][] = [
    ["Candidate's Full Name", student.name.toUpperCase()],
    ['Class & Section', `${student.className || 'Class'} - Section ${student.section || 'A'}`],
    ['Admission / Scholar No', student.admissionNumber],
    ['Registration Number', regNo],
  ];

  const demoCol2: [string, string][] = [
    ["Father's / Guardian's Name", fatherName],
    ['Date of Birth', student.dob || '—'],
    ['Examination Venue', exam.roomVenue || 'Main Campus Examination Hall'],
    ['Admit Card Status', 'VERIFIED & ISSUED'],
  ];

  for (let i = 0; i < demoCol1.length; i++) {
    // Left column
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(demoCol1[i][0] + ':', col1X, textY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(demoCol1[i][1], col1X + 32, textY);

    // Right column
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(demoCol2[i][0] + ':', col2X, textY);

    if (demoCol2[i][0] === 'Admit Card Status') {
      doc.setFillColor(209, 250, 229); // emerald-100
      doc.setDrawColor(16, 185, 129); // emerald-500
      doc.setLineWidth(0.2);
      doc.rect(col2X + 34, textY - 3.5, 30, 4.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(6, 95, 70); // emerald-800
      doc.text(demoCol2[i][1], col2X + 49, textY - 0.5, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const valueX = col2X + 34;
      const valueWidth = pageWidth - margin - 6 - valueX;
      const fitted = doc.splitTextToSize(String(demoCol2[i][1] ?? ''), valueWidth) as string[];
      doc.text(fitted.length > 1 ? `${fitted[0].replace(/\s+\S*$/, '')}...` : fitted[0] || '', valueX, textY);
    }

    textY += rowSpacing;
  }

  currentY = cardY + cardHeight + 4;

  // 4. Timetable / Schedule Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('EXAMINATION SCHEDULE & SEATING ALLOTMENT', margin + 4, currentY);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('* Candidate must occupy allotted seat 15 mins prior to commencement', pageWidth - margin - 4, currentY, {
    align: 'right',
  });
  currentY += 2;

  // Prepare table data
  const scheduleItems = options.schedule || getApplicableSchedule(student, exam);
  const tableRows =
    scheduleItems.length > 0
      ? scheduleItems.map((item, idx) => {
          let dayOfWeek = '';
          try {
            if (item.date) {
              const d = new Date(item.date);
              dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
            }
          } catch {}

          const dateDisplay = `${item.date || '—'}${dayOfWeek ? ` (${dayOfWeek})` : ''}`;
          const timeDisplay = item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : item.startTime || '09:00 AM';
          const roomDisplay = item.roomNumber || exam.roomVenue || 'Exam Hall';

          return [
            String(idx + 1),
            dateDisplay,
            item.subjectName || 'Subject',
            timeDisplay,
            String(item.maxMarks || 100),
            roomDisplay,
            '', // Invigilator signature column
          ];
        })
      : [
          [
            '1',
            'As per Notice Board',
            'All Registered Curriculum Papers',
            '09:00 AM - 12:00 PM',
            '100',
            exam.roomVenue || 'Exam Hall',
            '',
          ],
        ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin + 4, right: margin + 4, top: 0, bottom: 0 },
    head: [['#', 'Date & Day', 'Subject Name', 'Time', 'Max Marks', 'Room / Hall', 'Invigilator Sign']],
    body: tableRows,
    theme: 'grid',
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      font: 'helvetica',
      textColor: [15, 23, 42],
      lineColor: [15, 23, 42],
      lineWidth: 0.2,
      minCellHeight: 5.5,
    },
    headStyles: {
      fillColor: [226, 232, 240], // slate-200
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 32, halign: 'left' },
      2: { cellWidth: 38, halign: 'left', fontStyle: 'bold' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 32, halign: 'center', fontSize: 7 },
      6: { halign: 'center', cellWidth: 'auto' }, // Remaining width for invigilator signature
    },
  });

  const finalTableY = (doc as any).lastAutoTable?.finalY || currentY + 40;
  currentY = finalTableY + 4;

  // 5. Rules & Instructions for Candidates
  const instructionBoxY = currentY;
  const instructionBoxHeight = 27;
  const instructionBoxWidth = pageWidth - (margin + 4) * 2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(margin + 4, instructionBoxY, instructionBoxWidth, instructionBoxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('RULES & INSTRUCTIONS FOR CANDIDATES:', margin + 7, instructionBoxY + 4.5);

  const rules = [
    '1. Candidates must occupy their allotted seats 15 minutes before the scheduled time. No entry permitted after commencement.',
    '2. Admit Card along with School ID Card must be produced on all examination days.',
    '3. Mobile phones, smartwatches, digital calculators, study notes, or any electronic devices are strictly prohibited.',
    '4. Use only blue or royal blue ballpoint pen for writing answers. Borrowing stationery during exam hours is strictly disallowed.',
    `5. ${exam.instructions || 'Any candidate caught using unfair means will be disqualified immediately as per school examination bylaws.'}`,
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  let ruleY = instructionBoxY + 8.5;
  for (const rule of rules) {
    const splitRule = doc.splitTextToSize(rule, instructionBoxWidth - 6);
    doc.text(splitRule[0], margin + 7, ruleY);
    ruleY += 3.8;
  }

  // 6. Signatures (Anchored safely at bottom of page)
  const sigY = pageHeight - margin - 18;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);

  // Candidate
  doc.line(margin + 8, sigY, margin + 48, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text("Candidate's Signature", margin + 28, sigY + 4, { align: 'center' });

  // Class Teacher
  doc.line(pageWidth / 2 - 20, sigY, pageWidth / 2 + 20, sigY);
  doc.text("Class Teacher's Signature", pageWidth / 2, sigY + 4, { align: 'center' });

  // Principal / Controller of Examinations
  const prinX = pageWidth - margin - 48;
  doc.line(prinX, sigY, pageWidth - margin - 8, sigY);

  if (sigBase64) {
    try {
      const sigFormat = sigBase64.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(sigBase64, sigFormat, prinX + 4, sigY - 11, 32, 9);
    } catch {
      // Signature image render fallback
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(settings.principalName || 'Principal', pageWidth - margin - 28, sigY + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Controller of Examinations', pageWidth - margin - 28, sigY + 7.5, { align: 'center' });

  // Strict Single Page Invariant: Delete any accidental extra page
  if (isFirstPage) {
    while (doc.getNumberOfPages() > 1) {
      doc.deletePage(doc.getNumberOfPages());
    }
  }
}

/**
 * Generates and downloads a single student high-resolution Admit Card PDF.
 * Guaranteed to fit exactly on 1 A4 page with dynamic photo, logo and signatures.
 */
export async function exportAdmitCardToPdf(options: AdmitCardPdfOptions, action: 'download' | 'print' = 'download'): Promise<boolean> {
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
        : getDocumentImageBase64Async(options.settings.schoolLogo, true),
      options.photoBase64
        ? options.photoBase64
        : resolveStudentPhotoBase64(options.student),
      options.sigBase64
        ? options.sigBase64
        : getDocumentImageBase64Async(options.settings.principalSignature),
    ]);

    await buildSingleAdmitCardPage(
      doc,
      {
        ...options,
        logoBase64,
        photoBase64,
        sigBase64,
      },
      true
    );

    // Final safety clamp: Exactly 1 page
    while (doc.getNumberOfPages() > 1) {
      doc.deletePage(doc.getNumberOfPages());
    }

    const cleanStudentName = options.student.name.replace(/[^a-zA-Z0-9]/g, '_');
    const examClean = (options.exam?.name || options.exam?.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `AdmitCard_${options.student.admissionNumber}_${cleanStudentName}_${examClean}.pdf`;

    if (typeof window !== 'undefined') {
      if (action === 'print') await printPdfBlob(doc.output('blob'));
      else doc.save(filename);
    } else {
      doc.output('arraybuffer');
    }
    return true;
  } catch (err) {
    console.error('[AdmitCardPdfExporter] Single export error:', err);
    return false;
  }
}

/**
 * Generates and downloads a bulk PDF containing exactly 1 A4 page per student.
 */
export async function exportBulkAdmitCardsToPdf(options: BulkAdmitCardPdfOptions, action: 'download' | 'print' = 'download'): Promise<boolean> {
  try {
    const { students, exam, settings, getStudentSchedule, photosMap: initialPhotosMap } = options;
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

    const { logoBase64: preLogo, sigBase64: preSig, photosMap: prePhotos } = await preloadDocumentAssets(uniqueStudents, settings);
    const logoBase64 = options.logoBase64 || preLogo;
    const sigBase64 = options.sigBase64 || preSig;

    // Merge existing photosMap with newly preloaded photos
    const mergedPhotosMap = new Map<string, string>(initialPhotosMap || []);
    for (const [k, v] of prePhotos.entries()) {
      if (!mergedPhotosMap.has(k)) {
        mergedPhotosMap.set(k, v);
      }
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < uniqueStudents.length; i++) {
      const st = uniqueStudents[i];
      const sched = getStudentSchedule ? getStudentSchedule(st) : getApplicableSchedule(st, exam);
      let studentPhoto = mergedPhotosMap.get(st.id) || mergedPhotosMap.get(st.admissionNumber) || null;

      if (!studentPhoto) {
        studentPhoto = await resolveStudentPhotoBase64(st, `admit-card-student-photo-${st.id}`);
        if (studentPhoto) {
          mergedPhotosMap.set(st.id, studentPhoto);
          if (st.admissionNumber) mergedPhotosMap.set(st.admissionNumber, studentPhoto);
        }
      }

      await buildSingleAdmitCardPage(
        doc,
        {
          student: st,
          exam,
          settings,
          schedule: sched,
          photoBase64: studentPhoto,
          logoBase64,
          sigBase64,
        },
        i === 0
      );
    }

    // Ensure total pages equals number of students
    while (doc.getNumberOfPages() > uniqueStudents.length) {
      doc.deletePage(doc.getNumberOfPages());
    }

    const schoolClean = (settings.schoolName || 'CPS_School').replace(/[^a-zA-Z0-9]/g, '_');
    const examClean = (exam?.name || exam?.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${schoolClean}_AdmitCards_${examClean}_${uniqueStudents.length}Students.pdf`;

    if (typeof window !== 'undefined') {
      if (action === 'print') await printPdfBlob(doc.output('blob'));
      else doc.save(filename);
    } else {
      doc.output('arraybuffer');
    }
    return true;
  } catch (err) {
    console.error('[AdmitCardPdfExporter] Bulk export error:', err);
    return false;
  }
}
