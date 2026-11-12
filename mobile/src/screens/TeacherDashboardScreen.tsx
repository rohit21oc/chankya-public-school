import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { SystemBars } from '../components/SystemBars';
import { User, MobileModule } from '../types';
import type { TeacherDashboardSummary, TeacherAuthorizedAssignments } from '../types/teacher';
import { StateView } from '../components/ui/StateView';
import { apiService } from '../services/apiService';
import { getAuthorizedModulesForUser } from '../utils/rbac';
import { BRAND_COLORS, SCHOOL_INFO, resolveFileUrl } from '../utils/branding';
import { buildAssignmentIndex } from '../utils/teacherAssignments';
import {
  buildPendingTasks,
  buildSummaryCards,
  buildTimetableView,
  firstNameOf,
  formatHeaderDate,
  formatNoticeDate,
  greetingForHour,
  initialsOf,
} from '../utils/teacherHomeModel';
import { TH, FONT } from '../theme/teacherHome';
import { T } from '../components/teacher-home/T';
import { TeacherHomeHeader } from '../components/teacher-home/TeacherHomeHeader';
import { TimetableCard } from '../components/teacher-home/TimetableCard';
import { QuickActions, QuickActionItem } from '../components/teacher-home/QuickActions';
import { SummaryRow } from '../components/teacher-home/SummaryRow';
import { SectionHeading, Card, InfoRow, CardMessage } from '../components/teacher-home/ListParts';
import { NOT_CONFIGURED, affiliationLine, useSchoolIdentity } from '../services/schoolIdentity';
import { useActivity } from '../services/activityStore';

interface TeacherDashboardScreenProps {
  user: User;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onNavigateModule: (moduleId: string) => void;
}

/** Quick actions in design order. Only modules the signed-in user may open are shown. */
const QUICK_ACTIONS: { id: string; label: string; icon: QuickActionItem['icon'] }[] = [
  { id: 'student-attendance', label: 'Mark\nAttendance', icon: 'clipboard' },
  { id: 'marks-entry', label: 'Enter\nMarks', icon: 'notebook' },
  { id: 'students', label: 'My\nStudents', icon: 'users' },
  { id: 'timetable', label: 'View\nTimetable', icon: 'calendar' },
  { id: 'my-classes', label: 'My\nClasses', icon: 'graduation-cap' },
  { id: 'homework', label: 'Home-\nwork', icon: 'book-open' },
  { id: 'communication', label: 'Notices', icon: 'megaphone' },
  { id: 'messages', label: 'Parent\nChat', icon: 'message-circle' },
];

/** Most recent notices shown on Home; the full list lives in the communication module. */
const HOME_NOTICE_LIMIT = 2;

