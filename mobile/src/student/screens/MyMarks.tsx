import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Card, CardMessage } from '../../components/teacher-home/ListParts';
import { Icon } from '../../components/teacher-home/Icon';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren, NoActiveChild } from '../../parent/ParentChildContext';
import { ChoiceRow, Figure, ParentHeader, Pill, Screen, Segmented, Skeleton, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { classLabel, evaluateMarks, formatDisplayDate, publishedExamsForChild, upcomingExamsForChild } from '../../utils/parentRules';
import { useStudentPortal } from '../StudentContext';

type Tab = 'marks' | 'schedule' | 'result';

export const MyMarks: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { activeChild } = useParentChildren();
  const { schoolSession } = useStudentPortal();
  const [tab, setTab] = useState<Tab>('marks');
  const [session, setSession] = useState('');
  const [examId, setExamId] = useState('');

  const sessions = useChildData(async () => {
    const r = await apiService.getAcademicSessions();
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  });
  const sessionNames = useMemo(() => {
    const names = (sessions.data || []).map((s) => s.name).filter(Boolean);
    for (const extra of [schoolSession, activeChild?.academicSession]) if (extra && !names.includes(extra)) names.push(extra);
    const current = schoolSession || activeChild?.academicSession || '';
    const rank = (n: string) => (n === current ? 0 : current && n > current ? 2 : 1);
    return Array.from(new Set(names)).sort((a, b) => rank(a) - rank(b) || b.localeCompare(a));
  }, [sessions.data, schoolSession, activeChild?.academicSession]);

  useEffect(() => {
    setSession(schoolSession || activeChild?.academicSession || '');
    setExamId('');
  }, [activeChild?.id, schoolSession]);

  const published = useChildData(async (c) => {
    if (!c.classId) return { ok: true, data: [] as any[] };
    const r = await apiService.getPublishedExams(c.classId, session || undefined);
    return { ok: r.ok, status: r.status, error: r.error, data: publishedExamsForChild(r.data as any[], c, session || undefined) };
  }, session);

  useEffect(() => {
    const list = published.data || [];
    setExamId((prev) => (prev && list.some((e: any) => e.id === prev) ? prev : list[0]?.id || ''));
  }, [published.data]);

  const schedule = useChildData(async (c) => {
    if (!c.classId) return { ok: true, data: [] as any[] };
    const r = await apiService.getExams({ classId: c.classId });
    return { ok: r.ok, status: r.status, error: r.error, data: upcomingExamsForChild(r.data as any[], c) };
  });

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
  const exam = (published.data || []).find((e: any) => e.id === examId);
  const examName = exam?.name || exam?.title || 'Examination';

  const refresh = () => {
    published.refresh();
    marks.refresh();
    schedule.refresh();
  };

  const examPicker =
    sessionNames.length > 0 || (published.data || []).length > 0 ? (
      <>
        {sessionNames.length > 0 && (
          <ChoiceRow label="Academic session" options={sessionNames.map((n) => ({ value: n, label: n === schoolSession ? `${n} (current)` : n }))} value={session} onChange={(v) => { setSession(v); setExamId(''); }} />
        )}
        {(published.data || []).length > 0 && <ChoiceRow label="Examination" options={(published.data || []).map((e: any) => ({ value: e.id, label: e.name || e.title || 'Examination' }))} value={examId} onChange={setExamId} />}
      </>
    ) : null;

  const noResults = (
    <StateBlock kind="empty" icon="graduation-cap" title="No results published yet" message={`No results have been published for ${classLabel(activeChild?.className)}${session ? ` in ${session}` : ''}.`} />
  );

  const marksBody = () => {
    if (published.state === 'loading' && !published.data) return <Skeleton height={40} radius={20} />;
    if (published.state === 'error' && !published.data) return <StateBlock kind="error" title="Exams could not be loaded" message={published.error} onRetry={published.reload} />;
    if ((published.data || []).length === 0) return noResults;
    if (marks.state === 'loading' && !marks.data) return <SkeletonList rows={4} height={48} />;
    if (marks.state === 'error') return <StateBlock kind="error" title="Marks could not be loaded" message={marks.error} onRetry={marks.reload} />;
    if (!result || result.rows.length === 0) return <StateBlock kind="empty" icon="graduation-cap" title="Marks not available" message={`Marks for ${examName} have not been entered yet.`} />;
    return (
      <>
        <Card gap={0}>
          <View style={styles.tableHead}>
            <T style={[styles.th, { flex: 1 }]}>Subject</T>
            <T style={[styles.th, styles.num]}>Max Marks</T>
            <T style={[styles.th, styles.num]}>Obtained</T>
            <T style={[styles.th, styles.grade]}>Grade</T>
          </View>
          {result.rows.map((r, i) => (
            <View key={r.subjectId || r.subject} style={[styles.tr, i > 0 && styles.trBorder]}>
              <T style={[styles.td, { flex: 1 }]} numberOfLines={2}>
                {r.subject}
              </T>
              <T style={[styles.td, styles.num]}>{r.max}</T>
              <T style={[styles.td, styles.num, !r.pass && styles.fail]}>{r.obtained === null ? 'Absent' : r.obtained}</T>
              <T style={[styles.td, styles.grade, !r.pass && styles.fail]}>{r.grade}</T>
            </View>
          ))}
        </Card>
        <View style={styles.overall}>
          <View style={styles.trophy}>
            <Icon name="graduation-cap" size={22} color={TH.goldInk} />
          </View>
          <View style={{ flex: 1 }}>
            <T style={styles.overallLabel}>Overall Grade</T>
            <T style={styles.overallValue}>{result.grade || '—'}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T style={styles.overallLabel}>Percentage</T>
            <T style={styles.overallValue}>{result.percentage === null ? '—' : `${result.percentage}%`}</T>
          </View>
        </View>
        <CardMessage text="Grades follow the 8-point grading scale used on the school marksheet." />
      </>
    );
  };

  const scheduleBody = () => {
    if (schedule.state === 'loading' && !schedule.data) return <SkeletonList rows={3} height={64} />;
    if (schedule.state === 'error' && !schedule.data) return <StateBlock kind="error" title="Exam schedule could not be loaded" message={schedule.error} onRetry={schedule.reload} />;
    const list = (schedule.data as any[]) || [];
    if (list.length === 0) return <StateBlock kind="empty" icon="calendar" title="No exams scheduled" message="Upcoming examinations for your class will appear here." />;
    return (
      <View style={{ gap: SPACE.md }}>
        {list.map((e: any) => (
          <Card key={e.id || `${e.name}-${e.startDate}`} gap={SPACE.sm}>
            <T style={styles.examTitle}>{e.name || e.title || 'Examination'}</T>
            <T style={styles.examMeta}>
              {formatDisplayDate(e.startDate)}
              {e.endDate && e.endDate !== e.startDate ? ` – ${formatDisplayDate(e.endDate)}` : ''}
            </T>
            {!!e.examType && <Pill label={String(e.examType).replace(/_/g, ' ')} tone="info" />}
          </Card>
        ))}
      </View>
    );
  };

  const resultBody = () => {
    if (published.state === 'loading' && !published.data) return <Skeleton height={140} radius={16} />;
    if ((published.data || []).length === 0) return noResults;
    if (marks.state === 'loading' && !marks.data) return <Skeleton height={140} radius={16} />;
    if (!result || result.rows.length === 0) return <StateBlock kind="empty" icon="graduation-cap" title="Result not available" message={`Marks for ${examName} have not been entered yet.`} />;
    return (
      <Card gap={SPACE.md}>
        <View style={styles.resultHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T style={styles.examTitle} numberOfLines={2}>
              {examName}
            </T>
            {!!exam?.startDate && (
              <T style={styles.examMeta}>
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
    );
  };

  return (
    <Screen header={<ParentHeader title="Marks & Results" onBack={onBack} />} refreshing={published.refreshing || marks.refreshing || schedule.refreshing} onRefresh={refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : (
        <>
          <Segmented
            options={[
              { value: 'marks', label: 'Term Marks' },
              { value: 'schedule', label: 'Exam Schedule' },
              { value: 'result', label: 'Result' },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
          {tab !== 'schedule' && examPicker}
          {tab === 'marks' ? marksBody() : tab === 'schedule' ? scheduleBody() : resultBody()}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  tableHead: { flexDirection: 'row', gap: SPACE.sm, paddingBottom: SPACE.sm, borderBottomWidth: 1, borderBottomColor: TH.border },
  th: { fontFamily: FONT.semibold, fontSize: 11, color: TH.muted },
  tr: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.sm },
  trBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  td: { fontFamily: FONT.medium, fontSize: 14, color: TH.ink },
  num: { width: 62, textAlign: 'right' },
  grade: { width: 40, textAlign: 'right' },
  fail: { color: '#B42318' },
  overall: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderRadius: 16, backgroundColor: '#FFF3DB', borderWidth: 1, borderColor: '#F6E3B4' },
  trophy: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFE6A8', alignItems: 'center', justifyContent: 'center' },
  overallLabel: { fontFamily: FONT.regular, fontSize: 12, color: TH.goldInk },
  overallValue: { fontFamily: FONT.heading, fontSize: 22, color: TH.navy },
  examTitle: { fontFamily: FONT.heading, fontSize: 17, color: TH.navy },
  examMeta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  resultHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  figures: { flexDirection: 'row', gap: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: TH.border },
});
