/**
 * Maps the /api/dashboard/summary payload to what the Admin Dashboard shows.
 * Nothing is invented: a field the server did not send becomes `null` and the UI shows "—".
 */
export interface CountPair { name: string; count: number }
export interface ClassSectionRow { classId: string; className: string; total: number; sections: CountPair[] }
export interface AttendanceBlock {
  recorded: boolean;
  present: number | null;
  absent: number | null;
  leave: number | null;
  notMarked: number | null;
  percentText: string;
}
export interface AdminDashboardModel {
  session: string;
  dateLabel: string;
  students: { total: number | null; active: number | null; inactive: number | null; hostel: number | null; dayScholars: number | null };
  staff: { total: number | null; active: number | null; inactive: number | null; teaching: number | null; nonTeaching: number | null };
  classes: ClassSectionRow[];
  departments: CountPair[];
  studentAttendance: AttendanceBlock;
  staffAttendance: AttendanceBlock;
  /** null when the signed-in role may not view fee data. */
  fees: null | { today: string; month: string; pending: string; studentsWithDues: number | null; recent: Array<{ id: string; student: string; amount: string; mode: string; date: string }> };
  upcomingExams: Array<{ id: string; name: string; dateLabel: string }>;
  events: Array<{ id: string; title: string; dateLabel: string }>;
  notices: Array<{ id: string; title: string; dateLabel: string }>;
  timetable: { dayName: string; scheduled: number | null; first: Array<{ id: string; period: string; subject: string; where: string }> };
}

const num = (v: any): number | null => (typeof v === 'number' && isFinite(v) ? v : v != null && v !== '' && isFinite(Number(v)) ? Number(v) : null);

export const formatInr = (v: any): string => {
  const n = num(v);
  return n === null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const formatShortDate = (iso?: string): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const d = new Date(`${iso.substring(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const attendanceBlock = (a: any, absentKey: 'absent', leaveKey: 'leave' | 'onLeave', totalKey: string): AttendanceBlock => {
  const recorded = !!a?.isMarked;
  return {
    recorded,
    present: recorded ? num(a.present) : null,
    absent: recorded ? num(a[absentKey]) : null,
    leave: recorded ? num(a[leaveKey]) : null,
    notMarked: num(a?.notMarked ?? (num(a?.[totalKey]) !== null && num(a?.totalMarked) !== null ? a[totalKey] - a.totalMarked : null)),
    percentText: recorded && num(a.percentage) !== null ? `${a.percentage}%` : 'Not recorded',
  };
};

export function buildAdminDashboardModel(s: any): AdminDashboardModel {
  const so = s?.studentOverview || {};
  const fo = s?.staffOverview || {};
  const total = num(so.total ?? s?.enrolledStudents);
  const active = num(so.active ?? s?.totalStudents);
  const staffActive = num(fo.active ?? s?.totalStaff);
  const staffTotal = num(fo.total);

  return {
    session: String(s?.academicSession || ''),
    dateLabel: formatShortDate(s?.todayDate),
    students: {
      total,
      active,
      inactive: num(so.inactive ?? (total !== null && active !== null ? total - active : null)),
      hostel: num(so.hostel),
      dayScholars: num(so.dayScholars),
    },
    staff: {
      total: staffTotal ?? staffActive,
      active: staffActive,
      inactive: num(fo.inactive),
      teaching: num(fo.teaching ?? s?.totalTeachers),
      nonTeaching: num(fo.nonTeaching ?? s?.totalNonTeaching),
    },
    classes: Array.isArray(so.classSections)
      ? so.classSections.map((c: any) => ({
          classId: String(c.classId),
          className: String(c.className),
          total: num(c.total) ?? 0,
          sections: (c.sections || []).map((x: any) => ({ name: String(x.name), count: num(x.count) ?? 0 })),
        }))
      : (Array.isArray(s?.classDistribution) ? s.classDistribution : [])
          .filter((c: any) => c.id !== '__not_in_active_class')
          .map((c: any) => ({ classId: String(c.id), className: String(c.name), total: num(c.count) ?? 0, sections: [] })),
    departments: Array.isArray(fo.departments) ? fo.departments.map((d: any) => ({ name: String(d.name), count: num(d.count) ?? 0 })) : [],
    studentAttendance: attendanceBlock(s?.attendance, 'absent', 'leave', 'totalActive'),
    staffAttendance: attendanceBlock(s?.staffAttendance, 'absent', 'onLeave', 'totalStaff'),
    fees: s?.fees
      ? {
          today: formatInr(s.fees.todayCollection),
          month: formatInr(s.fees.monthlyCollection),
          pending: formatInr(s.fees.pendingAmount),
          studentsWithDues: num(s.fees.studentsWithPendingCount),
          recent: (Array.isArray(s.fees.recentPayments) ? s.fees.recentPayments : []).slice(0, 5).map((p: any) => ({
            id: String(p.id || p.receiptNumber),
            student: String(p.studentName || '—'),
            amount: formatInr(p.amount),
            mode: String(p.paymentMode || ''),
            date: formatShortDate(p.paymentDate),
          })),
        }
      : null,
    upcomingExams: (Array.isArray(s?.upcomingExams) ? s.upcomingExams : []).map((e: any) => ({
      id: String(e.id),
      name: String(e.name || e.title || 'Examination'),
      dateLabel: [formatShortDate(e.startDate), formatShortDate(e.endDate)].filter(Boolean).join(' – '),
    })),
    events: (Array.isArray(s?.upcomingEvents) ? s.upcomingEvents : []).map((e: any) => ({
      id: String(e.id),
      title: String(e.title || e.name || 'Event'),
      dateLabel: formatShortDate(e.eventDate),
    })),
    notices: (Array.isArray(s?.recentNotices) ? s.recentNotices : []).map((n: any) => ({
      id: String(n.id),
      title: String(n.title || 'Notice'),
      dateLabel: formatShortDate(n.publishedDate),
    })),
    timetable: {
      dayName: String(s?.timetable?.todayDay || s?.todayDay || ''),
      scheduled: num(s?.timetable?.scheduledCount ?? s?.academics?.scheduledPeriodsToday),
      first: (Array.isArray(s?.timetable?.slots) ? s.timetable.slots : []).slice(0, 3).map((t: any, i: number) => ({
        id: String(t.id || i),
        period: `P${t.periodNumber ?? i + 1}`,
        subject: String(t.subjectName || ''),
        where: [t.className, t.section].filter(Boolean).join(' '),
      })),
    },
  };
}

export const showCount = (v: number | null): string => (v === null ? '—' : String(v));
