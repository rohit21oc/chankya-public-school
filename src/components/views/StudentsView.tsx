import React, { useState, useMemo } from 'react';
import {
  Download,
  Eye,
  FileCheck,
  Filter,
  PlusCircle,
  Printer,
  QrCode,
  Search,
  SlidersHorizontal,
  UserPlus,
  Edit3,
  Trash2,
  RotateCcw,
  Users,
  UserCheck,
  UserX,
  Sparkles,
  Award,
  ChevronDown,
  AlertTriangle,
  X,
  Check,
  CheckCircle2,
  Loader2,
  FileText,
  Calendar,
  ArrowLeft,
  ShieldAlert,
  GraduationCap,
} from 'lucide-react';
import { AcademicClass, CertificateType, SchoolSettings, Student, StudentStatus, UserRole } from '../../types';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { hasPermission } from '../../utils/rbac';
import { StudentAdmissionView } from './StudentAdmissionView';
import { StudentAdmissionModal } from '../modals/StudentAdmissionModal';
import { StudentEditModal } from '../modals/StudentEditModal';
import { StudentProfileView } from './StudentProfileView';
import { PrintableReportCardModal } from '../modals/PrintableReportCardModal';
import { PrintableIdCardModal } from '../modals/PrintableIdCardModal';
import { PrintableCertificateModal } from '../modals/PrintableCertificateModal';
import { PrintableAdmissionLetterModal } from '../modals/PrintableAdmissionLetterModal';
import { fileUploadService } from '../../services/fileUploadService';
import { downloadBlankForm } from '../../utils/blankFormsPdf';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { navigate } from '../../services/routerService';
import { ParentStudentsView } from '../parent/ParentStudentsView';
import { PromoteClassModal } from '../modals/PromoteClassModal';
import { classSectionOptions } from '../../utils/classSections';

