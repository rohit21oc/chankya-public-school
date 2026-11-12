import assert from 'node:assert/strict';
import { createStudentAdmissionFormPdf, createStaffOnboardingFormPdf, letterheadLines } from '../src/utils/blankFormsPdf';

const settings: any = {
  schoolName: 'Test School', schoolAddress: 'Addr', contactNumber: '1', email: 'a@b.c',
  affiliatedBoard: 'CBSE', affiliationNumber: '1', schoolCode: '1', currentAcademicSession: '2026-2027',
};
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('PASS', name); };

for (const [label, make] of [['student admission', createStudentAdmissionFormPdf], ['staff onboarding', createStaffOnboardingFormPdf]] as const) {
  t(`${label} form is A4 and at most 2 pages`, () => {
    const d = make({ settings });
    assert.ok(d.getNumberOfPages() <= 2, `pages=${d.getNumberOfPages()}`);
    assert.equal(Math.round(d.internal.pageSize.getWidth()), 210);
    assert.equal(Math.round(d.internal.pageSize.getHeight()), 297);
  });
  t(`${label} form builds without a logo and produces a real PDF`, () => {
    const bytes = Buffer.from(make({ settings, logoBase64: null }).output('arraybuffer'));
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.length > 5000);
  });
}
t('letterhead never prints old demo values: they show as Not configured', () => {
  const l = letterheadLines({ schoolAddress: 'Campus-1, Vidya Vihar, Sheohar', email: 'principal@pdsresidential.edu.in', contactNumber: '+91 94312 87650' } as any);
  assert.ok(l.address.includes('Not configured'));
  assert.ok(!l.contact.includes('94312') && !l.contact.includes('pdsresidential'));
  assert.ok(l.contact.includes('Not configured'));
  assert.ok(l.affiliation.includes('Not configured'));
});
t('letterhead follows Settings when they hold real values', () => {
  const l = letterheadLines({ schoolAddress: 'New Road, Sheohar', email: 'new@school.in', footerContacts: ['111', '222'], helplineNumber: '333', affiliationCode: '999' } as any);
  assert.ok(l.address.includes('New Road') && l.contact.includes('111, 222') && l.contact.includes('333') && l.contact.includes('new@school.in') && l.affiliation.includes('999'));
});
console.log(`\n${n} passed`);
