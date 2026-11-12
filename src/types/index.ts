export type UserRole =
  | 'SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'PRINCIPAL'
  | 'TEACHER'
  | 'ACCOUNTANT'
  | 'HR_STAFF'
  | 'HOSTEL_WARDEN'
  | 'TRANSPORT_MANAGER'
  | 'ACADEMIC_COORDINATOR'
  | 'VICE_PRINCIPAL'
  | 'SUPPORT_STAFF'
  | 'PARENT'
  | 'STUDENT';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  permissions?: string[];
  deniedPermissions?: string[];
  employeeId?: string;
  studentId?: string;
  linkedStudentIds?: string[]; // For Parent role: array of children student IDs
  activeStudentId?: string; // Currently active child viewed in parent session
  avatar?: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt?: string;
  lastLoginAt?: string;
  mustChangePassword?: boolean;
}

export interface AdminAccount {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  avatar?: string;
  photo?: string;
  photoFileKey?: string;
  role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  loginEnabled?: boolean;
  passwordHash?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface ParentAccount {
  id: string;
  name?: string;
  parentName?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  studentIds: string[];
  loginEnabled: boolean;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  passwordHash?: string;
  lastLoginAt?: string;
}

export interface UserWithAuth extends User {
  passwordHash?: string;
  failedLoginAttempts?: number;
  lockoutUntil?: number;
  passwordResetToken?: string;
  passwordResetExpires?: number;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: number;
}

export interface SchoolPaymentDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  upiId: string;
  upiQrCode?: string;
  upiQrCodeFileKey?: string;
  instructions?: string;
}

export interface StudentApplicableFeeHead {
  id?: string;
  head: string;
  category: 'ONE_TIME' | 'MONTHLY' | 'YEARLY' | 'EXAMINATION' | 'FACILITY' | 'OTHER';
  frequency: 'One Time' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'Event/Exam Based';
  amount: number;
  selected: boolean;
  isDefault?: boolean;
  remarks?: string;
}

