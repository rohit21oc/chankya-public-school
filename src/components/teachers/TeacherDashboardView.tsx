import { qualifiedClassNames, qualifiedSectionsForClass } from '../../utils/teacherSubjects';
import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  FileEdit,
  FileText,
  GraduationCap,
  Layers,
  MapPin,
  Megaphone,
  PlusCircle,
  Printer,
  QrCode,
  Loader2,
  RefreshCw,
  Sparkles,
  UserCheck,
  Users,
  ShieldCheck,
  HelpCircle,
  Send,
} from 'lucide-react';
import {
  SchoolSettings,
  User,
  TimetableSlot,
  Exam,
  Notice,
  StaffLeave,
  TeacherStaff,
  TeacherDashboardSummary,
  TeacherAssignedClassDetail,
  TeacherTodayTimetableSlot,
  TeacherActionableTask,
} from '../../types';
import { api } from '../../services/api';
import { getApiUrl, getAuthHeaders } from '../../services/apiConfig';
import { fileUploadService } from '../../services/fileUploadService';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { PrintableIdCardModal } from '../modals/PrintableIdCardModal';

interface TeacherDashboardViewProps {
  user: User;
  settings: SchoolSettings;
  onNavigate: (module: string, subTab?: string) => void;
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  user,
  settings,
  onNavigate,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [teacherSummary, setTeacherSummary] = useState<TeacherDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  // Auto-synchronize when timetable, attendance, exams, notices or staff records change
  useRealtimeListener(['TIMETABLE', 'ATTENDANCE', 'EXAM', 'NOTICE', 'STAFF'], () => {
    fetchDashboardData(true);
  });

  // Dedicated Staff ID Card State for Logged-In Teacher
  const [isMyIdCardOpen, setIsMyIdCardOpen] = useState(false);
  const [teacherStaffRecord, setTeacherStaffRecord] = useState<TeacherStaff | null>(null);
  const [isLoadingIdCard, setIsLoadingIdCard] = useState(false);

  const handleOpenIdCard = async () => {
    setIsLoadingIdCard(true);
    try {
      const staffId = teacherSummary?.teacher?.id || user.employeeId || user.id;
      const res = await api.fetchStaffIdCard(staffId);
      if (res.success && res.staff) {
        setTeacherStaffRecord(res.staff);
        setIsMyIdCardOpen(true);
      } else {
        const found = api.getStaff().find(
          (s) =>
            s.id === user.id ||
            s.id === staffId ||
            (user.employeeId && s.employeeId?.toUpperCase() === user.employeeId?.toUpperCase())
        );
        if (found) {
          setTeacherStaffRecord(found);
          setIsMyIdCardOpen(true);
        }
      }
    } catch {
      const found = api.getStaff().find(
        (s) =>
          s.id === user.id ||
          (user.employeeId && s.employeeId?.toUpperCase() === user.employeeId?.toUpperCase())
      );
      if (found) {
        setTeacherStaffRecord(found);
        setIsMyIdCardOpen(true);
      }
    } finally {
      setIsLoadingIdCard(false);
    }
  };

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setSyncing(true);
    else setLoading(true);

