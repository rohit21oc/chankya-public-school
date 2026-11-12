import {
  audienceLabel,
  canManageNotice,
  canPublishNotices,
  canViewSms,
  countByStatus,
  draftFrom,
  filterNotices,
  formatDay,
  previewText,
  statusOf,
  validateDraft,
} from '../src/utils/noticeRules';

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); } else { failed++; console.log(`  FAIL: ${name} ${detail}`); }
};

console.log('--- Who may do what (same lists as the server) ---');
check('admins and teachers may publish', ['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER'].every(canPublishNotices));
check('accountant, warden, transport, HR, parent, student may not publish', ['ACCOUNTANT', 'HOSTEL_WARDEN', 'TRANSPORT_MANAGER', 'HR_STAFF', 'PARENT', 'STUDENT'].every((r) => !canPublishNotices(r)));
check('accountant may view SMS, warden may not', canViewSms('ACCOUNTANT') && !canViewSms('HOSTEL_WARDEN'));
const mine = { id: 'n1', authorId: 't-1' };
check('admin manages any notice', canManageNotice('PRINCIPAL', 'x', mine));
check('teacher manages own notice', canManageNotice('TEACHER', 't-1', mine));
check("teacher cannot manage another's notice", !canManageNotice('TEACHER', 't-2', mine));
check('teacher cannot manage a notice without an author', !canManageNotice('TEACHER', 't-1', { id: 'n2' }));

console.log('--- Lists ---');
const list = [
  { id: 'a', title: 'Sports day', status: 'PUBLISHED', content: 'Ground' },
  { id: 'b', title: 'Fee notice', status: 'DRAFT', content: 'Pay by 10th' },
  { id: 'c', title: 'Old exam', status: 'EXPIRED', content: '' },
  { id: 'd', title: 'No status', content: 'x' },
];
const c = countByStatus(list);
check('counts by status (missing status counts as published)', c.ALL === 4 && c.PUBLISHED === 2 && c.DRAFT === 1 && c.EXPIRED === 1, JSON.stringify(c));
check('filter by status', filterNotices(list, 'DRAFT', '').map((n) => n.id).join() === 'b');
check('search title and text', filterNotices(list, 'ALL', 'pay').map((n) => n.id).join() === 'b' && filterNotices(list, 'ALL', 'SPORTS').length === 1);
check('unknown status reads as published', statusOf({ id: 'z', status: 'weird' }) === 'PUBLISHED');

console.log('--- Labels ---');
check('audience labels', audienceLabel({ id: '1', targetAudience: 'ALL' }) === 'Everyone' && audienceLabel({ id: '2', targetAudience: 'CLASS', targetClass: 'Class 5', targetSection: 'B' }) === 'Class 5 B' && audienceLabel({ id: '3', targetAudience: 'INDIVIDUAL', targetStudentIds: ['a'] }) === '1 student');
check('date format', formatDay('2026-10-21') === '21 Oct 2026' && formatDay('') === '');
check('preview drops decorative runs', previewText('EXAM ========== Schedule') === 'EXAM Schedule');

console.log('--- Form checks (same rules as the server) ---');
const today = '2026-10-21';
const ok = { ...draftFrom(null), title: 'T', content: 'Body' };
check('valid draft passes', validateDraft(ok, today) === null);
check('empty title refused', validateDraft({ ...ok, title: '  ' }, today) !== null);
check('empty text refused', validateDraft({ ...ok, content: '' }, today) !== null);
check('class audience needs a class', validateDraft({ ...ok, targetAudience: 'CLASS' }, today) !== null && validateDraft({ ...ok, targetAudience: 'CLASS', targetClass: 'Class 1' }, today) === null);
check('bad date format refused', validateDraft({ ...ok, expiryDate: '21/10/2026' }, today) !== null);
check('new past expiry refused', validateDraft({ ...ok, expiryDate: '2026-01-01' }, today) !== null);
check('unchanged old expiry allowed (editing an expired notice)', validateDraft({ ...ok, expiryDate: '2026-01-01' }, today, '2026-01-01') === null);
check('draftFrom keeps a draft a draft', draftFrom({ id: 'x', status: 'DRAFT' }).status === 'DRAFT' && draftFrom({ id: 'y', status: 'EXPIRED' }).status === 'PUBLISHED');

console.log(`\nNOTICE RULES: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
