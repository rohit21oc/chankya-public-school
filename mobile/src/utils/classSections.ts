/**
 * Section names of one class, exactly as the school set them up in Academics: active sections only, in order,
 * however many there are (Nursery with six sections shows six). When a teacher's class list was already narrowed
 * to their own sections, only those stay. Tested in mobile/test/verify-class-sections.ts.
 */
const up = (v: unknown) => String(v ?? '').trim().toUpperCase();

export function classSectionNames(cls: any): string[] {
  if (!cls) return [];
  const plain: string[] = (Array.isArray(cls.sections) ? cls.sections : [])
    .map((s: any) => (typeof s === 'string' ? s : s?.name))
    .map(up)
    .filter(Boolean);
  const detailed: string[] | null =
    Array.isArray(cls.detailedSections) && cls.detailedSections.length > 0
      ? cls.detailedSections.filter((d: any) => d && (d.status || 'ACTIVE') !== 'INACTIVE').map((d: any) => up(d.name)).filter(Boolean)
      : null;
  const list = detailed ? (plain.length ? plain.filter((p) => detailed.includes(p)) : detailed) : plain;
  const seen = new Set<string>();
  return list
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
