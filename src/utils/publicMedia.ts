import { getFileContentUrl } from '../services/apiConfig';

/**
 * Image address for website content (gallery, facilities, hero slides, team photos).
 * Takes the first non-empty value and turns it into a working URL: a storage key, an already
 * built "/api/files/content?key=…" address, an http(s) / data: URL are all handled. Before, the
 * landing page wrapped "/api/files/content?key=…" in a second "/api/files/content?key=", so every
 * uploaded gallery photo pointed at a file that does not exist.
 */
export function mediaSrc(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    const v = typeof c === 'string' ? c.trim() : '';
    if (v) return getFileContentUrl(v) || v;
  }
  return '';
}

/** Website items that are switched on, in the admin's display order. */
export function visibleInOrder<T extends { isActive?: boolean; displayOrder?: number }>(items: T[] | null | undefined): T[] {
  return (Array.isArray(items) ? items : [])
    .filter((x) => x && x.isActive !== false)
    .slice()
    .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
}
