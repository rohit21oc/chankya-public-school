import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STAFF_DRAFT_PREFIX as PREFIX } from '../../../utils/staffDraftStorage';

/**
 * Keeps a half-filled staff form so it is not lost if the page is closed, refreshed or the session ends.
 * - Saved in this browser only (never sent to the server), under the signed-in user's ID.
 * - The temporary password is never saved.
 * - A draft older than 14 days is dropped. It is removed when the staff member is saved, when the person
 *   discards it, and when they sign out.
 */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const NEVER_SAVED = new Set(['initialPassword']);

export type DraftFields = Record<string, readonly [unknown, (value: any) => void]>;

interface StoredDraft {
  savedAt: number;
  values: Record<string, unknown>;
}

const safeStorage = {
  get(key: string): string | null {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): boolean {
    try { window.localStorage.setItem(key, value); return true; } catch { return false; }
  },
  remove(key: string) {
    try { window.localStorage.removeItem(key); } catch { /* storage unavailable */ }
  },
};

function readDraft(key: string): StoredDraft | null {
  const raw = safeStorage.get(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || typeof parsed.savedAt !== 'number' || typeof parsed.values !== 'object' || !parsed.values) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      safeStorage.remove(key);
      return null;
    }
    return parsed;
  } catch {
    safeStorage.remove(key);
    return null;
  }
}

export function useStaffDraft(fields: DraftFields, userId: string) {
  const key = `${PREFIX}${userId || 'anonymous'}`;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const snapshot = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const name of Object.keys(fieldsRef.current)) {
      if (!NEVER_SAVED.has(name)) out[name] = fieldsRef.current[name][0];
    }
    return out;
  };

  // What the empty form looks like, so an untouched form is never saved as a "draft".
  const pristine = useRef<string>(JSON.stringify(snapshot()));
  const [pending, setPending] = useState<StoredDraft | null>(() => readDraft(key));
  const [enabled, setEnabled] = useState(() => !readDraft(key));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);

  const current = useMemo(() => JSON.stringify(snapshot()), [fields]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = useRef(current);
  latest.current = current;

  const write = useCallback(() => {
    if (latest.current === pristine.current) {
      safeStorage.remove(key);
      setSavedAt(null);
      return;
    }
    const stored: StoredDraft = { savedAt: Date.now(), values: JSON.parse(latest.current) };
    if (safeStorage.set(key, JSON.stringify(stored))) {
      setSavedAt(stored.savedAt);
      setStorageFailed(false);
    } else {
      setStorageFailed(true);
    }
  }, [key]);

  // Save a moment after the person stops typing.
  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(write, 600);
    return () => window.clearTimeout(t);
  }, [current, enabled, write]);

  // Save immediately when the tab is hidden or closed.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => write();
    const onVisibility = () => { if (document.visibilityState === 'hidden') write(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, write]);

  const restore = useCallback(() => {
    if (!pending) return;
    for (const name of Object.keys(pending.values)) {
      const value = pending.values[name];
      const entry = fieldsRef.current[name];
      if (!entry || NEVER_SAVED.has(name)) continue;
      const [existing, setter] = entry;
      // Ignore anything whose type no longer matches the form (an older draft after an app update).
      if (value === null || value === undefined) continue;
      if (typeof existing !== typeof value || Array.isArray(existing) !== Array.isArray(value)) {
        if (!(existing === '' && typeof value === 'number')) continue;
      }
      setter(value);
    }
    setSavedAt(pending.savedAt);
    setPending(null);
    setEnabled(true);
  }, [pending]);

  const discard = useCallback(() => {
    safeStorage.remove(key);
    setPending(null);
    setSavedAt(null);
    setEnabled(true);
  }, [key]);

  /** Call after the staff member is saved. Stops saving for good on this page. */
  const clear = useCallback(() => {
    safeStorage.remove(key);
    setEnabled(false);
    setPending(null);
    setSavedAt(null);
  }, [key]);

  return {
    pendingDraft: pending ? { savedAt: pending.savedAt, name: String(pending.values.fullName || '') } : null,
    savedAt,
    storageFailed,
    restore,
    discard,
    clear,
  };
}

export function formatDraftTime(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}
