/**
 * Teacher qualification fields: one list of subjects (Subject Expertise) and one list of classes
 * (Classes Qualified to Teach). The old "Additional Subjects Handled" field is folded into Subject
 * Expertise, so nothing a teacher was already recorded for is lost.
 * Used by the staff forms (web) and by the server on startup. Checked by scripts/verify-teacher-subjects.ts.
 */

type Loose = Record<string, any>;

const clean = (v: unknown): string => String(v ?? '').trim();

/** Unique, trimmed values in first-seen order, compared case-insensitively. */
export function uniqueNames(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = clean(v);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

const asList = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []);

/** Subject Expertise including anything recorded earlier as Additional Subjects. */
export function unifiedSubjectExpertise(staff: Loose | null | undefined): string[] {
  if (!staff) return [];
  const tp: Loose = staff.teachingProfile || {};
  return uniqueNames([
    ...asList(staff.subjectExpertise),
    ...asList(tp.subjectExpertise),
    ...asList(staff.specializationSubjects),
    ...asList(staff.additionalSubjects),
    ...asList(tp.additionalSubjects),
  ]);
}

/** Classes Qualified to Teach, read from whichever field holds them (array, comma list or teaching profile). */
export function qualifiedClassNames(staff: Loose | null | undefined): string[] {
  if (!staff) return [];
  const tp: Loose = staff.teachingProfile || {};
  return uniqueNames([
    ...asList(staff.qualifiedClasses),
    ...asList(staff.classesQualifiedToTeach),
    ...asList(tp.classesQualifiedToTeach),
  ]);
}

/**
 * Returns the staff record with Additional Subjects merged into Subject Expertise and the qualified
 * classes written consistently. `changed` is true only when something had to be rewritten.
 */
export function migrateTeachingFields<T extends Loose>(staff: T): { staff: T; changed: boolean } {
  const hasLegacy =
    (Array.isArray(staff.additionalSubjects) && staff.additionalSubjects.length > 0) ||
    (Array.isArray(staff.teachingProfile?.additionalSubjects) && staff.teachingProfile.additionalSubjects.length > 0) ||
    'additionalSubjects' in staff ||
    (staff.teachingProfile && 'additionalSubjects' in staff.teachingProfile);
  if (!hasLegacy) return { staff, changed: false };

  const expertise = unifiedSubjectExpertise(staff);
  const next: Loose = { ...staff };
  delete next.additionalSubjects;
  if (expertise.length > 0) {
    next.subjectExpertise = expertise;
    next.specializationSubjects = expertise;
  }
  if (staff.teachingProfile) {
    const tp: Loose = { ...staff.teachingProfile };
    delete tp.additionalSubjects;
    if (expertise.length > 0) tp.subjectExpertise = expertise;
    next.teachingProfile = tp;
  }
  return { staff: next as T, changed: true };
}

// ---------------------------------------------------------------------------------------------------------
// Sections per qualified class
// A teacher qualified for a class teaches only the sections chosen for that class
// (staff.qualifiedClassSections = [{ className, sections: ['A', 'C'] }]). A class with no entry is an older record
// from before sections could be chosen: it keeps covering every active section, exactly as before.
// ---------------------------------------------------------------------------------------------------------

export interface QualifiedClassSections {
  className: string;
  sections: string[];
}

const secKey = (s: unknown) => clean(s).toUpperCase();

/** Active section names of a class (detailed sections when present, else the plain list). */
export function activeSectionNames(cls: { sections?: unknown[]; detailedSections?: Array<{ name: string; status?: string }> } | null | undefined): string[] {
  if (!cls) return [];
  const list =
    Array.isArray(cls.detailedSections) && cls.detailedSections.length > 0
      ? cls.detailedSections.filter((d) => d && (d.status || 'ACTIVE') !== 'INACTIVE').map((d) => d.name)
      : (Array.isArray(cls.sections) ? cls.sections : []).map((s: any) => (typeof s === 'string' ? s : s?.name));
  return uniqueNames(list.map(secKey));
}

/** Cleans what a form sent: only qualified classes, upper-case unique sections, one entry per class. */
export function normalizeQualifiedClassSections(raw: unknown, qualifiedClasses: string[]): QualifiedClassSections[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Map(qualifiedClasses.map((c) => [c.toLowerCase(), c]));
  const out = new Map<string, QualifiedClassSections>();
  for (const item of raw) {
    const name = clean((item as Loose)?.className);
    const canonical = allowed.get(name.toLowerCase());
    if (!canonical) continue;
    const sections = uniqueNames((Array.isArray((item as Loose)?.sections) ? (item as Loose).sections : []).map(secKey)).slice(0, 50);
    out.set(canonical.toLowerCase(), { className: canonical, sections });
  }
  return Array.from(out.values());
}

/**
 * Sections this teacher teaches in one qualified class: the chosen ones (still active), or every active section
 * when nothing was chosen for that class (older records). Returns [] for a class the teacher is not qualified for.
 */
export function qualifiedSectionsForClass(
  staff: Loose | null | undefined,
  cls: { id?: string; name: string; sections?: unknown[]; detailedSections?: Array<{ name: string; status?: string }> }
): string[] {
  if (!staff) return [];
  const qualified = qualifiedClassNames(staff).map((c) => c.toLowerCase());
  if (!qualified.includes(cls.name.toLowerCase()) && !(cls.id && qualified.includes(cls.id.toLowerCase()))) return [];
  const active = activeSectionNames(cls);
  const entries: unknown[] = Array.isArray(staff.qualifiedClassSections) ? staff.qualifiedClassSections : [];
  const entry = entries.find((e: any) => {
    const n = clean(e?.className).toLowerCase();
    return n === cls.name.toLowerCase() || (!!cls.id && n === cls.id.toLowerCase());
  }) as Loose | undefined;
  if (!entry || !Array.isArray(entry.sections)) return active;
  const chosen = new Set(entry.sections.map(secKey));
  return active.filter((s) => chosen.has(s));
}
