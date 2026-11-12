export type BackAction = 'close-drawer' | 'go-back' | 'go-dashboard' | 'exit-app';

const MAX_HISTORY = 30;

export function resolveBackAction(opts: { isAuthenticated: boolean; isDrawerOpen: boolean; currentScreenId: string; historyLength?: number }): BackAction {
  if (!opts.isAuthenticated) return 'exit-app';
  if (opts.isDrawerOpen) return 'close-drawer';
  if (opts.currentScreenId !== 'dashboard') return (opts.historyLength || 0) > 0 ? 'go-back' : 'go-dashboard';
  return 'exit-app';
}

/** History after opening `to` from `from`. Opening the dashboard starts over; a screen already in the trail is not stacked twice. */
export function nextHistory(history: string[], from: string, to: string): string[] {
  if (to === 'dashboard') return [];
  if (from === 'dashboard' && history.length === 0) return [];
  const base = history[history.length - 1] === from ? history : [...history, from];
  return base.slice(-MAX_HISTORY);
}

/** One step back: the previous screen, or the dashboard when there is nothing before. */
export function stepBack(history: string[]): { screen: string; history: string[] } {
  if (!history.length) return { screen: 'dashboard', history: [] };
  const screen = history[history.length - 1];
  return { screen, history: history.slice(0, -1) };
}
