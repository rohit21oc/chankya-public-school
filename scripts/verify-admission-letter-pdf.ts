/**
 * Admission letter PDF checks (offline): builds letters for real seed students with the school's saved
 * settings, renders the PDF and inspects its text with `pdftotext` (poppler-utils).
 *
 * Usage: npx tsx scripts/verify-admission-letter-pdf.ts [outputDir]
 * Writes the generated PDFs to outputDir (default: a temp folder) so they can be opened and printed.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { buildAdmissionLetterModel, generateAdmissionLetterPdf, admissionLetterPdfBase64, admissionLetterFileName } from '../src/utils/admissionLetter.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'admission-letters-'));
fs.mkdirSync(outDir, { recursive: true });

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function pdfText(file: string): string {
  return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
}

const students: any[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/students.json'), 'utf8'));
const settingsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/schoolSettings.json'), 'utf8'));
const settings = Array.isArray(settingsRaw) ? settingsRaw[0] : settingsRaw;
const feeConfigs: any[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/feeConfigurations.json'), 'utf8'));
const FIXED_NOW = new Date('2026-10-21T06:00:00Z');

const withProfile = students.find((s) => s.feeProfile?.feeHeads?.length && s.parentEmail);
const withoutProfile = students.find((s) => !s.feeProfile?.feeHeads?.length);
const longName = {
  ...(withProfile || students[0]),
  name: 'Aaradhya Vishwakarma Shrivastava Kumari Prasad Narayan Singh',
  fatherName: 'Shri Ramchandra Prasad Vishwakarma Shrivastava',
  address: 'Ward No. 12, Near Old Durga Mandir, Behind Block Development Office Campus',
  city: 'Sheohar',
  state: 'Bihar',
  pincode: '843329',
};

const cases: Array<{ label: string; student: any; settings: any; cfg?: any }> = [];
if (withProfile) cases.push({ label: 'saved-fee-profile', student: withProfile, settings });
if (withoutProfile) {
  const cfg = feeConfigs.find((c) => c.classId === withoutProfile.classId) || null;
  cases.push({ label: 'class-config-only', student: withoutProfile, settings, cfg });
}
cases.push({ label: 'long-text', student: longName, settings });
cases.push({ label: 'no-payment-settings', student: withProfile || students[0], settings: { ...settings, paymentOptions: undefined } });
cases.push({ label: 'no-fees-configured', student: { ...(withoutProfile || students[0]), feeProfile: undefined }, settings, cfg: null });

for (const c of cases) {
  const model = buildAdmissionLetterModel(c.student, c.settings, c.cfg, FIXED_NOW);
  const doc = generateAdmissionLetterPdf(model);
  const file = path.join(outDir, `${c.label}-${admissionLetterFileName(c.student)}`);
  fs.writeFileSync(file, Buffer.from(doc.output('arraybuffer')));
  const bytes = fs.readFileSync(file);
  const txt = pdfText(file);
  const flat = txt.replace(/\s+/g, ' ');
  console.log(`\n== ${c.label} (${path.basename(file)}, ${doc.getNumberOfPages()} page(s), ${bytes.length} bytes)`);

  check('File is a PDF', bytes.subarray(0, 5).toString('latin1') === '%PDF-');
  check('Page size is A4 portrait', Math.round(doc.internal.pageSize.getWidth()) === 210 && Math.round(doc.internal.pageSize.getHeight()) === 297);
  check('Fits on at most two pages', doc.getNumberOfPages() <= 2, `${doc.getNumberOfPages()} pages`);
  check("Shows the student's admission number", flat.includes(String(c.student.admissionNumber)));
  const firstWord = String(c.student.name).split(' ')[0];
  check("Shows the student's name", flat.includes(firstWord));
  check('Shows the class', flat.includes(String(c.student.className)));
  check('Shows the school name', flat.toUpperCase().includes(String(c.settings.schoolName).toUpperCase().split(' ')[0]));
  for (const bad of ['MongoDB', 'PDS123', 'undefined', 'null', 'NaN', 'New Delhi', 'Password: 20', '[object']) {
    check(`Contains no "${bad}"`, !flat.includes(bad));
  }
  if (!c.settings.paymentOptions) {
    check('No bank details when payment settings are missing', !flat.includes('38947291054') && !flat.includes('IFSC'));
  } else {
    check('Bank details come from School Settings', flat.includes(String(c.settings.paymentOptions.accountNumber)));
  }
  if (!model.fees.configured) {
    check('Says the fee structure is not set up', /fee structure for this class has not been set up/i.test(flat));
  } else {
    const firstHead = [...model.fees.oneTime, ...model.fees.monthly, ...model.fees.periodic][0];
    check('Lists the configured fee heads', !!firstHead && flat.includes(firstHead.head.split(' ')[0]));
    const expectedOneTime = model.fees.oneTime.reduce((a, r) => a + r.amount, 0);
    check('One-time total equals the sum of one-time heads', model.fees.totalOneTime === expectedOneTime, `${model.fees.totalOneTime}`);
  }
}

const b64 = admissionLetterPdfBase64(buildAdmissionLetterModel(cases[0].student, settings, null, FIXED_NOW));
check('\nBase64 export decodes to a PDF (email attachment)', Buffer.from(b64, 'base64').subarray(0, 5).toString('latin1') === '%PDF-');

console.log(`\nPDFs written to: ${outDir}`);
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll admission letter checks passed.');
process.exit(failures ? 1 : 0);
