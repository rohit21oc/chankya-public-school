import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, MobileModule, TimetableSlot } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { ModuleCard } from '../components/ModuleCard';
import { useActivity } from '../services/activityStore';
import {
  getDoMoreGridModules,
  getModuleTitleForUser,
  formatRoleLabel,
} from '../utils/rbac';
import { BRAND_COLORS, SCHOOL_INFO } from '../utils/branding';
import { apiService } from '../services/apiService';
import { TeacherDashboardScreen } from './TeacherDashboardScreen';
import { AdminDashboardScreen } from './AdminDashboardScreen';
import { NOT_CONFIGURED, affiliationLine, useSchoolIdentity } from '../services/schoolIdentity';

interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onNavigateModule: (moduleId: string) => void;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  onLogout,
  onOpenMenu,
  onOpenProfile,
  onNavigateModule,
}) => {
  const sid = useSchoolIdentity();
  const activity = useActivity();
  const [refreshing, setRefreshing] = useState(false);
  const [todaySlots, setTodaySlots] = useState<TimetableSlot[]>([]);
  const [unreadNoticesCount, setUnreadNoticesCount] = useState<number>(0);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const roleName = formatRoleLabel(user.role);
  const gridModules = getDoMoreGridModules(user);

  const todayDate = new Date();
  const dayName = DAYS_OF_WEEK[todayDate.getDay()];
  const formattedDate = todayDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isTeacher = user.role === 'TEACHER';
  const isAdmin = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR'].includes(user.role);
  const isStaff = !isTeacher && !isAdmin && user.role !== 'STUDENT' && user.role !== 'PARENT';

  // Determine Attendance Quick Link destination based on role
  const attendanceDestination = isTeacher
    ? 'student-attendance'
    : isAdmin
    ? 'student-attendance'
    : isStaff
    ? 'staff-attendance'
    : 'student-attendance';

  const loadDashboardData = async () => {
    setLoadingSchedule(true);
    try {
      // 1. Fetch today's timetable slots
      const timetableRes = await apiService.getTimetables({});
      if (timetableRes.ok && Array.isArray(timetableRes.data)) {
        const slotsForToday = timetableRes.data.filter(
          (t) => (t.dayOfWeek || '').trim().toLowerCase() === dayName.toLowerCase()
        );
        setTodaySlots(slotsForToday.sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0)));
      }

      // 2. Fetch notices count for notification indicator
      const noticesRes = await apiService.getNotices();
      if (noticesRes.ok && Array.isArray(noticesRes.data)) {
        setUnreadNoticesCount(noticesRes.data.length);
      }
    } catch (err) {
      console.warn('[Dashboard] Error loading dashboard data:', err);
    } finally {
      setLoadingSchedule(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Teachers get the scoped TeacherDashboardScreen, which loads its own data.
    // Skip the generic loader so no unscoped /api/timetables request is made for them.
    if (user.role === 'TEACHER' || isAdmin) return;
    loadDashboardData();
  }, [user.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await apiService.verifyCurrentSession();
    await loadDashboardData();
  };

  const handleModuleClick = (module: MobileModule) => {
    onNavigateModule(module.id);
  };

  // All hooks above run unconditionally; only the render branches here.
  if (user.role === 'TEACHER') {
    return (
      <TeacherDashboardScreen
        user={user}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
        onNavigateModule={onNavigateModule}
      />
    );
  }

  // Admin-tier roles get the live school overview.
  if (isAdmin) {
    return (
      <AdminDashboardScreen
        user={user}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
        onNavigateModule={onNavigateModule}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. Compact Blue Top Header with School Name, Notification & Logout Icons */}
      <SchoolHeader
        user={user}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[BRAND_COLORS.primaryBright]}
          />
        }
      >
        {/* Compact User Identity & Session Bar */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeTop}>
            <View style={styles.welcomeTextCol}>
              <Text style={styles.greetingText}>Welcome back,</Text>
              <Text style={styles.userNameText} numberOfLines={1}>
                {user.name}
              </Text>
            </View>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{roleName}</Text>
            </View>
          </View>

          <View style={styles.welcomeMetaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>TODAY</Text>
              <Text style={styles.metaValue}>{formattedDate}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>SESSION</Text>
              <Text style={styles.metaValue}>{SCHOOL_INFO.currentSession}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>AFFILIATION</Text>
              <Text style={styles.metaValue}>{sid.board || NOT_CONFIGURED}</Text>
            </View>
          </View>
        </View>

        {/* 2. Quick Links Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeaderTitle}>Quick Links</Text>
            <Text style={styles.sectionHeaderBadge}>Instant Access</Text>
          </View>

          <View style={styles.quickLinksCard}>
            {/* Quick Link 1: Communication */}
            <TouchableOpacity
              style={styles.quickLinkItem}
              onPress={() => onNavigateModule('communication')}
              activeOpacity={0.7}
              accessibilityLabel="Open Communication and Notices"
            >
              <View style={styles.quickLinkIconBadge}>
                <Text style={styles.quickLinkEmoji}>📢</Text>
              </View>
              <Text style={styles.quickLinkLabel} numberOfLines={1}>
                Communication
              </Text>
            </TouchableOpacity>

            {/* Quick Link 2: Live Events */}
            <TouchableOpacity
              style={styles.quickLinkItem}
              onPress={() => onNavigateModule('live-events')}
              activeOpacity={0.7}
              accessibilityLabel="Open Live Events"
            >
              <View style={styles.quickLinkIconBadge}>
                <Text style={styles.quickLinkEmoji}>🎟️</Text>
              </View>
              <Text style={styles.quickLinkLabel} numberOfLines={1}>
                Live Events
              </Text>
            </TouchableOpacity>

            {/* Quick Link 3: Attendance */}
            <TouchableOpacity
              style={styles.quickLinkItem}
              onPress={() => onNavigateModule(attendanceDestination)}
              activeOpacity={0.7}
              accessibilityLabel="Open Attendance Register"
            >
              <View style={styles.quickLinkIconBadge}>
                <Text style={styles.quickLinkEmoji}>📋</Text>
              </View>
              <Text style={styles.quickLinkLabel} numberOfLines={1}>
                Attendance
              </Text>
            </TouchableOpacity>

            {/* Quick Link 4: Timetable */}
            <TouchableOpacity
              style={styles.quickLinkItem}
              onPress={() => onNavigateModule('timetable')}
              activeOpacity={0.7}
              accessibilityLabel="Open Weekly Timetable"
            >
              <View style={styles.quickLinkIconBadge}>
                <Text style={styles.quickLinkEmoji}>📅</Text>
              </View>
              <Text style={styles.quickLinkLabel} numberOfLines={1}>
                Timetable
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Do More Section: 3-Column Grid of Square Module Cards */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionHeaderTitle}>Do More</Text>
              <Text style={styles.sectionSubtitle}>
                {gridModules.length} Authorized Modules • {roleName}
              </Text>
            </View>
          </View>

          <View style={styles.gridContainer}>
            {gridModules.map((module) => {
              const displayTitle = getModuleTitleForUser(module, user);
              return (
                <View key={module.id} style={styles.gridColumn}>
                  <ModuleCard
                    module={module}
                    titleOverride={displayTitle}
                    variant="square"
                    badge={module.id === 'messages' ? activity.messages : module.id === 'communication' ? activity.noticesNew : 0}
                    onPress={handleModuleClick}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* 4. Today's Period Schedule Preview */}
        {todaySlots.length > 0 && (
          <View style={styles.scheduleContainer}>
            <View style={styles.scheduleHeaderRow}>
              <View style={styles.scheduleTitleCol}>
                <Text style={styles.scheduleSectionIcon}>🕒</Text>
                <Text style={styles.scheduleSectionTitle}>
                  {isTeacher ? 'My Schedule Today' : 'Today\'s Timetable'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onNavigateModule('timetable')}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllLink}>Full Week →</Text>
              </TouchableOpacity>
            </View>

            {loadingSchedule ? (
              <View style={styles.scheduleLoadingBox}>
                <ActivityIndicator size="small" color={BRAND_COLORS.primaryRoyal} />
                <Text style={styles.scheduleLoadingText}>Loading schedule...</Text>
              </View>
            ) : (
              <View style={styles.slotsList}>
                {todaySlots.slice(0, 3).map((slot) => (
                  <View key={slot.id || `${slot.periodNumber}-${slot.dayOfWeek}`} style={styles.slotRow}>
                    <View style={styles.slotPeriodPill}>
                      <Text style={styles.slotPeriodNum}>P{slot.periodNumber}</Text>
                      <Text style={styles.slotPeriodTime}>{slot.startTime || '09:00'}</Text>
                    </View>
                    <View style={styles.slotDetails}>
                      <Text style={styles.slotSubject} numberOfLines={1}>
                        {slot.subjectName}
                      </Text>
                      <Text style={styles.slotClass}>
                        Class: {slot.className || slot.classId} {slot.section ? `(${slot.section})` : ''}
                        {slot.roomNumber ? ` • Room ${slot.roomNumber}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}

                {todaySlots.length > 3 && (
                  <TouchableOpacity
                    style={styles.moreSlotsBtn}
                    onPress={() => onNavigateModule('timetable')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.moreSlotsText}>
                      + {todaySlots.length - 3} more periods scheduled today
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* 5. Institutional Support & Accreditation Footer */}
        <View style={styles.supportBox}>
          <Text style={styles.supportTitle}>{sid.name}</Text>
          <Text style={styles.supportSub}>
            {[affiliationLine(sid), sid.address, [sid.helpline || sid.phones[0], sid.email].filter(Boolean).join(' • ')].filter(Boolean).join('\n')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },

  // Welcome Greeting Card
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  welcomeTextCol: {
    flex: 1,
    marginRight: 8,
  },
  greetingText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  roleTag: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND_COLORS.primaryRoyal,
  },
  welcomeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
  },
  metaLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1.5,
  },

  // Section Layout
  sectionContainer: {
    marginTop: 14,
    marginHorizontal: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  sectionHeaderBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND_COLORS.primaryRoyal,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },

  // Quick Links Card
  quickLinksCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  quickLinkItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  quickLinkIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickLinkEmoji: {
    fontSize: 20,
    color: BRAND_COLORS.primaryRoyal,
  },
  quickLinkLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },

  // Do More 3-Column Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridColumn: {
    width: '31.3%',
    marginBottom: 10,
  },

  // Schedule Preview
  scheduleContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scheduleTitleCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleSectionIcon: {
    fontSize: 15,
  },
  scheduleSectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  viewAllLink: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND_COLORS.primaryRoyal,
  },
  scheduleLoadingBox: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  scheduleLoadingText: {
    fontSize: 11,
    color: '#64748B',
  },
  slotsList: {
    gap: 7,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotPeriodPill: {
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  slotPeriodNum: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  slotPeriodTime: {
    color: BRAND_COLORS.accentGoldLight,
    fontSize: 8.5,
    fontWeight: '600',
  },
  slotDetails: {
    flex: 1,
  },
  slotSubject: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  slotClass: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  moreSlotsBtn: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreSlotsText: {
    fontSize: 10.5,
    color: BRAND_COLORS.primaryBright,
    fontWeight: '700',
  },

  // Institutional Footer
  supportBox: {
    marginTop: 16,
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  supportSub: {
    fontSize: 9.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 14,
  },
});