export interface StudentFeeProfileData {
  classFeeConfigId?: string;
  className?: string;
  section?: string;
  academicSession?: string;
  feeHeads: StudentApplicableFeeHead[];
  totalOneTimeFee: number;
  totalMonthlyFee: number;
  totalYearlyFee: number;
  totalApplicableFee: number;
  monthlyPayableAmount: number;
  transportIncluded?: boolean;
  hostelIncluded?: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface MobileAppUpdateSettings {
  /** Android build number (versionCode) of the newest app on the Play Store. Older apps show the update popup. */
  latestVersionCode?: number;
  /** Shown to users, e.g. "1.0.6". */
  latestVersionName?: string;
  /** Apps older than this cannot skip the popup ("Later" is hidden). */
  minVersionCode?: number;
  message?: string;
  storeUrl?: string;
}

export interface SchoolSettings {
  mobileAppUpdate?: MobileAppUpdateSettings;
  schoolName: string;
  schoolCode: string;
  affiliationNumber: string;
  affiliationCode?: string;
  affiliatedBoard: 'CBSE' | 'ICSE' | 'STATE_BOARD' | 'IB' | string;
  classesOffered?: string;
  headerContacts?: string[];
  footerContacts?: string[];
  helplineNumber?: string;
  schoolLogo: string;
  logoFileKey?: string;
  principalSignature?: string;
  principalSignatureFileKey?: string;
  /** Controller of Examinations: printed on staff-issued marksheets (never on the public result page). */
  examControllerName?: string;
  examControllerSignature?: string;
  examControllerSignatureFileKey?: string;
  schoolAddress: string;
  additionalAddress?: string;
  principalName: string;
  contactNumber: string;
  email: string;
  website: string;
  registrationNumber: string;
  currentAcademicSession: string;
  currentSession?: string;
  academicSessions?: AcademicSession[];
  schoolStartTime?: string;
  schoolEndTime?: string;
  timetableDays?: string[];
  schoolTiming: {
    startTime: string;
    endTime: string;
  };
  workingDays: string[];
  gradingSystem: GradeDefinition[];
  plusCode?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  paymentOptions?: SchoolPaymentDetails;
  bankDetails?: SchoolPaymentDetails;
  customExamTypes?: string[];
  feeSettings?: {
    lateFeeAmount?: number;
    dueDayOfMonth?: number;
    lateFeeStartDay?: number;
  };
}

export interface AcademicSession {
  id: string;
  name: string; // e.g., "2026-2027"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GradeDefinition {
  id?: string;
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number;
  status: 'PASS' | 'FAIL';
  description: string;
  academicSession?: string;
}

export interface AcademicSection {
  id: string;
  name: string; // e.g., "A", "B", "C"
  maxCapacity: number; // default e.g. 40
  classTeacherId?: string;
  classTeacherName?: string;
  roomNumber?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface AcademicClass {
  id: string;
  name: string; // e.g., "Class 1", "Class 10"
  numericOrder: number;
  sections: string[]; // ['A', 'B', 'C'] for backward compatibility
  detailedSections?: AcademicSection[];
  classTeacherId?: string;
  classTeacherName?: string;
  classTeacher?: string;
  maxCapacity?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  academicSession?: string;
  description?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  type: 'CORE' | 'ELECTIVE' | 'OPTIONAL' | 'ACTIVITY';
  classIds: string[];
  maxMarks?: number;
  passMarks?: number;
  theoryMarks?: number;
  practicalMarks?: number;
  credits?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  department?: string;
  academicSession?: string;
}

export interface AttachedDocument {
  id: string;
  title: string;
  fileKey: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  url?: string;
  previewUrl?: string;
  downloadUrl?: string;
  type?: string;
  fileName?: string;
  documentType?: 'BIRTH_CERTIFICATE' | 'AADHAAR' | 'TRANSFER_CERTIFICATE' | 'CHARACTER_CERTIFICATE' | 'MIGRATION' | 'BONAFIDE' | 'PREVIOUS_MARKSHEET' | 'OTHER' | string;
  customDocumentTitle?: string;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedBy?: string;
  verifiedAt?: string;
  verificationRemark?: string;
}

export type StudentStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'TRANSFERRED'
  | 'WITHDRAWN';

export type CertificateType = 'TC' | 'BONAFIDE' | 'CHARACTER';

export interface AcademicPromotionRecord {
  session: string;
  className: string;
  section: string;
  rollNumber: string;
  result?: string;
  percentage?: number;
  promotionDate?: string;
  status?: string;
}

export interface StudentActivityRecord {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  performedBy?: string;
  category?: 'ADMISSION' | 'ACADEMIC' | 'STATUS' | 'DOCUMENT' | 'FEE' | 'EXAM' | 'PORTAL' | 'GENERAL';
}

export interface Student {
  id: string;
  schoolId?: string;
  admissionNumber: string; // 8 digits (e.g. 20260401)
  registrationNumber: string; // PDS2026040001
  rollNumber: string; // digits only, unique class-wise
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  photo?: string;
  photoFileKey?: string;
  documents?: AttachedDocument[];
  dob: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup: string;
  aadhaarNumber?: string;
  /** APAAR ID (Automated Permanent Academic Account Registry), 12 digits. */
  apaarId?: string;
  fatherAadhaar?: string;
  motherAadhaar?: string;
  category?: 'GENERAL' | 'OBC' | 'SC' | 'ST' | 'EWS';
  religion?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  mobile: string;
  email?: string;
  admissionDate: string;
  admittedBy?: string;
  /** Last admission-letter email. ACCEPTED = taken by the email service for delivery (not proof of delivery). */
  admissionLetterEmail?: {
    status: 'ACCEPTED' | 'FAILED';
    at: string;
    recipient: string; // masked address
    messageId?: string;
    by?: string;
    error?: string;
  };
  enrollmentDate?: string; // Controlling date for fee billing
  feeStartDate?: string; // Fee Start Date = Enrollment Date automatically
  portalEntryDate?: string; // Date student record was entered into ERP portal
  classId: string;
  className: string;
  section: string;
  parentName: string;
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  parentPhone: string;
  fatherMobile?: string;
  motherMobile?: string;
  guardianMobile?: string;
  parentEmail?: string;
  parentOccupation?: string;
  fatherOccupation?: string;
  fatherEmail?: string;
  motherOccupation?: string;
  motherEmail?: string;
  guardianRelationship?: string;
  emergencyContact: string;
  emergencyContactName?: string;
  emergencyRelationship?: string;
  secondaryEmergencyContact?: string;
  secondaryEmergencyName?: string;
  previousSchool?: string;
  previousClassPassed?: 'Yes' | 'No' | string;
  previousClass?: string;
  previousMarks?: string;
  previousSession?: string;
  academicSession: string;
  status: StudentStatus;
  hostelRequired?: boolean;
  hostelId?: string;
  hostelRoomId?: string;
  hostelFloor?: number;
  hostelBedNumber?: string;
  hostelName?: string;
  hostelWarden?: string;
  hostelAllocationDate?: string;
  hostelStatus?: 'ACTIVE' | 'VACATED';
  hostelMonthlyFee?: number;
  messMonthlyFee?: number;
  transportRouteId?: string;
  transportStopName?: string;
  transportStopId?: string;
  transportRequired?: boolean;
  transportSlabId?: string;
  transportDistanceKm?: number;
  transportMonthlyFee?: number;
  dressCodeSelected?: boolean;
  booksSelected?: boolean;
  pickupPoint?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverContact?: string;
  // Medical & Special Care
  identificationMark?: string;
  allergies?: string;
  medicalConditions?: string;
  medications?: string;
  doctorName?: string;
  doctorContact?: string;
  specialMedicalInstructions?: string;
  // Long-term history
  academicHistory?: AcademicPromotionRecord[];
  activityHistory?: StudentActivityRecord[];
  // Portal login integration
  loginEnabled?: boolean;
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  passwordHash?: string;
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockoutUntil?: number;
  passwordResetToken?: string;
  passwordResetTokenHash?: string;
  passwordResetExpires?: number;
  // Applicable Fee Profile (Dynamically configured class fee heads & facilities)
  feeProfile?: StudentFeeProfileData;
}

export interface StaffLeave {
  id: string;
  staffId: string;
  staffName: string;
  employeeId: string;
  leaveType: 'CASUAL' | 'SICK' | 'MATERNITY' | 'EARNED' | 'DUTY' | 'OTHER' | 'UNPAID' | 'LWP';
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  document?: string;
  documentName?: string;
}

export interface StaffPayrollRecord {
  id: string;
  staffId: string;
  staffName: string;
  employeeId: string;
  uanNumber?: string;
  department?: string;
  designation?: string;
  month: string; // e.g. "September 2026"
  payrollMonth?: string; // e.g. "2026-09"
  year: number;
  salaryPeriodStart?: string;
  salaryPeriodEnd?: string;
  monthlySalary?: number;
  dailySalary?: number;
  workingDaysInMonth?: number;
  presentDays?: number;
  lateDays?: number;
  unpaidLeaveDays?: number;
  approvedPaidLeaveDays?: number;
  leaveDaysTaken?: number;
  waivedLeaveDays?: number;
  chargeableLeaveDays?: number;
  holidayDays?: number;
  weeklyOffDays?: number;
  /** Working days marked Absent (each = one day's salary). */
  absentDays?: number;
  /** Working days with no attendance mark at all (each = one day's salary). */
  notMarkedDays?: number;
  notMarkedDeduction?: number;
  lateDeduction?: number;
  unpaidLeaveDeduction?: number;
  /** Calendar days of the month before the person's salary start date (joined mid-month). */
  notEmployedDays?: number;
  notEmployedDeduction?: number;
  otherDeductions?: number;
  basicSalary: number;
  allowances: {
    hra?: number;
    da?: number;
    ta?: number;
    special?: number;
    other?: number;
  };
  deductions: {
    pf?: number;
    tds?: number;
    insurance?: number;
    leaveDeduction?: number;
    notMarkedDeduction?: number;
    other?: number;
  };
  totalAllowances: number;
  totalDeductions: number;
  grossSalary?: number;
  netSalary: number;
  paymentStatus: 'PAID' | 'PENDING' | 'GENERATED' | 'FAILED' | 'PROCESSING';
  paymentDate?: string;
  paymentMethod?: 'BANK_TRANSFER' | 'CHEQUE' | 'UPI' | 'CASH';
  transactionReference?: string;
  salarySlipNumber?: string;
  paidBy?: string;
  paidByName?: string;
  remarks?: string;
  auditLog?: Array<{
    action?: string;
    performedBy?: string;
    timestamp?: string;
    details?: string;
  }>;
}

export interface TeacherStaff {
  id: string;
  employeeId: string; // PDS0001
  name: string;
  photo?: string;
  photoFileKey?: string;
  documents?: AttachedDocument[];
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dob: string;
  phone: string;
  email: string;
  alternatePhone?: string;
  address: string;
  fatherName?: string;
  motherName?: string;
  fatherOrMotherName?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  city?: string;
  state?: string;
  pincode?: string;
  // Detailed Permanent & Current Address
  permanentAddress?: string;
  permanentState?: string;
  permanentCity?: string;
  permanentPincode?: string;
  currentAddress?: string;
  currentState?: string;
  currentCity?: string;
  currentPincode?: string;
  sameAsPermanentAddress?: boolean;
  previousSchool?: string;
  employmentType?: 'Full Time' | 'Part Time' | 'Contract' | 'Temporary' | 'PERMANENT' | 'PROBATION' | 'VISITING' | string;
  qualification: string;
  customQualification?: string;
  experienceYears?: number;
  totalExperience?: string;
  joiningDate: string;
  /** First day the ERP pays salary for (YYYY-MM-DD). Earlier months were paid outside the ERP. */
  salaryStartDate?: string;
  designation: string;
  department?: 'ACADEMICS' | 'ADMINISTRATION' | 'ACCOUNTS' | 'SPORTS' | 'HOSTEL' | 'TRANSPORT' | string;
  customDepartment?: string;
  subjectExpertise?: string[]; // Dynamic from Academic Structure subjects
  specializationSubjects?: string[]; // Kept for backward compatibility
  classesQualifiedToTeach?: string;
  qualifiedClasses?: string[];
  /** Sections taught in each qualified class: [{ className, sections }]. A class with no entry covers all its active sections. */
  qualifiedClassSections?: Array<{ className: string; sections: string[] }>;
  certifications?: string;
  certificationsList?: string[];
  customCertification?: string;
  assignedClasses: string[]; // e.g. ["Class 10-A", "Class 9-B"]
  assignedSubjects: string[]; // e.g. ["Mathematics", "Physics"]
  classTeacherOf?: string;
  houseClubResponsibility?: string;
  houseClubResponsibilities?: string[];
  customHouseClub?: string;
  salary: {
    basic: number;
    allowances: number;
    deductions: number;
    net: number;
  };
  monthlySalary?: number;
  bankAccountNo?: string;
  ifscCode?: string;
  bankName?: string;
  bankBranch?: string;
  panNumber?: string;
  uanNumber?: string;
  // Role and Designation
  portalRole?: UserRole;
  alsoPerformsTeaching?: boolean;
  assignedPrimarySubject?: string;
  /** @deprecated Folded into subjectExpertise. Read only to migrate old records. */
  additionalSubjects?: string[];
  teachingWorkload?: number;
  academicDepartment?: string;
  academicResponsibilities?: string;
  administrativeResponsibilities?: string;
  accountingResponsibilities?: string;
  hrResponsibilities?: string;
  employeeManagementScope?: string;
  payrollHrAccessScope?: string;
  hostelId?: string;
  hostelName?: string;
  hostelBlock?: string;
  wardenResponsibility?: string;
  dutyTiming?: string;
  residentialDuty?: boolean;
  emergencyResponsibility?: string;
  transportResponsibility?: string;
  assignedRoutes?: string[];
  assignedVehicles?: string[];
  operationsResponsibility?: string;

