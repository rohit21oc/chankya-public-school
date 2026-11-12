import { StaffPayrollRecord, TeacherStaff, StaffAttendanceRecord, StaffLeave, Holiday } from '../../src/types/index.ts';
import { StaffPayrollModel } from '../models/StaffPayroll.ts';
import { isWeekOff, workingDaySet, UNMARKED_SALARY_CUT_FROM } from '../../src/utils/workingDays.ts';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Returns current timestamp components in Asia/Kolkata timezone
 */
export function getNowInAsiaKolkata(): {
  now: Date;
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  isoDate: string;
} {
  const istString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istString);
  const year = istDate.getFullYear();
  const month = istDate.getMonth() + 1; // 1-12
  const day = istDate.getDate();
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { now: istDate, year, month, day, hour, minute, isoDate };
}

/**
 * Paid leave allowance per month. Leave beyond this is deducted at one day's salary per day.
 * School rule: 1 day (sick leave preferred) is forgiven each month.
 */
export const FREE_LEAVE_DAYS_PER_MONTH = 1;

/**
 * Daily Salary formula: Monthly Salary / 30
 */
export function calculateDailySalary(monthlySalary: number): number {
  if (!monthlySalary || monthlySalary <= 0) return 0;
  return Math.round((monthlySalary / 30) * 100) / 100;
}

/**
 * Late deduction: 25% of one day's salary per qualifying late day
 * Formula: (Monthly Salary / 30) * 0.25 * Qualifying Late Days
 */
export function calculateLateDeduction(monthlySalary: number, qualifyingLateDays: number): number {
  if (!monthlySalary || qualifyingLateDays <= 0) return 0;
  const deduction = (monthlySalary / 30) * 0.25 * qualifyingLateDays;
  return Math.round(deduction * 100) / 100;
}

/**
 * Unpaid leave deduction: 1 day's salary per qualifying unpaid day
 * Formula: (Monthly Salary / 30) * Qualifying Unpaid Days
 */
export function calculateUnpaidLeaveDeduction(monthlySalary: number, qualifyingUnpaidDays: number): number {
  if (!monthlySalary || qualifyingUnpaidDays <= 0) return 0;
  const deduction = (monthlySalary / 30) * qualifyingUnpaidDays;
  return Math.round(deduction * 100) / 100;
}

/**
 * Days in month for specified year and 1-based month
 */
export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 0).getDate();
}

/**
 * Formats standard month metadata
 */
