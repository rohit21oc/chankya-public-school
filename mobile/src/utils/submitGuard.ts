/**
 * Synchronous in-flight guard. React state updates are async, so two quick taps
 * can both read `saving === false`; a ref-backed guard closes that window.
 */
export interface SubmitGuard {
  tryEnter(): boolean;
  leave(): void;
}

export function createSubmitGuard(): SubmitGuard {
  let busy = false;
  return {
    tryEnter() {
      if (busy) return false;
      busy = true;
      return true;
    },
    leave() {
      busy = false;
    },
  };
}
