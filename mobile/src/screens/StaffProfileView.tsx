import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { SectionCard } from '../components/ui/SectionCard';
import { StateView } from '../components/ui/StateView';
import { Avatar } from '../components/ui/Avatar';
import { TabStrip } from '../components/ui/TabStrip';
import { ProfileSections } from '../components/ui/ProfileSections';
import { AttendanceCalendar } from '../components/AttendanceCalendar';
import { IdCard } from '../components/IdCard';
import { apiService } from '../services/apiService';
import { BRAND_COLORS } from '../utils/branding';
import { buildStaffSections, isTeachingStaff, listDocuments } from '../utils/profileSections';
import { buildStaffIdCardModel } from '../utils/idCardModel';
import { formatRupees, normalizePayrollRecord } from '../utils/payrollRules';

interface Props {
  user: User;
  staff: any;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenStaffAttendance?: () => void;
  onChanged: () => void;
}

export const PAYROLL_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'HR_STAFF', 'ACCOUNTANT'];
const STATUS_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HR_STAFF'];

export const StaffProfileView: React.FC<Props> = ({ user, staff: initial, onBack, onOpenMenu, onOpenStaffAttendance, onChanged }) => {
  const [staff, setStaff] = useState<any>(initial);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const canSeePayroll = PAYROLL_ROLES.includes(user.role);
  const canChangeStatus = STATUS_ROLES.includes(user.role) && staff.id !== user.id && staff.employeeId !== user.employeeId;
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'leave', label: 'Leave' },
    ...(canSeePayroll ? [{ id: 'payroll', label: 'Payroll' }] : []),
    { id: 'idcard', label: 'ID Card' },
    { id: 'documents', label: 'Documents' },
  ];

  useEffect(() => {
    let live = true;
    apiService.getStaffById(initial.id).then((r) => {
      if (!live) return;
      if (r.ok && r.data) setStaff(r.data);
      else setDetailError(r.error || 'Could not load the complete record.');
    });
    return () => { live = false; };
  }, [initial.id]);

  const isActive = String(staff.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
  const sections = useMemo(() => buildStaffSections(staff, { canSeeFinancial: canSeePayroll }), [staff, canSeePayroll]);
  const calendarId = staff.employeeId || staff.id;
  const loadCalendar = useCallback(() => apiService.getStaffCalendar(calendarId), [calendarId]);

  const toggleStatus = () => {
    const next = isActive ? 'INACTIVE' : 'ACTIVE';
    Alert.alert(
      isActive ? 'Deactivate staff member?' : 'Activate staff member?',
      isActive
        ? `${staff.name} will be marked inactive and their app login will be disabled.`
        : `${staff.name} will be marked active and their login restored.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(true);
            const res = await apiService.setStaffStatus(staff.id, next);
            setBusy(false);
            if (res.ok) { setStaff((s: any) => ({ ...s, status: next })); onChanged(); }
            else Alert.alert('Could not change status', res.error || 'Please try again.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} title="Staff Profile" subtitle={staff.employeeId} />
      <View style={styles.hero}>
        <Avatar name={staff.name} photo={staff.photo || staff.photoFileKey} size={64} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name} numberOfLines={2}>{staff.name}</Text>
          <Text style={styles.sub}>{[staff.designation, staff.department].filter(Boolean).join(' • ')}</Text>
          <View style={styles.badges}>
            <Text style={[styles.badge, isActive ? styles.ok : styles.warn]}>{isActive ? 'ACTIVE' : String(staff.status).toUpperCase()}</Text>
            <Text style={[styles.badge, styles.info]}>{isTeachingStaff(staff) ? 'Teaching' : 'Non-teaching'}</Text>
          </View>
        </View>
      </View>
      <TabStrip tabs={tabs} active={tab} onChange={setTab} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'overview' && (
          <>
            {detailError && <Text style={styles.note}>{detailError} Showing directory details only.</Text>}
            <ProfileSections sections={sections} />
            {(canChangeStatus || (onOpenStaffAttendance && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HR_STAFF'].includes(user.role))) && (
              <SectionCard title="Actions">
                {onOpenStaffAttendance && (
                  <TouchableOpacity style={styles.btn} onPress={onOpenStaffAttendance} accessibilityRole="button">
                    <Text style={styles.btnText}>Open staff attendance register</Text>
                  </TouchableOpacity>
                )}
                {canChangeStatus && (
                  <TouchableOpacity style={[styles.btn, isActive && styles.btnDanger]} onPress={toggleStatus} disabled={busy} accessibilityRole="button">
                    {busy ? <ActivityIndicator color={BRAND_COLORS.primaryRoyal} /> : <Text style={[styles.btnText, isActive && { color: BRAND_COLORS.error }]}>{isActive ? 'Deactivate staff member' : 'Activate staff member'}</Text>}
                  </TouchableOpacity>
                )}
              </SectionCard>
            )}
          </>
        )}
        {tab === 'attendance' && <AttendanceCalendar title="Attendance" load={loadCalendar} salaryCut />}
        {tab === 'leave' && <LeaveTab staff={staff} />}
        {tab === 'payroll' && canSeePayroll && <PayrollTab staff={staff} />}
        {tab === 'idcard' && <IdCardTab staff={staff} user={user} />}
        {tab === 'documents' && <DocsTab staff={staff} />}
      </ScrollView>
    </SafeAreaView>
  );
};

const LeaveTab: React.FC<{ staff: any }> = ({ staff }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [leaves, setLeaves] = useState<any[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setState('loading');
    const r = await apiService.getStaffLeaves();
    if (!r.ok) { setError(r.error || 'Could not load leave records.'); setState('error'); return; }
    const emp = String(staff.employeeId || '').toUpperCase();
    setLeaves(r.data.filter((l) => l.staffId === staff.id || (emp && String(l.employeeId || '').toUpperCase() === emp)).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate))));
    setState('ready');
  }, [staff.id, staff.employeeId]);
  useEffect(() => { void load(); }, [load]);
  if (state === 'loading') return <StateView variant="loading" title="Loading leave" />;
  if (state === 'error') return <StateView variant="error" title="Leave unavailable" message={error} onRetry={load} />;
  return (
    <SectionCard title="Leave records" subtitle="Approvals are handled on the website.">
      {leaves.length === 0 && <Text style={styles.muted}>No leave applications.</Text>}
      {leaves.map((l) => (
        <View key={l.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{String(l.leaveType || 'Leave').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase())} • {l.daysCount} day(s)</Text>
            <Text style={styles.muted}>{l.startDate}{l.endDate && l.endDate !== l.startDate ? ` → ${l.endDate}` : ''}</Text>
            {!!l.reason && <Text style={styles.muted} numberOfLines={2}>{l.reason}</Text>}
          </View>
          <Text style={[styles.badge, l.status === 'APPROVED' ? styles.ok : l.status === 'REJECTED' ? styles.err : styles.warn]}>{l.status}</Text>
        </View>
      ))}
    </SectionCard>
  );
};

const PayrollTab: React.FC<{ staff: any }> = ({ staff }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'denied'>('loading');
  const [records, setRecords] = useState<any[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setState('loading');
    const r = await apiService.getStaffPayrollHistory(staff.employeeId || staff.id);
    if (r.ok) { setRecords(r.data.map(normalizePayrollRecord)); setState('ready'); }
    else if (r.status === 403) setState('denied');
    else { setError(r.error || 'Could not load payroll.'); setState('error'); }
  }, [staff.id, staff.employeeId]);
  useEffect(() => { void load(); }, [load]);
  const openSlip = async (id: string) => {
    const r = await apiService.getPayslipDownloadUrl(id);
    if (r.ok && r.url) Linking.openURL(r.url).catch(() => Alert.alert('Could not open', 'The salary slip could not be opened.'));
    else Alert.alert('Salary slip unavailable', r.error || 'Please try again.');
  };
  if (state === 'loading') return <StateView variant="loading" title="Loading payroll" />;
  if (state === 'denied') return <StateView variant="empty" title="No access" message="Your role cannot view payroll." />;
  if (state === 'error') return <StateView variant="error" title="Payroll unavailable" message={error} onRetry={load} />;
  return (
    <SectionCard title="Salary history" subtitle="Restricted: payroll roles only. Generating and paying salaries is done on the website.">
      {records.length === 0 && <Text style={styles.muted}>No payroll records yet.</Text>}
      {records.map((p) => (
        <TouchableOpacity key={p.id} style={styles.row} onPress={() => openSlip(p.id)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Open salary slip for ${p.month}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{p.month}</Text>
            <Text style={styles.muted}>Gross {formatRupees(p.gross)} • Deductions {formatRupees(p.deductions)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amt}>{formatRupees(p.net)}</Text>
            <Text style={[styles.badge, p.status === 'PAID' ? styles.ok : styles.warn]}>{p.status}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </SectionCard>
  );
};

const IdCardTab: React.FC<{ staff: any; user: User }> = ({ staff, user }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<{ staff?: any; settings?: any; qrToken?: string }>({});
  const [error, setError] = useState('');
  const [side, setSide] = useState<'front' | 'back'>('front');
  const load = useCallback(async () => {
    setState('loading');
    const r = await apiService.getStaffIdCard(staff.id);
    if (r.ok && r.staff) { setData(r); setState('ready'); } else { setError(r.error || 'Could not load the ID card.'); setState('error'); }
  }, [staff.id]);
  useEffect(() => { void load(); }, [load]);
  if (state === 'loading') return <StateView variant="loading" title="Loading ID card" />;
  if (state === 'error') return <StateView variant="error" title="ID card unavailable" message={error} onRetry={load} />;
  return (
    <View style={{ alignItems: 'center' }}>
      <IdCard model={buildStaffIdCardModel(data.staff, data.settings, user, data.qrToken)} side={side} onToggle={() => setSide((s) => (s === 'front' ? 'back' : 'front'))} />
      <Text style={[styles.muted, { marginTop: 10 }]}>Tap the card to turn it over.</Text>
    </View>
  );
};

const DocsTab: React.FC<{ staff: any }> = ({ staff }) => {
  const docs = listDocuments(staff);
  return (
    <SectionCard title="Documents">
      {docs.length === 0 && <Text style={styles.muted}>No documents on record.</Text>}
      {docs.map((d) => (
        <View key={d.key} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={2}>{d.title}</Text>
            {!!d.type && <Text style={styles.muted}>{d.type}</Text>}
          </View>
          {!!d.status && <Text style={[styles.badge, d.status === 'VERIFIED' ? styles.ok : styles.info]}>{d.status}</Text>}
        </View>
      ))}
    </SectionCard>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_COLORS.surfaceSoft },
  hero: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF' },
  name: { fontSize: 18, fontWeight: '800', color: BRAND_COLORS.primary },
  sub: { fontSize: 12, color: BRAND_COLORS.textMuted, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  ok: { backgroundColor: BRAND_COLORS.successLight, color: BRAND_COLORS.success },
  warn: { backgroundColor: BRAND_COLORS.warningLight, color: BRAND_COLORS.warning },
  err: { backgroundColor: BRAND_COLORS.errorLight, color: BRAND_COLORS.error },
  info: { backgroundColor: BRAND_COLORS.infoLight, color: BRAND_COLORS.info },
  content: { padding: 16, paddingBottom: 32 },
  note: { fontSize: 12, color: BRAND_COLORS.warning, marginBottom: 10 },
  muted: { fontSize: 12, color: BRAND_COLORS.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BRAND_COLORS.borderColor, gap: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: BRAND_COLORS.textPrimary },
  amt: { fontSize: 15, fontWeight: '800', color: BRAND_COLORS.primary },
  btn: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: BRAND_COLORS.primaryRoyal, marginBottom: 8 },
  btnDanger: { borderColor: BRAND_COLORS.error },
  btnText: { fontSize: 14, fontWeight: '700', color: BRAND_COLORS.primaryRoyal },
});
