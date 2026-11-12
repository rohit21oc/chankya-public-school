import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, StyleSheet, ActivityIndicator, Vibration, Linking, ScrollView, Image, AppState } from 'react-native';

// The camera is a native module. An app installed before it was added cannot load it, so it is
// loaded defensively and the screen explains that the app needs updating instead of crashing.
let Camera: typeof import('expo-camera') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Camera = require('expo-camera');
} catch {
  Camera = null;
}
const noPermissionHook = (): [null, () => Promise<null>, () => Promise<null>] => [null, async () => null, async () => null];
const useCameraPermissions: () => [any, () => Promise<any>, () => Promise<any>] = (Camera?.useCameraPermissions as any) || noPermissionHook;
import { T } from './teacher-home/T';
import { FONT, TH } from '../theme/teacherHome';
import { apiService, AttendanceScanResult } from '../services/apiService';
import { resolveFileUrl } from '../utils/branding';

/**
 * Full-screen camera that marks today's attendance from an ID card QR.
 *
 * The server decides everything (signature, who may mark whom, today's date,
 * holidays, duplicates); this screen shows its answer. The same card is ignored
 * for a few seconds after a scan, so a card held in front of the camera is sent
 * once. An existing Absent/Leave record is changed only after the user confirms.
 */

type Props = {
  visible: boolean;
  kind: 'STUDENT' | 'STAFF';
  onClose: () => void;
  onMarked?: (r: AttendanceScanResult) => void;
};

type Feedback = { tone: 'success' | 'info' | 'error' | 'confirm'; message: string; result: AttendanceScanResult; code?: string; status?: 'PRESENT' | 'LATE' };

const REPEAT_WINDOW_MS = 4000;
const GREEN = '#067647';
const AMBER = '#B54708';
const RED = '#B42318';

const label = (s?: string) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function detailLine(r: AttendanceScanResult): string {
  const p = r.person;
  if (!p) return '';
  if (r.kind === 'STAFF') return [p.employeeId, p.designation].filter(Boolean).join(' · ');
  return [[p.className, p.section].filter(Boolean).join(' '), p.rollNumber ? `Roll ${p.rollNumber}` : '', p.admissionNumber].filter(Boolean).join(' · ');
}

