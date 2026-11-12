import { qualifiedSectionsForClass } from '../../utils/teacherSubjects';
import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  DoorOpen,
  Edit2,
  Eye,
  Filter,
  GraduationCap,
  Layers,
  MoreVertical,
  Plus,
  PlusCircle,
  Search,
  Settings2,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  AcademicClass,
  AcademicSection,
  AcademicSession,
  Subject,
  TeacherStaff,
  User,
  UserRole,
} from '../../types';
import { api } from '../../services/api';
import {
  ClassModal,
  SectionModal,
  SubjectModal,
  DeleteClassModal,
  DeleteSectionModal,
  DeleteSubjectModal,
} from '../academics/ClassSectionModals';
import { GradingSystemModal } from '../academics/GradingSystemModal';
import { AcademicSessionsManager } from '../academics/AcademicSessionsManager';
import { useRealtimeListener } from '../../hooks/useRealtime';

interface AcademicsViewProps {
  userRole?: UserRole;
  currentUser?: User;
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({ userRole = 'SUPER_ADMIN', currentUser }) => {
  const isTeacher = userRole === 'TEACHER';
  const canManageAcademics = [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'ADMIN',
    'PRINCIPAL',
    'VICE_PRINCIPAL',
    'ACADEMIC_COORDINATOR',
  ].includes(userRole as any);

  const canDeleteClass = canManageAcademics;

  // Session State
  const schoolSettings = api.getSettings();
  const [sessions, setSessions] = useState<AcademicSession[]>(() => api.getAcademicSessions());
  const activeSessionObj = sessions.find((s) => s.status === 'ACTIVE') || sessions[0];
  const [selectedSession, setSelectedSession] = useState<string>(
    schoolSettings.currentAcademicSession || activeSessionObj?.name || '2026-2027'
  );

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'CLASSES' | 'SUBJECTS' | 'GRADING' | 'SESSIONS'>(
    'CLASSES'
  );

  // Listen to session changes
  useEffect(() => {
    const handleSessionChanged = (e: any) => {
      const updatedSessions = api.getAcademicSessions();
      setSessions(updatedSessions);
      if (e?.detail?.session) {
        setSelectedSession(e.detail.session);
      } else {
        const active = updatedSessions.find((s) => s.status === 'ACTIVE');
        if (active) setSelectedSession(active.name);
      }
    };

    window.addEventListener('academic-session-changed', handleSessionChanged);
    return () => {
      window.removeEventListener('academic-session-changed', handleSessionChanged);
    };
  }, []);

  // Live Collections
  const [classes, setClasses] = useState<AcademicClass[]>(() => api.getAllClasses());
  const [subjects, setSubjects] = useState<Subject[]>(() => api.getAllSubjects());
  const [staff, setStaff] = useState<TeacherStaff[]>(() => api.getStaff());
  const [students, setStudents] = useState(() => api.getStudents());

  // Resolved teacher staff profile and strict assignment scoping
  const currentTeacher = useMemo(() => {
    if (!isTeacher) return null;
    return staff.find(
      (s) =>
        s.id === currentUser?.id ||
        (s.employeeId && currentUser?.employeeId && s.employeeId.toUpperCase() === currentUser.employeeId.toUpperCase()) ||
        (s.email && currentUser?.email && s.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  }, [isTeacher, staff, currentUser]);

  const teacherAssignments = useMemo(() => {
    if (!isTeacher || !currentTeacher) return null;

    const assignedMap = new Map<string, { classId: string; className: string; sections: Set<string>; isClassTeacher: boolean }>();

    // 1. Class Teacher Designation (e.g. "Class 2-B" or "Class 2")
    if (currentTeacher.classTeacherOf) {
      const parts = currentTeacher.classTeacherOf.trim().split(/[-:]/);
      const cPart = parts[0].trim().toLowerCase();
      const sPart = parts[1]?.trim().toUpperCase();
      const matched = classes.find((c) => c.name.toLowerCase() === cPart || c.id.toLowerCase() === cPart);
      if (matched) {
        if (!assignedMap.has(matched.id)) {
          assignedMap.set(matched.id, { classId: matched.id, className: matched.name, sections: new Set(), isClassTeacher: true });
        } else {
          assignedMap.get(matched.id)!.isClassTeacher = true;
        }
        if (sPart) {
          assignedMap.get(matched.id)!.sections.add(sPart);
        } else {
          (matched.sections || ['A']).forEach((sec) => assignedMap.get(matched.id)!.sections.add(sec));
        }
      }
    }

    // 2. Class / section level classTeacherId
    classes.forEach((c) => {
      if (c.classTeacherId === currentTeacher.id || c.classTeacherId === currentTeacher.employeeId) {
        if (!assignedMap.has(c.id)) {
          assignedMap.set(c.id, { classId: c.id, className: c.name, sections: new Set(), isClassTeacher: true });
        } else {
          assignedMap.get(c.id)!.isClassTeacher = true;
        }
        (c.sections || ['A']).forEach((sec) => assignedMap.get(c.id)!.sections.add(sec));
      }
      if (Array.isArray(c.detailedSections)) {
        c.detailedSections.forEach((ds) => {
          if (ds.classTeacherId === currentTeacher.id || ds.classTeacherId === currentTeacher.employeeId) {
            if (!assignedMap.has(c.id)) {
              assignedMap.set(c.id, { classId: c.id, className: c.name, sections: new Set(), isClassTeacher: true });
            } else {
              assignedMap.get(c.id)!.isClassTeacher = true;
            }
            assignedMap.get(c.id)!.sections.add(ds.name.toUpperCase());
          }
        });
      }
    });

    // 3. Structured teachingProfile
    if (currentTeacher.teachingProfile) {
      const tp = currentTeacher.teachingProfile;
      const targetCId = tp.assignedClassId || tp.assignedClassName;
      if (targetCId) {
        const matched = classes.find((c) => c.id.toLowerCase() === targetCId.toLowerCase() || c.name.toLowerCase() === targetCId.toLowerCase());
        if (matched) {
          const sec = (tp.assignedSection || 'A').toUpperCase();
          if (!assignedMap.has(matched.id)) {
            assignedMap.set(matched.id, { classId: matched.id, className: matched.name, sections: new Set(), isClassTeacher: !!tp.isClassTeacher });
          } else if (tp.isClassTeacher) {
            assignedMap.get(matched.id)!.isClassTeacher = true;
          }
          assignedMap.get(matched.id)!.sections.add(sec);
        }
      }
    }

    // 4. Assigned classes array
    if (Array.isArray(currentTeacher.assignedClasses)) {
      currentTeacher.assignedClasses.forEach((ac) => {
        if (!ac || typeof ac !== 'string') return;
        const parts = ac.trim().split(/[-:]/);
        const cPart = parts[0].trim().toLowerCase();
        const sPart = parts[1]?.trim().toUpperCase();
        const matched = classes.find((c) => c.name.toLowerCase() === cPart || c.id.toLowerCase() === cPart);
        if (matched) {
          if (!assignedMap.has(matched.id)) {
            assignedMap.set(matched.id, { classId: matched.id, className: matched.name, sections: new Set(), isClassTeacher: false });
          }
          if (sPart) {
            assignedMap.get(matched.id)!.sections.add(sPart);
          } else {
            (matched.sections || ['A']).forEach((sec) => assignedMap.get(matched.id)!.sections.add(sec));
          }
        }
      });
    }

    // 5. Classes Qualified to Teach (CBSE levels permitted)
    const rawQualified: string[] = [];
    if (Array.isArray(currentTeacher.qualifiedClasses)) {
      rawQualified.push(...currentTeacher.qualifiedClasses);
    }
    if (Array.isArray(currentTeacher.classesQualifiedToTeach)) {
      rawQualified.push(...(currentTeacher.classesQualifiedToTeach as any));
    } else if (typeof currentTeacher.classesQualifiedToTeach === 'string' && currentTeacher.classesQualifiedToTeach.trim()) {
      rawQualified.push(...currentTeacher.classesQualifiedToTeach.split(',').map((s) => s.trim()));
    }
    if (currentTeacher.teachingProfile && Array.isArray((currentTeacher.teachingProfile as any).classesQualifiedToTeach)) {
      rawQualified.push(...(currentTeacher.teachingProfile as any).classesQualifiedToTeach);
    }

    const uniqueQualified = Array.from(new Set(rawQualified.filter(Boolean)));
    uniqueQualified.forEach((qc) => {
      const qTrim = qc.trim().toLowerCase();
      const matched = classes.find((c) => c.name.toLowerCase() === qTrim || c.id.toLowerCase() === qTrim);
      if (matched && (matched.status || 'ACTIVE') !== 'INACTIVE') {
        if (!assignedMap.has(matched.id)) {
          assignedMap.set(matched.id, { classId: matched.id, className: matched.name, sections: new Set(), isClassTeacher: false });
        }
        // Only the sections chosen for this class on the staff form (same rule as the server).
        const sectionsList = qualifiedSectionsForClass(currentTeacher as any, matched as any);
        sectionsList.forEach((sec) => assignedMap.get(matched.id)!.sections.add(sec));
      }
    });

    return Array.from(assignedMap.values()).map((v) => ({
      ...v,
      sections: Array.from(v.sections),
    }));
  }, [isTeacher, currentTeacher, classes]);

  const visibleClasses = useMemo(() => {
    if (!isTeacher || !teacherAssignments) return classes;
    const assignedIds = new Set(teacherAssignments.map((a) => a.classId.toLowerCase()));
    return classes
      .filter((c) => assignedIds.has(c.id.toLowerCase()))
      .map((c) => {
        const match = teacherAssignments.find((a) => a.classId.toLowerCase() === c.id.toLowerCase());
        const allowedSecs = new Set((match?.sections || []).map((s) => s.toUpperCase()));
        return {
          ...c,
          sections: (c.sections || []).filter((s) => allowedSecs.has(s.toUpperCase())),
          detailedSections: Array.isArray(c.detailedSections)
            ? c.detailedSections.filter((ds) => allowedSecs.has(ds.name.toUpperCase()))
            : [],
        };
      });
  }, [classes, isTeacher, teacherAssignments]);

  const visibleSubjects = useMemo(() => {
    if (!isTeacher || !currentTeacher || !teacherAssignments) return subjects;

    const isClassTeacherForAny = teacherAssignments.some((a) => a.isClassTeacher);
    const primarySub = (currentTeacher.assignedPrimarySubject || (currentTeacher as any).primarySubject || currentTeacher.teachingProfile?.assignedPrimarySubject || '').trim().toLowerCase();
    const expertise = [
      ...(Array.isArray(currentTeacher.subjectExpertise) ? currentTeacher.subjectExpertise : []),
      ...(Array.isArray(currentTeacher.specializationSubjects) ? currentTeacher.specializationSubjects : []),
      ...(Array.isArray(currentTeacher.subjects) ? currentTeacher.subjects : []),
      ...(Array.isArray(currentTeacher.assignedSubjects) ? currentTeacher.assignedSubjects : []),
    ].map((e) => String(e).trim().toLowerCase());

    const assignedClassIds = new Set(teacherAssignments.map((a) => a.classId));

    return subjects.filter((s) => {
      const sName = (s.name || '').toLowerCase();
      const sId = (s.id || '').toLowerCase();
      // Actual primary subject assignment
      if (primarySub && (sName === primarySub || sId === primarySub)) return true;

      // Subject expertise match
      if (expertise.includes(sName) || expertise.includes(sId)) return true;

      // Class Teachers can monitor subjects of their class
      if (isClassTeacherForAny) {
        const classTeacherClassIds = new Set(teacherAssignments.filter((a) => a.isClassTeacher).map((a) => a.classId));
        if (Array.isArray(s.classIds) && s.classIds.some((cid) => classTeacherClassIds.has(cid))) {
          return true;
        }
      }

      // Read-only curriculum subjects belonging to teacher's qualified/assigned classes
      if (Array.isArray(s.classIds) && s.classIds.some((cid) => assignedClassIds.has(cid))) {
        return true;
      }

      return false;
    });
  }, [subjects, isTeacher, currentTeacher, teacherAssignments]);

  // Class Selection in Classes Tab
  const [selectedClassId, setSelectedClassId] = useState<string>(() => visibleClasses[0]?.id || '');
  const selectedClass = visibleClasses.find((c) => c.id === selectedClassId) || visibleClasses[0];

  // Subject Filtering & Search
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectTypeFilter, setSubjectTypeFilter] = useState('ALL');

  // Modals Visibility & State
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<AcademicClass | null>(null);

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<AcademicSection | null>(null);

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);

  // Safe In-App Delete Modals
  const [isDeleteClassModalOpen, setIsDeleteClassModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<AcademicClass | null>(null);

  const [isDeleteSectionModalOpen, setIsDeleteSectionModalOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<AcademicSection | null>(null);

  const [isDeleteSubjectModalOpen, setIsDeleteSubjectModalOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  // Refresh all state from API
  const refreshData = () => {
    setClasses(api.getAllClasses());
    setSubjects(api.getAllSubjects());
    setStaff(api.getStaff());
    setStudents(api.getStudents());
    setSessions(api.getAcademicSessions());
    api.syncClasses().then((serverClasses) => {
      if (Array.isArray(serverClasses)) setClasses(serverClasses);
    }).catch(() => {});
    api.syncSubjects().then((serverSubjects) => {
      if (Array.isArray(serverSubjects)) setSubjects(serverSubjects);
    }).catch(() => {});
  };

  // Initial mount data load
  useEffect(() => {
    refreshData();
  }, []);

  // Ensure default class selection when classes are loaded
  useEffect(() => {
    if (!selectedClassId && visibleClasses.length > 0) {
      setSelectedClassId(visibleClasses[0].id);
    } else if (selectedClassId && !visibleClasses.some((c) => c.id === selectedClassId) && visibleClasses.length > 0) {
      setSelectedClassId(visibleClasses[0].id);
    }
  }, [visibleClasses, selectedClassId]);

  // Real-time synchronization for Academics, Classes, Subjects, Sessions
  useRealtimeListener(['CLASS', 'SUBJECT', 'TEACHER', 'STUDENT', 'SESSION', 'SETTINGS'], () => {
    refreshData();
  });

  // ----------------------------------------------------
  // Class CRUD Handlers
  // ----------------------------------------------------
  const handleOpenAddClass = () => {
    if (!canManageAcademics) return;
    setEditingClass(null);
    setIsClassModalOpen(true);
  };

  const handleOpenEditClass = (cls: AcademicClass) => {
    if (!canManageAcademics) return;
    setEditingClass(cls);
    setIsClassModalOpen(true);
  };

  const handleInitiateDeleteClass = (cls: AcademicClass) => {
    if (!canManageAcademics) return;
    setClassToDelete(cls);
    setIsDeleteClassModalOpen(true);
  };

  const handleClassDeleted = () => {
    if (!canManageAcademics) return;
    const deletedId = classToDelete?.id;
    refreshData();
    const updated = api.getAllClasses();
    if (deletedId && (selectedClassId === deletedId || !updated.some((c) => c.id === selectedClassId))) {
      if (updated.length > 0) {
        setSelectedClassId(updated[0].id);
      } else {
        setSelectedClassId('');
      }
    }
    setClassToDelete(null);
    api
      .syncClasses()
      .then((serverClasses) => {
        if (Array.isArray(serverClasses)) {
          setClasses(serverClasses);
        }
      })
      .catch(() => {});
  };

  const handleToggleClassStatus = async (cls: AcademicClass) => {
    if (!canManageAcademics) return;
    try {
      await api.toggleClassStatusAsync(cls.id);
      const synced = await api.syncClasses();
      if (Array.isArray(synced)) {
        setClasses(synced);
      }
      refreshData();
    } catch (err: any) {
      console.error('Failed to toggle class status:', err);
      refreshData();
    }
  };

  // ----------------------------------------------------
  // Section CRUD Handlers
  // ----------------------------------------------------
  const handleOpenAddSection = () => {
    if (!canManageAcademics || !selectedClass) return;
    setEditingSection(null);
    setIsSectionModalOpen(true);
  };

  const handleOpenEditSection = (sec: AcademicSection) => {
    if (!canManageAcademics) return;
    setEditingSection(sec);
    setIsSectionModalOpen(true);
  };

  const handleInitiateDeleteSection = (sec: AcademicSection) => {
    if (!canManageAcademics) return;
    setSectionToDelete(sec);
    setIsDeleteSectionModalOpen(true);
  };

  const handleSectionDeleted = () => {
    if (!canManageAcademics) return;
    refreshData();
    setSectionToDelete(null);
  };

  // ----------------------------------------------------
  // Subject CRUD Handlers
  // ----------------------------------------------------
  const handleOpenAddSubject = () => {
    if (!canManageAcademics) return;
    setEditingSubject(null);
    setIsSubjectModalOpen(true);
  };

  const handleOpenEditSubject = (sub: Subject) => {
    if (!canManageAcademics) return;
    setEditingSubject(sub);
    setIsSubjectModalOpen(true);
  };

  const handleInitiateDeleteSubject = (sub: Subject) => {
    if (!canManageAcademics) return;
    setSubjectToDelete(sub);
    setIsDeleteSubjectModalOpen(true);
  };

  const handleSubjectDeleted = () => {
    if (!canManageAcademics) return;
    refreshData();
    setSubjectToDelete(null);
  };

  // Calculate enrolled metrics for current class
  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter((s) => s.classId === selectedClass.id);
  }, [students, selectedClass]);

  // Filtered Subjects List
  const filteredSubjects = useMemo(() => {
    const q = (subjectSearch || '').trim().toLowerCase();
    return (visibleSubjects || []).filter((s) => {
      if (!s) return false;
      const sName = (s.name || '').toLowerCase();
      const sCode = (s.code || '').toLowerCase();
      const matchSearch = !q || sName.includes(q) || sCode.includes(q);
      const matchType = subjectTypeFilter === 'ALL' || s.type === subjectTypeFilter;
      return matchSearch && matchType;
    });
  }, [visibleSubjects, subjectSearch, subjectTypeFilter]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Banner & Session Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Academics</h2>
                {isTeacher && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    Teacher View (Read-Only)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls: Session selector & Main Tabs */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Academic Session Filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-bold text-slate-600">Session:</span>
            <select
              value={selectedSession}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSession(val);
              }}
              className="bg-transparent text-xs font-bold text-blue-900 focus:outline-none cursor-pointer"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} {s.status === 'ACTIVE' ? '(Active)' : '(Inactive)'}
                </option>
              ))}
            </select>
          </div>

          {/* Module Nav Pills */}
          <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold gap-1">
            <button
              onClick={() => setActiveTab('CLASSES')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'CLASSES'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Classes & Sections</span>
            </button>
            <button
              onClick={() => setActiveTab('SUBJECTS')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'SUBJECTS'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Subjects & Curriculum</span>
            </button>
            <button
              onClick={() => setActiveTab('GRADING')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'GRADING'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Grade System</span>
            </button>
            <button
              onClick={() => setActiveTab('SESSIONS')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'SESSIONS'
                  ? 'bg-white text-emerald-950 shadow-xs font-bold border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>Academic Sessions</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CLASSES & SECTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'CLASSES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Class List (Sidebar / Col 4) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  Institutional Grades
                </span>
              </div>
              {canManageAcademics && (
                <button
                  type="button"
                  onClick={handleOpenAddClass}
                  className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
              {visibleClasses.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {isTeacher
                    ? 'No assigned classes found. Please contact the administrator.'
                    : 'No classes found.'}
                </div>
              ) : (
                visibleClasses.map((cls) => {
                const count = students.filter((s) => s.classId === cls.id).length;
                const isSelected = selectedClass?.id === cls.id;
                const totalCap = (cls.detailedSections || []).reduce(
                  (acc, s) => acc + (s.maxCapacity || cls.maxCapacity || 40),
                  0
                );

                return (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{cls.name}</h4>
                        {cls.status === 'INACTIVE' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {(cls.detailedSections && cls.detailedSections.length > 0)
                          ? cls.detailedSections.length
                          : (cls.sections || []).length}{' '}
                        Sections (
                        {(cls.detailedSections && cls.detailedSections.length > 0)
                          ? cls.detailedSections.map((s) => s.name).join(', ')
                          : (cls.sections || []).join(', ')}
                        )
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900">
                          {count}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">
                            / {totalCap || cls.maxCapacity * ((cls.sections || []).length || 1)}
                          </span>
                        </div>
                        <span className="text-[10px] text-blue-700 font-semibold">Enrolled</span>
                      </div>
                      {canDeleteClass && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInitiateDeleteClass(cls);
                          }}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={`Delete ${cls.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>

          {/* Class Configuration Detail (Col 8) */}
          <div className="lg:col-span-8 space-y-5">
            {selectedClass ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
                {/* Header for Selected Class */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-slate-900">{selectedClass.name}</h3>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                        Numeric Grade {selectedClass.numericOrder}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          selectedClass.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {selectedClass.status || 'ACTIVE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Session: <strong className="text-slate-700">{selectedClass.academicSession}</strong> •{' '}
                      Standard Section Limit: <strong>{selectedClass.maxCapacity} students</strong>
                      {selectedClass.description ? ` • ${selectedClass.description}` : ''}
                    </p>
                  </div>

                  {/* Class Level Actions */}
                  {canManageAcademics && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleClassStatus(selectedClass)}
                        className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                      >
                        {selectedClass.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditClass(selectedClass)}
                        className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Class</span>
                      </button>
                      {canDeleteClass && (
                        <button
                          type="button"
                          onClick={() => handleInitiateDeleteClass(selectedClass)}
                          className="px-2.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Class</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Overall Class Capacity Bar */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Total Grade Enrollment Capacity</span>
                    <span className="font-semibold text-slate-600">
                      {classStudents.length} Students Enrolled across{' '}
                      {selectedClass.detailedSections?.length || selectedClass.sections.length} Sections
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (classStudents.length /
                            (selectedClass.maxCapacity *
                              (selectedClass.detailedSections?.length || selectedClass.sections.length || 1))) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Sections Grid & Teacher Allocations */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Sections & Assigned Class Teachers
                      </h4>
                    </div>
                    {canManageAcademics && (
                      <button
                        type="button"
                        onClick={handleOpenAddSection}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Section</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(selectedClass.detailedSections || []).map((sec) => {
                      const enrolledInSec = classStudents.filter((s) => s.section === sec.name).length;
                      const cap = sec.maxCapacity || selectedClass.maxCapacity || 40;
                      const teacher = staff.find((t) => t.id === sec.classTeacherId);

                      return (
                        <div
                          key={sec.id}
                          className="p-4 border border-slate-200 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-blue-900 text-white font-mono font-bold text-xs">
                                Section {sec.name}
                              </span>
                              {sec.roomNumber && (
                                <span className="text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 font-medium">
                                  <DoorOpen className="w-3 h-3 text-slate-400" />
                                  <span>{sec.roomNumber}</span>
                                </span>
                              )}
                            </div>

                            {canManageAcademics && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSection(sec)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition-colors"
                                  title="Edit Section"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleInitiateDeleteSection(sec)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                                  title="Delete Section"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[11px] text-slate-500 font-medium">Enrollment</span>
                              <span className="font-bold text-slate-800">
                                {enrolledInSec} / {cap} Seats
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  enrolledInSec >= cap ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${Math.min(100, (enrolledInSec / cap) * 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Class Teacher Badge */}
                          <div className="pt-2.5 border-t border-slate-200/80 text-xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                              Designated Class Teacher
                            </span>
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-slate-900">
                                  {teacher ? teacher.name : sec.classTeacherName || 'Unassigned'}
                                </span>
                              </div>
                              {canManageAcademics && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSection(sec)}
                                  className="text-[10px] text-blue-700 font-bold hover:underline"
                                >
                                  {teacher ? 'Change' : 'Assign'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Enrolled Students in Selected Class */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Enrolled Student Registry ({classStudents.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Students currently registered in {selectedClass.name}.
                      </p>
                    </div>
                  </div>

                  {classStudents.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                          <tr>
                            <th className="p-2.5">Adm No</th>
                            <th className="p-2.5">Student Name</th>
                            <th className="p-2.5">Section</th>
                            <th className="p-2.5">Roll No</th>
                            <th className="p-2.5">Parent / Guardian</th>
                            <th className="p-2.5">Contact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {classStudents.map((stu) => (
                            <tr key={stu.id} className="hover:bg-slate-50/70">
                              <td className="p-2.5 font-mono font-bold text-blue-900">{stu.admissionNumber}</td>
                              <td className="p-2.5 font-bold text-slate-900">{stu.name}</td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[11px]">
                                  {stu.section}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono">{stu.rollNumber}</td>
                              <td className="p-2.5 text-slate-700">{stu.parentName}</td>
                              <td className="p-2.5 text-slate-600">{stu.parentPhone}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No students are currently enrolled in {selectedClass.name}. Use the Student Admission desk to admit students.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                Please select or create a class to manage its structure.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUBJECTS & CURRICULUM */}
      {/* ========================================================================= */}
      {activeTab === 'SUBJECTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">CBSE Curriculum & Subject Registry</h3>
            </div>

            {canManageAcademics && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenAddSubject}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Subject</span>
                </button>
              </div>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search subject by name or code (e.g. Mathematics, ENG-101)..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={subjectTypeFilter}
                onChange={(e) => setSubjectTypeFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Subject Types</option>
                <option value="CORE">CORE</option>
                <option value="ELECTIVE">ELECTIVE</option>
                <option value="OPTIONAL">OPTIONAL</option>
                <option value="ACTIVITY">ACTIVITY</option>
              </select>
            </div>
          </div>

          {/* Subjects Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3">Subject Code</th>
                  <th className="p-3">Subject Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Evaluation Scheme</th>
                  <th className="p-3">Pass Mark</th>
                  <th className="p-3">Credits</th>
                  <th className="p-3">Assigned Classes</th>
                  <th className="p-3">Status</th>
                  {canManageAcademics && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSubjects.map((sub) => {
                  const assignedClassNames = classes
                    .filter((c) => (sub.classIds || []).includes(c.id))
                    .map((c) => c.name);

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono font-bold text-blue-900">{sub.code}</td>
                      <td className="p-3 font-bold text-slate-900">{sub.name}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.type === 'CORE'
                              ? 'bg-blue-100 text-blue-800'
                              : sub.type === 'ELECTIVE'
                              ? 'bg-purple-100 text-purple-800'
                              : sub.type === 'PRACTICAL' || sub.type === 'ACTIVITY'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {sub.type}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700">
                        <span className="font-bold text-slate-900">{sub.maxMarks || 100} Marks</span>{' '}
                        <span className="text-[11px] text-slate-400">
                          ({sub.theoryMarks || 80} Theory + {sub.practicalMarks || 20} Practical)
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-emerald-800">{sub.passMarks || 33} Marks</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{sub.credits || 4}</td>
                      <td className="p-3">
                        <span className="text-slate-600 text-[11px]">
                          {assignedClassNames.length > 0
                            ? assignedClassNames.length === classes.length
                              ? 'All Classes (1 to 12)'
                              : assignedClassNames.join(', ')
                            : 'None'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sub.status || 'ACTIVE'}
                        </span>
                      </td>
                      {canManageAcademics && (
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSubject(sub)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Subject"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInitiateDeleteSubject(sub)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Subject"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GRADE SYSTEM */}
      {/* ========================================================================= */}
      {activeTab === 'GRADING' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">CBSE Continuous Comprehensive Evaluation (CCE)</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                  9-Point Standard
                </span>
              </div>
            </div>

            {canManageAcademics && (
              <button
                type="button"
                onClick={() => setIsGradingModalOpen(true)}
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                <span>Configure Grading Criteria</span>
              </button>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3">Grade</th>
                  <th className="p-3">Percentage Range</th>
                  <th className="p-3">Grade Point</th>
                  <th className="p-3">Institutional Remark</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {api.getGradingSystem().map((g) => (
                  <tr key={g.grade} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-black text-sm text-blue-900">{g.grade}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      {g.minPercentage}% — {g.maxPercentage}%
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">{g.gradePoint}</td>
                    <td className="p-3 text-slate-700">{g.description || 'Satisfactory'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          g.status === 'PASS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {g.status === 'PASS' ? 'PASSING' : 'NEEDS IMPROVEMENT'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ACADEMIC SESSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'SESSIONS' && (
        <AcademicSessionsManager
          selectedSession={selectedSession}
          onSelectSession={(name) => setSelectedSession(name)}
          onSessionActivated={(name) => {
            setSelectedSession(name);
            setSessions(api.getAcademicSessions());
            refreshData();
          }}
          canManage={canManageAcademics}
        />
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}
      <ClassModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        onSaved={() => refreshData()}
        onDelete={canDeleteClass ? handleInitiateDeleteClass : undefined}
        editingClass={editingClass}
        currentSession={selectedSession}
      />

      {selectedClass && (
        <SectionModal
          isOpen={isSectionModalOpen}
          onClose={() => setIsSectionModalOpen(false)}
          onSaved={() => refreshData()}
          classObj={selectedClass}
          editingSection={editingSection}
          staffList={staff}
        />
      )}

      <SubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSaved={() => refreshData()}
        editingSubject={editingSubject}
        classes={classes}
        currentSession={selectedSession}
      />

      <GradingSystemModal
        isOpen={isGradingModalOpen}
        onClose={() => setIsGradingModalOpen(false)}
        onSaved={() => refreshData()}
      />

      {/* Safe In-App Deletion Modals */}
      <DeleteClassModal
        isOpen={isDeleteClassModalOpen}
        onClose={() => {
          setIsDeleteClassModalOpen(false);
          setClassToDelete(null);
        }}
        onDeleted={handleClassDeleted}
        classToDelete={classToDelete}
        classes={classes}
        enrolledStudentsCount={
          classToDelete
            ? students.filter((s) => s.classId === classToDelete.id).length
            : 0
        }
      />

      <DeleteSectionModal
        isOpen={isDeleteSectionModalOpen}
        onClose={() => {
          setIsDeleteSectionModalOpen(false);
          setSectionToDelete(null);
        }}
        onDeleted={handleSectionDeleted}
        parentClass={selectedClass}
        sectionToDelete={sectionToDelete}
        enrolledStudentsCount={
          selectedClass && sectionToDelete
            ? students.filter(
                (s) =>
                  s.classId === selectedClass.id &&
                  s.section === sectionToDelete.name
              ).length
            : 0
        }
      />

      <DeleteSubjectModal
        isOpen={isDeleteSubjectModalOpen}
        onClose={() => {
          setIsDeleteSubjectModalOpen(false);
          setSubjectToDelete(null);
        }}
        onDeleted={handleSubjectDeleted}
        subjectToDelete={subjectToDelete}
      />
    </div>
  );
};
