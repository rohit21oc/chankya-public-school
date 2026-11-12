import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { T } from './teacher-home/T';
import { FONT, TH } from '../theme/teacherHome';
import { apiService } from '../services/apiService';
import { decideAppUpdate, installedBuildNumber, type AppUpdateDecision } from '../utils/appUpdate';

/**
 * "New update available" popup. On every app start and every return to the foreground (at most every
 * 10 minutes) it asks the school server for the newest Play Store build. If this phone's build is older, the
 * popup shows — again on every open until the app is updated. "Later" hides it only until the next open; below
 * the required version there is no "Later".
 */
const RECHECK_MS = 10 * 60 * 1000;

export const AppUpdatePrompt: React.FC = () => {
  const [decision, setDecision] = useState<AppUpdateDecision | null>(null);
  const lastCheck = useRef(0);
  const dismissedThisOpen = useRef(false);

  const check = useCallback(async (force = false) => {
    if (Platform.OS !== 'android') return;
    if (!force && Date.now() - lastCheck.current < RECHECK_MS) return;
    lastCheck.current = Date.now();
    try {
      const res = await fetch(`${apiService.getBaseUrl()}/api/app/version`, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const d = decideAppUpdate(installedBuildNumber(Constants as any), data?.android);
      if (!d.show) { setDecision(null); return; }
      if (dismissedThisOpen.current && !d.force) return;
      setDecision(d);
    } catch {
      // offline: try again next time the app opens
    }
  }, []);

  useEffect(() => {
    void check(true);
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      // A fresh "open" = coming back from the background; the popup may show again then.
      if (prev.match(/inactive|background/) && next === 'active') {
        dismissedThisOpen.current = false;
        void check(false);
      }
      prev = next;
    });
    return () => sub.remove();
  }, [check]);

  const openStore = useCallback(async () => {
    if (!decision) return;
    const market = `market://details?id=${decision.packageName}`;
    try {
      await Linking.openURL(market);
    } catch {
      await Linking.openURL(decision.storeUrl).catch(() => undefined);
    }
  }, [decision]);

  if (!decision) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (!decision.force) { dismissedThisOpen.current = true; setDecision(null); } }}>
      <View style={s.backdrop}>
        <View style={s.card} accessibilityRole="alert">
          <View style={s.badge}><T style={s.badgeText}>⬆</T></View>
          <T style={s.title}>New update available</T>
          <T style={s.body}>
            {decision.message || 'A new version of the school app is available with improvements and fixes. Please update to continue getting the latest features.'}
          </T>
          {!!decision.versionLabel && <T style={s.version}>{decision.versionLabel}</T>}
          <Pressable style={s.primary} onPress={openStore} accessibilityRole="button" accessibilityLabel="Update the app now">
            <T style={s.primaryText}>Update now</T>
          </Pressable>
          {!decision.force && (
            <Pressable
              style={s.secondary}
              onPress={() => { dismissedThisOpen.current = true; setDecision(null); }}
              accessibilityRole="button"
              accessibilityLabel="Remind me later"
            >
              <T style={s.secondaryText}>Later</T>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,75,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, alignItems: 'center', gap: 10 },
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 26, color: TH.royal },
  title: { fontFamily: FONT.bold, fontSize: 19, color: TH.ink, textAlign: 'center' },
  body: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: TH.muted, textAlign: 'center' },
  version: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  primary: { alignSelf: 'stretch', minHeight: 48, borderRadius: 14, backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryText: { fontFamily: FONT.bold, fontSize: 16, color: '#FFFFFF' },
  secondary: { alignSelf: 'stretch', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: FONT.semibold, fontSize: 15, color: TH.muted },
});
