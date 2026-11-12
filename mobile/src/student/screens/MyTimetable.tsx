import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { BRAND_COLORS } from '../../utils/branding';
import { T } from '../../components/teacher-home/T';
import { Card, CardMessage } from '../../components/teacher-home/ListParts';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren, NoActiveChild } from '../../parent/ParentChildContext';
import { ChoiceRow, ParentHeader, Screen, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { classLabel, classSectionLabel, roomLabel, timetableForChild, todayWeekDay, WEEK_DAYS, WeekDay } from '../../utils/parentRules';
import { useStudentPortal } from '../StudentContext';

/** "HH:MM" (24h) or "8:30 AM" → minutes since midnight, or null. */
function minutesOf(t?: string): number | null {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}
const nowMinutesIst = () => {
  const p = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date());
  const [h, m] = p.split(':').map(Number);
  return (h % 24) * 60 + m;
};

export const MyTimetable: React.FC = () => {
  const { activeChild } = useParentChildren();
  const { schoolSession } = useStudentPortal();
  const today = todayWeekDay();
  const [day, setDay] = useState<WeekDay>(today || 'Monday');

  const slots = useChildData(async (c) => {
    const r = await apiService.getTimetables({ classId: c.classId, section: c.section });
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  });

  const week = useMemo(() => (activeChild && slots.data ? timetableForChild(slots.data as any[], activeChild, schoolSession) : null), [slots.data, activeChild?.id, schoolSession]);
  const daySlots = week?.days.find((d) => d.day === day)?.slots || [];
  const nowMin = day === today ? nowMinutesIst() : null;

  return (
    <Screen header={<ParentHeader title="Class Timetable" />} refreshing={slots.refreshing} onRefresh={slots.refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : (
        <>
          <View style={styles.info}>
            <View style={styles.infoBox}>
              <T style={styles.infoLabel}>Class</T>
              <T style={styles.infoValue} numberOfLines={1}>
                {classLabel(activeChild.className) || '—'}
              </T>
            </View>
            <View style={styles.infoBox}>
              <T style={styles.infoLabel}>Section</T>
              <T style={styles.infoValue}>{activeChild.section || '—'}</T>
            </View>
            <View style={styles.infoBox}>
              <T style={styles.infoLabel}>Session</T>
              <T style={styles.infoValue} numberOfLines={1}>
                {schoolSession || activeChild.academicSession || '—'}
              </T>
            </View>
          </View>

          {slots.state === 'error' && !slots.data ? (
            <StateBlock kind="error" title="Timetable could not be loaded" message={slots.error} onRetry={slots.reload} />
          ) : slots.state === 'loading' && !slots.data ? (
            <SkeletonList rows={5} height={56} />
          ) : !week || week.slotCount === 0 ? (
            <StateBlock kind="empty" icon="calendar" title="No timetable published yet" message={`The school has not published periods for ${classSectionLabel(activeChild.className, activeChild.section)}.`} />
          ) : (
            <>
              <ChoiceRow label="Day" options={WEEK_DAYS.map((d) => ({ value: d, label: d === today ? `${d.slice(0, 3)} · Today` : d.slice(0, 3) }))} value={day} onChange={(v) => setDay(v as WeekDay)} />
              <Card gap={0}>
                <View style={styles.head}>
                  <T style={[styles.th, { width: 44 }]}>Period</T>
                  <T style={[styles.th, { width: 92 }]}>Time</T>
                  <T style={[styles.th, { flex: 1 }]}>Subject</T>
                </View>
                {daySlots.length === 0 ? (
                  <CardMessage text={`No periods on ${day}.`} />
                ) : (
                  daySlots.map((s, i) => {
                    const a = minutesOf(s.startTime);
                    const b = minutesOf(s.endTime);
                    const live = nowMin !== null && a !== null && b !== null && nowMin >= a && nowMin < b;
                    return (
                      <View key={s.id || `${day}-${i}`} style={[styles.tr, i > 0 && styles.trBorder, live && styles.live]}>
                        <T style={[styles.pNo, { width: 44 }]}>{s.periodNumber ?? s.period}</T>
                        <T style={[styles.time, { width: 92 }]}>{s.startTime ? `${s.startTime}${s.endTime ? ` - ${s.endTime}` : ''}` : '—'}</T>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <T style={styles.subject} numberOfLines={2}>
                            {s.subjectName || 'Subject not recorded'}
                          </T>
                          <T style={styles.teacher} numberOfLines={1}>
                            {[s.teacherName, roomLabel(s.roomNumber)].filter(Boolean).join(' · ')}
                          </T>
                          {live ? <T style={styles.liveTag}>Running now</T> : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  info: { flexDirection: 'row', gap: SPACE.sm },
  infoBox: { flex: 1, padding: SPACE.md, borderRadius: 14, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  infoLabel: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  infoValue: { fontFamily: FONT.semibold, fontSize: 15, color: TH.navy },
  head: { flexDirection: 'row', gap: SPACE.sm, paddingBottom: SPACE.sm, borderBottomWidth: 1, borderBottomColor: TH.border },
  th: { fontFamily: FONT.semibold, fontSize: 12, color: TH.muted },
  tr: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.sm },
  trBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  live: { backgroundColor: '#EEF4FF', marginHorizontal: -SPACE.sm, paddingHorizontal: SPACE.sm, borderRadius: 10 },
  pNo: { fontFamily: FONT.bold, fontSize: 15, color: BRAND_COLORS.primaryRoyal },
  time: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  subject: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  teacher: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  liveTag: { fontFamily: FONT.bold, fontSize: 10, color: BRAND_COLORS.primaryBright },
});
