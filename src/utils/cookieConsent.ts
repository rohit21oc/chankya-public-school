import { useSyncExternalStore } from 'react';

/**
 * The visitor's cookie / local-storage choice. "Essential" storage (sign-in session, this choice itself)
 * is always on. Optional: third-party embedded content (the Google Maps frame on the Contact section).
 * The choice is stored on this device only, under CONSENT_KEY, and is asked again if CONSENT_VERSION changes.
 */
export const CONSENT_KEY = 'cps.cookieConsent';
export const CONSENT_VERSION = 1;

export interface ConsentState {
  /** true once the visitor has chosen (accept, essential only, or saved preferences) */
  decided: boolean;
  /** Google Maps and other embedded third-party content */
  embeds: boolean;
  /** ISO time of the choice */
  at?: string;
}

const UNDECIDED: ConsentState = { decided: false, embeds: false };

function read(): ConsentState {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return UNDECIDED;
    const v = JSON.parse(raw);
    if (v?.version !== CONSENT_VERSION) return UNDECIDED;
    return { decided: true, embeds: v.embeds === true, at: typeof v.at === 'string' ? v.at : undefined };
  } catch {
    return UNDECIDED;
  }
}

let state: ConsentState = read();
let panelOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function saveConsent(choice: { embeds: boolean }): void {
  const at = new Date().toISOString();
  state = { decided: true, embeds: choice.embeds, at };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, embeds: choice.embeds, at }));
  } catch {
    // Storage blocked: the choice still applies until the page is closed.
  }
  panelOpen = false;
  emit();
}

/** Footer "Cookie settings": show the choices again. */
export function openCookieSettings(): void {
  panelOpen = true;
  emit();
}

export function closeCookieSettings(): void {
  panelOpen = false;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useConsent(): ConsentState {
  return useSyncExternalStore(subscribe, () => state, () => UNDECIDED);
}

export function useCookiePanelOpen(): boolean {
  return useSyncExternalStore(subscribe, () => panelOpen, () => false);
}
