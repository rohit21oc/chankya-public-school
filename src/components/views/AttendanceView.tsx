import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Megaphone,
  Save,
  Send,
  UserCheck,
  Users,
  XCircle,
  Calendar,
  CalendarOff,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit,
  FileText,
  FileCheck,
  Printer,
  Download,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  Search,
  Loader2,
  X,
  ShieldCheck,
  ScanLine,
} from 'lucide-react';
import {
  AcademicClass,
  AttendanceRecord,
  Holiday,
  SchoolSettings,
  StaffAttendanceRecord,
  StaffLeave,
  Student,
  TeacherStaff,
  User,
} from '../../types';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { getFileContentUrl } from '../../services/apiConfig';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import {
  buildAttendanceRegisterModel,
  createAttendanceRegisterPdf,
  attendanceRegisterFileName,
  printPdfBlob,
} from '../../utils/attendanceRegisterPdf';
import { getLogoBase64Async } from '../../utils/receiptPdfExporter';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { AttendanceCalendar } from '../common/AttendanceCalendar';
import { hasPermission } from '../../utils/rbac';
import { ParentAttendanceView } from '../parent/ParentAttendanceView';
import { IdCardScanModal } from '../attendance/IdCardScanModal';
import { StudentCalendarPicker } from '../attendance/StudentCalendarPicker';
import { PersonAvatar } from '../common/PersonAvatar';
import { canMarkStaffAttendance } from '../../constants/staffRoles';
import { isWeekOff, workingDaySet } from '../../utils/workingDays';

/** Current time in India as "hh:mm AM" (the format the register uses). */
const indiaTimeNow = (): string =>
  new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
import type { IdCardKind, ScanResult } from '../../services/idCardQrService';

interface AttendanceViewProps {
  currentUser?: User;
  settings?: SchoolSettings;
}

type AttendanceTab =
  | 'DAILY' // Mark Daily
  | 'REGISTER' // Monthly Register
  | 'LEDGER' // Student Ledger
  | 'STAFF' // Staff Attendance
  | 'LEAVES' // Leave Requests
  | 'HOLIDAYS'; // School Holidays

