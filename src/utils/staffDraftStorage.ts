/** Where half-filled staff forms are kept in the browser (see useStaffDraft). */
export const STAFF_DRAFT_PREFIX = 'pds-staff-draft:v1:';

/** Remove every saved staff draft. Called on sign-out so a shared computer keeps nothing. */
export function clearAllStaffDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STAFF_DRAFT_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
