/**
 * "Class 2" / "2" / "Nursery" → "Class 2" / "Class 2" / "Nursery".
 * Avoids "Class Class 2" when the stored class name already starts with "Class",
 * and never invents a class when the record has none.
 */
export function classLabel(className?: string | null): string {
  const name = String(className ?? '').trim();
  if (!name) return 'Class not recorded';
  if (/^class\b/i.test(name)) return name;
  if (/^\d+$/.test(name) || /^[IVXL]+$/i.test(name)) return `Class ${name}`;
  return name;
}

/** "Class 2 - A" style label for a class and optional section. */
export function classSectionLabel(className?: string | null, section?: string | null): string {
  const base = classLabel(className);
  const sec = String(section ?? '').trim();
  return sec ? `${base} - ${sec}` : base;
}
