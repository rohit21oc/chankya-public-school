import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Card } from '../../components/teacher-home/ListParts';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren, NoActiveChild } from '../ParentChildContext';
import { ParentHeader, Pill, Screen, Segmented, SkeletonList, SPACE, StateBlock, Tone } from '../ui';
import { classSectionLabel, formatDisplayDate, homeworkForChild, HomeworkDueStatus } from '../../utils/parentRules';

const STATUS_UI: Record<HomeworkDueStatus, { label: string; tone: Tone }> = {
  DUE_TODAY: { label: 'Due today', tone: 'warning' },
  UPCOMING: { label: 'Upcoming', tone: 'info' },
  PAST_DUE: { label: 'Due date passed', tone: 'neutral' },
  NO_DUE_DATE: { label: 'No due date', tone: 'neutral' },
};

/**
 * Homework for the active child's class. The school's homework records have no
 * submission field, so status is based on the due date only.
 */
export const ParentHomeworkScreen: React.FC<{ onBack: () => void; onOpenChildren: () => void }> = ({ onBack, onOpenChildren }) => {
  const { activeChild } = useParentChildren();
  const [filter, setFilter] = useState<'current' | 'all'>('current');

  const hw = useChildData(async (c) => {
    const r = await apiService.getAssignments(c.classId);
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  });

  const items = useMemo(() => (activeChild ? homeworkForChild((hw.data as any[]) || [], activeChild) : []), [hw.data, activeChild?.id]);
  const current = items.filter((h) => h.dueStatus !== 'PAST_DUE');
  const shown = filter === 'current' ? current : items;

  return (
    <Screen header={<ParentHeader title="Homework" onBack={onBack} child={activeChild} onPressChild={onOpenChildren} />} refreshing={hw.refreshing} onRefresh={hw.refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : hw.state === 'error' && !hw.data ? (
        <StateBlock kind="error" title="Homework could not be loaded" message={hw.error} onRetry={hw.reload} />
      ) : hw.state === 'loading' && !hw.data ? (
        <SkeletonList rows={3} height={96} />
      ) : (
        <>
          <Segmented
            options={[
              { value: 'current', label: `Current (${current.length})` },
              { value: 'all', label: `All (${items.length})` },
            ]}
            value={filter}
            onChange={(v) => setFilter(v as 'current' | 'all')}
          />
          {shown.length === 0 ? (
            <StateBlock
              kind="empty"
              icon="book-open"
              title={items.length === 0 ? 'No homework assigned' : 'No current homework'}
              message={items.length === 0 ? `No homework has been posted for ${classSectionLabel(activeChild.className, activeChild.section)}.` : 'All posted homework is past its due date. Choose "All" to see it.'}
            />
          ) : (
            <View style={{ gap: SPACE.md }}>
              {shown.map((h: any) => (
                <Card key={h.id} gap={SPACE.sm}>
                  <View style={styles.top}>
                    <T style={styles.subject} numberOfLines={1}>
                      {h.subjectName || 'Subject not recorded'}
                    </T>
                    <Pill label={STATUS_UI[h.dueStatus as HomeworkDueStatus].label} tone={STATUS_UI[h.dueStatus as HomeworkDueStatus].tone} />
                  </View>
                  <T style={styles.title}>{h.title || 'Untitled homework'}</T>
                  {!!h.instructions && <T style={styles.body}>{h.instructions}</T>}
                  <T style={styles.meta}>
                    {[h.dueDate ? `Due ${formatDisplayDate(h.dueDate)}` : '', h.assignedDate ? `Set ${formatDisplayDate(h.assignedDate)}` : '', h.teacherName].filter(Boolean).join(' · ')}
                  </T>
                </Card>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  subject: { flexShrink: 1, fontFamily: FONT.semibold, fontSize: 12, color: TH.royal },
  title: { fontFamily: FONT.semibold, fontSize: 16, lineHeight: 22, color: TH.ink },
  body: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
});
