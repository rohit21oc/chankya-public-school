import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { Student, User, Exam, ExamMark } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { SectionCard } from '../components/ui/SectionCard';
import { StateView } from '../components/ui/StateView';
import { Avatar } from '../components/ui/Avatar';
import { Chip } from '../components/ui/Chip';
import { TabStrip } from '../components/ui/TabStrip';
import { ProfileSections } from '../components/ui/ProfileSections';
import { AttendanceCalendar } from '../components/AttendanceCalendar';
import { IdCard } from '../components/IdCard';
import { apiService } from '../services/apiService';
import { BRAND_COLORS } from '../utils/branding';
import { buildStudentSections, isHostelResident, listDocuments } from '../utils/profileSections';
import { buildStudentIdCardModel } from '../utils/idCardModel';
import { formatDisplayDate, formatRupees, ledgerPending, ledgerState, ledgerTotal, summarizeFees } from '../utils/parentRules';
import { computeCbseEvaluation } from '../utils/reportCardRules';

interface Props {
  user: User;
  student: Student;
  onBack: () => void;
  onOpenMenu?: () => void;
  onChanged: () => void;
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'fees', label: 'Fees' },
  { id: 'marks', label: 'Marks' },
  { id: 'idcard', label: 'ID Card' },
  { id: 'documents', label: 'Documents' },
];

const STATUS_ACTIONS: Array<{ status: string; label: string }> = [
  { status: 'ACTIVE', label: 'Mark active' },
  { status: 'INACTIVE', label: 'Mark inactive' },
];

const STATE_COLOR: Record<string, string> = { PAID: BRAND_COLORS.success, PARTIAL: BRAND_COLORS.warning, OVERDUE: BRAND_COLORS.error, DUE: BRAND_COLORS.info };

