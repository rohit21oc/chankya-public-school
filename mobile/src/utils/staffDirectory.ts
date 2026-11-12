import { isTeachingStaff } from './profileSections';

/** Pure search / filter / summary helpers for the staff directory. */
export type StaffStatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';
export type StaffKindFilter = 'ALL' | 'TEACHING' | 'NON_TEACHING';

export const isActiveStaff = (s: any): boolean => String(s?.status ?? 'ACTIVE').trim().toUpperCase() === 'ACTIVE';

export function filterStaff(
  list: any[],
  f: { query?: string; status?: StaffStatusFilter; kind?: StaffKindFilter; department?: string }
): any[] {
  const q = String(f.query || '').trim().toLowerCase();
  return list
    .filter((s) => {
      if (f.status === 'ACTIVE' && !isActiveStaff(s)) return false;
      if (f.status === 'INACTIVE' && isActiveStaff(s)) return false;
      if (f.kind === 'TEACHING' && !isTeachingStaff(s)) return false;
      if (f.kind === 'NON_TEACHING' && isTeachingStaff(s)) return false;
      if (f.department && String(s.department || 'Other').trim().toLowerCase() !== f.department.trim().toLowerCase()) return false;
      if (q) {
        const hay = [s.name, s.employeeId, s.designation, s.department, s.phone].map((v) => String(v || '').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

export function summarizeStaff(list: any[]) {
  const active = list.filter(isActiveStaff);
  const deps = new Map<string, { name: string; count: number }>();
  for (const s of active) {
    const d = String(s.department || 'Other').trim() || 'Other';
    const entry = deps.get(d.toLowerCase()) || { name: d, count: 0 };
    entry.count += 1;
    deps.set(d.toLowerCase(), entry);
  }
  return {
    total: list.length,
    active: active.length,
    inactive: list.length - active.length,
    teaching: active.filter(isTeachingStaff).length,
    nonTeaching: active.filter((s) => !isTeachingStaff(s)).length,
    departments: Array.from(deps.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
