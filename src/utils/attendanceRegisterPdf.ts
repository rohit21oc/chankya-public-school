import { jsPDF } from 'jspdf';
import { isWeekOff, workingDaySet } from './workingDays';
import autoTable from 'jspdf-autotable';

/**
 * Monthly student attendance register: one model, one PDF renderer.
 * "Download PDF" saves the file and "Print" prints the very same file, so both always match.
 * A4 landscape, 8 mm margins, header row repeated on every page, rows never split across pages.
 */

export interface RegisterStudent {
  id: string;
  name: string;
  rollNumber?: string | number;
}
export interface RegisterRecord {
  studentId: string;
  date: string; // YYYY-MM-DD
  status: string;
}
export interface RegisterHoliday {
  date: string;
  endDate?: string;
}

export interface RegisterCell {
  code: string; // P, A, L, LT, H, —, ·
  kind: 'P' | 'A' | 'L' | 'LT' | 'H' | 'SUN' | 'NM';
}
export interface RegisterRow {
  roll: string;
  name: string;
  cells: RegisterCell[];
  p: number;
  a: number;
  l: number;
  h: number;
  nm: number;
  percentage: string;
}
export interface RegisterModel {
  year: number;
  month: number; // 0-11
  monthName: string;
  daysInMonth: number;
  weekdays: string[]; // Su Mo ...
  dayNumbers: number[];
  rows: RegisterRow[];
  dailyPresent: (number | null)[]; // null on weekly offs and holidays
  totals: { students: number; p: number; a: number; l: number; h: number; nm: number; percentage: string };
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad2 = (n: number) => String(n).padStart(2, '0');

export function buildAttendanceRegisterModel(
  students: RegisterStudent[],
  records: RegisterRecord[],
  holidays: RegisterHoliday[],
  year: number,
  month: number,
  /** School working weekdays (School Settings); other weekdays are weekly offs. Default Mon–Sat. */
  workingDays?: string[]
): RegisterModel {
  const working = workingDaySet(workingDays);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byKey = new Map<string, string>();
  for (const r of records) byKey.set(`${r.studentId}|${r.date}`, String(r.status || '').toUpperCase());

  const dates = Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad2(month + 1)}-${pad2(i + 1)}`);
  const isHoliday = dates.map((d) => holidays.some((h) => h.date === d || (h.endDate && d >= h.date && d <= h.endDate)));
  const isSunday = dates.map((d) => isWeekOff(d, working)); // weekly off (name kept for the 'SUN' cell kind)

  const dailyPresent: (number | null)[] = dates.map((_, i) => (isSunday[i] || isHoliday[i] ? null : 0));
  const totals = { students: students.length, p: 0, a: 0, l: 0, h: 0, nm: 0, percentage: '' };

  const rows: RegisterRow[] = students.map((st) => {
    let p = 0, a = 0, l = 0, h = 0, nm = 0;
    const cells: RegisterCell[] = dates.map((d, i) => {
      const status = byKey.get(`${st.id}|${d}`);
      if (isHoliday[i]) { h++; return { code: 'H', kind: 'H' }; }
      if (status === 'PRESENT') { p++; if (dailyPresent[i] !== null) dailyPresent[i]!++; return { code: 'P', kind: 'P' }; }
      if (status === 'ABSENT') { a++; return { code: 'A', kind: 'A' }; }
      if (status === 'LEAVE') { l++; return { code: 'L', kind: 'L' }; }
      if (status === 'LATE') { p++; if (dailyPresent[i] !== null) dailyPresent[i]!++; return { code: 'LT', kind: 'LT' }; }
      if (isSunday[i]) return { code: '—', kind: 'SUN' };
      nm++;
      return { code: '·', kind: 'NM' };
    });
    totals.p += p; totals.a += a; totals.l += l; totals.h += h; totals.nm += nm;
    return {
      roll: st.rollNumber === undefined || st.rollNumber === null ? '' : String(st.rollNumber),
      name: st.name || '',
      cells,
      p, a, l, h, nm,
      percentage: p + a + l > 0 ? `${Math.round((p / (p + a + l)) * 100)}%` : '—',
    };
  });

  const marked = totals.p + totals.a + totals.l;
  totals.percentage = marked > 0 ? `${Math.round((totals.p / marked) * 100)}%` : '—';

  return {
    year,
    month,
    monthName: MONTH_NAMES[month],
    daysInMonth,
    weekdays: dates.map((_, i) => WEEKDAYS[new Date(year, month, i + 1).getDay()]),
    dayNumbers: dates.map((_, i) => i + 1),
    rows,
    dailyPresent,
    totals,
  };
}

export interface RegisterPdfMeta {
  schoolName: string;
  schoolAddress?: string;
  affiliationLine?: string;
  className: string;
  section: string;
  printDate: string;
  logoBase64?: string | null;
}

// Page geometry (mm)
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 8;
const FOOTER_H = 7;

type RGB = [number, number, number];
const FILL: Record<RegisterCell['kind'], { fill?: RGB; text: RGB }> = {
  P: { fill: [220, 252, 231], text: [21, 128, 61] },
  A: { fill: [254, 226, 226], text: [185, 28, 28] },
  L: { fill: [254, 243, 199], text: [180, 83, 9] },
  LT: { fill: [254, 243, 199], text: [146, 64, 14] },
  H: { fill: [243, 232, 255], text: [107, 33, 168] },
  SUN: { fill: [255, 241, 242], text: [190, 18, 60] },
  NM: { text: [148, 163, 184] },
};

export function createAttendanceRegisterPdf(model: RegisterModel, meta: RegisterPdfMeta): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const innerW = PAGE_W - MARGIN * 2;

  // ---- Header block (first page) ----
  let y = MARGIN;
  let logoW = 0;
  if (meta.logoBase64) {
    try {
      const props = doc.getImageProperties(meta.logoBase64);
      const h = 14;
      logoW = Math.min(30, (props.width / props.height) * h);
      doc.addImage(meta.logoBase64, props.fileType || 'PNG', MARGIN, y, logoW, h, undefined, 'FAST');
    } catch {
      logoW = 0;
    }
  }
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text((meta.schoolName || '').toUpperCase(), PAGE_W / 2, y + 5, { align: 'center', maxWidth: innerW - 80 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const sub = [meta.schoolAddress, meta.affiliationLine].filter(Boolean).join('  •  ');
  if (sub) doc.text(sub, PAGE_W / 2, y + 9.5, { align: 'center', maxWidth: innerW - 80 });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`MONTHLY STUDENT ATTENDANCE REGISTER - ${model.monthName.toUpperCase()} ${model.year}`, PAGE_W / 2, y + 14.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Printed: ${meta.printDate}`, PAGE_W - MARGIN, y + 5, { align: 'right' });
  doc.text(`Total Students: ${model.totals.students}`, PAGE_W - MARGIN, y + 9.5, { align: 'right' });

  y += 18;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 2;

  // Summary ribbon
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, innerW, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Class: ${meta.className}    Section: ${meta.section}    Month: ${model.monthName} ${model.year}`, MARGIN + 2, y + 4);
  const t = model.totals;
  doc.text(`P: ${t.p}   A: ${t.a}   L: ${t.l}   H: ${t.h}   NM: ${t.nm}   Attendance: ${t.percentage}`, PAGE_W - MARGIN - 2, y + 4, { align: 'right' });
  y += 8;

  // ---- Table ----
  const days = model.daysInMonth;
  const rollW = 9;
  const sumW = 7;
  const pctW = 9;
  const nameW = 44;
  const dayW = (innerW - rollW - nameW - sumW * 5 - pctW) / days; // ~6 mm for 31 days
  const dayHead = (i: number) => `${model.dayNumbers[i]}\n${model.weekdays[i]}`;

  const head = [[
    'Roll', 'Student Name',
    ...model.dayNumbers.map((_, i) => dayHead(i)),
    'P', 'A', 'L', 'H', 'NM', '%',
  ]];

  const body = model.rows.map((r) => [
    r.roll, r.name,
    ...r.cells.map((c) => c.code),
    String(r.p), String(r.a), String(r.l), String(r.h), String(r.nm), r.percentage,
  ]);

  const foot = [[
    { content: 'Total present per day', colSpan: 2, styles: { halign: 'center' as const } },
    ...model.dailyPresent.map((v) => (v === null ? '' : String(v))),
    String(t.p), String(t.a), String(t.l), String(t.h), String(t.nm), t.percentage,
  ]];

  const columnStyles: Record<number, any> = {
    0: { cellWidth: rollW, halign: 'center' },
    1: { cellWidth: nameW, halign: 'left', overflow: 'ellipsize' },
  };
  for (let i = 0; i < days; i++) columnStyles[2 + i] = { cellWidth: dayW, halign: 'center' };
  for (let i = 0; i < 5; i++) columnStyles[2 + days + i] = { cellWidth: sumW, halign: 'center' };
  columnStyles[2 + days + 5] = { cellWidth: pctW, halign: 'center' };

  autoTable(doc, {
    head,
    body: body.length ? body : [[{ content: 'No students enrolled in this class and section.', colSpan: 2 + days + 6, styles: { halign: 'center' } } as any]],
    foot: body.length ? foot : undefined,
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN + FOOTER_H },
    tableWidth: innerW,
    theme: 'grid',
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 6.5,
      cellPadding: { top: 1.1, bottom: 1.1, left: 0.6, right: 0.6 },
      lineColor: [148, 163, 184],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
      valign: 'middle',
      overflow: 'ellipsize',
      minCellHeight: 5.2,
    },
    headStyles: { fillColor: [226, 232, 240], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 6, halign: 'center', cellPadding: 0.7 },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 6.3 },
    columnStyles,
    didParseCell: (d) => {
      if (d.section === 'head' && d.column.index >= 2 && d.column.index < 2 + days) {
        const wd = model.weekdays[d.column.index - 2];
        if (wd === 'Su') { d.cell.styles.fillColor = [254, 205, 211]; d.cell.styles.textColor = [159, 18, 57]; }
      }
      if (d.section === 'head' && d.column.index === 1) d.cell.styles.halign = 'left';
      if (d.section === 'foot') d.cell.styles.halign = 'center';
      if (d.section !== 'body' || !body.length) return;
      const idx = d.column.index;
      if (idx === 1) d.cell.styles.fontStyle = 'bold';
      if (idx >= 2 && idx < 2 + days) {
        const cell = model.rows[d.row.index]?.cells[idx - 2];
        if (cell) {
          const f = FILL[cell.kind];
          if (f.fill) d.cell.styles.fillColor = f.fill;
          d.cell.styles.textColor = f.text;
          d.cell.styles.fontStyle = cell.kind === 'NM' ? 'normal' : 'bold';
        }
      } else if (idx >= 2 + days) {
        d.cell.styles.fontStyle = 'bold';
        if (idx === 2 + days + 5) d.cell.styles.fillColor = [219, 234, 254];
      }
    },
    didDrawPage: () => {
      // Footer on every page (page count filled in below once the total is known)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${meta.schoolName} - ${meta.className} ${meta.section} - ${model.monthName} ${model.year}`,
        MARGIN,
        PAGE_H - MARGIN + 2
      );
    },
  });

  // Legend + signatures on the last page (placed after the table; new page if there is no room)
  let endY = ((doc as any).lastAutoTable?.finalY as number) || y;
  if (endY + 22 > PAGE_H - MARGIN - FOOTER_H) {
    doc.addPage();
    endY = MARGIN;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text('P = Present   A = Absent   L = Leave   LT = Late (counted present)   H = Holiday   NM = Not marked   — = Weekly off   % = P / (P + A + L)', MARGIN, endY + 5);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.2);
  const sigY = endY + 15;
  doc.line(MARGIN + 5, sigY, MARGIN + 60, sigY);
  doc.line(PAGE_W / 2 - 27, sigY, PAGE_W / 2 + 28, sigY);
  doc.line(PAGE_W - MARGIN - 60, sigY, PAGE_W - MARGIN - 5, sigY);
  doc.setFontSize(7);
  doc.text('Class Teacher', MARGIN + 32.5, sigY + 3.5, { align: 'center' });
  doc.text('Examination / Academic In-charge', PAGE_W / 2, sigY + 3.5, { align: 'center' });
  doc.text('Principal', PAGE_W - MARGIN - 32.5, sigY + 3.5, { align: 'center' });

  // Page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN + 2, { align: 'right' });
  }
  return doc;
}

export function attendanceRegisterFileName(meta: { className: string; section: string }, model: { monthName: string; year: number }): string {
  const safe = (s: string) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `Attendance-Register-${safe(meta.className)}-${safe(meta.section)}-${model.monthName}-${model.year}.pdf`;
}

/** Print a PDF blob through a hidden iframe so the printed pages are exactly the downloaded file. */
export function printPdfBlob(blob: Blob, filename = 'document.pdf'): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    // Phones and tablets cannot print a PDF inside a hidden frame (the frame never loads, so nothing
    // happened and the button seemed stuck). Hand the PDF over instead: it opens in the phone's viewer
    // where its own Print / Share works.
    const nav: any = typeof navigator !== 'undefined' ? navigator : {};
    const noInlinePdf = nav.pdfViewerEnabled === false || /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '');
    if (noInlinePdf) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      resolve();
      return;
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60000);
      resolve();
    };
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        // Some browsers refuse to print an embedded PDF: open it so the viewer's own Print works.
        window.open(url, '_blank');
      }
      cleanup();
    };
    frame.src = url;
    document.body.appendChild(frame);
    setTimeout(cleanup, 8000); // if the frame never reports back, free the button anyway
  });
}
