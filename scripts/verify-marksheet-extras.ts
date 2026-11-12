/**
 * Marksheet QR text and marks-submission rules. Run: npx tsx scripts/verify-marksheet-extras.ts
 */
import { buildMarksheet } from '../src/utils/marksheetModel';
import { buildMarksheetQrText, marksheetResultLabel } from '../src/utils/marksheetExtras';
import { dedupeMarks, marksForSubmission } from '../src/utils/marksSubmission';

let failed = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};

const subjects: any[] = [
  { id: 'en', name: 'English', maxMarks: 100 },
  { id: 'ma', name: 'Mathematics', maxMarks: 100 },
];
const student: any = {
  id: 's1', name: 'Rohit Kumar', className: 'Class 2', classId: 'c2', section: 'A', admissionNumber: '64010009',
  rollNumber: '1', registrationNumber: 'CPS2026020009', dob: '2003-12-27', gender: 'Male',
  fatherName: 'Kishori Sahni', motherName: 'Malti Devi',
};
const mk = (subjectId: string, marks: number, extra: any = {}): any => ({ id: `${subjectId}${marks}`, examId: 'e1', studentId: 's1', subjectId, marksObtained: marks, maxMarks: 100, isAbsent: false, ...extra });

const pass = buildMarksheet(subjects, [mk('en', 60), mk('ma', 70)]);
const text = buildMarksheetQrText(student, pass);
check('QR has name, class, admission, roll, registration', /Student Name: ROHIT KUMAR/.test(text) && /Class & Section: Class 2 - A/.test(text) && /Admission No: 64010009/.test(text) && /Roll No: 1/.test(text) && /Registration No: CPS2026020009/.test(text));
check('QR has DOB, gender, parents', /Date of Birth: 2003-12-27/.test(text) && /Gender: MALE/.test(text) && /Father's Name: KISHORI SAHNI/.test(text) && /Mother's Name: MALTI DEVI/.test(text));
check('QR has result, obtained marks, percentage', /Result: PASS/.test(text) && /Obtained Marks: 130 \/ 200/.test(text) && /Percentage: 65\.00%/.test(text));
check('QR has no attendance', !/attendance/i.test(text));
// The school's rule is overall percentage: 33% or more is PASS, below is FAIL.
check('Overall below 33% shows FAIL', marksheetResultLabel(buildMarksheet(subjects, [mk('en', 20), mk('ma', 30)])) === 'FAIL');
check('Overall 33% or more shows PASS', marksheetResultLabel(buildMarksheet(subjects, [mk('en', 0, { isAbsent: true }), mk('ma', 70)])) === 'PASS');
check('Missing subject is INCOMPLETE, never a guessed result', marksheetResultLabel(buildMarksheet(subjects, [mk('en', 60)])) === 'INCOMPLETE');
check('No marks is NOT PUBLISHED', marksheetResultLabel(buildMarksheet(subjects, [])) === 'NOT PUBLISHED');
check('Missing mother/father shows a dash, not "undefined"', !/undefined|null/.test(buildMarksheetQrText({ ...student, fatherName: '', motherName: undefined, parentName: '' }, pass)));

// Submission rows
const other: any = { id: 's2', name: 'Other', classId: 'c10', section: 'B' };
const second: any = { id: 's3', name: 'Second', classId: 'c2', section: 'B' };
const rows: any[] = [
  mk('en', 50),
  mk('en', 80),                                   // same student again: latest wins
  { ...mk('en', 40), id: 'x', studentId: 's2' },  // another class's student
  { ...mk('en', 90), id: 'y', studentId: 's3' },
  { ...mk('ma', 10), id: 'z' },                   // another subject
  { ...mk('en', 10), id: 'w', examId: 'e2' },     // another exam
];
const out = marksForSubmission(rows, [student, second], 'e1', 'en');
check('Only shown students are submitted', out.length === 2 && out.every((m) => m.studentId === 's1' || m.studentId === 's3'));
check('One row per student, latest value wins', out.find((m) => m.studentId === 's1')?.marksObtained === 80);
check('Each row carries the student\'s own class and section', out.find((m) => m.studentId === 's3')?.section === 'B' && out.every((m) => m.classId === 'c2'));
check('Absent can be changed to present with new marks', marksForSubmission([mk('en', 0, { isAbsent: true }), mk('en', 55)], [student], 'e1', 'en')[0].isAbsent === false);
{
  const dup = dedupeMarks([mk('en', 0, { isAbsent: true }), mk('en', 85)]);
  check('Duplicate rows collapse to one (last wins) so screen, edit and save use the same row', dup.length === 1 && dup[0].marksObtained === 85 && !dup[0].isAbsent);
  const single = [mk('en', 40)];
  check('No duplicates leaves the list untouched', dedupeMarks(single) === single);
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll marksheet checks passed.');
