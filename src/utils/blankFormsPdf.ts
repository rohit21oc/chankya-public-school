import { jsPDF } from 'jspdf';
import type { SchoolSettings } from '../types';

/**
 * Blank, printable paper forms (A4 portrait, 2 pages each):
 *  - Student Admission Form
 *  - Staff Onboarding Form
 * The fields mirror what the ERP asks when a student is admitted / a staff member is added, so the
 * office can type the filled form straight into the system. Layout is drawn with jsPDF only (no DOM),
 * so the file is identical on every device and prints cleanly in black & white.
 */

type RGB = [number, number, number];
const NAVY: RGB = [11, 31, 75];
const GOLD: RGB = [176, 133, 36];
const INK: RGB = [15, 23, 42];
const GREY: RGB = [51, 65, 85]; // darker than before so labels print clearly
const LINE: RGB = [100, 116, 139];
const SOFT: RGB = [241, 245, 249];

const PAGE_W = 210;
const PAGE_H = 297;
const MX = 10;
const W = PAGE_W - MX * 2;
const FOOTER_Y = PAGE_H - 7;
const BOTTOM = PAGE_H - 12;

const NOT_SET = 'Not configured';
/** Old demo values that must never be printed as if they were the school's details. */
const isPlaceholder = (v?: string) => !v || /vidya vihar|pdsresidential\.edu\.in|94312|campus-1/i.test(v);

/**
 * Header lines for the letterhead, from saved School Settings only. A missing value
 * (or an old demo value still saved) prints as "Not configured" so it gets fixed in
 * Settings instead of being silently replaced.
 */
export function letterheadLines(s: Partial<SchoolSettings>): { affiliation: string; address: string; contact: string } {
  const address = !isPlaceholder(s.schoolAddress) ? String(s.schoolAddress) : NOT_SET;
  const phones = (Array.isArray(s.footerContacts) && s.footerContacts.length ? s.footerContacts : [s.contactNumber]).map((p) => String(p || '').trim()).filter((p) => p && !isPlaceholder(p));
  const email = !isPlaceholder(s.email) ? String(s.email) : '';
  const helpline = s.helplineNumber || '';
  const code = s.affiliationCode || s.affiliationNumber || '';
  const plus = s.plusCode ? String(s.plusCode).split(' ')[0] : '';
  const board = s.affiliatedBoard ? `${s.affiliatedBoard} ` : '';
  return {
    affiliation: code ? `${board}Affiliation Code: ${code}` : `Affiliation: ${NOT_SET}`,
    address: plus && address !== NOT_SET ? `${address}  (Plus Code: ${plus})` : address,
    contact: ['Contact: ' + (phones.join(', ') || NOT_SET), helpline ? `Helpline: ${helpline}` : '', email].filter(Boolean).join('  |  '),
  };
}

export interface BlankFormMeta {
  settings: Pick<
    SchoolSettings,
    'schoolName' | 'schoolAddress' | 'contactNumber' | 'email' | 'affiliatedBoard' | 'affiliationNumber' | 'schoolCode' | 'currentAcademicSession'
  > & Partial<SchoolSettings>;
  /** Raster (PNG/JPEG) data URL of the school crest. Optional: the header simply has no logo without it. */
  logoBase64?: string | null;
}

interface Cell {
  label: string;
  /** Relative width inside the row. */
  w: number;
  kind?: 'text' | 'digits' | 'date' | 'choices';
  /** Number of single-character boxes for kind = 'digits'. */
  n?: number;
  options?: string[];
  /** Printed (not fillable) hint text inside the box, e.g. "Class 5". */
  hint?: string;
}

