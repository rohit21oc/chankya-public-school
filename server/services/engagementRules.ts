/**
 * Pure rules for leave, fee-due alerts and parent chat. No database or Express here,
 * so scripts/verify-engagement-rules.ts can check them offline.
 */

import { isWeekOff, workingDaySet } from '../../src/utils/workingDays.ts';

export const LEAVE_APPROVAL_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'HR_STAFF'];
/** Who may message parents and send fee-due alerts. Teachers are limited to their own classes. */
export const PARENT_CHAT_STAFF_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACCOUNTANT', 'ACADEMIC_COORDINATOR', 'TEACHER', 'HOSTEL_WARDEN'];
/** May send an emergency message to every parent (or chosen classes / students) at once. */
export const EMERGENCY_MESSAGE_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
export const FEE_ALERT_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACCOUNTANT'];
export const STUDENT_LEAVE_TYPES = ['SICK', 'CASUAL', 'FAMILY', 'OTHER'] as const;
export const STAFF_LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED', 'DUTY', 'MATERNITY', 'LWP', 'OTHER'] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Today's date in India (the school's time zone). */
export function indiaToday(now = Date.now()): string {
  return new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Each calendar date from start to end inclusive (YYYY-MM-DD, UTC-safe). */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return out;
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cur <= last && out.length < 400) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Weekly offs (days not in School Working Days) and holidays are not leave days; only working days count. */
export function leaveWorkingDates(start: string, end: string, holidays: Array<{ date?: string; endDate?: string }> = [], workingDays?: string[]): string[] {
  const holidaySet = new Set<string>();
  for (const h of holidays) {
    const from = String(h?.date || '').slice(0, 10);
    const to = String(h?.endDate || h?.date || '').slice(0, 10);
    for (const d of eachDate(from, to)) holidaySet.add(d);
  }
  const working = workingDaySet(workingDays);
  return eachDate(start, end).filter((d) => !isWeekOff(d, working) && !holidaySet.has(d));
}

/** Validates a leave application. Returns an error message, or null when it is fine. */
export function validateLeaveInput(input: { startDate?: unknown; endDate?: unknown; reason?: unknown }, workingDays: number): string | null {
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) return 'Choose a valid start and end date.';
  if (String(input.endDate) < String(input.startDate)) return 'The end date cannot be before the start date.';
  if (eachDate(String(input.startDate), String(input.endDate)).length > 60) return 'A single leave cannot be longer than 60 days.';
  if (!String(input.reason || '').trim()) return 'Please write a reason for the leave.';
  if (String(input.reason).length > 500) return 'Keep the reason under 500 characters.';
  if (workingDays <= 0) return 'Those dates are only Sundays or holidays, so no leave is needed.';
  return null;
}

export interface LedgerLike {
  id?: string;
  studentId?: string;
  status?: string;
  pendingAmount?: number;
  totalAmount?: number;
  total?: number;
  amount?: number;
  paidAmount?: number;
  dueDate?: string;
  feeMonth?: string;
  monthYear?: string;
  feeType?: string;
}

export interface FeeDueSummary {
  totalPending: number;
  overdue: number;
  overdueCount: number;
  items: Array<{ label: string; amount: number; dueDate: string; overdue: boolean }>;
}

function pendingOf(l: LedgerLike): number {
  const st = String(l.status || '').toUpperCase();
  if (st === 'WAIVED' || st === 'CANCELLED' || st === 'REFUNDED') return 0;
  const p = typeof l.pendingAmount === 'number' ? l.pendingAmount : Math.max(0, (l.totalAmount ?? l.total ?? l.amount ?? 0) - (l.paidAmount ?? 0));
  return Number.isFinite(p) && p > 0 ? Math.round(p * 100) / 100 : 0;
}

/** Pending and overdue dues of one student from their fee ledgers. */
export function summarizeFeeDues(ledgers: LedgerLike[], today: string): FeeDueSummary {
  const seen = new Set<string>();
  const items: FeeDueSummary['items'] = [];
  for (const l of ledgers) {
    if (l.id) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
    }
    const amount = pendingOf(l);
    if (amount <= 0) continue;
    const dueDate = String(l.dueDate || '').slice(0, 10);
    items.push({ label: String(l.monthYear || l.feeMonth || l.feeType || 'School fee'), amount, dueDate, overdue: !!dueDate && dueDate < today });
  }
  items.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    totalPending: round(items.reduce((s, i) => s + i.amount, 0)),
    overdue: round(items.filter((i) => i.overdue).reduce((s, i) => s + i.amount, 0)),
    overdueCount: items.filter((i) => i.overdue).length,
    items,
  };
}

export function formatInr(n: number): string {
  return `Rs.${Math.round(n).toLocaleString('en-IN')}`;
}

/** Text of the fee-due alert shown in the parent chat (and used for the optional SMS). */
export function buildFeeDueText(schoolName: string, studentName: string, s: FeeDueSummary, note?: string): string {
  const parts = [`${schoolName}: Dear Parent, fee of ${formatInr(s.totalPending)} is pending for ${studentName}.`];
  if (s.overdue > 0) parts.push(`${formatInr(s.overdue)} of it is past the due date.`);
  parts.push('Kindly pay at the school office or in the app (Fees).');
  const extra = String(note || '').trim();
  if (extra) parts.push(extra.slice(0, 300));
  return parts.join(' ');
}

/** Short form for SMS (one or two SMS units). */
export function buildFeeDueSms(schoolName: string, studentName: string, s: FeeDueSummary): string {
  return `${schoolName}: Dear Parent, fee of ${formatInr(s.totalPending)} is pending for ${studentName}${s.overdue > 0 ? ` (${formatInr(s.overdue)} overdue)` : ''}. Kindly clear the dues. Check the school app for details.`;
}

export function cleanMessageText(v: unknown): string {
  return String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, 2000);
}
