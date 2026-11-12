import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SectionCard } from '../ui/SectionCard';
import { BRAND_COLORS } from '../../utils/branding';
import { apiService } from '../../services/apiService';
import { TeacherTeachingAssignmentDetail } from '../../types/teacher';

/**
 * "Currently assigned" comes from the server's authorization rules (the same ones used
 * by My Students, attendance, timetable and marks entry): active classes, sections and
 * subjects only. "Qualified to teach" is what the staff record says the teacher can
 * teach; it does not give access to any class.
 */
export const TeachingAssignmentsCard: React.FC = () => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [rows, setRows] = useState<TeacherTeachingAssignmentDetail[]>([]);
  const [qualified, setQualified] = useState<{ subjects: string[]; classes: string[] }>({ subjects: [], classes: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      const a = await apiService.getTeacherAuthorizedAssignments({ force: true });
      if (!alive) return;
      if (!a.ok || !a.data) {
        setState('error');
        return;
      }
      const list = (a.data.detailedAssignments || []).slice().sort((x, y) => `${x.className}${x.section}`.localeCompare(`${y.className}${y.section}`, 'en', { numeric: true }));
      setRows(list);
      setState('ready');
      if (a.data.teacherId) {
        const st = await apiService.getStaffById(a.data.teacherId);
        if (!alive || !st.ok || !st.data) return;
        const d: any = st.data;
        const subj = (Array.isArray(d.subjectExpertise) && d.subjectExpertise.length ? d.subjectExpertise : Array.isArray(d.specializationSubjects) ? d.specializationSubjects : []).map(String);
        const cls = Array.isArray(d.qualifiedClasses) && d.qualifiedClasses.length ? d.qualifiedClasses.map(String) : String(d.classesQualifiedToTeach || '').split(',').map((x) => x.trim()).filter(Boolean);
        setQualified({ subjects: subj, classes: cls });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <SectionCard title="Currently assigned" subtitle="Classes and subjects you can open in attendance, marks and My Students">
        {state === 'loading' && <ActivityIndicator color={BRAND_COLORS.primaryRoyal} />}
        {state === 'error' && <Text style={s.muted}>Assignments could not be loaded. Pull down to retry.</Text>}
        {state === 'ready' && rows.length === 0 && <Text style={s.muted}>No class is assigned to you yet. Ask the academic office.</Text>}
        {rows.map((r) => (
          <View key={`${r.classId}-${r.section}`} style={s.row}>
            <View style={s.classPill}>
              <Text style={s.classText}>{r.className} – {r.section}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.subjects} numberOfLines={2}>{r.subjects.length ? r.subjects.map((x) => x.name).join(', ') : 'No subject assigned'}</Text>
              {r.isClassTeacher && <Text style={s.ct}>Class teacher</Text>}
            </View>
          </View>
        ))}
      </SectionCard>
      {(qualified.subjects.length > 0 || qualified.classes.length > 0) && (
        <SectionCard title="Qualified to teach" subtitle="From your staff record. This does not give access to a class.">
          {qualified.subjects.length > 0 && <Text style={s.line}><Text style={s.label}>Subjects: </Text>{qualified.subjects.join(', ')}</Text>}
          {qualified.classes.length > 0 && <Text style={s.line}><Text style={s.label}>Classes: </Text>{qualified.classes.join(', ')}</Text>}
        </SectionCard>
      )}
    </>
  );
};

const s = StyleSheet.create({
  muted: { fontSize: 13, color: BRAND_COLORS.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BRAND_COLORS.borderColor },
  classPill: { backgroundColor: BRAND_COLORS.infoLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, minWidth: 84, alignItems: 'center' },
  classText: { fontSize: 13, fontWeight: '800', color: BRAND_COLORS.primaryRoyal },
  subjects: { fontSize: 13, color: BRAND_COLORS.textPrimary },
  ct: { fontSize: 11, fontWeight: '700', color: BRAND_COLORS.success, marginTop: 2 },
  line: { fontSize: 13, color: BRAND_COLORS.textPrimary, marginBottom: 4 },
  label: { fontWeight: '700', color: BRAND_COLORS.textSecondary },
});
