import type { Staff, StaffAttendanceRecord, User } from '../types';

/**
 * Pure rules for the teacher profile, ID card and own attendance views.
 * No runtime imports from the API client, so they can be unit-tested offline.
 *
 * Rule: display only values that the server supplied. Never substitute
 * placeholders that look like real data (fake IDs, default departments, school phone).
 */

/** The only identifier the ID card may request: the signed-in user's own. */
export function ownStaffIdentifier(user: User): string {
  return user.employeeId || user.id || '';
}

export interface IdCardView {
  /** True only when a server staff record was loaded for this user. */
  available: boolean;
  name: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  phone?: string;
  photoKey?: string;
}

export function buildIdCardView(record: Staff | null | undefined, user: User): IdCardView {
  if (!record || !record.id) {
    return { available: false, name: user.name || '' };
  }
  return {
    available: true,
    name: record.name || user.name || '',
    employeeId: record.employeeId || undefined,
    designation: record.designation || undefined,
    department: record.department || undefined,
    phone: record.phone || user.phone || undefined,
    photoKey: record.photo || record.photoFileKey || undefined,
  };
}

export interface OwnAttendanceSummary {
  month: string;
  total: number;
  present: number;
  absent: number;
  leave: number;
  late: number;
  halfDay: number;
  records: StaffAttendanceRecord[];
}

function isOwnRecord(r: StaffAttendanceRecord, user: User): boolean {
  if (r.staffId && (r.staffId === user.id || (!!user.employeeId && r.staffId === user.employeeId))) return true;
  if (r.employeeId && !!user.employeeId && r.employeeId === user.employeeId) return true;
  return false;
}

/**
 * Summarises the signed-in user's own attendance for one month (YYYY-MM).
 * Records that are not the user's are excluded even if the server returned them.
 */
export function summarizeOwnAttendance(
  records: StaffAttendanceRecord[],
  user: User,
  month: string
): OwnAttendanceSummary {
  const own = (records || [])
    .filter((r) => isOwnRecord(r, user))
    .filter((r) => typeof r.date === 'string' && r.date.startsWith(month))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const count = (status: StaffAttendanceRecord['status']) => own.filter((r) => r.status === status).length;

  return {
    month,
    total: own.length,
    present: count('PRESENT'),
    absent: count('ABSENT'),
    leave: count('LEAVE'),
    late: count('LATE'),
    halfDay: count('HALF_DAY'),
    records: own,
  };
}
