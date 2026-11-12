import type { ClassItem, SubjectItem } from '../types';
import type { TeacherAuthorizedAssignments } from '../types/teacher';

/**
 * Pure scoping rules for teacher pickers. No runtime imports, so these can be
 * unit-tested without the API client or React Native.
 */
const norm = (v?: string) => (v || '').trim().toLowerCase();
const sectionName = (s: string | { id?: string; name: string }) => (typeof s === 'string' ? s : s.name);

export function scopeClassesForTeacher(
  classes: ClassItem[],
  assignments: TeacherAuthorizedAssignments
): ClassItem[] {
  if (assignments.allAccess) return classes;

  const scoped: ClassItem[] = [];
  for (const cls of classes) {
    const match = assignments.classes.find(
      (a) => norm(a.classId) === norm(cls.id) || norm(a.className) === norm(cls.name)
    );
    if (!match) continue;
    const allowed = new Set(match.sections.map(norm));
    const sections = (cls.sections || []).filter((s) => allowed.has(norm(sectionName(s as any))));
    if (sections.length > 0) scoped.push({ ...cls, sections: sections as ClassItem['sections'] });
  }
  return scoped;
}

export function scopeSubjectsForTeacher(
  subjects: SubjectItem[],
  assignments: TeacherAuthorizedAssignments
): SubjectItem[] {
  if (assignments.allAccess) return subjects;
  const allowedIds = new Set(assignments.subjects.map((s) => s.id));
  return subjects.filter((s) => allowedIds.has(s.id));
}

/**
 * Filter subjects specifically for the selected class and section.
 * When detailedAssignments are available from /api/teacher/authorized-assignments,
 * only subjects authorized for this specific class+section are returned.
 */
export function scopeSubjectsForClassAndSection(
  subjects: SubjectItem[],
  assignments: TeacherAuthorizedAssignments,
  classIdOrName: string,
  section?: string
): SubjectItem[] {
  if (assignments.allAccess) return subjects;
  if (!classIdOrName) return [];

  const targetClass = norm(classIdOrName);
  const targetSec = norm(section || 'A');

  if (Array.isArray(assignments.detailedAssignments) && assignments.detailedAssignments.length > 0) {
    const detail = assignments.detailedAssignments.find(
      (d) =>
        (norm(d.classId) === targetClass || norm(d.className) === targetClass) &&
        norm(d.section) === targetSec
    );

    if (detail && Array.isArray(detail.subjects) && detail.subjects.length > 0) {
      const allowedSubjectIds = new Set(detail.subjects.map((s) => norm(s.id)));
      const allowedSubjectNames = new Set(detail.subjects.map((s) => norm(s.name)));
      return subjects.filter(
        (s) => allowedSubjectIds.has(norm(s.id)) || allowedSubjectNames.has(norm(s.name))
      );
    }
    // If no matching detailed assignment for this class/section, teacher is not authorized
    return [];
  }

  // Fallback to general teacher authorized subjects if detailed breakdown was not returned
  return scopeSubjectsForTeacher(subjects, assignments);
}

/**
 * Validates whether the teacher is authorized to teach the specified subject for class & section.
 */
export function isTeacherAuthorizedForSubject(
  assignments: TeacherAuthorizedAssignments,
  classIdOrName: string,
  section: string,
  subjectIdOrName: string
): boolean {
  if (assignments.allAccess) return true;
  const available = scopeSubjectsForClassAndSection(
    [{ id: subjectIdOrName, name: subjectIdOrName }],
    assignments,
    classIdOrName,
    section
  );
  return available.length > 0;
}

