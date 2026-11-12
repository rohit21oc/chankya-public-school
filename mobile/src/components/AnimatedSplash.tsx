import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { BRAND_COLORS } from '../utils/branding';

// The school crest, bundled with the app (exactly the supplied logo, no redrawing).
const LOGO = require('../../assets/school-logo.png');

const LOGO_SIZE = 200;
const BAR_WIDTH = 120;
/** The crest stays on screen at least this long so the animation can be seen. */
const MIN_VISIBLE_MS = 2200;
/** Never hold the user on the splash longer than this, even if sign-in restore is slow. */
const MAX_WAIT_MS = 6000;

/** AppNavigator calls this once the saved sign-in has been restored; the splash then leaves. */
export const AppReadyContext = createContext<() => void>(() => {});
export const useAppReady = () => useContext(AppReadyContext);

type Props = {
  /** True once the app behind the splash has something to show. */
  ready: boolean;
  onFinish: () => void;
};

/**
 * Animated launch screen shown right after the native splash (same white background and logo
 * position, so the hand-over is seamless): the crest settles in with a spring, golden rings
 * pulse behind it, a light sweep crosses it and a gold progress line fills underneath.
 */
export const AnimatedSplash: React.FC<Props> = ({ ready, onFinish }) => {
  const startedAt = useRef(Date.now()).current;
  const nativeHidden = useRef(false);
  const finished = useRef(false);
  const [forced, setForced] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  const hideNativeSplash = useCallback(() => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    // Safety net: never leave the native splash up if layout never fires.
    const safetyHide = setTimeout(hideNativeSplash, 1500);
    const giveUp = setTimeout(() => setForced(true), MAX_WAIT_MS);

    Animated.spring(enter, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }).start();
    Animated.timing(tagline, {
      toValue: 1,
      duration: 600,
      delay: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(progress, {
      toValue: 1,
      duration: MIN_VISIBLE_MS - 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // animates width
    }).start();

    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const pulseA = pulse(ringA, 0);
    const pulseB = pulse(ringB, 750);
    pulseA.start();
    pulseB.start();

    const sweep = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(shine, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    sweep.start();

    return () => {
      clearTimeout(safetyHide);
      clearTimeout(giveUp);
      pulseA.stop();
      pulseB.stop();
      sweep.stop();
    };
  }, [enter, hideNativeSplash, progress, ringA, ringB, shine, tagline]);

  const canLeave = ready || forced;
  useEffect(() => {
    if (!canLeave) return undefined;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
    const timer = setTimeout(() => {
      Animated.timing(exit, {
        toValue: 1,
        duration: 380,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (finished.current) return;
        finished.current = true;
        onFinish();
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [canLeave, exit, onFinish, startedAt]);

  const logoScale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
    exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }),
  );
  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
  });
  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-LOGO_SIZE * 0.9, LOGO_SIZE * 1.3] });

  return (
    <Animated.View
      style={[styles.root, { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
      onLayout={hideNativeSplash}
      pointerEvents="auto"
      accessible
      accessibilityLabel="Residential PDS Public School Sheohar"
    >
      <StatusBar style="dark" />

      <Animated.View style={[styles.ring, ringStyle(ringA)]} />
      <Animated.View style={[styles.ring, ringStyle(ringB)]} />

      <Animated.View style={[styles.logoClip, { transform: [{ scale: logoScale }] }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Animated.View style={[styles.shine, { transform: [{ translateX: shineX }, { rotate: '18deg' }] }]} />
      </Animated.View>

      <Animated.View style={[styles.bottom, { opacity: tagline }]}>
        <Text style={styles.tagline}>DIGITAL CAMPUS</Text>
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_WIDTH] }) }]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 2,
    borderColor: BRAND_COLORS.accentGold,
  },
  logoClip: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    overflow: 'hidden',
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  shine: {
    position: 'absolute',
    top: -LOGO_SIZE * 0.3,
    width: 56,
    height: LOGO_SIZE * 1.6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  bottom: {
    position: 'absolute',
    bottom: 72,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '600',
    color: BRAND_COLORS.primary,
    opacity: 0.7,
    marginBottom: 14,
  },
  track: {
    width: BAR_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND_COLORS.borderColor,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND_COLORS.accentGold,
  },
});
