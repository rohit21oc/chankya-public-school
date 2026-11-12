import React, { createContext, useContext } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';

/** True inside a frame that already keeps its content above the keyboard. */
const HandledContext = createContext(false);

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /**
   * Always handle the keyboard here, even inside another frame. Needed for a Modal: it is a separate
   * window, so the frame around the screen does not reach into it.
   */
  own?: boolean;
}

/**
 * Keeps everything inside above the on-screen keyboard (and so scrollable and visible).
 * The whole app is wrapped once (App.tsx); Modals with forms wrap their content in `own`.
 * A frame inside a frame does nothing extra, so a chat screen can use one anywhere.
 */
export const KeyboardFrame: React.FC<Props> = ({ style, children, own }) => {
  const handled = useContext(HandledContext);
  const { ref, inset, measure } = useKeyboardInset();
  const active = own || !handled;
  return (
    <HandledContext.Provider value={true}>
      <View ref={ref} onLayout={measure} collapsable={false} style={[{ flex: 1 }, style, active && inset > 0 ? { paddingBottom: inset } : null]}>
        {children}
      </View>
    </HandledContext.Provider>
  );
};
