import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Info,
  CalendarOff,
  Sparkles,
} from 'lucide-react';
import { AttendanceRecord, Holiday, StaffAttendanceRecord, StaffLeave } from '../../types';
import { api } from '../../services/api';
import { DAY_NAMES, isWeekOff as isWeekOffDate, workingDaySet, UNMARKED_SALARY_CUT_FROM } from '../../utils/workingDays';

export interface AttendanceCalendarProps {
  type: 'STUDENT' | 'STAFF';
  studentId?: string;
  staffId?: string;
  employeeId?: string;
  studentName?: string;
  staffName?: string;
  records: (AttendanceRecord | StaffAttendanceRecord)[];
  leaves?: StaffLeave[];
  holidays?: Holiday[];
  initialYear?: number;
  initialMonth?: number; // 0-indexed (0 = Jan, 11 = Dec)
  readOnly?: boolean;
  /** School working weekdays; default: School Settings → School Working Days. Others are weekly offs. */
  workingDays?: string[];
}

interface DayAttendanceInfo {
  dateStr: string;
  dayNumber: number;
  isToday: boolean;
  isFuture: boolean;
  /** Weekday not ticked in School Working Days. */
  isWeekOff: boolean;
  /** Staff: this day costs one day's salary (absent, or a past working day with no mark). */
  salaryCut: boolean;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HOLIDAY' | 'LATE' | 'NOT_MARKED';
  record?: AttendanceRecord | StaffAttendanceRecord;
  holiday?: Holiday;
  leave?: StaffLeave;
  markedBy?: string;
  remarks?: string;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  type,
  studentId,
  staffId,
  employeeId,
  records,
  leaves = [],
  holidays = [],
  initialYear,
  initialMonth,
  workingDays,
}) => {
  const workingSet = useMemo(
    () => workingDaySet(workingDays && workingDays.length ? workingDays : (api.getSettings() as any)?.workingDays),
    [workingDays]
  );
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(
    initialYear !== undefined ? initialYear : today.getFullYear()
  );
  const [currentMonth, setCurrentMonth] = useState<number>(
    initialMonth !== undefined ? initialMonth : today.getMonth()
  );

  const [selectedDay, setSelectedDay] = useState<DayAttendanceInfo | null>(null);
  const [isCustomYear, setIsCustomYear] = useState(false);
  const [customYearVal, setCustomYearVal] = useState('');

  // Dynamically compute selectable years based on records, leaves, holidays, initialYear, and currentYear
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    const currentCalYear = new Date().getFullYear();
    const minBound = Math.min(2015, currentCalYear - 8, currentYear - 4);
    const maxBound = Math.max(2035, currentCalYear + 8, currentYear + 4);

    for (let y = minBound; y <= maxBound; y++) {
      yearsSet.add(y);
    }
    yearsSet.add(currentYear);
    if (initialYear) yearsSet.add(initialYear);

    records?.forEach((r) => {
      if (r?.date) {
        const y = parseInt(r.date.split('-')[0], 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });

    leaves?.forEach((l) => {
      if (l?.startDate) {
        const y = parseInt(l.startDate.split('-')[0], 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });

    holidays?.forEach((h) => {
      if (h?.date) {
        const y = parseInt(h.date.split('-')[0], 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });

    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [currentYear, initialYear, records, leaves, holidays]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  // Filter approved leaves for this staff member
  const approvedLeaves = useMemo(() => {
    if (type !== 'STAFF') return [];
    return leaves.filter((l) => {
      if (l.status !== 'APPROVED') return false;
      if (staffId && (l.staffId === staffId || l.employeeId === staffId)) return true;
      if (employeeId && l.employeeId === employeeId) return true;
      return !staffId && !employeeId;
    });
  }, [type, leaves, staffId, employeeId]);

  // Compute Calendar Grid for Current Month
  const { daysInMonth, startDayOfWeek, dayInfos, stats } = useMemo(() => {
    const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon...

    const infos: DayAttendanceInfo[] = [];

    let countPresent = 0;
    let countAbsent = 0;
    let countLeave = 0;
    let countHoliday = 0;
    let countLate = 0;
    let countNotMarked = 0;
    let countWorkingDays = 0;
    let countSalaryCut = 0;

    const todayStr = today.toISOString().split('T')[0];

    for (let day = 1; day <= daysCount; day++) {
      const dateObj = new Date(currentYear, currentMonth, day);
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const isWeekOff = isWeekOffDate(dateStr, workingSet);
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;

      // 1. Check Holiday first
      const holiday = holidays.find((h) => {
        if (h.date === dateStr) return true;
        if (h.endDate && dateStr >= h.date && dateStr <= h.endDate) return true;
        return false;
      });

      // 2. Check Approved Leave (for staff)
      const approvedLeave = approvedLeaves.find((l) => {
        return dateStr >= l.startDate && dateStr <= l.endDate;
      });

      // 3. Check Attendance Record
      const record = records.find((r) => {
        if (r.date !== dateStr) return false;
        if (type === 'STUDENT' && studentId) {
          return (r as AttendanceRecord).studentId === studentId;
        }
        if (type === 'STAFF') {
          const sr = r as StaffAttendanceRecord;
          // Only this person's record (before, any staff member's record for the date was taken).
          if (!staffId && !employeeId) return true;
          if (staffId && (sr.staffId === staffId || sr.employeeId === staffId)) return true;
          if (employeeId && sr.employeeId === employeeId) return true;
          return false;
        }
        return true;
      });

      let status: DayAttendanceInfo['status'] = 'NOT_MARKED';
      let remarks = '';
      let markedBy = '';

      if (holiday) {
        status = 'HOLIDAY';
        remarks = holiday.name + (holiday.description ? ` (${holiday.description})` : '');
        countHoliday++;
      } else if (approvedLeave) {
        status = 'LEAVE';
        remarks = `Approved ${approvedLeave.leaveType} Leave: ${approvedLeave.reason}`;
        markedBy = approvedLeave.approvedBy || 'Principal';
        countLeave++;
        countWorkingDays++;
      } else if (record) {
        markedBy = (record as any).markedBy || '';
        remarks = record.remarks || '';
        const recStatus = record.status?.toUpperCase();

        if (recStatus === 'PRESENT') {
          status = 'PRESENT';
          countPresent++;
          countWorkingDays++;
        } else if (recStatus === 'ABSENT') {
          status = 'ABSENT';
          countAbsent++;
          countWorkingDays++;
        } else if (recStatus === 'LATE') {
          status = 'LATE';
          countLate++;
          countPresent++; // Late is considered present in CBSE standards
          countWorkingDays++;
        } else if (recStatus === 'LEAVE' || recStatus === 'ON_LEAVE') {
          status = 'LEAVE';
          countLeave++;
          countWorkingDays++;
        } else if (recStatus === 'HOLIDAY') {
          status = 'HOLIDAY';
          countHoliday++;
        } else {
          status = 'NOT_MARKED';
          if (!isFuture && !isWeekOff) countNotMarked++;
        }
      } else {
        if (isWeekOff) {
          status = 'NOT_MARKED';
          remarks = `Weekly off (${DAY_NAMES[dateObj.getDay()]})`;
        } else if (isFuture) {
          status = 'NOT_MARKED';
          remarks = 'Upcoming Day';
        } else {
          status = 'NOT_MARKED';
          countNotMarked++;
          countWorkingDays++;
        }
      }

      // Same rule as payroll: on a working day (not a holiday / approved leave) an absence costs one day's
      // salary, and so does a past day with no mark at all (from the rule's start date).
      const salaryCut =
        type === 'STAFF' &&
        !isWeekOff &&
        status !== 'HOLIDAY' &&
        status !== 'LEAVE' &&
        (status === 'ABSENT' || (status === 'NOT_MARKED' && !isFuture && !isToday && dateStr >= UNMARKED_SALARY_CUT_FROM));
      if (salaryCut) {
        countSalaryCut++;
        remarks = status === 'ABSENT' ? `${remarks ? `${remarks} · ` : ''}1 day salary cut` : 'Attendance not marked · 1 day salary cut';
      }

      infos.push({
        dateStr,
        dayNumber: day,
        isToday,
        isFuture,
        isWeekOff,
        salaryCut,
        status,
        record,
        holiday,
        leave: approvedLeave,
        markedBy,
        remarks,
      });
    }

    // Attendance % Calculation: Present (including late) / Total marked days (or working days past)
    const effectivePresent = countPresent;
    const totalRecordedDays = countPresent + countAbsent + countLeave;
    const percentage = totalRecordedDays > 0
      ? Math.round((effectivePresent / totalRecordedDays) * 100)
      : (countWorkingDays === 0 ? 100 : 0);

    return {
      daysInMonth: daysCount,
      startDayOfWeek: firstDayIndex,
      dayInfos: infos,
      stats: {
        present: countPresent,
        absent: countAbsent,
        leave: countLeave,
        holiday: countHoliday,
        late: countLate,
        notMarked: countNotMarked,
        workingDays: countWorkingDays,
        salaryCut: countSalaryCut,
        percentage,
      },
    };
  }, [currentYear, currentMonth, records, approvedLeaves, holidays, studentId, staffId, employeeId, type, workingSet]);

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const offLabelIdx = new Set(DAY_NAMES.map((n, i) => (workingSet.has(n.toLowerCase()) ? -1 : i)).filter((i) => i >= 0));

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Month Navigation & Summary Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {monthNames[currentMonth]} {currentYear} Attendance Register
              </h3>
              <p className="text-[11px] text-slate-500">
                {type === 'STUDENT' ? 'Student classroom attendance ledger' : 'Staff biometric & duty attendance log'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={currentMonth}
              onChange={(e) => {
                setCurrentMonth(Number(e.target.value));
                setSelectedDay(null);
              }}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 cursor-pointer shadow-2xs focus:ring-1 focus:ring-blue-500"
            >
              {monthNames.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>
            {isCustomYear ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1990"
                  max="2100"
                  value={customYearVal}
                  onChange={(e) => setCustomYearVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const y = parseInt(customYearVal, 10);
                      if (!isNaN(y) && y >= 1990 && y <= 2100) {
                        setCurrentYear(y);
                        setSelectedDay(null);
                        setIsCustomYear(false);
                      }
                    } else if (e.key === 'Escape') {
                      setIsCustomYear(false);
                    }
                  }}
                  autoFocus
                  placeholder="YYYY"
                  className="w-16 px-2 py-1 bg-white border border-blue-500 rounded-lg text-xs font-bold text-slate-800 font-mono focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const y = parseInt(customYearVal, 10);
                    if (!isNaN(y) && y >= 1990 && y <= 2100) {
                      setCurrentYear(y);
                      setSelectedDay(null);
                      setIsCustomYear(false);
                    }
                  }}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                  title="Apply Year"
                >
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomYear(false)}
                  className="px-1.5 py-1 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  title="Cancel"
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                value={currentYear}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setCustomYearVal(String(currentYear));
                    setIsCustomYear(true);
                  } else {
                    setCurrentYear(Number(e.target.value));
                    setSelectedDay(null);
                  }
                }}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono cursor-pointer shadow-2xs focus:ring-1 focus:ring-blue-500"
                title="Select Academic Year"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
                <option value="custom">✏️ Enter Any Year...</option>
              </select>
            )}
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
              <span>🟢</span>
              <span>Present</span>
            </div>
            <div className="text-xl font-black text-emerald-950 font-mono mt-1">
              {stats.present} <span className="text-[10px] font-normal text-emerald-700">days</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-800">
              <span>🔴</span>
              <span>Absent</span>
            </div>
            <div className="text-xl font-black text-rose-950 font-mono mt-1">
              {stats.absent} <span className="text-[10px] font-normal text-rose-700">days</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
              <span>🟠</span>
              <span>Leave</span>
            </div>
            <div className="text-xl font-black text-amber-950 font-mono mt-1">
              {stats.leave} <span className="text-[10px] font-normal text-amber-700">days</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-yellow-50/70 border border-yellow-200/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-800">
              <span>🟡</span>
              <span>Late</span>
            </div>
            <div className="text-xl font-black text-yellow-950 font-mono mt-1">
              {stats.late} <span className="text-[10px] font-normal text-yellow-700">days</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <span>⚪</span>
              <span>Holiday</span>
            </div>
            <div className="text-xl font-black text-slate-800 font-mono mt-1">
              {stats.holiday} <span className="text-[10px] font-normal text-slate-500">days</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <span>⚪</span>
              <span>Not Marked</span>
            </div>
            <div className="text-xl font-black text-slate-700 font-mono mt-1">
              {stats.notMarked} <span className="text-[10px] font-normal text-slate-500">days</span>
            </div>
          </div>

          {type === 'STAFF' && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300" title="Absent days and past working days without a mark: one day's salary each">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-800">
                <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                <span>Salary cut</span>
              </div>
              <div className="text-xl font-black text-rose-950 font-mono mt-1">
                {stats.salaryCut} <span className="text-[10px] font-normal text-rose-700">days</span>
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-800">
              <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
              <span>Working Days</span>
            </div>
            <div className="text-xl font-black text-indigo-950 font-mono mt-1">
              {stats.workingDays} <span className="text-[10px] font-normal text-indigo-700">days</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800">
              <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
              <span>Attendance %</span>
            </div>
            <div className="text-xl font-black text-blue-950 font-mono mt-1">
              {stats.percentage}%
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-600 border-t border-slate-100">
          <span className="font-semibold text-slate-700">Legend:</span>
          <span className="inline-flex items-center gap-1">
            <span>🟢</span>
            <strong>Present (P)</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <span>🔴</span>
            <strong>Absent (A)</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <span>🟠</span>
            <strong>Approved Leave (L)</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <span>🟡</span>
            <strong>Late (LT)</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <span>⚪</span>
            <strong>Holiday (H)</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-400" />
            <strong>Not Marked (NM)</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="px-1 rounded text-[10px] border bg-slate-100 text-slate-400 border-slate-200 leading-none">OFF</span>
            <strong>Weekly off</strong>
          </span>
          {type === 'STAFF' && (
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] font-bold text-rose-700">−1d</span>
              <strong>1 day salary cut (absent / not marked)</strong>
            </span>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-500 pb-2 border-b border-slate-100">
          {weekDayLabels.map((wd, i) => (
            <div key={wd} className={offLabelIdx.has(i) ? 'text-rose-500' : ''} title={offLabelIdx.has(i) ? 'Weekly off' : undefined}>
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-1">
          {/* Empty cells before month start */}
          {Array.from({ length: startDayOfWeek }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="min-h-[52px] sm:min-h-[64px] rounded-xl bg-slate-50/40 border border-transparent"
            />
          ))}

          {/* Month days */}
          {dayInfos.map((d) => {
            const isSelected = selectedDay?.dateStr === d.dateStr;

            let badgeBg = 'bg-slate-100 text-slate-600 border-slate-200';
            let label = 'NM';

            if (d.status === 'PRESENT') {
              badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
              label = 'P';
            } else if (d.status === 'ABSENT') {
              badgeBg = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
              label = 'A';
            } else if (d.status === 'LEAVE') {
              badgeBg = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
              label = 'L';
            } else if (d.status === 'LATE') {
              badgeBg = 'bg-yellow-100 text-yellow-900 border-yellow-300 font-bold';
              label = 'LT';
            } else if (d.status === 'HOLIDAY') {
              badgeBg = 'bg-slate-100 text-slate-800 border-slate-300 font-bold';
              label = 'H';
            } else if (d.isWeekOff) {
              badgeBg = 'bg-slate-100 text-slate-400 border-slate-200';
              label = 'OFF';
            }

            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`min-h-[52px] sm:min-h-[64px] p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-blue-600 border-blue-600 bg-blue-50/50 shadow-xs'
                    : d.isToday
                    ? 'border-blue-400 bg-blue-50/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-mono font-bold ${
                      d.isToday ? 'text-blue-700 underline' : d.isWeekOff ? 'text-rose-500' : 'text-slate-800'
                    }`}
                  >
                    {d.dayNumber}
                  </span>
                  {d.isToday && (
                    <span className="text-[9px] font-bold px-1 rounded bg-blue-600 text-white uppercase tracking-wider hidden sm:inline">
                      Today
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between w-full mt-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] border leading-none ${badgeBg}`}
                  >
                    {label}
                  </span>
                  {d.salaryCut && (
                    <span className="text-[9px] font-bold text-rose-700 leading-none" title="1 day salary cut">
                      −1d
                    </span>
                  )}
                  {d.holiday && (
                    <span className="text-[10px] text-purple-700 font-semibold truncate hidden sm:block max-w-[60px]" title={d.holiday.name}>
                      {d.holiday.name}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details Card */}
      {selectedDay && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-xs space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-blue-200/70">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-700" />
              <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                Attendance Details: {selectedDay.dateStr}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">Recorded Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    selectedDay.status === 'PRESENT'
                      ? 'bg-emerald-500'
                      : selectedDay.status === 'ABSENT'
                      ? 'bg-rose-500'
                      : selectedDay.status === 'LEAVE'
                      ? 'bg-amber-500'
                      : selectedDay.status === 'HOLIDAY'
                      ? 'bg-purple-500'
                      : 'bg-slate-400'
                  }`}
                />
                <strong className="text-slate-900 font-bold">{selectedDay.status}</strong>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">Class / Wing</span>
              <strong className="text-slate-900 font-semibold block mt-0.5">
                {(selectedDay.record as any)?.className
                  ? `${(selectedDay.record as any).className} - ${(selectedDay.record as any).section || 'A'}`
                  : (selectedDay.record as any)?.department || (type === 'STUDENT' ? 'Classroom Roster' : 'Academics')}
              </strong>
            </div>

            <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">Recorded By</span>
              <strong className="text-slate-900 font-semibold block mt-0.5 truncate">
                {selectedDay.markedBy || (selectedDay.status === 'HOLIDAY' ? 'Academic Calendar' : 'Class Teacher / System')}
              </strong>
            </div>

            <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">Remarks / Note</span>
              <span className="text-slate-700 font-medium block mt-0.5">
                {selectedDay.remarks || 'Regular daily record entry'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