  // Structured role-specific profiles for clean persistence
  teachingProfile?: {
    subjectExpertise?: string[];
    classesQualifiedToTeach?: string[];
    assignedClassId?: string;
    assignedClassName?: string;
    assignedSection?: string;
    assignedPrimarySubject?: string;
    additionalSubjects?: string[];
    teachingWorkloadPeriods?: number;
    academicDepartment?: string;
    isClassTeacher?: boolean;
    houseClubResponsibility?: string;
  };
  departmentAssignment?: {
    departmentName?: string;
    responsibilities?: string;
    administrativeScope?: string;
  };
  hostelAssignment?: {
    hostelId?: string;
    hostelName?: string;
    hostelBlock?: string;
    wardenResponsibility?: string;
    shiftTiming?: string;
    residentialDuty?: boolean;
    emergencyResponsibility?: string;
  };
  transportAssignment?: {
    assignedRouteIds?: string[];
    assignedVehicleIds?: string[];
    transportResponsibility?: string;
    dutyTiming?: string;
    operationsResponsibility?: string;
  };
  payrollInformation?: {
    monthlyGrossSalary?: number;
    bankAccountNo?: string;
    ifscCode?: string;
    bankName?: string;
    bankBranch?: string;
    panNumber?: string;
    uanNumber?: string;
    accountingResponsibilities?: string;
  };
  hrProfile?: {
    hrResponsibilities?: string;
    employeeManagementScope?: string;
    payrollHrAccessScope?: string;
  };
  adminProfile?: {
    administrativeDepartment?: string;
    systemResponsibilities?: string;
  };
  academicCoordinatorProfile?: {
    academicDepartment?: string;
    academicResponsibilities?: string;
  };