class Painter {
  readonly doc: jsPDF;
  y = 0;
  constructor(private readonly meta: BlankFormMeta, private readonly title: string, private readonly code: string, private readonly compact = false) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    this.header();
  }

  private color(c: RGB, kind: 'draw' | 'fill' | 'text') {
    if (kind === 'draw') this.doc.setDrawColor(c[0], c[1], c[2]);
    else if (kind === 'fill') this.doc.setFillColor(c[0], c[1], c[2]);
    else this.doc.setTextColor(c[0], c[1], c[2]);
  }

  /** Letterhead + form title. Returns nothing; sets this.y below the header. */
  private header() {
    const d = this.doc;
    const s = this.meta.settings;
    let y = 9;
    // Outer double rule
    this.color(NAVY, 'draw');
    d.setLineWidth(0.7);
    d.line(MX, y, PAGE_W - MX, y);
    y += 2.5;

    let logoW = 0;
    if (this.meta.logoBase64) {
      try {
        const p = d.getImageProperties(this.meta.logoBase64);
        const h = 19;
        logoW = Math.min(26, (p.width / p.height) * h);
        d.addImage(this.meta.logoBase64, p.fileType || 'PNG', MX, y, logoW, h, undefined, 'FAST');
      } catch {
        logoW = 0;
      }
    }
    const cx = MX + W / 2 + (logoW ? logoW / 2 : 0);
    const maxW = W - (logoW ? logoW + 4 : 0) - 2;
    this.color(NAVY, 'text');
    d.setFont('helvetica', 'bold');
    d.setFontSize(15);
    d.text((s.schoolName || 'School').toUpperCase(), cx, y + 6, { align: 'center', maxWidth: maxW });
    d.setFont('helvetica', 'bold');
    d.setFontSize(8.4);
    this.color(GREY, 'text');
    const lh = letterheadLines(s);
    d.text(lh.affiliation, cx, y + 10.4, { align: 'center', maxWidth: maxW });
    d.text(lh.address, cx, y + 14.1, { align: 'center', maxWidth: maxW });
    d.text(lh.contact, cx, y + 17.8, { align: 'center', maxWidth: maxW });
    y += 23;

    this.color(NAVY, 'draw');
    d.setLineWidth(0.7);
    d.line(MX, y, PAGE_W - MX, y);
    y += 2.2;

    // Title bar
    this.color(NAVY, 'fill');
    d.rect(MX, y, W, 7.5, 'F');
    this.color([255, 255, 255], 'text');
    d.setFont('helvetica', 'bold');
    d.setFontSize(11.5);
    d.text(this.title, MX + 3, y + 5.2);
    d.setFontSize(8.5);
    d.text(`Academic Session: ${s.currentAcademicSession || '________'}`, PAGE_W - MX - 3, y + 5.1, { align: 'right' });
    y += 9.5;

    // Form no / date line
    d.setFont('helvetica', 'bold');
    d.setFontSize(9);
    this.color(INK, 'text');
    d.text('Form No.', MX, y + 3);
    this.color(LINE, 'draw');
    d.setLineWidth(0.25);
    d.line(MX + 14, y + 3.4, MX + 52, y + 3.4);
    d.text('Date', PAGE_W - MX - 52, y + 3);
    d.line(PAGE_W - MX - 44, y + 3.4, PAGE_W - MX, y + 3.4);
    this.color(GREY, 'text');
    d.setFontSize(7.8);
    d.text('Use BLOCK LETTERS with a black / blue pen.   * = required', PAGE_W / 2, y + 3, { align: 'center' });
    this.y = y + 6.5;
  }

  ensure(h: number) {
    if (this.y + h <= BOTTOM) return;
    this.doc.addPage('a4', 'portrait');
    this.y = 12;
    // Slim running head on continuation pages
    this.color(GREY, 'text');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.text(`${this.meta.settings.schoolName || ''} - ${this.title}`, MX, this.y);
    this.color(LINE, 'draw');
    this.doc.setLineWidth(0.3);
    this.doc.line(MX, this.y + 1.5, PAGE_W - MX, this.y + 1.5);
    this.y += 5;
  }

  section(title: string, keepWith = 22) {
    this.ensure(7 + keepWith);
    const d = this.doc;
    this.color(SOFT, 'fill');
    this.color(NAVY, 'draw');
    d.setLineWidth(0.3);
    d.rect(MX, this.y, W, 6, 'FD');
    this.color(GOLD, 'fill');
    d.rect(MX, this.y, 2, 6, 'F');
    this.color(NAVY, 'text');
    d.setFont('helvetica', 'bold');
    d.setFontSize(9.6);
    d.text(title.toUpperCase(), MX + 4.5, this.y + 4.2);
    this.y += 7.5;
  }

  gap(h = 2) {
    this.y += h;
  }

  /** One row of cells laid out left-to-right inside [x, x + width]. */
  row(cells: Cell[], opts: { h?: number; x?: number; width?: number } = {}) {
    const h = opts.h !== undefined ? (this.compact ? opts.h * 0.9 : opts.h) : this.compact ? 9.4 : 10.5;
    const x0 = opts.x ?? MX;
    const width = opts.width ?? W;
    this.ensure(h);
    const total = cells.reduce((a, c) => a + c.w, 0);
    let x = x0;
    for (const c of cells) {
      const w = (c.w / total) * width;
      this.cell(c, x, this.y, w, h);
      x += w;
    }
    this.y += h;
  }

  private cell(c: Cell, x: number, y: number, w: number, h: number) {
    const d = this.doc;
    this.color(LINE, 'draw');
    d.setLineWidth(0.25);
    d.rect(x, y, w, h);
    this.color(INK, 'text');
    d.setFont('helvetica', 'bold');
    let ls = 7.6;
    d.setFontSize(ls);
    while (d.getTextWidth(c.label) > w - 2.4 && ls > 5.8) {
      ls -= 0.2;
      d.setFontSize(ls);
    }
    d.text(c.label, x + 1.2, y + 3, { maxWidth: w - 2 });

    const kind = c.kind || 'text';
    if (kind === 'text') {
      if (c.hint) {
        this.color([148, 163, 184], 'text');
        d.setFontSize(8.2);
        d.text(c.hint, x + 1.5, y + h - 2);
      }
      return;
    }
    if (kind === 'digits') {
      const n = c.n || 10;
      const bw = Math.min(6.2, (w - 3) / n);
      const bh = Math.min(5.6, h - 5);
      const by = y + h - bh - 1.2;
      this.color(LINE, 'draw');
      for (let i = 0; i < n; i++) d.rect(x + 1.5 + i * bw, by, bw, bh);
      return;
    }
    if (kind === 'date') {
      const bw = 4.6;
      const bh = Math.min(5.6, h - 5);
      const by = y + h - bh - 1.2;
      let bx = x + 1.5;
      const hints = ['D', 'D', 'M', 'M', 'Y', 'Y', 'Y', 'Y'];
      let k = 0;
      [2, 2, 4].forEach((g, gi) => {
        for (let i = 0; i < g; i++) {
          this.color(LINE, 'draw');
          d.rect(bx, by, bw, bh);
          this.color([148, 163, 184], 'text');
          d.setFontSize(6);
          d.text(hints[k++], bx + bw / 2, by + bh / 2 + 0.9, { align: 'center' });
          bx += bw;
        }
        if (gi < 2) {
          this.color(GREY, 'text');
          d.setFontSize(9);
          d.text('/', bx + 1.2, by + bh - 1);
          bx += 2.4;
        }
      });
      return;
    }
    // choices: tick squares followed by option text
    const opts = c.options || [];
    let size = 8.4;
    const need = (sz: number) => {
      d.setFontSize(sz);
      return opts.reduce((a, o) => a + 3 + 1.4 + d.getTextWidth(o) + 3.2, 0);
    };
    while (need(size) > w - 2 && size > 5.8) size -= 0.3;
    d.setFontSize(size);
    d.setFont('helvetica', 'bold');
    this.color(INK, 'text');
    let ox = x + 1.5;
    const oy = y + h - 2.1;
    for (const o of opts) {
      this.color(INK, 'draw');
      d.setLineWidth(0.3);
      d.rect(ox, oy - 2.6, 3, 3);
      ox += 3 + 1.4;
      this.color(INK, 'text');
      d.text(o, ox, oy);
      ox += d.getTextWidth(o) + 3.2;
    }
  }

  /** Photograph box on the right, spanning `h` mm from the current y. */
  photoBox(h: number, label = 'Affix recent passport size colour photograph') {
    const d = this.doc;
    const w = 32;
    const x = PAGE_W - MX - w;
    this.color(LINE, 'draw');
    d.setLineWidth(0.3);
    d.rect(x, this.y, w, h);
    this.color(GREY, 'text');
    d.setFont('helvetica', 'bold');
    d.setFontSize(7.4);
    const lines = d.splitTextToSize(label, w - 6) as string[];
    const ty = this.y + h / 2 - (lines.length * 3) / 2 + 2;
    d.text(lines, x + w / 2, ty, { align: 'center' });
  }

  /** Checklist table: # | document | Enclosed | Original seen. */
  checklist(items: string[]) {
    const d = this.doc;
    const rowH = this.compact ? 5.3 : 6.2;
    const cols = { num: 8, doc: W - 8 - 24 - 24, a: 24, b: 24 };
    this.ensure(rowH * 2);
    // header
    this.color(SOFT, 'fill');
    this.color(LINE, 'draw');
    d.setLineWidth(0.25);
    d.rect(MX, this.y, W, 5.6, 'FD');
    this.color(INK, 'text');
    d.setFont('helvetica', 'bold');
    d.setFontSize(8.2);
    d.text('#', MX + cols.num / 2, this.y + 3.9, { align: 'center' });
    d.text('Document', MX + cols.num + 2, this.y + 3.9);
    d.text('Enclosed', MX + cols.num + cols.doc + cols.a / 2, this.y + 3.9, { align: 'center' });
    d.text('Original seen', MX + cols.num + cols.doc + cols.a + cols.b / 2, this.y + 3.9, { align: 'center' });
    this.y += 5.6;
    items.forEach((t, i) => {
      this.ensure(rowH);
      this.color(LINE, 'draw');
      d.rect(MX, this.y, W, rowH);
      d.line(MX + cols.num, this.y, MX + cols.num, this.y + rowH);
      d.line(MX + cols.num + cols.doc, this.y, MX + cols.num + cols.doc, this.y + rowH);
      d.line(MX + cols.num + cols.doc + cols.a, this.y, MX + cols.num + cols.doc + cols.a, this.y + rowH);
      this.color(INK, 'text');
      d.setFont('helvetica', 'bold');
      let ts = 8.6;
      d.setFontSize(ts);
      while (d.getTextWidth(t) > cols.doc - 4 && ts > 6.4) {
        ts -= 0.2;
        d.setFontSize(ts);
      }
      d.text(String(i + 1), MX + cols.num / 2, this.y + 4.2, { align: 'center' });
      d.text(t, MX + cols.num + 2, this.y + 4.2, { maxWidth: cols.doc - 4 });
      this.color(INK, 'draw');
      d.setLineWidth(0.3);
      d.rect(MX + cols.num + cols.doc + cols.a / 2 - 1.6, this.y + 1.6, 3.2, 3.2);
      d.rect(MX + cols.num + cols.doc + cols.a + cols.b / 2 - 1.6, this.y + 1.6, 3.2, 3.2);
      d.setLineWidth(0.25);
      this.y += rowH;
    });
  }

  paragraph(text: string, size = 8.8) {
    const d = this.doc;
    d.setFont('helvetica', 'bold');
    d.setFontSize(size);
    this.color(INK, 'text');
    const lines = d.splitTextToSize(text, W - 2) as string[];
    const h = lines.length * (size * 0.42 + 0.9) + 1;
    this.ensure(h);
    d.text(lines, MX + 1, this.y + 3.2, { lineHeightFactor: 1.25 });
    this.y += h + 1;
  }

  /** Signature line blocks laid out evenly across the page. */
  signatures(labels: string[], h = 16) {
    this.ensure(h + 2);
    const d = this.doc;
    const gap = 6;
    const w = (W - gap * (labels.length - 1)) / labels.length;
    labels.forEach((l, i) => {
      const x = MX + i * (w + gap);
      this.color(INK, 'draw');
      d.setLineWidth(0.3);
      d.line(x, this.y + h - 5, x + w, this.y + h - 5);
      this.color(GREY, 'text');
      d.setFont('helvetica', 'bold');
      d.setFontSize(8.2);
      d.text(l, x + w / 2, this.y + h - 1.6, { align: 'center', maxWidth: w });
    });
    this.y += h;
  }

  /** Greyed block for the school office. Rows are drawn by the caller between begin() and end(). */
  officeBox(draw: () => void, h: number) {
    this.ensure(h + 8);
    const d = this.doc;
    d.setLineDashPattern([1.6, 1.2], 0);
    this.color(GREY, 'draw');
    d.setLineWidth(0.4);
    d.rect(MX - 1, this.y - 0.5, W + 2, h + 8);
    d.setLineDashPattern([], 0);
    this.color(GREY, 'text');
    d.setFont('helvetica', 'bold');
    d.setFontSize(9);
    d.text('FOR OFFICE USE ONLY', MX + 2, this.y + 3.6);
    this.y += 6;
    draw();
    this.y += 1.5;
  }

  finish(): jsPDF {
    const d = this.doc;
    const total = d.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      d.setPage(p);
      this.color(LINE, 'draw');
      d.setLineWidth(0.25);
      d.line(MX, FOOTER_Y - 2.5, PAGE_W - MX, FOOTER_Y - 2.5);
      this.color(GREY, 'text');
      d.setFont('helvetica', 'bold');
      d.setFontSize(7.6);
      d.text(`${this.meta.settings.schoolName || ''}  |  ${this.code}`, MX, FOOTER_Y);
      d.text(`Page ${p} of ${total}`, PAGE_W - MX, FOOTER_Y, { align: 'right' });
    }
    return d;
  }
}

