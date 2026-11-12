import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon, IconName } from '../../components/teacher-home/Icon';
import { Card, SectionHeading, InfoRow, CardMessage } from '../../components/teacher-home/ListParts';
import { apiService } from '../../services/apiService';
import { CountBadge } from '../../components/ui/CountBadge';
import { useActivity } from '../../services/activityStore';
import { useChildData, useParentChildren } from '../ParentChildContext';
import { Avatar, Figure, ParentHeader, Screen, Skeleton, SPACE, StateBlock } from '../ui';
import {
  classSectionLabel,
  formatDisplayDate,
  formatRupees,
  kolkataDate,
  NOT_RECORDED,
  summarizeAttendance,
  summarizeFees,
  upcomingExamsForChild,
} from '../../utils/parentRules';
import type { ParentRoute } from '../routes';

interface Props {
  onNavigate: (r: ParentRoute) => void;
  sessionName?: string;
}

const QUICK: Array<{ route: ParentRoute; label: string; icon: IconName }> = [
  { route: 'timetable', label: 'Timetable', icon: 'calendar' },
  { route: 'homework', label: 'Homework', icon: 'book-open' },
  { route: 'documents', label: 'Report card', icon: 'file-text' },
  { route: 'notices', label: 'Notices', icon: 'megaphone' },
];