interface StudentsViewProps {
  userRole: UserRole;
  currentUser?: any;
  settings: SchoolSettings;
  subTab?: string;
  onTabChange?: (subTab?: string) => void;
  onNavigate?: (module: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  userRole,
  currentUser: propUser,
  settings,
  subTab,
  onTabChange,
  onNavigate,
}) => {
  const currentUser = propUser || authService.getCurrentUser() || authService.getStoredUser();

  if (userRole === 'PARENT') {
    return (
      <ParentStudentsView
        currentUser={currentUser}
        settings={settings}
        onNavigate={onNavigate}
      />
    );
  }

  const isTeacher = userRole === 'TEACHER';
  const isParent = userRole === 'PARENT';
  const canAdmitStudents = !isTeacher && !isParent && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ADMIN'].includes(userRole);
  const canEditStudents = !isTeacher && !isParent && (hasPermission(currentUser, 'students.edit') || ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN'].includes(userRole));
  const canDeleteStudents = !isTeacher && !isParent && (hasPermission(currentUser, 'students.delete') || ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN'].includes(userRole));
  const canViewReportCard = hasPermission(currentUser, 'reports.view') || hasPermission(currentUser, 'documents.view');

  const [students, setStudents] = useState<Student[]>(() => api.getStudents());
  const classes = api.getClasses();

  // Teacher assigned classes & subjects state
  const [assignedClassesData, setAssignedClassesData] = useState<{
    allAccess: boolean;
    classes: { classId: string; className: string; sections: string[] }[];
  }>({
    allAccess: !isTeacher,
    classes: [],
  });
  const [assignedSubjects, setAssignedSubjects] = useState<{ id: string; name: string }[]>([]);
  const [detailedAssignments, setDetailedAssignments] = useState<{
    classId: string;
    className: string;
    section: string;
    isClassTeacher: boolean;
    subjects: { id: string; name: string }[];
  }[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');

  // Load the list from the server when the page opens (for every role). Until it arrives the table
  // shows a loading state, not "no students found".
  const [listLoadState, setListLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const loadStudentList = React.useCallback(() => {
    setListLoadState('loading');
    api.loadStudentsFromServer().then(({ ok, students: list }) => {
      setStudents([...list]);
      setListLoadState(ok ? 'ready' : 'error');
    });
  }, []);
  React.useEffect(() => {
    loadStudentList();
  }, [loadStudentList]);

  React.useEffect(() => {
    if (isTeacher) {
      api.getTeacherAuthorizedAssignments().then((res) => {
        setAssignedClassesData({
          allAccess: res.allAccess,
          classes: res.classes,
        });
        setAssignedSubjects(res.subjects);
        setDetailedAssignments(res.detailedAssignments);
      });
    }
  }, [isTeacher]);

  // Real-time synchronization listener for Students & Academic Sessions
  useRealtimeListener(['STUDENT', 'SESSION'], () => {
    const updated = api.getStudents();
    setStudents([...updated]);
  });

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

  // Available classes for dropdown
  const availableClasses = useMemo(() => {
    const active = classes.filter((c) => (c.status || 'ACTIVE') === 'ACTIVE');
    if (!isTeacher || assignedClassesData.allAccess) {
      return active;
    }
    const assignedIds = new Set(assignedClassesData.classes.map((c) => c.classId.toLowerCase()));
    const assignedNames = new Set(assignedClassesData.classes.map((c) => c.className.toLowerCase()));
    return active.filter(
      (c) => assignedIds.has(c.id.toLowerCase()) || assignedNames.has(c.name.toLowerCase())
    );
  }, [classes, isTeacher, assignedClassesData]);

  // Available subjects for dropdown
  const availableSubjects = useMemo(() => {
    if (isTeacher && !assignedClassesData.allAccess) {
      if (selectedClass !== 'ALL') {
        const targetCls = selectedClass.toLowerCase();
        const subsForCls = new Map<string, string>();
        detailedAssignments.forEach((a) => {
          if (a.className.toLowerCase() === targetCls || a.classId.toLowerCase() === targetCls) {
            a.subjects.forEach((s) => subsForCls.set(s.id, s.name));
          }
        });
        if (subsForCls.size > 0) {
          return Array.from(subsForCls.entries()).map(([id, name]) => ({ id, name }));
        }
      }
      return assignedSubjects;
    }
    return api.getSubjects().filter((s) => (s.status || 'ACTIVE') === 'ACTIVE').map((s) => ({ id: s.id, name: s.name }));
  }, [isTeacher, assignedClassesData, assignedSubjects, selectedClass, detailedAssignments]);

  // Available sections for chosen class
  const availableSections = useMemo(() => {
    if (isTeacher && !assignedClassesData.allAccess) {
      if (selectedClass !== 'ALL') {
        const matched = assignedClassesData.classes.find(
          (c) => c.className.toLowerCase() === selectedClass.toLowerCase() || c.classId.toLowerCase() === selectedClass.toLowerCase()
        );
        if (matched) return matched.sections;
      }
      const allSecs = new Set<string>();
      assignedClassesData.classes.forEach((c) => c.sections.forEach((s) => allSecs.add(s)));
      return Array.from(allSecs);
    }
    if (selectedClass !== 'ALL') {
      const cls = classes.find((c) => c.name.toLowerCase() === selectedClass.toLowerCase() || c.id.toLowerCase() === selectedClass.toLowerCase());
      const opts = classSectionOptions(cls);
      if (opts.length) return opts;
    }
    // All classes: every section that any class has (not a fixed A / B / C list).
    const all = new Set<string>();
    classes.forEach((c) => classSectionOptions(c).forEach((s) => all.add(s)));
    return all.size ? Array.from(all).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : ['A'];
  }, [classes, isTeacher, assignedClassesData, selectedClass]);

  // Auto-reset section if it is no longer valid for the selected class
  React.useEffect(() => {
    if (selectedSection !== 'ALL' && !availableSections.includes(selectedSection)) {
      setSelectedSection('ALL');
    }
  }, [selectedClass, availableSections, selectedSection]);

  // Auto-reset subject if it is no longer valid for the selected class
  React.useEffect(() => {
    if (selectedSubject !== 'ALL' && !availableSubjects.some((s) => s.id === selectedSubject || s.name === selectedSubject)) {
      setSelectedSubject('ALL');
    }
  }, [selectedClass, availableSubjects, selectedSubject]);

  // Bulk Selection for ID Cards and other operations
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkIdModalOpen, setIsBulkIdModalOpen] = useState(false);

  // Admission Full-Page View state
  const [isAdmissionOpen, setIsAdmissionOpen] = useState(() => !isTeacher && subTab === 'admission');
  // Open the admission form on its own address (/students/admission), so a reload or reopening the site
  // comes back to the form, with the auto-saved draft.
  const openAdmission = () => {
    setIsAdmissionOpen(true);
    if (onTabChange) onTabChange('admission');
    else navigate('/students/admission');
  };
  // Unfinished admission saved on this device (auto-saved by the admission form)
  const admissionDraft = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('cps_student_admission_draft');
      if (!raw) return null;
      const d = JSON.parse(raw);
      const f = d?.formData || {};
      const name = f.name || [f.firstName, f.middleName, f.lastName].filter(Boolean).join(' ');
      return { name: name || 'New student', step: Number(d?.currentStep) || 1, savedAt: d?.savedAt as string | undefined };
    } catch {
      return null;
    }
    // re-read whenever the admission screen is closed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmissionOpen]);

  React.useEffect(() => {
    if (isTeacher) {
      setIsAdmissionOpen(false);
      return;
    }
    if (subTab === 'admission') {
      setIsAdmissionOpen(true);
    } else if (subTab === undefined && isAdmissionOpen) {
      // If user navigated away from admission subTab
      setIsAdmissionOpen(false);
    }
  }, [subTab, isTeacher]);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [selectedStudentForId, setSelectedStudentForId] = useState<Student | null>(null);
  const [certificateData, setCertificateData] = useState<{
    student: Student;
    type: CertificateType;
  } | null>(null);
  const [selectedStudentForLetter, setSelectedStudentForLetter] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  // Quick status dropdown menu per row
  const [activeStatusMenuId, setActiveStatusMenuId] = useState<string | null>(null);
  // Quick certificate dropdown menu per row
  const [activeCertMenuId, setActiveCertMenuId] = useState<string | null>(null);

  // Available academic sessions / admission years from data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(settings.currentAcademicSession || '2026-2027');
    teacherScopedStudents.forEach((s) => {
      if (s.academicSession) years.add(s.academicSession);
      if (s.admissionDate) {
        const year = s.admissionDate.substring(0, 4);
        years.add(`${year}-${Number(year) + 1}`);
      }
    });
    return Array.from(years).sort().reverse();
  }, [teacherScopedStudents, settings.currentAcademicSession]);

  // Statistics calculation for the dashboard metrics
  const stats = useMemo(() => {
    const total = teacherScopedStudents.length;
    const active = teacherScopedStudents.filter((s) => s.status === 'ACTIVE').length;
    const inactive = teacherScopedStudents.filter(
      (s) => s.status === 'INACTIVE' || s.status === 'SUSPENDED' || s.status === 'WITHDRAWN' || s.status === 'TRANSFERRED'
    ).length;
    const newlyAdmitted = teacherScopedStudents.filter(
      (s) => s.academicSession === settings.currentAcademicSession || (s.admissionDate && s.admissionDate.startsWith('2026'))
    ).length;

    // Class-wise count
    const classCountMap: Record<string, number> = {};
    availableClasses.forEach((c) => {
      classCountMap[c.name] = teacherScopedStudents.filter((s) => s.classId === c.id || s.className === c.name).length;
    });

    // Section-wise count
    const sectionCountMap: Record<string, number> = { A: 0, B: 0, C: 0 };
    teacherScopedStudents.forEach((s) => {
      const sec = s.section || 'A';
      sectionCountMap[sec] = (sectionCountMap[sec] || 0) + 1;
    });

    return {
      total,
      active,
      inactive,
      newlyAdmitted,
      classCountMap,
      sectionCountMap,
    };
  }, [teacherScopedStudents, availableClasses, settings.currentAcademicSession]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return teacherScopedStudents.filter((s) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        s.name.toLowerCase().includes(term) ||
        (s.admissionNumber && s.admissionNumber.includes(term)) ||
        (s.registrationNumber && s.registrationNumber.toLowerCase().includes(term)) ||
        (s.rollNumber && s.rollNumber.includes(term)) ||
        (s.parentPhone && s.parentPhone.includes(term)) ||
        (s.parentName && s.parentName.toLowerCase().includes(term)) ||
        (s.fatherMobile && s.fatherMobile.includes(term)) ||
        (s.mobile && s.mobile.includes(term));

      const matchesClass =
        selectedClass === 'ALL' ||
        s.className?.toLowerCase() === selectedClass.toLowerCase() ||
        s.classId?.toLowerCase() === selectedClass.toLowerCase();
      const matchesSection = selectedSection === 'ALL' || (s.section || 'A').toUpperCase() === selectedSection.toUpperCase();
      const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;
      const matchesYear =
        selectedYear === 'ALL' ||
        s.academicSession === selectedYear ||
        (s.admissionDate && s.admissionDate.startsWith(selectedYear.split('-')[0]));

      let matchesSubject = true;
      if (selectedSubject !== 'ALL') {
        const targetSub = selectedSubject.trim().toLowerCase();
        if (isTeacher && detailedAssignments.length > 0) {
          const sCId = (s.classId || '').toLowerCase();
          const sCName = (s.className || '').toLowerCase();
          const sSec = (s.section || 'A').trim().toUpperCase();
          matchesSubject = detailedAssignments.some((a) => {
            const classMatch = a.classId.toLowerCase() === sCId || a.className.toLowerCase() === sCName || a.className.toLowerCase() === sCId;
            const secMatch = a.section.toUpperCase() === sSec;
            if (!classMatch || !secMatch) return false;
            if (a.isClassTeacher) return true;
            return a.subjects.some((sub) => sub.id.toLowerCase() === targetSub || sub.name.toLowerCase() === targetSub);
          });
        }
      }

      return matchesSearch && matchesClass && matchesSection && matchesStatus && matchesYear && matchesSubject;
    });
  }, [teacherScopedStudents, searchTerm, selectedClass, selectedSection, selectedStatus, selectedYear, selectedSubject, isTeacher, detailedAssignments]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedClass('ALL');
    setSelectedSection('ALL');
    setSelectedSubject('ALL');
    setSelectedStatus('ALL');
    setSelectedYear('ALL');
  };

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedStudentsList = useMemo(() => {
    return teacherScopedStudents.filter((s) => selectedStudentIds.includes(s.id));
  }, [teacherScopedStudents, selectedStudentIds]);

  const handleStudentAdmitted = (newStudent: Student) => {
    if (isTeacher || !canAdmitStudents) return;
    setStudents(api.getStudents());
    setSelectedStudentForProfile(newStudent);
  };

  const handleStudentUpdated = (updated: Student) => {
    if (isTeacher || !canEditStudents) return;
    setStudents(api.getStudents());
    if (selectedStudentForProfile?.id === updated.id) {
      setSelectedStudentForProfile(updated);
    }
    setToastMessage({
      type: 'success',
      text: `Student record for "${updated.name}" updated successfully.`,
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleQuickStatusChange = async (studentId: string, newStatus: StudentStatus) => {
    if (isTeacher || !canEditStudents) return;
    setActiveStatusMenuId(null);
    try {
      const updated = await api.changeStudentStatusAsync(studentId, newStatus);
      handleStudentUpdated(updated);
    } catch (err: any) {
      setStudents(api.getStudents());
      setToastMessage({ type: 'error', text: err?.message || 'Could not change the status. Please try again.' });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete || isTeacher || !canDeleteStudents) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const studentName = studentToDelete.name;
      await api.deleteStudentAsync(studentToDelete.id);
      setStudents(api.getStudents());
      setToastMessage({
        type: 'success',
        text: `Student record for "${studentName}" deleted successfully.`,
      });
      setTimeout(() => setToastMessage(null), 4000);
      setStudentToDelete(null);
    } catch (err: any) {
      console.error('[StudentsView] Delete student failed:', err);
      setDeleteError(err.message || 'Failed to delete student record from server.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Admission No',
      'Roll No',
      'Registration No',
      'Student Name',
      'Class',
      'Section',
      'Gender',
      'DOB',
      'Blood Group',
      'Parent Name',
      'Parent Phone',
      'Academic Session',
      'Status',
    ];
    const rows = filteredStudents.map((s) => [
      s.admissionNumber,
      s.rollNumber,
      s.registrationNumber,
      `"${s.name}"`,
      s.className,
      s.section,
      s.gender,
      s.dob,
      s.bloodGroup,
      `"${s.parentName}"`,
      s.parentPhone,
      s.academicSession,
      s.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Students_Directory_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status?: StudentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'INACTIVE':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'SUSPENDED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'TRANSFERRED':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'WITHDRAWN':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  const isFiltered = searchTerm !== '' || selectedClass !== 'ALL' || selectedSection !== 'ALL' || selectedSubject !== 'ALL' || selectedStatus !== 'ALL' || selectedYear !== 'ALL';

  // Dedicated Full-Page Student Admission & Enrollment Screen
  if (isAdmissionOpen && canAdmitStudents && !isTeacher) {
    return (
      <StudentAdmissionView
        settings={settings}
        classes={classes}
        onBack={() => {
          setIsAdmissionOpen(false);
          if (onTabChange) {
            onTabChange(undefined);
          } else {
            navigate('/students');
          }
        }}
        onStudentAdmitted={(newSt) => {
          handleStudentAdmitted(newSt);
        }}
        onOpenProfile={(newSt) => {
          setIsAdmissionOpen(false);
          if (onTabChange) onTabChange(undefined);
          else navigate('/students');
          setSelectedStudentForProfile(newSt);
        }}
      />
    );
  }

  // Full-page Student Profile View when a student is selected
  if (selectedStudentForProfile) {
    const isAuthorizedForProfile = (() => {
      if (!isTeacher || assignedClassesData.allAccess) return true;
      const assignedIds = new Set(assignedClassesData.classes.map((c) => c.classId.toLowerCase()));
      const assignedNames = new Set(assignedClassesData.classes.map((c) => c.className.toLowerCase()));
      const sCId = (selectedStudentForProfile.classId || '').toLowerCase();
      const sCName = (selectedStudentForProfile.className || '').toLowerCase();
      const matchClass = (sCId && assignedIds.has(sCId)) || (sCName && assignedNames.has(sCName)) || (sCId && assignedNames.has(sCId));
      if (!matchClass) return false;
      const matchedCls = assignedClassesData.classes.find(
        (ac) => ac.classId.toLowerCase() === sCId || ac.className.toLowerCase() === sCName || ac.className.toLowerCase() === sCId
      );
      if (matchedCls) {
        return matchedCls.sections.some((sec) => sec.toUpperCase() === (selectedStudentForProfile.section || 'A').toUpperCase());
      }
      return true;
    })();

    if (!isAuthorizedForProfile) {
      return (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center max-w-lg mx-auto my-12 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-rose-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
          <p className="text-xs text-slate-500">
            You are only authorized to view records of students enrolled in your assigned classes and sections.
          </p>
          <button
            onClick={() => setSelectedStudentForProfile(null)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Students Roster</span>
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <StudentProfileView
          student={selectedStudentForProfile}
          settings={settings}
          onBack={() => setSelectedStudentForProfile(null)}
          onUpdate={handleStudentUpdated}
          onEdit={(st) => !isTeacher && canEditStudents && setStudentToEdit(st)}
          onOpenReportCard={(st) => canViewReportCard && setSelectedStudentForReport(st)}
          onOpenIdCard={(st) => setSelectedStudentForId(st)}
          onOpenCertificate={(st, type) => !isTeacher && setCertificateData({ student: st, type })}
          onSelectStudent={(st) => {
            if (isTeacher && !assignedClassesData.allAccess) {
              const assignedIds = new Set(assignedClassesData.classes.map((c) => c.classId.toLowerCase()));
              const assignedNames = new Set(assignedClassesData.classes.map((c) => c.className.toLowerCase()));
              const sCId = (st.classId || '').toLowerCase();
              const sCName = (st.className || '').toLowerCase();
              const matchClass = (sCId && assignedIds.has(sCId)) || (sCName && assignedNames.has(sCName)) || (sCId && assignedNames.has(sCId));
              let isAuth = matchClass;
              if (matchClass) {
                const matchedCls = assignedClassesData.classes.find(
                  (ac) => ac.classId.toLowerCase() === sCId || ac.className.toLowerCase() === sCName || ac.className.toLowerCase() === sCId
                );
                if (matchedCls) {
                  isAuth = matchedCls.sections.some((sec) => sec.toUpperCase() === (st.section || 'A').toUpperCase());
                }
              }
              if (!isAuth) {
                setToastMessage({
                  type: 'error',
                  text: `Access Denied: You are not assigned to teach ${st.name}'s class/section.`,
                });
                setTimeout(() => setToastMessage(null), 4000);
                return;
              }
            }
            setSelectedStudentForProfile(st);
          }}
          userRole={userRole}
          currentUser={currentUser}
        />

        {/* Modals triggerable from profile view */}
        {studentToEdit && !isTeacher && (
          <StudentEditModal
            isOpen={true}
            student={studentToEdit}
            classes={classes}
            onClose={() => setStudentToEdit(null)}
            onStudentUpdated={handleStudentUpdated}
          />
        )}

        {selectedStudentForReport && canViewReportCard && (
          <PrintableReportCardModal
            student={selectedStudentForReport}
            isOpen={true}
            onClose={() => setSelectedStudentForReport(null)}
            settings={settings}
          />
        )}

        {selectedStudentForId && (
          <PrintableIdCardModal
            student={selectedStudentForId}
            isOpen={true}
            onClose={() => setSelectedStudentForId(null)}
            settings={settings}
            onBackToProfile={() => setSelectedStudentForId(null)}
          />
        )}

        {certificateData && !isTeacher && (
          <PrintableCertificateModal
            student={certificateData.student}
            certType={certificateData.type}
            isOpen={true}
            onClose={() => setCertificateData(null)}
            settings={settings}
          />
        )}
      </div>
    );
  }

  // Row actions, shared by the desktop table and the phone cards.
  const renderStudentActions = (s: Student, touch: boolean) => {
    const iconBtn = touch ? 'inline-flex items-center justify-center w-10 h-10' : 'p-1.5';
    return (
                      <div className={`flex items-center gap-1 ${touch ? "flex-wrap justify-start" : "justify-end"}`}>
                        {/* View Profile */}
                        <button
                          onClick={() => setSelectedStudentForProfile(s)}
                          className={`${iconBtn} text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors`}
                          title="View Complete Student Profile"
                          aria-label="View Complete Student Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit Student (Admin only) */}
                        {canEditStudents && !isTeacher && (
                          <button
                            onClick={() => setStudentToEdit(s)}
                            className={`${iconBtn} text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors`}
                            title="Edit Student Information"
                          aria-label="Edit Student Information"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* ID Card (Authorized students) */}
                        <button
                          onClick={() => setSelectedStudentForId(s)}
                          className={`${iconBtn} text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors`}
                          title="Generate Student ID Card"
                          aria-label="Generate Student ID Card"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        {/* Admission Letter (Admin only) */}
                        {!isTeacher && (
                          <button
                            onClick={() => setSelectedStudentForLetter(s)}
                            className={`${iconBtn} text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors`}
                            title="Print Official Admission Letter & Fee Schedule"
                          aria-label="Print Official Admission Letter & Fee Schedule"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}

                        {/* Certificate Dropdown (Admin only) */}
                        {!isTeacher && (
                          <div className="relative inline-block">
                            <button
                              onClick={() => setActiveCertMenuId(activeCertMenuId === s.id ? null : s.id)}
                              className={`${iconBtn} text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors`}
                              title="Issue Official Certificate"
                          aria-label="Issue Official Certificate"
                            >
                              <Award className="w-4 h-4" />
                            </button>
                            {activeCertMenuId === s.id && (
                              <div className="absolute right-0 z-20 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 p-1 text-left text-xs">
                                <span className="text-[10px] font-bold text-slate-400 px-2 py-1 block uppercase">
                                  Issue Certificate
                                </span>
                                <button
                                  onClick={() => {
                                    setCertificateData({ student: s, type: 'BONAFIDE' });
                                    setActiveCertMenuId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-100 font-medium text-slate-700"
                                >
                                  Bonafide Study Cert
                                </button>
                                <button
                                  onClick={() => {
                                    setCertificateData({ student: s, type: 'CHARACTER' });
                                    setActiveCertMenuId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-100 font-medium text-slate-700"
                                >
                                  Character Certificate
                                </button>
                                <button
                                  onClick={() => {
                                    setCertificateData({ student: s, type: 'TC' });
                                    setActiveCertMenuId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-100 font-medium text-slate-700 text-rose-700"
                                >
                                  Transfer Certificate (TC)
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Report Card (Only if permitted) */}
                        {canViewReportCard && (
                          <button
                            onClick={() => setSelectedStudentForReport(s)}
                            className={`${iconBtn} text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors`}
                            title="Generate Exam Report Card"
                          aria-label="Generate Exam Report Card"
                          >
                            <FileCheck className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Student (Admin only) */}
                        {canDeleteStudents && !isTeacher && (
                          <button
                            onClick={() => setStudentToDelete(s)}
                            className={`${iconBtn} text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors`}
                            title="Delete Student Record"
                          aria-label="Delete Student Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Main Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {isTeacher ? 'My Students' : 'Student Management'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  {filteredStudents.length} {isTeacher ? 'Assigned' : 'Total Enrolled'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {isTeacher
                  ? 'Assigned Classes & Sections Roster • View-Only Academic Profile & Performance'
                  : 'Comprehensive student directory, academic enrollment, official documents & records'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            title="Download CSV spreadsheet of current view"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          {!isTeacher && (
            <button
              type="button"
              onClick={() => { void downloadBlankForm('student', settings); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
              title="Download a blank A4 admission form (PDF) to print and fill by hand"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Admission Form (PDF)</span>
            </button>
          )}
          {canEditStudents && !isTeacher && (
            <button
              type="button"
              id="btn-promote-class"
              onClick={() => setIsPromoteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition-colors"
              title="Promote a whole class to the next class after the annual exam"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Promote Class</span>
            </button>
          )}
          {canAdmitStudents && !isTeacher && (
            <button
              id="btn-admit-student"
              onClick={openAdmission}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Admit Student</span>
            </button>
          )}
        </div>
      </div>

      {/* Unfinished admission (auto-saved draft) */}
      {canAdmitStudents && !isTeacher && admissionDraft && (
        <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="text-amber-900">
            <strong>Unfinished admission:</strong> {admissionDraft.name} • Step {admissionDraft.step} of 6
            {admissionDraft.savedAt
              ? ` • saved ${new Date(admissionDraft.savedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </div>
          <button
            type="button"
            onClick={openAdmission}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
          >
            Continue admission
          </button>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 ${toastMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} />
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Dashboard Metrics Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Students */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {isTeacher ? 'Assigned Students' : 'Total Students'}
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-0.5 block">{stats.total}</span>
            <span className="text-[10px] text-slate-500">
              Across {availableClasses.length} {isTeacher ? 'Assigned Classes' : 'Academic Classes'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active Students */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Active Students</span>
            <span className="text-2xl font-bold text-emerald-800 mt-0.5 block">{stats.active}</span>
            <span className="text-[10px] text-emerald-600">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% active attendance rate
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Inactive Students */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Inactive / On Leave</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5 block">{stats.inactive}</span>
            <span className="text-[10px] text-slate-500">Suspended / TC / Withdrawn</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        {/* Newly Admitted Students */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">Newly Admitted</span>
            <span className="text-2xl font-bold text-indigo-900 mt-0.5 block">{stats.newlyAdmitted}</span>
            <span className="text-[10px] text-indigo-600">Session {settings.currentAcademicSession}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-800">Search & Multi-Criteria Filters</span>
          </div>
          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Search box */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, roll, adm no, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium"
            >
              <option value="ALL">All Authorized Classes</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium"
            >
              <option value="ALL">All Authorized Sections</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium"
            >
              <option value="ALL">All Authorized Subjects</option>
              {availableSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="TRANSFERRED">TRANSFERRED (TC)</option>
              <option value="WITHDRAWN">WITHDRAWN</option>
            </select>
          </div>

          {/* Admission Year / Session Filter */}
          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium"
            >
              <option value="ALL">All Admission Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Session {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar if students are selected */}
      {selectedStudentIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs text-white">
              {selectedStudentIds.length}
            </div>
            <div>
              <span className="font-bold text-xs text-white">
                {selectedStudentIds.length} Student{selectedStudentIds.length > 1 ? 's' : ''} Selected
              </span>
              <p className="text-[11px] text-slate-400">
                Generate high-HD printable ID cards with dynamic QR codes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkIdModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>Generate Bulk ID Cards ({selectedStudentIds.length})</span>
            </button>
            <button
              onClick={() => setSelectedStudentIds([])}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* 2. Students Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Phone layout: one card per student (the table below is used on tablets and desktops) */}
        <ul className="md:hidden divide-y divide-slate-100" aria-label="Students">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s) => (
              <li key={`card-${s.id}`} className="p-4 space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center overflow-hidden shrink-0 font-bold text-blue-900 text-sm">
                    {s.photo && fileUploadService.getFileUrl(s.photo) ? (
                      <img src={fileUploadService.getFileUrl(s.photo)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{s.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setSelectedStudentForProfile(s)} className="text-left text-sm font-bold text-slate-900 hover:text-blue-700 break-words">
                      {s.name}
                    </button>
                    <div className="text-xs text-slate-600">
                      {s.className}{s.section ? ` – ${s.section}` : ''}{s.rollNumber ? ` • Roll ${s.rollNumber}` : ''}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-blue-900">{s.admissionNumber}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(s.status)}`}>{s.status}</span>
                    </div>
                    {(s.parentName || s.parentPhone) && (
                      <div className="mt-1 text-xs text-slate-600 break-words">
                        {s.parentName}{s.parentPhone ? (
                          <a href={`tel:${s.parentPhone}`} className="ml-1 font-mono text-slate-700">{s.parentPhone}</a>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
                {renderStudentActions(s, true)}
              </li>
            ))
          ) : (
            <li className="py-10 px-4 text-center text-sm text-slate-500" role={listLoadState === 'loading' ? 'status' : undefined}>
              {listLoadState === 'loading'
                ? 'Loading students…'
                : listLoadState === 'error' && students.length === 0
                ? 'Unable to load students. Please try again.'
                : students.length === 0
                ? 'No students have been admitted yet.'
                : 'No students found matching your criteria.'}
            </li>
          )}
        </ul>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all students"
                    checked={
                      filteredStudents.length > 0 &&
                      selectedStudentIds.length === filteredStudents.length
                    }
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Student Photo & Name</th>
                <th className="py-3.5 px-3">Roll No</th>
                <th className="py-3.5 px-3">Admission No</th>
                <th className="py-3.5 px-3">Class & Sec</th>
                <th className="py-3.5 px-3">Gender</th>
                <th className="py-3.5 px-3">Parent / Contact</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/90 transition-colors">
                    {/* Checkbox */}
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.name}`}
                        checked={selectedStudentIds.includes(s.id)}
                        onChange={() => handleToggleSelectStudent(s.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                    </td>

                    {/* Student Photo & Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs font-bold text-blue-900 text-sm">
                          {s.photo && fileUploadService.getFileUrl(s.photo) ? (
                            <img
                              src={fileUploadService.getFileUrl(s.photo)}
                              alt={s.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span>{s.name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <span
                            onClick={() => setSelectedStudentForProfile(s)}
                            className="font-bold text-slate-900 hover:text-blue-700 cursor-pointer block text-xs"
                          >
                            {s.name}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            DOB: {s.dob} • {s.bloodGroup}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Reg: {s.registrationNumber}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Roll No */}
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                      {s.rollNumber}
                    </td>

                    {/* Admission No (8 Digits) */}
                    <td className="py-3.5 px-3 font-mono font-bold text-blue-900">
                      <span className="bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                        {s.admissionNumber}
                      </span>
                    </td>

                    {/* Class & Section */}
                    <td className="py-3.5 px-3 font-semibold text-slate-800">
                      <div>{s.className}</div>
                      <div className="text-[11px] text-slate-500 font-normal">Section {s.section}</div>
                    </td>

                    {/* Gender */}
                    <td className="py-3.5 px-3 font-medium text-slate-700">
                      {s.gender}
                    </td>

                    {/* Parent / Guardian & Contact */}
                    <td className="py-3.5 px-3 text-slate-800">
                      <div className="font-semibold truncate max-w-[130px]">{s.parentName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{s.parentPhone}</div>
                    </td>

                    {/* Status with inline quick status switcher */}
                    <td className="py-3.5 px-3 relative">
                      {isTeacher ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(
                            s.status
                          )}`}
                        >
                          <span>{s.status}</span>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveStatusMenuId(activeStatusMenuId === s.id ? null : s.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${getStatusBadge(
                              s.status
                            )}`}
                            title="Click to toggle status"
                          >
                            <span>{s.status}</span>
                            <ChevronDown className="w-3 h-3 opacity-60" />
                          </button>

                          {/* Dropdown status switcher menu */}
                          {activeStatusMenuId === s.id && (
                            <div className="absolute z-20 mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-200 p-1 text-left text-xs">
                              <span className="text-[10px] font-bold text-slate-400 px-2 py-1 block uppercase">
                                Change Student Status
                              </span>
                              {(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRANSFERRED', 'WITHDRAWN'] as StudentStatus[]).map(
                                (st) => (
                                  <button
                                    key={st}
                                    onClick={() => handleQuickStatusChange(s.id, st)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs font-medium hover:bg-slate-100 ${
                                      s.status === st ? 'font-bold text-blue-700 bg-blue-50' : 'text-slate-700'
                                    }`}
                                  >
                                    <span>{st}</span>
                                    {s.status === st && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {renderStudentActions(s, false)}
                    </td>
                  </tr>
                ))
              ) : listLoadState === 'loading' ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm" role="status">
                    Loading students…
                  </td>
                </tr>
              ) : listLoadState === 'error' && students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center" role="alert">
                    <p className="font-semibold text-slate-700 text-sm">Unable to load students. Please try again.</p>
                    <button
                      type="button"
                      onClick={loadStudentList}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                    >
                      Try again
                    </button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700 text-sm">{students.length === 0 ? 'No students have been admitted yet.' : 'No students found matching your criteria'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Try resetting search keywords or filter dropdowns.</p>
                      {isFiltered && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filteredStudents.length}</strong> of{' '}
            <strong className="text-slate-800">{students.length}</strong> total registered students
          </span>
          <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            8-Digit Immutable Admission Sequence Active (Session {settings.currentAcademicSession})
          </span>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Student Record?</h3>
                <p className="text-xs text-slate-500">This permanently removes the student record. Students with fee payments, attendance or exam marks cannot be deleted — change their status to Withdrawn instead.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
              <div>Name: <strong className="text-slate-900">{studentToDelete.name}</strong></div>
              <div>Admission Number: <strong className="font-mono text-blue-900">{studentToDelete.admissionNumber}</strong></div>
              <div>Class & Section: <strong className="text-slate-900">{studentToDelete.className}-{studentToDelete.section}</strong></div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setStudentToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Confirm Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {canEditStudents && !isTeacher && (
        <PromoteClassModal
          isOpen={isPromoteOpen}
          onClose={() => setIsPromoteOpen(false)}
          classes={classes}
          students={students}
          currentSession={settings.currentAcademicSession}
          initialClassId={selectedClass !== 'ALL' ? selectedClass : undefined}
          onPromoted={(message) => {
            loadStudentList();
            setToastMessage({ type: 'success', text: message });
          }}
        />
      )}
      {/* 1. Admission Modal */}
      {!isTeacher && canAdmitStudents && (
        <StudentAdmissionModal
          isOpen={isAdmissionOpen}
          onClose={() => setIsAdmissionOpen(false)}
          onStudentAdmitted={handleStudentAdmitted}
          classes={classes}
        />
      )}

      {/* 2. Edit Student Modal */}
      {studentToEdit && !isTeacher && canEditStudents && (
        <StudentEditModal
          isOpen={true}
          student={studentToEdit}
          classes={classes}
          onClose={() => setStudentToEdit(null)}
          onStudentUpdated={handleStudentUpdated}
        />
      )}

      {/* 3. Report Card Modal */}
      {selectedStudentForReport && canViewReportCard && (
        <PrintableReportCardModal
          student={selectedStudentForReport}
          isOpen={true}
          onClose={() => setSelectedStudentForReport(null)}
          settings={settings}
        />
      )}

      {/* 4. ID Card Modal (Single or Bulk) */}
      {(selectedStudentForId || isBulkIdModalOpen) && (
        <PrintableIdCardModal
          student={selectedStudentForId}
          students={isBulkIdModalOpen ? selectedStudentsList : undefined}
          isOpen={true}
          onClose={() => {
            setSelectedStudentForId(null);
            setIsBulkIdModalOpen(false);
          }}
          settings={settings}
        />
      )}

      {/* 5. Institutional Certificate Modal */}
      {certificateData && !isTeacher && (
        <PrintableCertificateModal
          student={certificateData.student}
          certType={certificateData.type}
          isOpen={true}
          onClose={() => setCertificateData(null)}
          settings={settings}
        />
      )}

      {/* 6. Official Admission Letter Modal */}
      {selectedStudentForLetter && !isTeacher && (
        <PrintableAdmissionLetterModal
          student={selectedStudentForLetter}
          isOpen={true}
          onClose={() => setSelectedStudentForLetter(null)}
          settings={settings}
        />
      )}
    </div>
  );
};