export const TeacherDashboardScreen: React.FC<TeacherDashboardScreenProps> = ({
  user,
  onOpenMenu,
  onOpenProfile,
  onLogout,
  onNavigateModule,
}) => {
  const activity = useActivity();
  const sid = useSchoolIdentity();
  const [summary, setSummary] = useState<TeacherDashboardSummary | null>(null);
  const [assignments, setAssignments] = useState<TeacherAuthorizedAssignments | null>(null);
  const [assignmentError, setAssignmentError] = useState<string>('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [isWaking, setIsWaking] = useState(false);

  // Guards against out-of-order responses and updates after unmount.
  const requestSeq = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = apiService.subscribeColdStart((waking) => {
      if (mounted.current) setIsWaking(waking);
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      const seq = ++requestSeq.current;
      if (!isRefresh) setLoadState('loading');

      const [summaryRes, assignmentsRes] = await Promise.all([
        apiService.getTeacherDashboardSummary(),
        apiService.getTeacherAuthorizedAssignments({ force: isRefresh }),
      ]);

      if (!mounted.current || seq !== requestSeq.current) return;

      if (summaryRes.ok && summaryRes.data) {
        setSummary(summaryRes.data);
        setLoadError('');
        setLoadState('ready');
      } else if (summary) {
        // Keep the last good data on screen and surface the failure as a banner.
        setLoadError(summaryRes.error || 'Could not refresh the dashboard.');
        setLoadState('ready');
      } else {
        setLoadError(summaryRes.error || 'Could not load your dashboard.');
        setLoadState('error');
      }

      if (assignmentsRes.ok && assignmentsRes.data) {
        setAssignments(assignmentsRes.data);
        setAssignmentError('');
      } else {
        setAssignments(null);
        setAssignmentError(assignmentsRes.error || 'Assignment details are unavailable right now.');
      }
      setRefreshing(false);
    },
    // summary is read only to decide between "keep stale data" and "show error state"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary]
  );

  useEffect(() => {
    loadDashboard(false);
    // Reload only when the signed-in teacher changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard(true);
  };

  const permittedModuleIds = useMemo(
    () => new Set(getAuthorizedModulesForUser(user).map((m: MobileModule) => m.id)),
    [user]
  );

  const assignmentIndex = useMemo(() => buildAssignmentIndex(assignments), [assignments]);

  // Only show sections the server reports as assigned. If the assignment call
  // failed, fall back to the summary's own (server-scoped) sections and say so.
  const visibleSections = useMemo(() => {
    const list = summary?.assignedClasses ?? [];
    if (!assignments) return list;
    return list.filter((s) => assignmentIndex.isSectionAssigned(s.classId || s.className, s.section));
  }, [summary, assignments, assignmentIndex]);

  const timetableView = useMemo(() => buildTimetableView(summary?.todayTimetable), [summary]);
  const pendingTasks = useMemo(
    () => buildPendingTasks(visibleSections, summary?.pendingMarksTasks),
    [visibleSections, summary]
  );

  const canOpen = (moduleId: string) => permittedModuleIds.has(moduleId);
  const openModule = (moduleId: string) => {
    if (canOpen(moduleId)) onNavigateModule(moduleId);
  };

  const teacherName = summary?.teacher.name || user.name;
  const avatarKey = summary?.teacher.avatar || user.avatar;
  const noticeCount = summary?.recentNotices?.length ?? 0;

  const renderHeader = () => (
    <TeacherHomeHeader
      schoolName={sid.name}
      teacherName={teacherName}
      avatarUri={avatarKey ? resolveFileUrl(avatarKey) : undefined}
      initials={initialsOf(teacherName)}
      noticeCount={noticeCount}
      onOpenNotifications={() => openModule('communication')}
      onOpenProfile={onOpenProfile}
      onOpenMenu={onOpenMenu}
    />
  );

  const renderShell = (body: React.ReactNode) => (
    <SafeAreaView style={styles.safeArea}>
      <SystemBars color={TH.bg} style="dark" bottomColor={TH.surface} />
      {renderHeader()}
      {body}
    </SafeAreaView>
  );

  if (loadState === 'loading' && !summary) {
    return renderShell(
      <StateView
        variant="loading"
        title="Loading your dashboard"
        message={isWaking ? 'The school server is waking up. This can take up to a minute.' : undefined}
      />
    );
  }

  if (loadState === 'error' || !summary) {
    return renderShell(
      <StateView
        variant="error"
        title="Dashboard unavailable"
        message={loadError || 'Please check your connection and try again.'}
        onRetry={() => loadDashboard(false)}
      />
    );
  }

  const t = summary.teacher;
  const notices = (summary.recentNotices ?? []).slice(0, HOME_NOTICE_LIMIT);
  const subtitle = [t.designation, t.classTeacherOf ? `Class Teacher ${t.classTeacherOf}` : '']
    .filter(Boolean)
    .join(' \u00B7 ');

  const quickActions: QuickActionItem[] = QUICK_ACTIONS.filter((a) => canOpen(a.id)).map((a) => ({
    id: a.id,
    label: a.label,
    icon: a.icon,
    badge: a.id === 'messages' ? activity.messages : a.id === 'communication' ? activity.noticesNew : 0,
    onPress: () => openModule(a.id),
  }));

  return renderShell(
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[BRAND_COLORS.primaryBright]} />
      }
    >
      {!!loadError && (
        <View style={styles.banner} accessibilityRole="alert">
          <T style={styles.bannerText}>{loadError} Showing the last loaded data.</T>
        </View>
      )}
      {!!assignmentError && (
        <View style={styles.banner} accessibilityRole="alert">
          <T style={styles.bannerText}>{assignmentError} Showing the classes reported by the server.</T>
        </View>
      )}

      <View style={styles.greeting}>
        <T style={styles.dateLine}>{formatHeaderDate(summary.todayDate, summary.academicSession)}</T>
        <T style={styles.greetingTitle} numberOfLines={2}>
          {greetingForHour(new Date().getHours())}, {firstNameOf(t.name)}
        </T>
        {!!subtitle && <T style={styles.greetingSubtitle}>{subtitle}</T>}
      </View>

      {visibleSections.length > 0 && (
        <>
          <SectionHeading
            title="Assigned classes & subjects"
            action={canOpen('my-classes') ? 'View all' : undefined}
            onActionPress={canOpen('my-classes') ? () => openModule('my-classes') : undefined}
          />
          <View style={styles.chipWrap}>
            {visibleSections.slice(0, 6).map((sec) => (
              <TouchableOpacity
                key={`${sec.classId}|${sec.section}`}
                style={styles.chip}
                onPress={canOpen('my-classes') ? () => openModule('my-classes') : undefined}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${sec.className} ${sec.section}. ${(sec.subjects || []).join(', ')}`}
              >
                <T style={styles.chipTitle} numberOfLines={1}>
                  {sec.className} - {sec.section}
                </T>
                <T style={styles.chipSub} numberOfLines={1}>
                  {(sec.subjects || []).length > 0 ? sec.subjects.join(', ') : `${sec.studentCount} students`}
                </T>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TimetableCard view={timetableView} onOpenTimetable={canOpen('timetable') ? () => openModule('timetable') : undefined} />

      {quickActions.length > 0 && <QuickActions actions={quickActions} />}

      <SummaryRow cards={buildSummaryCards(summary.quickStats)} />

      <SectionHeading
        title="Pending academic tasks"
        action={pendingTasks.length > 0 ? `${pendingTasks.length} ${pendingTasks.length === 1 ? 'task' : 'tasks'}` : undefined}
      />
      <Card>
        {pendingTasks.length === 0 ? (
          <CardMessage text="You're all caught up. No attendance or marks entry is pending." />
        ) : (
          pendingTasks.map((task) => (
            <InfoRow
              key={task.id}
              icon={task.kind === 'ATTENDANCE' ? 'clipboard' : 'notebook'}
              title={task.title}
              subtitle={task.subtitle}
              badge={task.badge}
              onPress={canOpen(task.moduleId) ? () => openModule(task.moduleId) : undefined}
            />
          ))
        )}
      </Card>

      <SectionHeading
        title="Notices & Circulars"
        action={canOpen('communication') ? 'View all' : undefined}
        onActionPress={canOpen('communication') ? () => openModule('communication') : undefined}
      />
      {notices.length === 0 ? (
        <Card>
          <CardMessage text="No notices right now." />
        </Card>
      ) : (
        notices.map((n) => (
          <TouchableNotice key={n.id} onPress={canOpen('communication') ? () => openModule('communication') : undefined}>
            <T style={styles.noticeDate}>{formatNoticeDate(n.createdAt)}</T>
            <T style={styles.noticeTitle} numberOfLines={2}>
              {n.title || 'Notice'}
            </T>
            {!!n.content && (
              <T style={styles.noticeBody} numberOfLines={2}>
                {n.content}
              </T>
            )}
          </TouchableNotice>
        ))
      )}

      <Card>
        <InfoRow icon="grid" title="More Modules" subtitle="All your teaching tools, in one place" onPress={onOpenMenu} />
      </Card>
    </ScrollView>
  );
};

/** Notice card: tappable when the user may open the communication module. */
const TouchableNotice: React.FC<{ onPress?: () => void; children: React.ReactNode }> = ({ onPress, children }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.7}
    accessibilityRole={onPress ? 'button' : undefined}
  >
    <Card gap={8}>{children}</Card>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TH.bg },
  content: { gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  banner: { backgroundColor: TH.goldSoft, borderRadius: 12, padding: 12 },
  bannerText: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.goldInk },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: '30%', flexGrow: 1, maxWidth: '48%', backgroundColor: TH.surface, borderRadius: 12, borderWidth: 1, borderColor: TH.border, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  chipTitle: { fontFamily: FONT.bold, fontSize: 12, color: TH.royal },
  chipSub: { fontFamily: FONT.regular, fontSize: 10, color: TH.muted },
  greeting: { gap: 4 },
  dateLine: { fontFamily: FONT.regular, fontSize: 10, lineHeight: 14, color: TH.muted },
  greetingTitle: { fontFamily: FONT.heading, fontSize: 26, lineHeight: 36.4, color: TH.ink },
  greetingSubtitle: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 16.8, color: TH.muted },
  noticeDate: { fontFamily: FONT.regular, fontSize: 10, lineHeight: 14, color: TH.muted },
  noticeTitle: { fontFamily: FONT.semibold, fontSize: 14, lineHeight: 19.6, color: TH.ink },
  noticeBody: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 16.8, color: TH.muted },
});
