import React from 'react';
import { useActivity } from '../../services/activityStore';
import { CountBadge } from '../../components/ui/CountBadge';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { BRAND_COLORS } from '../../utils/branding';
import { T } from '../../components/teacher-home/T';
import { Icon, IconName } from '../../components/teacher-home/Icon';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren } from '../../parent/ParentChildContext';
import { Avatar, ParentHeader, Screen, Skeleton, SPACE, StateBlock } from '../../parent/ui';
import { formatDisplayDate, formatRupees, kolkataDate, summarizeAttendance, summarizeFees, upcomingExamsForChild } from '../../utils/parentRules';
import { classRollLine, greetingFor, percentLabel } from '../../utils/studentPortalRules';
import { StudentRoute } from '../routes';
import { useStudentPortal } from '../StudentContext';

const TILES: Array<{ route: StudentRoute; label: string; icon: IconName; tint: string }> = [
  { route: 'attendance', label: 'Attendance', icon: 'clipboard', tint: '#E3EEFF' },
  { route: 'timetable', label: 'Timetable', icon: 'calendar', tint: '#E3F6EA' },
  { route: 'marks', label: 'Marks & Results', icon: 'graduation-cap', tint: '#FFEBD9' },
  { route: 'fees', label: 'Fees & Account', icon: 'wallet', tint: '#DDF3EE' },
  { route: 'homework', label: 'Homework', icon: 'book-open', tint: '#EFE4FF' },
  { route: 'documents', label: 'Documents', icon: 'file-text', tint: '#E8E6FF' },
  { route: 'notices', label: 'Notices', icon: 'megaphone', tint: '#E1ECFF' },
  { route: 'events', label: 'Events', icon: 'bell', tint: '#FFE3E3' },
];