export const ParentHomeScreen: React.FC<Props> = ({ onNavigate, sessionName }) => {
  const { activeChild, children, status, error, reload } = useParentChildren();
  const activity = useActivity();
  const month = kolkataDate().substring(0, 7);

  const attendance = useChildData(async (c, o) => {
    const r = await apiService.getChildAttendance(c.id, o);
    return { ok: r.ok, status: r.status, error: r.error, data: summarizeAttendance(r.data, c.id, month) };
  }, month);

  const fees = useChildData(async (c, o) => {
    const [l, p] = await Promise.all([apiService.getChildFeeLedgers(c.id, o), apiService.getChildPayments(c.id, o)]);
    return { ok: l.ok, status: l.status, error: l.error, data: summarizeFees(l.data, p.ok ? p.data : []) };
  });

  const exams = useChildData(async (c) => {
    const r = await apiService.getExams({ classId: c.classId });
    return { ok: r.ok, status: r.status, error: r.error, data: upcomingExamsForChild(r.data as any[], c).slice(0, 3) };
  });

  const notices = useChildData(async (_c, o) => {
    const r = await apiService.getParentNotices(o);
    const list = (r.data || [])
      .filter((n: any) => !n.status || n.status === 'PUBLISHED')
      .sort((a: any, b: any) => String(b.publishedDate || b.publishDate || b.createdAt || '').localeCompare(String(a.publishedDate || a.publishDate || a.createdAt || '')));
    return { ok: r.ok, status: r.status, error: r.error, data: list.slice(0, 3) };
  });

  const refreshing = attendance.refreshing || fees.refreshing || exams.refreshing || notices.refreshing;
  const refreshAll = () => {
    attendance.refresh();
    fees.refresh();
    exams.refresh();
    notices.refresh();
  };

  const header = <ParentHeader title="Home" />;

  if (status === 'loading' && !activeChild) {
    return (
      <Screen header={header}>
        <Skeleton height={120} radius={16} />
        <Skeleton height={88} radius={16} />
        <Skeleton height={160} radius={16} />
      </Screen>
    );
  }
  if (status === 'error' && !activeChild) {
    return (
      <Screen header={header}>
        <StateBlock kind="error" title="Your children could not be loaded" message={error} onRetry={reload} />
      </Screen>
    );
  }
  if (!activeChild) {
    return (
      <Screen header={header}>
        <StateBlock
          kind="empty"
          icon="users"
          title="No child is linked to this account"
          message="Please contact the school office to link your child to this mobile number."
          onRetry={reload}
        />
      </Screen>
    );
  }

  const att = attendance.data;
  const fee = fees.data;

  return (
    <Screen header={header} refreshing={refreshing} onRefresh={refreshAll}>
      {/* Child identity */}
      <Card gap={SPACE.md}>
        <View style={styles.identity}>
          <Avatar name={activeChild.name} photoKey={activeChild.photo || activeChild.photoFileKey} size={56} />
          <View style={styles.identityText}>
            <T style={styles.childName} numberOfLines={2}>
              {activeChild.name}
            </T>
            <T style={styles.childMeta} numberOfLines={1}>
              {classSectionLabel(activeChild.className, activeChild.section)}
              {activeChild.rollNumber ? ` · Roll ${activeChild.rollNumber}` : ''}
            </T>
          </View>
          {children.length > 1 && (
            <TouchableOpacity style={styles.changeBtn} onPress={() => onNavigate('children')} accessibilityRole="button" accessibilityLabel="Change child" activeOpacity={0.7}>
              <T style={styles.changeText}>Change</T>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.metaRow}>
          <Figure label="Admission no." value={activeChild.admissionNumber || NOT_RECORDED} />
          <Figure label="Session" value={activeChild.academicSession || sessionName || NOT_RECORDED} />
        </View>
      </Card>

      {/* At a glance */}
      <View style={styles.glance}>
        <TouchableOpacity style={styles.glanceCard} onPress={() => onNavigate('attendance')} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Attendance this month">
          <T style={styles.glanceLabel}>Attendance this month</T>
          {attendance.state === 'loading' && !att ? (
            <Skeleton height={24} width={72} radius={6} />
          ) : attendance.state === 'error' ? (
            <T style={styles.glanceMuted}>Could not load</T>
          ) : att && att.percentage !== null ? (
            <>
              <T style={[styles.glanceValue, { color: att.percentage >= 75 ? '#16803C' : TH.goldInk }]}>{att.percentage}%</T>
              <T style={styles.glanceSub}>
                {att.present} of {att.total} days
              </T>
            </>
          ) : (
            <T style={styles.glanceMuted}>No records yet</T>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.glanceCard} onPress={() => onNavigate('fees')} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Fee balance">
          <T style={styles.glanceLabel}>Fee balance</T>
          {fees.state === 'loading' && !fee ? (
            <Skeleton height={24} width={88} radius={6} />
          ) : fees.state === 'error' ? (
            <T style={styles.glanceMuted}>Could not load</T>
          ) : fee && fee.ledgerCount === 0 ? (
            <T style={styles.glanceMuted}>No fee records</T>
          ) : fee && fee.totalPending > 0 ? (
            <>
              <T style={[styles.glanceValue, { color: '#B42318' }]}>{formatRupees(fee.totalPending)}</T>
              <T style={styles.glanceSub}>{fee.overdue > 0 ? `${formatRupees(fee.overdue)} overdue` : 'Due'}</T>
            </>
          ) : (
            <>
              <T style={[styles.glanceValue, { color: '#16803C' }]}>Paid</T>
              <T style={styles.glanceSub}>Nothing due</T>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <TouchableOpacity key={q.route} style={styles.quick} onPress={() => onNavigate(q.route)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={q.label}>
            <View style={styles.quickIcon}>
              <Icon name={q.icon} size={20} color={TH.royal} />
            </View>
            <T style={styles.quickLabel} numberOfLines={1}>
              {q.label}
            </T>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chat with the school */}
      <TouchableOpacity style={styles.chatCard} onPress={() => onNavigate('chat')} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Messages">
        <View style={styles.chatIcon}>
          <Icon name="message-circle" size={20} color={TH.gold} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={styles.chatTitle}>Messages</T>
          <T style={styles.chatSub} numberOfLines={1}>{activity.messages > 0 ? `${activity.messages} new message${activity.messages === 1 ? '' : 's'}` : 'Chat with teachers, Principal or Chairman'}</T>
        </View>
        <CountBadge count={activity.messages} />
        <Icon name="chevron" size={16} color={TH.onNavyMuted} />
      </TouchableOpacity>

      {/* Upcoming exams */}
      <View style={styles.section}>
        <SectionHeading title="Upcoming exams" action="View all" onActionPress={() => onNavigate('exams')} />
        <Card>
          {exams.state === 'loading' && !exams.data ? (
            <Skeleton height={48} />
          ) : exams.state === 'error' ? (
            <CardMessage text="Exams could not be loaded. Pull down to try again." />
          ) : (exams.data || []).length === 0 ? (
            <CardMessage text="No upcoming exams scheduled." />
          ) : (
            (exams.data || []).map((e: any) => (
              <InfoRow
                key={e.id}
                icon="graduation-cap"
                title={e.name || e.title || 'Examination'}
                subtitle={[formatDisplayDate(e.startDate), e.endDate && e.endDate !== e.startDate ? formatDisplayDate(e.endDate) : ''].filter(Boolean).join(' – ')}
                onPress={() => onNavigate('exams')}
              />
            ))
          )}
        </Card>
      </View>

      {/* Notices */}
      <View style={styles.section}>
        <SectionHeading title="Notices" action="View all" onActionPress={() => onNavigate('notices')} />
        <Card>
          {notices.state === 'loading' && !notices.data ? (
            <Skeleton height={56} />
          ) : notices.state === 'error' ? (
            <CardMessage text="Notices could not be loaded. Pull down to try again." />
          ) : (notices.data || []).length === 0 ? (
            <CardMessage text="No notices right now." />
          ) : (
            (notices.data || []).map((n: any) => (
              <InfoRow
                key={n.id}
                icon="megaphone"
                title={n.title || 'Notice'}
                subtitle={formatDisplayDate(String(n.publishedDate || n.publishDate || n.createdAt || '').substring(0, 10))}
                badge={n.isUrgent ? 'Urgent' : undefined}
                onPress={() => onNavigate('notices')}
              />
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  childName: { fontFamily: FONT.heading, fontSize: 20, lineHeight: 26, color: TH.navy },
  childMeta: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  changeBtn: { minHeight: 44, paddingHorizontal: SPACE.md, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: TH.border },
  changeText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal },
  metaRow: { flexDirection: 'row', gap: SPACE.lg, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: TH.border },
  glance: { flexDirection: 'row', gap: SPACE.md },
  glanceCard: {
    flex: 1,
    minHeight: 96,
    gap: 4,
    padding: SPACE.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TH.border,
    backgroundColor: TH.surface,
  },
  glanceLabel: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  glanceValue: { fontFamily: FONT.bold, fontSize: 22, color: TH.ink },
  glanceSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  glanceMuted: { fontFamily: FONT.semibold, fontSize: 14, color: TH.muted, marginTop: 4 },
  quickRow: { flexDirection: 'row', gap: SPACE.sm },
  chatCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, backgroundColor: TH.navy, borderRadius: 16, padding: SPACE.md },
  chatIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  chatTitle: { fontFamily: FONT.semibold, fontSize: 15, color: '#FFFFFF' },
  chatSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.onNavyMuted },
  quick: { flex: 1, minHeight: 76, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  quickIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: FONT.medium, fontSize: 11, color: TH.ink },
  section: { gap: SPACE.sm },
});
