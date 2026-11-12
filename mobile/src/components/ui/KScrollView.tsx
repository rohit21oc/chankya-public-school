import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { findNodeHandle, ScrollView, ScrollViewProps, TextInput } from 'react-native';
import { useKeyboard } from '../../hooks/useKeyboardInset';

/**
 * A ScrollView that scrolls the field being typed in above the keyboard. Use it instead of
 * ScrollView on any screen with text boxes. It works together with <KeyboardFrame>, which shrinks
 * the screen to the space above the keyboard; this brings the focused box into that space.
 */
export const KScrollView = forwardRef<ScrollView, ScrollViewProps>((props, fwd) => {
  const ref = useRef<ScrollView>(null);
  useImperativeHandle(fwd, () => ref.current as ScrollView);
  const offset = useRef(0);
  const height = useRef(0);
  const kb = useKeyboard();

  const reveal = useCallback(() => {
    const input = TextInput.State?.currentlyFocusedInput?.();
    const node = findNodeHandle(ref.current);
    if (!input || !node || !height.current) return;
    input.measureLayout(
      node,
      (_x, y, _w, h) => {
        const margin = 28;
        const top = offset.current;
        const bottom = top + height.current;
        if (y + h + margin > bottom) ref.current?.scrollTo({ y: Math.max(0, y + h + margin - height.current), animated: true });
        else if (y - margin < top) ref.current?.scrollTo({ y: Math.max(0, y - margin), animated: true });
      },
      () => undefined // the focused box is not inside this scroll view
    );
  }, []);

  // Keyboard opened: bring the focused box into view once the screen has resized.
  useEffect(() => {
    if (!kb || props.horizontal) return;
    const t = setTimeout(reveal, 220);
    return () => clearTimeout(t);
  }, [kb, reveal, props.horizontal]);

  return (
    <ScrollView
      {...props}
      ref={ref}
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
      onScroll={(e) => {
        offset.current = e.nativeEvent.contentOffset.y;
        props.onScroll?.(e);
      }}
      onLayout={(e) => {
        height.current = e.nativeEvent.layout.height;
        props.onLayout?.(e);
        if (kb) setTimeout(reveal, 60);
      }}
    />
  );
});
KScrollView.displayName = 'KScrollView';
