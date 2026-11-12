import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Cloud,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  FolderOpen,
  GraduationCap,
  Layers,
  Lock,
  Phone,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
  AlertCircle,
  Eye,
  Loader2,
} from 'lucide-react';
import {
  SchoolSettings,
  Student,
  TeacherStaff,
  StudyMaterial,
  AcademicClass,
  Exam,
  ExamMark,
  Subject,
  User,
} from '../../types';
import { api } from '../../services/api';
import { getFileContentUrl } from '../../services/apiConfig';
import { fileUploadService, UploadResult } from '../../services/fileUploadService';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { PrintableIdCardModal } from '../modals/PrintableIdCardModal';
import { PrintableReportCardModal } from '../modals/PrintableReportCardModal';
import { PrintableCertificateModal } from '../modals/PrintableCertificateModal';
import { ParentReportsView } from '../parent/ParentReportsView';
import { calculateEvaluation } from '../../utils/grading';
import { hasPermission } from '../../utils/rbac';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity as savedSchoolIdentity } from '../../utils/schoolIdentity';

interface DocumentsViewProps {
  settings: SchoolSettings;
  userRole?: string;
  currentUser?: User;
}

/**
 * Reusable Avatar / Profile Photo Component with Graceful Fallback
 */
const AvatarPhoto: React.FC<{
  photo?: string;
  name: string;
  type?: 'student' | 'staff';
  badge?: string;
}> = ({ photo, name, type = 'student', badge }) => {
  const [hasError, setHasError] = useState(false);

  const resolvedUrl = useMemo(() => {
    if (!photo || !photo.trim()) return '';
    return getFileContentUrl(photo);
  }, [photo]);

  const initials = useMemo(() => {
    if (!name) return type === 'student' ? 'S' : 'T';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }, [name, type]);

  if (resolvedUrl && !hasError) {
    return (
      <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs">
        <img
          src={resolvedUrl}
          alt={name}
          className="w-full h-full object-cover object-top"
          onError={() => setHasError(true)}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  const gradientClass =
    type === 'student'
      ? 'bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white'
      : 'bg-gradient-to-br from-purple-700 via-purple-800 to-indigo-900 text-white';

  return (
    <div
      className={`w-11 h-11 rounded-xl shrink-0 flex flex-col items-center justify-center font-bold text-xs shadow-2xs border border-slate-200 ${gradientClass}`}
    >
      <span>{initials}</span>
      {badge && <span className="text-[7px] uppercase tracking-wider opacity-75">{badge}</span>}
    </div>
  );
};

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  settings,
  userRole,
  currentUser,
}) => {
  // Active session
  const academicSession =
    api.getActiveAcademicSession()?.name || settings.currentAcademicSession || '2026-2027';

  const activeUser = currentUser || api.getCurrentUser();
  const effectiveRole = userRole || activeUser?.role || 'SUPER_ADMIN';
  const isTeacher = effectiveRole === 'TEACHER';
  // Students get the same read-only report cards and ID card as a parent, for themselves.
  const isParent = effectiveRole === 'PARENT' || effectiveRole === 'STUDENT';

  if (isParent) {
    return <ParentReportsView currentUser={activeUser} settings={settings} />;
  }

  // Active navigation tab
  const [activeDocType, setActiveDocType] = useState<
    'STUDENT_ID' | 'STAFF_ID' | 'REPORT_CARDS' | 'TC_BONAFIDE' | 'R2_REPOSITORY'
  >('STUDENT_ID');

  // Teacher assigned classes state
  const [assignedClassesData, setAssignedClassesData] = useState<{
    allAccess: boolean;
    classes: { classId: string; className: string; sections: string[] }[];
  }>({
    allAccess: !isTeacher,
    classes: [],
  });

  useEffect(() => {
    if (isTeacher) {
      if (activeDocType !== 'STUDENT_ID') {
        setActiveDocType('STUDENT_ID');
      }
      api.getTeacherAuthorizedAssignments().then((res) => {
        setAssignedClassesData({
          allAccess: res.allAccess,
          classes: res.classes,
        });
      });
    }
  }, [isTeacher, activeDocType]);

  // Base datasets
  const [students, setStudents] = useState<Student[]>(() => api.getStudents());
  const [staff, setStaff] = useState<TeacherStaff[]>(() => api.getStaff());
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>(() => api.getStudyMaterials());
  const [exams, setExams] = useState<Exam[]>(() => api.getExams());
  const [examMarks, setExamMarks] = useState<ExamMark[]>([]);

  // Common filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // Staff specific filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedStaffRole, setSelectedStaffRole] = useState<string>('ALL');

  // Report cards specific filters
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Bulk selection states
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [bulkStaffForId, setBulkStaffForId] = useState<TeacherStaff[] | null>(null);
  const [isPreparingBulkStaff, setIsPreparingBulkStaff] = useState(false);
  const [isBulkIdCardOpen, setIsBulkIdCardOpen] = useState(false);
  const [isBulkReportCardOpen, setIsBulkReportCardOpen] = useState(false);

  // R2 Repository state
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    title: '',
    description: '',
    className: 'Class 10',
    subject: 'Mathematics',
    category: 'STUDY_MATERIAL' as 'STUDY_MATERIAL' | 'HOMEWORK' | 'SYLLABUS' | 'CIRCULAR',
    fileKey: '',
    originalFileName: '',
    fileSize: 0,
    contentType: 'application/pdf',
  });

  // Single preview dialog states
  const [selectedStudentForId, setSelectedStudentForId] = useState<Student | null>(null);
  const [selectedStaffForId, setSelectedStaffForId] = useState<TeacherStaff | null>(null);
  const [generatingStaffId, setGeneratingStaffId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [certData, setCertData] = useState<{ student: Student; type: 'TC' | 'BONAFIDE' | 'CHARACTER' } | null>(
    null
  );

  const handleCloseStaffIdModal = useCallback(() => {
    setSelectedStaffForId(null);
  }, []);

  const handlePrintFacultyCard = useCallback(
    async (st: TeacherStaff) => {
      if (generatingStaffId) return;

      if (isTeacher) {
        setActionFeedback({
          type: 'error',
          message: 'Access Denied: Teachers are authorized for Student ID Cards only.',
        });
        setTimeout(() => setActionFeedback(null), 4000);
        return;
      }

      const canGenerate = hasPermission({ role: effectiveRole as any }, 'documents.generate');
      if (!canGenerate) {
        setActionFeedback({
          type: 'error',
          message: 'Access Denied: You do not have authorization to print faculty ID cards.',
        });
        setTimeout(() => setActionFeedback(null), 4000);
        return;
      }

      try {
        setGeneratingStaffId(st.id);
        let targetStaff = st;
        try {
          const fresh = await api.fetchStaffDirect(st.id);
          if (fresh) targetStaff = fresh;
        } catch (err) {
          console.warn('[DocumentsView] Using cached staff details:', err);
        }
        setSelectedStaffForId(targetStaff);
      } catch (err) {
        console.error('[DocumentsView] Error loading faculty card:', err);
        setActionFeedback({
          type: 'error',
          message: 'Could not generate faculty card. Please try again.',
        });
        setTimeout(() => setActionFeedback(null), 4000);
      } finally {
        setGeneratingStaffId(null);
      }
    },
    [generatingStaffId, effectiveRole, isTeacher]
  );

  // Dynamically fetch strictly ACTIVE classes for the current session
  const activeClasses = useMemo(() => {
    return api.getActiveClasses(academicSession);
  }, [academicSession]);

  // Sync data dynamically on mount and listen to realtime events
  const refreshAllData = useCallback(async () => {
    try {
      const [freshStudents, freshStaff, freshExams] = await Promise.all([
        api.syncStudents().catch(() => api.getStudents()),
        api.syncStaff().catch(() => api.getStaff()),
        api.fetchExams().catch(() => api.getExams()),
      ]);

      if (Array.isArray(freshStudents) && freshStudents.length > 0) {
        setStudents(freshStudents);
      }
      if (Array.isArray(freshStaff) && freshStaff.length > 0) {
        setStaff(freshStaff);
      }
      if (Array.isArray(freshExams) && freshExams.length > 0) {
        setExams(freshExams);
      }
      setStudyMaterials(api.getStudyMaterials());
    } catch (e) {
      console.warn('[DocumentsView] Error refreshing data:', e);
    }
  }, []);

  useEffect(() => {
    refreshAllData();

    const handleSync = () => {
      setStudents(api.getStudents());
      setStaff(api.getStaff());
      setExams(api.getExams());
      setStudyMaterials(api.getStudyMaterials());
    };

    window.addEventListener('cps_entity_students', handleSync);
    window.addEventListener('cps_entity_staff', handleSync);
    window.addEventListener('cps_entity_exams', handleSync);

    return () => {
      window.removeEventListener('cps_entity_students', handleSync);
      window.removeEventListener('cps_entity_staff', handleSync);
      window.removeEventListener('cps_entity_exams', handleSync);
    };
  }, [refreshAllData]);

  // Automatically select an initial default exam when exams are available
  useEffect(() => {
    if (!selectedExamId && exams.length > 0) {
      // Prioritize exams matching active session and with approval
      const preferred =
        exams.find((e) => e.academicSession === academicSession && e.isApprovedByPrincipal) ||
        exams.find((e) => e.academicSession === academicSession) ||
        exams[0];
      setSelectedExamId(preferred.id);
    }
  }, [exams, academicSession, selectedExamId]);

  // Load marks for the selected exam dynamically
  useEffect(() => {
    if (selectedExamId) {
      const localMarks = api.getExamMarks(selectedExamId);
      setExamMarks(localMarks);
      api.fetchExamMarks(selectedExamId).then((fresh) => {
        if (Array.isArray(fresh) && fresh.length > 0) {
          setExamMarks(fresh);
        }
      });
    } else {
      setExamMarks([]);
    }
  }, [selectedExamId]);

  // Applicable exams for the currently selected class & session
  const applicableExams = useMemo(() => {
    return exams.filter((e) => {
      // Must match academic session
      const matchesSession = !e.academicSession || e.academicSession === academicSession;
      if (!matchesSession) return false;

      // If a specific class is selected, exam must be configured for that class
      if (selectedClassId !== 'ALL') {
        return Array.isArray(e.classIds) && e.classIds.includes(selectedClassId);
      }
      return true;
    });
  }, [exams, academicSession, selectedClassId]);

  // Scoped available classes for dropdown
  const availableClasses = useMemo(() => {
    if (!isTeacher || assignedClassesData.allAccess) {
      return activeClasses;
    }
    const assignedIds = new Set(assignedClassesData.classes.map((c) => c.classId.toLowerCase()));
    const assignedNames = new Set(assignedClassesData.classes.map((c) => c.className.toLowerCase()));
    return activeClasses.filter(
      (c) => assignedIds.has(c.id.toLowerCase()) || assignedNames.has(c.name.toLowerCase())
    );
  }, [activeClasses, isTeacher, assignedClassesData]);

  // Available sections for the selected class
  const availableSections = useMemo(() => {
    if (selectedClassId === 'ALL') {
      if (isTeacher && !assignedClassesData.allAccess) {
        const allSecs = new Set<string>();
        assignedClassesData.classes.forEach((c) => c.sections.forEach((s) => allSecs.add(s)));
        return Array.from(allSecs).sort();
      }
      return [];
    }
    if (isTeacher && !assignedClassesData.allAccess) {
      const matched = assignedClassesData.classes.find(
        (c) => c.classId.toLowerCase() === selectedClassId.toLowerCase() || c.className.toLowerCase() === selectedClassId.toLowerCase()
      );
      if (matched && matched.sections.length > 0) {
        return matched.sections;
      }
    }
    const cls = activeClasses.find((c) => c.id === selectedClassId || c.name.toLowerCase() === selectedClassId.toLowerCase());
    if (!cls) return [];
    if (Array.isArray(cls.sections) && cls.sections.length > 0) {
      return cls.sections;
    }
    return ['A'];
  }, [selectedClassId, activeClasses, isTeacher, assignedClassesData]);

  // Auto-reset section if it is no longer valid for the selected class
  useEffect(() => {
    if (selectedSection !== 'ALL' && availableSections.length > 0 && !availableSections.includes(selectedSection)) {
      setSelectedSection('ALL');
    }
  }, [selectedClassId, availableSections, selectedSection]);

  // Scoped students list strictly authorized for current teacher
  const teacherScopedStudents = useMemo(() => {
    if (!isTeacher || assignedClassesData.allAccess) {
      return students;
    }
    const assignedIds = new Set(assignedClassesData.classes.map((c) => c.classId.toLowerCase()));
    const assignedNames = new Set(assignedClassesData.classes.map((c) => c.className.toLowerCase()));
    return students.filter((s) => {
      const sCId = (s.classId || '').toLowerCase();
      const sCName = (s.className || '').toLowerCase();
      const matchClass = (sCId && assignedIds.has(sCId)) || (sCName && assignedNames.has(sCName)) || (sCId && assignedNames.has(sCId));
      if (!matchClass) return false;
      const matchedCls = assignedClassesData.classes.find(
        (ac) => ac.classId.toLowerCase() === sCId || ac.className.toLowerCase() === sCName || ac.className.toLowerCase() === sCId
      );
      if (matchedCls) {
        return matchedCls.sections.some((sec) => sec.toUpperCase() === (s.section || 'A').toUpperCase());
      }
      return true;
    });
  }, [students, isTeacher, assignedClassesData]);

  // Filtered Students list
  const filteredStudents = useMemo(() => {
    return teacherScopedStudents.filter((s) => {
      // Class filter
      if (selectedClassId !== 'ALL') {
        const matchesCls =
          s.classId === selectedClassId ||
          (s.className && s.className.toLowerCase() === selectedClassId.toLowerCase());
        if (!matchesCls) return false;
      }
      // Section filter
      if (selectedSection !== 'ALL') {
        if ((s.section || 'A').toUpperCase() !== selectedSection.toUpperCase()) return false;
      }
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = (s.name || '').toLowerCase().includes(q);
        const matchesAdm = (s.admissionNumber || '').includes(q);
        const matchesRoll = String(s.rollNumber || '').includes(q);
        const matchesFather = (s.fatherName || s.parentName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesAdm && !matchesRoll && !matchesFather) {
          return false;
        }
      }
      return true;
    });
  }, [teacherScopedStudents, selectedClassId, selectedSection, searchTerm]);

  // Filtered Staff list
  const filteredStaff = useMemo(() => {
    return staff.filter((st) => {
      // Department filter
      if (selectedDepartment !== 'ALL') {
        const dept = (st.department || '').toUpperCase();
        if (dept !== selectedDepartment.toUpperCase()) return false;
      }
      // Role filter
      if (selectedStaffRole !== 'ALL') {
        const isTeaching =
          (st.designation || '').toLowerCase().includes('teacher') ||
          (st.designation || '').toLowerCase().includes('pgt') ||
          (st.designation || '').toLowerCase().includes('tgt') ||
          (st.designation || '').toLowerCase().includes('prt');
        if (selectedStaffRole === 'TEACHING' && !isTeaching) return false;
        if (selectedStaffRole === 'NON_TEACHING' && isTeaching) return false;
      }
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = (st.name || '').toLowerCase().includes(q);
        const matchesEmpId = (st.employeeId || '').toLowerCase().includes(q);
        const matchesPhone = (st.phone || '').includes(q);
        const matchesDesig = (st.designation || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmpId && !matchesPhone && !matchesDesig) {
          return false;
        }
      }
      return true;
    });
  }, [staff, selectedDepartment, selectedStaffRole, searchTerm]);

  // Distinct staff departments
  const staffDepartments = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => {
      if (s.department) set.add(s.department.toUpperCase());
    });
    return Array.from(set).sort();
  }, [staff]);

  // Filtered Study Materials
  const filteredMaterials = useMemo(() => {
    return studyMaterials.filter((m) => {
      const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
      const matchesSearch =
        !searchTerm.trim() ||
        (m.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.className || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [studyMaterials, selectedCategory, searchTerm]);

  // Bulk student selection handlers
  const handleToggleStudentSelect = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllStudents = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  // Selected students array for bulk printing
  const selectedStudentsForBulk = useMemo(() => {
    return teacherScopedStudents.filter((s) => selectedStudentIds.includes(s.id));
  }, [teacherScopedStudents, selectedStudentIds]);

  // Bulk staff ID cards: tick staff (or Select All) and download every card in one PDF
  const allStaffShownSelected = filteredStaff.length > 0 && filteredStaff.every((st) => selectedStaffIds.includes(st.id));
  const handleToggleStaffSelect = (id: string) => {
    setSelectedStaffIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };
  const handleSelectAllStaff = () => {
    const shown = filteredStaff.map((st) => st.id);
    setSelectedStaffIds((prev) => (allStaffShownSelected ? prev.filter((id) => !shown.includes(id)) : Array.from(new Set([...prev, ...shown]))));
  };
  const handleOpenBulkStaffCards = async () => {
    if (isPreparingBulkStaff || selectedStaffIds.length === 0) return;
    if (!hasPermission({ role: effectiveRole as any }, 'documents.generate')) {
      setActionFeedback({ type: 'error', message: 'Access Denied: You do not have authorization to print faculty ID cards.' });
      setTimeout(() => setActionFeedback(null), 4000);
      return;
    }
    setIsPreparingBulkStaff(true);
    try {
      const chosen = staff.filter((st) => selectedStaffIds.includes(st.id));
      // Latest details (photo, designation) for each card, a few at a time.
      const fresh: TeacherStaff[] = [];
      for (let i = 0; i < chosen.length; i += 6) {
        const part = await Promise.all(chosen.slice(i, i + 6).map((st) => api.fetchStaffDirect(st.id).then((f) => f || st).catch(() => st)));
        fresh.push(...part);
      }
      setBulkStaffForId(fresh);
    } finally {
      setIsPreparingBulkStaff(false);
    }
  };

  // Student marks statistics for selected exam
  const studentExamStats = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        hasMarks: boolean;
        subjectCount: number;
        totalObtained: number;
        totalMax: number;
        percentage: number;
        grade: string;
      }
    >();

    if (!selectedExamId || examMarks.length === 0) return statsMap;

    filteredStudents.forEach((st) => {
      // One entry per subject, and only subjects that apply to the student's class (when known),
      // so duplicate or orphan rows never inflate the totals.
      const classSubjectIds = new Set(
        (api.getActiveSubjects(st.classId) || []).filter((sub) => Array.isArray(sub.classIds) && sub.classIds.includes(st.classId)).map((sub) => sub.id)
      );
      const latestBySubject = new Map<string, ExamMark>();
      examMarks.filter((m) => m.studentId === st.id).forEach((m) => {
        if (classSubjectIds.size === 0 || classSubjectIds.has(m.subjectId)) latestBySubject.set(m.subjectId, m);
      });
      const stMarks = Array.from(latestBySubject.values());
      if (stMarks.length === 0) {
        statsMap.set(st.id, {
          hasMarks: false,
          subjectCount: 0,
          totalObtained: 0,
          totalMax: 0,
          percentage: 0,
          grade: '—',
        });
      } else {
        let totalObtained = 0;
        let totalMax = 0;
        stMarks.forEach((m) => {
          totalObtained += m.isAbsent ? 0 : m.marksObtained || 0;
          totalMax += m.maxMarks || 100;
        });
        const percentage = totalMax > 0 ? +((totalObtained / totalMax) * 100).toFixed(1) : 0;
        const evalRes = calculateEvaluation(totalObtained, totalMax);
        statsMap.set(st.id, {
          hasMarks: true,
          subjectCount: stMarks.length,
          totalObtained,
          totalMax,
          percentage,
          grade: evalRes?.grade || '—',
        });
      }
    });

    return statsMap;
  }, [filteredStudents, selectedExamId, examMarks]);

  // Students with published marks for the selected exam
  const studentsWithMarks = useMemo(() => {
    return filteredStudents.filter((st) => studentExamStats.get(st.id)?.hasMarks);
  }, [filteredStudents, studentExamStats]);

  // R2 File download handler
  const handleDownloadFile = async (fileKey: string, fileName: string) => {
    try {
      const url = await fileUploadService.getDownloadUrl(fileKey);
      if (!url) {
        alert('The file could not be downloaded. Please try again.');
        return;
      }
      const win = window.open(url, '_blank');
      if (!win) {
        window.location.href = url;
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  // Delete material handler
  const handleDeleteMaterial = async (material: StudyMaterial) => {
    if (window.confirm(`Delete "${material.title}" permanently?`)) {
      if (material.fileKey) {
        await fileUploadService.deleteFile(material.fileKey);
      }
      api.deleteStudyMaterial(material.id);
      setStudyMaterials(api.getStudyMaterials());
    }
  };

  // Material upload complete
  const handleMaterialUploadComplete = (res: UploadResult) => {
    setUploadFormData((prev) => ({
      ...prev,
      fileKey: res.fileKey,
      originalFileName: res.originalFileName,
      fileSize: res.fileSize,
      contentType: res.contentType,
      title: prev.title || res.originalFileName.replace(/\.[^/.]+$/, ''),
    }));
  };

  // Save uploaded material
  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFormData.title || !uploadFormData.fileKey) {
      alert('Please upload a file and enter a title.');
      return;
    }

    const created = api.addStudyMaterial({
      title: uploadFormData.title,
      description: uploadFormData.description,
      className: uploadFormData.className,
      subject: uploadFormData.subject,
      category: uploadFormData.category,
      fileKey: uploadFormData.fileKey,
      originalFileName: uploadFormData.originalFileName,
      fileSize: uploadFormData.fileSize,
      contentType: uploadFormData.contentType,
      uploadedBy: 'Mrs. Sunita Verma',
    });

    fileUploadService.confirmFileAssociation(uploadFormData.fileKey, {
      type: 'STUDY_MATERIAL',
      id: created.id,
    });

    setStudyMaterials(api.getStudyMaterials());
    setIsUploadModalOpen(false);
    setUploadFormData({
      title: '',
      description: '',
      className: 'Class 10',
      subject: 'Mathematics',
      category: 'STUDY_MATERIAL',
      fileKey: '',
      originalFileName: '',
      fileSize: 0,
      contentType: 'application/pdf',
    });
  };

  return (
    <div className="space-y-5">
      {/* Module Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>{isTeacher ? 'Student Documents — Student ID Cards' : 'Official Documents & ID Cards'}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {academicSession}
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {isTeacher
                  ? 'Authorized Student ID Card generation, preview, printing & downloads for assigned classes'
                  : [savedSchoolIdentity(settings).name, affiliationText(savedSchoolIdentity(settings))].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshAllData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-semibold text-slate-500 overflow-x-auto bg-white px-2 rounded-t-xl border-x">
        <button
          onClick={() => {
            setActiveDocType('STUDENT_ID');
            setSearchTerm('');
          }}
          className={`py-3.5 px-4 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeDocType === 'STUDENT_ID'
              ? 'border-blue-700 text-blue-900 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Student ID Cards (with QR)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 font-mono">
            {isTeacher ? teacherScopedStudents.length : students.length}
          </span>
        </button>

        {!isTeacher && (
          <>
            <button
              onClick={() => {
                setActiveDocType('STAFF_ID');
                setSearchTerm('');
              }}
              className={`py-3.5 px-4 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeDocType === 'STAFF_ID'
                  ? 'border-purple-700 text-purple-900 font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Staff & Faculty ID Cards</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-800 font-mono">
                {staff.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveDocType('REPORT_CARDS');
                setSearchTerm('');
              }}
              className={`py-3.5 px-4 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeDocType === 'REPORT_CARDS'
                  ? 'border-emerald-700 text-emerald-900 font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Marksheets</span>
            </button>

            <button
              onClick={() => {
                setActiveDocType('TC_BONAFIDE');
                setSearchTerm('');
              }}
              className={`py-3.5 px-4 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeDocType === 'TC_BONAFIDE'
                  ? 'border-amber-700 text-amber-900 font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>TC & Bonafide Certificates</span>
            </button>

          </>
        )}
      </div>

      {/* TAB 1: STUDENT ID CARDS */}
      {activeDocType === 'STUDENT_ID' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 text-xs">
              {/* Search */}
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by student name, admission number, roll no, or father's name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Class Filter (Active Classes only) */}
              <div className="md:col-span-4 flex items-center gap-2">
                <span className="text-slate-500 font-semibold whitespace-nowrap text-[11px]">Class:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedSection('ALL');
                    setSelectedStudentIds([]);
                  }}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  <option value="ALL">
                    {isTeacher ? 'All Authorized Classes' : 'All Active Classes'} ({teacherScopedStudents.length} Students)
                  </option>
                  {availableClasses.map((cls) => {
                    const countInClass = teacherScopedStudents.filter(
                      (s) => s.classId === cls.id || (s.className && s.className.toLowerCase() === cls.name.toLowerCase())
                    ).length;
                    return (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({countInClass} Students)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Section Filter */}
              <div className="md:col-span-3 flex items-center gap-2">
                <span className="text-slate-500 font-semibold whitespace-nowrap text-[11px]">Section:</span>
                <select
                  value={selectedSection}
                  onChange={(e) => {
                    setSelectedSection(e.target.value);
                    setSelectedStudentIds([]);
                  }}
                  disabled={!isTeacher && selectedClassId === 'ALL'}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                >
                  <option value="ALL">All {isTeacher ? 'Authorized ' : ''}Sections</option>
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulk Selection and Count Header */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAllStudents}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 transition-colors"
                >
                  {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-blue-700" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </span>
                </button>

                <span className="text-slate-500">
                  Showing <strong className="text-slate-900">{filteredStudents.length}</strong> of{' '}
                  <strong className="text-slate-900">{students.length}</strong> active students
                  {selectedStudentIds.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                      {selectedStudentIds.length} Selected for Bulk Printing
                    </span>
                  )}
                </span>
              </div>

              {selectedStudentIds.length > 0 && (
                <button
                  onClick={() => setIsBulkIdCardOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Generate Bulk ID Cards ({selectedStudentIds.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* One Student Per Row Compact Layout */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No students found</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting the class filter or search criteria to view student ID cards.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredStudents.map((st) => {
                  const isSelected = selectedStudentIds.includes(st.id);

                  return (
                    <div
                      key={st.id}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Left: Checkbox + Photo + Basic Details */}
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleStudentSelect(st.id)}
                          className="text-slate-400 hover:text-blue-700 shrink-0"
                          title={isSelected ? 'Deselect student' : 'Select for bulk ID print'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-700" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>

                        {/* Real Student Profile Photo with Fallback */}
                        <AvatarPhoto
                          photo={st.photo || st.photoFileKey}
                          name={st.name}
                          type="student"
                          badge="STU"
                        />

                        {/* Student Information */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 truncate">{st.name}</h3>
                            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                              Adm: {st.admissionNumber}
                            </span>
                            {st.bloodGroup && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                {st.bloodGroup}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                            <span className="font-semibold text-slate-700">
                              {st.className || 'Class'} • Sec {st.section || 'A'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-mono text-slate-600">Roll: {st.rollNumber || '—'}</span>
                            {(st.fatherName || st.parentName) && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="truncate max-w-[180px] text-slate-600">
                                  Parent: {st.fatherName || st.parentName}
                                </span>
                              </>
                            )}
                            {(st.mobile || st.parentPhone) && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{st.mobile || st.parentPhone}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => setSelectedStudentForId(st)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                          title="Generate & print official laminated ID card with QR code"
                        >
                          <QrCode className="w-3.5 h-3.5 text-blue-700" />
                          <span>Print ID Card</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STAFF & FACULTY ID CARDS */}
      {!isTeacher && activeDocType === 'STAFF_ID' && (
        <div className="space-y-4">
          {actionFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                actionFeedback.type === 'error'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{actionFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionFeedback(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 text-xs">
              {/* Search */}
              <div className="md:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by faculty name, employee ID, phone, or designation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:bg-white"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Department Filter */}
              <div className="md:col-span-3 flex items-center gap-2">
                <span className="text-slate-500 font-semibold whitespace-nowrap text-[11px]">Department:</span>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-600"
                >
                  <option value="ALL">All Departments ({staff.length})</option>
                  {staffDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Type Filter */}
              <div className="md:col-span-3 flex items-center gap-2">
                <span className="text-slate-500 font-semibold whitespace-nowrap text-[11px]">Role Type:</span>
                <select
                  value={selectedStaffRole}
                  onChange={(e) => setSelectedStaffRole(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-600"
                >
                  <option value="ALL">All Staff</option>
                  <option value="TEACHING">Teaching Faculty Only</option>
                  <option value="NON_TEACHING">Administrative & Support</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectAllStaff}
                  disabled={filteredStaff.length === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 transition-colors disabled:opacity-50"
                >
                  {allStaffShownSelected ? <CheckSquare className="w-4 h-4 text-purple-700" /> : <Square className="w-4 h-4 text-slate-400" />}
                  <span>{allStaffShownSelected ? 'Deselect All' : 'Select All'}</span>
                </button>
                <span className="text-slate-500">
                  Showing <strong className="text-slate-900">{filteredStaff.length}</strong> of{' '}
                  <strong className="text-slate-900">{staff.length}</strong> registered faculty members
                  {selectedStaffIds.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">
                      {selectedStaffIds.length} selected
                    </span>
                  )}
                </span>
              </div>
              {selectedStaffIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenBulkStaffCards}
                  disabled={isPreparingBulkStaff}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-60 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                >
                  {isPreparingBulkStaff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                  <span>{isPreparingBulkStaff ? 'Preparing cards…' : `Download / Print ${selectedStaffIds.length} Staff ID Cards`}</span>
                </button>
              )}
            </div>
          </div>

          {/* One Staff Member Per Row Compact Layout */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredStaff.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No staff members found</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust your search or department filters to locate staff ID cards.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredStaff.map((st) => (
                  <div
                    key={st.id}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${
                      selectedStaffIds.includes(st.id) ? 'bg-purple-50/40' : ''
                    }`}
                  >
                    {/* Left: Checkbox + Photo + Information */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStaffSelect(st.id)}
                        className="text-slate-400 hover:text-purple-700 shrink-0"
                        title={selectedStaffIds.includes(st.id) ? 'Deselect' : 'Select for bulk ID cards'}
                        aria-pressed={selectedStaffIds.includes(st.id)}
                        aria-label={`Select ${st.name}`}
                      >
                        {selectedStaffIds.includes(st.id) ? <CheckSquare className="w-4 h-4 text-purple-700" /> : <Square className="w-4 h-4 text-slate-300" />}
                      </button>
                      {/* Real Staff Profile Photo with Fallback */}
                      <AvatarPhoto
                        photo={st.photo || st.photoFileKey}
                        name={st.name}
                        type="staff"
                        badge="STAFF"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{st.name}</h3>
                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
                            {st.employeeId || 'ID: —'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {st.employmentStatus || 'ACTIVE'}
                          </span>
                          {st.bloodGroup && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              {st.bloodGroup}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="font-semibold text-slate-700">{st.designation}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-medium text-purple-900">{st.department || 'Academics'}</span>
                          {st.phone && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{st.phone}</span>
                              </span>
                            </>
                          )}
                          {st.email && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 text-[11px] truncate max-w-[200px]">
                                {st.email}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handlePrintFacultyCard(st)}
                        disabled={generatingStaffId === st.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 disabled:opacity-60 disabled:cursor-not-allowed text-purple-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        title="Print Faculty Identity Card with security QR code"
                      >
                        {generatingStaffId === st.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-700" />
                            <span>Preparing Card...</span>
                          </>
                        ) : (
                          <>
                            <QrCode className="w-3.5 h-3.5 text-purple-700" />
                            <span>Print Faculty Card</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REPORT CARDS */}
      {!isTeacher && activeDocType === 'REPORT_CARDS' && (
        <div className="space-y-4">
          {/* Controls Bar with Exam Selector */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 text-xs">
              {/* Exam Selector */}
              <div className="md:col-span-5 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Examination Term:</span>
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-emerald-50/60 border border-emerald-300 rounded-xl text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                >
                  {applicableExams.length === 0 ? (
                    <option value="">No exams configured for this session</option>
                  ) : (
                    applicableExams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.examType?.replace('_', ' ') || 'Examination'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Class Filter */}
              <div className="md:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">Filter by Class:</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedSection('ALL');
                  }}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  <option value="ALL">All Active Classes</option>
                  {activeClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div className="md:col-span-3 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">Section:</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  disabled={selectedClassId === 'ALL'}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
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

            {/* Search and Exam Information */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter student marks by name, roll, or admission no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Bulk Marksheet Print Button */}
              {studentsWithMarks.length > 0 && (
                <button
                  onClick={() => setIsBulkReportCardOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Class Marksheets ({studentsWithMarks.length} Students)</span>
                </button>
              )}
            </div>

            {/* Exam Details Notice */}
            {selectedExamId && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-950">
                      {exams.find((e) => e.id === selectedExamId)?.title || 'Selected Examination'}
                    </span>
                    <span className="text-emerald-800 ml-2">
                      • Academic Session: {academicSession}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-900 font-bold">
                  <span>Results Available: {studentsWithMarks.length} / {filteredStudents.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Report Cards Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3.5">Student Details</th>
                    <th className="p-3.5">Class & Section</th>
                    <th className="p-3.5">Admission No</th>
                    <th className="p-3.5">Exam Result Status</th>
                    <th className="p-3.5 text-center">Marks Obtained</th>
                    <th className="p-3.5 text-center">Percentage</th>
                    <th className="p-3.5 text-center">Grade</th>
                    <th className="p-3.5 text-right">Official Marksheet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-slate-700">No students match filter</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Select a different class or check the academic session.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st) => {
                      const stat = studentExamStats.get(st.id);
                      const hasMarks = stat?.hasMarks || false;

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Student Details with Photo */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <AvatarPhoto
                                photo={st.photo || st.photoFileKey}
                                name={st.name}
                                type="student"
                                badge="STU"
                              />
                              <div>
                                <h4 className="font-bold text-slate-900 text-xs">{st.name}</h4>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Roll: {st.rollNumber || '—'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Class & Section */}
                          <td className="p-3.5 text-slate-700 font-medium">
                            {st.className || 'Class'} - {st.section || 'A'}
                          </td>

                          {/* Admission No */}
                          <td className="p-3.5 font-mono text-blue-900 font-semibold text-[11px]">
                            {st.admissionNumber}
                          </td>

                          {/* Exam Result Status */}
                          <td className="p-3.5">
                            {hasMarks ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{stat?.subjectCount} Subjects Recorded</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Marks Unpublished / Pending</span>
                              </span>
                            )}
                          </td>

                          {/* Marks Obtained */}
                          <td className="p-3.5 text-center font-mono">
                            {hasMarks ? (
                              <span className="font-bold text-slate-900">
                                {stat?.totalObtained} / {stat?.totalMax}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Percentage */}
                          <td className="p-3.5 text-center font-mono font-bold">
                            {hasMarks ? (
                              <span
                                className={
                                  (stat?.percentage || 0) >= 75
                                    ? 'text-emerald-700'
                                    : (stat?.percentage || 0) >= 50
                                    ? 'text-blue-700'
                                    : 'text-amber-700'
                                }
                              >
                                {stat?.percentage}%
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Grade */}
                          <td className="p-3.5 text-center">
                            {hasMarks ? (
                              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                                {stat?.grade}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="p-3.5 text-right">
                            {hasMarks ? (
                              <button
                                onClick={() => setSelectedStudentForReport(st)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                                title="Generate and print comprehensive report card marksheet"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Marksheet</span>
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                                <span>No Marks Uploaded</span>
                              </div>
                            )}
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

      {/* TAB 4: TC & BONAFIDE CERTIFICATES */}
      {!isTeacher && activeDocType === 'TC_BONAFIDE' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 text-xs">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by student name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full focus:outline-hidden text-slate-800"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Admission No</th>
                  <th className="p-3">Parent Name</th>
                  <th className="p-3 text-right">Certificates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{st.name}</td>
                    <td className="p-3 text-slate-700">{st.className}-{st.section}</td>
                    <td className="p-3 font-mono text-blue-900">{st.admissionNumber}</td>
                    <td className="p-3 text-slate-700">{st.parentName}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => setCertData({ student: st, type: 'TC' })}
                        className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700"
                      >
                        Issue TC
                      </button>
                      <button
                        onClick={() => setCertData({ student: st, type: 'BONAFIDE' })}
                        className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700"
                      >
                        Bonafide
                      </button>
                      <button
                        onClick={() => setCertData({ student: st, type: 'CHARACTER' })}
                        className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700"
                      >
                        Character
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Upload Modal for Study Materials */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-800">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Upload Institutional Document
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload study materials, syllabus guides, or circulars to the school library.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 7 Science Diagrams Guide"
                  value={uploadFormData.title}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary or contents of document..."
                  value={uploadFormData.description}
                  onChange={(e) =>
                    setUploadFormData({ ...uploadFormData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Class</label>
                  <select
                    value={uploadFormData.className}
                    onChange={(e) =>
                      setUploadFormData({ ...uploadFormData, className: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  >
                    {activeClasses.map((cls) => (
                      <option key={cls.id} value={cls.name}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={uploadFormData.subject}
                    onChange={(e) =>
                      setUploadFormData({ ...uploadFormData, subject: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">File Category</label>
                <select
                  value={uploadFormData.category}
                  onChange={(e) =>
                    setUploadFormData({ ...uploadFormData, category: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                >
                  <option value="STUDY_MATERIAL">Study Material</option>
                  <option value="SYLLABUS">Syllabus</option>
                  <option value="CIRCULAR">Circular / Notice</option>
                  <option value="HOMEWORK">Homework Sheet</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Upload PDF / Document <span className="text-red-500">*</span>
                </label>
                <FileUploadComponent
                  folder="study-materials"
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                  maxSizeMB={20}
                  onUploadComplete={handleMaterialUploadComplete}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFormData.fileKey}
                  className={`px-5 py-2 rounded-lg text-white text-xs font-semibold shadow-xs ${
                    uploadFormData.fileKey
                      ? 'bg-blue-700 hover:bg-blue-800'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  Save to Repository
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SINGLE STUDENT ID CARD PREVIEW MODAL */}
      {selectedStudentForId && (
        <PrintableIdCardModal
          student={selectedStudentForId}
          isOpen={true}
          onClose={() => setSelectedStudentForId(null)}
          settings={settings}
        />
      )}

      {/* BULK STUDENT ID CARDS PREVIEW MODAL */}
      {isBulkIdCardOpen && selectedStudentsForBulk.length > 0 && (
        <PrintableIdCardModal
          students={selectedStudentsForBulk}
          isOpen={true}
          onClose={() => setIsBulkIdCardOpen(false)}
          settings={settings}
        />
      )}

      {/* STAFF ID CARD PREVIEW MODAL */}
      {selectedStaffForId && (
        <PrintableIdCardModal
          staff={selectedStaffForId}
          isOpen={true}
          onClose={handleCloseStaffIdModal}
          settings={settings}
        />
      )}

      {/* BULK STAFF ID CARDS */}
      {bulkStaffForId && bulkStaffForId.length > 0 && (
        <PrintableIdCardModal
          staffList={bulkStaffForId}
          isOpen={true}
          onClose={() => setBulkStaffForId(null)}
          settings={settings}
        />
      )}

      {/* SINGLE REPORT CARD / MARKSHEET MODAL */}
      {selectedStudentForReport && (
        <PrintableReportCardModal
          student={selectedStudentForReport}
          examId={selectedExamId}
          isOpen={true}
          onClose={() => setSelectedStudentForReport(null)}
          settings={settings}
        />
      )}

      {/* BULK CLASS REPORT CARDS MARKSHEET MODAL */}
      {isBulkReportCardOpen && studentsWithMarks.length > 0 && (
        <PrintableReportCardModal
          students={studentsWithMarks}
          isBulk={true}
          examId={selectedExamId}
          isOpen={true}
          onClose={() => setIsBulkReportCardOpen(false)}
          settings={settings}
        />
      )}

      {/* CERTIFICATES MODAL */}
      {certData && (
        <PrintableCertificateModal
          student={certData.student}
          certType={certData.type}
          isOpen={true}
          onClose={() => setCertData(null)}
          settings={settings}
        />
      )}
    </div>
  );
};
