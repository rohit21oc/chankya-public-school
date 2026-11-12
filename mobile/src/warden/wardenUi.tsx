import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../theme/teacherHome';
import { T } from '../components/teacher-home/T';
import { Icon, IconName } from '../components/teacher-home/Icon';
import { NotificationBell } from '../components/NotificationBell';
import { KeyboardFrame } from '../components/ui/KeyboardFrame';
import { SPACE } from '../parent/ui';
import { NIGHT_STATUSES, NightStatus, STATUS_META, Tone } from './wardenRules';
import { BRAND_COLORS } from '../utils/branding';

/** Warden UI parts. Colours: Navy #0B1F4B, Royal #123B8C, Gold #D9A441, White, page #F7F9FC (TH tokens). */

export const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: BRAND_COLORS.successLight, fg: BRAND_COLORS.success },
  danger: { bg: BRAND_COLORS.errorLight, fg: '#B42318' },
  warning: { bg: TH.goldSoft, fg: TH.goldInk },
  info: { bg: TH.tile, fg: TH.royal },
  neutral: { bg: '#F1F4F8', fg: TH.muted },
};

/** Navy app bar: back (or nothing on a tab), title + optional subtitle, bell. */
export const WardenHeader: React.FC<{ title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }> = ({ title, subtitle, onBack, right }) => (
  <View style={s.header}>
    {onBack ? (
      <TouchableOpacity style={s.headerBtn} onPress={onBack} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
        <Icon name="chevron-left" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    ) : null}
    <View style={{ flex: 1, minWidth: 0, marginLeft: onBack ? 0 : SPACE.xs }}>
      <T style={s.headerTitle} numberOfLines={1}>
        {title}
      </T>
      {!!subtitle && (
        <T style={s.headerSub} numberOfLines={1}>
          {subtitle}
        </T>
      )}
    </View>
    {right}
    <NotificationBell tone="light" size={20} />
  </View>
);

/** One number on the dashboard grid. */
export const StatTile: React.FC<{ label: string; value: number | string; icon: IconName; tone?: Tone; onPress?: () => void }> = ({ label, value, icon, tone = 'info', onPress }) => (
  <TouchableOpacity
    style={s.stat}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.75}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${label}: ${value}`}
  >
    <View style={[s.statIcon, { backgroundColor: TONE_COLORS[tone].bg }]}>
      <Icon name={icon} size={18} color={TONE_COLORS[tone].fg} />
    </View>
    <T style={s.statValue}>{String(value)}</T>
    <T style={s.statLabel} numberOfLines={1}>
      {label}
    </T>
  </TouchableOpacity>
);

/** Quick navigation tile. */
export const QuickTile: React.FC<{ label: string; icon: IconName; onPress: () => void; badge?: number }> = ({ label, icon, onPress, badge }) => (
  <TouchableOpacity style={s.quick} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} pending` : label}>
    <View style={s.quickIcon}>
      <Icon name={icon} size={22} color={TH.gold} />
      {!!badge && badge > 0 && (
        <View style={s.quickBadge}>
          <T style={s.quickBadgeText}>{badge > 99 ? '99+' : String(badge)}</T>
        </View>
      )}
    </View>
    <T style={s.quickLabel} numberOfLines={2}>
      {label}
    </T>
  </TouchableOpacity>
);

/** P / A / L / O choice for one student. The full word is the accessibility label; colour is never the only cue. */
export const StatusPicker: React.FC<{ value?: NightStatus | null; onChange: (s: NightStatus) => void; disabled?: boolean; name: string }> = ({ value, onChange, disabled, name }) => (
  <View style={s.picker} accessibilityRole="radiogroup">
    {NIGHT_STATUSES.map((st) => {
      const on = value === st;
      const m = STATUS_META[st];
      return (
        <TouchableOpacity
          key={st}
          disabled={disabled}
          onPress={() => onChange(st)}
          style={[s.pick, on && { backgroundColor: TONE_COLORS[m.tone].fg, borderColor: TONE_COLORS[m.tone].fg }, disabled && !on && { opacity: 0.4 }]}
          activeOpacity={0.7}
          accessibilityRole="radio"
          accessibilityState={{ selected: on, disabled }}
          accessibilityLabel={`${name}: ${m.label}`}
        >
          <T style={[s.pickText, on && { color: '#FFFFFF' }]}>{m.short}</T>
        </TouchableOpacity>
      );
    })}
  </View>
);

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <View style={s.search}>
    <Icon name="search" size={18} color={TH.muted} />
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={TH.muted}
      style={s.searchInput}
      autoCorrect={false}
      returnKeyType="search"
      accessibilityLabel={placeholder}
    />
    {!!value && (
      <TouchableOpacity onPress={() => onChange('')} style={s.clear} accessibilityRole="button" accessibilityLabel="Clear search">
        <Icon name="x" size={16} color={TH.muted} />
      </TouchableOpacity>
    )}
  </View>
);

