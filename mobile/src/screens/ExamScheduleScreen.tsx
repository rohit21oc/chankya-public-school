import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from '../components/ui/SafeArea';
import { ClassItem, User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { ExamScheduleBody } from '../components/exam/ExamScheduleBody';
import { ChoiceRow, SPACE, StateBlock } from '../parent/ui';
import { apiService } from '../services/apiService';
import { loadScopedPickers } from '../utils/teacherScope';
import { classLabel, kolkataDate } from '../utils/parentRules';
import { BRAND_COLORS } from '../utils/branding';

interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenProfile?: () => void;
}

const sectionNames = (c?: ClassItem): string[] =>
  (c?.sections || []).map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean);

/** Exam schedule for staff: pick a class (teachers see their own classes), same view parents and students get. */
export const ExamScheduleScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile }) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState('');
  const [section, setSection] = useState('ALL');
  const [pickState, setPickState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pickError, setPickError] = useState('');
  const [exams, setExams] = useState<any[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadClasses = useCallback(async () => {
    setPickState('loading');
    const r = await loadScopedPickers(user);
    if (!r.ok) {
      setPickState('error');
      setPickError(r.error || 'Could not load classes.');
      return;
    }
    const sorted = [...r.classes].sort((a, b) => (a.numericOrder ?? 0) - (b.numericOrder ?? 0));
    setClasses(sorted);
    setClassId((cur) => cur || sorted[0]?.id || '');
    setPickState('ready');
  }, [user]);

  const loadExams = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setState('loading');
    const r = await apiService.getExams();
    if (r.ok) {
      setExams(r.data as any[]);
      setState('ready');
    } else {
      setState('error');
      setError(r.error || 'Could not load the exam schedule.');
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadClasses();
    void loadExams();
  }, [loadClasses, loadExams]);

  const cls = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);
  const sections = sectionNames(cls);

  return (
    <SafeAreaView style={styles.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="Exam Schedule" subtitle={cls ? classLabel(cls.name) : 'Examination dates'} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadExams(true); void loadClasses(); }} colors={[BRAND_COLORS.primaryBright]} />}
      >
        {pickState === 'error' ? (
          <StateBlock kind="error" title="Classes could not be loaded" message={pickError} onRetry={loadClasses} />
        ) : pickState === 'ready' && classes.length === 0 ? (
          <StateBlock kind="empty" icon="users" title="No classes available" message={user.role === 'TEACHER' ? 'No class is assigned to you yet.' : 'Add classes in Academic Structure first.'} />
        ) : (
          <View style={{ gap: SPACE.lg }}>
            {classes.length > 0 && (
              <ChoiceRow label="Class" value={classId} onChange={(v) => { setClassId(v); setSection('ALL'); }} options={classes.map((c) => ({ value: c.id, label: classLabel(c.name) || c.name }))} />
            )}
            {sections.length > 1 && (
              <ChoiceRow label="Section" value={section} onChange={setSection} options={[{ value: 'ALL', label: 'All sections' }, ...sections.map((s) => ({ value: s, label: `Section ${s}` }))]} />
            )}
            <ExamScheduleBody
              exams={exams}
              state={pickState === 'loading' && !exams ? 'loading' : state}
              error={error}
              onRetry={() => void loadExams()}
              classId={classId}
              section={section === 'ALL' ? undefined : section}
              classTitle={cls ? `${classLabel(cls.name)}${section !== 'ALL' ? ` - Section ${section}` : ''}` : undefined}
              today={kolkataDate()}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_COLORS.surfaceSoft },
  content: { padding: SPACE.lg, paddingBottom: SPACE.xl * 2 },
});
