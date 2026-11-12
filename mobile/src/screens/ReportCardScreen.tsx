import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, Exam, ExamMark, Student, ClassItem, SubjectItem } from '../types';
import { StudentPicker } from '../components/StudentPicker';
import { SchoolHeader } from '../components/SchoolHeader';
import { BRAND_COLORS, SCHOOL_INFO } from '../utils/branding';
import { apiService } from '../services/apiService';
import { loadScopedPickers } from '../utils/teacherScope';

interface ReportCardScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

import { buildMarksheet } from '../utils/reportCardRules';
import { NOT_CONFIGURED, affiliationLine, useSchoolIdentity } from '../services/schoolIdentity';

/** "Class 5-A" from the class name; a class id like "c-5" is never shown to people. */
function studentClassLabel(className?: string, classId?: string, section?: string): string {
  const raw = String(className || '').trim() || (/^c-\d+$/i.test(String(classId || '')) ? String(classId).slice(2) : '');
  if (!raw) return '';
  const name = /^(\d+|[ivx]+)$/i.test(raw) ? `Class ${raw}` : raw;
  return `${name}${section ? `-${section}` : ''}`;
}

export const ReportCardScreen: React.FC<ReportCardScreenProps> = ({
  user,
  onBack,
  onOpenMenu,
  onOpenProfile,
}) => {
  const sid = useSchoolIdentity();
  const isStudent = user.role === 'STUDENT';
  const isParent = user.role === 'PARENT';
  const isTeacher = user.role === 'TEACHER';
  const isAdmin = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR'].includes(user.role);

  // Available academic sessions
  const availableSessions = ['2026-2027', '2025-2026', '2024-2025'];
  const [selectedSession, setSelectedSession] = useState<string>(SCHOOL_INFO.currentSession);

  // Data states
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Record<string, string>>({});
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);

  // Parent child selection
  const linkedChildrenIds = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...(user.linkedStudentIds || []),
          user.activeStudentId,
          user.studentId,
        ].filter(Boolean) as string[]
      )
    );
  }, [user]);
  const [selectedChildId, setSelectedChildId] = useState<string>(
    user.activeStudentId || user.studentId || linkedChildrenIds[0] || ''
  );
  const [childrenList, setChildrenList] = useState<Student[]>([]);

  // Teacher / Admin class & student selection
  const [teacherClasses, setTeacherClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Initial Load: subjects map and role-specific prerequisites
  useEffect(() => {
    let isMounted = true;
    const initPrerequisites = async () => {
      try {
        const subRes = await apiService.getSubjects();
        if (isMounted && subRes.ok && Array.isArray(subRes.data)) {
          const map: Record<string, string> = {};
          subRes.data.forEach((s) => {
            map[s.id] = s.name;
          });
          setSubjectsMap(map);
          setAllSubjects(subRes.data);
        }

        // If parent: load student profiles for linked children
        if (isParent && linkedChildrenIds.length > 0) {
          const stuRes = await apiService.getStudents(100);
          if (isMounted && stuRes.ok && Array.isArray(stuRes.data)) {
            const matched = stuRes.data.filter((s) => linkedChildrenIds.includes(s.id) || linkedChildrenIds.includes(s.admissionNumber));
            setChildrenList(matched);
            if (!selectedChildId && matched.length > 0) {
              setSelectedChildId(matched[0].id);
            }
          }
        }

        // If teacher / admin: load authorized classes
        if (isTeacher || isAdmin) {
          const scoped = await loadScopedPickers(user, false);
          if (isMounted && scoped.ok && Array.isArray(scoped.classes)) {
            const availableCls = scoped.classes;
            setTeacherClasses(availableCls);
            if (availableCls.length > 0) {
              const firstCls = availableCls[0];
              setSelectedClassId(firstCls.id);
              const firstSec = Array.isArray(firstCls.sections) && firstCls.sections.length > 0
                ? (typeof firstCls.sections[0] === 'string' ? firstCls.sections[0] : (firstCls.sections[0] as any).name || 'A')
                : 'A';
              setSelectedSection(firstSec);
            }
          }
        }
      } catch (err) {
        console.warn('[ReportCardScreen] Init prerequisites warning:', err);
      }
    };

    initPrerequisites();
    return () => {
      isMounted = false;
    };
  }, [isParent, isTeacher, isAdmin, linkedChildrenIds]);

  // 2. Load Students for selected class & section (Teacher / Admin)
  useEffect(() => {
    if (!isTeacher && !isAdmin) return;
    if (!selectedClassId) return;

    let isMounted = true;
    const loadClassRoster = async () => {
      try {
        const res = await apiService.getStudents(100);
        if (isMounted && res.ok && Array.isArray(res.data)) {
          const matched = res.data.filter((s) => {
            const classMatch = s.classId === selectedClassId;
            const secMatch = !selectedSection || (s.section || 'A').toUpperCase() === selectedSection.toUpperCase();
            return classMatch && secMatch;
          });
          setClassStudents(matched);
          if (matched.length > 0) {
            setSelectedStudentId(matched[0].id);
          } else {
            setSelectedStudentId('');
          }
        }
      } catch (e) {
        console.warn('[ReportCardScreen] Error loading class roster:', e);
      }
    };

    loadClassRoster();
    return () => {
      isMounted = false;
    };
  }, [selectedClassId, selectedSection, isTeacher, isAdmin]);

  // 3. Load Examinations filtered by Academic Session
  const loadExaminations = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiService.getExams({ academicSession: selectedSession });
      if (res.ok && Array.isArray(res.data)) {
        // Filter strictly by selected academic session
        const sessionExams = res.data.filter(
          (e) => !e.academicSession || e.academicSession === selectedSession
        );
        setExams(sessionExams);
        if (sessionExams.length > 0) {
          // Preserve currently selected exam if it exists in new session, else pick first
          const stillValid = sessionExams.some((e) => e.id === selectedExamId);
          if (!stillValid) {
            setSelectedExamId(sessionExams[0].id);
          }
        } else {
          setSelectedExamId('');
          setMarks([]);
        }
      } else {
        setErrorMessage(res.error || 'Failed to retrieve examinations.');
        setExams([]);
        setSelectedExamId('');
        setMarks([]);
      }
    } catch {
      setErrorMessage('Could not connect to examination server.');
      setExams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSession, selectedExamId]);

  useEffect(() => {
    loadExaminations(false);
  }, [selectedSession]);

  // 4. Resolve Target Student ID for marksheet
  const activeStudentTargetId = useMemo(() => {
    if (isStudent) {
      return user.studentId || user.id || user.username;
    }
    if (isParent) {
      return selectedChildId || user.activeStudentId || user.studentId || linkedChildrenIds[0] || '';
    }
    if (isTeacher || isAdmin) {
      return selectedStudentId;
    }
    return '';
  }, [isStudent, isParent, isTeacher, isAdmin, user, selectedChildId, linkedChildrenIds, selectedStudentId]);

  // 5. Load Marksheet Data for selected examination & student
  const loadMarksheet = useCallback(async (isRefresh = false) => {
    if (!selectedExamId || !activeStudentTargetId) {
      setMarks([]);
      return;
    }

    if (!isRefresh) setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiService.getMarks({
        examId: selectedExamId,
        studentId: activeStudentTargetId,
        academicSession: selectedSession,
      });

      if (res.ok && Array.isArray(res.data)) {
        setMarks(res.data);
      } else {
        setMarks([]);
        if (res.error && res.status !== 404) {
          setErrorMessage(res.error);
        }
      }
    } catch {
      setErrorMessage('Failed to load marks statement. Please try again.');
      setMarks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedExamId, activeStudentTargetId, selectedSession]);

  useEffect(() => {
    loadMarksheet(false);
  }, [loadMarksheet]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadExaminations(true);
    loadMarksheet(true);
  };

  // Selected Exam Object
  const currentExam = useMemo(() => {
    return exams.find((e) => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Class of the student whose marksheet is on screen (drives which subjects must appear)
  const targetClassId = useMemo(() => {
    if (isStudent) return user.classId || '';
    if (isParent) {
      const child = childrenList.find((c) => c.id === activeStudentTargetId || c.admissionNumber === activeStudentTargetId);
      return child?.classId || '';
    }
    return classStudents.find((s) => s.id === activeStudentTargetId)?.classId || selectedClassId || '';
  }, [isStudent, isParent, user, childrenList, classStudents, activeStudentTargetId, selectedClassId]);

  // Computed Evaluation: every subject of the class (pending when no marks yet) + totals and result
  const evaluation = useMemo(() => {
    const classSubjects = allSubjects.filter(
      (sub) =>
        (sub.status || 'ACTIVE') !== 'INACTIVE' &&
        (!Array.isArray(sub.classIds) || sub.classIds.length === 0 || !targetClassId || sub.classIds.includes(targetClassId))
    );
    // Subjects that have marks but are missing from the class list (e.g. legacy rows) are still shown.
    const known = new Set(classSubjects.map((sub) => sub.id));
    const extra = marks
      .filter((m) => m.subjectId && !known.has(m.subjectId))
      .map((m) => ({ id: m.subjectId, name: (m as any).subjectName || subjectsMap[m.subjectId] || 'Subject' }));
    const subjectList = [
      ...classSubjects.map((sub) => ({ id: sub.id, name: sub.name, maxMarks: sub.maxMarks })),
      ...extra,
    ];
    const sheet = buildMarksheet(
      subjectList,
      marks.map((m) => ({
        subjectId: m.subjectId,
        maxMarks: m.maxMarks || currentExam?.maxMarks || undefined,
        marksObtained: m.marksObtained,
        isAbsent: Boolean(m.isAbsent),
        status: (m as any).status,
      })),
      currentExam?.maxMarks || 100
    );
    return {
      hasMarks: sheet.rows.length > 0 && sheet.totalMax > 0,
      totalObtained: sheet.totalObtained,
      totalMax: sheet.totalMax,
      percentage: sheet.percentage,
      overallGrade: sheet.grade,
      resultStatus: sheet.result,
      pendingCount: sheet.pendingCount,
      evalRows: sheet.rows.map((r) => ({
        id: r.subjectId,
        subjectName: r.subjectName,
        maxMarks: r.maxMarks,
        marksObtained: r.result === 'PENDING' ? '—' : r.isAbsent ? 'ABSENT' : r.obtained,
        isAbsent: r.isAbsent,
        grade: r.grade,
        status: r.result,
      })),
    };
  }, [marks, currentExam, subjectsMap, allSubjects, targetClassId]);

  // Target Student Display Name & Info
  const targetStudentInfo = useMemo(() => {
    if (isStudent) {
      return {
        name: user.name,
        admissionNo: user.username,
        classLabel: studentClassLabel((user as any).className, user.classId, user.section) || 'Enrolled Student',
      };
    }
    if (isParent) {
      const child = childrenList.find((c) => c.id === activeStudentTargetId || c.admissionNumber === activeStudentTargetId);
      return {
        name: child?.name || 'Child Profile',
        admissionNo: child?.admissionNumber || activeStudentTargetId,
        classLabel: studentClassLabel((child as any)?.className, child?.classId, child?.section) || 'Class Record',
      };
    }
    if (isTeacher || isAdmin) {
      const st = classStudents.find((s) => s.id === activeStudentTargetId);
      return {
        name: st?.name || 'Select Student',
        admissionNo: st?.admissionNumber || activeStudentTargetId,
        classLabel: studentClassLabel((st as any)?.className, st?.classId, st?.section) || 'Class Record',
      };
    }
    return { name: user.name, admissionNo: user.username, classLabel: '' };
  }, [isStudent, isParent, isTeacher, isAdmin, user, activeStudentTargetId, childrenList, classStudents]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        showBack
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        title="Report Card"
        subtitle={`Academic Session ${selectedSession}`}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[BRAND_COLORS.primaryBright]}
          />
        }
      >
        {/* 1. Academic Session Filter Selector */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionLabel}>ACADEMIC SESSION</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionChipsRow}>
            {availableSessions.map((session) => {
              const isSelected = selectedSession === session;
              return (
                <TouchableOpacity
                  key={session}
                  style={[styles.sessionChip, isSelected && styles.sessionChipActive]}
                  onPress={() => setSelectedSession(session)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sessionChipText, isSelected && styles.sessionChipTextActive]}>
                    Session {session}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. Parent Sibling Switcher (if Parent role) */}
        {isParent && linkedChildrenIds.length > 1 && (
          <View style={styles.childSwitcherCard}>
            <Text style={styles.filterSectionLabel}>SELECT CHILD</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childPillsRow}>
              {linkedChildrenIds.map((cid) => {
                const isSelected = cid === selectedChildId;
                const childObj = childrenList.find((c) => c.id === cid || c.admissionNumber === cid);
                const label = childObj?.name || `Child (${cid})`;
                return (
                  <TouchableOpacity
                    key={cid}
                    style={[styles.childPill, isSelected && styles.childPillActive]}
                    onPress={() => setSelectedChildId(cid)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.childPillText, isSelected && styles.childPillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 3. Teacher / Admin Class & Student Picker */}
        {(isTeacher || isAdmin) && teacherClasses.length > 0 && (
          <View style={styles.teacherSelectorCard}>
            <Text style={styles.filterSectionLabel}>ROSTER SELECTION</Text>

            {/* Class Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRowMargin}>
              {teacherClasses.map((cls) => {
                const isSelected = cls.id === selectedClassId;
                return (
                  <TouchableOpacity
                    key={cls.id}
                    style={[styles.smallChip, isSelected && styles.smallChipActive]}
                    onPress={() => setSelectedClassId(cls.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.smallChipText, isSelected && styles.smallChipTextActive]}>
                      {cls.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Searchable student dropdown */}
            {classStudents.length > 0 && (
              <View style={styles.chipRowMargin}>
                <StudentPicker students={classStudents} selectedId={selectedStudentId} onSelect={setSelectedStudentId} />
              </View>
            )}
          </View>
        )}

        {/* 4. Examination Selector */}
        {exams.length > 0 ? (
          <View style={styles.examSelectorCard}>
            <Text style={styles.filterSectionLabel}>SELECT EXAMINATION ({exams.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.examChipsRow}>
              {exams.map((exam) => {
                const isSelected = exam.id === selectedExamId;
                return (
                  <TouchableOpacity
                    key={exam.id}
                    style={[styles.examChip, isSelected && styles.examChipActive]}
                    onPress={() => setSelectedExamId(exam.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.examChipTitle, isSelected && styles.examChipTitleActive]}>
                      {exam.name || (exam as any).title || 'Examination'}
                    </Text>
                    <Text style={[styles.examChipSub, isSelected && styles.examChipSubActive]}>
                      Max: {exam.maxMarks || 100}M
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Examinations Found</Text>
            <Text style={styles.emptySubtitle}>
              No scheduled or completed examinations are recorded for session {selectedSession}.
            </Text>
          </View>
        )}

        {/* Error State */}
        {!loading && errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadExaminations(true)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={BRAND_COLORS.primaryRoyal} />
            <Text style={styles.loadingText}>Loading official student marksheet...</Text>
          </View>
        )}

        {/* 5. Marksheet Display */}
        {!loading && !errorMessage && currentExam && (
          <View style={styles.marksheetWrapper}>
            {/* Student Marksheet Header Banner */}
            <View style={styles.studentHeaderCard}>
              <View style={styles.studentInfoCol}>
                <Text style={styles.studentNameText}>{targetStudentInfo.name}</Text>
                <Text style={styles.studentMetaText}>
                  Adm No: {targetStudentInfo.admissionNo} • {targetStudentInfo.classLabel}
                </Text>
                <Text style={styles.examMetaText}>
                  Exam: {currentExam.name || (currentExam as any).title} ({selectedSession})
                </Text>
              </View>
              <View style={styles.badgeCol}>
                <View
                  style={[
                    styles.resultBadge,
                    evaluation.resultStatus === 'PASS'
                      ? styles.resultBadgePass
                      : evaluation.resultStatus === 'INCOMPLETE'
                      ? styles.resultBadgeCompartment
                      : styles.resultBadgeFail,
                  ]}
                >
                  <Text
                    style={[
                      styles.resultBadgeText,
                      evaluation.resultStatus === 'PASS'
                        ? styles.resultPassText
                        : evaluation.resultStatus === 'INCOMPLETE'
                        ? styles.resultCompartmentText
                        : styles.resultFailText,
                    ]}
                  >
                    {evaluation.resultStatus}
                  </Text>
                </View>
              </View>
            </View>

            {/* Aggregate Metric Summary Banner */}
            {evaluation.hasMarks && (
              <View style={styles.aggregateCard}>
                <View style={styles.aggregateMetricCol}>
                  <Text style={styles.aggregateMetricLabel}>Total Score</Text>
                  <Text style={styles.aggregateMetricValue}>
                    {evaluation.totalObtained} / {evaluation.totalMax}
                  </Text>
                </View>
                <View style={styles.aggregateDivider} />
                <View style={styles.aggregateMetricCol}>
                  <Text style={styles.aggregateMetricLabel}>Percentage</Text>
                  <Text style={[styles.aggregateMetricValue, { color: BRAND_COLORS.primaryRoyal }]}>
                    {evaluation.percentage}%
                  </Text>
                </View>
                <View style={styles.aggregateDivider} />
                <View style={styles.aggregateMetricCol}>
                  <Text style={styles.aggregateMetricLabel}>Overall Grade</Text>
                  <Text style={[styles.aggregateMetricValue, { color: BRAND_COLORS.accentGold }]}>
                    {evaluation.overallGrade}
                  </Text>
                </View>
              </View>
            )}

            {/* Subject-wise Marks Table Card */}
            {evaluation.hasMarks ? (
              <View style={styles.tableCard}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thText, styles.colSubject]}>SUBJECT</Text>
                  <Text style={[styles.thText, styles.colMax]}>MAX</Text>
                  <Text style={[styles.thText, styles.colObt]}>OBTAINED</Text>
                  <Text style={[styles.thText, styles.colGrade]}>GRADE</Text>
                  <Text style={[styles.thText, styles.colStatus]}>STATUS</Text>
                </View>

                {evaluation.evalRows.map((row, idx) => {
                  const isFail = row.status === 'FAIL' || row.isAbsent;
                  return (
                    <View key={row.id || idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                      <Text style={[styles.tdSubjectText, styles.colSubject]} numberOfLines={1}>
                        {row.subjectName}
                      </Text>
                      <Text style={[styles.tdText, styles.colMax]}>{row.maxMarks}</Text>
                      <Text
                        style={[
                          styles.tdObtText,
                          styles.colObt,
                          isFail ? styles.tdFailColor : styles.tdPassColor,
                        ]}
                      >
                        {row.marksObtained}
                      </Text>
                      <View style={[styles.colGrade, styles.gradeBadgeWrapper]}>
                        <View style={styles.gradePill}>
                          <Text style={styles.gradePillText}>{row.grade}</Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.tdStatusText,
                          styles.colStatus,
                          isFail ? styles.tdFailColor : styles.tdPassColor,
                        ]}
                      >
                        {row.status}
                      </Text>
                    </View>
                  );
                })}

                {/* Aggregate Summary Footer Row */}
                <View style={styles.tableFooterRow}>
                  <Text style={[styles.tfText, styles.colSubject]}>AGGREGATE TOTAL</Text>
                  <Text style={[styles.tfText, styles.colMax]}>{evaluation.totalMax}</Text>
                  <Text style={[styles.tfObtText, styles.colObt]}>{evaluation.totalObtained}</Text>
                  <Text style={[styles.tfGradeText, styles.colGrade]}>{evaluation.overallGrade}</Text>
                  <Text style={[styles.tfStatusText, styles.colStatus]}>{evaluation.resultStatus}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyTitle}>Marks Not Published Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Evaluation records for this examination have not been released or submitted yet.
                </Text>
              </View>
            )}

            {/* Official CBSE Institutional Verification Footer */}
            <View style={styles.institutionalNotice}>
              <Text style={styles.noticeHeading}>{sid.name}</Text>
              {!!affiliationLine(sid) && <Text style={styles.noticeSub}>{affiliationLine(sid)}</Text>}
              <Text style={styles.noticeBody}>
                This official digital marksheet is issued for academic session {selectedSession}. Grades are calculated on the school's 8-point grading scale.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sessionChipsRow: {
    gap: 8,
  },
  sessionChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  sessionChipActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  sessionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  sessionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  childSwitcherCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  childPillsRow: {
    gap: 8,
  },
  childPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  childPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: BRAND_COLORS.primaryRoyal,
  },
  childPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  childPillTextActive: {
    color: BRAND_COLORS.primaryRoyal,
    fontWeight: '700',
  },
  teacherSelectorCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipRowMargin: {
    marginTop: 6,
    marginBottom: 6,
  },
  smallChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smallChipActive: {
    backgroundColor: BRAND_COLORS.primaryRoyal,
    borderColor: BRAND_COLORS.primaryRoyal,
  },
  smallChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  studentChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  studentChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  studentChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  studentChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  examSelectorCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  examChipsRow: {
    gap: 8,
  },
  examChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    minWidth: 120,
  },
  examChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: BRAND_COLORS.primaryRoyal,
  },
  examChipTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  examChipTitleActive: {
    color: BRAND_COLORS.primaryRoyal,
    fontWeight: '700',
  },
  examChipSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  examChipSubActive: {
    color: BRAND_COLORS.primaryRoyal,
    fontWeight: '600',
  },
  centerBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  marksheetWrapper: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  studentHeaderCard: {
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  studentNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  studentMetaText: {
    fontSize: 12,
    color: '#93C5FD',
    marginBottom: 3,
  },
  examMetaText: {
    fontSize: 11,
    color: '#E2E8F0',
  },
  badgeCol: {
    alignItems: 'flex-end',
  },
  resultBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  resultBadgePass: {
    backgroundColor: '#ECFDF5',
  },
  resultBadgeCompartment: {
    backgroundColor: '#FFFBEB',
  },
  resultBadgeFail: {
    backgroundColor: '#FEF2F2',
  },
  resultBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resultPassText: {
    color: '#047857',
  },
  resultCompartmentText: {
    color: '#B45309',
  },
  resultFailText: {
    color: '#B91C1C',
  },
  aggregateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  aggregateMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  aggregateDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  aggregateMetricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  aggregateMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  thText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  colSubject: {
    flex: 2.2,
  },
  colMax: {
    flex: 1,
    textAlign: 'center',
  },
  colObt: {
    flex: 1.2,
    textAlign: 'center',
  },
  colGrade: {
    flex: 1,
    alignItems: 'center',
  },
  colStatus: {
    flex: 1.1,
    textAlign: 'right',
  },
  tdSubjectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  tdText: {
    fontSize: 12,
    color: '#475569',
  },
  tdObtText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tdPassColor: {
    color: '#047857',
  },
  tdFailColor: {
    color: '#DC2626',
  },
  gradeBadgeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradePill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gradePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
  },
  tdStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tableFooterRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 2,
    borderTopColor: '#CBD5E1',
    alignItems: 'center',
  },
  tfText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  tfObtText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
    textAlign: 'center',
  },
  tfGradeText: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND_COLORS.accentGold,
    textAlign: 'center',
  },
  tfStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    textAlign: 'right',
  },
  institutionalNotice: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  noticeHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0B1F4B',
    marginBottom: 2,
  },
  noticeSub: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 6,
  },
  noticeBody: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 14,
  },
});
