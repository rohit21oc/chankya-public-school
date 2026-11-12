import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl, Image } from 'react-native';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, Student, ClassItem, Exam, SubjectItem } from '../types';
import { TeacherAuthorizedAssignments } from '../types/teacher';
import { SchoolHeader } from '../components/SchoolHeader';
import { BRAND_COLORS, SCHOOL_INFO, resolveFileUrl } from '../utils/branding';
import { apiService } from '../services/apiService';
import { loadScopedPickers } from '../utils/teacherScope';
import {
  scopeSubjectsForClassAndSection,
  isTeacherAuthorizedForSubject,
} from '../utils/teacherScopeRules';
import { sanitizeMarksInput, validateMarksForSave, toggleAbsentRow } from '../utils/marksRules';
import { createSubmitGuard } from '../utils/submitGuard';
import {
  examsForSessionAndClass,
  findClass,
  gradeForMarks,
  marksSnapshot,
  resolvePaperConfig,
  rosterForSelection,
  sectionNames,
  subjectsForClass,
} from '../utils/marksEntryRules';

interface MarksEntryScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

interface StudentMarkInput {
  studentId: string;
  name: string;
  rollNumber?: string;
  admissionNumber?: string;
  marksObtained: string;
  isAbsent: boolean;
  photo?: string;
}

const DEFAULT_SESSIONS = ['2026-2027', '2025-2026', '2024-2025'];

