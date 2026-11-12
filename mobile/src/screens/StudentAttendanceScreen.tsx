import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, Student, ClassItem, AttendanceRecord } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { BRAND_COLORS } from '../utils/branding';
import { apiService, AttendanceScanResult } from '../services/apiService';
import { ScanAttendanceModal } from '../components/ScanAttendanceModal';
import { loadScopedPickers } from '../utils/teacherScope';
import { classSectionNames } from '../utils/classSections';
import { createSubmitGuard } from '../utils/submitGuard';
import { istTime } from '../utils/attendanceCalendarModel';
import {
  AttendanceMap,
  AttendanceStatus,
  buildInitialAttendance,
  buildAttendanceSubmission,
  countAttendance,
} from '../utils/attendanceRules';

interface StudentAttendanceScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

export const StudentAttendanceScreen: React.FC<StudentAttendanceScreenProps> = ({
  user,
  onBack,
  onOpenMenu,
  onOpenProfile,
}) => {
  const isStudentOrParent = user.role === 'STUDENT' || user.role === 'PARENT';
  const isTeacher = user.role === 'TEACHER';

  // Date state (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Class & Section state
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('A');

  // Students and attendance states
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [scanOpen, setScanOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  // When each Present / Late student was marked (scan or manual), from the saved records.
  const [inTimes, setInTimes] = useState<Record<string, string>>({});
  const timesFrom = (list: any[]) => {
    const m: Record<string, string> = {};
    for (const r of list || []) {
      if (r?.studentId && (r.status === 'PRESENT' || r.status === 'LATE')) {
        const t = r.checkInTime || istTime(r.markedAt);
        if (t) m[r.studentId] = t;
      }
    }
    return m;
  };
  const [savedLoadFailed, setSavedLoadFailed] = useState(false);
  const loadSeq = useRef(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const submitGuard = useRef(createSubmitGuard()).current;
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Load active classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await loadScopedPickers(user, false, true);
        if (!res.ok) {
          setFeedback({ type: 'error', message: res.error || 'Could not load your classes. Please try again.' });
        }
        if (res.ok && res.classes.length === 0 && user.role === 'TEACHER') {
          setFeedback({ type: 'error', message: 'You are not assigned as Class Incharge of any class, so attendance cannot be marked. Please contact the administrator.' });
        }
        if (res.ok && res.classes.length > 0) {
          setClasses(res.classes);
          // Set initial class
          const firstClass = res.classes[0];
          setSelectedClassId(firstClass.id || firstClass.name);
          setSelectedSection(classSectionNames(firstClass)[0] || 'A');
        }
      } catch (err) {
        console.warn('[Attendance] Error fetching classes:', err);
      }
    };

    fetchClasses();
  }, []);

  // Sections of the chosen class, straight from Academics (no fixed A/B/C): all of them for the office, the
  // incharge sections for a teacher.
  const currentSections = useMemo(() => {
    const cls = classes.find((c) => c.id === selectedClassId || c.name === selectedClassId);
    const list = classSectionNames(cls);
    return list.length ? list : ['A'];
  }, [classes, selectedClassId]);
  useEffect(() => {
    if (!currentSections.includes(String(selectedSection).toUpperCase())) setSelectedSection(currentSections[0]);
  }, [currentSections, selectedSection]);

  // 2. Load students & existing attendance for selected class, section & date
  const loadClassAttendance = async () => {
    if (!selectedClassId) return;

    // Ignore responses of older loads and never show the previous selection's marks.
    const seq = ++loadSeq.current;
    setLoading(true);
    setFeedback(null);
    setAttendanceMap({});
    setSavedIds([]);
    setSavedLoadFailed(false);

    try {
      // Fetch students in this class/section
      const studentsRes = await apiService.getStudents(100);
      let enrolled: Student[] = [];

      if (studentsRes.ok && studentsRes.data) {
        enrolled = studentsRes.data.filter((s) => {
          const matchClass = s.classId === selectedClassId || s.className === selectedClassId;
          const matchSec = !selectedSection || (s.section || 'A').toUpperCase() === selectedSection.toUpperCase();
          return matchClass && matchSec;
        });

      }

      // Fetch existing attendance records
      const attRes = await apiService.getAttendance({
        classId: selectedClassId,
        section: selectedSection,
        date: selectedDate,
      });
      if (seq !== loadSeq.current) return;

      setStudents(enrolled);
      if (!attRes.ok) {
        // Saved records unknown: block submit so they cannot be overwritten blindly.
        setSavedLoadFailed(true);
        setFeedback({ type: 'error', message: 'Could not load saved attendance for this date. Pull down to retry.' });
      } else {
        const seeded = buildInitialAttendance(enrolled, attRes.data || []);
        setAttendanceMap(seeded.map);
        setSavedIds(seeded.savedIds);
        setInTimes(timesFrom(attRes.data || []));
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error loading student attendance.' });
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      loadClassAttendance();
    }
  }, [selectedClassId, selectedSection, selectedDate]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadClassAttendance();
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  // A scan was saved on the server: show it in the open register, keeping other unsaved choices.
  const handleScanMarked = (r: AttendanceScanResult) => {
    const id = r.person?.id;
    if (!id || r.kind !== 'STUDENT' || r.date !== selectedDate || !students.some((s) => s.id === id)) return;
    setAttendanceMap((prev) => ({ ...prev, [id]: (r.markedStatus as any) || 'PRESENT' }));
  };

  const handleMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    const updated: AttendanceMap = {};
    students.forEach((s) => {
      updated[s.id] = status;
    });
    setAttendanceMap(updated);
  };

  const handleSaveAttendance = async () => {
    if (students.length === 0) {
      Alert.alert('No Students', 'No students enrolled in this class to record attendance for.');
      return;
    }
    if (savedLoadFailed) {
      setFeedback({ type: 'error', message: 'Saved attendance could not be loaded. Pull down to retry before saving.' });
      return;
    }
    const built = buildAttendanceSubmission<Student>(students, attendanceMap);
    if (!built.ok) {
      setFeedback({
        type: 'error',
        message: `${built.unmarkedCount} student${built.unmarkedCount === 1 ? ' is' : 's are'} not marked yet. Select Present or Absent for everyone.`,
      });
      return;
    }
    if (!submitGuard.tryEnter()) return;

    setSaving(true);
    setFeedback(null);

    const records = built.records.map(({ student: s, status }) => ({
      studentId: s.id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      admissionNumber: s.admissionNumber,
      status,
      remarks: '',
    }));

    try {
      const res = await apiService.saveAttendance({
        records,
        date: selectedDate,
        classId: selectedClassId,
        section: selectedSection,
      });

      if (!res.ok || !res.success) {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to record attendance. Please check permissions.',
        });
      } else {
        setSavedIds(records.map((r) => r.studentId));
        void apiService.getAttendance({ classId: selectedClassId, section: selectedSection, date: selectedDate }).then((a) => {
          if (a.ok) setInTimes(timesFrom(a.data || []));
        });
        setFeedback({
          type: 'success',
          message: `Attendance saved successfully for ${records.length} students on ${selectedDate}.`,
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Could not submit attendance to server.' });
    } finally {
      submitGuard.leave();
      setSaving(false);
    }
  };

  // Metrics for current sheet
  const counts = countAttendance(students, attendanceMap);
  const presentCount = counts.present;
  const absentCount = counts.absent;
  const lateCount = counts.late;
  const leaveCount = counts.leave;
  const canSubmit = !saving && !savedLoadFailed && counts.unmarked === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        showBack
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        title={isStudentOrParent ? 'Attendance Record' : 'Student Attendance'}
        subtitle={`Register for ${selectedDate}`}
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
        {/* Class & Date Controls */}
        <View style={styles.filterSection}>
          {/* Class Selector Bar */}
          <Text style={styles.filterLabel}>SELECT CLASS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
            {classes.map((cls) => {
              const isSelected = selectedClassId === cls.id || selectedClassId === cls.name;
              return (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  onPress={() => setSelectedClassId(cls.id || cls.name)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                    {cls.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Section & Date Row */}
          <View style={styles.metaControlRow}>
            <View style={styles.sectionSelector}>
              <Text style={styles.metaControlLabel}>SECTION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionButtonsRow}>
                {currentSections.map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    style={[styles.secBtn, selectedSection === sec && styles.secBtnActive]}
                    onPress={() => setSelectedSection(sec)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.secBtnText, selectedSection === sec && styles.secBtnTextActive]}>
                      {sec}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.dateSelector}>
              <Text style={styles.metaControlLabel}>DATE</Text>
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>📅 {selectedDate}</Text>
              </View>
            </View>
          </View>
        </View>

        {!isStudentOrParent && (
          <>
            <TouchableOpacity style={styles.scanBtn} onPress={() => setScanOpen(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Scan student ID card">
              <Text style={styles.scanBtnText}>Scan ID card</Text>
            </TouchableOpacity>
            <Text style={styles.scanHint}>Scanning marks today's attendance straight away. You can mark the rest below.</Text>
          </>
        )}

        {/* Attendance Summary Banner */}
        {!isStudentOrParent && students.length > 0 && (
          <Text style={{ paddingHorizontal: 16, paddingTop: 10, fontSize: 12, fontWeight: '700', color: counts.unmarked > 0 ? '#B54708' : '#16803C' }}>
            Marked {counts.marked} of {counts.total}
            {counts.unmarked > 0 ? ` • ${counts.unmarked} not marked` : ' • All students marked'}
          </Text>
        )}
        <View style={styles.metricsBar}>
          <View style={[styles.metricBox, { backgroundColor: '#ECFDF3' }]}>
            <Text style={[styles.metricNum, { color: '#16803C' }]}>{presentCount}</Text>
            <Text style={[styles.metricLbl, { color: '#16803C' }]}>Present</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.metricNum, { color: '#D92D20' }]}>{absentCount}</Text>
            <Text style={[styles.metricLbl, { color: '#D92D20' }]}>Absent</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: '#FFFAEB' }]}>
            <Text style={[styles.metricNum, { color: '#B54708' }]}>{lateCount}</Text>
            <Text style={[styles.metricLbl, { color: '#B54708' }]}>Late</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.metricNum, { color: '#175CD3' }]}>{leaveCount}</Text>
            <Text style={[styles.metricLbl, { color: '#175CD3' }]}>Leave</Text>
          </View>
        </View>

        {/* Quick Batch Actions */}
        {!isStudentOrParent && (
          <View style={styles.batchActionsRow}>
            <TouchableOpacity
              style={styles.batchBtn}
              onPress={() => handleMarkAll('PRESENT')}
              activeOpacity={0.7}
            >
              <Text style={styles.batchBtnText}>✓ Mark All Present</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Feedback Banner */}
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
            <Text style={styles.loadingText}>Loading enrolled class roster...</Text>
          </View>
        )}

        {/* Students Attendance List */}
        {!loading && (
          <View style={styles.listContainer}>
            <Text style={styles.listHeaderTitle}>
              Enrolled Students ({students.length})
            </Text>

            {students.map((student, idx) => {
              const currentStatus = attendanceMap[student.id];
              const isSaved = savedIds.includes(student.id);

              return (
                <View key={student.id || idx} style={styles.studentCard}>
                  {/* Left: Roll & Info */}
                  <View style={styles.studentInfoCol}>
                    <View style={styles.rollBadge}>
                      <Text style={styles.rollText}>{student.rollNumber || String(idx + 1).padStart(2, '0')}</Text>
                    </View>
                    <View style={styles.studentDetails}>
                      <Text style={styles.studentName} numberOfLines={1}>
                        {student.name}
                      </Text>
                      <Text style={styles.studentMeta}>
                        Adm: {student.admissionNumber} • Roll: {student.rollNumber || 'N/A'}
                      </Text>
                      {!isStudentOrParent && (
                        <Text style={{ fontSize: 11, fontWeight: '700', marginTop: 2, color: !currentStatus ? '#B54708' : '#64748B' }}>
                          {!currentStatus ? 'Not marked' : isSaved ? `Saved${inTimes[student.id] && (currentStatus === 'PRESENT' || currentStatus === 'LATE') ? ` • In ${inTimes[student.id]}` : ''}` : 'Not saved yet'}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Right: Status Toggle Buttons */}
                  <View style={styles.statusGroup}>
                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        currentStatus === 'PRESENT' && styles.statusBtnPresentActive,
                      ]}
                      onPress={() => handleStatusChange(student.id, 'PRESENT')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          currentStatus === 'PRESENT' && styles.statusBtnTextActive,
                        ]}
                      >
                        P
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        currentStatus === 'ABSENT' && styles.statusBtnAbsentActive,
                      ]}
                      onPress={() => handleStatusChange(student.id, 'ABSENT')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          currentStatus === 'ABSENT' && styles.statusBtnTextActive,
                        ]}
                      >
                        A
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        currentStatus === 'LATE' && styles.statusBtnLateActive,
                      ]}
                      onPress={() => handleStatusChange(student.id, 'LATE')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          currentStatus === 'LATE' && styles.statusBtnTextActive,
                        ]}
                      >
                        L
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        currentStatus === 'LEAVE' && styles.statusBtnLeaveActive,
                      ]}
                      onPress={() => handleStatusChange(student.id, 'LEAVE')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          currentStatus === 'LEAVE' && styles.statusBtnTextActive,
                        ]}
                      >
                        LV
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {students.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No Students Found</Text>
                <Text style={styles.emptySubtitle}>
                  No students are enrolled in Class {selectedClassId} (Sec {selectedSection}).
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Submit Attendance Button */}
        {!isStudentOrParent && students.length > 0 && (
          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSaveAttendance}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>💾 Save & Sync Attendance</Text>
              )}
            </TouchableOpacity>
            {counts.unmarked > 0 && (
              <Text style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#B54708', fontWeight: '600' }}>
                Mark all {counts.total} students to save ({counts.unmarked} remaining).
              </Text>
            )}
          </View>
        )}
      </ScrollView>
      <ScanAttendanceModal visible={scanOpen} kind="STUDENT" onClose={() => setScanOpen(false)} onMarked={handleScanMarked} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  scanBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B2CCFF',
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  scanBtnText: { fontSize: 15, fontWeight: '700', color: '#123B8C' },
  scanHint: { marginHorizontal: 16, marginTop: 6, fontSize: 12, color: '#64748B' },
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 14,
  },
  filterPillsRow: {
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 10,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  metaControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  metaControlLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionSelector: {
    flex: 1,
  },
  sectionButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  secBtn: {
    minWidth: 32,
    paddingHorizontal: 8,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secBtnActive: {
    backgroundColor: BRAND_COLORS.primaryRoyal,
    borderColor: BRAND_COLORS.primaryRoyal,
  },
  secBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  secBtnTextActive: {
    color: '#FFFFFF',
  },
  dateSelector: {
    alignItems: 'flex-end',
  },
  dateBadge: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  metricNum: {
    fontSize: 15,
    fontWeight: '800',
  },
  metricLbl: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  batchActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  batchBtn: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: '#ECFDF3',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A6F4C5',
    alignItems: 'center',
  },
  batchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16803C',
  },
  feedbackBox: {
    marginHorizontal: 14,
    marginVertical: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: '#ECFDF3',
    borderColor: '#A6F4C5',
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECDD3',
  },
  feedbackText: {
    fontSize: 11,
    fontWeight: '600',
  },
  feedbackSuccessText: {
    color: '#16803C',
  },
  feedbackErrorText: {
    color: '#D92D20',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748B',
  },
  listContainer: {
    paddingHorizontal: 14,
    marginTop: 10,
  },
  listHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  studentInfoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  rollBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  rollText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentMeta: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  statusGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  statusBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  statusBtnPresentActive: {
    backgroundColor: '#16803C',
    borderColor: '#16803C',
  },
  statusBtnAbsentActive: {
    backgroundColor: '#D92D20',
    borderColor: '#D92D20',
  },
  statusBtnLateActive: {
    backgroundColor: '#B54708',
    borderColor: '#B54708',
  },
  statusBtnLeaveActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusBtnTextActive: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  submitContainer: {
    paddingHorizontal: 14,
    marginTop: 12,
  },
  submitButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