const YES_NO = ['Yes', 'No'];
const GENDER = ['Male', 'Female', 'Other'];

/* -------------------------------------------------------------------------- */
/*  Student admission form                                                      */
/* -------------------------------------------------------------------------- */
export function createStudentAdmissionFormPdf(meta: BlankFormMeta): jsPDF {
  const p = new Painter(meta, 'STUDENT ADMISSION FORM', 'Student Admission Form');
  const photoW = 32 + 3;

  p.section('A. Student details', 50);
  const topY = p.y;
  p.row([{ label: 'First name *', w: 1 }, { label: 'Middle name', w: 1 }, { label: 'Last name *', w: 1 }], { width: W - photoW });
  p.row([{ label: 'Date of birth *', w: 1.05, kind: 'date' }, { label: 'Gender', w: 1.05, kind: 'choices', options: GENDER }, { label: 'Blood group', w: 0.7 }], { width: W - photoW });
  p.row([{ label: 'Aadhaar number (12 digits)', w: 1, kind: 'digits', n: 12 }], { width: W - photoW });
  p.row([{ label: 'Social category', w: 1, kind: 'choices', options: ['General', 'OBC', 'SC', 'ST', 'EWS'] }], { width: W - photoW });
  const bottomY = p.y;
  p.y = topY;
  p.photoBox(bottomY - topY);
  p.y = bottomY;
  p.row([{ label: 'Religion *', w: 1 }, { label: 'Visible identification mark', w: 1.8 }]);
  p.row([{ label: "Student's mobile (if any)", w: 1, kind: 'digits', n: 10 }, { label: "Student's e-mail (if any)", w: 1 }]);
  p.gap();

  p.section('B. Parent / guardian details', 52);
  p.paragraph('Give at least one of father / mother / guardian name and one 10-digit mobile number. Father\'s occupation is required.', 8);
  p.row([{ label: "Father's full name", w: 1.55 }, { label: "Father's occupation *", w: 0.95 }, { label: 'Mobile number *', w: 1.3, kind: 'digits', n: 10 }]);
  p.row([{ label: "Mother's full name", w: 1.55 }, { label: "Mother's occupation", w: 0.95 }, { label: 'Mobile number', w: 1.3, kind: 'digits', n: 10 }]);
  p.row([{ label: 'Local guardian name (if applicable)', w: 1.55 }, { label: 'Relationship', w: 0.95 }, { label: 'Mobile number', w: 1.3, kind: 'digits', n: 10 }]);
  p.row([{ label: 'Parent / guardian e-mail', w: 1 }, { label: 'Emergency contact - name', w: 1 }]);
  p.row([{ label: 'Emergency contact - relationship', w: 1 }, { label: 'Emergency contact - mobile number', w: 1.5, kind: 'digits', n: 10 }]);
  p.gap();

  p.section('C. Residential address', 38);
  p.row([{ label: 'Full address (house / village / post office / police station) *', w: 1 }], { h: 15 });
  p.row([{ label: 'State *', w: 1 }, { label: 'District / city *', w: 1.3 }, { label: 'PIN code *', w: 1.2, kind: 'digits', n: 6 }]);
  p.gap();

  p.section('D. Admission & previous education', 38);
  p.row([
    { label: 'Admission sought in class *', w: 1.25 },
    { label: 'Section * (office)', w: 0.8 },
    { label: 'Date of admission / enrolment *', w: 1.7, kind: 'date' },
  ]);
  p.row([{ label: 'Previous school name', w: 2 }, { label: 'Previous class', w: 0.9 }, { label: 'Marks / % / division', w: 1.1 }]);
  p.row([
    { label: 'Previous class passed? *', w: 1.1, kind: 'choices', options: YES_NO },
    { label: 'Transfer Certificate (TC) no. & date', w: 1.5 },
    { label: 'Board of previous school', w: 1.1 },
  ]);
  p.gap();

  p.section('E. Facilities required', 22);
  p.row([
    { label: 'School transport required?', w: 1.15, kind: 'choices', options: YES_NO },
    { label: 'If yes: route / pick-up and drop point (village / stop)', w: 2 },
  ]);
  p.row([
    { label: 'Hostel (residential) required?', w: 1.15, kind: 'choices', options: YES_NO },
    { label: 'If yes: room / bed (office).   Medical conditions / allergies to note', w: 2 },
  ]);
  p.gap();

  p.section('F. Documents submitted', 60);
  p.checklist([
    'Birth certificate / date-of-birth proof',
    'Transfer Certificate (TC) from previous school',
    'Previous class report card / marksheet',
    "Student's Aadhaar card (copy)",
    "Parent's / guardian's Aadhaar card (copy)",
    'Passport size photographs of the student (4)',
    'Address proof (copy)',
    'Caste / category certificate (SC / ST / OBC / EWS only)',
    'Medical / vaccination record (needed for hostel)',
    'Other: ______________________________________',
  ]);
  p.gap(3);

  p.section('G. Declaration by parent / guardian', 40);
  p.paragraph(
    'I declare that the information given in this form is true and complete to the best of my knowledge and that the documents attached are genuine. ' +
      'I agree to follow the rules of the school and to pay the fees on or before the due dates. I understand that admission is provisional until the documents are verified and that false information may lead to cancellation of admission.'
  );
  p.signatures(["Father's / guardian's signature", "Mother's signature", 'Date', 'Place']);
  p.gap(3);

  p.officeBox(() => {
    p.row([
      { label: 'Admission no.', w: 1 },
      { label: 'Registration no.', w: 1 },
      { label: 'Roll no.', w: 0.7 },
      { label: 'Class & section allotted', w: 1.2 },
    ], { h: 9.5 });
    p.row([
      { label: 'Fee category / concession', w: 1.3 },
      { label: 'Amount received', w: 1 },
      { label: 'Receipt no. & date', w: 1.3 },
    ], { h: 9.5 });
    p.row([{ label: 'Documents verified by', w: 1 }, { label: 'Remarks', w: 2 }], { h: 9.5 });
    p.gap(1);
    p.signatures(['Admission in-charge', 'Accountant', 'Principal'], 13);
  }, 52);

  return p.finish();
}

