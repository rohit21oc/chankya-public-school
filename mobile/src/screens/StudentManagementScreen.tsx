import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, Student, ClassItem } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { StateView } from '../components/ui/StateView';
import { Avatar } from '../components/ui/Avatar';
import { Chip } from '../components/ui/Chip';
import { apiService } from '../services/apiService';
import { BRAND_COLORS } from '../utils/branding';
import { isHostelResident } from '../utils/profileSections';
import { buildAdminDashboardModel, showCount } from '../utils/adminDashboardModel';
import { sectionNames } from '../utils/marksEntryRules';
import { StudentProfileView } from './StudentProfileView';
import { FormDownloadButton } from '../components/ui/FormDownloadButton';

interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenProfile?: () => void;
}

const PAGE = 30;
const STATUS_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'INACTIVE', label: 'Inactive' },
  { id: 'ALL', label: 'All' },
];

export const StudentManagementScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile }) => {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [classId, setClassId] = useState('');
  const [section, setSection] = useState('');
  const [session, setSession] = useState('');
  const [sessions, setSessions] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [rows, setRows] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ReturnType<typeof buildAdminDashboardModel> | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const seq = useRef(0);

  // Filters data
  useEffect(() => {
    apiService.getClasses().then((r) => r.ok && setClasses(r.data));
    apiService.getAcademicSessions().then((r) => {
      if (r.ok) setSessions(r.data.map((s) => s.name));
    });
    apiService.getDashboardSummary().then((r) => r.ok && r.data && setStats(buildAdminDashboardModel(r.data)));
  }, []);

  // Debounce the search box so typing does not fire a request per key.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (nextPage: number, mode: 'replace' | 'append' | 'refresh') => {
      const mySeq = ++seq.current;
      if (mode === 'replace') setState('loading');
      if (mode === 'append') setLoadingMore(true);
      const res = await apiService.getStudentsPage({
        classId: classId || undefined,
        section: section || undefined,
        status: status === 'ALL' ? undefined : status,
        academicSession: session || undefined,
        search: search || undefined,
        page: nextPage,
        limit: PAGE,
      });
      if (mySeq !== seq.current) return; // a newer request replaced this one
      setLoadingMore(false);
      setRefreshing(false);
      if (!res.ok) {
        if (mode !== 'append') { setError(res.error || 'Could not load students.'); setState('error'); }
        return;
      }
      setRows((prev) => (mode === 'append' ? [...prev, ...res.data] : res.data));
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setPage(nextPage);
      setState('ready');
    },
    [classId, section, status, session, search]
  );

  useEffect(() => {
    void load(1, 'replace');
  }, [load]);

  const selectedClass = classes.find((c) => c.id === classId);

  if (selected) {
    return (
      <StudentProfileView
        user={user}
        student={selected}
        onBack={() => setSelected(null)}
        onOpenMenu={onOpenMenu}
        onChanged={() => { void load(1, 'refresh'); apiService.getDashboardSummary().then((r) => r.ok && r.data && setStats(buildAdminDashboardModel(r.data))); }}
      />
    );
  }

  const header = (
    <View>
      {['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ACCOUNTANT', 'HR_STAFF'].includes(user.role) && (
        <FormDownloadButton kind="student" label="Download Admission Form (PDF)" />
      )}
      {stats && (
        <View style={styles.statsRow}>
          <Stat label="Total" value={showCount(stats.students.total)} />
          <Stat label="Active" value={showCount(stats.students.active)} color={BRAND_COLORS.success} />
          <Stat label="Inactive" value={showCount(stats.students.inactive)} color={BRAND_COLORS.warning} />
          <Stat label="Hostel" value={showCount(stats.students.hostel)} />
          <Stat label="Day" value={showCount(stats.students.dayScholars)} />
        </View>
      )}
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search name, admission no. or phone"
        placeholderTextColor="#94A3B8"
        autoCorrect={false}
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {STATUS_FILTERS.map((s) => <Chip key={s.id} label={s.label} active={status === s.id} onPress={() => setStatus(s.id)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <Chip label="All classes" active={!classId} onPress={() => { setClassId(''); setSection(''); }} />
        {classes.map((c) => <Chip key={c.id} label={c.name} active={classId === c.id} onPress={() => { setClassId(c.id); setSection(''); }} />)}
      </ScrollView>
      {selectedClass && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Chip label="All sections" active={!section} onPress={() => setSection('')} />
          {sectionNames(selectedClass).map((s) => <Chip key={s} label={`Section ${s}`} active={section === s} onPress={() => setSection(s)} />)}
        </ScrollView>
      )}
      {sessions.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Chip label="All sessions" active={!session} onPress={() => setSession('')} />
          {sessions.map((s) => <Chip key={s} label={s} active={session === s} onPress={() => setSession(s)} />)}
        </ScrollView>
      )}
      {state === 'ready' && <Text style={styles.count}>{total} student{total === 1 ? '' : 's'}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="Students" subtitle="Student Management" />
      {(
        <FlatList
          data={rows}
          keyExtractor={(s: Student) => s.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(1, 'refresh'); }} colors={[BRAND_COLORS.primaryBright]} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            state === 'loading' ? <StateView variant="loading" title="Loading students" />
            : state === 'error' ? <StateView variant="error" title="Students unavailable" message={error} onRetry={() => load(1, 'replace')} />
            : <StateView variant="empty" title="No students found" message="Try a different search or filter." />
          }
          ListFooterComponent={
            page < totalPages ? (
              <TouchableOpacity style={styles.more} onPress={() => load(page + 1, 'append')} disabled={loadingMore} accessibilityRole="button">
                {loadingMore ? <ActivityIndicator color={BRAND_COLORS.primaryRoyal} /> : <Text style={styles.moreText}>Load more</Text>}
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }: { item: Student }) => (
            <TouchableOpacity style={styles.row} onPress={() => setSelected(item)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}>
              <Avatar name={item.name} photo={item.photo || item.photoFileKey} size={46} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>Adm {item.admissionNumber}{item.rollNumber ? ` • Roll ${item.rollNumber}` : ''}</Text>
                <Text style={styles.sub} numberOfLines={1}>{[item.className, item.section && `Section ${item.section}`].filter(Boolean).join(' • ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.badge, item.status === 'ACTIVE' ? styles.ok : styles.warn]}>{item.status}</Text>
                <Text style={styles.sub}>{isHostelResident(item) ? 'Hostel' : 'Day scholar'}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const Stat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_COLORS.surfaceSoft },
  list: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: BRAND_COLORS.borderColor, paddingVertical: 12, marginBottom: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: BRAND_COLORS.primaryRoyal },
  statLabel: { fontSize: 11, color: BRAND_COLORS.textMuted, marginTop: 2 },
  search: { minHeight: 44, borderWidth: 1, borderColor: BRAND_COLORS.borderColor, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontSize: 14, color: BRAND_COLORS.textPrimary, marginBottom: 10 },
  chips: { marginBottom: 8, flexGrow: 0 },
  count: { fontSize: 12, color: BRAND_COLORS.textMuted, marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: BRAND_COLORS.borderColor, padding: 12, marginBottom: 8, minHeight: 64 },
  name: { fontSize: 15, fontWeight: '700', color: BRAND_COLORS.textPrimary },
  sub: { fontSize: 12, color: BRAND_COLORS.textMuted, marginTop: 1 },
  badge: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  ok: { backgroundColor: BRAND_COLORS.successLight, color: BRAND_COLORS.success },
  warn: { backgroundColor: BRAND_COLORS.warningLight, color: BRAND_COLORS.warning },
  more: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  moreText: { fontSize: 14, fontWeight: '700', color: BRAND_COLORS.primaryBright },
});
