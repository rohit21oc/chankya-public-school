/** Helpers for the Live Events screen. Pure so they can be tested. */

export const EVENT_CATEGORIES = ['Sports', 'Cultural', 'Academic', 'Celebration', 'Examination', 'Community'];

export const CATEGORY_COLOR: Record<string, { bg: string; fg: string }> = {
  Sports: { bg: '#ECFDF3', fg: '#067647' },
  Cultural: { bg: '#FDF2FA', fg: '#C11574' },
  Academic: { bg: '#EFF8FF', fg: '#175CD3' },
  Celebration: { bg: '#FFF6E5', fg: '#8A5B12' },
  Examination: { bg: '#FEF3F2', fg: '#B42318' },
  Community: { bg: '#F4F3FF', fg: '#5925DC' },
};

export const categoryColor = (c?: string) => CATEGORY_COLOR[String(c || '')] || { bg: '#F2F4F7', fg: '#344054' };

export function eventStart(e: any): string {
  return String(e?.eventDate || e?.startDate || e?.date || '').slice(0, 10);
}

export function eventEnd(e: any): string {
  const end = String(e?.endDate || '').slice(0, 10);
  const start = eventStart(e);
  return end && end >= start ? end : start;
}

export type EventPhase = 'LIVE' | 'UPCOMING' | 'PAST' | 'UNDATED';

export function eventPhase(e: any, today: string): EventPhase {
  const s = eventStart(e);
  if (!s) return 'UNDATED';
  const end = eventEnd(e);
  if (today >= s && today <= end) return 'LIVE';
  return s > today ? 'UPCOMING' : 'PAST';
}

export function daysUntil(date: string, today: string): number {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** "Live now", "Tomorrow", "In 5 days", "In 3 weeks", "2 days ago". */
export function countdownLabel(e: any, today: string): string {
  const phase = eventPhase(e, today);
  if (phase === 'LIVE') return 'Happening today';
  if (phase === 'UNDATED') return 'Date to be announced';
  const n = daysUntil(eventStart(e), today);
  if (phase === 'UPCOMING') {
    if (n === 1) return 'Tomorrow';
    if (n < 14) return `In ${n} days`;
    return `In ${Math.round(n / 7)} weeks`;
  }
  const ago = daysUntil(eventEnd(e), today) * -1;
  return ago === 1 ? 'Yesterday' : ago < 30 ? `${ago} days ago` : 'Earlier';
}

/** Upcoming soonest first; past most recent first. */
export function splitEvents(list: any[], today: string): { live: any[]; upcoming: any[]; past: any[] } {
  const live: any[] = [];
  const upcoming: any[] = [];
  const past: any[] = [];
  for (const e of list) {
    const p = eventPhase(e, today);
    if (p === 'LIVE') live.push(e);
    else if (p === 'PAST') past.push(e);
    else upcoming.push(e);
  }
  upcoming.sort((a, b) => (eventStart(a) || '9999').localeCompare(eventStart(b) || '9999'));
  past.sort((a, b) => eventStart(b).localeCompare(eventStart(a)));
  return { live, upcoming, past };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function dateBadge(iso: string): { day: string; month: string; weekday: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { day: '—', month: '', weekday: '' };
  const d = new Date(`${iso}T00:00:00Z`);
  return { day: String(d.getUTCDate()), month: MONTHS[d.getUTCMonth()], weekday: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }) };
}
