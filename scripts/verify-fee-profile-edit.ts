/** Checks for src/utils/feeProfileEdit.ts (Edit Student → Fee structure). Run: npx tsx scripts/verify-fee-profile-edit.ts */
import { buildDefaultFeeHeads, feeProfileTotals, newlyBillableHeads, normalizeFeeHeads, isMonthlyHead } from '../src/utils/feeProfileEdit';

let failures = 0;
const check = (name: string, ok: boolean, info = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !info ? '' : `  (${info})`}`);
};

const base = buildDefaultFeeHeads({ admissionFee: 5000, monthlySchoolFee: 1800, examFee: 1000, dressCodeFee: 2200, booksFee: 1500, idCardFee: 200 }, {});
check('defaults: admission heads present, transport/hostel off', base.some((h) => h.head === 'Admission Fee' && h.selected) && base.filter((h) => /Transport|Hostel/.test(h.head)).every((h) => !h.selected));
const t0 = feeProfileTotals(base);
check('totals: monthly 1,800; one-time 5,000+2,200+200+1,500 books = 8,900; yearly exam 1,000', t0.totalMonthlyFee === 1800 && t0.totalOneTimeFee === 8900 && t0.totalYearlyFee === 1000, JSON.stringify(t0));

const withCustom = [
  ...base,
  { id: 'c1', head: 'Annual Function', category: 'ONE_TIME', frequency: 'One Time', amount: 500, selected: true },
  { id: 'c2', head: 'Coaching', category: 'MONTHLY', frequency: 'Monthly', amount: 300, selected: true },
  { id: 'c3', head: 'Picnic', category: 'YEARLY', frequency: 'Yearly', amount: 700, selected: true },
] as any;
const bill = newlyBillableHeads(base, normalizeFeeHeads(withCustom));
check('new one-time + yearly custom heads are billed now; monthly one is not', bill.length === 2 && bill.map((b) => b.head).join() === 'Annual Function,Picnic', JSON.stringify(bill));
check('saving the same structure again bills nothing', newlyBillableHeads(normalizeFeeHeads(withCustom), normalizeFeeHeads(withCustom)).length === 0);
const raised = normalizeFeeHeads(withCustom).map((h) => (h.head === 'Annual Function' ? { ...h, amount: 900 } : h));
check('amount change on a head already on is not billed again', newlyBillableHeads(normalizeFeeHeads(withCustom), raised).length === 0);
const switchedOn = normalizeFeeHeads(base).map((h) => (h.head === 'Medical / Health Care' ? { ...h, selected: true } : h));
check('switching on an existing yearly head (Medical) bills it once', newlyBillableHeads(base, switchedOn).map((b) => b.head).join() === 'Medical / Health Care');
const examBooksFacility = normalizeFeeHeads(base).map((h) => (/Exam|Books|Late|Transport|Hostel|Mess/.test(h.head) ? { ...h, selected: true, amount: 999 } : h));
check('exam, books, late fee, transport, hostel, mess never billed by an edit', newlyBillableHeads(normalizeFeeHeads(base).map((h) => ({ ...h, selected: false })), examBooksFacility).every((b) => !/Exam|Books|Late|Transport|Hostel|Mess/.test(b.head)));
check('monthly test matches the bill (Tuition by name)', isMonthlyHead({ head: 'Tuition extra', category: 'OTHER', frequency: 'Yearly' }));
const dirty = normalizeFeeHeads([{ head: '  Lab  fee ', amount: '-5' }, { head: '' }, { head: 'X', amount: 1e12, category: 'BAD', frequency: 'BAD' }, null]);
check('normalize: trims, drops empty names, clamps amounts, fixes unknown category / frequency', dirty.length === 2 && dirty[0].head === 'Lab fee' && dirty[0].amount === 0 && dirty[1].amount === 10_000_000 && dirty[1].category === 'OTHER' && dirty[1].frequency === 'Yearly');
const t1 = feeProfileTotals(normalizeFeeHeads(withCustom));
check('totals with custom: monthly 2,100; one-time 9,400; yearly 1,700', t1.totalMonthlyFee === 2100 && t1.totalOneTimeFee === 9400 && t1.totalYearlyFee === 1700, JSON.stringify(t1));

// Student without a fee structure: the class defaults are the "before" (admission charges already billed).
const setUp = normalizeFeeHeads([...base, { id: 'c9', head: 'Annual Function', category: 'ONE_TIME', frequency: 'One Time', amount: 500, selected: true }]);
check('no structure before: class defaults not billed again, only the custom fee', newlyBillableHeads(base, setUp).map((b) => b.head).join() === 'Annual Function');

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll fee profile edit checks passed.');
process.exit(failures ? 1 : 0);
