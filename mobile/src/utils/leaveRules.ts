/**
 * Leave helpers for the app. The server re-checks everything (dates, overlap,
 * who may apply) and counts the days itself; these only make the form helpful.
 */

export const STAFF_LEAVE_TYPES = [
  { value: 'SICK', label: 'Sick' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'EARNED', label: 'Earned' },
  { value: 'DUTY', label: 'On duty' },
  { value: 'LWP', label: 'Without pay' },
  { value: 'OTHER', label: 'Other' },
];

export const STUDENT_LEAVE_TYPES = [
  { value: 'SICK', label: 'Sick' },
  { value: 'CASUAL', label: 'Personal' },
  { value: 'FAMILY', label: 'Family function' },
  { value: 'OTHER', label: 'Other' },
];

export const LEAVE_APPROVER_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'HR_STAFF'];

export const canApproveLeave = (role?: string) => LEAVE_APPROVER_ROLES.includes(String(role || '').toUpperCase());

export function leaveTypeLabel(v?: string): string {
  const all = [...STAFF_LEAVE_TYPES, ...STUDENT_LEAVE_TYPES, { value: 'UNPAID', label: 'Without pay' }, { value: 'MATERNITY', label: 'Maternity' }];
  return all.find((t) => t.value === String(v || '').toUpperCase())?.label || 'Leave';
}

export const LEAVE_STATUS_UI: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: 'Pending', bg: '#FFFAEB', fg: '#B54708' },
  APPROVED: { label: 'Approved', bg: '#ECFDF3', fg: '#067647' },
  REJECTED: { label: 'Rejected', bg: '#FEF3F2', fg: '#B42318' },
  CANCELLED: { label: 'Withdrawn', bg: '#F2F4F7', fg: '#344054' },
};

export const indiaToday = (now = Date.now()) => new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** School working days between two dates: Sundays (and given holidays) are not counted. */
export function countLeaveDays(start: string, end: string, holidays: string[] = []): number {
  if (!ISO.test(start) || !ISO.test(end) || end < start) return 0;
  const skip = new Set(holidays);
  let n = 0;
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cur <= last && n < 400) {
    const iso = cur.toISOString().slice(0, 10);
    if (cur.getUTCDay() !== 0 && !skip.has(iso)) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

export function validateLeaveForm(f: { startDate: string; endDate: string; reason: string }): string | null {
  if (!ISO.test(f.startDate) || !ISO.test(f.endDate)) return 'Choose the start and end date.';
  if (f.endDate < f.startDate) return 'The end date cannot be before the start date.';
  if (!f.reason.trim()) return 'Please write a reason.';
  if (countLeaveDays(f.startDate, f.endDate) === 0) return 'Those dates are only Sundays. No leave is needed.';
  return null;
}

export function formatShortDate(iso?: string): string {
  if (!iso || !ISO.test(iso.slice(0, 10))) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatRange(start?: string, end?: string): string {
  if (!start) return '';
  return !end || end === start ? formatShortDate(start) : `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/**
 * Explains the salary rule for staff, using the same rule as the server:
 * in a month, 1 leave day is forgiven (sick leave first) and each further day costs monthly/30.
 */
export const SALARY_LEAVE_RULE = '1 leave day a month is forgiven (sick leave first). Each further leave day is cut at one day’s salary (monthly salary ÷ 30).';
