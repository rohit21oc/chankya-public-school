import type { AcademicClass } from '../types';

export interface InchargeOption {
  /** Stored as `classTeacherOf`, e.g. "Class 5-A". */
  value: string;
  classId: string;
  className: string;
  section: string;
  label: string;
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

function activeSectionNames(cls: AcademicClass): string[] {
  if (Array.isArray(cls.detailedSections) && cls.detailedSections.length > 0) {
    return cls.detailedSections
      .filter((s) => (s.status || 'ACTIVE') !== 'INACTIVE')
      .map((s) => String(s.name).trim())
      .filter(Boolean);
  }
  return (cls.sections || []).map((s) => String(s).trim()).filter(Boolean);
}

/**
 * Class Incharge choices for a teacher: only ACTIVE classes and sections, and only classes the
 * teacher teaches or is already qualified for (`teachingClasses` = class names/ids).
 * The server re-checks the same rule when the staff record is saved.
 */
export function buildInchargeOptions(classes: AcademicClass[], teachingClasses: string[]): InchargeOption[] {
  const allowed = new Set(teachingClasses.map(norm).filter(Boolean));
  if (allowed.size === 0) return [];
  const options: InchargeOption[] = [];
  const ordered = [...classes].sort((a, b) => (a.numericOrder ?? 0) - (b.numericOrder ?? 0));
  for (const cls of ordered) {
    if ((cls.status || 'ACTIVE') === 'INACTIVE') continue;
    if (!allowed.has(norm(cls.id)) && !allowed.has(norm(cls.name))) continue;
    for (const section of activeSectionNames(cls)) {
      options.push({
        value: `${cls.name}-${section}`,
        classId: cls.id,
        className: cls.name,
        section,
        label: `${cls.name} – Section ${section}`,
      });
    }
  }
  return options;
}
