import QRCode from 'qrcode';
import type { Student } from '../types';
import type { Marksheet } from './marksheetModel';

/**
 * Marksheet QR code and photo fitting, shared by the PDF export and the on-screen marksheet.
 * The QR holds plain readable text, so any phone camera shows the student's details without an app.
 */

const clean = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();

/** "PASS" / "FAIL" once every subject has marks; otherwise the honest status (never a guess). */
export function marksheetResultLabel(sheet: Marksheet): string {
  if (sheet.result === 'PASS' || sheet.result === 'FAIL') return sheet.result;
  if (sheet.result === 'INCOMPLETE') return 'INCOMPLETE';
  return 'NOT PUBLISHED';
}

export function buildMarksheetQrText(student: Student, sheet: Marksheet): string {
  const regNo = student.registrationNumber || (student.admissionNumber ? `CPS${student.admissionNumber}` : '');
  const lines: Array<[string, string]> = [
    ['Student Name', clean(student.name).toUpperCase()],
    ['Class & Section', `${clean(student.className) || 'Class'} - ${clean(student.section) || 'A'}`],
    ['Admission No', clean(student.admissionNumber)],
    ['Roll No', clean(student.rollNumber) || '-'],
    ['Registration No', clean(regNo)],
    ['Date of Birth', clean(student.dob) || '-'],
    ['Gender', clean(student.gender).toUpperCase() || '-'],
    ["Father's Name", clean(student.fatherName || student.parentName).toUpperCase() || '-'],
    ["Mother's Name", clean(student.motherName).toUpperCase() || '-'],
    ['Result', marksheetResultLabel(sheet)],
    ['Obtained Marks', sheet.totalMax > 0 ? `${sheet.totalObtained} / ${sheet.totalMax}` : '-'],
    ['Percentage', sheet.totalMax > 0 ? `${sheet.percentage.toFixed(2)}%` : '-'],
  ];
  return lines.map(([k, v]) => `${k}: ${v}`).join('\n');
}

export async function makeMarksheetQr(student: Student, sheet: Marksheet): Promise<string | null> {
  try {
    return await QRCode.toDataURL(buildMarksheetQrText(student, sheet), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });
  } catch {
    return null;
  }
}

/**
 * Centre-crops a photo to the frame's shape (cover), so it is never stretched or squashed in the PDF.
 * Outside a browser (tests) the image is returned unchanged.
 */
export function fitPhotoToFrame(dataUrl: string | null | undefined, frameW: number, frameH: number): Promise<string | null> {
  if (!dataUrl) return Promise.resolve(null);
  if (typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const sw = img.naturalWidth || img.width;
        const sh = img.naturalHeight || img.height;
        if (!sw || !sh) return resolve(dataUrl);
        const target = frameW / frameH;
        let cw = sw;
        let ch = sh;
        if (sw / sh > target) cw = sh * target;
        else ch = sw / target;
        const sx = (sw - cw) / 2;
        const sy = Math.max(0, (sh - ch) / 4); // keep faces: crop a little more from the bottom than the top
        const scale = Math.min(1, 600 / ch);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(cw * scale));
        canvas.height = Math.max(1, Math.round(ch * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
