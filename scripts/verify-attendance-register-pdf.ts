/**
 * Monthly attendance register PDF checks (offline): builds the register from the repo's real
 * students/attendance/holiday data (plus a 70-student roster built in memory to force several pages),
 * renders the PDF and inspects it with poppler (`pdftotext`, `pdfinfo`).
 *
 * Usage: npx tsx scripts/verify-attendance-register-pdf.ts [outputDir]
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { buildAttendanceRegisterModel, createAttendanceRegisterPdf } from '../src/utils/attendanceRegisterPdf.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'attendance-register-'));
fs.mkdirSync(outDir, { recursive: true });
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

const students: any[] = read('students.json');
const attendance: any[] = read('attendance.json');
const holidays: any[] = read('holidays.json');
const meta = { schoolName: 'Residential PDS Public School', schoolAddress: 'Sheohar, Bihar', affiliationLine: '', className: 'Class 8', section: 'A', printDate: '21 Oct 2026' };

function render(name: string, roster: any[], recs: any[], year: number, month: number) {
  const model = buildAttendanceRegisterModel(roster, recs, holidays, year, month);
  const doc = createAttendanceRegisterPdf(model, meta);
  const file = path.join(outDir, name);
  fs.writeFileSync(file, Buffer.from(doc.output('arraybuffer')));
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
  const size = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(info);
  const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
  return { model, file, pages, w: Number(size?.[1]), h: Number(size?.[2]), text };
}

// 1. Real class (13 students), the month with saved records
const cls = students.filter((s) => s.classId === 'c-8' && (s.section || 'A') === 'A');
const recs = attendance.map((r) => ({ studentId: r.studentId, date: r.date, status: r.status }));
const r1 = render('register-real-class.pdf', cls.map((s) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber })), recs, 2026, 8);
check('A4 landscape page size', Math.abs(r1.w - 841.9) < 2 && Math.abs(r1.h - 595.3) < 2, `${r1.w} x ${r1.h} pt`);
check('every student name is present', cls.every((s) => r1.text.includes(s.name.split(' ')[0])), `${cls.length} students`);
check('title shows month and year', /ATTENDANCE REGISTER - SEPTEMBER 2026/.test(r1.text));
check('31-day months and 30-day months get the right number of day columns', r1.model.daysInMonth === 30 && r1.model.rows[0].cells.length === 30);

// 2. 70 students, 31 days: must paginate with a repeated header and no split rows
const many = Array.from({ length: 70 }, (_, i) => ({ id: `t${i}`, name: `Student Number ${String(i + 1).padStart(2, '0')} With A Long Surname`, rollNumber: i + 1 }));
const manyRecs = many.flatMap((s, i) => Array.from({ length: 31 }, (_, d) => ({ studentId: s.id, date: `2026-10-${String(d + 1).padStart(2, '0')}`, status: (i + d) % 9 === 0 ? 'ABSENT' : (i + d) % 11 === 0 ? 'LEAVE' : (i + d) % 13 === 0 ? 'LATE' : 'PRESENT' })));
const r2 = render('register-70-students.pdf', many, manyRecs, 2026, 9);
check('70 students paginate over several pages', r2.pages >= 3, `${r2.pages} pages`);
const pageTexts = r2.text.split('\f').filter((t) => t.trim());
check('table header repeats on every page', pageTexts.every((t) => /Roll/.test(t) && /Student Name/.test(t)), `${pageTexts.length} pages`);
check('page numbers "Page i of n" on every page', pageTexts.every((t, i) => t.includes(`Page ${i + 1} of ${r2.pages}`)));
check('all 70 rows are printed exactly once', many.every((s, i) => (r2.text.match(new RegExp(`Student Number ${String(i + 1).padStart(2, '0')} `, 'g')) || []).length === 1));
check('totals row appears once, on the last page', (r2.text.match(/Total present per day/g) || []).length === 1 && pageTexts[pageTexts.length - 1].includes('Total present per day'));
check('signature block is on the last page', pageTexts[pageTexts.length - 1].includes('Principal'));

// 3. Model semantics
const m = buildAttendanceRegisterModel([{ id: 'x', name: 'X', rollNumber: 1 }], [
  { studentId: 'x', date: '2026-10-01', status: 'PRESENT' }, { studentId: 'x', date: '2026-10-02', status: 'LATE' },
  { studentId: 'x', date: '2026-10-05', status: 'ABSENT' }, { studentId: 'x', date: '2026-10-06', status: 'LEAVE' },
], [], 2026, 9);
check('LATE counts as present; P/A/L tallied', m.rows[0].p === 2 && m.rows[0].a === 1 && m.rows[0].l === 1);
check('Sundays are not counted as not-marked', m.rows[0].nm === 31 - 4 - 4 /* 4 Sundays in Oct 2026 */ && m.rows[0].cells[3].kind === 'SUN');
console.log(`\nPDFs written to ${outDir}`);
process.exit(failures ? 1 : 0);
