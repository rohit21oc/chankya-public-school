import React, { useCallback, useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AnimatedSplash, AppReadyContext } from './src/components/AnimatedSplash';
import { AppUpdatePrompt } from './src/components/AppUpdatePrompt';
import { SystemBarsProvider, useSystemBarsState } from './src/components/SystemBars';
import { FONT_ASSETS } from './src/theme/teacherHome';
import { KeyboardFrame } from './src/components/ui/KeyboardFrame';

// Keep the native splash up until the animated splash (AnimatedSplash) has drawn its first frame.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Android is always edge-to-edge from Expo SDK 54 / target API 36, so the app must leave room for
 * the status bar and gesture/navigation bar itself. This paints a coloured strip behind each bar
 * (navy behind the status bar, as before) and keeps the screens between them. Screens may change
 * the strip with <SystemBars />. iOS already handles its safe areas inside each screen.
 */
function RootFrame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const bars = useSystemBarsState();

  if (Platform.OS !== 'android') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <KeyboardFrame own>{children}</KeyboardFrame>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={bars.style} />
      <View style={{ height: insets.top, backgroundColor: bars.color }} />
      <View style={styles.content}>
        <KeyboardFrame own>{children}</KeyboardFrame>
      </View>
      <View style={{ height: insets.bottom, backgroundColor: bars.bottomColor }} />
    </View>
  );
}

export default function App() {
  // Bundled Outfit / Plus Jakarta Sans. If loading fails the app still renders with system fonts.
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  // The app mounts behind the splash so sign-in restore runs during the animation.
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const markAppReady = useCallback(() => setAppReady(true), []);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // OTA updates are applied at launch by expo-updates (app.json: updates.fallbackToCacheTimeout),
  // so a new JS bundle is already running by the time this screen appears - no JS reload needed.

  return (
    <SafeAreaProvider>
      <SystemBarsProvider>
        <AppReadyContext.Provider value={markAppReady}>
          <View style={styles.root}>
            {(fontsLoaded || !!fontError) && (
              <RootFrame>
                <AppNavigator />
              </RootFrame>
            )}
            {!splashDone && <AnimatedSplash ready={appReady} onFinish={finishSplash} />}
            {splashDone && <AppUpdatePrompt />}
          </View>
        </AppReadyContext.Provider>
      </SystemBarsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
});