export const MarksEntryScreen: React.FC<MarksEntryScreenProps> = ({
  user,
  onBack,
  onOpenMenu,
  onOpenProfile,
}) => {
  // 1. Academic Session Flow
  const [sessions, setSessions] = useState<string[]>(DEFAULT_SESSIONS);
  const [selectedSession, setSelectedSession] = useState<string>('2026-2027');

  // 2. Examination Flow
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // 3. Class & Section Flow
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('A');

  // 4. Subject Flow
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [assignments, setAssignments] = useState<TeacherAuthorizedAssignments | null>(null);

  // 5. Roster & Marks Data
  const [searchQuery, setSearchQuery] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [studentMarks, setStudentMarks] = useState<StudentMarkInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const submitGuard = useRef(createSubmitGuard()).current;
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize: load verified school settings for session, exams, and teacher scoped pickers
  useEffect(() => {
    let isMounted = true;

    const initData = async () => {
      setLoading(true);
      setFeedback(null);

      try {
        const [settingsRes, examsRes, pickers] = await Promise.all([
          apiService.getSchoolSettings(),
          apiService.getExams(),
          loadScopedPickers(user, true),
        ]);

        if (!isMounted) return;

        // Resolve current academic session from verified settings
        let currentSession = '2026-2027';
        if (settingsRes.ok && settingsRes.data) {
          const s = settingsRes.data.currentAcademicSession || settingsRes.data.academicSession;
          if (s) {
            currentSession = s;
            setSelectedSession(s);
            if (!DEFAULT_SESSIONS.includes(s)) {
              setSessions([s, ...DEFAULT_SESSIONS.filter((ds) => ds !== s)]);
            }
          }
        }

        // Store exams
        if (examsRes.ok && Array.isArray(examsRes.data)) {
          setAllExams(examsRes.data);
          const matching = examsRes.data.filter(
            (e) => !e.academicSession || e.academicSession === currentSession
          );
          if (matching.length > 0) {
            setSelectedExamId(matching[0].id);
          }
        }

        // Fail-closed verification for classes and subjects
        if (!pickers.ok) {
          setFeedback({
            type: 'error',
            message: pickers.error || 'Could not verify your assigned classes. Please try again.',
          });
          setClasses([]);
          setAllSubjects([]);
          setAssignments(null);
          setLoading(false);
          return;
        }

        setAssignments(pickers.assignments || null);
        const rawSubs = pickers.allSubjects || pickers.subjects || [];
        setAllSubjects(rawSubs);

        if (pickers.classes.length > 0) {
          setClasses(pickers.classes);
          const firstCls = pickers.classes[0];
          const initialClassId = firstCls.id || firstCls.name;
          setSelectedClassId(initialClassId);

          const rawSecs = Array.isArray(firstCls.sections) ? firstCls.sections : ['A'];
          const firstSec = typeof rawSecs[0] === 'string' ? rawSecs[0] : (rawSecs[0] as any)?.name || 'A';
          setSelectedSection(firstSec);

          // Exam and subject are picked by the effects below, from this class only.
        } else {
          setClasses([]);
          setSelectedClassId('');
          setSelectedSubjectId('');
        }
      } catch (err) {
        if (isMounted) {
          setFeedback({ type: 'error', message: 'Failed to initialize marks entry module.' });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initData();

    return () => {
      isMounted = false;
    };
  }, []);

  // ---- Derived selection (all filtering rules live in utils/marksEntryRules.ts) ----
  const selectedClass = useMemo(() => findClass(classes, selectedClassId), [classes, selectedClassId]);
  const resolvedClassId = selectedClass?.id || selectedClassId;

  // Exams of the selected session that apply to the selected class
  const filteredExams = useMemo(
    () => examsForSessionAndClass(allExams, selectedSession, resolvedClassId) as Exam[],
    [allExams, selectedSession, resolvedClassId]
  );

  const availableSections = useMemo(() => sectionNames(selectedClass), [selectedClass]);

  // Only subjects assigned to the selected class; teachers are narrowed further to their assignments.
  const availableSubjects = useMemo(() => {
    const ofClass = subjectsForClass(allSubjects, resolvedClassId, selectedClass?.name);
    if (!assignments) return ofClass;
    return scopeSubjectsForClassAndSection(ofClass, assignments, selectedClassId, selectedSection);
  }, [allSubjects, assignments, resolvedClassId, selectedClass, selectedClassId, selectedSection]);

  const selectedExam = useMemo(() => allExams.find((e) => e.id === selectedExamId), [allExams, selectedExamId]);
  const selectedSubject = useMemo(
    () => availableSubjects.find((s) => s.id === selectedSubjectId || s.name === selectedSubjectId),
    [availableSubjects, selectedSubjectId]
  );
  // Maximum / pass marks come from the examination configuration.
  const paperConfig = useMemo(
    () => resolvePaperConfig(selectedExam as any, selectedSubject, resolvedClassId, selectedSection),
    [selectedExam, selectedSubject, resolvedClassId, selectedSection]
  );
  const maxMarks = paperConfig.maxMarks;

  const visibleMarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return studentMarks;
    return studentMarks.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.rollNumber || '').toLowerCase() === q ||
        String(s.admissionNumber || '').toLowerCase().includes(q)
    );
  }, [studentMarks, searchQuery]);

  const isDirty = studentMarks.length > 0 && marksSnapshot(studentMarks) !== savedSnapshot;

  // Keep dependent selections valid: exam must belong to session+class, subject must belong to class.
  useEffect(() => {
    if (selectedExamId && !filteredExams.some((e) => e.id === selectedExamId)) {
      setSelectedExamId(filteredExams[0]?.id || '');
    } else if (!selectedExamId && filteredExams.length > 0) {
      setSelectedExamId(filteredExams[0].id);
    }
  }, [filteredExams]);

  useEffect(() => {
    if (!loading && selectedSubjectId && !selectedSubject) {
      setSelectedSubjectId(availableSubjects[0]?.id || '');
    } else if (!selectedSubjectId && availableSubjects.length > 0) {
      setSelectedSubjectId(availableSubjects[0].id || availableSubjects[0].name);
    }
  }, [availableSubjects, loading]);

  /** Runs `action` straight away, or after the user agrees to discard marks that are not saved yet. */
  const guardUnsaved = (action: () => void) => {
    if (!isDirty) {
      action();
      return;
    }
    Alert.alert('Unsaved marks', 'You have marks that are not saved. Changing the selection will discard them.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: action },
    ]);
  };

  const resetRoster = () => {
    setStudentMarks([]);
    setSavedSnapshot('');
    setSearchQuery('');
  };

  const handleSessionChange = (newSession: string) => {
    if (newSession === selectedSession) return;
    guardUnsaved(() => {
      setSelectedSession(newSession);
      setSelectedExamId(''); // re-picked from the new session's exams
      resetRoster();
    });
  };

  const handleExamChange = (newExamId: string) => {
    if (newExamId === selectedExamId) return;
    guardUnsaved(() => {
      setSelectedExamId(newExamId);
      resetRoster();
    });
  };

  const handleClassChange = (newClassId: string) => {
    if (newClassId === selectedClassId) return;
    guardUnsaved(() => {
      const cls = findClass(classes, newClassId);
      setSelectedClassId(newClassId);
      setSelectedSection(sectionNames(cls)[0] || 'A');
      // Subject and exam belong to the class: clear them, the effects above pick valid ones.
      setSelectedSubjectId('');
      setSelectedExamId('');
      resetRoster();
    });
  };

  const handleSectionChange = (newSection: string) => {
    if (newSection === selectedSection) return;
    guardUnsaved(() => {
      setSelectedSection(newSection);
      resetRoster();
    });
  };

  const handleSubjectChange = (newSubjectId: string) => {
    if (newSubjectId === selectedSubjectId) return;

    if (assignments && !isTeacherAuthorizedForSubject(assignments, selectedClassId, selectedSection, newSubjectId)) {
      Alert.alert(
        'Unauthorized Subject',
        'You are not authorized to enter marks for this subject in the selected class and section.'
      );
      return;
    }
    guardUnsaved(() => {
      setSelectedSubjectId(newSubjectId);
      resetRoster();
    });
  };

  const handleBack = () => guardUnsaved(onBack);

  // Load the roster (this class + section only) and the marks already saved for it
  const loadRosterAndMarks = async () => {
    if (!selectedClassId || !selectedExamId || !selectedSubjectId) {
      resetRoster();
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      // 1. Students of exactly this class and section, filtered by the server and re-checked here.
      const studentsRes = await apiService.getAllStudents({
        classId: resolvedClassId,
        section: selectedSection,
        status: 'ACTIVE',
      });
      if (!studentsRes.ok) {
        setFeedback({ type: 'error', message: studentsRes.error || 'Could not load the students of this class.' });
        resetRoster();
        return;
      }
      const enrolled: Student[] = rosterForSelection(studentsRes.data, {
        classId: resolvedClassId,
        className: selectedClass?.name,
        section: selectedSection,
        session: selectedSession,
      }).sort((a, b) => Number(a.rollNumber || 0) - Number(b.rollNumber || 0) || a.name.localeCompare(b.name));

      // 2. Marks already saved for this exam + subject
      const marksRes = await apiService.getMarks({
        examId: selectedExamId,
        classId: resolvedClassId,
        section: selectedSection,
        subjectId: selectedSubjectId,
      });
      const marksMap: Record<string, { marksObtained: number; isAbsent?: boolean }> = {};
      if (marksRes.ok && marksRes.data) {
        marksRes.data.forEach((m) => {
          marksMap[m.studentId] = { marksObtained: m.marksObtained, isAbsent: m.isAbsent };
        });
      }

      // 3. Clean input roster. A student with no saved mark stays blank (never turned into 0).
      const inputs: StudentMarkInput[] = enrolled.map((st) => {
        const existing = marksMap[st.id];
        return {
          studentId: st.id,
          name: st.name,
          rollNumber: st.rollNumber,
          admissionNumber: st.admissionNumber,
          photo: st.photo || st.photoFileKey,
          marksObtained: existing && !existing.isAbsent && existing.marksObtained !== undefined ? String(existing.marksObtained) : '',
          isAbsent: !!existing?.isAbsent,
        };
      });
      setStudentMarks(inputs);
      setSavedSnapshot(marksSnapshot(inputs));
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load examination marks roster.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedClassId && selectedExamId && selectedSubjectId) {
      loadRosterAndMarks();
    }
  }, [selectedClassId, selectedSection, selectedExamId, selectedSubjectId, selectedSession]);

  const handleRefresh = () => {
    guardUnsaved(() => {
      setRefreshing(true);
      loadRosterAndMarks();
    });
  };

  const handleMarkChange = (studentId: string, value: string) => {
    const current = studentMarks.find((s) => s.studentId === studentId)?.marksObtained ?? '';
    const result = sanitizeMarksInput(value, maxMarks, current);
    if (result.exceeded) {
      Alert.alert('Invalid Marks', `Marks cannot exceed Maximum Marks (${maxMarks}).`);
      return;
    }
    setStudentMarks((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, marksObtained: result.value, isAbsent: false } : s))
    );
  };

  const handleToggleAbsent = (studentId: string) => {
    setStudentMarks((prev) => prev.map((s) => (s.studentId === studentId ? toggleAbsentRow(s) : s)));
  };

  const calculateGrade = (obtainedStr: string, isAbsent: boolean): string => {
    if (isAbsent) return 'AB';
    const num = parseFloat(obtainedStr);
    if (isNaN(num)) return '-';
    return gradeForMarks(num, maxMarks).grade;
  };

  const handleSave = (status: 'DRAFT' | 'SUBMITTED') => {
    if (saving) return;

    // Check teacher authorization before saving
    if (assignments && !isTeacherAuthorizedForSubject(assignments, selectedClassId, selectedSection, selectedSubjectId)) {
      Alert.alert('Unauthorized Subject', 'You are not authorized to save marks for this subject.');
      return;
    }

    const checked = validateMarksForSave(
      studentMarks.map((s) => ({
        studentId: s.studentId,
        studentName: s.name,
        marksObtained: s.marksObtained,
        isAbsent: s.isAbsent,
      })),
      maxMarks
    );
    if (checked.errors.length > 0) {
      Alert.alert('Check the marks', checked.errors.slice(0, 5).join('\n'));
      return;
    }
    if (checked.valid.length === 0) {
      Alert.alert('No Marks Entered', 'Please enter marks for at least one student before saving.');
      return;
    }

    const pending = studentMarks.length - checked.valid.length;
    if (status === 'SUBMITTED') {
      Alert.alert(
        'Submit final marks?',
        `${selectedExam?.name || 'Exam'} • ${selectedClass?.name || ''} ${selectedSection} • ${selectedSubject?.name || ''}\n\n` +
          `${checked.valid.length} of ${studentMarks.length} students will be submitted.` +
          (pending > 0 ? `\n${pending} student(s) have no marks and will stay pending (not counted as zero).` : '') +
          '\n\nSubmitted marks go for review.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: () => void doSave(status, checked.valid) },
        ]
      );
      return;
    }
    void doSave(status, checked.valid);
  };

  const doSave = async (
    status: 'DRAFT' | 'SUBMITTED',
    valid: Array<{ studentId: string; marksObtained: number; isAbsent: boolean }>
  ) => {
    if (!submitGuard.tryEnter()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiService.saveMarks({
        marksList: valid.map((m) => ({ ...m, maxMarks, remarks: '' })),
        examId: selectedExamId,
        classId: resolvedClassId,
        section: selectedSection,
        subjectId: selectedSubject?.id || selectedSubjectId,
        academicSession: selectedSession,
        submissionStatus: status,
      });

      if (!res.ok || !res.success) {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to save marks. Please check your network and permissions.',
        });
      } else {
        setSavedSnapshot(marksSnapshot(studentMarks));
        setFeedback({
          type: 'success',
          message: `Marks ${status === 'DRAFT' ? 'saved as draft' : 'submitted successfully'} for ${res.count || valid.length} students.`,
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error saving examination marks.' });
    } finally {
      submitGuard.leave();
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        showBack
        onBack={handleBack}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        title="Marks Entry"
        subtitle={`Session ${selectedSession} • ${filteredExams.find((e) => e.id === selectedExamId)?.name || 'Select Exam'}`}
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
        {/* Selector Flow Card: Session → Examination → Class → Section → Subject */}
        <View style={styles.filterCard}>
          {/* 1. Academic Session Selector */}
          <Text style={styles.filterTitle}>1. ACADEMIC SESSION</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
            {sessions.map((sess) => {
              const isSelected = selectedSession === sess;
              return (
                <TouchableOpacity
                  key={sess}
                  style={[styles.pill, isSelected && styles.pillActive]}
                  onPress={() => handleSessionChange(sess)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                    {sess}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 2. Examination Selector */}
          <Text style={styles.filterTitle}>2. EXAMINATION ({selectedSession})</Text>
          {filteredExams.length === 0 ? (
            <Text style={styles.emptyPickerNotice}>
              No examinations found for academic session {selectedSession}.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
              {filteredExams.map((exam) => {
                const isSelected = selectedExamId === exam.id;
                return (
                  <TouchableOpacity
                    key={exam.id}
                    style={[styles.pill, isSelected && styles.pillActive]}
                    onPress={() => handleExamChange(exam.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                      {exam.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* 3. Class & Section Selectors */}
          <Text style={styles.filterTitle}>3. CLASS & SECTION</Text>
          {classes.length === 0 ? (
            <Text style={styles.emptyPickerNotice}>
              No authorized classes assigned to your profile.
            </Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                {classes.map((cls) => {
                  const isSelected = selectedClassId === cls.id || selectedClassId === cls.name;
                  return (
                    <TouchableOpacity
                      key={cls.id}
                      style={[styles.pill, isSelected && styles.pillActive]}
                      onPress={() => handleClassChange(cls.id || cls.name)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                        {cls.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.dropdownRow}>
                <View style={styles.dropdownCol}>
                  <Text style={styles.subLabel}>SECTION</Text>
                  <View style={styles.secRow}>
                    {availableSections.map((sec) => (
                      <TouchableOpacity
                        key={sec}
                        style={[styles.secBtn, selectedSection === sec && styles.secBtnActive]}
                        onPress={() => handleSectionChange(sec)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.secBtnText, selectedSection === sec && styles.secBtnTextActive]}>
                          {sec}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.dropdownCol, { flex: 1.5 }]}>
                  <Text style={styles.subLabel}>MAX MARKS</Text>
                  <View style={styles.maxMarksBox}>
                    <Text style={styles.maxMarksText}>{maxMarks} Marks</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* 4. Subject Selector */}
          <Text style={styles.filterTitle}>4. SUBJECT (AUTHORIZED ONLY)</Text>
          {availableSubjects.length === 0 ? (
            <Text style={styles.emptyPickerNotice}>
              No authorized subjects for class {classes.find((c) => c.id === selectedClassId)?.name || selectedClassId} section {selectedSection}.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
              {availableSubjects.map((sub) => {
                const isSelected = selectedSubjectId === sub.id || selectedSubjectId === sub.name;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={[styles.pill, isSelected && styles.pillActive]}
                    onPress={() => handleSubjectChange(sub.id || sub.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                      {sub.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Feedback Banner */}
        {feedback && (
          <View
            style={[
              styles.feedbackBox,
              feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                feedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText,
              ]}
            >
              {feedback.type === 'success' ? '✓ ' : '⚠ '}
              {feedback.message}
            </Text>
          </View>
        )}

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={BRAND_COLORS.primaryRoyal} />
            <Text style={styles.loadingText}>Loading marks roster...</Text>
          </View>
        )}

        {/* Selection summary */}
        {!loading && selectedExamId && selectedSubjectId && (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle} numberOfLines={2}>
              {selectedExam?.name} • {selectedClass?.name} - {selectedSection} • {selectedSubject?.name}
            </Text>
            <Text style={styles.summarySub}>
              {studentMarks.length} students • Max {maxMarks} • Pass {paperConfig.passMarks}
            </Text>
          </View>
        )}

        {/* Student Marks List */}
        {!loading && (
          <View style={styles.marksList}>
            <View style={styles.marksHeaderRow}>
              <Text style={styles.marksHeaderTitle}>Students ({visibleMarks.length}{visibleMarks.length !== studentMarks.length ? ` of ${studentMarks.length}` : ''})</Text>
              <Text style={styles.marksHeaderSub}>Marks / Grade</Text>
            </View>
            {studentMarks.length > 0 && (
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search name, roll or admission no."
                placeholderTextColor="#94A3B8"
                autoCorrect={false}
              />
            )}

            {studentMarks.length === 0 ? (
              <View style={styles.emptyRosterBox}>
                <Text style={styles.emptyRosterText}>
                  No enrolled students found for the selected examination, class and section.
                </Text>
              </View>
            ) : (
              visibleMarks.map((s, idx) => {
                const grade = calculateGrade(s.marksObtained, s.isAbsent);

                return (
                  <View key={s.studentId || idx} style={styles.markCard}>
                    {/* Left: Student Meta */}
                    {s.photo && resolveFileUrl(s.photo) ? (
                      <Image source={{ uri: resolveFileUrl(s.photo) }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarText}>{(s.name || '?').trim().charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.studentMetaCol}>
                      <Text style={styles.studentName} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={styles.studentSub}>
                        Roll: {s.rollNumber || String(idx + 1).padStart(2, '0')} • Adm: {s.admissionNumber}
                      </Text>
                    </View>

                    {/* Right: Input & Grade */}
                    <View style={styles.inputCol}>
                      <TouchableOpacity
                        style={[styles.absentToggle, s.isAbsent && styles.absentToggleActive]}
                        onPress={() => handleToggleAbsent(s.studentId)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.absentToggleText, s.isAbsent && styles.absentToggleTextActive]}>
                          ABS
                        </Text>
                      </TouchableOpacity>

                      <TextInput
                        style={[styles.marksInput, s.isAbsent && styles.marksInputDisabled]}
                        value={s.isAbsent ? 'AB' : s.marksObtained}
                        onChangeText={(val) => handleMarkChange(s.studentId, val)}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={5}
                        editable={!s.isAbsent && !saving}
                      />

                      <View style={[styles.gradePill, s.isAbsent && styles.gradePillAbsent]}>
                        <Text style={[styles.gradePillText, s.isAbsent && styles.gradePillTextAbsent]}>
                          {grade}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Action Buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.draftBtn, (saving || studentMarks.length === 0) && styles.btnDisabled]}
          onPress={() => handleSave('DRAFT')}
          disabled={saving || studentMarks.length === 0}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#0F172A" />
          ) : (
            <Text style={styles.draftBtnText}>Save Draft</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.submitBtn, (saving || studentMarks.length === 0) && styles.btnDisabled]}
          onPress={() => handleSave('SUBMITTED')}
          disabled={saving || studentMarks.length === 0}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Marks</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 90,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  filterTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 12,
  },
  emptyPickerNotice: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillActive: {
    backgroundColor: BRAND_COLORS.primaryBright,
    borderColor: BRAND_COLORS.primaryBright,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  dropdownCol: {
    flex: 1,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  secRow: {
    flexDirection: 'row',
    gap: 6,
  },
  secBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  secBtnActive: {
    backgroundColor: BRAND_COLORS.primaryBright,
    borderColor: BRAND_COLORS.primaryBright,
  },
  secBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  secBtnTextActive: {
    color: '#FFFFFF',
  },
  summaryBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  summaryTitle: { fontSize: 13, fontWeight: '800', color: BRAND_COLORS.primary },
  summarySub: { fontSize: 12, color: '#475569', marginTop: 2 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 8,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, marginRight: 10, backgroundColor: '#E2E8F0' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND_COLORS.primaryRoyal },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  maxMarksBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  maxMarksText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_COLORS.primaryBright,
  },
  feedbackBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
  },
  feedbackSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  feedbackError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackSuccessText: {
    color: '#166534',
  },
  feedbackErrorText: {
    color: '#991B1B',
  },
  centerBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  marksList: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  marksHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  marksHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  marksHeaderSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyRosterBox: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyRosterText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  markCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  studentMetaCol: {
    flex: 1,
    marginRight: 10,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  inputCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  absentToggle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  absentToggleActive: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  absentToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  absentToggleTextActive: {
    color: '#FFFFFF',
  },
  marksInput: {
    width: 58,
    height: 38,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  marksInputDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    color: '#94A3B8',
  },
  gradePill: {
    width: 36,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradePillAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  gradePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_COLORS.primaryBright,
  },
  gradePillTextAbsent: {
    color: '#EF4444',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  draftBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  submitBtn: {
    backgroundColor: BRAND_COLORS.primaryBright,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