  status: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
  leaves?: StaffLeave[];
  payrollHistory?: StaffPayrollRecord[];
  // Portal login integration
  loginEnabled?: boolean;
  systemRole?: UserRole; // Role mapping for ERP authorization
  role?: UserRole;
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'RESIGNED' | 'LEFT_SCHOOL' | string;
  passwordHash?: string;
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockoutUntil?: number;
  passwordResetToken?: string;
  passwordResetTokenHash?: string;
  passwordResetExpires?: number;
}

export interface TimetablePeriodConfig {
  periodNumber: number;
  name?: string;
  startTime: string; // e.g. "08:00 AM"
  endTime: string;   // e.g. "08:45 AM"
  isBreak?: boolean;
  breakType?: 'RECESS' | 'LUNCH' | 'ASSEMBLY';
}

export interface TimetableSlot {
  id: string;
  classId: string;
  className: string;
  section: string;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | string;
  day?: string;
  periodNumber: number;
  period?: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  roomNumber: string;
  academicSession?: string;
}

export interface TeacherAssignedClassAttendance {
  isMarked: boolean;
  present: number;
  absent: number;
  late: number;
  leave: number;
}

export interface TeacherAssignedClassDetail {
  classId: string;
  className: string;
  section: string;
  isClassTeacher: boolean;
  studentCount: number;
  subjects?: string[];
  attendance: TeacherAssignedClassAttendance;
}

export interface TeacherTodayTimetableSlot extends TimetableSlot {
  status: 'COMPLETED' | 'ACTIVE' | 'UPCOMING';
}

export interface TeacherQuickStats {
  totalAssignedStudents: number;
  assignedClassesCount: number;
  assignedSubjectsCount?: number;
  scheduledPeriodsToday: number;
  completedPeriodsToday: number;
  pendingAttendanceCount: number;
  pendingMarksCount: number;
  leaveBalance: number;
}

export interface TeacherLeaveSummary {
  totalApprovedDays: number;
  pendingRequests: number;
  casualLeavesTaken: number;
  sickLeavesTaken: number;
  remainingBalance: number;
  totalAnnualQuota?: number;
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
  type: 'ATTENDANCE' | 'MARKS_ENTRY' | 'EXAM' | 'CIRCULAR' | string;
  title: string;
  description: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  module: string;
}

export interface TeacherDashboardSummary {
  teacher: {
    id: string;
    name: string;
    employeeId: string;
    designation: string;
    department: string;
    classTeacherOf?: string;
    avatar?: string;
    email?: string;
    phone?: string;
    assignedSubjects?: string[];
  };
  todayDate: string;
  todayDay: string;
  academicSession: string;
  assignedClasses: TeacherAssignedClassDetail[];
  assignedSubjects: string[];
  todayTimetable: TeacherTodayTimetableSlot[];
  upcomingExams: any[];
  pendingMarksTasks: TeacherPendingMarksTask[];
  tasks?: TeacherActionableTask[];
  recentNotices: Notice[];
  leaveSummary: TeacherLeaveSummary;
  quickStats: TeacherQuickStats;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  endDate?: string;
  description?: string;
  type?: 'NATIONAL' | 'FESTIVAL' | 'SCHOOL' | 'VACATION' | 'STATE' | 'OTHER';
  academicSession?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StudentAttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'LEAVE'
  | 'HOLIDAY'
  | 'HALF_DAY'
  | 'EXCUSED'
  | 'NOT_MARKED';

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  classId: string;
  section: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY' | 'HALF_DAY' | 'EXCUSED';
  remarks?: string;
  /** Time it was marked Present / Late (scan or manual), e.g. "09:12 AM". */
  checkInTime?: string;
  markedBy?: string;
  markedAt?: string;
  academicSession?: string;
}

export interface StaffAttendanceRecord {
  id: string;
  date: string;
  staffId: string;
  staffName: string;
  employeeId: string;
  department?: string;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'WEEK_OFF' | 'HOLIDAY' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE';
  checkInTime?: string;
  checkOutTime?: string;
  remarks?: string;
  markedBy?: string;
  academicSession?: string;
}

export interface FeeStructure {
  id: string;
  name: string; // e.g. "Tuition Fee Q1", "Admission Fee"
  type: 'ADMISSION' | 'TUITION' | 'TRANSPORT' | 'HOSTEL' | 'EXAM' | 'LIBRARY' | 'COMPUTER' | 'OTHER';
  amount: number;
  classIds: string[];
  dueDate: string;
  academicSession: string;
}

export interface FeeItemConfig {
  id: string;
  name: string;
  category: 'ONE_TIME' | 'MONTHLY' | 'YEARLY' | 'EXAMINATION';
  frequency: 'One Time' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'Event/Exam Based';
  amount: number;
  mandatory: boolean;
  active: boolean;
  effectiveFrom?: string;
  dueDate?: string;
  applicableClass?: string;
  applicableSection?: string;
  description?: string;
}

export interface ExamFeeConfig {
  id: string;
  examName: string;
  amount: number;
  applicableClass: string;
  applicableSection: string; // 'ALL' or specific section
  dueDate?: string;
  frequency: 'One-Time/Event Based' | 'Periodic';
  required: boolean;
  active: boolean;
  remarks?: string;
}

export interface HostelFeeConfig {
  hostelFee: number;
  messFee: number;
  otherHostelCharges?: number;
  otherChargesName?: string;
  frequency: 'Monthly' | 'Quarterly' | 'Yearly';
  active: boolean;
  remarks?: string;
}

export interface ClassFeeConfiguration {
  id: string;
  classId: string;
  className: string;
  section?: string; // 'ALL' or 'A', 'B', etc.
  isSectionOverride?: boolean;
  academicSession: string;
  studentCategory?: string; // 'ALL' or specific category
  effectiveFrom?: string;
  description?: string;
  isActive?: boolean;
  
