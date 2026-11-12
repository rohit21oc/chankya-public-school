import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Building2,
  Bed,
  DoorOpen,
  ArrowRightLeft,
  LogOut,
  Bus,
  Calendar,
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  File,
  FileCheck,
  FileText,
  History,
  KeyRound,
  Lock,
  Printer,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  User,
  Users,
  Award,
  Phone,
  Mail,
  MapPin,
  Check,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  HeartPulse,
  UserCheck,
  Activity,
  Layers,
  Sparkles,
  Shield,
  HelpCircle,
  Compass,
} from 'lucide-react';
import {
  AttachedDocument,
  CertificateType,
  Exam,
  ExamMark,
  FeeLedgerEntry,
  FeePayment,
  SchoolSettings,
  Student,
  StudentStatus,
  TransportRoute,
} from '../../types';
import { api } from '../../services/api';
import { calculateGradeFromMarks } from '../../utils/grading';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { fileUploadService } from '../../services/fileUploadService';
import { PrintableStudentProfileModal } from '../modals/PrintableStudentProfileModal';
import { PrintableAdmissionLetterModal } from '../modals/PrintableAdmissionLetterModal';
import { PrintableAdmitCardModal } from '../modals/PrintableAdmitCardModal';
import { PrintableReportCardModal } from '../modals/PrintableReportCardModal';
import { AttendanceCalendar } from '../common/AttendanceCalendar';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { hasPermission } from '../../utils/rbac';
import { NOT_CONFIGURED, affiliationText, schoolIdentity } from '../../utils/schoolIdentity';
import { classSectionOptions, sectionForClass } from '../../utils/classSections';

interface StudentProfileViewProps {
  student: Student;
  settings: SchoolSettings;
  onBack: () => void;
  onUpdate: (updated: Student) => void;
  onEdit: (student: Student) => void;
  onOpenReportCard: (student: Student) => void;
  onOpenIdCard: (student: Student) => void;
  onOpenCertificate: (student: Student, certType: CertificateType) => void;
  onSelectStudent?: (student: Student) => void;
  userRole?: string;
  currentUser?: any;
}

