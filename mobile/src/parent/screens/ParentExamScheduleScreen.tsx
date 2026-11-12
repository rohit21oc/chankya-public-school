import React from 'react';
import { apiService } from '../../services/apiService';
import { ExamScheduleBody } from '../../components/exam/ExamScheduleBody';
import { useChildData, useParentChildren, NoActiveChild } from '../ParentChildContext';
import { ParentHeader, Screen } from '../ui';
import { classSectionLabel, kolkataDate } from '../../utils/parentRules';

/** Exam schedule for the active child (parent portal) or the signed-in student (student portal). */
export const ParentExamScheduleScreen: React.FC<{ onBack?: () => void; onOpenChildren?: () => void; session?: string; title?: string }> = ({ onBack, onOpenChildren, session, title = 'Exam Schedule' }) => {
  const { activeChild } = useParentChildren();
  const exams = useChildData(async (c) => {
    const r = await apiService.getExams({ classId: c.classId });
    return { ok: r.ok, status: r.status, error: r.error, data: r.data as any[] };
  });

  return (
    <Screen header={<ParentHeader title={title} onBack={onBack} child={activeChild} onPressChild={onOpenChildren} />} refreshing={exams.refreshing} onRefresh={exams.refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : (
        <ExamScheduleBody
          exams={exams.data as any}
          state={exams.state}
          error={exams.error}
          onRetry={exams.reload}
          classId={activeChild.classId}
          section={activeChild.section}
          classTitle={classSectionLabel(activeChild.className, activeChild.section)}
          session={session || activeChild.academicSession}
          today={kolkataDate()}
        />
      )}
    </Screen>
  );
};
