export type UserRole =
  | 'SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'PRINCIPAL'
  | 'VICE_PRINCIPAL'
  | 'SUPPORT_STAFF'
  | 'ACADEMIC_COORDINATOR'
  | 'ACCOUNTANT'
  | 'TEACHER'
  | 'HOSTEL_WARDEN'
  | 'TRANSPORT_MANAGER'
  | 'HR_STAFF'
  | 'PARENT'
  | 'STUDENT';

export type PermissionKey =
  | 'students.view'
  | 'students.create'
  | 'students.edit'
  | 'students.delete'
  | 'students.admit'
  | 'attendance.view'
  | 'attendance.mark'
  | 'attendance.edit'
  | 'attendance.approve'
  | 'exams.view'
  | 'exams.create'
  | 'exams.edit'
  | 'exams.marks.enter'
  | 'exams.marks.edit'
  | 'results.publish'
  | 'fees.view'
  | 'fees.structure.manage'
  | 'fees.collect'
  | 'fees.refund'
  | 'fees.waive'
  | 'fees.export'
  | 'staff.view'
  | 'staff.manage'
  | 'hr.manage'
  | 'payroll.view'
  | 'payroll.manage'
  | 'academics.view'
  | 'academics.manage'
  | 'timetable.view'
  | 'timetable.manage'
  | 'hostel.view'
  | 'hostel.manage'
  | 'transport.view'
  | 'transport.manage'
  | 'communication.view'
  | 'communication.manage'
  | 'notices.publish'
  | 'sms.send'
  | 'documents.view'
  | 'documents.generate'
  | 'reports.view'
  | 'reports.export'
  | 'website.view'
  | 'website.manage'
  | 'users.view'
  | 'users.create'
  | 'users.manage'
  | 'roles.manage'
  | 'permissions.manage'
  | 'settings.view'
  | 'settings.manage'
  | 'audit_logs.view';

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  role: UserRole;
  employeeId?: string;
  studentId?: string;
  // Present on STUDENT sessions when the server includes the enrolled class.
  classId?: string;
  section?: string;
  activeStudentId?: string;
  linkedStudentIds?: string[];
  permissions?: PermissionKey[];
  customPermissions?: PermissionKey[];
  deniedPermissions?: PermissionKey[];
  avatar?: string;
  status?: string;
  gender?: string;
  address?: string;
  createdAt?: string;
}

export interface SchoolSettings {
  schoolName: string;
  schoolCode: string;
  affiliationNumber: string;
  affiliationCode?: string;
  address: string;
  schoolAddress?: string;
  phone: string;
  email: string;
  website: string;
  academicYear: string;
  currentAcademicSession?: string;
  academicSession?: string;
  workingDays?: string[];
  principalName?: string;
  principalSignature?: string;
  logoFileKey?: string;
  schoolLogo?: string;
  affiliatedBoard?: string;
  contactNumber?: string;
  headerContacts?: string[];
  helplineNumber?: string;
  registrationNumber?: string;
  classesOffered?: string;
}


export interface Student {
  id: string;
  admissionNumber: string;
  name: string;
  firstName?: string;
  lastName?: string;
  rollNumber?: string;
  classId: string;
  className: string;
  section: string;
  dob: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  fatherName?: string;
  motherName?: string;
  parentPhone?: string;
  fatherMobile?: string;
  photo?: string;
  photoFileKey?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ALUMNI' | 'SUSPENDED';
  academicSession: string;
  attendancePercentage?: number;
  totalDue?: number;
}

export interface Staff {
  id: string;
  employeeId: string;
  name: string;
  role?: UserRole;
  designation?: string;
  department?: string;
  phone?: string;
  email?: string;
  bloodGroup?: string;
  joiningDate?: string;
  qualification?: string;
  experience?: string;
  photo?: string;
  photoFileKey?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  classesQualifiedToTeach?: string | string[];
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
  school?: {
    name: string;
    code: string;
    session: string;
  };
  expiresAt?: number;
}

export interface MobileModule {
  id: string;
  title: string;
  description: string;
  iconName: string;
  roles: UserRole[];
  permission?: PermissionKey;
  badge?: string;
  color: string;
  isImplementedInPhase1: boolean;
}

export type LoginTabType = 'staff' | 'student' | 'parent';

export interface TimetableSlot {
  id: string;
  dayOfWeek: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  section: string;
  teacherId: string;
  teacherName: string;
  roomNumber?: string;
  academicSession?: string;
}

export interface AttendanceRecord {
  id?: string;
  studentId: string;
  studentName?: string;
  rollNumber?: string;
  admissionNumber?: string;
  classId: string;
  className?: string;
  section: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY';
  remarks?: string;
}

export interface StaffAttendanceRecord {
  id?: string;
  staffId: string;
  employeeId?: string;
  staffName: string;
  department?: string;
  designation?: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE' | 'HALF_DAY';
  remarks?: string;
}

export interface Exam {
  id: string;
  name: string;
  examType?: string;
  academicSession?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  isMarksEntryOpen?: boolean;
  maxMarks?: number;
  schedule?: ExamPaper[];
  classIds?: string[];
  section?: string;
}

/** One scheduled paper of an exam (subject, date, time, class). */
export interface ExamPaper {
  id?: string;
  subjectId?: string;
  passMarks?: number;
  classId?: string;
  className?: string;
  section?: string;
  subjectName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  maxMarks?: number;
  roomNumber?: string;
  instructions?: string;
}

export interface ExamMark {
  id?: string;
  examId: string;
  studentId: string;
  studentName?: string;
  admissionNumber?: string;
  rollNumber?: string;
  classId: string;
  section: string;
  subjectId: string;
  marksObtained: number;
  maxMarks: number;
  grade?: string;
  isAbsent?: boolean;
  status?: 'DRAFT' | 'SUBMITTED';
}

export interface StaffPayrollRecord {
  id: string;
  staffId?: string;
  employeeId: string;
  staffName: string;
  month: string;
  year?: number;
  salaryPeriodStart?: string;
  salaryPeriodEnd?: string;
  basicSalary: number;
  grossSalary?: number;
  netSalary: number;
  allowancesTotal?: number;
  deductionsTotal?: number;
  paymentStatus?: 'PAID' | 'PENDING' | 'PROCESSED';
  status?: 'PAID' | 'PENDING' | 'PROCESSED';
  paymentDate?: string;
  paymentMode?: string;
  transactionReference?: string;
  salarySlipNumber?: string;
  breakdown?: {
    allowances?: Array<{ name: string; amount: number }>;
    deductions?: Array<{ name: string; amount: number }>;
  };
}

export interface ClassItem {
  id: string;
  name: string;
  sections: string[] | Array<{ id: string; name: string }>;
  numericOrder?: number;
}

export interface SubjectItem {
  id: string;
  name: string;
  code?: string;
  type?: string;
  status?: string;
  classIds?: string[];
  maxMarks?: number;
}
