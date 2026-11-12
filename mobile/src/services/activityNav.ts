/**
 * The bell and the badges need to open a screen without knowing which portal is on show.
 * Each portal (staff, parent, student) registers how it opens "messages", "notices" or "fees".
 */
export type ActivityTarget = 'messages' | 'notices' | 'fees' | 'enquiries';

let navigator: ((target: ActivityTarget) => void) | null = null;

export function setActivityNavigator(fn: ((target: ActivityTarget) => void) | null) {
  navigator = fn;
}

export function openActivityTarget(target: ActivityTarget) {
  navigator?.(target);
}
