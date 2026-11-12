import type { AcademicClass } from '../types';

/**
 * The sections a class has, as set up in Academic Structure: its section list plus any detailed
 * section that is not switched off, in order (A, B, C … then others). Used by every form that picks
 * a section, so a class with sections A–E shows all five and a class with only A shows only A.
 */
export function classSectionOptions(cls?: Pick<AcademicClass, 'sections' | 'detailedSections'> | null): string[] {
  if (!cls) return [];
  const inactive = new Set(
    (cls.detailedSections || []).filter((d) => d && d.status === 'INACTIVE').map((d) => String(d.name || '').trim().toUpperCase())
  );
  const names = [
    ...(Array.isArray(cls.sections) ? cls.sections : []),
    ...(cls.detailedSections || []).filter((d) => d && d.status !== 'INACTIVE').map((d) => d.name),
  ]
    .map((s) => String(s ?? '').trim())
    .filter((s) => s && !inactive.has(s.toUpperCase()));
  const seen = new Set<string>();
  const unique = names.filter((s) => {
    const k = s.toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
}

/** The section to keep after the class changes: the current one if the class has it, else its first section. */
export function sectionForClass(cls: Pick<AcademicClass, 'sections' | 'detailedSections'> | null | undefined, current?: string): string {
  const options = classSectionOptions(cls);
  if (!options.length) return current || 'A';
  const match = options.find((s) => s.toUpperCase() === String(current || '').toUpperCase());
  return match || options[0];
}
