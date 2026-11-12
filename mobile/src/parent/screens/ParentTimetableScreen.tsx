import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Card, CardMessage } from '../../components/teacher-home/ListParts';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren, NoActiveChild } from '../ParentChildContext';
import { ChoiceRow, ParentHeader, Screen, SkeletonList, SPACE, StateBlock } from '../ui';
import { classSectionLabel, roomLabel, timetableForChild, todayWeekDay, WEEK_DAYS, WeekDay } from '../../utils/parentRules';

export const ParentTimetableScreen: React.FC<{ onBack: () => void; onOpenChildren: () => void; session?: string }> = ({ onBack, onOpenChildren, session }) => {
  const { activeChild } = useParentChildren();
  const today = todayWeekDay();
  const [day, setDay] = useState<WeekDay>(today || 'Monday');

  const slots = useChildData(async (c) => {
    const r = await apiService.getTimetables({ classId: c.classId, section: c.section });
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  });

  const week = useMemo(() => (activeChild && slots.data ? timetableForChild(slots.data as any[], activeChild, session) : null), [slots.data, activeChild?.id, session]);
  const daySlots = week?.days.find((d) => d.day === day)?.slots || [];

  return (
    <Screen header={<ParentHeader title="Timetable" onBack={onBack} child={activeChild} onPressChild={onOpenChildren} />} refreshing={slots.refreshing} onRefresh={slots.refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : slots.state === 'error' && !slots.data ? (
        <StateBlock kind="error" title="Timetable could not be loaded" message={slots.error} onRetry={slots.reload} />
      ) : slots.state === 'loading' && !slots.data ? (
        <SkeletonList rows={5} height={56} />
      ) : !week || week.slotCount === 0 ? (
        <StateBlock kind="empty" icon="calendar" title="No timetable published yet" message={`The school has not published periods for ${classSectionLabel(activeChild.className, activeChild.section)}.`} />
      ) : (
        <>
          <ChoiceRow
            label="Day"
            options={WEEK_DAYS.map((d) => ({ value: d, label: d === today ? `${d.slice(0, 3)} · Today` : d.slice(0, 3) }))}
            value={day}
            onChange={(v) => setDay(v as WeekDay)}
          />
          <Card gap={0}>
            {daySlots.length === 0 ? (
              <CardMessage text={`No periods on ${day}.`} />
            ) : (
              daySlots.map((s, i) => (
                <View key={s.id || `${day}-${i}`} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <View style={styles.period}>
                    <T style={styles.periodNo}>P{s.periodNumber ?? s.period}</T>
                    {!!s.startTime && (
                      <T style={styles.time}>
                        {s.startTime}
                        {s.endTime ? `\n${s.endTime}` : ''}
                      </T>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <T style={styles.subject} numberOfLines={2}>
                      {s.subjectName || 'Subject not recorded'}
                    </T>
                    <T style={styles.meta} numberOfLines={2}>
                      {[s.teacherName, roomLabel(s.roomNumber)].filter(Boolean).join(' · ')}
                    </T>
                  </View>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  period: { width: 64, alignItems: 'flex-start' },
  periodNo: { fontFamily: FONT.bold, fontSize: 14, color: TH.royal },
  time: { fontFamily: FONT.regular, fontSize: 11, lineHeight: 15, color: TH.muted },
  subject: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
});
