import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SectionCard } from './ui/SectionCard';
import { StateView } from './ui/StateView';
import { BRAND_COLORS } from '../utils/branding';
import { apiService } from '../services/apiService';
import { buildMonthModel, CalendarDay, DayKind, shiftMonth } from '../utils/attendanceCalendarModel';

export interface CalendarSource {
  ok: boolean;
  records: any[];
  leaves: any[];
  holidays: any[];
  error?: string;
}

interface Props {
  title?: string;
  /** Loads every record of the person. Month navigation then happens locally. */
  load: () => Promise<CalendarSource>;
  /** Staff calendars: show absent and unmarked working days as a one-day salary cut. */
  salaryCut?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const KIND_STYLE: Record<DayKind, { bg: string; fg: string; label: string }> = {
  PRESENT: { bg: '#DCFCE7', fg: '#166534', label: 'Present' },
  LATE: { bg: '#D1FAE5', fg: '#047857', label: 'Late' },
  HALF_DAY: { bg: '#E0F2FE', fg: '#075985', label: 'Half day' },
  ABSENT: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Absent' },
  LEAVE: { bg: '#FEF3C7', fg: '#B45309', label: 'Leave' },
  HOLIDAY: { bg: '#EDE9FE', fg: '#6D28D9', label: 'Holiday' },
  WEEK_OFF: { bg: '#F1F5F9', fg: '#64748B', label: 'Weekly off' },
  NO_RECORD: { bg: '#FFFFFF', fg: '#475569', label: 'No record' },
  FUTURE: { bg: '#FFFFFF', fg: '#CBD5E1', label: 'Upcoming' },
};

const todayIsoIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().substring(0, 10);

export const AttendanceCalendar: React.FC<Props> = ({ title = 'Attendance', load, salaryCut = false }) => {
  const today = todayIsoIST();
  const [cursor, setCursor] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 });
  const [source, setSource] = useState<CalendarSource | null>(null);
  const [workingDays, setWorkingDays] = useState<string[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CalendarDay | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [data, settings] = await Promise.all([load(), apiService.getSchoolSettings()]);
      setSource(data);
      const wd = (settings.data as any)?.workingDays;
      setWorkingDays(Array.isArray(wd) && wd.length > 0 ? wd : undefined);
    } catch {
      setSource({ ok: false, records: [], leaves: [], holidays: [], error: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const model = useMemo(
    () =>
      buildMonthModel({
        year: cursor.year,
        month: cursor.month,
        records: source?.records || [],
        holidays: source?.holidays || [],
        leaves: source?.leaves || [],
        workingDays,
        todayIso: today,
        salaryCut,
      }),
    [cursor, source, workingDays, today, salaryCut]
  );

  const go = (delta: number) => {
    setSelected(null);
    setCursor((c) => shiftMonth(c.year, c.month, delta));
  };

  const t = model.totals;
  const presentTotal = t.present + t.late;

  return (
    <SectionCard title={title}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => go(-1)} style={styles.navBtn} accessibilityLabel="Previous month" accessibilityRole="button">
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{model.title}</Text>
        <TouchableOpacity onPress={() => go(1)} style={styles.navBtn} accessibilityLabel="Next month" accessibilityRole="button">
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <StateView variant="loading" title="Loading attendance" />
      ) : !source?.ok ? (
        <StateView variant="error" title="Could not load attendance" message={source?.error} onRetry={fetchAll} />
      ) : (
        <>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.weekday}>{d}</Text>
            ))}
          </View>
          {model.weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((d, di) =>
                d ? (
                  <TouchableOpacity
                    key={d.iso}
                    style={styles.cell}
                    onPress={() => setSelected(d)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${d.day} ${model.title}: ${d.detail}`}
                  >
                    <View
                      style={[
                        styles.dayBubble,
                        { backgroundColor: KIND_STYLE[d.kind].bg },
                        d.kind === 'NO_RECORD' && styles.dayBubbleOutline,
                        d.iso === today && styles.today,
                      ]}
                    >
                      <Text style={[styles.dayText, { color: KIND_STYLE[d.kind].fg }, d.iso === today && styles.todayText]}>{d.day}</Text>
                    </View>
                    {d.salaryCut ? <Text style={styles.cutMark}>−1 day</Text> : null}
                  </TouchableOpacity>
                ) : (
                  <View key={`p${wi}-${di}`} style={styles.cell} />
                )
              )}
            </View>
          ))}

          {selected && (
            <View style={styles.detail}>
              <Text style={styles.detailTitle}>{selected.iso}</Text>
              <Text style={styles.detailText}>
                {selected.detail}
                {selected.checkInTime ? ` • In ${selected.checkInTime}` : ''}
                {selected.remarks ? ` • ${selected.remarks}` : ''}
              </Text>
            </View>
          )}

          <View style={styles.totals}>
            <Total label="Present" value={presentTotal} color="#16803C" />
            <Total label="Absent" value={t.absent} color="#D92D20" />
            <Total label="Leave" value={t.leave} color="#B45309" />
            <Total label="Holiday" value={t.holiday} color="#6D28D9" />
          </View>
          {(t.halfDay > 0 || t.late > 0 || t.weekOff > 0 || t.noRecord > 0) && (
            <Text style={styles.footnote}>
              {[
                t.late ? `${t.late} late (counted present)` : '',
                t.halfDay ? `${t.halfDay} half day` : '',
                t.weekOff ? `${t.weekOff} weekly off` : '',
                t.noRecord ? `${t.noRecord} without a record` : '',
              ].filter(Boolean).join(' • ')}
            </Text>
          )}
          {salaryCut && t.salaryCut > 0 && (
            <View style={styles.cutBox} accessibilityRole="text">
              <Text style={styles.cutTitle}>Salary cut: {t.salaryCut} day{t.salaryCut === 1 ? '' : 's'}</Text>
              <Text style={styles.cutText}>Each absent day and each past working day without attendance is cut at one day's salary (monthly salary ÷ 30).</Text>
            </View>
          )}
          {!model.hasAnyRecord && <Text style={styles.footnote}>No attendance has been recorded for this month.</Text>}

          <View style={styles.legend}>
            {(['PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY', 'WEEK_OFF', 'NO_RECORD'] as DayKind[]).map((k) => (
              <View key={k} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: KIND_STYLE[k].bg, borderColor: k === 'NO_RECORD' ? '#CBD5E1' : KIND_STYLE[k].fg }]} />
                <Text style={styles.legendText}>{KIND_STYLE[k].label}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </SectionCard>
  );
};

const Total: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={styles.total}>
    <Text style={[styles.totalValue, { color }]}>{value}</Text>
    <Text style={styles.totalLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: BRAND_COLORS.surfaceSoft },
  navArrow: { fontSize: 24, color: BRAND_COLORS.primaryRoyal, lineHeight: 26 },
  monthTitle: { fontSize: 15, fontWeight: '800', color: BRAND_COLORS.textPrimary },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: BRAND_COLORS.textMuted, paddingVertical: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3, minHeight: 40 },
  dayBubble: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayBubbleOutline: { borderWidth: 1, borderColor: BRAND_COLORS.borderColor },
  today: { borderWidth: 2, borderColor: BRAND_COLORS.primaryRoyal },
  dayText: { fontSize: 13, fontWeight: '600' },
  cutMark: { fontSize: 8, fontWeight: '800', color: '#B91C1C', marginTop: 1 },
  cutBox: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  cutTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  cutText: { fontSize: 11, color: '#7F1D1D', marginTop: 2, lineHeight: 15 },
  todayText: { fontWeight: '800' },
  detail: { backgroundColor: BRAND_COLORS.infoLight, borderRadius: 10, padding: 10, marginTop: 8 },
  detailTitle: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.primary },
  detailText: { fontSize: 13, color: BRAND_COLORS.textSecondary, marginTop: 2 },
  totals: { flexDirection: 'row', marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BRAND_COLORS.borderColor, paddingTop: 12 },
  total: { flex: 1, alignItems: 'center' },
  totalValue: { fontSize: 20, fontWeight: '800' },
  totalLabel: { fontSize: 11, color: BRAND_COLORS.textMuted, marginTop: 2 },
  footnote: { fontSize: 11, color: BRAND_COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, marginRight: 5 },
  legendText: { fontSize: 11, color: BRAND_COLORS.textSecondary },
});
