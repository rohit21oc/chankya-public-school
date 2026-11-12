import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { BRAND_COLORS } from '../../utils/branding';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Card } from '../../components/teacher-home/ListParts';
import { LeavePanel } from '../../components/LeavePanel';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren, NoActiveChild } from '../../parent/ParentChildContext';
import { Banner, Figure, ParentHeader, Screen, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { formatDisplayDate, formatMonthLabel, kolkataDate, shiftMonth, summarizeAttendance } from '../../utils/parentRules';
import { CalStatus, holidayDatesInMonth, monthGrid, percentLabel } from '../../utils/studentPortalRules';

const DOT: Record<CalStatus, string> = { PRESENT: '#16A34A', LATE: '#D97706', ABSENT: '#DC2626', LEAVE: '#2563EB', HOLIDAY: '#98A2B3' };
const LABEL: Record<CalStatus, string> = { PRESENT: 'Present', LATE: 'Late', ABSENT: 'Absent', LEAVE: 'Leave', HOLIDAY: 'Holiday' };
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MyAttendance: React.FC = () => {
  const { activeChild } = useParentChildren();
  const today = kolkataDate();
  const thisMonth = today.substring(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [picked, setPicked] = useState<string | null>(null);

  const records = useChildData(async (c, o) => {
    const r = await apiService.getChildAttendance(c.id, o);
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  });
  const holidays = useChildData(async () => {
    const r = await apiService.getHolidays();
    return { ok: true, data: r.ok ? r.data : [] };
  });

  // Weekly offs come from School Settings → School Working Days.
  const settings = useChildData(async () => {
    const r = await apiService.getSchoolSettings();
    return { ok: true, data: r.ok ? ((r.data as any)?.workingDays as string[] | undefined) : undefined };
  });

  const monthly = useMemo(() => (activeChild && records.data ? summarizeAttendance(records.data, activeChild.id, month) : null), [records.data, activeChild?.id, month]);
  const statusByDate = useMemo(() => {
    const m: Record<string, CalStatus> = {};
    for (const d of monthly?.days || []) m[d.date] = d.status as CalStatus;
    return m;
  }, [monthly]);
  const grid = useMemo(
    () => monthGrid(month, statusByDate, holidayDatesInMonth(holidays.data as any[], month), today, settings.data || undefined),
    [month, statusByDate, holidays.data, today, settings.data]
  );
  const remarkFor = (date: string) => monthly?.days.find((d) => d.date === date)?.remarks;

  const change = (delta: number) => {
    setPicked(null);
    setMonth((m) => shiftMonth(m, delta));
  };

  return (
    <Screen header={<ParentHeader title="Attendance" />} refreshing={records.refreshing} onRefresh={records.refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : records.state === 'error' && !records.data ? (
        <StateBlock kind="error" title="Attendance could not be loaded" message={records.error} onRetry={records.reload} />
      ) : records.state === 'loading' && !records.data ? (
        <SkeletonList rows={4} height={88} />
      ) : (
        <>
          {records.state === 'error' && <Banner text="Could not refresh. Showing the last loaded records." onRetry={records.refresh} />}

          <Card gap={SPACE.md}>
            <View style={styles.monthBar}>
              <TouchableOpacity style={styles.monthBtn} onPress={() => change(-1)} accessibilityRole="button" accessibilityLabel="Previous month">
                <Icon name="chevron-left" size={20} color={TH.navy} />
              </TouchableOpacity>
              <T style={styles.monthLabel}>{formatMonthLabel(month)}</T>
              <TouchableOpacity style={[styles.monthBtn, month >= thisMonth && { opacity: 0.35 }]} onPress={() => change(1)} disabled={month >= thisMonth} accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: month >= thisMonth }}>
                <View style={{ transform: [{ rotate: '180deg' }] }}>
                  <Icon name="chevron-left" size={20} color={TH.navy} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              {DOW.map((d) => (
                <T key={d} style={styles.dow}>
                  {d}
                </T>
              ))}
            </View>
            {grid.map((week, wi) => (
              <View key={wi} style={styles.row}>
                {week.map((c, ci) => (
                  <TouchableOpacity
                    key={ci}
                    style={styles.cellWrap}
                    disabled={!c.date}
                    onPress={() => setPicked(c.date === picked ? null : c.date)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={c.date ? `${formatDisplayDate(c.date)}${c.status ? `, ${LABEL[c.status]}` : ''}` : undefined}
                  >
                    {c.date ? (
                      <View style={[styles.cell, c.isToday && styles.cellToday, picked === c.date && styles.cellPicked]}>
                        <T style={[styles.dayNum, c.isToday && styles.dayNumToday, c.isSunday && !c.isToday && { color: '#DC2626' }]}>{c.day}</T>
                        <View style={[styles.dot, { backgroundColor: c.status ? DOT[c.status] : 'transparent' }]} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <View style={styles.legend}>
              {(['PRESENT', 'ABSENT', 'LEAVE', 'LATE', 'HOLIDAY'] as CalStatus[]).map((s) => (
                <View key={s} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: DOT[s] }]} />
                  <T style={styles.legendText}>{LABEL[s]}</T>
                </View>
              ))}
            </View>

            {picked ? (
              <View style={styles.picked}>
                <T style={styles.pickedDate}>{formatDisplayDate(picked)}</T>
                <T style={styles.pickedText}>
                  {statusByDate[picked] ? LABEL[statusByDate[picked]] : holidayDatesInMonth(holidays.data as any[], month).has(picked) ? 'Holiday' : 'No attendance recorded'}
                  {remarkFor(picked) ? ` · ${remarkFor(picked)}` : ''}
                </T>
              </View>
            ) : null}
          </Card>

          <Card gap={SPACE.md}>
            <View style={styles.overallTop}>
              <View>
                <T style={styles.overallLabel}>Overall Attendance · {formatMonthLabel(month)}</T>
                <T style={styles.percent}>{percentLabel(monthly?.percentage)}</T>
              </View>
              <View style={styles.pctBadge}>
                <Icon name="clipboard" size={22} color={TH.royal} />
              </View>
            </View>
            {monthly && monthly.total > 0 ? (
              <View style={styles.figures}>
                <Figure label="Present" value={String(monthly.present)} tone="success" />
                <Figure label="Absent" value={String(monthly.absent)} tone="danger" />
                <Figure label="Leave" value={String(monthly.leave)} tone="info" />
                <Figure label="Late" value={String(monthly.late)} tone="warning" />
              </View>
            ) : (
              <T style={styles.empty}>No attendance has been recorded for {formatMonthLabel(month)}.</T>
            )}
          </Card>

          {/* Apply leave; the school approves it and the days show as Leave. */}
          <LeavePanel key={activeChild.id} kind="student" subjectId={activeChild.id} subjectName={activeChild.name} onChanged={records.refresh} />
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.tile },
  monthLabel: { flex: 1, textAlign: 'center', fontFamily: FONT.heading, fontSize: 18, color: TH.navy },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontFamily: FONT.semibold, fontSize: 11, color: TH.muted },
  cellWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  cell: { width: 38, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cellToday: { backgroundColor: BRAND_COLORS.primaryRoyal },
  cellPicked: { borderWidth: 1.5, borderColor: BRAND_COLORS.primaryBright },
  dayNum: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink },
  dayNumToday: { color: '#FFFFFF' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: TH.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  picked: { padding: SPACE.md, borderRadius: 12, backgroundColor: TH.tile, gap: 2 },
  pickedDate: { fontFamily: FONT.semibold, fontSize: 13, color: TH.navy },
  pickedText: { fontFamily: FONT.regular, fontSize: 13, color: TH.ink },
  overallTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overallLabel: { fontFamily: FONT.semibold, fontSize: 13, color: TH.muted },
  percent: { fontFamily: FONT.bold, fontSize: 34, color: TH.navy },
  pctBadge: { width: 48, height: 48, borderRadius: 16, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  figures: { flexDirection: 'row', gap: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: TH.border },
  empty: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
});
