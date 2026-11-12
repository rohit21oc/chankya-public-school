/**
 * Pure rules for the mobile Parent Portal. No React, no network, so each rule is
 * unit-tested (test/verify-parent-portal.ts). Fee, timetable, homework and calendar
 * rules mirror the website's src/utils/parentFeeSummary.ts and parentPortalRules.ts
 * so a parent sees the same numbers on both.
 *
 * Nothing here invents data: missing values become "Not recorded" or an empty
 * state, never a default class, section, percentage or amount.
 */
import { computeCbseEvaluation } from './reportCardRules';

export const NOT_RECORDED = 'Not recorded';

// ---------------------------------------------------------------------------
// Active child
// ---------------------------------------------------------------------------

export interface ChildLike {
  id: string;
  admissionNumber?: string;
  name?: string;
  classId?: string;
  className?: string;
  section?: string;
}

/**
 * Children the session is allowed to show: the server already scopes
 * GET /api/students to the parent, and this keeps only ids that are also in the
 * session's linked list (defence in depth). An empty linked list trusts the server.
 */
export function authorizedChildren<T extends ChildLike>(serverList: T[] | null | undefined, linkedIds: string[] | null | undefined): T[] {
  const linked = new Set((linkedIds || []).filter(Boolean));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of serverList || []) {
    if (!c?.id || seen.has(c.id)) continue;
    if (linked.size > 0 && !linked.has(c.id) && !(c.admissionNumber && linked.has(c.admissionNumber))) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/**
 * The child to show: the stored choice if it is still authorized, else the
 * session's active child, else the first child. Never an id outside the list.
 */
export function chooseActiveChildId(
  children: ChildLike[],
  storedId?: string | null,
  sessionActiveId?: string | null
): string | null {
  const has = (id?: string | null) => !!id && children.some((c) => c.id === id);
  if (has(storedId)) return storedId as string;
  if (has(sessionActiveId)) return sessionActiveId as string;
  return children[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Labels and dates
// ---------------------------------------------------------------------------

/** "Class 2" stays, "2" becomes "Class 2", "Nursery" stays; nothing is invented. */
export function classLabel(className?: string | null): string {
  const name = String(className ?? '').trim();
  if (!name) return 'Class not recorded';
  if (/^class\b/i.test(name)) return name;
  if (/^\d+$/.test(name) || /^[IVXL]+$/i.test(name)) return `Class ${name}`;
  return name;
}

export function classSectionLabel(className?: string | null, section?: string | null): string {
  const base = classLabel(className);
  const sec = String(section ?? '').trim();
  return sec ? `${base} - ${sec}` : base;
}

export function initialsOf(name?: string | null): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function firstNameOf(name?: string | null): string {
  return String(name ?? '').trim().split(/\s+/)[0] || '';
}

/** Calendar date (YYYY-MM-DD) in Asia/Kolkata, the school's timezone. */
export function kolkataDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60 * 1000).toISOString().substring(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "20 Oct 2026" for YYYY-MM-DD; anything else is returned unchanged. */
export function formatDisplayDate(d?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  if (!m) return String(d || '');
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "October 2026" for YYYY-MM. */
export function formatMonthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym);
  return m ? `${MONTHS_LONG[Number(m[2]) - 1]} ${m[1]}` : ym;
}

export function shiftMonth(ym: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym);
  if (!m) return ym;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, '0')}`;
}

/** "₹1,234" for a real number, "—" when not available. */
export function formatRupees(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export type DayStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY';

export interface AttendanceLike {
  studentId?: string;
  date?: string;
  status?: string;
  remarks?: string;
}

export interface AttendanceSummary {
  total: number; // school days with a record (holidays excluded)
  present: number; // PRESENT + LATE
  absent: number;
  late: number;
  leave: number;
  percentage: number | null; // null when there are no records: never show 100%
  days: Array<{ date: string; status: DayStatus; remarks?: string }>;
}

const DAY_STATUSES: DayStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY'];

/** One child's attendance, optionally limited to a month (YYYY-MM). Latest day first. */
export function summarizeAttendance(
  records: AttendanceLike[] | null | undefined,
  childId: string,
  month?: string
): AttendanceSummary {
  const byDate = new Map<string, { date: string; status: DayStatus; remarks?: string }>();
  for (const r of records || []) {
    if (r?.studentId && r.studentId !== childId) continue;
    const date = String(r?.date || '').substring(0, 10);
    const status = String(r?.status || '').toUpperCase() as DayStatus;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !DAY_STATUSES.includes(status)) continue;
    if (month && !date.startsWith(month)) continue;
    byDate.set(date, { date, status, remarks: r.remarks || undefined }); // last record for a date wins
  }
  const days = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  let present = 0, absent = 0, late = 0, leave = 0;
  for (const d of days) {
    if (d.status === 'PRESENT') present++;
    else if (d.status === 'LATE') { late++; present++; }
    else if (d.status === 'ABSENT') absent++;
    else if (d.status === 'LEAVE') leave++;
  }
  const total = present + absent + leave;
  return { total, present, absent, late, leave, percentage: total > 0 ? Math.round((present / total) * 100) : null, days };
}

// ---------------------------------------------------------------------------
// Fees (same rules as the website: ledgers are the billing record)
// ---------------------------------------------------------------------------

export interface LedgerLike {
  amount?: number | string;
  total?: number | string;
  totalAmount?: number | string;
  fine?: number | string;
  paidAmount?: number | string;
  pendingAmount?: number | string;
  status?: string;
  dueDate?: string;
  monthYear?: string;
  feeMonth?: string;
}

export interface FeeSummary {
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  overdue: number;
  overdueCount: number;
  ledgerCount: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function ledgerTotal(l: LedgerLike): number {
  if (l.total !== undefined && l.total !== null && l.total !== '') return num(l.total);
  if (l.totalAmount !== undefined && l.totalAmount !== null && l.totalAmount !== '') return num(l.totalAmount);
  return num(l.amount) + num(l.fine);
}

export function ledgerPending(l: LedgerLike): number {
  if (l.pendingAmount !== undefined && l.pendingAmount !== null && l.pendingAmount !== '') return Math.max(0, num(l.pendingAmount));
  return Math.max(0, ledgerTotal(l) - num(l.paidAmount));
}

export function summarizeFees(ledgers: LedgerLike[] | null | undefined, payments: Array<{ amount?: number | string }> | null | undefined, now: Date = new Date()): FeeSummary {
  const rows = Array.isArray(ledgers) ? ledgers : [];
  const pays = Array.isArray(payments) ? payments : [];
  const today = kolkataDate(now);
  const totalBilled = rows.reduce((s, l) => s + ledgerTotal(l), 0);
  const totalPaid = Math.max(pays.reduce((s, p) => s + num(p.amount), 0), rows.reduce((s, l) => s + num(l.paidAmount), 0));
  const totalPending = rows.reduce((s, l) => s + ledgerPending(l), 0);
  let overdue = 0, overdueCount = 0;
  for (const l of rows) {
    const pending = ledgerPending(l);
    if (pending > 0 && (l.status === 'OVERDUE' || (!!l.dueDate && l.dueDate < today))) {
      overdue += pending;
      overdueCount++;
    }
  }
  return { totalBilled, totalPaid, totalPending, overdue, overdueCount, ledgerCount: rows.length };
}

export type LedgerState = 'PAID' | 'PARTIAL' | 'OVERDUE' | 'DUE';

export function ledgerState(l: LedgerLike, now: Date = new Date()): LedgerState {
  const pending = ledgerPending(l);
  if (pending <= 0) return 'PAID';
  if (l.status === 'OVERDUE' || (!!l.dueDate && l.dueDate < kolkataDate(now))) return 'OVERDUE';
  return num(l.paidAmount) > 0 ? 'PARTIAL' : 'DUE';
}

// ---------------------------------------------------------------------------
// Timetable, homework, calendar
// ---------------------------------------------------------------------------

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

export function normalizeDay(d?: string): WeekDay | null {
  const v = norm(d);
  if (!v) return null;
  return WEEK_DAYS.find((w) => w.toLowerCase() === v || w.toLowerCase().slice(0, 3) === v.slice(0, 3)) || null;
}

function sameClass(child: ChildLike, classId?: string, className?: string): boolean {
  if (child.classId && classId) return child.classId === classId;
  return !!child.className && norm(child.className) === norm(className);
}
function sameSection(child: ChildLike, section?: string): boolean {
  if (!section || !child.section) return true;
  return norm(section) === norm(child.section);
}
function sameSession(session?: string, recordSession?: string): boolean {
  if (!session || !recordSession) return true;
  return norm(session) === norm(recordSession);
}

export interface SlotLike {
  id?: string;
  classId?: string;
  className?: string;
  section?: string;
  dayOfWeek?: string;
  day?: string;
  periodNumber?: number;
  period?: number;
  startTime?: string;
  endTime?: string;
  subjectName?: string;
  teacherName?: string;
  roomNumber?: string;
  academicSession?: string;
}

export function timetableForChild(slots: SlotLike[] | null | undefined, child: ChildLike, session?: string) {
  const mine = (slots || []).filter((s) => sameClass(child, s.classId, s.className) && sameSection(child, s.section) && sameSession(session, s.academicSession));
  const days = WEEK_DAYS.map((day) => ({
    day,
    slots: mine
      .filter((s) => normalizeDay(s.dayOfWeek || s.day) === day)
      .sort((a, b) => Number(a.periodNumber ?? a.period) - Number(b.periodNumber ?? b.period)),
  }));
  return { days, slotCount: mine.length };
}

/** Today's weekday in Asia/Kolkata, or null on Sunday. */
export function todayWeekDay(now: Date = new Date()): WeekDay | null {
  const d = new Date(`${kolkataDate(now)}T00:00:00Z`).getUTCDay();
  return d >= 1 && d <= 6 ? WEEK_DAYS[d - 1] : null;
}

export function roomLabel(r?: string): string {
  const v = String(r || '').trim();
  if (!v) return '';
  return /^room\b/i.test(v) ? v : `Room ${v}`;
}

export type HomeworkDueStatus = 'DUE_TODAY' | 'UPCOMING' | 'PAST_DUE' | 'NO_DUE_DATE';

export function homeworkDueStatus(dueDate: string | undefined, today: string): HomeworkDueStatus {
  const d = String(dueDate || '').substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 'NO_DUE_DATE';
  if (d === today) return 'DUE_TODAY';
  return d > today ? 'UPCOMING' : 'PAST_DUE';
}

export interface HomeworkLike {
  id: string;
  classId?: string;
  className?: string;
  section?: string;
  dueDate?: string;
}

/**
 * Homework for the child's class and section. Records have no completion field,
 * so the status comes from the due date only; nothing is shown as "completed".
 */
export function homeworkForChild<T extends HomeworkLike>(list: T[] | null | undefined, child: ChildLike, now: Date = new Date()) {
  const today = kolkataDate(now);
  const rank: Record<HomeworkDueStatus, number> = { DUE_TODAY: 0, UPCOMING: 1, NO_DUE_DATE: 2, PAST_DUE: 3 };
  return (list || [])
    .filter((h) => sameClass(child, h.classId, h.className) && sameSection(child, h.section))
    .map((h) => ({ ...h, dueStatus: homeworkDueStatus(h.dueDate, today) }))
    .sort((a, b) => {
      const r = rank[a.dueStatus] - rank[b.dueStatus];
      if (r !== 0) return r;
      const da = String(a.dueDate || ''), db = String(b.dueDate || '');
      return a.dueStatus === 'PAST_DUE' ? db.localeCompare(da) : da.localeCompare(db);
    });
}

export interface CalendarItem {
  id: string;
  kind: 'HOLIDAY' | 'EVENT';
  title: string;
  date: string;
  endDate?: string;
  detail?: string;
}

export function upcomingCalendar(
  holidays: Array<{ id: string; name?: string; date: string; endDate?: string; type?: string; description?: string }> | null | undefined,
  events: Array<{ id: string; title?: string; eventDate?: string; description?: string; location?: string; isActive?: boolean }> | null | undefined,
  now: Date = new Date(),
  limit = 20
): CalendarItem[] {
  const today = kolkataDate(now);
  const items: CalendarItem[] = [];
  for (const h of holidays || []) {
    if (!h?.date || (h.endDate || h.date) < today) continue;
    items.push({ id: `h-${h.id}`, kind: 'HOLIDAY', title: h.name || 'Holiday', date: h.date, endDate: h.endDate, detail: h.description || undefined });
  }
  for (const e of events || []) {
    if (!e || e.isActive === false || !e.eventDate) continue;
    const d = e.eventDate.substring(0, 10);
    if (d < today) continue;
    items.push({ id: `e-${e.id}`, kind: 'EVENT', title: e.title || 'School event', date: d, detail: [e.location, e.description].filter(Boolean).join(' · ') || undefined });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Exams and marks
// ---------------------------------------------------------------------------

export interface ExamLike {
  id: string;
  name?: string;
  title?: string;
  academicSession?: string;
  classIds?: string[];
  classId?: string;
  status?: string;
  resultsStatus?: string;
  startDate?: string;
  endDate?: string;
}

/** Published-result exams for the child's class in a session, newest first. */
export function publishedExamsForChild<T extends ExamLike>(exams: T[] | null | undefined, child: ChildLike, session?: string): T[] {
  return (exams || [])
    .filter((e) => e && e.status !== 'DRAFT' && e.resultsStatus === 'PUBLISHED')
    .filter((e) => sameSession(session, e.academicSession))
    .filter((e) => {
      const ids = Array.isArray(e.classIds) && e.classIds.length > 0 ? e.classIds : e.classId ? [e.classId] : [];
      return ids.length === 0 || (!!child.classId && ids.includes(child.classId));
    })
    .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
}

/** Exams not yet finished for the child's class (Dashboard "upcoming"), soonest first. */
export function upcomingExamsForChild<T extends ExamLike>(exams: T[] | null | undefined, child: ChildLike, now: Date = new Date()): T[] {
  const today = kolkataDate(now);
  return (exams || [])
    .filter((e) => e && e.status !== 'DRAFT' && !!e.startDate && String(e.endDate || e.startDate) >= today)
    .filter((e) => {
      const ids = Array.isArray(e.classIds) && e.classIds.length > 0 ? e.classIds : e.classId ? [e.classId] : [];
      return ids.length === 0 || (!!child.classId && ids.includes(child.classId));
    })
    // The same exam saved more than once (same name and dates) is shown once.
    .filter((e, i, all) => all.findIndex((o) => examKey(o) === examKey(e)) === i)
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
}

const examKey = (e: ExamLike) => `${String((e as any).name || (e as any).title || '').trim().toLowerCase()}|${e.startDate || ''}|${e.endDate || ''}`;

export interface MarkLike {
  studentId?: string;
  examId?: string;
  subjectId?: string;
  subjectName?: string;
  marksObtained?: number | string;
  maxMarks?: number | string;
  isAbsent?: boolean;
  status?: string;
  grade?: string;
}

export interface MarksRow {
  subjectId?: string;
  subject: string;
  obtained: number | null; // null when absent
  max: number;
  grade: string;
  pass: boolean;
}

export interface MarksResult {
  rows: MarksRow[];
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
  grade: string | null;
  result: 'PASS' | 'FAIL' | null;
}

/**
 * Subject-wise result for one child and one exam. Rows without a real maximum
 * are skipped rather than assuming 100. Subject names come from the school list.
 */
export function evaluateMarks(marks: MarkLike[] | null | undefined, childId: string, examId: string, subjectNames: Record<string, string>): MarksResult {
  const rows: MarksRow[] = [];
  const seen = new Set<string>();
  for (const m of marks || []) {
    if (!m || (m.studentId && m.studentId !== childId) || (m.examId && m.examId !== examId)) continue;
    const key = String(m.subjectId || m.subjectName || '');
    if (key && seen.has(key)) continue;
    const max = num(m.maxMarks);
    if (!(max > 0)) continue;
    if (key) seen.add(key);
    const absent = !!m.isAbsent || String(m.status || '').toUpperCase() === 'ABSENT';
    const obtained = absent ? null : num(m.marksObtained);
    const ev = computeCbseEvaluation(obtained ?? 0, max);
    rows.push({
      subjectId: m.subjectId,
      subject: (m.subjectId && subjectNames[m.subjectId]) || m.subjectName || NOT_RECORDED,
      obtained,
      max,
      grade: absent ? 'AB' : ev.grade,
      pass: !absent && ev.status === 'PASS',
    });
  }
  rows.sort((a, b) => a.subject.localeCompare(b.subject));
  const totalMax = rows.reduce((s, r) => s + r.max, 0);
  const totalObtained = rows.reduce((s, r) => s + (r.obtained ?? 0), 0);
  if (rows.length === 0 || totalMax <= 0) {
    return { rows, totalObtained: 0, totalMax: 0, percentage: null, grade: null, result: null };
  }
  const overall = computeCbseEvaluation(totalObtained, totalMax);
  return {
    rows,
    totalObtained,
    totalMax,
    percentage: overall.percentage,
    grade: overall.grade,
    result: rows.every((r) => r.pass) ? 'PASS' : 'FAIL',
  };
}
