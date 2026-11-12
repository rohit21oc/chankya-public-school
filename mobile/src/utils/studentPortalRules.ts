/**
 * Pure rules for the student portal screens (kept free of React so they can be tested offline).
 */

export type CalStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'HOLIDAY';

export interface CalCell {
  /** YYYY-MM-DD, or null for the blank cells before the 1st / after the last day. */
  date: string | null;
  day: number;
  /** Attendance (or holiday) status shown on this day, if any. */
  status?: CalStatus;
  isToday: boolean;
  /** Weekly off: a weekday not ticked in School Working Days (name kept for existing screens). */
  isSunday: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Days in a month, from "YYYY-MM". */
export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

import { isWeekOff, workingDaySet } from './workingDays';

/**
 * A Monday-first month grid (rows of 7) like a wall calendar. Attendance wins over a holiday on the
 * same day; a Sunday never shows as absent. `statusByDate` and `holidayDates` are YYYY-MM-DD keyed.
 */
export function monthGrid(ym: string, statusByDate: Record<string, CalStatus>, holidayDates: Set<string>, today: string, workingDays?: string[]): CalCell[][] {
  const working = workingDaySet(workingDays);
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // Monday-first offset
  const total = daysInMonth(ym);
  const cells: CalCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ date: null, day: 0, isToday: false, isSunday: false });
  for (let d = 1; d <= total; d++) {
    const date = `${y}-${pad(m)}-${pad(d)}`;
    const rec = statusByDate[date];
    cells.push({
      date,
      day: d,
      status: rec ?? (holidayDates.has(date) ? 'HOLIDAY' : undefined),
      isToday: date === today,
      isSunday: isWeekOff(date, working),
    });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: 0, isToday: false, isSunday: false });
  const weeks: CalCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Holiday dates (YYYY-MM-DD) that fall inside a month; multi-day holidays are expanded. */
export function holidayDatesInMonth(holidays: Array<{ date?: string; endDate?: string }> | null | undefined, ym: string): Set<string> {
  const out = new Set<string>();
  for (const h of holidays || []) {
    const start = String(h?.date || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) continue;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(String(h?.endDate || '').substring(0, 10)) ? String(h.endDate).substring(0, 10) : start;
    const s = new Date(`${start}T00:00:00Z`);
    for (let i = 0; i < 62; i++) {
      const d = new Date(s.getTime() + i * 86400000);
      const iso = d.toISOString().substring(0, 10);
      if (iso > end) break;
      if (iso.startsWith(ym)) out.add(iso);
    }
  }
  return out;
}

/** "Good Morning" / "Good Afternoon" / "Good Evening" by Asia/Kolkata hour. */
export function greetingFor(now: Date = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now)) % 24;
  return hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
}

/** "Class 5 - A  |  Roll No. 12" with whatever is recorded. */
export function classRollLine(s: { className?: string; section?: string; rollNumber?: string } | null | undefined): string {
  if (!s) return '';
  const cls = String(s.className || '').trim();
  const sec = String(s.section || '').trim();
  const parts: string[] = [];
  if (cls) parts.push(sec ? `${cls} - ${sec}` : cls);
  if (s.rollNumber) parts.push(`Roll No. ${s.rollNumber}`);
  return parts.join('  |  ');
}

export type NoticeTab = 'ALL' | 'ACADEMIC' | 'GENERAL';

const ACADEMIC_CATEGORIES = ['EXAM', 'RESULT', 'ACADEMIC', 'HOMEWORK', 'TIMETABLE', 'SYLLABUS', 'ASSIGNMENT'];

/** Which tab a notice belongs to: exam / result / academic notices vs everything else. */
export function noticeTabOf(n: { category?: string; noticeType?: string }): Exclude<NoticeTab, 'ALL'> {
  const c = String(n?.category || n?.noticeType || '').toUpperCase();
  return ACADEMIC_CATEGORIES.includes(c) ? 'ACADEMIC' : 'GENERAL';
}

const noticeDay = (n: any) => String(n?.publishedDate || n?.publishDate || n?.date || n?.createdAt || '').substring(0, 10);

/** Published notices for the portal, pinned first then newest first, filtered by tab. */
export function noticesForTab(list: any[] | null | undefined, tab: NoticeTab): any[] {
  return (list || [])
    .filter((n) => n && (!n.status || n.status === 'PUBLISHED'))
    .filter((n) => tab === 'ALL' || noticeTabOf(n) === tab)
    .sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) || noticeDay(b).localeCompare(noticeDay(a)));
}

/** A notice counts as "New" for 3 days after it is published. */
export function isNewNotice(n: any, today: string): boolean {
  const d = noticeDay(n);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const diff = (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${d}T00:00:00Z`).getTime()) / 86400000;
  return diff >= 0 && diff <= 3;
}

const eventDay = (e: any) => String(e?.eventDate || e?.date || '').substring(0, 10);

/** Active events split into upcoming (today or later, soonest first) and past (latest first). */
export function splitEvents(list: any[] | null | undefined, today: string): { upcoming: any[]; past: any[] } {
  const active = (list || []).filter((e) => e && e.isActive !== false && /^\d{4}-\d{2}-\d{2}$/.test(eventDay(e)));
  return {
    upcoming: active.filter((e) => eventDay(e) >= today).sort((a, b) => eventDay(a).localeCompare(eventDay(b))),
    past: active.filter((e) => eventDay(e) < today).sort((a, b) => eventDay(b).localeCompare(eventDay(a))),
  };
}

/** Whole days from `today` to a YYYY-MM-DD date (0 = today). */
export function daysUntil(date: string, today: string): number {
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000);
}

/** Percentage of an attendance summary, or null when nothing is recorded. */
export function percentLabel(p: number | null | undefined): string {
  return p === null || p === undefined ? '—' : `${p}%`;
}
