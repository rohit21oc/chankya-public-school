import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { getAuthorizedModulesForUser } from '../utils/rbac';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { SectionCard } from '../components/ui/SectionCard';
import { StateView } from '../components/ui/StateView';
import { Icon, IconName } from '../components/teacher-home/Icon';
import { BRAND_COLORS } from '../utils/branding';
import { formatRoleLabel } from '../utils/rbac';
import { apiService } from '../services/apiService';
import {
  AdminDashboardModel,
  AttendanceBlock,
  buildAdminDashboardModel,
  showCount,
} from '../utils/adminDashboardModel';

interface Props {
  user: User;
  onLogout: () => void;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onNavigateModule: (moduleId: string) => void;
}

/** Shortcuts shown on the admin dashboard. Only screens that exist in the app are listed. */
export const ADMIN_SHORTCUTS: Array<{ id: string; label: string; icon: IconName }> = [
  { id: 'students', label: 'Students', icon: 'graduation-cap' },
  { id: 'staff', label: 'Staff', icon: 'users' },
  { id: 'student-attendance', label: 'Student Att.', icon: 'clipboard' },
  { id: 'staff-attendance', label: 'Staff Att.', icon: 'id-card' },
  { id: 'timetable', label: 'Timetable', icon: 'calendar' },
  { id: 'marks-entry', label: 'Marks Entry', icon: 'notebook' },
  { id: 'communication', label: 'Notices', icon: 'megaphone' },
  { id: 'messages', label: 'Messages', icon: 'message-circle' },
];

