import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  QrCode,
  GraduationCap,
  Printer,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  FileCheck,
  Award,
  Phone,
  Calendar,
  Loader2,
  Eye,
  BookOpen,
  ArrowRight,
  Info,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { SchoolSettings, Student, Exam, ExamMark, Subject, User as UserType } from '../../types';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { fileUploadService } from '../../services/fileUploadService';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { StudentIdCard } from '../common/StudentIdCard';
import { PrintableIdCardModal } from '../modals/PrintableIdCardModal';
import { PrintableReportCardModal } from '../modals/PrintableReportCardModal';
import { calculateEvaluation, getPromotionalStatus } from '../../utils/grading';
import { exportIdCardToPdf } from '../../utils/idCardPdfExporter';
import { exportReportCardToPdf } from '../../utils/reportCardPdfExporter';
import { classLabel, classSectionLabel } from '../../utils/classLabel';
import { apiFetch } from '../../services/apiConfig';

interface ParentReportsViewProps {
  currentUser?: UserType;
  settings: SchoolSettings;
  onNavigate?: (module: string) => void;
}

export const ParentReportsView: React.FC<ParentReportsViewProps> = ({
  currentUser: propUser,
  settings,
  onNavigate,
}) => {
  const user = propUser || authService.getCurrentUser() || authService.getStoredUser();
  const academicSession =
    api.getActiveAcademicSession()?.name || settings.currentAcademicSession || '2026-2027';

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [parentChildren, setParentChildren] = useState<Student[]>([]);
  const [activeChildId, setActiveChildId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'STUDENT_ID' | 'MARKSHEET'>('STUDENT_ID');

  // ID Card State
  const [idCardSide, setIdCardSide] = useState<'flip' | 'both' | 'front' | 'back'>('flip');
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState<boolean>(false);
  const [isExportingIdCard, setIsExportingIdCard] = useState<boolean>(false);
  const [idCardFeedback, setIdCardFeedback] = useState<string | null>(null);

  // Marksheet State
  const [exams, setExams] = useState<Exam[]>([]);
  // Report card session: defaults to the school's active session, parent may pick an earlier one.
  const [selectedSession, setSelectedSession] = useState<string>(academicSession);
  const [examsState, setExamsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [examsError, setExamsError] = useState<string>('');
  const examsRequestSeq = useRef(0);
  const [remoteSessionNames, setRemoteSessionNames] = useState<string[]>([]);
  useEffect(() => {
    // Parent settings do not include the session list, so read it from the sessions API.
    let alive = true;
    apiFetch('/api/academic-sessions')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data?.data) ? data.data : [];
        if (alive) setRemoteSessionNames(list.map((x: any) => x?.name).filter(Boolean));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const sessionOptions = useMemo(() => {
    const names = [...remoteSessionNames, ...(api.getAcademicSessions() || []).map((s) => s.name)].filter(Boolean);
    if (!names.includes(academicSession)) names.push(academicSession);
    return Array.from(new Set(names)).sort((a, b) => b.localeCompare(a));
  }, [academicSession, remoteSessionNames]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [examMarks, setExamMarks] = useState<ExamMark[]>([]);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [loadingMarks, setLoadingMarks] = useState<boolean>(false);
  const [isReportCardModalOpen, setIsReportCardModalOpen] = useState<boolean>(false);
  const [isExportingReportPdf, setIsExportingReportPdf] = useState<boolean>(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  // Real-time listener for updates to exams, marks, or students
  useRealtimeListener(['EXAM', 'STUDENT'], () => {
    refreshAllData(true);
  });

  // Load initial cached children linked to parent
  const loadInitialChildren = useCallback(() => {
    const cachedStudents = api.getStudents();
    const linkedIds = [
      ...(Array.isArray(user?.linkedStudentIds) ? user.linkedStudentIds : []),
      ...(user?.activeStudentId ? [user.activeStudentId] : []),
      ...(user?.studentId ? [user.studentId] : []),
    ];
    const cleanPhone = (user?.phone || user?.username || '').replace(/\D/g, '').slice(-10);

    const matched = cachedStudents.filter((s) => {
      const matchLinked = linkedIds.includes(s.id) || linkedIds.includes(s.admissionNumber);
      if (matchLinked) return true;
      if (cleanPhone.length >= 10) {
        const pPhone = (s.parentPhone || '').replace(/\D/g, '').slice(-10);
        const fPhone = (s.fatherMobile || '').replace(/\D/g, '').slice(-10);
        const mPhone = (s.motherMobile || '').replace(/\D/g, '').slice(-10);
        const gPhone = (s.guardianMobile || '').replace(/\D/g, '').slice(-10);
        const mob = (s.mobile || '').replace(/\D/g, '').slice(-10);
        return (
          pPhone === cleanPhone ||
          fPhone === cleanPhone ||
          mPhone === cleanPhone ||
          gPhone === cleanPhone ||
          mob === cleanPhone
        );
      }
      return false;
    });

    const uniqueMap = new Map<string, Student>();
    matched.forEach((s) => uniqueMap.set(s.id, s));
    return Array.from(uniqueMap.values());
  }, [user]);

  // Fetch verified children from backend
  const refreshChildren = async (isManual = false) => {
    if (isManual) setSyncing(true);
    else setLoading(true);

    try {
      const serverChildren = await api.fetchLinkedChildren();
      if (Array.isArray(serverChildren) && serverChildren.length > 0) {
        setParentChildren(serverChildren);
        setActiveChildId((prev) => {
          if (prev && serverChildren.some((c) => c.id === prev)) return prev;
          if (user?.activeStudentId && serverChildren.some((c) => c.id === user.activeStudentId)) {
            return user.activeStudentId;
          }
          return serverChildren[0].id;
        });
      } else {
        const fallback = loadInitialChildren();
        if (fallback.length > 0) {
          setParentChildren(fallback);
          setActiveChildId((prev) => (prev ? prev : fallback[0].id));
        }
      }
    } catch (err) {
      console.warn('[ParentReportsView] Error refreshing linked children:', err);
      const fallback = loadInitialChildren();
      setParentChildren(fallback);
      if (fallback.length > 0 && !activeChildId) {
        setActiveChildId(fallback[0].id);
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    refreshChildren();
  }, []);

  // Currently selected child
  const selectedChild = useMemo(() => {
    return parentChildren.find((c) => c.id === activeChildId) || parentChildren[0] || null;
  }, [parentChildren, activeChildId]);

  // Load published exams and subjects whenever active child changes
  const loadExamsForChild = useCallback(async (child: Student) => {
    if (!child) return;
    const seq = ++examsRequestSeq.current;
    setExamsState('loading');
    setExamsError('');
    try {
      // Published exams for this child's class in the selected session
      const fetchedExams = await api.fetchExams({
        classId: child.classId,
        studentId: child.id,
        // Results visibility is decided by resultsStatus. Exam status moves on to
        // ONGOING/COMPLETED after the exam, and requiring PUBLISHED hid those results.
        resultsStatus: 'PUBLISHED',
        academicSession: selectedSession,
      });
      if (seq !== examsRequestSeq.current) return; // a newer child/session request won

      const publishedExams = (fetchedExams || []).filter((e) => {
        if (e.status === 'DRAFT') return false;
        if (e.academicSession && e.academicSession !== selectedSession) return false;
        return (
          e.resultsStatus === 'PUBLISHED' ||
          e.isApprovedByPrincipal === true ||
          (e as any).resultsPublished === true
        );
      });

      setExams(publishedExams);
      setSelectedExamId((prev) => {
        if (prev && publishedExams.some((e) => e.id === prev)) return prev;
        return publishedExams[0]?.id || '';
      });

      if (child.classId) {
        const subs = await api.fetchClassSubjects(child.classId);
        if (seq !== examsRequestSeq.current) return;
        setClassSubjects(subs || []);
      }
      setExamsState('ready');
    } catch (err) {
      if (seq !== examsRequestSeq.current) return;
      console.warn('[ParentReportsView] Error loading exams for child:', err);
      setExams([]);
      setSelectedExamId('');
      setExamsState('error');
      setExamsError('Could not load examinations. Please check your connection and try again.');
    }
  }, [selectedSession]);

  const handleSessionChange = (next: string) => {
    if (next === selectedSession) return;
    // Clear everything that belonged to the previous session before loading the new one.
    setSelectedExamId('');
    setExamMarks([]);
    setExams([]);
    setSelectedSession(next);
  };

  useEffect(() => {
    if (selectedChild) {
      loadExamsForChild(selectedChild);
    }
  }, [selectedChild, loadExamsForChild]);

  // Load marks whenever selected exam or active child changes
  const loadMarksForExamAndChild = useCallback(async () => {
    if (!selectedExamId || !selectedChild) {
      setExamMarks([]);
      return;
    }

    setLoadingMarks(true);
    try {
      const marks = await api.fetchExamMarks(
        selectedExamId,
        selectedChild.classId,
        undefined,
        selectedChild.id
      );
      // Ensure only marks for the selected child are stored
      const filtered = (marks || []).filter(
        (m) =>
          m.studentId === selectedChild.id ||
          m.studentId === selectedChild.admissionNumber
      );
      setExamMarks(filtered);
    } catch (err) {
      console.warn('[ParentReportsView] Error loading exam marks:', err);
      setExamMarks([]);
    } finally {
      setLoadingMarks(false);
    }
  }, [selectedExamId, selectedChild]);

  useEffect(() => {
    loadMarksForExamAndChild();
  }, [loadMarksForExamAndChild]);

  // Child switch handler
  const handleSelectChild = async (childId: string) => {
    if (childId === activeChildId) return;
    setActiveChildId(childId);
    try {
      await authService.switchChild(childId);
      const fresh = await api.fetchStudentDirect(childId);
      if (fresh) {
        setParentChildren((prev) => {
          const idx = prev.findIndex((p) => p.id === fresh.id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = fresh;
            return updated;
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn('[ParentReportsView] switchChild notification:', e);
    }
  };

  const refreshAllData = async (isSilent = false) => {
    if (!isSilent) setSyncing(true);
    try {
      await refreshChildren(true);
      if (selectedChild) {
        await loadExamsForChild(selectedChild);
        await loadMarksForExamAndChild();
      }
    } finally {
      setSyncing(false);
    }
  };

  // Compute marks evaluation for the selected exam
  const currentExam = useMemo(() => {
    return exams.find((e) => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  const marksEvaluation = useMemo(() => {
    if (!selectedChild || examMarks.length === 0) {
      return {
        hasMarks: false,
        totalObtained: 0,
        totalMax: 0,
        percentage: 0,
        overallGrade: 'N/A',
        resultStatus: 'PENDING',
        evalRows: [],
      };
    }

    let totalObt = 0;
    let totalMx = 0;

    const subjectNameById = new Map<string, string>();
    for (const sub of [...(api.getSubjects() || []), ...classSubjects]) {
      if (sub?.id && sub?.name) subjectNameById.set(sub.id, sub.name);
    }

    const evalRows = examMarks.map((m) => {
      const max = m.maxMarks || 100;
      const isAbsent = (m as any).isAbsent || m.status === 'ABSENT';
      const obt = isAbsent ? 0 : (m.marksObtained ?? 0);
      totalMx += max;
      if (!isAbsent) {
        totalObt += obt;
      }

      const evalRes = calculateEvaluation(obt, max);
      return {
        ...m,
        subjectName: (m as any).subjectName || subjectNameById.get(m.subjectId) || 'Subject not recorded',
        maxMarks: max,
        marksObtained: isAbsent ? 'ABSENT' : obt,
        isAbsent,
        grade: isAbsent ? 'AB' : m.grade || evalRes.grade,
        gradePoint: isAbsent ? 0 : evalRes.gradePoint,
        remark: isAbsent ? 'Absent from assessment' : evalRes.remark,
        status: isAbsent ? 'ABSENT' : evalRes.status,
      };
    });

    const overall = calculateEvaluation(totalObt, totalMx);
    const promo = getPromotionalStatus(totalObt, totalMx);

    return {
      hasMarks: true,
      totalObtained: totalObt,
      totalMax: totalMx,
      percentage: overall.percentage,
      overallGrade: overall.grade,
      resultStatus: promo.badgeText,
      promoRemark: promo.remark,
      evalRows,
    };
  }, [selectedChild, examMarks, classSubjects]);

  // ID Card PDF Download Handler
  const handleDownloadIdCardPdf = async () => {
    if (!selectedChild || isExportingIdCard) return;
    setIsExportingIdCard(true);
    setIdCardFeedback('Generating high-resolution ID Card PDF...');

    try {
      const fileName = `StudentID_${selectedChild.admissionNumber}_${selectedChild.name.replace(/\s+/g, '_')}.pdf`;
      // The PDF always has both sides, so lay them out side by side for the capture.
      const wasFlip = idCardSide === 'flip';
      if (wasFlip) {
        setIdCardSide('both');
        await new Promise((r) => setTimeout(r, 350));
      }
      let success = false;
      try {
        success = await exportIdCardToPdf('parent-child-id-card-preview', fileName);
      } finally {
        if (wasFlip) setIdCardSide('flip');
      }
      if (success) {
        setIdCardFeedback('ID Card downloaded successfully!');
        setTimeout(() => setIdCardFeedback(null), 3000);
      } else {
        setIdCardFeedback('Unable to download PDF. Opening print dialog...');
        setIsIdCardModalOpen(true);
        setTimeout(() => setIdCardFeedback(null), 3500);
      }
    } catch (err) {
      console.error('[ParentReportsView] Error downloading ID card:', err);
      setIdCardFeedback('Download failed. Please try printing directly.');
      setTimeout(() => setIdCardFeedback(null), 3500);
    } finally {
      setIsExportingIdCard(false);
    }
  };

  // Marksheet PDF Download Handler
  const handleDownloadMarksheetPdf = async () => {
    if (!selectedChild || !currentExam || isExportingReportPdf) return;
    setIsExportingReportPdf(true);
    setReportFeedback('Compiling official A4 Marksheet PDF...');

    try {
      const success = await exportReportCardToPdf({
        student: selectedChild,
        exam: currentExam,
        settings,
        subjects: classSubjects,
        marksList: examMarks,
      });

      if (success) {
        setReportFeedback('Marksheet downloaded successfully!');
        setTimeout(() => setReportFeedback(null), 3000);
      } else {
        setReportFeedback('PDF creation failed. Opening print preview...');
        setIsReportCardModalOpen(true);
        setTimeout(() => setReportFeedback(null), 3500);
      }
    } catch (err) {
      console.error('[ParentReportsView] Error downloading marksheet:', err);
      setReportFeedback('Download failed. Opening preview modal...');
      setIsReportCardModalOpen(true);
      setTimeout(() => setReportFeedback(null), 3500);
    } finally {
      setIsExportingReportPdf(false);
    }
  };

  // Loading State
  if (loading && parentChildren.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
        <RefreshCw className="w-9 h-9 text-blue-600 animate-spin mb-3" />
        <h3 className="text-sm font-bold text-slate-800">Loading Student Reports & ID Cards</h3>
        <p className="text-xs text-slate-500 mt-1">Retrieving official academic records from school database...</p>
      </div>
    );
  }

  // No Linked Children Found
  if (!loading && parentChildren.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">No Linked Students Found</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No enrolled students are currently linked to your registered mobile number ({user?.phone || 'Registered Phone'}).
            Please contact the school administrative office to link your children.
          </p>
        </div>
        <button
          onClick={() => refreshChildren(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Records</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Institutional Top Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Reports & ID Cards
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Session {academicSession}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {user?.role === 'STUDENT' ? 'Student Portal' : 'Parent Portal'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Official Student Identity Cards & Published Examination Marksheets • {settings.schoolName || 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshAllData(false)}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Synchronize records with school database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Refresh Records'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Child Selector (Multi-Child Support) */}
      {parentChildren.length > 1 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Select Child:</span>
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              {parentChildren.length} Children Linked
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {parentChildren.map((child) => {
              const isSelected = child.id === selectedChild?.id;
              const photoUrl = child.photo ? fileUploadService.getFileUrl(child.photo) : null;

              return (
                <button
                  key={child.id}
                  onClick={() => handleSelectChild(child.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-400'
                      : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center font-bold text-xs text-blue-700">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={child.name}
                        className="w-full h-full object-cover object-top"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{child.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold truncate leading-tight">{child.name}</h4>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {classSectionLabel(child.className, child.section)} • Roll {child.rollNumber || '—'}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">
                      Adm: {child.admissionNumber}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Child Identity Banner */}
      {selectedChild && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white/10 border-2 border-white/20 shrink-0 flex items-center justify-center font-bold text-lg text-white shadow-xs">
              {selectedChild.photo && fileUploadService.getFileUrl(selectedChild.photo) ? (
                <img
                  src={fileUploadService.getFileUrl(selectedChild.photo)}
                  alt={selectedChild.name}
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{selectedChild.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  {selectedChild.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  {selectedChild.status || 'ACTIVE'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-blue-200/90 mt-1">
                <span>Class: <strong className="text-white">{classSectionLabel(selectedChild.className, selectedChild.section)}</strong></span>
                <span>•</span>
                <span>Roll No: <strong className="text-white">{selectedChild.rollNumber || '—'}</strong></span>
                <span>•</span>
                <span>Admission No: <strong className="text-white font-mono">{selectedChild.admissionNumber}</strong></span>
                {selectedChild.bloodGroup && (
                  <>
                    <span>•</span>
                    <span>Blood Group: <strong className="text-white">{selectedChild.bloodGroup}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="bg-white/10 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/10 text-left">
              <span className="block text-[10px] uppercase font-semibold text-blue-200">Guardian / Parent</span>
              <span className="font-bold text-white truncate block max-w-[200px]">
                {selectedChild.fatherName || selectedChild.parentName || user?.name || 'Verified Guardian'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Module Navigation Tabs */}
      <div className="grid grid-cols-2 sm:flex border-b border-slate-200 text-xs font-semibold text-slate-500 sm:overflow-x-auto bg-white px-2 rounded-t-xl border-x" role="tablist">
        <button
          onClick={() => setActiveTab('STUDENT_ID')}
          role="tab"
          aria-selected={activeTab === 'STUDENT_ID'}
          className={`min-h-[48px] py-3 px-2 sm:py-3.5 sm:px-5 border-b-2 text-center sm:text-left whitespace-normal sm:whitespace-nowrap transition-colors flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
            activeTab === 'STUDENT_ID'
              ? 'border-blue-700 text-blue-900 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4 text-blue-600" />
          <span>Student ID Card (with QR)</span>
        </button>

        <button
          onClick={() => setActiveTab('MARKSHEET')}
          role="tab"
          aria-selected={activeTab === 'MARKSHEET'}
          className={`min-h-[48px] py-3 px-2 sm:py-3.5 sm:px-5 border-b-2 text-center sm:text-left whitespace-normal sm:whitespace-nowrap transition-colors flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
            activeTab === 'MARKSHEET'
              ? 'border-emerald-700 text-emerald-900 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-emerald-600" />
          <span>Exam-wise Marksheet & Report Card</span>
          {exams.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">
              {exams.length} Published
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STUDENT ID CARD */}
      {/* ========================================================================= */}
      {activeTab === 'STUDENT_ID' && selectedChild && (
        <div className="space-y-5">
          {/* Action Toolbar for ID Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold">Display Card Side:</span>
              <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                <button
                  onClick={() => setIdCardSide('flip')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    idCardSide === 'flip' ? 'bg-white text-blue-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Flip
                </button>
                <button
                  onClick={() => setIdCardSide('both')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    idCardSide === 'both' ? 'bg-white text-blue-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Both Sides
                </button>
                <button
                  onClick={() => setIdCardSide('front')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    idCardSide === 'front' ? 'bg-white text-blue-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Front
                </button>
                <button
                  onClick={() => setIdCardSide('back')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    idCardSide === 'back' ? 'bg-white text-blue-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Back
                </button>
              </div>
            </div>

            {/* Action Buttons: Preview, Print, Download PDF */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsIdCardModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                title="Open full interactive preview dialog"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Full Preview</span>
              </button>

              <button
                onClick={handleDownloadIdCardPdf}
                disabled={isExportingIdCard}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="Download high-resolution printable ID Card PDF"
              >
                {isExportingIdCard ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>{isExportingIdCard ? 'Generating PDF...' : 'Download Card (PDF)'}</span>
              </button>

              <button
                onClick={() => setIsIdCardModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                title="Print student identity card"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print ID Card</span>
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {idCardFeedback && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{idCardFeedback}</span>
            </div>
          )}

          {/* ID Card Display Area & Information Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Visual Card Render Preview */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center min-h-[460px] overflow-hidden">
              <div className="w-full flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Official Student ID Card Preview</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Standard CR80 HD Format
                </span>
              </div>

              {/* Card Container for html2canvas capture */}
              <div
                id="parent-child-id-card-preview"
                className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200 shadow-inner flex flex-wrap items-center justify-start sm:justify-center gap-6 max-w-full overflow-x-auto"
              >
                <StudentIdCard
                  student={selectedChild}
                  settings={settings}
                  side={idCardSide}
                  idPrefix={`card-${selectedChild.id}`}
                />
              </div>

              <p className="text-[11px] text-slate-400 text-center mt-4">
                The QR code on the back is scanned by teachers to mark attendance. It contains no personal details.
              </p>
            </div>

            {/* Student ID Card Record Details Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5 text-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Card Identity Verification</span>
                </h3>

                <div className="space-y-2.5 divide-y divide-slate-100">
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500">Full Name</span>
                    <strong className="text-slate-900 font-bold">{selectedChild.name}</strong>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Admission Number</span>
                    <span className="font-mono font-bold text-blue-900">{selectedChild.admissionNumber}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Class & Section</span>
                    <span className="font-semibold text-slate-800">
                      {classLabel(selectedChild.className)}{selectedChild.section ? ` • Section ${selectedChild.section}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Roll Number</span>
                    <span className="font-mono font-bold text-slate-800">{selectedChild.rollNumber || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Date of Birth</span>
                    <span className="text-slate-800">{selectedChild.dob || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Blood Group</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                      {selectedChild.bloodGroup || 'O+'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Father / Guardian</span>
                    <span className="text-slate-800 font-medium">
                      {selectedChild.fatherName || selectedChild.parentName || 'Verified Guardian'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Mother&apos;s Name</span>
                    <span className="text-slate-800 font-medium">{selectedChild.motherName || 'Verified Mother'}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Emergency Phone</span>
                    <span className="font-mono text-slate-800 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{selectedChild.emergencyContact || selectedChild.parentPhone || selectedChild.mobile || '—'}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">Valid Academic Session</span>
                    <span className="font-semibold text-blue-700">{academicSession}</span>
                  </div>
                </div>
              </div>

              {/* Institutional Directives Card */}
              <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200 text-xs space-y-2 text-blue-950">
                <h4 className="font-bold flex items-center gap-1.5 text-blue-900">
                  <CheckCircle2 className="w-4 h-4 text-blue-700" />
                  <span>Card Instructions & Replacement</span>
                </h4>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  The Student Identity Card must be displayed during school hours, bus boarding, and examination entry.
                  In case of loss or damage, request a duplicate card through the school administration desk.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXAM-WISE MARKSHEET */}
      {/* ========================================================================= */}
      {activeTab === 'MARKSHEET' && selectedChild && (
        <div className="space-y-5">
          {/* Exam Selection & Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
              {/* Academic Session Selector */}
              <div className="md:col-span-12 flex flex-col sm:flex-row sm:items-center gap-2">
                <label htmlFor="parent-report-session" className="text-slate-700 font-bold whitespace-nowrap text-xs">
                  Academic Session:
                </label>
                <select
                  id="parent-report-session"
                  value={selectedSession}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  className="w-full sm:w-56 min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                >
                  {sessionOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                      {name === academicSession ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Exam Selector */}
              <div className="md:col-span-7 flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-slate-700 font-bold whitespace-nowrap text-xs flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  <span>Select Examination:</span>
                </label>

                {examsState === 'loading' ? (
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium text-xs flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading examinations…
                  </div>
                ) : examsState === 'error' ? (
                  <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-medium text-xs flex items-center gap-2" role="alert">
                    <span>{examsError}</span>
                    <button
                      type="button"
                      onClick={() => selectedChild && loadExamsForChild(selectedChild)}
                      className="ml-auto px-2.5 py-1 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100"
                    >
                      Retry
                    </button>
                  </div>
                ) : exams.length > 0 ? (
                  <select
                    aria-label="Select examination"
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name || ex.title} ({ex.academicSession || selectedSession})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium text-xs">
                    No published examinations for {classLabel(selectedChild.className)} in {selectedSession}
                  </div>
                )}
              </div>

              {/* Marksheet Actions: Print & Download PDF */}
              <div className="md:col-span-5 flex items-center justify-start md:justify-end gap-2 flex-wrap">
                {marksEvaluation.hasMarks && currentExam && (
                  <>
                    <button
                      onClick={handleDownloadMarksheetPdf}
                      disabled={isExportingReportPdf}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      title="Download official A4 Marksheet PDF"
                    >
                      {isExportingReportPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{isExportingReportPdf ? 'Downloading...' : 'Download PDF'}</span>
                    </button>

                    <button
                      onClick={() => setIsReportCardModalOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                      title="Preview and print official Marksheet"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Marksheet</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Selected Exam Notification Banner */}
            {currentExam && (
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-950 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Official Results Declared for: <strong className="font-bold">{currentExam.name || currentExam.title}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                  <span>Start: {currentExam.startDate || '—'}</span>
                  <span>•</span>
                  <span>End: {currentExam.endDate || '—'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Feedback banner */}
          {reportFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{reportFeedback}</span>
            </div>
          )}

          {/* Marks Content or Empty State */}
          {examsState === 'loading' ? null : loadingMarks ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-xs">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">Retrieving Official Examination Marks</h4>
              <p className="text-xs text-slate-500 mt-1">Querying verified marks records from school database...</p>
            </div>
          ) : !currentExam ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Published Examination Available</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Official marks and report cards are only published after evaluation and administrative approval.
                Please check back once the school declares results for session {selectedSession}.
              </p>
            </div>
          ) : !marksEvaluation.hasMarks ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
              <Clock className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">Marks Evaluation in Progress</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The examination <strong>{currentExam.name || currentExam.title}</strong> is active, but individual subject marks
                for {selectedChild.name} ({classLabel(selectedChild.className)}{selectedChild.section ? `-${selectedChild.section}` : ''}) have not been published yet.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Scholastic Evaluation Summary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Total Marks */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Marks Obtained</span>
                  <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
                    {marksEvaluation.totalObtained}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {marksEvaluation.totalMax}</span>
                  </div>
                </div>

                {/* Percentage */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Overall Percentage</span>
                  <div className="text-lg sm:text-xl font-bold font-mono text-emerald-700 mt-1">
                    {marksEvaluation.percentage}%
                  </div>
                </div>

                {/* Overall Grade */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Scholastic Grade</span>
                  <div className="text-lg sm:text-xl font-bold font-mono text-blue-700 mt-1">
                    {marksEvaluation.overallGrade}
                  </div>
                </div>

                {/* Result Status */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Result Status</span>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{marksEvaluation.resultStatus}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Subject-wise Marksheet Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Subject-wise Marks Statement
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {marksEvaluation.evalRows.length} Subjects Evaluated
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="p-3.5">Subject</th>
                        <th className="p-3.5 text-center">Max Marks</th>
                        <th className="p-3.5 text-center">Pass Marks</th>
                        <th className="p-3.5 text-center">Marks Obtained</th>
                        <th className="p-3.5 text-center">Grade</th>
                        <th className="p-3.5 text-center">Status</th>
                        <th className="p-3.5">Teacher Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      {marksEvaluation.evalRows.map((row: any, idx: number) => {
                        const isFail = row.status === 'FAIL' || row.isAbsent;
                        return (
                          <tr key={row.id || idx} className="hover:bg-slate-50/70 transition-colors">
                            {/* Subject */}
                            <td className="p-3.5 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                                <span>{row.subjectName}</span>
                              </div>
                            </td>

                            {/* Max Marks */}
                            <td className="p-3.5 text-center font-mono text-slate-600">
                              {row.maxMarks}
                            </td>

                            {/* Pass Marks */}
                            <td className="p-3.5 text-center font-mono text-slate-500">
                              {Math.round(row.maxMarks * 0.33)}
                            </td>

                            {/* Marks Obtained */}
                            <td className="p-3.5 text-center font-mono font-bold">
                              {row.isAbsent ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold">
                                  ABSENT
                                </span>
                              ) : (
                                <span className={isFail ? 'text-rose-700' : 'text-slate-900'}>
                                  {row.marksObtained}
                                </span>
                              )}
                            </td>

                            {/* Grade */}
                            <td className="p-3.5 text-center">
                              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                                {row.grade}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="p-3.5 text-center">
                              {row.isAbsent ? (
                                <span className="text-[10px] font-bold text-rose-700">ABSENT</span>
                              ) : row.status === 'PASS' ? (
                                <span className="text-[10px] font-bold text-emerald-700">PASS</span>
                              ) : (
                                <span className="text-[10px] font-bold text-rose-700">FAIL</span>
                              )}
                            </td>

                            {/* Remark */}
                            <td className="p-3.5 text-slate-600 text-[11px]">
                              {row.remark || 'Satisfactory'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                      <tr>
                        <td className="p-3.5">Total Aggregate</td>
                        <td className="p-3.5 text-center font-mono">{marksEvaluation.totalMax}</td>
                        <td className="p-3.5 text-center font-mono">{Math.round(marksEvaluation.totalMax * 0.33)}</td>
                        <td className="p-3.5 text-center font-mono text-emerald-800 text-sm">
                          {marksEvaluation.totalObtained}
                        </td>
                        <td className="p-3.5 text-center font-mono text-blue-800">
                          {marksEvaluation.overallGrade}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="text-emerald-700 text-[11px] font-bold">
                            {marksEvaluation.percentage >= 33 ? 'QUALIFIED' : 'REPEAT'}
                          </span>
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-700">
                          {marksEvaluation.promoRemark}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Official CBSE Marksheet Footer Notice */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-500 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p>
                  • Computer-generated marks statement from {settings.schoolName || 'Chanakya Public School & Coaching Centre'}.
                  Grades correspond to the school's scholastic grading scale.
                </p>
                <button
                  onClick={() => setIsReportCardModalOpen(true)}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer shrink-0"
                >
                  <span>Open Full Official Marksheet</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Printable ID Card Modal with Working Back / Close */}
      {selectedChild && (
        <PrintableIdCardModal
          student={selectedChild}
          isOpen={isIdCardModalOpen}
          onClose={() => setIsIdCardModalOpen(false)}
          settings={settings}
        />
      )}

      {/* Printable Report Card Marksheet Modal with Working Back / Close */}
      {selectedChild && currentExam && (
        <PrintableReportCardModal
          student={selectedChild}
          examId={currentExam.id}
          subjects={classSubjects}
          isOpen={isReportCardModalOpen}
          onClose={() => setIsReportCardModalOpen(false)}
          settings={settings}
        />
      )}
    </div>
  );
};