    try {
      // 1. Fetch live teacher dashboard summary from MongoDB
      const res = await fetch(getApiUrl('/api/teacher/dashboard-summary'), {
        headers: getAuthHeaders({
          'x-auth-user-id': user.id,
          'x-auth-user-role': user.role,
          'x-auth-employee-id': user.employeeId || '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTeacherSummary(data);
        setLoadError(null);
      } else {
        // Fallback: build summary from local cached collections
        buildFallbackSummary();
      }
      setLastSyncTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err: any) {
      console.warn('[TeacherDashboard] Error fetching from backend, building from cache:', err);
      buildFallbackSummary();
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const buildFallbackSummary = () => {
    const staffList = api.getStaff();
    const currentStaff = staffList.find(
      (s) =>
        s.id === user.id ||
        (user.employeeId && s.employeeId?.toUpperCase() === user.employeeId.toUpperCase())
    );

    const activeClasses = api.getClasses();
    const allStudents = api.getStudents().filter((s) => s.status === 'ACTIVE');
    const todayStr = new Date().toISOString().substring(0, 10);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDayName = dayNames[new Date().getDay()] || 'Monday';

    // Parse assigned classes
    const assignedClassNames: string[] = [];
    if (currentStaff?.classTeacherOf) assignedClassNames.push(currentStaff.classTeacherOf);
    if (Array.isArray(currentStaff?.assignedClasses)) {
      assignedClassNames.push(...currentStaff.assignedClasses);
    }
    if (Array.isArray(currentStaff?.qualifiedClasses)) {
      assignedClassNames.push(...currentStaff.qualifiedClasses);
    }
    if (Array.isArray(currentStaff?.classesQualifiedToTeach)) {
      assignedClassNames.push(...(currentStaff.classesQualifiedToTeach as any));
    } else if (typeof currentStaff?.classesQualifiedToTeach === 'string' && currentStaff.classesQualifiedToTeach.trim()) {
      assignedClassNames.push(...currentStaff.classesQualifiedToTeach.split(',').map((s) => s.trim()));
    }
    if (currentStaff?.teachingProfile && Array.isArray((currentStaff.teachingProfile as any).classesQualifiedToTeach)) {
      assignedClassNames.push(...(currentStaff.teachingProfile as any).classesQualifiedToTeach);
    }

    const assignedDetails: any[] = [];
    let totalStudents = 0;
    let pendingAttendance = 0;

    // Offline fallback only (the server's summary is the real source): qualified classes count only for the
    // sections chosen for them on the staff form; other assignments name "Class-Section" explicitly.
    const qualifiedLower = qualifiedClassNames(currentStaff as any).map((c) => c.toLowerCase());
    activeClasses.forEach((cls) => {
      const sections = cls.sections || ['A'];
      const qualifiedSecs = qualifiedLower.includes(cls.name.toLowerCase()) ? qualifiedSectionsForClass(currentStaff as any, cls as any) : [];
      sections.forEach((sec) => {
        const isAssigned =
          qualifiedSecs.includes(String(sec).toUpperCase()) ||
          assignedClassNames
            .filter((ac) => !qualifiedLower.includes(ac.toLowerCase()))
            .some((ac) => {
              const [c, sc] = ac.split(/[-:]/).map((x) => x.trim().toLowerCase());
              return (c === cls.name.toLowerCase() || c === cls.id.toLowerCase()) && (!sc || sc === String(sec).toLowerCase());
            }) ||
          (cls.classTeacherId === currentStaff?.id && sec === 'A');

        if (isAssigned) {
          const clsStudents = allStudents.filter(
            (s) => (s.classId === cls.id || s.className === cls.name) && s.section === sec
          );
          totalStudents += clsStudents.length;

          const todayAtt = api.getAttendance(cls.id, sec, todayStr);
          const isMarked = todayAtt.length > 0;
          if (!isMarked) pendingAttendance++;

          assignedDetails.push({
            classId: cls.id,
            className: cls.name,
            section: sec,
            isClassTeacher: currentStaff?.classTeacherOf?.includes(cls.name),
            studentCount: clsStudents.length,
            attendance: {
              isMarked,
              present: todayAtt.filter((a) => a.status === 'PRESENT').length,
              absent: todayAtt.filter((a) => a.status === 'ABSENT').length,
              late: todayAtt.filter((a) => a.status === 'LATE').length,
              leave: todayAtt.filter((a) => a.status === 'LEAVE').length,
            },
          });
        }
      });
    });

    const teacherSlots = api
      .getTimetable(undefined, undefined, currentStaff?.id, todayDayName)
      .sort((a, b) => Number(a.periodNumber) - Number(b.periodNumber));

    setTeacherSummary({
      teacher: {
        id: currentStaff?.id || user.id,
        name: currentStaff?.name || user.name,
        employeeId: currentStaff?.employeeId || user.employeeId || 'PDS0001',
        designation: currentStaff?.designation || 'Teacher / Faculty',
        department: currentStaff?.department || 'ACADEMICS',
        classTeacherOf: currentStaff?.classTeacherOf || '',
        avatar: currentStaff?.photo || user.avatar || '',
      },
      todayDate: todayStr,
      todayDay: todayDayName,
      academicSession: settings.currentAcademicSession || '2026-2027',
      assignedClasses: assignedDetails,
      todayTimetable: teacherSlots.map((s) => ({
        ...s,
        status: 'UPCOMING',
      })),
      upcomingExams: api.getExams().slice(0, 3),
      pendingMarksTasks: [],
      recentNotices: api.getNotices().filter((n) => n.status === 'PUBLISHED').slice(0, 5),
      leaveSummary: {
        totalApprovedDays: 0,
        pendingRequests: 0,
        casualLeavesTaken: 0,
        sickLeavesTaken: 0,
        remainingBalance: 24,
      },
      quickStats: {
        totalAssignedStudents: totalStudents,
        assignedClassesCount: assignedDetails.length,
        scheduledPeriodsToday: teacherSlots.length,
        completedPeriodsToday: 0,
        pendingAttendanceCount: pendingAttendance,
        pendingMarksCount: 0,
        leaveBalance: 24,
      },
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user.id, settings.currentAcademicSession]);

  const teacher = teacherSummary?.teacher || {
    name: user.name,
    employeeId: user.employeeId || 'PDS0001',
    designation: 'Teacher / Faculty',
    department: 'ACADEMICS',
    classTeacherOf: '',
    assignedSubjects: [] as string[],
  };

  const assignedClasses = teacherSummary?.assignedClasses || [];
  const assignedSubjects = teacherSummary?.assignedSubjects || (teacher as any).assignedSubjects || [];
  const todayTimetable = teacherSummary?.todayTimetable || [];
  const actionableTasks = teacherSummary?.tasks || [];
  const quickStats = teacherSummary?.quickStats || {
    totalAssignedStudents: 0,
    assignedClassesCount: assignedClasses.length,
    assignedSubjectsCount: assignedSubjects.length,
    scheduledPeriodsToday: todayTimetable.length,
    completedPeriodsToday: 0,
    pendingAttendanceCount: 0,
    pendingMarksCount: 0,
    leaveBalance: 24,
  };
  const upcomingExams = teacherSummary?.upcomingExams || [];
  const pendingMarksTasks = teacherSummary?.pendingMarksTasks || [];
  const recentNotices = teacherSummary?.recentNotices || [];
  const leaveSummary = teacherSummary?.leaveSummary || { remainingBalance: 24, pendingRequests: 0 };

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return new Date().toLocaleDateString();
    }
  }, []);

  return (
    <div className="space-y-4 sm:space-y-5 pb-12 font-sans antialiased text-slate-800">
      {/* 1. TEACHER HERO BANNER */}
      <div className="bg-gradient-to-r from-[#0B1F4B] to-[#1E3A8A] rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4.5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-1 flex items-center justify-center font-bold text-xl text-white shadow-xs shrink-0 overflow-hidden">
              {teacher.avatar && fileUploadService.getFileUrl(teacher.avatar) ? (
                <img
                  src={fileUploadService.getFileUrl(teacher.avatar)}
                  alt={teacher.name}
                  className="w-full h-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-2xl font-bold">{teacher.name.charAt(0)}</span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                  Teacher Portal
                </span>
                {teacher.classTeacherOf && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-200 border border-amber-300/30">
                    Class Teacher: {teacher.classTeacherOf}
                  </span>
                )}
                <span className="text-xs text-blue-200 font-mono">
                  Emp ID: {teacher.employeeId}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-heading">
                Welcome, {teacher.name}
              </h1>
              <p className="text-xs text-blue-100/90 mt-0.5 flex flex-wrap items-center gap-2">
                <span>{teacher.designation || 'Faculty Member'}</span>
                <span>•</span>
                <span>Academic Session: <strong>{teacherSummary?.academicSession || settings.currentAcademicSession || '2026-2027'}</strong></span>
                <span>•</span>
                <span>RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR</span>
              </p>

              {/* Assigned Subjects Badges */}
              {assignedSubjects.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="text-[11px] text-blue-200 font-semibold flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-blue-300" />
                    <span>Assigned Subjects:</span>
                  </span>
                  {assignedSubjects.map((sub: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/15 text-white border border-white/20 backdrop-blur-xs shadow-2xs"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-blue-100">{formattedDate}</div>
              <div className="text-[11px] text-blue-300">
                Synced at {lastSyncTime}
              </div>
            </div>
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={syncing}
              title="Refresh teacher portal records"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. FREQUENT TEACHER QUICK ACTIONS */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>Teacher Quick Actions</span>
          <span className="text-[11px] text-slate-400 font-normal">Click to navigate directly</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* Action 1: Mark Attendance */}
          <button
            onClick={() => onNavigate('attendance')}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/70 text-slate-700 hover:text-emerald-900 text-xs font-semibold transition-all group cursor-pointer shadow-2xs"
          >
            <CalendarCheck className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span className="truncate">Mark Attendance</span>
          </button>

          {/* Action 2: Enter Marks */}
          <button
            onClick={() => onNavigate('exams')}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/70 text-slate-700 hover:text-blue-900 text-xs font-semibold transition-all group cursor-pointer shadow-2xs"
          >
            <FileEdit className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            <span className="truncate">Enter Marks</span>
          </button>

          {/* Action 3: View Timetable */}
          <button
            onClick={() => onNavigate('timetable')}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 text-xs font-semibold transition-all group cursor-pointer shadow-2xs"
          >
            <Clock className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
            <span className="truncate">My Timetable</span>
          </button>

          {/* Action 4: My Students */}
          <button
            onClick={() => onNavigate('students')}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-violet-500 hover:bg-violet-50/70 text-slate-700 hover:text-violet-900 text-xs font-semibold transition-all group cursor-pointer shadow-2xs"
          >
            <GraduationCap className="w-4 h-4 text-violet-600 group-hover:scale-110 transition-transform" />
            <span className="truncate">My Students</span>
          </button>

          {/* Action 5: My Profile & Leaves */}
          <button
            onClick={() => onNavigate('profile')}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/70 text-slate-700 hover:text-amber-900 text-xs font-semibold transition-all group cursor-pointer shadow-2xs col-span-2 sm:col-span-1"
          >
            <UserCheck className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
            <span className="truncate">Leave & Profile</span>
          </button>
        </div>
      </div>

      {/* 3. KEY METRICS STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Assigned Classes & Students */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Classes & Subjects</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {quickStats.assignedClassesCount}
              <span className="text-xs text-slate-500 font-normal ml-2">
                Classes • {assignedSubjects.length} Subjects
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {assignedClasses.slice(0, 3).map((ac: any, i: number) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700"
                >
                  {ac.className}-{ac.section}
                </span>
              ))}
              {assignedClasses.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] text-slate-400">
                  +{assignedClasses.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Today's Attendance Status */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Today's Attendance</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              quickStats.pendingAttendanceCount === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {quickStats.pendingAttendanceCount === 0 ? 'Completed' : `${quickStats.pendingAttendanceCount} Pending`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {quickStats.pendingAttendanceCount === 0
                ? 'All assigned classes recorded today'
                : 'Take attendance for pending classes'}
            </p>
          </div>
        </div>

        {/* Card 3: Today's Scheduled Periods */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Today's Periods</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {quickStats.scheduledPeriodsToday}
              <span className="text-xs text-slate-500 font-normal ml-2">
                Periods on {teacherSummary?.todayDay || 'Today'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {quickStats.completedPeriodsToday} completed • {Math.max(0, quickStats.scheduledPeriodsToday - quickStats.completedPeriodsToday)} upcoming
            </p>
          </div>
        </div>

        {/* Card 4: Pending Marks & Tasks */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Pending Tasks</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {quickStats.pendingMarksCount}
              <span className="text-xs text-slate-500 font-normal ml-2">
                Marks entries
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Leave balance: <strong className="text-slate-800">{leaveSummary.remainingBalance} days</strong> remaining
            </p>
          </div>
        </div>
      </div>

      {/* ACTIONABLE TASKS & DEADLINES SECTION */}
      {actionableTasks.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-amber-200/80">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <h2 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Action Items & Tasks ({actionableTasks.length})
              </h2>
            </div>
            <span className="text-[11px] text-amber-800 font-medium hidden sm:inline">Requires your immediate action</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {actionableTasks.map((task: any) => (
              <div
                key={task.id}
                className="p-3.5 rounded-xl bg-white border border-amber-200/80 shadow-2xs flex flex-col justify-between gap-2.5 hover:border-amber-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="font-bold text-xs text-slate-900 truncate">{task.title}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                        task.urgency === 'HIGH'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {task.urgency}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2">{task.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate(task.module)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer pt-1"
                >
                  <span>Resolve Task</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: TWO COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left 8 Cols: Today's Timetable & Assigned Classes Attendance */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-5">
          {/* A. TODAY'S TIMETABLE WIDGET */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Today's Schedule — {teacherSummary?.todayDay || 'Today'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Personalized periods, subjects, and classroom assignments
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('timetable')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                <span>Full Timetable</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayTimetable.length > 0 ? (
              <div className="space-y-2.5">
                {todayTimetable.map((slot: any, idx: number) => {
                  const isCompleted = slot.status === 'COMPLETED';
                  const isActive = slot.status === 'ACTIVE';

                  return (
                    <div
                      key={slot.id || idx}
                      className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        isActive
                          ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-2 ring-blue-500/10'
                          : isCompleted
                          ? 'bg-slate-50/60 border-slate-200 text-slate-500 opacity-80'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isActive
                              ? 'bg-blue-700 text-white'
                              : isCompleted
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          P{slot.periodNumber}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                              {slot.subjectName}
                            </h3>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-blue-700 text-white animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                Ongoing Period
                              </span>
                            )}
                            {isCompleted && (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                                Completed
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-800">
                              {slot.className} - Section {slot.section}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {slot.roomNumber || 'Room 204'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-slate-800">
                            {slot.startTime} - {slot.endTime}
                          </div>
                          <div className="text-[10px] text-slate-400">45 minutes</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No periods scheduled for today</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Check your weekly timetable or verify assignments with the administration.
                </p>
              </div>
            )}
          </div>

          {/* B. ASSIGNED CLASSES & ATTENDANCE REGISTER */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    My Classes — Today's Attendance Register
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Daily student attendance status for your authorized classes
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('attendance')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <span>Attendance Hub</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {assignedClasses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assignedClasses.map((ac: any, idx: number) => {
                  const isMarked = ac.attendance?.isMarked;
                  const att = ac.attendance || {};

                  return (
                    <div
                      key={`${ac.classId}-${ac.section}-${idx}`}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                        isMarked
                          ? 'bg-slate-50/50 border-slate-200'
                          : 'bg-amber-50/40 border-amber-300 shadow-2xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-slate-900">
                                {ac.className} - Section {ac.section}
                              </h3>
                              {ac.isClassTeacher && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Class Teacher
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Enrolled: <strong>{ac.studentCount} active students</strong>
                            </p>
                            {Array.isArray(ac.subjects) && ac.subjects.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {ac.subjects.map((sub: string, sIdx: number) => (
                                  <span
                                    key={sIdx}
                                    className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200/80"
                                  >
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isMarked
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                            }`}
                          >
                            {isMarked ? '✓ Marked' : '⚠ Pending'}
                          </span>
                        </div>

                        {isMarked ? (
                          <div className="grid grid-cols-4 gap-1.5 my-2.5 p-2 rounded-lg bg-white border border-slate-100 text-center text-[10px]">
                            <div>
                              <span className="text-slate-400 block">Present</span>
                              <strong className="text-emerald-700 font-bold">{att.present || 0}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Absent</span>
                              <strong className="text-rose-700 font-bold">{att.absent || 0}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Late</span>
                              <strong className="text-amber-700 font-bold">{att.late || 0}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Leave</span>
                              <strong className="text-blue-700 font-bold">{att.leave || 0}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="my-2 p-2 rounded-lg bg-amber-100/60 text-amber-900 text-[11px]">
                            Attendance has not been recorded for this section today.
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => onNavigate('attendance')}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2 ${
                          isMarked
                            ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            : 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-2xs'
                        }`}
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>{isMarked ? 'Update Attendance' : 'Take Attendance Now'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No classes assigned yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Contact the school administrator to configure your assigned classes & sections.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 4 Cols: Exams & Marks Tasks, School Circulars, Leave Balance */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-5">
          {/* A. PENDING MARKS ENTRIES & EXAMS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-bold text-slate-900">Pending Marks Entry</h2>
              </div>
              <button
                onClick={() => onNavigate('exams')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                Enter Marks →
              </button>
            </div>

            {pendingMarksTasks.length > 0 ? (
              <div className="space-y-2.5">
                {pendingMarksTasks.map((task: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{task.examTitle}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                        {task.missingCount > 0 ? `${task.missingCount} Missing` : 'Draft'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
                      <span>{task.className} - {task.section} ({task.subjectName})</span>
                      <span className="font-mono text-slate-500">
                        {task.enteredCount}/{task.totalStudents} entered
                      </span>
                    </div>
                    <button
                      onClick={() => onNavigate('exams')}
                      className="mt-2 text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <span>Complete Entry</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : upcomingExams.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-[11px] text-slate-500 mb-2">Upcoming Scheduled Examinations:</p>
                {upcomingExams.map((ex: any) => (
                  <div
                    key={ex.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{ex.name || ex.title}</span>
                      <span className="px-2 py-0.2 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold">
                        {ex.examType || 'Term Exam'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">
                      Date: <strong className="text-slate-800">{ex.startDate}</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Venue: {ex.venue}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                <FileCheck className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                No pending marks entries or examinations
              </div>
            )}
          </div>

          {/* B. RECENT SCHOOL NOTICES & CIRCULARS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">School Notices</h2>
              </div>
              <button
                onClick={() => onNavigate('communication')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                All Circulars →
              </button>
            </div>

            {recentNotices.length > 0 ? (
              <div className="space-y-2.5">
                {recentNotices.map((n: Notice) => (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 text-xs transition-colors"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-slate-900 line-clamp-1">{n.title}</span>
                      {n.priority === 'URGENT' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 shrink-0">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                      {n.content}
                    </p>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>{n.publishedDate}</span>
                      <span className="font-medium text-slate-600">
                        To: {n.targetAudience}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-xl text-xs text-slate-500">
                No active announcements
              </div>
            )}
          </div>

          {/* C. LEAVE BALANCE & PROFILE STATUS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">Leave & Profile</h2>
              </div>
              <button
                onClick={() => onNavigate('profile')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                Apply Leave →
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Available Leave Balance:</span>
                <strong className="text-slate-900 font-bold text-sm">
                  {leaveSummary.remainingBalance} Days
                </strong>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Approved Leaves Taken:</span>
                <span className="font-medium text-slate-700">
                  {leaveSummary.totalApprovedDays || 0} Days
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Pending Leave Requests:</span>
                <span className={`font-semibold ${
                  leaveSummary.pendingRequests > 0 ? 'text-amber-600' : 'text-slate-500'
                }`}>
                  {leaveSummary.pendingRequests || 0}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('profile')}
              className="w-full mt-3 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Manage Profile, Leave & Salary</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
