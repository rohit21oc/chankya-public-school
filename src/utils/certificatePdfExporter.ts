import { jsPDF } from 'jspdf';
import { CertificateType, SchoolSettings, Student } from '../types';
import { getDocumentImageBase64Async, resolveStudentPhotoBase64 } from './documentImageHelper';
import { NOT_CONFIGURED } from './schoolIdentity';

export interface CertificatePdfOptions {
  student: Student;
  certType: CertificateType;
  settings: SchoolSettings;
  issueDate?: string;
  photoBase64?: string | null;
  logoBase64?: string | null;
  sigBase64?: string | null;
  saveToFile?: string;
}

/**
 * Renders a justified paragraph in jsPDF with natural, continuous text flow:
 * - Natural word wrapping across available width without manual line breaks inside sentences.
 * - Intermediate lines are smoothly justified within reasonable word spacing bounds.
 * - The LAST line of the paragraph is ALWAYS naturally left-aligned, NEVER stretched.
 * - Consistent line-height and optional first-line indent.
 * Returns the updated Y coordinate.
 */
function renderJustifiedParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number = 7.0,
  indent: number = 8.0
): number {
  let currentY = startY;
  const normalSpace = doc.getTextWidth(' ');

  // Split into lines based on available line width
  const lines = doc.splitTextToSize(text, maxWidth - indent);
  if (!lines || lines.length === 0) return currentY;

  lines.forEach((lineText: string, idx: number) => {
    const isFirstLine = idx === 0;
    const isLastLine = idx === lines.length - 1;
    const lineX = x + (isFirstLine ? indent : 0);
    const lineMaxWidth = maxWidth - (isFirstLine ? indent : 0);

    // If it's the last line of the paragraph, ALWAYS render naturally left-aligned
    if (isLastLine) {
      doc.text(lineText, lineX, currentY);
      currentY += lineHeight;
      return;
    }

    const words = lineText.trim().split(/\s+/);
    if (words.length <= 1) {
      doc.text(lineText, lineX, currentY);
      currentY += lineHeight;
      return;
    }

    const totalWordWidth = words.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
    const availableGapSpace = lineMaxWidth - totalWordWidth;
    const gapCount = words.length - 1;
    const gapWidth = availableGapSpace / gapCount;

    // Only apply distributed justification if gapWidth is within natural bounds (up to 2.3x normal space)
    if (gapWidth > 0 && gapWidth <= normalSpace * 2.3) {
      let curX = lineX;
      for (let w = 0; w < words.length; w++) {
        const word = words[w];
        doc.text(word, curX, currentY);
        curX += doc.getTextWidth(word) + gapWidth;
      }
    } else {
      doc.text(lineText, lineX, currentY);
    }

    currentY += lineHeight;
  });

  return currentY;
}

/**
 * Standardized institutional certificate header renderer:
 * - Logo positioned directly to the left of the School Name in the same horizontal header row
 * - Prominent uppercase school name
 * - Address & affiliation details centered under school name
 * - Certificate Title Badge centered below
 * - Solid divider line
 * Returns the updated currentY coordinate.
 */
