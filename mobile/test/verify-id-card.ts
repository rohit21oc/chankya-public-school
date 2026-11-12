import QRCode from 'qrcode';
import { buildStaffIdCardModel, buildStudentIdCardModel, formatCardDate, NOT_RECORDED, titleCase } from '../src/utils/idCardModel';
import { buildQrMatrix } from '../src/utils/qrMatrix';

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); } else { failed++; console.log(`  FAIL: ${name} ${detail}`); }
};
const row = (rows: { label: string; value: string }[], label: string) => rows.find((r) => r.label === label)?.value;

const settings = {
  schoolName: 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE',
  schoolAddress: 'Kushahar Ward 07, Kushahar, Sheohar, Bihar - 843329',
  affiliationCode: '10034104008',
  principalName: 'Nilam Devi',
  principalSignature: 'school/signature.png',
};
const staffToken = 'CPS1.T.dC0z.abcdefghijklmnopqrstuv';
const rajeev = {
  id: 't-3', name: 'Rajeev Kumar', employeeId: 'CPS0003', designation: 'TGT Science', department: 'ACADEMICS',
  subjectExpertise: ['Social Science', 'Mathematics', 'Hindi'], dob: '1988-04-09', email: 'rajeev@example.org',
  bloodGroup: 'B+', phone: '9817520759', photo: 'staff/rajeev.jpg', password: 'secret-hash', bankAccount: '123',
};

console.log('--- Staff card (same fields as the website card) ---');
const m = buildStaffIdCardModel(rajeev, settings, { name: 'Rajeev Kumar' }, staffToken);
check('kind and title', m.kind === 'STAFF' && m.title === 'FACULTY / STAFF IDENTITY CARD');
check('name, initials, designation', m.name === 'Rajeev Kumar' && m.initials === 'RK' && m.designation === 'TGT Science');
check('front rows: Staff ID, Subject (max two), DOB', row(m.frontRows, 'Staff ID') === 'CPS0003' && row(m.frontRows, 'Subject') === 'Social Science, Mathematics' && row(m.frontRows, 'DOB') === '09/04/1988');
check('back rows: School Name, Department, Mobile, Email', m.backRows.map((r) => r.label).join() === 'School Name,Department,Mobile,Email');
check('department in title case', row(m.backRows, 'Department') === 'Academics');
check('mobile and email are the staff member\'s own', row(m.backRows, 'Mobile') === '9817520759' && row(m.backRows, 'Email') === 'rajeev@example.org');
check('blood group and photo when recorded', m.bloodGroup === 'B+' && m.photoKey === 'staff/rajeev.jpg');
check('signature from school settings', m.signatureKey === 'school/signature.png');
check('QR is exactly the signed server code', m.qrToken === staffToken);
check('no secrets or bank data anywhere in the model', !/secret|bank|"123"/i.test(JSON.stringify(m)));

console.log('--- Missing data is never invented ---');
const bare = buildStaffIdCardModel({ name: 'A Teacher', employeeId: 'CPS0009' }, {}, { name: 'A Teacher' });
check('designation -> Not recorded', bare.designation === NOT_RECORDED);
check('subject, DOB -> Not recorded', row(bare.frontRows, 'Subject') === NOT_RECORDED && row(bare.frontRows, 'DOB') === NOT_RECORDED);
check('department, mobile, email -> Not recorded', ['Department', 'Mobile', 'Email'].every((l) => row(bare.backRows, l) === NOT_RECORDED));
check('no blood group, photo or signature without data', bare.bloodGroup === undefined && bare.photoKey === undefined && bare.signatureKey === undefined);
check('no QR without a server code (never self-made)', bare.qrToken === undefined);
check('missing school details show Not configured (never invented)', bare.schoolName === 'Not configured' && bare.affiliationCode === 'Not configured');

console.log('--- Student card ---');
const stu = {
  id: 'st-3', name: 'Devansh Singhania', admissionNumber: '64010003', className: 'Class 8', section: 'A', rollNumber: 3,
  dob: '2011-02-19', bloodGroup: 'A+', fatherName: 'Rajeev Singhania', parentPhone: '9822334455', address: 'Station Road, Ward No. 8',
};
const s = buildStudentIdCardModel(stu, settings, 'CPS1.S.c3QtMw.abcdefghijklmnopqrstuv');
check('title', s.kind === 'STUDENT' && s.title === 'STUDENT IDENTITY CARD');
check('front rows: Student ID, Class, Section, Roll no, DOB', s.frontRows.map((r) => r.value).join('|') === '64010003|Class 8|A|3|19/02/2011');
check('back rows: School Name, Father\'s Name, Mobile, Address', s.backRows.map((r) => r.label).join() === "School Name,Father's Name,Mobile,Address" && row(s.backRows, 'Mobile') === '9822334455');
check('no designation line on a student card', s.designation === undefined);
const sb = buildStudentIdCardModel({ name: 'X' }, {});
check('student missing values -> Not recorded', [...sb.frontRows, ...sb.backRows.slice(1)].every((r) => r.value === NOT_RECORDED));

console.log('--- Helpers ---');
check('date format', formatCardDate('2007-01-31') === '31/01/2007' && formatCardDate('31-01-2007') === '31-01-2007' && formatCardDate('') === NOT_RECORDED);
check('title case keeps short codes and mixed case', titleCase('ACADEMICS') === 'Academics' && titleCase('IT') === 'IT' && titleCase('Senior Wing') === 'Senior Wing');

console.log('--- QR matrix ---');
const mx = buildQrMatrix(staffToken, 'M');
const ref = QRCode.create(staffToken, { errorCorrectionLevel: 'M' });
const grid = Array.from({ length: mx.count }, () => Array(mx.count).fill(0));
for (const r of mx.runs) for (let c = r.start; c < r.start + r.len; c++) grid[r.row][c] = 1;
let same = true;
for (let r = 0; r < mx.count; r++) for (let c = 0; c < mx.count; c++) if (grid[r][c] !== (ref.modules.data[r * mx.count + c] ? 1 : 0)) same = false;
check('drawn runs reproduce the QR exactly', same);
check('finder pattern top-left, top-right, bottom-left', [[0, 0], [0, mx.count - 7], [mx.count - 7, 0]].every(([r0, c0]) =>
  grid[r0].slice(c0, c0 + 7).every((v) => v === 1) && grid[r0 + 6].slice(c0, c0 + 7).every((v) => v === 1)));
check('runs are merged (far fewer views than modules)', mx.runs.length < (mx.count * mx.count) / 2);

console.log(`\nID CARD: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
