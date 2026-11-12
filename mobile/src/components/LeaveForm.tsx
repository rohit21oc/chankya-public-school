import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { KeyboardFrame } from './ui/KeyboardFrame';
import { KScrollView as ScrollView } from './ui/KScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from './teacher-home/T';
import { FONT, TH } from '../theme/teacherHome';
import { DatePickerField } from './ui/DatePickerField';
import { STAFF_LEAVE_TYPES, STUDENT_LEAVE_TYPES, SALARY_LEAVE_RULE, countLeaveDays, indiaToday, validateLeaveForm } from '../utils/leaveRules';

export interface LeaveFormValue {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  approveNow: boolean;
}

interface Props {
  visible: boolean;
  kind: 'staff' | 'student';
  /** Shown at the top, e.g. "For Rohit Kumar" */
  forLabel?: string;
  /** Approvers adding leave for someone else can approve it at once. */
  allowApproveNow?: boolean;
  /** Approvers may record past leave; applicants can only apply from today. */
  allowPastDates?: boolean;
  onClose: () => void;
  onSubmit: (v: LeaveFormValue) => Promise<string | null>; // returns an error message, or null when saved
}

export const LeaveForm: React.FC<Props> = ({ visible, kind, forLabel, allowApproveNow, allowPastDates, onClose, onSubmit }) => {
  const today = indiaToday();
  const blank: LeaveFormValue = { leaveType: kind === 'staff' ? 'CASUAL' : 'SICK', startDate: today, endDate: today, reason: '', approveNow: !!allowApproveNow };
  const [v, setV] = useState<LeaveFormValue>(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const types = kind === 'staff' ? STAFF_LEAVE_TYPES : STUDENT_LEAVE_TYPES;
  const days = countLeaveDays(v.startDate, v.endDate);

  const set = (p: Partial<LeaveFormValue>) => {
    setErr(null);
    setV((x) => {
      const n = { ...x, ...p };
      if (p.startDate && n.endDate < p.startDate) n.endDate = p.startDate;
      return n;
    });
  };

  const close = () => {
    if (busy) return;
    setV(blank);
    setErr(null);
    onClose();
  };

  const submit = async () => {
    const invalid = validateLeaveForm(v);
    if (invalid) return setErr(invalid);
    setBusy(true);
    const e = await onSubmit({ ...v, reason: v.reason.trim() });
    setBusy(false);
    if (e) return setErr(e);
    setV(blank);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaView style={s.safe}>
        <KeyboardFrame own>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <T style={s.title}>{allowApproveNow ? 'Add leave' : 'Apply for leave'}</T>
            {!!forLabel && <T style={s.sub} numberOfLines={1}>{forLabel}</T>}
          </View>
          <Pressable onPress={close} style={s.headBtn} disabled={busy} accessibilityRole="button">
            <T style={s.headBtnText}>Cancel</T>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <T style={s.label}>Type of leave</T>
            <View style={s.wrap}>
              {types.map((t) => (
                <Pressable key={t.value} onPress={() => set({ leaveType: t.value })} style={[s.chip, v.leaveType === t.value && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: v.leaveType === t.value }}>
                  <T style={[s.chipText, v.leaveType === t.value && s.chipTextOn]}>{t.label}</T>
                </Pressable>
              ))}
            </View>

            <View style={s.dates}>
              <DatePickerField label="From" value={v.startDate} min={allowPastDates ? undefined : today} onChange={(d) => set({ startDate: d })} />
              <DatePickerField label="To" value={v.endDate} min={v.startDate || (allowPastDates ? undefined : today)} onChange={(d) => set({ endDate: d })} />
            </View>

            <View style={s.daysBox}>
              <T style={s.daysNum}>{days}</T>
              <T style={s.daysText}>{days === 1 ? 'school day' : 'school days'} (Sundays not counted)</T>
            </View>

            <T style={s.label}>Reason</T>
            <TextInput
              value={v.reason}
              onChangeText={(t) => set({ reason: t })}
              placeholder={kind === 'staff' ? 'e.g. Fever, doctor advised rest' : 'e.g. Fever / family function'}
              placeholderTextColor={TH.muted}
              style={s.input}
              multiline
              maxLength={500}
              accessibilityLabel="Reason"
            />

            {allowApproveNow && (
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <T style={s.switchTitle}>Approve now</T>
                  <T style={s.switchSub}>Marks these days as leave in attendance straight away.</T>
                </View>
                <Switch value={v.approveNow} onValueChange={(x) => set({ approveNow: x })} trackColor={{ true: TH.royal, false: TH.border }} />
              </View>
            )}

            {kind === 'staff' && (
              <View style={s.note}>
                <T style={s.noteTitle}>How leave affects salary</T>
                <T style={s.noteText}>{SALARY_LEAVE_RULE}</T>
              </View>
            )}
            {err ? <T style={s.err}>{err}</T> : null}
          </ScrollView>
        </View>
        <View style={s.footer}>
          <Pressable onPress={submit} style={[s.primary, busy && { opacity: 0.7 }]} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <T style={s.primaryText}>{allowApproveNow ? (v.approveNow ? 'Add & approve' : 'Add as pending') : 'Send request'}</T>}
          </Pressable>
        </View>
        </KeyboardFrame>
      </SafeAreaView>
    </Modal>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.bg },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  title: { fontFamily: FONT.bold, fontSize: 18, color: TH.navy },
  sub: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted, marginTop: 2 },
  headBtn: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  headBtnText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  label: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { backgroundColor: TH.navy, borderColor: TH.navy },
  chipText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  chipTextOn: { color: '#FFFFFF' },
  dates: { flexDirection: 'row', gap: 10 },
  daysBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: TH.tile, borderRadius: 14, padding: 12 },
  daysNum: { fontFamily: FONT.heading, fontSize: 26, color: TH.royal },
  daysText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink, flexShrink: 1 },
  input: { minHeight: 96, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', padding: 12, fontFamily: FONT.regular, fontSize: 15, color: TH.ink, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: TH.border, padding: 12 },
  switchTitle: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  switchSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, marginTop: 2 },
  note: { backgroundColor: TH.goldSoft, borderRadius: 14, padding: 12, gap: 4 },
  noteTitle: { fontFamily: FONT.semibold, fontSize: 13, color: TH.goldInk },
  noteText: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.goldInk },
  err: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318' },
  footer: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: TH.border },
  primary: { minHeight: 50, borderRadius: 14, backgroundColor: TH.royal, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FONT.semibold, fontSize: 15, color: '#FFFFFF' },
});
