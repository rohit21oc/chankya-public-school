import React, { useState, useMemo, useEffect } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit2,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Lock,
  Plus,
  PlusCircle,
  Printer,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  User,
  Users,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  AcademicClass,
  Exam,
  ExamMark,
  ExamScheduleItem,
  SchoolSettings,
  Student,
  Subject,
  UserRole,
} from '../../types';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { PrintableReportCardModal } from '../modals/PrintableReportCardModal';
import { dedupeMarks, marksForSubmission } from '../../utils/marksSubmission';
import { PrintableAdmitCardModal } from '../modals/PrintableAdmitCardModal';
import { papersForStudent, sortExamSchedule, formatExamDate } from '../../utils/examSchedule';
import { ExamCreateEditModal } from '../modals/ExamCreateEditModal';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { calculateEvaluation } from '../../utils/grading';
import { fileUploadService } from '../../services/fileUploadService';
import { getSchoolLogoSrc } from '../../constants/schoolLogo';
import {
  generateResultSheetHtml,
  downloadResultSheet,
} from '../../utils/resultSheetGenerator';
import { exportReportCardToPdf, exportBulkReportCardsToPdf } from '../../utils/reportCardPdfExporter';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity as savedSchoolIdentity } from '../../utils/schoolIdentity';

interface ExamsViewProps {
  userRole: UserRole;
  settings: SchoolSettings;
}

