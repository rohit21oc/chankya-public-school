import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Check,
  RefreshCw,
  CalendarCheck,
  Award,
  BookOpen,
  CalendarOff,
  Sparkles,
} from 'lucide-react';
import {
  AttendanceRecord,
  Holiday,
  SchoolSettings,
  Student,
  User,
} from '../../types';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { AttendanceCalendar } from '../common/AttendanceCalendar';
import { fileUploadService } from '../../services/fileUploadService';
import { classLabel, classSectionLabel } from '../../utils/classLabel';

interface ParentAttendanceViewProps {
  currentUser?: User;
  settings?: SchoolSettings;
  onNavigate?: (module: string) => void;
}

export const ParentAttendanceView: React.FC<ParentAttendanceViewProps> = ({
  currentUser: propUser,
  settings: propSettings,
  onNavigate,
}) => {
  const user = propUser || authService.getCurrentUser() || authService.getStoredUser();
  const settings = propSettings || api.getSettings();

  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [parentChildren, setParentChildren] = useState<Student[]>([]);
  const [activeChildId, setActiveChildId] = useState<string>('');

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>(() => api.getHolidays());

  // Real-time listener for attendance updates and holiday changes
  useRealtimeListener(['ATTENDANCE', 'HOLIDAY', 'STUDENT'], () => {
    if (activeChildId) {
      loadChildAttendance(activeChildId, true);
    }
  });

  const loadInitialChildren = useCallback(() => {
    const cachedStudents = api.getStudents();
    const linkedIds = user?.linkedStudentIds || [];
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

  const loadChildAttendance = async (childId: string, isSilent = false) => {
    if (!childId) return;
    if (!isSilent) setSyncing(true);

    try {
      // 1. Fetch authoritative student calendar endpoint
      const calendarData = await api.fetchStudentCalendar(childId);
      if (calendarData && Array.isArray(calendarData.records)) {
        setAttendanceRecords(calendarData.records);
        if (calendarData.holidays && Array.isArray(calendarData.holidays)) {
          setHolidays(calendarData.holidays);
        }
      } else {
        // Fallback to cached attendance records
        const cached = api.getAttendance();
        setAttendanceRecords(cached.filter((a) => a.studentId === childId));
        setHolidays(api.getHolidays());
      }
    } catch (err) {
      console.warn('[ParentAttendanceView] Error loading attendance:', err);
      const cached = api.getAttendance();
      setAttendanceRecords(cached.filter((a) => a.studentId === childId));
    } finally {
      setSyncing(false);
    }
  };

  const refreshChildrenAndAttendance = async () => {
    setLoading(true);
    try {
      const serverChildren = await api.fetchLinkedChildren();
      let childrenList: Student[] = [];
      if (Array.isArray(serverChildren) && serverChildren.length > 0) {
        childrenList = serverChildren;
      } else {
        childrenList = loadInitialChildren();
      }

      setParentChildren(childrenList);

      const resolvedActiveId =
        (activeChildId && childrenList.some((c) => c.id === activeChildId) ? activeChildId : null) ||
        (user?.activeStudentId && childrenList.some((c) => c.id === user.activeStudentId)
          ? user.activeStudentId
          : null) ||
        (childrenList[0]?.id || '');

      setActiveChildId(resolvedActiveId);
      if (resolvedActiveId) {
        await loadChildAttendance(resolvedActiveId);
      }
    } catch (err) {
      console.warn('[ParentAttendanceView] Error refreshing children:', err);
      const fallback = loadInitialChildren();
      setParentChildren(fallback);
      if (fallback.length > 0) {
        const fallbackId = fallback[0].id;
        setActiveChildId(fallbackId);
        await loadChildAttendance(fallbackId);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshChildrenAndAttendance();
  }, []);

  const handleSelectChild = async (childId: string) => {
    if (childId === activeChildId) return;
    setActiveChildId(childId);
    // Clear stale attendance records to prevent stale state display
    setAttendanceRecords([]);

    try {
      await authService.switchChild(childId);
      await loadChildAttendance(childId);
    } catch (e) {
      console.warn('[ParentAttendanceView] Error switching child:', e);
      await loadChildAttendance(childId);
    }
  };

  const selectedChild = useMemo(() => {
    if (!activeChildId) return parentChildren[0] || null;
    return parentChildren.find((c) => c.id === activeChildId) || parentChildren[0] || null;
  }, [parentChildren, activeChildId]);

  // Comprehensive attendance statistics for selected child
  const attendanceMetrics = useMemo(() => {
    if (!selectedChild) {
      return {
        percentage: 0,
        totalWorkingDays: 0,
        presentDays: 0,
        absentDays: 0,
        leaveDays: 0,
        lateDays: 0,
        holidaysCount: holidays.length,
      };
    }

    // Filter records for this student
    const studentRecords = attendanceRecords.filter((a) => a.studentId === selectedChild.id);

    let present = 0;
    let absent = 0;
    let leave = 0;
    let late = 0;

    studentRecords.forEach((r) => {
      const st = (r.status || '').toUpperCase();
      if (st === 'PRESENT') present++;
      else if (st === 'ABSENT') absent++;
      else if (st === 'LEAVE' || st === 'HALF_DAY' || st === 'EXCUSED_LEAVE') leave++;
      else if (st === 'LATE') {
        present++;
        late++;
      }
    });

    const totalWorkingDays = present + absent + leave;
    const percentage = totalWorkingDays > 0 ? Math.round((present / totalWorkingDays) * 100) : 0;

    return {
      percentage,
      totalWorkingDays,
      presentDays: present,
      absentDays: absent,
      leaveDays: leave,
      lateDays: late,
      holidaysCount: holidays.length,
    };
  }, [selectedChild, attendanceRecords, holidays]);

  if (loading && parentChildren.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl border border-slate-200 p-8">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <h3 className="text-sm font-bold text-slate-800">Loading Attendance Records</h3>
        <p className="text-xs text-slate-500 mt-1">Loading attendance…</p>
      </div>
    );
  }

  if (!loading && parentChildren.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">No Linked Children Found</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No registered student records are linked to your parent contact number ({user?.phone || 'Registered Phone'}).
          </p>
        </div>
        <button
          onClick={() => refreshChildrenAndAttendance()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Database</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. TOP BANNER & CONTEXT */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold">
              <CalendarCheck className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  {user?.role === 'STUDENT' ? 'STUDENT PORTAL' : 'PARENT PORTAL'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Read-Only Verified Attendance
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                Student Attendance Calendar
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                CHANAKYA PUBLIC SCHOOL & COACHING CENTRE • Attendance Benchmark 75%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeChildId) loadChildAttendance(activeChildId);
                else refreshChildrenAndAttendance();
              }}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Attendance'}</span>
            </button>
          </div>
        </div>

        {/* 2. SIBLINGS / MULTI-CHILD SWITCHER */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700" />
              <span className="text-xs font-bold text-slate-900">
                {user?.role === 'STUDENT' ? 'My Attendance' : `Select Sibling to View Attendance (${parentChildren.length} Linked)`}
              </span>
            </div>
            {user?.role !== 'STUDENT' && (
              <span className="text-[11px] text-slate-500">
                Click to view student-specific attendance calendar
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {parentChildren.map((child) => {
              const isSelected = selectedChild?.id === child.id;
              const rawPhoto = child.photo || child.photoFileKey || (child as any).avatar || '';
              const photoSrc = rawPhoto ? fileUploadService.getFileUrl(rawPhoto) : '';

              return (
                <button
                  key={child.id}
                  onClick={() => handleSelectChild(child.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-200 hover:bg-slate-50 bg-white'
                  }`}
                >
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    {photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={child.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-blue-800 text-sm bg-blue-100">
                        {child.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{child.name}</h4>
                    <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                      {child.className} • Section {child.section || 'A'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 font-mono">
                      <span>Adm: {child.admissionNumber}</span>
                      <span>• Roll: {child.rollNumber || 'N/A'}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedChild && (
        <>
          {/* 3. SELECTED CHILD PARTICULARS & ATTENDANCE METRICS STRIP */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs">
                  {(() => {
                    const rawPhoto =
                      selectedChild.photo || selectedChild.photoFileKey || (selectedChild as any).avatar || '';
                    const photoSrc = rawPhoto ? fileUploadService.getFileUrl(rawPhoto) : '';
                    return photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={selectedChild.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-black text-xl text-blue-800 bg-blue-100">
                        {selectedChild.name.slice(0, 2).toUpperCase()}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {selectedChild.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-100 text-blue-800">
                      {selectedChild.admissionNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {classLabel(selectedChild.className)}{selectedChild.section ? ` (${selectedChild.section})` : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-2">
                    <span>
                      Roll No: <strong className="font-mono text-slate-900">{selectedChild.rollNumber || 'N/A'}</strong>
                    </span>
                    <span>
                      Session:{' '}
                      <strong className="text-slate-900">
                        {selectedChild.academicSession || settings.currentAcademicSession || '2026-2027'}
                      </strong>
                    </span>
                    <span>
                      Status:{' '}
                      <strong className="text-emerald-700 font-bold">{selectedChild.status || 'ACTIVE'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Attendance Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Attendance Rate
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <strong
                      className={`text-xl font-black font-mono ${
                        attendanceMetrics.percentage >= 75
                          ? 'text-emerald-700'
                          : attendanceMetrics.percentage >= 60
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {attendanceMetrics.percentage}%
                    </strong>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {attendanceMetrics.percentage >= 75 ? 'Meets 75% Req' : 'Below 75%'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Days Present
                  </span>
                  <strong className="text-xl font-black text-emerald-950 font-mono mt-0.5 block">
                    {attendanceMetrics.presentDays}
                  </strong>
                  <span className="text-[10px] text-emerald-600 block">Of {attendanceMetrics.totalWorkingDays} Working Days</span>
                </div>

                <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                    Days Absent
                  </span>
                  <strong className="text-xl font-black text-rose-950 font-mono mt-0.5 block">
                    {attendanceMetrics.absentDays}
                  </strong>
                  <span className="text-[10px] text-rose-600 block">Recorded absences</span>
                </div>

                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                    School Holidays
                  </span>
                  <strong className="text-xl font-black text-purple-950 font-mono mt-0.5 block">
                    {attendanceMetrics.holidaysCount}
                  </strong>
                  <span className="text-[10px] text-purple-600 block">Gazetted & School</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. INTEGRATED ATTENDANCE CALENDAR COMPONENT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Month-by-Month Attendance Register</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing verified daily attendance for {selectedChild.name} ({classSectionLabel(selectedChild.className, selectedChild.section)})
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Authoritative Records</span>
                </span>
              </div>
            </div>

            {/* Reused AttendanceCalendar component from Student Profile */}
            <AttendanceCalendar
              type="STUDENT"
              studentId={selectedChild.id}
              studentName={selectedChild.name}
              records={attendanceRecords.filter((a) => a.studentId === selectedChild.id)}
              holidays={holidays}
              readOnly={true}
            />

            {/* Truthful Note when records are empty */}
            {attendanceRecords.filter((a) => a.studentId === selectedChild.id).length === 0 && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-center">
                <AlertCircle className="w-4 h-4 text-slate-400 inline-block mr-1.5 align-middle" />
                <span>
                  No attendance records logged for {selectedChild.name} in this session yet. Official daily class rosters marked by teachers will be reflected here dynamically.
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