export const AttendanceView: React.FC<AttendanceViewProps> = ({ currentUser: propUser, settings: propSettings }) => {
  const activeUser = propUser || authService.getStoredUser() || {
    id: 'admin',
    name: 'Administrator',
    role: 'SUPER_ADMIN',
  };

  // Parents see their child's attendance, students see their own: never the teacher's marking screen.
  if (activeUser.role === 'PARENT' || activeUser.role === 'STUDENT') {
    return (
      <ParentAttendanceView
        currentUser={activeUser}
        settings={propSettings}
      />
    );
  }

  const isTeacher = activeUser.role === 'TEACHER';
  const isAdmin = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN'].includes(activeUser.role);
  // Only the Super Admin and the Principal mark staff attendance (the server enforces the same rule).
  const canManageStaffAttendance = canMarkStaffAttendance(activeUser.role);
  const canEditAttendance = hasPermission(activeUser, 'attendance.edit') || isAdmin;
  // Same roles the server accepts for scan-to-mark (it re-checks every scan).
  const canScanStudents = isTeacher || isAdmin || activeUser.role === 'ACADEMIC_COORDINATOR';
  const [scanKind, setScanKind] = useState<IdCardKind | null>(null);

  const [activeTab, setActiveTab] = useState<AttendanceTab>('DAILY');

  // Teacher assigned classes state
  const [assignedClassesData, setAssignedClassesData] = useState<{
    allAccess: boolean;
    classes: { classId: string; className: string; sections: string[] }[];
    defaultClassId?: string;
    defaultSection?: string;
    teacherId?: string;
    teacherName?: string;
    classTeacherOf?: string;
  }>({
    allAccess: !isTeacher,
    classes: [],
  });

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [holidaysList, setHolidaysList] = useState<Holiday[]>(() => api.getHolidays());

  const loadHolidays = () => {
    api.fetchHolidays().then((h) => setHolidaysList(h));
  };

  useEffect(() => {
    loadHolidays();
  }, [refreshTrigger]);

  // Live real-time sync for attendance records, staff leaves, teacher assignments & holidays
  useRealtimeListener(['ATTENDANCE', 'STAFF_ATTENDANCE', 'STAFF_LEAVE', 'HOLIDAY', 'STUDENT', 'TEACHER', 'STAFF', 'CLASS'], () => {
    setRefreshTrigger((prev) => prev + 1);
  });

  // Load teacher assigned classes dynamically from backend
  useEffect(() => {
    let isMounted = true;
    api.getAssignedClassesForAttendance('incharge').then((res) => {
      if (!isMounted) return;
      setAssignedClassesData(res);
      if (res.classes.length > 0) {
        if (isTeacher) {
          // Strictly default to teacher's assigned class & section
          const targetClassId = res.defaultClassId || res.classes[0].classId;
          const matchedClass = res.classes.find((c) => c.classId === targetClassId) || res.classes[0];
          const targetSection = res.defaultSection || matchedClass.sections[0] || 'A';
          setSelectedClassId(matchedClass.classId);
          setSelectedSection(targetSection);
        } else {
          // Admin role: maintain selection if valid, otherwise use default
          setSelectedClassId((prev) => {
            if (!prev || !res.classes.some((c) => c.classId === prev)) {
              return res.defaultClassId || res.classes[0].classId;
            }
            return prev;
          });
          setSelectedSection((prev) => {
            const currentCls = res.classes.find((c) => c.classId === (selectedClassId || res.classes[0].classId));
            if (!currentCls || !currentCls.sections.includes(prev)) {
              return currentCls?.sections[0] || 'A';
            }
            return prev;
          });
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activeUser.id, activeUser.role, isTeacher, refreshTrigger]);

  // Available classes for dropdown based on assigned permissions
  const availableClasses = useMemo(() => {
    if (assignedClassesData.allAccess) {
      return api
        .getActiveClasses()
        .map((c) => ({
          classId: c.id,
          className: c.name,
          sections:
            c.detailedSections && c.detailedSections.length > 0
              ? c.detailedSections.filter((ds) => (ds.status || 'ACTIVE') === 'ACTIVE').map((ds) => ds.name)
              : c.sections || ['A'],
        }));
    }
    return assignedClassesData.classes;
  }, [assignedClassesData]);

  // Available sections for current selected class
  const availableSections = useMemo(() => {
    const matched = availableClasses.find((c) => c.classId === selectedClassId);
    return matched ? matched.sections : ['A', 'B', 'C'];
  }, [availableClasses, selectedClassId]);

  // Check if selected date is an official school holiday
  const currentHoliday = useMemo(() => {
    return api.isHoliday(selectedDate);
  }, [selectedDate, refreshTrigger]);

  // Sync students from MongoDB whenever class changes or on refresh
  useEffect(() => {
    if (selectedClassId) {
      api.syncStudents();
    }
  }, [selectedClassId, refreshTrigger]);

  // Students enrolled in selected class & section
  const enrolledStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const matchedClass = availableClasses.find((c) => c.classId === selectedClassId);
    const targetClassName = matchedClass?.className?.toLowerCase();

    return api
      .getStudents()
      .filter((s) => {
        if (s.status && s.status !== 'ACTIVE') return false;
        const classMatch =
          s.classId === selectedClassId ||
          (targetClassName &&
            (s.classId?.toLowerCase() === targetClassName || s.className?.toLowerCase() === targetClassName));
        if (!classMatch) return false;
        const studentSec = (s.section || 'A').trim().toUpperCase();
        const targetSec = (selectedSection || 'A').trim().toUpperCase();
        return studentSec === targetSec;
      })
      .sort((a, b) => {
        const rollA = parseInt(a.rollNumber || '0', 10);
        const rollB = parseInt(b.rollNumber || '0', 10);
        if (!isNaN(rollA) && !isNaN(rollB) && rollA !== rollB) {
          return rollA - rollB;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [selectedClassId, selectedSection, availableClasses, refreshTrigger]);

  // Local student attendance status map for Mark Daily
  const [studentStatusMap, setStudentStatusMap] = useState<
    Record<string, { id?: string; status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE' | 'NOT_MARKED' | 'HOLIDAY'; remarks: string }>
  >({});

  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Records already saved on the server for this class and day (from the register or ID card scans).
  const [savedStudentRecords, setSavedStudentRecords] = useState<Record<string, { status: string; remarks: string }>>({});

  // Saving is a correction only when it changes an already saved record. Students who are
  // still unmarked (for example the ones not scanned yet) can be added without correction rights.
  const changesSavedRecord = useMemo(() => {
    if (currentHoliday) return false;
    return (Object.entries(savedStudentRecords) as [string, { status: string; remarks: string }][]).some(([sid, saved]) => {
      const now = studentStatusMap[sid];
      if (!now) return false;
      return now.status !== saved.status || (now.remarks || '') !== (saved.remarks || '');
    });
  }, [currentHoliday, savedStudentRecords, studentStatusMap]);

  // Sync attendance records from server whenever class, section, or date changes
  useEffect(() => {
    if (!selectedClassId || !selectedSection || !selectedDate) return;

    let isCancelled = false;
    setIsLoadingAttendance(true);

    api
      .fetchAttendance({ classId: selectedClassId, section: selectedSection, date: selectedDate })
      .then((records) => {
        if (isCancelled) return;
        const newMap: Record<string, { id?: string; status: any; remarks: string }> = {};
        const saved: Record<string, { status: string; remarks: string }> = {};

        // If today is a school holiday, default all to HOLIDAY
        const holidayToday = api.isHoliday(selectedDate);

        enrolledStudents.forEach((st) => {
          const found = records.find((r) => r.studentId === st.id);
          if (found) {
            newMap[st.id] = {
              id: found.id,
              status: found.status as any,
              remarks: found.remarks || '',
            };
            saved[st.id] = { status: String(found.status), remarks: found.remarks || '' };
          } else if (holidayToday) {
            newMap[st.id] = {
              status: 'HOLIDAY',
              remarks: holidayToday.name,
            };
          } else {
            newMap[st.id] = {
              status: 'NOT_MARKED',
              remarks: '',
            };
          }
        });
        setStudentStatusMap(newMap);
        setSavedStudentRecords(saved);
      })
      .catch((err) => {
        console.warn('[Attendance] Error fetching attendance:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingAttendance(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedClassId, selectedSection, selectedDate, enrolledStudents.length, refreshTrigger]);

  // Bulk Actions
  const handleBulkStatus = (targetStatus: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE') => {
    if (currentHoliday) {
      setAlertMessage({
        type: 'warning',
        text: `Cannot mark status: "${selectedDate}" is an official school holiday (${currentHoliday.name}).`,
      });
      return;
    }
    const nextMap = { ...studentStatusMap };
    enrolledStudents.forEach((st) => {
      nextMap[st.id] = {
        status: targetStatus,
        remarks: nextMap[st.id]?.remarks || '',
      };
    });
    setStudentStatusMap(nextMap);
  };

  // Toggle individual status
  const handleToggleStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE') => {
    if (currentHoliday) {
      setAlertMessage({
        type: 'warning',
        text: `Selected date is a school holiday (${currentHoliday.name}). Attendance cannot be marked.`,
      });
      return;
    }
    setStudentStatusMap((prev) => ({
      ...prev,
      [studentId]: {
        status,
        remarks: prev[studentId]?.remarks || '',
      },
    }));
  };

  const handleStudentRemarkChange = (studentId: string, remarks: string) => {
    setStudentStatusMap((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || 'NOT_MARKED',
        remarks,
      },
    }));
  };

  // A scan was recorded on the server: show it in the open register without discarding other unsaved edits.
  const handleScanMarked = (r: ScanResult) => {
    if (!r.person) return;
    const pid = r.person.id;
    if (r.kind === 'STUDENT' && r.date === selectedDate && enrolledStudents.some((st) => st.id === pid)) {
      setStudentStatusMap((prev) => ({ ...prev, [pid]: { ...prev[pid], status: (r.status as any) || 'PRESENT', remarks: r.alreadyMarked ? prev[pid]?.remarks || '' : `ID card scan at ${r.time || ''}`.trim() } }));
      if (!r.alreadyMarked) {
        setSavedStudentRecords((prev) => ({ ...prev, [pid]: { status: String(r.status || 'PRESENT'), remarks: `ID card scan at ${r.time || ''}`.trim() } }));
      }
    }
    if (r.kind === 'STAFF' && r.date === staffDate && !r.alreadyMarked) {
      setStaffStatusMap((prev) => ({
        ...prev,
        [pid]: {
          ...(prev[pid] || { outTime: '' }),
          status: String(r.status || 'PRESENT'),
          remarks: `ID card scan at ${r.time || ''}`.trim(),
          inTime: r.time || prev[pid]?.inTime || '',
          outTime: (r as any).checkOutTime || prev[pid]?.outTime || dispersalTime,
        },
      }));
    }
  };

  // Save Attendance to MongoDB
  const handleSaveAttendance = async () => {
    if (enrolledStudents.length === 0) {
      setAlertMessage({ type: 'warning', text: 'No students enrolled in this section to save.' });
      return;
    }

    if (currentHoliday) {
      setAlertMessage({
        type: 'error',
        text: `Cannot save regular attendance: ${selectedDate} is marked as an official school holiday: "${currentHoliday.name}".`,
      });
      return;
    }

    if (changesSavedRecord && !canEditAttendance) {
      setAlertMessage({
        type: 'error',
        text: 'Forbidden: You do not have authorization to make attendance corrections.',
      });
      return;
    }

    setIsSavingAttendance(true);
    setAlertMessage(null);

    // Only explicitly marked students are saved. Unmarked students stay unmarked.
    const payloadRecords = enrolledStudents
      .filter((st) => {
        const s = studentStatusMap[st.id]?.status;
        return s === 'PRESENT' || s === 'ABSENT' || s === 'LEAVE' || s === 'LATE';
      })
      .map((st) => {
        const entry = studentStatusMap[st.id];
        return {
          id: entry?.id || undefined,
          studentId: st.id,
          studentName: st.name,
          rollNumber: st.rollNumber,
          status: entry.status,
          remarks: entry?.remarks || '',
        };
      });

    if (payloadRecords.length === 0) {
      setIsSavingAttendance(false);
      setAlertMessage({ type: 'error', text: 'Mark at least one student as Present, Absent, Leave or Late before saving.' });
      return;
    }

    const res = await api.saveAttendanceAsync({
      classId: selectedClassId,
      section: selectedSection,
      date: selectedDate,
      records: payloadRecords,
    });

    setIsSavingAttendance(false);

    if (res.success) {
      setAlertMessage({
        type: 'success',
        text: `Attendance register for ${selectedDate} saved (${res.count} students recorded).`,
      });
      // Re-fetch to ensure sync
      api.fetchAttendance({ classId: selectedClassId, section: selectedSection, date: selectedDate });
    } else {
      setAlertMessage({
        type: 'error',
        text: res.error || 'Failed to save attendance. Please verify permissions.',
      });
    }
  };

  // Metrics calculation
  const stats = useMemo(() => {
    let p = 0;
    let a = 0;
    let l = 0;
    let lt = 0;
    let nm = 0;
    let h = 0;

    enrolledStudents.forEach((st) => {
      const s = studentStatusMap[st.id]?.status;
      if (s === 'PRESENT') p++;
      else if (s === 'ABSENT') a++;
      else if (s === 'LEAVE') l++;
      else if (s === 'LATE') {
        lt++;
        p++;
      } else if (s === 'HOLIDAY') h++;
      else nm++;
    });

    const total = enrolledStudents.length;
    const pct = total > 0 && total !== nm ? ((p / (total - h - nm || 1)) * 100).toFixed(1) : '100';

    return { total, present: p, absent: a, leave: l, late: lt, notMarked: nm, holiday: h, percentage: pct };
  }, [enrolledStudents, studentStatusMap]);

  // =========================================================================
  // MONTHLY REGISTER TAB STATE & PRINT CONFIG
  // =========================================================================
  const activeSchoolSettings = propSettings || api.getSettings();
  // Weekly offs = weekdays not ticked in School Working Days (Timetable settings), not always Sunday.
  const weekOffSet = workingDaySet((activeSchoolSettings as any)?.workingDays);
  const isWeekOffDay = (y: number, m: number, d: number) =>
    isWeekOff(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, weekOffSet);
  const schoolName = activeSchoolSettings?.schoolName || 'Chanakya Public School & Coaching Centre';
  const schoolLogoSrc = getSchoolLogoSrc(activeSchoolSettings?.schoolLogo);
  const schoolAddress = activeSchoolSettings?.schoolAddress || '';
  const affiliationNumber = activeSchoolSettings?.affiliationNumber || activeSchoolSettings?.affiliationCode || '';
  const affiliatedBoard = activeSchoolSettings?.affiliatedBoard || '';

  const selectedClassObj = availableClasses.find((c) => c.classId === selectedClassId);
  const currentClassName = selectedClassObj?.className || (selectedClassId ? `Class ${selectedClassId}` : 'All Classes');

  const printDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const [registerMonth, setRegisterMonth] = useState<number>(new Date().getMonth());
  const [registerYear, setRegisterYear] = useState<number>(new Date().getFullYear());
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const daysInRegisterMonth = new Date(registerYear, registerMonth + 1, 0).getDate();

  // All attendance records for register
  const monthlyClassAttendance = useMemo(() => {
    return api.getAttendance(selectedClassId, selectedSection);
  }, [selectedClassId, selectedSection, refreshTrigger]);

  // Complete attendance summary for monthly register: P, A, L, H, NM and %
  const monthlyRegisterStats = useMemo(() => {
    let totalP = 0;
    let totalA = 0;
    let totalL = 0;
    let totalH = 0;
    let totalNM = 0;

    enrolledStudents.forEach((st) => {
      for (let d = 1; d <= daysInRegisterMonth; d++) {
        const dayNum = d;
        const dateStr = `${registerYear}-${String(registerMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const isSun = isWeekOffDay(registerYear, registerMonth, dayNum);

        const holiday = holidaysList.find(
          (hol) => hol.date === dateStr || (hol.endDate && dateStr >= hol.date && dateStr <= hol.endDate)
        );
        const rec = monthlyClassAttendance.find((r) => r.studentId === st.id && r.date === dateStr);

        if (holiday) {
          totalH++;
        } else if (rec?.status === 'PRESENT' || rec?.status === 'LATE') {
          totalP++;
        } else if (rec?.status === 'ABSENT') {
          totalA++;
        } else if (rec?.status === 'LEAVE') {
          totalL++;
        } else if (isSun) {
          // Sunday
        } else {
          totalNM++;
        }
      }
    });

    const markedTotal = totalP + totalA + totalL;
    const overallPercentage = markedTotal > 0 ? `${Math.round((totalP / markedTotal) * 100)}%` : '—';

    return {
      totalStudents: enrolledStudents.length,
      p: totalP,
      a: totalA,
      l: totalL,
      h: totalH,
      nm: totalNM,
      percentage: overallPercentage,
    };
  }, [enrolledStudents, daysInRegisterMonth, registerYear, registerMonth, holidaysList, monthlyClassAttendance]);

  const dayColWidth = useMemo(() => {
    return ((69) / daysInRegisterMonth).toFixed(3);
  }, [daysInRegisterMonth]);

  // Download and Print share one A4 landscape PDF, so both always look the same.
  const [isPreparingRegister, setIsPreparingRegister] = useState<'' | 'download' | 'print'>('');
  const buildRegisterPdf = async () => {
    const model = buildAttendanceRegisterModel(
      enrolledStudents.map((s) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber })),
      monthlyClassAttendance.map((r) => ({ studentId: r.studentId, date: r.date, status: String(r.status) })),
      holidaysList.map((h) => ({ date: h.date, endDate: h.endDate })),
      registerYear,
      registerMonth,
      (activeSchoolSettings as any)?.workingDays
    );
    let logoBase64: string | null = null;
    try {
      logoBase64 = await getLogoBase64Async(activeSchoolSettings as any);
    } catch {
      logoBase64 = null;
    }
    const meta = {
      schoolName,
      schoolAddress,
      affiliationLine: affiliationNumber ? `Affiliation No: ${affiliationNumber}${affiliatedBoard ? ` (${affiliatedBoard})` : ''}` : '',
      className: currentClassName,
      section: selectedSection,
      printDate,
      logoBase64,
    };
    return { doc: createAttendanceRegisterPdf(model, meta), fileName: attendanceRegisterFileName(meta, model) };
  };
  const handleDownloadRegister = async () => {
    if (isPreparingRegister) return;
    setIsPreparingRegister('download');
    try {
      const { doc, fileName } = await buildRegisterPdf();
      doc.save(fileName);
    } catch (err) {
      console.error('[Attendance] Register PDF failed:', err);
      setAlertMessage({ type: 'error', text: 'Could not generate the attendance register PDF. Please try again.' });
    } finally {
      setIsPreparingRegister('');
    }
  };
  const handlePrintRegister = async () => {
    if (isPreparingRegister) return;
    setIsPreparingRegister('print');
    try {
      const { doc } = await buildRegisterPdf();
      await printPdfBlob(doc.output('blob'));
    } catch (err) {
      console.error('[Attendance] Register print failed:', err);
      setAlertMessage({ type: 'error', text: 'Could not prepare the attendance register for printing. Please try again.' });
    } finally {
      setIsPreparingRegister('');
    }
  };

  // =========================================================================
  // STUDENT LEDGER TAB STATE
  // =========================================================================
  const [ledgerStudentId, setLedgerStudentId] = useState<string>('');


  // Students this user may look up: everyone for administrators, only their own classes / sections for a
  // teacher (before, the list showed every student in the school to teachers too).
  // Teachers may view the calendar of every class they teach (marking stays limited to the class they
  // are in charge of), so the picker uses the full teaching assignment, not only the in-charge class.
  const [ledgerScope, setLedgerScope] = useState<{ allAccess: boolean; classes: { classId: string; className: string; sections: string[] }[] }>({
    allAccess: !isTeacher,
    classes: [],
  });
  useEffect(() => {
    if (!isTeacher || activeTab !== 'LEDGER') return;
    let alive = true;
    api.getAssignedClassesForAttendance().then((res) => {
      if (alive) setLedgerScope({ allAccess: res.allAccess, classes: res.classes });
    });
    return () => {
      alive = false;
    };
  }, [isTeacher, activeTab, refreshTrigger]);
  const ledgerClasses = isTeacher && !ledgerScope.allAccess ? ledgerScope.classes : availableClasses;

  // Load the current student list when the tab opens (students added on another computer show up).
  const [ledgerStudentsVersion, setLedgerStudentsVersion] = useState(0);
  useEffect(() => {
    if (activeTab !== 'LEDGER') return;
    let alive = true;
    api
      .syncStudents()
      .then(() => alive && setLedgerStudentsVersion((v) => v + 1))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [activeTab]);

  const ledgerStudentPool = useMemo(() => {
    const all = api.getStudents().filter((s) => !['DELETED', 'ARCHIVED'].includes(String((s as any).status || '').toUpperCase()));
    if (!isTeacher || ledgerScope.allAccess) return all;
    const allowed = new Map<string, Set<string>>(ledgerScope.classes.map((c) => [c.classId, new Set(c.sections.map((x) => String(x).toUpperCase()))]));
    return all.filter((s) => {
      const secs = allowed.get(s.classId);
      return !!secs && (secs.size === 0 || secs.has(String(s.section || '').toUpperCase()));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Recomputed when the tab opens and when the class list loads, since students may arrive after mount.
  }, [isTeacher, ledgerScope, refreshTrigger, activeTab, enrolledStudents, ledgerStudentsVersion]);

  const targetLedgerStudent = useMemo(() => {
    return ledgerStudentPool.find((s) => s.id === ledgerStudentId);
  }, [ledgerStudentId, ledgerStudentPool]);

  useEffect(() => {
    // Default: the first student of the class open on the Daily tab (or of the picker's list).
    if (!ledgerStudentId || !ledgerStudentPool.some((s) => s.id === ledgerStudentId)) {
      const first = enrolledStudents.find((st) => ledgerStudentPool.some((s) => s.id === st.id)) || ledgerStudentPool[0];
      if (first && first.id !== ledgerStudentId) setLedgerStudentId(first.id);
    }
  }, [enrolledStudents, ledgerStudentId, ledgerStudentPool]);

  // Every attendance record of the chosen student from the server (the browser copy holds only the
  // days that were opened, so older months showed as "not marked").
  const [ledgerRecords, setLedgerRecords] = useState<AttendanceRecord[]>([]);
  useEffect(() => {
    if (!ledgerStudentId || activeTab !== 'LEDGER') return;
    let alive = true;
    setLedgerRecords(api.getAttendance().filter((a) => a.studentId === ledgerStudentId));
    api.fetchStudentCalendar(ledgerStudentId).then((d) => {
      if (alive && Array.isArray(d?.records)) setLedgerRecords(d.records as AttendanceRecord[]);
    });
    return () => {
      alive = false;
    };
  }, [ledgerStudentId, activeTab, refreshTrigger]);

  // =========================================================================
  // STAFF ATTENDANCE TAB STATE
  // =========================================================================
  const staffList = api.getStaff();
  const [staffDate, setStaffDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [staffStatusMap, setStaffStatusMap] = useState<
    Record<string, { status: string; remarks: string; inTime: string; outTime: string }>
  >({});
  const [isSavingStaffAtt, setIsSavingStaffAtt] = useState(false);
  // Out time = the school's dispersal time (School Settings → Dispersal / End Time).
  const dispersalTime: string = (() => {
    const st: any = api.getSettings() || {};
    return String(st.schoolTiming?.endTime || st.schoolEndTime || '').trim();
  })();
  /** In / out time for a status: Present / Late → in = now (kept if already set), out = dispersal; others → none. */
  const timesForStatus = (status: string, entry?: { inTime?: string; outTime?: string; status?: string }) => {
    if (status !== 'PRESENT' && status !== 'LATE') return { inTime: '', outTime: '' };
    const keep = entry && (entry.status === 'PRESENT' || entry.status === 'LATE');
    return { inTime: (keep && entry?.inTime) || indiaTimeNow(), outTime: (keep && entry?.outTime) || dispersalTime };
  };

  useEffect(() => {
    let isCancelled = false;
    api.fetchStaffAttendance({ date: staffDate }).then((records) => {
      if (isCancelled) return;
      const map: Record<string, any> = {};
      staffList.forEach((st) => {
        const found = records.find((r) => r.staffId === st.id || r.employeeId === st.employeeId);
        if (found) {
          map[st.id] = {
            status: found.status,
            remarks: found.remarks || '',
            inTime: found.checkInTime || '',
            outTime: found.checkOutTime || '',
          };
        } else {
          // Never preselect: staff stay Unmarked until explicitly marked.
          map[st.id] = {
            status: 'NOT_MARKED',
            remarks: '',
            inTime: '',
            outTime: '',
          };
        }
      });
      setStaffStatusMap(map);
    });
    return () => {
      isCancelled = true;
    };
  }, [staffDate, refreshTrigger]);

  const handleSaveStaffAttendance = async () => {
    if (!isAdmin) {
      setAlertMessage({ type: 'error', text: 'Forbidden: Only administrators and principal can record staff attendance.' });
      return;
    }

    setIsSavingStaffAtt(true);
    setAlertMessage(null);

    const isMarked = (s?: string) => s === 'PRESENT' || s === 'ABSENT' || s === 'LEAVE' || s === 'LATE';
    const payload = staffList
      .filter((st) => isMarked(staffStatusMap[st.id]?.status))
      .map((st) => {
      const entry = staffStatusMap[st.id];
      return {
        staffId: st.id,
        staffName: st.name,
        employeeId: st.employeeId,
        department: st.department || 'ACADEMICS',
        status: entry.status,
        remarks: entry.remarks,
        checkInTime: entry.inTime,
        checkOutTime: entry.outTime,
      };
    });

    if (payload.length === 0) {
      setIsSavingStaffAtt(false);
      setAlertMessage({ type: 'error', text: 'Mark at least one staff member as Present, Absent, Leave or Late before saving.' });
      return;
    }

    const res = await api.saveStaffAttendanceAsync({
      date: staffDate,
      records: payload,
    });

    setIsSavingStaffAtt(false);

    if (res.success) {
      setAlertMessage({
        type: 'success',
        text: `Staff attendance register for ${staffDate} saved (${res.count} staff recorded).`,
      });
    } else {
      setAlertMessage({
        type: 'error',
        text: res.error || 'Failed to save staff attendance.',
      });
    }
  };

  // =========================================================================
  // LEAVE REQUESTS TAB STATE
  // =========================================================================
  const [leavesList, setLeavesList] = useState<StaffLeave[]>([]);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [isApplyLeaveModalOpen, setIsApplyLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'CASUAL' as 'CASUAL' | 'SICK' | 'EARNED' | 'MATERNITY' | 'DUTY',
    startDate: new Date().toISOString().substring(0, 10),
    endDate: new Date().toISOString().substring(0, 10),
    daysCount: 1,
    reason: '',
  });

  const loadLeaves = () => {
    setLeavesList(api.getStaffLeaves());
  };

  useEffect(() => {
    loadLeaves();
  }, [refreshTrigger]);

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.reason.trim()) {
      alert('Please specify a valid official reason for leave.');
      return;
    }

    try {
      await api.applyStaffLeaveAsync({
        staffId: activeUser.id,
        staffName: activeUser.name,
        employeeId: activeUser.employeeId || 'CPS0000',
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        daysCount: Math.max(1, leaveForm.daysCount),
        reason: leaveForm.reason.trim(),
        status: 'PENDING',
      });
      setIsApplyLeaveModalOpen(false);
      setLeaveForm({
        leaveType: 'CASUAL',
        startDate: new Date().toISOString().substring(0, 10),
        endDate: new Date().toISOString().substring(0, 10),
        daysCount: 1,
        reason: '',
      });
      loadLeaves();
      setAlertMessage({ type: 'success', text: 'Leave application submitted successfully. Awaiting administration approval.' });
    } catch (err: any) {
      alert(err.message || 'Failed to submit leave application.');
    }
  };

  const handleUpdateLeaveStatus = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!isAdmin) {
      alert('Forbidden: Only administrators and principal are authorized to approve leaves.');
      return;
    }
    const remarks = prompt(`Enter ${status.toLowerCase()} remarks (optional):`) || undefined;
    try {
      await api.updateStaffLeaveStatusAsync(leaveId, status, activeUser.name, remarks);
      loadLeaves();
      setAlertMessage({ type: 'success', text: `Leave application marked as ${status} successfully.` });
    } catch (err: any) {
      alert(err.message || 'Failed to update leave status.');
    }
  };

  // =========================================================================
  // SCHOOL HOLIDAYS TAB STATE
  // =========================================================================
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: new Date().toISOString().substring(0, 10),
    endDate: '',
    type: 'FESTIVAL' as Holiday['type'],
    description: '',
  });

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name.trim() || !holidayForm.date) {
      alert('Holiday name and date are required.');
      return;
    }

    try {
      if (editingHoliday) {
        await api.updateHoliday(editingHoliday.id, {
          name: holidayForm.name.trim(),
          date: holidayForm.date,
          endDate: holidayForm.endDate || undefined,
          type: holidayForm.type,
          description: holidayForm.description.trim(),
        });
        setAlertMessage({ type: 'success', text: `Holiday "${holidayForm.name}" updated.` });
      } else {
        await api.addHoliday({
          name: holidayForm.name.trim(),
          date: holidayForm.date,
          endDate: holidayForm.endDate || undefined,
          type: holidayForm.type,
          description: holidayForm.description.trim(),
        });
        setAlertMessage({ type: 'success', text: `Holiday "${holidayForm.name}" created.` });
      }

      setIsHolidayModalOpen(false);
      setEditingHoliday(null);
      setHolidayForm({
        name: '',
        date: new Date().toISOString().substring(0, 10),
        endDate: '',
        type: 'FESTIVAL',
        description: '',
      });
      loadHolidays();
    } catch (err: any) {
      alert(err.message || 'Failed to save holiday.');
    }
  };

  const handleDeleteHoliday = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to delete holiday "${name}"?`)) return;
    try {
      await api.deleteHoliday(id);
      loadHolidays();
      setAlertMessage({ type: 'success', text: `Holiday "${name}" deleted successfully.` });
    } catch (err: any) {
      alert(err.message || 'Failed to delete holiday.');
    }
  };

  return (
    <div className="space-y-5 text-xs text-slate-700">
      {isTeacher && assignedClassesData.classes.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
          You are not assigned as Class Incharge of any class, so you cannot mark attendance. Please contact the administrator.
        </div>
      )}
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Attendance System</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Saved records
            </span>
            {isTeacher && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                Teacher Assigned Roster
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-based student classroom rosters, biometric staff punches, leave approval workflows, and school holidays.
          </p>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold gap-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('DAILY')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'DAILY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mark Daily
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REGISTER')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'REGISTER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Register
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LEDGER')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'LEDGER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Student Calendar
          </button>

          {canManageStaffAttendance && (
            <button
              type="button"
              onClick={() => setActiveTab('STAFF')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'STAFF' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Staff Attendance
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('LEAVES')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'LEAVES' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Leave Desk
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HOLIDAYS')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'HOLIDAYS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            School Holidays
          </button>
        </div>
      </div>

      <IdCardScanModal
        open={scanKind !== null}
        kind={scanKind || 'STUDENT'}
        onClose={() => setScanKind(null)}
        onMarked={handleScanMarked}
      />

      {/* Alert Notice */}
      {alertMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            alertMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : alertMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : alertMessage.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{alertMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MARK DAILY ATTENDANCE TAB                                              */}
      {/* ========================================================================= */}
      {activeTab === 'DAILY' && (
        <div className="space-y-4">
          {/* Controls Filter Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl font-semibold text-xs focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                />
              </div>

              {/* Class Selector (Filtered if Teacher) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Class {isTeacher && <span className="text-emerald-700 font-semibold">(Assigned Class Teacher)</span>}
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl font-semibold text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                >
                  {availableClasses.length === 0 ? (
                    <option value="">No Classes Assigned</option>
                  ) : (
                    availableClasses.map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {c.className}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Section Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Section</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl font-semibold text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                >
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulk Action Buttons & Save */}
            <div className="flex flex-wrap items-center gap-2">
              {canScanStudents && (
                <button
                  type="button"
                  onClick={() => setScanKind('STUDENT')}
                  className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  title="Mark today's attendance by scanning student ID cards"
                >
                  <ScanLine className="w-4 h-4" aria-hidden="true" />
                  Scan ID card
                </button>
              )}
              <button
                type="button"
                onClick={() => handleBulkStatus('PRESENT')}
                disabled={Boolean(currentHoliday) || isLoadingAttendance}
                className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
                title="Mark all students as Present"
              >
                All Present
              </button>

              <button
                type="button"
                onClick={() => handleBulkStatus('ABSENT')}
                disabled={Boolean(currentHoliday) || isLoadingAttendance}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 font-bold hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                title="Mark all students as Absent"
              >
                All Absent
              </button>

              <button
                type="button"
                onClick={() => handleBulkStatus('LEAVE')}
                disabled={Boolean(currentHoliday) || isLoadingAttendance}
                className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 font-bold hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                title="Mark all students as Leave"
              >
                All Leave
              </button>

              <button
                type="button"
                onClick={() => handleBulkStatus('LATE')}
                disabled={Boolean(currentHoliday) || isLoadingAttendance}
                className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-100/70 text-amber-900 font-bold hover:bg-amber-200/70 transition-colors cursor-pointer disabled:opacity-50"
                title="Mark all students as Late"
              >
                All Late
              </button>

              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isSavingAttendance || isLoadingAttendance || Boolean(currentHoliday) || (changesSavedRecord && !canEditAttendance)}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                title={changesSavedRecord && !canEditAttendance ? 'Attendance correction is not permitted for your role' : 'Save attendance to database'}
              >
                {isSavingAttendance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Attendance</span>
              </button>
            </div>
          </div>

          {/* School Holiday Notification Banner */}
          {currentHoliday && (
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center gap-3">
              <CalendarOff className="w-5 h-5 text-purple-600 shrink-0" />
              <div>
                <strong className="block text-xs font-bold">Official School Holiday: {currentHoliday.name}</strong>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  {selectedDate} is configured as a school holiday ({currentHoliday.type}). Regular attendance is disabled on holidays.
                </p>
              </div>
            </div>
          )}

          {/* Attendance Correction Mode Banner */}
          {!currentHoliday && Object.keys(savedStudentRecords).length > 0 && (
            <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              canEditAttendance ? 'bg-amber-50/90 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className={`w-4 h-4 shrink-0 ${canEditAttendance ? 'text-amber-700' : 'text-rose-700'}`} />
                <span>
                  {canEditAttendance ? (
                    <>
                      <strong>Saved attendance loaded:</strong> Some or all records for <strong>{selectedDate}</strong> are already saved (from the register or ID card scans). Changing a saved record is logged as a correction.
                    </>
                  ) : (
                    <>
                      <strong>Saved attendance:</strong> Records already saved for <strong>{selectedDate}</strong> cannot be changed with your role. Students who are not marked yet can still be added.
                    </>
                  )}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${
                canEditAttendance ? 'bg-amber-200/80 text-amber-900 border-amber-300' : 'bg-rose-200 text-rose-900 border-rose-300'
              }`}>
                {canEditAttendance ? 'Correction Mode' : 'Correction Restricted'}
              </span>
            </div>
          )}

          {/* Calculated Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Enrolled Students</span>
              <span className="text-xl font-black text-slate-900 font-mono mt-0.5">{stats.total}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-600 block uppercase">Present Today</span>
              <span className="text-xl font-black text-emerald-700 font-mono mt-0.5">{stats.present}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-600 block uppercase">Absent</span>
              <span className="text-xl font-black text-rose-700 font-mono mt-0.5">{stats.absent}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-600 block uppercase">Leave</span>
              <span className="text-xl font-black text-amber-700 font-mono mt-0.5">{stats.leave}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">Not Marked</span>
              <span className="text-xl font-black text-slate-700 font-mono mt-0.5">{stats.notMarked}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-700 block uppercase">Attendance %</span>
              <span className="text-xl font-black text-blue-950 font-mono mt-0.5">{stats.percentage}%</span>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3 w-16 text-center">Roll No</th>
                    <th className="p-3 w-12 text-center">Photo</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Admission No</th>
                    <th className="p-3">Parent Phone</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Remarks</th>
                    <th className="p-3 text-right">Quick Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrolledStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No students enrolled in Class {selectedClassId} Section {selectedSection}.
                      </td>
                    </tr>
                  ) : (
                    enrolledStudents.map((st) => {
                      const entry = studentStatusMap[st.id] || { status: 'NOT_MARKED', remarks: '' };
                      const currentStatus = entry.status;
                      const photoUrl = st.photoFileKey || st.photo
                        ? getFileContentUrl(st.photoFileKey || st.photo)
                        : '';

                      return (
                        <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center font-bold text-slate-900 font-mono">
                            {st.rollNumber}
                          </td>
                          <td className="p-3 text-center">
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={st.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 mx-auto"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center mx-auto text-xs">
                                {st.name.charAt(0)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            {st.name}
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {st.admissionNumber}
                          </td>
                          <td className="p-3 font-medium text-slate-600">
                            {st.parentPhone || st.mobile || 'N/A'}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                currentStatus === 'PRESENT'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : currentStatus === 'ABSENT'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : currentStatus === 'LEAVE'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : currentStatus === 'LATE'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : currentStatus === 'HOLIDAY'
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {currentStatus === 'PRESENT'
                                ? '🟢 Present'
                                : currentStatus === 'ABSENT'
                                ? '🔴 Absent'
                                : currentStatus === 'LEAVE'
                                ? '🟠 Leave'
                                : currentStatus === 'LATE'
                                ? '🟡 Late'
                                : currentStatus === 'HOLIDAY'
                                ? '⚪ Holiday'
                                : '⚪ Not Marked'}
                            </span>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Optional remark"
                              value={entry.remarks}
                              onChange={(e) => handleStudentRemarkChange(st.id, e.target.value)}
                              className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs w-36 focus:ring-1 focus:ring-blue-600 outline-hidden"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 gap-0.5">
                              {(['PRESENT', 'ABSENT', 'LEAVE', 'LATE'] as const).map((stt) => (
                                <button
                                  key={stt}
                                  type="button"
                                  onClick={() => handleToggleStudentStatus(st.id, stt)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    currentStatus === stt
                                      ? stt === 'PRESENT'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : stt === 'ABSENT'
                                        ? 'bg-rose-600 text-white shadow-2xs'
                                        : stt === 'LEAVE'
                                        ? 'bg-amber-600 text-white shadow-2xs'
                                        : 'bg-amber-500 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                  }`}
                                >
                                  {stt === 'PRESENT' ? 'P' : stt === 'ABSENT' ? 'A' : stt === 'LEAVE' ? 'L' : 'LT'}
                                </button>
                              ))}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MONTHLY REGISTER TAB                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'REGISTER' && (
        <div className="space-y-4">
          {/* Screen Controls Bar */}
          <div className="print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl font-semibold text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {availableClasses.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {c.className}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Section</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl font-semibold text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month & Year Navigation */}
              <div className="flex items-center gap-1 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (registerMonth === 0) {
                      setRegisterMonth(11);
                      setRegisterYear((y) => y - 1);
                    } else setRegisterMonth((m) => m - 1);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 text-xs">
                  {monthNames[registerMonth]} {registerYear}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (registerMonth === 11) {
                      setRegisterMonth(0);
                      setRegisterYear((y) => y + 1);
                    } else setRegisterMonth((m) => m + 1);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadRegister}
                disabled={Boolean(isPreparingRegister) || enrolledStudents.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPreparingRegister === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={handlePrintRegister}
                disabled={Boolean(isPreparingRegister) || enrolledStudents.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPreparingRegister === 'print' ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Printer className="w-4 h-4 text-white" />}
                <span>Print Register</span>
              </button>
            </div>
          </div>

          {/* Attendance Summary Banner (Screen View) */}
          <div className="print:hidden grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Students</div>
              <div className="text-lg font-black text-slate-800 mt-0.5">{monthlyRegisterStats.totalStudents}</div>
            </div>
            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Present (P)</div>
              <div className="text-lg font-black text-emerald-800 mt-0.5">{monthlyRegisterStats.p}</div>
            </div>
            <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Absent (A)</div>
              <div className="text-lg font-black text-rose-800 mt-0.5">{monthlyRegisterStats.a}</div>
            </div>
            <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Leave (L)</div>
              <div className="text-lg font-black text-amber-800 mt-0.5">{monthlyRegisterStats.l}</div>
            </div>
            <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Holidays (H)</div>
              <div className="text-lg font-black text-purple-800 mt-0.5">{monthlyRegisterStats.h}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Not Marked (NM)</div>
              <div className="text-lg font-black text-slate-700 mt-0.5">{monthlyRegisterStats.nm}</div>
            </div>
            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Overall Attendance</div>
              <div className="text-lg font-black text-blue-900 mt-0.5">{monthlyRegisterStats.percentage}</div>
            </div>
          </div>

          {/* Printable Register Container */}
          <div
            id="printable-monthly-register"
            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none print:rounded-none"
          >
            {/* Print Header: School Details, Class, Section, Month/Year, Print Date & Stats */}
            <div className="hidden print:block p-2 pb-2 mb-2 border-b-2 border-slate-800">
              <div className="flex items-center justify-between gap-4 mb-2">
                {schoolLogoSrc ? (
                  <img
                    src={schoolLogoSrc}
                    alt={schoolName}
                    onError={handleLogoError}
                    className="h-12 w-auto max-w-[120px] object-contain"
                  />
                ) : (
                  <div className="w-12" />
                )}
                <div className="text-center flex-1">
                  <h1 className="text-base font-black uppercase text-slate-900 tracking-tight leading-tight">
                    {schoolName}
                  </h1>
                  {schoolAddress && (
                    <p className="text-[8pt] text-slate-600 mt-0.5 leading-tight">
                      {schoolAddress}
                      {affiliationNumber ? ` • Affiliation No: ${affiliationNumber}${affiliatedBoard ? ` (${affiliatedBoard})` : ''}` : ''}
                    </p>
                  )}
                  <div className="text-[9pt] font-black uppercase text-slate-800 tracking-wider mt-1">
                    Monthly Student Attendance Register — {monthNames[registerMonth].toUpperCase()} {registerYear}
                  </div>
                </div>
                <div className="text-right text-[7.5pt] text-slate-700 font-medium">
                  <div><strong>Print Date:</strong> {printDate}</div>
                  <div><strong>Total Students:</strong> {monthlyRegisterStats.totalStudents}</div>
                </div>
              </div>

              {/* Print Metadata & Attendance Summary Bar */}
              <div className="flex items-center justify-between text-[7.5pt] font-bold bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-sm">
                <div className="flex items-center gap-4">
                  <span><strong className="text-slate-600">Class:</strong> {currentClassName}</span>
                  <span><strong className="text-slate-600">Section:</strong> {selectedSection}</span>
                  <span><strong className="text-slate-600">Month:</strong> {monthNames[registerMonth]} {registerYear}</span>
                  <span><strong className="text-slate-600">Total Students:</strong> {monthlyRegisterStats.totalStudents}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-800">P: <strong>{monthlyRegisterStats.p}</strong></span>
                  <span className="text-rose-800">A: <strong>{monthlyRegisterStats.a}</strong></span>
                  <span className="text-amber-800">L: <strong>{monthlyRegisterStats.l}</strong></span>
                  <span className="text-purple-800">H: <strong>{monthlyRegisterStats.h}</strong></span>
                  <span className="text-slate-700">NM: <strong>{monthlyRegisterStats.nm}</strong></span>
                  <span className="text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                    Attendance: <strong>{monthlyRegisterStats.percentage}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Matrix Register Table */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-[11px] border-collapse min-w-max print:min-w-0 print:w-full print:text-[7pt] print:table-fixed">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold print:bg-slate-100 print:border-slate-400">
                  <tr>
                    <th
                      style={{ width: '3.5%' }}
                      className="p-2 text-center sticky left-0 bg-slate-50 z-10 border-r border-slate-200 print:static print:p-0.5 print:border print:border-slate-300 print:text-[7pt]"
                    >
                      Roll
                    </th>
                    <th
                      style={{ width: '14%' }}
                      className="p-2 sticky left-12 bg-slate-50 z-10 border-r border-slate-200 print:static print:p-0.5 print:border print:border-slate-300 print:text-[7pt]"
                    >
                      Student Name
                    </th>
                    {Array.from({ length: daysInRegisterMonth }).map((_, d) => {
                      const dayNum = d + 1;
                      const dateObj = new Date(registerYear, registerMonth, dayNum);
                      const isSun = isWeekOffDay(registerYear, registerMonth, dayNum);
                      return (
                        <th
                          key={dayNum}
                          style={{ width: `${dayColWidth}%` }}
                          className={`p-1 text-center min-w-[24px] print:min-w-0 print:p-0.5 print:border print:border-slate-300 ${
                            isSun
                              ? 'bg-rose-50 text-rose-700 font-bold print:bg-rose-100 print:text-rose-900'
                              : 'print:bg-slate-50 print:text-slate-800'
                          }`}
                        >
                          <div>{dayNum}</div>
                          <div className="text-[8px] font-normal opacity-70 print:text-[5.5pt]">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dateObj.getDay()]}
                          </div>
                        </th>
                      );
                    })}
                    <th
                      style={{ width: '2.2%' }}
                      className="p-1.5 text-center bg-emerald-50 text-emerald-800 font-bold print:p-0.5 print:border print:border-slate-300 print:bg-emerald-100 print:text-emerald-900 print:text-[7pt]"
                    >
                      P
                    </th>
                    <th
                      style={{ width: '2.2%' }}
                      className="p-1.5 text-center bg-rose-50 text-rose-800 font-bold print:p-0.5 print:border print:border-slate-300 print:bg-rose-100 print:text-rose-900 print:text-[7pt]"
                    >
                      A
                    </th>
                    <th
                      style={{ width: '2.2%' }}
                      className="p-1.5 text-center bg-amber-50 text-amber-800 font-bold print:p-0.5 print:border print:border-slate-300 print:bg-amber-100 print:text-amber-900 print:text-[7pt]"
                    >
                      L
                    </th>
                    <th
                      style={{ width: '2.2%' }}
                      className="p-1.5 text-center bg-purple-50 text-purple-800 font-bold print:p-0.5 print:border print:border-slate-300 print:bg-purple-100 print:text-purple-900 print:text-[7pt]"
                    >
                      H
                    </th>
                    <th
                      style={{ width: '2.3%' }}
                      className="p-1.5 text-center bg-slate-100 text-slate-700 font-bold print:p-0.5 print:border print:border-slate-300 print:bg-slate-200 print:text-slate-800 print:text-[7pt]"
                    >
                      NM
                    </th>
                    <th
                      style={{ width: '2.4%' }}
                      className="p-1.5 text-center bg-blue-50 text-blue-900 font-black print:p-0.5 print:border print:border-slate-300 print:bg-blue-100 print:text-blue-950 print:text-[7pt]"
                    >
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-none">
                  {enrolledStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={daysInRegisterMonth + 8}
                        className="p-8 text-center text-slate-500 font-medium print:p-4"
                      >
                        No students enrolled in Class {currentClassName} - Section {selectedSection}
                      </td>
                    </tr>
                  ) : (
                    enrolledStudents.map((st) => {
                      let p = 0;
                      let a = 0;
                      let l = 0;
                      let h = 0;
                      let nm = 0;

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/80 print:hover:bg-transparent">
                          <td className="p-2 text-center font-bold font-mono text-slate-800 sticky left-0 bg-white border-r border-slate-200 print:static print:p-0.5 print:border print:border-slate-300 print:text-[7pt]">
                            {st.rollNumber}
                          </td>
                          <td className="p-2 font-bold text-slate-900 sticky left-12 bg-white border-r border-slate-200 truncate max-w-[176px] print:static print:p-0.5 print:border print:border-slate-300 print:max-w-none print:text-[7pt]">
                            {st.name}
                          </td>
                          {Array.from({ length: daysInRegisterMonth }).map((_, d) => {
                            const dayNum = d + 1;
                            const dateStr = `${registerYear}-${String(registerMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                            const isSun = isWeekOffDay(registerYear, registerMonth, dayNum);

                            // Check holiday
                            const holiday = holidaysList.find(
                              (hol) => hol.date === dateStr || (hol.endDate && dateStr >= hol.date && dateStr <= hol.endDate)
                            );

                            // Check attendance record
                            const rec = monthlyClassAttendance.find((rec) => rec.studentId === st.id && rec.date === dateStr);

                            let badge = '·';
                            let colorClass = 'text-slate-300 print:text-slate-400';

                            if (holiday) {
                              badge = 'H';
                              colorClass = 'text-purple-700 font-bold bg-purple-50 print:bg-purple-100 print:text-purple-900';
                              h++;
                            } else if (rec?.status === 'PRESENT') {
                              badge = 'P';
                              colorClass = 'text-emerald-700 font-bold bg-emerald-50 print:bg-emerald-100 print:text-emerald-900';
                              p++;
                            } else if (rec?.status === 'ABSENT') {
                              badge = 'A';
                              colorClass = 'text-rose-700 font-bold bg-rose-50 print:bg-rose-100 print:text-rose-900';
                              a++;
                            } else if (rec?.status === 'LEAVE') {
                              badge = 'L';
                              colorClass = 'text-amber-700 font-bold bg-amber-50 print:bg-amber-100 print:text-amber-900';
                              l++;
                            } else if (rec?.status === 'LATE') {
                              badge = 'LT';
                              colorClass = 'text-amber-600 font-bold bg-amber-50 print:bg-amber-100 print:text-amber-900';
                              p++;
                            } else if (isSun) {
                              badge = '—';
                              colorClass = 'text-rose-400 bg-rose-50/50 print:bg-rose-50 print:text-rose-700';
                            } else {
                              nm++;
                            }

                            return (
                              <td
                                key={dateStr}
                                className={`p-1 text-center font-mono text-[10px] print:p-0.5 print:text-[6.5pt] print:border print:border-slate-300 ${colorClass}`}
                              >
                                {badge}
                              </td>
                            );
                          })}

                          {/* Summary Columns */}
                          <td className="p-1.5 text-center font-bold text-emerald-800 bg-emerald-50/50 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-emerald-50 print:text-[7pt]">
                            {p}
                          </td>
                          <td className="p-1.5 text-center font-bold text-rose-800 bg-rose-50/50 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-rose-50 print:text-[7pt]">
                            {a}
                          </td>
                          <td className="p-1.5 text-center font-bold text-amber-800 bg-amber-50/50 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-amber-50 print:text-[7pt]">
                            {l}
                          </td>
                          <td className="p-1.5 text-center font-bold text-purple-800 bg-purple-50/50 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-purple-50 print:text-[7pt]">
                            {h}
                          </td>
                          <td className="p-1.5 text-center font-bold text-slate-600 bg-slate-50 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-slate-100 print:text-slate-800 print:text-[7pt]">
                            {nm}
                          </td>
                          <td className="p-1.5 text-center font-black text-blue-900 bg-blue-50 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-blue-100 print:text-blue-950 print:text-[7pt]">
                            {p + a + l > 0 ? `${Math.round((p / (p + a + l)) * 100)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {/* Table Footer with Column Aggregates */}
                {enrolledStudents.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 print:border-slate-400">
                    <tr>
                      <td
                        colSpan={2}
                        className="p-2 text-center text-xs font-black text-slate-800 sticky left-0 bg-slate-100 border-r border-slate-200 print:static print:p-0.5 print:border print:border-slate-300 print:text-[7pt]"
                      >
                        Total / Summary
                      </td>
                      {Array.from({ length: daysInRegisterMonth }).map((_, d) => {
                        const dayNum = d + 1;
                        const dateStr = `${registerYear}-${String(registerMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        const isSun = isWeekOffDay(registerYear, registerMonth, dayNum);
                        const holiday = holidaysList.find(
                          (hol) => hol.date === dateStr || (hol.endDate && dateStr >= hol.date && dateStr <= hol.endDate)
                        );

                        // Daily count of present students across the class
                        let dailyP = 0;
                        if (!isSun && !holiday) {
                          enrolledStudents.forEach((st) => {
                            const rec = monthlyClassAttendance.find((r) => r.studentId === st.id && r.date === dateStr);
                            if (rec?.status === 'PRESENT' || rec?.status === 'LATE') dailyP++;
                          });
                        }

                        return (
                          <td
                            key={`foot-${dayNum}`}
                            className={`p-1 text-center font-mono text-[10px] print:p-0.5 print:text-[6.5pt] print:border print:border-slate-300 ${
                              holiday
                                ? 'bg-purple-50 text-purple-800 font-bold print:bg-purple-100'
                                : isSun
                                ? 'bg-rose-50 text-rose-700 print:bg-rose-100'
                                : 'text-slate-800'
                            }`}
                          >
                            {holiday ? 'H' : isSun ? '—' : dailyP}
                          </td>
                        );
                      })}
                      <td className="p-1.5 text-center font-black text-emerald-900 bg-emerald-100/70 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-emerald-100 print:text-[7pt]">
                        {monthlyRegisterStats.p}
                      </td>
                      <td className="p-1.5 text-center font-black text-rose-900 bg-rose-100/70 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-rose-100 print:text-[7pt]">
                        {monthlyRegisterStats.a}
                      </td>
                      <td className="p-1.5 text-center font-black text-amber-900 bg-amber-100/70 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-amber-100 print:text-[7pt]">
                        {monthlyRegisterStats.l}
                      </td>
                      <td className="p-1.5 text-center font-black text-purple-900 bg-purple-100/70 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-purple-100 print:text-[7pt]">
                        {monthlyRegisterStats.h}
                      </td>
                      <td className="p-1.5 text-center font-black text-slate-800 bg-slate-200/70 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-slate-200 print:text-[7pt]">
                        {monthlyRegisterStats.nm}
                      </td>
                      <td className="p-1.5 text-center font-black text-blue-950 bg-blue-100 font-mono print:p-0.5 print:border print:border-slate-300 print:bg-blue-100 print:text-[7pt]">
                        {monthlyRegisterStats.percentage}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Print Footer: Legend and Signature Blocks */}
            <div className="hidden print:block p-2 pt-3 border-t border-slate-300 text-[7.5pt] text-slate-700">
              <div className="flex items-center justify-between text-[7pt] text-slate-600 mb-4 bg-slate-50 px-2 py-1 border border-slate-200 rounded-xs">
                <span><strong>Legend:</strong> [P] Present &bull; [A] Absent &bull; [L] Leave &bull; [LT] Late &bull; [H] Holiday &bull; [NM] Not Marked &bull; [&mdash;] Weekly off</span>
                <span>Printed from School Management System</span>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-5 mt-2 text-center">
                <div className="border-t border-slate-400 pt-1">
                  <div className="font-bold text-slate-900">Class Teacher's Signature</div>
                  <div className="text-[6.5pt] text-slate-500">Name & Date</div>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <div className="font-bold text-slate-900">Attendance Officer / In-Charge</div>
                  <div className="text-[6.5pt] text-slate-500">Verified By</div>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <div className="font-bold text-slate-900">Principal's Signature</div>
                  <div className="text-[6.5pt] text-slate-500">School Seal / Stamp</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STUDENT LEDGER TAB                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'LEDGER' && (
        <div className="space-y-4">
          <StudentCalendarPicker
            students={ledgerStudentPool}
            classes={ledgerClasses}
            selectedId={ledgerStudentId}
            onSelect={setLedgerStudentId}
          />

          {targetLedgerStudent && (
            <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 flex items-center gap-3">
              <PersonAvatar name={targetLedgerStudent.name} photo={targetLedgerStudent.photo} size={44} />
              <div className="min-w-0">
                <strong className="block text-sm font-bold text-slate-900 truncate">{targetLedgerStudent.name}</strong>
                <span className="block text-xs text-slate-500 truncate">
                  {targetLedgerStudent.className || targetLedgerStudent.classId}-{targetLedgerStudent.section}
                  {' · '}Adm {targetLedgerStudent.admissionNumber || '—'}
                  {(targetLedgerStudent as any).registrationNumber ? ` · Reg ${(targetLedgerStudent as any).registrationNumber}` : ''}
                  {targetLedgerStudent.rollNumber ? ` · Roll ${targetLedgerStudent.rollNumber}` : ''}
                </span>
              </div>
            </div>
          )}

          {/* Interactive Attendance Calendar for Student */}
          {targetLedgerStudent && (
            <AttendanceCalendar
              type="STUDENT"
              studentId={targetLedgerStudent.id}
              studentName={targetLedgerStudent.name}
              records={ledgerRecords}
              holidays={holidaysList}
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. STAFF ATTENDANCE & BIOMETRIC TAB                                       */}
      {/* ========================================================================= */}
      {activeTab === 'STAFF' && (
        <div className="space-y-4">
          {!canManageStaffAttendance ? (
            /* Teacher Self-Attendance Calendar View */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold">Faculty Personal Attendance History</h3>
                  <p className="text-[11px] text-purple-700">
                    Showing your personal duty attendance records and verified biometric punches.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs"
                >
                  Apply Leave
                </button>
              </div>

              <AttendanceCalendar
                type="STAFF"
                staffId={activeUser.id}
                employeeId={activeUser.employeeId}
                records={api.getStaffAttendance(undefined, activeUser.id)}
                leaves={leavesList}
                holidays={holidaysList}
              />
            </div>
          ) : (
            /* Admin & Principal Management View */
            <div className="space-y-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={staffDate}
                      onChange={(e) => setStaffDate(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-xl font-semibold text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setScanKind('STAFF')}
                    className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 self-end inline-flex items-center gap-1.5"
                    title="Mark today's staff attendance by scanning staff ID cards"
                  >
                    <ScanLine className="w-4 h-4" aria-hidden="true" />
                    Scan staff ID card
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...staffStatusMap };
                      staffList.forEach((st) => {
                        next[st.id] = {
                          status: 'PRESENT',
                          remarks: next[st.id]?.remarks || '',
                          ...timesForStatus('PRESENT', next[st.id]),
                        };
                      });
                      setStaffStatusMap(next);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-100 self-end"
                  >
                    Mark All Staff Present
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveStaffAttendance}
                  disabled={isSavingStaffAtt}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingStaffAtt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Staff Attendance</span>
                </button>
              </div>

              {/* Staff Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-3">Employee ID</th>
                      <th className="p-3">Staff Name</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Punch In</th>
                      <th className="p-3">Punch Out</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Quick Toggle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffList.map((st) => {
                      const entry = staffStatusMap[st.id] || { status: 'NOT_MARKED', inTime: '', outTime: '', remarks: '' };
                      return (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-blue-900">{st.employeeId}</td>
                          <td className="p-3 font-bold text-slate-800">{st.name}</td>
                          <td className="p-3 text-slate-600">{st.department || 'Academics'}</td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={entry.inTime}
                              onChange={(e) =>
                                setStaffStatusMap({
                                  ...staffStatusMap,
                                  [st.id]: { ...entry, inTime: e.target.value },
                                })
                              }
                              className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={entry.outTime}
                              onChange={(e) =>
                                setStaffStatusMap({
                                  ...staffStatusMap,
                                  [st.id]: { ...entry, outTime: e.target.value },
                                })
                              }
                              className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                entry.status === 'PRESENT'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : entry.status === 'ABSENT'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : entry.status === 'LEAVE'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : entry.status === 'NOT_MARKED'
                                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                              }`}
                            >
                              {entry.status === 'NOT_MARKED' ? 'UNMARKED' : entry.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 gap-0.5">
                              {(['PRESENT', 'ABSENT', 'LEAVE', 'LATE'] as const).map((stt) => (
                                <button
                                  key={stt}
                                  type="button"
                                  onClick={() =>
                                    setStaffStatusMap({
                                      ...staffStatusMap,
                                      [st.id]: {
                                        ...entry,
                                        status: stt,
                                        ...timesForStatus(stt, entry),
                                      },
                                    })
                                  }
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    entry.status === stt
                                      ? stt === 'PRESENT'
                                        ? 'bg-emerald-600 text-white'
                                        : stt === 'ABSENT'
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-amber-600 text-white'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {stt === 'PRESENT' ? 'P' : stt === 'ABSENT' ? 'A' : stt === 'LEAVE' ? 'L' : 'LT'}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. LEAVE DESK TAB                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'LEAVES' && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-700">Filter Status:</span>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setLeaveStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    leaveStatusFilter === st
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsApplyLeaveModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Apply for Leave</span>
            </button>
          </div>

          {/* Leaves Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3">Staff Name</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Leave Type</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leavesList
                  .filter((l) => {
                    if (isTeacher && !isAdmin) {
                      const teacherStaff = api.getStaff().find(
                        (s) => s.id === activeUser.id || (activeUser.employeeId && s.employeeId === activeUser.employeeId)
                      );
                      const myId = teacherStaff ? teacherStaff.id : activeUser.id;
                      const myEmpId = teacherStaff ? teacherStaff.employeeId : (activeUser as any).employeeId;
                      if (l.staffId !== myId && l.employeeId !== myEmpId) return false;
                    }
                    return leaveStatusFilter === 'ALL' ? true : l.status === leaveStatusFilter;
                  })
                  .map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{l.staffName}</td>
                      <td className="p-3 font-mono text-slate-600">{l.employeeId}</td>
                      <td className="p-3 font-semibold text-slate-800">{l.leaveType}</td>
                      <td className="p-3">
                        <span className="font-medium text-slate-700">
                          {l.startDate} to {l.endDate}
                        </span>
                        <span className="text-[10px] text-slate-500 block">({l.daysCount} days)</span>
                      </td>
                      <td className="p-3 max-w-xs truncate text-slate-600">{l.reason}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            l.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : l.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {l.status === 'PENDING' && isAdmin && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateLeaveStatus(l.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateLeaveStatus(l.id, 'REJECTED')}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {l.status !== 'PENDING' && (
                          <span className="text-[10px] text-slate-400">
                            By {l.approvedBy || 'Admin'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SCHOOL HOLIDAYS TAB                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'HOLIDAYS' && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Official School Academic Holidays ({holidaysList.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                School holidays automatically lock classroom and staff attendance registers as ⚪ Holiday.
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingHoliday(null);
                  setHolidayForm({
                    name: '',
                    date: new Date().toISOString().substring(0, 10),
                    endDate: '',
                    type: 'FESTIVAL',
                    description: '',
                  });
                  setIsHolidayModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add School Holiday</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {holidaysList.map((h) => (
              <div
                key={h.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      {h.type || 'FESTIVAL'}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-blue-700">
                      {h.date} {h.endDate ? `to ${h.endDate}` : ''}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 mt-2">{h.name}</h4>
                  {h.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{h.description}</p>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingHoliday(h);
                        setHolidayForm({
                          name: h.name,
                          date: h.date,
                          endDate: h.endDate || '',
                          type: h.type || 'FESTIVAL',
                          description: h.description || '',
                        });
                        setIsHolidayModalOpen(true);
                      }}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3 h-3 text-slate-500" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHoliday(h.id, h.name)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: APPLY LEAVE                                                        */}
      {/* ========================================================================= */}
      {isApplyLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Apply for Faculty Leave</h3>
              <button
                type="button"
                onClick={() => setIsApplyLeaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Leave Type *</label>
                <select
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="CASUAL">Casual Leave (CL)</option>
                  <option value="SICK">Medical / Sick Leave (SL)</option>
                  <option value="EARNED">Earned Leave (EL)</option>
                  <option value="MATERNITY">Maternity / Paternity Leave</option>
                  <option value="DUTY">Duty / Official Leave (DL)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Number of Days *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={leaveForm.daysCount}
                  onChange={(e) => setLeaveForm({ ...leaveForm, daysCount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Leave *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Provide explicit reasons for the leave application..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT HOLIDAY                                                 */}
      {/* ========================================================================= */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingHoliday ? 'Edit School Holiday' : 'Add School Holiday'}
              </h3>
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Holiday Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maha Shivratri"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={holidayForm.endDate}
                    onChange={(e) => setHolidayForm({ ...holidayForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Holiday Category</label>
                <select
                  value={holidayForm.type}
                  onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="NATIONAL">National Holiday</option>
                  <option value="FESTIVAL">Festival Celebration</option>
                  <option value="VACATION">Vacation / Term Break</option>
                  <option value="SCHOOL">Institutional Holiday</option>
                  <option value="STATE">State Holiday</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional context or event details..."
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
                >
                  {editingHoliday ? 'Update Holiday' : 'Create Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
