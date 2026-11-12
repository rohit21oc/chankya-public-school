/**
 * Rules for the staff Notices & SMS screen. Mirrors the server (server.ts:
 * requireRole lists, canManageNotice, validateNoticeInput) so the app only
 * offers what the server accepts; the server stays the authority.
 */

export const NOTICE_PUBLISH_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'ADMIN'];
export const NOTICE_MANAGER_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN'];
export const SMS_VIEW_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'TEACHER', 'ACCOUNTANT'];

export type NoticeStatus = 'PUBLISHED' | 'DRAFT' | 'EXPIRED';
export type NoticeFilter = 'ALL' | NoticeStatus;

export interface NoticeLike {
  id: string;
  title?: string;
  content?: string;
  status?: string;
  noticeType?: string;
  category?: string;
  targetAudience?: string;
  targetClass?: string;
  targetSection?: string;
  targetStudentIds?: string[];
  priority?: string;
  publishDate?: string;
  publishedDate?: string;
  date?: string;
  expiryDate?: string;
  authorId?: string;
  publishedBy?: string;
}

export const canPublishNotices = (role?: string) => Boolean(role && NOTICE_PUBLISH_ROLES.includes(role));
export const canViewSms = (role?: string) => Boolean(role && SMS_VIEW_ROLES.includes(role));

/** Admins manage every notice; a teacher manages only the notices they wrote. */
export function canManageNotice(role: string | undefined, userId: string | undefined, n: NoticeLike): boolean {
  if (!role) return false;
  if (NOTICE_MANAGER_ROLES.includes(role)) return true;
  return role === 'TEACHER' && Boolean(n.authorId) && n.authorId === userId;
}

export const statusOf = (n: NoticeLike): NoticeStatus => {
  const s = String(n.status || 'PUBLISHED').toUpperCase();
  return s === 'DRAFT' || s === 'EXPIRED' ? s : 'PUBLISHED';
};

export function countByStatus(list: NoticeLike[]): Record<NoticeFilter, number> {
  const c: Record<NoticeFilter, number> = { ALL: list.length, PUBLISHED: 0, DRAFT: 0, EXPIRED: 0 };
  for (const n of list) c[statusOf(n)]++;
  return c;
}

export function filterNotices(list: NoticeLike[], filter: NoticeFilter, query: string): NoticeLike[] {
  const q = query.trim().toLowerCase();
  return list.filter((n) => (filter === 'ALL' || statusOf(n) === filter) && (!q || `${n.title || ''} ${n.content || ''} ${n.publishedBy || ''}`.toLowerCase().includes(q)));
}

export const CATEGORIES: { value: string; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'ACADEMIC', label: 'Academic' },
  { value: 'EXAM', label: 'Exam' },
  { value: 'RESULT', label: 'Result' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'EVENT', label: 'Event' },
  { value: 'FEE', label: 'Fee' },
  { value: 'FEE_REMINDER', label: 'Fee reminder' },
  { value: 'ADMISSION', label: 'Admission' },
  { value: 'EMERGENCY', label: 'Emergency' },
];
export const AUDIENCES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'STUDENTS', label: 'Students' },
  { value: 'PARENTS', label: 'Parents' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'CLASS', label: 'One class' },
];

export const categoryLabel = (v?: string) => CATEGORIES.find((c) => c.value === String(v || '').toUpperCase())?.label || 'General';

export function audienceLabel(n: NoticeLike): string {
  const a = String(n.targetAudience || 'ALL').toUpperCase();
  if (a === 'CLASS') return [n.targetClass || 'Class', n.targetSection].filter(Boolean).join(' ');
  if (a === 'INDIVIDUAL') {
    const c = n.targetStudentIds?.length || 0;
    return `${c} student${c === 1 ? '' : 's'}`;
  }
  return AUDIENCES.find((x) => x.value === a)?.label || (a === 'PUBLIC' ? 'Public website' : 'Everyone');
}

/** "2026-10-21" -> "21 Oct 2026". */
export function formatDay(v?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  if (!m) return v || '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

export const previewText = (v?: string) => String(v || '').replace(/([=\-_*~#])\1{3,}/g, ' ').replace(/\s+/g, ' ').trim();

export interface NoticeDraft {
  title: string;
  content: string;
  noticeType: string;
  targetAudience: string;
  targetClass: string;
  targetSection: string;
  priority: string;
  status: 'PUBLISHED' | 'DRAFT';
  expiryDate: string;
}

/** Same checks as the server, so mistakes are caught before sending. Returns null when valid. */
export function validateDraft(d: NoticeDraft, today: string, originalExpiry = ''): string | null {
  const title = d.title.trim();
  if (!title) return 'Add a title.';
  if (title.length > 200) return 'The title must be 200 characters or fewer.';
  if (!d.content.trim()) return 'Add the notice text.';
  if (d.content.trim().length > 10000) return 'The notice text must be 10,000 characters or fewer.';
  if (d.targetAudience === 'CLASS' && !d.targetClass) return 'Choose the class.';
  const exp = d.expiryDate.trim();
  if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) return 'Write the expiry date as YYYY-MM-DD.';
  // An unchanged old expiry date is allowed (fixing a typo in an expired notice).
  if (exp && exp < today && exp !== originalExpiry) return 'The expiry date cannot be in the past.';
  return null;
}

export function draftFrom(n?: NoticeLike | null): NoticeDraft {
  return {
    title: n?.title || '',
    content: n?.content || '',
    noticeType: String(n?.noticeType || n?.category || 'GENERAL').toUpperCase(),
    targetAudience: String(n?.targetAudience || 'ALL').toUpperCase(),
    targetClass: n?.targetClass || '',
    targetSection: n?.targetSection || '',
    priority: String(n?.priority || 'NORMAL').toUpperCase(),
    status: statusOf(n || ({} as NoticeLike)) === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    expiryDate: n?.expiryDate || '',
  };
}

/** India calendar date, YYYY-MM-DD. */
export const indiaToday = (now = Date.now()) => new Date(now + 330 * 60000).toISOString().slice(0, 10);

export const SMS_STATUS_LABEL: Record<string, string> = {
  DELIVERED: 'Delivered',
  SENT: 'Sent',
  SUBMITTED: 'Accepted by provider',
  FAILED: 'Failed',
};