  // Structured items
  items?: FeeItemConfig[];
  examinationFees?: ExamFeeConfig[];
  hostelConfig?: HostelFeeConfig;

  // Direct head fields (retained for backward compatibility and fast access)
  admissionFee: number; // 1-time
  monthlySchoolFee?: number; // monthly
  monthlyTuitionFee: number; // optional monthly
  dressCodeFee: number; // 1-time
  examFee?: number;
  computerFee?: number;
  computerSmartClassFee?: number;
  sportsFee?: number;
  booksFee?: number;
  booksStationeryFee?: number;
  idCardFee: number;
  annualCharges?: number;
  medicalFee?: number;
  miscFee?: number;
  hostelFee: number;
  messFee: number;
  updatedAt?: string;
}

export interface TransportSlab {
  id: string;
  slabName: string; // e.g. "0 - 1 KM", "1 - 3 KM"
  name?: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  monthlyFee: number;
  monthlyAmount?: number;
  active?: boolean;
  isActive?: boolean;
  description?: string;
  academicSession?: string;
}

export interface FeeLedgerBreakdownItem {
  head: string;
  amount: number;
  isOneTime?: boolean;
}

export interface FeeLedgerEntry {
  id: string;
  invoiceNumber?: string;
  studentId: string;
  admissionNumber: string;
  studentName: string;
  classId?: string;
  className: string;
  section: string;
  academicSession: string;
  feeMonth: string; // e.g. "Admission 2026", "October 2026"
  monthYear?: string;
  billingPeriod?: string;
  feeType: string;
  breakdown: FeeLedgerBreakdownItem[];
  schoolFee?: number;
  transportFee?: number;
  hostelFee?: number;
  messFee?: number;
  amount: number;
  totalAmount?: number;
  discount: number;
  fine: number;
  total: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' | 'WAIVED';
  dueDate: string;
  lateFeeApplied?: boolean;
  /**
   * MONTHLY_FEE: the regular monthly fee bill for feeMonth (made on the 1st, at admission, or in advance).
   * EXTRA: a separate charge from "Add bill"; it never counts as the month's fee bill.
   * Older records have no value.
   */
  billKind?: 'MONTHLY_FEE' | 'EXTRA';
  /** The enrollment month's fee, collected on admission day. */
  collectAtAdmission?: boolean;
  /** Bill made after its usual due date: no late fee before this date (YYYY-MM-DD). */
  graceUntil?: string;
  /** Session whose Books & Stationery this bill covers (admission or promotion). One per session. */
  booksFeeSession?: string;
  /** Session whose yearly exam fee this bill covers (added when the Annual Examination is published). */
  examFeeSession?: string;
  examId?: string;
  paymentDate?: string;
  receiptNumber?: string;
  paymentMethod?: 'CASH' | 'ONLINE_UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'UPI' | 'ONLINE';
  transactionReference?: string;
  collectedBy?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeePayment {
  id: string;
  receiptNumber: string; // REC-2026-001
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  section: string;
  amount: number;
  feeType: string;
  academicSession?: string;
  paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'ONLINE' | string;
  paymentMode?: string;
  transactionReference: string;
  paymentDate: string;
  collectedBy: string;
  discount: number;
  fine?: number;
  ledgerId?: string;
  invoiceNumber?: string;
  balanceDue?: number;
  totalBill?: number;
  baseDue?: number;
  feeMonth?: string;
  billingPeriod?: string;
  remarks?: string;
  breakdown?: { head: string; amount: number }[];
  /** Online payments (PhonePe): our merchant order id and PhonePe's ids. Older receipts may carry other gateway ids. */
  gateway?: 'PHONEPE' | string;
  merchantOrderId?: string;
  phonepeOrderId?: string;
  phonepeTransactionId?: string;
  onlinePaymentMode?: string;
  refundStatus?: string;
}

export interface ExamScheduleItem {
  id?: string;
  classId: string;
  className: string;
  section?: string; // 'ALL' or specific section
  subjectId: string;
  subjectName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "10:00 AM"
  endTime: string; // e.g. "01:00 PM"
  maxMarks: number;
  passMarks: number;
  roomNumber?: string; // Room / Venue
  instructions?: string;
}

export interface Exam {
  id: string;
  title: string; // e.g. "Mid-Term Examination 2026"
  name?: string;
  term?: string;
  examType: 'UNIT_TEST' | 'MID_TERM' | 'FINAL_TERM' | 'PRE_BOARD' | 'PERIODIC_TEST' | 'ANNUAL' | string;
  type?: string;
  classIds: string[];
  section?: string;
  startDate: string;
  endDate: string;
  academicSession: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'UPCOMING' | 'ONGOING';
  admitCardStatus?: 'DRAFT' | 'PUBLISHED';
  resultsStatus?: 'DRAFT' | 'PUBLISHED';
  isApprovedByPrincipal: boolean;
  instructions?: string;
  roomVenue?: string;
  schedule?: ExamScheduleItem[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExamMark {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string;
  classId: string;
  section: string;
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  marksObtained: number;
  isAbsent?: boolean;
  grade: string;
  gradePoint?: number;
  remark?: string;
  remarks?: string;
  status?: 'PASS' | 'FAIL' | 'ABSENT' | 'N/A';
  submissionStatus?: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  enteredBy?: string;
  enteredAt?: string;
  academicSession?: string;
}

export interface ExamResult {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string;
  classId: string;
  className: string;
  section: string;
  totalMaxMarks: number;
  totalMarksObtained: number;
  percentage: number;
  grade: string;
  resultStatus: 'PASS' | 'FAIL';
  rank?: number;
  remarks?: string;
}

export interface Homework {
  id: string;
  classId: string;
  className: string;
  section: string;
  subjectId?: string;
  subjectName: string;
  title: string;
  instructions: string;
  assignedDate: string;
  dueDate: string;
  teacherId?: string;
  teacherName: string;
  academicSession?: string;
  /** Set by the server for staff views: whether the caller may edit or delete this item. */
  canManage?: boolean;
  attachmentName?: string;
  attachmentFileKey?: string;
  attachmentSize?: number;
}

export interface Hostel {
  id: string;
  name: string;
  type: 'BOYS' | 'GIRLS';
  wardenName: string;
  wardenPhone: string;
  emergencyPhone?: string;
  floors?: number[];
  totalRooms: number;
  capacity?: number;
  monthlyFee?: number;
  messFee?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  address?: string;
}

export interface HostelBed {
  bedNumber: string;
  allocatedStudentId?: string;
  allocatedStudentName?: string;
  allocatedAdmissionNo?: string;
  allocationDate?: string;
  status?: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';
}

export interface HostelRoom {
  id: string;
  hostelId: string;
  hostelName: string;
  roomNumber: string;
  floor: number;
  capacityBeds: number;
  capacity?: number;
  occupiedBeds?: number;
  roomType?: string;
  monthlyFee?: number;
  status?: 'AVAILABLE' | 'FULL' | 'MAINTENANCE' | 'INACTIVE';
  amenities?: string[];
  beds: HostelBed[];
}

export interface HostelAllocation {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  hostelId: string;
  hostelName: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  bedNumber: string;
  allocationDate: string;
  vacateDate?: string;
  monthlyRent?: number;
  messFee?: number;
  status: 'ACTIVE' | 'VACATED' | 'TRANSFERRED';
  remarks?: string;
}

export interface TransportVehicle {
  id: string;
  registrationNumber: string;
  vehicleNumber?: string;
  busName?: string;
  busCode?: string;
  vehicleType: 'BUS' | 'MINI_BUS' | 'VAN' | string;
  model?: string;
  capacity: number;
  driverName: string;
  driverPhone: string;
  driverContact?: string;
  conductorName?: string;
  helperName?: string;
  helperPhone?: string;
  driverLicense?: string;
  permitDetails?: string;
  rcNumber?: string;
  insuranceExpiry: string;
  fitnessExpiry: string;
  permitExpiry?: string;
  pollutionExpiry?: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  gpsDeviceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RouteStop {
  id: string;
  stopName: string;
  name?: string;
  landmark?: string;
  pickupTime: string;
  dropTime: string;
  monthlyFare: number;
  fare?: number;
  fee?: number;
  stopOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  active?: boolean;
  distanceKm?: number;
  slabId?: string;
}

export interface TransportRoute {
  id: string;
  routeName: string;
  name?: string;
  routeNumber?: string;
  startPoint?: string;
  endPoint?: string;
  vehicleId: string;
  vehicleRegNumber: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  driverContact?: string;
  stops: RouteStop[];
  status?: 'ACTIVE' | 'INACTIVE';
  assignedStudentsCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransportDashboardStats {
  activeBuses: number;
  activeRoutes: number;
  totalStops: number;
  studentsUsingTransport: number;
  availableCapacity: number;
  totalCapacity: number;
  totalVehicles: number;
  totalRoutes: number;
}

export type NoticeType =
  | 'GENERAL'
  | 'ACADEMIC'
  | 'EXAM'
  | 'RESULT'
  | 'HOLIDAY'
  | 'EVENT'
  | 'FEE'
  | 'ADMISSION'
  | 'EMERGENCY';

export type NoticeAudience =
  | 'ALL'
  | 'STUDENTS'
  | 'PARENTS'
  | 'STAFF'
  | 'CLASS'
  | 'SECTION'
  | 'INDIVIDUAL'
  | 'TEACHERS';

export type NoticePriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';
export type NoticeStatus = 'DRAFT' | 'PUBLISHED' | 'EXPIRED';

export interface NoticeSeenReceipt {
  userId: string;
  userName: string;
  role: string;
  studentId?: string;
  phone?: string;
  seenAt: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  noticeType?: NoticeType;
  category: NoticeType | 'ATTENDANCE' | 'FEE_REMINDER' | 'HOMEWORK' | string;
  targetAudience: NoticeAudience;
  targetClass?: string;
  targetClassId?: string;
  targetSection?: string;
  targetStudentIds?: string[];
  targetPhone?: string;
  date?: string;
  publishDate?: string;
  publishedDate?: string;
  publishedBy?: string;
  author?: string;
  authorId?: string;
  authorRole?: string;
  expiryDate?: string;
  priority?: NoticePriority;
  status?: NoticeStatus;
  isUrgent?: boolean;
  isImportant?: boolean;
  isPinned?: boolean;
  isPublic?: boolean;
  shortDescription?: string;
  attachmentUrl?: string;
  attachmentFileKey?: string;
  attachmentName?: string;
  isActive?: boolean;
  showOnHomepage?: boolean;
  showInTicker?: boolean;
  academicSession?: string;
  createdAt?: string;
  updatedAt?: string;
  // Seen & Read Tracking
  seenBy?: NoticeSeenReceipt[];
  seenCount?: number;
  isSeen?: boolean;
  seen?: boolean;
  seenAt?: string;
  smsLogId?: string;
}

export type SmsTriggerType =
  | 'DAILY_ABSENTEE'
  | 'FEE_REMINDER'
  | 'EXAM_ANNOUNCEMENT'
  | 'ADMIT_CARD_PUBLISHED'
  | 'RESULT_PUBLISHED'
  | 'EMERGENCY_CIRCULAR'
  | 'CUSTOM';

export type SmsStatus =
  | 'SENT'
  | 'DELIVERED'
  | 'SEEN'
  | 'FAILED'
  | 'SUBMITTED'
  | 'QUEUED'
  | 'UNKNOWN';

export interface SmsLog {
  id: string;
  sentAt: string;
  date: string;
  deliveredAt?: string;
  seenAt?: string;
  seen?: boolean;
  seenBy?: string;
  portalNoticeId?: string;
  triggerType: SmsTriggerType;
  recipientPhone: string;
  recipientName: string;
  recipientRole: 'PARENT' | 'STUDENT' | 'STAFF';
  studentId?: string;
  studentName?: string;
  admissionNumber?: string;
  className?: string;
  section?: string;
  message: string;
  characterCount: number;
  smsUnits: number;
  provider: string;
  providerMessageId?: string;
  status: SmsStatus;
  errorReason?: string;
  idempotencyKey: string;
  sentBy: string;
  sentByUserId?: string;
}

export interface SmsQuickTriggerRecipient {
  phone: string;
  recipientName: string;
  studentId?: string;
  studentName?: string;
  admissionNumber?: string;
  className?: string;
  section?: string;
  detail?: string;
  amount?: number;
  dueDate?: string;
  examName?: string;
}

export interface SmsQuickTriggerPreview {
  triggerType: SmsTriggerType;
  title: string;
  templateMessage: string;
  sampleResolvedMessage: string;
  recipientsCount: number;
  validRecipientsCount: number;
  invalidPhonesCount: number;
  recipients: SmsQuickTriggerRecipient[];
  alreadySentCount?: number;
}

export interface SmsStats {
  todaySent: number;
  todayFailed: number;
  totalSent: number;
  totalFailed: number;
  activeProvider: string;
  senderId: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  role: UserRole;
  action: string;
  entity: string;
  entityId: string;
  ipAddress: string;
  details: string;
  /** category, severity, actor id and redacted before/after values for sensitive changes */
  metadata?: Record<string, any>;
}

export type StorageFolder =
  | 'students/photos'
  | 'staff/photos'
  | 'teachers/photos'
  | 'school-logo'
  | 'students/documents'
  | 'staff/documents'
  | 'certificates'
  | 'study-materials'
  | 'homework'
  | 'public-website/hero'
  | 'public-website/gallery'
  | 'public-website/leadership'
  | 'public-website/events'
  | 'public-website/notices'
  | 'public-website/facilities'
  | 'public-website/general'
  | 'school/hero'
  | 'school/gallery'
  | 'school/leadership'
  | 'school/signatures';

export interface R2FileMetadata {
  fileKey: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  storageProvider: 'CLOUDFLARE_R2' | 'LOCAL_DISK';
  uploadedAt: string;
  folder: string;
  isTemporary?: boolean;
  /** User id that requested the upload slot (ownership for attach / delete). */
  uploadedBy?: string;
  associatedEntity?: {
    type: 'STUDENT' | 'STAFF' | 'SCHOOL_LOGO' | 'PRINCIPAL_SIGNATURE' | 'EXAM_CONTROLLER_SIGNATURE' | 'STUDENT_DOC' | 'STUDY_MATERIAL' | 'HOMEWORK';
    id: string;
  };
}

export interface PresignedUploadRequest {
  fileName: string;
  contentType: string;
  fileSize: number;
  folder: StorageFolder;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
  contentType: string;
}

export interface PresignedDownloadResponse {
  downloadUrl: string;
  expiresIn: number;
  fileKey: string;
}

export interface StudyMaterial {
  id: string;
  title: string;
  description?: string;
  className: string;
  subject: string;
  fileKey: string;
  originalFileName: string;
  fileSize: number;
  contentType: string;
  uploadedBy: string;
  uploadedAt: string;
  category: 'STUDY_MATERIAL' | 'HOMEWORK' | 'SYLLABUS' | 'CIRCULAR';
}

export interface PublicFacility {
  id: string;
  title: string;
  description: string;
  iconName?: string;
  image?: string;
  imageUrl?: string;
  features?: string[];
  displayOrder?: number;
  isActive?: boolean;
  category?: string;
  details?: string;
}

export interface PublicGalleryItem {
  id: string;
  title: string;
  category:
    | 'Campus'
    | 'Classrooms'
    | 'Events'
    | 'Sports'
    | 'Cultural Activities'
    | 'Celebrations'
    | 'Infrastructure'
    | 'Students'
    | 'Labs'
    | 'Hostel'
    | string;
  image?: string;
  imageUrl?: string;
  description?: string;
  caption?: string;
  displayOrder?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface AdmissionEnquiry {
  id: string;
  /** ENQUIRY = admission form; CALLBACK = "request a call" from the public site. Older records have no kind. */
  kind?: 'ENQUIRY' | 'CALLBACK';
  referenceNumber: string;
  parentName: string;
  studentName: string;
  mobile: string;
  email?: string;
  classApplying: string;
  currentSchool?: string;
  message?: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'CONTACTED' | 'VISIT_SCHEDULED' | 'ADMITTED' | 'CLOSED' | 'REVIEWED' | 'ACCEPTED' | string;
  submittedAt: string;
  updatedAt?: string;
  notes?: string;
  followUpDate?: string;
  preferredTime?: string;
}

export interface PublicHeroSlide {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  badge?: string;
  primaryCtaText: string;
  primaryCtaAction: string;
  secondaryCtaText: string;
  secondaryCtaAction: string;
  bgGradient?: string;
  image?: string;
  imageUrl?: string;
  desktopImage?: string;
  desktopImageFileKey?: string;
  mobileImage?: string;
  mobileImageFileKey?: string;
  displayOrder?: number;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicLeadershipProfile {
  id: string;
  name: string;
  designation: string;
  roleCategory?: 'CHAIRMAN' | 'DIRECTOR' | 'PRINCIPAL' | 'ACADEMIC_HEAD' | 'MANAGEMENT' | 'OTHER' | string;
  photo?: string;
  photoUrl?: string;
  photoFileKey?: string;
  message?: string;
  fullBio?: string;
  quote?: string;
  shortBio?: string;
  qualification?: string;
  education?: string;
  experience?: string;
  responsibilities?: string;
  email?: string;
  phone?: string;
  displayOrder: number;
  isActive: boolean;
  active?: boolean;
  showOnWebsite?: boolean;
  showProfile?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicWebsiteEvent {
  id: string;
  title: string;
  description: string;
  eventDate?: string;
  startDate?: string;
  endDate?: string;
  time?: string;
  location?: string;
  venue?: string;
  category: 'Academic' | 'Sports' | 'Cultural' | 'Celebration' | 'Examination' | 'Community' | string;
  image?: string;
  imageUrl?: string;
  imageFileKey?: string;
  isFeatured?: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicWebsiteContent {
  aboutSchool: string;
  aboutHighlights?: { title: string; desc: string }[];
  vision: string;
  visionPoints?: string[];
  mission: string;
  missionPoints?: string[];
  chairmanMessage: string;
  principalMessage: string;
  academicIntro?: string;
  residentialLife?: string;
  campusIntro?: string;
  updatedAt?: string;
}

export interface PublicMediaItem {
  id: string;
  fileKey: string;
  fileName: string;
  name?: string;
  contentType: string;
  mimeType?: string;
  fileSize: number;
  sizeBytes?: number;
  url: string;
  folder: string;
  category: 'HERO' | 'GALLERY' | 'LEADERSHIP' | 'EVENTS' | 'FACILITIES' | 'NOTICES' | 'OTHER';
  uploadedAt: string;
  usedIn?: string[];
}

export * from './realtime.ts';
export * from '../utils/rbac.ts';

