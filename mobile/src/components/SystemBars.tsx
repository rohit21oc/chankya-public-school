import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BRAND_COLORS } from '../utils/branding';

/**
 * Android 15+ (and Expo SDK 54 / target API 36) always draws the app edge-to-edge, so the
 * status bar and gesture/navigation bar areas belong to the app. `RootFrame` in App.tsx paints
 * those two strips; screens that want a different status bar look call <SystemBars /> to
 * change the strip colour and icon style while they are mounted.
 */
export type SystemBarsState = {
  /** Background of the strip behind the status bar. */
  color: string;
  /** Status bar icon style: "light" = white icons (for dark backgrounds). */
  style: 'light' | 'dark';
  /** Background of the strip behind the gesture / navigation bar. */
  bottomColor: string;
};

export const DEFAULT_SYSTEM_BARS: SystemBarsState = {
  color: BRAND_COLORS.primary,
  style: 'light',
  bottomColor: '#F8FAFC',
};

type SystemBarsContextValue = {
  state: SystemBarsState;
  setBars: (next: Partial<SystemBarsState>) => void;
  resetBars: () => void;
};

const SystemBarsContext = createContext<SystemBarsContextValue>({
  state: DEFAULT_SYSTEM_BARS,
  setBars: () => {},
  resetBars: () => {},
});

export const SystemBarsProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<SystemBarsState>(DEFAULT_SYSTEM_BARS);
  const setBars = useCallback((next: Partial<SystemBarsState>) => {
    setState((prev) => ({ ...DEFAULT_SYSTEM_BARS, ...prev, ...next }));
  }, []);
  const resetBars = useCallback(() => setState(DEFAULT_SYSTEM_BARS), []);
  const value = useMemo(() => ({ state, setBars, resetBars }), [state, setBars, resetBars]);
  return <SystemBarsContext.Provider value={value}>{children}</SystemBarsContext.Provider>;
};

export const useSystemBarsState = () => useContext(SystemBarsContext).state;

type SystemBarsProps = Partial<SystemBarsState>;

/** Renders nothing. While mounted it sets the status / navigation bar strips; resets on unmount. */
export const SystemBars = ({ color, style, bottomColor }: SystemBarsProps) => {
  const { setBars, resetBars } = useContext(SystemBarsContext);
  useEffect(() => {
    const next: Partial<SystemBarsState> = {};
    if (color) next.color = color;
    if (style) next.style = style;
    if (bottomColor) next.bottomColor = bottomColor;
    setBars(next);
    return resetBars;
  }, [color, style, bottomColor, setBars, resetBars]);
  return null;
};
