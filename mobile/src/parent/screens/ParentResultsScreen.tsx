import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Card, CardMessage } from '../../components/teacher-home/ListParts';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren, NoActiveChild } from '../ParentChildContext';
import { ChoiceRow, Figure, ParentHeader, Pill, Screen, Skeleton, SkeletonList, SPACE, StateBlock } from '../ui';
import { classLabel, evaluateMarks, formatDisplayDate, publishedExamsForChild } from '../../utils/parentRules';

interface Props {
  onOpenChildren: () => void;
  /** The school's current session from saved settings, when known. */
  schoolSession?: string;
}

/** Session → Exam → subject-wise marks for the active child (published results only). */
export const ParentResultsScreen: React.FC<Props> = ({ onOpenChildren, schoolSession }) => {
  const { activeChild } = useParentChildren();
  const [session, setSession] = useState<string>('');
  const [examId, setExamId] = useState<string>('');

  // Sessions list; default to the school's saved current session, else the child's.
  const sessions = useChildData(async () => {
    const r = await apiService.getAcademicSessions();
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  });
  const sessionNames = useMemo(() => {
    const names = (sessions.data || []).map((s) => s.name).filter(Boolean);
    for (const extra of [schoolSession, activeChild?.academicSession]) if (extra && !names.includes(extra)) names.push(extra);
    // Current session first, then earlier sessions (newest first); sessions set up
    // for future years cannot have results yet, so they go last.
    const current = schoolSession || activeChild?.academicSession || '';
    const rank = (n: string) => (n === current ? 0 : current && n > current ? 2 : 1);
    return Array.from(new Set(names)).sort((a, b) => rank(a) - rank(b) || b.localeCompare(a));
  }, [sessions.data, schoolSession, activeChild?.academicSession]);

  useEffect(() => {
    // New child: start from the verified default again.
    setSession(schoolSession || activeChild?.academicSession || '');
    setExamId('');
  }, [activeChild?.id, schoolSession]);

  const exams = useChildData(async (c) => {
    if (!c.classId) return { ok: true, data: [] as any[] };
    const r = await apiService.getPublishedExams(c.classId, session || undefined);
    return { ok: r.ok, status: r.status, error: r.error, data: publishedExamsForChild(r.data as any[], c, session || undefined) };
  }, session);

  useEffect(() => {
    // Changing session or child clears an exam that no longer applies.
    const list = exams.data || [];
    setExamId((prev) => (prev && list.some((e: any) => e.id === prev) ? prev : list[0]?.id || ''));
  }, [exams.data]);

  const subjects = useChildData(async () => {
    const r = await apiService.getSubjects();
    const map: Record<string, string> = {};
    for (const s of r.data || []) if (s?.id && s?.name) map[s.id] = s.name;
    return { ok: true, data: map };
  });

  const marks = useChildData(async (c) => {
    if (!examId) return { ok: true, data: [] as any[] };
    const r = await apiService.getChildMarks(c.id, examId);
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  }, examId);

  const result = useMemo(
    () => (activeChild && examId ? evaluateMarks(marks.data as any[], activeChild.id, examId, subjects.data || {}) : null),
    [marks.data, activeChild?.id, examId, subjects.data]
  );
  const exam = (exams.data || []).find((e: any) => e.id === examId);

  const refresh = () => {
    exams.refresh();
    marks.refresh();
  };

  return (
    <Screen header={<ParentHeader title="Exams & Marks" child={activeChild} onPressChild={onOpenChildren} />} refreshing={exams.refreshing || marks.refreshing} onRefresh={refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : (
        <>
          {sessionNames.length > 0 && (
            <ChoiceRow label="Academic session" options={sessionNames.map((n) => ({ value: n, label: n === schoolSession ? `${n} (current)` : n }))} value={session} onChange={(v) => { setSession(v); setExamId(''); }} />
          )}

          {exams.state === 'loading' && !exams.data ? (
            <Skeleton height={40} radius={20} />
          ) : exams.state === 'error' ? (
            <StateBlock kind="error" title="Exams could not be loaded" message={exams.error} onRetry={exams.reload} />
          ) : (exams.data || []).length === 0 ? (
            <StateBlock
              kind="empty"
              icon="graduation-cap"
              title="No results published yet"
              message={`No results have been published for ${classLabel(activeChild.className)}${session ? ` in ${session}` : ''}.`}
            />
          ) : (
            <>
              <ChoiceRow label="Examination" options={(exams.data || []).map((e: any) => ({ value: e.id, label: e.name || e.title || 'Examination' }))} value={examId} onChange={setExamId} />

              {marks.state === 'loading' && !marks.data ? (
                <SkeletonList rows={4} height={48} />
              ) : marks.state === 'error' ? (
                <StateBlock kind="error" title="Marks could not be loaded" message={marks.error} onRetry={marks.reload} />
              ) : !result || result.rows.length === 0 ? (
                <StateBlock kind="empty" icon="graduation-cap" title="Marks not available" message={`Marks for ${exam?.name || exam?.title || 'this exam'} have not been entered for ${activeChild.name} yet.`} />
              ) : (
                <>
                  <Card gap={SPACE.md}>
                    <View style={styles.resultHead}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T style={styles.examName} numberOfLines={2}>
                          {exam?.name || exam?.title}
                        </T>
                        {!!exam?.startDate && (
                          <T style={styles.examDate}>
                            {formatDisplayDate(exam.startDate)}
                            {exam.endDate && exam.endDate !== exam.startDate ? ` – ${formatDisplayDate(exam.endDate)}` : ''}
                          </T>
                        )}
                      </View>
                      {result.result && <Pill label={result.result === 'PASS' ? 'Passed' : 'Not passed'} tone={result.result === 'PASS' ? 'success' : 'danger'} />}
                    </View>
                    <View style={styles.figures}>
                      <Figure label="Total" value={`${result.totalObtained} / ${result.totalMax}`} />
                      <Figure label="Percentage" value={result.percentage === null ? '—' : `${result.percentage}%`} />
                      <Figure label="Grade" value={result.grade || '—'} />
                    </View>
                  </Card>

                  <Card gap={0}>
                    <View style={styles.tableHead}>
                      <T style={[styles.th, { flex: 1 }]}>Subject</T>
                      <T style={[styles.th, styles.num]}>Marks</T>
                      <T style={[styles.th, styles.grade]}>Grade</T>
                    </View>
                    {result.rows.map((r, i) => (
                      <View key={r.subjectId || r.subject} style={[styles.tr, i > 0 && styles.trBorder]}>
                        <T style={[styles.td, { flex: 1 }]} numberOfLines={2}>
                          {r.subject}
                        </T>
                        <T style={[styles.td, styles.num, !r.pass && styles.fail]}>{r.obtained === null ? 'Absent' : `${r.obtained} / ${r.max}`}</T>
                        <T style={[styles.td, styles.grade, !r.pass && styles.fail]}>{r.grade}</T>
                      </View>
                    ))}
                  </Card>
                  <CardMessage text="Grades follow the 8-point grading scale used on the school marksheet." />
                </>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  resultHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  examName: { fontFamily: FONT.heading, fontSize: 17, color: TH.navy },
  examDate: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, marginTop: 2 },
  figures: { flexDirection: 'row', gap: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: TH.border },
  tableHead: { flexDirection: 'row', gap: SPACE.sm, paddingBottom: SPACE.sm, borderBottomWidth: 1, borderBottomColor: TH.border },
  th: { fontFamily: FONT.semibold, fontSize: 12, color: TH.muted },
  tr: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.sm },
  trBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  td: { fontFamily: FONT.medium, fontSize: 14, color: TH.ink },
  num: { width: 84, textAlign: 'right' },
  grade: { width: 48, textAlign: 'right' },
  fail: { color: '#B42318' },
});