export function getMonthPeriodMeta(year: number, monthIndex: number): {
  monthName: string;
  payrollMonth: string;
  startDate: string;
  endDate: string;
  daysInMonth: number;
} {
  const monthName = `${MONTH_NAMES[monthIndex - 1]} ${year}`;
  const payrollMonth = `${year}-${String(monthIndex).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const startDate = `${payrollMonth}-01`;
  const endDate = `${payrollMonth}-${String(daysInMonth).padStart(2, '0')}`;
  return { monthName, payrollMonth, startDate, endDate, daysInMonth };
}

/**
 * Extracts configured monthly salary from staff profile
 */
export function getConfiguredMonthlySalary(staff: TeacherStaff | any): number {
  if (typeof staff.monthlySalary === 'number' && staff.monthlySalary > 0) {
    return Math.round(staff.monthlySalary * 100) / 100;
  }
  if (typeof staff.salary === 'number' && staff.salary > 0) {
    return Math.round(staff.salary * 100) / 100;
  }
  if (staff.salary && typeof staff.salary === 'object') {
    const candidate = staff.salary.net || staff.salary.basic || staff.salary.monthly;
    if (typeof candidate === 'number' && candidate > 0) {
      return Math.round(candidate * 100) / 100;
    }
  }
  // No salary configured: return 0. Payroll is never generated from an assumed amount;
  // the generator reports these staff so their salary can be set first.
  return 0;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayOf = (v: unknown): string => {
  const d = String(v || '').trim().substring(0, 10);
  return ISO_DAY.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) ? d : '';
};
const laterOf = (a: string, b: string): string => (a && b ? (a > b ? a : b) : a || b);
const firstOfMonth = (isoDay: string): string => (isoDay ? `${isoDay.substring(0, 7)}-01` : '');

/**
 * "Salary from" for a new staff record when the form leaves it empty: the joining date, or the first day of
 * the month they were added to the ERP if they joined earlier. Salary for months before they were added was
 * paid outside the ERP, so it must not show up as unpaid.
 */
export function defaultSalaryStartDate(joiningDate: unknown, addedOn: string): string {
  return laterOf(dayOf(joiningDate), firstOfMonth(dayOf(addedOn)));
}

/**
 * The first day the ERP pays this person for. Records made before "Salary from" existed fall back to the
 * day the record was created (its id is t-<milliseconds>), and only then to the joining date.
 */
export function getSalaryStartDate(staff: TeacherStaff | any): string {
  const explicit = dayOf(staff?.salaryStartDate);
  const joining = dayOf(staff?.joiningDate);
  if (explicit) return laterOf(explicit, joining);
  const createdMs = Number(String(staff?.id || '').match(/^t-(\d{13})$/)?.[1]) || Date.parse(String(staff?.createdAt || ''));
  if (Number.isFinite(createdMs) && createdMs > 0) {
    return defaultSalaryStartDate(joining, new Date(createdMs).toISOString().substring(0, 10));
  }
  return joining;
}

/** Statuses for which a staff member is no longer on the rolls. */
export const INACTIVE_STAFF_STATUSES = ['INACTIVE', 'LEFT_SCHOOL', 'TERMINATED', 'RESIGNED'];

export function isStaffInactive(staff: TeacherStaff | any): boolean {
  const statuses = [staff?.status, staff?.accountStatus].map((v) => String(v || '').toUpperCase());
  return statuses.some((v) => INACTIVE_STAFF_STATUSES.includes(v));
}

/**
 * Core Salary & Deduction Calculator for a staff member for a specific month
 */
export function calculateStaffSalaryForMonth(params: {
  staff: TeacherStaff | any;
  year: number;
  monthIndex: number; // 1-12
  attendanceRecords: StaffAttendanceRecord[];
  leaves: StaffLeave[];
  holidays: Holiday[];
  otherDeductions?: number;
  generatedBy?: string;
  /** School working weekdays (School Settings). Other weekdays are weekly offs. Default Mon–Sat. */
  workingDays?: string[];
  /** "Today" in India (YYYY-MM-DD); days from today on are not charged as unmarked. Default: now. */
  todayIso?: string;
}): StaffPayrollRecord | null {
  const { staff, year, monthIndex, attendanceRecords, leaves, holidays, otherDeductions = 0, generatedBy } = params;
  const workingSet = workingDaySet(params.workingDays);
  const todayIso = params.todayIso || getNowInAsiaKolkata().isoDate;

  // 1. Eligibility Check: Joining Date & Employment Status
  const { monthName, payrollMonth, startDate, endDate, daysInMonth } = getMonthPeriodMeta(year, monthIndex);

  // First paid day: the later of the joining date and "Salary from".
  const joiningDate = getSalaryStartDate(staff);
  if (joiningDate && joiningDate > endDate) {
    // Not employed by the ERP yet in this month
    return null;
  }
  // Starting part-way through the month: pay only the calendar days from the start date.
  const daysBeforeStart = joiningDate && joiningDate > startDate ? Number(joiningDate.substring(8, 10)) - 1 : 0;

  // 2. Base Salary & Daily Salary — never assumed; staff without a configured salary are skipped.
  const monthlySalary = getConfiguredMonthlySalary(staff);
  if (monthlySalary <= 0) {
    return null;
  }
  const dailySalary = calculateDailySalary(monthlySalary);

  // 3. Filter Attendance & Leaves for this staff member in this month
  const staffId = String(staff.id);
  const empId = String(staff.employeeId || '').toUpperCase();

  const monthAttendance = attendanceRecords.filter((a) => {
    const isStaffMatch = String(a.staffId) === staffId || (!!empId && String(a.employeeId || '').toUpperCase() === empId);
    const d = String(a.date || '').split('T')[0];
    return isStaffMatch && d >= startDate && d <= endDate;
  });

  // Staff who are no longer active are paid only for a month in which they have attendance on record.
  if (isStaffInactive(staff) && monthAttendance.length === 0) {
    return null;
  }

  const staffLeaves = leaves.filter((l) => {
    const isStaffMatch = String(l.staffId) === staffId || String(l.employeeId || '').toUpperCase() === empId;
    return isStaffMatch;
  });

  // Approved paid leave dates set (these are approved paid leaves -> NOT deducted)
  const approvedPaidLeaveDates = new Set<string>();
  // date -> leave type, so the monthly free-leave allowance can prefer SICK leave
  const approvedPaidLeaveTypeByDate = new Map<string, string>();
  // Explicit unpaid leaves set (UNPAID, LWP, or rejected/unapproved -> full daily deduction)
  const explicitUnpaidLeaveDates = new Set<string>();

  staffLeaves.forEach((l) => {
    // Only APPROVED leave changes pay. A rejected or pending application is not leave: what happened
    // that day is decided by the attendance register (e.g. ABSENT is deducted, PRESENT is paid).
    if (String(l.status || '').toUpperCase() !== 'APPROVED') return;
    const isExplicitlyUnpaid =
      l.leaveType === 'UNPAID' ||
      l.leaveType === 'LWP' ||
      (l as any).isPaid === false;
    const isApprovedPaid = !isExplicitlyUnpaid;
    if (!l.startDate || !l.endDate) return;

    const start = l.startDate.split('T')[0];
    const end = l.endDate.split('T')[0];
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = `${payrollMonth}-${String(d).padStart(2, '0')}`;
      if (curDate >= start && curDate <= end) {
        if (isExplicitlyUnpaid) {
          explicitUnpaidLeaveDates.add(curDate);
        } else if (isApprovedPaid) {
          approvedPaidLeaveDates.add(curDate);
          if (!approvedPaidLeaveTypeByDate.has(curDate) || String(l.leaveType).toUpperCase() === 'SICK') {
            approvedPaidLeaveTypeByDate.set(curDate, String(l.leaveType || 'CASUAL').toUpperCase());
          }
        }
      }
    }
  });

  // Official holidays set
  const holidayDates = new Set<string>();
  holidays.forEach((h) => {
    const hDate = (h.date || '').split('T')[0];
    const hEnd = (h.endDate || h.date || '').split('T')[0];
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = `${payrollMonth}-${String(d).padStart(2, '0')}`;
      if (curDate >= hDate && curDate <= hEnd) {
        holidayDates.add(curDate);
      }
    }
  });

  // 4. Analyze Attendance by Distinct Dates
  // Avoid duplicate deductions for the same date
  const processedDates = new Map<string, string>(); // date -> status
  monthAttendance.forEach((att) => {
    const d = att.date.split('T')[0];
    // If not already recorded or status is higher priority
    if (!processedDates.has(d)) {
      processedDates.set(d, att.status);
    }
  });

  let presentDays = 0;
  let lateDays = 0;
  let unpaidLeaveDays = 0;
  let approvedPaidLeaveDays = 0;
  // Leave days taken this month (approved, not explicitly unpaid). Only FREE_LEAVE_DAYS_PER_MONTH
  // of them are paid; the rest are deducted like an absence. Collected first, decided after the loop.
  const leaveDaysTaken: string[] = [];
  let holidayDays = 0;
  let weeklyOffDays = 0;
  // Working days with no attendance mark at all (charged one day each, see below).
  let notMarkedDays = 0;
  let absentDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const curDate = `${payrollMonth}-${String(day).padStart(2, '0')}`;

    // If before joining date in the same month
    if (joiningDate && curDate < joiningDate) {
      // Days prior to joining are not working days for this employee
      continue;
    }

    // Weekly off = a weekday that is not ticked in School Working Days.
    if (isWeekOff(curDate, workingSet)) {
      weeklyOffDays++;
      continue;
    }

    if (holidayDates.has(curDate)) {
      holidayDays++;
      continue;
    }

    // A day the person actually worked is paid as worked, even if a leave was approved for it.
    const workedStatus = processedDates.get(curDate);
    const workedThatDay = workedStatus === 'PRESENT' || workedStatus === 'LATE' || workedStatus === 'HALF_DAY';

    // Approved unpaid leave is deducted
    if (!workedThatDay && explicitUnpaidLeaveDates.has(curDate)) {
      unpaidLeaveDays++;
      continue;
    }

    if (!workedThatDay && approvedPaidLeaveDates.has(curDate)) {
      leaveDaysTaken.push(curDate);
      continue;
    }

    const recordedStatus = processedDates.get(curDate);
    if (recordedStatus) {
      if (recordedStatus === 'PRESENT') {
        presentDays++;
      } else if (recordedStatus === 'LATE') {
        lateDays++;
        presentDays++; // Counts as attendance but incurs 25% daily deduction penalty
      } else if (recordedStatus === 'HALF_DAY') {
        // Half day = 0.5 unpaid absence day
        unpaidLeaveDays += 0.5;
        presentDays += 0.5;
      } else if (
        recordedStatus === 'ABSENT' ||
        recordedStatus === 'UNPAID_LEAVE' ||
        recordedStatus === 'LWP'
      ) {
        unpaidLeaveDays++;
        absentDays++;
      } else if (recordedStatus === 'ON_LEAVE' || recordedStatus === 'LEAVE') {
        // Check if approved paid
        if (approvedPaidLeaveDates.has(curDate)) {
          leaveDaysTaken.push(curDate);
        } else {
          unpaidLeaveDays++;
        }
      } else if (recordedStatus === 'HOLIDAY') {
        holidayDays++;
      } else if (recordedStatus === 'WEEK_OFF') {
        weeklyOffDays++;
      } else {
        presentDays++;
      }
    } else if (curDate >= UNMARKED_SALARY_CUT_FROM && curDate < todayIso) {
      // School rule: a working day without any attendance mark is cut like an absence (one day's
      // salary). Today and later are not charged yet; days before the rule started are not charged.
      notMarkedDays++;
    }
  }

  // 4b. Monthly leave allowance: salary is paid for days actually worked. Out of the leave taken in
  // a month, only FREE_LEAVE_DAYS_PER_MONTH day(s) are forgiven (a SICK leave day is used first);
  // every other leave day is deducted at one day's salary (monthly / 30).
  // Example: ₹30,000, 3 leave days → 1 forgiven, 2 × ₹1,000 = ₹2,000 deducted.
  const sickFirst = [...leaveDaysTaken].sort((a, b) => {
    const as = approvedPaidLeaveTypeByDate.get(a) === 'SICK' ? 0 : 1;
    const bs = approvedPaidLeaveTypeByDate.get(b) === 'SICK' ? 0 : 1;
    return as - bs || a.localeCompare(b);
  });
  const waivedLeaveDates = sickFirst.slice(0, FREE_LEAVE_DAYS_PER_MONTH);
  const chargeableLeaveDays = Math.max(0, leaveDaysTaken.length - waivedLeaveDates.length);
  approvedPaidLeaveDays = waivedLeaveDates.length;
  unpaidLeaveDays += chargeableLeaveDays;

  // 5. Compute Deductions according to strict school rules
  // A. Late deduction = (Monthly Salary / 30) * 0.25 * lateDays
  const lateDeduction = calculateLateDeduction(monthlySalary, lateDays);

  // B. Unpaid leave deduction = (Monthly Salary / 30) * unpaidLeaveDays
  const unpaidLeaveDeduction = calculateUnpaidLeaveDeduction(monthlySalary, unpaidLeaveDays);

  // B2. Working days with no attendance mark: one day's salary each (monthly / 30)
  const notMarkedDeduction = calculateUnpaidLeaveDeduction(monthlySalary, notMarkedDays);

  // C. Days before the salary start date in this month (joined / started mid-month)
  const notEmployedDeduction = daysBeforeStart > 0 ? Math.round(((monthlySalary * daysBeforeStart) / daysInMonth) * 100) / 100 : 0;

  // D. Total deductions & Net Payable
  const totalDeductions =
    Math.round((lateDeduction + unpaidLeaveDeduction + notMarkedDeduction + notEmployedDeduction + (otherDeductions || 0)) * 100) / 100;
  const netSalary = Math.max(0, Math.round((monthlySalary - totalDeductions) * 100) / 100);

  // 6. Earnings: the school records one monthly salary per person, so that is the only earning shown.
  // (Splitting it into basic/HRA/DA/TA here would print allowances the school never set.)
  const basicSalary = monthlySalary;
  const totalAllowances = 0;

  const id = `pay-${staff.id}-${payrollMonth}`;
  const slipNumber = `SLIP-${year}-${String(monthIndex).padStart(2, '0')}-${staff.employeeId || 'STAFF'}`;

  const payrollRecord: StaffPayrollRecord = {
    id,
    staffId: staff.id,
    staffName: staff.name,
    employeeId: staff.employeeId || empId,
    uanNumber: staff.uanNumber || undefined,
    department: staff.department || '',
    designation: staff.designation || '',
    month: monthName,
    payrollMonth,
    year,
    salaryPeriodStart: startDate,
    salaryPeriodEnd: endDate,
    monthlySalary,
    dailySalary,
    workingDaysInMonth: 30,
    presentDays: Math.round(presentDays * 10) / 10,
    lateDays,
    unpaidLeaveDays: Math.round(unpaidLeaveDays * 10) / 10,
    approvedPaidLeaveDays,
    leaveDaysTaken: leaveDaysTaken.length,
    waivedLeaveDays: waivedLeaveDates.length,
    chargeableLeaveDays,
    holidayDays,
    weeklyOffDays,
    absentDays,
    notMarkedDays,
    notMarkedDeduction,
    lateDeduction,
    unpaidLeaveDeduction,
    notEmployedDays: daysBeforeStart,
    notEmployedDeduction,
    otherDeductions: otherDeductions || 0,
    basicSalary,
    allowances: {},
    deductions: {
      leaveDeduction: unpaidLeaveDeduction,
      notMarkedDeduction,
      other: lateDeduction + notEmployedDeduction + (otherDeductions || 0),
    },
    totalAllowances,
    totalDeductions,
    grossSalary: monthlySalary,
    netSalary,
    paymentStatus: 'PENDING',
    salarySlipNumber: slipNumber,
    remarks: `Generated monthly payroll for ${monthName}`,
    auditLog: [
      {
        action: 'PAYROLL_GENERATED',
        performedBy: generatedBy || 'SYSTEM_SCHEDULER',
        timestamp: new Date().toISOString(),
        details: `Calculated monthly salary ₹${monthlySalary} with ₹${lateDeduction} late deduction, ₹${unpaidLeaveDeduction} leave deduction${notMarkedDays ? `, ₹${notMarkedDeduction} for ${notMarkedDays} working day(s) without attendance` : ''}${daysBeforeStart ? ` and ₹${notEmployedDeduction} for ${daysBeforeStart} day(s) before the salary start date` : ''} (${leaveDaysTaken.length} leave day(s), ${waivedLeaveDates.length} forgiven, ${chargeableLeaveDays} deducted)`,
      },
    ],
  };

  return payrollRecord;
}
