import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { T } from './teacher-home/T';
import { Icon } from './teacher-home/Icon';
import { FONT, TH } from '../theme/teacherHome';
import { apiService } from '../services/apiService';
import { LeaveForm } from './LeaveForm';
import { LEAVE_STATUS_UI, formatRange, leaveTypeLabel } from '../utils/leaveRules';

/**
 * "My leave" card shown under the attendance calendar (profile for staff and
 * students, attendance tab for parents). Apply for leave, see each request's
 * status, and withdraw a pending student request.
 */
interface Props {
  kind: 'staff' | 'student';
  /** Staff: id / employeeId. Student: student id. */
  subjectId: string;
  employeeId?: string;
  subjectName?: string;
  /** Called after a change so the calendar above can reload. */
  onChanged?: () => void;
}

export const LeavePanel: React.FC<Props> = ({ kind, subjectId, employeeId, subjectName, onChanged }) => {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (kind === 'staff') {
      const r = await apiService.getStaffLeaves();
      if (r.ok) {
        const emp = String(employeeId || '').toUpperCase();
        setLeaves(
          r.data
            .filter((l) => l.staffId === subjectId || (emp && String(l.employeeId || '').toUpperCase() === emp))
            .sort((a, b) => String(b.appliedAt || b.startDate).localeCompare(String(a.appliedAt || a.startDate)))
        );
        setError(null);
      } else setError(r.error || 'Leave could not be loaded.');
    } else {
      const r = await apiService.getStudentLeaves({ studentId: subjectId });
      if (r.ok) {
        setLeaves(r.data);
        setError(null);
      } else setError(r.error || 'Leave could not be loaded.');
    }
    setLoading(false);
  }, [kind, subjectId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (v: { leaveType: string; startDate: string; endDate: string; reason: string }) => {
    const res =
      kind === 'staff'
        ? await apiService.applyStaffLeave({ staffId: subjectId, employeeId, leaveType: v.leaveType, startDate: v.startDate, endDate: v.endDate, reason: v.reason })
        : await apiService.applyStudentLeave({ studentId: subjectId, leaveType: v.leaveType, startDate: v.startDate, endDate: v.endDate, reason: v.reason });
    if (!res.ok) return res.error || 'The request could not be sent.';
    setOpen(false);
    setToast('Leave request sent. You will see the decision here.');
    setTimeout(() => setToast(null), 4000);
    await load();
    onChanged?.();
    return null;
  };

  const withdraw = (l: any) =>
    Alert.alert('Withdraw this request?', `${leaveTypeLabel(l.leaveType)} leave, ${formatRange(l.startDate, l.endDate)}`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          const r = await apiService.decideStudentLeave(l.id, 'CANCELLED');
          if (!r.ok) Alert.alert('Could not withdraw', r.error || 'Please try again.');
          await load();
        },
      },
    ]);

  const pending = leaves.filter((l) => l.status === 'PENDING').length;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.iconTile}>
          <Icon name="calendar" size={18} color={TH.royal} />
        </View>
        <View style={{ flex: 1 }}>
          <T style={s.title}>{kind === 'student' && subjectName ? `Leave for ${subjectName.split(' ')[0]}` : 'My leave'}</T>
          <T style={s.sub}>{pending ? `${pending} waiting for approval` : 'Apply, and track approval here'}</T>
        </View>
        <Pressable onPress={() => setOpen(true)} style={s.apply} accessibilityRole="button" accessibilityLabel="Apply for leave">
          <T style={s.applyText}>Apply leave</T>
        </Pressable>
      </View>

      {toast && <T style={s.toast}>{toast}</T>}

      {loading ? (
        <ActivityIndicator color={TH.royal} style={{ marginVertical: 12 }} />
      ) : error ? (
        <Pressable onPress={load}>
          <T style={s.error}>{error} Tap to retry.</T>
        </Pressable>
      ) : leaves.length === 0 ? (
        <T style={s.empty}>No leave taken yet.</T>
      ) : (
        leaves.slice(0, 6).map((l, i) => {
          const st = LEAVE_STATUS_UI[l.status] || LEAVE_STATUS_UI.PENDING;
          return (
            <View key={l.id} style={[s.row, i > 0 && s.rowBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={s.rowTitle} numberOfLines={1}>
                  {leaveTypeLabel(l.leaveType)} · {l.daysCount} day{Number(l.daysCount) === 1 ? '' : 's'}
                </T>
                <T style={s.rowSub}>{formatRange(l.startDate, l.endDate)}</T>
                {!!l.remarks && l.status !== 'PENDING' && <T style={s.rowSub} numberOfLines={2}>Note: {l.remarks}</T>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={[s.pill, { backgroundColor: st.bg }]}>
                  <T style={[s.pillText, { color: st.fg }]}>{st.label}</T>
                </View>
                {kind === 'student' && l.status === 'PENDING' && (
                  <Pressable onPress={() => withdraw(l)} hitSlop={8} accessibilityRole="button">
                    <T style={s.link}>Withdraw</T>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })
      )}

      <LeaveForm visible={open} kind={kind} forLabel={subjectName ? `For ${subjectName}` : undefined} onClose={() => setOpen(false)} onSubmit={submit} />
    </View>
  );
};

const s = StyleSheet.create({
  card: { marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, padding: 14, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  iconTile: { width: 36, height: 36, borderRadius: 10, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.bold, fontSize: 15, color: TH.ink },
  sub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  apply: { minHeight: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: TH.royal, justifyContent: 'center' },
  applyText: { fontFamily: FONT.semibold, fontSize: 13, color: '#FFFFFF' },
  toast: { fontFamily: FONT.medium, fontSize: 12, color: '#067647', backgroundColor: '#ECFDF3', padding: 8, borderRadius: 8 },
  error: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318', paddingVertical: 8 },
  empty: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  rowTitle: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  rowSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, marginTop: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontFamily: FONT.semibold, fontSize: 11 },
  link: { fontFamily: FONT.semibold, fontSize: 12, color: '#B42318' },
});
