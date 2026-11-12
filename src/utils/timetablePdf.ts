import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TeacherStaff, TimetableSlot } from '../types';

export interface GeneratePDFParams {
  schoolName: string;
  academicSession: string;
  className: string;
  section: string;
  workingDays: string[];
  periods: {
    periodNumber: number;
    name: string;
    startTime: string;
    endTime: string;
    isBreak?: boolean;
    breakType?: string;
  }[];
  slots: TimetableSlot[];
  staffList: TeacherStaff[];
}

export interface TimetablePdfParams {
  schoolName: string;
  /** Main line under the school name, e.g. "Class 5 – Section A Timetable" or "Timetable – Mr. Sharma". */
  heading: string;
  /** Small facts printed in one line under the heading (session, class, teacher, status …). */
  meta: string[];
  workingDays: string[];
  periods: GeneratePDFParams['periods'];
  slots: TimetableSlot[];
  /** Lines shown inside a filled cell; only real saved values, no placeholders. */
  cellLines: (slot: TimetableSlot) => string[];
}

const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;

/**
 * Builds an A4 landscape timetable (days × periods). Used by both Download and Print so they always match.
 * Native vector text, rows never split across pages, header repeated and a footer with page numbers.
 */
export function createTimetablePdf(params: TimetablePdfParams): jsPDF {
  const { schoolName, heading, meta, workingDays, periods, slots, cellLines } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const centre = PAGE_W / 2;
  const generated = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(schoolName.toUpperCase(), centre, 14, { align: 'center', maxWidth: PAGE_W - MARGIN * 2 });
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text(heading, centre, 20.5, { align: 'center', maxWidth: PAGE_W - MARGIN * 2 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(meta.filter(Boolean).join('   |   '), centre, 26, { align: 'center', maxWidth: PAGE_W - MARGIN * 2 });
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 29, PAGE_W - MARGIN, 29);

  const count = Math.max(periods.length, 1);
  const firstCol = 24;
  const colWidth = (PAGE_W - MARGIN * 2 - firstCol) / count;
  const body = count > 9 ? 6.5 : count > 7 ? 7 : 8;

  const headRow = ['Day', ...periods.map((p) => `${p.name}\n${p.startTime} - ${p.endTime}`)];
  const bodyRows = workingDays.map((day) => {
    const row: string[] = [day];
    periods.forEach((p) => {
      if (p.isBreak) {
        row.push((p.breakType || 'Break').toUpperCase());
        return;
      }
      const slot = slots.find(
        (s) => String(s.dayOfWeek).toLowerCase() === day.toLowerCase() && Number(s.periodNumber) === Number(p.periodNumber)
      );
      row.push(slot ? cellLines(slot).filter(Boolean).join('\n') : '');
    });
    return row;
  });

  const columnStyles: Record<number, any> = { 0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 23, 42], halign: 'left', cellWidth: firstCol } };
  periods.forEach((_, i) => { columnStyles[i + 1] = { cellWidth: colWidth }; });

  autoTable(doc, {
    startY: 32,
    margin: { left: MARGIN, right: MARGIN, top: 14, bottom: 14 },
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    rowPageBreak: 'avoid',
    tableWidth: PAGE_W - MARGIN * 2,
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: body, halign: 'center', valign: 'middle', cellPadding: 2 },
    styles: { fontSize: body, cellPadding: 2, halign: 'center', valign: 'middle', lineColor: [203, 213, 225], lineWidth: 0.2, overflow: 'linebreak', minCellHeight: 16 },
    columnStyles,
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index === 0) return;
      const period = periods[data.column.index - 1];
      if (period?.isBreak) {
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
        data.cell.styles.fontStyle = 'bold';
      } else if (data.cell.text.join('').trim()) {
        data.cell.styles.fillColor = [239, 246, 255];
        data.cell.styles.textColor = [30, 58, 138];
      }
    },
  });

  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 130, 145);
    doc.text(`${schoolName}  |  Generated ${generated}`, MARGIN, PAGE_H - 6);
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
  }
  return doc;
}

/** Back-compatible class timetable download. */
export const downloadTimetablePDF = ({ schoolName, academicSession, className, section, workingDays, periods, slots, staffList }: GeneratePDFParams) => {
  const doc = createTimetablePdf({
    schoolName,
    heading: `${className} - Section ${section} Weekly Timetable`,
    meta: [`Session ${academicSession}`],
    workingDays,
    periods,
    slots,
    cellLines: (slot) => [
      slot.subjectName,
      slot.teacherName || staffList.find((st) => st.id === slot.teacherId)?.name || '',
      slot.roomNumber || '',
    ],
  });
  doc.save(`Timetable_${className.replace(/\s+/g, '_')}_Sec${section}_${academicSession}.pdf`);
};
