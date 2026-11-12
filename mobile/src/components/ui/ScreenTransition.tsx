import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Wraps the current screen. When `id` changes (a different screen is opened) the new screen eases in
 * (a short fade and a small slide up) instead of snapping, so moving between Notices, Messages and the
 * rest feels smooth. Runs on the native driver, so it does not compete with the screen loading its data.
 */
export const ScreenTransition: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [id, v]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
};
