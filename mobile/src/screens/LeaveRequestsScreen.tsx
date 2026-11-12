import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardFrame } from '../components/ui/KeyboardFrame';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { T } from '../components/teacher-home/T';
import { Icon } from '../components/teacher-home/Icon';
import { FONT, TH } from '../theme/teacherHome';
import { apiService } from '../services/apiService';
import { LeaveForm, LeaveFormValue } from '../components/LeaveForm';
import { LEAVE_STATUS_UI, formatRange, leaveTypeLabel } from '../utils/leaveRules';
import { classLabel } from '../components/comm/PersonPhoto';

/**
 * Leave approvals for the principal / administration / HR.
 * - Staff and student requests in one place, newest pending first.
 * - Approve or reject with an optional note. Approval marks attendance as Leave,
 *   and for staff the payroll then applies the monthly leave rule.
 * - "Add leave" records leave for any staff member or student (approved at once if wanted).
 */
interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

type Who = 'STAFF' | 'STUDENT';
type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

export const LeaveRequestsScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile }) => {
  const [who, setWho] = useState<Who>('STAFF');
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [staffLeaves, setStaffLeaves] = useState<any[]>([]);
  const [studentLeaves, setStudentLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decide, setDecide] = useState<{ leave: any; next: 'APPROVED' | 'REJECTED' } | null>(null);
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Add leave for someone
  const [picker, setPicker] = useState(false);
  const [people, setPeople] = useState<any[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<any | null>(null);

  const load = useCallback(async () => {
    const [st, su] = await Promise.all([apiService.getStaffLeaves(), apiService.getStudentLeaves()]);
    if (st.ok) setStaffLeaves(st.data);
    if (su.ok) setStudentLeaves(su.data);
    setError(!st.ok || !su.ok ? st.error || su.error || 'Some leave could not be loaded.' : null);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const source = who === 'STAFF' ? staffLeaves : studentLeaves;
  const counts = useMemo(() => ({
    STAFF: staffLeaves.filter((l) => l.status === 'PENDING').length,
    STUDENT: studentLeaves.filter((l) => l.status === 'PENDING').length,
  }), [staffLeaves, studentLeaves]);
  const list = useMemo(
    () =>
      source
        .filter((l) => filter === 'ALL' || l.status === filter)
        .sort((a, b) => String(b.appliedAt || b.startDate).localeCompare(String(a.appliedAt || a.startDate))),
    [source, filter]
  );

  const flash = (t: string) => {
    setBanner(t);
    setTimeout(() => setBanner(null), 4000);
  };

  const confirmDecision = async () => {
    if (!decide) return;
    setBusy(true);
    const r = who === 'STAFF' ? await apiService.decideStaffLeave(decide.leave.id, decide.next, remark.trim() || undefined) : await apiService.decideStudentLeave(decide.leave.id, decide.next, remark.trim() || undefined);
    setBusy(false);
    if (!r.ok) return Alert.alert('Could not save', r.error || 'Please try again.');
    flash(decide.next === 'APPROVED' ? 'Leave approved. Attendance is marked as Leave.' : 'Leave rejected.');
    setDecide(null);
    setRemark('');
    load();
  };

  const openPicker = async () => {
    setPicker(true);
    setQuery('');
    setPeopleLoading(true);
    const r = who === 'STAFF' ? await apiService.getStaffDirectory() : await apiService.getAllStudents({ status: 'ACTIVE' });
    setPeople(r.ok ? r.data : []);
    setPeopleLoading(false);
  };

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !q || [p.name, p.employeeId, p.admissionNumber, p.className].some((x) => String(x || '').toLowerCase().includes(q)))
      .slice(0, 60);
  }, [people, query]);

  const addLeave = async (v: LeaveFormValue): Promise<string | null> => {
    if (!target) return 'Choose a person first.';
    const status = v.approveNow ? ('APPROVED' as const) : undefined;
    const r =
      who === 'STAFF'
        ? await apiService.applyStaffLeave({ staffId: target.id, employeeId: target.employeeId, leaveType: v.leaveType, startDate: v.startDate, endDate: v.endDate, reason: v.reason, status })
        : await apiService.applyStudentLeave({ studentId: target.id, leaveType: v.leaveType, startDate: v.startDate, endDate: v.endDate, reason: v.reason, status });
    if (!r.ok) return r.error || 'The leave could not be saved.';
    setTarget(null);
    flash(v.approveNow ? `Leave added and approved for ${target.name}.` : `Leave added for ${target.name}. It is waiting for approval.`);
    load();
    return null;
  };

  const renderLeave = (l: any) => {
    const st = LEAVE_STATUS_UI[l.status] || LEAVE_STATUS_UI.PENDING;
    const name = who === 'STAFF' ? l.staffName : l.studentName;
    const meta = who === 'STAFF' ? l.employeeId : [classLabel(l), l.appliedByRole === 'PARENT' ? 'by parent' : null].filter(Boolean).join(' · ');
    return (
      <View key={l.id} style={s.card}>
        <View style={s.cardTop}>
          <View style={s.avatar}>
            <T style={s.avatarText}>{String(name || '?').split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase()}</T>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T style={s.name} numberOfLines={1}>{name}</T>
            {!!meta && <T style={s.meta} numberOfLines={1}>{meta}</T>}
          </View>
          <View style={[s.pill, { backgroundColor: st.bg }]}>
            <T style={[s.pillText, { color: st.fg }]}>{st.label}</T>
          </View>
        </View>
        <View style={s.infoRow}>
          <View style={s.info}>
            <T style={s.infoLabel}>Type</T>
            <T style={s.infoValue}>{leaveTypeLabel(l.leaveType)}</T>
          </View>
          <View style={s.info}>
            <T style={s.infoLabel}>Days</T>
            <T style={s.infoValue}>{l.daysCount}</T>
          </View>
          <View style={[s.info, { flex: 2 }]}>
            <T style={s.infoLabel}>Dates</T>
            <T style={s.infoValue} numberOfLines={1}>{formatRange(l.startDate, l.endDate)}</T>
          </View>
        </View>
        {!!l.reason && <T style={s.reason} numberOfLines={3}>“{l.reason}”</T>}
        {l.status !== 'PENDING' && (!!l.approvedBy || !!l.remarks) && (
          <T style={s.meta}>{[l.approvedBy && `By ${l.approvedBy}`, l.remarks].filter(Boolean).join(' · ')}</T>
        )}
        {l.status === 'PENDING' && (
          <View style={s.actions}>
            <Pressable onPress={() => setDecide({ leave: l, next: 'REJECTED' })} style={[s.btn, s.btnGhost]} accessibilityRole="button">
              <Icon name="x" size={16} color="#B42318" />
              <T style={[s.btnText, { color: '#B42318' }]}>Reject</T>
            </Pressable>
            <Pressable onPress={() => setDecide({ leave: l, next: 'APPROVED' })} style={[s.btn, s.btnOk]} accessibilityRole="button">
              <Icon name="check" size={16} color="#FFFFFF" />
              <T style={[s.btnText, { color: '#FFFFFF' }]}>Approve</T>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="Leave Requests" subtitle={`${counts.STAFF + counts.STUDENT} pending`} />

      <View style={s.segment}>
        {(['STAFF', 'STUDENT'] as Who[]).map((w) => (
          <Pressable key={w} onPress={() => setWho(w)} style={[s.segBtn, who === w && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: who === w }}>
            <T style={[s.segText, who === w && s.segTextOn]}>{w === 'STAFF' ? 'Staff' : 'Students'}</T>
            {counts[w] > 0 && (
              <View style={s.badge}>
                <T style={s.badgeText}>{counts[w]}</T>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={s.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as Filter[]).map((f) => (
              <Pressable key={f} onPress={() => setFilter(f)} style={[s.chip, filter === f && s.chipOn]}>
                <T style={[s.chipText, filter === f && s.chipTextOn]}>{f === 'ALL' ? 'All' : LEAVE_STATUS_UI[f].label}</T>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <Pressable onPress={openPicker} style={s.addBtn} accessibilityRole="button">
          <T style={s.addText}>+ Add leave for {who === 'STAFF' ? 'a staff member' : 'a student'}</T>
        </Pressable>

        {banner && <T style={s.banner}>{banner}</T>}
        {error && <T style={s.error}>{error}</T>}

        {loading ? (
          <ActivityIndicator color={TH.royal} style={{ marginTop: 32 }} />
        ) : list.length === 0 ? (
          <View style={s.empty}>
            <Icon name="check" size={28} color={TH.muted} />
            <T style={s.emptyText}>{filter === 'PENDING' ? 'No leave is waiting for approval.' : 'Nothing here.'}</T>
          </View>
        ) : (
          list.map(renderLeave)
        )}
      </ScrollView>

      {/* Approve / reject with an optional note */}
      <Modal visible={!!decide} transparent animationType="fade" onRequestClose={() => !busy && setDecide(null)} statusBarTranslucent navigationBarTranslucent>
        <KeyboardFrame own>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <T style={s.sheetTitle}>{decide?.next === 'APPROVED' ? 'Approve leave?' : 'Reject leave?'}</T>
            {decide && (
              <T style={s.meta}>
                {(who === 'STAFF' ? decide.leave.staffName : decide.leave.studentName) || ''} · {leaveTypeLabel(decide.leave.leaveType)} · {decide.leave.daysCount} day(s)
              </T>
            )}
            {decide?.next === 'APPROVED' && who === 'STAFF' && (
              <T style={s.hint}>Salary: 1 leave day a month is forgiven (sick first); other leave days are cut at monthly salary ÷ 30.</T>
            )}
            <TextInput value={remark} onChangeText={setRemark} placeholder="Note (optional)" placeholderTextColor={TH.muted} style={s.input} maxLength={300} />
            <View style={s.actions}>
              <Pressable onPress={() => setDecide(null)} style={[s.btn, s.btnGhost]} disabled={busy}>
                <T style={s.btnText}>Cancel</T>
              </Pressable>
              <Pressable onPress={confirmDecision} style={[s.btn, decide?.next === 'APPROVED' ? s.btnOk : s.btnBad]} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <T style={[s.btnText, { color: '#FFFFFF' }]}>{decide?.next === 'APPROVED' ? 'Approve' : 'Reject'}</T>}
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardFrame>
      </Modal>

      {/* Choose the person */}
      <Modal visible={picker} animationType="slide" onRequestClose={() => setPicker(false)} statusBarTranslucent navigationBarTranslucent>
        <SafeAreaView style={s.safe}>
          <KeyboardFrame own>
          <View style={s.pickHead}>
            <T style={s.sheetTitle}>{who === 'STAFF' ? 'Choose staff member' : 'Choose student'}</T>
            <Pressable onPress={() => setPicker(false)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T style={[s.btnText, { color: TH.royal }]}>Close</T>
            </Pressable>
          </View>
          <View style={{ padding: 16, paddingBottom: 0 }}>
            <TextInput value={query} onChangeText={setQuery} placeholder={who === 'STAFF' ? 'Search name or employee ID' : 'Search name, admission no. or class'} placeholderTextColor={TH.muted} style={s.input} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
            {peopleLoading ? (
              <ActivityIndicator color={TH.royal} />
            ) : filteredPeople.length === 0 ? (
              <T style={s.emptyText}>No one found.</T>
            ) : (
              filteredPeople.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setPicker(false);
                    setTarget(p);
                  }}
                  style={s.person}
                >
                  <T style={s.name}>{p.name}</T>
                  <T style={s.meta}>{who === 'STAFF' ? [p.employeeId, p.designation].filter(Boolean).join(' · ') : [p.admissionNumber, classLabel(p)].filter(Boolean).join(' · ')}</T>
                </Pressable>
              ))
            )}
          </ScrollView>
          </KeyboardFrame>
        </SafeAreaView>
      </Modal>

      <LeaveForm
        visible={!!target}
        kind={who === 'STAFF' ? 'staff' : 'student'}
        forLabel={target ? `For ${target.name}${target.employeeId ? ` (${target.employeeId})` : ''}` : undefined}
        allowApproveNow
        allowPastDates
        onClose={() => setTarget(null)}
        onSubmit={addLeave}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.bg },
  segment: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 6, gap: 6, borderBottomWidth: 1, borderBottomColor: TH.border },
  segBtn: { flex: 1, minHeight: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segOn: { backgroundColor: TH.navy },
  segText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.muted },
  segTextOn: { color: '#FFFFFF' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: TH.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontFamily: FONT.bold, fontSize: 11, color: TH.navy },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  toolbar: { flexDirection: 'row' },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { backgroundColor: TH.royal, borderColor: TH.royal },
  chipText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  chipTextOn: { color: '#FFFFFF' },
  addBtn: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: TH.royal, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.tile },
  addText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
  banner: { fontFamily: FONT.medium, fontSize: 13, color: '#067647', backgroundColor: '#ECFDF3', padding: 10, borderRadius: 10 },
  error: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT.heading, fontSize: 14, color: TH.gold },
  name: { fontFamily: FONT.bold, fontSize: 15, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontFamily: FONT.semibold, fontSize: 11 },
  infoRow: { flexDirection: 'row', gap: 8, backgroundColor: TH.bg, borderRadius: 12, padding: 10 },
  info: { flex: 1 },
  infoLabel: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  infoValue: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink, marginTop: 2 },
  reason: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 19, color: '#475467' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnGhost: { borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF' },
  btnOk: { backgroundColor: '#067647' },
  btnBad: { backgroundColor: '#B42318' },
  btnText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyText: { fontFamily: FONT.medium, fontSize: 14, color: TH.muted, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,75,0.45)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 12 },
  sheetTitle: { fontFamily: FONT.bold, fontSize: 17, color: TH.navy },
  hint: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.goldInk, backgroundColor: TH.goldSoft, padding: 10, borderRadius: 10 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontFamily: FONT.regular, fontSize: 14, color: TH.ink },
  pickHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  person: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: TH.border, padding: 12, gap: 2 },
});
