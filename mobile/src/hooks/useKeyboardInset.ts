import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';

export type KeyboardEdge = { top: number; height: number };

/** Current on-screen keyboard (null when hidden). Shared by every screen through Keyboard events. */
export function useKeyboard(): KeyboardEdge | null {
  const [kb, setKb] = useState<KeyboardEdge | null>(null);
  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEv, (e) => setKb({ top: e.endCoordinates.screenY, height: e.endCoordinates.height }));
    const b = Keyboard.addListener(hideEv, () => setKb(null));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return kb;
}

/** True while the keyboard is open (used to hide bottom bars so the form gets the room). */
export const useKeyboardVisible = () => !!useKeyboard();

/**
 * How many pixels of the given container the on-screen keyboard covers.
 *
 * Android (Expo SDK 54) draws edge-to-edge, so the window does not shrink for the keyboard and
 * KeyboardAvoidingView is not reliable across devices. This measures the container against the
 * keyboard's top edge instead: if the system already resized the window the overlap is 0 and
 * nothing is added; if the keyboard sits on top, the overlap is returned so the screen can pad itself.
 *
 * Usage: put `ref` and `onLayout` on a flex:1 container and give it `paddingBottom: inset`.
 */
export function useKeyboardInset() {
  const ref = useRef<View>(null);
  const kb = useKeyboard();
  const [inset, setInset] = useState(0);

  const measure = useCallback(() => {
    if (!kb) return setInset(0);
    ref.current?.measureInWindow((_x, y, _w, h) => {
      if (typeof y !== 'number' || typeof h !== 'number') return;
      setInset(Math.max(0, Math.round(y + h - kb.top)));
    });
  }, [kb]);

  useEffect(() => {
    if (!kb) return setInset(0);
    // Let the layout settle after the keyboard animation, then measure.
    const t = setTimeout(measure, 30);
    return () => clearTimeout(t);
  }, [kb, measure]);

  return { ref, inset, keyboardShown: !!kb, kb, measure };
}