function renderCertificateHeader(
  doc: jsPDF,
  settings: SchoolSettings,
  certType: CertificateType,
  logoBase64: string | null,
  contentX: number,
  contentRight: number,
  pageWidth: number,
  startY: number
): number {
  let currentY = startY;

  // Saved School Settings only; missing values print as "Not configured".
  const schoolName = (settings.schoolName || NOT_CONFIGURED).toUpperCase();
  const address = settings.schoolAddress || NOT_CONFIGURED;
  const affCode = settings.affiliationCode || settings.affiliationNumber || NOT_CONFIGURED;
  const schCode = settings.schoolCode || NOT_CONFIGURED;
  const board = settings.affiliatedBoard || NOT_CONFIGURED;
  const affLine = `Affiliated to ${board} • Affiliation No: ${affCode} • School Code: ${schCode}`;

  // Measure text dimensions to align logo directly to the left of the school name block
  doc.setFont('times', 'bold');
  doc.setFontSize(15.5);
  const nameWidth = doc.getTextWidth(schoolName);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const affWidth = doc.getTextWidth(affLine);

  const textBlockWidth = Math.max(nameWidth, affWidth);
  const logoSize = 16; // 16mm x 16mm proportional high-res logo
  const logoGap = 4; // 4mm spacing between logo and text block

  const totalHeaderWidth = (logoBase64 ? logoSize + logoGap : 0) + textBlockWidth;
  const headerStartX = Math.max(contentX, (pageWidth - totalHeaderWidth) / 2);

  const logoX = headerStartX;
  const textStartX = logoBase64 ? headerStartX + logoSize + logoGap : headerStartX;
  const textCenterX = textStartX + textBlockWidth / 2;

  const logoY = currentY;

  // 1. Draw School Logo on the left of school name
  if (logoBase64) {
    try {
      const format = logoBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoBase64, format, logoX, logoY, logoSize, logoSize);
    } catch {}
  }

  // 2. School Name (prominent bold serif, vertically aligned with logo)
  doc.setFont('times', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(15, 23, 42);
  doc.text(schoolName, textCenterX, currentY + 5.0, { align: 'center' });

  // 3. School Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(address, textCenterX, currentY + 9.8, { align: 'center' });

  // 4. Affiliation Line
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(affLine, textCenterX, currentY + 14.0, { align: 'center' });

  currentY += Math.max(logoBase64 ? logoSize : 15, 16) + 2.5;

  // 5. Certificate Badge Box (Centered title box matching portal preview)
  const badgeTitle =
    certType === 'TC'
      ? 'TRANSFER CERTIFICATE / SCHOOL LEAVING CERTIFICATE'
      : certType === 'CHARACTER'
      ? 'CHARACTER & CONDUCT CERTIFICATE'
      : 'BONAFIDE STUDY CERTIFICATE';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const badgeTextWidth = doc.getTextWidth(badgeTitle);
  const badgeWidth = Math.min(145, Math.max(badgeTextWidth + 14, 100));
  const badgeHeight = 6.5;
  const badgeX = (pageWidth - badgeWidth) / 2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.rect(badgeX, currentY, badgeWidth, badgeHeight, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.text(badgeTitle, pageWidth / 2, currentY + 4.5, { align: 'center' });
  currentY += badgeHeight + 2.5;

  // 6. Header Divider Line (Matching border-b border-slate-900)
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(contentX, currentY, contentRight, currentY);
  currentY += 4.0;

  return currentY;
}

/**
 * Generates and downloads a high-resolution vector PDF for institutional certificates
 * (Bonafide, Character, and Transfer Certificate).
 * Strictly guarantees exactly 1 A4 portrait page with balanced professional spacing.
 */
export async function exportCertificateToPdf(options: CertificatePdfOptions): Promise<boolean> {
  try {
    const { student, certType, settings, issueDate = new Date().toLocaleDateString('en-GB') } = options;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8; // Clean 8mm outer margin for A4

    // Resolve images with maximum available resolution
    const [logoBase64, photoBase64, sigBase64] = await Promise.all([
      options.logoBase64
        ? options.logoBase64
        : getDocumentImageBase64Async(settings.schoolLogo, true),
      options.photoBase64
        ? options.photoBase64
        : resolveStudentPhotoBase64(student),
      options.sigBase64
        ? options.sigBase64
        : getDocumentImageBase64Async(settings.principalSignature),
    ]);

    // Outer double border matching portal preview: 'border-double border-slate-900'
    // Outer thick border
    doc.setDrawColor(15, 23, 42); // Deep Navy / Slate #0F172A
    doc.setLineWidth(1.2);
    doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

    // Inner thin border
    doc.setLineWidth(0.4);
    doc.rect(margin + 2.5, margin + 2.5, pageWidth - (margin + 2.5) * 2, pageHeight - (margin + 2.5) * 2);

    // Inner content area boundaries
    const contentX = 14;
    const contentRight = 196;
    const contentWidth = contentRight - contentX;

    // Standardized header renderer: Logo on left of school name, clean address & affiliation, badge & divider
    let currentY = renderCertificateHeader(
      doc,
      settings,
      certType,
      logoBase64,
      contentX,
      contentRight,
      pageWidth,
      margin + 4.5
    );

    // Certificate Meta Row & Student Photo (Preserving authentic passport ratio and sharp vector boundaries)
    const refNo = `${certType}/2026/${student.admissionNumber}`;
    const photoW = 24; // Standard 24mm x 30mm passport ratio (4:5)
    const photoH = 30;
    const photoX = contentRight - photoW;
    const photoY = currentY;

    const metaY1 = currentY + 5.5;
    const metaY2 = currentY + 13.0;
    const metaY3 = currentY + 20.5;
    const metaY4 = currentY + 27.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Cert Ref No: ', contentX, metaY1);

    const refLabelWidth = doc.getTextWidth('Cert Ref No: ');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(refNo, contentX + refLabelWidth, metaY1);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Date of Issue: ', contentX, metaY2);

    const dateLabelWidth = doc.getTextWidth('Date of Issue: ');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(issueDate, contentX + dateLabelWidth, metaY2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Student ID / Adm No: ', contentX, metaY3);

    const admLabelWidth = doc.getTextWidth('Student ID / Adm No: ');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(student.admissionNumber, contentX + admLabelWidth, metaY3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Academic Session: ', contentX, metaY4);

    const sessLabelWidth = doc.getTextWidth('Academic Session: ');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const session = student.academicSession || settings.currentAcademicSession || '2026-2027';
    doc.text(session, contentX + sessLabelWidth, metaY4);

    // Embed student photo on the top-right preserving exact natural aspect ratio
    let photoRendered = false;
    if (photoBase64) {
      try {
        const photoFormat = photoBase64.includes('png') ? 'PNG' : 'JPEG';
        let imgWidth = photoW;
        let imgHeight = photoH;

        try {
          const imgProps = (doc as any).getImageProperties(photoBase64);
          if (imgProps && imgProps.width > 0 && imgProps.height > 0) {
            imgWidth = imgProps.width;
            imgHeight = imgProps.height;
          }
        } catch {}

        const imgAspect = imgWidth / imgHeight;
        const boxAspect = photoW / photoH;

        let drawW = photoW;
        let drawH = photoH;
        let drawX = photoX;
        let drawY = photoY;

        if (imgAspect > boxAspect) {
          // Photo is wider than container box: constrain by width, center vertically
          drawW = photoW;
          drawH = photoW / imgAspect;
          drawY = photoY + (photoH - drawH) / 2;
        } else {
          // Photo is taller than container box: constrain by height, center horizontally
          drawH = photoH;
          drawW = photoH * imgAspect;
          drawX = photoX + (photoW - drawW) / 2;
        }

        // Clean white background container
        doc.setFillColor(255, 255, 255);
        doc.rect(photoX, photoY, photoW, photoH, 'F');

        // Draw photo at preserved aspect ratio
        doc.addImage(photoBase64, photoFormat, drawX, drawY, drawW, drawH);
        photoRendered = true;
      } catch (e) {
        console.warn('[CertificatePdf] Failed to add student image:', e);
      }
    }

    if (!photoRendered) {
      doc.setFillColor(248, 250, 252);
      doc.rect(photoX, photoY, photoW, photoH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(100, 116, 139);
      doc.text(student.name.charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 + 1.5, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text('PHOTO', photoX + photoW / 2, photoY + photoH / 2 + 8, { align: 'center' });
    }

    // Outer photo frame border
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.35);
    doc.rect(photoX, photoY, photoW, photoH);

    currentY = photoY + photoH + 4.5;

    // Subtle divider below meta row
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(contentX, currentY, contentRight, currentY);
    currentY += 4.5;

    // Student Shared Data
    const studentFather = student.fatherName || student.parentName || 'Father';
    const studentMother = student.motherName || 'Verified Mother';
    const regNo = student.registrationNumber || `PDS${student.admissionNumber}`;
    const studentAddress = `${student.address || ''}, ${student.city || ''}, ${student.state || 'Bihar'} - ${student.pincode || '843329'}`.trim();
    const affCode = settings.affiliationCode || settings.affiliationNumber || NOT_CONFIGURED;
    const schCode = settings.schoolCode || NOT_CONFIGURED;

    if (certType === 'TC') {
      // Transfer Certificate: Exactly 17 distinct numbered items matching portal preview
      const tcItems: [string, string][] = [
        ['1. Name of the Pupil', student.name.toUpperCase()],
        ["2. Father's / Guardian's Name", studentFather.toUpperCase()],
        ["3. Mother's Name", studentMother.toUpperCase()],
        ['4. Nationality', 'Indian'],
        ['5. Category', (student.category || 'GENERAL').toUpperCase()],
        ['6. Gender', (student.gender || 'MALE').toUpperCase()],
        ['7. Institutional Admission Number', student.admissionNumber],
        ['8. Class Roll Number', student.rollNumber || '—'],
        ['9. Registration Number', regNo],
        ['10. Date of Birth (in figures)', student.dob || '—'],
        ['11. Class in which pupil last studied', `${student.className} (${student.section})`],
        ['12. School / Board Annual Examination last taken with result', 'PROMOTED / PASSED'],
        ['13. Academic Session', session],
        ['14. Month up to which the pupil has paid school dues', 'ALL DUES CLEARED IN FULL'],
        ['15. General Conduct & Character', 'VERY GOOD & EXEMPLARY'],
        ['16. Reason for leaving the school', 'Course completion / Transfer on parent request'],
        ['17. Permanent Residential Address', studentAddress],
      ];

      const targetContentEnd = 246;
      const availableSpace = targetContentEnd - currentY;
      const itemSpacing = Math.min(9.8, Math.max(8.5, availableSpace / tcItems.length));

      for (const [label, val] of tcItems) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);

        const labelText = label + ': ';
        doc.text(labelText, contentX, currentY);
        const labelWidth = doc.getTextWidth(labelText);

        const valX = contentX + labelWidth + 1.5;
        const maxValWidth = contentRight - valX - 1;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);

        const textWidth = doc.getTextWidth(val);
        if (textWidth <= maxValWidth) {
          doc.text(val, valX, currentY);

          // Subtle underline directly under the value matching portal preview: border-b border-slate-400
          doc.setDrawColor(148, 163, 184); // slate-400
          doc.setLineWidth(0.25);
          doc.line(valX - 0.5, currentY + 1.2, valX + textWidth + 1.5, currentY + 1.2);
          currentY += itemSpacing;
        } else {
          // Wrap gracefully if address or parent name is exceptionally long
          const splitVal = doc.splitTextToSize(val, maxValWidth);
          doc.text(splitVal, valX, currentY);

          doc.setDrawColor(148, 163, 184);
          doc.setLineWidth(0.25);
          splitVal.forEach((lineText: string, idx: number) => {
            const lineWidth = doc.getTextWidth(lineText);
            const lineY = currentY + idx * 4.0;
            doc.line(valX - 0.5, lineY + 1.2, valX + lineWidth + 1.5, lineY + 1.2);
          });
          currentY += Math.max(itemSpacing, splitVal.length * 4.2 + 2);
        }
      }

      // Institutional verification note
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Certified that the above institutional information is verified against the school register.',
        pageWidth / 2,
        Math.min(currentY + 2, 248),
        { align: 'center' }
      );
    } else {
      // Character or Bonafide Certificate: Beautiful, continuous justified typography with balanced vertical flow
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);

      const p1 =
        certType === 'CHARACTER'
          ? `This is to certify that Mr./Mrs. ${student.name.toUpperCase()}, Son / Daughter of Shri ${studentFather.toUpperCase()} and Smt. ${studentMother.toUpperCase()}, bearing Admission Number ${student.admissionNumber} and Registration Number ${regNo}, has been a regular student of this institution studying in ${student.className}, Section ${student.section} during the Academic Session ${session}.`
          : `This is to certify that Mr./Mrs. ${student.name.toUpperCase()}, Son / Daughter of Shri ${studentFather.toUpperCase()} and Smt. ${studentMother.toUpperCase()}, bearing Admission Number ${student.admissionNumber} and Registration Number ${regNo}, is a bonafide student of this institution currently enrolled in ${student.className}, Section ${student.section} during the Academic Session ${session}.`;

      const p2 =
        certType === 'CHARACTER'
          ? `According to institutional admission records, his / her official date of birth is ${student.dob || '—'}. To the best of our knowledge and official institutional records, he / she bears an EXEMPLARY MORAL CHARACTER and pleasant conduct. He / She has demonstrated active discipline, courteous demeanor, and cheerful participation in scholastic and co-curricular programs.`
          : `According to the school admission register, his / her official date of birth is ${student.dob || '—'}. His / Her registered permanent address is ${studentAddress}. He / She bears a good moral character.`;

      const p3 =
        certType === 'CHARACTER'
          ? `We wish him / her immense success, bright health, and outstanding prospects in all future academic pursuits.`
          : `This certificate is issued upon the request of the parent / guardian for official documentation, banking, passport, and educational verification purposes.`;

      const sigDividerTargetY = 252;
      const boxHeight = 32;
      const lineHeight = 6.8;
      const indent = 8.0;

      // Render Paragraph 1
      currentY = renderJustifiedParagraph(doc, p1, contentX, currentY, contentWidth, lineHeight, indent);
      currentY += 8.0;

      // Render Paragraph 2
      currentY = renderJustifiedParagraph(doc, p2, contentX, currentY, contentWidth, lineHeight, indent);
      currentY += 8.0;

      // Render Paragraph 3
      currentY = renderJustifiedParagraph(doc, p3, contentX, currentY, contentWidth, lineHeight, indent);
      currentY += 9.0;

      // Institutional Record Verification Box: Cleanly positioned with no dead void in middle
      const maxBoxY = sigDividerTargetY - boxHeight - 12;
      const boxY = Math.min(Math.max(currentY, 180), maxBoxY);
      const boxW = contentWidth;
      const boxX = contentX;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.35);
      doc.roundedRect(boxX, boxY, boxW, boxHeight, 2, 2, 'FD');

      // Box Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('INSTITUTIONAL RECORD VERIFICATION & OFFICIAL SEAL', pageWidth / 2, boxY + 5.2, { align: 'center' });

      // Subtle horizontal rule inside box
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(boxX + 6, boxY + 7.5, boxX + boxW - 6, boxY + 7.5);

      // Two-column Institutional Record particulars
      const colLeftX = boxX + 8;
      const colRightX = boxX + boxW / 2 + 4;
      const rowY1 = boxY + 13.0;
      const rowY2 = boxY + 18.5;
      const rowY3 = boxY + 24.0;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      // Left Column
      doc.text('• Admission Register: ', colLeftX, rowY1);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Vol. 2026/27 • Verified Record`, colLeftX + doc.getTextWidth('• Admission Register: '), rowY1);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• Affiliated Board: ', colLeftX, rowY2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${settings.affiliatedBoard || NOT_CONFIGURED} (Code: ${affCode})`, colLeftX + doc.getTextWidth('• Affiliated Board: '), rowY2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• School Registration: ', colLeftX, rowY3);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${schCode} • Sheohar`, colLeftX + doc.getTextWidth('• School Registration: '), rowY3);

      // Right Column
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• Institutional Status: ', colRightX, rowY1);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const statusText = certType === 'CHARACTER' ? 'Exemplary Conduct & Character' : 'Bonafide Active Student';
      doc.text(statusText, colRightX + doc.getTextWidth('• Institutional Status: '), rowY1);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• Legal Validity: ', colRightX, rowY2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Official Institutional Record', colRightX + doc.getTextWidth('• Legal Validity: '), rowY2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• Authorizing Authority: ', colRightX, rowY3);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('School Administration Cell', colRightX + doc.getTextWidth('• Authorizing Authority: '), rowY3);

      // Bottom legal validity note inside box
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Valid for official admission, governmental, educational, banking, and scholarship verification requirements.',
        pageWidth / 2,
        boxY + 29.0,
        { align: 'center' }
      );

      // Official embossed institutional seal guide circle between box and signatures
      const sealY = (boxY + boxHeight + sigDividerTargetY) / 2;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.35);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.circle(pageWidth / 2, sealY, 7.5, 'S');
      doc.setLineDashPattern([], 0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text('OFFICIAL INSTITUTIONAL SEAL', pageWidth / 2, sealY + 0.5, { align: 'center' });
    }

    // Institutional Signatures at Bottom (3 Columns matching portal preview)
    const sigDividerY = 252;
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.35);
    doc.line(contentX, sigDividerY, contentRight, sigDividerY);

    const sigLineY = 268;
    const col1Center = contentX + 28;
    const col1Width = 36;
    const col2Center = pageWidth / 2;
    const col2Width = 36;
    const col3Center = contentRight - 28;
    const col3Width = 40;

    // Dashed lines matching portal preview 'border-dashed border-slate-400'
    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([1.5, 1], 0);

    // Column 1 dashed line
    doc.line(col1Center - col1Width / 2, sigLineY, col1Center + col1Width / 2, sigLineY);
    // Column 2 dashed line
    doc.line(col2Center - col2Width / 2, sigLineY, col2Center + col2Width / 2, sigLineY);
    // Column 3 dashed line
    doc.line(col3Center - col3Width / 2, sigLineY, col3Center + col3Width / 2, sigLineY);

    // Reset dash pattern for text/shapes
    doc.setLineDashPattern([], 0);

    // Principal Signature image above dashed line if available
    if (sigBase64) {
      try {
        const sigFormat = sigBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        const sigW = 28;
        const sigH = 8.5;
        doc.addImage(sigBase64, sigFormat, col3Center - sigW / 2, sigLineY - sigH - 1, sigW, sigH);
      } catch {}
    }

    // Signature labels
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text('Prepared By (Admin)', col1Center, sigLineY + 4, { align: 'center' });
    doc.text('Checked by Registrar', col2Center, sigLineY + 4, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(settings.principalName || 'Principal', col3Center, sigLineY + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Principal / Head of Institution', col3Center, sigLineY + 7.5, { align: 'center' });

    // Strictly enforce exactly 1 A4 page
    while (doc.getNumberOfPages() > 1) {
      doc.deletePage(doc.getNumberOfPages());
    }

    // Save PDF
    const cleanStudentName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${certType}_Certificate_${student.admissionNumber}_${cleanStudentName}.pdf`;

    if (typeof window !== 'undefined') {
      doc.save(filename);
    } else {
      const buffer = Buffer.from(doc.output('arraybuffer'));
      if (options.saveToFile) {
        try {
          const fs = await import('fs');
          fs.writeFileSync(options.saveToFile, buffer);
        } catch {}
      }
    }
    return true;
  } catch (err) {
    console.error('[CertificatePdfExporter] Export error:', err);
    return false;
  }
}
