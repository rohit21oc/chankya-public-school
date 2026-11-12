/**
 * Monthly audit-log archive rules. Pure functions only (no server state, no network) so they can be tested alone.
 *
 * - Log timestamps are stored as UTC text "YYYY-MM-DD HH:mm:ss". Months are counted in India time (IST).
 * - On the 1st of a month the previous month (and any older month still not archived) is written to an Excel file,
 *   saved in Cloudflare R2 and e-mailed to the school.
 * - Entries stay in MongoDB for KEEP_MONTHS full months after their month ends, and are deleted only when the
 *   month's archive file is confirmed in R2 and holds every entry of that month.
 */

export const KEEP_MONTHS = 3;
const IST_MS = 5.5 * 3600 * 1000;

export const isMonthKey = (m: unknown): m is string => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

/** Current month (YYYY-MM) in India time. */
export function istMonth(now = Date.now()): string {
  return new Date(now + IST_MS).toISOString().slice(0, 7);
}

/** India-time hour (0–23). */
export function istHour(now = Date.now()): number {
  return new Date(now + IST_MS).getUTCHours();
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

/** Whole months from `a` to `b` (b − a). */
export function monthDiff(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

const utcText = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);

/** The stored-timestamp range [from, to) that covers one IST month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  return { from: utcText(Date.UTC(y, m - 1, 1) - IST_MS), to: utcText(Date.UTC(y, m, 1) - IST_MS) };
}

/** IST month of a stored timestamp ("YYYY-MM-DD HH:mm:ss" UTC, or ISO). */
export function monthOfTimestamp(ts: string): string | null {
  const ms = Date.parse(String(ts || '').includes('T') ? ts : `${String(ts).replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? null : istMonth(ms);
}

/** IST date-time text for the Excel sheet. */
export function istText(ts: string): string {
  const ms = Date.parse(String(ts || '').includes('T') ? ts : `${String(ts).replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? String(ts || '') : new Date(ms + IST_MS).toISOString().replace('T', ' ').slice(0, 19);
}

export interface ArchiveRecord {
  month: string;
  count: number;
  fileKey?: string;
  verified?: boolean; // the file was read back from R2 with the right size
  emailedAt?: string;
  emailAttempts?: number;
  purgedAt?: string;
}

/** Months to archive now: every month before the current one that has entries and no verified archive covering them. */
export function monthsToArchive(monthsWithLogs: Array<{ month: string; count: number }>, archives: ArchiveRecord[], currentMonth: string): string[] {
  return monthsWithLogs
    .filter((x) => x.count > 0 && monthDiff(x.month, currentMonth) >= 1)
    .filter((x) => {
      const a = archives.find((r) => r.month === x.month);
      // Not archived yet, not verified, or entries arrived after it was written (e.g. restored): write it again.
      return !a || !a.verified || (!a.purgedAt && x.count > a.count);
    })
    .map((x) => x.month)
    .sort();
}

/** Months whose entries may be deleted from MongoDB now. */
export function monthsToPurge(monthsWithLogs: Array<{ month: string; count: number }>, archives: ArchiveRecord[], currentMonth: string, keep = KEEP_MONTHS): string[] {
  return monthsWithLogs
    .filter((x) => x.count > 0 && monthDiff(x.month, currentMonth) > keep)
    .filter((x) => {
      const a = archives.find((r) => r.month === x.month);
      return !!a && !!a.verified && !!a.fileKey && a.count >= x.count;
    })
    .map((x) => x.month)
    .sort();
}

/** E-mails still to (re)send: archived, not yet e-mailed, fewer than 5 tries. */
export function monthsToEmail(archives: ArchiveRecord[], maxAttempts = 5): string[] {
  return archives.filter((a) => a.verified && !a.emailedAt && (a.emailAttempts || 0) < maxAttempts).map((a) => a.month).sort();
}

export const ARCHIVE_COLUMNS = ['Date & time (IST)', 'User', 'Role', 'Action', 'Entity', 'Entity ID', 'Details', 'Category', 'Severity', 'IP address', 'Changes', 'Log ID'];
export const ARCHIVE_WIDTHS = [20, 24, 16, 30, 18, 22, 60, 16, 10, 16, 60, 34];

/** One sheet row per log entry. Secrets were already masked when the entry was written. */
export function archiveRow(l: any): Array<string> {
  const meta = l?.metadata || {};
  let changes = '';
  if (meta.changes && typeof meta.changes === 'object') {
    changes = Object.entries(meta.changes)
      .map(([k, v]: [string, any]) => `${k}: ${JSON.stringify(v?.from ?? '')} → ${JSON.stringify(v?.to ?? '')}`)
      .join('; ')
      .slice(0, 5000);
  }
  return [
    istText(l?.timestamp),
    String(l?.userName || ''),
    String(l?.role || l?.userRole || ''),
    String(l?.action || ''),
    String(l?.entity || ''),
    String(l?.entityId || ''),
    String(l?.details || ''),
    String(meta.category || ''),
    String(meta.severity || ''),
    String(l?.ipAddress || ''),
    changes,
    String(l?.id || ''),
  ];
}

export const archiveFileName = (month: string) => `audit-logs-${month}.xlsx`;
export const archiveFileKey = (month: string) => `archives/audit-logs/${archiveFileName(month)}`;