const Metric: React.FC<{ label: string; value: string; tone?: 'default' | 'success' | 'warning' }> = ({ label, value, tone }) => (
  <View style={styles.metric} accessibilityLabel={`${label}: ${value}`}>
    <Text
      style={[styles.metricValue, tone === 'success' && { color: BRAND_COLORS.success }, tone === 'warning' && { color: BRAND_COLORS.warning }]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
    <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
  </View>
);

const AttendanceRow: React.FC<{ title: string; block: AttendanceBlock; onPress?: () => void }> = ({ title, block, onPress }) => (
  <TouchableOpacity style={styles.attRow} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
    <View style={{ flex: 1 }}>
      <Text style={styles.attTitle}>{title}</Text>
      {block.recorded ? (
        <Text style={styles.attSub}>
          Present {showCount(block.present)} • Absent {showCount(block.absent)} • Leave {showCount(block.leave)}
          {block.notMarked ? ` • Not marked ${block.notMarked}` : ''}
        </Text>
      ) : (
        <Text style={styles.attSub}>Not marked yet today</Text>
      )}
    </View>
    <Text style={[styles.attPct, !block.recorded && styles.attPctMuted]}>{block.percentText}</Text>
  </TouchableOpacity>
);

export const AdminDashboardScreen: React.FC<Props> = ({ user, onLogout, onOpenMenu, onOpenProfile, onNavigateModule }) => {
  const [model, setModel] = useState<AdminDashboardModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openClass, setOpenClass] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await apiService.getDashboardSummary();
      if (res.ok && res.data) setModel(buildAdminDashboardModel(res.data));
      else setError(res.error || 'Could not load the dashboard.');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, user.id]);

  const onRefresh = () => {
    setRefreshing(true);
    void load(true);
  };

  const notices = model?.notices ?? [];
  const roleName = useMemo(() => formatRoleLabel(user.role), [user.role]);
  // Only shortcuts this role may open (e.g. an accountant has no staff attendance).
  const allowedModules = useMemo(() => new Set(getAuthorizedModulesForUser(user).map((m) => m.id)), [user]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND_COLORS.primaryBright]} />}
      >
        <View style={styles.welcome}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeSmall}>Welcome back,</Text>
            <Text style={styles.welcomeName} numberOfLines={1}>{user.name}</Text>
            <View style={styles.roleTag}><Text style={styles.roleTagText}>{roleName}</Text></View>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>SESSION</Text>
            <Text style={styles.metaValue}>{model?.session || '—'}</Text>
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>TODAY</Text>
            <Text style={styles.metaValue}>{model?.dateLabel || '—'}</Text>
          </View>
        </View>

        {/* Shortcuts */}
        <SectionCard title="Quick Shortcuts">
          <View style={styles.grid}>
            {ADMIN_SHORTCUTS.filter((s) => allowedModules.has(s.id)).map((s) => (
              <TouchableOpacity key={s.id} style={styles.shortcut} onPress={() => onNavigateModule(s.id)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={s.label}>
                <View style={styles.shortcutIcon}><Icon name={s.icon} size={22} color={BRAND_COLORS.primaryRoyal} /></View>
                <Text style={styles.shortcutLabel} numberOfLines={1}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {loading && <StateView variant="loading" title="Loading school overview" />}
        {!loading && error && <StateView variant="error" title="Dashboard unavailable" message={error} onRetry={() => load()} />}

        {!loading && !error && model && (
          <>
            <SectionCard title="Students" subtitle={`Session ${model.session}`} right={<TouchableOpacity onPress={() => onNavigateModule('students')}><Text style={styles.link}>View all</Text></TouchableOpacity>}>
              <View style={styles.metricsRow}>
                <Metric label="Total" value={showCount(model.students.total)} />
                <Metric label="Active" value={showCount(model.students.active)} tone="success" />
                <Metric label="Inactive" value={showCount(model.students.inactive)} tone="warning" />
              </View>
              <View style={[styles.metricsRow, { marginTop: 8 }]}>
                <Metric label="Hostellers" value={showCount(model.students.hostel)} />
                <Metric label="Day scholars" value={showCount(model.students.dayScholars)} />
              </View>

              {model.classes.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.subHeading}>Class-wise (active students)</Text>
                  {model.classes.map((c) => {
                    const open = openClass === c.classId;
                    return (
                      <View key={c.classId}>
                        <TouchableOpacity style={styles.classRow} onPress={() => setOpenClass(open ? null : c.classId)} activeOpacity={0.7} disabled={c.sections.length === 0}>
                          <Text style={styles.className}>{c.className}</Text>
                          <Text style={styles.classCount}>{c.total}</Text>
                        </TouchableOpacity>
                        {open && c.sections.map((sec) => (
                          <View key={sec.name} style={styles.sectionRow}>
                            <Text style={styles.sectionName}>Section {sec.name}</Text>
                            <Text style={styles.sectionCount}>{sec.count}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              )}
            </SectionCard>

            <SectionCard title="Staff" right={<TouchableOpacity onPress={() => onNavigateModule('staff')}><Text style={styles.link}>View all</Text></TouchableOpacity>}>
              <View style={styles.metricsRow}>
                <Metric label="Total" value={showCount(model.staff.total)} />
                <Metric label="Active" value={showCount(model.staff.active)} tone="success" />
                <Metric label="Inactive" value={showCount(model.staff.inactive)} tone="warning" />
              </View>
              <View style={[styles.metricsRow, { marginTop: 8 }]}>
                <Metric label="Teaching" value={showCount(model.staff.teaching)} />
                <Metric label="Non-teaching" value={showCount(model.staff.nonTeaching)} />
              </View>
              {model.departments.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.subHeading}>Departments (active staff)</Text>
                  {model.departments.map((d) => (
                    <View key={d.name} style={styles.classRow}>
                      <Text style={styles.className}>{d.name}</Text>
                      <Text style={styles.classCount}>{d.count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </SectionCard>

            <SectionCard title="Today's Attendance">
              <AttendanceRow title="Students" block={model.studentAttendance} onPress={() => onNavigateModule('student-attendance')} />
              <View style={styles.divider} />
              <AttendanceRow title="Staff" block={model.staffAttendance} onPress={allowedModules.has('staff-attendance') ? () => onNavigateModule('staff-attendance') : undefined} />
            </SectionCard>

            {model.fees && (
              <SectionCard title="Fees">
                <View style={styles.metricsRow}>
                  <Metric label="Collected today" value={model.fees.today} tone="success" />
                  <Metric label="This month" value={model.fees.month} />
                </View>
                <View style={[styles.metricsRow, { marginTop: 8 }]}>
                  <Metric label="Outstanding dues" value={model.fees.pending} tone="warning" />
                  <Metric label="Students with dues" value={showCount(model.fees.studentsWithDues)} />
                </View>
                {model.fees.recent.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.subHeading}>Recent payments</Text>
                    {model.fees.recent.map((p) => (
                      <View key={p.id} style={styles.classRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.className} numberOfLines={1}>{p.student}</Text>
                          <Text style={styles.sectionName}>{[p.date, p.mode].filter(Boolean).join(' • ')}</Text>
                        </View>
                        <Text style={styles.classCount}>{p.amount}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </SectionCard>
            )}

            <SectionCard title="Today's Timetable" subtitle={model.timetable.dayName} right={<TouchableOpacity onPress={() => onNavigateModule('timetable')}><Text style={styles.link}>Full week</Text></TouchableOpacity>}>
              {model.timetable.scheduled ? (
                <>
                  <Text style={styles.sectionName}>{model.timetable.scheduled} periods scheduled across the school</Text>
                  {model.timetable.first.map((t) => (
                    <View key={t.id} style={styles.classRow}>
                      <Text style={styles.periodPill}>{t.period}</Text>
                      <Text style={[styles.className, { flex: 1 }]} numberOfLines={1}>{t.subject}</Text>
                      <Text style={styles.sectionName}>{t.where}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.empty}>No periods scheduled today.</Text>
              )}
            </SectionCard>

            <SectionCard title="Upcoming Examinations">
              {model.upcomingExams.length === 0 ? (
                <Text style={styles.empty}>No upcoming examinations.</Text>
              ) : (
                model.upcomingExams.map((e) => (
                  <View key={e.id} style={styles.classRow}>
                    <Text style={[styles.className, { flex: 1 }]} numberOfLines={1}>{e.name}</Text>
                    <Text style={styles.sectionName}>{e.dateLabel}</Text>
                  </View>
                ))
              )}
            </SectionCard>

            <SectionCard title="Notices & Events" right={<TouchableOpacity onPress={() => onNavigateModule('communication')}><Text style={styles.link}>Open</Text></TouchableOpacity>}>
              {model.notices.length === 0 && model.events.length === 0 && <Text style={styles.empty}>Nothing new right now.</Text>}
              {model.notices.map((n) => (
                <View key={n.id} style={styles.classRow}>
                  <Text style={[styles.className, { flex: 1 }]} numberOfLines={2}>{n.title}</Text>
                  <Text style={styles.sectionName}>{n.dateLabel}</Text>
                </View>
              ))}
              {model.events.length > 0 && <Text style={[styles.subHeading, { marginTop: 12 }]}>Upcoming events</Text>}
              {model.events.map((e) => (
                <View key={e.id} style={styles.classRow}>
                  <Text style={[styles.className, { flex: 1 }]} numberOfLines={2}>{e.title}</Text>
                  <Text style={styles.sectionName}>{e.dateLabel}</Text>
                </View>
              ))}
            </SectionCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.surfaceSoft },
  content: { padding: 16, paddingBottom: 32 },
  welcome: { flexDirection: 'row', backgroundColor: BRAND_COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: BRAND_COLORS.borderColor, padding: 16, marginBottom: 14 },
  welcomeSmall: { fontSize: 13, color: BRAND_COLORS.textMuted },
  welcomeName: { fontSize: 20, fontWeight: '800', color: BRAND_COLORS.primary, marginTop: 2 },
  roleTag: { alignSelf: 'flex-start', backgroundColor: BRAND_COLORS.accentGoldLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8 },
  roleTagText: { fontSize: 11, fontWeight: '700', color: BRAND_COLORS.primaryDark },
  metaCol: { alignItems: 'flex-end', paddingLeft: 12 },
  metaLabel: { fontSize: 10, letterSpacing: 1, color: BRAND_COLORS.textMuted, fontWeight: '700' },
  metaValue: { fontSize: 13, fontWeight: '700', color: BRAND_COLORS.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  shortcut: { width: '25%', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  shortcutIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: BRAND_COLORS.infoLight, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 11, fontWeight: '600', color: BRAND_COLORS.textSecondary, marginTop: 6 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: BRAND_COLORS.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: BRAND_COLORS.borderColor, padding: 10 },
  metricValue: { fontSize: 20, fontWeight: '800', color: BRAND_COLORS.primaryRoyal },
  metricLabel: { fontSize: 11, color: BRAND_COLORS.textMuted, marginTop: 2 },
  subHeading: { fontSize: 12, fontWeight: '700', color: BRAND_COLORS.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  classRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BRAND_COLORS.borderColor, gap: 8 },
  className: { fontSize: 14, fontWeight: '600', color: BRAND_COLORS.textPrimary },
  classCount: { fontSize: 14, fontWeight: '800', color: BRAND_COLORS.primaryRoyal },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingLeft: 16, backgroundColor: BRAND_COLORS.surfaceSoft },
  sectionName: { fontSize: 12, color: BRAND_COLORS.textMuted },
  sectionCount: { fontSize: 13, fontWeight: '700', color: BRAND_COLORS.textSecondary, paddingRight: 4 },
  link: { fontSize: 13, fontWeight: '700', color: BRAND_COLORS.primaryBright },
  attRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  attTitle: { fontSize: 14, fontWeight: '700', color: BRAND_COLORS.textPrimary },
  attSub: { fontSize: 12, color: BRAND_COLORS.textMuted, marginTop: 2 },
  attPct: { fontSize: 18, fontWeight: '800', color: BRAND_COLORS.success },
  attPctMuted: { fontSize: 12, fontWeight: '600', color: BRAND_COLORS.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: BRAND_COLORS.borderColor, marginVertical: 8 },
  periodPill: { fontSize: 11, fontWeight: '800', color: BRAND_COLORS.primaryRoyal, backgroundColor: BRAND_COLORS.infoLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  empty: { fontSize: 13, color: BRAND_COLORS.textMuted },
});
