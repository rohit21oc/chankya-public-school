import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../teacher-home/T';
import { Icon } from '../teacher-home/Icon';
import { Card } from '../teacher-home/ListParts';
import { ChoiceRow, Pill, SPACE, SkeletonList, StateBlock, Tone } from '../../parent/ui';
import {
  ExamLike,
  SchedulePaper,
  buildSchedule,
  filterOptions,
  groupByDate,
  longDate,
  monthLabel,
  parts,
  phaseLabel,
  scheduleSummary,
} from '../../utils/examScheduleModel';

const PHASE_TONE: Record<SchedulePaper['phase'], Tone> = { today: 'warning', upcoming: 'info', completed: 'neutral' };

interface Props {
  exams: ExamLike[] | null;
  state: 'loading' | 'ready' | 'error';
  error?: string;
  onRetry: () => void;
  classId?: string;
  section?: string;
  /** "Class 5 - Section A", shown in the summary. */
  classTitle?: string;
  session?: string;
  today: string;
}

/** Exam schedule for one class: summary, filters, papers grouped by date, and a detail sheet. Same for every role. */
export const ExamScheduleBody: React.FC<Props> = ({ exams, state, error, onRetry, classId, section, classTitle, session, today }) => {
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const [examType, setExamType] = useState('ALL');
  const [month, setMonth] = useState('ALL');
  const [open, setOpen] = useState<SchedulePaper | null>(null);

  const options = useMemo(() => filterOptions(exams, classId), [exams, classId]);
  const { papers, noTimetable } = useMemo(() => buildSchedule(exams, { classId, section, examType, month }, today), [exams, classId, section, examType, month, today]);
  const groups = useMemo(() => groupByDate(papers), [papers]);
  const summary = useMemo(() => scheduleSummary(papers), [papers]);
  const filtering = examType !== 'ALL' || month !== 'ALL';

  if (state === 'error' && !exams) {
    return <StateBlock kind="error" icon="calendar" title="Exam schedule could not be loaded" message={error || 'Please check your connection and try again.'} onRetry={onRetry} />;
  }
  if (state === 'loading' && !exams) {
    return (
      <View accessibilityLabel="Loading exam schedule" style={{ gap: SPACE.md }}>
        <SkeletonList rows={1} height={120} />
        <SkeletonList rows={4} height={84} />
      </View>
    );
  }

  const nothing = papers.length === 0 && noTimetable.length === 0;
  const next = summary.next;

  return (
    <View style={{ gap: SPACE.lg }}>
      {/* Summary */}
      <View style={styles.hero}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={styles.heroLabel}>{[session && `Session ${session}`, classTitle].filter(Boolean).join(' · ') || 'Exam schedule'}</T>
          <T style={styles.heroTitle} numberOfLines={2}>
            {next ? `${next.subject}` : papers.length ? 'All papers completed' : 'No papers scheduled'}
          </T>
          <T style={styles.heroSub} numberOfLines={2}>
            {next ? `${next.phase === 'today' ? 'Today' : 'Next'} · ${longDate(next.date)}${next.startTime ? ` · ${next.startTime}` : ''}` : filtering ? 'Try clearing the filters' : 'Check back when the school publishes dates'}
          </T>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.stat}>
            <T style={styles.statNum}>{summary.subjects}</T>
            <T style={styles.statLabel}>Subjects</T>
          </View>
          <View style={styles.stat}>
            <T style={styles.statNum}>{summary.total}</T>
            <T style={styles.statLabel}>Papers</T>
          </View>
        </View>
      </View>

      {/* Filters */}
      {options.types.length > 1 && <ChoiceRow label="Exam type" value={examType} onChange={setExamType} options={[{ value: 'ALL', label: 'All exams' }, ...options.types.map((t) => ({ value: t, label: t }))]} />}
      {options.months.length > 1 && <ChoiceRow label="Month" value={month} onChange={setMonth} options={[{ value: 'ALL', label: 'All months' }, ...options.months.map((m) => ({ value: m, label: monthLabel(m) }))]} />}

      {nothing ? (
        <StateBlock
          kind="empty"
          icon="calendar"
          title="No exams found"
          message={filtering ? 'No exam schedule for the selected type or month.' : 'No exam schedule has been published for this class yet.'}
          onRetry={filtering ? () => { setExamType('ALL'); setMonth('ALL'); } : onRetry}
        />
      ) : (
        <>
          {groups.map((g) => (
            <View key={g.date} style={{ gap: SPACE.sm }}>
              <T style={styles.dayTitle}>{g.title}</T>
              <Card gap={0}>
                {g.papers.map((p, i) => {
                  const d = parts(p.date);
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[styles.row, i > 0 && styles.rowBorder, p.phase === 'completed' && { opacity: 0.7 }]}
                      onPress={() => setOpen(p)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.subject}, ${longDate(p.date)}${p.startTime ? `, ${p.startTime}` : ''}. Open details`}
                    >
                      <View style={[styles.tile, narrow && styles.tileNarrow]}>
                        <T style={styles.tileDay}>{d.day}</T>
                        <T style={styles.tileMon}>{d.mon}</T>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <T style={styles.subject} numberOfLines={2}>{p.subject}</T>
                        <T style={styles.meta} numberOfLines={2}>
                          {[p.startTime && `${p.startTime}${p.endTime ? ` – ${p.endTime}` : ''}`, p.room && `Room ${p.room}`].filter(Boolean).join(' · ') || 'Time not set'}
                        </T>
                        {!examType || examType === 'ALL' ? <T style={styles.exam} numberOfLines={1}>{p.examName}</T> : null}
                      </View>
                      <View style={styles.right}>
                        {p.phase !== 'upcoming' && <Pill label={phaseLabel(p.phase)} tone={PHASE_TONE[p.phase]} />}
                        <Icon name="chevron" size={16} color={TH.muted} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Card>
            </View>
          ))}

          {noTimetable.length > 0 && (
            <View style={{ gap: SPACE.sm }}>
              <T style={styles.dayTitle}>Timetable not published yet</T>
              <Card gap={0}>
                {noTimetable.map((n, i) => (
                  <View key={n.examId} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={[styles.tile, narrow && styles.tileNarrow]}>
                      <T style={styles.tileDay}>{parts(n.startDate).day}</T>
                      <T style={styles.tileMon}>{parts(n.startDate).mon}</T>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <T style={styles.subject} numberOfLines={2}>{n.examName}</T>
                      <T style={styles.meta} numberOfLines={2}>
                        {n.endDate !== n.startDate ? `${longDate(n.startDate)} to ${longDate(n.endDate)}` : longDate(n.startDate)}
                      </T>
                    </View>
                    <Pill label={phaseLabel(n.phase)} tone={PHASE_TONE[n.phase]} />
                  </View>
                ))}
              </Card>
            </View>
          )}
        </>
      )}

      {/* Detail sheet */}
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)} statusBarTranslucent navigationBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)} accessibilityLabel="Close details" />
        {open && (
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={styles.sheetTitle} numberOfLines={2}>{open.subject}</T>
                <T style={styles.sheetSub} numberOfLines={2}>{open.examName}</T>
              </View>
              <Pill label={phaseLabel(open.phase)} tone={PHASE_TONE[open.phase]} />
              <TouchableOpacity onPress={() => setOpen(null)} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="x" size={20} color={TH.ink} />
              </TouchableOpacity>
            </View>
            {([
              ['Date', longDate(open.date)],
              ['Time', open.startTime ? `${open.startTime}${open.endTime ? ` – ${open.endTime}` : ''}` : 'Not set'],
              ['Duration', open.durationLabel || '—'],
              ['Venue', open.room ? `Room ${open.room}` : 'Not set'],
            ] as Array<[string, string]>).map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <T style={styles.detailKey}>{k}</T>
                <T style={styles.detailVal}>{v}</T>
              </View>
            ))}
            {!!open.instructions && (
              <View style={styles.instr}>
                <T style={styles.instrTitle}>Instructions</T>
                <T style={styles.instrText}>{open.instructions}</T>
              </View>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderRadius: 18, backgroundColor: TH.navy },
  heroLabel: { fontFamily: FONT.medium, fontSize: 11, color: TH.onNavyMuted },
  heroTitle: { fontFamily: FONT.heading, fontSize: 20, color: '#FFFFFF', marginTop: 2 },
  heroSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.onNavyMuted, marginTop: 4 },
  heroStats: { gap: SPACE.sm },
  stat: { minWidth: 64, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: TH.onNavyPanel },
  statNum: { fontFamily: FONT.bold, fontSize: 18, color: '#FFFFFF' },
  statLabel: { fontFamily: FONT.regular, fontSize: 10, color: TH.onNavyMuted },
  dayTitle: { fontFamily: FONT.semibold, fontSize: 13, color: TH.muted, paddingHorizontal: 2 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  tile: { width: 52, height: 56, borderRadius: 12, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  tileNarrow: { width: 44, height: 50 },
  tileDay: { fontFamily: FONT.bold, fontSize: 18, color: TH.royal, lineHeight: 22 },
  tileMon: { fontFamily: FONT.medium, fontSize: 11, color: TH.royal },
  subject: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  exam: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  right: { alignItems: 'flex-end', gap: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,75,0.45)' },
  sheet: { backgroundColor: TH.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: SPACE.lg, paddingBottom: SPACE.xl + 8, gap: SPACE.xs },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, marginBottom: SPACE.sm },
  sheetTitle: { fontFamily: FONT.heading, fontSize: 20, color: TH.ink },
  sheetSub: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted, marginTop: 2 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: TH.border },
  detailKey: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  detailVal: { flex: 1, textAlign: 'right', fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  instr: { marginTop: SPACE.sm, padding: SPACE.md, borderRadius: 14, backgroundColor: TH.tile, gap: 4 },
  instrTitle: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal },
  instrText: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 19, color: TH.ink },
});