export const MyHome: React.FC = () => {
  const activity = useActivity();
  const { navigate } = useStudentPortal();
  const { activeChild, status, error, reload } = useParentChildren();
  const month = kolkataDate().substring(0, 7);

  const attendance = useChildData(async (c, o) => {
    const r = await apiService.getChildAttendance(c.id, o);
    return { ok: r.ok, status: r.status, error: r.error, data: summarizeAttendance(r.data, c.id, month) };
  }, month);

  const exams = useChildData(async (c) => {
    if (!c.classId) return { ok: true, data: [] as any[] };
    const r = await apiService.getExams({ classId: c.classId });
    return { ok: r.ok, status: r.status, error: r.error, data: upcomingExamsForChild(r.data as any[], c).slice(0, 1) };
  });

  const fees = useChildData(async (c, o) => {
    const [l, p] = await Promise.all([apiService.getChildFeeLedgers(c.id, o), apiService.getChildPayments(c.id, o)]);
    return { ok: l.ok, status: l.status, error: l.error, data: summarizeFees(l.data, p.ok ? p.data : []) };
  });

  const refreshing = attendance.refreshing || exams.refreshing || fees.refreshing;
  const refreshAll = () => {
    attendance.refresh();
    exams.refresh();
    fees.refresh();
  };

  const header = <ParentHeader title="Dashboard" />;

  if (!activeChild) {
    return (
      <Screen header={header}>
        {status === 'error' ? (
          <StateBlock kind="error" title="Your details could not be loaded" message={error} onRetry={reload} />
        ) : (
          <>
            <Skeleton height={110} radius={16} />
            <Skeleton height={200} radius={16} />
          </>
        )}
      </Screen>
    );
  }

  const nextExam: any = exams.data?.[0];
  const due = fees.data?.totalPending ?? 0;
  const att = attendance.data;

  return (
    <Screen header={header} refreshing={refreshing} onRefresh={refreshAll}>
      <View style={styles.hello}>
        <Avatar name={activeChild.name} photoKey={activeChild.photo || activeChild.photoFileKey} size={64} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={styles.helloSmall}>{greetingFor()},</T>
          <T style={styles.helloName} numberOfLines={2}>
            {activeChild.name}
          </T>
          <T style={styles.helloMeta} numberOfLines={1}>
            {classRollLine(activeChild)}
          </T>
          {!!activeChild.admissionNumber && <T style={styles.helloMeta}>Admission No. {activeChild.admissionNumber}</T>}
        </View>
      </View>

      <View style={styles.banner}>
        <T style={styles.bannerText}>Keep Learning, Keep Growing!</T>
      </View>

      <View style={styles.grid}>
        {TILES.map((t) => (
          <TouchableOpacity key={t.route} style={styles.tile} onPress={() => navigate(t.route)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={t.label}>
            <View style={[styles.tileIcon, { backgroundColor: t.tint }]}>
              <Icon name={t.icon} size={24} color={TH.royal} />
              {t.route === 'notices' && <CountBadge count={activity.noticesNew} style={{ position: 'absolute', top: -6, right: -6 }} />}
            </View>
            <T style={styles.tileLabel} numberOfLines={2}>
              {t.label}
            </T>
            {t.route === 'fees' && due > 0 ? (
              <View style={styles.dueDot}>
                <T style={styles.dueText}>{formatRupees(due)} due</T>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ gap: SPACE.sm }}>
        <T style={styles.sectionTitle}>Today's Highlights</T>
        <View style={styles.highlights}>
          <TouchableOpacity style={styles.hl} onPress={() => navigate('attendance')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Open attendance">
            <View style={[styles.hlIcon, { backgroundColor: '#E3F6EA' }]}>
              <Icon name="check" size={20} color={BRAND_COLORS.success} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={styles.hlLabel}>Attendance (this month)</T>
              <T style={styles.hlValue}>{attendance.state === 'loading' && !att ? '…' : percentLabel(att?.percentage)}</T>
            </View>
          </TouchableOpacity>
          <View style={styles.hlDivider} />
          <TouchableOpacity style={styles.hl} onPress={() => navigate('exams')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Open exam schedule">
            <View style={[styles.hlIcon, { backgroundColor: '#E1ECFF' }]}>
              <Icon name="graduation-cap" size={20} color={TH.royal} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={styles.hlLabel}>Next Exam</T>
              <T style={styles.hlValue} numberOfLines={2}>
                {exams.state === 'loading' && !exams.data ? '…' : nextExam ? nextExam.name || nextExam.title || 'Examination' : 'None scheduled'}
              </T>
              {!!nextExam?.startDate && <T style={styles.hlSub}>{formatDisplayDate(nextExam.startDate)}</T>}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hello: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderRadius: 18, backgroundColor: '#FFF3DB', borderWidth: 1, borderColor: '#F6E3B4' },
  helloSmall: { fontFamily: FONT.regular, fontSize: 12, color: TH.goldInk },
  helloName: { fontFamily: FONT.heading, fontSize: 21, color: TH.navy },
  helloMeta: { fontFamily: FONT.medium, fontSize: 12, color: TH.ink, marginTop: 2 },
  banner: { padding: SPACE.md, borderRadius: 14, backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F6E3B4' },
  bannerText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.goldInk },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  tile: { width: '31.2%', minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, padding: SPACE.sm, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  tileIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: FONT.semibold, fontSize: 12, color: TH.ink, textAlign: 'center' },
  dueDot: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: BRAND_COLORS.errorLight },
  dueText: { fontFamily: FONT.bold, fontSize: 9, color: BRAND_COLORS.error },
  sectionTitle: { fontFamily: FONT.heading, fontSize: 17, color: TH.navy },
  highlights: { flexDirection: 'row', alignItems: 'stretch', padding: SPACE.md, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  hl: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  hlDivider: { width: 1, backgroundColor: TH.border, marginHorizontal: SPACE.sm },
  hlIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hlLabel: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  hlValue: { fontFamily: FONT.bold, fontSize: 16, color: TH.navy },
  hlSub: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
});
