import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, Pressable, Animated, Dimensions, StyleSheet, AccessibilityInfo } from 'react-native';
import { T } from './teacher-home/T';
import { FONT } from '../theme/teacherHome';
import { QrCodeView } from './QrCodeView';
import { resolveFileUrl, SCHOOL_INFO } from '../utils/branding';
import { IdCardModel, IdCardRow, NOT_RECORDED } from '../utils/idCardModel';

/**
 * Student / staff ID card, same design as the website card (340 x 540 design
 * units, scaled to the screen). Tap to turn it over: a rotateY + opacity swap on
 * the native driver, skipped when the phone asks for reduced motion.
 * The waves are drawn with plain Views (no SVG library in the app).
 */
const NAVY = '#0B1F4B';
const NAVY_DEEP = '#081638';
const BLUE = '#1F6FD8';
const BLUE_LIGHT = '#5AA2F0';
const GOLD = '#F4B400';
const INK = '#0F172A';
const LINE = '#C7D0DC';
const DESIGN_W = 340;
const DESIGN_H = 540;

interface Props {
  model: IdCardModel;
  side: 'front' | 'back';
  onToggle: () => void;
  maxWidth?: number;
}

export const IdCard: React.FC<Props> = ({ model, side, onToggle, maxWidth = 380 }) => {
  const winW = Dimensions.get('window').width;
  const cardW = Math.min(Math.max(winW - 32, 280), maxWidth);
  const k = cardW / DESIGN_W;
  const cardH = Math.round(DESIGN_H * k);
  const n = (v: number) => Math.round(v * k * 100) / 100;
  const st = useMemo(() => makeStyles(k), [k]);

  const [photoFailed, setPhotoFailed] = useState(false);
  const [sigFailed, setSigFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [model.photoKey]);
  useEffect(() => setSigFailed(false), [model.signatureKey]);

  const progress = useRef(new Animated.Value(side === 'back' ? 1 : 0)).current;
  useEffect(() => {
    let cancelled = false;
    const to = side === 'back' ? 1 : 0;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) progress.setValue(to);
        else Animated.timing(progress, { toValue: to, duration: 420, useNativeDriver: true }).start();
      });
    return () => {
      cancelled = true;
    };
  }, [side, progress]);

  const frontFace = {
    opacity: progress.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] }),
    transform: [{ perspective: 1200 }, { rotateY: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
  };
  const backFace = {
    opacity: progress.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] }),
    transform: [{ perspective: 1200 }, { rotateY: progress.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }],
  };

  const logoUri = resolveFileUrl(model.logoKey || SCHOOL_INFO.canonicalLogoKey);
  const photoUri = model.photoKey ? resolveFileUrl(model.photoKey) : null;
  const sigUri = model.signatureKey ? resolveFileUrl(model.signatureKey) : null;
  const isBack = side === 'back';
  const kindLabel = model.kind === 'STAFF' ? 'Staff ID card' : 'Student ID card';
  const photoSize = model.kind === 'STAFF' ? 140 : 132;

  const BottomWave = () => (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[st.bottomWave, { width: n(408), height: n(408), borderRadius: n(204), left: n(119) - n(204), top: DESIGN_H * k - n(50) }]} />
      <View style={[st.bottomWave, { width: n(408), height: n(408), borderRadius: n(204), left: n(330) - n(204), top: DESIGN_H * k - n(38) }]} />
      <View style={[st.stripe, { width: n(140), right: n(44), bottom: n(28), backgroundColor: BLUE_LIGHT }]} />
      <View style={[st.stripe, { width: n(120), right: n(18), bottom: n(19), backgroundColor: BLUE }]} />
    </View>
  );

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${kindLabel} of ${model.name}, ${isBack ? 'back' : 'front'} side. Tap to show the ${isBack ? 'front' : 'back'}.`}
      style={{ width: cardW, height: cardH, alignSelf: 'center' }}
    >
      {/* FRONT */}
      <Animated.View style={[st.face, { width: cardW, height: cardH }, frontFace]} pointerEvents={isBack ? 'none' : 'auto'} importantForAccessibility={isBack ? 'no-hide-descendants' : 'auto'}>
        {/* blue side waves, drawn first so the header covers their top ends */}
        <View pointerEvents="none" style={[st.waveBlock, { left: n(-44), top: n(104), backgroundColor: BLUE, transform: [{ rotate: '-18deg' }] }]} />
        <View pointerEvents="none" style={[st.waveBlockThin, { left: n(-30), top: n(104), backgroundColor: BLUE_LIGHT, transform: [{ rotate: '-18deg' }] }]} />
        <View pointerEvents="none" style={[st.waveBlock, { right: n(-44), top: n(104), backgroundColor: BLUE, transform: [{ rotate: '18deg' }] }]} />
        <View pointerEvents="none" style={[st.waveBlockThin, { right: n(-30), top: n(104), backgroundColor: BLUE_LIGHT, transform: [{ rotate: '18deg' }] }]} />
        <View style={st.frontHeader}>
          <View style={st.headerRow}>
            <View style={st.logoRing}>
              <Image source={{ uri: logoUri }} style={st.logo} resizeMode="contain" accessible={false} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={st.schoolName} numberOfLines={2}>{model.schoolName}</T>
              <T style={st.affiliation} numberOfLines={1}>{model.board ? `${model.board} ` : ''}AFFILIATION CODE: {model.affiliationCode}</T>
              <T style={st.address} numberOfLines={1}>{model.schoolAddress}</T>
            </View>
          </View>
        </View>
        <View style={st.ribbon}>
          <T style={st.ribbonText} numberOfLines={1}>{model.title}</T>
        </View>

        <View style={[st.body, { top: n(150) }]}>
          <View style={{ width: n(photoSize), height: n(photoSize) }}>
            <View style={[st.photoRing, { width: n(photoSize), height: n(photoSize), borderRadius: n(photoSize / 2) }]}>
              {photoUri && !photoFailed ? (
                <Image source={{ uri: photoUri }} style={st.photoImg} resizeMode="cover" onError={() => setPhotoFailed(true)} accessible={false} />
              ) : (
                <T style={[st.initials, { fontSize: n(photoSize * 0.32) }]}>{model.initials}</T>
              )}
            </View>
            {!!model.bloodGroup && (
              <View style={st.blood} accessibilityLabel={`Blood group ${model.bloodGroup}`}>
                <View style={st.drop} />
                <T style={st.bloodText}>{model.bloodGroup}</T>
              </View>
            )}
          </View>
          <View style={{ alignItems: 'center', width: n(312) }}>
            <T style={[st.name, model.name.length > 22 && { fontSize: n(17), lineHeight: n(21) }]} numberOfLines={2}>
              {model.name}
            </T>
            {!!model.designation && (
              <T style={st.designation} numberOfLines={2}>
                DESIGNATION: <T style={{ fontFamily: FONT.semibold }}>{model.designation.toUpperCase()}</T>
              </T>
            )}
          </View>
          <Table rows={model.frontRows} width={n(270)} labelWidth={n(104)} st={st} lines={1} />
        </View>
        <BottomWave />
      </Animated.View>

      {/* BACK */}
      <Animated.View style={[st.face, { width: cardW, height: cardH }, backFace]} pointerEvents={isBack ? 'auto' : 'none'} importantForAccessibility={isBack ? 'auto' : 'no-hide-descendants'}>
        <View pointerEvents="none" style={[st.backArc, { width: cardW, height: cardW, borderRadius: cardW / 2, top: n(102) - cardW, backgroundColor: BLUE }]} />
        <View pointerEvents="none" style={[st.backArc, { width: cardW, height: cardW, borderRadius: cardW / 2, top: n(96) - cardW, backgroundColor: NAVY }]} />
        <View style={[st.headerRow, { position: 'absolute', top: n(22), left: n(22), right: n(18) }]}>
          <View style={st.logoRing}>
            <Image source={{ uri: logoUri }} style={st.logo} resizeMode="contain" accessible={false} />
          </View>
          <T style={st.backSchool} numberOfLines={2}>{model.schoolName}</T>
        </View>

        <View style={[st.body, { top: n(142), gap: n(12) }]}>
          <Table rows={model.backRows} width={n(300)} labelWidth={n(model.kind === 'STAFF' ? 106 : 112)} st={st} lines={2} />
          <View style={st.qrBox}>
            {model.qrToken ? (
              <View accessible accessibilityLabel="ID card QR code for attendance">
                <QrCodeView value={model.qrToken} size={n(108)} dark={NAVY} />
              </View>
            ) : (
              <T style={st.qrMissing}>QR code is not available right now.</T>
            )}
          </View>
          <View style={{ width: n(200), alignItems: 'center' }}>
            <View style={st.sigLine}>
              {sigUri && !sigFailed ? (
                <Image source={{ uri: sigUri }} style={{ height: n(28), width: n(150) }} resizeMode="contain" onError={() => setSigFailed(true)} accessible={false} />
              ) : null}
            </View>
            <T style={st.sigLabel}>Principal's Signature</T>
          </View>
        </View>
        <BottomWave />
      </Animated.View>
    </Pressable>
  );
};

const Table: React.FC<{ rows: IdCardRow[]; width: number; labelWidth: number; st: any; lines: number }> = ({ rows, width, labelWidth, st, lines }) => (
  <View style={[st.table, { width }]}>
    {rows.map((r, i) => {
      const missing = r.value === NOT_RECORDED;
      return (
        <View key={r.label} style={[st.row, i > 0 && st.rowLine]}>
          <View style={[st.labelCell, { width: labelWidth }]}>
            <T style={st.label}>{r.label}:</T>
          </View>
          <View style={st.valueCell}>
            <T style={[st.value, missing && st.valueMissing]} numberOfLines={lines}>
              {r.value}
            </T>
          </View>
        </View>
      );
    })}
  </View>
);

function makeStyles(k: number) {
  const n = (v: number) => Math.round(v * k * 100) / 100;
  const f = (v: number) => Math.max(8, Math.round(v * k * 10) / 10);
  return StyleSheet.create({
    face: {
      position: 'absolute',
      top: 0,
      left: 0,
      backgroundColor: '#FFFFFF',
      borderRadius: n(18),
      borderWidth: 1,
      borderColor: LINE,
      overflow: 'hidden',
      backfaceVisibility: 'hidden',
    },
    frontHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: n(132), backgroundColor: NAVY, paddingTop: n(16), paddingLeft: n(16), paddingRight: n(14) },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: n(10) },
    logoRing: { width: n(58), height: n(58), borderRadius: n(29), backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: GOLD, padding: n(2), alignItems: 'center', justifyContent: 'center' },
    logo: { width: '100%', height: '100%', borderRadius: n(27) },
    schoolName: { fontFamily: FONT.bold, fontSize: f(15), lineHeight: f(18), color: '#FFFFFF', textTransform: 'uppercase' },
    affiliation: { fontFamily: FONT.bold, fontSize: f(9), color: GOLD, marginTop: n(3) },
    address: { fontFamily: FONT.regular, fontSize: f(8.5), color: '#CBD5E1', marginTop: n(2) },
    ribbon: { position: 'absolute', top: n(96), left: n(22), right: n(22), height: n(26), borderRadius: n(7), backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
    ribbonText: { fontFamily: FONT.bold, fontSize: f(12), color: NAVY, letterSpacing: 0.4 },
    waveBlock: { position: 'absolute', width: n(66), height: n(132), borderBottomLeftRadius: n(40), borderBottomRightRadius: n(40) },
    waveBlockThin: { position: 'absolute', width: n(28), height: n(92), borderBottomLeftRadius: n(20), borderBottomRightRadius: n(20) },
    body: { position: 'absolute', left: 0, right: 0, bottom: n(62), alignItems: 'center', gap: n(8) },
    photoRing: {
      borderWidth: n(6), borderColor: '#FFFFFF', backgroundColor: '#E2E8F0', overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
      shadowColor: NAVY, shadowOpacity: 0.22, shadowRadius: n(10), shadowOffset: { width: 0, height: n(4) }, elevation: 6,
    },
    photoImg: { width: '100%', height: '100%' },
    initials: { fontFamily: FONT.bold, color: NAVY },
    blood: {
      position: 'absolute', right: n(-10), bottom: n(6), flexDirection: 'row', alignItems: 'center', gap: n(4),
      paddingHorizontal: n(9), paddingVertical: n(3), borderRadius: 999, backgroundColor: '#C8102E', borderWidth: 2, borderColor: '#FFFFFF',
    },
    drop: { width: n(8), height: n(8), borderRadius: n(4), borderTopRightRadius: 0, backgroundColor: '#FFFFFF', transform: [{ rotate: '-45deg' }] },
    bloodText: { fontFamily: FONT.bold, fontSize: f(12), color: '#FFFFFF' },
    name: { fontFamily: FONT.bold, fontSize: f(20), lineHeight: f(24), color: NAVY, textAlign: 'center', textTransform: 'uppercase' },
    designation: { fontFamily: FONT.bold, fontSize: f(11.5), color: '#1E293B', textAlign: 'center', marginTop: n(2) },
    table: { borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF' },
    row: { flexDirection: 'row', minHeight: n(26) },
    rowLine: { borderTopWidth: 1, borderTopColor: LINE },
    labelCell: { justifyContent: 'center', paddingHorizontal: n(8), borderRightWidth: 1, borderRightColor: LINE },
    label: { fontFamily: FONT.bold, fontSize: f(12), color: INK },
    valueCell: { flex: 1, justifyContent: 'center', paddingHorizontal: n(8), paddingVertical: n(3) },
    value: { fontFamily: FONT.medium, fontSize: f(12), lineHeight: f(15), color: INK },
    valueMissing: { fontFamily: FONT.regular, fontStyle: 'italic', color: '#64748B' },
    bottomWave: { position: 'absolute', backgroundColor: NAVY, transform: [{ scaleX: 1.5 }] },
    stripe: { position: 'absolute', height: n(4), borderRadius: n(2), transform: [{ rotate: '-3deg' }] },
    backArc: { position: 'absolute', left: 0, transform: [{ scaleX: 1.8 }] },
    backSchool: { flex: 1, fontFamily: FONT.bold, fontSize: f(16), lineHeight: f(20), color: '#FFFFFF', textTransform: 'uppercase' },
    qrBox: { width: n(124), height: n(124), borderWidth: n(3), borderColor: BLUE, borderRadius: n(4), backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    qrMissing: { fontFamily: FONT.regular, fontSize: f(10.5), lineHeight: f(14), color: '#475569', textAlign: 'center', paddingHorizontal: n(8) },
    sigLine: { height: n(28), width: '100%', borderBottomWidth: 1, borderBottomColor: '#94A3B8', alignItems: 'center', justifyContent: 'flex-end' },
    sigLabel: { fontFamily: FONT.regular, fontSize: f(11.5), color: '#1E293B', marginTop: n(3) },
  });
}
