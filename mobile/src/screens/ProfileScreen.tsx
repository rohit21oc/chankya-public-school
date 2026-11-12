import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { BRAND_COLORS, SCHOOL_INFO, resolveFileUrl } from '../utils/branding';
import { formatRoleLabel, getAuthorizedModulesForUser } from '../utils/rbac';
import { AttendanceCalendar } from '../components/AttendanceCalendar';
import { LeavePanel } from '../components/LeavePanel';
import { ChangePasswordCard } from '../components/auth/ChangePasswordCard';
import { NotificationsCard } from '../components/NotificationsCard';
import { Icon } from '../components/teacher-home/Icon';
import { apiService } from '../services/apiService';
import { MyStaffProfile } from '../components/profile/MyStaffProfile';
import { TH } from '../theme/teacherHome';
import { RefreshControl } from 'react-native';
import { NOT_CONFIGURED, affiliationLine, useSchoolIdentity } from '../services/schoolIdentity';

interface ProfileScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onLogout: () => void;
  onNavigateModule?: (moduleId: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onBack,
  onOpenMenu,
  onLogout,
  onNavigateModule,
}) => {
  const sid = useSchoolIdentity();
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);

  const roleName = formatRoleLabel(user.role);
  const isStudent = user.role === 'STUDENT';
  const allowed = useMemo(() => new Set(getAuthorizedModulesForUser(user).map((m) => m.id)), [user]);
  const loadCalendar = useCallback(
    () => (isStudent
      ? apiService.getStudentCalendar(user.studentId || user.id)
      : apiService.getStaffCalendar(user.employeeId || user.id)),
    [isStudent, user.studentId, user.employeeId, user.id]
  );
  const recordTiles = [
    { id: 'my-payroll', label: 'My Payroll', sub: 'Salary & payslips', icon: 'wallet' as const },
    { id: 'my-id-card', label: 'My ID Card', sub: 'View & download', icon: 'id-card' as const },
  ].filter((t) => allowed.has(t.id) && !!onNavigateModule);
  const avatarUri = user.avatar ? resolveFileUrl(user.avatar) : null;
  const initials = (user.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleSyncSession = async () => {
    setSyncing(true);
    setSyncSuccess(null);
    try {
      const res = await apiService.verifyCurrentSession();
      if (res.valid) {
        setSyncSuccess('Session actively synchronized with campus server.');
      } else {
        Alert.alert('Session Expired', 'Your authentication session has expired. Please sign in again.');
        onLogout();
      }
    } catch {
      Alert.alert('Network Issue', 'Could not sync session with server.');
    } finally {
      setSyncing(false);
    }
  };

  // Every staff role gets the same profile as teachers (ID card, payroll, details, contact, attendance, leave, password).
  if (!isStudent && user.role !== 'PARENT') {
    return (
      <StaffProfileLayout
        user={user}
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        onLogout={onLogout}
        records={recordTiles.map((t) => t.id as 'my-payroll' | 'my-id-card')}
        onOpen={(id) => onNavigateModule?.(id)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        showBack
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        title="My Profile"
        subtitle="Account & Security"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card Header */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>

          <Text style={styles.userName}>{user.name}</Text>

          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{roleName}</Text>
          </View>

          <View style={styles.statusLivePill}>
            <View style={styles.greenDot} />
            <Text style={styles.statusLiveText}>Active Session • Verified</Text>
          </View>
        </View>

        {/* Personal records: payroll and ID card live here only (not in the drawer) */}
        {recordTiles.length > 0 && (
          <View style={styles.tilesRow}>
            {recordTiles.map((t) => (
              <TouchableOpacity key={t.id} style={styles.tile} onPress={() => onNavigateModule!(t.id)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t.label}>
                <View style={styles.tileIcon}><Icon name={t.icon} size={22} color={BRAND_COLORS.primaryRoyal} /></View>
                <Text style={styles.tileLabel}>{t.label}</Text>
                <Text style={styles.tileSub}>{t.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <AttendanceCalendar key={calendarKey} title="My Attendance" load={loadCalendar} salaryCut={!isStudent} />
        <LeavePanel
          kind={isStudent ? 'student' : 'staff'}
          subjectId={isStudent ? user.studentId || user.id : user.id}
          employeeId={isStudent ? undefined : user.employeeId}
          onChanged={() => setCalendarKey((k) => k + 1)}
        />
        <NotificationsCard />
        <ChangePasswordCard />

        {/* Sync message */}
        {syncSuccess && (
          <View style={styles.syncBox}>
            <Text style={styles.syncText}>✓ {syncSuccess}</Text>
          </View>
        )}

        {/* Personal & Academic Details Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>CREDENTIAL & ACCOUNT DETAILS</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Identifier</Text>
            <Text style={styles.detailValue}>{user.username}</Text>
          </View>

          {user.employeeId && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Employee ID</Text>
              <Text style={styles.detailValue}>{user.employeeId}</Text>
            </View>
          )}

          {user.studentId && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Admission Number</Text>
              <Text style={styles.detailValue}>{user.username}</Text>
            </View>
          )}

          {user.phone && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Registered Mobile</Text>
              <Text style={styles.detailValue}>📞 {user.phone}</Text>
            </View>
          )}

          {user.email && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Official Email</Text>
              <Text style={styles.detailValue}>{user.email}</Text>
            </View>
          )}

          {user.gender && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Gender</Text>
              <Text style={styles.detailValue}>{user.gender}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Status</Text>
            <Text style={[styles.detailValue, { color: BRAND_COLORS.success }]}>
              {user.status || 'ACTIVE'}
            </Text>
          </View>
        </View>

        {/* Institutional Campus Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>INSTITUTIONAL AFFILIATION</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>School Name</Text>
            <Text style={styles.detailValue}>{sid.name || NOT_CONFIGURED}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Board & Affiliation</Text>
            <Text style={styles.detailValue}>{sid.affiliationNo ? `${sid.board ? `${sid.board} ` : ''}(${sid.affiliationNo})` : NOT_CONFIGURED}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>School Code</Text>
            <Text style={styles.detailValue}>{sid.schoolCode || NOT_CONFIGURED}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Academic Session</Text>
            <Text style={styles.detailValue}>{sid.session || SCHOOL_INFO.currentSession}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Campus Location</Text>
            <Text style={styles.detailValue}>Sheohar, Bihar - 843329</Text>
          </View>
        </View>

        {/* Session & Security Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={handleSyncSession}
            disabled={syncing}
            activeOpacity={0.7}
          >
            {syncing ? (
              <ActivityIndicator color={BRAND_COLORS.primaryRoyal} size="small" />
            ) : (
              <Text style={styles.syncBtnText}>🔄 Verify & Sync Live Session</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={onLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutBtnText}>🚪 Sign Out from Device</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BRAND_COLORS.accentGold,
    overflow: 'hidden',
    marginBottom: 10,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  rolePill: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND_COLORS.primaryRoyal,
  },
  statusLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16803C',
  },
  statusLiveText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16803C',
  },
  syncBox: {
    backgroundColor: '#ECFDF3',
    margin: 14,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A6F4C5',
    alignItems: 'center',
  },
  syncText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16803C',
  },
  tilesRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tile: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: BRAND_COLORS.borderColor, padding: 14 },
  tileIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: BRAND_COLORS.infoLight, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileLabel: { fontSize: 14, fontWeight: '800', color: BRAND_COLORS.textPrimary },
  tileSub: { fontSize: 12, color: BRAND_COLORS.textMuted, marginTop: 2 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  actionsCard: {
    marginHorizontal: 14,
    marginTop: 16,
    gap: 10,
  },
  syncBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND_COLORS.primaryRoyal,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: {
    color: BRAND_COLORS.primaryRoyal,
    fontSize: 13,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '700',
  },
});

/** Staff profile page: school header + the shared MyStaffProfile, with pull-to-refresh. */
export const StaffProfileLayout: React.FC<{
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onLogout: () => void;
  records: Array<'my-payroll' | 'my-id-card'>;
  onOpen: (id: 'my-payroll' | 'my-id-card') => void;
  extra?: React.ReactNode;
}> = ({ user, onBack, onOpenMenu, onLogout, records, onOpen, extra }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: TH.bg }}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} title="My Profile" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setRefreshKey((k) => k + 1);
            }}
            colors={[BRAND_COLORS.primaryBright]}
          />
        }
      >
        <MyStaffProfile user={user} records={records} onOpen={onOpen} onLogout={onLogout} extra={extra} refreshKey={refreshKey} onLoaded={() => setRefreshing(false)} />
      </ScrollView>
    </SafeAreaView>
  );
};