export const ExamsView: React.FC<ExamsViewProps> = ({ userRole, settings }) => {
  const [realtimeRevision, setRealtimeRevision] = useState(0);

  // Live real-time sync for exams, marks, students, and notices
  useRealtimeListener(['EXAM', 'EXAM_MARK', 'STUDENT', 'SESSION', 'NOTICE'], () => {
    setRealtimeRevision((prev) => prev + 1);
  });

  // Load exams, marks, classes and subjects from the server when the module opens; the cached copy alone can be
  // empty on a fresh sign-in or direct link, which showed "No examination schedules" although exams exist.
  useEffect(() => {
    let alive = true;
    Promise.allSettled([api.syncExams(), api.syncClasses(), api.syncSubjects()]).then(() => {
      if (alive) setRealtimeRevision((prev) => prev + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  const currentUser = authService.getCurrentUser();
  const isStudent = userRole === 'STUDENT';
  const isParent = userRole === 'PARENT';
  const isStaff = !isStudent && !isParent;

  // Authorized admin roles for managing exams, schedules, and publishing
  const authorizedAdminRoles: UserRole[] = [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'ACADEMIC_COORDINATOR',
    'VICE_PRINCIPAL',
  ];
  const canManageExams = authorizedAdminRoles.includes(userRole);

  // Cached data
  const rawExams = useMemo(() => api.getExams(), [realtimeRevision]);
  const allClasses = useMemo(() => api.getClasses(), [realtimeRevision]);
  const allSubjects = useMemo(() => api.getSubjects(), [realtimeRevision]);
  const allStudents = useMemo(() => api.getStudents(), [realtimeRevision]);
  const allNotices = useMemo(() => api.getNotices(), [realtimeRevision]);

  // ONLY ACTIVE classes and subjects
  const activeClasses = useMemo(
    () => allClasses.filter((c) => (c.status || 'ACTIVE') === 'ACTIVE'),
    [allClasses]
  );
  const activeSubjects = useMemo(
    () => allSubjects.filter((s) => (s.status || 'ACTIVE') === 'ACTIVE'),
    [allSubjects]
  );

  // Navigation tab for Staff
  const [activeTab, setActiveTab] = useState<'SCHEDULES' | 'MARKS' | 'ADMIT_CARDS' | 'RESULTS'>('SCHEDULES');

  // Shared state selectors
  const [selectedSession, setSelectedSession] = useState<string>(
    settings.currentAcademicSession || '2026-2027'
  );
  const [selectedExamId, setSelectedExamId] = useState<string>(() => rawExams[0]?.id || '');
  const [selectedClassId, setSelectedClassId] = useState<string>(() => activeClasses[0]?.id || '');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => activeSubjects[0]?.id || '');
  const [selectedTimetableClassId, setSelectedTimetableClassId] = useState<string>('ALL');
  const [isPrintingResultSheet, setIsPrintingResultSheet] = useState(false);

  // Marks state
  const [marksList, setMarksList] = useState<ExamMark[]>([]);
  const [marksSearchQuery, setMarksSearchQuery] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [isCreateEditModalOpen, setIsCreateEditModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState(false);
  const [admitCardStudent, setAdmitCardStudent] = useState<Student | null>(null);
  const [admitCardClassStudents, setAdmitCardClassStudents] = useState<Student[]>([]);
  const [isAdmitCardModalOpen, setIsAdmitCardModalOpen] = useState(false);
  const [reportStudent, setReportStudent] = useState<Student | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [bulkReportStudents, setBulkReportStudents] = useState<Student[] | null>(null);
  const [isBulkReportModalOpen, setIsBulkReportModalOpen] = useState(false);
  const [expandedExamScheduleId, setExpandedExamScheduleId] = useState<string | null>(null);

  // Parent linked children state
  const [parentActiveStudentId, setParentActiveStudentId] = useState<string>(() => {
    if (isParent) {
      return (
        currentUser?.activeStudentId ||
        currentUser?.studentId ||
        (currentUser?.linkedStudentIds && currentUser.linkedStudentIds[0]) ||
        allStudents[0]?.id ||
        ''
      );
    }
    return '';
  });

  // Target student for Student or Parent view
  const targetStudent: Student | null = useMemo(() => {
    if (isStudent) {
      if (currentUser?.studentId) {
        return (
          allStudents.find((s) => s.id === currentUser.studentId) ||
          allStudents.find((s) => s.admissionNumber === currentUser.username) ||
          null
        );
      }
      return allStudents.find((s) => s.admissionNumber === currentUser?.username) || allStudents[0] || null;
    }
    if (isParent) {
      return allStudents.find((s) => s.id === parentActiveStudentId) || allStudents[0] || null;
    }
    return null;
  }, [isStudent, isParent, currentUser, parentActiveStudentId, allStudents]);

  const isTeacher = userRole === 'TEACHER';
  const [assignedClassesData, setAssignedClassesData] = useState<{
    allAccess: boolean;
    classes: { classId: string; className: string; sections: string[] }[];
    defaultClassId?: string;
    defaultSection?: string;
  }>({
    allAccess: !isTeacher,
    classes: [],
  });

  // Load teacher assigned classes dynamically
  useEffect(() => {
    if (isTeacher) {
      api.getAssignedClassesForAttendance().then((res) => {
        setAssignedClassesData(res);
        if (res.classes.length > 0) {
          const targetCId = res.defaultClassId || res.classes[0].classId;
          const matched = res.classes.find((c) => c.classId === targetCId) || res.classes[0];
          setSelectedClassId(matched.classId);
          setSelectedSection(res.defaultSection || matched.sections[0] || 'A');
        }
      });
    }
  }, [isTeacher]);

  const teacherAvailableClasses = useMemo(() => {
    if (!isTeacher || assignedClassesData.allAccess) {
      return activeClasses;
    }
    const assignedIds = new Set(assignedClassesData.classes.map((c) => c.classId));
    const assignedNames = new Set(assignedClassesData.classes.map((c) => c.className.toLowerCase()));
    return activeClasses.filter(
      (c) => assignedIds.has(c.id) || assignedNames.has(c.name.toLowerCase())
    );
  }, [activeClasses, isTeacher, assignedClassesData]);

  // Deduplicated examinations from MongoDB - unique database ID (scoped for teachers)
  const uniqueExams = useMemo(() => {
    const baseList = isTeacher ? api.getTeacherAssignedExams() : rawExams;
    const seen = new Set<string>();
    const list: Exam[] = [];
    for (const ex of baseList) {
      if (ex && ex.id && !seen.has(ex.id)) {
        seen.add(ex.id);
        list.push(ex);
      }
    }
    return list;
  }, [rawExams, isTeacher]);

  // Synchronize selected exam when exams change
  useEffect(() => {
    if (uniqueExams.length > 0) {
      if (!selectedExamId || !uniqueExams.some((e) => e.id === selectedExamId)) {
        setSelectedExamId(uniqueExams[0].id);
      }
    }
  }, [uniqueExams, selectedExamId]);

  // Active exam object
  const activeExam = useMemo(
    () => uniqueExams.find((e) => e.id === selectedExamId) || uniqueExams[0] || null,
    [uniqueExams, selectedExamId]
  );

  const selectedClass = useMemo(
    () => teacherAvailableClasses.find((c) => c.id === selectedClassId) || activeClasses.find((c) => c.id === selectedClassId),
    [teacherAvailableClasses, activeClasses, selectedClassId]
  );

  const availableSections = useMemo(() => {
    if (isTeacher && !assignedClassesData.allAccess) {
      const matched = assignedClassesData.classes.find(
        (c) => c.classId === selectedClassId || c.className.toLowerCase() === selectedClass?.name.toLowerCase()
      );
      if (matched && matched.sections.length > 0) {
        return matched.sections;
      }
    }
    if (selectedClass && Array.isArray(selectedClass.sections) && selectedClass.sections.length > 0) {
      return selectedClass.sections;
    }
    return ['A', 'B'];
  }, [selectedClass, isTeacher, assignedClassesData, selectedClassId]);

  useEffect(() => {
    if (selectedSection !== 'ALL' && !availableSections.includes(selectedSection)) {
      setSelectedSection(availableSections[0] || 'ALL');
    }
  }, [availableSections, selectedSection]);

  // Admit cards and results only make sense for the classes the selected exam is meant for.
  const examClassOptions = useMemo(() => {
    const ids = activeExam?.classIds || [];
    if (ids.length === 0) return teacherAvailableClasses;
    const scoped = teacherAvailableClasses.filter((c) => ids.includes(c.id));
    return scoped.length > 0 ? scoped : teacherAvailableClasses;
  }, [activeExam, teacherAvailableClasses]);

  useEffect(() => {
    if (examClassOptions.length > 0 && !examClassOptions.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(examClassOptions[0].id);
    }
  }, [examClassOptions, selectedClassId]);

  // Synchronize selected class if not valid
  useEffect(() => {
    if (teacherAvailableClasses.length > 0) {
      if (!selectedClassId || !teacherAvailableClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(teacherAvailableClasses[0].id);
      }
    }
  }, [teacherAvailableClasses, selectedClassId]);

  // Available subjects for the currently selected class - strictly database-driven, deduplicated
  const [classAssignedSubjects, setClassAssignedSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!selectedClassId) {
      setClassAssignedSubjects([]);
      return;
    }
    // 1. Immediately populate from cached active subjects assigned to selectedClassId
    const cached = activeSubjects.filter(
      (s) =>
        (s.status || 'ACTIVE') === 'ACTIVE' &&
        Array.isArray(s.classIds) &&
        s.classIds.includes(selectedClassId)
    );
    const seen = new Set<string>();
    const initialList: Subject[] = [];
    for (const s of cached) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        initialList.push(s);
      }
    }
    setClassAssignedSubjects(initialList);

    // 2. Fetch fresh from backend endpoint via api service
    api.fetchClassSubjects(selectedClassId)
      .then((fresh) => {
        if (Array.isArray(fresh)) {
          const freshMatched = fresh.filter(
            (s: Subject) =>
              (s.status || 'ACTIVE') === 'ACTIVE' &&
              Array.isArray(s.classIds) &&
              s.classIds.includes(selectedClassId)
          );
          const freshSeen = new Set<string>();
          const freshList: Subject[] = [];
          for (const s of freshMatched) {
            if (!freshSeen.has(s.id)) {
              freshSeen.add(s.id);
              freshList.push(s);
            }
          }
          setClassAssignedSubjects(freshList);
        }
      })
      .catch(() => {});
  }, [selectedClassId, activeSubjects, realtimeRevision]);

  const classAvailableSubjects = classAssignedSubjects;

  // Ensure selectedSubjectId is valid for selected class
  useEffect(() => {
    if (classAvailableSubjects.length > 0) {
      if (!classAvailableSubjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(classAvailableSubjects[0].id);
      }
    }
  }, [classAvailableSubjects, selectedSubjectId]);

  // Load marks whenever selectedExamId, selectedClassId, or selectedSubjectId changes
  useEffect(() => {
    if (selectedExamId) {
      const recorded = api.getExamMarks(selectedExamId);
      setMarksList(dedupeMarks(recorded));
      api.fetchExamMarks(selectedExamId).then((fresh) => {
        if (Array.isArray(fresh)) {
          setMarksList(dedupeMarks(fresh));
        }
      });
    } else {
      setMarksList([]);
    }
  }, [selectedExamId, realtimeRevision]);

  // Filter enrolled students for selected class and section - deduplicated and roll sorted
  const enrolledStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const seen = new Set<string>();
    return allStudents
      .filter((s) => {
        const matchClass = s.classId === selectedClassId;
        const matchSection = selectedSection === 'ALL' || !selectedSection || s.section === selectedSection;
        if (!matchClass || !matchSection) return false;
        const key = s.id || s.admissionNumber;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const rollA = parseInt(a.rollNumber || '0', 10);
        const rollB = parseInt(b.rollNumber || '0', 10);
        if (!isNaN(rollA) && !isNaN(rollB) && rollA !== rollB) return rollA - rollB;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [allStudents, selectedClassId, selectedSection]);

  // Active subject object
  const activeSubject = useMemo(
    () => classAvailableSubjects.find((s) => s.id === selectedSubjectId) || classAvailableSubjects[0] || null,
    [classAvailableSubjects, selectedSubjectId]
  );

  // Active scheduled paper config (to determine maxMarks and passMarks)
  const currentPaperSchedule = useMemo(() => {
    if (!activeExam || !activeExam.schedule) return null;
    return activeExam.schedule.find(
      (s) => s.classId === selectedClassId && s.subjectId === selectedSubjectId
    );
  }, [activeExam, selectedClassId, selectedSubjectId]);

  const currentMaxMarks = currentPaperSchedule?.maxMarks || activeSubject?.maxMarks || 100;
  const currentPassMarks = currentPaperSchedule?.passMarks || activeSubject?.passMarks || 33;

  // Handle single student mark update
  const handleUpdateMark = (student: Student, marksValue: number, isAbsent: boolean = false) => {
    if (!selectedExamId || !selectedSubjectId) return;

    const max = currentMaxMarks;
    let clamped = Math.max(0, Math.min(max, isNaN(marksValue) ? 0 : marksValue));
    if (isAbsent) clamped = 0;

    const evalRes = calculateEvaluation(clamped, max);

    const existingIdx = marksList.findIndex(
      (m) =>
        m.examId === selectedExamId &&
        m.studentId === student.id &&
        m.subjectId === selectedSubjectId
    );

    const updated = [...marksList];
    const markRecord: ExamMark = {
      id: existingIdx >= 0 ? marksList[existingIdx].id : `em-${Date.now()}-${student.id}`,
      examId: selectedExamId,
      studentId: student.id,
      studentName: student.name,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      classId: student.classId,
      section: student.section,
      subjectId: selectedSubjectId,
      subjectName: activeSubject?.name || 'Subject',
      marksObtained: clamped,
      maxMarks: max,
      isAbsent,
      grade: isAbsent ? 'E/F' : evalRes.grade,
      gradePoint: isAbsent ? 0 : evalRes.gradePoint,
      remark: isAbsent ? 'Absent' : evalRes.remark,
      status: isAbsent ? 'FAIL' : evalRes.status,
      academicSession: activeExam?.academicSession || selectedSession,
    };

    if (existingIdx >= 0) {
      updated[existingIdx] = markRecord;
    } else {
      updated.push(markRecord);
    }
    setMarksList(updated);
  };

  const [isSavingMarks, setIsSavingMarks] = useState(false);
  const [marksFilter, setMarksFilter] = useState<'ALL' | 'MISSING' | 'ABSENT' | 'ENTERED'>('ALL');

  // Subject-wise performance summary and absentee/missing counts
  const subjectMarksStats = useMemo(() => {
    const relevantMarks = enrolledStudents.map((st) => {
      const found = marksList.find(
        (m) =>
          m.studentId === st.id &&
          m.subjectId === selectedSubjectId &&
          m.examId === selectedExamId
      );
      return { student: st, mark: found };
    });

    const totalStudents = enrolledStudents.length;
    const entered = relevantMarks.filter((r) => r.mark !== undefined);
    const absent = relevantMarks.filter((r) => r.mark?.isAbsent === true);
    const missing = relevantMarks.filter((r) => r.mark === undefined);

    const nonAbsentMarks = relevantMarks
      .filter((r) => r.mark && !r.mark.isAbsent)
      .map((r) => Number(r.mark!.marksObtained));

    const totalScore = nonAbsentMarks.reduce((acc, curr) => acc + curr, 0);
    const avgScore = nonAbsentMarks.length > 0 ? (totalScore / nonAbsentMarks.length).toFixed(1) : '0';
    const highestScore = nonAbsentMarks.length > 0 ? Math.max(...nonAbsentMarks) : 0;
    const lowestScore = nonAbsentMarks.length > 0 ? Math.min(...nonAbsentMarks) : 0;

    const passCount = nonAbsentMarks.filter((m) => m >= currentPassMarks).length;
    const passPercentage = nonAbsentMarks.length > 0 ? ((passCount / nonAbsentMarks.length) * 100).toFixed(0) : '0';

    const gradeCounts: Record<string, number> = {
      A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, D: 0, 'E/F': 0,
    };
    relevantMarks.forEach((r) => {
      if (r.mark) {
        const g = r.mark.grade || (r.mark.isAbsent ? 'E/F' : 'E/F');
        gradeCounts[g] = (gradeCounts[g] || 0) + 1;
      }
    });

    return {
      totalStudents,
      enteredCount: entered.length,
      absentCount: absent.length,
      missingCount: missing.length,
      avgScore,
      highestScore,
      lowestScore,
      passPercentage,
      gradeCounts,
    };
  }, [enrolledStudents, marksList, selectedSubjectId, selectedExamId, currentPassMarks]);

  // Displayed students filtered by user selected view (ALL, MISSING, ABSENT, ENTERED)
  const displayedStudents = useMemo(() => {
    return enrolledStudents.filter((st) => {
      const markEntry = marksList.find(
        (m) =>
          m.studentId === st.id &&
          m.subjectId === selectedSubjectId &&
          m.examId === selectedExamId
      );
      if (marksFilter === 'MISSING') {
        return markEntry === undefined;
      }
      if (marksFilter === 'ABSENT') {
        return markEntry?.isAbsent === true;
      }
      if (marksFilter === 'ENTERED') {
        return markEntry !== undefined;
      }
      return true;
    });
  }, [enrolledStudents, marksList, selectedSubjectId, selectedExamId, marksFilter]);

  // Commit marks to server and MongoDB (supports Draft and Submitted)
  const handleSaveMarksWithStatus = async (status: 'DRAFT' | 'SUBMITTED' = 'SUBMITTED') => {
    if (!selectedExamId || !selectedSubjectId) {
      setFeedbackMessage({ type: 'error', text: 'Please select an examination and subject first.' });
      return;
    }

    setIsSavingMarks(true);
    setFeedbackMessage(null);

    try {
      // Only the students shown for this class/section, one row each (see marksForSubmission).
      const relevantMarks = marksForSubmission(marksList, enrolledStudents, selectedExamId, selectedSubjectId);

      if (relevantMarks.length === 0) {
        setFeedbackMessage({ type: 'error', text: 'Enter marks for at least one student before saving.' });
        return;
      }

      const res = await api.saveExamMarksAsync({
        examId: selectedExamId,
        classId: selectedClassId,
        section: selectedSection === 'ALL' ? undefined : selectedSection,
        subjectId: selectedSubjectId,
        marksList: relevantMarks,
        submissionStatus: status,
      });

      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: status === 'DRAFT'
            ? `Marks saved as DRAFT successfully for ${activeSubject?.name || 'Subject'}! You can continue making adjustments anytime.`
            : `Marks successfully SUBMITTED for ${activeSubject?.name || 'Subject'} (${res.count} students). Status marked as SUBMITTED.`,
        });
        setTimeout(() => setFeedbackMessage(null), 5000);
      } else {
        setFeedbackMessage({ type: 'error', text: res.error || 'Failed to save marks' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to save marks.' });
    } finally {
      setIsSavingMarks(false);
    }
  };

  const handleSaveMarks = () => handleSaveMarksWithStatus('SUBMITTED');

  // When an Annual Examination is published the server adds the yearly exam fee to the students' ledgers
  const examFeeNote = (saved: any): string => {
    const b = saved?.examFeeBilling;
    if (!b || !b.billed) return '';
    return ` Annual exam fee added to ${b.billed} student${b.billed === 1 ? '' : 's'} (₹${Number(b.total || 0).toLocaleString('en-IN')}).`;
  };

  // Exam publishing toggle
  const handleToggleExamPublish = async (exam: Exam) => {
    if (!canManageExams) return;
    const nextStatus = exam.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      const saved = await api.publishExam(exam.id, nextStatus);
      setFeedbackMessage({
        type: 'success',
        text: `Examination "${exam.name || exam.title}" status changed to ${nextStatus}. Notices updated.${examFeeNote(saved)}`,
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to update status.' });
    }
  };

  // Admit card publishing toggle
  const handleToggleAdmitCardPublish = async (exam: Exam) => {
    if (!canManageExams) return;
    const nextStatus = exam.admitCardStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await api.publishAdmitCards(exam.id, nextStatus);
      setFeedbackMessage({
        type: 'success',
        text: `Admit card status for "${exam.name || exam.title}" changed to ${nextStatus}.`,
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to update admit card status.' });
    }
  };

  // Results publishing toggle
  const handleToggleResultsPublish = async (exam: Exam) => {
    if (!canManageExams) return;
    const nextStatus = exam.resultsStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await api.publishResults(exam.id, nextStatus);
      setFeedbackMessage({
        type: 'success',
        text: `Results publication for "${exam.name || exam.title}" set to ${nextStatus}. Notices synchronized.`,
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to update results status.' });
    }
  };

  // Class-wise result sheet CSV download
  const handleDownloadResultSheet = () => {
    if (!activeExam || !selectedClassId || enrolledStudents.length === 0) {
      setFeedbackMessage({ type: 'error', text: 'No result data available' });
      setTimeout(() => setFeedbackMessage(null), 3500);
      return;
    }

    if (enrolledStudents.length === 0) {
      setFeedbackMessage({ type: 'error', text: 'No students enrolled in this class' });
      setTimeout(() => setFeedbackMessage(null), 3500);
      return;
    }

    downloadResultSheet({
      settings,
      exam: activeExam,
      selectedClass,
      section: selectedSection,
      subjects: classAvailableSubjects,
      students: enrolledStudents,
      marksList,
    });

    setFeedbackMessage({ type: 'success', text: 'Result sheet downloaded successfully!' });
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  // Class-wise result sheet print
  const handlePrintResultSheet = () => {
    if (!activeExam || !selectedClassId || enrolledStudents.length === 0) {
      setFeedbackMessage({ type: 'error', text: 'No students enrolled in this class' });
      setTimeout(() => setFeedbackMessage(null), 3500);
      return;
    }
    setIsPrintingResultSheet(true);
    document.body.classList.add('result-sheet-print-active');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('result-sheet-print-active');
      setIsPrintingResultSheet(false);
    }, 1000);
  };

  // Download All Marksheets (one student per page)
  const handleDownloadAllMarksheets = async () => {
    if (!activeExam || !selectedClassId || enrolledStudents.length === 0) {
      setFeedbackMessage({ type: 'error', text: 'No students enrolled in this class' });
      setTimeout(() => setFeedbackMessage(null), 3500);
      return;
    }

    const okAll = await exportBulkReportCardsToPdf({
      settings,
      exam: activeExam,
      students: enrolledStudents,
      marksList,
      getStudentSubjects: (st) => {
        if (st.classId === selectedClassId && classAvailableSubjects.length > 0) {
          return classAvailableSubjects;
        }
        const subs = api.getActiveSubjects(st.classId).filter(
          (s) => (s.status || 'ACTIVE') === 'ACTIVE' && Array.isArray(s.classIds) && s.classIds.includes(st.classId)
        );
        const seen = new Set<string>();
        const list: Subject[] = [];
        for (const sub of subs) {
          if (!seen.has(sub.id)) {
            seen.add(sub.id);
            list.push(sub);
          }
        }
        return list;
      },
    });

    if (!okAll) {
      setFeedbackMessage({ type: 'error', text: 'Could not generate marksheets PDF.' });
      setTimeout(() => setFeedbackMessage(null), 3500);
      return;
    }
    setFeedbackMessage({ type: 'success', text: `Downloaded marksheets for ${enrolledStudents.length} students!` });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Single student marksheet actions
  const handlePreviewSingleMarksheet = (st: Student) => {
    setReportStudent(st);
    setIsReportModalOpen(true);
  };

  const handleDownloadSingleMarksheetAction = async (st: Student) => {
    if (!activeExam) return;
    const subs = (st.classId === selectedClassId && classAvailableSubjects.length > 0)
      ? classAvailableSubjects
      : api.getActiveSubjects(st.classId).filter(
          (s) => (s.status || 'ACTIVE') === 'ACTIVE' && Array.isArray(s.classIds) && s.classIds.includes(st.classId)
        );
    const seen = new Set<string>();
    const list: Subject[] = [];
    for (const sub of subs) {
      if (!seen.has(sub.id)) {
        seen.add(sub.id);
        list.push(sub);
      }
    }

    const ok = await exportReportCardToPdf({
      settings,
      exam: activeExam,
      student: st,
      subjects: list,
      marksList,
    });
    if (!ok) {
      setFeedbackMessage({ type: 'error', text: 'Could not generate report card PDF.' });
      setTimeout(() => setFeedbackMessage(null), 3500);
    }
  };

  // Delete Exam (Admin RBAC + In-App Modal Confirmation)
  const handleDeleteExam = (exam: Exam) => {
    if (!canManageExams) return;
    setExamToDelete(exam);
  };

  const handleConfirmDeleteExam = async () => {
    if (!examToDelete || !canManageExams) return;
    setIsDeletingExam(true);
    try {
      await api.deleteExam(examToDelete.id);
      setFeedbackMessage({
        type: 'success',
        text: `Examination "${examToDelete.name || examToDelete.title}" and related records deleted.`,
      });
      setRealtimeRevision((prev) => prev + 1);
      if (selectedExamId === examToDelete.id) {
        const remaining = rawExams.filter((e) => e.id !== examToDelete.id);
        setSelectedExamId(remaining[0]?.id || '');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to delete examination.' });
    } finally {
      setIsDeletingExam(false);
      setExamToDelete(null);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  // =========================================================================
  // STUDENT & PARENT VIEW PORTAL
  // =========================================================================
  if (isStudent || isParent) {
    // Only published exams applicable to this student's class
    const studentExams = rawExams.filter((ex) => {
      if (ex.status === 'DRAFT') return false;
      if (!targetStudent) return false;
      const matchClass = !ex.classIds || ex.classIds.length === 0 || ex.classIds.includes(targetStudent.classId);
      const matchSchedule = Array.isArray(ex.schedule) && ex.schedule.some((s) => s.classId === targetStudent.classId);
      return matchClass || matchSchedule;
    });

    const currentStudentExam = studentExams.find((e) => e.id === selectedExamId) || studentExams[0] || null;
    const studentPapers = papersForStudent(currentStudentExam?.schedule, targetStudent?.classId, targetStudent?.section);

    // Student's marks for selected published exam
    const studentMarksForExam = currentStudentExam && currentStudentExam.resultsStatus === 'PUBLISHED'
      ? api.getExamMarks(currentStudentExam.id).filter((m) => m.studentId === targetStudent?.id)
      : [];

    const totalMax = studentMarksForExam.reduce((acc, m) => acc + m.maxMarks, 0);
    const totalObtained = studentMarksForExam.reduce((acc, m) => acc + m.marksObtained, 0);
    const overallEval = totalMax > 0
      ? calculateEvaluation(totalObtained, totalMax)
      : { grade: '—', gradePoint: 0, status: 'N/A' as const, percentage: 0, remark: 'Pending' };

    return (
      <div className="space-y-6">
        {/* Portal Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-900 text-amber-300 flex items-center justify-center font-bold text-xl shrink-0">
              <GraduationCap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {isParent ? 'Parent Portal: Ward Examinations & Results' : 'Student Examination Portal'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  Session {settings.currentAcademicSession || '2026-2027'}
                </span>
              </div>
            </div>
          </div>

          {/* If Parent, Child Selector */}
          {isParent && (
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
              <User className="w-4 h-4 text-slate-500" />
              <label className="font-semibold text-slate-700">Select Child:</label>
              <select
                value={parentActiveStudentId}
                onChange={(e) => setParentActiveStudentId(e.target.value)}
                className="bg-white px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900"
              >
                {allStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.className} - {st.section})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Candidate Profile Strip */}
        {targetStudent ? (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans">
            <div>
              <span className="text-slate-500 block text-[11px]">Candidate Name</span>
              <strong className="text-slate-900 text-sm uppercase">{targetStudent.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Class & Section</span>
              <strong className="text-slate-900 text-sm">{targetStudent.className} - Sec {targetStudent.section}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Admission Number</span>
              <strong className="text-slate-900 font-mono text-sm">{targetStudent.admissionNumber}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Roll Number</span>
              <strong className="text-slate-900 font-mono text-sm">{targetStudent.rollNumber}</strong>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            No enrolled student record associated with this account.
          </div>
        )}

        {/* Examination Selector */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="font-bold text-slate-700 shrink-0">Select Examination:</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white min-w-[240px]"
            >
              {studentExams.length === 0 ? (
                <option value="">No examinations currently published for your class</option>
              ) : (
                studentExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name || ex.title} ({ex.examType?.replace('_', ' ') || 'Term'})
                  </option>
                ))
              )}
            </select>
          </div>

          {currentStudentExam && (
            <div className="flex items-center gap-2">
              {currentStudentExam.admitCardStatus === 'PUBLISHED' && targetStudent && (
                <button
                  type="button"
                  onClick={() => {
                    setAdmitCardStudent(targetStudent);
                    setAdmitCardClassStudents([targetStudent]);
                    setIsAdmitCardModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download / Print Admit Card</span>
                </button>
              )}

              {currentStudentExam.resultsStatus === 'PUBLISHED' && targetStudent && studentMarksForExam.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setReportStudent(targetStudent);
                    setIsReportModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Official Marksheet / Report Card</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main Content Panels */}
        {!currentStudentExam ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No examination data available</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              There are currently no active or published examinations for your enrolled class. You will be notified automatically when an exam schedule is released.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Timetable & Schedule */}
            <div className="lg:col-span-2 space-y-6">
              {/* Timetable Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Examination Timetable & Papers ({targetStudent?.className})
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600">
                    Center: {currentStudentExam.roomVenue || 'School Campus'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-10 text-center">#</th>
                        <th className="p-3">Exam Date</th>
                        <th className="p-3">Subject Name</th>
                        <th className="p-3 text-center">Timing</th>
                        <th className="p-3 text-center">Max Marks</th>
                        <th className="p-3 text-center">Room / Hall</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentPapers.length > 0 ? (
                        studentPapers.map((paper, idx) => (
                            <tr key={paper.id || idx} className="hover:bg-slate-50">
                              <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="p-3 font-semibold text-slate-900">{formatExamDate(paper.date)}</td>
                              <td className="p-3 font-bold text-blue-900">{paper.subjectName}</td>
                              <td className="p-3 text-center font-medium text-slate-700">
                                {paper.startTime} - {paper.endTime}
                              </td>
                              <td className="p-3 text-center font-bold text-slate-800">{paper.maxMarks || 100}</td>
                              <td className="p-3 text-center text-slate-600">{paper.roomNumber || 'Exam Hall'}</td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-500">
                            Class-wise examination schedule will be published shortly.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {currentStudentExam.instructions && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                    <strong className="block text-slate-800 mb-1 font-semibold">Important Exam Instructions:</strong>
                    <p className="leading-relaxed">{currentStudentExam.instructions}</p>
                  </div>
                )}
              </div>

              {/* Results / Marksheet section */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Scholastic Performance & Mark Sheet
                    </h3>
                  </div>

                  {currentStudentExam.resultsStatus === 'PUBLISHED' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      RESULTS PUBLISHED
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>EVALUATION IN PROGRESS</span>
                    </span>
                  )}
                </div>

                {currentStudentExam.resultsStatus !== 'PUBLISHED' ? (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="font-bold text-slate-800 text-xs">Official Results Not Yet Published</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Examination answer sheets are currently being evaluated and cross-verified by the academic council. Results will appear automatically here once approved by the Principal.
                    </p>
                  </div>
                ) : studentMarksForExam.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">No marks entries registered for this candidate.</p>
                  </div>
                ) : (
                  <div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">Subject</th>
                            <th className="p-3 text-center">Max Marks</th>
                            <th className="p-3 text-center">Marks Obtained</th>
                            <th className="p-3 text-center">Grade</th>
                            <th className="p-3 text-center">Result Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentMarksForExam.map((m) => {
                            const evalRes = calculateEvaluation(m.marksObtained, m.maxMarks);
                            const isPass = evalRes.status === 'PASS';
                            return (
                              <tr key={m.id} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-900">{m.subjectName}</td>
                                <td className="p-3 text-center text-slate-600">{m.maxMarks}</td>
                                <td className="p-3 text-center font-bold text-slate-900">{m.marksObtained}</td>
                                <td className="p-3 text-center font-bold text-blue-800">{evalRes.grade}</td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {isPass ? 'PASSED' : 'FAILED'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                          <tr>
                            <td className="p-3 text-slate-900">Aggregate / Overall</td>
                            <td className="p-3 text-center text-slate-800">{totalMax}</td>
                            <td className="p-3 text-center text-slate-900">{totalObtained}</td>
                            <td className="p-3 text-center text-blue-900">{overallEval.grade}</td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                                  overallEval.status === 'PASS'
                                    ? 'bg-emerald-200 text-emerald-900'
                                    : 'bg-red-200 text-red-900'
                                }`}
                              >
                                {overallEval.percentage}% ({overallEval.status})
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Admit Card Card & Circulars */}
            <div className="space-y-6">
              {/* Admit Card Status Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-amber-500" />
                    <span>Admit Card / Hall Ticket</span>
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      currentStudentExam.admitCardStatus === 'PUBLISHED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {currentStudentExam.admitCardStatus === 'PUBLISHED' ? 'ISSUED' : 'PENDING'}
                  </span>
                </div>

                {currentStudentExam.admitCardStatus === 'PUBLISHED' && targetStudent ? (
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Admit Card is verified and released by Examination Cell.</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Please print a hard copy of your official admit card. You must bring it along with your school ID card to every examination paper.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAdmitCardStudent(targetStudent);
                        setAdmitCardClassStudents([targetStudent]);
                        setIsAdmitCardModalOpen(true);
                      }}
                      className="w-full py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Official Admit Card</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold">
                      <Lock className="w-4 h-4 text-slate-500" />
                      <span>Admit Card Not Released</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Hall tickets are issued approximately 5 days prior to commencement once attendance and clearance prerequisites are certified.
                    </p>
                  </div>
                )}
              </div>

              {/* Examination Notices */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-700" />
                  <span>Official Examination Notices</span>
                </h3>

                <div className="space-y-2">
                  {allNotices
                    .filter((n) => n.category === 'EXAM' || n.category === 'RESULT')
                    .slice(0, 4)
                    .map((n) => (
                      <div key={n.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <strong className="text-slate-900 font-bold line-clamp-1">{n.title}</strong>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{n.publishedDate}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">{n.content}</p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modals for Student / Parent */}
        {targetStudent && isAdmitCardModalOpen && currentStudentExam && (
          <PrintableAdmitCardModal
            student={targetStudent}
            students={[targetStudent]}
            exam={currentStudentExam}
            isOpen={isAdmitCardModalOpen}
            onClose={() => setIsAdmitCardModalOpen(false)}
            settings={settings}
          />
        )}

        {targetStudent && isReportModalOpen && currentStudentExam && (
          <PrintableReportCardModal
            student={targetStudent}
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            settings={settings}
            examId={currentStudentExam.id}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // ADMIN & STAFF SUITE
  // =========================================================================
  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-row items-center justify-between gap-3 bg-white px-4 py-3 sm:px-5 sm:py-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Exams & Marks</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Session {selectedSession}
            </span>
          </div>
        </div>

        {canManageExams && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingExam(null);
                setIsCreateEditModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-700/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Exam</span>
            </button>
          </div>
        )}
      </div>

      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs overflow-x-auto text-xs [&>button]:whitespace-nowrap [&>button]:shrink-0">
        <button
          onClick={() => setActiveTab('SCHEDULES')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'SCHEDULES'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Schedules ({rawExams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MARKS')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'MARKS'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Edit2 className="w-4 h-4" />
          <span>Marks Entry</span>
        </button>

        <button
          onClick={() => setActiveTab('ADMIT_CARDS')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ADMIT_CARDS'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Admit Cards</span>
        </button>

        <button
          onClick={() => setActiveTab('RESULTS')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'RESULTS'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Results</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: EXAMINATIONS & SCHEDULES */}
      {/* ===================================================================== */}
      {activeTab === 'SCHEDULES' && (
        <div className="space-y-4">
          {uniqueExams.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No examination schedules registered</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Create a new examination to configure subject-wise dates, timings, venues, and publish circulars.
              </p>
              {canManageExams && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingExam(null);
                    setIsCreateEditModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md shadow-blue-700/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Examination</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {uniqueExams.map((ex) => {
                const isExpanded = expandedExamScheduleId === ex.id;
                const scheduleCount = ex.schedule?.length || 0;

                return (
                  <div
                    key={ex.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    <div className="p-4 sm:p-5 space-y-3">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">{ex.name || ex.title}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {(ex.examType || 'Term').replace(/_/g, ' ')} · {ex.academicSession || selectedSession}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setExpandedExamScheduleId(isExpanded ? null : ex.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                            title="Show or hide the timetable"
                          >
                            <span>Timetable</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {canManageExams && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExam(ex);
                                  setIsCreateEditModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                                title="Edit examination and timetable"
                                aria-label="Edit examination"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteExam(ex)}
                                className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer"
                                title="Delete examination"
                                aria-label="Delete examination"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Facts */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
                        <span>
                          <strong className="text-slate-800">{formatExamDate(ex.startDate)}</strong> – <strong className="text-slate-800">{formatExamDate(ex.endDate)}</strong>
                        </span>
                        <span>
                          {(() => {
                            const names = (ex.classIds || [])
                              .map((cid) => allClasses.find((c) => c.id === cid)?.name)
                              .filter(Boolean) as string[];
                            if (names.length === 0) return 'All classes';
                            return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3} more` : names.join(', ');
                          })()}
                        </span>
                        <span>{scheduleCount} {scheduleCount === 1 ? 'paper' : 'papers'}</span>
                        {ex.roomVenue && <span>{ex.roomVenue}</span>}
                      </div>

                      {/* Publishing controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                        {([
                          { key: 'schedule', label: 'Schedule', on: ex.status === 'PUBLISHED', icon: Unlock, onLabel: 'Unpublish', offLabel: 'Publish', run: () => handleToggleExamPublish(ex) },
                          { key: 'admit', label: 'Admit cards', on: ex.admitCardStatus === 'PUBLISHED', icon: Printer, onLabel: 'Revoke', offLabel: 'Publish', run: () => handleToggleAdmitCardPublish(ex) },
                          { key: 'results', label: 'Results', on: ex.resultsStatus === 'PUBLISHED', icon: Award, onLabel: 'Hide', offLabel: 'Publish', run: () => handleToggleResultsPublish(ex) },
                        ] as const).map((c) => (
                          <div key={c.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${c.on ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{c.label}</p>
                                <p className="text-[11px] text-slate-500">{c.on ? 'Published' : 'Draft'}</p>
                              </div>
                            </div>
                            {canManageExams && (
                              <button
                                type="button"
                                onClick={c.run}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                  c.on
                                    ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                                    : 'bg-blue-700 hover:bg-blue-800 text-white'
                                }`}
                              >
                                {c.on ? c.onLabel : c.offLabel}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expandable Schedule Details */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Scheduled Papers & Timings ({scheduleCount})
                          </h4>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Auto-syncs to Public Notice & Student Portal
                          </span>
                        </div>

                        {scheduleCount === 0 ? (
                          <p className="text-xs text-slate-500 italic">No papers configured in this exam.</p>
                        ) : (
                          <div className="space-y-4">
                            {Array.from(new Set(ex.schedule.map((p) => p.classId || 'default'))).map((classId) => {
                              const classPapers = sortExamSchedule<ExamScheduleItem>(ex.schedule.filter((p) => (p.classId || 'default') === classId));
                              const className =
                                classPapers[0]?.className ||
                                activeClasses.find((c) => c.id === classId)?.name ||
                                'Class';
                              return (
                                <div
                                  key={classId}
                                  className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs"
                                >
                                  <div className="bg-slate-100/90 px-3.5 py-2 border-b border-slate-200 font-bold text-xs text-slate-900 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-700"></span>
                                    <span>{className} — Examination Schedule</span>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs font-sans">
                                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                        <tr>
                                          <th className="p-2.5">Subject</th>
                                          <th className="p-2.5 w-20">Section</th>
                                          <th className="p-2.5">Exam Date</th>
                                          <th className="p-2.5 w-24">Start</th>
                                          <th className="p-2.5 w-24">End</th>
                                          <th className="p-2.5 w-16 text-center">Max</th>
                                          <th className="p-2.5 w-16 text-center">Pass</th>
                                          <th className="p-2.5">Room/Venue</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {classPapers.map((paper, pIdx) => (
                                          <tr key={paper.id || pIdx} className="hover:bg-slate-50">
                                            <td className="p-2.5 font-bold text-blue-900">{paper.subjectName}</td>
                                            <td className="p-2.5">{paper.section || 'ALL'}</td>
                                            <td className="p-2.5 font-medium text-slate-700">{formatExamDate(paper.date)}</td>
                                            <td className="p-2.5 text-slate-600">{paper.startTime}</td>
                                            <td className="p-2.5 text-slate-600">{paper.endTime}</td>
                                            <td className="p-2.5 text-center font-bold text-slate-800">{paper.maxMarks || 100}</td>
                                            <td className="p-2.5 text-center font-bold text-red-700">{paper.passMarks || 33}</td>
                                            <td className="p-2.5 text-slate-600">{paper.roomNumber || 'School Examination Center'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: DYNAMIC MARKS ENTRY */}
      {/* ===================================================================== */}
      {activeTab === 'MARKS' && (
        <div className="space-y-4">
          {/* Selectors Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-600 mb-1">Select Examination</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              >
                {uniqueExams.length === 0 ? (
                  <option value="">No examinations available</option>
                ) : (
                  uniqueExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name || ex.title} • {ex.academicSession || selectedSession}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">
                Class {isTeacher && <span className="text-emerald-700 text-[11px] font-semibold">(Assigned)</span>}
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              >
                {teacherAvailableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 bg-white focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              >
                {!isTeacher && <option value="ALL">All Sections (A, B, C)</option>}
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Subject (Active Only)</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              >
                {classAvailableSubjects.length === 0 ? (
                  <option value="">No active subjects for this class</option>
                ) : (
                  classAvailableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Subject Performance & Roster Metrics Dashboard */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-700" />
                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                  Subject-Wise Performance: {activeSubject?.name || 'Subject'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  Max: {currentMaxMarks} • Pass: {currentPassMarks}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>Class: <strong>{selectedClass?.name || 'Selected'}</strong></span>
                <span>•</span>
                <span>Section: <strong>{selectedSection}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Enrolled</span>
                <span className="text-base font-black text-slate-900 font-mono">{subjectMarksStats.totalStudents}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Class Average</span>
                <span className="text-base font-black text-blue-900 font-mono">{subjectMarksStats.avgScore} <span className="text-[10px] font-normal text-blue-700">/ {currentMaxMarks}</span></span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Highest Score</span>
                <span className="text-base font-black text-emerald-900 font-mono">{subjectMarksStats.highestScore}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-[10px] font-bold text-indigo-700 uppercase block">Pass Rate (&gt;=33%)</span>
                <span className="text-base font-black text-indigo-900 font-mono">{subjectMarksStats.passPercentage}%</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${subjectMarksStats.missingCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <span className="text-[10px] font-bold uppercase block">Missing Marks</span>
                <span className="text-base font-black font-mono">{subjectMarksStats.missingCount}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${subjectMarksStats.absentCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <span className="text-[10px] font-bold uppercase block">Absent Students</span>
                <span className="text-base font-black font-mono">{subjectMarksStats.absentCount}</span>
              </div>
            </div>

            {/* CBSE Grade Distribution Strip */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-bold text-slate-500 mr-1 text-[10px] uppercase">Grade Scale:</span>
              {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D', 'E/F'] as const).map((grd) => (
                <span
                  key={grd}
                  className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                    grd === 'E/F'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : grd.startsWith('A')
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  {grd}: {subjectMarksStats.gradeCounts[grd] || 0}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Filter Pill Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold gap-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setMarksFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  marksFilter === 'ALL' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Students ({subjectMarksStats.totalStudents})
              </button>
              <button
                type="button"
                onClick={() => setMarksFilter('MISSING')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  marksFilter === 'MISSING'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : subjectMarksStats.missingCount > 0
                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Missing Marks ({subjectMarksStats.missingCount})
              </button>
              <button
                type="button"
                onClick={() => setMarksFilter('ABSENT')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  marksFilter === 'ABSENT'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : subjectMarksStats.absentCount > 0
                    ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Absent Students ({subjectMarksStats.absentCount})
              </button>
              <button
                type="button"
                onClick={() => setMarksFilter('ENTERED')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  marksFilter === 'ENTERED' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Entered ({subjectMarksStats.enteredCount})
              </button>
            </div>

            {/* Save as Draft & Submit Marks Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSavingMarks || displayedStudents.length === 0}
                onClick={() => handleSaveMarksWithStatus('DRAFT')}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                title="Save progress as draft without finalizing"
              >
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                disabled={isSavingMarks || displayedStudents.length === 0}
                onClick={() => handleSaveMarksWithStatus('SUBMITTED')}
                className="px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="Submit marks officially for administrative review"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Marks</span>
              </button>
            </div>
          </div>

          {/* Marks Entry Sheet */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70 text-xs">
              <div>
                <span className="font-bold text-slate-900">
                  Roster: {activeSubject?.name || 'Subject'}
                </span>
                <span className="text-slate-500 ml-2">
                  Showing {displayedStudents.length} of {enrolledStudents.length} students
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Qualified</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Failed / Absent</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Missing</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-16 text-center">Roll</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Admission No</th>
                    <th className="p-3 w-20 text-center">Absent?</th>
                    <th className="p-3 w-40">Marks (Out of {currentMaxMarks})</th>
                    <th className="p-3 text-center">Grade</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-500">
                        {marksFilter !== 'ALL'
                          ? `No students matching filter "${marksFilter}".`
                          : `No enrolled students found in ${selectedClass?.name || 'this class'}.`}
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map((st) => {
                      const markEntry = marksList.find(
                        (m) =>
                          m.studentId === st.id &&
                          m.subjectId === selectedSubjectId &&
                          m.examId === selectedExamId
                      );

                      const hasMark = markEntry !== undefined;
                      const marksObtained = markEntry?.marksObtained ?? 0;
                      const isAbsent = !!markEntry?.isAbsent;
                      const evalRes = calculateEvaluation(marksObtained, currentMaxMarks);
                      const grade = isAbsent ? 'E/F' : hasMark ? (markEntry.grade || evalRes.grade) : '—';
                      const isPass = !isAbsent && marksObtained >= currentPassMarks;

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/80">
                          <td className="p-3 text-center font-bold text-slate-800">{st.rollNumber}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{st.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Sec {st.section}</span>
                          </td>
                          <td className="p-3 font-mono text-slate-600">{st.admissionNumber}</td>

                          {/* Absent Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isAbsent}
                              onChange={(e) => handleUpdateMark(st, 0, e.target.checked)}
                              className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                              title="Mark Student as Absent"
                            />
                          </td>

                          {/* Marks Input */}
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={currentMaxMarks}
                                disabled={isAbsent}
                                placeholder="0"
                                value={isAbsent ? '0' : hasMark ? marksObtained : ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (val < 0) {
                                    alert('Obtained marks cannot be negative.');
                                    return;
                                  }
                                  if (val > currentMaxMarks) {
                                    alert(`Obtained marks cannot exceed maximum marks (${currentMaxMarks}).`);
                                    return;
                                  }
                                  handleUpdateMark(st, val, false);
                                }}
                                className={`w-24 px-2.5 py-1.5 border rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden ${
                                  isAbsent
                                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                                    : !hasMark
                                    ? 'bg-amber-50/50 border-amber-300'
                                    : 'bg-white border-slate-300'
                                }`}
                              />
                              {!hasMark && !isAbsent && (
                                <span className="text-[10px] font-bold text-amber-600 uppercase">Missing</span>
                              )}
                            </div>
                          </td>

                          {/* Grade Badge */}
                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded font-bold text-[11px] ${
                                grade === 'E/F'
                                  ? 'bg-red-50 text-red-800 border border-red-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {grade}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 text-center">
                            {isAbsent ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                ABSENT
                              </span>
                            ) : hasMark ? (
                              <div className="inline-flex flex-col items-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isPass
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {isPass ? 'QUALIFIED' : 'FAILED'}
                                </span>
                                {markEntry?.submissionStatus && (
                                  <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
                                    {markEntry.submissionStatus}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                MISSING MARK
                              </span>
                            )}
                          </td>

                          {/* Print Report Card */}
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setReportStudent(st);
                                setIsReportModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer text-xs"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Marksheet</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CLASS ADMIT CARDS */}
      {/* ===================================================================== */}
      {activeTab === 'ADMIT_CARDS' && (
        <div className="space-y-4">
          {/* Selectors Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-600 mb-1">Select Examination</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
              >
                {uniqueExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name || ex.title} ({ex.admitCardStatus || 'DRAFT'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
              >
                {examClassOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 bg-white"
              >
                <option value="ALL">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-900 text-sm">
                Admit Cards for {activeClasses.find((c) => c.id === selectedClassId)?.name || 'Class'}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Total Enrolled Candidates: <strong>{enrolledStudents.length}</strong> • Publication Status:{' '}
                <strong
                  className={
                    activeExam?.admitCardStatus === 'PUBLISHED' ? 'text-emerald-700' : 'text-amber-700'
                  }
                >
                  {activeExam?.admitCardStatus || 'DRAFT'}
                </strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {activeExam && (
                <button
                  type="button"
                  onClick={() => handleToggleAdmitCardPublish(activeExam)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeExam.admitCardStatus === 'PUBLISHED'
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  }`}
                >
                  {activeExam.admitCardStatus === 'PUBLISHED' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  <span>{activeExam.admitCardStatus === 'PUBLISHED' ? 'Revoke Publication' : 'Publish Admit Cards'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={enrolledStudents.length === 0}
                onClick={() => {
                  setAdmitCardStudent(enrolledStudents[0]);
                  setAdmitCardClassStudents(enrolledStudents);
                  setIsAdmitCardModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-700/20 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Generate & Print All Class Cards ({enrolledStudents.length})</span>
              </button>
            </div>
          </div>

          {/* Student Cards List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-16 text-center">Roll</th>
                    <th className="p-3 w-14 text-center">Photo</th>
                    <th className="p-3">Candidate Name</th>
                    <th className="p-3">Admission No</th>
                    <th className="p-3">Class & Section</th>
                    <th className="p-3">Father's Name</th>
                    <th className="p-3 text-center">Admit Card Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrolledStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-500">
                        No enrolled candidates found in this class.
                      </td>
                    </tr>
                  ) : (
                    enrolledStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50">
                        <td className="p-3 text-center font-bold text-slate-800">{st.rollNumber}</td>
                        <td className="p-3 text-center">
                          {st.photo && fileUploadService.getFileUrl(st.photo) ? (
                            <img
                              src={fileUploadService.getFileUrl(st.photo)}
                              alt={st.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-300 mx-auto"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center mx-auto text-xs">
                              {st.name?.charAt(0) || 'S'}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-900">{st.name}</td>
                        <td className="p-3 font-mono text-slate-600">{st.admissionNumber}</td>
                        <td className="p-3 font-medium text-slate-700">{st.className} - {st.section}</td>
                        <td className="p-3 text-slate-600">{st.parentName || st.fatherName || 'Guardian'}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              activeExam?.admitCardStatus === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {activeExam?.admitCardStatus === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setAdmitCardStudent(st);
                              setAdmitCardClassStudents([st]);
                              setIsAdmitCardModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Preview & Print</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: RESULTS & TABULATION SHEET */}
      {/* ===================================================================== */}
      {activeTab === 'RESULTS' && (
        <div className="space-y-4">
          {/* Selectors Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-600 mb-1">Select Examination</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
              >
                {uniqueExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name || ex.title} ({ex.resultsStatus || 'DRAFT'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
              >
                {examClassOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 bg-white"
              >
                <option value="ALL">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Publishing & Summary Strip */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Consolidated Tabulation Sheet: {activeClasses.find((c) => c.id === selectedClassId)?.name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    activeExam?.resultsStatus === 'PUBLISHED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Results: {activeExam?.resultsStatus || 'DRAFT'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadResultSheet}
                className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download complete class tabulation & result sheet as standalone HTML"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Download Result Sheet</span>
              </button>

              <button
                type="button"
                onClick={handlePrintResultSheet}
                className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Print complete class tabulation & result sheet (A4 Landscape)"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Print Result Sheet</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadAllMarksheets}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Download all student marksheets in one file (1 student per page)"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Download All Marksheets</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkReportStudents(enrolledStudents);
                  setIsBulkReportModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Preview and print all marksheets in the class (one student per page)"
              >
                <Eye className="w-4 h-4 text-blue-700" />
                <span>Print All Marksheets</span>
              </button>

              {activeExam && canManageExams && (
                <button
                  type="button"
                  onClick={() => handleToggleResultsPublish(activeExam)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeExam.resultsStatus === 'PUBLISHED'
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                      : 'bg-blue-700 hover:bg-blue-800 text-white shadow-md shadow-blue-700/20'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>
                    {activeExam.resultsStatus === 'PUBLISHED'
                      ? 'Revert to DRAFT'
                      : 'Publish Results'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Tabulation Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-16 text-center">Roll</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Admission No</th>
                    {classAvailableSubjects.map((sub) => (
                      <th key={sub.id} className="p-3 text-center">
                        {sub.code || sub.name}
                        <div className="font-normal text-[10px] text-slate-500">({sub.maxMarks || 100})</div>
                      </th>
                    ))}
                    <th className="p-3 text-center">Total Marks</th>
                    <th className="p-3 text-center">%</th>
                    <th className="p-3 text-center">Grade</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Report Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrolledStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8 + classAvailableSubjects.length} className="p-10 text-center text-slate-500">
                        No enrolled students found in this class.
                      </td>
                    </tr>
                  ) : (
                    enrolledStudents.map((st) => {
                      const stMarks = marksList.filter((m) => m.studentId === st.id);
                      const activeSubIds = new Set(classAvailableSubjects.map((s) => s.id));
                      const relevantMarks = stMarks.filter((m) => activeSubIds.has(m.subjectId));
                      const totalMax = relevantMarks.reduce((acc, m) => acc + (m.maxMarks || 100), 0);
                      const totalObtained = relevantMarks.reduce((acc, m) => acc + (m.isAbsent ? 0 : m.marksObtained || 0), 0);
                      const evalRes = totalMax > 0 ? calculateEvaluation(totalObtained, totalMax) : null;

                      return (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="p-3 text-center font-bold text-slate-800">{st.rollNumber}</td>
                          <td className="p-3 font-bold text-slate-900">{st.name}</td>
                          <td className="p-3 font-mono text-slate-600">{st.admissionNumber}</td>

                          {classAvailableSubjects.map((sub) => {
                            const sm = stMarks.find((m) => m.subjectId === sub.id);
                            return (
                              <td key={sub.id} className="p-3 text-center">
                                {sm ? (
                                  sm.isAbsent ? (
                                    <span className="text-red-600 font-bold">AB</span>
                                  ) : (
                                    <span className="font-semibold text-slate-900">{sm.marksObtained}</span>
                                  )
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="p-3 text-center font-bold text-slate-900">
                            {totalMax > 0 ? `${totalObtained} / ${totalMax}` : '—'}
                          </td>
                          <td className="p-3 text-center font-semibold text-slate-800">
                            {evalRes ? `${evalRes.percentage}%` : '—'}
                          </td>
                          <td className="p-3 text-center font-bold text-blue-800">
                            {evalRes ? evalRes.grade : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {evalRes ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  evalRes.status === 'PASS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {evalRes.status}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setReportStudent(st);
                                  setIsReportModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer text-xs"
                                title="Preview and print official marksheet"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Card</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadSingleMarksheetAction(st)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer text-xs"
                                title="Download report card PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Standalone Printable Result Sheet Container (Rendered during Print Result Sheet) */}
          <div id="printable-result-sheet" className="hidden print:block font-sans text-slate-900 bg-white p-4">
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getSchoolLogoSrc(settings.schoolLogo) && (
                  <img
                    src={getSchoolLogoSrc(settings.schoolLogo)}
                    className="w-14 h-14 object-contain"
                    alt={settings.schoolName}
                  />
                )}
                <div>
                  <h1 className="text-base font-extrabold uppercase text-[#0b1f4b] tracking-wide">
                    {settings.schoolName || 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE'}
                  </h1>
                  <p className="text-[10px] text-slate-600">{settings.schoolAddress}</p>
                  <p className="text-[10px] font-semibold text-slate-700">
                    {letterheadLine(savedSchoolIdentity(settings)) || 'School details not configured'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-xs font-extrabold uppercase text-slate-900 tracking-wide">
                  Official Tabulation & Result Sheet
                </h2>
                <p className="text-[10px] font-bold text-slate-700 mt-0.5">
                  {activeExam?.name || activeExam?.title} • Session {activeExam?.academicSession || settings.currentAcademicSession || '2026-2027'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 border border-slate-300 px-3 py-1.5 text-[11px] mb-3 rounded">
              <div>Class: <strong className="text-slate-900">{selectedClass?.name || 'Class'}</strong></div>
              <div>Section: <strong className="text-slate-900">{selectedSection === 'ALL' || !selectedSection ? 'All Sections' : `Section ${selectedSection}`}</strong></div>
              <div>Total Candidates: <strong className="text-slate-900">{enrolledStudents.length}</strong></div>
              <div>Assigned Subjects: <strong className="text-slate-900">{classAvailableSubjects.length}</strong></div>
              <div>Generated: <strong className="text-slate-900">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
            </div>

            <table className="w-full border-collapse border border-slate-800 text-[10px] mb-3">
              <thead>
                <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-center">
                  <th className="border border-slate-700 p-1.5 w-8">Roll</th>
                  <th className="border border-slate-700 p-1.5 text-left w-36">Student Name</th>
                  <th className="border border-slate-700 p-1.5 w-20">Admission No</th>
                  {classAvailableSubjects.map((sub) => (
                    <th key={sub.id} className="border border-slate-700 p-1.5 text-center">
                      {sub.code || sub.name}
                      <div className="font-normal text-[8px] text-slate-600">({sub.maxMarks || 100})</div>
                    </th>
                  ))}
                  <th className="border border-slate-700 p-1.5 w-16">Total Marks</th>
                  <th className="border border-slate-700 p-1.5 w-12">%</th>
                  <th className="border border-slate-700 p-1.5 w-12">Grade</th>
                  <th className="border border-slate-700 p-1.5 w-14">Status</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudents.map((st) => {
                  const stMarks = marksList.filter((m) => m.studentId === st.id);
                  const activeSubIds = new Set(classAvailableSubjects.map((s) => s.id));
                  const relevantMarks = stMarks.filter((m) => activeSubIds.has(m.subjectId));
                  const totalMax = relevantMarks.reduce((acc, m) => acc + (m.maxMarks || 100), 0);
                  const totalObtained = relevantMarks.reduce((acc, m) => acc + (m.isAbsent ? 0 : m.marksObtained || 0), 0);
                  const evalRes = totalMax > 0 ? calculateEvaluation(totalObtained, totalMax) : null;

                  return (
                    <tr key={st.id} className="border-b border-slate-400">
                      <td className="border border-slate-400 p-1 text-center font-bold">{st.rollNumber || '—'}</td>
                      <td className="border border-slate-400 p-1 text-left font-bold">{st.name}</td>
                      <td className="border border-slate-400 p-1 text-center font-mono">{st.admissionNumber}</td>
                      {classAvailableSubjects.map((sub) => {
                        const sm = stMarks.find((m) => m.subjectId === sub.id);
                        return (
                          <td key={sub.id} className="border border-slate-400 p-1 text-center font-semibold">
                            {sm ? (
                              sm.isAbsent ? (
                                <span className="text-red-700 font-bold">AB</span>
                              ) : (
                                sm.marksObtained
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-slate-400 p-1 text-center font-bold">
                        {totalMax > 0 ? `${totalObtained} / ${totalMax}` : '—'}
                      </td>
                      <td className="border border-slate-400 p-1 text-center font-semibold">
                        {evalRes ? `${evalRes.percentage}%` : '—'}
                      </td>
                      <td className={`border border-slate-400 p-1 text-center font-bold ${evalRes?.status === 'PASS' ? 'text-emerald-800' : 'text-red-700'}`}>
                        {evalRes?.grade || '—'}
                      </td>
                      <td className={`border border-slate-400 p-1 text-center font-bold ${evalRes?.status === 'PASS' ? 'text-emerald-800' : 'text-red-700'}`}>
                        {evalRes?.status || 'Pending'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Summary Statistics */}
            <div className="grid grid-cols-5 gap-2 text-[10px] mb-4">
              <div className="border border-slate-300 p-2 rounded bg-slate-50 text-center">
                <span className="text-slate-500 uppercase block text-[8.5px]">Total Enrolled</span>
                <span className="font-bold text-slate-900 text-xs">{enrolledStudents.length}</span>
              </div>
              <div className="border border-slate-300 p-2 rounded bg-slate-50 text-center">
                <span className="text-slate-500 uppercase block text-[8.5px]">Appeared</span>
                <span className="font-bold text-slate-900 text-xs">
                  {enrolledStudents.filter((st) => marksList.some((m) => m.studentId === st.id)).length}
                </span>
              </div>
              <div className="border border-slate-300 p-2 rounded bg-slate-50 text-center">
                <span className="text-slate-500 uppercase block text-[8.5px]">Passed</span>
                <span className="font-bold text-emerald-800 text-xs">
                  {enrolledStudents.filter((st) => {
                    const rel = marksList.filter((m) => m.studentId === st.id && classAvailableSubjects.some((s) => s.id === m.subjectId));
                    const totMax = rel.reduce((acc, m) => acc + (m.maxMarks || 100), 0);
                    const totObt = rel.reduce((acc, m) => acc + (m.isAbsent ? 0 : m.marksObtained || 0), 0);
                    return totMax > 0 && calculateEvaluation(totObt, totMax).status === 'PASS';
                  }).length}
                </span>
              </div>
              <div className="border border-slate-300 p-2 rounded bg-slate-50 text-center">
                <span className="text-slate-500 uppercase block text-[8.5px]">Failed / Repeat</span>
                <span className="font-bold text-red-700 text-xs">
                  {enrolledStudents.filter((st) => {
                    const rel = marksList.filter((m) => m.studentId === st.id && classAvailableSubjects.some((s) => s.id === m.subjectId));
                    const totMax = rel.reduce((acc, m) => acc + (m.maxMarks || 100), 0);
                    const totObt = rel.reduce((acc, m) => acc + (m.isAbsent ? 0 : m.marksObtained || 0), 0);
                    return totMax > 0 && calculateEvaluation(totObt, totMax).status === 'FAIL';
                  }).length}
                </span>
              </div>
              <div className="border border-slate-300 p-2 rounded bg-slate-50 text-center">
                <span className="text-slate-500 uppercase block text-[8.5px]">Pass %</span>
                <span className="font-bold text-blue-900 text-xs">
                  {(() => {
                    const appeared = enrolledStudents.filter((st) => marksList.some((m) => m.studentId === st.id)).length;
                    const passed = enrolledStudents.filter((st) => {
                      const rel = marksList.filter((m) => m.studentId === st.id && classAvailableSubjects.some((s) => s.id === m.subjectId));
                      const totMax = rel.reduce((acc, m) => acc + (m.maxMarks || 100), 0);
                      const totObt = rel.reduce((acc, m) => acc + (m.isAbsent ? 0 : m.marksObtained || 0), 0);
                      return totMax > 0 && calculateEvaluation(totObt, totMax).status === 'PASS';
                    }).length;
                    return appeared > 0 ? `${Math.round((passed / appeared) * 1000) / 10}%` : '0%';
                  })()}
                </span>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-4 gap-4 text-center text-[9px] pt-4 mt-4">
              <div>
                <div className="h-8 border-b border-dashed border-slate-500 mb-1"></div>
                <span className="font-semibold text-slate-700 uppercase">Class Teacher</span>
              </div>
              <div>
                <div className="h-8 border-b border-dashed border-slate-500 mb-1"></div>
                <span className="font-semibold text-slate-700 uppercase">Tabulator</span>
              </div>
              <div>
                <div className="h-8 border-b border-dashed border-slate-500 mb-1"></div>
                <span className="font-semibold text-slate-700 uppercase">Examination Incharge</span>
              </div>
              <div>
                <div className="h-8 border-b border-dashed border-slate-500 mb-1 flex items-end justify-center">
                  {settings.principalSignature && (
                    <img
                      src={fileUploadService.getFileUrl(settings.principalSignature)}
                      alt="Principal Signature"
                      className="max-h-7 object-contain"
                    />
                  )}
                </div>
                <span className="font-bold text-slate-900 uppercase">{settings.principalName || 'Principal'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS */}
      {/* ===================================================================== */}
      <ExamCreateEditModal
        isOpen={isCreateEditModalOpen}
        onClose={() => setIsCreateEditModalOpen(false)}
        exam={editingExam}
        settings={settings}
        onSaved={(savedExam) => {
          setSelectedExamId(savedExam.id);
          setFeedbackMessage({
            type: 'success',
            text: `Examination "${savedExam.name || savedExam.title}" saved.${examFeeNote(savedExam)}`,
          });
          setTimeout(() => setFeedbackMessage(null), 4000);
        }}
      />

      {isAdmitCardModalOpen && activeExam && (
        <PrintableAdmitCardModal
          student={admitCardStudent}
          students={admitCardClassStudents}
          exam={activeExam}
          isOpen={isAdmitCardModalOpen}
          onClose={() => setIsAdmitCardModalOpen(false)}
          settings={settings}
        />
      )}

      {reportStudent && isReportModalOpen && (
        <PrintableReportCardModal
          student={reportStudent}
          subjects={classAvailableSubjects}
          isOpen={isReportModalOpen}
          onClose={() => {
            setReportStudent(null);
            setIsReportModalOpen(false);
          }}
          settings={settings}
          examId={selectedExamId}
        />
      )}

      {isBulkReportModalOpen && (
        <PrintableReportCardModal
          students={bulkReportStudents || enrolledStudents}
          subjects={classAvailableSubjects}
          isBulk={true}
          isOpen={isBulkReportModalOpen}
          onClose={() => {
            setBulkReportStudents(null);
            setIsBulkReportModalOpen(false);
          }}
          settings={settings}
          examId={selectedExamId}
        />
      )}

      {/* ===================================================================== */}
      {/* DELETE CONFIRMATION MODAL (Admin Only) */}
      {/* ===================================================================== */}
      {examToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">Delete Examination</h3>
                <p className="text-xs text-slate-600">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-slate-900 font-bold">"{examToDelete.name || examToDelete.title}"</strong>?
                </p>
              </div>

              <div className="bg-red-50 rounded-xl p-3.5 border border-red-100 text-xs text-red-700 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Permanent deletion</span>
                </p>
                <p className="text-[11px] leading-relaxed text-red-600">
                  This will safely delete this examination record, all {examToDelete.schedule?.length || 0} scheduled subject paper(s), recorded student marks, admit cards, and publication notices from the database.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExamToDelete(null)}
                  disabled={isDeletingExam}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteExam}
                  disabled={isDeletingExam}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingExam ? 'Deleting...' : 'Yes, Delete Examination'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
