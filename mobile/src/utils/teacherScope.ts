import type { ClassItem, SubjectItem, User } from '../types';

import type { TeacherAuthorizedAssignments } from '../types/teacher';
import { apiService } from '../services/apiService';
import { scopeClassesForTeacher, scopeSubjectsForTeacher } from './teacherScopeRules';

/**
 * Teacher scoping for pickers (class, section, subject).
 *
 * Fail-closed rule: for a TEACHER, if the server's assignment list cannot be
 * loaded, the picker is EMPTY and an error is returned. The backend still
 * enforces every read and write; this only prevents offering unassigned options.
 */

export interface ScopedClassesResult {
  ok: boolean;
  classes: ClassItem[];
  subjects: SubjectItem[];
  allSubjects?: SubjectItem[];
  assignments?: TeacherAuthorizedAssignments;
  error?: string;
}

/** Loads classes (and optionally subjects) for the user, scoped for teachers. */
export async function loadScopedPickers(user: User, withSubjects = false, inchargeOnly = false): Promise<ScopedClassesResult> {
  if (user.role === 'TEACHER' && inchargeOnly) {
    // Attendance: only the Class Incharge class/section (the server enforces the same rule).
    const [incharge, classRes] = await Promise.all([apiService.getInchargeClasses(), apiService.getClasses()]);
    if (!incharge.ok) {
      return { ok: false, classes: [], subjects: [], error: incharge.error || 'Could not verify your Class Incharge assignment. Please try again.' };
    }
    const scoped = classRes.ok
      ? scopeClassesForTeacher(classRes.data, { allAccess: false, classes: incharge.classes, subjects: [] } as unknown as TeacherAuthorizedAssignments)
      : [];
    return { ok: classRes.ok, classes: scoped, subjects: [], error: classRes.ok ? undefined : classRes.error };
  }
  if (user.role !== 'TEACHER') {
    const [c, s] = await Promise.all([
      apiService.getClasses(),
      withSubjects ? apiService.getSubjects() : Promise.resolve({ ok: true, data: [] as SubjectItem[] } as any),
    ]);
    return {
      ok: c.ok,
      classes: c.ok ? c.data : [],
      subjects: s.ok ? s.data : [],
      allSubjects: s.ok ? s.data : [],
      error: c.ok ? undefined : c.error,
    };
  }

  const [assignRes, classRes, subjectRes] = await Promise.all([
    apiService.getTeacherAuthorizedAssignments(),
    apiService.getClasses(),
    withSubjects ? apiService.getSubjects() : Promise.resolve({ ok: true, data: [] as SubjectItem[] } as any),
  ]);

  if (!assignRes.ok || !assignRes.data) {
    return {
      ok: false,
      classes: [],
      subjects: [],
      error: assignRes.error || 'Could not verify your assigned classes. Please try again.',
    };
  }

  const allSubjects = subjectRes.ok ? subjectRes.data : [];
  return {
    ok: classRes.ok,
    classes: classRes.ok ? scopeClassesForTeacher(classRes.data, assignRes.data) : [],
    subjects: subjectRes.ok ? scopeSubjectsForTeacher(subjectRes.data, assignRes.data) : [],
    allSubjects,
    assignments: assignRes.data,
    error: classRes.ok ? undefined : classRes.error,
  };
}

