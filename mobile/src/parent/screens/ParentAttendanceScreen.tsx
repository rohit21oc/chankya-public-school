import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Card, SectionHeading, CardMessage } from '../../components/teacher-home/ListParts';
import { apiService } from '../../services/apiService';
import { LeavePanel } from '../../components/LeavePanel';
import { useChildData, useParentChildren, NoActiveChild } from '../ParentChildContext';
import { Banner, Figure, ParentHeader, Pill, Screen, SkeletonList, SPACE, StateBlock, Tone } from '../ui';
import { formatDisplayDate, formatMonthLabel, kolkataDate, shiftMonth, summarizeAttendance, DayStatus } from '../../utils/parentRules';

const STATUS_UI: Record<DayStatus, { label: string; tone: Tone }> = {
  PRESENT: { label: 'Present', tone: 'success' },
  LATE: { label: 'Late', tone: 'warning' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  LEAVE: { label: 'Leave', tone: 'info' },
  HOLIDAY: { label: 'Holiday', tone: 'neutral' },
};

export const ParentAttendanceScreen: React.FC<{ onOpenChildren: () => void }> = ({ onOpenChildren }) => {
  const { activeChild } = useParentChildren();
  const thisMonth = kolkataDate().substring(0, 7);
  const [month, setMonth] = useState(thisMonth);

  // One request for the child; month and overall summaries are derived locally.
  const records = useChildData(async (c, o) => {
    const r = await apiService.getChildAttendance(c.id, o);
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  });

  const monthly = useMemo(() => (activeChild && records.data ? summarizeAttendance(records.data, activeChild.id, month) : null), [records.data, activeChild?.id, month]);
  const overall = useMemo(() => (activeChild && records.data ? summarizeAttendance(records.data, activeChild.id) : null), [records.data, activeChild?.id]);

  return (
    <Screen header={<ParentHeader title="Attendance" child={activeChild} onPressChild={onOpenChildren} />} refreshing={records.refreshing} onRefresh={records.refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : records.state === 'error' && !records.data ? (
        <StateBlock kind="error" title="Attendance could not be loaded" message={records.error} onRetry={records.reload} />
      ) : records.state === 'loading' && !records.data ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {records.state === 'error' && <Banner text="Could not refresh. Showing the last loaded records." onRetry={records.refresh} />}

          {/* Apply leave for the child; the school approves it and the days show as Leave. */}
          <LeavePanel key={activeChild.id} kind="student" subjectId={activeChild.id} subjectName={activeChild.name} onChanged={records.refresh} />

          {/* Month chooser */}
          <View style={styles.monthBar}>
            <TouchableOpacity style={styles.monthBtn} onPress={() => setMonth((m) => shiftMonth(m, -1))} accessibilityRole="button" accessibilityLabel="Previous month">
              <Icon name="chevron-left" size={20} color={TH.navy} />
            </TouchableOpacity>
            <T style={styles.monthLabel}>{formatMonthLabel(month)}</T>
            <TouchableOpacity
              style={[styles.monthBtn, month >= thisMonth && styles.monthBtnDisabled]}
              onPress={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={month >= thisMonth}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              accessibilityState={{ disabled: month >= thisMonth }}
            >
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon name="chevron-left" size={20} color={month >= thisMonth ? TH.border : TH.navy} />
              </View>
            </TouchableOpacity>
          </View>

          {monthly && (
            <Card gap={SPACE.md}>
              <View style={styles.headline}>
                <T style={styles.percent}>{monthly.percentage === null ? '—' : `${monthly.percentage}%`}</T>
                <T style={styles.percentLabel}>{monthly.percentage === null ? 'No records this month' : `${monthly.present} of ${monthly.total} school days`}</T>
              </View>
              <View style={styles.figures}>
                <Figure label="Present" value={String(monthly.present)} tone="success" />
                <Figure label="Absent" value={String(monthly.absent)} tone="danger" />
                <Figure label="Leave" value={String(monthly.leave)} tone="info" />
                <Figure label="Late" value={String(monthly.late)} tone="warning" />
              </View>
            </Card>
          )}

          {overall && overall.percentage !== null && (
            <T style={styles.overall}>
              All recorded days: {overall.percentage}% ({overall.present} of {overall.total} days)
            </T>
          )}

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Daily record" />
            <Card gap={0}>
              {!monthly || monthly.days.length === 0 ? (
                <CardMessage text={`No attendance has been recorded for ${formatMonthLabel(month)}.`} />
              ) : (
                monthly.days.map((d, i) => (
                  <View key={d.date} style={[styles.dayRow, i > 0 && styles.dayRowBorder]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={styles.dayDate}>{formatDisplayDate(d.date)}</T>
                      {!!d.remarks && (
                        <T style={styles.dayRemark} numberOfLines={2}>
                          {d.remarks}
                        </T>
                      )}
                    </View>
                    <View style={styles.dayPill}>
                      <Pill label={STATUS_UI[d.status].label} tone={STATUS_UI[d.status].tone} />
                    </View>
                  </View>
                ))
              )}
            </Card>
          </View>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  monthBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  monthBtnDisabled: { opacity: 0.5 },
  monthLabel: { flex: 1, textAlign: 'center', fontFamily: FONT.semibold, fontSize: 16, color: TH.navy },
  headline: { gap: 2 },
  percent: { fontFamily: FONT.bold, fontSize: 32, color: TH.navy },
  percentLabel: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  figures: { flexDirection: 'row', gap: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: TH.border },
  overall: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  dayRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  dayPill: { justifyContent: 'center' },
  dayRowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  dayDate: { fontFamily: FONT.medium, fontSize: 14, color: TH.ink },
  dayRemark: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
});
