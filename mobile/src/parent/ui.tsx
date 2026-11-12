import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { TH, FONT } from '../theme/teacherHome';
import { BRAND_COLORS, resolveFileUrl } from '../utils/branding';
import { T } from '../components/teacher-home/T';
import { Icon, IconName } from '../components/teacher-home/Icon';
import { Student } from '../types';
import { NotificationBell } from '../components/NotificationBell';
import { classSectionLabel, firstNameOf, initialsOf } from '../utils/parentRules';

/**
 * Building blocks for the parent screens. They reuse the teacher-home tokens
 * (TH, FONT) and parts (Card, SectionHeading, InfoRow, Badge, Icon) so the two
 * portals share one visual language.
 */

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

// ---------------------------------------------------------------------------

export const Avatar: React.FC<{ name?: string; photoKey?: string; size?: number }> = ({ name, photoKey, size = 40 }) => {
  const [failed, setFailed] = useState(false);
  const uri = photoKey && !failed ? resolveFileUrl(photoKey) : null;
  const radius = size / 2;
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: TH.tile }}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessible={false}
    />
  ) : (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <T style={{ fontFamily: FONT.heading, fontSize: Math.round(size * 0.38), color: TH.gold }}>{initialsOf(name)}</T>
    </View>
  );
};

// ---------------------------------------------------------------------------

interface HeaderProps {
  title: string;
  child?: Student | null;
  onBack?: () => void;
  onPressChild?: () => void;
  right?: React.ReactNode;
}

/**
 * Screen header: optional back, title, and the active child as a compact chip.
 * The chip opens My Children, the one place where the child is changed.
 */
/**
 * The student portal reuses the parent screens. It sets this so their headers become the navy
 * app bar of the student design (menu or back on the left, no child chip).
 */
export const PortalChromeContext = createContext<{ variant: 'parent' | 'student'; onMenu?: () => void }>({ variant: 'parent' });

