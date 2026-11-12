import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Card } from '../../components/teacher-home/ListParts';
import { Pill, Screen, Segmented, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { MonthlyReport, NightRecord, wardenApi } from '../wardenApi';
import { indiaDate, monthLabel, nightLabel, shiftMonth, STATUS_META } from '../wardenRules';
import { WardenHeader } from '../wardenUi';

type View_ = 'daily' | 'monthly';

/** Night attendance history (day by day, with corrections) and the monthly report. */
export const WardenHistoryScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const today = indiaDate();
  const [mode, setMode] = useState<View_>('daily');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [records, setRecords] = useState<NightRecord[]>([]);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pull = false) => {
      if (pull) setRefreshing(true);
      const from = `${month}-01`;
      const to = `${month}-31`;
      const [h, m] = await Promise.all([wardenApi.history({ from, to }), wardenApi.monthly(month)]);
      if (h.ok) setRecords(h.data || []);
      if (m.ok) setReport(m.data || null);
      setError(!h.ok ? h.error || 'History could not be loaded.' : !m.ok ? m.error || 'The report could not be loaded.' : null);
      setLoading(false);
      setRefreshing(false);
    },
    [month]
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const byDate = records.reduce<Record<string, NightRecord[]>>((acc, r) => {
    (acc[r.date] = acc[r.date] || []).push(r);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort().reverse();

  return (
    <Screen header={<WardenHeader title="Attendance History" subtitle="Night roll-call records and reports" onBack={onBack} />} refreshing={refreshing} onRefresh={() => load(true)}>
      <View style={styles.monthRow}>
        <TouchableOpacity style={styles.mBtn} onPress={() => setMonth(shiftMonth(month, -1))} accessibilityRole="button" accessibilityLabel="Previous month">
          <Icon name="chevron-left" size={20} color={TH.navy} />
        </TouchableOpacity>
        <T style={styles.monthTitle}>{monthLabel(month)}</T>
        <TouchableOpacity
          style={[styles.mBtn, month >= today.slice(0, 7) && { opacity: 0.3 }]}
          disabled={month >= today.slice(0, 7)}
          onPress={() => setMonth(shiftMonth(month, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="chevron-left" size={20} color={TH.navy} />
          </View>
        </TouchableOpacity>
      </View>
      <Segmented<View_> options={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly report' }]} value={mode} onChange={setMode} />

      {loading ? (
        <SkeletonList rows={5} />
      ) : error && !records.length && !report ? (
        <StateBlock kind="error" title="Could not load" message={error} onRetry={() => load()} />
      ) : mode === 'daily' ? (
        dates.length === 0 ? (
          <StateBlock kind="empty" icon="moon" title="No roll-call this month" message="Saved night attendance will appear here." />
        ) : (
          dates.map((d) => {
            const list = byDate[d];
            const absent = list.filter((r) => r.status !== 'PRESENT');
            const present = list.length - absent.length;
            return (
              <Card key={d} gap={SPACE.sm}>
                <View style={styles.dayHead}>
                  <T style={styles.dayTitle}>{nightLabel(d, today)}</T>
                  <T style={styles.dayMeta}>
                    {present} present · {absent.length} not present
                  </T>
                </View>
                {absent.length === 0 ? (
                  <T style={styles.allGood}>Everyone was present.</T>
                ) : (
                  absent.map((r) => (
                    <View key={r.id} style={styles.recRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T style={styles.recName} numberOfLines={1}>
                          {r.studentName}
                        </T>
                        <T style={styles.recMeta} numberOfLines={2}>
                          Room {r.roomNumber || '-'}
                          {r.remarks ? ` · ${r.remarks}` : ''}
                          {r.corrected && r.history?.length ? ` · corrected: ${r.history[r.history.length - 1].reason || ''}` : ''}
                        </T>
                      </View>
                      <Pill label={STATUS_META[r.status].label} tone={STATUS_META[r.status].tone} />
                    </View>
                  ))
                )}
                {list.some((r) => r.corrected && r.status === 'PRESENT') && (
                  <T style={styles.recMeta}>
                    Corrected to present: {list.filter((r) => r.corrected && r.status === 'PRESENT').map((r) => r.studentName).join(', ')}
                  </T>
                )}
              </Card>
            );
          })
        )
      ) : !report || report.nightsTaken === 0 ? (
        <StateBlock kind="empty" icon="moon" title="No roll-call this month" message="The report fills in as night attendance is saved." />
      ) : (
        <>
          <Card gap={SPACE.xs}>
            <T style={styles.dayTitle}>{report.nightsTaken} night(s) taken</T>
            <T style={styles.recMeta}>Totals per student for {monthLabel(month)}. P present · A absent · L on leave · O outside.</T>
          </Card>
          <Card gap={0}>
            <View style={[styles.tRow, styles.tHead]}>
              <T style={[styles.tName, styles.tHeadText]}>Student</T>
              {['P', 'A', 'L', 'O'].map((h) => (
                <T key={h} style={[styles.tNum, styles.tHeadText]}>
                  {h}
                </T>
              ))}
            </View>
            {report.perStudent.map((p) => (
              <View key={p.studentId} style={styles.tRow} accessibilityLabel={`${p.name}: ${p.present} present, ${p.absent} absent, ${p.onLeave} on leave, ${p.outside} outside`}>
                <View style={styles.tName}>
                  <T style={styles.recName} numberOfLines={1}>
                    {p.name}
                  </T>
                  <T style={styles.recMeta}>Room {p.roomNumber || '-'}</T>
                </View>
                <T style={styles.tNum}>{p.present}</T>
                <T style={[styles.tNum, p.absent > 0 && { color: '#B42318', fontFamily: FONT.bold }]}>{p.absent}</T>
                <T style={styles.tNum}>{p.onLeave}</T>
                <T style={styles.tNum}>{p.outside}</T>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  mBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  monthTitle: { flex: 1, textAlign: 'center', fontFamily: FONT.heading, fontSize: 18, color: TH.navy },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayTitle: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  dayMeta: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  allGood: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 44 },
  recName: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  recMeta: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
  tRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderBottomColor: TH.border },
  tHead: { minHeight: 36 },
  tHeadText: { fontFamily: FONT.semibold, fontSize: 12, color: TH.muted },
  tName: { flex: 1, minWidth: 0 },
  tNum: { width: 36, textAlign: 'center', fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
});