export type ProfileTabType =
  | 'OVERVIEW'
  | 'PERSONAL'
  | 'ACADEMIC'
  | 'PARENT'
  | 'ATTENDANCE'
  | 'FEES'
  | 'EXAMS'
  | 'DOCUMENTS'
  | 'TRANSPORT_HOSTEL'
  | 'PORTAL'
  | 'ACTIVITY';

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  student,
  settings,
  onBack,
  onUpdate,
  onEdit,
  onOpenReportCard,
  onOpenIdCard,
  onOpenCertificate,
  onSelectStudent,
  userRole,
  currentUser: propUser,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTabType>('OVERVIEW');
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isAdmissionLetterOpen, setIsAdmissionLetterOpen] = useState(false);
  const [showAadhaarNumber, setShowAadhaarNumber] = useState(false);

  // Modals for Workflow Actions
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<AttachedDocument | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedDocForVerification, setSelectedDocForVerification] = useState<AttachedDocument | null>(null);

  // Promotion Form State
  const classes = api.getClasses();
  const [promoteTargetClassId, setPromoteTargetClassId] = useState('');
  const [promoteTargetSection, setPromoteTargetSection] = useState('A');
  const [promoteTargetSession, setPromoteTargetSession] = useState(() => {
    // Promotion moves the student into the NEXT session (2026-2027 -> 2027-2028)
    const current = student.academicSession || api.getActiveAcademicSession()?.name || settings.currentAcademicSession || '2026-2027';
    const m = String(current).match(/^(\d{4})-(\d{4})$/);
    return m ? `${Number(m[1]) + 1}-${Number(m[2]) + 1}` : current;
  });
  const [promoteChargeBooks, setPromoteChargeBooks] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteCustomRoll, setPromoteCustomRoll] = useState('');
  const [promoteRemark, setPromoteRemark] = useState('');

  // Status Form State
  const [statusNewValue, setStatusNewValue] = useState<StudentStatus>(student.status);
  const [statusReason, setStatusReason] = useState('');
  const [statusEffectiveDate, setStatusEffectiveDate] = useState(new Date().toISOString().substring(0, 10));

  // Document Verification State
  const [docVerifyRemark, setDocVerifyRemark] = useState('');

  // Portal Credentials state
  const [studentNewPassword, setStudentNewPassword] = useState('');
  const [parentNewPassword, setParentNewPassword] = useState('');
  const [portalMsg, setPortalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResettingStudentPass, setIsResettingStudentPass] = useState(false);
  const [isResettingParentPass, setIsResettingParentPass] = useState(false);

  // Current user & authorization
  const currentUser = propUser || api.getCurrentUser();
  const effectiveUserRole = userRole || currentUser?.role || '';
  const isTeacher = effectiveUserRole === 'TEACHER';
  const isParent = effectiveUserRole === 'PARENT';
  const canEditStudents = !isTeacher && !isParent && (hasPermission(currentUser, 'students.edit') || ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN'].includes(effectiveUserRole));
  const canManageHostel = !isTeacher && !isParent && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'HOSTEL_WARDEN'].includes(effectiveUserRole);
  const canManageTransport = !isTeacher && !isParent && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TRANSPORT_MANAGER', 'ADMIN', 'ACCOUNTANT'].includes(effectiveUserRole);
  const canViewReportCard = hasPermission(currentUser, 'reports.view') || hasPermission(currentUser, 'documents.view');

  useEffect(() => {
    if (isTeacher && !['OVERVIEW', 'PERSONAL', 'ACADEMIC', 'PARENT', 'ATTENDANCE', 'EXAMS'].includes(activeTab)) {
      setActiveTab('OVERVIEW');
    } else if (isParent && !['OVERVIEW', 'PERSONAL', 'ACADEMIC', 'PARENT', 'ATTENDANCE', 'FEES', 'EXAMS', 'DOCUMENTS', 'TRANSPORT_HOSTEL'].includes(activeTab)) {
      setActiveTab('OVERVIEW');
    }
  }, [isTeacher, isParent, activeTab]);

  const [transportRoutesList, setTransportRoutesList] = useState<TransportRoute[]>(() => api.getRoutes());

  useEffect(() => {
    api.fetchTransport().then((data) => {
      if (Array.isArray(data.routes)) setTransportRoutesList(data.routes);
    }).catch(() => {});
  }, []);

  // Transport modal states
  const [isManageTransportModalOpen, setIsManageTransportModalOpen] = useState(false);
  const [transportRouteId, setTransportRouteId] = useState(student.transportRouteId || '');
  const [transportStopId, setTransportStopId] = useState(student.transportStopId || '');
  const [transportRequired, setTransportRequired] = useState(!!student.transportRequired);
  const [transportActionMsg, setTransportActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [transportActionLoading, setTransportActionLoading] = useState(false);

  // Hostel modal states
  const [isHostelDetailsOpen, setIsHostelDetailsOpen] = useState(false);
  const [isChangeBedModalOpen, setIsChangeBedModalOpen] = useState(false);
  const [isVacateBedModalOpen, setIsVacateBedModalOpen] = useState(false);
  const [isAllocateBedModalOpen, setIsAllocateBedModalOpen] = useState(false);
  const [hostelActionMsg, setHostelActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hostelActionLoading, setHostelActionLoading] = useState(false);

  // Form fields for hostel actions
  const [vacateRemarks, setVacateRemarks] = useState('Relocation / session completed');
  const [changeTargetRoomId, setChangeTargetRoomId] = useState('');
  const [changeTargetBedNumber, setChangeTargetBedNumber] = useState('');
  const [changeRemarks, setChangeRemarks] = useState('');
  const [allocTargetHostelId, setAllocTargetHostelId] = useState('');
  const [allocTargetRoomId, setAllocTargetRoomId] = useState('');
  const [allocTargetBedNumber, setAllocTargetBedNumber] = useState('');
  const [allocRemarks, setAllocRemarks] = useState('Student opted in for hostel residency');

  // Associated Data
  const attendanceSummary = api.getStudentAttendanceSummary(student.id);
  const [feePaymentsList, setFeePaymentsList] = useState<FeePayment[]>(() => api.getFeePayments(student.id));
  const [studentLedgers, setStudentLedgers] = useState<FeeLedgerEntry[]>(() => api.getFeeLedgersSync(student.id));
  const [isLoadingFees, setIsLoadingFees] = useState(false);

  const refreshFees = useCallback(async () => {
    try {
      setIsLoadingFees(true);
      const [ledgers, payments] = await Promise.all([
        api.getFeeLedgers({ studentId: student.id }),
        api.fetchFeePayments({ studentId: student.id }),
      ]);
      if (Array.isArray(ledgers)) {
        setStudentLedgers(ledgers);
      }
      if (Array.isArray(payments)) {
        setFeePaymentsList(payments.filter((p) => p.studentId === student.id));
      }
    } catch (err) {
      console.warn('[StudentProfile] Error loading fee ledgers & payments:', err);
    } finally {
      setIsLoadingFees(false);
    }
  }, [student.id]);

  useEffect(() => {
    refreshFees();
  }, [refreshFees]);

  useRealtimeListener(['FEE_LEDGER', 'FEE_PAYMENT', 'STUDENT'], () => {
    refreshFees();
  });

  // Modals for Exam Actions
  const [selectedExamForAdmitCard, setSelectedExamForAdmitCard] = useState<Exam | null>(null);
  const [selectedExamForReportCard, setSelectedExamForReportCard] = useState<Exam | null>(null);
  const [expandedExamMarksId, setExpandedExamMarksId] = useState<string | null>(null);

  // Dynamic Exams State: all published exams applicable to this student's class and section
  const [allExams, setAllExams] = useState<Exam[]>(() => api.getExams());
  const [allStudentMarks, setAllStudentMarks] = useState<ExamMark[]>(() =>
    (api.getExamMarks('') || []).filter((m) => m.studentId === student.id)
  );
  const [isLoadingExams, setIsLoadingExams] = useState(false);

  useEffect(() => {
    setIsLoadingExams(true);
    Promise.allSettled([
      api.fetchExams({ studentId: student.id }),
      api.fetchExamMarks(undefined, student.classId),
      api.syncHostel(),
    ])
      .then(([exRes, marksRes]) => {
        if (exRes.status === 'fulfilled' && Array.isArray(exRes.value)) {
          setAllExams(exRes.value);
        }
        if (marksRes.status === 'fulfilled' && Array.isArray(marksRes.value)) {
          setAllStudentMarks(marksRes.value.filter((m) => m.studentId === student.id));
        }
      })
      .catch((err) => {
        console.warn('[StudentProfile] Error loading exams & marks:', err);
      })
      .finally(() => {
        setIsLoadingExams(false);
      });
  }, [student.id, student.classId, student.section]);

  // Filter strictly by published status and student's active class/section
  const studentPublishedExams = useMemo(() => {
    return (allExams || []).filter((exam) => {
      // Must be published immediately (status === 'PUBLISHED', strictly exclude DRAFT)
      const isPublished = exam.status === 'PUBLISHED' || (!exam.status && (exam as any).isPublished !== false);
      if (!isPublished) return false;

      // Class match: handles classId array, className, or single classId field
      const hasClassIds = Array.isArray(exam.classIds) && exam.classIds.length > 0;
      const classIdMatches = hasClassIds
        ? (exam.classIds.includes(student.classId) || (student.className && exam.classIds.includes(student.className)))
        : ((exam as any).classId === student.classId || (student.className && (exam as any).classId === student.className));

      // Schedule match: check if any paper is scheduled for student's class/section
      const scheduleMatches =
        Array.isArray(exam.schedule) &&
        exam.schedule.some((s) => {
          const cMatch =
            !s.classId ||
            s.classId === student.classId ||
            (student.className && s.className === student.className);
          const secMatch =
            !s.section ||
            s.section === 'ALL' ||
            !student.section ||
            s.section === student.section;
          return cMatch && secMatch;
        });

      const isSchoolWide = !hasClassIds && !(exam as any).classId && (!Array.isArray(exam.schedule) || exam.schedule.length === 0);

      // Section match on exam top-level
      const sectionMatches =
        !exam.section ||
        exam.section === 'ALL' ||
        !student.section ||
        exam.section === student.section;

      return (classIdMatches || scheduleMatches || isSchoolWide) && sectionMatches;
    });
  }, [allExams, student.classId, student.className, student.section]);

  // Linked siblings under same parent phone
  const linkedSiblings = useMemo(() => {
    const parentPhone = student.parentPhone || student.fatherMobile || student.motherMobile || '';
    if (!parentPhone) return [];
    return api.getLinkedChildren(parentPhone, student.id);
  }, [student]);

  // Fetch authoritative student record from backend/MongoDB upon mount to verify persistence
  useEffect(() => {
    let isMounted = true;
    api.fetchStudentDirect(student.id).then((fresh) => {
      if (isMounted && fresh) {
        onUpdate(fresh);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [student.id]);

  // Fee calculation metrics: strictly derived from actual invoices in the fee ledger and recorded payments
  const feeMetrics = useMemo(() => {
    const paid = feePaymentsList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    if (studentLedgers.length > 0) {
      const totalBilled = studentLedgers.reduce((acc, l) => acc + Number(l.total ?? l.amount ?? 0), 0);
      const totalPaidOnLedgers = studentLedgers.reduce((acc, l) => acc + Number(l.paidAmount ?? 0), 0);
      const effectivePaid = Math.max(paid, totalPaidOnLedgers);
      const pending = studentLedgers.reduce((acc, l) => {
        const bTotal = Number(l.total ?? l.amount ?? 0);
        const bPaid = Number(l.paidAmount ?? 0);
        return acc + Number(l.pendingAmount ?? Math.max(0, bTotal - bPaid));
      }, 0);

      return {
        total: totalBilled,
        paid: effectivePaid,
        pending: Math.max(0, pending),
      };
    }

    // Fallback if no invoices generated yet in fee ledger: use saved class-wise fee structure one-time admission dues
    const oneTimePayable = Number(student.feeProfile?.totalOneTimeFee ?? 0);
    const pending = Math.max(0, oneTimePayable - paid);
    return {
      total: oneTimePayable,
      paid,
      pending,
    };
  }, [feePaymentsList, studentLedgers, student.feeProfile]);

  const calculateAge = (dobString: string): string => {
    if (!dobString) return 'N/A';
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return 'N/A';
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    const years = Math.abs(ageDt.getUTCFullYear() - 1970);
    return `${years} Years`;
  };

  const getStatusBadgeStyle = (status: StudentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-200';
      case 'INACTIVE':
        return 'bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-200';
      case 'ON_LEAVE':
        return 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-200';
      case 'SUSPENDED':
        return 'bg-red-50 text-red-700 border-red-300 ring-1 ring-red-200';
      case 'TRANSFERRED':
        return 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-200';
      case 'WITHDRAWN':
        return 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-300';
    }
  };

  const handlePhotoUpdated = async (res: { fileKey: string; previewUrl?: string }) => {
    if (isTeacher) return;
    const updated = await api.updateStudentAsync(student.id, {
      photo: res.fileKey,
      photoFileKey: res.fileKey,
    });
    await fileUploadService.confirmFileAssociation(res.fileKey, {
      type: 'STUDENT_PHOTO',
      id: student.id,
    });
    onUpdate(updated);
    setIsUpdatingPhoto(false);
    setStatusFeedback('Student photo updated.');
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  const handleRemovePhoto = async () => {
    if (isTeacher || isParent) return;
    if (student.photoFileKey) {
      await fileUploadService.deleteFile(student.photoFileKey);
    }
    const updated = await api.updateStudentAsync(student.id, {
      photo: '',
      photoFileKey: '',
    });
    onUpdate(updated);
    setIsUpdatingPhoto(false);
  };

  const handleDocumentUploaded = async (res: any) => {
    if (isTeacher || isParent) return;
    const newDoc: AttachedDocument = {
      id: `doc-${Date.now()}`,
      title: res.originalFileName.split('.')[0] || 'Uploaded Document',
      fileKey: res.fileKey,
      originalFileName: res.originalFileName,
      contentType: res.contentType,
      fileSize: res.fileSize,
      uploadedAt: new Date().toISOString(),
      documentType: 'OTHER',
      verificationStatus: 'PENDING',
    };
    const docs = [newDoc, ...(student.documents || [])];
    const updated = await api.updateStudentAsync(student.id, { documents: docs });
    await fileUploadService.confirmFileAssociation(res.fileKey, {
      type: 'STUDENT_DOCUMENT',
      id: student.id,
    });
    onUpdate(updated);
    setStatusFeedback('Document uploaded.');
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  const handleDeleteDocument = async (docId: string, fileKey: string) => {
    if (isTeacher || isParent) return;
    if (window.confirm('Are you sure you want to delete this document?')) {
      await fileUploadService.deleteFile(fileKey);
      const docs = (student.documents || []).filter((d) => d.id !== docId);
      const updated = await api.updateStudentAsync(student.id, { documents: docs });
      onUpdate(updated);
    }
  };

  const handleVerifyDocument = (status: 'VERIFIED' | 'REJECTED') => {
    if (isTeacher || isParent || !selectedDocForVerification) return;
    const updated = api.verifyStudentDocument(
      student.id,
      selectedDocForVerification.id,
      status,
      docVerifyRemark,
      'Admissions Officer'
    );
    onUpdate(updated);
    setSelectedDocForVerification(null);
    setDocVerifyRemark('');
    setStatusFeedback(`Document ${status === 'VERIFIED' ? 'Verified' : 'Rejected'} successfully`);
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTeacher || isParent || isPromoting) return;
    if (!promoteTargetClassId) {
      setStatusFeedback('Choose the class to promote to.');
      setTimeout(() => setStatusFeedback(null), 3500);
      return;
    }
    setIsPromoting(true);
    const res = await api.promoteStudentsAsync({
      studentIds: [student.id],
      toClassId: promoteTargetClassId,
      toSection: promoteTargetSection,
      targetSession: promoteTargetSession.trim(),
      remark: promoteRemark.trim() || undefined,
      customRoll: promoteCustomRoll.trim() || undefined,
      chargeBooksFee: promoteChargeBooks,
    });
    setIsPromoting(false);
    const updated = res.students?.[0];
    if (!res.success || !updated) {
      setStatusFeedback(res.error || res.skipped?.[0]?.reason || 'Promotion failed. Please try again.');
      setTimeout(() => setStatusFeedback(null), 5000);
      return;
    }
    onUpdate(updated);
    setIsPromoteModalOpen(false);
    setPromoteRemark('');
    setPromoteCustomRoll('');
    const books = res.promoted?.[0]?.booksBilled;
    setStatusFeedback(
      `Student promoted to ${updated.className}-${updated.section}` +
        (books ? `. Books & Stationery fee ₹${books.toLocaleString('en-IN')} added.` : '')
    );
    setTimeout(() => setStatusFeedback(null), 4500);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTeacher || isParent) return;
    try {
      const updated = await api.changeStudentStatusAsync(student.id, statusNewValue, statusReason, statusEffectiveDate);
      onUpdate(updated);
      setIsStatusModalOpen(false);
      setStatusReason('');
      setStatusFeedback(`Status changed to ${statusNewValue}.`);
    } catch (err: any) {
      setIsStatusModalOpen(false);
      setStatusFeedback(err?.message || 'Could not change the status. Please try again.');
    }
    setTimeout(() => setStatusFeedback(null), 5000);
  };

  const handleToggleStudentPortal = async () => {
    if (isTeacher || isParent) return;
    const nextState = student.loginEnabled === false;
    const updated = await api.updateStudentPortalStatus(student.id, { loginEnabled: nextState });
    if (updated) onUpdate(updated);
    setPortalMsg({
      type: 'success',
      text: `Student portal access has been ${nextState ? 'enabled' : 'disabled'}.`,
    });
    setTimeout(() => setPortalMsg(null), 3000);
  };

  const handleResetStudentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTeacher || isParent || !studentNewPassword.trim()) return;
    setIsResettingStudentPass(true);
    try {
      const res = await api.resetStudentPassword(student.id, studentNewPassword.trim());
      setPortalMsg({ type: 'success', text: res.message || 'Student password reset successfully.' });
      setStudentNewPassword('');
    } catch {
      setPortalMsg({ type: 'error', text: 'Failed to reset student password.' });
    } finally {
      setIsResettingStudentPass(false);
      setTimeout(() => setPortalMsg(null), 3000);
    }
  };

  const handleToggleParentPortal = async () => {
    if (isTeacher || isParent) return;
    const parentPhone = student.fatherMobile || student.parentPhone;
    if (!parentPhone) {
      alert('Student does not have a registered parent phone number.');
      return;
    }
    await api.updateParentPortalStatus(parentPhone, { loginEnabled: true });
    setPortalMsg({
      type: 'success',
      text: `Parent portal access synchronized for registered Login ID: ${parentPhone}.`,
    });
    setTimeout(() => setPortalMsg(null), 3000);
  };

  const handleResetParentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTeacher || isParent) return;
    const parentPhone = student.fatherMobile || student.parentPhone;
    if (!parentPhone || !parentNewPassword.trim()) return;
    setIsResettingParentPass(true);
    try {
      const res = await api.resetParentPassword(parentPhone, parentNewPassword.trim());
      setPortalMsg({ type: 'success', text: res.message || 'Parent password reset successfully.' });
      setParentNewPassword('');
    } catch {
      setPortalMsg({ type: 'error', text: 'Failed to reset parent password.' });
    } finally {
      setIsResettingParentPass(false);
      setTimeout(() => setPortalMsg(null), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Navigation & Feedback Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            title="Back to Students Registry"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
            <span className="hidden sm:inline">Back to Students Registry</span>
            <span className="sm:hidden">Back</span>
          </button>

          <span className="text-xs text-slate-400">/</span>
          <span className="text-xs font-bold text-slate-700 truncate max-w-[180px] sm:max-w-xs">
            {student.name} ({student.admissionNumber})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {statusFeedback && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-fadeIn">
              <Check className="w-3.5 h-3.5" />
              {statusFeedback}
            </span>
          )}

          {!isTeacher && canEditStudents && (
            <button
              onClick={() => onEdit(student)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Edit student information"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          )}

          {!isTeacher && (
            <button
              onClick={() => setIsAdmissionLetterOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="A4 Printable Admission Confirmation Letter & Fee Schedule"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admission Letter</span>
              <span className="sm:hidden">Letter</span>
            </button>
          )}

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="A4 Printable Profile Dossier"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print Profile</span>
            <span className="sm:hidden">Print</span>
          </button>
        </div>
      </div>

      {/* Official Backend Immutable Identifiers Notice Banner */}
      <div className="bg-slate-900 text-slate-200 rounded-xl p-3.5 px-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-md shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white uppercase tracking-wider text-[11px] block">
              Auto-Generated Official Identifiers (Protected & Immutable)
            </span>
            <span className="text-[11px] text-slate-400">
              Admission and registration numbers are institutional identifiers generated at onboarding.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
            <span className="text-[10px] text-slate-400 font-sans block">Admission No.</span>
            <strong className="text-blue-400 text-sm">{student.admissionNumber}</strong>
          </div>
          <div className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
            <span className="text-[10px] text-slate-400 font-sans block">Registration No.</span>
            <strong className="text-slate-200">{student.registrationNumber}</strong>
          </div>
          <div className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
            <span className="text-[10px] text-slate-400 font-sans block">Roll No.</span>
            <strong className="text-white">#{student.rollNumber}</strong>
          </div>
          <div className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
            <span className="text-[10px] text-slate-400 font-sans block">System Record ID</span>
            <strong className="text-slate-400 text-[11px]">{student.id}</strong>
          </div>
        </div>
      </div>

      {/* 1. STUDENT 360° PROFILE — HEADER CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 lg:gap-8">
            {/* Student Photo with Cloudflare R2 Upload Controls */}
            <div className="relative group shrink-0">
              <div className="w-32 h-36 lg:w-36 lg:h-44 rounded-2xl bg-slate-100 border-2 border-slate-200 shadow-md overflow-hidden flex items-center justify-center font-bold text-4xl text-slate-400">
                {student.photo && fileUploadService.getFileUrl(student.photo) ? (
                  <img
                    src={fileUploadService.getFileUrl(student.photo)}
                    alt={student.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{student.name.charAt(0)}</span>
                )}
              </div>

              {!isTeacher && !isParent && (
                <button
                  type="button"
                  onClick={() => setIsUpdatingPhoto(!isUpdatingPhoto)}
                  className="absolute -bottom-2 -right-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-full text-white shadow-md transition-transform hover:scale-110 cursor-pointer"
                  title="Update Photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Student Vital Details */}
            <div className="flex-1 text-center md:text-left space-y-3">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-950 font-serif">
                  {student.name}
                </h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBadgeStyle(student.status)}`}>
                  {student.status.replace('_', ' ')}
                </span>
                {student.photoFileKey && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                    Photo saved
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Class:</span>
                  <strong className="text-slate-900 font-bold text-sm bg-slate-100 px-2 py-0.5 rounded">
                    {student.className}-{student.section}
                  </strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Roll Number:</span>
                  <strong className="text-slate-900 font-mono font-bold text-sm">
                    #{student.rollNumber}
                  </strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Admission No:</span>
                  <strong className="text-blue-700 font-mono font-bold text-sm">
                    {student.admissionNumber}
                  </strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Session:</span>
                  <strong className="text-slate-800">{student.academicSession}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Admission Date:</span>
                  <strong className="text-slate-800">{student.admissionDate}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Enrollment Date:</span>
                  <strong className="text-emerald-800 font-bold">{student.enrollmentDate || student.admissionDate}</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1.5 font-medium">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  {student.mobile || student.parentPhone}
                </span>
                {student.email && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Mail className="w-3.5 h-3.5 text-purple-600" />
                    {student.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  {student.address}, {student.city || 'Sheohar'}, {student.state || 'Bihar'} - {student.pincode || '843329'}
                </span>
              </div>
            </div>
          </div>

          {/* Direct Photo Upload Drawer if Active */}
          {isUpdatingPhoto && !isTeacher && !isParent && (
            <div className="mt-6 p-5 bg-slate-900 rounded-xl text-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">
                  Upload Student Passport Photo
                </span>
                <button
                  type="button"
                  onClick={() => setIsUpdatingPhoto(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <FileUploadComponent
                bucketName="student-photos"
                onUploadComplete={handlePhotoUpdated}
                acceptedFormats={['image/jpeg', 'image/png', 'image/webp']}
                maxSizeMB={5}
              />
              {student.photo && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer block"
                >
                  Remove current photo
                </button>
              )}
            </div>
          )}
        </div>

        {/* 2. ACTION BAR (Comprehensive Institutional Tools) */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
              Quick Actions:
            </span>

            <button
              onClick={() => onOpenIdCard(student)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <QrCode className="w-3.5 h-3.5 text-blue-600" />
              <span>ID Card</span>
            </button>

            {canViewReportCard && (
              <button
                onClick={() => onOpenReportCard(student)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Report Card</span>
              </button>
            )}

            {!isTeacher && !isParent && (
              <>
                <button
                  onClick={() => onOpenCertificate(student, 'BONAFIDE')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Bonafide</span>
                </button>

                <button
                  onClick={() => onOpenCertificate(student, 'CHARACTER')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>Character</span>
                </button>

                <button
                  onClick={() => onOpenCertificate(student, 'TC')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  <span>Transfer Cert (TC)</span>
                </button>
              </>
            )}
          </div>

          {!isTeacher && !isParent && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsStatusModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-slate-700" />
                <span>Change Status</span>
              </button>

              <button
                onClick={() => setIsPromoteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Promote Student</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. PROFILE SUMMARY CARDS (8 Key Metrics) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-200 bg-white">
          {/* 1: Attendance % */}
          <div className="p-4 text-center">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Attendance</span>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <strong className="text-lg font-black text-blue-700">{attendanceSummary.percentage}%</strong>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, attendanceSummary.percentage)}%` }}
              />
            </div>
          </div>

          {/* 2: Total Fees */}
          <div className="p-4 text-center">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Total Fees</span>
            <strong className="text-base font-bold text-slate-900 block mt-0.5">
              ₹{feeMetrics.total.toLocaleString('en-IN')}
            </strong>
            <span className="text-[10px] text-slate-400">Assessed 2026-27</span>
          </div>

          {/* 3: Paid Fees */}
          <div className="p-4 text-center">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Paid Fees</span>
            <strong className="text-base font-bold text-emerald-700 block mt-0.5">
              ₹{feeMetrics.paid.toLocaleString('en-IN')}
            </strong>
            <span className="text-[10px] text-emerald-600 font-medium">Receipts Verified</span>
          </div>

          {/* 4: Pending / Balance */}
          <div className="p-4 text-center">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Pending Dues</span>
            <strong className={`text-base font-bold block mt-0.5 ${feeMetrics.pending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
              ₹{feeMetrics.pending.toLocaleString('en-IN')}
            </strong>
            <span className="text-[10px] text-slate-400">{feeMetrics.pending > 0 ? 'Due Q2' : 'Nil Balance'}</span>
          </div>

          {/* 5: Current Class */}
          <div className="p-4 text-center">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Class & Sec</span>
            <strong className="text-base font-bold text-slate-900 block mt-0.5">
              {student.className}-{student.section}
            </strong>
            <span className="text-[10px] text-slate-400">{student.academicSession}</span>
          </div>

          {/* 6: Roll Number */}
          <div className="p-4 text-center">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Roll Number</span>
            <strong className="text-base font-mono font-bold text-slate-900 block mt-0.5">
              #{student.rollNumber}
            </strong>
            <span className="text-[10px] text-slate-400">Class Rank</span>
          </div>

          {/* 7: Admission Date */}
          <div className="p-4 text-center">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Admission Date</span>
            <strong className="text-xs font-semibold text-slate-800 block mt-1 truncate" title={student.admissionDate}>
              {student.admissionDate}
            </strong>
            <span className="text-[10px] text-slate-400">Registered</span>
          </div>

          {/* 8: Parent Contact */}
          <div className="p-4 text-center">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Parent / Guardian</span>
            <strong className="text-xs font-bold text-slate-900 block mt-1 truncate" title={student.parentName || student.fatherName}>
              {student.parentName || student.fatherName || 'Parent'}
            </strong>
            <span className="text-[10px] text-slate-500 font-mono">{student.parentPhone || student.fatherMobile || 'N/A'}</span>
          </div>
        </div>

        {/* 4. TAB NAVIGATION */}
        <div className="px-4 lg:px-6 bg-slate-900 text-white flex overflow-x-auto scrollbar-none text-xs font-bold tracking-wide">
          {(isTeacher
            ? [
                { id: 'OVERVIEW', label: 'Overview' },
                { id: 'PERSONAL', label: 'Personal' },
                { id: 'ACADEMIC', label: 'Academics' },
                { id: 'PARENT', label: 'Parent / Guardian' },
                { id: 'ATTENDANCE', label: 'Attendance' },
                { id: 'EXAMS', label: 'Academic Performance' },
              ]
            : isParent
            ? [
                { id: 'OVERVIEW', label: 'Overview' },
                { id: 'PERSONAL', label: 'Personal' },
                { id: 'ACADEMIC', label: 'Academics' },
                { id: 'PARENT', label: 'Parent / Guardian' },
                { id: 'ATTENDANCE', label: 'Attendance' },
                { id: 'FEES', label: 'Fees' },
                { id: 'EXAMS', label: 'Exams' },
                { id: 'DOCUMENTS', label: `Documents (${student.documents?.length || 0})` },
                { id: 'TRANSPORT_HOSTEL', label: 'Transport / Hostel' },
              ]
            : [
                { id: 'OVERVIEW', label: 'Overview' },
                { id: 'PERSONAL', label: 'Personal' },
                { id: 'ACADEMIC', label: 'Academics' },
                { id: 'PARENT', label: 'Parent / Guardian' },
                { id: 'ATTENDANCE', label: 'Attendance' },
                { id: 'FEES', label: 'Fees' },
                { id: 'EXAMS', label: 'Exams' },
                { id: 'DOCUMENTS', label: `Documents (${student.documents?.length || 0})` },
                { id: 'TRANSPORT_HOSTEL', label: 'Transport / Hostel' },
                { id: 'PORTAL', label: 'Portal Access' },
                { id: 'ACTIVITY', label: `Activity (${student.activityHistory?.length || 0})` },
              ]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ProfileTabType)}
              className={`py-3.5 px-4.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-blue-400 text-white bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. TAB CONTENT PANELS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-xs">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-600" />
                <span>360° Comprehensive Student Snapshot</span>
              </h3>
              <span className="text-xs text-slate-500">
                Institutional Academic Record • Session {student.academicSession}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Student Identity & Vital Summary */}
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
                  <User className="w-4 h-4 text-blue-700" />
                  <span>Student Identity & Vitals</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Full Name:</span>
                    <strong className="text-slate-900">{student.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date of Birth:</span>
                    <strong className="text-slate-900">{student.dob} ({calculateAge(student.dob)})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gender & Blood:</span>
                    <strong className="text-slate-900">{student.gender} • <span className="text-red-600 font-bold">{student.bloodGroup}</span></strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Admission No:</span>
                    <strong className="text-blue-700 font-mono font-bold">{student.admissionNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusBadgeStyle(student.status)}`}>
                      {student.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Aadhaar (UIDAI):</span>
                    <span className="font-mono text-slate-800">
                      {student.aadhaarNumber ? `XXXX-XXXX-${student.aadhaarNumber.slice(-4)}` : 'Recorded'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Parent & Emergency Summary */}
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
                  <Users className="w-4 h-4 text-purple-700" />
                  <span>Parent & Emergency Protocol</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Father's Name:</span>
                    <strong className="text-slate-900">{student.fatherName || student.parentName || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mother's Name:</span>
                    <strong className="text-slate-900">{student.motherName || 'Mrs. Gupta'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Primary Mobile:</span>
                    <strong className="text-slate-900 font-mono">{student.parentPhone || student.fatherMobile}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Emergency Phone:</span>
                    <strong className="text-red-700 font-mono font-bold">{student.emergencyContact || student.parentPhone}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact Person:</span>
                    <strong className="text-slate-900">{student.emergencyContactName || student.parentName} ({student.emergencyRelationship || 'Parent'})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Linked Siblings:</span>
                    <strong className="text-blue-700 font-semibold">{linkedSiblings.length} Sibling(s) in School</strong>
                  </div>
                </div>
              </div>

              {/* Card 3: Academic & Financial Health */}
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  <span>Academic & Financial Summary</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Class:</span>
                    <strong className="text-slate-900">{student.className}-{student.section}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Class Roll:</span>
                    <strong className="text-slate-900 font-mono font-bold">#{student.rollNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Attendance:</span>
                    <strong className="text-blue-700 font-bold">{attendanceSummary.percentage}% ({attendanceSummary.present}/{attendanceSummary.total} Days)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Fees:</span>
                    <strong className="text-slate-900">₹{feeMetrics.total.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paid Fees:</span>
                    <strong className="text-emerald-700">₹{feeMetrics.paid.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pending Dues:</span>
                    <strong className={feeMetrics.pending > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                      {feeMetrics.pending > 0 ? `₹${feeMetrics.pending.toLocaleString('en-IN')}` : 'Nil'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Mini-Feed */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-slate-700" />
                  <span>Recent Institutional Activity Feed</span>
                </h4>
                <button
                  onClick={() => setActiveTab('ACTIVITY')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                >
                  View Full History →
                </button>
              </div>

              <div className="space-y-2.5">
                {(student.activityHistory || []).slice(0, 3).map((act) => (
                  <div key={act.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900">{act.title}</strong>
                        <span className="text-[10px] text-slate-400">{act.timestamp}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-0.5">{act.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PERSONAL */}
        {activeTab === 'PERSONAL' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Personal Particulars & Vital Records
              </h4>
              <span className="text-xs text-slate-500">Immutable Student Identifier: {student.admissionNumber}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Full Legal Name</span>
                <span className="font-bold text-slate-900 text-sm">{student.name}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date of Birth</span>
                <span className="font-semibold text-slate-800">{student.dob} ({calculateAge(student.dob)})</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Gender</span>
                <span className="font-semibold text-slate-800">{student.gender}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Blood Group</span>
                <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs inline-block">
                  {student.bloodGroup || 'B+'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Student Mobile Phone</span>
                <span className="font-semibold text-slate-800 font-mono">{student.mobile || student.parentPhone || 'N/A'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Student Email Address</span>
                <span className="font-semibold text-slate-800 truncate block">{student.email || 'N/A'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Aadhaar (UIDAI)</span>
                  <button
                    type="button"
                    onClick={() => setShowAadhaarNumber(!showAadhaarNumber)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                    title={showAadhaarNumber ? 'Mask Aadhaar' : 'Reveal Aadhaar'}
                  >
                    {showAadhaarNumber ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="font-mono font-bold text-slate-900">
                  {student.aadhaarNumber
                    ? showAadhaarNumber
                      ? student.aadhaarNumber
                      : `XXXX-XXXX-${student.aadhaarNumber.slice(-4)}`
                    : 'Not Provided'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Apaar Id</span>
                <span className="font-mono font-bold text-slate-900">{student.apaarId || 'Not Provided'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Social Category</span>
                <span className="font-semibold text-slate-800">{student.category || 'GENERAL'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Religion</span>
                <span className="font-semibold text-slate-800">{student.religion || 'Hindu'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Visible Identification Mark</span>
                <span className="font-medium text-slate-800">{student.identificationMark || 'None reported'}</span>
              </div>
              <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Permanent Residential Address</span>
                <span className="font-semibold text-slate-900">
                  {student.address}, {student.city || 'Sheohar'}, {student.state || 'Bihar'} - {student.pincode || '843329'}
                </span>
              </div>
            </div>

            {/* Medical Information Section */}
            <div className="p-5 bg-red-50/40 rounded-xl border border-red-100 space-y-3">
              <h5 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-red-600" />
                <span>Medical Record & Health Protocol</span>
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Known Allergies</span>
                  <strong className="text-slate-900">{student.allergies || 'None reported'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Medical Conditions</span>
                  <strong className="text-slate-900">{student.medicalConditions || 'Clinically Fit'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Regular Medications</span>
                  <strong className="text-slate-900">{student.medications || 'None'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Consulting Physician</span>
                  <strong className="text-slate-900">{student.doctorName || 'Not provided'} ({student.doctorContact || 'Not provided'})</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACADEMICS */}
        {activeTab === 'ACADEMIC' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Academic Registration & Enrollment Timeline
              </h4>
              <button
                onClick={() => setIsPromoteModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Promote Student
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Enrolled Class</span>
                <span className="font-bold text-slate-900 text-base">{student.className}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Section</span>
                <span className="font-bold text-slate-900 text-base">Section {student.section}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Roll Number</span>
                <span className="font-mono font-bold text-blue-700 text-base">#{student.rollNumber}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Academic Session</span>
                <span className="font-semibold text-slate-900 text-base">{student.academicSession}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Admission Date</span>
                <span className="font-semibold text-slate-900">{student.admissionDate}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Enrollment Date</span>
                <span className="font-bold text-emerald-900">{student.enrollmentDate || student.admissionDate}</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-blue-700 block text-[10px] uppercase font-semibold">Fee Start Date</span>
                <span className="font-bold text-blue-900">{student.feeStartDate || student.enrollmentDate || student.admissionDate}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Previous School</span>
                <span className="font-semibold text-slate-900">{student.previousSchool || 'Direct Entry'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Previous Class & Marks</span>
                <span className="font-semibold text-slate-900">{student.previousClass || 'Class 9'} ({student.previousMarks || '91.4%'})</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">School Affiliation</span>
                <span className="font-semibold text-slate-900">{affiliationText(schoolIdentity(api.getSettings()), 'Code') || NOT_CONFIGURED}</span>
              </div>
            </div>

            {/* Academic History / Past Sessions Table */}
            <div className="space-y-3 pt-2">
              <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Academic Promotion & Session History
              </h5>
              {student.academicHistory && student.academicHistory.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Session</th>
                        <th className="py-2.5 px-4">Class & Section</th>
                        <th className="py-2.5 px-4">Roll No</th>
                        <th className="py-2.5 px-4">Annual Result</th>
                        <th className="py-2.5 px-4">Percentage</th>
                        <th className="py-2.5 px-4">Promotion Date</th>
                        <th className="py-2.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(student.academicHistory || []).map((hist, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{hist.session}</td>
                          <td className="py-2.5 px-4">{hist.className}-{hist.section}</td>
                          <td className="py-2.5 px-4 font-mono font-medium">#{hist.rollNumber}</td>
                          <td className="py-2.5 px-4 font-bold text-emerald-700">{hist.result}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{hist.percentage ? `${hist.percentage}%` : '—'}</td>
                          <td className="py-2.5 px-4 text-slate-500">{hist.promotionDate}</td>
                          <td className="py-2.5 px-4 text-slate-600">{hist.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs text-center">
                  Initial enrollment record in session {student.academicSession}. Historical session records will be archived automatically upon promotion.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PARENT / GUARDIAN & MULTIPLE CHILDREN LINKING */}
        {activeTab === 'PARENT' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Parents & Guardian Comprehensive Records
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Single-School Unified Family Account. Siblings are automatically linked under the same registered mobile number.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Father's Information Card */}
              <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block border-b border-blue-200/60 pb-1.5">
                  Father's Information
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Father's Name:</span>
                    <strong className="text-slate-900 text-sm">{student.fatherName || student.parentName || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mobile Phone:</span>
                    <strong className="text-blue-800 font-mono text-sm">{student.fatherMobile || student.parentPhone || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Father Aadhar:</span>
                    <strong className="text-slate-800 font-mono">
                      {student.fatherAadhaar
                        ? showAadhaarNumber
                          ? student.fatherAadhaar
                          : `XXXX-XXXX-${student.fatherAadhaar.slice(-4)}`
                        : 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Occupation / Designation:</span>
                    <strong className="text-slate-800">{student.fatherOccupation || student.parentOccupation || 'Professional / Business'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email Address:</span>
                    <strong className="text-slate-800">{student.fatherEmail || student.parentEmail || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              {/* Mother's Information Card */}
              <div className="p-5 rounded-xl border border-purple-200 bg-purple-50/30 space-y-3">
                <span className="text-xs font-bold text-purple-900 uppercase tracking-wider block border-b border-purple-200/60 pb-1.5">
                  Mother's Information
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mother's Name:</span>
                    <strong className="text-slate-900 text-sm">{student.motherName || 'Mrs. Gupta'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mobile Phone:</span>
                    <strong className="text-purple-800 font-mono text-sm">{student.motherMobile || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mother Aadhar:</span>
                    <strong className="text-slate-800 font-mono">
                      {student.motherAadhaar
                        ? showAadhaarNumber
                          ? student.motherAadhaar
                          : `XXXX-XXXX-${student.motherAadhaar.slice(-4)}`
                        : 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Occupation / Designation:</span>
                    <strong className="text-slate-800">{student.motherOccupation || 'Homemaker / Professional'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email Address:</span>
                    <strong className="text-slate-800">{student.motherEmail || 'N/A'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Sibling Linkage Card (Multiple Children under Parent Account) */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-700" />
                    <span>Multiple Children Linked Under Parent Account ({student.parentPhone || 'Mobile'})</span>
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    When parents log in with their phone number, they can switch between all their enrolled children.
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  {linkedSiblings.length + 1} Total Child(ren)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {/* Current Student Tile */}
                <div className="p-3.5 bg-blue-50 rounded-lg border-2 border-blue-300 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-200 border border-blue-400 overflow-hidden shrink-0 flex items-center justify-center font-bold text-blue-900">
                    {student.photo && fileUploadService.getFileUrl(student.photo) ? (
                      <img src={fileUploadService.getFileUrl(student.photo)} alt={student.name} className="w-full h-full object-cover" />
                    ) : (
                      student.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <strong className="text-slate-900 truncate">{student.name}</strong>
                      <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded">Current</span>
                    </div>
                    <span className="text-slate-600 block text-[11px]">{student.className}-{student.section} • Adm: {student.admissionNumber}</span>
                  </div>
                </div>

                {/* Sibling Tiles */}
                {linkedSiblings.map((sibling) => (
                  <div
                    key={sibling.id}
                    className="p-3.5 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-700">
                        {sibling.photo && fileUploadService.getFileUrl(sibling.photo) ? (
                          <img src={fileUploadService.getFileUrl(sibling.photo)} alt={sibling.name} className="w-full h-full object-cover" />
                        ) : (
                          sibling.name.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <strong className="text-slate-900 block truncate">{sibling.name}</strong>
                        <span className="text-slate-500 block text-[11px]">{sibling.className}-{sibling.section} • Adm: {sibling.admissionNumber}</span>
                      </div>
                    </div>

                    {onSelectStudent && (
                      <button
                        onClick={() => onSelectStudent(sibling)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 rounded text-xs font-semibold shrink-0 cursor-pointer"
                        title={`Switch view to ${sibling.name}`}
                      >
                        View Profile
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ATTENDANCE */}
        {activeTab === 'ATTENDANCE' && (
          <div className="space-y-4">
            <AttendanceCalendar
              type="STUDENT"
              studentId={student.id}
              studentName={student.name}
              records={(api.getAttendance() || []).filter((a) => a.studentId === student.id)}
              holidays={api.getHolidays()}
            />
          </div>
        )}

        {/* TAB 6: FEES */}
        {!isTeacher && activeTab === 'FEES' && (
          <div className="space-y-6">
            {/* Applicable Fee Profile Blueprint */}
            {(() => {
              const profile = student.feeProfile;
              const heads = profile?.feeHeads?.filter((h) => h.selected) || [];
              const oneTime = profile?.totalOneTimeFee ?? 0;
              const monthly = profile?.monthlyPayableAmount ?? 0;
              const annual = profile?.totalApplicableFee ?? 0;

              return (
                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        <span>Student Applicable Fee Structure Blueprint</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Class {student.className} (Section {student.section}) • Academic Session {student.academicSession}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAdmissionLetterOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Print Admission Letter</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Admission Dues (1-Time)</span>
                      <strong className="text-blue-900 text-sm font-black font-mono">₹{oneTime.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Monthly Regular Dues</span>
                      <strong className="text-emerald-700 text-sm font-black font-mono">₹{monthly.toLocaleString('en-IN')}/mo</strong>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Annual Commitment</span>
                      <strong className="text-slate-900 text-sm font-black font-mono">₹{annual.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Fee Heads</span>
                      <strong className="text-purple-700 text-sm font-black font-mono">{heads.length} Heads</strong>
                    </div>
                  </div>

                  {heads.length > 0 && (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/70 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Fee Head</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3">Frequency</th>
                            <th className="py-2 px-3 text-right">Applicable Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {heads.map((h) => (
                            <tr key={h.head} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-900">{h.head}</td>
                              <td className="py-2 px-3 text-slate-500">{h.category}</td>
                              <td className="py-2 px-3 text-slate-500">{h.frequency}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                ₹{Number(h.amount).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* SECTION 1: INVOICES & BILLING LEDGER */}
            <div className="space-y-3">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Tuition, Transport & Institutional Fee Invoices</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">Authoritative billing ledger generated from saved fee structure & schedules</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600">
                    Total Invoiced: <strong className="text-slate-900 font-bold font-mono">₹{feeMetrics.total.toLocaleString('en-IN')}</strong>
                  </span>
                  <span className="text-xs text-slate-600">
                    Paid: <strong className="text-emerald-700 font-bold font-mono">₹{feeMetrics.paid.toLocaleString('en-IN')}</strong>
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    Balance Dues: <strong className={feeMetrics.pending > 0 ? 'text-amber-700 font-mono' : 'text-emerald-700 font-mono'}>₹{feeMetrics.pending.toLocaleString('en-IN')}</strong>
                  </span>
                </div>
              </div>

              {studentLedgers.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Invoice No</th>
                        <th className="py-2.5 px-4">Particulars / Period</th>
                        <th className="py-2.5 px-4">Due Date</th>
                        <th className="py-2.5 px-4 text-right">Base Amount</th>
                        <th className="py-2.5 px-4 text-right">Late Fee</th>
                        <th className="py-2.5 px-4 text-right">Total Invoiced</th>
                        <th className="py-2.5 px-4 text-right">Paid</th>
                        <th className="py-2.5 px-4 text-right">Outstanding</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentLedgers.map((l) => {
                        const baseAmt = Number(l.amount ?? l.total ?? 0);
                        const fineAmt = Number(l.fine || 0);
                        const totalAmt = Number(l.total ?? l.totalAmount ?? baseAmt + fineAmt);
                        const paidAmt = Number(l.paidAmount || 0);
                        const pendingAmt = Number(l.pendingAmount ?? Math.max(0, totalAmt - paidAmt));
                        const isOverdue = l.status === 'OVERDUE' || (pendingAmt > 0 && l.dueDate && l.dueDate < new Date().toISOString().substring(0, 10));

                        return (
                          <tr key={l.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-mono font-bold text-blue-700">{l.invoiceNumber || l.id}</td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {l.feeType || l.feeMonth || l.monthYear || 'Fee Charge'}
                            </td>
                            <td className="py-3 px-4 text-slate-600">{l.dueDate || '—'}</td>
                            <td className="py-3 px-4 text-right font-mono text-slate-700">₹{baseAmt.toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 text-right font-mono text-amber-700">
                              {fineAmt > 0 ? `₹${fineAmt.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">₹{totalAmt.toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">₹{paidAmt.toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 text-right font-mono font-black text-amber-800">₹{pendingAmt.toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 text-center">
                              {l.status === 'PAID' || pendingAmt <= 0 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  PAID
                                </span>
                              ) : isOverdue ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                  OVERDUE
                                </span>
                              ) : paidAmt > 0 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  PARTIAL
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  PENDING
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  No fee invoices generated yet for this student. One-time admission dues will appear here upon invoice generation.
                </div>
              )}
            </div>

            {/* SECTION 2: PAYMENT RECEIPTS HISTORY */}
            <div className="space-y-3 pt-3">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Official Payment Receipts & Reconciliation</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">Verified financial transactions and audit-compliant counter payments</p>
                </div>
              </div>

              {feePaymentsList.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Receipt No</th>
                        <th className="py-2.5 px-4">Payment Date</th>
                        <th className="py-2.5 px-4">Particulars</th>
                        <th className="py-2.5 px-4">Amount</th>
                        <th className="py-2.5 px-4">Payment Mode</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {feePaymentsList.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-blue-700">{p.receiptNumber}</td>
                          <td className="py-3 px-4 text-slate-600">{p.paymentDate}</td>
                          <td className="py-3 px-4 font-medium text-slate-900">{p.feeType || 'Institutional Fee Payment'}</td>
                          <td className="py-3 px-4 font-black text-slate-900">₹{(Number(p.amount) || 0).toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 font-medium text-slate-700">{p.paymentMethod}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              PAID & RECONCILED
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => window.print()}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                            >
                              Print Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  No payment transaction records found for this student.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: EXAMS */}
        {activeTab === 'EXAMS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Examination Assessment & Academic Performance
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Published examinations, admit cards, and official marksheets for {student.className || `Class ${student.classId}`} ({student.section || 'A'})
                </p>
              </div>
              <button
                onClick={() => onOpenReportCard(student)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Print Official Marksheet</span>
              </button>
            </div>

            {isLoadingExams ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                Loading official examination records...
              </div>
            ) : studentPublishedExams.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Exam Name</th>
                      <th className="py-3 px-4">Exam Type</th>
                      <th className="py-3 px-4">Schedule</th>
                      <th className="py-3 px-4 text-center">Admit Card</th>
                      <th className="py-3 px-4 text-center">Marksheet / Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {studentPublishedExams.map((exam) => {
                      const examMarksForThisExam = allStudentMarks.filter((m) => m.examId === exam.id);
                      const isAdmitCardPublished = exam.admitCardStatus === 'PUBLISHED';
                      const isResultsPublished = exam.resultsStatus === 'PUBLISHED';

                      // Format exam schedule summary
                      const applicableSchedule = (exam.schedule || []).filter((item) => {
                        const classMatch = !item.classId || item.classId === student.classId || (student.className && item.className === student.className);
                        const sectionMatch = !item.section || item.section === 'ALL' || !student.section || item.section === student.section;
                        return classMatch && sectionMatch;
                      });

                      let scheduleText = 'Schedule Announced';
                      if (applicableSchedule.length > 0) {
                        const sortedPapers = [...applicableSchedule].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                        const firstDate = sortedPapers[0]?.date;
                        const lastDate = sortedPapers[sortedPapers.length - 1]?.date;
                        scheduleText = firstDate === lastDate ? firstDate : `${firstDate} to ${lastDate}`;
                      } else if (exam.startDate) {
                        scheduleText = exam.endDate && exam.endDate !== exam.startDate ? `${exam.startDate} to ${exam.endDate}` : exam.startDate;
                      }

                      // Format exam type
                      const rawType = exam.examType || 'EXAMINATION';
                      const formattedType = rawType.replace(/_/g, ' ');

                      const isExpanded = expandedExamMarksId === exam.id;

                      return (
                        <React.Fragment key={exam.id}>
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">
                                    {exam.name || exam.title || 'Examination'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    {exam.term || 'Academic Term'} • {exam.academicSession || '2026-2027'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {formattedType}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{scheduleText}</span>
                              </div>
                              {applicableSchedule.length > 0 && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {applicableSchedule.length} Subject Paper{applicableSchedule.length > 1 ? 's' : ''}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {isAdmitCardPublished ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedExamForAdmitCard(exam)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                                  title="View / Download Admit Card"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>View / Download Admit Card</span>
                                </button>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {isResultsPublished ? (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedExamForReportCard(exam)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                                    title="View / Download / Print Marksheet"
                                  >
                                    <FileCheck className="w-3.5 h-3.5" />
                                    <span>View / Download / Print Marksheet</span>
                                  </button>
                                  {examMarksForThisExam.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedExamMarksId(isExpanded ? null : exam.id)}
                                      className="px-2 py-1 rounded text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                                      title={isExpanded ? 'Hide Subject Marks' : 'Show Subject Marks'}
                                    >
                                      {isExpanded ? 'Hide Marks' : 'Marks Breakdown'}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Expandable Marks breakdown row when requested and marks exist */}
                          {isExpanded && examMarksForThisExam.length > 0 && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={5} className="p-4 border-t border-b border-slate-200">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-slate-800">
                                      Subject Scorecard — {exam.name || exam.title}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      {examMarksForThisExam.length} evaluated subjects
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                                        <tr>
                                          <th className="py-2 px-3">Subject</th>
                                          <th className="py-2 px-3">Max Marks</th>
                                          <th className="py-2 px-3">Marks Scored</th>
                                          <th className="py-2 px-3">Percentage</th>
                                          <th className="py-2 px-3">Grade</th>
                                          <th className="py-2 px-3">Grade Point</th>
                                          <th className="py-2 px-3">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {examMarksForThisExam.map((m) => {
                                          const markEval = calculateGradeFromMarks(m.marksObtained, m.maxMarks);
                                          const pct = Math.round((m.marksObtained / m.maxMarks) * 100);
                                          const grade = m.grade || markEval.grade;
                                          const gp = m.gradePoint ?? markEval.gradePoint;
                                          const isPass = markEval.isPass;
                                          return (
                                            <tr key={m.id} className="hover:bg-slate-50/50">
                                              <td className="py-2 px-3 font-semibold text-slate-900">{m.subjectName}</td>
                                              <td className="py-2 px-3 text-slate-500">{m.maxMarks}</td>
                                              <td className="py-2 px-3 font-bold text-slate-900">{m.marksObtained}</td>
                                              <td className="py-2 px-3 font-bold text-blue-700">{pct}%</td>
                                              <td className="py-2 px-3">
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                  {grade}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 font-mono font-bold text-slate-900">{gp}</td>
                                              <td className="py-2 px-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                  {isPass ? 'PASS' : 'FAIL'}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-semibold text-sm text-slate-700">No Published Examinations Available</p>
                <p className="text-xs text-slate-400 mt-1">
                  There are no published examinations currently scheduled or conducted for {student.className || `Class ${student.classId}`} ({student.section || 'A'}).
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 8: DOCUMENTS (Verification Workflow) */}
        {!isTeacher && activeTab === 'DOCUMENTS' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Digital Document Vault & Verification Center
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Birth certificates, marksheets, and transfer certificates with admin verification audit trail
                </p>
              </div>
            </div>

            {!isParent && (
              <FileUploadComponent
                bucketName="student-documents"
                onUploadComplete={handleDocumentUploaded}
                acceptedFormats={['application/pdf', 'image/jpeg', 'image/png']}
                maxSizeMB={10}
              />
            )}

            <div className="space-y-3 pt-3">
              {student.documents && student.documents.length > 0 ? (
                student.documents.map((doc) => {
                  const status = doc.verificationStatus || 'PENDING';
                  return (
                    <div
                      key={doc.id}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-blue-700 mt-0.5">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="font-bold text-slate-900 text-sm">{doc.title}</strong>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                status === 'VERIFIED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : status === 'REJECTED'
                                  ? 'bg-red-50 text-red-700 border-red-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-300'
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {doc.originalFileName} • {(doc.fileSize / 1024).toFixed(1)} KB • Uploaded {doc.uploadedAt ? doc.uploadedAt.substring(0, 10) : 'N/A'}
                          </p>
                          {doc.verificationRemark && (
                            <p className="text-[11px] text-slate-700 mt-1 italic bg-white p-1.5 px-2 rounded border border-slate-200">
                              Verification note: {doc.verificationRemark} ({doc.verifiedBy || 'Admin'})
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        {!isParent && (
                          <button
                            onClick={() => setSelectedDocForVerification(doc)}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold cursor-pointer"
                          >
                            Verify / Review
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 font-semibold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                        <a
                          href={fileUploadService.getFileUrl(doc.fileKey)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                        >
                          Download
                        </a>
                        {!isParent && (
                          <button
                            onClick={() => handleDeleteDocument(doc.id, doc.fileKey)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  No documents attached to this student record. Upload birth certificates, previous marksheets, or medical forms above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 9: TRANSPORT & HOSTEL */}
        {!isTeacher && activeTab === 'TRANSPORT_HOSTEL' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Logistics: School Transport & Campus Hostel Residency
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Transport Card */}
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                    <Bus className="w-4 h-4 text-amber-600" />
                    School Bus Transport
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${student.transportRequired ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                      {student.transportRequired ? 'Allocated' : 'Not Requested'}
                    </span>
                    {canManageTransport && (
                      <button
                        type="button"
                        onClick={() => {
                          api.fetchTransport().then((data) => {
                            if (Array.isArray(data.routes)) setTransportRoutesList(data.routes);
                          }).catch(() => {});
                          setTransportRequired(!!student.transportRequired);
                          setTransportRouteId(student.transportRouteId || '');
                          setTransportStopId(student.transportStopId || '');
                          setTransportActionMsg(null);
                          setIsManageTransportModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors cursor-pointer"
                      >
                        Manage Transport
                      </button>
                    )}
                  </div>
                </div>

                {transportActionMsg && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                      transportActionMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {transportActionMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{transportActionMsg.text}</span>
                  </div>
                )}

                {student.transportRequired ? (() => {
                  const routes = transportRoutesList.length > 0 ? transportRoutesList : api.getRoutes();
                  const matchedRoute = routes.find((r) => r.id === student.transportRouteId || r.routeName === student.transportRouteId);
                  const matchedStop = (matchedRoute?.stops || []).find(
                    (s) => s.id === student.transportStopId || s.stopName === student.transportStopName || s.name === student.transportStopName
                  );
                  const fare = student.transportMonthlyFee ?? matchedStop?.monthlyFare ?? matchedStop?.fare ?? 0;
                  const busNum = student.vehicleNumber || matchedRoute?.vehicleNumber || 'Campus Bus';
                  const drvName = student.driverName || matchedRoute?.driverName || 'Designated Driver';
                  const drvPhone = student.driverContact || matchedRoute?.driverPhone;

                  return (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Transit Route:</span>
                        <strong className="text-slate-900">{matchedRoute?.routeName || student.transportRouteId || 'Assigned Route'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Designated Stop:</span>
                        <strong className="text-slate-900">{matchedStop?.stopName || student.transportStopName || 'Assigned Stop'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Vehicle Number:</span>
                        <strong className="text-slate-900 font-mono">{busNum}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Driver & Contact:</span>
                        <strong className="text-slate-900">{drvName} {drvPhone ? `(${drvPhone})` : ''}</strong>
                      </div>
                      {fare > 0 && (
                        <div className="flex justify-between pt-1 border-t border-slate-100">
                          <span className="text-slate-500">Monthly Transport Fare:</span>
                          <strong className="text-emerald-700 font-bold font-mono">₹{Number(fare).toLocaleString('en-IN')} / mo</strong>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <p className="text-slate-500 italic py-2 text-xs">
                    Student travels via self-conveyance / day scholar transport.
                  </p>
                )}
              </div>

              {/* Hostel Card */}
              {(() => {
                const currentHostelRooms = api.getHostelRooms();
                const currentHostels = api.getHostels();
                const currentRoom = currentHostelRooms.find((r) => r.id === student.hostelRoomId || r.roomNumber === student.hostelRoomId);
                const currentHostel = currentHostels.find(
                  (h) => h.id === student.hostelId || h.name === student.hostelName || h.id === currentRoom?.hostelId
                );
                const currentAlloc = api.getHostelAllocations().find(
                  (a) => a.studentId === student.id && a.status === 'ACTIVE'
                );

                return (
                  <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        Campus Hostel Residency
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          student.hostelRequired ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {student.hostelRequired ? 'Hostel Resident' : 'Day Scholar'}
                      </span>
                    </div>

                    {hostelActionMsg && (
                      <div
                        className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                          hostelActionMsg.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{hostelActionMsg.text}</span>
                      </div>
                    )}

                    {student.hostelRequired ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div className="flex justify-between p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-slate-500 font-medium">Hostel Wing:</span>
                            <strong className="text-slate-900">{student.hostelName || currentHostel?.name || '—'}</strong>
                          </div>
                          <div className="flex justify-between p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-slate-500 font-medium">Floor & Room:</span>
                            <strong className="text-slate-900">
                              Floor {student.hostelFloor || currentRoom?.floor || '—'} • Room {currentRoom?.roomNumber || student.hostelRoomId || '—'}
                            </strong>
                          </div>
                          <div className="flex justify-between p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-slate-500 font-medium">Bed Identifier:</span>
                            <strong className="text-indigo-900 font-mono font-bold">{student.hostelBedNumber || '—'}</strong>
                          </div>
                          <div className="flex justify-between p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-slate-500 font-medium">Hostel Status:</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {student.hostelStatus || 'ACTIVE'}
                            </span>
                          </div>
                          <div className="flex justify-between p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-slate-500 font-medium">Allocation Date:</span>
                            <strong className="text-slate-900">
                              {student.hostelAllocationDate || currentAlloc?.allocationDate || student.admissionDate || '—'}
                            </strong>
                          </div>
                          <div className="flex justify-between p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-slate-500 font-medium">Chief Warden:</span>
                            <strong className="text-slate-900">
                              {student.hostelWarden || currentHostel?.wardenName || '—'}
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs">
                          <span className="text-indigo-900 font-medium">Monthly Boarding Charges:</span>
                          <strong className="text-indigo-950 font-bold font-mono">
                            ₹{((student.hostelMonthlyFee || currentRoom?.monthlyFee || 0) + (student.messMonthlyFee || currentHostel?.messFee || 0)).toLocaleString('en-IN')}/mo
                            <span className="text-[10px] font-normal text-slate-500 ml-1">
                              (Room Rent: ₹{student.hostelMonthlyFee || currentRoom?.monthlyFee || 0} + Mess: ₹{student.messMonthlyFee || currentHostel?.messFee || 0})
                            </span>
                          </strong>
                        </div>

                        {canManageHostel && (
                          <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setIsHostelDetailsOpen(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHostelActionMsg(null);
                                setChangeRemarks('');
                                const availRooms = currentHostelRooms.filter(
                                  (r) => r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
                                );
                                setChangeTargetRoomId(availRooms[0]?.id || '');
                                const firstBed = availRooms[0]?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                                setChangeTargetBedNumber(firstBed?.bedNumber || '');
                                setIsChangeBedModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 text-xs font-semibold shadow-2xs cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                              <span>Change Bed</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHostelActionMsg(null);
                                setVacateRemarks('Relocation / session completed');
                                setIsVacateBedModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 text-red-800 text-xs font-semibold shadow-2xs cursor-pointer"
                            >
                              <LogOut className="w-3.5 h-3.5 text-red-600" />
                              <span>Vacate Bed</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-slate-500 italic py-2 text-xs">
                          Student resides at home with parents in Sheohar area (Day Scholar).
                        </p>
                        {canManageHostel && (
                          <div className="pt-2 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => {
                                setHostelActionMsg(null);
                                setAllocRemarks('Hostel accommodation opted by student');
                                const activeH = currentHostels.filter((h) => h.status !== 'INACTIVE');
                                setAllocTargetHostelId(activeH[0]?.id || '');
                                const hRooms = currentHostelRooms.filter(
                                  (r) => r.hostelId === activeH[0]?.id && r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
                                );
                                setAllocTargetRoomId(hRooms[0]?.id || '');
                                const firstB = hRooms[0]?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                                setAllocTargetBedNumber(firstB?.bedNumber || '');
                                setIsAllocateBedModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                            >
                              <Bed className="w-3.5 h-3.5" />
                              <span>Allocate Hostel Bed</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 10: PORTAL ACCESS & CREDENTIALS */}
        {!isTeacher && activeTab === 'PORTAL' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Direct School Portal Credentials & Access Center
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unified authentication directly integrated into the school system. No third-party user directory.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Admission No: {student.admissionNumber}
              </span>
            </div>

            {portalMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  portalMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{portalMsg.text}</span>
              </div>
            )}

            {/* Student Portal Card */}
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 text-blue-800">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">Student Portal Login Account</h5>
                    <p className="text-xs text-slate-500">
                      Login ID: <strong className="font-mono text-blue-800">{student.admissionNumber}</strong> (or registration no: {student.registrationNumber})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                      student.loginEnabled !== false
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-red-100 text-red-800 border-red-300'
                    }`}
                  >
                    {student.loginEnabled !== false ? 'Active & Enabled' : 'Access Disabled'}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleStudentPortal}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                  >
                    {student.loginEnabled !== false ? 'Disable Access' : 'Enable Access'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleResetStudentPassword} className="p-4 bg-white rounded-lg border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Set / Reset Student Portal Password</span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={studentNewPassword}
                    onChange={(e) => setStudentNewPassword(e.target.value)}
                    placeholder="Enter new password (minimum 6 characters)"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setStudentNewPassword('CPS123')}
                    className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs cursor-pointer"
                  >
                    Use "CPS123"
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingStudentPass || !studentNewPassword.trim()}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg text-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isResettingStudentPass ? 'Updating...' : 'Set Password'}
                  </button>
                </div>
              </form>
            </div>

            {/* Parent Portal Card */}
            <div className="p-5 bg-purple-50/40 rounded-xl border border-purple-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-purple-100 text-purple-800">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">Parent / Guardian Portal Account</h5>
                    <p className="text-xs text-slate-500">
                      Login ID: <strong className="font-mono text-purple-900">{student.fatherMobile || student.parentPhone || 'Mobile Phone'}</strong> ({student.fatherName || student.parentName || 'Parent'})
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Father's registered mobile number is used as the Parent Portal Login ID.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-emerald-100 text-emerald-800 border-emerald-300">
                    Active
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleParentPortal}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-300 bg-white hover:bg-purple-50 text-purple-700 transition-colors cursor-pointer"
                  >
                    Sync Family Access
                  </button>
                </div>
              </div>

              <form onSubmit={handleResetParentPassword} className="p-4 bg-white rounded-lg border border-purple-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Set / Reset Parent Portal Password</span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={parentNewPassword}
                    onChange={(e) => setParentNewPassword(e.target.value)}
                    placeholder="Enter new parent password (minimum 6 characters)"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-purple-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setParentNewPassword('CPS123')}
                    className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs cursor-pointer"
                  >
                    Use "CPS123"
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingParentPass || !parentNewPassword.trim() || !student.parentPhone}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg text-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isResettingParentPass ? 'Updating...' : 'Set Parent Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 11: ACTIVITY / HISTORY */}
        {!isTeacher && activeTab === 'ACTIVITY' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Lifecycle Audit Trail & Activity Log
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete institutional timeline: admissions, status transitions, fee collections, exam marks, and promotions
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(student.activityHistory && student.activityHistory.length > 0 ? student.activityHistory : [
                {
                  id: 'act-init',
                  timestamp: student.admissionDate,
                  title: 'Student Admitted to School',
                  description: `Admitted into ${student.className}-${student.section} (Session ${student.academicSession}) with permanent admission number ${student.admissionNumber}`,
                  category: 'ADMISSION' as const,
                  performedBy: 'Admissions Office',
                }
              ]).map((act) => (
                <div
                  key={act.id}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3.5 text-xs hover:bg-slate-100/50 transition-colors"
                >
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-blue-700 mt-0.5 shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-slate-900 font-bold text-sm">{act.title}</strong>
                      <span className="text-[11px] font-mono text-slate-500">{act.timestamp}</span>
                    </div>
                    <p className="text-slate-600 mt-1 text-xs">{act.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2">
                      <span>Officer: <strong>{act.performedBy || 'Administrative Staff'}</strong></span>
                      <span>Category: <strong>{act.category || 'SYSTEM'}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Promotion Workflow Modal */}
      {isPromoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Academic Promotion Workflow</h3>
                <p className="text-xs text-slate-500">Promote {student.name} to the next academic level</p>
              </div>
              <button
                onClick={() => setIsPromoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePromoteSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Target Class *</label>
                <select
                  required
                  value={promoteTargetClassId}
                  onChange={(e) => {
                    setPromoteTargetClassId(e.target.value);
                    // Keep the section if the new class has it, otherwise its first section.
                    setPromoteTargetSection(sectionForClass(classes.find((c) => c.id === e.target.value), promoteTargetSection));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">Select Next Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Section</label>
                  <select
                    value={promoteTargetSection}
                    onChange={(e) => setPromoteTargetSection(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {/* Sections of the class chosen above (Academic Structure), not a fixed A / B / C list */}
                    {(() => {
                      const target = classes.find((c) => c.id === promoteTargetClassId);
                      const opts = classSectionOptions(target);
                      return (opts.length ? opts : [promoteTargetSection || 'A']).map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec}
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">New Academic Session</label>
                  <input
                    type="text"
                    value={promoteTargetSession}
                    onChange={(e) => setPromoteTargetSession(e.target.value)}
                    placeholder="2027-2028"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Custom Roll Number (Optional)</label>
                <input
                  type="text"
                  value={promoteCustomRoll}
                  onChange={(e) => setPromoteCustomRoll(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="Auto-assigned if left blank"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Promotion Remarks / Decision</label>
                <textarea
                  rows={2}
                  value={promoteRemark}
                  onChange={(e) => setPromoteRemark(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Promoted with Distinction in Annual Examination 2026"
                />
              </div>

              <label className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoteChargeBooks}
                  onChange={(e) => setPromoteChargeBooks(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <span className="text-slate-700">
                  <strong>Add Books & Stationery fee of the new class</strong>
                  <span className="block text-[11px] text-slate-500">Rate from Fee Management, billed once for the new session.</span>
                </span>
              </label>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px]">
                Current session details will be safely archived into the student's academic history table.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPromoteModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPromoting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg font-bold cursor-pointer"
                >
                  {isPromoting ? 'Promoting…' : 'Confirm Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DocumentPreviewModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={
          previewDoc
            ? {
                title: previewDoc.title || previewDoc.originalFileName || 'Document',
                fileKey: previewDoc.fileKey,
                originalFileName: previewDoc.originalFileName,
                contentType: previewDoc.contentType,
              }
            : null
        }
      />

      {/* Status Transition Workflow Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Student Enrollment Status</h3>
                <p className="text-xs text-slate-500">Update status with administrative justification</p>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Select New Status *</label>
                <select
                  value={statusNewValue}
                  onChange={(e) => setStatusNewValue(e.target.value as StudentStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold text-slate-800"
                >
                  <option value="ACTIVE">ACTIVE (Regular Enrolled)</option>
                  <option value="INACTIVE">INACTIVE (Extended Absence)</option>
                  <option value="ON_LEAVE">ON_LEAVE (Authorized Medical / Personal Leave)</option>
                  <option value="SUSPENDED">SUSPENDED (Disciplinary Hold)</option>
                  <option value="TRANSFERRED">TRANSFERRED (TC Issued to another school)</option>
                  <option value="WITHDRAWN">WITHDRAWN (Parent withdrawal request)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Effective Date</label>
                <input
                  type="date"
                  value={statusEffectiveDate}
                  onChange={(e) => setStatusEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Reason / Institutional Note</label>
                <textarea
                  rows={3}
                  required
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="State the formal administrative reason for this status transition..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold cursor-pointer"
                >
                  Apply Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Verification Modal */}
      {selectedDocForVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Document Verification Review</h3>
                <p className="text-xs text-slate-500">{selectedDocForVerification.title}</p>
              </div>
              <button
                onClick={() => setSelectedDocForVerification(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">File Name:</span>
                  <strong className="text-slate-900 truncate max-w-[200px]">{selectedDocForVerification.originalFileName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">File Size:</span>
                  <span className="text-slate-700 font-mono">{(selectedDocForVerification.fileSize / 1024).toFixed(1)} KB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Status:</span>
                  <span className="font-bold text-blue-700">{selectedDocForVerification.verificationStatus || 'PENDING'}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Verification Remark / Audit Note</label>
                <textarea
                  rows={2}
                  value={docVerifyRemark}
                  onChange={(e) => setDocVerifyRemark(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Original verified against civil registry record."
                />
              </div>

              <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleVerifyDocument('REJECTED')}
                  className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold cursor-pointer"
                >
                  Reject Document
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDocForVerification(null)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerifyDocument('VERIFIED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Mark Verified
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A4 Printable Student Profile Dossier Modal */}
      <PrintableStudentProfileModal
        student={student}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        settings={settings}
      />

      {/* A4 Printable Official Admission Letter Modal */}
      <PrintableAdmissionLetterModal
        student={student}
        isOpen={isAdmissionLetterOpen}
        onClose={() => setIsAdmissionLetterOpen(false)}
        settings={settings}
      />

      {/* Printable Exam Admit Card Modal */}
      {selectedExamForAdmitCard && (
        <PrintableAdmitCardModal
          student={student}
          exam={selectedExamForAdmitCard}
          isOpen={!!selectedExamForAdmitCard}
          onClose={() => setSelectedExamForAdmitCard(null)}
          settings={settings}
        />
      )}

      {/* Printable Exam Marksheet / Report Card Modal */}
      {selectedExamForReportCard && (
        <PrintableReportCardModal
          student={student}
          examId={selectedExamForReportCard.id}
          isOpen={!!selectedExamForReportCard}
          onClose={() => setSelectedExamForReportCard(null)}
          settings={settings}
        />
      )}

      {/* 1. Hostel Residency Full Details Modal */}
      {isHostelDetailsOpen && (() => {
        const hRooms = api.getHostelRooms();
        const hList = api.getHostels();
        const currentRoom = hRooms.find((r) => r.id === student.hostelRoomId);
        const currentHostel = hList.find((h) => h.id === student.hostelId || h.name === student.hostelName || h.id === currentRoom?.hostelId);
        const currentAlloc = api.getHostelAllocations().find((a) => a.studentId === student.id && a.status === 'ACTIVE');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-base text-slate-900">Hostel Residency Dossier</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHostelDetailsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{student.name}</h4>
                    <p className="text-[11px] text-slate-500 font-mono">Adm No: {student.admissionNumber} • Roll: {student.rollNumber}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {student.hostelStatus || 'ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Hostel Block</span>
                    <strong className="text-slate-900">{student.hostelName || currentHostel?.name || '—'}</strong>
                    <span className="text-[10px] text-slate-500 block">Type: {currentHostel?.type || 'BOYS'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Floor & Room</span>
                    <strong className="text-slate-900">Floor {student.hostelFloor || currentRoom?.floor || '1'} • Room {currentRoom?.roomNumber || student.hostelRoomId}</strong>
                    <span className="text-[10px] text-slate-500 block">Type: {currentRoom?.roomType || 'Standard'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Bed Identifier</span>
                    <strong className="text-indigo-900 font-mono text-sm font-bold">{student.hostelBedNumber || 'Bed A'}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Allocation Date</span>
                    <strong className="text-slate-900 font-mono">{student.hostelAllocationDate || currentAlloc?.allocationDate || student.admissionDate}</strong>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Warden Administration</span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Chief Warden:</span>
                    <strong className="text-slate-900">{student.hostelWarden || currentHostel?.wardenName || 'Shri Manoj Tiwary'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone:</span>
                    <strong className="text-slate-900 font-mono">{currentHostel?.wardenPhone || '—'}</strong>
                  </div>
                  {currentHostel?.emergencyPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Emergency Contact:</span>
                      <strong className="text-red-700 font-mono font-bold">{currentHostel.emergencyPhone}</strong>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 space-y-1">
                  <span className="text-indigo-900 block text-[10px] uppercase font-bold">Fee Profile</span>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Monthly Room Rent:</span>
                    <strong className="text-slate-900 font-mono">₹{student.hostelMonthlyFee || currentRoom?.monthlyFee || 0}/mo</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Monthly Mess & Dining:</span>
                    <strong className="text-slate-900 font-mono">₹{student.messMonthlyFee || currentHostel?.messFee || 0}/mo</strong>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsHostelDetailsOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold text-xs cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. Change Bed Modal */}
      {isChangeBedModalOpen && (() => {
        const allRooms = api.getHostelRooms();
        const availableRooms = allRooms.filter(
          (r) => r.status !== 'INACTIVE' && r.status !== 'MAINTENANCE' && r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
        );
        const selectedRoom = availableRooms.find((r) => r.id === changeTargetRoomId) || availableRooms[0];
        const availableBeds = selectedRoom?.beds?.filter(
          (b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'
        ) || [];

        const handleSubmitChange = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!selectedRoom || !changeTargetBedNumber) return;
          setHostelActionLoading(true);
          const res = await api.changeHostelBed(student.id, selectedRoom.id, changeTargetBedNumber, changeRemarks);
          setHostelActionLoading(false);
          if (!res.success) {
            setHostelActionMsg({ type: 'error', text: res.error || 'Failed to change bed.' });
          } else {
            if (res.student) onUpdate(res.student);
            setIsChangeBedModalOpen(false);
            setHostelActionMsg({
              type: 'success',
              text: `Bed changed successfully to Room ${res.room?.roomNumber} (${changeTargetBedNumber}).`,
            });
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-base text-slate-900">Change Student Bed</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangeBedModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500">Current Bed:</span>{' '}
                <strong className="text-slate-900">{student.hostelName} • Room {student.hostelRoomId} • {student.hostelBedNumber}</strong>
              </div>

              {availableRooms.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No other rooms with available beds found in active hostels.</span>
                </div>
              ) : (
                <form onSubmit={handleSubmitChange} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Room (Available Slots)</label>
                    <select
                      value={selectedRoom?.id || ''}
                      onChange={(e) => {
                        setChangeTargetRoomId(e.target.value);
                        const r = availableRooms.find((rm) => rm.id === e.target.value);
                        const fb = r?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                        setChangeTargetBedNumber(fb?.bedNumber || '');
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                    >
                      {availableRooms.map((r) => {
                        const freeSlots = r.beds?.filter((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE').length || 0;
                        return (
                          <option key={r.id} value={r.id}>
                            {r.hostelName} • Room {r.roomNumber} (Floor {r.floor} • {freeSlots} free beds)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Bed Identifier</label>
                    <select
                      value={changeTargetBedNumber || (availableBeds[0]?.bedNumber || '')}
                      onChange={(e) => setChangeTargetBedNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-medium"
                    >
                      {availableBeds.map((b) => (
                        <option key={b.bedNumber} value={b.bedNumber}>
                          {b.bedNumber} (Available)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Transfer Reason / Remarks</label>
                    <input
                      type="text"
                      value={changeRemarks}
                      onChange={(e) => setChangeRemarks(e.target.value)}
                      placeholder="e.g. Requested lower floor / medical comfort"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsChangeBedModalOpen(false)}
                      className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={hostelActionLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {hostelActionLoading ? 'Transferring...' : 'Confirm Bed Change'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* 3. Vacate Bed Modal */}
      {isVacateBedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <LogOut className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-base text-slate-900">Vacate Hostel Bed</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVacateBedModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
              <p className="font-bold">Vacate Student from Campus Hostel Residency?</p>
              <p>
                Student <strong>{student.name}</strong> will be transitioned to <strong>Day Scholar</strong>.
                Bed <strong>{student.hostelBedNumber}</strong> in <strong>{student.hostelName} (Room {student.hostelRoomId})</strong> will immediately become available for other students.
              </p>
            </div>

            <div className="text-xs space-y-1">
              <label className="block font-semibold text-slate-700">Vacation Reason / Remarks</label>
              <input
                type="text"
                value={vacateRemarks}
                onChange={(e) => setVacateRemarks(e.target.value)}
                placeholder="e.g. Relocated to parental home in Sheohar"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setIsVacateBedModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={hostelActionLoading}
                onClick={async () => {
                  setHostelActionLoading(true);
                  const res = await api.vacateHostelBed(student.id, vacateRemarks);
                  setHostelActionLoading(false);
                  if (!res.success) {
                    setHostelActionMsg({ type: 'error', text: res.error || 'Failed to vacate bed.' });
                  } else {
                    if (res.student) onUpdate(res.student);
                    setIsVacateBedModalOpen(false);
                    setHostelActionMsg({ type: 'success', text: `Student vacated hostel bed successfully. Bed is now available.` });
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {hostelActionLoading ? 'Vacating...' : 'Confirm Vacate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Allocate Bed to Day Scholar Modal */}
      {isAllocateBedModalOpen && (() => {
        const activeHostels = api.getHostels().filter((h) => h.status !== 'INACTIVE');
        const activeRooms = api.getHostelRooms().filter((r) => r.status !== 'INACTIVE' && r.status !== 'MAINTENANCE');
        const currentHId = allocTargetHostelId || activeHostels[0]?.id;
        const hRooms = activeRooms.filter(
          (r) => r.hostelId === currentHId && r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
        );
        const selectedRoom = hRooms.find((r) => r.id === allocTargetRoomId) || hRooms[0];
        const availableBeds = selectedRoom?.beds?.filter(
          (b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'
        ) || [];

        const handleSubmitAllocate = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!selectedRoom || !allocTargetBedNumber) return;
          setHostelActionLoading(true);
          const res = await api.allocateHostelBed(selectedRoom.id, allocTargetBedNumber, student.id, allocRemarks);
          setHostelActionLoading(false);
          if (!res.success) {
            setHostelActionMsg({ type: 'error', text: res.error || 'Failed to allocate bed.' });
          } else {
            if (res.student) onUpdate(res.student);
            setIsAllocateBedModalOpen(false);
            setHostelActionMsg({
              type: 'success',
              text: `Allocated Bed ${allocTargetBedNumber} in Room ${res.room?.roomNumber} to ${student.name}.`,
            });
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Bed className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-base text-slate-900">Allocate Hostel Bed</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAllocateBedModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {activeHostels.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                  No active hostels configured. Please configure hostels first.
                </div>
              ) : (
                <form onSubmit={handleSubmitAllocate} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Hostel Block</label>
                    <select
                      value={currentHId}
                      onChange={(e) => {
                        setAllocTargetHostelId(e.target.value);
                        const nextRooms = activeRooms.filter(
                          (r) => r.hostelId === e.target.value && r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
                        );
                        setAllocTargetRoomId(nextRooms[0]?.id || '');
                        const fb = nextRooms[0]?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                        setAllocTargetBedNumber(fb?.bedNumber || '');
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                    >
                      {activeHostels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.type === 'BOYS' ? 'Boys' : 'Girls'} Wing)
                        </option>
                      ))}
                    </select>
                  </div>

                  {hRooms.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                      No rooms with available beds in this hostel. Please select another hostel.
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Available Room</label>
                        <select
                          value={selectedRoom?.id || ''}
                          onChange={(e) => {
                            setAllocTargetRoomId(e.target.value);
                            const rm = hRooms.find((r) => r.id === e.target.value);
                            const fb = rm?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                            setAllocTargetBedNumber(fb?.bedNumber || '');
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                        >
                          {hRooms.map((r) => {
                            const freeSlots = r.beds?.filter((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE').length || 0;
                            return (
                              <option key={r.id} value={r.id}>
                                Room {r.roomNumber} (Floor {r.floor} • {r.roomType || 'Standard'} • {freeSlots} free)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Available Bed Identifier</label>
                        <select
                          value={allocTargetBedNumber || (availableBeds[0]?.bedNumber || '')}
                          onChange={(e) => setAllocTargetBedNumber(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-medium"
                        >
                          {availableBeds.map((b) => (
                            <option key={b.bedNumber} value={b.bedNumber}>
                              {b.bedNumber} (Available)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                        <input
                          type="text"
                          value={allocRemarks}
                          onChange={(e) => setAllocRemarks(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setIsAllocateBedModalOpen(false)}
                          className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={hostelActionLoading}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {hostelActionLoading ? 'Allocating...' : 'Allocate Bed'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* MANAGE TRANSPORT ALLOCATION MODAL */}
      {isManageTransportModalOpen && (() => {
        const activeRoutes = (transportRoutesList.length > 0 ? transportRoutesList : api.getRoutes()).filter((r) => (r.status || 'ACTIVE') === 'ACTIVE');
        const selectedRoute = activeRoutes.find((r) => r.id === transportRouteId) || activeRoutes[0];
        const availableStops = (selectedRoute?.stops || []).filter((s) => s.status !== 'INACTIVE' && s.active !== false);
        const selectedStop = availableStops.find((s) => s.id === transportStopId || s.stopName === transportStopId) || availableStops[0];
        const monthlyFare = Number(selectedStop?.monthlyFare ?? selectedStop?.fare ?? selectedStop?.fee ?? 0);

        const handleSaveTransport = async (e: React.FormEvent) => {
          e.preventDefault();
          setTransportActionLoading(true);
          setTransportActionMsg(null);
          try {
            if (transportRequired) {
              if (!selectedRoute) {
                throw new Error('Please select an active transit route.');
              }
              if (!selectedStop) {
                throw new Error('Please select a designated bus stop.');
              }
              const res = await api.allocateTransport(student.id, selectedRoute.id, selectedStop.stopName, selectedStop.id);
              if (res.student) onUpdate(res.student);
              setIsManageTransportModalOpen(false);
              setTransportActionMsg({
                type: 'success',
                text: `Transport allocated on ${selectedRoute.routeName} at ${selectedStop.stopName} (₹${monthlyFare}/mo).`,
              });
            } else {
              const res = await api.deallocateTransport(student.id);
              if (res.student) onUpdate(res.student);
              setIsManageTransportModalOpen(false);
              setTransportActionMsg({
                type: 'success',
                text: `Transport deallocated for ${student.name}. Designated as Day Scholar.`,
              });
            }
          } catch (err: any) {
            setTransportActionMsg({ type: 'error', text: err?.message || 'Failed to update transport allocation.' });
          } finally {
            setTransportActionLoading(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Bus className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Manage Transport Allocation</h3>
                    <p className="text-xs text-slate-500">{student.name} • {student.admissionNumber} • {student.className}-{student.section}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManageTransportModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveTransport} className="space-y-4 text-xs">
                {/* Opt In / Out Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-900 block">School Bus Facility</span>
                    <span className="text-[11px] text-slate-500">
                      {transportRequired ? 'Student requires daily school bus transit' : 'Student travels via self conveyance / day scholar'}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transportRequired}
                      onChange={(e) => setTransportRequired(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                    />
                    <span className="ml-2 font-bold text-slate-700">
                      {transportRequired ? 'Opted In' : 'Opt Out'}
                    </span>
                  </label>
                </div>

                {transportRequired && (
                  <div className="space-y-3">
                    {activeRoutes.length === 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                        No active transport routes available. Please create routes first in the Transport module.
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Transit Route</label>
                          <select
                            value={selectedRoute?.id || ''}
                            onChange={(e) => {
                              setTransportRouteId(e.target.value);
                              const rt = activeRoutes.find((r) => r.id === e.target.value);
                              const fStop = (rt?.stops || []).find((s) => s.status !== 'INACTIVE' && s.active !== false);
                              setTransportStopId(fStop?.id || '');
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                          >
                            {activeRoutes.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.routeName || r.name} {r.vehicleNumber ? `(${r.vehicleNumber})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Designated Bus Stop</label>
                          <select
                            value={selectedStop?.id || ''}
                            onChange={(e) => setTransportStopId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                          >
                            {availableStops.length === 0 ? (
                              <option value="">No stops configured for this route</option>
                            ) : (
                              availableStops.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.stopName} (Pickup: {s.pickupTime}, Drop: {s.dropTime}) — ₹{Number(s.monthlyFare ?? s.fare ?? s.fee ?? 0).toLocaleString('en-IN')}/mo
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {/* Route & Vehicle Summary Card */}
                        {selectedRoute && (
                          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1.5 text-[11px] text-slate-700">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Assigned Bus:</span>
                              <strong className="font-mono text-slate-900">{selectedRoute.vehicleNumber || 'No Bus Assigned'}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Driver & Phone:</span>
                              <strong className="text-slate-900">{selectedRoute.driverName || 'N/A'} {selectedRoute.driverPhone ? `(${selectedRoute.driverPhone})` : ''}</strong>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-amber-200/60 font-semibold">
                              <span className="text-slate-600">Monthly Transport Fare:</span>
                              <strong className="text-emerald-800 font-mono text-xs">₹{monthlyFare.toLocaleString('en-IN')} / mo</strong>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsManageTransportModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={transportActionLoading || (transportRequired && (!selectedRoute || !selectedStop))}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {transportActionLoading ? 'Saving...' : transportRequired ? 'Save Allocation' : 'Deallocate Transport'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Dynamic Admit Card Modal */}
      {selectedExamForAdmitCard && (
        <PrintableAdmitCardModal
          student={student}
          exam={selectedExamForAdmitCard}
          isOpen={!!selectedExamForAdmitCard}
          onClose={() => setSelectedExamForAdmitCard(null)}
          settings={settings || api.getSettings()}
        />
      )}

      {/* Dynamic Report Card / Marksheet Modal */}
      {selectedExamForReportCard && (
        <PrintableReportCardModal
          student={student}
          isOpen={!!selectedExamForReportCard}
          onClose={() => setSelectedExamForReportCard(null)}
          settings={settings || api.getSettings()}
          examId={selectedExamForReportCard.id}
        />
      )}
    </div>
  );
};