export const ParentHeader: React.FC<HeaderProps> = ({ title, child, onBack, onPressChild, right }) => {
  const chrome = useContext(PortalChromeContext);
  if (chrome.variant === 'student') {
    return (
      <View style={styles.sHeader}>
        {onBack ? (
          <TouchableOpacity style={styles.sBtn} onPress={onBack} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
            <Icon name="chevron-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : chrome.onMenu ? (
          <TouchableOpacity style={styles.sBtn} onPress={chrome.onMenu} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Open menu">
            <View style={styles.burger}>
              <View style={styles.burgerBar} />
              <View style={styles.burgerBar} />
              <View style={styles.burgerBar} />
            </View>
          </TouchableOpacity>
        ) : null}
        <T style={styles.sTitle} numberOfLines={1}>
          {title}
        </T>
        {right}
        <NotificationBell tone="light" size={20} />
      </View>
    );
  }
  return (
  <View style={styles.header}>
    {onBack ? (
      <TouchableOpacity style={styles.headerBtn} onPress={onBack} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
        <Icon name="chevron-left" size={22} color={TH.navy} />
      </TouchableOpacity>
    ) : null}
    <T style={[styles.headerTitle, !onBack && { marginLeft: SPACE.xs }]} numberOfLines={1}>
      {title}
    </T>
    {right}
    <NotificationBell tone="dark" size={20} />
    {child ? (
      <TouchableOpacity
        style={styles.childChip}
        onPress={onPressChild}
        disabled={!onPressChild}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Viewing ${child.name}, ${classSectionLabel(child.className, child.section)}. Change child`}
      >
        <Avatar name={child.name} photoKey={child.photo || child.photoFileKey} size={28} />
        <View style={styles.childChipText}>
          <T style={styles.childChipName} numberOfLines={1}>
            {firstNameOf(child.name)}
          </T>
          <T style={styles.childChipClass} numberOfLines={1}>
            {classSectionLabel(child.className, child.section)}
          </T>
        </View>
      </TouchableOpacity>
    ) : null}
  </View>
  );
};

// ---------------------------------------------------------------------------

export const Screen: React.FC<{
  header: React.ReactNode;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}> = ({ header, children, refreshing = false, onRefresh }) => (
  <View style={styles.screen}>
    {header}
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND_COLORS.primaryBright]} /> : undefined}
    >
      {children}
    </ScrollView>
  </View>
);

// ---------------------------------------------------------------------------

/** Pulsing placeholder; respects the layout so content does not jump when it loads. */
export const Skeleton: React.FC<{ height: number; width?: number | string; radius?: number }> = ({ height, width = '100%', radius = 12 }) => {
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    let alive = true;
    const loop = (to: number) => {
      if (!alive) return;
      Animated.timing(pulse, { toValue: to, duration: 700, useNativeDriver: true }).start(() => loop(to === 1 ? 0.55 : 1));
    };
    loop(1);
    return () => {
      alive = false;
    };
  }, [pulse]);
  return <Animated.View style={{ height, width, borderRadius: radius, backgroundColor: TH.border, opacity: pulse }} />;
};

export const SkeletonList: React.FC<{ rows?: number; height?: number }> = ({ rows = 3, height = 64 }) => (
  <View style={{ gap: SPACE.md }} accessibilityLabel="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} height={height} />
    ))}
  </View>
);

// ---------------------------------------------------------------------------

export const StateBlock: React.FC<{
  kind: 'empty' | 'error';
  title: string;
  message?: string;
  onRetry?: () => void;
  icon?: IconName;
}> = ({ kind, title, message, onRetry, icon }) => (
  <View style={[styles.state, kind === 'error' && styles.stateError]} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
    <View style={[styles.stateIcon, kind === 'error' && { backgroundColor: BRAND_COLORS.errorLight }]}>
      <Icon name={icon || (kind === 'error' ? 'circle-alert' : 'file-text')} size={22} color={kind === 'error' ? BRAND_COLORS.error : TH.muted} />
    </View>
    <T style={styles.stateTitle}>{title}</T>
    {!!message && <T style={styles.stateMessage}>{message}</T>}
    {!!onRetry && (
      <TouchableOpacity style={styles.retry} onPress={onRetry} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Try again">
        <Icon name="refresh-cw" size={16} color={TH.royal} />
        <T style={styles.retryText}>Try again</T>
      </TouchableOpacity>
    )}
  </View>
);

// ---------------------------------------------------------------------------

export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: BRAND_COLORS.successLight, fg: BRAND_COLORS.success },
  danger: { bg: BRAND_COLORS.errorLight, fg: '#B42318' },
  warning: { bg: TH.goldSoft, fg: TH.goldInk },
  info: { bg: TH.tile, fg: TH.royal },
  neutral: { bg: '#F1F4F8', fg: TH.muted },
};

/** Status text with a tinted background. Meaning is always in the text, never colour alone. */
export const Pill: React.FC<{ label: string; tone?: Tone }> = ({ label, tone = 'neutral' }) => (
  <View style={[styles.pill, { backgroundColor: TONES[tone].bg }]}>
    <T style={[styles.pillText, { color: TONES[tone].fg }]} numberOfLines={1}>
      {label}
    </T>
  </View>
);

/** One figure with its label, for summary rows. */
export const Figure: React.FC<{ label: string; value: string; tone?: Tone }> = ({ label, value, tone }) => (
  <View style={styles.figure}>
    <T style={styles.figureLabel} numberOfLines={1}>
      {label}
    </T>
    <T style={[styles.figureValue, tone && tone !== 'neutral' && { color: TONES[tone].fg }]} numberOfLines={1}>
      {value}
    </T>
  </View>
);

/** Segmented choice (two to four options). */
export function Segmented<V extends string>({ options, value, onChange }: { options: ReadonlyArray<{ value: V; label: string }>; value: V; onChange: (v: V) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <T style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </T>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Horizontal chooser for exams or sessions; scrolls inside itself, never the page. */
export function ChoiceRow<V extends string>({ options, value, onChange, label }: { options: Array<{ value: V; label: string }>; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <T style={styles.choiceLabel}>{label}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.sm }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              style={[styles.choice, active && styles.choiceActive]}
              onPress={() => onChange(o.value)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={o.label}
            >
              <T style={[styles.choiceText, active && styles.choiceTextActive]} numberOfLines={1}>
                {o.label}
              </T>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const InlineBusy: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.inlineBusy}>
    <ActivityIndicator size="small" color={TH.royal} />
    <T style={styles.inlineBusyText}>{label}</T>
  </View>
);

/** Thin banner for a failed refresh while older data stays on screen. */
export const Banner: React.FC<{ text: string; onRetry?: () => void }> = ({ text, onRetry }) => (
  <View style={styles.banner} accessibilityRole="alert">
    <T style={styles.bannerText}>{text}</T>
    {!!onRetry && (
      <TouchableOpacity onPress={onRetry} style={styles.bannerAction} accessibilityRole="button" accessibilityLabel="Try again">
        <T style={styles.bannerActionText}>Retry</T>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TH.bg },
  content: { padding: SPACE.lg, paddingBottom: SPACE.xl + 8, gap: SPACE.lg },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    backgroundColor: TH.surface,
    borderBottomWidth: 1,
    borderBottomColor: TH.border,
  },
  sHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, backgroundColor: BRAND_COLORS.primaryRoyal },
  sBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sTitle: { flex: 1, fontFamily: FONT.heading, fontSize: 19, color: '#FFFFFF' },
  burger: { width: 20, gap: 4 },
  burgerBar: { height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF' },
  headerBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: FONT.heading, fontSize: 20, color: TH.navy },
  childChip: {
    minHeight: 44,
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 22,
    backgroundColor: TH.tile,
  },
  childChipText: { flexShrink: 1 },
  childChipName: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink },
  childChipClass: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  state: {
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.xl,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TH.border,
    backgroundColor: TH.surface,
  },
  stateError: { borderColor: '#F4C7C3' },
  stateIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink, textAlign: 'center' },
  stateMessage: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 19, color: TH.muted, textAlign: 'center' },
  retry: {
    marginTop: SPACE.xs,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TH.border,
  },
  retryText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  pillText: { fontFamily: FONT.semibold, fontSize: 11 },
  figure: { flex: 1, minWidth: 0, gap: 2 },
  figureLabel: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  figureValue: { fontFamily: FONT.bold, fontSize: 17, color: TH.ink },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: '#EEF2F7' },
  segment: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.sm },
  segmentActive: { backgroundColor: TH.surface, shadowColor: '#0B1F4B', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontFamily: FONT.medium, fontSize: 13, color: TH.muted },
  segmentTextActive: { fontFamily: FONT.semibold, color: TH.navy },
  choiceLabel: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  choice: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: TH.border, backgroundColor: TH.surface },
  choiceActive: { backgroundColor: TH.navy, borderColor: TH.navy },
  choiceText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  choiceTextActive: { color: '#FFFFFF', fontFamily: FONT.semibold },
  inlineBusy: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  inlineBusyText: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  banner: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderRadius: 12, backgroundColor: TH.goldSoft },
  bannerText: { flex: 1, fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.goldInk },
  bannerAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: SPACE.sm },
  bannerActionText: { fontFamily: FONT.semibold, fontSize: 12, color: TH.goldInk },
});
