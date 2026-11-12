/**
 * Response contracts for the Teacher Portal endpoints.
 * Mirrors the shapes returned by server.ts:
 *   GET /api/teacher/dashboard-summary
 *   GET /api/teacher/authorized-assignments
 * Fields are optional where the server may omit them; the UI must handle absence.
 */

export type TeacherSlotStatus = 'COMPLETED' | 'ACTIVE' | 'UPCOMING';

export interface TeacherProfileSummary {
  id: string;
  name: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  classTeacherOf?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  assignedSubjects?: string[];
}

export interface TeacherAttendanceStatus {
  isMarked: boolean;
  present: number;
  absent: number;
  late: number;
  leave: number;
}

export interface TeacherAssignedSectionSummary {
  classId: string;
  className: string;
  section: string;
  isClassTeacher: boolean;
  studentCount: number;
  subjects: string[];
  attendance: TeacherAttendanceStatus;
}

export interface TeacherTodaySlot {
  id: string;
  dayOfWeek?: string;
  day?: string;
  periodNumber: number;
  startTime?: string;
  endTime?: string;
  subjectName?: string;
  className?: string;
  section?: string;
  roomNumber?: string;
  status: TeacherSlotStatus;
}

export interface TeacherUpcomingExam {
  id: string;
  name?: string;
  title?: string;
  examType?: string;
  startDate?: string;
  endDate?: string;
  venue?: string;
  resultsStatus?: string;
}

export interface TeacherPendingMarksTask {
  examId: string;
  examTitle: string;
  classId: string;
  className: string;
  section: string;
  subjectId: string;
  subjectName: string;
  totalStudents: number;
  enteredCount: number;
  missingCount: number;
  status: 'PENDING' | 'IN_PROGRESS';
}

export interface TeacherActionableTask {
  id: string;
  type: 'ATTENDANCE' | 'MARKS_ENTRY' | string;
  title: string;
  description: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  module: string;
}

export interface TeacherNotice {
  id: string;
  title?: string;
  content?: string;
  createdAt?: string;
  targetAudience?: string;
}

export interface TeacherLeaveSummary {
  totalApprovedDays: number;
  pendingRequests: number;
  casualLeavesTaken: number;
  sickLeavesTaken: number;
  remainingBalance: number;
  totalAnnualQuota: number;
}

export interface TeacherQuickStats {
  totalAssignedStudents: number;
  assignedClassesCount: number;
  assignedSubjectsCount: number;
  scheduledPeriodsToday: number;
  completedPeriodsToday: number;
  pendingAttendanceCount: number;
  pendingMarksCount: number;
  leaveBalance: number;
}

export interface TeacherDashboardSummary {
  teacher: TeacherProfileSummary;
  todayDate: string;
  todayDay: string;
  academicSession: string;
  assignedClasses: TeacherAssignedSectionSummary[];
  assignedSubjects: string[];
  todayTimetable: TeacherTodaySlot[];
  upcomingExams: TeacherUpcomingExam[];
  pendingMarksTasks: TeacherPendingMarksTask[];
  tasks: TeacherActionableTask[];
  recentNotices: TeacherNotice[];
  leaveSummary: TeacherLeaveSummary;
  quickStats: TeacherQuickStats;
}

export interface TeacherClassAssignment {
  classId: string;
  className: string;
  sections: string[];
}

export interface TeacherSubjectRef {
  id: string;
  name: string;
}

export interface TeacherTeachingAssignmentDetail {
  classId: string;
  className: string;
  section: string;
  isClassTeacher?: boolean;
  subjects: TeacherSubjectRef[];
}

/** One class as listed on My Classes: its sections, the teacher's subjects there and student counts. */
export interface TeacherClassGroup {
  classId: string;
  className: string;
  isClassTeacher: boolean;
  studentCount: number;
  sections: Array<{ section: string; isClassTeacher: boolean; studentCount: number }>;
  subjects: string[];
}

export interface TeacherAuthorizedAssignments {
  success?: boolean;
  allAccess: boolean;
  teacherId?: string;
  employeeId?: string;
  teacherName?: string;
  classTeacherOf?: string;
  classes: TeacherClassAssignment[];
  subjects: TeacherSubjectRef[];
  detailedAssignments?: TeacherTeachingAssignmentDetail[];
  /** Classes the teacher is assigned to (class incharge, teaching profile, assigned classes, timetable). */
  assignedClasses?: TeacherClassGroup[];
  /** Classes the teacher is qualified for but not assigned to. */
  qualifiedOnlyClasses?: TeacherClassGroup[];
}

