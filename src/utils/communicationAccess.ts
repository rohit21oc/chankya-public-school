/**
 * Who may do what in Notices & SMS. Mirrors the server checks in server.ts
 * (requireRole lists and canManageNotice) so the screen only offers actions the
 * server will accept. The server remains the authority.
 */
import type { Notice, UserRole } from '../types';

export const NOTICE_PUBLISH_ROLES: UserRole[] = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'ADMIN'] as UserRole[];
export const NOTICE_MANAGER_ROLES: UserRole[] = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN'] as UserRole[];
export const SMS_SEND_ROLES: UserRole[] = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'TEACHER'] as UserRole[];
export const SMS_VIEW_ROLES: UserRole[] = [...SMS_SEND_ROLES, 'ACCOUNTANT' as UserRole];

export const canPublishNotices = (role?: UserRole) => Boolean(role && NOTICE_PUBLISH_ROLES.includes(role));
export const canCleanupNotices = (role?: UserRole) => Boolean(role && NOTICE_MANAGER_ROLES.includes(role));
export const canSendSms = (role?: UserRole) => Boolean(role && SMS_SEND_ROLES.includes(role));
export const canViewSms = (role?: UserRole) => Boolean(role && SMS_VIEW_ROLES.includes(role));

/** Admins manage every notice; teachers manage only notices they created. */
export function canManageNotice(role: UserRole | undefined, userId: string | undefined, notice: Notice): boolean {
  if (!role) return false;
  if (NOTICE_MANAGER_ROLES.includes(role)) return true;
  return role === 'TEACHER' && Boolean(notice.authorId) && notice.authorId === userId;
}

export const NOTICE_CATEGORIES: { value: string; label: string }[] = [
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

export const categoryLabel = (v?: string) => NOTICE_CATEGORIES.find((c) => c.value === String(v || '').toUpperCase())?.label || 'General';

export function audienceLabel(n: Pick<Notice, 'targetAudience' | 'targetClass' | 'targetSection' | 'targetStudentIds'>): string {
  const aud = String(n.targetAudience || 'ALL').toUpperCase();
  if (aud === 'CLASS') return [n.targetClass || 'Class', n.targetSection].filter(Boolean).join(' ');
  if (aud === 'INDIVIDUAL') {
    const c = n.targetStudentIds?.length || 0;
    return `${c} student${c === 1 ? '' : 's'}`;
  }
  return ({ ALL: 'Everyone', STUDENTS: 'Students', PARENTS: 'Parents', STAFF: 'Staff', PUBLIC: 'Public website' } as Record<string, string>)[aud] || 'Everyone';
}

/** "2026-10-21" -> "21 Oct 2026". */
export function formatDay(v?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  if (!m) return v || '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

/** Text preview without decorative runs such as "=====" or "-----". */
export const previewText = (v?: string) => String(v || '').replace(/([=\-_*~#])\1{3,}/g, ' ').replace(/\s+/g, ' ').trim();