export const StudentProfileView: React.FC<Props> = ({ user, student: initial, onBack, onOpenMenu, onChanged }) => {
  const [student, setStudent] = useState<Student & Record<string, any>>(initial as any);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);

  // The list row has the basics; fetch the complete record for the profile.
  const [detailError, setDetailError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    apiService.getStudentById(initial.id).then((r) => {
      if (!live) return;
      if (r.ok && r.data) setStudent(r.data as any);
      else setDetailError(r.error || 'Could not load the complete record.');
    });
    return () => { live = false; };
  }, [initial.id]);

  const canChangeStatus = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'].includes(user.role);

  const changeStatus = (status: string) => {
    if (status === student.status) return;
    Alert.alert(
      status === 'ACTIVE' ? 'Mark student active?' : 'Mark student inactive?',
      `${student.name} will be marked ${status.toLowerCase()}.` + (status !== 'ACTIVE' ? '\n\nInactive students are left out of attendance, marks entry and fee generation.' : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: status === 'ACTIVE' ? 'default' : 'destructive',
          onPress: async () => {
            setBusy(true);
            const res = await apiService.setStudentStatus(student.id, status);
            setBusy(false);
            if (res.ok) {
              setStudent((s) => ({ ...s, status: status as any }));
              onChanged();
            } else {
              Alert.alert('Could not change status', res.error || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const loadCalendar = useCallback(() => apiService.getStudentCalendar(student.id), [student.id]);
  const sections = useMemo(() => buildStudentSections(student), [student]);
  const hostel = isHostelResident(student);

  return (
    <SafeAreaView style={styles.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} title="Student Profile" subtitle={student.admissionNumber ? `Adm. ${student.admissionNumber}` : undefined} />
      <View style={styles.hero}>
        <Avatar name={student.name} photo={student.photo || student.photoFileKey} size={64} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name} numberOfLines={2}>{student.name}</Text>
          <Text style={styles.sub}>{[student.className, student.section && `Section ${student.section}`, student.rollNumber && `Roll ${student.rollNumber}`].filter(Boolean).join(' • ')}</Text>
          <View style={styles.badges}>
            <Text style={[styles.badge, student.status === 'ACTIVE' ? styles.badgeOk : styles.badgeWarn]}>{student.status || '—'}</Text>
            <Text style={[styles.badge, styles.badgeInfo]}>{hostel ? 'Hostel' : 'Day scholar'}</Text>
          </View>
        </View>
      </View>
      <TabStrip tabs={TABS} active={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'overview' && (
          <>
            {detailError && <Text style={styles.warn}>{detailError} Showing the basic details.</Text>}
            <ProfileSections sections={sections} />
            {canChangeStatus && (
              <SectionCard title="Status">
                <View style={styles.statusRow}>
                  {STATUS_ACTIONS.map((a) => (
                    <TouchableOpacity key={a.status} style={[styles.statusBtn, student.status === a.status && styles.statusBtnOff]} disabled={busy || student.status === a.status} onPress={() => changeStatus(a.status)} accessibilityRole="button">
                      <Text style={[styles.statusBtnText, student.status === a.status && { color: BRAND_COLORS.textMuted }]}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {busy && <ActivityIndicator color={BRAND_COLORS.primaryRoyal} />}
              </SectionCard>
            )}
          </>
        )}
        {tab === 'attendance' && <AttendanceCalendar title="Attendance" load={loadCalendar} />}
        {tab === 'fees' && <FeesTab studentId={student.id} />}
        {tab === 'marks' && <MarksTab student={student} />}
        {tab === 'idcard' && <IdCardTab studentId={student.id} />}
        {tab === 'documents' && <DocumentsTab record={student} />}
      </ScrollView>
    </SafeAreaView>
  );
};

const FeesTab: React.FC<{ studentId: string }> = ({ studentId }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'denied'>('loading');
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setState('loading');
    const r = await apiService.getChildFeeLedgers(studentId, { fresh: true });
    if (r.ok) { setLedgers(r.data); setState('ready'); }
    else if (r.status === 403) setState('denied');
    else { setError(r.error || 'Could not load fees.'); setState('error'); }
  }, [studentId]);
  useEffect(() => { void load(); }, [load]);

  if (state === 'loading') return <StateView variant="loading" title="Loading fees" />;
  if (state === 'denied') return <StateView variant="empty" title="No access" message="Your role does not have access to fee records." />;
  if (state === 'error') return <StateView variant="error" title="Fees unavailable" message={error} onRetry={load} />;
  const sum = summarizeFees(ledgers, []);
  const sorted = [...ledgers].sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')));
  return (
    <>
      <SectionCard title="Fee summary">
        <View style={styles.sumRow}>
          <Sum label="Billed" value={formatRupees(sum.totalBilled)} />
          <Sum label="Paid" value={formatRupees(sum.totalPaid)} color={BRAND_COLORS.success} />
          <Sum label="Pending" value={formatRupees(sum.totalPending)} color={sum.totalPending > 0 ? BRAND_COLORS.error : undefined} />
        </View>
        {sum.overdueCount > 0 && <Text style={styles.warn}>{formatRupees(sum.overdue)} overdue across {sum.overdueCount} invoice(s).</Text>}
      </SectionCard>
      <SectionCard title="Ledger" subtitle="Collection, refunds and waivers are handled on the website.">
        {sorted.length === 0 && <Text style={styles.muted}>No fee entries for this student.</Text>}
        {sorted.map((l) => {
          const st = ledgerState(l);
          return (
            <View key={l.id} style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerTitle} numberOfLines={1}>{l.monthYear || l.feeMonth || l.feeType || 'Fee'}</Text>
                <Text style={styles.muted}>{[l.invoiceNumber, l.dueDate && `Due ${formatDisplayDate(l.dueDate)}`].filter(Boolean).join(' • ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.ledgerAmt}>{formatRupees(ledgerTotal(l))}</Text>
                <Text style={[styles.ledgerState, { color: STATE_COLOR[st] }]}>{st === 'PAID' ? 'Paid' : `${formatRupees(ledgerPending(l))} ${st.toLowerCase()}`}</Text>
              </View>
            </View>
          );
        })}
      </SectionCard>
    </>
  );
};

const Sum: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <View style={{ flex: 1 }}>
    <Text style={[styles.sumValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={styles.muted}>{label}</Text>
  </View>
);

const MarksTab: React.FC<{ student: Student & Record<string, any> }> = ({ student }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState('');
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      const [ex, sub] = await Promise.all([apiService.getExams(), apiService.getSubjects()]);
      if (!live) return;
      if (!ex.ok) { setError(ex.error || 'Could not load examinations.'); setState('error'); return; }
      const mine = ex.data.filter((e) => (!e.academicSession || e.academicSession === student.academicSession) && (!e.classIds || e.classIds.length === 0 || e.classIds.includes(student.classId)));
      setExams(mine);
      setSubjects(Object.fromEntries((sub.data || []).map((s) => [s.id, s.name])));
      if (mine[0]) setExamId(mine[0].id);
      setState('ready');
    })();
    return () => { live = false; };
  }, [student.id]);

  useEffect(() => {
    if (!examId) { setMarks([]); return; }
    let live = true;
    apiService.getChildMarks(student.id, examId).then((r) => { if (live) setMarks(r.ok ? r.data : []); });
    return () => { live = false; };
  }, [examId, student.id]);

  if (state === 'loading') return <StateView variant="loading" title="Loading marks" />;
  if (state === 'error') return <StateView variant="error" title="Marks unavailable" message={error} />;
  if (exams.length === 0) return <StateView variant="empty" title="No examinations" message="No examinations apply to this student's class yet." />;

  const saved = marks.filter((m) => m.status !== 'DRAFT');
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {exams.map((e) => <Chip key={e.id} label={e.name} active={e.id === examId} onPress={() => setExamId(e.id)} />)}
      </ScrollView>
      <SectionCard title="Subject-wise marks" subtitle="Submitted marks only. Full report cards are in Report Card.">
        {saved.length === 0 && <Text style={styles.muted}>No marks have been submitted for this exam.</Text>}
        {saved.map((m) => {
          const ev = m.isAbsent ? null : computeCbseEvaluation(m.marksObtained, m.maxMarks);
          return (
            <View key={m.id || m.subjectId} style={styles.ledgerRow}>
              <Text style={[styles.ledgerTitle, { flex: 1 }]} numberOfLines={1}>{(m as any).subjectName || subjects[m.subjectId] || 'Subject'}</Text>
              <Text style={styles.ledgerAmt}>{m.isAbsent ? 'Absent' : `${m.marksObtained}/${m.maxMarks}`}</Text>
              <Text style={[styles.ledgerState, { color: ev && ev.status === 'FAIL' ? BRAND_COLORS.error : BRAND_COLORS.success, width: 44, textAlign: 'right' }]}>{m.isAbsent ? 'AB' : ev!.grade === 'E' ? 'E/F' : ev!.grade}</Text>
            </View>
          );
        })}
      </SectionCard>
    </>
  );
};

const IdCardTab: React.FC<{ studentId: string }> = ({ studentId }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<{ student?: Student; settings?: any; qrToken?: string }>({});
  const [error, setError] = useState('');
  const [side, setSide] = useState<'front' | 'back'>('front');
  const load = useCallback(async () => {
    setState('loading');
    const r = await apiService.getChildIdCard(studentId);
    if (r.ok && r.student) { setData(r); setState('ready'); } else { setError(r.error || 'Could not load the ID card.'); setState('error'); }
  }, [studentId]);
  useEffect(() => { void load(); }, [load]);
  if (state === 'loading') return <StateView variant="loading" title="Loading ID card" />;
  if (state === 'error') return <StateView variant="error" title="ID card unavailable" message={error} onRetry={load} />;
  return (
    <View style={{ alignItems: 'center' }}>
      <IdCard model={buildStudentIdCardModel(data.student, data.settings, data.qrToken)} side={side} onToggle={() => setSide((s) => (s === 'front' ? 'back' : 'front'))} />
      <Text style={[styles.muted, { marginTop: 10 }]}>Tap the card to turn it over.</Text>
    </View>
  );
};

const DocumentsTab: React.FC<{ record: any }> = ({ record }) => {
  const docs = listDocuments(record);
  return (
    <SectionCard title="Documents">
      {docs.length === 0 && <Text style={styles.muted}>No documents on record.</Text>}
      {docs.map((d) => (
        <View key={d.key} style={styles.ledgerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ledgerTitle} numberOfLines={2}>{d.title}</Text>
            {!!d.type && <Text style={styles.muted}>{d.type}</Text>}
          </View>
          {!!d.status && <Text style={[styles.badge, d.status === 'VERIFIED' ? styles.badgeOk : styles.badgeInfo]}>{d.status}</Text>}
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
  badgeOk: { backgroundColor: BRAND_COLORS.successLight, color: BRAND_COLORS.success },
  badgeWarn: { backgroundColor: BRAND_COLORS.warningLight, color: BRAND_COLORS.warning },
  badgeInfo: { backgroundColor: BRAND_COLORS.infoLight, color: BRAND_COLORS.info },
  content: { padding: 16, paddingBottom: 32 },
  warn: { fontSize: 12, color: BRAND_COLORS.warning, marginBottom: 10 },
  muted: { fontSize: 12, color: BRAND_COLORS.textMuted },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusBtn: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: BRAND_COLORS.primaryRoyal },
  statusBtnOff: { borderColor: BRAND_COLORS.borderColor, backgroundColor: BRAND_COLORS.surfaceSoft },
  statusBtnText: { fontSize: 13, fontWeight: '700', color: BRAND_COLORS.primaryRoyal },
  sumRow: { flexDirection: 'row', gap: 8 },
  sumValue: { fontSize: 18, fontWeight: '800', color: BRAND_COLORS.primary },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BRAND_COLORS.borderColor, gap: 8 },
  ledgerTitle: { fontSize: 14, fontWeight: '600', color: BRAND_COLORS.textPrimary },
  ledgerAmt: { fontSize: 14, fontWeight: '800', color: BRAND_COLORS.textPrimary },
  ledgerState: { fontSize: 12, fontWeight: '700' },
});
