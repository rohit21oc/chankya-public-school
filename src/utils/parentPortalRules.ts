/**
 * Pure rules for the parent portal's Timetable, Homework and Events screens.
 * Kept free of React and network code so they can be tested directly.
 */
import { kolkataDate } from './parentFeeSummary';

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

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

export interface ChildLike {
  id: string;
  classId?: string;
  className?: string;
  section?: string;
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

export function normalizeDay(d?: string): WeekDay | null {
  const v = norm(d);
  const hit = WEEK_DAYS.find((w) => w.toLowerCase() === v || w.toLowerCase().slice(0, 3) === v.slice(0, 3));
  return v ? hit || null : null;
}

/** True when a record belongs to the child's class (by id, or by name when ids are missing). */
function sameClass(child: ChildLike, classId?: string, className?: string): boolean {
  if (child.classId && classId) return child.classId === classId;
  return !!child.className && norm(child.className) === norm(className);
}

/** A record without a section applies to the whole class. */
function sameSection(child: ChildLike, section?: string): boolean {
  if (!section || !child.section) return true;
  return norm(section) === norm(child.section);
}

function sameSession(session: string | undefined, recordSession?: string): boolean {
  if (!session || !recordSession) return true;
  return norm(session) === norm(recordSession);
}

export interface WeeklyTimetable {
  periods: Array<{ number: number; startTime?: string; endTime?: string }>;
  days: Array<{ day: WeekDay; slots: SlotLike[] }>;
  slotCount: number;
}

/** Only the child's class and section, grouped by day and ordered by period. */
export function buildChildTimetable(slots: SlotLike[] | null | undefined, child: ChildLike, session?: string): WeeklyTimetable {
  const mine = (slots || []).filter(
    (s) => sameClass(child, s.classId, s.className) && sameSection(child, s.section) && sameSession(session, s.academicSession)
  );
  const periodMap = new Map<number, { number: number; startTime?: string; endTime?: string }>();
  for (const s of mine) {
    const n = Number(s.periodNumber ?? s.period);
    if (!Number.isFinite(n)) continue;
    if (!periodMap.has(n)) periodMap.set(n, { number: n, startTime: s.startTime, endTime: s.endTime });
  }
  const periods = [...periodMap.values()].sort((a, b) => a.number - b.number);
  const days = WEEK_DAYS.map((day) => ({
    day,
    slots: mine
      .filter((s) => normalizeDay(s.dayOfWeek || s.day) === day)
      .sort((a, b) => Number(a.periodNumber ?? a.period) - Number(b.periodNumber ?? b.period)),
  }));
  return { periods, days, slotCount: mine.length };
}

export interface HomeworkLike {
  id: string;
  classId?: string;
  className?: string;
  section?: string;
  subjectName?: string;
  title?: string;
  dueDate?: string;
  assignedDate?: string;
}

export type HomeworkDueStatus = 'UPCOMING' | 'DUE_TODAY' | 'PAST_DUE' | 'NO_DUE_DATE';

/**
 * Status from the due date only. The homework records have no submission or
 * completion field, so the portal never claims a task is "completed".
 */
export function homeworkDueStatus(dueDate: string | undefined, today: string): HomeworkDueStatus {
  const d = String(dueDate || '').substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 'NO_DUE_DATE';
  if (d === today) return 'DUE_TODAY';
  return d > today ? 'UPCOMING' : 'PAST_DUE';
}

export function homeworkForChild<T extends HomeworkLike>(list: T[] | null | undefined, child: ChildLike, now: Date = new Date()) {
  const today = kolkataDate(now);
  const rank: Record<HomeworkDueStatus, number> = { DUE_TODAY: 0, UPCOMING: 1, NO_DUE_DATE: 2, PAST_DUE: 3 };
  return (list || [])
    .filter((h) => sameClass(child, h.classId, h.className) && sameSection(child, h.section))
    .map((h) => ({ ...h, dueStatus: homeworkDueStatus(h.dueDate, today) }))
    .sort((a, b) => {
      const r = rank[a.dueStatus] - rank[b.dueStatus];
      if (r !== 0) return r;
      // Soonest first for open work, most recent first for past work.
      const da = String(a.dueDate || ''), db = String(b.dueDate || '');
      return a.dueStatus === 'PAST_DUE' ? db.localeCompare(da) : da.localeCompare(db);
    });
}

export interface HolidayLike {
  id: string;
  name?: string;
  date: string;
  endDate?: string;
  type?: string;
  description?: string;
  academicSession?: string;
}

export interface EventLike {
  id: string;
  title?: string;
  eventDate?: string;
  description?: string;
  location?: string;
  isActive?: boolean;
}

export interface CalendarItem {
  id: string;
  kind: 'HOLIDAY' | 'EVENT';
  title: string;
  date: string;
  endDate?: string;
  detail?: string;
}

/** Holidays and active events that have not finished yet, soonest first. */
export function upcomingCalendar(
  holidays: HolidayLike[] | null | undefined,
  events: EventLike[] | null | undefined,
  now: Date = new Date(),
  limit = 20
): CalendarItem[] {
  const today = kolkataDate(now);
  const items: CalendarItem[] = [];
  for (const h of holidays || []) {
    const end = h.endDate || h.date;
    if (!h.date || end < today) continue;
    items.push({ id: `h-${h.id}`, kind: 'HOLIDAY', title: h.name || 'Holiday', date: h.date, endDate: h.endDate, detail: h.description || h.type });
  }
  for (const e of events || []) {
    if (e.isActive === false || !e.eventDate) continue;
    const d = e.eventDate.substring(0, 10);
    if (d < today) continue;
    items.push({ id: `e-${e.id}`, kind: 'EVENT', title: e.title || 'School event', date: d, detail: [e.location, e.description].filter(Boolean).join(' · ') || undefined });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

/** "20 Oct 2026" for YYYY-MM-DD; anything else is returned unchanged. */
export function formatDisplayDate(d?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  if (!m) return String(d || '');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}