export const ScanAttendanceModal: React.FC<Props> = ({ visible, kind, onClose, onMarked }) => {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [late, setLate] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recent, setRecent] = useState<AttendanceScanResult[]>([]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const busy = useRef(false);
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const lateRef = useRef(late);
  lateRef.current = late;
  const onMarkedRef = useRef(onMarked);
  onMarkedRef.current = onMarked;

  useEffect(() => {
    if (visible) {
      setFeedback(null);
      last.current = { code: '', at: 0 };
    }
  }, [visible]);
  useEffect(() => setPhotoFailed(false), [feedback?.result.person?.id]);
  // The modal stays mounted with its screen, so the camera permission is read again each time the
  // scanner opens and whenever the app comes back to the front (for example from Android settings).
  const [checking, setChecking] = useState(false);
  const refreshPermission = useCallback(async () => {
    try {
      const p = await getPermission();
      // Not decided yet: show the system prompt straight away.
      if (p && !p.granted && p.canAskAgain && p.status === 'undetermined') await requestPermission();
    } catch {
      /* permission state stays as it was */
    }
  }, [getPermission, requestPermission]);
  useEffect(() => {
    if (!visible) return;
    refreshPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermission();
    });
    return () => sub.remove();
  }, [visible, refreshPermission]);

  /** Ask again; Android settings open only when the system no longer shows the prompt. */
  const allowCamera = useCallback(async () => {
    setChecking(true);
    try {
      const p = await requestPermission();
      if (!p?.granted && p && !p.canAskAgain) await Linking.openSettings();
    } catch {
      Linking.openSettings().catch(() => undefined);
    } finally {
      setChecking(false);
    }
  }, [requestPermission]);

  const send = useCallback(
    async (code: string, opts: { status?: 'PRESENT' | 'LATE'; override?: boolean } = {}) => {
      if (busy.current) return;
      busy.current = true;
      setSending(true);
      const status = opts.status || (lateRef.current ? 'LATE' : 'PRESENT');
      let r: AttendanceScanResult;
      try {
        r = await apiService.scanAttendance({ code, expect: kind, status, override: opts.override });
      } catch {
        r = { ok: false, status: 0, error: 'Could not reach the school server. Check the connection and scan again.' };
      }
      busy.current = false;
      setSending(false);
      if (r.ok) {
        const name = r.person?.name || 'This person';
        const message = r.alreadyMarked
          ? `${name} is already marked ${label(r.markedStatus)} today.`
          : r.corrected
          ? `${name} changed from ${label(r.previousStatus)} to ${label(r.markedStatus)}.`
          : `${name} marked ${label(r.markedStatus)}${r.time ? ` at ${r.time}` : ''}.`;
        setFeedback({ tone: r.alreadyMarked ? 'info' : 'success', message, result: r });
        if (!r.alreadyMarked) setRecent((list) => [r, ...list.filter((x) => x.person?.id !== r.person?.id)].slice(0, 6));
        try {
          Vibration.vibrate(r.alreadyMarked ? 40 : 90);
        } catch {
          /* no vibration */
        }
        onMarkedRef.current?.(r);
      } else if (r.code === 'CONFIRM_OVERRIDE') {
        setFeedback({ tone: 'confirm', message: r.error || 'Already marked today. Change it?', result: r, code, status });
      } else {
        setFeedback({ tone: 'error', message: r.error || 'Attendance could not be marked. Please try again.', result: r });
      }
    },
    [kind]
  );

  const onScanned = useCallback(
    (e: { data?: string }) => {
      const code = String(e?.data || '');
      const now = Date.now();
      if (!code || busy.current) return;
      if (code === last.current.code && now - last.current.at < REPEAT_WINDOW_MS) return;
      last.current = { code, at: now };
      send(code);
    },
    [send]
  );

  const title = kind === 'STAFF' ? 'Scan staff ID card' : 'Scan student ID card';
  const person = feedback?.result.person;
  const photo = person?.photo ? resolveFileUrl(person.photo) : '';
  const tone = feedback?.tone;
  const toneColor = tone === 'success' ? GREEN : tone === 'confirm' ? AMBER : tone === 'error' ? RED : TH.royal;

  let cameraArea: React.ReactNode;
  const CameraView = Camera?.CameraView;
  if (!Camera || !CameraView) {
    cameraArea = (
      <View style={s.center}>
        <T style={s.permTitle}>Update the app to scan cards</T>
        <T style={s.permText}>This installed version of the app does not include the camera scanner. Install the latest version of the school app, then open the scanner again.</T>
      </View>
    );
  } else if (!permission) {
    cameraArea = (
      <View style={s.center}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  } else if (!permission.granted) {
    cameraArea = (
      <View style={s.center}>
        <T style={s.permTitle}>Camera access is needed</T>
        <T style={s.permText}>The camera is used only to read the QR code on the back of ID cards.</T>
        <Pressable style={s.primaryBtn} onPress={allowCamera} disabled={checking} accessibilityRole="button">
          {checking ? <ActivityIndicator color="#FFFFFF" /> : <T style={s.primaryBtnText}>Allow camera</T>}
        </Pressable>
        {!permission.canAskAgain ? (
          <T style={s.permText}>If no prompt appears, open the app settings, choose Permissions, then Camera, then Allow. Come back here and the camera starts.</T>
        ) : null}
      </View>
    );
  } else {
    cameraArea = (
      <View style={{ flex: 1 }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={visible ? onScanned : undefined}
        />
        <View pointerEvents="none" style={s.frameWrap}>
          <View style={s.frame} />
        </View>
        {sending && (
          <View style={s.sendingPill}>
            <ActivityIndicator size="small" color={TH.navy} />
            <T style={s.sendingText}>Marking…</T>
          </View>
        )}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <T style={s.title}>{title}</T>
            <T style={s.subtitle}>Today's attendance is marked. Hold the QR on the back of the card inside the frame.</T>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Close scanner">
            <T style={s.closeText}>Close</T>
          </Pressable>
        </View>

        <View style={s.camera}>{cameraArea}</View>

        <ScrollView style={s.panel} contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Pressable
            onPress={() => setLate((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ selected: late }}
            style={[s.lateChip, late && s.lateChipOn]}
          >
            <View style={[s.box, late && s.boxOn]}>{late ? <View style={s.boxDot} /> : null}</View>
            <T style={[s.lateText, late && { color: AMBER }]}>Mark as Late</T>
          </Pressable>

          {feedback ? (
            <View style={[s.result, { borderColor: toneColor }]} accessibilityLiveRegion="polite">
              {person ? (
                photo && !photoFailed ? (
                  <Image source={{ uri: photo }} style={s.avatar} onError={() => setPhotoFailed(true)} accessible={false} />
                ) : (
                  <View style={[s.avatar, s.avatarFallback]}>
                    <T style={s.avatarText}>{person.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</T>
                  </View>
                )
              ) : null}
              <View style={{ flex: 1 }}>
                <T style={[s.resultTitle, { color: toneColor }]}>{feedback.message}</T>
                {!!person && <T style={s.resultSub}>{detailLine(feedback.result)}</T>}
                {tone === 'confirm' && feedback.code ? (
                  <View style={s.confirmRow}>
                    <Pressable style={s.primaryBtn} disabled={sending} onPress={() => send(feedback.code!, { status: feedback.status, override: true })} accessibilityRole="button">
                      <T style={s.primaryBtnText}>Change to {label(feedback.status)}</T>
                    </Pressable>
                    <Pressable style={s.secondaryBtn} onPress={() => setFeedback(null)} accessibilityRole="button">
                      <T style={s.secondaryBtnText}>Keep {label(feedback.result.previousStatus)}</T>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          ) : permission?.granted ? (
            <T style={s.waiting}>Waiting for a card…</T>
          ) : null}

          {recent.length > 0 && (
            <View>
              <T style={s.recentHead}>Marked in this session</T>
              {recent.map((r) => (
                <View key={r.person?.id} style={s.recentRow}>
                  <T style={s.recentName} numberOfLines={1}>{r.person?.name}</T>
                  <T style={[s.recentStatus, { color: r.markedStatus === 'LATE' ? AMBER : GREEN }]}>
                    {label(r.markedStatus)}
                    {r.time ? ` · ${r.time}` : ''}
                  </T>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 44, paddingBottom: 12, backgroundColor: TH.navy },
  title: { fontFamily: FONT.bold, fontSize: 17, color: '#FFFFFF' },
  subtitle: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 16, color: TH.onNavyMuted, marginTop: 2 },
  closeBtn: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: FONT.semibold, fontSize: 14, color: '#FFFFFF' },
  camera: { height: 340, backgroundColor: '#0B1220' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  permTitle: { fontFamily: FONT.bold, fontSize: 16, color: '#FFFFFF', textAlign: 'center' },
  permText: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18, color: '#CBD5E1', textAlign: 'center' },
  frameWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 220, height: 220, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF' },
  sendingPill: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  sendingText: { fontFamily: FONT.semibold, fontSize: 12, color: TH.navy },
  panel: { flex: 1 },
  lateChip: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: TH.border, alignSelf: 'flex-start' },
  lateChipOn: { borderColor: AMBER, backgroundColor: '#FFFAEB' },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: AMBER },
  boxDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: AMBER },
  lateText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  result: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, backgroundColor: '#FFFFFF' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E2E8F0' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT.bold, fontSize: 15, color: TH.navy },
  resultTitle: { fontFamily: FONT.bold, fontSize: 14, lineHeight: 19 },
  resultSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, marginTop: 2 },
  confirmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  primaryBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: TH.royal, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: FONT.semibold, fontSize: 14, color: '#FFFFFF' },
  secondaryBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: TH.border, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  waiting: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  recentHead: { fontFamily: FONT.semibold, fontSize: 12, color: TH.muted, marginBottom: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: TH.border },
  recentName: { flex: 1, fontFamily: FONT.medium, fontSize: 14, color: TH.ink },
  recentStatus: { fontFamily: FONT.semibold, fontSize: 12 },
});
