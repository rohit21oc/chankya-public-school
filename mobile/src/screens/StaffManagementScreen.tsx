import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { StateView } from '../components/ui/StateView';
import { Avatar } from '../components/ui/Avatar';
import { Chip } from '../components/ui/Chip';
import { apiService } from '../services/apiService';
import { BRAND_COLORS } from '../utils/branding';
import { isTeachingStaff } from '../utils/profileSections';
import { filterStaff, summarizeStaff } from '../utils/staffDirectory';
import { StaffProfileView } from './StaffProfileView';
import { FormDownloadButton } from '../components/ui/FormDownloadButton';

interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenProfile?: () => void;
  onNavigateModule?: (id: string) => void;
}

export const StaffManagementScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile, onNavigateModule }) => {
  const [all, setAll] = useState<any[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [kind, setKind] = useState<'ALL' | 'TEACHING' | 'NON_TEACHING'>('ALL');
  const [department, setDepartment] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setState('loading');
    const r = await apiService.getStaffDirectory();
    setRefreshing(false);
    if (r.ok) { setAll(r.data); setState('ready'); }
    else { setError(r.error || 'Could not load staff.'); setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => summarizeStaff(all), [all]);
  const list = useMemo(() => filterStaff(all, { query, status, kind, department }), [all, query, status, kind, department]);

  if (selected) {
    return (
      <StaffProfileView
        user={user}
        staff={selected}
        onBack={() => setSelected(null)}
        onOpenMenu={onOpenMenu}
        onOpenStaffAttendance={onNavigateModule ? () => onNavigateModule('staff-attendance') : undefined}
        onChanged={() => void load(true)}
      />
    );
  }

  const header = (
    <View>
      {['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HR_STAFF'].includes(user.role) && (
        <FormDownloadButton kind="staff" label="Download Staff Onboarding Form (PDF)" />
      )}
      <View style={styles.statsRow}>
        <Stat label="Total" value={summary.total} />
        <Stat label="Active" value={summary.active} color={BRAND_COLORS.success} />
        <Stat label="Inactive" value={summary.inactive} color={BRAND_COLORS.warning} />
        <Stat label="Teaching" value={summary.teaching} />
        <Stat label="Other" value={summary.nonTeaching} />
      </View>
      <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Search name, employee ID or designation" placeholderTextColor="#94A3B8" autoCorrect={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {(['ACTIVE', 'INACTIVE', 'ALL'] as const).map((s) => <Chip key={s} label={s === 'ALL' ? 'All' : s === 'ACTIVE' ? 'Active' : 'Inactive'} active={status === s} onPress={() => setStatus(s)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <Chip label="All staff" active={kind === 'ALL'} onPress={() => setKind('ALL')} />
        <Chip label="Teaching" active={kind === 'TEACHING'} onPress={() => setKind('TEACHING')} />
        <Chip label="Non-teaching" active={kind === 'NON_TEACHING'} onPress={() => setKind('NON_TEACHING')} />
      </ScrollView>
      {summary.departments.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Chip label="All departments" active={!department} onPress={() => setDepartment('')} />
          {summary.departments.map((d) => <Chip key={d.name} label={`${d.name} (${d.count})`} active={department === d.name} onPress={() => setDepartment(d.name)} />)}
        </ScrollView>
      )}
      {state === 'ready' && <Text style={styles.count}>{list.length} staff member{list.length === 1 ? '' : 's'}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="Staff" subtitle="Staff Management" />
      <FlatList
        data={list}
        keyExtractor={(s: any) => s.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} colors={[BRAND_COLORS.primaryBright]} />}
        ListEmptyComponent={
          state === 'loading' ? <StateView variant="loading" title="Loading staff" />
          : state === 'error' ? <StateView variant="error" title="Staff unavailable" message={error} onRetry={() => load()} />
          : <StateView variant="empty" title="No staff found" message="Try a different search or filter." />
        }
        renderItem={({ item }: { item: any }) => {
          const active = String(item.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
          return (
            <TouchableOpacity style={styles.row} onPress={() => setSelected(item)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}>
              <Avatar name={item.name} photo={item.photo || item.photoFileKey} size={46} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>{item.employeeId}{item.designation ? ` • ${item.designation}` : ''}</Text>
                <Text style={styles.sub} numberOfLines={1}>{[item.department, isTeachingStaff(item) ? 'Teaching' : 'Non-teaching'].filter(Boolean).join(' • ')}</Text>
              </View>
              <Text style={[styles.badge, active ? styles.ok : styles.warn]}>{active ? 'ACTIVE' : String(item.status).toUpperCase()}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
};

const Stat: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
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
});
