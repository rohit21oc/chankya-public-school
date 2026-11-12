import React from 'react';
import { Platform, View, ViewProps } from 'react-native';
import { SafeAreaView as NativeSafeAreaView, type Edge } from 'react-native-safe-area-context';

/**
 * Screen-level safe area.
 *
 * Android: App.tsx (`RootFrame`) already reserves the status bar and the gesture / navigation bar, so screens
 * must not add those insets again. The native SafeAreaView measures its position once; when it measured before
 * the frame had its final size it kept a status-bar-high gap above the bottom tab bar and a second gap under the
 * screen (the white band teachers saw above the tabs). On Android this is therefore a plain View.
 * iOS: the root frame does not pad, so the real SafeAreaView is used.
 *
 * Modals are separate windows: keep using react-native-safe-area-context's SafeAreaView inside a Modal.
 */
export const SafeAreaView: React.FC<ViewProps & { edges?: readonly Edge[] }> = ({ edges, ...props }) =>
  Platform.OS === 'android' ? <View {...props} /> : <NativeSafeAreaView edges={edges} {...props} />;