export const PrimaryButton: React.FC<{ label: string; onPress: () => void; busy?: boolean; disabled?: boolean; tone?: 'navy' | 'gold' | 'danger' | 'outline'; icon?: IconName }> = ({ label, onPress, busy, disabled, tone = 'navy', icon }) => {
  const bg = tone === 'gold' ? TH.gold : tone === 'danger' ? '#B42318' : tone === 'outline' ? TH.surface : TH.navy;
  const fg = tone === 'outline' ? TH.navy : tone === 'gold' ? TH.navy : '#FFFFFF';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      style={[s.btn, { backgroundColor: bg }, tone === 'outline' && { borderWidth: 1, borderColor: TH.border }, (disabled || busy) && { opacity: 0.55 }]}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy }}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <T style={[s.btnText, { color: fg }]}>{label}</T>
    </TouchableOpacity>
  );
};

/**
 * Bottom sheet that asks for a short text (a reason, a note, an emergency message), optionally with a
 * status choice. Returns the values through onSubmit; the caller shows the server's answer.
 */
export const PromptSheet: React.FC<{
  visible: boolean;
  title: string;
  message?: string;
  placeholder: string;
  submitLabel: string;
  minLength?: number;
  withStatus?: NightStatus | null;
  tone?: 'navy' | 'danger';
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (text: string, status?: NightStatus) => void;
}> = ({ visible, title, message, placeholder, submitLabel, minLength = 3, withStatus, tone = 'navy', busy, error, onClose, onSubmit }) => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<NightStatus | null>(withStatus || null);
  useEffect(() => {
    if (visible) {
      setText('');
      setStatus(withStatus || null);
    }
  }, [visible, withStatus]);
  const ready = text.trim().length >= minLength && (withStatus === undefined || !!status);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardFrame>
        <View style={s.sheet}>
          <View style={s.grabber} />
          <T style={s.sheetTitle}>{title}</T>
          {!!message && <T style={s.sheetMsg}>{message}</T>}
          {withStatus !== undefined && <StatusPicker value={status} onChange={setStatus} name="New status" />}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={TH.muted}
            style={s.input}
            multiline
            maxLength={300}
            accessibilityLabel={placeholder}
          />
          {!!error && (
            <T style={s.err} accessibilityRole="alert">
              {error}
            </T>
          )}
          <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cancel" tone="outline" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label={submitLabel} tone={tone} busy={busy} disabled={!ready} onPress={() => onSubmit(text.trim(), status || undefined)} />
            </View>
          </View>
        </View>
      </KeyboardFrame>
    </Modal>
  );
};

const s = StyleSheet.create({
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, backgroundColor: TH.navy },
  headerBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONT.heading, fontSize: 20, color: '#FFFFFF' },
  headerSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.onNavyMuted },
  stat: { flexBasis: '31%', flexGrow: 1, minHeight: 104, padding: SPACE.md, gap: 4, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontFamily: FONT.bold, fontSize: 22, color: TH.ink },
  statLabel: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  quick: { flex: 1, minHeight: 92, alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.md, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  quickIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center' },
  quickBadge: { position: 'absolute', top: -6, right: -8, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#B42318', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  quickBadgeText: { fontFamily: FONT.bold, fontSize: 10, color: '#FFFFFF' },
  quickLabel: { fontFamily: FONT.semibold, fontSize: 12, color: TH.ink, textAlign: 'center', paddingHorizontal: 4 },
  picker: { flexDirection: 'row', gap: 6 },
  pick: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: TH.border, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.surface },
  pickText: { fontFamily: FONT.bold, fontSize: 14, color: TH.ink },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, borderRadius: 14, borderWidth: 1, borderColor: TH.border, backgroundColor: TH.surface },
  searchInput: { flex: 1, fontFamily: FONT.regular, fontSize: 14, color: TH.ink, paddingVertical: 10 },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, borderRadius: 14 },
  btnText: { fontFamily: FONT.semibold, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,75,0.45)' },
  sheet: { backgroundColor: TH.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.xl },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: TH.border },
  sheetTitle: { fontFamily: FONT.heading, fontSize: 19, color: TH.navy },
  sheetMsg: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 19, color: TH.muted },
  input: { minHeight: 88, textAlignVertical: 'top', borderWidth: 1, borderColor: TH.border, borderRadius: 14, padding: SPACE.md, fontFamily: FONT.regular, fontSize: 14, color: TH.ink, backgroundColor: TH.bg },
  err: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318' },
});
