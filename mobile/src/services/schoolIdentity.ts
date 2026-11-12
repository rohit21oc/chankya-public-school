import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { apiService } from './apiService';

/**
 * The school's identity for the app, from the saved School Settings on the server
 * (the single source of truth). The last copy is kept on the phone so headers do not
 * flash empty on start; it is refreshed on start, when the app returns to the
 * foreground (at most every 5 minutes) and after settings change. Nothing is invented:
 * a value that is not saved stays empty and screens show NOT_CONFIGURED or hide it.
 */
export { NOT_CONFIGURED, toIdentity, affiliationLine, getSchoolIdentity } from '../utils/schoolIdentityModel';
export type { SchoolIdentity } from '../utils/schoolIdentityModel';
import { SchoolIdentity, getSchoolIdentity, setSchoolIdentity, subscribeSchoolIdentity, toIdentity } from '../utils/schoolIdentityModel';

const STORE_KEY = 'cps_school_identity_v1';
let lastFetch = 0;
let inflight: Promise<void> | null = null;

function store(): { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const S = require('expo-secure-store');
    if (S?.getItemAsync) return { get: (k) => S.getItemAsync(k), set: (k, v) => S.setItemAsync(k, v) };
  } catch {}
  return null;
}

const publish = setSchoolIdentity;

let restored = false;
async function restore() {
  if (restored) return;
  restored = true;
  try {
    const raw = await store()?.get(STORE_KEY);
    if (raw && !getSchoolIdentity().name) publish({ ...toIdentity(null), ...JSON.parse(raw) });
  } catch {}
}

/** Fetch the saved settings now (or when stale). */
export function refreshSchoolIdentity(force = false): Promise<void> {
  if (!force && Date.now() - lastFetch < 5 * 60 * 1000 && getSchoolIdentity().name) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    await restore();
    const r = await apiService.getSchoolSettings();
    if (r.ok && r.data) {
      lastFetch = Date.now();
      const id = toIdentity(r.data);
      publish(id);
      try {
        await store()?.set(STORE_KEY, JSON.stringify(id));
      } catch {}
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

let appStateHooked = false;
/** React hook: the current school identity; loads it on first use. */
export function useSchoolIdentity(): SchoolIdentity {
  const [id, setId] = useState<SchoolIdentity>(getSchoolIdentity());
  useEffect(() => {
    const unsubscribe = subscribeSchoolIdentity(setId);
    void refreshSchoolIdentity();
    if (!appStateHooked) {
      appStateHooked = true;
      AppState.addEventListener('change', (st) => {
        if (st === 'active') void refreshSchoolIdentity();
      });
    }
    return () => {
      unsubscribe();
    };
  }, []);
  return id;
}
