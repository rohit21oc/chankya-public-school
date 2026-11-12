/**
 * Pure helpers for the institutional reports (server.ts → /api/analytics/official-reports).
 * Every figure is derived from saved records; nothing is estimated or filled in.
 * Checked by scripts/verify-report-rules.ts.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && ISO.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

/** "2026-2027" / "2026-27" → same session. */
export function sameSession(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = String(a).replace(/[\s-]/g, '').toLowerCase();
  const y = String(b).replace(/[\s-]/g, '').toLowerCase();
  return x === y || x.slice(0, 4) === y.slice(0, 4);
}

/** Start/end dates of a session: from the saved session list, else 1 April – 31 March. */
export function sessionRange(name: string, sessions: Array<{ name?: string; startDate?: string; endDate?: string }> = []): { start: string; end: string } {
  const saved = sessions.find((s) => sameSession(s.name, name) && isIsoDate(s.startDate) && isIsoDate(s.endDate));
  if (saved) return { start: saved.startDate!, end: saved.endDate! };
  const y = parseInt(String(name).slice(0, 4), 10);
  if (!Number.isFinite(y)) return { start: '', end: '' };
  return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

/** Effective reporting period: the session, narrowed by the optional date filter. */
export function reportPeriod(session: { start: string; end: string }, from?: string, to?: string): { from: string; to: string } {
  const f = isIsoDate(from) && (!session.start || from >= session.start) ? from : session.start;
  const t = isIsoDate(to) && (!session.end || to <= session.end) ? to : session.end;
  return { from: f, to: t };
}

export const inPeriod = (d: unknown, p: { from: string; to: string }) => {
  const x = String(d || '').slice(0, 10);
  if (!x) return false;
  return (!p.from || x >= p.from) && (!p.to || x <= p.to);
};

export const isActiveClass = (c: any) => String(c?.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && c?.isActive !== false;

/** Active sections of a class (detailed sections win when present). */
export function activeSectionsOf(c: any): string[] {
  if (Array.isArray(c?.detailedSections) && c.detailedSections.length) {
    return c.detailedSections.filter((d: any) => String(d?.status || 'ACTIVE').toUpperCase() === 'ACTIVE').map((d: any) => String(d.name).trim().toUpperCase()).filter(Boolean);
  }
  const list = Array.isArray(c?.sections) ? c.sections.map((x: any) => String(typeof x === 'string' ? x : x?.name || '').trim().toUpperCase()).filter(Boolean) : [];
  return list.length ? list : ['A'];
}

/** Ledger money: billed (after discount), paid, pending and excess. Waived / cancelled bills count as zero. */
export function ledgerFigures(l: any): { billed: number; paid: number; pending: number; excess: number } {
  const st = String(l?.status || '').toUpperCase();
  if (st === 'WAIVED' || st === 'CANCELLED' || st === 'VOID') return { billed: 0, paid: 0, pending: 0, excess: 0 };
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const billed = n(l?.totalAmount ?? l?.total ?? l?.amount);
  const paid = Math.max(0, n(l?.paidAmount));
  const pending = l?.pendingAmount !== undefined && l?.pendingAmount !== null ? Math.max(0, n(l.pendingAmount)) : Math.max(0, billed - paid);
  // Anything received or still due beyond the bill amount, so billed + excess = paid + pending.
  const excess = Math.max(0, paid + pending - billed);
  return { billed, paid, pending, excess };
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** Attendance % of one student; null when nothing was marked (never shown as 100%). */
export function attendancePct(present: number, marked: number): number | null {
  return marked > 0 ? Math.round((present / marked) * 1000) / 10 : null;
}

export function attendanceBand(p: number | null): 'No records' | 'Good' | 'Warning' | 'Critical' | 'Severe' {
  if (p === null) return 'No records';
  if (p < 50) return 'Severe';
  if (p < 60) return 'Critical';
  if (p < 75) return 'Warning';
  return 'Good';
}

/** Age in whole years on a given date (YYYY-MM-DD); null when the DOB is not a valid date. */
export function ageOn(dob: unknown, today: string): number | null {
  const d = String(dob || '').slice(0, 10);
  if (!isIsoDate(d)) return null;
  let age = parseInt(today.slice(0, 4), 10) - parseInt(d.slice(0, 4), 10);
  if (today.slice(5) < d.slice(5)) age--;
  return age >= 0 && age < 100 ? age : null;
}

/** "2026-10" → "Oct 2026" */
export function monthLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
