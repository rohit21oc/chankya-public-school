import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Bus,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Info,
  Layers,
  MapPin,
  Megaphone,
  Phone,
  PlusCircle,
  Receipt,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Loader2,
} from 'lucide-react';
import {
  Exam,
  FeePayment,
  Homework,
  Notice,
  SchoolSettings,
  Student,
  TimetableSlot,
  User,
  hasPermission,
} from '../../types';
import { api } from '../../services/api';
import { canOpenModule } from '../Sidebar';
import { authService } from '../../services/authService';
import { fileUploadService } from '../../services/fileUploadService';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { TeacherDashboardView } from '../teachers/TeacherDashboardView';
import { summarizeStudentFees } from '../../utils/parentFeeSummary';
import { classLabel, classSectionLabel } from '../../utils/classLabel';
import { NOT_CONFIGURED, schoolIdentity } from '../../utils/schoolIdentity';

/** School identity from the saved School Settings (kept current by the settings cache). */
const SID = () => schoolIdentity(api.getSettings());

interface DashboardViewProps {
  user: User;
  settings: SchoolSettings;
  onNavigate: (module: string, subTab?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  settings,
  onNavigate,
}) => {
  const [syncing, setSyncing] = useState(false);
  // Set only after data has actually been loaded from the server.
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const stampLoaded = () =>
    setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }));

  // Sync data from database/backend on mount
  useEffect(() => {
    let isMounted = true;
    api.syncWithServer().catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const [realtimeRevision, setRealtimeRevision] = useState(0);

  // Live real-time sync across the entire Dashboard
  useRealtimeListener('ALL', () => {
    setRealtimeRevision((prev) => prev + 1);
  });

  // Refresh reloads records from the server (it never writes anything).
  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await api.syncWithServer({ force: true });
    } catch {
      setSummaryLoadError('Unable to refresh.');
    } finally {
      setSyncing(false);
    }
  };

  // Dynamic metrics & cached data from database
  const metrics = useMemo(() => api.getDashboardMetrics(), [syncing, realtimeRevision]);
  const students = useMemo(() => api.getStudents(), [syncing, realtimeRevision]);
  const classes = useMemo(() => api.getClasses(), [syncing, realtimeRevision]);
  const subjects = useMemo(() => api.getSubjects(), [syncing, realtimeRevision]);
  const notices = useMemo(() => api.getNotices(), [syncing, realtimeRevision]);
  const timetable = useMemo(() => api.getTimetable(), [syncing, realtimeRevision]);
  const exams = useMemo(() => api.getExams(), [syncing, realtimeRevision]);
  const feePayments = useMemo(() => api.getFeePayments(), [syncing, realtimeRevision]);
  const staffList = useMemo(() => api.getStaff(), [syncing, realtimeRevision]);
  const homeworkList = useMemo(() => api.getHomework(), [syncing, realtimeRevision]);

  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [summaryLoadError, setSummaryLoadError] = useState<string | null>(null);
  const [websiteEventsList, setWebsiteEventsList] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    api.fetchDashboardSummary(settings.currentAcademicSession)
      .then((data) => {
        if (isMounted) {
          if (data) {
            setDashboardSummary(data);
            setSummaryLoadError(null);
            stampLoaded();
          } else {
            setSummaryLoadError('Unable to load the latest figures.');
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('[Dashboard] Error fetching summary:', err);
          setSummaryLoadError('Unable to load the latest figures.');
        }
      });
    api.getWebsiteEvents().then((evts) => {
      if (isMounted && Array.isArray(evts)) {
        setWebsiteEventsList(evts);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [syncing, realtimeRevision, settings.currentAcademicSession]);

  const upcomingEventsList = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    return websiteEventsList
      .filter((ev) => ev.isActive !== false && ev.eventDate && ev.eventDate >= todayStr)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [websiteEventsList]);

  const publishedNotices = useMemo(() => {
    return notices
      .filter((n) => {
        if (n.status !== 'PUBLISHED') return false;
        const title = (n.title || '').trim().toLowerCase();
        const id = (n.id || '').trim().toLowerCase();
        if (
          id.includes('test-debug') ||
          title.includes('debug draft') ||
          title.startsWith('test all notice') ||
          /msg \d+$/i.test(title)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.publishedDate || '').localeCompare(a.publishedDate || ''));
  }, [notices]);

  const isParent = user.role === 'PARENT';
  const isStudent = user.role === 'STUDENT';
  const isTeacher = user.role === 'TEACHER';
  const isAdmin =
    user.role === 'SUPER_ADMIN' ||
    user.role === 'SCHOOL_ADMIN' ||
    user.role === 'PRINCIPAL' ||
    user.role === 'VICE_PRINCIPAL' ||
    user.role === 'ACADEMIC_COORDINATOR' ||
    user.role === 'HR_STAFF' ||
    user.role === 'HOSTEL_WARDEN' ||
    user.role === 'TRANSPORT_MANAGER' ||
    user.role === 'ACCOUNTANT';

  // Parent linked student management
  const [isSwitchingChild, setIsSwitchingChild] = useState(false);
  const [parentChildren, setParentChildren] = useState<Student[]>([]);

  const [activeChildId, setActiveChildId] = useState<string>(() => {
    if (isStudent && user.studentId) return user.studentId;
    if (isParent) {
      return (
        user.activeStudentId ||
        user.studentId ||
        (user.linkedStudentIds && user.linkedStudentIds[0]) ||
        (students[0]?.id ?? '')
      );
    }
    return '';
  });

  // Authoritative linked children list for Parent
  const linkedChildrenList = useMemo(() => {
    if (!isParent) return [];
    const linkedIds = user.linkedStudentIds || [];
    const cleanPhone = (user.phone || '').replace(/\D/g, '').slice(-10);
    const list = students.filter(
      (s) =>
        linkedIds.includes(s.id) ||
        linkedIds.includes(s.admissionNumber) ||
        (cleanPhone.length >= 10 &&
          ((s.parentPhone || '').replace(/\D/g, '').slice(-10) === cleanPhone ||
            (s.fatherMobile || '').replace(/\D/g, '').slice(-10) === cleanPhone ||
            (s.mobile || '').replace(/\D/g, '').slice(-10) === cleanPhone))
    );
    const seen = new Set<string>();
    return list.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [isParent, user.linkedStudentIds, user.phone, students]);

  // Combined deduplicated children list
  const effectiveChildren = useMemo(() => {
    if (!isParent) return [];
    const combined = [...parentChildren, ...linkedChildrenList];
    const seen = new Set<string>();
    return combined.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [isParent, parentChildren, linkedChildrenList]);

  // Fetch parent's linked children directly from MongoDB on mount
  useEffect(() => {
    if (isParent) {
      api.fetchLinkedChildren().then((freshList) => {
        if (freshList && freshList.length > 0) {
          setParentChildren(freshList);
          setActiveChildId((prev) => {
            const exists = freshList.some((c) => c.id === prev);
            return exists ? prev : (user.activeStudentId && freshList.some((c) => c.id === user.activeStudentId) ? user.activeStudentId : freshList[0].id);
          });
        }
      }).catch((e) => console.warn('[Dashboard] fetchLinkedChildren notice:', e));
    }
  }, [isParent, user.activeStudentId]);

  const handleSwitchChild = async (childId: string) => {
    if (childId === activeChildId && resolvedStudent) return;
    setIsSwitchingChild(true);
    try {
      await authService.switchChild(childId);
      const freshDirect = await api.fetchStudentDirect(childId);
      if (freshDirect) {
        setParentChildren((prev) => {
          const idx = prev.findIndex((p) => p.id === freshDirect.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = freshDirect;
            return next;
          }
          return [...prev, freshDirect];
        });
      }
      setActiveChildId(childId);
      setRealtimeRevision((r) => r + 1);
    } catch (err) {
      console.warn('[Dashboard] Error switching child:', err);
      setActiveChildId(childId);
    } finally {
      setIsSwitchingChild(false);
    }
  };

  const resolvedStudent: Student | null = useMemo(() => {
    if (!activeChildId) return null;
    return (
      effectiveChildren.find((s) => s.id === activeChildId) ||
      api.getStudentById(activeChildId) ||
      students.find((s) => s.id === activeChildId) ||
      null
    );
  }, [activeChildId, effectiveChildren, students]);

  // Current day of week for timetable
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDay = dayNames[new Date().getDay()];
  const formattedTodayDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Filter today's timetable based on user role
  const todayTimetableSlots = useMemo(() => {
    const todaySlots = timetable.filter(
      (t) => (t.dayOfWeek || '').toLowerCase() === todayDay.toLowerCase()
    );

    if (isTeacher) {
      return todaySlots
        .filter(
          (t) =>
            t.teacherId === user.id ||
            t.teacherId === user.employeeId ||
            (t.teacherName && user.name && t.teacherName.toLowerCase().includes(user.name.toLowerCase()))
        )
        .sort((a, b) => Number(a.periodNumber) - Number(b.periodNumber));
    }

    if ((isStudent || isParent) && resolvedStudent) {
      return todaySlots
        .filter(
          (t) =>
            (t.classId === resolvedStudent.classId || t.className === resolvedStudent.className) &&
            t.section.toUpperCase() === resolvedStudent.section.toUpperCase()
        )
        .sort((a, b) => Number(a.periodNumber) - Number(b.periodNumber));
    }

    // For Admin: return all today's slots sorted by period
    return todaySlots.sort((a, b) => Number(a.periodNumber) - Number(b.periodNumber));
  }, [timetable, todayDay, isTeacher, isStudent, isParent, resolvedStudent, user]);

  // Class-wise student distribution (Active classes Nursery to 8, active students only)
  const classDistribution = useMemo(() => {
    const activeClasses = classes
      .filter((cls) => cls.status === 'ACTIVE' && (cls as any).isActive !== false && cls.name !== 'ELP')
      .sort((a, b) => (a.numericOrder || 0) - (b.numericOrder || 0));

    const activeStudents = students.filter((s) => s.status === 'ACTIVE');

    return activeClasses.map((cls) => {
      const count = activeStudents.filter(
        (s) => s.classId === cls.id || s.className === cls.name
      ).length;
      return {
        id: cls.id,
        name: cls.name,
        count,
        capacity: cls.maxCapacity || 40,
      };
    });
  }, [classes, students]);

  const maxStudentInAnyClass = useMemo(() => {
    const max = Math.max(...classDistribution.map((c) => c.count), 1);
    return max > 0 ? max : 1;
  }, [classDistribution]);

  // Upcoming exams with valid dates and published status
  const upcomingExamsList = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const seenExamKeys = new Set<string>();
    return exams
      .filter((e) => {
        const examName = (e.title || e.name || '').trim();
        if (!examName) return false;
        const validDate = e.endDate || e.startDate;
        if (!validDate || !/^\d{4}-\d{2}-\d{2}/.test(validDate)) return false;
        if (validDate < todayStr || (e.status !== 'PUBLISHED' && !e.isApprovedByPrincipal)) return false;
        const dedupeKey = `${examName.toLowerCase()}_${e.startDate || ''}_${e.endDate || ''}`;
        if (seenExamKeys.has(dedupeKey)) return false;
        seenExamKeys.add(dedupeKey);
        return true;
      })
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }, [exams]);

  // Student specific calculations for student/parent portal
  const studentAttendanceSummary = useMemo(() => {
    if (!resolvedStudent) return { total: 0, present: 0, percent: 0 };
    const allAtt = api.getAttendance();
    const studentRecords = allAtt.filter((a) => a.studentId === resolvedStudent.id);
    const present = studentRecords.filter((a) => a.status === 'PRESENT').length;
    const total = studentRecords.length;
    const percent = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, percent };
  }, [resolvedStudent, syncing, realtimeRevision]);

  const studentFeeSummary = useMemo(() => {
    if (!resolvedStudent) return { paid: 0, due: 0, ledgerCount: 0, payments: [] as FeePayment[] };
    const studentPayments = feePayments.filter((p) => p.studentId === resolvedStudent.id);
    // Fee ledgers are the billing record (late fees, concessions, enrolment month).
    // Fee structures were used before: parents cannot read them, so every child showed "Cleared".
    const sum = summarizeStudentFees(api.getFeeLedgersSync(resolvedStudent.id), studentPayments);
    return { paid: sum.totalPaid, due: sum.totalPending, ledgerCount: sum.ledgerCount, payments: studentPayments };
  }, [resolvedStudent, feePayments, realtimeRevision, syncing]);

  const studentHomework = useMemo(() => {
    if (!resolvedStudent) return [];
    return homeworkList.filter(
      (h) =>
        (h.classId === resolvedStudent.classId || h.className === resolvedStudent.className) &&
        (!h.section || h.section === resolvedStudent.section)
    );
  }, [resolvedStudent, homeworkList]);

  // =========================================================================
  // RENDER: TEACHER PORTAL SPECIFIC VIEW
  // =========================================================================
  if (isTeacher) {
    return (
      <TeacherDashboardView
        user={user}
        settings={settings}
        onNavigate={onNavigate}
      />
    );
  }

  // =========================================================================
  // RENDER: STUDENT & PARENT SPECIFIC VIEW
  // =========================================================================
  if (isStudent || isParent) {
    return (
      <div className="space-y-6 pb-12">
        {/* 1. COMPACT HEADER */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {isParent ? 'PARENT PORTAL' : 'STUDENT PORTAL'}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Academic Session: {settings.currentAcademicSession || '2026-2027'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  System Online
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900">
                Welcome back, {user.name}
              </h1>
              <p className="text-xs text-slate-600">
                {settings.schoolName || 'RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR'}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-800">{formattedTodayDate}</div>
                <div className="text-[11px] text-slate-500">{lastSyncTime ? `Last updated ${lastSyncTime}` : 'Loading…'}</div>
              </div>
              <button
                onClick={handleManualSync}
                disabled={syncing}
                title="Refresh"
                aria-label="Refresh"
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Child Selector for Parent */}
          {isParent && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-700" />
                  <span className="text-xs font-bold text-slate-900">
                    Linked Children ({effectiveChildren.length})
                  </span>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    Select a student to view their records and academic progress
                  </span>
                </div>
                {isSwitchingChild && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Refreshing student records...
                  </span>
                )}
              </div>

              {effectiveChildren.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {effectiveChildren.map((st) => {
                    const isSelected = st.id === activeChildId;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleSwitchChild(st.id)}
                        disabled={isSwitchingChild}
                        className={`text-left p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-600 shadow-xs ring-2 ring-blue-600/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-blue-900 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                          {st.photo && fileUploadService.getFileUrl(st.photo) ? (
                            <img
                              src={fileUploadService.getFileUrl(st.photo)}
                              alt={st.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            st.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {st.name}
                            </span>
                            {isSelected ? (
                              <span className="px-1.5 py-0.2 bg-blue-700 text-white rounded text-[10px] font-bold shrink-0">
                                Viewing
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                Switch →
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                            <span className="font-semibold text-slate-800">
                              {classSectionLabel(st.className, st.section)}
                            </span>
                            <span>•</span>
                            <span>Roll: {st.rollNumber || 'N/A'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Adm No: {st.admissionNumber}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                  No linked children detected for phone {user.phone}. Contact the school administration to link your student profile.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resolved Student Detail Card */}
        {resolvedStudent ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 8 Cols: Academic Details, Timetable, Homework */}
            <div className="lg:col-span-8 space-y-5">
              {/* Student Overview Hero */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-bold text-xl shadow-xs overflow-hidden shrink-0 border border-slate-200">
                      {resolvedStudent.photo && fileUploadService.getFileUrl(resolvedStudent.photo) ? (
                        <img
                          src={fileUploadService.getFileUrl(resolvedStudent.photo)}
                          alt={resolvedStudent.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        resolvedStudent.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {resolvedStudent.name}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Class: <span className="font-bold text-slate-800">{resolvedStudent.className}</span> • Section: <span className="font-bold text-slate-800">{resolvedStudent.section}</span> • Roll No: <span className="font-bold text-slate-800">{resolvedStudent.rollNumber || 'N/A'}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Session: <span className="font-semibold text-blue-700">{resolvedStudent.academicSession || settings.currentAcademicSession || '2026-2027'}</span> • Admission No: <span className="font-mono font-bold text-slate-800">{resolvedStudent.admissionNumber || 'No data'}</span>
                      </p>
                    </div>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active Student
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Admission No.</span>
                    <span className="font-bold text-slate-800 text-xs font-mono">{resolvedStudent.admissionNumber || 'No data'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Class & Section</span>
                    <span className="font-bold text-slate-800 text-xs">{resolvedStudent.className} - {resolvedStudent.section}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Roll No.</span>
                    <span className="font-bold text-slate-800 text-xs">{resolvedStudent.rollNumber || 'N/A'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Academic Session</span>
                    <span className="font-bold text-blue-800 text-xs">{resolvedStudent.academicSession || settings.currentAcademicSession || '2026-2027'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Attendance</span>
                    <span className="font-bold text-emerald-700 text-xs">
                      {studentAttendanceSummary.total > 0
                        ? `${studentAttendanceSummary.percent}% (${studentAttendanceSummary.present}/${studentAttendanceSummary.total}d)`
                        : 'No records yet'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Fee Balance</span>
                    <span className={`font-bold text-xs ${studentFeeSummary.due > 0 ? 'text-amber-700' : studentFeeSummary.ledgerCount === 0 ? 'text-slate-500' : 'text-emerald-700'}`}>
                      {studentFeeSummary.due > 0
                        ? `₹${studentFeeSummary.due.toLocaleString('en-IN')} due`
                        : studentFeeSummary.ledgerCount === 0
                        ? 'No fee records'
                        : 'Cleared'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                  <button
                    onClick={() => onNavigate('documents')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                  >
                    View ID Card & Documents
                  </button>
                  <button
                    onClick={() => onNavigate('timetable')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                  >
                    Weekly Master Timetable
                  </button>
                  <button
                    onClick={() => onNavigate('fees')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                  >
                    Fee Receipts & Dues
                  </button>
                  <button
                    onClick={() => onNavigate('exams')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                  >
                    Examination & Results
                  </button>
                </div>
              </div>

              {/* Today's Timetable */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-700" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Today's Class Schedule ({todayDay})
                    </h3>
                  </div>
                  <button
                    onClick={() => onNavigate('timetable')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Full Timetable →
                  </button>
                </div>

                {todayTimetableSlots.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    No timetable periods scheduled for {todayDay}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayTimetableSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-md bg-blue-100 text-blue-900 font-bold flex items-center justify-center flex-shrink-0">
                            P{slot.periodNumber}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">{slot.subjectName}</div>
                            <div className="text-[11px] text-slate-500">
                              Teacher: {slot.teacherName || 'Faculty Assigned'} • Room: {slot.roomNumber || 'Room 101'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right sm:self-center font-mono font-medium text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200">
                          {slot.startTime} - {slot.endTime}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Homework & Assignments */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-700" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Current Homework & Study Tasks
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {studentHomework.length} Active Assignments
                  </span>
                </div>

                {studentHomework.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    No pending homework assignments recorded for your class.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {studentHomework.slice(0, 4).map((hw) => (
                      <div
                        key={hw.id}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-slate-900">{hw.title}</div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex-shrink-0">
                            Due: {hw.dueDate}
                          </span>
                        </div>
                        <div className="text-slate-600 mt-1">{hw.instructions}</div>
                        <div className="text-[11px] text-slate-400 mt-2">
                          Subject: {hw.subjectName} • Assigned by: {hw.teacherName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 4 Cols: Notices, Exams, Campus Info */}
            <div className="lg:col-span-4 space-y-5">
              {/* Upcoming Exams Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-700" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Upcoming Examinations
                    </h3>
                  </div>
                  <button
                    onClick={() => onNavigate('exams')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    View Date Sheet
                  </button>
                </div>

                {upcomingExamsList.length === 0 ? (
                  <div className="text-center py-5 text-slate-500 text-xs">
                    No examinations currently scheduled.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingExamsList.slice(0, 3).map((exam) => (
                      <div
                        key={exam.id}
                        className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs"
                      >
                        <div className="font-bold text-amber-950">{exam.title}</div>
                        <div className="text-amber-800 text-[11px] mt-1">
                          Starts: {exam.startDate} • Ends: {exam.endDate}
                        </div>
                        <div className="text-[10px] font-bold text-amber-700 uppercase mt-1">
                          Type: {exam.examType.replace('_', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* School Notices */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-blue-700" />
                    <h3 className="text-sm font-bold text-slate-900">
                      School Circulars & Notices
                    </h3>
                  </div>
                  <button
                    onClick={() => onNavigate('communication')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    View All
                  </button>
                </div>

                {notices.length === 0 ? (
                  <div className="text-center py-5 text-slate-500 text-xs">
                    No active circulars at this moment.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notices.slice(0, 4).map((n, idx) => (
                      <div key={n.id ? `notice-dash-${n.id}-${idx}` : `notice-dash-${idx}`} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-bold text-slate-900 leading-snug">{n.title}</h4>
                          {n.isUrgent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-800">
                              URGENT
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 mt-1 line-clamp-2 text-[11px]">{n.content}</p>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {n.publishedDate} • {n.category}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campus Information Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
                <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                  <Building2 className="w-4 h-4 text-blue-800" />
                  <span>Campus Information</span>
                </div>
                <div className="font-bold text-slate-900">
                  {SID().name || NOT_CONFIGURED}
                </div>
                <div className="flex items-start gap-1.5 text-slate-600 mt-1 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>{SID().address || NOT_CONFIGURED}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 mt-1 text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>Mobile: {SID().phones.join(' | ') || NOT_CONFIGURED}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                  Affiliation Code: <span className="font-mono font-bold text-slate-700">{SID().affiliationNo || NOT_CONFIGURED}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
            No student profile found for this user account.
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: TEACHER SPECIFIC VIEW
  // =========================================================================
  if (isTeacher) {
    const teacherStaffRecord = staffList.find(
      (s) => s.employeeId === user.employeeId || s.email === user.email || s.name === user.name
    );
    const teacherSlots = timetable.filter(
      (t) =>
        t.teacherId === user.id ||
        t.teacherId === user.employeeId ||
        (teacherStaffRecord && t.teacherId === teacherStaffRecord.id) ||
        (t.teacherName && user.name && t.teacherName.toLowerCase().includes(user.name.toLowerCase()))
    );
    const teacherTodaySlots = teacherSlots
      .filter((t) => (t.dayOfWeek || '').toLowerCase() === todayDay.toLowerCase())
      .sort((a, b) => Number(a.periodNumber) - Number(b.periodNumber));

    const assignedClassNames: string[] = Array.from(new Set<string>(teacherSlots.map((s) => `${s.className}-${s.section}`)));
    const assignedSubjects: string[] = Array.from(new Set<string>(teacherSlots.map((s) => s.subjectName)));

    // Primary class for attendance: first assigned class or first active class
    const primaryClassObj = classes.find((c) =>
      assignedClassNames.some((ac) => ac.startsWith(c.name))
    ) || classes.find((c) => c.status === 'ACTIVE' && c.name !== 'ELP') || classes[0];
    const primarySection = 'A';
    const classAttendanceToday = api.getAttendance(
      primaryClassObj?.id,
      primarySection,
      metrics.attendance.date
    );
    const classPresentCount = classAttendanceToday.filter((a) => a.status === 'PRESENT').length;
    const classTotalMarked = classAttendanceToday.length;
    const classAttPercent = classTotalMarked > 0 ? Math.round((classPresentCount / classTotalMarked) * 100) : 0;

    const teacherHomeworkItems = homeworkList.filter(
      (h) =>
        (h.teacherName && user.name && h.teacherName.toLowerCase().includes(user.name.toLowerCase())) ||
        assignedClassNames.some((ac) => ac.startsWith(h.className))
    );

    return (
      <div className="space-y-6 pb-12">
        {/* 1. COMPACT TEACHER HEADER */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 uppercase">
                  TEACHER PORTAL
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  Academic Session: {settings.currentAcademicSession || '2026-2027'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Academic Status: Active Faculty
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900">
                Welcome back, {user.name}
              </h1>
              <p className="text-xs text-slate-600">
                {SID().name || NOT_CONFIGURED} — Department of {teacherStaffRecord?.department || 'Academics'}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800">{formattedTodayDate}</div>
                <div className="text-[11px] text-slate-500">{lastSyncTime ? `Last updated ${lastSyncTime}` : 'Loading…'}</div>
              </div>
              <button
                onClick={handleManualSync}
                disabled={syncing}
                title="Refresh"
                aria-label="Refresh"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-purple-600' : ''}`} />
                <span className="hidden sm:inline">{syncing ? 'Refreshing…' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. TEACHER TOP KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Teaching Periods */}
          <div
            onClick={() => onNavigate('timetable')}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-purple-400 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
              <span className="font-semibold text-slate-700">Today's Periods</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {teacherTodaySlots.length} Periods
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500 font-medium">
                Day: <strong className="text-slate-800">{todayDay}</strong>
              </span>
              <span className="text-purple-700 font-semibold">Weekly: {teacherSlots.length}</span>
            </div>
          </div>

          {/* Card 2: Assigned Classes */}
          <div
            onClick={() => onNavigate('academics')}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-400 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
              <span className="font-semibold text-slate-700">My Classes</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {assignedClassNames.length > 0 ? assignedClassNames.length : 'No classes'}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500 truncate max-w-[150px]">
                {assignedClassNames.join(', ') || 'General Faculty'}
              </span>
              <span className="text-slate-400">{assignedSubjects.length} Subjects</span>
            </div>
          </div>

          {/* Card 3: Class Attendance */}
          <div
            onClick={() => onNavigate('attendance')}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-emerald-400 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
              <span className="font-semibold text-slate-700">Class Attendance</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {classTotalMarked > 0 ? `${classAttPercent}%` : `${metrics.attendance.percentage}%`}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500">
                {primaryClassObj?.name || 'Class 1'}-{primarySection}: <strong className="text-emerald-700">{classPresentCount} Present</strong>
              </span>
              <span className="text-slate-400">Total: {classTotalMarked || metrics.totalStudents}</span>
            </div>
          </div>

          {/* Card 4: Active Homework */}
          <div
            onClick={() => onNavigate('academics')}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-amber-400 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
              <span className="font-semibold text-slate-700">Active Homework</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {teacherHomeworkItems.length}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500">Assigned Tasks</span>
              <span className="text-amber-700 font-semibold">Active</span>
            </div>
          </div>
        </div>

        {/* 3. TEACHER QUICK ACTIONS */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Teacher Quick Actions
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <button
              onClick={() => goIfAllowed('attendance')}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/60 text-slate-700 text-xs font-semibold transition-all"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span className="truncate">Mark Class Attendance</span>
            </button>
            <button
              onClick={() => onNavigate('timetable')}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:border-purple-400 hover:bg-purple-50/60 text-slate-700 text-xs font-semibold transition-all"
            >
              <Clock className="w-3.5 h-3.5 text-purple-700" />
              <span className="truncate">My Timetable</span>
            </button>
            <button
              onClick={() => onNavigate('academics')}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 text-slate-700 text-xs font-semibold transition-all"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-700" />
              <span className="truncate">Create Homework</span>
            </button>
            <button
              onClick={() => onNavigate('exams')}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:border-amber-400 hover:bg-amber-50/60 text-slate-700 text-xs font-semibold transition-all"
            >
              <Award className="w-3.5 h-3.5 text-amber-700" />
              <span className="truncate">Enter Exam Result</span>
            </button>
            <button
              onClick={() => onNavigate('communication')}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 text-slate-700 text-xs font-semibold transition-all"
            >
              <Megaphone className="w-3.5 h-3.5 text-blue-700" />
              <span className="truncate">Post Notice</span>
            </button>
            <button
              onClick={() => onNavigate('academics')}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all"
            >
              <FileCheck className="w-3.5 h-3.5 text-slate-700" />
              <span className="truncate">Study Material</span>
            </button>
          </div>
        </div>

        {/* 4. TEACHER 12-COLUMN RESPONSIVE GRID */}
        <div className="grid grid-cols-12 gap-5">
          {/* Left 8 Cols */}
          <div className="col-span-12 lg:col-span-8 space-y-5">
            {/* Today's Teaching Schedule */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-700" />
                  <h2 className="text-sm font-bold text-slate-900">
                    My Teaching Schedule for Today ({todayDay})
                  </h2>
                </div>
                <button
                  onClick={() => onNavigate('timetable')}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-900"
                >
                  Weekly Master Timetable →
                </button>
              </div>

              {teacherTodaySlots.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No teaching periods scheduled for you on {todayDay}.
                </div>
              ) : (
                <div className="space-y-2">
                  {teacherTodaySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-md bg-purple-100 text-purple-900 font-bold flex items-center justify-center flex-shrink-0">
                          P{slot.periodNumber}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">
                            {slot.subjectName} — {slot.className} ({slot.section})
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Room: {slot.roomNumber || 'Room 101'} • Duration: 45 Minutes
                          </div>
                        </div>
                      </div>
                      <div className="font-mono font-medium text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 text-right sm:self-center">
                        {slot.startTime} - {slot.endTime}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Class Attendance Register */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Class Attendance Register ({primaryClassObj?.name || 'Class 1'}-{primarySection})
                  </h2>
                </div>
                <button
                  onClick={() => goIfAllowed('attendance')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Open Attendance Register →
                </button>
              </div>

              {classAttendanceToday.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Attendance not yet recorded for {primaryClassObj?.name || 'Class 1'}-{primarySection} on {metrics.attendance.date}.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {classAttendanceToday.slice(0, 5).map((rec) => (
                    <div key={rec.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{rec.studentName}</span>
                        <span className="text-[11px] text-slate-400 ml-2">Roll No: {rec.rollNumber}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rec.status === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.status === 'ABSENT'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Homework & Tasks */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-700" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Assigned Homework & Curriculum Tasks
                  </h2>
                </div>
                <button
                  onClick={() => onNavigate('academics')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Create Homework →
                </button>
              </div>

              {teacherHomeworkItems.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No active homework tasks assigned currently.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {teacherHomeworkItems.slice(0, 4).map((hw) => (
                    <div
                      key={hw.id}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900">{hw.title}</div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Due: {hw.dueDate}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 text-[11px]">{hw.instructions}</p>
                      <div className="text-[10px] text-slate-400 mt-2">
                        Class: {hw.className} ({hw.section}) • Subject: {hw.subjectName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Cols */}
          <div className="col-span-12 lg:col-span-4 space-y-5">
            {/* Upcoming Examinations */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-700" />
                  <h3 className="text-sm font-bold text-slate-900">Upcoming Exams</h3>
                </div>
                <button
                  onClick={() => onNavigate('exams')}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900"
                >
                  Enter Marks
                </button>
              </div>

              {upcomingExamsList.length === 0 ? (
                <div className="text-center py-5 text-slate-500 text-xs">
                  No exams currently scheduled.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingExamsList.slice(0, 3).map((exam) => (
                    <div
                      key={exam.id}
                      className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs"
                    >
                      <div className="font-bold text-amber-950">{exam.title}</div>
                      <div className="text-amber-800 text-[11px] mt-1">
                        Dates: {exam.startDate} to {exam.endDate}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* School Circulars & Notices */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-blue-700" />
                  <h3 className="text-sm font-bold text-slate-900">Staff Notices</h3>
                </div>
                <button
                  onClick={() => onNavigate('communication')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  View All
                </button>
              </div>

              {notices.length === 0 ? (
                <div className="text-center py-5 text-slate-500 text-xs">
                  No circulars posted.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notices.slice(0, 4).map((n, idx) => (
                    <div key={n.id ? `notice-card-${n.id}-${idx}` : `notice-card-${idx}`} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                      <div className="font-bold text-slate-900">{n.title}</div>
                      <p className="text-slate-600 line-clamp-2 text-[11px] mt-0.5">{n.content}</p>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {n.publishedDate} • {n.category}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Teacher Campus Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                <Building2 className="w-4 h-4 text-blue-800" />
                <span>Campus Information</span>
              </div>
              <div className="font-bold text-slate-900">
                {SID().name || NOT_CONFIGURED}
              </div>
              <div className="flex items-start gap-1.5 text-slate-600 mt-1.5 text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{SID().address || NOT_CONFIGURED}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 mt-1.5 text-[11px]">
                <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>Mobile: {SID().phones.join(' | ') || NOT_CONFIGURED}</span>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200 text-[11px] flex justify-between text-slate-500">
                <span>Affiliation Code: <strong className="font-mono text-slate-800">{SID().affiliationNo || NOT_CONFIGURED}</strong></span>
                <span>{SID().board ? `${SID().board} Affiliated • CBSE Pattern` : 'CBSE Pattern'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ADMIN / SUPER ADMIN / PRINCIPAL / EXECUTIVE DASHBOARD
  // =========================================================================
  const activeMetrics = dashboardSummary || metrics;
  const currentMonthName = new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const recentTransactions = activeMetrics.fees?.recentPayments || [];
  // Fee figures are omitted by the server for roles without fee access.
  const showFees = !!activeMetrics.fees;

  // Shortcuts are shown only when the user may open the module and perform the action.
  const quickActions = [
    { label: 'Admit Student', module: 'students', tab: 'admission', permission: 'students.create', icon: UserPlus, iconClass: 'text-blue-700' },
    { label: 'Mark Attendance', module: 'attendance', tab: undefined, permission: 'attendance.mark', icon: CalendarCheck, iconClass: 'text-emerald-700' },
    { label: 'Collect Fee', module: 'fees', tab: undefined, permission: 'fees.collect', icon: Receipt, iconClass: 'text-emerald-700' },
    { label: 'Enter Result', module: 'exams', tab: undefined, permission: 'exams.marks.enter', icon: Award, iconClass: 'text-amber-700' },
    { label: 'Create Notice', module: 'communication', tab: undefined, permission: 'notices.publish', icon: Megaphone, iconClass: 'text-blue-700' },
    { label: 'Master Timetable', module: 'timetable', tab: undefined, permission: undefined, icon: Clock, iconClass: 'text-slate-700' },
  ].filter((qa) => canOpenModule(user, qa.module) && (!qa.permission || user.role === 'SUPER_ADMIN' || hasPermission(user, qa.permission)));
  const goIfAllowed = (moduleId: string) => {
    if (canOpenModule(user, moduleId)) onNavigate(moduleId);
  };

  // Genuinely upcoming examinations & school events with valid future dates
  const combinedUpcoming = [
    ...upcomingExamsList.map((e) => {
      const dateStr =
        e.startDate && e.endDate && e.startDate !== e.endDate
          ? `${e.startDate} to ${e.endDate}`
          : e.startDate || e.endDate || '';
      return {
        id: `exam-${e.id}`,
        title: e.title || e.name || 'Examination',
        type: 'EXAM' as const,
        date: dateStr,
        description: e.instructions || e.description || '',
      };
    }),
    ...upcomingEventsList.map((ev) => ({
      id: `evt-${ev.id}`,
      title: ev.title || 'School Event',
      type: 'EVENT' as const,
      date: ev.eventDate || '',
      description: ev.description || '',
    })),
  ]
    .filter((item) => Boolean(item.date) && item.date.length >= 8)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  return (
    <div className="space-y-5 pb-12">
      {summaryLoadError && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between">
          <span>{summaryLoadError} Showing the last saved figures.</span>
          <button
            type="button"
            onClick={handleManualSync}
            className="text-amber-800 underline font-semibold cursor-pointer shrink-0 ml-3"
          >
            Try again
          </button>
        </div>
      )}

      {/* 1. COMPACT SCHOOL MIS HEADER */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0B1F4B] text-white tracking-wide uppercase">
                {user.role.replace('_', ' ')}
              </span>
              <span className="text-xs font-semibold text-slate-700">
                Academic Session: {activeMetrics.academicSession || settings.currentAcademicSession || '2026-2027'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">
                {[SID().affiliationNo ? `Affiliation Code: ${SID().affiliationNo}` : 'Affiliation Code: Not configured', SID().board ? `${SID().board} affiliated` : '', 'CBSE Pattern of Education'].filter(Boolean).join(' • ')}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-heading">
              {SID().name || NOT_CONFIGURED}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {SID().address || 'Address not configured'} • Administrative Control Center
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800">{formattedTodayDate}</div>
              <div className="text-[11px] text-slate-500">
                {lastSyncTime ? `Last updated ${lastSyncTime}` : 'Loading…'}
              </div>
            </div>
            <button
              onClick={handleManualSync}
              disabled={syncing}
              title="Refresh dashboard"
              aria-label="Refresh dashboard"
              className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{syncing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. FREQUENT QUICK ACTIONS */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-3.5 shadow-xs">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Administrative Quick Actions
        </div>
        {quickActions.length === 0 ? (
          <p className="text-xs text-slate-500">No shortcuts are available for your role.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                type="button"
                onClick={() => onNavigate(qa.module, qa.tab)}
                className="flex items-center justify-center gap-2 min-h-11 p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 text-slate-700 text-xs font-semibold transition-all group cursor-pointer"
              >
                <qa.icon className={`w-3.5 h-3.5 ${qa.iconClass} group-hover:scale-110 transition-transform`} />
                <span className="truncate">{qa.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. ROW 1: TOP 6 EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Card 1: Active Students */}
        <div
          onClick={() => goIfAllowed('students')}
          className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs hover:border-blue-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <span>Active Students</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center group-hover:bg-[#123B8C] group-hover:text-white transition-colors">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-heading">
            {activeMetrics.totalStudents > 0 ? activeMetrics.totalStudents : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            All active enrollments
          </div>
        </div>

        {/* Card 2: Today's Attendance */}
        <div
          onClick={() => goIfAllowed('attendance')}
          className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs hover:border-emerald-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <span>Today's Attendance</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-heading">
            {activeMetrics.attendance?.isMarked && activeMetrics.attendance.percentage !== null
              ? `${activeMetrics.attendance.percentage}%`
              : 'Not recorded'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {activeMetrics.attendance?.isMarked
              ? `${activeMetrics.attendance.present} of ${activeMetrics.attendance.totalMarked} marked present`
              : 'Attendance not marked'}
          </div>
        </div>

        {showFees && (
        <>
        {/* Card 3: Today's Collection */}
        <div
          onClick={() => goIfAllowed('fees')}
          className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs hover:border-emerald-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <span>Today's Collection</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-heading">
            ₹{(activeMetrics.fees?.todayCollection || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {activeMetrics.fees?.todayCollection > 0
              ? 'Confirmed payments today'
              : '0 payments recorded today'}
          </div>
        </div>

        {/* Card 4: Month-to-Date Collection */}
        <div
          onClick={() => goIfAllowed('fees')}
          className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs hover:border-emerald-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <span>Month-to-Date</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-heading">
            ₹{(activeMetrics.fees?.monthlyCollection || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {currentMonthName}
          </div>
        </div>

        {/* Card 5: Outstanding Fees */}
        <div
          onClick={() => goIfAllowed('fees')}
          className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs hover:border-amber-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <span>Outstanding Fees</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-800 font-heading">
            ₹{(activeMetrics.fees?.pendingAmount || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Students with balance: <strong className="text-amber-900">{activeMetrics.fees?.studentsWithPendingCount || 0}</strong>
          </div>
        </div>

        </>
        )}

        {/* Card 6: Active Staff */}
        <div
          onClick={() => goIfAllowed('teachers')}
          className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs hover:border-purple-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <span>Active Staff</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-800 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-heading">
            {activeMetrics.totalStaff > 0 ? activeMetrics.totalStaff : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {activeMetrics.totalTeachers} teaching • {activeMetrics.totalNonTeaching} non-teaching
          </div>
        </div>
      </div>

      {/* 4. ROW 2: TODAY'S ATTENDANCE & FEE SUMMARY */}
      <div className="grid grid-cols-12 gap-5">
        {/* LEFT: TODAY'S ATTENDANCE BREAKDOWN */}
        <div className={`col-span-12 ${showFees ? 'lg:col-span-4' : 'lg:col-span-12'} bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-700" />
                <h2 className="text-sm font-bold text-slate-900 font-heading">
                  Today's Student Attendance
                </h2>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {activeMetrics.attendance?.date || new Date().toISOString().substring(0, 10)}
              </span>
            </div>

            {activeMetrics.attendance?.isMarked ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">Recorded Rate</span>
                  <span className="text-xs font-bold text-emerald-700">
                    {activeMetrics.attendance.percentage}% Present
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${activeMetrics.attendance.percentage || 0}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
                  <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/60">
                    <span className="block text-[10px] text-emerald-800 font-medium">Present</span>
                    <strong className="text-emerald-900 font-bold text-sm">
                      {activeMetrics.attendance.present}
                    </strong>
                    {activeMetrics.attendance.late > 0 && (
                      <span className="block text-[10px] text-emerald-700">incl. {activeMetrics.attendance.late} late</span>
                    )}
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200/60">
                    <span className="block text-[10px] text-rose-800 font-medium">Absent</span>
                    <strong className="text-rose-900 font-bold text-sm">
                      {activeMetrics.attendance.absent}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/60">
                    <span className="block text-[10px] text-amber-800 font-medium">On Leave</span>
                    <strong className="text-amber-900 font-bold text-sm">
                      {activeMetrics.attendance.leave}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="block text-[10px] text-slate-600 font-medium">Not Marked</span>
                    <strong className="text-slate-800 font-bold text-sm">
                      {activeMetrics.attendance.notMarked}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                  {activeMetrics.attendance.totalMarked} students marked on today's roster out of {activeMetrics.attendance.totalActive} active enrolled students.
                </p>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs space-y-2">
                <p className="font-semibold text-slate-700">Attendance not marked today</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Daily classroom attendance has not yet been recorded for {formattedTodayDate}.
                </p>
                <button
                  onClick={() => goIfAllowed('attendance')}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Mark Attendance Now →
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Class Attendance Register</span>
            <button
              onClick={() => goIfAllowed('attendance')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              Open Register →
            </button>
          </div>
        </div>

        {/* RIGHT: FEES OVERVIEW & RECENT TRANSACTIONS */}
        {showFees && (
        <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Fee Collection & Accounts Summary
              </h2>
            </div>
            <button
              onClick={() => goIfAllowed('fees')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              View Fees Module →
            </button>
          </div>

          {/* 4 Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3.5">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Today's Collection</span>
              <strong className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                ₹{(activeMetrics.fees?.todayCollection || 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Month-to-Date</span>
              <strong className="text-sm sm:text-base font-bold text-emerald-700 font-mono">
                ₹{(activeMetrics.fees?.monthlyCollection || 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total Outstanding</span>
              <strong className="text-sm sm:text-base font-bold text-amber-800 font-mono">
                ₹{(activeMetrics.fees?.pendingAmount || 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Students with Dues</span>
              <strong className="text-sm sm:text-base font-bold text-slate-800 font-mono">
                {activeMetrics.fees?.studentsWithPendingCount || 0} Students
              </strong>
            </div>
          </div>

          {/* Recent Unique Transactions Table */}
          <div className="text-xs font-bold text-slate-800 mb-2">
            Recent Fee Transactions (Unique Receipts)
          </div>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No fee payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2 px-2.5">Receipt No</th>
                    <th className="py-2 px-2.5">Student</th>
                    <th className="py-2 px-2.5">Class</th>
                    <th className="py-2 px-2.5">Fee Head</th>
                    <th className="py-2 px-2.5">Payment Mode</th>
                    <th className="py-2 px-2.5 text-right">Amount (₹)</th>
                    <th className="py-2 px-2.5 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-2.5 font-mono font-bold text-blue-900">{p.receiptNumber || '—'}</td>
                      <td className="py-2 px-2.5 font-semibold text-slate-800">{p.studentName || '—'}</td>
                      <td className="py-2 px-2.5 text-slate-600 font-medium">
                        {p.className && p.className !== '—' ? `${p.className}${p.section ? `-${p.section}` : ''}` : '—'}
                      </td>
                      <td className="py-2 px-2.5 text-slate-600 truncate max-w-[170px]" title={p.feeHead || p.feeType}>
                        {p.feeHead || p.feeType || '—'}
                      </td>
                      <td className="py-2 px-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {p.paymentMode || p.paymentMethod || '—'}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-emerald-700 font-mono">
                        ₹{(Number(p.amount) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-500 text-[11px]">{p.paymentDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </div>

      {/* 5. ROW 3: ACADEMIC OVERVIEW & TODAY'S TIMETABLE */}
      <div className="grid grid-cols-12 gap-5">
        {/* LEFT: ACADEMIC OVERVIEW */}
        <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-800" />
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Academic Structure & Curriculum
              </h2>
            </div>
            <button
              onClick={() => onNavigate('academics')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
            >
              Academic Setup →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3.5">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Active Classes</span>
              <strong className="text-base font-bold text-slate-900 font-mono">
                {activeMetrics.academics?.totalClasses || classDistribution.length}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Sections</span>
              <strong className="text-base font-bold text-slate-900 font-mono">
                {activeMetrics.academics?.totalSections ?? classes.filter((c) => c.status === 'ACTIVE' && (c as any).isActive !== false && c.name !== 'ELP').reduce((sum, c) => sum + (c.detailedSections?.filter((s) => s.status === 'ACTIVE').length || c.sections?.length || 1), 0)}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Subjects</span>
              <strong className="text-base font-bold text-slate-900 font-mono">
                {activeMetrics.academics?.totalSubjects || subjects.length}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Today's Periods</span>
              <strong className="text-base font-bold text-blue-900 font-mono">
                {activeMetrics.academics?.scheduledPeriodsToday || todayTimetableSlots.length}
              </strong>
            </div>
          </div>

          {/* Academic session details */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1 text-slate-600">
            <div className="flex justify-between">
              <span>Affiliated Board:</span>
              <strong className="text-slate-800">{SID().board ? `${SID().board} Affiliated • CBSE Pattern` : NOT_CONFIGURED}</strong>
            </div>
            <div className="flex justify-between">
              <span>Class Range:</span>
              <strong className="text-slate-800">{(api.getSettings() as any).classesOffered || NOT_CONFIGURED}</strong>
            </div>
            <div className="flex justify-between">
              <span>Grading System:</span>
              <strong className="text-slate-800">CBSE 8-Tier Scale (A1 to E/F)</strong>
            </div>
          </div>
        </div>

        {/* RIGHT: TODAY'S MASTER TIMETABLE */}
        <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Today's Master Timetable ({todayDay})
              </h2>
            </div>
            <button
              onClick={() => onNavigate('timetable')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
            >
              Weekly Master Timetable →
            </button>
          </div>

          {todayTimetableSlots.length === 0 ? (
            <div className="text-center py-7 text-slate-500 text-xs space-y-2">
              <p className="font-semibold text-slate-700">No periods scheduled today</p>
              <p className="text-[11px] text-slate-400">
                No timetable slots for {todayDay}.
              </p>
              <button
                onClick={() => onNavigate('timetable')}
                className="mt-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
              >
                Configure Timetable →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2">Period</th>
                    <th className="p-2">Timing</th>
                    <th className="p-2">Class</th>
                    <th className="p-2">Subject</th>
                    <th className="p-2">Teacher</th>
                    <th className="p-2 text-right">Room</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayTimetableSlots.slice(0, 6).map((slot) => (
                    <tr key={slot.id} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-blue-950 font-mono">
                        P{slot.periodNumber}
                      </td>
                      <td className="p-2 font-mono text-slate-600 text-[11px]">
                        {slot.startTime} - {slot.endTime}
                      </td>
                      <td className="p-2 font-semibold text-slate-800">
                        {slot.className}-{slot.section}
                      </td>
                      <td className="p-2 text-slate-900 font-medium">
                        {slot.subjectName}
                      </td>
                      <td className="p-2 text-slate-600">
                        {slot.teacherName || '—'}
                      </td>
                      <td className="p-2 text-right text-slate-500 font-mono">
                        {slot.roomNumber || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 6. ROW 4: CLASS-WISE DISTRIBUTION & FACULTY SUMMARY */}
      <div className="grid grid-cols-12 gap-5">
        {/* LEFT: CLASS-WISE DISTRIBUTION */}
        <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-700" />
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Class-Wise Student Distribution
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Total: <strong className="text-slate-800">{activeMetrics.totalStudents}</strong> Active Students
            </span>
          </div>

          {classDistribution.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No active classes found.
            </div>
          ) : (
            <div className="space-y-2.5">
              {classDistribution.map((item) => {
                const percentage = Math.round((item.count / maxStudentInAnyClass) * 100);
                return (
                  <div key={item.id} className="flex items-center gap-3 text-xs">
                    <div className="w-20 sm:w-24 font-semibold text-slate-700 truncate">
                      {item.name}
                    </div>
                    <div className="flex-1 bg-slate-100 h-3.5 rounded overflow-hidden relative">
                      <div
                        className="bg-[#123B8C] h-full rounded transition-all duration-500"
                        style={{ width: `${Math.max(item.count > 0 ? 6 : 0, percentage)}%` }}
                      ></div>
                    </div>
                    <div className="w-16 text-right font-bold text-slate-800 font-mono">
                      {item.count}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        / {item.capacity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: FACULTY & STAFF SUMMARY */}
        <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-700" />
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Faculty & Staff Overview
              </h2>
            </div>
            <button
              onClick={() => onNavigate('teachers')}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 cursor-pointer"
            >
              View Staff Directory →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Teaching Faculty</span>
              <strong className="text-base font-bold text-slate-900 font-mono">
                {activeMetrics.totalTeachers}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Non-Teaching Staff</span>
              <strong className="text-base font-bold text-slate-900 font-mono">
                {activeMetrics.totalNonTeaching}
              </strong>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs mb-3 space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Campus Presence:</span>
              <strong className="text-emerald-700 font-mono">
                {activeMetrics.staffAttendance?.isMarked
                  ? `${activeMetrics.staffAttendance.present} Present • ${activeMetrics.staffAttendance.onLeave} on leave`
                  : 'Attendance not marked'}
              </strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Principal:</span>
              <strong className="text-slate-800">{settings.principalName || 'Nandini Raut'}</strong>
            </div>
          </div>

          {/* Key Staff Preview */}
          <div className="space-y-1.5 text-xs">
            {staffList.slice(0, 3).map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between p-2 rounded bg-white border border-slate-100"
              >
                <div className="font-semibold text-slate-800 truncate pr-2">{st.name}</div>
                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  {st.designation || st.department || 'Staff'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. ROW 5: NOTICES, UPCOMING EVENTS/EXAMS & OPERATIONS */}
      <div className="grid grid-cols-12 gap-5">
        {/* PUBLISHED NOTICES */}
        <div className="col-span-12 lg:col-span-6 bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Published Notices & Circulars
              </h2>
            </div>
            <button
              onClick={() => onNavigate('communication')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
            >
              All Notices →
            </button>
          </div>

          {publishedNotices.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No published notices recorded.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {publishedNotices.slice(0, 4).map((n, idx) => (
                <div key={n.id ? `notice-${n.id}` : `notice-${idx}`} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 leading-snug">{n.title}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {n.category || 'GENERAL'}
                      </span>
                      {n.isUrgent && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800">
                          URGENT
                        </span>
                      )}
                    </div>
                  </div>
                  {n.content && (
                    <p className="text-slate-600 mt-1 line-clamp-2 text-xs">{n.content}</p>
                  )}
                  <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                    <span>
                      Published: {n.publishedDate}
                      {n.publishedBy ? ` • By: ${n.publishedBy}` : ''}
                    </span>
                    <button
                      onClick={() => onNavigate('communication')}
                      className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* UPCOMING EXAMINATIONS & EVENTS */}
        <div className="col-span-12 lg:col-span-3 bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Upcoming Schedule
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Future Dates</span>
          </div>

          {combinedUpcoming.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No upcoming events or examinations.
            </div>
          ) : (
            <div className="space-y-2.5 text-xs">
              {combinedUpcoming.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-lg border ${
                    item.type === 'EXAM'
                      ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                      : 'bg-blue-50/70 border-blue-200/80 text-blue-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="truncate pr-1">{item.title}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        item.type === 'EXAM'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-blue-200 text-blue-900'
                      }`}
                    >
                      {item.type}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    {item.date}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HOSTEL & TRANSPORT OPERATIONS */}
        <div className="col-span-12 lg:col-span-3 bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-stone-700" />
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Campus Operations
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Facilities</span>
          </div>

          <div className="space-y-3">
            {/* Hostel */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-800">Hostel Beds</span>
                <span className="font-mono text-[11px] text-slate-600">
                  {activeMetrics.hostel?.occupancyRate || 0}% Occupied
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-blue-800 h-full rounded-full transition-all duration-500"
                  style={{ width: `${activeMetrics.hostel?.occupancyRate || 0}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
                <div className="p-1 rounded bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Total</span>
                  <strong className="text-slate-800 font-mono">{activeMetrics.hostel?.totalBeds || 0}</strong>
                </div>
                <div className="p-1 rounded bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Occupied</span>
                  <strong className="text-blue-800 font-mono">{activeMetrics.hostel?.occupiedBeds || 0}</strong>
                </div>
                <div className="p-1 rounded bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Available</span>
                  <strong className="text-emerald-700 font-mono">{activeMetrics.hostel?.availableBeds || 0}</strong>
                </div>
              </div>
            </div>

            {/* Transport */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-800">Transport Fleet</span>
                <span className="font-mono text-[11px] text-emerald-700 font-bold">
                  {activeMetrics.transport?.activeVehicles || 0} Active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-center text-[11px]">
                <div className="p-1.5 rounded bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Vehicles</span>
                  <strong className="text-slate-800 font-mono">
                    {activeMetrics.transport?.activeVehicles || 0} / {activeMetrics.transport?.totalVehicles || 0}
                  </strong>
                </div>
                <div className="p-1.5 rounded bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Routes</span>
                  <strong className="text-slate-800 font-mono">
                    {activeMetrics.transport?.activeRoutes || 0} Designated
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

