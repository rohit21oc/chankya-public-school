/**
 * Pure rules for student attendance entry.
 * A student with no status is "unmarked". Unmarked students are never submitted and
 * never default to PRESENT.
 */
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
export type AttendanceMap = Record<string, AttendanceStatus>;

const VALID: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
export const isAttendanceStatus = (v: unknown): v is AttendanceStatus =>
  typeof v === 'string' && (VALID as string[]).includes(v);

/** Seeds the sheet from saved records only. Students with no saved record stay unmarked. */
export function buildInitialAttendance(
  students: Array<{ id: string }>,
  savedRecords: Array<{ studentId?: string; status?: string }>
): { map: AttendanceMap; savedIds: string[] } {
  const enrolled = new Set(students.map((s) => s.id));
  const map: AttendanceMap = {};
  const savedIds: string[] = [];
  for (const rec of savedRecords || []) {
    if (rec.studentId && enrolled.has(rec.studentId) && isAttendanceStatus(rec.status)) {
      map[rec.studentId] = rec.status;
      savedIds.push(rec.studentId);
    }
  }
  return { map, savedIds };
}

export function countAttendance(students: Array<{ id: string }>, map: AttendanceMap) {
  const c = { total: students.length, marked: 0, unmarked: 0, present: 0, absent: 0, late: 0, leave: 0 };
  for (const s of students) {
    const st = map[s.id];
    if (!isAttendanceStatus(st)) { c.unmarked++; continue; }
    c.marked++;
    if (st === 'PRESENT') c.present++;
    else if (st === 'ABSENT') c.absent++;
    else if (st === 'LATE') c.late++;
    else c.leave++;
  }
  return c;
}

/** Builds the submit payload, or reports who is still unmarked. Never invents a status. */
export function buildAttendanceSubmission<T extends { id: string }>(
  students: T[],
  map: AttendanceMap
): { ok: boolean; unmarkedCount: number; records: Array<{ student: T; status: AttendanceStatus }> } {
  const unmarked = students.filter((s) => !isAttendanceStatus(map[s.id]));
  if (unmarked.length > 0) return { ok: false, unmarkedCount: unmarked.length, records: [] };
  return { ok: true, unmarkedCount: 0, records: students.map((s) => ({ student: s, status: map[s.id] })) };
}

/**
 * Staff register. Staff with no saved record stay "unmarked" (no status is ever preselected)
 * and only explicitly marked staff are submitted.
 */
export type StaffAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE' | 'HALF_DAY';
export type StaffAttendanceMap = Record<string, StaffAttendanceStatus>;
const STAFF_VALID: StaffAttendanceStatus[] = ['PRESENT', 'ABSENT', 'LEAVE', 'LATE', 'HALF_DAY'];
export const isStaffAttendanceStatus = (v: unknown): v is StaffAttendanceStatus =>
  typeof v === 'string' && (STAFF_VALID as string[]).includes(v);

export const staffKey = (s: { id?: string; employeeId?: string }): string => String(s.id || s.employeeId || '');

export function buildStaffAttendanceMap(
  savedRecords: Array<{ staffId?: string; employeeId?: string; status?: string }>
): StaffAttendanceMap {
  const map: StaffAttendanceMap = {};
  for (const rec of savedRecords || []) {
    const key = rec.staffId || rec.employeeId;
    if (key && isStaffAttendanceStatus(rec.status)) map[key] = rec.status;
  }
  return map;
}

export function buildStaffSubmission<T extends { id?: string; employeeId?: string }>(
  staff: T[],
  map: StaffAttendanceMap
): Array<{ member: T; status: StaffAttendanceStatus }> {
  return staff
    .filter((s) => isStaffAttendanceStatus(map[staffKey(s)]))
    .map((s) => ({ member: s, status: map[staffKey(s)] }));
}

export const countUnmarkedStaff = (staff: Array<{ id?: string; employeeId?: string }>, map: StaffAttendanceMap): number =>
  staff.filter((s) => !isStaffAttendanceStatus(map[staffKey(s)])).length;
