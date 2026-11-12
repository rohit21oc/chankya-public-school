/**
 * File upload / attach / delete rules. Run: npx tsx scripts/verify-file-policy.ts
 */
import { canAttach, canDeleteFile, canUploadToFolder, canWriteSlot, isActiveContentType, isWebsiteFolder } from '../server/services/filePolicy';

let failed = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};

check('No role → no upload', !canUploadToFolder(undefined, 'students/photos'));
check('Teacher cannot upload website media', !canUploadToFolder('TEACHER', 'public-website/hero'));
check('Principal can upload website media', canUploadToFolder('PRINCIPAL', 'public-website/gallery'));
check('school/hero counts as website', isWebsiteFolder('school/hero'));
check('Only settings roles upload the logo', canUploadToFolder('SCHOOL_ADMIN', 'school-logo') && !canUploadToFolder('TEACHER', 'school-logo') && !canUploadToFolder('VICE_PRINCIPAL', 'school-logo'));
check('Teacher can upload homework', canUploadToFolder('TEACHER', 'homework'));

const slot = { uploadedBy: 'u1', isTemporary: true };
check('Uploader writes own open slot', canWriteSlot('u1', slot));
check('Another user cannot write the slot', !canWriteSlot('u2', slot));
check('A finished file cannot be overwritten', !canWriteSlot('u1', { uploadedBy: 'u1', isTemporary: false }));
check('Unknown key cannot be written', !canWriteSlot('u1', null));

const own = { uploadedBy: 't1' };
const legacy = {};
check('Teacher attaches own upload to a student', canAttach({ userId: 't1', role: 'TEACHER' }, { type: 'STUDENT_PHOTO', id: 's1' }, own));
check('Teacher cannot attach someone else’s file', !canAttach({ userId: 't1', role: 'TEACHER' }, { type: 'STUDENT_PHOTO', id: 's1' }, { uploadedBy: 'x' }));
check('Parent cannot attach to a student record', !canAttach({ userId: 'p1', role: 'PARENT' }, { type: 'STUDENT_DOCUMENT', id: 's1' }, { uploadedBy: 'p1' }));
check('Teacher cannot replace the school logo', !canAttach({ userId: 't1', role: 'TEACHER' }, { type: 'SCHOOL_LOGO', id: '' }, own));
check('Admin replaces the school logo', canAttach({ userId: 'a1', role: 'SUPER_ADMIN' }, { type: 'SCHOOL_LOGO', id: '' }, legacy));
check('Staff attaches own photo', canAttach({ userId: 't1', role: 'TEACHER', staffId: 'st1' }, { type: 'STAFF', id: 'st1' }, own));
check('Staff cannot set a colleague’s photo', !canAttach({ userId: 't1', role: 'TEACHER', staffId: 'st1' }, { type: 'STAFF', id: 'st2' }, own));
check('No session → no attach', !canAttach({}, { type: 'STUDENT', id: 's1' }, own));

check('Admin deletes any file', canDeleteFile({ userId: 'a', role: 'SCHOOL_ADMIN' }, legacy));
check('Teacher deletes own upload', canDeleteFile({ userId: 't1', role: 'TEACHER' }, own));
check('Teacher cannot delete others’ files', !canDeleteFile({ userId: 't1', role: 'TEACHER' }, legacy));
check('Parent cannot delete files', !canDeleteFile({ userId: 'p1', role: 'PARENT' }, { uploadedBy: 'p1' }));
check('Vice principal deletes website media', canDeleteFile({ userId: 'v', role: 'VICE_PRINCIPAL' }, { folder: 'public-website/hero' }));

check('HTML is active content', isActiveContentType('text/html; charset=utf-8'));
check('SVG is active content', isActiveContentType('image/svg+xml'));
check('JPEG / PDF are not', !isActiveContentType('image/jpeg') && !isActiveContentType('application/pdf'));

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll file policy checks passed.');
