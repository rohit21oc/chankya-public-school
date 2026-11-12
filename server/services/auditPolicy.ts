/**
 * What the audit trail keeps. The trail is for accountability on sensitive changes, not a click log:
 * routine activity (sign-ins, sign-outs, scans, page views) is dropped, repeated security noise is collapsed,
 * and every stored entry has secrets stripped before it is written.
 */

/** Routine actions that are never written to the audit trail. */
export const NOISE_ACTIONS = new Set([
  'USER_LOGIN',
  'USER_LOGOUT',
  'SWITCH_CHILD',
  'REPORT_VIEWED',
  'ATTENDANCE_SCANNED',
  'STAFF_ATTENDANCE_SCANNED',
  'PROFILE_UPDATE',
  'MARKS_DRAFT_SAVED',
  'ADMIN_INIT',
  'ADMIN_MIGRATION',
]);

/** Security events worth keeping, but only once per person per window (a brute-force run must not flood the trail). */
export const COLLAPSED_ACTIONS = new Set(['LOGIN_FAILED', 'LOGIN_BLOCKED', 'PASSWORD_CHANGE_FAILED']);
export const COLLAPSE_WINDOW_MS = 10 * 60 * 1000;
/** A client-reported entry that repeats a recorded one inside this window is a duplicate. */
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

export type AuditCategory = 'DATA_DELETION' | 'FINANCE' | 'EXAM' | 'ACADEMIC' | 'SECURITY' | 'ADMINISTRATION' | 'OTHER';

export function categoryOf(action: string, entity: string): AuditCategory {
  const a = String(action || '').toUpperCase();
  const e = String(entity || '').toUpperCase();
  if (/DELETE|REMOVED|DEPARTED/.test(a)) return 'DATA_DELETION';
  if (/FEE|PAYMENT|REFUND|WAIV|RECEIPT|PAYROLL|SALARY/.test(a) || /FEE|PAYMENT|PAYROLL/.test(e)) return 'FINANCE';
  if (/EXAM/.test(a) || e === 'EXAM') return 'EXAM';
  if (/MARK|RESULT|ATTENDANCE|HOMEWORK|SESSION|ADMISSION|PROMOT|TIMETABLE/.test(a)) return 'ACADEMIC';
  if (/LOGIN|PASSWORD|STATUS|ROLE|PERMISSION|ADMIN_/.test(a)) return 'SECURITY';
  if (/SETTINGS|ACCOUNT|STAFF|USER/.test(a)) return 'ADMINISTRATION';
  return 'OTHER';
}

const SECRET_KEY = /pass(word|wd)?|token|secret|hash|otp|pin\b|authorization|api[-_]?key|credential|cvv|card[-_]?number|salt|session/i;
const MAX_STRING = 300;
const MAX_KEYS = 40;

/** Deep copy with secret-looking fields replaced and long values shortened. Safe to call on any value. */
export function redact(value: any, depth = 0): any {
  if (value == null) return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value !== 'object') return value;
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 25).map((v) => redact(v, depth + 1));
  const out: Record<string, any> = {};
  for (const k of Object.keys(value).slice(0, MAX_KEYS)) {
    out[k] = SECRET_KEY.test(k) ? '[redacted]' : redact(value[k], depth + 1);
  }
  return out;
}

const IGNORED_DIFF_KEYS = new Set(['updatedAt', 'createdAt', 'lastModified', 'version', '__v', '_id']);

/** Only the fields that really changed, as { field: { from, to } }; secrets are redacted. */
export function diffRecords(before: any, after: any): Record<string, { from: any; to: any }> {
  const changes: Record<string, { from: any; to: any }> = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (IGNORED_DIFF_KEYS.has(k)) continue;
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    changes[k] = SECRET_KEY.test(k) ? { from: '[redacted]', to: '[redacted]' } : { from: redact(a, 2), to: redact(b, 2) };
  }
  return changes;
}

export interface AuditExtra {
  actorId?: string;
  before?: any;
  after?: any;
  changes?: Record<string, { from: any; to: any }>;
  [k: string]: any;
}

export interface RecentEntry {
  userName: string;
  action: string;
  entityId: string;
  at: number;
}

/** Decide whether an entry is stored. `recent` is a newest-first list of recently stored entries. */
export function shouldRecord(
  entry: { userName: string; action: string; entityId: string },
  recent: RecentEntry[],
  now: number,
  fromClient = false
): boolean {
  const action = String(entry.action || '').toUpperCase();
  if (!action || NOISE_ACTIONS.has(action)) return false;
  if (COLLAPSED_ACTIONS.has(action)) {
    return !recent.some((r) => now - r.at < COLLAPSE_WINDOW_MS && r.action.toUpperCase() === action && r.userName === entry.userName);
  }
  if (fromClient) {
    // The server already records its own changes; a browser-reported entry about the same record is a duplicate.
    return !recent.some((r) => now - r.at < DUPLICATE_WINDOW_MS && r.userName === entry.userName && r.entityId === entry.entityId);
  }
  return true;
}

/** The metadata stored with an entry: category, severity and redacted before/after values. */
export function buildMetadata(action: string, entity: string, extra?: AuditExtra): Record<string, any> {
  const category = categoryOf(action, entity);
  const meta: Record<string, any> = {
    category,
    severity: category === 'DATA_DELETION' || category === 'FINANCE' || category === 'EXAM' ? 'critical' : 'normal',
  };
  if (!extra) return meta;
  const { actorId, before, after, changes, ...rest } = extra;
  if (actorId) meta.actorId = actorId;
  if (before !== undefined) meta.before = redact(before);
  if (after !== undefined) meta.after = redact(after);
  const diff = changes || (before !== undefined && after !== undefined ? diffRecords(before, after) : undefined);
  if (diff && Object.keys(diff).length) meta.changes = diff;
  for (const [k, v] of Object.entries(rest)) meta[k] = redact(v);
  return meta;
}