/* -------------------------------------------------------------------------- */
/*  Staff onboarding form                                                       */
/* -------------------------------------------------------------------------- */
export function createStaffOnboardingFormPdf(meta: BlankFormMeta): jsPDF {
  const p = new Painter(meta, 'STAFF ONBOARDING FORM', 'Staff Onboarding Form', true);
  const photoW = 32 + 3;

  p.section('A. Personal details', 50);
  const topY = p.y;
  p.row([{ label: 'Full name (as per Aadhaar) *', w: 1 }], { width: W - photoW });
  p.row([{ label: "Father's / mother's name", w: 1 }, { label: 'Alternate mobile number', w: 1 }], { width: W - photoW });
  p.row([{ label: 'Date of birth', w: 1.05, kind: 'date' }, { label: 'Gender', w: 1.05, kind: 'choices', options: GENDER }, { label: 'Blood group', w: 0.7 }], { width: W - photoW });
  p.row([{ label: 'Aadhaar number (12 digits) - also attach as ID proof', w: 1, kind: 'digits', n: 12 }], { width: W - photoW });
  const bottomY = p.y;
  p.y = topY;
  p.photoBox(bottomY - topY);
  p.y = bottomY;
  p.row([
    { label: 'Marital status', w: 1.4, kind: 'choices', options: ['Single', 'Married', 'Other'] },
    { label: 'PAN number', w: 1.4, kind: 'digits', n: 10 },
  ]);
  p.row([{ label: 'Mobile number * (10 digits)', w: 1, kind: 'digits', n: 10 }, { label: 'E-mail address', w: 1 }]);
  p.gap();

  p.section('B. Address', 52);
  p.row([{ label: 'Permanent / residential address *', w: 1 }], { h: 14 });
  p.row([{ label: 'State', w: 1 }, { label: 'District / city', w: 1.3 }, { label: 'PIN code * (6 digits)', w: 1.2, kind: 'digits', n: 6 }]);
  p.row([{ label: 'Current address (required if not same as permanent)', w: 1.6 }, { label: 'Same as permanent?', w: 1, kind: 'choices', options: YES_NO }], { h: 14 });
  p.row([{ label: 'State', w: 1 }, { label: 'District / city', w: 1.3 }, { label: 'PIN code', w: 1.2, kind: 'digits', n: 6 }]);
  p.gap();

  p.section('C. Qualification & experience', 52);
  p.row([{ label: 'Highest qualification', w: 1.2 }, { label: 'University / board', w: 1.2 }, { label: 'Year of passing', w: 0.8 }]);
  p.row([{ label: 'Other qualifications / certifications (B.Ed, D.El.Ed, TET / CTET, computer etc.)', w: 1 }], { h: 13 });
  p.row([{ label: 'Total experience (years)', w: 0.9 }, { label: 'Last school / organisation', w: 1.6 }, { label: 'Last designation', w: 1.1 }]);
  p.gap();

  p.section('D. Job details', 48);
  p.row([{ label: 'Designation *', w: 1.2 }, { label: 'Date of joining', w: 1.7, kind: 'date' }, { label: 'Staff type', w: 1.7, kind: 'choices', options: ['Teaching', 'Non-teaching'] }]);
  p.row([{ label: 'Department', w: 1, kind: 'choices', options: ['Academics', 'Administration', 'Accounts', 'Hostel', 'Transport', 'Sports', 'Other'] }]);
  p.row([{ label: 'Employment type', w: 1, kind: 'choices', options: ['Full time', 'Part time', 'Contract', 'Probation', 'Visiting'] }]);
  p.row([{ label: 'Subjects taught / expertise (teaching staff)', w: 1.3 }, { label: 'Classes qualified to teach', w: 1 }]);
  p.gap();

  p.section('E. Bank & statutory details (for salary)', 40);
  p.row([{ label: 'Account holder name', w: 1 }, { label: 'Bank name', w: 1 }]);
  p.row([{ label: 'Account number', w: 1.2 }, { label: 'IFSC code', w: 1, kind: 'digits', n: 11 }]);
  p.row([{ label: 'Branch', w: 1 }, { label: 'UAN (PF) number, if any', w: 1, kind: 'digits', n: 12 }]);
  p.gap();

  p.section('F. Emergency contact', 24);
  p.row([{ label: 'Name', w: 1.4 }, { label: 'Relationship', w: 0.9 }, { label: 'Mobile number', w: 1.4, kind: 'digits', n: 10 }]);
  p.gap();

  p.section('G. Documents submitted', 60);
  p.checklist([
    'Aadhaar card / ID proof (copy)',
    'Educational / qualification certificates and marksheets',
    'B.Ed / D.El.Ed / TET / CTET certificate (teaching staff)',
    'Experience certificate / relieving letter from last employer',
    'Resume / curriculum vitae',
    'PAN card (copy)',
    'Passport size photographs (2)',
    'Address proof (copy)',
    'Bank passbook first page / cancelled cheque',
    'Police verification / character certificate',
    'Medical fitness certificate (hostel / transport staff)',
    'Driving licence (drivers only)',
  ]);
  p.gap(3);

  p.section('H. Declaration by employee', 38);
  p.paragraph(
    'I declare that the information and documents given by me are true and correct. I will follow the service rules, code of conduct and child-safety policy of the school and will keep student and school information confidential. ' +
      'I understand that appointment is subject to verification of my documents and that false information is a ground for termination.'
  );
  p.signatures(['Signature of employee', 'Date', 'Place'], 13);
  p.gap(3);

  p.officeBox(() => {
    p.row([
      { label: 'Employee ID (PDS____)', w: 1.2 },
      { label: 'Portal role', w: 1.2 },
      { label: 'Reporting to', w: 1.2 },
    ], { h: 9.5 });
    p.row([
      { label: 'Monthly salary * (payroll)', w: 1.3 },
      { label: 'Basic', w: 1 },
      { label: 'Allowances', w: 1 },
      { label: 'Deductions', w: 1 },
    ], { h: 9.5 });
    p.row([{ label: 'Class Incharge (class & section) / assigned classes & subjects', w: 1.6 }, { label: 'Remarks', w: 1.4 }], { h: 9.5 });
    p.gap(1);
    p.signatures(['HR / office in-charge', 'Accountant', 'Principal'], 13);
  }, 52);

  return p.finish();
}

export const BLANK_FORM_FILE_NAMES = {
  student: 'Student-Admission-Form.pdf',
  staff: 'Staff-Onboarding-Form.pdf',
};

/** Browser helper: builds the form (with the school crest when available) and downloads it. */
export async function downloadBlankForm(kind: 'student' | 'staff', settings: BlankFormMeta['settings']): Promise<void> {
  let logoBase64: string | null = null;
  try {
    const { getDocumentImageBase64Async, ensureRasterJpegOrPng } = await import('./documentImageHelper');
    logoBase64 = await ensureRasterJpegOrPng(await getDocumentImageBase64Async(settings.schoolLogo, true));
  } catch {
    logoBase64 = null; // the form is still fully usable without the crest
  }
  const doc = kind === 'student' ? createStudentAdmissionFormPdf({ settings, logoBase64 }) : createStaffOnboardingFormPdf({ settings, logoBase64 });
  doc.save(BLANK_FORM_FILE_NAMES[kind]);
}
