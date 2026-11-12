// Authoritative School Management System API - Dynamic MongoDB Architecture
// All production data is synchronized with MongoDB Atlas endpoints.
import { calculateEvaluation, OFFICIAL_GRADING_SYSTEM } from '../utils/grading';
import { clearAllStaffDrafts } from '../utils/staffDraftStorage';
import { isMonthOnOrAfterEnrollmentDate } from '../utils/feeDateHelper';

// Shown only until the saved School Settings arrive from the server. No contact,
// principal or bank details are invented here: screens show "Not configured" instead.
const defaultSchoolSettings: any = {
  schoolName: 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE',
  currentAcademicSession: '2026-2027',
  schoolLogo: '',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  gradingSystem: OFFICIAL_GRADING_SYSTEM,
};
import {
  AcademicClass,
  AcademicSection,
  AcademicSession,
  AttachedDocument,
  AttendanceRecord,
  AuditLog,
  Exam,
  ExamMark,
  FeePayment,
  FeeStructure,
  ClassFeeConfiguration,
  TransportSlab,
  FeeLedgerEntry,
  GradeDefinition,
  Homework,
  Hostel,
  HostelRoom,
  HostelBed,
  HostelAllocation,
  Notice,
  SchoolSettings,
  StaffAttendanceRecord,
  StaffLeave,
  StaffPayrollRecord,
  Student,
  StudentStatus,
  StudyMaterial,
  Subject,
  TeacherStaff,
  TimetablePeriodConfig,
  TimetableSlot,
  TransportRoute,
  RouteStop,
  TransportVehicle,
  User,
  UserRole,
  AdminAccount,
  RealtimeEvent,
  RealtimeEntityType,
  RealtimeAction,
  PublicFacility,
  PublicGalleryItem,
  AdmissionEnquiry,
  PublicHeroSlide,
  PublicLeadershipProfile,
  PublicWebsiteEvent,
  PublicWebsiteContent,
  PublicMediaItem,
  Holiday,
  SmsLog,
  SmsTriggerType,
  SmsStatus,
} from '../types';
import { getApiUrl, getAuthHeaders, getAuthToken, getFileContentUrl, getStoredUser, apiFetch } from './apiConfig';

export interface HomeworkClassOption {
  classId: string;
  className: string;
  sections: { name: string; subjects: { id: string; name: string }[] }[];
}
export interface HomeworkInput {
  classId: string;
  section: string;
  subjectId: string;
  title: string;
  instructions: string;
  assignedDate?: string;
  dueDate: string;
  /** Send '' to remove an existing attachment; omit to leave it unchanged. */
  attachmentFileKey?: string;
  attachmentName?: string;
  attachmentSize?: number;
}

class SchoolApiService {
  private cache: {
    settings: SchoolSettings;
    classes: AcademicClass[];
    subjects: Subject[];
    staff: TeacherStaff[];
    students: Student[];
    timetable: TimetableSlot[];
    timetablePeriods: TimetablePeriodConfig[];
    attendance: AttendanceRecord[];
    staffAttendance: StaffAttendanceRecord[];
    staffLeaves: StaffLeave[];
    staffPayroll: StaffPayrollRecord[];
    holidays: Holiday[];
    feeStructures: FeeStructure[];
    feePayments: FeePayment[];
    feeConfigurations: ClassFeeConfiguration[];
    transportSlabs: TransportSlab[];
    feeLedgers: FeeLedgerEntry[];
    exams: Exam[];
    examMarks: ExamMark[];
    homework: Homework[];
    studyMaterials: StudyMaterial[];
    hostels: Hostel[];
    hostelRooms: HostelRoom[];
    hostelAllocations: HostelAllocation[];
    vehicles: TransportVehicle[];
    routes: TransportRoute[];
    notices: Notice[];
    auditLogs: AuditLog[];
    adminAccounts: AdminAccount[];
    currentUser: User;
  };

  constructor() {
    // Initialize with local storage if present, otherwise initial database
    const saved = localStorage.getItem('cps_school_erp');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const defaults = this.getDefaults();
        this.cache = { ...defaults, ...parsed };
        if (!this.cache.adminAccounts || !Array.isArray(this.cache.adminAccounts)) {
          this.cache.adminAccounts = [];
        }
        if (!this.cache.settings.academicSessions || !Array.isArray(this.cache.settings.academicSessions) || this.cache.settings.academicSessions.length === 0) {
          this.cache.settings.academicSessions = [
            {
              id: 'session-2026-2027',
              name: this.cache.settings.currentAcademicSession || '2026-2027',
              startDate: '2026-04-01',
              endDate: '2027-03-31',
              status: 'ACTIVE',
            },
          ];
        }
        // Ensure only ONE session is ACTIVE, aligned with currentAcademicSession
        const currentActiveName = this.cache.settings.currentAcademicSession || '2026-2027';
        let foundActive = false;
        this.cache.settings.academicSessions = this.cache.settings.academicSessions.map((ses) => {
          if (!foundActive && (ses.name === currentActiveName || ses.status === 'ACTIVE')) {
            foundActive = true;
            return { ...ses, status: 'ACTIVE' as const };
          }
          return { ...ses, status: 'INACTIVE' as const };
        });
        if (!foundActive && this.cache.settings.academicSessions.length > 0) {
          this.cache.settings.academicSessions[0].status = 'ACTIVE';
        }
        const finalActive = this.cache.settings.academicSessions.find((s) => s.status === 'ACTIVE');
        if (finalActive) {
          this.cache.settings.currentAcademicSession = finalActive.name;
        }
        if (!this.cache.staffLeaves || !Array.isArray(this.cache.staffLeaves)) {
          this.cache.staffLeaves = [];
        }
        if (!this.cache.staffPayroll || !Array.isArray(this.cache.staffPayroll)) {
          this.cache.staffPayroll = [];
        }
        if (this.cache.feeLedgers && Array.isArray(this.cache.feeLedgers)) {
          const seen = new Set<string>();
          this.cache.feeLedgers = this.cache.feeLedgers.filter((l) => {
            if (!l || !l.id) return false;
            if (seen.has(l.id)) return false;
            seen.add(l.id);
            return true;
          });
        }
        if (this.cache.feePayments && Array.isArray(this.cache.feePayments)) {
          const seen = new Set<string>();
          this.cache.feePayments = this.cache.feePayments.filter((p) => {
            if (!p || !p.id) return false;
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
        }
        if (!this.cache.timetablePeriods || !Array.isArray(this.cache.timetablePeriods) || this.cache.timetablePeriods.length === 0) {
          this.cache.timetablePeriods = [
            { periodNumber: 1, name: 'Period 1', startTime: '08:00 AM', endTime: '08:45 AM' },
            { periodNumber: 2, name: 'Period 2', startTime: '08:45 AM', endTime: '09:30 AM' },
            { periodNumber: 3, name: 'Period 3', startTime: '09:30 AM', endTime: '10:15 AM' },
            { periodNumber: 4, name: 'Period 4', startTime: '10:15 AM', endTime: '11:00 AM' },
            { periodNumber: 5, name: 'Recess / Break', startTime: '11:00 AM', endTime: '11:30 AM', isBreak: true, breakType: 'RECESS' as const },
            { periodNumber: 6, name: 'Period 5', startTime: '11:30 AM', endTime: '12:15 PM' },
            { periodNumber: 7, name: 'Period 6', startTime: '12:15 PM', endTime: '01:00 PM' },
            { periodNumber: 8, name: 'Period 7', startTime: '01:00 PM', endTime: '01:45 PM' },
          ];
        }

        // Normalize classes: ensure detailedSections, maxCapacity, status
        if (Array.isArray(this.cache.classes)) {
          this.cache.classes = this.cache.classes.map((cls) => {
            const maxCap = Number(cls.maxCapacity) || 40;
            const detailedSections = (cls.detailedSections && cls.detailedSections.length > 0)
              ? cls.detailedSections
              : (cls.sections || ['A', 'B']).map((sec) => ({
                  id: `sec-${cls.id}-${String(sec || 'A').replace(/\s+/g, '-').toLowerCase()}`,
                  name: sec,
                  maxCapacity: maxCap,
                  status: 'ACTIVE' as const,
                  classTeacherId: cls.classTeacherId,
                  classTeacherName: cls.classTeacherName,
                }));

            return {
              ...cls,
              maxCapacity: maxCap,
              status: cls.status || 'ACTIVE',
              academicSession: cls.academicSession || '2026-2027',
              detailedSections,
              sections: detailedSections.map((s) => s.name),
            };
          });
        }

        // Normalize subjects
        if (Array.isArray(this.cache.subjects)) {
          this.cache.subjects = this.cache.subjects.map((sub) => {
            const max = sub.maxMarks ?? 100;
            return {
              ...sub,
              maxMarks: max,
              passMarks: sub.passMarks ?? 33,
              theoryMarks: sub.theoryMarks ?? max,
              practicalMarks: sub.practicalMarks ?? 0,
              credits: sub.credits ?? 4,
              status: sub.status ?? 'ACTIVE',
              academicSession: sub.academicSession ?? '2026-2027',
            };
          });
        }

        // Normalize grading system to exact 8-tier CBSE scale (A1 to E/F, E/F is FAIL)
        if (
          this.cache.settings &&
          (!this.cache.settings.gradingSystem ||
            this.cache.settings.gradingSystem.length !== 8 ||
            !this.cache.settings.gradingSystem.some((g) => g.grade === 'D' && g.minPercentage === 33) ||
            !this.cache.settings.gradingSystem.some((g) => g.grade === 'E/F' && g.status === 'FAIL') ||
            this.cache.settings.gradingSystem.some((g) => (g.grade === 'E/F' || g.grade === 'E') && g.status === 'PASS') ||
            !(this.cache.settings.gradingSystem[0] as any).gradePoint)
        ) {
          this.cache.settings.gradingSystem = [...OFFICIAL_GRADING_SYSTEM];
        }

        // Normalize staff salary if it was previously stored as a number or missing net
        if (Array.isArray(this.cache.staff)) {
          this.cache.staff = this.cache.staff.map((st) => {
            if (typeof (st as any).salary === 'number') {
              const num = (st as any).salary;
              return {
                ...st,
                salary: {
                  basic: Math.round(num * 0.6),
                  allowances: Math.round(num * 0.4),
                  deductions: 0,
                  net: num,
                },
              };
            }
            if (st.salary && typeof st.salary === 'object' && (st.salary as any).net === undefined) {
              const basic = st.salary.basic || 0;
              const allowances = st.salary.allowances || 0;
              const deductions = st.salary.deductions || 0;
              return {
                ...st,
                salary: {
                  basic,
                  allowances,
                  deductions,
                  net: basic + allowances - deductions,
                },
              };
            }
            return st;
          });
        }

        // Ensure student photoFileKey and parent details are properly preserved
        if (Array.isArray(this.cache.students)) {
          this.cache.students = this.cache.students.map((stu) => {
            let photo = stu.photo;
            if (photo && photo.startsWith('blob:')) {
              photo = stu.photoFileKey ? stu.photoFileKey : undefined;
            }
            if (!photo && stu.photoFileKey) {
              photo = stu.photoFileKey;
            }
            return {
              ...stu,
              photo,
              fatherName: stu.fatherName || stu.parentName || '',
              motherName: stu.motherName || '',
            };
          });
        }
        // Clean up legacy static placeholder logo if present
        const currentLogo = this.cache.settings?.schoolLogo || '';
        if (currentLogo.includes('6d803721-266e-4895-907b-562d8586e5fd.png')) {
          const r2UploadedLogoKey = 'school/school-logo/logo.png';
          this.cache.settings = {
            ...this.cache.settings,
            schoolLogo: r2UploadedLogoKey,
            logoFileKey: r2UploadedLogoKey,
          };
          this.persist();
        }

        // Normalize timetable slots: Title Case dayOfWeek, populate teacherName from staff
        if (Array.isArray(this.cache.timetable)) {
          this.cache.timetable = this.cache.timetable.map((slot) => {
            const staffMatch = this.cache.staff?.find((s) => s.id === slot.teacherId);
            return {
              ...slot,
              dayOfWeek: this.normalizeDayOfWeek(slot.dayOfWeek),
              teacherName: slot.teacherName || staffMatch?.name || 'Assigned Faculty',
            };
          });
        }

        // Seamless background synchronization with server so authentication & API layers reflect updated photos
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            this.syncWithServer().catch(() => {});
          }, 100);
        }
      } catch (e) {
        this.cache = this.getDefaults();
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            this.syncWithServer().catch(() => {});
          }, 100);
        }
      }
    } else {
      this.cache = this.getDefaults();
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          this.syncWithServer().catch(() => {});
        }, 100);
      }
    }
  }

  /**
   * Synchronizes all school modules with the persistent backend server and Cloudflare R2
   */
  // A full sync is ~27 requests. App start, the App shell and the Dashboard each asked
  // for one at the same moment, so a single page load ran it 3 times (5 in dev).
  // Concurrent callers now share one run, and a run that finished moments ago is reused.
  private syncInFlight: Promise<any> | null = null;
  private lastSyncFinishedAt = 0;
  private lastSyncResult: any = null;
  private static readonly SYNC_REUSE_MS = 4000;

  public async syncWithServer(options: { force?: boolean } = {}): ReturnType<SchoolApiService['runFullSync']> {
    if (this.syncInFlight) return this.syncInFlight;
    if (!options.force && this.lastSyncResult && Date.now() - this.lastSyncFinishedAt < SchoolApiService.SYNC_REUSE_MS) {
      return this.lastSyncResult;
    }
    const run = this.runFullSync()
      .then((result) => {
        this.lastSyncResult = result;
        this.lastSyncFinishedAt = Date.now();
        return result;
      })
      .finally(() => {
        this.syncInFlight = null;
      });
    this.syncInFlight = run;
    return run;
  }

  private async runFullSync(): Promise<{
    settings: SchoolSettings;
    students: Student[];
    staff: TeacherStaff[];
    classes: AcademicClass[];
    subjects: Subject[];
    timetable: TimetableSlot[];
    feeStructures: FeeStructure[];
    feePayments: FeePayment[];
    exams: Exam[];
    notices: Notice[];
    studyMaterials: StudyMaterial[];
  }> {
    try {
      // Parents and students are always refused these staff-only lists (401/403),
      // and a refused request leaves the cache unchanged, so do not send them.
      const familyRole = ['PARENT', 'STUDENT'].includes(String(getStoredUser()?.role || ''));
      // Nothing that needs a login is requested while signed out (login page, public website).
      const signedIn = !!getAuthToken();
      // Only roles that can see homework ask for it (others would just be refused).
      const homeworkRole = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT'].includes(String(getStoredUser()?.role || ''));
      const staffOnly = (path: string, init?: RequestInit) =>
        familyRole || !signedIn ? Promise.resolve(null) : fetch(getApiUrl(path), init).then(async (r) => (r.ok ? r.json() : null));
      const authed = (path: string) =>
        signedIn ? fetch(getApiUrl(path), { headers: getAuthHeaders() }).then(async (r) => (r.ok ? r.json() : null)) : Promise.resolve(null);
      const results = await Promise.allSettled([
        // 1. Settings. Signed-in staff must send their login: without it the server leaves out the
        // signature images, and the cache would lose them (no preview in Settings, no signature on documents).
        fetch(getApiUrl('/api/settings'), signedIn ? { headers: getAuthHeaders() } : undefined).then(async (r) => (r.ok ? r.json() : null)),
        // 2. Students
        authed('/api/students?limit=2000'),
        // 3. Teachers / Staff
        staffOnly('/api/teachers', { headers: getAuthHeaders() }),
        // 4. Classes
        authed('/api/classes'),
        // 5. Subjects
        authed('/api/subjects'),
        // 6. Timetable
        authed('/api/timetables'),
        // 7. Timetable periods
        authed('/api/timetables/periods'),
        // 8. Attendance
        authed('/api/attendance'),
        // 9. Staff attendance
        staffOnly('/api/staff-attendance', { headers: getAuthHeaders() }),
        // 10. Fee structures
        staffOnly('/api/fees/structures', { headers: getAuthHeaders() }),
        // 11. Fee payments
        authed('/api/fees/payments'),
        // 12. Exams
        authed('/api/exams'),
        // 13. Exam Marks
        authed('/api/marks'),
        // 14. Homework
        homeworkRole ? authed('/api/homework') : Promise.resolve(null),
        // 15. Notices
        authed('/api/notices'),
        // 16. Study Materials
        fetch(getApiUrl('/api/study-materials')).then(async (r) => (r.ok ? r.json() : null)),
        // 17. Hostels
        fetch(getApiUrl('/api/hostels')).then(async (r) => (r.ok ? r.json() : null)),
        // 18. Transport
        fetch(getApiUrl('/api/transport')).then(async (r) => (r.ok ? r.json() : null)),
        // 19. Class Fee Configurations
        fetch(getApiUrl('/api/fee-configurations')).then(async (r) => (r.ok ? r.json() : null)),
        // 20. Transport Slabs
        fetch(getApiUrl('/api/transport-slabs')).then(async (r) => (r.ok ? r.json() : null)),
        // 21. Fee Ledgers
        authed('/api/fee-ledgers'),
        // 22. Staff Leaves
        staffOnly('/api/staff-leaves', { headers: getAuthHeaders() }),
        // 23. Staff Payroll
        staffOnly('/api/staff-payroll', { headers: getAuthHeaders() }),
        // 24. Audit Logs
        staffOnly('/api/audit-logs?limit=500', { headers: getAuthHeaders() }),
        // 25. Admin Accounts
        staffOnly('/api/admin/accounts', { headers: getAuthHeaders() }),
        // 26. School Holidays
        fetch(getApiUrl('/api/holidays')).then(async (r) => (r.ok ? r.json() : null)),
      ]);

      const [
        settingsRes,
        studentsRes,
        teachersRes,
        classesRes,
        subjectsRes,
        timetableRes,
        periodsRes,
        attendanceRes,
        staffAttRes,
        feeStructRes,
        feePayRes,
        examsRes,
        marksRes,
        hwRes,
        noticesRes,
        studyMatRes,
        hostelsRes,
        transportRes,
        feeConfigRes,
        transportSlabsRes,
        feeLedgersRes,
        staffLeavesRes,
        staffPayrollRes,
        auditLogsRes,
        adminAccountsRes,
        holidaysRes,
      ] = results;

      // 1. Settings
      if (settingsRes.status === 'fulfilled' && settingsRes.value && settingsRes.value.schoolName) {
        const serverSettings: SchoolSettings = settingsRes.value;
        const rawServerLogo = serverSettings.schoolLogo || serverSettings.logoFileKey || '';
        const schoolLogo =
          rawServerLogo && !rawServerLogo.includes('6d803721')
            ? rawServerLogo
            : this.cache.settings.schoolLogo || '';
        // The server copy replaces the cached one completely, so values removed or never
        // saved on the server (e.g. old demo details in this browser's cache) do not linger.
        this.cache.settings = {
          ...this.keepSignaturesIfOmitted(serverSettings),
          schoolLogo,
          logoFileKey: serverSettings.logoFileKey || schoolLogo,
        } as SchoolSettings;
      }

      // 2. Students (Server is authoritative source of truth)
      if (studentsRes.status === 'fulfilled' && studentsRes.value) {
        const stuData = studentsRes.value;
        const serverStudents: Student[] = Array.isArray(stuData) ? stuData : (stuData.data || []);
        if (Array.isArray(serverStudents)) {
          this.cache.students = serverStudents;
        }
      }

      // 3. Teachers / Staff (Server is authoritative source of truth)
      if (teachersRes.status === 'fulfilled' && Array.isArray(teachersRes.value)) {
        this.cache.staff = teachersRes.value;
      }

      // 4. Classes
      if (classesRes.status === 'fulfilled' && Array.isArray(classesRes.value)) {
        this.cache.classes = classesRes.value;
      }

      // 5. Subjects
      if (subjectsRes.status === 'fulfilled' && Array.isArray(subjectsRes.value)) {
        this.cache.subjects = subjectsRes.value;
      }

      // 6. Timetable
      if (timetableRes.status === 'fulfilled' && Array.isArray(timetableRes.value)) {
        this.cache.timetable = timetableRes.value;
      }

      // 7. Timetable periods
      if (periodsRes.status === 'fulfilled' && Array.isArray(periodsRes.value) && periodsRes.value.length > 0) {
        this.cache.timetablePeriods = periodsRes.value;
      }

      // 8. Attendance
      if (attendanceRes.status === 'fulfilled' && Array.isArray(attendanceRes.value)) {
        this.cache.attendance = attendanceRes.value;
      }

      // 9. Staff attendance
      if (staffAttRes.status === 'fulfilled' && Array.isArray(staffAttRes.value)) {
        this.cache.staffAttendance = staffAttRes.value;
      }

      // 10. Fee structures
      if (feeStructRes.status === 'fulfilled' && Array.isArray(feeStructRes.value)) {
        this.cache.feeStructures = feeStructRes.value;
      }

      // 11. Fee payments
      if (feePayRes.status === 'fulfilled' && Array.isArray(feePayRes.value)) {
        this.cache.feePayments = feePayRes.value;
      }

      // 12. Exams
      if (examsRes.status === 'fulfilled' && Array.isArray(examsRes.value)) {
        this.cache.exams = examsRes.value;
      }

      // 13. Exam Marks
      if (marksRes.status === 'fulfilled' && Array.isArray(marksRes.value)) {
        this.cache.examMarks = marksRes.value;
      }

      // 14. Homework
      if (hwRes.status === 'fulfilled' && Array.isArray(hwRes.value)) {
        this.cache.homework = hwRes.value;
      }

      // 15. Notices
      if (noticesRes.status === 'fulfilled' && noticesRes.value) {
        const rawNotices = Array.isArray(noticesRes.value)
          ? noticesRes.value
          : noticesRes.value?.notices || [];
        if (Array.isArray(rawNotices)) {
          const seen = new Set<string>();
          this.cache.notices = rawNotices.filter((n: any) => {
            const id = n?.id || n?._id;
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
        }
      }

      // 16. Study Materials
      if (studyMatRes.status === 'fulfilled' && Array.isArray(studyMatRes.value)) {
        this.cache.studyMaterials = studyMatRes.value;
      }

      // 17. Hostels
      if (hostelsRes.status === 'fulfilled' && hostelsRes.value) {
        if (Array.isArray(hostelsRes.value.hostels)) {
          this.cache.hostels = hostelsRes.value.hostels;
        }
        if (Array.isArray(hostelsRes.value.rooms)) {
          this.cache.hostelRooms = hostelsRes.value.rooms;
        }
      }

      // 18. Transport
      if (transportRes.status === 'fulfilled' && transportRes.value) {
        if (Array.isArray(transportRes.value.vehicles)) {
          this.cache.vehicles = transportRes.value.vehicles;
        }
        if (Array.isArray(transportRes.value.routes)) {
          this.cache.routes = transportRes.value.routes;
        }
      }

      // 19. Class Fee Configurations
      if (feeConfigRes.status === 'fulfilled' && Array.isArray(feeConfigRes.value)) {
        this.cache.feeConfigurations = feeConfigRes.value;
      }

      // 20. Transport Slabs
      if (transportSlabsRes.status === 'fulfilled' && Array.isArray(transportSlabsRes.value)) {
        this.cache.transportSlabs = transportSlabsRes.value;
      }

      // 21. Fee Ledgers
      if (feeLedgersRes.status === 'fulfilled' && Array.isArray(feeLedgersRes.value)) {
        this.cache.feeLedgers = feeLedgersRes.value;
      }

      // 22. Staff Leaves
      if (staffLeavesRes.status === 'fulfilled' && Array.isArray(staffLeavesRes.value)) {
        this.cache.staffLeaves = staffLeavesRes.value;
      }

      // 23. Staff Payroll
      if (staffPayrollRes.status === 'fulfilled' && Array.isArray(staffPayrollRes.value)) {
        this.cache.staffPayroll = staffPayrollRes.value;
      }

      // 24. Audit Logs (Server is authoritative source of truth)
      if (auditLogsRes.status === 'fulfilled' && Array.isArray(auditLogsRes.value)) {
        this.cache.auditLogs = auditLogsRes.value;
      }

      // 25. Admin Accounts
      if (adminAccountsRes.status === 'fulfilled' && adminAccountsRes.value) {
        const accs = adminAccountsRes.value.accounts || (Array.isArray(adminAccountsRes.value) ? adminAccountsRes.value : null);
        if (Array.isArray(accs) && accs.length > 0) {
          this.cache.adminAccounts = accs;
        }
      }

      // 26. School Holidays (Authoritative from MongoDB)
      if (holidaysRes.status === 'fulfilled' && Array.isArray(holidaysRes.value)) {
        this.cache.holidays = holidaysRes.value;
      }

      this.persist();
    } catch (err) {
      console.warn('[SchoolApiService] Background sync with server warning:', err);
    }

    return {
      settings: this.cache.settings,
      students: this.cache.students,
      staff: this.cache.staff,
      classes: this.cache.classes,
      subjects: this.cache.subjects,
      timetable: this.cache.timetable,
      feeStructures: this.cache.feeStructures,
      feePayments: this.cache.feePayments,
      exams: this.cache.exams,
      notices: this.cache.notices,
      studyMaterials: this.cache.studyMaterials,
    };
  }

  /**
   * Granular Real-time Invalidation & Authoritative Fetch Methods
   */
  /** Loads the student list from the server and reports whether that worked (the cache is kept on failure). */
  public async loadStudentsFromServer(): Promise<{ ok: boolean; students: Student[] }> {
    try {
      const res = await fetch(getApiUrl('/api/students?limit=2000'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const serverStudents: Student[] = Array.isArray(data) ? data : (data.data || []);
        this.cache.students = serverStudents;
        this.persist();
        return { ok: true, students: serverStudents };
      }
    } catch (err) {
      console.warn('[API] Could not load students:', err);
    }
    return { ok: false, students: this.cache.students };
  }

  public async syncStudents(): Promise<Student[]> {
    try {
      const res = await fetch(getApiUrl('/api/students?limit=2000'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const serverStudents: Student[] = Array.isArray(data) ? data : (data.data || []);
        if (Array.isArray(serverStudents)) {
          this.cache.students = serverStudents;
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncStudents error:', err);
    }
    return this.cache.students;
  }

  public async syncStaff(): Promise<TeacherStaff[]> {
    try {
      const res = await fetch(getApiUrl('/api/teachers'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.staff = data;
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncStaff error:', err);
    }
    return this.cache.staff;
  }

  public async syncClasses(): Promise<AcademicClass[]> {
    try {
      const res = await fetch(getApiUrl('/api/classes'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.classes = data;
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncClasses error:', err);
    }
    return this.cache.classes;
  }

  public async syncSubjects(): Promise<Subject[]> {
    try {
      const res = await fetch(getApiUrl('/api/subjects'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.subjects = data;
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncSubjects error:', err);
    }
    return this.cache.subjects;
  }

  public async syncTimetable(): Promise<TimetableSlot[]> {
    try {
      const [ttRes, periodsRes] = await Promise.allSettled([
        fetch(getApiUrl('/api/timetables'), { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : null)),
        fetch(getApiUrl('/api/timetables/periods'), { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (ttRes.status === 'fulfilled' && Array.isArray(ttRes.value)) {
        this.cache.timetable = ttRes.value;
      }
      if (periodsRes.status === 'fulfilled' && Array.isArray(periodsRes.value)) {
        this.cache.timetablePeriods = periodsRes.value;
      }
      this.persist();
    } catch (err) {
      console.warn('[RealtimeSync] syncTimetable error:', err);
    }
    return this.cache.timetable;
  }

  public async syncAttendance(): Promise<AttendanceRecord[]> {
    try {
      const res = await fetch(getApiUrl('/api/attendance'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.attendance = data;
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncAttendance error:', err);
    }
    return this.cache.attendance;
  }

  public async syncStaffAttendance(): Promise<StaffAttendanceRecord[]> {
    try {
      const res = await fetch(getApiUrl('/api/staff-attendance'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.staffAttendance = data;
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncStaffAttendance error:', err);
    }
    return this.cache.staffAttendance;
  }

  public async syncStaffLeaves(): Promise<StaffLeave[]> {
    try {
      const res = await fetch(getApiUrl('/api/staff-leaves'), { headers: getAuthHeaders() });
      if (res.ok) {
        const leaves = await res.json();
        if (Array.isArray(leaves)) {
          this.cache.staffLeaves = leaves;
          this.persist();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cps_entity_staff_leaves', { detail: leaves }));
          }
          return leaves;
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncStaffLeaves error:', err);
    }
    return this.cache.staffLeaves || [];
  }

  public async syncStaffPayroll(): Promise<StaffPayrollRecord[]> {
    try {
      const res = await fetch(getApiUrl('/api/staff-payroll'), { headers: getAuthHeaders() });
      if (res.ok) {
        const records = await res.json();
        if (Array.isArray(records)) {
          this.cache.staffPayroll = records;
          this.persist();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cps_entity_staff_payroll', { detail: records }));
          }
          return records;
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncStaffPayroll error:', err);
    }
    return this.cache.staffPayroll || [];
  }

  public async syncAuditLogs(): Promise<AuditLog[]> {
    // Staff-only list: never request it for parents/students or when signed out (it would only return 401).
    if (!getAuthToken() || ['PARENT', 'STUDENT'].includes(String(getStoredUser()?.role || ''))) return this.cache.auditLogs || [];
    try {
      const res = await fetch(getApiUrl('/api/audit-logs?limit=500'), { headers: getAuthHeaders() });
      if (res.ok) {
        const logs = await res.json();
        if (Array.isArray(logs)) {
          this.cache.auditLogs = logs;
          this.persist();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cps_entity_audit_logs', { detail: logs }));
          }
          return logs;
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncAuditLogs error:', err);
    }
    return this.cache.auditLogs || [];
  }

  public async syncAdminAccounts(): Promise<AdminAccount[]> {
    if (!getAuthToken() || ['PARENT', 'STUDENT'].includes(String(getStoredUser()?.role || ''))) return this.cache.adminAccounts || [];
    try {
      const res = await fetch(getApiUrl('/api/admin/accounts'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const accs = data.accounts || (Array.isArray(data) ? data : null);
        if (Array.isArray(accs) && accs.length > 0) {
          this.cache.adminAccounts = accs;
          this.persist();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cps_entity_admin_accounts', { detail: accs }));
          }
          return accs;
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncAdminAccounts error:', err);
    }
    return this.cache.adminAccounts || [];
  }

  public async syncFees(): Promise<{ structures: FeeStructure[]; payments: FeePayment[] }> {
    try {
      const familyRole = ['PARENT', 'STUDENT'].includes(String(getStoredUser()?.role || ''));
      const [structRes, payRes] = await Promise.allSettled([
        !getAuthToken() || familyRole
          ? Promise.resolve(null)
          : fetch(getApiUrl('/api/fees/structures'), { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : null)),
        fetch(getApiUrl('/api/fees/payments'), { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (structRes.status === 'fulfilled' && Array.isArray(structRes.value)) {
        this.cache.feeStructures = structRes.value;
      }
      if (payRes.status === 'fulfilled' && Array.isArray(payRes.value)) {
        this.cache.feePayments = payRes.value;
      }
      this.persist();
    } catch (err) {
      console.warn('[RealtimeSync] syncFees error:', err);
    }
    return { structures: this.cache.feeStructures, payments: this.cache.feePayments };
  }

  public async syncExams(): Promise<{ exams: Exam[]; marks: ExamMark[] }> {
    try {
      const [exRes, marksRes] = await Promise.allSettled([
        fetch(getApiUrl('/api/exams')).then((r) => (r.ok ? r.json() : null)),
        fetch(getApiUrl('/api/marks'), { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (exRes.status === 'fulfilled' && Array.isArray(exRes.value)) {
        this.cache.exams = exRes.value;
      }
      if (marksRes.status === 'fulfilled' && Array.isArray(marksRes.value)) {
        this.cache.examMarks = marksRes.value;
      }
      this.persist();
    } catch (err) {
      console.warn('[RealtimeSync] syncExams error:', err);
    }
    return { exams: this.cache.exams, marks: this.cache.examMarks };
  }

  public async syncHomework(): Promise<Homework[]> {
    try {
      if (!getAuthToken()) return this.cache.homework;
      const res = await fetch(getApiUrl('/api/homework'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.homework = data;
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncHomework error:', err);
    }
    return this.cache.homework;
  }

  public async syncNotices(): Promise<Notice[]> {
    try {
      const user = this.getCurrentUser();
      let endpoint = '/api/notices';
      if (user?.role === 'STUDENT') {
        endpoint = '/api/student/notices';
      } else if (user?.role === 'PARENT') {
        endpoint = '/api/parent/notices';
      }

      const res = await fetch(getApiUrl(endpoint), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.notices) ? data.notices : []);
        if (Array.isArray(list)) {
          const seen = new Set<string>();
          this.cache.notices = list.filter((n) => {
            const id = n?.id || (n as any)?._id;
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncNotices error:', err);
    }
    return this.cache.notices;
  }

  public async syncStudyMaterials(): Promise<StudyMaterial[]> {
    try {
      const res = await fetch(getApiUrl('/api/study-materials'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.studyMaterials = data;
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncStudyMaterials error:', err);
    }
    return this.cache.studyMaterials;
  }

  public async syncHostel(): Promise<void> {
    try {
      const res = await fetch(getApiUrl('/api/hostels'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.hostels)) this.cache.hostels = data.hostels;
        if (Array.isArray(data.rooms)) this.cache.hostelRooms = data.rooms;
        if (Array.isArray(data.allocations)) this.cache.hostelAllocations = data.allocations;
        this.persist();
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncHostel error:', err);
    }
  }

  public async syncTransport(): Promise<void> {
    try {
      const res = await fetch(getApiUrl('/api/transport'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.vehicles)) this.cache.vehicles = data.vehicles;
        if (Array.isArray(data.routes)) this.cache.routes = data.routes;
        this.persist();
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncTransport error:', err);
    }
  }

  /**
   * The public settings answer (no login) leaves out the signature images. When such an answer replaces
   * the cache of a signed-in user, keep the signatures we already have instead of wiping them.
   */
  private keepSignaturesIfOmitted(serverSettings: any): any {
    const keys = ['principalSignature', 'principalSignatureFileKey', 'examControllerSignature', 'examControllerSignatureFileKey'];
    const omitted = keys.every((k) => !(k in (serverSettings || {})));
    if (!omitted || !getAuthToken()) return serverSettings;
    const kept: any = { ...serverSettings };
    for (const k of keys) if ((this.cache.settings as any)?.[k]) kept[k] = (this.cache.settings as any)[k];
    return kept;
  }

  public async syncSettings(): Promise<SchoolSettings> {
    try {
      const res = await fetch(getApiUrl('/api/settings'), getAuthToken() ? { headers: getAuthHeaders() } : undefined);
      if (res.ok) {
        const data = await res.json();
        if (data && data.schoolName) {
          const rawServerLogo = data.schoolLogo || data.logoFileKey || '';
          const schoolLogo =
            rawServerLogo && !rawServerLogo.includes('6d803721')
              ? rawServerLogo
              : this.cache.settings.schoolLogo || '';
          this.cache.settings = {
            ...this.keepSignaturesIfOmitted(data),
            schoolLogo,
            logoFileKey: data.logoFileKey || schoolLogo,
          } as SchoolSettings;
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[RealtimeSync] syncSettings error:', err);
    }
    return this.cache.settings;
  }

  /**
   * Application-wide Live Real-time Event Handler
   * Applies immediate state updates to memory cache, triggers authoritative backend slice fetch,
   * and dispatches reactive window events to open views.
   */
  public async handleRealtimeEvent(event: RealtimeEvent): Promise<void> {
    const { entity, action, data } = event;

    // 1. Immediate optimistic in-memory reconciliation
    switch (entity) {
      case 'STUDENT':
        if (action === 'DELETE' && (data?.id || event.studentId)) {
          const targetId = data?.id || event.studentId;
          this.cache.students = this.cache.students.filter((s) => s.id !== targetId);
        } else if (data && (action === 'CREATE' || action === 'UPDATE')) {
          const idx = this.cache.students.findIndex((s) => s.id === data.id);
          if (idx !== -1) {
            this.cache.students[idx] = { ...this.cache.students[idx], ...data };
          } else if (action === 'CREATE') {
            this.cache.students.unshift(data);
          }
        }
        break;

      case 'TEACHER':
        if (action === 'DELETE' && data?.id) {
          this.cache.staff = this.cache.staff.filter((s) => s.id !== data.id);
        } else if (data && (action === 'CREATE' || action === 'UPDATE')) {
          const idx = this.cache.staff.findIndex((s) => s.id === data.id);
          if (idx !== -1) {
            this.cache.staff[idx] = { ...this.cache.staff[idx], ...data };
          } else if (action === 'CREATE') {
            this.cache.staff.unshift(data);
          }
        }
        break;

      case 'CLASS':
        if (action === 'DELETE' && data?.id) {
          this.cache.classes = this.cache.classes.filter((c) => c.id !== data.id);
        } else if (data) {
          const idx = this.cache.classes.findIndex((c) => c.id === data.id);
          if (idx !== -1) {
            this.cache.classes[idx] = { ...this.cache.classes[idx], ...data };
          } else {
            this.cache.classes.push(data);
          }
        }
        break;

      case 'SUBJECT':
        if (action === 'DELETE' && data?.id) {
          this.cache.subjects = this.cache.subjects.filter((s) => s.id !== data.id);
        } else if (data) {
          const idx = this.cache.subjects.findIndex((s) => s.id === data.id);
          if (idx !== -1) {
            this.cache.subjects[idx] = { ...this.cache.subjects[idx], ...data };
          } else {
            this.cache.subjects.push(data);
          }
        }
        break;

      case 'FEE_PAYMENT':
        if (data) {
          const idx = this.cache.feePayments.findIndex((f) => f.id === data.id);
          if (idx !== -1) {
            this.cache.feePayments[idx] = { ...this.cache.feePayments[idx], ...data };
          } else {
            this.cache.feePayments.unshift(data);
          }
        }
        break;

      case 'FEE_LEDGER':
        if (data && data.id) {
          const idx = (this.cache.feeLedgers || []).findIndex((l) => l.id === data.id);
          if (idx !== -1) {
            this.cache.feeLedgers[idx] = { ...this.cache.feeLedgers[idx], ...data };
          } else {
            this.cache.feeLedgers = [data, ...(this.cache.feeLedgers || [])];
          }
        }
        break;

      case 'FEE_STRUCTURE':
        if (action === 'DELETE' && data?.id) {
          this.cache.feeStructures = this.cache.feeStructures.filter((f) => f.id !== data.id);
        } else if (data) {
          const idx = this.cache.feeStructures.findIndex((f) => f.id === data.id);
          if (idx !== -1) {
            this.cache.feeStructures[idx] = { ...this.cache.feeStructures[idx], ...data };
          } else {
            this.cache.feeStructures.push(data);
          }
        }
        break;

      case 'NOTICE':
        if (action === 'DELETE' && data?.id) {
          this.cache.notices = this.cache.notices.filter((n) => n.id !== data.id);
        } else if (data) {
          const idx = this.cache.notices.findIndex((n) => n.id === data.id);
          if (idx !== -1) {
            this.cache.notices[idx] = { ...this.cache.notices[idx], ...data };
          } else {
            this.cache.notices.unshift(data);
          }
        }
        break;

      case 'SETTINGS':
      case 'SESSION':
        if (data?.currentAcademicSession) {
          this.cache.settings.currentAcademicSession = data.currentAcademicSession;
        }
        if (data?.academicSessions) {
          this.cache.settings.academicSessions = data.academicSessions;
        }
        break;

      case 'STAFF_LEAVE':
        if (action === 'DELETE' && data?.id) {
          this.cache.staffLeaves = (this.cache.staffLeaves || []).filter((l) => l.id !== data.id);
        } else if (data) {
          const idx = (this.cache.staffLeaves || []).findIndex((l) => l.id === data.id);
          if (idx !== -1) {
            this.cache.staffLeaves[idx] = { ...this.cache.staffLeaves[idx], ...data };
          } else {
            this.cache.staffLeaves = [data, ...(this.cache.staffLeaves || [])];
          }
        }
        break;

      case 'STAFF_PAYROLL':
        if (action === 'DELETE' && data?.id) {
          this.cache.staffPayroll = (this.cache.staffPayroll || []).filter((p) => p.id !== data.id);
        } else if (data) {
          const idx = (this.cache.staffPayroll || []).findIndex((p) => p.id === data.id);
          if (idx !== -1) {
            this.cache.staffPayroll[idx] = { ...this.cache.staffPayroll[idx], ...data };
          } else {
            this.cache.staffPayroll = [data, ...(this.cache.staffPayroll || [])];
          }
        }
        break;

      case 'AUDIT_LOG':
        if (data) {
          const existingIdx = (this.cache.auditLogs || []).findIndex((l) => l.id === data.id);
          if (existingIdx !== -1) {
            this.cache.auditLogs[existingIdx] = { ...this.cache.auditLogs[existingIdx], ...data };
          } else {
            this.cache.auditLogs = [data, ...(this.cache.auditLogs || [])];
            if (this.cache.auditLogs.length > 500) {
              this.cache.auditLogs = this.cache.auditLogs.slice(0, 500);
            }
          }
        }
        break;

      case 'ADMIN_ACCOUNT':
        if (action === 'DELETE' && (data?.id || (data as any)?.username)) {
          const targetId = data.id;
          this.cache.adminAccounts = (this.cache.adminAccounts || []).filter(
            (a) => a.id !== targetId && a.username !== (data as any).username
          );
        } else if (data) {
          const idx = (this.cache.adminAccounts || []).findIndex((a) => a.id === data.id);
          if (idx !== -1) {
            this.cache.adminAccounts[idx] = { ...this.cache.adminAccounts[idx], ...data };
          } else {
            this.cache.adminAccounts.push(data);
          }
        }
        break;
    }

    this.persist();

    // 2. Fetch authoritative slice from MongoDB/backend to guarantee 100% consistency
    try {
      switch (entity) {
        case 'STUDENT':
          await this.syncStudents();
          break;
        case 'TEACHER':
          await this.syncStaff();
          break;
        case 'CLASS':
          await this.syncClasses();
          break;
        case 'SUBJECT':
          await this.syncSubjects();
          break;
        case 'TIMETABLE':
          await this.syncTimetable();
          break;
        case 'ATTENDANCE':
          await this.syncAttendance();
          break;
        case 'STAFF_ATTENDANCE':
          await this.syncStaffAttendance();
          break;
        case 'STAFF_LEAVE':
          await this.syncStaffLeaves();
          break;
        case 'STAFF_PAYROLL':
          await this.syncStaffPayroll();
          break;
        case 'AUDIT_LOG':
          await this.syncAuditLogs();
          break;
        case 'ADMIN_ACCOUNT':
          await this.syncAdminAccounts();
          break;
        case 'FEE_PAYMENT':
        case 'FEE_STRUCTURE':
        case 'FEE_LEDGER':
        case 'FEE_CONFIG':
          await this.syncFees();
          await this.getFeeLedgers();
          break;
        case 'EXAM':
        case 'EXAM_MARK':
          await this.syncExams();
          break;
        case 'HOMEWORK':
          await this.syncHomework();
          break;
        case 'NOTICE':
          await this.syncNotices();
          break;
        case 'STUDY_MATERIAL':
          await this.syncStudyMaterials();
          break;
        case 'HOSTEL':
          await this.syncHostel();
          break;
        case 'TRANSPORT':
          await this.syncTransport();
          break;
        case 'SETTINGS':
        case 'SESSION':
          await this.syncSettings();
          break;
      }
    } catch (syncErr) {
      console.warn('[RealtimeSync] Authoritative slice sync warning:', syncErr);
    }

    // 3. Dispatch global browser events for active React components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cps_realtime_event', { detail: event }));
      window.dispatchEvent(new CustomEvent(`cps_entity_${entity.toLowerCase()}`, { detail: event }));
      window.dispatchEvent(new CustomEvent('cps_data_updated', { detail: { entity, action } }));

      if (entity === 'SETTINGS' || entity === 'SESSION') {
        window.dispatchEvent(
          new CustomEvent('academic-session-changed', {
            detail: { session: this.cache.settings.currentAcademicSession },
          })
        );
      }
    }
  }

  private getDefaults() {
    return {
      settings: defaultSchoolSettings,
      classes: [] as AcademicClass[],
      subjects: [] as Subject[],
      staff: [] as TeacherStaff[],
      students: [] as Student[],
      timetable: [] as TimetableSlot[],
      timetablePeriods: [
        { periodNumber: 1, name: 'Period 1', startTime: '08:00 AM', endTime: '08:45 AM' },
        { periodNumber: 2, name: 'Period 2', startTime: '08:45 AM', endTime: '09:30 AM' },
        { periodNumber: 3, name: 'Period 3', startTime: '09:30 AM', endTime: '10:15 AM' },
        { periodNumber: 4, name: 'Period 4', startTime: '10:15 AM', endTime: '11:00 AM' },
        { periodNumber: 5, name: 'Recess / Break', startTime: '11:00 AM', endTime: '11:30 AM', isBreak: true, breakType: 'RECESS' as const },
        { periodNumber: 6, name: 'Period 5', startTime: '11:30 AM', endTime: '12:15 PM' },
        { periodNumber: 7, name: 'Period 6', startTime: '12:15 PM', endTime: '01:00 PM' },
        { periodNumber: 8, name: 'Period 7', startTime: '01:00 PM', endTime: '01:45 PM' },
      ],
      attendance: [] as AttendanceRecord[],
      staffAttendance: [] as StaffAttendanceRecord[],
      staffLeaves: [] as StaffLeave[],
      staffPayroll: [] as StaffPayrollRecord[],
      holidays: [] as Holiday[],
      feeStructures: [] as FeeStructure[],
      feePayments: [] as FeePayment[],
      feeConfigurations: [] as ClassFeeConfiguration[],
      transportSlabs: [] as TransportSlab[],
      feeLedgers: [] as FeeLedgerEntry[],
      exams: [] as Exam[],
      examMarks: [] as ExamMark[],
      homework: [] as Homework[],
      studyMaterials: [] as StudyMaterial[],
      hostels: [] as Hostel[],
      hostelRooms: [] as HostelRoom[],
      hostelAllocations: [] as HostelAllocation[],
      vehicles: [] as TransportVehicle[],
      routes: [] as TransportRoute[],
      notices: [] as Notice[],
      auditLogs: [] as AuditLog[],
      adminAccounts: [] as AdminAccount[],
      currentUser: {
        id: 'admin',
        username: 'admin',
        name: 'School Administrator',
        email: 'cpskushahar@gmail.com',
        phone: '8207870192',
        role: 'SUPER_ADMIN' as UserRole,
        status: 'ACTIVE' as const,
        createdAt: '2026-01-05T08:00:00.000Z',
      },
    };
  }

  private persist() {
    try {
      localStorage.setItem('cps_school_erp', JSON.stringify(this.cache));
    } catch (e) {
      console.warn('Storage quota exceeded, state kept in memory', e);
    }
  }

  private addAudit(action: string, entity: string, entityId: string, details: string) {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userName: this.cache.currentUser.name,
      role: this.cache.currentUser.role,
      action,
      entity,
      entityId,
      ipAddress: '127.0.0.1',
      details,
    };
    this.cache.auditLogs.unshift(log);
    // Preserving immutable audit records: do not truncate historical logs
    this.persist();

    // Persist to MongoDB through server API
    fetch(getApiUrl('/api/audit-logs'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(log),
    }).catch((err) => {
      console.warn('[AuditLog] Failed to persist audit log to server:', err);
    });
  }

  // Auth & Session
  getCurrentUser(): User {
    try {
      if (typeof window !== 'undefined') {
        const raw =
          localStorage.getItem('cps_erp_current_user') ||
          sessionStorage.getItem('cps_erp_current_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.id) {
            this.cache.currentUser = parsed;
            return parsed;
          }
        }
      }
    } catch {}
    return this.cache.currentUser;
  }

  setCurrentUser(user: User) {
    this.cache.currentUser = user;
    this.persist();
  }

  login(identifier: string, role?: UserRole): { success: boolean; user: User } {
    const idClean = identifier.trim().toLowerCase();
    // Search admin accounts
    const admin = (this.cache.adminAccounts || []).find(
      (a) => (a.username ? a.username.toLowerCase() === idClean : false) || (a.email ? a.email.toLowerCase() === idClean : false)
    );
    if (admin) {
      const user: User = {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        status: (admin.accountStatus || admin.status || 'ACTIVE') as any,
        createdAt: admin.createdAt,
      };
      this.cache.currentUser = user;
      this.persist();
      return { success: true, user };
    }

    // Search staff
    const staff = (this.cache.staff || []).find(
      (s) => (s.employeeId ? s.employeeId.toLowerCase() === idClean : false) || (s.email ? s.email.toLowerCase() === idClean : false)
    );
    if (staff) {
      const user: User = {
        id: staff.id,
        username: staff.employeeId,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: (staff.systemRole || staff.role || 'TEACHER') as UserRole,
        employeeId: staff.employeeId,
        status: (staff.accountStatus || 'ACTIVE') as any,
        createdAt: staff.joiningDate,
      };
      this.cache.currentUser = user;
      this.persist();
      return { success: true, user };
    }

    // Search student
    const student = (this.cache.students || []).find(
      (s) => (s.admissionNumber ? s.admissionNumber.toLowerCase() === idClean : false) || (s.email ? s.email.toLowerCase() === idClean : false)
    );
    if (student) {
      const user: User = {
        id: student.id,
        username: student.admissionNumber,
        name: student.name,
        email: student.email || `${student.admissionNumber}@student.chanakyaschool.example`,
        phone: student.mobile || student.parentPhone,
        role: 'STUDENT',
        studentId: student.id,
        status: (student.accountStatus || 'ACTIVE') as any,
        createdAt: student.admissionDate,
      };
      this.cache.currentUser = user;
      this.persist();
      return { success: true, user };
    }

    const fallbackUser: User = {
      id: this.cache.adminAccounts?.[0]?.id || 'admin-1',
      username: this.cache.adminAccounts?.[0]?.username || 'admin',
      name: this.cache.adminAccounts?.[0]?.name || 'School Administrator',
      email: this.cache.adminAccounts?.[0]?.email || 'cpskushahar@gmail.com',
      phone: this.cache.adminAccounts?.[0]?.phone || '8207870192',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-01-05T08:00:00.000Z',
    };
    this.cache.currentUser = fallbackUser;
    this.persist();
    return { success: true, user: fallbackUser };
  }

  logout() {
    clearAllStaffDrafts();
    this.addAudit('USER_LOGOUT', 'User', this.cache.currentUser.id, 'User logged out');
    const defaultUser: User = {
      id: this.cache.adminAccounts?.[0]?.id || 'admin-1',
      username: this.cache.adminAccounts?.[0]?.username || 'admin',
      name: this.cache.adminAccounts?.[0]?.name || 'School Administrator',
      email: this.cache.adminAccounts?.[0]?.email || 'cpskushahar@gmail.com',
      phone: this.cache.adminAccounts?.[0]?.phone || '8207870192',
      role: (this.cache.adminAccounts?.[0]?.role || 'SUPER_ADMIN') as UserRole,
      status: 'ACTIVE' as const,
      createdAt: '2026-01-05T08:00:00.000Z',
    };
    this.cache.currentUser = defaultUser;
    this.persist();
  }

  // Administrator Accounts Management
  addAdminAccount(data: {
    name: string;
    username: string;
    email: string;
    phone: string;
    role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN';
    status?: 'ACTIVE' | 'INACTIVE';
    password?: string;
  }): AdminAccount {
    const newAdmin: AdminAccount = {
      id: `admin-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: data.name,
      username: data.username.toLowerCase(),
      email: data.email.toLowerCase(),
      phone: data.phone,
      role: data.role,
      status: data.status || 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    this.cache.adminAccounts.push(newAdmin);
    this.addAudit('ADMIN_CREATED', 'AdminAccount', newAdmin.id, `Created admin account ${newAdmin.username} (${newAdmin.role})`);
    this.persist();

    fetch(getApiUrl('/api/admin/accounts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newAdmin,
        password: data.password || 'Admin@123',
      }),
    }).catch((err) => {
      console.warn('[AdminCreate] Failed to create admin on server:', err);
    });

    return newAdmin;
  }

  async addAdminAccountAsync(data: {
    name: string;
    username: string;
    email: string;
    phone: string;
    role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN';
    status?: 'ACTIVE' | 'INACTIVE';
    password?: string;
  }): Promise<AdminAccount> {
    const newAdmin = this.addAdminAccount(data);
    try {
      const res = await fetch(getApiUrl('/api/admin/accounts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAdmin,
          password: data.password || 'Admin@123',
        }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body.account) {
          const idx = this.cache.adminAccounts.findIndex((a) => a.id === newAdmin.id);
          if (idx !== -1) {
            this.cache.adminAccounts[idx] = { ...this.cache.adminAccounts[idx], ...body.account };
            this.persist();
          }
          return this.cache.adminAccounts[idx] || newAdmin;
        }
      }
    } catch (err) {
      console.error('[AdminCreate] Async create error:', err);
    }
    return newAdmin;
  }

  deleteAdminAccount(id: string): boolean {
    const target = this.cache.adminAccounts.find((a) => a.id === id);
    if (target) {
      if (target.username === 'admin') {
        throw new Error('Primary root administrator cannot be deleted');
      }
      this.cache.adminAccounts = this.cache.adminAccounts.filter((a) => a.id !== id);
      this.addAudit('ADMIN_DELETED', 'AdminAccount', id, `Deleted admin account ${target.username}`);
      this.persist();

      fetch(getApiUrl(`/api/admin/admins/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }).catch((err) => {
        console.warn('[AdminDelete] Failed to delete admin on server:', err);
      });

      return true;
    }
    return false;
  }

  async deleteAdminAccountAsync(id: string): Promise<boolean> {
    const target = this.cache.adminAccounts.find((a) => a.id === id);
    if (!target) return false;
    if (target.username === 'admin') {
      throw new Error('Primary root administrator cannot be deleted');
    }
    this.cache.adminAccounts = this.cache.adminAccounts.filter((a) => a.id !== id);
    this.addAudit('ADMIN_DELETED', 'AdminAccount', id, `Deleted admin account ${target.username}`);
    this.persist();

    try {
      const res = await fetch(getApiUrl(`/api/admin/admins/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (err) {
      console.error('[AdminDelete] Async server deletion failed:', err);
      return false;
    }
  }

  switchParentActiveChild(studentId: string) {
    if (this.cache.currentUser.role === 'PARENT') {
      this.cache.currentUser = {
        ...this.cache.currentUser,
        studentId,
        activeStudentId: studentId,
      };
      this.persist();
    }
  }

  // School Settings
  getSettings(): SchoolSettings {
    return this.cache.settings;
  }

  updateSettings(settings: Partial<SchoolSettings>): SchoolSettings {
    const updated = { ...this.cache.settings, ...settings };
    if (updated.logoFileKey && !updated.schoolLogo) {
      updated.schoolLogo = updated.logoFileKey;
    }
    if (updated.schoolLogo && !updated.logoFileKey && !updated.schoolLogo.startsWith('http') && !updated.schoolLogo.startsWith('blob:')) {
      updated.logoFileKey = updated.schoolLogo;
    }
    if (updated.principalSignatureFileKey && !updated.principalSignature) {
      updated.principalSignature = updated.principalSignatureFileKey;
    }
    if (updated.examControllerSignatureFileKey && !updated.examControllerSignature) {
      updated.examControllerSignature = updated.examControllerSignatureFileKey;
    }
    if (updated.principalSignature && !updated.principalSignatureFileKey && !updated.principalSignature.startsWith('http') && !updated.principalSignature.startsWith('blob:')) {
      updated.principalSignatureFileKey = updated.principalSignature;
    }
    this.cache.settings = updated;
    this.addAudit('SETTINGS_UPDATED', 'SchoolSettings', 'config', 'Updated school configuration');
    this.persist();

    // Async sync to server
    fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    }).then(async (res) => {
      if (res.ok) {
        const saved = await res.json();
        if (saved && saved.schoolName) {
          this.cache.settings = { ...this.cache.settings, ...saved };
          this.persist();
        }
      } else {
        console.warn(`[api] Background settings sync returned HTTP ${res.status}`);
      }
    }).catch((err) => {
      console.warn('[api] Background settings sync network error:', err);
    });

    return this.cache.settings;
  }

  async updateSettingsAsync(settings: Partial<SchoolSettings>): Promise<SchoolSettings> {
    const updated = { ...this.cache.settings, ...settings };
    if (updated.logoFileKey && !updated.schoolLogo) {
      updated.schoolLogo = updated.logoFileKey;
    }
    if (updated.schoolLogo && !updated.logoFileKey && !updated.schoolLogo.startsWith('http') && !updated.schoolLogo.startsWith('blob:')) {
      updated.logoFileKey = updated.schoolLogo;
    }
    if (updated.principalSignatureFileKey && !updated.principalSignature) {
      updated.principalSignature = updated.principalSignatureFileKey;
    }
    if (updated.examControllerSignatureFileKey && !updated.examControllerSignature) {
      updated.examControllerSignature = updated.examControllerSignatureFileKey;
    }
    if (updated.principalSignature && !updated.principalSignatureFileKey && !updated.principalSignature.startsWith('http') && !updated.principalSignature.startsWith('blob:')) {
      updated.principalSignatureFileKey = updated.principalSignature;
    }
    this.cache.settings = updated;
    this.addAudit('SETTINGS_UPDATED', 'SchoolSettings', 'config', 'Updated school configuration');
    this.persist();

    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required: Admin login token is missing or expired. Please log in again.');
    }

    const res = await fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    });

    if (!res.ok) {
      let errMsg = `Failed to update settings (HTTP ${res.status})`;
      try {
        const errJson = await res.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const saved = await res.json();
    if (saved && saved.schoolName) {
      this.cache.settings = { ...this.cache.settings, ...saved };
      this.persist();
    }

    return this.cache.settings;
  }

  // ==========================================
  // Academic Sessions Management
  // ==========================================
  getAcademicSessions(): AcademicSession[] {
    if (!this.cache.settings.academicSessions || !Array.isArray(this.cache.settings.academicSessions) || this.cache.settings.academicSessions.length === 0) {
      this.cache.settings.academicSessions = [
        {
          id: 'session-2026-2027',
          name: this.cache.settings.currentAcademicSession || '2026-2027',
          startDate: '2026-04-01',
          endDate: '2027-03-31',
          status: 'ACTIVE',
        },
      ];
      this.persist();
    }
    // Return sorted chronologically by startDate or name descending
    return [...this.cache.settings.academicSessions].sort((a, b) => {
      if (a.startDate && b.startDate) {
        return b.startDate.localeCompare(a.startDate);
      }
      return b.name.localeCompare(a.name);
    });
  }

  getActiveAcademicSession(): AcademicSession {
    const sessions = this.getAcademicSessions();
    const active =
      sessions.find((s) => s.status === 'ACTIVE') ||
      sessions.find((s) => s.name === this.cache.settings.currentAcademicSession) ||
      sessions[0];

    if (active && (active.status !== 'ACTIVE' || this.cache.settings.currentAcademicSession !== active.name)) {
      this.cache.settings.academicSessions = sessions.map((s) => ({
        ...s,
        status: s.id === active.id ? ('ACTIVE' as const) : ('INACTIVE' as const),
      }));
      this.cache.settings.currentAcademicSession = active.name;
      this.persist();
    }
    return active;
  }

  createAcademicSession(sessionData: {
    name: string;
    startDate: string;
    endDate: string;
    status: 'ACTIVE' | 'INACTIVE';
    description?: string;
  }): AcademicSession {
    const trimmedName = sessionData.name.trim();
    if (!trimmedName) {
      throw new Error('Session name is required (e.g. 2026-2027)');
    }

    const sessions = this.getAcademicSessions();
    if (sessions.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error(`Academic session "${trimmedName}" already exists.`);
    }

    const newSession: AcademicSession = {
      id: `ses-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: trimmedName,
      startDate: sessionData.startDate,
      endDate: sessionData.endDate,
      status: sessionData.status,
      description: sessionData.description?.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedSessions = [...sessions];

    if (newSession.status === 'ACTIVE') {
      // Deactivate all others
      updatedSessions = updatedSessions.map((s) => ({ ...s, status: 'INACTIVE' as const }));
      this.cache.settings.currentAcademicSession = newSession.name;
    }

    updatedSessions.push(newSession);
    this.cache.settings.academicSessions = updatedSessions;
    this.addAudit(
      'SESSION_CREATED',
      'AcademicSession',
      newSession.id,
      `Created academic session ${newSession.name} (${newSession.status})`
    );
    this.persist();

    // Async sync to backend
    fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('academic-session-changed', {
          detail: { session: this.cache.settings.currentAcademicSession },
        })
      );
    }

    return newSession;
  }

  updateAcademicSession(id: string, updateData: Partial<AcademicSession>): AcademicSession {
    const sessions = this.getAcademicSessions();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error('Academic session not found.');
    }

    const current = { ...sessions[idx] };
    const willBeActive = updateData.status === 'ACTIVE';

    if (updateData.name && updateData.name.trim() !== current.name) {
      const trimmed = updateData.name.trim();
      if (sessions.some((s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error(`Academic session "${trimmed}" already exists.`);
      }
      current.name = trimmed;
    }

    if (updateData.startDate) current.startDate = updateData.startDate;
    if (updateData.endDate) current.endDate = updateData.endDate;
    if (updateData.description !== undefined) current.description = updateData.description.trim();
    current.updatedAt = new Date().toISOString();

    let updatedSessions = [...sessions];

    if (willBeActive) {
      current.status = 'ACTIVE';
      updatedSessions = updatedSessions.map((s) =>
        s.id === id ? current : { ...s, status: 'INACTIVE' as const }
      );
      this.cache.settings.currentAcademicSession = current.name;
    } else if (updateData.status === 'INACTIVE') {
      current.status = 'INACTIVE';
      // If deactivating active session, pick another to be active if available
      const other = updatedSessions.find((s) => s.id !== id);
      if (other) {
        other.status = 'ACTIVE';
        this.cache.settings.currentAcademicSession = other.name;
      }
      updatedSessions = updatedSessions.map((s) => {
        if (s.id === id) return current;
        if (other && s.id === other.id) return { ...s, status: 'ACTIVE' as const };
        return s;
      });
    } else {
      updatedSessions = updatedSessions.map((s) => (s.id === id ? current : s));
    }

    if (current.status === 'ACTIVE') {
      this.cache.settings.currentAcademicSession = current.name;
    }

    this.cache.settings.academicSessions = updatedSessions;
    this.addAudit(
      'SESSION_UPDATED',
      'AcademicSession',
      id,
      `Updated academic session ${current.name} (Status: ${current.status})`
    );
    this.persist();

    fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('academic-session-changed', {
          detail: { session: this.cache.settings.currentAcademicSession },
        })
      );
    }

    return current;
  }

  setActiveAcademicSession(id: string): AcademicSession {
    const sessions = this.getAcademicSessions();
    const target = sessions.find((s) => s.id === id);
    if (!target) {
      throw new Error('Academic session not found.');
    }

    const updatedSessions = sessions.map((s) => ({
      ...s,
      status: s.id === id ? ('ACTIVE' as const) : ('INACTIVE' as const),
      updatedAt: s.id === id ? new Date().toISOString() : s.updatedAt,
    }));

    this.cache.settings.academicSessions = updatedSessions;
    this.cache.settings.currentAcademicSession = target.name;

    this.addAudit(
      'SESSION_ACTIVATED',
      'AcademicSession',
      target.id,
      `Switched active academic session to ${target.name}`
    );
    this.persist();

    fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('academic-session-changed', {
          detail: { session: target.name },
        })
      );
    }

    return target;
  }

  deactivateAcademicSession(id: string): { success: boolean; message?: string } {
    const sessions = this.getAcademicSessions();
    const target = sessions.find((s) => s.id === id);
    if (!target) {
      throw new Error('Academic session not found.');
    }

    if (target.status !== 'ACTIVE') {
      return { success: true, message: 'Session is already inactive.' };
    }

    const other = sessions.find((s) => s.id !== id);
    if (!other) {
      throw new Error('Cannot deactivate the only academic session. You must create or activate another session first.');
    }

    this.setActiveAcademicSession(other.id);
    return {
      success: true,
      message: `Deactivated ${target.name}. Active academic session switched to ${other.name}.`,
    };
  }

  deleteAcademicSession(id: string): { success: boolean; message?: string } {
    const sessions = this.getAcademicSessions();
    const target = sessions.find((s) => s.id === id);
    if (!target) {
      throw new Error('Academic session not found.');
    }

    if (target.status === 'ACTIVE') {
      throw new Error('Cannot delete the currently ACTIVE academic session. Set another session as active first.');
    }

    if (sessions.length <= 1) {
      throw new Error('Cannot delete the only academic session.');
    }

    this.cache.settings.academicSessions = sessions.filter((s) => s.id !== id);
    this.addAudit(
      'SESSION_DELETED',
      'AcademicSession',
      id,
      `Deleted inactive academic session ${target.name}`
    );
    this.persist();

    fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('academic-session-changed', {
          detail: { session: this.cache.settings.currentAcademicSession },
        })
      );
    }

    return { success: true, message: `Academic session ${target.name} has been deleted.` };
  }

  // Dashboard Metrics
  // Dashboard Metrics & Live Aggregation
  async fetchDashboardSummary(academicSession?: string, date?: string) {
    try {
      const queryParams = new URLSearchParams();
      if (academicSession) queryParams.set('academicSession', academicSession);
      if (date) queryParams.set('date', date);
      const url = getApiUrl(`/api/dashboard/summary?${queryParams.toString()}`);
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        return await res.json();
      }
      console.warn(`[API] Dashboard summary request failed (HTTP ${res.status}).`);
    } catch (err) {
      console.warn('[API] Could not fetch the dashboard summary:', err);
    }
    // null tells the dashboard the live figures could not be loaded, so it can say so.
    return null;
  }

  getDashboardMetrics() {
    const activeStudents = this.cache.students.filter((s) => s.status === 'ACTIVE');
    const activeStudentIdSet = new Set(activeStudents.map((s) => s.id));

    // Active classes strictly excluding inactive classes like ELP
    const activeClasses = this.cache.classes
      .filter((c) => (c.status || 'ACTIVE') === 'ACTIVE' && (c as any).isActive !== false)
      .sort((a, b) => (a.numericOrder || 0) - (b.numericOrder || 0));

    const classDistribution = activeClasses.map((c) => {
      const studentCount = activeStudents.filter((s) => s.classId === c.id || s.className === c.name).length;
      return {
        id: c.id,
        name: c.name,
        numericOrder: c.numericOrder || 0,
        count: studentCount,
        capacity: c.maxCapacity || 40,
        sections: c.sections || ['A'],
      };
    });

    const activeStaff = this.cache.staff.filter((s) => (s as any).status === 'ACTIVE' || !(s as any).status);
    const teachers = activeStaff.filter(
      (s) =>
        s.role === 'TEACHER' ||
        s.designation?.toLowerCase().includes('teacher') ||
        s.designation?.toLowerCase().includes('faculty') ||
        (s.department === 'ACADEMICS' && s.role !== 'SUPER_ADMIN' && s.role !== 'SCHOOL_ADMIN' && s.role !== 'PRINCIPAL')
    );
    const nonTeaching = activeStaff.filter((s) => !teachers.includes(s));
    const totalStaff = activeStaff.length;

    const todayStr = new Date().toISOString().substring(0, 10);
    const dateObj = new Date(todayStr + 'T12:00:00Z');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDay = days[dateObj.getDay()] || 'Thursday';

    // Student Attendance for today strictly
    const relevantAtt = this.cache.attendance.filter((a) => a.date === todayStr);
    const isAttMarked = relevantAtt.length > 0;
    const presentCount = relevantAtt.filter((a) => a.status === 'PRESENT').length;
    const absentCount = relevantAtt.filter((a) => a.status === 'ABSENT').length;
    const leaveCount = relevantAtt.filter((a) => a.status === 'LEAVE' || a.status === 'LATE' || a.status === 'HOLIDAY').length;
    const attPercentage = isAttMarked ? Math.round((presentCount / relevantAtt.length) * 100) : null;
    const notMarkedCount = Math.max(0, activeStudents.length - relevantAtt.length);

    // Staff Attendance for today strictly
    const relevantStaffAtt = this.cache.staffAttendance.filter((a) => a.date === todayStr);
    const isStaffAttMarked = relevantStaffAtt.length > 0;
    const staffPresent = relevantStaffAtt.filter((a) => a.status === 'PRESENT').length;
    const staffAbsent = relevantStaffAtt.filter((a) => a.status === 'ABSENT').length;
    const staffOnLeave = relevantStaffAtt.filter((a) => a.status === 'LEAVE' || a.status === 'LATE').length;
    const staffPercentage = isStaffAttMarked ? Math.round((staffPresent / relevantStaffAtt.length) * 100) : null;

    const todayFee = this.cache.feePayments
      .filter((p) => p.paymentDate === todayStr && (p as any).status !== 'FAILED')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const thisMonthPrefix = todayStr.substring(0, 7);
    const monthlyFee = this.cache.feePayments
      .filter((p) => p.paymentDate && p.paymentDate.startsWith(thisMonthPrefix) && (p as any).status !== 'FAILED')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Calculate pending fees strictly for ACTIVE students in current academic session
    const activeLedgers = (this.cache.feeLedgers || []).filter((l) => activeStudentIdSet.has(l.studentId));
    let totalPendingAmount = 0;
    let studentsWithPendingCount = 0;
    for (const st of activeStudents) {
      const stLedgers = activeLedgers.filter((l) => l.studentId === st.id);
      const dues = stLedgers.reduce(
        (sum, l) => sum + (Number(l.pendingAmount ?? Math.max(0, (l.total ?? l.amount ?? 0) - (l.paidAmount ?? 0))) || 0),
        0
      );
      if (dues > 0) {
        totalPendingAmount += dues;
        studentsWithPendingCount++;
      }
    }

    // Unique recent transactions deduplicated by receipt number
    const seenReceipts = new Set<string>();
    const recentPayments: any[] = [];
    const sortedPayments = [...this.cache.feePayments].sort(
      (a: any, b: any) => new Date(b.createdAt || b.paymentDate).getTime() - new Date(a.createdAt || a.paymentDate).getTime()
    );
    for (const p of sortedPayments) {
      const rKey = (p.receiptNumber || p.id || '').trim();
      if (!rKey || seenReceipts.has(rKey)) continue;
      seenReceipts.add(rKey);

      const st = activeStudents.find((s) => s.id === p.studentId) || this.cache.students.find((s) => s.id === p.studentId);
      const displayClass = st ? (st.className || p.className) : (p.className && p.className !== 'Class 10' && p.className !== 'Class 9' ? p.className : '—');
      const displaySection = st?.section || p.section || 'A';

      recentPayments.push({
        id: p.id,
        receiptNumber: p.receiptNumber || '—',
        studentId: p.studentId,
        studentName: st?.name || p.studentName || '—',
        className: displayClass || '—',
        section: displaySection,
        feeType: p.feeType || (p as any).feeHead || '—',
        paymentMethod: p.paymentMethod || (p as any).paymentMode || '—',
        amount: Number(p.amount) || 0,
        paymentDate: p.paymentDate || '—',
        status: (p as any).status || 'SUCCESS',
      });
      if (recentPayments.length >= 7) break;
    }

    let totalBeds = 0;
    let occupiedBeds = 0;
    this.cache.hostelRooms.forEach((r) => {
      totalBeds += Number(r.capacityBeds || r.capacity || 0);
      occupiedBeds += (r.beds || []).filter((b) => Boolean(b.allocatedStudentId)).length;
    });

    const activeVehicles = this.cache.vehicles.filter((v) => v.status === 'ACTIVE').length;
    const activeRoutes = this.cache.routes.filter((r) => r.status === 'ACTIVE').length;

    // Timetable slots for today
    const todayTimetableSlots = this.cache.timetable
      .filter((t) => (t.dayOfWeek || '').toLowerCase() === todayDay.toLowerCase())
      .sort((a, b) => Number(a.periodNumber) - Number(b.periodNumber));

    // Upcoming exams strictly with valid dates
    const seenExamNames = new Set<string>();
    const upcomingExams = this.cache.exams
      .filter((e) => {
        const examName = (e.name || e.title || '').trim();
        if (!examName) return false;
        const validDate = e.endDate || e.startDate;
        if (!validDate || !/^\d{4}-\d{2}-\d{2}/.test(validDate)) return false;
        if (validDate < todayStr) return false;
        const dedupeKey = `${examName.toLowerCase()}_${e.startDate || ''}_${e.endDate || ''}`;
        if (seenExamNames.has(dedupeKey)) return false;
        seenExamNames.add(dedupeKey);
        return true;
      })
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

    // Legitimate published notices
    const legitimateNotices = this.cache.notices
      .filter((n) => {
        if (n.status !== 'PUBLISHED') return false;
        const title = (n.title || '').trim().toLowerCase();
        const id = (n.id || '').trim().toLowerCase();
        if (id.includes('test-debug') || title.includes('debug draft') || title.startsWith('test all notice') || /msg \d+$/i.test(title)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.publishedDate || '').localeCompare(a.publishedDate || ''));

    const activeSubjects = this.cache.subjects.filter((s) => s.status === 'ACTIVE' || (s as any).isActive !== false);
    const totalSectionsCount = activeClasses.reduce(
      (sum, c) => sum + (c.detailedSections?.filter((s) => s.status === 'ACTIVE').length || c.sections?.length || 1),
      0
    );

    return {
      academicSession: this.cache.settings.currentAcademicSession || '2026-2027',
      todayDate: todayStr,
      todayDay,
      totalStudents: activeStudents.length,
      enrolledStudents: this.cache.students.length,
      classDistribution,
      totalTeachers: teachers.length,
      totalNonTeaching: nonTeaching.length,
      totalStaff,
      attendance: {
        isMarked: isAttMarked,
        date: todayStr,
        isToday: true,
        percentage: attPercentage,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        notMarked: notMarkedCount,
        totalMarked: relevantAtt.length,
        totalActive: activeStudents.length,
        displayText: isAttMarked ? `${attPercentage}%` : 'Not recorded',
      },
      staffAttendance: {
        isMarked: isStaffAttMarked,
        date: todayStr,
        isToday: true,
        present: staffPresent,
        absent: staffAbsent,
        onLeave: staffOnLeave,
        totalMarked: relevantStaffAtt.length,
        totalStaff,
        percentage: staffPercentage,
      },
      fees: {
        todayCollection: todayFee,
        monthlyCollection: monthlyFee,
        pendingAmount: totalPendingAmount,
        studentsWithPendingCount,
        recentPayments,
      },
      hostel: {
        totalRooms: this.cache.hostelRooms.length,
        totalBeds,
        occupiedBeds,
        availableBeds: Math.max(0, totalBeds - occupiedBeds),
        occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      },
      transport: {
        totalVehicles: this.cache.vehicles.length,
        activeVehicles,
        activeBuses: activeVehicles,
        totalRoutes: this.cache.routes.length,
        activeRoutes,
        maintenanceBuses: this.cache.vehicles.filter((v) => v.status === 'MAINTENANCE').length,
      },
      academics: {
        totalClasses: activeClasses.length,
        totalSections: totalSectionsCount,
        totalSubjects: activeSubjects.length,
        scheduledPeriodsToday: todayTimetableSlots.length,
      },
      timetable: {
        todayDay,
        scheduledCount: todayTimetableSlots.length,
        slots: todayTimetableSlots,
      },
      upcomingExams: upcomingExams.slice(0, 3),
      recentNotices: legitimateNotices.slice(0, 5),
    };
  }

  // Institutional Analytics & Official Reports
  async fetchInstitutionalAnalytics(filters?: {
    academicSession?: string;
    dateFrom?: string;
    dateTo?: string;
    classId?: string;
    section?: string;
    examId?: string;
    subjectId?: string;
  }): Promise<any> {
    try {
      const query = new URLSearchParams();
      if (filters?.academicSession) query.set('academicSession', filters.academicSession);
      if (filters?.dateFrom) query.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) query.set('dateTo', filters.dateTo);
      if (filters?.classId) query.set('classId', filters.classId);
      if (filters?.section) query.set('section', filters.section);
      if (filters?.examId) query.set('examId', filters.examId);
      if (filters?.subjectId) query.set('subjectId', filters.subjectId);

      const res = await fetch(getApiUrl(`/api/analytics/official-reports?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) return data;
      // The server is the only source for report figures and decides who may see them,
      // so a refusal or failure is shown as an error (no client-side recalculation).
      if (res.status === 403) return { success: false, error: 'You do not have access to reports.' };
      if (res.status === 401) return { success: false, error: 'Your session has ended. Please sign in again.' };
      return { success: false, error: data?.error || 'The report could not be loaded. Please try again.' };
    } catch {
      return { success: false, error: 'The report could not be loaded. Check your internet connection.' };
    }
  }


  // Students Dashboard Statistics
  getStudentStats() {
    const totalStudents = this.cache.students.length;
    const activeStudents = this.cache.students.filter((s) => s.status === 'ACTIVE').length;
    const inactiveStudents = this.cache.students.filter(
      (s) => s.status === 'INACTIVE' || s.status === 'WITHDRAWN' || s.status === 'TRANSFERRED'
    ).length;
    const newlyAdmittedStudents = this.cache.students.filter(
      (s) => s.academicSession === this.cache.settings.currentAcademicSession
    ).length;

    const classCounts: Record<string, number> = {};
    this.cache.classes.forEach((c) => {
      classCounts[c.name] = this.cache.students.filter((s) => s.classId === c.id || s.className === c.name).length;
    });

    const sectionCounts: Record<string, number> = { A: 0, B: 0, C: 0 };
    this.cache.students.forEach((s) => {
      const sec = s.section || 'A';
      sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
    });

    return {
      totalStudents,
      activeStudents,
      inactiveStudents,
      newlyAdmittedStudents,
      classCounts,
      sectionCounts,
    };
  }

  // Previews next auto-generated admission number and unique roll number
  getNextStudentNumbers(classId: string, section: string) {
    // Generate unique 8-digit admission number starting with 6401 (e.g. 64010001, 64010002)
    let maxAdm = 64010000;
    this.cache.students.forEach((s) => {
      const num = parseInt(s.admissionNumber, 10);
      if (!isNaN(num) && s.admissionNumber.startsWith('6401') && num > maxAdm) {
        maxAdm = num;
      }
    });
    const admissionNumber = String(maxAdm + 1);

    const currentClass = this.cache.classes.find((c) => c.id === classId || c.name === classId);
    const classNum = currentClass ? String(currentClass.numericOrder).padStart(2, '0') : '10';
    const seq = String(this.cache.students.length + 1).padStart(4, '0');
    const registrationNumber = `CPS2026${classNum}${seq}`;

    const enrolledInClass = this.cache.students.filter(
      (s) => (s.classId === classId || s.className === currentClass?.name) && s.section === section
    );
    const rollNumber = String(enrolledInClass.length + 1);

    return {
      admissionNumber,
      registrationNumber,
      rollNumber,
    };
  }

  // Search existing parents by phone or email for Multiple Children Parent Linking
  findExistingParent(query: string) {
    if (!query || query.trim().length < 3) return null;
    const q = query.trim().toLowerCase();
    const phoneClean = q.replace(/[^0-9]/g, '');

    const matchedStudents = this.cache.students.filter((s) => {
      const pPhoneClean = (s.parentPhone || s.fatherMobile || s.motherMobile || s.mobile || '').replace(/[^0-9]/g, '');
      const phoneMatch = phoneClean.length >= 7 && pPhoneClean.includes(phoneClean);
      const emailMatch = q.includes('@') && (
        (s.parentEmail && s.parentEmail.toLowerCase() === q) ||
        (s.fatherEmail && s.fatherEmail.toLowerCase() === q) ||
        (s.motherEmail && s.motherEmail.toLowerCase() === q)
      );
      return phoneMatch || emailMatch;
    });

    if (matchedStudents.length === 0) {
      return null;
    }

    const primary = matchedStudents[0];
    return {
      found: true,
      // Admission screens read `children` / `childrenCount`; keep them alongside linkedStudents.
      children: matchedStudents,
      childrenCount: matchedStudents.length,
      parentName: primary.parentName || primary.fatherName || 'Parent',
      fatherName: primary.fatherName || primary.parentName,
      motherName: primary.motherName,
      guardianName: primary.guardianName,
      parentPhone: primary.parentPhone || primary.fatherMobile,
      fatherMobile: primary.fatherMobile || primary.parentPhone,
      motherMobile: primary.motherMobile,
      guardianMobile: primary.guardianMobile,
      parentEmail: primary.parentEmail || primary.fatherEmail,
      fatherEmail: primary.fatherEmail,
      motherEmail: primary.motherEmail,
      parentOccupation: primary.parentOccupation || primary.fatherOccupation,
      fatherOccupation: primary.fatherOccupation,
      motherOccupation: primary.motherOccupation,
      guardianRelationship: primary.guardianRelationship,
      address: primary.address,
      city: primary.city || 'Sheohar',
      state: primary.state || 'Bihar',
      pincode: primary.pincode || '843329',
      linkedStudents: matchedStudents.map((s) => ({
        id: s.id,
        name: s.name,
        className: s.className,
        section: s.section,
        admissionNumber: s.admissionNumber,
        rollNumber: s.rollNumber,
        photo: s.photo,
      })),
    };
  }

  // Get sibling students / children linked to the same parent
  getLinkedChildren(parentPhoneOrEmail: string, excludeStudentId?: string) {
    if (!parentPhoneOrEmail) return [];
    const phoneClean = parentPhoneOrEmail.replace(/[^0-9]/g, '');
    const isEmail = parentPhoneOrEmail.includes('@');
    return this.cache.students.filter((s) => {
      if (excludeStudentId && s.id === excludeStudentId) return false;
      const sPhoneClean = (s.parentPhone || s.fatherMobile || s.motherMobile || '').replace(/[^0-9]/g, '');
      if (phoneClean.length >= 7 && sPhoneClean.length >= 7 && (sPhoneClean === phoneClean || sPhoneClean.includes(phoneClean))) {
        return true;
      }
      if (isEmail && s.parentEmail && s.parentEmail.toLowerCase() === parentPhoneOrEmail.toLowerCase()) {
        return true;
      }
      return false;
    });
  }

  // Students
  getStudents(filters?: { classId?: string; section?: string; search?: string; status?: string; academicSession?: string }) {
    let list = [...this.cache.students];
    if (filters?.classId && filters.classId !== 'ALL') {
      list = list.filter((s) => s.classId === filters.classId || s.className === filters.classId);
    }
    if (filters?.section && filters.section !== 'ALL') {
      list = list.filter((s) => s.section === filters.section);
    }
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((s) => s.status === filters.status);
    }
    if (filters?.academicSession && filters.academicSession !== 'ALL') {
      list = list.filter((s) => s.academicSession === filters.academicSession);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          Boolean(s) &&
          ((s.name && s.name.toLowerCase().includes(q)) ||
            (s.firstName && s.firstName.toLowerCase().includes(q)) ||
            (s.lastName && s.lastName.toLowerCase().includes(q)) ||
            (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q)) ||
            (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)) ||
            s.rollNumber === q ||
            (s.parentPhone && s.parentPhone.includes(q)) ||
            (s.parentName && s.parentName.toLowerCase().includes(q)) ||
            (s.fatherName && s.fatherName.toLowerCase().includes(q)) ||
            (s.mobile && s.mobile.includes(q)))
      );
    }
    return list;
  }

  getStudentById(id: string): Student | undefined {
    return this.cache.students.find((s) => s.id === id);
  }

  admitStudent(data: Partial<Student>, skipServerSync = false): Student {
    // Generate 8-digit unique admission number starting with 6401 (e.g. 64010001, 64010002)
    let maxAdm = 64010000;
    this.cache.students.forEach((s) => {
      const num = parseInt(s.admissionNumber, 10);
      if (!isNaN(num) && s.admissionNumber.startsWith('6401') && num > maxAdm) {
        maxAdm = num;
      }
    });
    const admissionNumber = data.admissionNumber || String(maxAdm + 1);

    // Generate registration number: CPS2026100001
    const currentClass = this.cache.classes.find((c) => c.id === data.classId || c.name === data.className);
    const classNum = currentClass ? String(currentClass.numericOrder).padStart(2, '0') : '10';
    const seq = String(this.cache.students.length + 1).padStart(4, '0');
    const registrationNumber = data.registrationNumber || `CPS2026${classNum}${seq}`;

    // Unique class-wise roll number
    const enrolledInClass = this.cache.students.filter(
      (s) => (s.classId === data.classId || s.className === currentClass?.name) && s.section === data.section
    );
    const rollNumber = data.rollNumber || String(enrolledInClass.length + 1);

    const fullName = data.name ||
      [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ') ||
      'Unnamed Student';

    const cleanPhoto = (data.photo && !data.photo.startsWith('blob:') && !data.photo.startsWith('data:'))
      ? data.photo
      : (data.photoFileKey || '');
    const cleanPhotoKey = data.photoFileKey || (cleanPhoto ? cleanPhoto : '');

    const newStudent: Student = {
      ...data,
      id: data.id || `st-${Date.now()}`,
      admissionNumber,
      registrationNumber,
      rollNumber, // auto-generated unique roll number
      name: fullName,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      photo: cleanPhoto,
      photoFileKey: cleanPhotoKey,
      documents: Array.isArray(data.documents) ? data.documents : [],
      dob: data.dob || '',
      gender: data.gender as any,
      bloodGroup: data.bloodGroup || '',
      aadhaarNumber: data.aadhaarNumber,
      category: data.category as Student['category'],
      religion: data.religion || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      pincode: data.pincode || '',
      mobile: data.mobile || '',
      email: data.email || '',
      admissionDate: data.admissionDate || new Date().toISOString().substring(0, 10),
      enrollmentDate: data.enrollmentDate || data.admissionDate || new Date().toISOString().substring(0, 10),
      feeStartDate: data.feeStartDate || data.enrollmentDate || data.admissionDate || new Date().toISOString().substring(0, 10),
      portalEntryDate: data.portalEntryDate || new Date().toISOString().substring(0, 10),
      feeProfile: data.feeProfile,
      classId: currentClass ? currentClass.id : data.classId || '',
      className: currentClass ? currentClass.name : data.className || '',
      section: data.section || '',
      parentName: data.parentName || data.fatherName || '',
      fatherName: data.fatherName || data.parentName || '',
      motherName: data.motherName || '',
      guardianName: data.guardianName || '',
      parentPhone: data.parentPhone || data.fatherMobile || data.mobile || '',
      fatherMobile: data.fatherMobile || data.parentPhone || '',
      motherMobile: data.motherMobile || '',
      guardianMobile: data.guardianMobile || '',
      parentEmail: data.parentEmail || data.fatherEmail || data.email || '',
      fatherEmail: data.fatherEmail || '',
      motherEmail: data.motherEmail || '',
      parentOccupation: data.parentOccupation || data.fatherOccupation || '',
      fatherOccupation: data.fatherOccupation || data.parentOccupation || '',
      motherOccupation: data.motherOccupation || '',
      guardianRelationship: data.guardianRelationship || '',
      emergencyContact: data.emergencyContact || data.parentPhone || '',
      emergencyContactName: data.emergencyContactName || data.parentName || '',
      emergencyRelationship: data.emergencyRelationship || '',
      secondaryEmergencyContact: data.secondaryEmergencyContact || '',
      secondaryEmergencyName: data.secondaryEmergencyName || '',
      previousSchool: data.previousSchool || '',
      previousClass: data.previousClass || '',
      previousMarks: data.previousMarks || '',
      previousSession: data.previousSession || '',
      academicSession: data.academicSession || this.cache.settings.currentAcademicSession,
      status: data.status || 'ACTIVE',
      loginEnabled: data.loginEnabled !== false,
      accountStatus: data.accountStatus || 'ACTIVE',
      hostelRequired: data.hostelRequired || false,
      hostelRoomId: data.hostelRoomId,
      hostelBedNumber: data.hostelBedNumber,
      hostelName: data.hostelName,
      hostelWarden: data.hostelWarden,
      transportRequired: data.transportRequired || false,
      transportRouteId: data.transportRouteId,
      transportStopName: data.transportStopName,
      pickupPoint: data.pickupPoint,
      vehicleNumber: data.vehicleNumber,
      driverName: data.driverName,
      driverContact: data.driverContact,
      identificationMark: data.identificationMark || '',
      allergies: data.allergies || '',
      medicalConditions: data.medicalConditions || '',
      medications: data.medications || '',
      doctorName: data.doctorName || '',
      doctorContact: data.doctorContact || '',
      specialMedicalInstructions: data.specialMedicalInstructions || '',
      academicHistory: data.academicHistory || [],
      activityHistory: [
        {
          id: `act-${Date.now()}`,
          timestamp: new Date().toISOString().substring(0, 10),
          title: 'Student Admission Onboarded',
          description: `Admitted to ${currentClass ? currentClass.name : data.className || 'Class 10'}-${data.section || 'A'} (Session ${data.academicSession || this.cache.settings.currentAcademicSession}) with Official Admission No. ${admissionNumber}`,
          category: 'ADMISSION',
          performedBy: 'Admissions Office',
        },
      ],
    };

    this.cache.students.unshift(newStudent);
    this.addAudit('STUDENT_ADMISSION', 'Student', newStudent.id, `Admitted ${newStudent.name} (Adm No: ${admissionNumber})`);
    this.persist();

    // Async sync with server with valid authentication headers if not skipped
    if (!skipServerSync) {
      fetch(getApiUrl('/api/students'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newStudent),
      }).catch((err) => {
        console.warn('[API] Background admission sync warning:', err);
      });
    }

    return newStudent;
  }

  async admitStudentAsync(data: Partial<Student>): Promise<Student> {
    // Send only what was entered. The server validates the admission and allocates the admission,
    // registration and roll numbers; nothing is invented for empty fields and nothing is cached
    // until the server has saved the student.
    const payload: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && value.trim() === '') continue;
      payload[key] = value;
    }
    delete payload.admissionNumber;
    delete payload.registrationNumber;
    delete payload.rollNumber;
    if (!payload.name) {
      payload.name = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');
    }
    if (payload.photo && (String(payload.photo).startsWith('blob:') || String(payload.photo).startsWith('data:'))) {
      payload.photo = payload.photoFileKey || undefined;
    }

    let res: Response;
    try {
      res = await fetch(getApiUrl('/api/students'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('Could not reach the school server. The admission was not saved.');
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(body?.error || `The admission could not be saved (HTTP ${res.status}).`);
      err.code = body?.code;
      err.status = res.status;
      throw err;
    }
    const serverSaved: Student = body;
    const idx = this.cache.students.findIndex((s) => s.id === serverSaved.id);
    if (idx !== -1) {
      this.cache.students[idx] = { ...this.cache.students[idx], ...serverSaved };
    } else {
      this.cache.students.unshift(serverSaved);
    }
    this.addAudit('STUDENT_ADMISSION', 'Student', serverSaved.id, `Admitted ${serverSaved.name} (Adm No: ${serverSaved.admissionNumber})`);
    this.persist();
    return serverSaved;
  }

  /** Changes a student's status and waits for the server to save it. Throws with the server's message on failure. */
  async changeStudentStatusAsync(id: string, status: StudentStatus, reason?: string, effectiveDate?: string): Promise<Student> {
    const student = this.getStudentById(id);
    if (!student) throw new Error('Student not found');
    const previousStatus = student.status;
    const dateStr = effectiveDate || new Date().toISOString().substring(0, 10);
    const newActivity = {
      id: `act-${Date.now()}`,
      timestamp: dateStr,
      title: `Status Changed to ${status}`,
      description: reason
        ? `Status changed from ${previousStatus} to ${status}. Reason: ${reason}`
        : `Status changed from ${previousStatus} to ${status}`,
      category: 'STATUS' as const,
      performedBy: getStoredUser()?.name || 'Administration',
    };
    let res: Response;
    try {
      res = await fetch(getApiUrl(`/api/students/${encodeURIComponent(student.id)}/status`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
    } catch {
      throw new Error('Could not reach the school server. The status was not changed.');
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `Could not change the status (HTTP ${res.status}).`);
    }
    // Status is saved; record the history entry on the profile.
    return this.updateStudentAsync(student.id, {
      status,
      activityHistory: [newActivity, ...(student.activityHistory || [])],
    });
  }

  /**
   * Emails the admission letter PDF to the parent email saved on the student's record.
   * Resolves with the server's verdict; `status` is ACCEPTED only when the email service accepted the message.
   */
  async emailAdmissionLetter(studentId: string, pdfBase64: string, resend = false): Promise<{
    ok: boolean;
    status?: 'ACCEPTED' | 'FAILED';
    code?: string;
    message: string;
    recipient?: string;
    record?: Student['admissionLetterEmail'];
  }> {
    try {
      const res = await fetch(getApiUrl(`/api/students/${encodeURIComponent(studentId)}/admission-letter/email`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pdfBase64, resend }),
      });
      const body: any = await res.json().catch(() => ({}));
      if (res.ok && body?.status === 'ACCEPTED') {
        const idx = this.cache.students.findIndex((s) => s.id === studentId);
        if (idx !== -1 && body.admissionLetterEmail) {
          this.cache.students[idx] = { ...this.cache.students[idx], admissionLetterEmail: body.admissionLetterEmail };
          this.persist();
        }
        return { ok: true, status: 'ACCEPTED', message: body.message, recipient: body.recipient, record: body.admissionLetterEmail };
      }
      return { ok: false, status: body?.status, code: body?.code, message: body?.error || `The email was not sent (HTTP ${res.status}).` };
    } catch {
      return { ok: false, message: 'Could not reach the school server. The email was not sent.' };
    }
  }

  updateStudent(id: string, updates: Partial<Student>, skipServerSync = false): Student {
    const idx = this.cache.students.findIndex((s) => s.id === id);
    if (idx !== -1) {
      const existing = this.cache.students[idx];
      const originalAdmissionNumber = existing.admissionNumber;
      const originalRegistrationNumber = existing.registrationNumber;

      // Preserve existing photo and documents unless valid updates provided
      const photoToKeep = (updates.photo && !updates.photo.startsWith('blob:') && !updates.photo.startsWith('data:'))
        ? updates.photo
        : (updates.photoFileKey || existing.photo);
      const photoKeyToKeep = updates.photoFileKey || existing.photoFileKey;
      const docsToKeep = (Array.isArray(updates.documents) && updates.documents.length > 0)
        ? updates.documents
        : (existing.documents || []);

      if (updates.enrollmentDate) {
        updates.feeStartDate = updates.enrollmentDate;
      } else if (updates.feeStartDate && !updates.enrollmentDate) {
        updates.enrollmentDate = updates.feeStartDate;
      }

      if (updates.fatherMobile) {
        updates.parentPhone = updates.fatherMobile;
      } else if (updates.parentPhone) {
        updates.fatherMobile = updates.parentPhone;
      }

      const merged: Student = {
        ...existing,
        ...updates,
        photo: photoToKeep,
        photoFileKey: photoKeyToKeep,
        documents: docsToKeep,
        admissionNumber: originalAdmissionNumber,
        registrationNumber: originalRegistrationNumber,
      };
      if (merged.fatherMobile && !merged.parentPhone) {
        merged.parentPhone = merged.fatherMobile;
      } else if (merged.parentPhone && !merged.fatherMobile) {
        merged.fatherMobile = merged.parentPhone;
      }
      if (updates.firstName || updates.lastName) {
        merged.name = [updates.firstName, updates.middleName, updates.lastName].filter(Boolean).join(' ') || merged.name;
      }
      this.cache.students[idx] = merged;
      this.addAudit('STUDENT_UPDATED', 'Student', id, `Updated student record for ${this.cache.students[idx].name}`);
      this.persist();

      // Async sync with server
      if (!skipServerSync) {
        fetch(getApiUrl(`/api/students/${encodeURIComponent(id)}`), {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(merged),
        }).catch((err) => {
          console.warn('[API] updateStudent background sync error:', err);
        });
      }

      return this.cache.students[idx];
    }
    throw new Error('Student not found');
  }

  async updateStudentAsync(id: string, updates: Partial<Student>): Promise<Student> {
    const previous = this.cache.students.find((s) => s.id === id);
    const snapshot = previous ? { ...previous } : null;
    const local = this.updateStudent(id, updates, true);
    const restore = () => {
      if (!snapshot) return;
      const i = this.cache.students.findIndex((s) => s.id === id);
      if (i !== -1) {
        this.cache.students[i] = snapshot;
        this.persist();
      }
    };
    try {
      const res = await fetch(getApiUrl(`/api/students/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(local),
      });

      if (res.ok) {
        const serverUpdated: Student = await res.json();
        const idx = this.cache.students.findIndex((s) => s.id === id || s.id === serverUpdated.id);
        if (idx !== -1) {
          this.cache.students[idx] = { ...this.cache.students[idx], ...serverUpdated };
        }
        if (
          updates.hostelRequired !== undefined ||
          updates.hostelRoomId !== undefined ||
          updates.hostelBedNumber !== undefined ||
          updates.hostelStatus !== undefined
        ) {
          try {
            await this.syncHostel();
          } catch (hErr) {
            console.warn('[API] syncHostel after updateStudent error:', hErr);
          }
        }
        this.persist();
        return serverUpdated;
      } else {
        const errJson = await res.json().catch(() => ({}));
        restore();
        throw new Error(errJson.error || `Could not save changes (HTTP ${res.status}).`);
      }
    } catch (err: any) {
      console.warn('[API] Server sync error during student update:', err);
      if (err instanceof TypeError) {
        restore();
        throw new Error('Could not reach the school server. Your changes were not saved.');
      }
      throw err;
    }
  }

  async fetchStudentDirect(id: string): Promise<Student | null> {
    try {
      const res = await fetch(getApiUrl(`/api/students/${encodeURIComponent(id)}`), {
        headers: getAuthHeaders(),
      });
      if (res.status === 403) {
        throw new Error('Forbidden: Unauthorized student access');
      }
      if (res.ok) {
        const serverStudent: Student = await res.json();
        const idx = this.cache.students.findIndex((s) => s.id === serverStudent.id);
        if (idx !== -1) {
          this.cache.students[idx] = { ...this.cache.students[idx], ...serverStudent };
        } else {
          this.cache.students.push(serverStudent);
        }
        this.persist();
        return serverStudent;
      }
    } catch (err: any) {
      if (err?.message?.includes('Forbidden')) {
        throw err;
      }
      console.warn('[API] fetchStudentDirect error:', err);
    }
    return this.getStudentById(id) || null;
  }

  async fetchStaffDirect(id: string): Promise<TeacherStaff | null> {
    try {
      const res = await apiFetch(`/api/teachers/${encodeURIComponent(id)}`);
      if (res.ok) {
        const serverStaff: TeacherStaff = await res.json();
        const idx = this.cache.staff.findIndex((s) => s.id === serverStaff.id || s.employeeId === serverStaff.employeeId);
        if (idx !== -1) {
          this.cache.staff[idx] = { ...this.cache.staff[idx], ...serverStaff };
        } else {
          this.cache.staff.push(serverStaff);
        }
        this.persist();
        return serverStaff;
      }
    } catch (err) {
      console.warn('[API] fetchStaffDirect error:', err);
    }
    return this.getStaffById(id) || null;
  }

  /**
   * Public result verification: one student, one published exam. Returns only what the
   * public page shows; parent names and DOB come back only when the supplied DOB matches.
   */
  async getPublicResultOptions(): Promise<{
    ok: boolean;
    exams: Array<{ id: string; name: string; examType: string; academicSession: string; classIds: string[] }>;
    classes: Array<{ id: string; name: string }>;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/public/results/options'));
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) return { ok: false, exams: [], classes: [] };
      return { ok: true, exams: Array.isArray(json.exams) ? json.exams : [], classes: Array.isArray(json.classes) ? json.classes : [] };
    } catch {
      return { ok: false, exams: [], classes: [] };
    }
  }

  async lookupPublicResult(params: { examId: string; classId?: string; query: string; dob?: string }): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    student?: Partial<Student>;
    marks: ExamMark[];
    subjects: Subject[];
    dobVerified: boolean;
  }> {
    const q = new URLSearchParams({ examId: params.examId, query: params.query });
    if (params.classId) q.set('classId', params.classId);
    if (params.dob) q.set('dob', params.dob);
    try {
      const res = await fetch(getApiUrl(`/api/public/results/lookup?${q.toString()}`));
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        return { ok: false, status: res.status, error: json?.error || 'Result lookup failed.', marks: [], subjects: [], dobVerified: false };
      }
      return { ok: true, status: res.status, student: json.student || {}, marks: Array.isArray(json.marks) ? json.marks : [], subjects: Array.isArray(json.subjects) ? json.subjects : [], dobVerified: !!json.dobVerified };
    } catch {
      return { ok: false, status: 0, error: 'Could not reach the school server. Please check your connection and try again.', marks: [], subjects: [], dobVerified: false };
    }
  }

  async fetchLinkedChildren(): Promise<Student[]> {
    try {
      const res = await fetch(getApiUrl('/api/students'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const payload = await res.json();
        const studentList: Student[] = Array.isArray(payload) ? payload : (payload?.data || []);
        studentList.forEach((stu) => {
          const idx = this.cache.students.findIndex((s) => s.id === stu.id);
          if (idx !== -1) {
            this.cache.students[idx] = { ...this.cache.students[idx], ...stu };
          } else {
            this.cache.students.push(stu);
          }
        });
        this.persist();
        return studentList;
      }
    } catch (err) {
      console.warn('[API] fetchLinkedChildren error:', err);
    }
    const currentUser = getStoredUser();
    if (currentUser && currentUser.role === 'PARENT') {
      const linked = currentUser.linkedStudentIds || [];
      return this.cache.students.filter((s) => linked.includes(s.id) || linked.includes(s.admissionNumber));
    }
    return [];
  }

  changeStudentStatus(id: string, status: StudentStatus, reason?: string, effectiveDate?: string): Student {
    const student = this.getStudentById(id);
    if (!student) throw new Error('Student not found');
    
    const previousStatus = student.status;
    const dateStr = effectiveDate || new Date().toISOString().substring(0, 10);
    const desc = reason
      ? `Status transitioned from ${previousStatus} to ${status}. Reason: ${reason}`
      : `Status transitioned from ${previousStatus} to ${status}`;

    const newActivity = {
      id: `act-${Date.now()}`,
      timestamp: dateStr,
      title: `Status Changed to ${status}`,
      description: desc,
      category: 'STATUS' as const,
      performedBy: 'Administration',
    };

    const updatedHistory = [newActivity, ...(student.activityHistory || [])];

    // Background sync status to server
    fetch(getApiUrl(`/api/students/${encodeURIComponent(student.id)}/status`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }).catch(() => {});

    return this.updateStudent(id, {
      status,
      activityHistory: updatedHistory,
    });
  }

  deleteStudent(id: string): boolean {
    const target = this.cache.students.find((s) => s.id === id || (s as any)._id === id || s.admissionNumber === id);
    if (target) {
      const targetId = target.id;
      this.cache.students = this.cache.students.filter((s) => s.id !== targetId && s.admissionNumber !== target.admissionNumber);
      this.addAudit('STUDENT_DELETED', 'Student', targetId, `Deleted student ${target.name}`);
      this.persist();

      fetch(getApiUrl(`/api/students/${encodeURIComponent(targetId)}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }).catch((err) => {
        console.warn('[API] deleteStudent background sync error:', err);
      });

      return true;
    }
    return false;
  }

  async deleteStudentAsync(id: string): Promise<boolean> {
    const target = this.cache.students.find((s) => s.id === id || (s as any)._id === id || s.admissionNumber === id);
    const targetId = target ? target.id : id;

    const res = await fetch(getApiUrl(`/api/students/${encodeURIComponent(targetId)}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server failed to delete student with HTTP ${res.status}`);
    }

    if (target) {
      this.cache.students = this.cache.students.filter((s) => s.id !== target.id && s.admissionNumber !== target.admissionNumber);
      this.addAudit('STUDENT_DELETED', 'Student', target.id, `Deleted student ${target.name}`);
      this.persist();
    }
    return true;
  }

  /**
   * Promotes students on the server (one student or a whole class). The server archives the year into
   * academicHistory, continues roll numbers in the new class and bills the new class's Books & Stationery fee.
   */
  public async promoteStudentsAsync(payload: {
    studentIds: string[];
    toClassId: string;
    toSection?: string;
    targetSession?: string;
    remark?: string;
    chargeBooksFee?: boolean;
    booksFee?: number;
    /** Single-student promotion only: roll number to use instead of the next free one. */
    customRoll?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    session?: string;
    toClass?: { id: string; name: string };
    promoted?: { id: string; name: string; from: string; to: string; rollNumber: string; booksBilled: number }[];
    skipped?: { id: string; name: string; reason: string }[];
    booksBills?: number;
    booksTotal?: number;
    students?: Student[];
  }> {
    try {
      const res = await fetch(getApiUrl('/api/students/promote'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || `Promotion was not saved (error ${res.status}).` };
      }
      await this.loadStudentsFromServer().catch(() => null);
      await this.getFeeLedgers().catch(() => null);
      return data;
    } catch {
      return { success: false, error: 'Could not reach the server, so nobody was promoted. Check the internet connection and try again.' };
    }
  }

  promoteStudent(
    id: string,
    targetClassId?: string,
    targetSection?: string,
    targetSession?: string,
    customRoll?: string,
    remark?: string
  ): Student {
    const student = this.getStudentById(id);
    if (!student) throw new Error('Student not found');

    let targetClass = targetClassId
      ? this.cache.classes.find((c) => c.id === targetClassId || c.name === targetClassId)
      : undefined;

    if (!targetClass) {
      const currentClass = this.cache.classes.find(
        (c) => c.id === student.classId || c.name === student.className
      );
      const nextOrder = (currentClass?.numericOrder || 1) + 1;
      targetClass = this.cache.classes.find((c) => c.numericOrder === nextOrder) || currentClass;
    }

    if (!targetClass) throw new Error('Target class not found');

    const section = targetSection || student.section || 'A';
    const nextSession = targetSession || this.cache.settings.currentAcademicSession;

    const enrolled = this.cache.students.filter(
      (s) => (s.classId === targetClass.id || s.className === targetClass.name) && s.section === section && s.id !== id
    );
    const newRoll = customRoll || String(enrolled.length + 1);

    // Archive current academic record into academicHistory
    const archiveRecord = {
      session: student.academicSession,
      className: student.className,
      section: student.section,
      rollNumber: student.rollNumber,
      result: 'PROMOTED',
      promotionDate: new Date().toISOString().substring(0, 10),
      status: `Promoted to ${targetClass.name}-${section}`,
    };
    const updatedAcademicHistory = [archiveRecord, ...(student.academicHistory || [])];

    // Activity log entry
    const promoActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString().substring(0, 10),
      title: `Promoted to ${targetClass.name}-${section}`,
      description: remark
        ? `Academic promotion from ${student.className}-${student.section} (${student.academicSession}) to ${targetClass.name}-${section} (${nextSession}). Remark: ${remark}`
        : `Academic promotion from ${student.className}-${student.section} (${student.academicSession}) to ${targetClass.name}-${section} (${nextSession}).`,
      category: 'ACADEMIC' as const,
      performedBy: 'Academic Committee',
    };
    const updatedActivityHistory = [promoActivity, ...(student.activityHistory || [])];

    return this.updateStudent(id, {
      classId: targetClass.id,
      className: targetClass.name,
      section,
      rollNumber: newRoll,
      academicSession: nextSession,
      academicHistory: updatedAcademicHistory,
      activityHistory: updatedActivityHistory,
    });
  }

  // Document verification workflow
  verifyStudentDocument(
    studentId: string,
    documentId: string,
    status: 'VERIFIED' | 'REJECTED',
    remark?: string,
    verifiedBy: string = 'Admissions Officer'
  ): Student {
    const student = this.getStudentById(studentId);
    if (!student) throw new Error('Student not found');

    const docs = [...(student.documents || [])];
    const docIdx = docs.findIndex((d) => d.id === documentId);
    if (docIdx === -1) throw new Error('Document not found');

    docs[docIdx] = {
      ...docs[docIdx],
      verificationStatus: status,
      verificationRemark: remark || (status === 'VERIFIED' ? 'Document verified successfully.' : 'Document rejected.'),
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    };

    const docActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString().substring(0, 10),
      title: `Document ${status === 'VERIFIED' ? 'Verified' : 'Rejected'}: ${docs[docIdx].title}`,
      description: `${docs[docIdx].title} was marked as ${status} by ${verifiedBy}. ${remark ? `Remark: ${remark}` : ''}`,
      category: 'DOCUMENT' as const,
      performedBy: verifiedBy,
    };

    return this.updateStudent(studentId, {
      documents: docs,
      activityHistory: [docActivity, ...(student.activityHistory || [])],
    });
  }

  // Add document to student
  addStudentDocument(studentId: string, docData: AttachedDocument | Omit<AttachedDocument, 'id' | 'uploadedAt'>): Student {
    const student = this.getStudentById(studentId);
    if (!student) throw new Error('Student not found');

    const newDoc: AttachedDocument = {
      ...docData,
      id: ('id' in docData && docData.id) ? docData.id : `doc-${Date.now()}`,
      uploadedAt: ('uploadedAt' in docData && docData.uploadedAt) ? docData.uploadedAt : new Date().toISOString(),
      verificationStatus: docData.verificationStatus || 'PENDING',
    };

    const docActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString().substring(0, 10),
      title: `Document Uploaded: ${newDoc.title}`,
      description: `New file ${newDoc.originalFileName} (${(newDoc.fileSize / 1024).toFixed(1)} KB) uploaded for verification.`,
      category: 'DOCUMENT' as const,
      performedBy: 'Staff / Admissions',
    };

    this.addAudit('STUDENT_DOC_ADDED', 'Student', studentId, `Attached document: ${newDoc.title}`);
    return this.updateStudent(studentId, {
      documents: [newDoc, ...(student.documents || [])],
      activityHistory: [docActivity, ...(student.activityHistory || [])],
    });
  }

  // Remove document from student
  removeStudentDocument(studentId: string, documentId: string): Student {
    const student = this.getStudentById(studentId);
    if (!student) throw new Error('Student not found');

    const docs = (student.documents || []).filter((d) => d.id !== documentId);
    this.addAudit('STUDENT_DOC_REMOVED', 'Student', studentId, `Removed document ${documentId}`);
    return this.updateStudent(studentId, { documents: docs });
  }

  // Teachers & Staff
  getStaff(department?: string): TeacherStaff[] {
    if (department && department !== 'ALL') {
      return this.cache.staff.filter((s) => s.department === department);
    }
    return this.cache.staff;
  }

  getNextStaffEmployeeId(): string {
    let maxNum = 0;
    this.cache.staff.forEach((s) => {
      const match = s.employeeId?.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `CPS${String(maxNum + 1).padStart(4, '0')}`;
  }

  addStaff(data: Partial<TeacherStaff> & { name: string; phone: string }): TeacherStaff {
    const employeeId = data.employeeId || this.getNextStaffEmployeeId();
    
    // Resolve department fallback from designation if department is removed from form
    let dept = data.department;
    if (!dept) {
      const des = (data.designation || '').toLowerCase();
      if (des.includes('accountant') || des.includes('cashier')) dept = 'ACCOUNTS';
      else if (des.includes('hostel') || des.includes('warden')) dept = 'HOSTEL';
      else if (des.includes('transport')) dept = 'TRANSPORT';
      else if (des.includes('admin') || des.includes('hr') || des.includes('principal')) dept = 'ADMINISTRATION';
      else dept = 'ACADEMICS';
    }

    const totalExp = data.totalExperience || (data.experienceYears ? `${data.experienceYears} Years` : '0 Years');
    const expNum = data.experienceYears ?? (parseInt(totalExp, 10) || 0);

    const monthlySal = Number(data.monthlySalary) || (typeof data.salary === 'number' ? data.salary : (data.salary as any)?.net) || 45000;
    const salaryObj = (data.salary && typeof data.salary === 'object' && 'net' in data.salary)
      ? data.salary
      : {
          basic: Math.round(monthlySal * 0.7),
          allowances: Math.round(monthlySal * 0.3),
          deductions: 0,
          net: monthlySal,
        };

    const subjects = data.subjectExpertise || data.specializationSubjects || [];

    // Sanitize photo and photoFileKey to prevent transient blob URLs from persisting
    let cleanPhotoFileKey = data.photoFileKey && !data.photoFileKey.startsWith('blob:') && !data.photoFileKey.startsWith('data:')
      ? data.photoFileKey.trim().replace(/^\/+/, '')
      : undefined;
    let cleanPhoto = data.photo && !data.photo.startsWith('blob:') && !data.photo.startsWith('data:')
      ? data.photo.trim()
      : undefined;

    if (cleanPhotoFileKey && !cleanPhoto) {
      cleanPhoto = `/api/files/content?key=${encodeURIComponent(cleanPhotoFileKey)}`;
    }
    if (!cleanPhotoFileKey && cleanPhoto && cleanPhoto.includes('/api/files/content')) {
      const match = cleanPhoto.match(/[?&]key=([^&]+)/);
      if (match && match[1]) {
        cleanPhotoFileKey = decodeURIComponent(match[1]);
      }
    }

    const newStaff: TeacherStaff = {
      id: `t-${Date.now()}`,
      employeeId,
      name: data.name.trim(),
      photo: cleanPhoto,
      photoFileKey: cleanPhotoFileKey,
      documents: data.documents || [],
      gender: data.gender || 'MALE',
      dob: data.dob || '1990-01-01',
      phone: data.phone.trim(),
      email: data.email?.trim() || '',
      alternatePhone: data.alternatePhone,
      address: data.address || data.permanentAddress || 'Sheohar, Bihar, India',
      city: data.city || data.permanentCity || 'Sheohar',
      state: data.state || data.permanentState || 'Bihar',
      pincode: data.pincode || data.permanentPincode || '843329',
      permanentAddress: data.permanentAddress || data.address || '',
      permanentCity: data.permanentCity || data.city || 'Sheohar',
      permanentState: data.permanentState || data.state || 'Bihar',
      permanentPincode: data.permanentPincode || data.pincode || '843329',
      currentAddress: data.currentAddress || data.permanentAddress || data.address || '',
      currentCity: data.currentCity || data.permanentCity || data.city || 'Sheohar',
      currentState: data.currentState || data.permanentState || data.state || 'Bihar',
      currentPincode: data.currentPincode || data.permanentPincode || data.pincode || '843329',
      sameAsPermanentAddress: data.sameAsPermanentAddress !== undefined ? data.sameAsPermanentAddress : false,
      fatherName: data.fatherName,
      motherName: data.motherName,
      fatherOrMotherName: data.fatherOrMotherName || data.fatherName || data.motherName,
      bloodGroup: data.bloodGroup || 'B+',
      emergencyContact: data.emergencyContact,
      previousSchool: data.previousSchool,
      employmentType: data.employmentType || 'Full Time',
      qualification: data.qualification || 'Graduate',
      customQualification: data.customQualification,
      experienceYears: expNum,
      totalExperience: totalExp,
      joiningDate: data.joiningDate || new Date().toISOString().substring(0, 10),
      designation: data.designation || 'TGT Teacher',
      department: dept as any,
      customDepartment: data.customDepartment,
      academicDepartment: data.academicDepartment || (dept as any),
      subjectExpertise: subjects,
      specializationSubjects: subjects,
      classesQualifiedToTeach: data.classesQualifiedToTeach,
      qualifiedClasses: data.qualifiedClasses,
      certifications: data.certifications,
      certificationsList: data.certificationsList,
      customCertification: data.customCertification,
      assignedClasses: data.assignedClasses || [],
      assignedSubjects: data.assignedSubjects || [],
      classTeacherOf: data.classTeacherOf,
      houseClubResponsibility: data.houseClubResponsibility,
      houseClubResponsibilities: data.houseClubResponsibilities,
      customHouseClub: data.customHouseClub,
      teachingWorkload: data.teachingWorkload,
      assignedPrimarySubject: data.assignedPrimarySubject,
      alsoPerformsTeaching: Boolean(data.alsoPerformsTeaching),
      salary: salaryObj,
      monthlySalary: monthlySal,
      bankAccountNo: data.bankAccountNo,
      ifscCode: data.ifscCode,
      bankName: data.bankName,
      bankBranch: data.bankBranch,
      panNumber: data.panNumber,
      uanNumber: data.uanNumber,
      status: (data.accountStatus === 'RESIGNED' || data.accountStatus === 'LEFT_SCHOOL') ? 'RESIGNED' : 'ACTIVE',
      loginEnabled: data.loginEnabled !== false,
      systemRole: data.systemRole || (dept === 'ACCOUNTS' ? 'ACCOUNTANT' : dept === 'HOSTEL' ? 'HOSTEL_WARDEN' : dept === 'TRANSPORT' ? 'TRANSPORT_MANAGER' : (data.designation || '').toLowerCase().includes('principal') ? 'PRINCIPAL' : 'TEACHER'),
      accountStatus: data.accountStatus || 'ACTIVE',
      leaves: [],
      payrollHistory: [],
    };

    if (newStaff.classTeacherOf) {
      const match = newStaff.classTeacherOf.match(/^(.*?)(?:-([A-Za-z0-9]+))?$/);
      if (match) {
        const targetClassName = match[1]?.trim();
        const targetSecName = match[2]?.trim().toUpperCase() || 'A';
        const targetClass = this.cache.classes.find(
          (c) => c.name.toLowerCase() === targetClassName.toLowerCase() || c.id === targetClassName
        );
        if (targetClass) {
          const sec = (targetClass.detailedSections || []).find((s) => s.name.toUpperCase() === targetSecName);
          if (sec) {
            sec.classTeacherId = newStaff.id;
            sec.classTeacherName = newStaff.name;
          }
          if (targetSecName === 'A' || !targetClass.classTeacherId) {
            targetClass.classTeacherId = newStaff.id;
            targetClass.classTeacherName = newStaff.name;
          }
        }
      }
    }

    this.cache.staff.push(newStaff);
    this.addAudit('STAFF_ADDED', 'TeacherStaff', newStaff.id, `Created staff profile for ${newStaff.name} (ID: ${employeeId})`);
    this.persist();

    // Async sync with server
    fetch(getApiUrl('/api/teachers'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newStaff),
    }).catch(() => {});

    return newStaff;
  }

  async addStaffAsync(data: Partial<TeacherStaff> & { name: string; phone: string }): Promise<{
    success: boolean;
    staff: TeacherStaff;
    employeeId: string;
    portalUserId: string;
    email?: string | null;
    emailStatus: 'SENT' | 'FAILED' | 'SKIPPED_NO_EMAIL';
    emailError?: string;
    message: string;
  }> {
    // Only what the user entered is sent; the server allocates the employee ID and never receives
    // invented values (salary, date of birth, blood group, address...) for empty fields.
    const payload: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && value.trim() === '') continue;
      payload[key] = typeof value === 'string' ? value.trim() : value;
    }
    if (!(Number(payload.monthlySalary) > 0)) delete payload.monthlySalary;
    if (payload.photo && (String(payload.photo).startsWith('blob:') || String(payload.photo).startsWith('data:'))) delete payload.photo;
    if (payload.photoFileKey && (String(payload.photoFileKey).startsWith('blob:') || String(payload.photoFileKey).startsWith('data:'))) delete payload.photoFileKey;
    if (payload.photoFileKey) payload.photoFileKey = String(payload.photoFileKey).replace(/^\/+/, '');
    if (payload.photoFileKey && !payload.photo) payload.photo = `/api/files/content?key=${encodeURIComponent(payload.photoFileKey)}`;

    let response: Response;
    try {
      response = await fetch(getApiUrl('/api/teachers'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('Could not reach the school server. Check your connection and try again.');
    }
    const serverResult: any = await response.json().catch(() => ({}));
    if (!response.ok || !serverResult?.staff) {
      throw new Error(serverResult?.error || `Could not save the staff member (HTTP ${response.status}).`);
    }

    const saved: TeacherStaff = serverResult.staff;
    const existingIdx = this.cache.staff.findIndex((s) => s.id === saved.id);
    if (existingIdx !== -1) {
      this.cache.staff[existingIdx] = saved;
    } else {
      this.cache.staff.unshift(saved);
    }
    this.persist();

    return {
      success: true,
      staff: saved,
      employeeId: serverResult.employeeId || saved.employeeId,
      portalUserId: serverResult.portalUserId || saved.employeeId,
      email: serverResult.email ?? (saved.email || null),
      emailStatus: serverResult.emailStatus || 'SKIPPED_NO_EMAIL',
      emailError: serverResult.emailError,
      message: serverResult.message || `Staff registered. Employee ID: ${saved.employeeId}.`,
    };
  }

  async resendStaffCredentials(staffId: string): Promise<{
    success: boolean;
    emailDispatched: boolean;
    email?: string;
    employeeId?: string;
    portalUserId?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(getApiUrl(`/api/teachers/${encodeURIComponent(staffId)}/resend-credentials`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        emailDispatched: false,
        error: err?.message || 'Network error while contacting server.',
        message: 'Failed to contact server to resend credentials.',
      };
    }
  }

  /** Downloads the server-generated payslip PDF of a PAID payroll record (same file the mobile app gets). */
  async downloadPayslip(recordId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/staff-payroll/${encodeURIComponent(recordId)}/payslip`), { headers: getAuthHeaders() });
      if (!res.ok) {
        let message = 'Could not download the payslip.';
        try { message = (await res.json())?.error || message; } catch { /* keep default */ }
        return { ok: false, error: message };
      }
      const disposition = res.headers.get('Content-Disposition') || '';
      const fileName = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || 'Payslip.pdf';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Network error while downloading the payslip.' };
    }
  }

  async fetchStaffIdCard(staffId: string): Promise<{
    success: boolean;
    staff?: TeacherStaff;
    settings?: SchoolSettings;
    error?: string;
  }> {
    try {
      const res = await fetch(getApiUrl(`/api/staff/${encodeURIComponent(staffId)}/id-card`), {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || `Failed to fetch staff ID card (HTTP ${res.status}).`,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error fetching staff ID card.',
      };
    }
  }


  updateStaff(id: string, updates: Partial<TeacherStaff>): TeacherStaff {
    const idx = this.cache.staff.findIndex((s) => s.id === id);
    if (idx !== -1) {
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.photo && (sanitizedUpdates.photo.startsWith('blob:') || sanitizedUpdates.photo.startsWith('data:'))) {
        delete sanitizedUpdates.photo;
      }
      if (sanitizedUpdates.photoFileKey && (sanitizedUpdates.photoFileKey.startsWith('blob:') || sanitizedUpdates.photoFileKey.startsWith('data:'))) {
        delete sanitizedUpdates.photoFileKey;
      }
      if (sanitizedUpdates.photoFileKey && !sanitizedUpdates.photo) {
        sanitizedUpdates.photo = `/api/files/content?key=${encodeURIComponent(sanitizedUpdates.photoFileKey)}`;
      }

      this.cache.staff[idx] = { ...this.cache.staff[idx], ...sanitizedUpdates };
      this.addAudit('STAFF_UPDATED', 'TeacherStaff', id, `Updated staff profile for ${this.cache.staff[idx].name}`);
      this.persist();

      fetch(getApiUrl(`/api/teachers/${id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(this.cache.staff[idx]),
      }).catch(() => {});

      return this.cache.staff[idx];
    }
    throw new Error('Staff member not found');
  }

  async updateStaffAsync(id: string, updates: Partial<TeacherStaff>): Promise<TeacherStaff> {
    const idx = this.cache.staff.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Staff member not found');
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.photo && (sanitizedUpdates.photo.startsWith('blob:') || sanitizedUpdates.photo.startsWith('data:'))) {
      delete sanitizedUpdates.photo;
    }
    if (sanitizedUpdates.photoFileKey && (sanitizedUpdates.photoFileKey.startsWith('blob:') || sanitizedUpdates.photoFileKey.startsWith('data:'))) {
      delete sanitizedUpdates.photoFileKey;
    }
    if (sanitizedUpdates.photoFileKey && !sanitizedUpdates.photo) {
      sanitizedUpdates.photo = `/api/files/content?key=${encodeURIComponent(sanitizedUpdates.photoFileKey)}`;
    }

    const previous = this.cache.staff[idx];
    const merged = { ...previous, ...sanitizedUpdates };
    let res: Response;
    try {
      res = await fetch(getApiUrl(`/api/teachers/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(merged),
      });
    } catch {
      throw new Error('Could not reach the school server. Your changes were not saved.');
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `Could not save changes (HTTP ${res.status}).`);
    }
    const current = this.cache.staff.findIndex((s) => s.id === id);
    const saved = { ...merged, ...body } as TeacherStaff;
    if (current !== -1) this.cache.staff[current] = saved;
    this.addAudit('STAFF_UPDATED', 'TeacherStaff', id, `Updated staff profile for ${saved.name}`);
    this.persist();
    return saved;
  }

  async deleteStaffAsync(id: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(getApiUrl(`/api/teachers/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch {
      throw new Error('Could not reach the school server. Nothing was deleted.');
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `Could not delete the staff member (HTTP ${res.status}).`);
    }
    const target = this.cache.staff.find((s) => s.id === id);
    this.cache.staff = this.cache.staff.filter((s) => s.id !== id);
    if (target) this.addAudit('STAFF_DELETED', 'TeacherStaff', id, `Removed staff member ${target.name}`);
    this.persist();
  }

  deleteStaff(id: string): boolean {
    const target = this.cache.staff.find((s) => s.id === id);
    this.cache.staff = this.cache.staff.filter((s) => s.id !== id);
    if (target) {
      this.addAudit('STAFF_DELETED', 'TeacherStaff', id, `Removed staff member ${target.name}`);
      this.persist();

      fetch(getApiUrl(`/api/teachers/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }).catch(() => {});

      return true;
    }
    return false;
  }

  addStaffDocument(staffId: string, doc: AttachedDocument): TeacherStaff {
    const staffMember = this.cache.staff.find((s) => s.id === staffId);
    if (!staffMember) throw new Error('Staff not found');
    const docs = staffMember.documents || [];
    staffMember.documents = [...docs, doc];
    this.addAudit('STAFF_DOC_ADDED', 'TeacherStaff', staffId, `Attached document: ${doc.title}`);
    this.persist();

    fetch(getApiUrl(`/api/teachers/${staffId}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(staffMember),
    }).catch(() => {});

    return staffMember;
  }

  removeStaffDocument(staffId: string, docId: string): TeacherStaff {
    const staffMember = this.cache.staff.find((s) => s.id === staffId);
    if (!staffMember) throw new Error('Staff not found');
    staffMember.documents = (staffMember.documents || []).filter((d) => d.id !== docId);
    this.addAudit('STAFF_DOC_REMOVED', 'TeacherStaff', staffId, `Removed document ${docId}`);
    this.persist();

    fetch(getApiUrl(`/api/teachers/${staffId}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(staffMember),
    }).catch(() => {});

    return staffMember;
  }

  getStaffById(id: string): TeacherStaff | undefined {
    return this.cache.staff.find((s) => s.id === id);
  }

  toggleStaffStatus(id: string, status: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED'): TeacherStaff {
    const staff = this.cache.staff.find((s) => s.id === id);
    if (!staff) throw new Error('Staff not found');
    staff.status = status;
    this.addAudit('STAFF_STATUS_UPDATED', 'TeacherStaff', id, `Updated status of ${staff.name} to ${status}`);
    this.persist();

    fetch(getApiUrl(`/api/teachers/${id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(staff),
    }).catch(() => {});

    return staff;
  }

  assignTeacherToClass(teacherId: string, classWithSection: string, subjectName?: string): TeacherStaff {
    const teacher = this.cache.staff.find((s) => s.id === teacherId);
    if (!teacher) throw new Error('Teacher not found');

    if (!teacher.assignedClasses.includes(classWithSection)) {
      teacher.assignedClasses = [...teacher.assignedClasses, classWithSection];
    }
    if (subjectName && !teacher.assignedSubjects.includes(subjectName)) {
      teacher.assignedSubjects = [...teacher.assignedSubjects, subjectName];
    }
    this.addAudit('TEACHER_CLASS_ASSIGNED', 'TeacherStaff', teacherId, `Assigned ${teacher.name} to ${classWithSection} ${subjectName ? `(${subjectName})` : ''}`);
    this.persist();

    fetch(getApiUrl(`/api/teachers/${teacherId}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(teacher),
    }).catch(() => {});

    return teacher;
  }

  removeTeacherFromClass(teacherId: string, classWithSection: string, subjectName?: string): TeacherStaff {
    const teacher = this.cache.staff.find((s) => s.id === teacherId);
    if (!teacher) throw new Error('Teacher not found');

    teacher.assignedClasses = teacher.assignedClasses.filter((c) => c !== classWithSection);
    if (subjectName) {
      const hasOther = this.cache.timetable.some(
        (t) => t.teacherId === teacherId && t.subjectName === subjectName && `${t.className}-${t.section}` !== classWithSection
      );
      if (!hasOther) {
        teacher.assignedSubjects = teacher.assignedSubjects.filter((s) => s !== subjectName);
      }
    }
    this.addAudit('TEACHER_CLASS_REMOVED', 'TeacherStaff', teacherId, `Removed ${teacher.name} from ${classWithSection}`);
    this.persist();

    fetch(getApiUrl(`/api/teachers/${teacherId}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(teacher),
    }).catch(() => {});

    return teacher;
  }

  // Staff Leaves
  getStaffLeaves(staffId?: string): StaffLeave[] {
    let leaves = this.cache.staffLeaves || [];
    if (staffId) {
      leaves = leaves.filter((l) => l.staffId === staffId || l.employeeId === staffId);
    }
    return [...leaves].sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }

  async fetchStaffLeaves(staffId?: string): Promise<StaffLeave[]> {
    try {
      const url = staffId ? `/api/staff-leaves?staffId=${encodeURIComponent(staffId)}` : '/api/staff-leaves';
      const res = await fetch(getApiUrl(url), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const fetchedIds = new Set(data.map((l: any) => l.id));
          this.cache.staffLeaves = [
            ...(this.cache.staffLeaves || []).filter((l) => !fetchedIds.has(l.id)),
            ...data,
          ];
          this.persist();
          return data;
        }
      }
    } catch (err) {
      console.warn('[StaffLeave] Fetch leaves error:', err);
    }
    return this.getStaffLeaves(staffId);
  }

  async fetchStudentCalendar(studentId: string): Promise<{ studentId: string; studentName?: string; admissionNumber?: string; records: AttendanceRecord[]; holidays: Holiday[] }> {
    try {
      const res = await fetch(getApiUrl(`/api/attendance/student-calendar/${encodeURIComponent(studentId)}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.records && Array.isArray(data.records)) {
          const recIds = new Set(data.records.map((r: any) => r.id));
          this.cache.attendance = [
            ...(this.cache.attendance || []).filter((a: any) => !recIds.has(a.id)),
            ...data.records,
          ];
          this.persist();
        }
        return data;
      }
    } catch (err) {
      console.warn('[API] fetchStudentCalendar error:', err);
    }
    const stu = this.getStudents().find((s) => s.id === studentId || s.admissionNumber === studentId);
    return {
      studentId,
      studentName: stu?.name,
      records: this.getAttendance().filter((a) => a.studentId === studentId),
      holidays: this.getHolidays(),
    };
  }

  async fetchStaffCalendar(staffId: string): Promise<{ staffId: string; employeeId?: string; staffName?: string; records: StaffAttendanceRecord[]; leaves: StaffLeave[]; holidays: Holiday[] }> {
    try {
      const res = await fetch(getApiUrl(`/api/attendance/staff-calendar/${encodeURIComponent(staffId)}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.records && Array.isArray(data.records)) {
          const recIds = new Set(data.records.map((r: any) => r.id));
          this.cache.staffAttendance = [
            ...(this.cache.staffAttendance || []).filter((a: any) => !recIds.has(a.id)),
            ...data.records,
          ];
        }
        if (data.leaves && Array.isArray(data.leaves)) {
          const leaveIds = new Set(data.leaves.map((l: any) => l.id));
          this.cache.staffLeaves = [
            ...(this.cache.staffLeaves || []).filter((l: any) => !leaveIds.has(l.id)),
            ...data.leaves,
          ];
        }
        this.persist();
        return data;
      }
    } catch (err) {
      console.warn('[API] fetchStaffCalendar error:', err);
    }
    return {
      staffId,
      records: this.getStaffAttendance(undefined, staffId),
      leaves: this.getStaffLeaves(staffId),
      holidays: this.getHolidays(),
    };
  }

  applyStaffLeave(leave: Omit<StaffLeave, 'id' | 'appliedAt'>): StaffLeave {
    const newLeave: StaffLeave = {
      ...leave,
      id: `sl-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      appliedAt: new Date().toISOString().split('T')[0],
      status: leave.status || 'PENDING',
    };
    this.cache.staffLeaves = [newLeave, ...(this.cache.staffLeaves || [])];
    this.addAudit('STAFF_LEAVE_APPLIED', 'StaffLeave', newLeave.id, `${newLeave.staffName} applied for ${newLeave.leaveType} leave (${newLeave.daysCount} days)`);
    this.persist();

    fetch(getApiUrl('/api/staff-leaves'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newLeave),
    }).catch((err) => {
      console.warn('[StaffLeave] Failed to persist leave application to server:', err);
    });

    return newLeave;
  }

  async applyStaffLeaveAsync(leave: Omit<StaffLeave, 'id' | 'appliedAt'>): Promise<StaffLeave> {
    const newLeave = this.applyStaffLeave(leave);
    try {
      const res = await fetch(getApiUrl('/api/staff-leaves'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newLeave),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.leave) {
          const idx = (this.cache.staffLeaves || []).findIndex((l) => l.id === newLeave.id);
          if (idx !== -1) {
            this.cache.staffLeaves[idx] = data.leave;
            this.persist();
          }
          return data.leave;
        }
      }
    } catch (err) {
      console.error('[StaffLeave] Async apply error:', err);
    }
    return newLeave;
  }

  updateStaffLeaveStatus(leaveId: string, status: 'APPROVED' | 'REJECTED', approvedBy: string, remarks?: string): StaffLeave {
    const leave = (this.cache.staffLeaves || []).find((l) => l.id === leaveId);
    if (!leave) throw new Error('Leave application not found');

    leave.status = status;
    leave.approvedBy = approvedBy;
    leave.approvedAt = new Date().toISOString().split('T')[0];
    if (remarks !== undefined) leave.remarks = remarks;

    this.addAudit('STAFF_LEAVE_STATUS', 'StaffLeave', leaveId, `Marked leave for ${leave.staffName} as ${status}`);
    this.persist();

    fetch(getApiUrl(`/api/staff-leaves/${leaveId}/status`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, approvedBy, remarks }),
    }).catch((err) => {
      console.warn('[StaffLeave] Failed to update leave status on server:', err);
    });

    return leave;
  }

  async updateStaffLeaveStatusAsync(leaveId: string, status: 'APPROVED' | 'REJECTED', approvedBy: string, remarks?: string): Promise<StaffLeave> {
    const leave = this.updateStaffLeaveStatus(leaveId, status, approvedBy, remarks);
    try {
      const res = await fetch(getApiUrl(`/api/staff-leaves/${leaveId}/status`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, approvedBy, remarks }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.leave) {
          const idx = (this.cache.staffLeaves || []).findIndex((l) => l.id === leaveId);
          if (idx !== -1) {
            this.cache.staffLeaves[idx] = data.leave;
            this.persist();
          }
          return data.leave;
        }
      }
    } catch (err) {
      console.error('[StaffLeave] Async status update error:', err);
    }
    return leave;
  }

  // Staff Payroll
  getStaffPayroll(staffId?: string, year?: number): StaffPayrollRecord[] {
    let records = this.cache.staffPayroll || [];
    if (staffId) records = records.filter((p) => p.staffId === staffId || p.employeeId === staffId);
    if (year) records = records.filter((p) => p.year === year);
    return [...records].sort((a, b) => {
      const dateA = a.salaryPeriodEnd || `${a.year}-${a.month}`;
      const dateB = b.salaryPeriodEnd || `${b.year}-${b.month}`;
      return dateB.localeCompare(dateA);
    });
  }

  async fetchStaffPayrollAsync(params?: {
    month?: string;
    year?: number;
    search?: string;
    department?: string;
    designation?: string;
    paymentStatus?: string;
    summary?: boolean;
  }): Promise<{ records: StaffPayrollRecord[]; summary?: any }> {
    try {
      const query = new URLSearchParams();
      if (params?.month) query.set('month', params.month);
      if (params?.year) query.set('year', String(params.year));
      if (params?.search) query.set('search', params.search);
      if (params?.department) query.set('department', params.department);
      if (params?.designation) query.set('designation', params.designation);
      if (params?.paymentStatus) query.set('paymentStatus', params.paymentStatus);
      if (params?.summary !== false) query.set('summary', 'true');

      const res = await fetch(getApiUrl(`/api/staff-payroll?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.records && Array.isArray(data.records)) {
          // Update local cache
          const incomingIds = new Set(data.records.map((r: any) => r.id));
          // For a month query the server's list is the whole truth for that month: drop cached records of
          // that month it no longer returns (e.g. removed because they were before a "Salary from" date).
          const monthKey = /^\d{4}-\d{2}$/.test(String(params?.month || '')) ? String(params?.month) : '';
          const kept = (this.cache.staffPayroll || []).filter(
            (r) => !incomingIds.has(r.id) && !(monthKey && r.payrollMonth === monthKey)
          );
          this.cache.staffPayroll = [...data.records, ...kept];
          this.persist();
          return { records: data.records, summary: data.summary };
        } else if (Array.isArray(data)) {
          this.cache.staffPayroll = data;
          this.persist();
          return { records: data };
        }
      }
    } catch (err) {
      console.error('[StaffPayroll] Error fetching staff payroll:', err);
    }
    const fallback = this.getStaffPayroll();
    return { records: fallback };
  }

  /** Every salary record of one staff member (all months), newest first. */
  async fetchStaffPayrollHistory(staffId: string): Promise<{ ok: boolean; records: StaffPayrollRecord[]; error?: string }> {
    try {
      const res = await apiFetch(`/api/staff-payroll/history/${encodeURIComponent(staffId)}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) return { ok: true, records: data };
      return { ok: false, records: [], error: data?.error || 'Could not load the salary history.' };
    } catch {
      return { ok: false, records: [], error: 'Could not reach the server.' };
    }
  }

  async generateStaffPayrollAsync(month?: string, year?: number, force = false): Promise<{
    success: boolean;
    generatedCount: number;
    updatedCount?: number;
    paidLockedCount?: number;
    notConfigured?: Array<{ staffId: string; employeeId?: string; name: string }>;
    message: string;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/staff-payroll/generate'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ month, year, force }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        // Re-sync payroll records
        await this.syncWithServer({ force: true });
        return {
          success: true,
          generatedCount: data.generatedCount || 0,
          updatedCount: data.updatedCount || 0,
          paidLockedCount: data.paidLockedCount || 0,
          notConfigured: Array.isArray(data.notConfigured) ? data.notConfigured : [],
          message: data.message || 'Payroll generated.',
        };
      }
      return { success: false, generatedCount: 0, message: data.error || `Could not generate payroll (HTTP ${res.status}).` };
    } catch (err: any) {
      console.error('[StaffPayroll] Error generating payroll:', err);
      return { success: false, generatedCount: 0, message: 'Could not reach the school server. Payroll was not generated.' };
    }
  }

  async markSalaryAsPaidAsync(
    id: string,
    paymentDetails: { paymentMethod: string; paymentDate?: string; transactionReference?: string; remarks?: string }
  ): Promise<{ success: boolean; record?: StaffPayrollRecord; error?: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/staff-payroll/${encodeURIComponent(id)}/pay`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(paymentDetails),
      });
      const data = await res.json();
      if (res.ok && data.record) {
        const idx = (this.cache.staffPayroll || []).findIndex((p) => p.id === id);
        if (idx !== -1) {
          this.cache.staffPayroll[idx] = data.record;
        } else {
          this.cache.staffPayroll = [data.record, ...(this.cache.staffPayroll || [])];
        }
        this.persist();
        return { success: true, record: data.record };
      }
      if (res.status === 409 && data.record) {
        // Already paid elsewhere: show the saved payment instead of recording a second one.
        const idx = (this.cache.staffPayroll || []).findIndex((p) => p.id === id);
        if (idx !== -1) this.cache.staffPayroll[idx] = data.record;
        this.persist();
      }
      return { success: false, error: data.error || `Could not record the payment (HTTP ${res.status}).` };
    } catch (err: any) {
      console.error('[StaffPayroll] Error marking salary as paid:', err);
      return { success: false, error: 'Could not reach the school server. The payment was not recorded.' };
    }
  }

  recordStaffSalaryPayment(payment: Omit<StaffPayrollRecord, 'id' | 'salarySlipNumber'>): StaffPayrollRecord {
    const slipNumber = `SLIP-${payment.year}-${String(Date.now()).slice(-4)}`;
    const newRecord: StaffPayrollRecord = {
      ...payment,
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      salarySlipNumber: slipNumber,
    };
    this.cache.staffPayroll = [newRecord, ...(this.cache.staffPayroll || [])];
    this.addAudit('STAFF_SALARY_PAID', 'StaffPayrollRecord', newRecord.id, `Processed salary of ₹${newRecord.netSalary.toLocaleString('en-IN')} for ${newRecord.staffName} (${newRecord.month})`);
    this.persist();

    fetch(getApiUrl('/api/staff-payroll'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newRecord),
    }).catch((err) => {
      console.warn('[StaffPayroll] Failed to persist salary record to server:', err);
    });

    return newRecord;
  }

  async recordStaffSalaryPaymentAsync(payment: Omit<StaffPayrollRecord, 'id' | 'salarySlipNumber'>): Promise<StaffPayrollRecord> {
    const record = this.recordStaffSalaryPayment(payment);
    try {
      const res = await fetch(getApiUrl('/api/staff-payroll'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.record) {
          const idx = (this.cache.staffPayroll || []).findIndex((p) => p.id === record.id);
          if (idx !== -1) {
            this.cache.staffPayroll[idx] = data.record;
            this.persist();
          }
          return data.record;
        }
      }
    } catch (err) {
      console.error('[StaffPayroll] Async salary persist error:', err);
    }
    return record;
  }

  // Academics (Classes & Sections)
  getClasses(session?: string, includeInactive = false): AcademicClass[] {
    let list = this.cache.classes;
    if (!includeInactive) {
      list = list.filter((c) => (c.status ?? 'ACTIVE') === 'ACTIVE');
    }
    if (session) {
      list = list.filter((c) => !c.academicSession || c.academicSession === session);
    }
    return [...list].sort((a, b) => (a.numericOrder || 0) - (b.numericOrder || 0));
  }

  getActiveClasses(session?: string): AcademicClass[] {
    return this.getClasses(session, false);
  }

  getAllClasses(session?: string): AcademicClass[] {
    return this.getClasses(session, true);
  }

  getClassById(id: string): AcademicClass | undefined {
    return this.cache.classes.find((c) => c.id === id);
  }

  /**
   * Saves a class (or its sections) on the server and WAITS for the answer. The screen refreshes the class
   * list from the server right after saving, so a save that was still in flight used to make the new class
   * or section vanish, and a refused save was never reported. On failure the cache is put back.
   */
  private async commitClassToServer(
    method: 'POST' | 'PUT',
    path: string,
    body: AcademicClass,
    rollback: AcademicClass[]
  ): Promise<AcademicClass> {
    let res: Response;
    try {
      res = await fetch(getApiUrl(path), { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
    } catch {
      this.cache.classes = rollback;
      this.persist();
      throw new Error('Could not reach the server, so nothing was saved. Check the internet connection and try again.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      this.cache.classes = rollback;
      this.persist();
      throw new Error(data?.error || `The class was not saved (error ${res.status}).`);
    }
    const saved: AcademicClass = data && data.id ? data : body;
    const i = this.cache.classes.findIndex((c) => c.id === saved.id || c.id === body.id);
    if (i === -1) this.cache.classes.push(saved);
    else this.cache.classes[i] = saved;
    this.cache.classes.sort((a, b) => (a.numericOrder ?? 0) - (b.numericOrder ?? 0));
    this.persist();
    return saved;
  }

  async addClass(data: { name: string; sections?: string[]; maxCapacity?: number; numericOrder?: number; academicSession?: string; description?: string }): Promise<AcademicClass> {
    const before = this.cache.classes.map((c) => ({ ...c }));
    const defaultCapacity = Number(data.maxCapacity) || 40;
    const session = data.academicSession || this.cache.settings.currentAcademicSession || '2026-2027';
    const sectionNames = data.sections && data.sections.length > 0 ? data.sections : ['A'];

    const detailedSections: AcademicSection[] = sectionNames.map((secName, idx) => ({
      id: `sec-${Date.now()}-${idx}`,
      name: secName.trim().toUpperCase(),
      maxCapacity: defaultCapacity,
      roomNumber: `Room ${100 + this.cache.classes.length * 10 + idx + 1}`,
      status: 'ACTIVE' as const,
    }));

    const newClass: AcademicClass = {
      id: `c-${Date.now()}`,
      name: data.name.trim(),
      numericOrder: data.numericOrder ?? (this.cache.classes.length + 1),
      sections: detailedSections.map((s) => s.name),
      detailedSections,
      maxCapacity: defaultCapacity,
      status: 'ACTIVE',
      academicSession: session,
      description: data.description,
    };

    this.cache.classes.push(newClass);
    this.addAudit('CLASS_CREATED', 'AcademicClass', newClass.id, `Created ${newClass.name} with ${detailedSections.length} sections (${newClass.academicSession})`);
    this.persist();

    return this.commitClassToServer('POST', '/api/classes', newClass, before);
  }

  async updateClass(id: string, updates: Partial<AcademicClass>): Promise<AcademicClass> {
    const before = this.cache.classes.map((c) => ({ ...c }));
    const idx = this.cache.classes.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Class not found');

    const prev = this.cache.classes[idx];
    const updated = { ...prev, ...updates };

    if (updates.sections && Array.isArray(updates.sections)) {
      const existingMap = new Map((prev.detailedSections || []).map((s) => [s.name, s]));
      updated.detailedSections = updates.sections.map((secName, i) => {
        const existing = existingMap.get(secName);
        if (existing) return existing;
        return {
          id: `sec-${id}-${secName.toLowerCase()}-${Date.now()}-${i}`,
          name: secName.trim().toUpperCase(),
          maxCapacity: updated.maxCapacity || 40,
          status: 'ACTIVE' as const,
        };
      });
    }

    this.cache.classes[idx] = updated;
    this.addAudit('CLASS_UPDATED', 'AcademicClass', id, `Updated class ${updated.name}`);
    this.persist();

    return this.commitClassToServer('PUT', `/api/classes/${id}`, updated, before);
  }

  async deleteClass(id: string, options?: { reassignToClassId?: string; force?: boolean }): Promise<boolean> {
    const target = this.cache.classes.find((c) => c.id === id);
    const targetName = target ? target.name : id;

    const enrolledStudents = this.cache.students.filter((s) => s.classId === id || (target && s.className === target.name));
    if (enrolledStudents.length > 0 && !options?.reassignToClassId && !options?.force) {
      throw new Error(`Cannot delete ${targetName} because ${enrolledStudents.length} students are currently enrolled. Please choose to reassign or unassign students.`);
    }

    // Call server DELETE endpoint with auth headers and options
    const res = await fetch(getApiUrl(`/api/classes/${id}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify(options || {}),
    });

    if (!res.ok) {
      let errorMsg = 'Failed to delete class from server.';
      try {
        const errJson = await res.json();
        if (errJson.error) errorMsg = errJson.error;
      } catch {}
      throw new Error(errorMsg);
    }

    // On server success, update local state
    if (enrolledStudents.length > 0) {
      if (options?.reassignToClassId) {
        const destClass = this.cache.classes.find((c) => c.id === options.reassignToClassId);
        if (destClass) {
          const defaultSec = (destClass.detailedSections && destClass.detailedSections[0]?.name) || destClass.sections?.[0] || 'A';
          enrolledStudents.forEach((s) => {
            s.classId = destClass.id;
            s.className = destClass.name;
            s.section = defaultSec;
          });
          this.addAudit('STUDENTS_REASSIGNED', 'AcademicClass', id, `Reassigned ${enrolledStudents.length} students from ${targetName} to ${destClass.name}`);
        }
      } else if (options?.force) {
        enrolledStudents.forEach((s) => {
          s.classId = '';
          s.className = 'Unassigned';
          s.section = '';
        });
        this.addAudit('STUDENTS_UNASSIGNED', 'AcademicClass', id, `Unassigned ${enrolledStudents.length} students from deleted class ${targetName}`);
      }
    }

    this.cache.classes = this.cache.classes.filter((c) => c.id !== id);
    this.cache.timetable = this.cache.timetable.filter((t) => t.classId !== id);

    // Clean up subject classIds
    this.cache.subjects.forEach((sub) => {
      if (sub.classIds && sub.classIds.includes(id)) {
        sub.classIds = sub.classIds.filter((cid) => cid !== id);
      }
    });

    // Clean up teacher assignedClasses
    this.cache.staff.forEach((st) => {
      if (st.assignedClasses && Array.isArray(st.assignedClasses)) {
        st.assignedClasses = st.assignedClasses.filter((ac) => !ac.startsWith(targetName));
      }
    });

    this.addAudit('CLASS_DELETED', 'AcademicClass', id, `Deleted class ${targetName}`);
    this.persist();

    return true;
  }

  async toggleClassStatusAsync(id: string): Promise<AcademicClass> {
    const cls = this.cache.classes.find((c) => c.id === id);
    if (!cls) throw new Error('Class not found');
    const newStatus = cls.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    cls.status = newStatus;
    this.addAudit('CLASS_STATUS_CHANGED', 'AcademicClass', id, `Set status of ${cls.name} to ${newStatus}`);
    this.persist();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cps:class-status-changed', { detail: cls }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'cps_school_erp' }));
    }

    try {
      const res = await fetch(getApiUrl(`/api/classes/${id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(cls),
      });

      if (!res.ok) {
        let errMsg = `Failed to update class status (${res.status})`;
        try {
          const errData = await res.json();
          if (errData.error) errMsg = errData.error;
        } catch {}
        console.error('[API] Error updating class status:', errMsg);
        throw new Error(errMsg);
      }

      const updated = await res.json();
      const idx = this.cache.classes.findIndex((c) => c.id === id);
      if (idx !== -1 && updated && updated.id) {
        this.cache.classes[idx] = { ...this.cache.classes[idx], ...updated, status: newStatus };
        this.persist();
      }
    } catch (err) {
      console.error('[API] Failed to update class status on server:', err);
      throw err;
    }

    await this.syncClasses();
    return cls;
  }

  toggleClassStatus(id: string): AcademicClass {
    const cls = this.cache.classes.find((c) => c.id === id);
    if (!cls) throw new Error('Class not found');
    cls.status = cls.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    this.addAudit('CLASS_STATUS_CHANGED', 'AcademicClass', id, `Set status of ${cls.name} to ${cls.status}`);
    this.persist();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cps:class-status-changed', { detail: cls }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'cps_school_erp' }));
    }

    this.toggleClassStatusAsync(id).catch((err) => {
      console.error('[API] Background toggleClassStatus error:', err);
    });

    return cls;
  }

  async addSection(classId: string, sectionData: { name: string; maxCapacity?: number; roomNumber?: string; classTeacherId?: string; classTeacherName?: string }): Promise<AcademicClass> {
    const before = this.cache.classes.map((c) => ({ ...c, detailedSections: [...(c.detailedSections || [])], sections: [...(c.sections || [])] }));
    const cls = this.cache.classes.find((c) => c.id === classId);
    if (!cls) throw new Error('Class not found');

    const cleanName = sectionData.name.trim().toUpperCase();
    if (cls.detailedSections?.some((s) => s.name.toUpperCase() === cleanName) || cls.sections?.includes(cleanName)) {
      throw new Error(`Section ${cleanName} already exists in ${cls.name}`);
    }

    let classTeacherName = sectionData.classTeacherName;
    if (sectionData.classTeacherId && !classTeacherName) {
      const teacher = this.cache.staff.find((s) => s.id === sectionData.classTeacherId);
      classTeacherName = teacher?.name;
    }

    const newSec: AcademicSection = {
      id: `sec-${classId}-${cleanName.toLowerCase()}-${Date.now()}`,
      name: cleanName,
      maxCapacity: Number(sectionData.maxCapacity) || cls.maxCapacity || 40,
      roomNumber: sectionData.roomNumber,
      classTeacherId: sectionData.classTeacherId,
      classTeacherName,
      status: 'ACTIVE',
    };

    cls.detailedSections = [...(cls.detailedSections || []), newSec];
    cls.sections = cls.detailedSections.map((s) => s.name);

    if (sectionData.classTeacherId) {
      this.assignClassTeacher(classId, cleanName, sectionData.classTeacherId);
    }

    this.addAudit('SECTION_CREATED', 'AcademicClass', classId, `Added section ${cleanName} to ${cls.name}`);
    this.persist();

    return this.commitClassToServer('PUT', `/api/classes/${classId}`, cls, before);
  }

  async updateSection(classId: string, sectionIdentifier: string, updates: Partial<AcademicSection>): Promise<AcademicClass> {
    const before = this.cache.classes.map((c) => ({ ...c, detailedSections: [...(c.detailedSections || [])], sections: [...(c.sections || [])] }));
    const cls = this.cache.classes.find((c) => c.id === classId);
    if (!cls) throw new Error('Class not found');

    const secIdx = (cls.detailedSections || []).findIndex(
      (s) => s.id === sectionIdentifier || s.name.toUpperCase() === sectionIdentifier.toUpperCase()
    );
    if (secIdx === -1) throw new Error('Section not found');

    const oldSec = cls.detailedSections![secIdx];
    const newName = updates.name ? updates.name.trim().toUpperCase() : oldSec.name;

    if (newName !== oldSec.name && cls.detailedSections!.some((s, idx) => idx !== secIdx && s.name.toUpperCase() === newName)) {
      throw new Error(`Section ${newName} already exists in ${cls.name}`);
    }

    let classTeacherName = updates.classTeacherName !== undefined ? updates.classTeacherName : oldSec.classTeacherName;
    if (updates.classTeacherId && updates.classTeacherId !== oldSec.classTeacherId) {
      const teacher = this.cache.staff.find((s) => s.id === updates.classTeacherId);
      classTeacherName = teacher?.name;
    } else if (updates.classTeacherId === '') {
      classTeacherName = undefined;
    }

    const updatedSec: AcademicSection = {
      ...oldSec,
      ...updates,
      name: newName,
      classTeacherName,
    };

    cls.detailedSections![secIdx] = updatedSec;
    cls.sections = cls.detailedSections!.map((s) => s.name);

    if (updates.classTeacherId !== undefined && updates.classTeacherId !== oldSec.classTeacherId) {
      if (updates.classTeacherId) {
        this.assignClassTeacher(classId, newName, updates.classTeacherId);
      }
    }

    this.addAudit('SECTION_UPDATED', 'AcademicClass', classId, `Updated section ${newName} in ${cls.name}`);
    this.persist();

    return this.commitClassToServer('PUT', `/api/classes/${classId}`, cls, before);
  }

  deleteSection(classId: string, sectionIdentifier: string, options?: { reassignToSection?: string; force?: boolean }): AcademicClass {
    const cls = this.cache.classes.find((c) => c.id === classId);
    if (!cls) throw new Error('Class not found');

    const targetSec = (cls.detailedSections || []).find(
      (s) => s.id === sectionIdentifier || s.name.toUpperCase() === sectionIdentifier.toUpperCase()
    );
    if (!targetSec) throw new Error('Section not found');

    const enrolledStudents = this.cache.students.filter(
      (s) => (s.classId === classId || s.className === cls.name) && s.section.toUpperCase() === targetSec.name.toUpperCase()
    );

    if (enrolledStudents.length > 0) {
      if (options?.reassignToSection) {
        enrolledStudents.forEach((s) => {
          s.section = options.reassignToSection!;
        });
        this.addAudit('STUDENTS_REASSIGNED_SECTION', 'AcademicClass', classId, `Reassigned ${enrolledStudents.length} students from Section ${targetSec.name} to Section ${options.reassignToSection}`);
      } else if (options?.force) {
        enrolledStudents.forEach((s) => {
          s.section = '';
        });
        this.addAudit('STUDENTS_UNASSIGNED_SECTION', 'AcademicClass', classId, `Unassigned section for ${enrolledStudents.length} students from Section ${targetSec.name}`);
      } else {
        throw new Error(`Cannot delete Section ${targetSec.name} because ${enrolledStudents.length} students are enrolled.`);
      }
    }

    cls.detailedSections = (cls.detailedSections || []).filter((s) => s.id !== targetSec.id && s.name !== targetSec.name);
    cls.sections = cls.detailedSections.map((s) => s.name);

    // Clean up timetable slots for this class and section
    this.cache.timetable = this.cache.timetable.filter((t) => !(t.classId === classId && t.section === targetSec.name));

    this.addAudit('SECTION_DELETED', 'AcademicClass', classId, `Deleted section ${targetSec.name} from ${cls.name}`);
    this.persist();

    fetch(getApiUrl(`/api/classes/${classId}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(cls),
    }).catch(() => {});

    return cls;
  }

  assignClassTeacher(classId: string, sectionName: string, teacherId: string): { success: boolean; message: string; reassignedPrevious?: string } {
    const cls = this.cache.classes.find((c) => c.id === classId);
    if (!cls) throw new Error('Class not found');

    const teacher = this.cache.staff.find((s) => s.id === teacherId);
    if (!teacher) throw new Error('Teacher not found');

    const secNameUpper = sectionName.trim().toUpperCase();
    const classSectionLabel = `${cls.name}-${secNameUpper}`;

    let reassignedPrevious: string | undefined;
    this.cache.classes.forEach((otherCls) => {
      (otherCls.detailedSections || []).forEach((sec) => {
        if (sec.classTeacherId === teacherId && (otherCls.id !== classId || sec.name.toUpperCase() !== secNameUpper)) {
          reassignedPrevious = `${otherCls.name}-${sec.name}`;
          sec.classTeacherId = undefined;
          sec.classTeacherName = undefined;
        }
      });
    });

    const targetSec = (cls.detailedSections || []).find((s) => s.name.toUpperCase() === secNameUpper);
    if (targetSec) {
      targetSec.classTeacherId = teacher.id;
      targetSec.classTeacherName = teacher.name;
    }
    if (secNameUpper === 'A' || !cls.classTeacherId) {
      cls.classTeacherId = teacher.id;
      cls.classTeacherName = teacher.name;
    }

    teacher.classTeacherOf = classSectionLabel;
    if (!teacher.assignedClasses.includes(classSectionLabel)) {
      teacher.assignedClasses = [...teacher.assignedClasses, classSectionLabel];
    }

    const msg = reassignedPrevious
      ? `Assigned ${teacher.name} as Class Teacher of ${classSectionLabel} (Reassigned from ${reassignedPrevious}).`
      : `Assigned ${teacher.name} as Class Teacher of ${classSectionLabel}.`;

    this.addAudit('CLASS_TEACHER_ASSIGNED', 'AcademicClass', classId, msg);
    this.persist();

    fetch(getApiUrl(`/api/classes/${classId}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(cls),
    }).catch(() => {});

    fetch(getApiUrl(`/api/teachers/${teacher.id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(teacher),
    }).catch(() => {});

    return { success: true, message: msg, reassignedPrevious };
  }

  // Academics (Subjects & Curriculum)
  getSubjects(classId?: string, session?: string, includeInactive = false): Subject[] {
    let list = this.cache.subjects || [];
    if (!includeInactive) {
      list = list.filter((s) => (s.status ?? 'ACTIVE') === 'ACTIVE');
    }
    if (session) {
      list = list.filter((s) => !s.academicSession || s.academicSession === session);
    }
    if (classId) {
      list = list.filter((s) => Array.isArray(s.classIds) && s.classIds.includes(classId));
    }
    return [...list];
  }

  getActiveSubjects(classId?: string, session?: string): Subject[] {
    return this.getSubjects(classId, session, false);
  }

  async fetchClassSubjects(classId: string): Promise<Subject[]> {
    try {
      const res = await fetch(getApiUrl(`/api/classes/${classId}/subjects`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const subs = await res.json();
        if (Array.isArray(subs)) {
          // Update subjects cache with fresh data
          subs.forEach((freshSub: Subject) => {
            const idx = (this.cache.subjects || []).findIndex((s) => s.id === freshSub.id);
            if (idx !== -1) {
              this.cache.subjects[idx] = freshSub;
            } else {
              this.cache.subjects.push(freshSub);
            }
          });
          this.persist();
          return subs;
        }
      }
    } catch (e) {
      console.error('[API] Error fetching class subjects:', e);
    }
    return this.getActiveSubjects(classId);
  }

  getAllSubjects(classId?: string, session?: string): Subject[] {
    return this.getSubjects(classId, session, true);
  }

  getSubjectById(id: string): Subject | undefined {
    return this.cache.subjects.find((s) => s.id === id);
  }

  /** Sends a subject change to the server and returns the saved record; throws the server's own message on failure. */
  private async subjectRequest(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<any> {
    let res: Response;
    try {
      res = await fetch(getApiUrl(path), {
        method,
        headers: getAuthHeaders(),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
    return data;
  }

  async addSubject(data: Omit<Subject, 'id'>): Promise<Subject> {
    const session = data.academicSession || this.cache.settings.currentAcademicSession || '2026-2027';
    const maxMarks = Number(data.maxMarks) || 100;
    const draft: Subject = {
      ...data,
      id: `s-${Date.now()}`,
      maxMarks,
      passMarks: Number(data.passMarks) || 33,
      theoryMarks: data.theoryMarks !== undefined ? Number(data.theoryMarks) : maxMarks,
      practicalMarks: data.practicalMarks !== undefined ? Number(data.practicalMarks) : 0,
      credits: Number(data.credits) || 4,
      status: data.status || 'ACTIVE',
      academicSession: session,
    };
    const saved: Subject = await this.subjectRequest('POST', '/api/subjects', draft);
    this.cache.subjects.push(saved);
    this.addAudit('SUBJECT_CREATED', 'Subject', saved.id, `Created subject ${saved.name} (${saved.code})`);
    this.persist();
    return saved;
  }

  async updateSubject(id: string, updates: Partial<Subject>): Promise<Subject> {
    const idx = this.cache.subjects.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Subject not found');
    const saved: Subject = await this.subjectRequest('PUT', `/api/subjects/${id}`, { ...this.cache.subjects[idx], ...updates });
    this.cache.subjects[idx] = saved;
    this.addAudit('SUBJECT_UPDATED', 'Subject', id, `Updated subject ${saved.name} (${saved.code})`);
    this.persist();
    return saved;
  }

  async deleteSubject(id: string): Promise<void> {
    const target = this.cache.subjects.find((s) => s.id === id);
    if (!target) throw new Error('Subject not found');
    await this.subjectRequest('DELETE', `/api/subjects/${id}`);
    this.cache.subjects = this.cache.subjects.filter((s) => s.id !== id);
    this.addAudit('SUBJECT_DELETED', 'Subject', id, `Deleted subject ${target.name} (${target.code})`);
    this.persist();
  }

  assignSubjectToClass(subjectId: string, classId: string): Subject {
    const sub = this.cache.subjects.find((s) => s.id === subjectId);
    if (!sub) throw new Error('Subject not found');

    const cls = this.cache.classes.find((c) => c.id === classId);
    if (!cls) throw new Error('Class not found');

    if (!sub.classIds.includes(classId)) {
      sub.classIds = [...sub.classIds, classId];
      this.addAudit('SUBJECT_ASSIGNED_CLASS', 'Subject', subjectId, `Assigned ${sub.name} to ${cls.name}`);
      this.persist();

      fetch(getApiUrl(`/api/subjects/${subjectId}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(sub),
      }).catch(() => {});
    }
    return sub;
  }

  removeSubjectFromClass(subjectId: string, classId: string): Subject {
    const sub = this.cache.subjects.find((s) => s.id === subjectId);
    if (!sub) throw new Error('Subject not found');

    sub.classIds = sub.classIds.filter((cid) => cid !== classId);
    this.addAudit('SUBJECT_REMOVED_CLASS', 'Subject', subjectId, `Removed ${sub.name} from class ${classId}`);
    this.persist();

    fetch(getApiUrl(`/api/subjects/${subjectId}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(sub),
    }).catch((err) => {
      console.warn('[SubjectUpdate] Failed to remove subject from class on server:', err);
    });

    return sub;
  }

  async removeSubjectFromClassAsync(subjectId: string, classId: string): Promise<Subject> {
    const sub = this.removeSubjectFromClass(subjectId, classId);
    try {
      await fetch(getApiUrl(`/api/subjects/${subjectId}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(sub),
      });
    } catch (err) {
      console.error('[SubjectUpdate] Async remove subject error:', err);
    }
    return sub;
  }

  // Grading System
  getGradingSystem(session?: string): GradeDefinition[] {
    let system = this.cache.settings.gradingSystem;
    if (
      !system ||
      system.length !== 8 ||
      system.some((g) => (g.grade === 'E/F' || g.grade === 'E') && g.status === 'PASS') ||
      !system.some((g) => g.grade === 'E/F' && g.status === 'FAIL') ||
      !system.some((g) => g.grade === 'D' && g.minPercentage === 33)
    ) {
      this.cache.settings.gradingSystem = [...OFFICIAL_GRADING_SYSTEM];
      system = this.cache.settings.gradingSystem;
    }
    return system.map((g) => {
      const isFail = g.grade === 'E/F' || g.grade === 'E' || g.grade === 'F' || g.minPercentage < 33;
      if (isFail) {
        return {
          ...g,
          grade: 'E/F',
          minPercentage: 0,
          maxPercentage: 32,
          gradePoint: 0,
          status: 'FAIL' as const,
          remark: 'Essential Repeat',
          description: 'Essential Repeat',
        };
      }
      return {
        ...g,
        status: 'PASS' as const,
      };
    });
  }

  saveGradingSystem(grades: GradeDefinition[]): GradeDefinition[] {
    const sanitized = grades.map((g) => {
      const isFail = g.grade === 'E/F' || g.grade === 'E' || g.grade === 'F' || g.minPercentage < 33;
      if (isFail) {
        return {
          ...g,
          grade: 'E/F',
          minPercentage: 0,
          maxPercentage: 32,
          gradePoint: 0,
          status: 'FAIL' as const,
          remark: 'Essential Repeat',
          description: 'Essential Repeat',
        };
      }
      return {
        ...g,
        status: 'PASS' as const,
      };
    });
    this.cache.settings.gradingSystem = sanitized;
    this.addAudit('GRADING_SYSTEM_UPDATED', 'SchoolSettings', 'settings', `Updated grading system scale (${sanitized.length} grades)`);
    this.persist();

    fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    }).catch(() => {});

    return sanitized;
  }

  addGrade(grade: Omit<GradeDefinition, 'id'>): GradeDefinition {
    const newGrade: GradeDefinition = {
      ...grade,
      id: `gr-${Date.now()}`,
    };
    const current = this.cache.settings.gradingSystem || [];
    this.cache.settings.gradingSystem = [...current, newGrade];
    this.addAudit('GRADE_RULE_ADDED', 'SchoolSettings', newGrade.id, `Added grade ${newGrade.grade} (${newGrade.minPercentage}% - ${newGrade.maxPercentage}%)`);
    this.persist();

    fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    }).catch(() => {});

    return newGrade;
  }

  updateGrade(idOrGrade: string, updates: Partial<GradeDefinition>): GradeDefinition {
    const current = this.cache.settings.gradingSystem || [];
    const idx = current.findIndex((g) => g.id === idOrGrade || g.grade === idOrGrade);
    if (idx === -1) throw new Error('Grade not found');

    const updated = { ...current[idx], ...updates };
    current[idx] = updated;
    this.cache.settings.gradingSystem = current;
    this.addAudit('GRADE_RULE_UPDATED', 'SchoolSettings', updated.id || idOrGrade, `Updated grade ${updated.grade}`);
    this.persist();

    fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    }).catch(() => {});

    return updated;
  }

  deleteGrade(idOrGrade: string): boolean {
    const current = this.cache.settings.gradingSystem || [];
    const filtered = current.filter((g) => g.id !== idOrGrade && g.grade !== idOrGrade);
    if (filtered.length === current.length) return false;

    this.cache.settings.gradingSystem = filtered;
    this.addAudit('GRADE_RULE_DELETED', 'SchoolSettings', idOrGrade, `Deleted grade rule ${idOrGrade}`);
    this.persist();

    fetch(getApiUrl('/api/settings'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(this.cache.settings),
    }).catch(() => {});

    return true;
  }

  // Timetable
  getTimetableConfig(): { workingDays: string[]; periods: TimetablePeriodConfig[]; schoolTiming: { startTime: string; endTime: string } } {
    return {
      workingDays: this.cache.settings.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      periods: this.cache.timetablePeriods || [
        { periodNumber: 1, name: 'Period 1', startTime: '08:00 AM', endTime: '08:45 AM' },
        { periodNumber: 2, name: 'Period 2', startTime: '08:45 AM', endTime: '09:30 AM' },
        { periodNumber: 3, name: 'Period 3', startTime: '09:30 AM', endTime: '10:15 AM' },
        { periodNumber: 4, name: 'Period 4', startTime: '10:15 AM', endTime: '11:00 AM' },
        { periodNumber: 5, name: 'Recess / Break', startTime: '11:00 AM', endTime: '11:30 AM', isBreak: true, breakType: 'RECESS' as const },
        { periodNumber: 6, name: 'Period 5', startTime: '11:30 AM', endTime: '12:15 PM' },
        { periodNumber: 7, name: 'Period 6', startTime: '12:15 PM', endTime: '01:00 PM' },
        { periodNumber: 8, name: 'Period 7', startTime: '01:00 PM', endTime: '01:45 PM' },
      ],
      schoolTiming: {
        startTime: this.cache.settings.schoolTiming?.startTime || '08:00 AM',
        endTime: this.cache.settings.schoolTiming?.endTime || '02:00 PM',
      },
    };
  }

  updateTimetableConfig(updates: { workingDays?: string[]; periods?: TimetablePeriodConfig[]; schoolTiming?: { startTime: string; endTime: string } }) {
    if (updates.workingDays) {
      this.cache.settings.workingDays = updates.workingDays;
    }
    if (updates.periods) {
      this.cache.timetablePeriods = updates.periods;
    }
    if (updates.schoolTiming) {
      this.cache.settings.schoolTiming = {
        startTime: updates.schoolTiming.startTime,
        endTime: updates.schoolTiming.endTime,
      };
    }
    this.addAudit('TIMETABLE_CONFIG_UPDATED', 'SchoolSettings', 'timetable', 'Updated timetable working days and period timing configuration');
    this.persist();

    // Sanitize periods if provided to guarantee unique sequential period numbers
    const cleanUpdates = { ...updates };
    if (Array.isArray(cleanUpdates.periods)) {
      cleanUpdates.periods = cleanUpdates.periods.map((p, idx) => ({
        ...p,
        periodNumber: idx + 1,
        name: p.name || `Period ${idx + 1}`,
      }));
    }

    // Persist settings changes (workingDays and schoolTiming) via PUT /api/settings
    if (cleanUpdates.workingDays || cleanUpdates.schoolTiming) {
      const settingsPayload: Partial<SchoolSettings> = {};
      if (cleanUpdates.workingDays) settingsPayload.workingDays = cleanUpdates.workingDays;
      if (cleanUpdates.schoolTiming) settingsPayload.schoolTiming = cleanUpdates.schoolTiming;
      fetch(getApiUrl('/api/settings'), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settingsPayload),
      }).catch((err) => {
        console.warn('[TimetableConfig] Failed to update settings on server:', err);
      });
    }

    // Persist unified timetable configuration (includes workingDays, periods, schoolTiming)
    fetch(getApiUrl('/api/timetables/config'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(cleanUpdates),
    }).catch(() => {});
  }

  /**
   * Saves working days, school hours and period timings (one setting for every class and section).
   * The server checks the timings (valid, end after start, no overlap) and moves every scheduled slot
   * to the new times of its period. Throws the server's message when it refuses, instead of keeping an
   * unsaved copy in this browser as before.
   */
  async updateTimetableConfigAsync(updates: {
    workingDays?: string[];
    periods?: TimetablePeriodConfig[];
    schoolTiming?: { startTime: string; endTime: string };
  }): Promise<{ slotsUpdated: number; slotsInRemovedOrBreakPeriods: number }> {
    const cleanUpdates = { ...updates };
    if (Array.isArray(cleanUpdates.periods)) {
      cleanUpdates.periods = cleanUpdates.periods.map((p, idx) => ({
        ...p,
        periodNumber: idx + 1,
        name: p.name || `Period ${idx + 1}`,
      }));
    }
    const res = await fetch(getApiUrl('/api/timetables/config'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(cleanUpdates),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || 'The timetable settings could not be saved.');
    }
    this.updateTimetableConfig({
      ...cleanUpdates,
      ...(data?.config?.periods ? { periods: data.config.periods } : {}),
      ...(data?.config?.workingDays ? { workingDays: data.config.workingDays } : {}),
      ...(data?.config?.schoolTiming ? { schoolTiming: data.config.schoolTiming } : {}),
    });
    if (cleanUpdates.workingDays || cleanUpdates.schoolTiming) {
      this.cache.settings = {
        ...(this.cache.settings as any),
        ...(cleanUpdates.workingDays ? { workingDays: cleanUpdates.workingDays } : {}),
        ...(cleanUpdates.schoolTiming ? { schoolTiming: cleanUpdates.schoolTiming, schoolStartTime: cleanUpdates.schoolTiming.startTime, schoolEndTime: cleanUpdates.schoolTiming.endTime } : {}),
      } as any;
      this.persist();
    }
    // Slots of every class now carry the new times; reload them.
    if (Number(data?.slotsUpdated) > 0) await this.syncTimetable().catch(() => []);
    return { slotsUpdated: Number(data?.slotsUpdated) || 0, slotsInRemovedOrBreakPeriods: Number(data?.slotsInRemovedOrBreakPeriods) || 0 };
  }

  normalizeSessionName(raw?: string): string {
    if (!raw) return '';
    const s = String(raw).trim().replace(/^session-/i, '');
    const m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const century = m[1].substring(0, 2);
      return `${m[1]}-${century}${m[2]}`;
    }
    return s;
  }

  isSameAcademicSession(s1?: string, s2?: string): boolean {
    if (!s1 || !s2) return true;
    return this.normalizeSessionName(s1).toLowerCase() === this.normalizeSessionName(s2).toLowerCase();
  }

  normalizeDayOfWeek(day: string): string {
    if (!day) return 'Monday';
    const clean = day.trim().toLowerCase();
    const map: Record<string, string> = {
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
    };
    return map[clean] || (day.charAt(0).toUpperCase() + day.slice(1).toLowerCase());
  }

  getTimetable(classId?: string, section?: string, teacherId?: string, dayOfWeek?: string, session?: string): TimetableSlot[] {
    let slots = [...this.cache.timetable];
    if (session) slots = slots.filter((t) => !t.academicSession || this.isSameAcademicSession(t.academicSession, session));
    if (classId) slots = slots.filter((t) => t.classId === classId);
    if (section) slots = slots.filter((t) => t.section.toUpperCase() === section.toUpperCase());
    if (teacherId) {
      const cleanTargetId = String(teacherId).trim().toLowerCase();
      const staffMember = this.cache.staff?.find(
        (st) =>
          st.id?.toLowerCase() === cleanTargetId ||
          (st.employeeId && st.employeeId.toLowerCase() === cleanTargetId)
      );
      slots = slots.filter(
        (t) =>
          t.teacherId === teacherId ||
          (t.teacherId && t.teacherId.toLowerCase() === cleanTargetId) ||
          (staffMember && (t.teacherId === staffMember.id || (staffMember.employeeId && t.teacherId === staffMember.employeeId))) ||
          (staffMember && t.teacherName && staffMember.name && t.teacherName.toLowerCase().trim() === staffMember.name.toLowerCase().trim())
      );
    }
    if (dayOfWeek) {
      const targetDay = this.normalizeDayOfWeek(dayOfWeek).toLowerCase();
      slots = slots.filter((t) => this.normalizeDayOfWeek(t.dayOfWeek).toLowerCase() === targetDay);
    }

    // Always guarantee normalized day and resolved teacherName from staff
    return slots.map((s) => {
      const staffMember = this.cache.staff?.find((st) => st.id === s.teacherId);
      return {
        ...s,
        dayOfWeek: this.normalizeDayOfWeek(s.dayOfWeek),
        teacherName: s.teacherName || staffMember?.name || 'Assigned Faculty',
      };
    });
  }

  checkTimetableConflict(
    slotOrTeacherId:
      | {
          id?: string;
          dayOfWeek: string;
          periodNumber: number;
          teacherId: string;
          roomNumber?: string;
          classId?: string;
          section?: string;
          academicSession?: string;
          excludeSameClass?: boolean;
        }
      | string,
    dayOfWeekArg?: string,
    periodNumberArg?: number,
    classIdArg?: string,
    sectionArg?: string,
    roomNumberArg?: string
  ): { conflict: boolean; hasConflict: boolean; message?: string; conflictType?: 'TEACHER' | 'ROOM' | 'CLASS' } {
    let ignoreId: string | undefined;
    let teacherId = '';
    let dayOfWeek = '';
    let periodNumber = 1;
    let roomNumber: string | undefined;
    let classId: string | undefined;
    let section: string | undefined;
    let excludeSameClass = false;

    let academicSession: string | undefined;

    if (typeof slotOrTeacherId === 'object' && slotOrTeacherId !== null) {
      ignoreId = slotOrTeacherId.id;
      teacherId = slotOrTeacherId.teacherId;
      dayOfWeek = this.normalizeDayOfWeek(slotOrTeacherId.dayOfWeek);
      periodNumber = Number(slotOrTeacherId.periodNumber);
      roomNumber = slotOrTeacherId.roomNumber;
      classId = slotOrTeacherId.classId;
      section = slotOrTeacherId.section;
      academicSession = slotOrTeacherId.academicSession;
      excludeSameClass = !!slotOrTeacherId.excludeSameClass;
    } else {
      teacherId = slotOrTeacherId as string;
      dayOfWeek = this.normalizeDayOfWeek(dayOfWeekArg || 'Monday');
      periodNumber = Number(periodNumberArg) || 1;
      classId = classIdArg;
      section = sectionArg;
      roomNumber = roomNumberArg;
    }

    const normDay = dayOfWeek.toLowerCase();
    const activeSlots = this.cache.timetable.filter((t) => {
      if (ignoreId && t.id === ignoreId) return false;
      if (academicSession && t.academicSession && !this.isSameAcademicSession(t.academicSession, academicSession)) return false;
      return true;
    });

    // 1. Teacher Conflict: Teacher cannot teach two classes during the same period and day
    if (teacherId) {
      const teacherClash = activeSlots.find(
        (t) =>
          this.normalizeDayOfWeek(t.dayOfWeek).toLowerCase() === normDay &&
          Number(t.periodNumber) === periodNumber &&
          t.teacherId === teacherId &&
          (!excludeSameClass || !(t.classId === classId && (t.section || '').toUpperCase() === (section || '').toUpperCase()))
      );
      if (teacherClash) {
        const staffObj = this.cache.staff?.find((s) => s.id === teacherId);
        const tName = teacherClash.teacherName || staffObj?.name || 'This teacher';
        return {
          conflict: true,
          hasConflict: true,
          conflictType: 'TEACHER',
          message: `Teacher Conflict: ${tName} is already assigned to ${teacherClash.className}-${teacherClash.section} (${teacherClash.subjectName}) during Period ${periodNumber} on ${dayOfWeek}.`,
        };
      }
    }

    // 2. Room Conflict: Room cannot be occupied by two classes during the same period and day
    if (roomNumber && roomNumber.trim()) {
      const cleanRoom = roomNumber.trim().toLowerCase();
      const roomClash = activeSlots.find(
        (t) =>
          this.normalizeDayOfWeek(t.dayOfWeek).toLowerCase() === normDay &&
          Number(t.periodNumber) === periodNumber &&
          t.roomNumber &&
          t.roomNumber.trim().toLowerCase() === cleanRoom &&
          (!excludeSameClass || !(t.classId === classId && (t.section || '').toUpperCase() === (section || '').toUpperCase()))
      );
      if (roomClash) {
        return {
          conflict: true,
          hasConflict: true,
          conflictType: 'ROOM',
          message: `Room Conflict: ${roomClash.roomNumber} is already occupied by ${roomClash.className}-${roomClash.section} for ${roomClash.subjectName} during Period ${periodNumber} on ${dayOfWeek}.`,
        };
      }
    }

    // 3. Class Conflict: A class section cannot have two subjects during the same period and day
    if (classId && section && !excludeSameClass) {
      const classClash = activeSlots.find(
        (t) =>
          this.normalizeDayOfWeek(t.dayOfWeek).toLowerCase() === normDay &&
          Number(t.periodNumber) === periodNumber &&
          t.classId === classId &&
          (t.section || '').toUpperCase() === section.toUpperCase()
      );
      if (classClash) {
        return {
          conflict: true,
          hasConflict: true,
          conflictType: 'CLASS',
          message: `Class Conflict: ${classClash.className}-${classClash.section} already has ${classClash.subjectName} scheduled during Period ${periodNumber} on ${dayOfWeek}.`,
        };
      }
    }

    return { conflict: false, hasConflict: false };
  }

  addTimetableSlot(slot: Omit<TimetableSlot, 'id'>): { success: boolean; error?: string; slot?: TimetableSlot } {
    const normDay = this.normalizeDayOfWeek(slot.dayOfWeek);
    const conflictCheck = this.checkTimetableConflict({
      dayOfWeek: normDay,
      periodNumber: Number(slot.periodNumber),
      teacherId: slot.teacherId,
      roomNumber: slot.roomNumber,
      classId: slot.classId,
      section: slot.section,
    });

    if (conflictCheck.hasConflict) {
      return { success: false, error: conflictCheck.message };
    }

    const staffMember = this.cache.staff?.find((s) => s.id === slot.teacherId);
    const newSlot: TimetableSlot = {
      ...slot,
      id: `tt-${Date.now()}`,
      dayOfWeek: normDay,
      periodNumber: Number(slot.periodNumber),
      teacherName: slot.teacherName || staffMember?.name || 'Assigned Faculty',
      academicSession: slot.academicSession || this.cache.settings.currentAcademicSession || '2026-2027',
    };
    this.cache.timetable.push(newSlot);
    this.addAudit('TIMETABLE_SLOT_ADDED', 'TimetableSlot', newSlot.id, `Scheduled ${slot.subjectName} for ${slot.className}-${slot.section} on ${normDay} (P${slot.periodNumber})`);
    this.persist();

    fetch(getApiUrl('/api/timetables'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSlot),
    }).catch(() => {});

    return { success: true, slot: newSlot };
  }

  updateTimetableSlot(id: string, updates: Partial<TimetableSlot>): { success: boolean; error?: string; slot?: TimetableSlot } {
    const idx = this.cache.timetable.findIndex((t) => t.id === id);
    if (idx === -1) return { success: false, error: 'Timetable slot not found' };

    const normDay = updates.dayOfWeek ? this.normalizeDayOfWeek(updates.dayOfWeek) : this.cache.timetable[idx].dayOfWeek;
    const merged = {
      ...this.cache.timetable[idx],
      ...updates,
      dayOfWeek: normDay,
      periodNumber: updates.periodNumber !== undefined ? Number(updates.periodNumber) : this.cache.timetable[idx].periodNumber,
    };

    if (updates.teacherId) {
      const staffMember = this.cache.staff?.find((s) => s.id === updates.teacherId);
      if (staffMember) merged.teacherName = staffMember.name;
    }

    const conflictCheck = this.checkTimetableConflict({
      id,
      dayOfWeek: merged.dayOfWeek,
      periodNumber: merged.periodNumber,
      teacherId: merged.teacherId,
      roomNumber: merged.roomNumber,
      classId: merged.classId,
      section: merged.section,
    });

    if (conflictCheck.hasConflict) {
      return { success: false, error: conflictCheck.message };
    }

    this.cache.timetable[idx] = merged;
    this.addAudit('TIMETABLE_SLOT_UPDATED', 'TimetableSlot', id, `Updated slot for ${merged.subjectName} (${merged.className}-${merged.section})`);
    this.persist();

    fetch(getApiUrl(`/api/timetables/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    }).catch(() => {});

    return { success: true, slot: merged };
  }

  deleteTimetableSlot(id: string): boolean {
    const slot = this.cache.timetable.find((t) => t.id === id);
    if (!slot) return false;

    this.cache.timetable = this.cache.timetable.filter((t) => t.id !== id);
    this.addAudit('TIMETABLE_SLOT_DELETED', 'TimetableSlot', id, `Removed slot for ${slot.subjectName} on ${slot.dayOfWeek}`);
    this.persist();

    fetch(getApiUrl(`/api/timetables/${id}`), {
      method: 'DELETE',
    }).catch(() => {});

    return true;
  }

  async saveClassTimetableAsync(
    classId: string,
    section: string,
    slots: TimetableSlot[],
    session?: string
  ): Promise<{ success: boolean; error?: string; conflicts?: string[]; slots?: TimetableSlot[] }> {
    const activeSession = session || this.cache.settings.currentAcademicSession || '2026-2027';
    const targetClass = this.cache.classes.find((c) => c.id === classId);
    const className = targetClass?.name || 'Class';
    const secNorm = String(section).toUpperCase();

    // Slots from all other classes/sections
    const externalSlots = this.cache.timetable.filter(
      (t) =>
        !(
          t.classId === classId &&
          (t.section || '').toUpperCase() === secNorm &&
          (!t.academicSession || this.isSameAcademicSession(t.academicSession, activeSession))
        )
    );

    const conflicts: string[] = [];

    // Validate each slot against internal duplicates and external teacher/room clashes
    slots.forEach((slot, idx) => {
      const day = this.normalizeDayOfWeek(slot.dayOfWeek);
      const period = Number(slot.periodNumber);

      // Check intra-class conflict (2 subjects at same day & period)
      const intraClash = slots.find(
        (s, i) =>
          i !== idx &&
          this.normalizeDayOfWeek(s.dayOfWeek).toLowerCase() === day.toLowerCase() &&
          Number(s.periodNumber) === period
      );
      if (intraClash) {
        conflicts.push(`Intra-Class Conflict: Multiple subjects (${slot.subjectName} and ${intraClash.subjectName}) assigned to ${day} Period ${period}.`);
      }

      // Check external teacher clash
      if (slot.teacherId) {
        const teacherClash = externalSlots.find(
          (t) =>
            this.isSameAcademicSession(t.academicSession, activeSession) &&
            this.normalizeDayOfWeek(t.dayOfWeek).toLowerCase() === day.toLowerCase() &&
            Number(t.periodNumber) === period &&
            t.teacherId === slot.teacherId &&
            (!slot.id || t.id !== slot.id)
        );
        if (teacherClash) {
          const tName = slot.teacherName || teacherClash.teacherName || 'Teacher';
          conflicts.push(`Teacher Conflict: ${tName} is already assigned to ${teacherClash.className || 'another class'}-${teacherClash.section || 'A'} on ${day} Period ${period}.`);
        }
      }

      // Check external room clash
      if (slot.roomNumber && slot.roomNumber.trim()) {
        const cleanRoom = slot.roomNumber.trim().toLowerCase();
        const roomClash = externalSlots.find(
          (t) =>
            this.isSameAcademicSession(t.academicSession, activeSession) &&
            this.normalizeDayOfWeek(t.dayOfWeek).toLowerCase() === day.toLowerCase() &&
            Number(t.periodNumber) === period &&
            t.roomNumber &&
            t.roomNumber.trim().toLowerCase() === cleanRoom &&
            (!slot.id || t.id !== slot.id)
        );
        if (roomClash) {
          conflicts.push(`Room Conflict: ${slot.roomNumber} is already occupied by ${roomClash.className || 'another class'}-${roomClash.section || 'A'} on ${day} Period ${period}.`);
        }
      }
    });

    if (conflicts.length > 0) {
      return {
        success: false,
        error: conflicts[0],
        conflicts,
      };
    }

    // Normalize and prepare slots for database persistence
    const preparedSlots: TimetableSlot[] = slots.map((s, idx) => {
      const staffMember = this.cache.staff?.find((st) => st.id === s.teacherId);
      const periodObj = this.cache.timetablePeriods?.find((p) => p.periodNumber === Number(s.periodNumber));
      const subj = this.cache.subjects?.find((sb) => sb.id === s.subjectId);
      return {
        ...s,
        id: s.id && !s.id.startsWith('temp-') ? s.id : `tt-${Date.now()}-${idx}`,
        classId,
        className,
        section: secNorm,
        academicSession: activeSession,
        dayOfWeek: this.normalizeDayOfWeek(s.dayOfWeek),
        periodNumber: Number(s.periodNumber),
        startTime: s.startTime || periodObj?.startTime || '08:00 AM',
        endTime: s.endTime || periodObj?.endTime || '08:45 AM',
        subjectId: s.subjectId,
        subjectName: subj?.name || s.subjectName || 'Subject',
        teacherId: s.teacherId,
        teacherName: s.teacherName || staffMember?.name || 'Assigned Faculty',
        roomNumber: s.roomNumber?.trim() || 'Room 204',
      };
    });

    try {
      const res = await fetch(getApiUrl('/api/timetables/bulk'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          slots: preparedSlots,
          classId,
          section: secNorm,
          session: activeSession,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData.message || errorData.error || `Server returned error (${res.status})`;
        return { success: false, error: errMsg };
      }

      // Update in-memory cache with persisted slots
      this.cache.timetable = [...externalSlots, ...preparedSlots];
      this.clearTimetableDraft(classId, secNorm, activeSession);
      this.addAudit(
        'TIMETABLE_SAVED',
        'Timetable',
        `${classId}_${secNorm}`,
        `Published weekly timetable for ${className}-${secNorm} (${preparedSlots.length} periods)`
      );
      this.persist();

      // Immediately sync with server to ensure 100% MongoDB consistency
      await this.syncTimetable();

      return { success: true, slots: preparedSlots };
    } catch (err: any) {
      console.error('[ApiService] Error saving timetable asynchronously to server:', err);
      return { success: false, error: err?.message || 'Network error while persisting timetable' };
    }
  }

  saveClassTimetable(
    classId: string,
    section: string,
    slots: TimetableSlot[],
    session?: string
  ): { success: boolean; error?: string; conflicts?: string[] } {
    this.saveClassTimetableAsync(classId, section, slots, session).catch(() => {});
    return { success: true };
  }

  saveTimetableDraft(classId: string, section: string, slots: TimetableSlot[], session?: string): void {
    const activeSession = session || this.cache.settings.currentAcademicSession || '2026-2027';
    const draftKey = `cps_timetable_draft_${activeSession}_${classId}_${section.toUpperCase()}`;
    const payload = {
      savedAt: new Date().toISOString(),
      slots,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save draft to localStorage', e);
    }
  }

  getTimetableDraft(classId: string, section: string, session?: string): { slots: TimetableSlot[]; savedAt: string } | null {
    const activeSession = session || this.cache.settings.currentAcademicSession || '2026-2027';
    const draftKey = `cps_timetable_draft_${activeSession}_${classId}_${section.toUpperCase()}`;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  clearTimetableDraft(classId: string, section: string, session?: string): void {
    const activeSession = session || this.cache.settings.currentAcademicSession || '2026-2027';
    const draftKey = `cps_timetable_draft_${activeSession}_${classId}_${section.toUpperCase()}`;
    try {
      localStorage.removeItem(draftKey);
    } catch (e) {
      console.error('Failed to clear draft from localStorage', e);
    }
  }

  moveTimetableSlot(slotId: string, targetDay: string, targetPeriod: number): { success: boolean; error?: string; slot?: TimetableSlot } {
    return this.updateTimetableSlot(slotId, {
      dayOfWeek: this.normalizeDayOfWeek(targetDay),
      periodNumber: targetPeriod,
    });
  }

  swapTimetableSlots(slotIdA: string, slotIdB: string): { success: boolean; error?: string } {
    const slotA = this.cache.timetable.find((t) => t.id === slotIdA);
    const slotB = this.cache.timetable.find((t) => t.id === slotIdB);
    if (!slotA || !slotB) return { success: false, error: 'One or both slots not found' };

    const dayA = slotA.dayOfWeek;
    const periodA = slotA.periodNumber;
    const dayB = slotB.dayOfWeek;
    const periodB = slotB.periodNumber;

    // Check if moving slot A to B causes external clash
    const conflictA = this.checkTimetableConflict({
      id: slotA.id,
      dayOfWeek: dayB,
      periodNumber: periodB,
      teacherId: slotA.teacherId,
      roomNumber: slotA.roomNumber,
      classId: slotA.classId,
      section: slotA.section,
    });
    if (conflictA.hasConflict && conflictA.conflictType === 'TEACHER') {
      return { success: false, error: conflictA.message };
    }

    // Check if moving slot B to A causes external clash
    const conflictB = this.checkTimetableConflict({
      id: slotB.id,
      dayOfWeek: dayA,
      periodNumber: periodA,
      teacherId: slotB.teacherId,
      roomNumber: slotB.roomNumber,
      classId: slotB.classId,
      section: slotB.section,
    });
    if (conflictB.hasConflict && conflictB.conflictType === 'TEACHER') {
      return { success: false, error: conflictB.message };
    }

    slotA.dayOfWeek = dayB;
    slotA.periodNumber = periodB;
    slotB.dayOfWeek = dayA;
    slotB.periodNumber = periodA;

    this.addAudit('TIMETABLE_SLOTS_SWAPPED', 'TimetableSlot', `${slotIdA}_${slotIdB}`, `Swapped slots between ${slotA.subjectName} and ${slotB.subjectName}`);
    this.persist();
    return { success: true };
  }

  // Attendance
  getAttendance(classId?: string, section?: string, date?: string): AttendanceRecord[] {
    return this.cache.attendance.filter((a) => {
      if (classId && a.classId !== classId) return false;
      if (section && a.section !== section) return false;
      if (date && a.date !== date) return false;
      return true;
    });
  }

  getStudentAttendanceSummary(studentId: string) {
    const records = this.cache.attendance.filter((a) => a.studentId === studentId);
    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 100;
    return { records, total, present, percentage };
  }

  saveAttendance(
    classIdOrRecords: string | any[],
    section?: string,
    date?: string,
    recordsList?: { studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HOLIDAY'; remarks?: string }[]
  ) {
    if (Array.isArray(classIdOrRecords)) {
      const records = classIdOrRecords;
      const created: AttendanceRecord[] = records.map((r: any) => {
        const student = this.cache.students.find((s) => s.id === r.studentId);
        return {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          date: r.date || new Date().toISOString().substring(0, 10),
          classId: r.classId || (student ? student.classId : 'c-10'),
          section: r.section || (student ? student.section : 'A'),
          studentId: r.studentId,
          studentName: student ? student.name : r.studentName || 'Student',
          rollNumber: student ? student.rollNumber : '1',
          status: r.status,
          remarks: r.remarks,
        };
      });
      this.cache.attendance.push(...created);
      this.addAudit('ATTENDANCE_RECORDED', 'Attendance', 'bulk', `Recorded attendance for ${created.length} students`);
      this.persist();

      fetch(getApiUrl('/api/attendance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: created }),
      }).catch(() => {});

      return created;
    }

    const classId = classIdOrRecords as string;
    const records = recordsList || [];

    // Remove old records for this class/section/date
    this.cache.attendance = this.cache.attendance.filter(
      (a) => !(a.classId === classId && a.section === section && a.date === date)
    );

    const created: AttendanceRecord[] = records.map((r) => {
      const student = this.cache.students.find((s) => s.id === r.studentId);
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        date: date || new Date().toISOString().substring(0, 10),
        classId,
        section: section || 'A',
        studentId: r.studentId,
        studentName: student ? student.name : 'Student',
        rollNumber: student ? student.rollNumber : '1',
        status: r.status,
        remarks: r.remarks,
      };
    });

    this.cache.attendance.push(...created);
    this.addAudit('ATTENDANCE_RECORDED', 'Attendance', `${classId}-${section}-${date}`, `Recorded attendance for ${created.length} students`);
    this.persist();

    fetch(getApiUrl('/api/attendance'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ records: created, classId, section, date }),
    }).catch(() => {});

    return created;
  }

  // --- Dynamic Attendance Helpers ---

  async getAssignedClassesForAttendance(scope?: 'incharge'): Promise<{
    allAccess: boolean;
    classes: { classId: string; className: string; sections: string[] }[];
    defaultClassId?: string;
    defaultSection?: string;
    teacherId?: string;
    teacherName?: string;
    classTeacherOf?: string;
    authorizedSubjects?: { id: string; name: string }[];
    detailedAssignments?: any[];
  }> {
    try {
      const res = await fetch(getApiUrl(`/api/attendance/assigned-classes${scope ? `?scope=${scope}` : ''}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          allAccess: !!data.allAccess,
          classes: data.classes || [],
          defaultClassId: data.defaultClassId,
          defaultSection: data.defaultSection,
          teacherId: data.teacherId,
          teacherName: data.teacherName,
          classTeacherOf: data.classTeacherOf,
          authorizedSubjects: data.authorizedSubjects || [],
          detailedAssignments: data.detailedAssignments || [],
        };
      }
    } catch (e) {
      console.warn('[API] getAssignedClassesForAttendance error:', e);
    }
    const active = this.getActiveClasses();
    return {
      allAccess: true,
      classes: active.map((c) => ({
        classId: c.id,
        className: c.name,
        sections:
          c.detailedSections && c.detailedSections.length > 0
            ? c.detailedSections.filter((ds) => (ds.status || 'ACTIVE') === 'ACTIVE').map((ds) => ds.name)
            : c.sections || ['A'],
      })),
      defaultClassId: active[0]?.id,
      defaultSection: active[0]?.sections?.[0] || 'A',
      authorizedSubjects: [],
      detailedAssignments: [],
    };
  }

  async getTeacherAuthorizedAssignments(): Promise<{
    allAccess: boolean;
    classes: { classId: string; className: string; sections: string[] }[];
    subjects: { id: string; name: string }[];
    detailedAssignments: {
      classId: string;
      className: string;
      section: string;
      isClassTeacher: boolean;
      subjects: { id: string; name: string }[];
    }[];
  }> {
    try {
      const res = await fetch(getApiUrl('/api/teacher/authorized-assignments'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          allAccess: !!data.allAccess,
          classes: data.classes || [],
          subjects: data.subjects || [],
          detailedAssignments: data.detailedAssignments || [],
        };
      }
    } catch (e) {
      console.warn('[API] getTeacherAuthorizedAssignments error:', e);
    }
    const active = this.getActiveClasses();
    const allSubs = this.getSubjects().filter((s) => (s.status || 'ACTIVE') === 'ACTIVE');
    return {
      allAccess: true,
      classes: active.map((c) => ({
        classId: c.id,
        className: c.name,
        sections:
          c.detailedSections && c.detailedSections.length > 0
            ? c.detailedSections.filter((ds) => (ds.status || 'ACTIVE') === 'ACTIVE').map((ds) => ds.name)
            : c.sections || ['A'],
      })),
      subjects: allSubs.map((s) => ({ id: s.id, name: s.name })),
      detailedAssignments: [],
    };
  }

  async fetchStudentIdCard(studentId: string): Promise<{
    success: boolean;
    student: Student;
    schoolSettings: any;
  }> {
    const res = await fetch(getApiUrl(`/api/students/${studentId}/id-card`), {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch student ID card' }));
      throw new Error(err.error || `HTTP ${res.status}: Failed to fetch student ID card`);
    }
    return res.json();
  }

  async fetchAttendance(params: { classId?: string; section?: string; date?: string; studentId?: string }): Promise<AttendanceRecord[]> {
    const query = new URLSearchParams();
    if (params.classId) query.set('classId', params.classId);
    if (params.section) query.set('section', params.section);
    if (params.date) query.set('date', params.date);
    if (params.studentId) query.set('studentId', params.studentId);

    try {
      const res = await fetch(getApiUrl(`/api/attendance?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const fetchedIds = new Set(data.map((d: any) => d.id));
          this.cache.attendance = [
            ...this.cache.attendance.filter((a) => !fetchedIds.has(a.id)),
            ...data,
          ];
          this.persist();
          return data;
        }
      }
    } catch (e) {
      console.warn('[API] fetchAttendance error:', e);
    }
    return this.getAttendance(params.classId, params.section, params.date);
  }

  async saveAttendanceAsync(data: {
    classId: string;
    section: string;
    date: string;
    records: { studentId: string; studentName?: string; rollNumber?: string; status: string; remarks?: string }[];
  }): Promise<{ success: boolean; count: number; error?: string; holiday?: any }> {
    try {
      const res = await fetch(getApiUrl('/api/attendance'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || !resData.success) {
        return {
          success: false,
          count: 0,
          error: resData.error || `Failed to save attendance (HTTP ${res.status})`,
          holiday: resData.holiday,
        };
      }

      this.cache.attendance = this.cache.attendance.filter(
        (a) => !(a.classId === data.classId && a.section === data.section && a.date === data.date)
      );
      if (Array.isArray(resData.records)) {
        this.cache.attendance.push(...resData.records);
      }
      this.persist();

      return { success: true, count: resData.count || data.records.length };
    } catch (e: any) {
      console.error('[API] saveAttendanceAsync error:', e);
      return { success: false, count: 0, error: e?.message || 'Network error saving attendance.' };
    }
  }

  // --- Staff Attendance Helpers ---

  getStaffAttendance(date?: string, staffId?: string): StaffAttendanceRecord[] {
    return (this.cache.staffAttendance || []).filter((a) => {
      if (date && a.date !== date) return false;
      if (staffId && a.staffId !== staffId && a.employeeId !== staffId) return false;
      return true;
    });
  }

  async fetchStaffAttendance(params: { date?: string; staffId?: string }): Promise<StaffAttendanceRecord[]> {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.staffId) query.set('staffId', params.staffId);

    try {
      const res = await fetch(getApiUrl(`/api/staff-attendance?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const fetchedIds = new Set(data.map((d: any) => d.id));
          this.cache.staffAttendance = [
            ...(this.cache.staffAttendance || []).filter((a) => !fetchedIds.has(a.id)),
            ...data,
          ];
          this.persist();
          return data;
        }
      }
    } catch (e) {
      console.warn('[API] fetchStaffAttendance error:', e);
    }
    return this.getStaffAttendance(params.date, params.staffId);
  }

  async saveStaffAttendanceAsync(data: {
    date: string;
    records: { staffId: string; staffName?: string; employeeId?: string; department?: string; status: string; remarks?: string; checkInTime?: string; checkOutTime?: string }[];
  }): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/staff-attendance'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || !resData.success) {
        return {
          success: false,
          count: 0,
          error: resData.error || `Failed to save staff attendance (HTTP ${res.status})`,
        };
      }

      this.cache.staffAttendance = (this.cache.staffAttendance || []).filter(
        (a) => a.date !== data.date
      );
      if (Array.isArray(resData.records)) {
        this.cache.staffAttendance.push(...resData.records);
      }
      this.persist();

      return { success: true, count: resData.count || data.records.length };
    } catch (e: any) {
      console.error('[API] saveStaffAttendanceAsync error:', e);
      return { success: false, count: 0, error: e?.message || 'Network error saving staff attendance.' };
    }
  }

  // --- School Holidays Helpers ---

  getHolidays(session?: string): Holiday[] {
    let list = this.cache.holidays || [];
    if (session) {
      list = list.filter((h) => !h.academicSession || h.academicSession === session);
    }
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }

  isHoliday(dateStr: string): Holiday | undefined {
    return (this.cache.holidays || []).find((h) => {
      if (h.date === dateStr) return true;
      if (h.endDate && dateStr >= h.date && dateStr <= h.endDate) return true;
      return false;
    });
  }

  async fetchHolidays(): Promise<Holiday[]> {
    try {
      const res = await fetch(getApiUrl('/api/holidays'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.holidays = data;
          this.persist();
          return data;
        }
      }
    } catch (e) {
      console.warn('[API] fetchHolidays error:', e);
    }
    return this.getHolidays();
  }

  async addHoliday(holiday: Omit<Holiday, 'id'>): Promise<Holiday> {
    const res = await fetch(getApiUrl('/api/holidays'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(holiday),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create holiday (${res.status})`);
    }
    const data = await res.json();
    const newHol = data.holiday || holiday;
    this.cache.holidays = [...(this.cache.holidays || []).filter((h) => h.id !== newHol.id), newHol].sort((a, b) => a.date.localeCompare(b.date));
    this.persist();
    return newHol;
  }

  async updateHoliday(id: string, updates: Partial<Holiday>): Promise<Holiday> {
    const res = await fetch(getApiUrl(`/api/holidays/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update holiday (${res.status})`);
    }
    const data = await res.json();
    const updated = data.holiday;
    this.cache.holidays = (this.cache.holidays || []).map((h) => (h.id === id ? updated : h));
    this.persist();
    return updated;
  }

  async deleteHoliday(id: string): Promise<boolean> {
    const res = await fetch(getApiUrl(`/api/holidays/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete holiday (${res.status})`);
    }
    this.cache.holidays = (this.cache.holidays || []).filter((h) => h.id !== id);
    this.persist();
    return true;
  }

  // Fees
  getFeeStructures(): FeeStructure[] {
    return this.cache.feeStructures;
  }

  getFeePayments(studentId?: string): FeePayment[] {
    if (studentId) {
      return this.cache.feePayments.filter((p) => p.studentId === studentId);
    }
    return this.cache.feePayments;
  }

  public async fetchFeePayments(filters?: { studentId?: string; receiptNumber?: string }): Promise<FeePayment[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.studentId) params.append('studentId', filters.studentId);
      if (filters?.receiptNumber) params.append('receiptNumber', filters.receiptNumber);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`/api/fees/payments${query}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const existing = this.cache.feePayments || [];
          const map = new Map<string, FeePayment>();
          existing.forEach((p) => { if (p && p.id) map.set(p.id, p); });
          data.forEach((p) => { if (p && p.id) map.set(p.id, p); });
          this.cache.feePayments = Array.from(map.values());
          this.persist();
          return data;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch fee payments:', e);
    }
    return this.getFeePayments(filters?.studentId);
  }

  public async fetchFeePaymentsPaginated(options?: {
    studentId?: string;
    page?: number;
    limit?: number;
    search?: string;
    receiptNumber?: string;
  }): Promise<{ data: FeePayment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      const params = new URLSearchParams();
      if (options?.studentId) params.append('studentId', options.studentId);
      if (options?.page) params.append('page', String(options.page));
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.search) params.append('search', options.search);
      if (options?.receiptNumber) params.append('receiptNumber', options.receiptNumber);
      const query = params.toString() ? `?${params.toString()}` : '';

      const res = await apiFetch(`/api/fees/payments${query}`);
      if (res.ok) {
        const json = await res.json();
        if (json.pagination && Array.isArray(json.data)) {
          return json;
        } else if (Array.isArray(json)) {
          const page = options?.page || 1;
          const limit = options?.limit || 10;
          return {
            data: json.slice((page - 1) * limit, page * limit),
            pagination: {
              page,
              limit,
              total: json.length,
              totalPages: Math.ceil(json.length / limit) || 1,
            },
          };
        }
      }
    } catch (e) {
      console.warn('Failed to fetch paginated fee payments:', e);
    }

    // Local fallback
    const all = this.getFeePayments(options?.studentId);
    let filtered = all;
    if (options?.search && typeof options.search === 'string') {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter((p) =>
        Boolean(
          p && (
            (p.receiptNumber && p.receiptNumber.toLowerCase().includes(q)) ||
            (p.feeType && p.feeType.toLowerCase().includes(q)) ||
            (p.paymentMethod && String(p.paymentMethod).toLowerCase().includes(q)) ||
            (p.transactionReference && p.transactionReference.toLowerCase().includes(q))
          )
        )
      );
    }
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    return {
      data: filtered.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
    };
  }

  collectFee(data: any): FeePayment {
    return this.collectFeePayment(data);
  }

  collectFeePayment(data: {
    studentId: string;
    amount: number;
    feeType: string;
    paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'ONLINE';
    transactionReference: string;
    discount?: number;
    remarks?: string;
  }): FeePayment {
    const student = this.cache.students.find((s) => s.id === data.studentId);
    if (!student) throw new Error('Student not found');

    const activeSession = this.getActiveAcademicSession()?.name || this.cache.settings.currentAcademicSession || '2026-2027';
    const yearPrefix = activeSession.split('-')[0] || String(new Date().getFullYear());
    const receiptNumber = `REC-${yearPrefix}-${String(this.cache.feePayments.length + 44).padStart(4, '0')}`;
    const payment: FeePayment = {
      id: `fp-${Date.now()}`,
      receiptNumber,
      studentId: student.id,
      studentName: student.name,
      admissionNumber: student.admissionNumber,
      className: student.className,
      section: student.section,
      amount: data.amount,
      feeType: data.feeType,
      academicSession: activeSession,
      paymentMethod: data.paymentMethod,
      transactionReference: data.transactionReference || 'REF-' + Date.now(),
      paymentDate: new Date().toISOString().substring(0, 10),
      collectedBy: this.cache.currentUser.name,
      discount: data.discount || 0,
      remarks: data.remarks,
    };

    this.cache.feePayments.unshift(payment);
    this.addAudit('FEE_PAYMENT', 'FeePayment', receiptNumber, `Collected ₹${payment.amount} from ${student.name} (${receiptNumber})`);
    this.persist();

    fetch(getApiUrl('/api/fees/payments'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payment),
    }).catch(() => {});

    return payment;
  }

  // --- DYNAMIC CLASS FEE CONFIGURATIONS ---
  public async getFeeConfigurations(): Promise<ClassFeeConfiguration[]> {
    try {
      const res = await fetch(getApiUrl('/api/fee-configurations'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.feeConfigurations = data;
          this.persist();
        }
      }
    } catch (e) {
      console.warn('Failed to fetch fee configurations:', e);
    }
    return this.cache.feeConfigurations || [];
  }

  public getFeeConfigurationsSync(): ClassFeeConfiguration[] {
    return this.cache.feeConfigurations || [];
  }

  /**
   * Resolves the effective fee configuration following priority:
   * 1. Section-specific Override + Student Category
   * 2. Section-specific Override + ALL Categories
   * 3. Class-wide Default Configuration + Student Category
   * 4. Class-wide Default Configuration + ALL Categories
   * 5. Any available configuration for the class
   */
  public getEffectiveFeeConfig(
    classIdOrName: string,
    section?: string,
    academicSession?: string,
    studentCategory?: string
  ): ClassFeeConfiguration | null {
    const list = this.cache.feeConfigurations || [];
    const targetSession = academicSession || this.cache.settings?.currentAcademicSession || '2026-2027';

    // Normalize class identifiers
    const classesList = this.cache.classes || [];
    const targetClass = classesList.find(
      (c) =>
        c.id?.toLowerCase() === classIdOrName?.toLowerCase() ||
        c.name?.toLowerCase() === classIdOrName?.toLowerCase() ||
        c.id?.replace(/^c-/, 'class-').toLowerCase() === classIdOrName?.toLowerCase() ||
        c.id?.replace(/^class-/, 'c-').toLowerCase() === classIdOrName?.toLowerCase()
    );

    const validClassIdentifiers = new Set(
      [
        classIdOrName?.toLowerCase(),
        targetClass?.id?.toLowerCase(),
        targetClass?.name?.toLowerCase(),
        classIdOrName?.replace(/^c-/, 'class-')?.toLowerCase(),
        classIdOrName?.replace(/^class-/, 'c-')?.toLowerCase(),
      ].filter(Boolean) as string[]
    );

    // Filter by session if available, else all
    let sessionList = list.filter((c) => c.academicSession === targetSession);
    if (sessionList.length === 0) sessionList = list;

    // Filter by class
    const classConfigs = sessionList.filter((c) => {
      const cId = c.classId?.toLowerCase();
      const cName = c.className?.toLowerCase();
      return (
        (cId && validClassIdentifiers.has(cId)) ||
        (cName && validClassIdentifiers.has(cName))
      );
    });

    if (classConfigs.length === 0) {
      // Fallback: try finding any class matching in all configs
      const anyClassConfig = list.find((c) => {
        const cId = c.classId?.toLowerCase();
        const cName = c.className?.toLowerCase();
        return (
          (cId && validClassIdentifiers.has(cId)) ||
          (cName && validClassIdentifiers.has(cName))
        );
      });
      return anyClassConfig || null;
    }

    // 1. Priority 1: Specific section match + Specific student category
    if (section && section !== 'ALL') {
      if (studentCategory && studentCategory !== 'ALL') {
        const exactSectionCat = classConfigs.find(
          (c) => c.section === section && c.studentCategory === studentCategory
        );
        if (exactSectionCat) return exactSectionCat;
      }
      // Priority 2: Specific section match + All categories (or undefined)
      const sectionMatch = classConfigs.find(
        (c) => c.section === section && (!c.studentCategory || c.studentCategory === 'ALL')
      );
      if (sectionMatch) return sectionMatch;
    }

    // 2. Priority 3: Class-level default + Specific student category
    if (studentCategory && studentCategory !== 'ALL') {
      const classCatMatch = classConfigs.find(
        (c) => (!c.section || c.section === 'ALL' || c.section === 'Default') && c.studentCategory === studentCategory
      );
      if (classCatMatch) return classCatMatch;
    }

    // 3. Priority 4: Class-level default (ALL or no section) + All categories (or undefined)
    const classDefault = classConfigs.find(
      (c) => (!c.section || c.section === 'ALL' || c.section === 'Default') && (!c.studentCategory || c.studentCategory === 'ALL')
    );
    if (classDefault) return classDefault;

    // 4. Fallback: Any match for class
    return classConfigs[0] || null;
  }

  public getClassesSync(session?: string, includeInactive = false): AcademicClass[] {
    return this.getClasses(session, includeInactive);
  }

  public async saveFeeConfiguration(config: ClassFeeConfiguration): Promise<ClassFeeConfiguration> {
    return this.updateFeeConfiguration(config.id, config);
  }

  public async updateFeeConfiguration(id: string, updates: Partial<ClassFeeConfiguration>): Promise<ClassFeeConfiguration> {
    const list = this.cache.feeConfigurations || [];
    let idx = list.findIndex((c) => c.id === id);
    if (idx === -1 && updates.classId) {
      const targetSection = updates.section || 'ALL';
      const targetSession = updates.academicSession || '2026-2027';
      const targetCategory = updates.studentCategory || 'ALL';
      idx = list.findIndex(
        (c) =>
          (c.classId === updates.classId || c.className === updates.className) &&
          (c.section || 'ALL') === targetSection &&
          (c.academicSession || '2026-2027') === targetSession &&
          (c.studentCategory || 'ALL') === targetCategory
      );
    }
    const existing = idx >= 0 ? list[idx] : null;

    const merged: ClassFeeConfiguration = {
      ...(existing || {
        id,
        classId: updates.classId || '',
        className: updates.className || '',
        academicSession: updates.academicSession || '2026-2027',
        section: updates.section || 'ALL',
        admissionFee: 0,
        monthlyTuitionFee: 0,
        dressCodeFee: 0,
        booksStationeryFee: 0,
        idCardFee: 0,
        computerSmartClassFee: 0,
        hostelFee: 0,
        messFee: 0,
      }),
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      this.cache.feeConfigurations[idx] = merged;
    } else {
      this.cache.feeConfigurations.push(merged);
    }
    this.persist();

    try {
      const res = await fetch(getApiUrl(`/api/fee-configurations/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(merged),
      });
      if (res.ok) {
        const savedServer = await res.json();
        if (savedServer && savedServer.id) {
          const sIdx = this.cache.feeConfigurations.findIndex((c) => c.id === savedServer.id);
          if (sIdx !== -1) {
            this.cache.feeConfigurations[sIdx] = savedServer;
          } else if (idx !== -1) {
            this.cache.feeConfigurations[idx] = savedServer;
          }
          this.persist();
          return savedServer;
        }
      }
    } catch (e) {
      console.warn('Failed to persist fee configuration to server:', e);
    }

    return merged;
  }

  public async deleteFeeConfiguration(id: string): Promise<boolean> {
    const list = this.cache.feeConfigurations || [];
    const idx = list.findIndex((c) => c.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      this.persist();
      try {
        await fetch(getApiUrl(`/api/fee-configurations/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
      } catch (e) {
        console.warn('Failed to delete fee configuration from server:', e);
      }
      return true;
    }
    return false;
  }

  public async copyFeeConfiguration(
    sourceConfig: ClassFeeConfiguration,
    targetClassId: string,
    targetClassName: string,
    targetSection: string = 'ALL',
    targetSession: string = '2026-2027'
  ): Promise<ClassFeeConfiguration> {
    const newId = `fc-${targetClassId}-${targetSection.toLowerCase()}-${Date.now()}`;
    const newConfig: ClassFeeConfiguration = {
      ...sourceConfig,
      id: newId,
      classId: targetClassId,
      className: targetClassName,
      section: targetSection,
      academicSession: targetSession,
      updatedAt: new Date().toISOString(),
    };
    return this.updateFeeConfiguration(newId, newConfig);
  }

  // --- DYNAMIC TRANSPORT SLABS ---
  public async getTransportSlabs(): Promise<TransportSlab[]> {
    try {
      const res = await fetch(getApiUrl('/api/transport-slabs'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.cache.transportSlabs = data;
          this.persist();
        }
      }
    } catch (e) {
      console.warn('Failed to fetch transport slabs:', e);
    }
    return this.cache.transportSlabs || [];
  }

  public getTransportSlabsSync(): TransportSlab[] {
    return this.cache.transportSlabs || [];
  }

  public async updateTransportSlabs(slabs: TransportSlab[]): Promise<TransportSlab[]> {
    this.cache.transportSlabs = slabs;
    this.persist();

    try {
      await fetch(getApiUrl('/api/transport-slabs'), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(slabs),
      });
    } catch (e) {
      console.warn('Failed to persist transport slabs to server:', e);
    }

    return this.cache.transportSlabs;
  }

  public async saveTransportSlab(slabData: Partial<TransportSlab>): Promise<TransportSlab> {
    const slabs = this.cache.transportSlabs || [];
    const id = slabData.id || `ts-${Date.now()}`;
    const idx = slabs.findIndex((s) => s.id === id);
    const updatedSlab: TransportSlab = {
      id,
      slabName: slabData.slabName || '0 - 1 KM',
      minDistanceKm: Number(slabData.minDistanceKm) || 0,
      maxDistanceKm: Number(slabData.maxDistanceKm) || 1,
      monthlyFee: Number(slabData.monthlyFee) || 500,
      active: slabData.active !== false && slabData.isActive !== false,
      isActive: slabData.active !== false && slabData.isActive !== false,
      description: slabData.description || '',
      ...slabData,
    };

    if (idx !== -1) {
      slabs[idx] = updatedSlab;
    } else {
      slabs.push(updatedSlab);
    }
    await this.updateTransportSlabs(slabs);
    return updatedSlab;
  }

  public async updateTransportSlab(id: string, updates: Partial<TransportSlab>): Promise<TransportSlab> {
    return this.saveTransportSlab({ id, ...updates });
  }

  public async addTransportSlab(slabData: Partial<TransportSlab>): Promise<TransportSlab> {
    return this.saveTransportSlab(slabData);
  }

  public async deleteTransportSlab(id: string): Promise<boolean> {
    const slabs = this.cache.transportSlabs || [];
    const filtered = slabs.filter((s) => s.id !== id);
    if (filtered.length !== slabs.length) {
      await this.updateTransportSlabs(filtered);
      return true;
    }
    return false;
  }

  // --- DYNAMIC FEE LEDGERS & MONTHLY BILLING ---
  public async getFeeLedgers(filters?: { studentId?: string; academicSession?: string; monthYear?: string; status?: string; receiptNumber?: string }): Promise<FeeLedgerEntry[]> {
    try {
      let query = '';
      if (filters) {
        const params = new URLSearchParams();
        if (filters.studentId) params.append('studentId', filters.studentId);
        if (filters.academicSession) params.append('academicSession', filters.academicSession);
        if (filters.monthYear) params.append('monthYear', filters.monthYear);
        if (filters.status) params.append('status', filters.status);
        if (filters.receiptNumber) params.append('receiptNumber', filters.receiptNumber);
        query = `?${params.toString()}`;
      }

      const res = await apiFetch(`/api/fee-ledgers${query}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          if (!filters || Object.keys(filters).length === 0) {
            const seen = new Set<string>();
            this.cache.feeLedgers = data.filter((l) => {
              if (!l || !l.id) return false;
              if (seen.has(l.id)) return false;
              seen.add(l.id);
              return true;
            });
          } else if (filters?.studentId) {
            const studentIdFilter = filters.studentId;
            const otherLedgers = (this.cache.feeLedgers || []).filter((l) => l.studentId !== studentIdFilter);
            this.cache.feeLedgers = [...otherLedgers, ...data];
          } else {
            const existing = this.cache.feeLedgers || [];
            const updatedMap = new Map<string, FeeLedgerEntry>();
            existing.forEach((l) => { if (l && l.id) updatedMap.set(l.id, l); });
            data.forEach((l) => { if (l && l.id) updatedMap.set(l.id, l); });
            this.cache.feeLedgers = Array.from(updatedMap.values());
          }
          this.persist();
        }
      }
    } catch (e) {
      console.warn('Failed to fetch fee ledgers from server:', e);
    }
    return this.getFeeLedgersSync(filters?.studentId);
  }

  public fetchFeeLedgers(filters?: { studentId?: string; academicSession?: string; monthYear?: string; status?: string; receiptNumber?: string }): Promise<FeeLedgerEntry[]> {
    return this.getFeeLedgers(filters);
  }

  public fetchSettings(): Promise<SchoolSettings> {
    return this.syncSettings();
  }

  public getFeeLedgersSync(studentId?: string): FeeLedgerEntry[] {
    const all = this.cache.feeLedgers || [];
    const seen = new Set<string>();
    const unique: FeeLedgerEntry[] = [];
    for (const l of all) {
      if (l && l.id && !seen.has(l.id)) {
        seen.add(l.id);
        if (!studentId || l.studentId === studentId) {
          unique.push(l);
        }
      }
    }
    return unique;
  }

  public async generateMonthlyFees(payload: {
    academicSession: string;
    monthYear: string;
    dueDate?: string;
    classId?: string;
  }): Promise<{ success: boolean; generatedCount: number; message: string; ledgers: FeeLedgerEntry[] }> {
    // Bills are created only on the server; a bill that exists only in this browser would never be collectable.
    try {
      const res = await apiFetch('/api/fee-ledgers/generate-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, feeMonth: payload.monthYear, monthYear: payload.monthYear }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        await this.getFeeLedgers();
        const count = Number(data.generatedCount) || 0;
        return {
          ...data,
          success: true,
          generatedCount: count,
          message: data.message || (count > 0 ? `Created ${count} bill(s) for ${payload.monthYear}.` : `No new bills: every student already has a bill for ${payload.monthYear}.`),
        };
      }
      return { success: false, generatedCount: 0, message: data?.error || `Could not create bills (error ${res.status}).`, ledgers: this.cache.feeLedgers || [] };
    } catch {
      return { success: false, generatedCount: 0, message: 'Could not reach the server. Check the internet connection and try again.', ledgers: this.cache.feeLedgers || [] };
    }
  }

  /** Super Admin only: edit the fee heads, discount, late fee and due date of one invoice. */
  public async updateFeeLedgerAsync(
    ledgerId: string,
    payload: {
      breakdown: { head: string; amount: number; isOneTime?: boolean }[];
      discount?: number;
      fine?: number;
      dueDate?: string;
      reason: string;
    }
  ): Promise<{ success: boolean; ledger?: FeeLedgerEntry; error?: string }> {
    try {
      const res = await apiFetch(`/api/fee-ledgers/${encodeURIComponent(ledgerId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ledger) {
        return { success: false, error: data?.error || 'The invoice could not be changed. Please try again.' };
      }
      const idx = (this.cache.feeLedgers || []).findIndex((l) => l.id === data.ledger.id);
      if (idx !== -1) this.cache.feeLedgers[idx] = data.ledger;
      else this.cache.feeLedgers = [data.ledger, ...(this.cache.feeLedgers || [])];
      this.persist();
      this.getFeeLedgers().catch(() => {});
      return { success: true, ledger: data.ledger };
    } catch (e) {
      return { success: false, error: 'Could not reach the server. Please check the internet and try again.' };
    }
  }

  public async collectFeeLedgerPayment(
    ledgerId: string,
    payload: {
      amountPaid: number;
      paymentMethod: string;
      transactionReference?: string;
      discount?: number;
      fine?: number;
      remarks?: string;
      idempotencyKey?: string;
      collectedBy?: string;
      paymentDate?: string;
    }
  ): Promise<{ success: boolean; ledger?: FeeLedgerEntry; payment?: FeePayment; receipt?: FeePayment; error?: string }> {
    // A payment counts only once the server has saved it. There is no offline copy: a receipt that exists only
    // in this browser would show money as received that the school's books never record.
    try {
      const res = await apiFetch(`/api/fee-ledgers/${encodeURIComponent(ledgerId)}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      const paymentObj = data?.payment || data?.receipt;
      if (!res.ok || !paymentObj) {
        return { success: false, error: data?.error || `Payment was not saved (error ${res.status}). Nothing was recorded.` };
      }
      if (data.ledger) {
        const lIdx = (this.cache.feeLedgers || []).findIndex((l) => l.id === data.ledger.id);
        if (lIdx !== -1) this.cache.feeLedgers[lIdx] = data.ledger;
        else this.cache.feeLedgers = [data.ledger, ...(this.cache.feeLedgers || [])];
      }
      const pIdx = (this.cache.feePayments || []).findIndex((p) => p.id === paymentObj.id || p.receiptNumber === paymentObj.receiptNumber);
      if (pIdx !== -1) this.cache.feePayments[pIdx] = paymentObj;
      else this.cache.feePayments = [paymentObj, ...(this.cache.feePayments || [])];
      this.persist();
      this.getFeeLedgers().catch(() => {});
      if (data.ledger?.studentId) this.fetchFeePayments({ studentId: data.ledger.studentId }).catch(() => {});
      return { success: true, ledger: data.ledger, payment: paymentObj, receipt: paymentObj };
    } catch {
      return { success: false, error: 'Could not reach the server, so the payment was not recorded. Check the internet connection and try again.' };
    }
  }

  public async getStudentFeeOverview(studentId: string): Promise<{
    success: boolean;
    student: Student | null;
    payments: FeePayment[];
    ledgers: FeeLedgerEntry[];
  }> {
    try {
      const res = await apiFetch(`/api/fees/student/${encodeURIComponent(studentId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.student) {
          const idx = (this.cache.students || []).findIndex((s) => s.id === data.student.id);
          if (idx !== -1) {
            this.cache.students[idx] = { ...this.cache.students[idx], ...data.student };
          } else {
            this.cache.students.push(data.student);
          }
          this.persist();
        }
        return data;
      }
    } catch (e) {
      console.warn('Failed to fetch student fee overview:', e);
    }
    const student = this.cache.students.find((s) => s.id === studentId || s.admissionNumber === studentId) || null;
    const ledgers = this.getFeeLedgersSync(studentId);
    const payments = this.getFeePayments(studentId);
    return {
      success: true,
      student,
      payments,
      ledgers,
    };
  }

  public async getStudentFeeLedgersPaginated(
    studentId: string,
    options?: { page?: number; limit?: number; status?: string; search?: string }
  ): Promise<{ data: FeeLedgerEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', String(options.page));
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.status) params.append('status', options.status);
      if (options?.search) params.append('search', options.search);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`/api/fee-ledgers/student/${encodeURIComponent(studentId)}${query}`);
      if (res.ok) {
        const json = await res.json();
        if (json.pagination && Array.isArray(json.data)) {
          return json;
        } else if (Array.isArray(json)) {
          const page = options?.page || 1;
          const limit = options?.limit || 10;
          return {
            data: json.slice((page - 1) * limit, page * limit),
            pagination: {
              page,
              limit,
              total: json.length,
              totalPages: Math.ceil(json.length / limit) || 1,
            },
          };
        }
      }
    } catch (e) {
      console.warn('Failed to get paginated fee ledgers:', e);
    }

    // Local fallback
    const all = this.getFeeLedgersSync(studentId);
    let filtered = all;
    if (options?.status && options.status !== 'ALL') {
      const today = new Date().toISOString().substring(0, 10);
      if (options.status === 'PAID') filtered = filtered.filter((l) => (l.pendingAmount ?? 0) <= 0);
      else if (options.status === 'PENDING') filtered = filtered.filter((l) => (l.pendingAmount ?? 0) > 0);
      else if (options.status === 'OVERDUE') filtered = filtered.filter((l) => (l.pendingAmount ?? 0) > 0 && l.dueDate && l.dueDate < today);
    }
    if (options?.search && typeof options.search === 'string') {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter((l) =>
        Boolean(
          l && (
            (l.invoiceNumber && l.invoiceNumber.toLowerCase().includes(q)) ||
            (l.feeType && l.feeType.toLowerCase().includes(q)) ||
            (l.feeMonth && l.feeMonth.toLowerCase().includes(q))
          )
        )
      );
    }
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    return {
      data: filtered.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
    };
  }

  public async getStudentFeePaymentsPaginated(
    studentId: string,
    options?: { page?: number; limit?: number; search?: string }
  ): Promise<{ data: FeePayment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      const params = new URLSearchParams();
      params.append('studentId', studentId);
      if (options?.page) params.append('page', String(options.page));
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.search) params.append('search', options.search);
      const query = `?${params.toString()}`;
      const res = await fetch(getApiUrl(`/api/fees/payments${query}`), { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.pagination && Array.isArray(json.data)) {
          return json;
        } else if (Array.isArray(json)) {
          const page = options?.page || 1;
          const limit = options?.limit || 10;
          return {
            data: json.slice((page - 1) * limit, page * limit),
            pagination: {
              page,
              limit,
              total: json.length,
              totalPages: Math.ceil(json.length / limit) || 1,
            },
          };
        }
      }
    } catch (e) {
      console.warn('Failed to get paginated fee payments:', e);
    }

    // Local fallback
    const all = this.getFeePayments(studentId);
    let filtered = all;
    if (options?.search && typeof options.search === 'string') {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter((p) =>
        Boolean(
          p && (
            (p.receiptNumber && p.receiptNumber.toLowerCase().includes(q)) ||
            (p.transactionReference && p.transactionReference.toLowerCase().includes(q)) ||
            (p.feeType && p.feeType.toLowerCase().includes(q))
          )
        )
      );
    }
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    return {
      data: filtered.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
    };
  }

  public async addFeeLedgerBill(payload: {
    studentId: string;
    feeType?: string;
    description?: string;
    amount?: number;
    dueDate?: string;
    frequency?: string;
    applicableMonth?: string;
    remarks?: string;
    academicSession?: string;
    breakdown?: { head: string; amount: number; isOneTime?: boolean }[];
    /** MONTHLY_FEE: the regular monthly fee for applicableMonth (+ months). EXTRA: a separate charge. */
    billKind?: 'MONTHLY_FEE' | 'EXTRA';
    /** MONTHLY_FEE only: how many consecutive months to bill, starting at applicableMonth (1-12). */
    months?: number;
    /** Money the parent pays now, recorded against the new bill(s) with a receipt. */
    advancePayment?: {
      amount: number;
      paymentMethod?: string;
      transactionReference?: string;
      paymentDate?: string;
      remarks?: string;
    };
  }): Promise<{
    success: boolean;
    ledger?: FeeLedgerEntry;
    ledgers?: FeeLedgerEntry[];
    payments?: FeePayment[];
    skippedMonths?: string[];
    error?: string;
  }> {
    try {
      const res = await apiFetch('/api/fee-ledgers/bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ledger) {
        await this.getFeeLedgers();
        return {
          success: true,
          ledger: data.ledger,
          ledgers: Array.isArray(data.ledgers) ? data.ledgers : [data.ledger],
          payments: Array.isArray(data.payments) ? data.payments : [],
          skippedMonths: Array.isArray(data.skippedMonths) ? data.skippedMonths : [],
        };
      }
      if (data?.ledger) {
        // The bill was saved but the payment was not; refresh so the new bill shows up
        await this.getFeeLedgers().catch(() => null);
      }
      return { success: false, error: data?.error || `The bill was not saved (error ${res.status}).` };
    } catch {
      return { success: false, error: 'Could not reach the server, so the bill was not saved. Check the internet connection and try again.' };
    }
  }

  public async generateStudentMonthlyInvoice(
    studentId: string,
    payload: { monthYear: string; dueDate?: string; academicSession?: string }
  ): Promise<{ success: boolean; ledger?: FeeLedgerEntry; error?: string }> {
    try {
      const res = await apiFetch(`/api/fee-ledgers/student/${encodeURIComponent(studentId)}/generate-monthly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        await this.getFeeLedgers();
        return data;
      }
      return { success: false, error: data?.error || 'Failed to generate monthly invoice' };
    } catch {
      return { success: false, error: 'Could not reach the server, so no invoice was created. Check the internet connection and try again.' };
    }
  }

  public async payFullStudentDues(
    studentId: string,
    payload: {
      amountPaid?: number;
      paymentMethod: string;
      transactionReference?: string;
      collectedBy?: string;
      remarks?: string;
      paymentDate?: string;
      discount?: number;
      fine?: number;
      idempotencyKey?: string;
    }
  ): Promise<{
    success: boolean;
    settledCount: number;
    ledgers: FeeLedgerEntry[];
    receipts: FeePayment[];
    payment?: FeePayment;
    receipt?: FeePayment;
  }> {
    // Saved on the server or not at all (see collectFeeLedgerPayment). Errors are thrown with the server's reason.
    let res: Response;
    try {
      res = await apiFetch(`/api/fee-ledgers/student/${encodeURIComponent(studentId)}/pay-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('Could not reach the server, so the payment was not recorded. Check the internet connection and try again.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error(data?.error || data?.message || `Payment was not saved (error ${res.status}). Nothing was recorded.`);
    }
    await this.getFeeLedgers();
    await this.syncWithServer({ force: true });
    await this.fetchFeePayments({ studentId }).catch(() => {});
    return data;
  }

  // Exams & Marks
  getExams(filters?: { classId?: string; studentId?: string; status?: string }): Exam[] {
    let list = this.cache.exams || [];
    if (!filters) return list;
    if (filters.status) {
      list = list.filter((e) => e.status === filters.status || (filters.status === 'PUBLISHED' && (!e.status || e.status === 'PUBLISHED')));
    }
    if (filters.studentId) {
      const student = this.cache.students?.find((s) => s.id === filters.studentId || s.admissionNumber === filters.studentId);
      if (student) {
        list = list.filter((e) => {
          const hasClassIds = Array.isArray(e.classIds) && e.classIds.length > 0;
          const matchClass = hasClassIds && (
            e.classIds.includes(student.classId) || 
            (student.className && e.classIds.includes(student.className))
          );
          const matchSingle = (e as any).classId && (
            (e as any).classId === student.classId ||
            (student.className && (e as any).classId === student.className)
          );
          const matchSchedule = Array.isArray(e.schedule) && e.schedule.some((s) => 
            (s.classId === student.classId || (student.className && s.className === student.className)) &&
            (!s.section || s.section === 'ALL' || !student.section || s.section === student.section)
          );
          const isSchoolWide = !hasClassIds && !(e as any).classId && (!Array.isArray(e.schedule) || e.schedule.length === 0);
          const matchSection = !e.section || e.section === 'ALL' || !student.section || e.section === student.section;
          return (matchClass || matchSingle || matchSchedule || isSchoolWide) && matchSection;
        });
      } else {
        return [];
      }
    } else if (filters.classId) {
      list = list.filter((e) => {
        const hasClassIds = Array.isArray(e.classIds) && e.classIds.length > 0;
        const matchClass = hasClassIds && e.classIds.includes(filters.classId!);
        const matchSingle = (e as any).classId && (e as any).classId === filters.classId!;
        const matchSchedule = Array.isArray(e.schedule) && e.schedule.some((s) => s.classId === filters.classId!);
        const isSchoolWide = !hasClassIds && !(e as any).classId && (!Array.isArray(e.schedule) || e.schedule.length === 0);
        return matchClass || matchSingle || matchSchedule || isSchoolWide;
      });
    }
    return list;
  }

  public async fetchExams(filters?: { classId?: string; studentId?: string; status?: string; academicSession?: string; resultsStatus?: string }): Promise<Exam[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.classId) params.append('classId', filters.classId);
      if (filters?.studentId) params.append('studentId', filters.studentId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.resultsStatus) params.append('resultsStatus', filters.resultsStatus);
      if (filters?.academicSession) params.append('academicSession', filters.academicSession);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(getApiUrl(`/api/exams${queryStr}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          if (!this.cache.exams) this.cache.exams = [];
          list.forEach((freshExam: Exam) => {
            const idx = this.cache.exams.findIndex((e) => e.id === freshExam.id);
            if (idx >= 0) {
              this.cache.exams[idx] = freshExam;
            } else {
              this.cache.exams.push(freshExam);
            }
          });
          this.persist();
          return list;
        }
      }
    } catch (err) {
      console.warn('[API] Error fetching exams from server:', err);
    }
    return this.getExams(filters);
  }

  async createExam(examData: Partial<Exam>): Promise<Exam> {
    const examName = examData.name || examData.title || 'Examination';
    const newExam: Exam = {
      id: examData.id || `ex-${Date.now()}`,
      name: examName,
      title: examName,
      term: examData.term || 'First Term',
      examType: examData.examType || 'MID_TERM',
      academicSession: examData.academicSession || this.getActiveAcademicSession()?.name || this.cache.settings?.currentAcademicSession || '2026-2027',
      startDate: examData.startDate || new Date().toISOString().substring(0, 10),
      endDate: examData.endDate || new Date().toISOString().substring(0, 10),
      classIds: Array.isArray(examData.classIds) ? examData.classIds : (examData.classIds ? [examData.classIds] : []),
      section: examData.section || 'ALL',
      status: examData.status || 'DRAFT',
      admitCardStatus: examData.admitCardStatus || 'DRAFT',
      resultsStatus: examData.resultsStatus || 'DRAFT',
      isApprovedByPrincipal: !!examData.isApprovedByPrincipal,
      instructions: examData.instructions || '',
      roomVenue: examData.roomVenue || 'School Examination Center',
      schedule: Array.isArray(examData.schedule) ? examData.schedule : [],
      description: examData.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!this.cache.exams) this.cache.exams = [];
    this.cache.exams.unshift(newExam);
    this.addAudit('EXAM_CREATED', 'Exam', newExam.id, `Created exam schedule: ${newExam.title}`);
    this.persist();

    try {
      const res = await fetch(getApiUrl('/api/exams'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newExam),
      });
      if (res.ok) {
        const saved = await res.json();
        const idx = this.cache.exams.findIndex((e) => e.id === newExam.id);
        if (idx !== -1) this.cache.exams[idx] = saved;
        return saved;
      }
    } catch (err) {
      console.error('[API] Error creating exam on server:', err);
    }
    return newExam;
  }

  async updateExam(id: string, examData: Partial<Exam>): Promise<Exam> {
    if (!this.cache.exams) this.cache.exams = [];
    const idx = this.cache.exams.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Exam not found');

    const examName = examData.name || examData.title || this.cache.exams[idx].name || this.cache.exams[idx].title;
    const updated: Exam = {
      ...this.cache.exams[idx],
      ...examData,
      name: examName,
      title: examName,
      updatedAt: new Date().toISOString(),
    };

    this.cache.exams[idx] = updated;
    this.addAudit('EXAM_UPDATED', 'Exam', id, `Updated exam details: ${updated.title}`);
    this.persist();

    try {
      const res = await fetch(getApiUrl(`/api/exams/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const saved = await res.json();
        this.cache.exams[idx] = saved;
        return saved;
      }
    } catch (err) {
      console.error('[API] Error updating exam on server:', err);
    }
    return updated;
  }

  async deleteExam(id: string): Promise<boolean> {
    if (!this.cache.exams) return false;
    const exam = this.cache.exams.find((e) => e.id === id);
    this.cache.exams = this.cache.exams.filter((e) => e.id !== id);
    this.cache.examMarks = (this.cache.examMarks || []).filter((m) => m.examId !== id);
    // Remove notices
    this.cache.notices = (this.cache.notices || []).filter(
      (n) => n.id !== `notice-exam-${id}` && n.id !== `notice-result-${id}`
    );
    this.addAudit('EXAM_DELETED', 'Exam', id, `Deleted exam: ${exam?.title || id}`);
    this.persist();

    try {
      const res = await fetch(getApiUrl(`/api/exams/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (err) {
      console.error('[API] Error deleting exam on server:', err);
      return false;
    }
  }

  async publishExam(id: string, status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' = 'PUBLISHED'): Promise<Exam> {
    return this.updateExam(id, { status });
  }

  async publishAdmitCards(id: string, status: 'DRAFT' | 'PUBLISHED' = 'PUBLISHED'): Promise<Exam> {
    return this.updateExam(id, { admitCardStatus: status });
  }

  async publishResults(id: string, status: 'DRAFT' | 'PUBLISHED' = 'PUBLISHED'): Promise<Exam> {
    return this.updateExam(id, { resultsStatus: status });
  }

  async addCustomExamType(name: string): Promise<string[]> {
    const rawName = name.trim();
    if (!rawName) return this.cache.settings?.customExamTypes || [];
    if (!this.cache.settings) {
      this.cache.settings = {} as any;
    }
    if (!Array.isArray(this.cache.settings.customExamTypes)) {
      this.cache.settings.customExamTypes = [];
    }
    if (!this.cache.settings.customExamTypes.includes(rawName)) {
      this.cache.settings.customExamTypes.push(rawName);
    }
    this.persist();

    try {
      const res = await fetch(getApiUrl('/api/settings/exam-types'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name: rawName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.customExamTypes)) {
          this.cache.settings.customExamTypes = data.customExamTypes;
          this.persist();
        }
      }
    } catch (err) {
      console.error('[API] Error saving custom exam type:', err);
    }
    return this.cache.settings.customExamTypes || [];
  }

  getExamMarks(examId: string, classId?: string, subjectId?: string): ExamMark[] {
    let marks = (this.cache.examMarks || []).filter((m) => m.examId === examId);
    if (classId) marks = marks.filter((m) => m.classId === classId);
    if (subjectId) marks = marks.filter((m) => m.subjectId === subjectId);
    return marks;
  }

  async fetchExamMarks(examId?: string, classId?: string, subjectId?: string, studentId?: string): Promise<ExamMark[]> {
    try {
      const params = new URLSearchParams();
      if (examId) params.append('examId', examId);
      if (classId) params.append('classId', classId);
      if (subjectId) params.append('subjectId', subjectId);
      if (studentId) params.append('studentId', studentId);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(getApiUrl(`/api/marks${queryStr}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          list.forEach((freshMark: ExamMark) => {
            const idx = (this.cache.examMarks || []).findIndex((m) => m.id === freshMark.id);
            if (idx >= 0) {
              this.cache.examMarks[idx] = freshMark;
            } else {
              this.cache.examMarks.push(freshMark);
            }
          });
          this.persist();
          return list;
        }
      }
    } catch (e) {
      console.error('[API] Error fetching exam marks:', e);
    }
    return this.getExamMarks(examId || '', classId, subjectId);
  }

  saveExamMarks(marksList: Omit<ExamMark, 'id' | 'grade'>[]): ExamMark[] {
    const updated: ExamMark[] = [];

    marksList.forEach((item) => {
      // Validate marks against max marks and non-negative bounds
      const isAbsent = !!item.isAbsent;
      const safeMarks = isAbsent ? 0 : Math.max(0, Math.min(item.marksObtained, item.maxMarks));
      const evalRes = isAbsent
        ? { grade: 'E/F', gradePoint: 0, status: 'FAIL' as const, percentage: 0, remark: 'Absent' }
        : calculateEvaluation(safeMarks, item.maxMarks);

      const existingIndex = this.cache.examMarks.findIndex(
        (m) =>
          m.examId === item.examId &&
          m.studentId === item.studentId &&
          m.subjectId === item.subjectId
      );

      const record: ExamMark = {
        ...item,
        marksObtained: safeMarks,
        isAbsent,
        grade: evalRes.grade,
        gradePoint: evalRes.gradePoint,
        remark: evalRes.remark,
        status: evalRes.status,
        id: existingIndex >= 0 ? this.cache.examMarks[existingIndex].id : `em-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      if (existingIndex >= 0) {
        this.cache.examMarks[existingIndex] = record;
      } else {
        this.cache.examMarks.push(record);
      }
      updated.push(record);
    });

    this.addAudit('MARKS_RECORDED', 'ExamMark', marksList[0]?.examId || 'exam', `Submitted marks for ${updated.length} entries`);
    this.persist();

    fetch(getApiUrl('/api/marks'), {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ marksList: updated }),
    }).catch(() => {});

    return updated;
  }

  async saveExamMarksAsync(payload: {
    examId?: string;
    classId?: string;
    section?: string;
    subjectId?: string;
    marksList: any[];
    submissionStatus?: 'DRAFT' | 'SUBMITTED';
  }): Promise<{ success: boolean; count: number; submissionStatus?: string; error?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/marks'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save marks');
      }

      // Update local cache
      (payload.marksList || []).forEach((item) => {
        const existingIdx = this.cache.examMarks.findIndex(
          (m) => m.examId === (item.examId || payload.examId) &&
                 m.studentId === item.studentId &&
                 m.subjectId === (item.subjectId || payload.subjectId)
        );
        const record = {
          ...item,
          submissionStatus: payload.submissionStatus || 'SUBMITTED',
        };
        if (existingIdx >= 0) {
          this.cache.examMarks[existingIdx] = { ...this.cache.examMarks[existingIdx], ...record };
        } else {
          this.cache.examMarks.push(record);
        }
      });
      this.persist();

      return {
        success: true,
        count: data.count || payload.marksList.length,
        submissionStatus: payload.submissionStatus || 'SUBMITTED',
      };
    } catch (err: any) {
      console.error('[API] saveExamMarksAsync error:', err);
      return {
        success: false,
        count: 0,
        error: err.message || 'Network error saving marks',
      };
    }
  }

  async fetchTeacherAssignedExams(): Promise<Exam[]> {
    try {
      const res = await fetch(getApiUrl('/api/teacher/assigned-exams'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.exams)) {
          return data.exams;
        }
      }
    } catch (e) {
      console.warn('[API] fetchTeacherAssignedExams error:', e);
    }
    return this.getExams();
  }

  getTeacherAssignedExams(teacherEmployeeId?: string): Exam[] {
    const allExams = this.getExams();
    const storedUser = getStoredUser();
    if (!storedUser || storedUser.role !== 'TEACHER') {
      return allExams;
    }

    const staffList = this.getStaff();
    const curStaff = staffList.find(
      (s) => s.id === storedUser.id || (storedUser.employeeId && s.employeeId === storedUser.employeeId)
    );
    if (!curStaff) return allExams;

    const assignedClassNames = new Set<string>();
    if (curStaff.classTeacherOf) {
      assignedClassNames.add(curStaff.classTeacherOf.split(/[-:]/)[0].trim().toLowerCase());
    }
    if (Array.isArray(curStaff.assignedClasses)) {
      curStaff.assignedClasses.forEach((ac) => {
        assignedClassNames.add(ac.split(/[-:]/)[0].trim().toLowerCase());
      });
    }
    if (Array.isArray(curStaff.qualifiedClasses)) {
      curStaff.qualifiedClasses.forEach((qc) => {
        assignedClassNames.add(qc.trim().toLowerCase());
      });
    }
    if (Array.isArray(curStaff.classesQualifiedToTeach)) {
      (curStaff.classesQualifiedToTeach as any).forEach((qc: string) => {
        assignedClassNames.add(qc.trim().toLowerCase());
      });
    } else if (typeof curStaff.classesQualifiedToTeach === 'string' && curStaff.classesQualifiedToTeach.trim()) {
      curStaff.classesQualifiedToTeach.split(',').forEach((qc) => {
        assignedClassNames.add(qc.trim().toLowerCase());
      });
    }
    if (curStaff.teachingProfile && Array.isArray((curStaff.teachingProfile as any).classesQualifiedToTeach)) {
      (curStaff.teachingProfile as any).classesQualifiedToTeach.forEach((qc: string) => {
        assignedClassNames.add(qc.trim().toLowerCase());
      });
    }

    const matched = allExams.filter((ex) => {
      if (!ex.classIds || ex.classIds.length === 0 || ex.classIds.includes('ALL')) return true;
      return ex.classIds.some((cid) => {
        const cls = this.cache.classes.find((c) => c.id === cid || c.name.toLowerCase() === cid.toLowerCase());
        const name = (cls ? cls.name : cid).toLowerCase();
        return assignedClassNames.has(name) || assignedClassNames.has(cid.toLowerCase());
      });
    });

    return matched.length > 0 ? matched : allExams;
  }

  approveExamResults(examId: string): Exam {
    const exam = this.cache.exams.find((e) => e.id === examId);
    if (!exam) throw new Error('Exam not found');
    exam.isApprovedByPrincipal = true;
    this.addAudit('RESULTS_APPROVED', 'Exam', examId, `Principal approved results for ${exam.title}`);
    this.persist();

    fetch(getApiUrl(`/api/exams/${examId}/approve`), {
      method: 'PUT',
    }).catch(() => {});

    return exam;
  }

  // Homework
  getHomework(classId?: string): Homework[] {
    if (classId) {
      return this.cache.homework.filter((h) => h.classId === classId);
    }
    return this.cache.homework;
  }

  /** Fields a teacher or admin sends when creating or editing homework. */
  async fetchHomeworkOptions(): Promise<{ ok: boolean; classes: HomeworkClassOption[]; error?: string }> {
    try {
      const res = await apiFetch('/api/homework/options');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, classes: [], error: data?.error || `Could not load your classes (HTTP ${res.status}).` };
      return { ok: true, classes: Array.isArray(data?.classes) ? data.classes : [] };
    } catch (e: any) {
      return { ok: false, classes: [], error: e?.message || 'Network error loading your classes.' };
    }
  }

  async saveHomeworkAsync(
    input: HomeworkInput,
    id?: string
  ): Promise<{ success: boolean; homework?: Homework; error?: string }> {
    try {
      const res = await apiFetch(id ? `/api/homework/${encodeURIComponent(id)}` : '/api/homework', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: data?.error || `Could not save homework (HTTP ${res.status}).` };
      const saved = data as Homework;
      const list = (this.cache.homework || []).filter((h) => h.id !== saved.id);
      this.cache.homework = [saved, ...list];
      this.persist();
      return { success: true, homework: saved };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error saving homework.' };
    }
  }

  async deleteHomeworkAsync(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await apiFetch(`/api/homework/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: data?.error || `Could not delete homework (HTTP ${res.status}).` };
      this.cache.homework = (this.cache.homework || []).filter((h) => h.id !== id);
      this.persist();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error deleting homework.' };
    }
  }

  // Study Materials & Cloudflare R2 School Documents
  getStudyMaterials(category?: string, className?: string): StudyMaterial[] {
    let materials = this.cache.studyMaterials || [];
    if (category && category !== 'ALL') {
      materials = materials.filter((m) => m.category === category);
    }
    if (className && className !== 'ALL') {
      materials = materials.filter((m) => m.className === className);
    }
    return materials;
  }

  addStudyMaterial(data: Omit<StudyMaterial, 'id' | 'uploadedAt'>): StudyMaterial {
    const material: StudyMaterial = {
      ...data,
      id: `sm-${Date.now()}`,
      uploadedAt: new Date().toISOString().substring(0, 10),
    };
    if (!this.cache.studyMaterials) {
      this.cache.studyMaterials = [];
    }
    this.cache.studyMaterials.unshift(material);
    this.addAudit('STUDY_MATERIAL_ADDED', 'StudyMaterial', material.id, `Uploaded ${material.title} to Cloudflare R2`);
    this.persist();

    fetch(getApiUrl('/api/study-materials'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(material),
    }).catch(() => {});

    return material;
  }

  deleteStudyMaterial(id: string): boolean {
    if (!this.cache.studyMaterials) return false;
    const item = this.cache.studyMaterials.find((m) => m.id === id);
    if (!item) return false;
    this.cache.studyMaterials = this.cache.studyMaterials.filter((m) => m.id !== id);
    this.addAudit('STUDY_MATERIAL_DELETED', 'StudyMaterial', id, `Removed study material: ${item.title}`);
    this.persist();

    fetch(getApiUrl(`/api/study-materials/${id}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).catch(() => {});

    return true;
  }

  // Hostel Management
  getHostels(): Hostel[] {
    return this.cache.hostels;
  }

  getHostelRooms(): HostelRoom[] {
    return this.cache.hostelRooms;
  }

  getHostelAllocations(): HostelAllocation[] {
    return this.cache.hostelAllocations || [];
  }

  getHostelsData() {
    return {
      hostels: this.cache.hostels,
      rooms: this.cache.hostelRooms,
      allocations: this.cache.hostelAllocations || [],
    };
  }

  async fetchHostels(): Promise<{ hostels: Hostel[]; rooms: HostelRoom[]; allocations: HostelAllocation[]; stats?: any }> {
    await this.syncHostel();
    return {
      hostels: this.cache.hostels || [],
      rooms: this.cache.hostelRooms || [],
      allocations: this.cache.hostelAllocations || [],
    };
  }

  async createHostel(data: Partial<Hostel>): Promise<Hostel> {
    const res = await fetch(getApiUrl('/api/hostels'), {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create hostel' }));
      throw new Error(err.error || err.message || 'Failed to create hostel');
    }
    const created: Hostel = await res.json();
    this.cache.hostels.push(created);
    this.persist();
    return created;
  }

  async updateHostel(id: string, data: Partial<Hostel>): Promise<Hostel> {
    const res = await fetch(getApiUrl(`/api/hostels/${id}`), {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update hostel' }));
      throw new Error(err.error || err.message || 'Failed to update hostel');
    }
    const updated: Hostel = await res.json();
    const idx = this.cache.hostels.findIndex((h) => h.id === id);
    if (idx !== -1) {
      this.cache.hostels[idx] = updated;
    }
    this.persist();
    return updated;
  }

  async deleteHostel(id: string): Promise<boolean> {
    const res = await fetch(getApiUrl(`/api/hostels/${id}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete hostel' }));
      throw new Error(err.error || err.message || 'Failed to delete hostel');
    }
    this.cache.hostels = this.cache.hostels.filter((h) => h.id !== id);
    this.cache.hostelRooms = this.cache.hostelRooms.filter((r) => r.hostelId !== id);
    this.persist();
    return true;
  }

  async addHostelFloor(hostelId: string, floor: number): Promise<Hostel> {
    const res = await fetch(getApiUrl(`/api/hostels/${hostelId}/floors`), {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ floor }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add floor' }));
      throw new Error(err.error || err.message || 'Failed to add floor');
    }
    const updated: Hostel = await res.json();
    const idx = this.cache.hostels.findIndex((h) => h.id === hostelId);
    if (idx !== -1) {
      this.cache.hostels[idx] = updated;
    }
    this.persist();
    return updated;
  }

  async createHostelRoom(data: any): Promise<HostelRoom> {
    const res = await fetch(getApiUrl('/api/hostels/rooms'), {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create room' }));
      throw new Error(err.error || err.message || 'Failed to create room');
    }
    const created: HostelRoom = await res.json();
    this.cache.hostelRooms.push(created);
    const hostel = this.cache.hostels.find((h) => h.id === created.hostelId);
    if (hostel) {
      hostel.totalRooms = this.cache.hostelRooms.filter((r) => r.hostelId === hostel.id).length;
    }
    this.persist();
    return created;
  }

  async updateHostelRoom(id: string, data: any): Promise<HostelRoom> {
    const res = await fetch(getApiUrl(`/api/hostels/rooms/${id}`), {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update room' }));
      throw new Error(err.error || err.message || 'Failed to update room');
    }
    const updated: HostelRoom = await res.json();
    const idx = this.cache.hostelRooms.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.cache.hostelRooms[idx] = updated;
    }
    this.persist();
    return updated;
  }

  async deleteHostelRoom(id: string): Promise<boolean> {
    const res = await fetch(getApiUrl(`/api/hostels/rooms/${id}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete room' }));
      throw new Error(err.error || err.message || 'Failed to delete room');
    }
    const targetRoom = this.cache.hostelRooms.find((r) => r.id === id);
    this.cache.hostelRooms = this.cache.hostelRooms.filter((r) => r.id !== id);
    if (targetRoom) {
      const hostel = this.cache.hostels.find((h) => h.id === targetRoom.hostelId);
      if (hostel) {
        hostel.totalRooms = this.cache.hostelRooms.filter((r) => r.hostelId === hostel.id).length;
      }
    }
    this.persist();
    return true;
  }

  async allocateHostelBed(
    roomIdOrStudentId: string,
    bedNumberOrRoomId: string,
    studentIdOrBedNumber?: string,
    remarks?: string
  ): Promise<{ success: boolean; error?: string; room?: HostelRoom; student?: Student }> {
    let roomId = roomIdOrStudentId;
    let bedNumber = bedNumberOrRoomId;
    let studentId = studentIdOrBedNumber || '';

    // Handle parameter ordering if called as (studentId, roomId, bedNumber)
    if (this.cache.students.some((s) => s.id === roomIdOrStudentId)) {
      studentId = roomIdOrStudentId;
      roomId = bedNumberOrRoomId;
      bedNumber = studentIdOrBedNumber || 'Bed A';
    }

    try {
      const res = await fetch(getApiUrl('/api/hostels/allocate'), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, bedNumber, studentId, remarks }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || data.error || 'Failed to allocate bed.' };
      }

      // Sync local cache
      if (data.room) {
        const rIdx = this.cache.hostelRooms.findIndex((r) => r.id === roomId);
        if (rIdx !== -1) this.cache.hostelRooms[rIdx] = data.room;
      }
      if (data.student) {
        const sIdx = this.cache.students.findIndex((s) => s.id === studentId);
        if (sIdx !== -1) this.cache.students[sIdx] = data.student;
      }
      if (data.allocation) {
        this.cache.hostelAllocations = [
          data.allocation,
          ...(this.cache.hostelAllocations || []).filter((a) => a.id !== data.allocation.id),
        ];
      }
      this.persist();
      return { success: true, room: data.room, student: data.student };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error allocating bed' };
    }
  }

  async vacateHostelBed(
    studentId: string,
    remarks?: string
  ): Promise<{ success: boolean; error?: string; student?: Student }> {
    try {
      const res = await fetch(getApiUrl('/api/hostels/vacate'), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, remarks }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || data.error || 'Failed to vacate bed.' };
      }

      await this.syncHostel();
      const sIdx = this.cache.students.findIndex((s) => s.id === studentId);
      if (sIdx !== -1 && data.student) {
        this.cache.students[sIdx] = data.student;
      }
      this.persist();
      return { success: true, student: data.student };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error vacating bed' };
    }
  }

  async changeHostelBed(
    studentId: string,
    targetRoomId: string,
    targetBedNumber: string,
    remarks?: string
  ): Promise<{ success: boolean; error?: string; room?: HostelRoom; student?: Student }> {
    try {
      const res = await fetch(getApiUrl('/api/hostels/change-bed'), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, targetRoomId, targetBedNumber, remarks }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || data.error || 'Failed to change bed.' };
      }

      await this.syncHostel();
      if (data.student) {
        const sIdx = this.cache.students.findIndex((s) => s.id === studentId);
        if (sIdx !== -1) this.cache.students[sIdx] = data.student;
      }
      this.persist();
      return { success: true, room: data.room, student: data.student };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error changing bed' };
    }
  }

  // Transport Management & Bus Fleet
  getVehicles(): TransportVehicle[] {
    return this.cache.vehicles || [];
  }

  getRoutes(): TransportRoute[] {
    return this.cache.routes || [];
  }

  getTransport() {
    return { vehicles: this.cache.vehicles || [], routes: this.cache.routes || [] };
  }

  async fetchTransport(): Promise<{ vehicles: TransportVehicle[]; routes: TransportRoute[]; stats?: any }> {
    try {
      const res = await fetch(getApiUrl('/api/transport'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.vehicles)) this.cache.vehicles = data.vehicles;
        if (Array.isArray(data.routes)) this.cache.routes = data.routes;
        this.persist();
        return data;
      }
    } catch (err) {
      console.warn('[Transport] fetchTransport error:', err);
    }
    return { vehicles: this.cache.vehicles, routes: this.cache.routes };
  }

  async createVehicle(data: Partial<TransportVehicle>): Promise<TransportVehicle> {
    const res = await fetch(getApiUrl('/api/transport/vehicles'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create vehicle');
    }
    const result = await res.json();
    const created: TransportVehicle = result.vehicle || result;
    this.cache.vehicles = [created, ...(this.cache.vehicles || []).filter((v) => v.id !== created.id)];
    this.persist();
    return created;
  }

  async updateVehicle(id: string, data: Partial<TransportVehicle>): Promise<TransportVehicle> {
    const res = await fetch(getApiUrl(`/api/transport/vehicles/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update vehicle');
    }
    const result = await res.json();
    const updated: TransportVehicle = result.vehicle || result;
    this.cache.vehicles = (this.cache.vehicles || []).map((v) => (v.id === id ? updated : v));
    this.persist();
    return updated;
  }

  async deleteVehicle(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(getApiUrl(`/api/transport/vehicles/${id}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete vehicle');
    }
    this.cache.vehicles = (this.cache.vehicles || []).filter((v) => v.id !== id);
    // Unassign from routes
    (this.cache.routes || []).forEach((r) => {
      if (r.vehicleId === id) {
        r.vehicleId = '';
        r.vehicleNumber = '';
        r.vehicleRegNumber = '';
        r.driverName = '';
        r.driverPhone = '';
      }
    });
    this.persist();
    return await res.json();
  }

  async createRoute(data: Partial<TransportRoute>): Promise<TransportRoute> {
    const res = await fetch(getApiUrl('/api/transport/routes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create route');
    }
    const result = await res.json();
    const created: TransportRoute = result.route || result;
    this.cache.routes = [created, ...(this.cache.routes || []).filter((r) => r.id !== created.id)];
    this.persist();
    return created;
  }

  async updateRoute(id: string, data: Partial<TransportRoute>): Promise<TransportRoute> {
    const res = await fetch(getApiUrl(`/api/transport/routes/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update route');
    }
    const result = await res.json();
    const updated: TransportRoute = result.route || result;
    this.cache.routes = (this.cache.routes || []).map((r) => (r.id === id ? updated : r));
    this.persist();
    return updated;
  }

  async deleteRoute(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(getApiUrl(`/api/transport/routes/${id}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete route');
    }
    this.cache.routes = (this.cache.routes || []).filter((r) => r.id !== id);
    this.persist();
    return await res.json();
  }

  async addRouteStop(routeId: string, stopData: Partial<RouteStop>): Promise<{ stop: RouteStop; route: TransportRoute }> {
    const res = await fetch(getApiUrl(`/api/transport/routes/${routeId}/stops`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(stopData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add route stop');
    }
    const result = await res.json();
    if (result.route) {
      this.cache.routes = (this.cache.routes || []).map((r) => (r.id === routeId ? result.route : r));
      this.persist();
    }
    return result;
  }

  async updateRouteStop(routeId: string, stopId: string, stopData: Partial<RouteStop>): Promise<{ stop: RouteStop; route: TransportRoute }> {
    const res = await fetch(getApiUrl(`/api/transport/routes/${routeId}/stops/${stopId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(stopData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update route stop');
    }
    const result = await res.json();
    if (result.route) {
      this.cache.routes = (this.cache.routes || []).map((r) => (r.id === routeId ? result.route : r));
      this.persist();
    }
    return result;
  }

  async deleteRouteStop(routeId: string, stopId: string): Promise<{ success: boolean; route: TransportRoute }> {
    const res = await fetch(getApiUrl(`/api/transport/routes/${routeId}/stops/${stopId}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete route stop');
    }
    const result = await res.json();
    if (result.route) {
      this.cache.routes = (this.cache.routes || []).map((r) => (r.id === routeId ? result.route : r));
      this.persist();
    }
    return result;
  }

  async reorderRouteStops(routeId: string, stopIds: string[]): Promise<TransportRoute> {
    const res = await fetch(getApiUrl(`/api/transport/routes/${routeId}/stops-reorder`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ stopIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reorder route stops');
    }
    const result = await res.json();
    const updated = result.route;
    this.cache.routes = (this.cache.routes || []).map((r) => (r.id === routeId ? updated : r));
    this.persist();
    return updated;
  }

  async allocateTransport(studentId: string, routeId: string, stopName: string, stopId?: string) {
    const res = await fetch(getApiUrl('/api/transport/allocate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ studentId, routeId, stopName, stopId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to allocate transport');
    }
    const result = await res.json();
    if (result.student) {
      const idx = this.cache.students.findIndex((s) => s.id === studentId);
      if (idx !== -1) {
        this.cache.students[idx] = result.student;
      }
      this.persist();
    }
    return result;
  }

  async deallocateTransport(studentId: string) {
    const res = await fetch(getApiUrl('/api/transport/deallocate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ studentId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to deallocate transport');
    }
    const result = await res.json();
    if (result.student) {
      const idx = this.cache.students.findIndex((s) => s.id === studentId);
      if (idx !== -1) {
        this.cache.students[idx] = result.student;
      }
      this.persist();
    }
    return result;
  }

  // Communication & Notices
  getNotices(): Notice[] {
    const list = this.cache.notices || [];
    const seen = new Set<string>();
    return list.filter((n) => {
      const id = n?.id || (n as any)?._id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  publishNotice(data: Omit<Notice, 'id' | 'publishedDate' | 'publishedBy'>): Notice {
    const notice: Notice = {
      ...data,
      id: (data as any).id || `nt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      publishedDate: new Date().toISOString().substring(0, 10),
      publishedBy: this.cache.currentUser.name,
    };
    this.cache.notices = [notice, ...(this.cache.notices || []).filter((n) => n.id !== notice.id)];
    this.addAudit('NOTICE_PUBLISHED', 'Notice', notice.id, `Published notice: ${notice.title}`);
    this.persist();

    fetch(getApiUrl('/api/notices'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notice),
    }).catch(() => {});

    return notice;
  }

  // Audit Logs
  getAuditLogs(): AuditLog[] {
    return this.cache.auditLogs || [];
  }

  async getPaginatedAuditLogs(options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    entity?: string;
    action?: string;
    role?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: AuditLog[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.max(5, Math.min(100, options?.pageSize || 25));

    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('pageSize', String(pageSize));
      if (options?.search) query.set('search', options.search.trim());
      if (options?.entity && options.entity !== 'ALL') query.set('entity', options.entity);
      if (options?.action && options.action !== 'ALL') query.set('action', options.action);
      if (options?.role && options.role !== 'ALL') query.set('role', options.role);
      if (options?.dateFrom) query.set('dateFrom', options.dateFrom);
      if (options?.dateTo) query.set('dateTo', options.dateTo);
      if (options?.sortBy) query.set('sortBy', options.sortBy);
      if (options?.sortOrder) query.set('sortOrder', options.sortOrder);

      const res = await fetch(getApiUrl(`/api/audit-logs?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.pagination) {
          return {
            data: json.data || json.logs || [],
            pagination: json.pagination,
          };
        }
      }
    } catch (err) {
      console.warn('[AuditLogs] Backend paginated query error, falling back to local cache:', err);
    }

    // Local in-memory fallback
    const all = this.cache.auditLogs || [];
    let filtered = [...all];
    if (options?.entity && options.entity !== 'ALL') filtered = filtered.filter((l) => l.entity === options.entity);
    if (options?.action && options.action !== 'ALL') filtered = filtered.filter((l) => l.action === options.action);
    if (options?.role && options.role !== 'ALL') filtered = filtered.filter((l) => (l.role || (l as any).userRole) === options.role);
    if (options?.dateFrom) filtered = filtered.filter((l) => (l.timestamp || '') >= options.dateFrom!);
    if (options?.dateTo) filtered = filtered.filter((l) => (l.timestamp || '') <= options.dateTo! + ' 23:59:59');
    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (l) =>
          (l.userName || '').toLowerCase().includes(q) ||
          (l.action || '').toLowerCase().includes(q) ||
          (l.entity || '').toLowerCase().includes(q) ||
          (l.details || '').toLowerCase().includes(q) ||
          (l.ipAddress || '').toLowerCase().includes(q)
      );
    }
    const sortBy = options?.sortBy || 'timestamp';
    const sortOrder = options?.sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a: any, b: any) => {
      const valA = String(a[sortBy] || '');
      const valB = String(b[sortBy] || '');
      return sortOrder === 1 ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    const total = filtered.length;
    const skip = (page - 1) * pageSize;
    const paginated = filtered.slice(skip, skip + pageSize);
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: paginated,
      pagination: {
        total,
        page,
        pageSize,
        limit: pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // Portal & Credentials Management (Integrated Single-School Auth)
  async updateStaffPortalStatus(staffId: string, updates: { loginEnabled?: boolean; systemRole?: UserRole; accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' }) {
    const staffMember = this.cache.staff.find((s) => s.id === staffId);
    if (staffMember) {
      if (updates.loginEnabled !== undefined) staffMember.loginEnabled = updates.loginEnabled;
      if (updates.systemRole) staffMember.systemRole = updates.systemRole;
      if (updates.accountStatus) staffMember.accountStatus = updates.accountStatus;
      this.addAudit('STAFF_PORTAL_UPDATED', 'TeacherStaff', staffId, `Updated portal access for ${staffMember.name}`);
      this.persist();
    }
    try {
      await fetch(getApiUrl(`/api/teachers/${encodeURIComponent(staffId)}/portal-status`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.warn('Backend sync failed, updated local cache', e);
    }
    return staffMember;
  }

  async resetStaffPassword(staffId: string, newPassword: string) {
    const cleanId = String(staffId).trim();
    const staffMember = this.cache.staff.find(
      (s) => s.id === cleanId || (s.employeeId && cleanId && s.employeeId.toLowerCase() === cleanId.toLowerCase())
    );
    if (staffMember) {
      staffMember.loginEnabled = true;
      if (staffMember.accountStatus === 'INACTIVE') staffMember.accountStatus = 'ACTIVE';
      this.addAudit('STAFF_PASSWORD_RESET', 'TeacherStaff', staffMember.id, `Password reset by admin for ${staffMember.name}`);
      this.persist();
    }
    try {
      const res = await fetch(getApiUrl(`/api/admin/staff/${cleanId}/reset-password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      return res.ok ? body : { success: false, error: body?.error || `Could not reset the password (HTTP ${res.status}).` };
    } catch {
      return { success: false, error: 'Could not reach the school server. The password was not changed.' };
    }
  }

  async updateStudentPortalStatus(studentId: string, updates: { loginEnabled?: boolean; accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' }) {
    const student = this.cache.students.find((s) => s.id === studentId);
    if (student) {
      if (updates.loginEnabled !== undefined) student.loginEnabled = updates.loginEnabled;
      if (updates.accountStatus) student.accountStatus = updates.accountStatus;
      this.addAudit('STUDENT_PORTAL_UPDATED', 'Student', studentId, `Updated portal access for ${student.name}`);
      this.persist();
    }
    try {
      await fetch(getApiUrl(`/api/admin/students/${encodeURIComponent(studentId)}/portal-status`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.warn('Backend sync failed, updated local cache', e);
    }
    return student;
  }

  async resetStudentPassword(studentId: string, newPassword: string) {
    const student = this.cache.students.find((s) => s.id === studentId);
    if (student) {
      this.addAudit('STUDENT_PASSWORD_RESET', 'Student', studentId, `Student password reset for ${student.name}`);
      this.persist();
    }
    try {
      const res = await fetch(getApiUrl(`/api/admin/students/${encodeURIComponent(studentId)}/reset-password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ newPassword }),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Could not reach the school server. The password was not changed.' };
    }
  }

  async updateParentPortalStatus(phone: string, updates: { loginEnabled?: boolean; accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' }) {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    try {
      const res = await fetch(getApiUrl(`/api/admin/parents/${encodeURIComponent(cleanPhone || phone)}/portal-status`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updates),
      });
      const body = await res.json().catch(() => ({}));
      return res.ok ? body : { success: false, error: body?.error || `Could not update parent portal access (HTTP ${res.status}).` };
    } catch {
      return { success: false, error: 'Could not reach the school server. Parent portal access was not changed.' };
    }
  }

  async resetParentPassword(phoneOrStudentId: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const student = this.cache.students.find(
      (s) =>
        s.id === phoneOrStudentId ||
        (s.fatherMobile && phoneOrStudentId && s.fatherMobile.replace(/[^0-9]/g, '') === String(phoneOrStudentId).replace(/[^0-9]/g, '')) ||
        (s.parentPhone && phoneOrStudentId && s.parentPhone.replace(/[^0-9]/g, '') === String(phoneOrStudentId).replace(/[^0-9]/g, ''))
    );
    const rawPhone = student?.fatherMobile || student?.parentPhone || phoneOrStudentId;
    const cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
    if (student) {
      this.addAudit('PARENT_PASSWORD_RESET', 'Student', student.id, `Parent password reset for ${student.parentName || student.fatherName || 'Parent'} (${cleanPhone || rawPhone})`);
      this.persist();
    }
    try {
      const res = await fetch(getApiUrl(`/api/admin/parents/${encodeURIComponent(cleanPhone || rawPhone)}/reset-password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ newPassword }),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Could not reach the school server. The password was not changed.' };
    }
  }

  getAdminAccounts(): AdminAccount[] {
    return this.cache.adminAccounts || [];
  }

  async updateAdminAccount(id: string, updates: Partial<AdminAccount>) {
    const target = (this.cache.adminAccounts || []).find((a) => a.id === id);
    if (target) {
      Object.assign(target, updates);
      this.persist();
    }
    try {
      await fetch(getApiUrl(`/api/admin/admins/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.warn('Backend sync failed', e);
    }
    return target;
  }

  async resetAdminPassword(id: string, newPassword: string) {
    try {
      const res = await fetch(getApiUrl(`/api/admin/admins/${id}/reset-password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ newPassword }),
      });
      return await res.json();
    } catch {
      return { success: true, message: 'Admin password reset successfully.' };
    }
  }

  async adminDirectResetPassword(params: {
    targetType: 'STAFF' | 'STUDENT' | 'PARENT' | 'ADMIN';
    targetId: string;
    newPassword: string;
    sendEmail?: boolean;
    temporaryPassword?: boolean;
  }): Promise<{ success: boolean; message?: string; error?: string; emailDispatched?: boolean; recipientEmail?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/admin/reset-password-direct'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to reset password' };
      }
      if (params.targetType === 'STAFF') {
        const member = this.cache.staff.find((s) => s.id === params.targetId || (s.employeeId && params.targetId && s.employeeId.toLowerCase() === params.targetId.toLowerCase()));
        if (member) {
          member.loginEnabled = true;
          if (member.accountStatus === 'INACTIVE') member.accountStatus = 'ACTIVE';
          this.persist();
        }
      } else if (params.targetType === 'STUDENT') {
        const st = this.cache.students.find((s) => s.id === params.targetId || (s.admissionNumber && params.targetId && s.admissionNumber.toLowerCase() === params.targetId.toLowerCase()));
        if (st) {
          st.loginEnabled = true;
          if (st.accountStatus === 'INACTIVE') st.accountStatus = 'ACTIVE';
          this.persist();
        }
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  async adminSendLoginDetails(params: {
    targetType: 'STAFF' | 'STUDENT' | 'PARENT' | 'ADMIN';
    targetId: string;
    temporaryPassword?: string;
    customNote?: string;
  }): Promise<{ success: boolean; message?: string; error?: string; email?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/admin/send-login-details'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to send login details' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  async adminSendResetLink(params: {
    targetType: 'STAFF' | 'STUDENT' | 'PARENT' | 'ADMIN';
    targetId: string;
  }): Promise<{ success: boolean; message?: string; error?: string; email?: string; resetCode?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/admin/send-reset-link'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to send reset link' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  // ==========================================
  // Public Website CMS & Admissions
  // ==========================================

  async getFacilities(all = false): Promise<PublicFacility[]> {
    try {
      const res = await fetch(getApiUrl(`/api/facilities${all ? '?all=true' : ''}`));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn('[api] Failed to fetch facilities from server:', err);
    }
    return [];
  }

  async getGallery(category?: string, all = false): Promise<PublicGalleryItem[]> {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'All') params.set('category', category);
      if (all) params.set('all', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(getApiUrl(`/api/gallery${query}`));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn('[api] Failed to fetch gallery from server:', err);
    }
    return [];
  }

  async submitCallbackRequest(data: { name: string; mobile: string; message?: string; preferredTime?: string }): Promise<{
    success: boolean;
    referenceNumber?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/public/callback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: result.error || 'Could not send your request. Please call the school office.' };
      return result;
    } catch {
      return { success: false, error: 'No connection. Please check your internet or call the school office.' };
    }
  }

  async submitAdmissionEnquiry(data: Partial<AdmissionEnquiry>): Promise<{
    success: boolean;
    referenceNumber?: string;
    enquiry?: AdmissionEnquiry;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/public/enquiry'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || 'Failed to submit admission enquiry' };
      }
      return result;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while submitting enquiry' };
    }
  }

  async checkAdmissionEnquiryStatus(params: {
    referenceNumber?: string;
    mobile?: string;
  }): Promise<{ success: boolean; count?: number; enquiries?: AdmissionEnquiry[]; error?: string }> {
    try {
      const query = new URLSearchParams();
      if (params.referenceNumber) query.append('referenceNumber', params.referenceNumber);
      if (params.mobile) query.append('mobile', params.mobile);
      const res = await fetch(getApiUrl(`/api/public/enquiry/status?${query.toString()}`));
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || 'No matching admission enquiry found' };
      }
      return result;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while checking enquiry status' };
    }
  }

  async getAdmissionEnquiries(): Promise<AdmissionEnquiry[]> {
    try {
      const res = await fetch(getApiUrl('/api/enquiries'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[api] Failed to get enquiries:', err);
    }
    return [];
  }

  async updateAdmissionEnquiry(id: string, updates: Partial<AdmissionEnquiry>): Promise<AdmissionEnquiry> {
    const res = await fetch(getApiUrl(`/api/enquiries/${id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      throw new Error('Failed to update enquiry status');
    }
    return await res.json();
  }

  async deleteAdmissionEnquiry(id: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl(`/api/enquiries/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Public Website Key Statistics ---
  async getPublicStats(): Promise<{
    activeStudents: number;
    activeStaff: number;
    activeClasses: number;
    activeSubjects: number;
    activeRoutes: number;
    activeRooms: number;
    classRange: string;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/public/stats'));
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[api] Failed to get public stats:', err);
    }
    // Dynamic fallback calculated from in-memory cache directly
    const activeStudents = (this.cache.students || []).filter((s) => s.status === 'ACTIVE').length;
    const activeStaff = (this.cache.staff || []).filter((s) => s.status === 'ACTIVE').length;
    const activeClasses = (this.cache.classes || []).filter((c) => (c.status ?? 'ACTIVE') === 'ACTIVE').length;
    const activeSubjects = (this.cache.subjects || []).filter((s) => (s.status ?? 'ACTIVE') === 'ACTIVE').length;
    const sortedClasses = [...(this.cache.classes || [])].sort((a, b) => (a.numericOrder || 0) - (b.numericOrder || 0));
    const minClass = sortedClasses[0]?.name || 'Nursery';
    const maxClass = sortedClasses[sortedClasses.length - 1]?.name || 'Class 8';

    return {
      activeStudents,
      activeStaff,
      activeClasses,
      activeSubjects,
      activeRoutes: (this.cache.routes || []).length,
      activeRooms: (this.cache.hostelRooms || []).length,
      classRange: sortedClasses.length > 0 ? `${minClass}–${maxClass}` : 'Nursery–Class 8',
    };
  }

  // --- Hero Slider ---
  async getHeroSlides(all = false): Promise<PublicHeroSlide[]> {
    try {
      const res = await fetch(getApiUrl(`/api/public/hero-slides${all ? '?all=true' : ''}`));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn('[api] Failed to get hero slides:', err);
    }
    return [];
  }

  async createHeroSlide(slide: Partial<PublicHeroSlide>): Promise<PublicHeroSlide> {
    const res = await fetch(getApiUrl('/api/public/hero-slides'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(slide),
    });
    if (!res.ok) throw new Error('Failed to create hero slide');
    return await res.json();
  }

  async updateHeroSlide(id: string, updates: Partial<PublicHeroSlide>): Promise<PublicHeroSlide> {
    const res = await fetch(getApiUrl(`/api/public/hero-slides/${id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update hero slide');
    return await res.json();
  }

  async deleteHeroSlide(id: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl(`/api/public/hero-slides/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Leadership Profiles ---
  async getLeadership(all = false): Promise<PublicLeadershipProfile[]> {
    try {
      const res = await fetch(getApiUrl(`/api/public/leadership${all ? '?all=true' : ''}`));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn('[api] Failed to get leadership profiles:', err);
    }
    return [];
  }

  async getLeadershipById(id: string): Promise<PublicLeadershipProfile | null> {
    try {
      const res = await fetch(getApiUrl(`/api/public/leadership/${encodeURIComponent(id)}`));
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[api] Failed to get leadership by id:', err);
    }
    // Fallback: search in getLeadership(true)
    const list = await this.getLeadership(true);
    return list.find((item) => item.id === id) || null;
  }

  async createLeadershipProfile(profile: Partial<PublicLeadershipProfile>): Promise<PublicLeadershipProfile> {
    const res = await fetch(getApiUrl('/api/public/leadership'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error('Failed to create leadership profile');
    return await res.json();
  }

  async updateLeadershipProfile(id: string, updates: Partial<PublicLeadershipProfile>): Promise<PublicLeadershipProfile> {
    const res = await fetch(getApiUrl(`/api/public/leadership/${id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update leadership profile');
    return await res.json();
  }

  async deleteLeadershipProfile(id: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl(`/api/public/leadership/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Website Events ---
  async getWebsiteEvents(all = false): Promise<PublicWebsiteEvent[]> {
    try {
      const res = await fetch(getApiUrl(`/api/public/events${all ? '?all=true' : ''}`));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn('[api] Failed to get website events:', err);
    }
    return [];
  }

  async createWebsiteEvent(event: Partial<PublicWebsiteEvent>): Promise<PublicWebsiteEvent> {
    const res = await fetch(getApiUrl('/api/public/events'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error('Failed to create website event');
    return await res.json();
  }

  async updateWebsiteEvent(id: string, updates: Partial<PublicWebsiteEvent>): Promise<PublicWebsiteEvent> {
    const res = await fetch(getApiUrl(`/api/public/events/${id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update website event');
    return await res.json();
  }

  async deleteWebsiteEvent(id: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl(`/api/public/events/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Website Content Blocks ---
  async getWebsiteContent(): Promise<PublicWebsiteContent | null> {
    try {
      const res = await fetch(getApiUrl('/api/public/content'));
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[api] Failed to get website content:', err);
    }
    return null;
  }

  async updateWebsiteContent(content: Partial<PublicWebsiteContent>): Promise<PublicWebsiteContent> {
    const res = await fetch(getApiUrl('/api/public/content'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(content),
    });
    if (!res.ok) throw new Error('Failed to update website content');
    return await res.json();
  }

  // --- Gallery Mutations ---
  async createGalleryItem(data: Partial<PublicGalleryItem>): Promise<PublicGalleryItem> {
    const res = await fetch(getApiUrl('/api/gallery'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create gallery item');
    return await res.json();
  }

  async updateGalleryItem(id: string, updates: Partial<PublicGalleryItem>): Promise<PublicGalleryItem> {
    const res = await fetch(getApiUrl(`/api/gallery/${id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update gallery item');
    return await res.json();
  }

  async deleteGalleryItem(id: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl(`/api/gallery/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Facilities Mutations ---
  async createFacility(data: Partial<PublicFacility>): Promise<PublicFacility> {
    const res = await fetch(getApiUrl('/api/facilities'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create facility');
    return await res.json();
  }

  async updateFacility(id: string, updates: Partial<PublicFacility>): Promise<PublicFacility> {
    const res = await fetch(getApiUrl(`/api/facilities/${id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update facility');
    return await res.json();
  }

  async deleteFacility(id: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl(`/api/facilities/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Notice Management ---
  /** Reads the server's error message from a failed response. */
  private async noticeError(res: Response, fallback: string): Promise<Error> {
    const body = await res.json().catch(() => ({} as any));
    if (res.status === 401) return new Error('Your session has ended. Please sign in again.');
    if (res.status === 403) return new Error(body?.error || 'You do not have permission for this action.');
    return new Error(body?.error || body?.message || fallback);
  }

  /** Saves changes on the server first; the local list changes only after the server accepts them. */
  async updateNotice(id: string, updates: Partial<Notice>): Promise<Notice> {
    let res: Response;
    try {
      res = await fetch(getApiUrl(`/api/notices/${id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
    } catch {
      throw new Error('Could not reach the school server. Check the connection and try again.');
    }
    if (!res.ok) throw await this.noticeError(res, 'The notice could not be saved.');
    const saved: Notice = await res.json();
    const idx = (this.cache.notices || []).findIndex((n) => n.id === id);
    if (idx !== -1) {
      this.cache.notices[idx] = saved;
      this.persist();
    }
    return saved;
  }

  async deleteNotice(id: string): Promise<boolean> {
    let res: Response;
    try {
      res = await fetch(getApiUrl(`/api/notices/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch {
      throw new Error('Could not reach the school server. Check the connection and try again.');
    }
    if (!res.ok) throw await this.noticeError(res, 'The notice could not be deleted.');
    this.cache.notices = (this.cache.notices || []).filter((n) => n.id !== id);
    this.persist();
    return true;
  }

  async createLeadership(profile: Partial<PublicLeadershipProfile>): Promise<PublicLeadershipProfile> {
    return this.createLeadershipProfile(profile);
  }

  async updateLeadership(id: string, updates: Partial<PublicLeadershipProfile>): Promise<PublicLeadershipProfile> {
    return this.updateLeadershipProfile(id, updates);
  }

  async deleteLeadership(id: string): Promise<boolean> {
    return this.deleteLeadershipProfile(id);
  }

  /**
   * Creates a notice on the server. Nothing is added to the local list unless
   * the server saved it; a refusal (validation, duplicate, permission) is thrown
   * with the server's message.
   */
  async createNotice(notice: Partial<Notice> & { sendSmsBroadcast?: boolean }): Promise<Notice & { smsDispatch?: any }> {
    const body = {
      title: notice.title || '',
      content: notice.content || '',
      noticeType: notice.noticeType || notice.category || 'GENERAL',
      category: notice.category || notice.noticeType || 'GENERAL',
      targetAudience: notice.targetAudience || 'ALL',
      targetClass: notice.targetClass || '',
      targetClassId: notice.targetClassId || '',
      targetSection: notice.targetSection || '',
      targetStudentIds: Array.isArray(notice.targetStudentIds) ? notice.targetStudentIds : [],
      publishDate: notice.publishDate || notice.publishedDate || undefined,
      expiryDate: notice.expiryDate || '',
      priority: notice.priority || 'NORMAL',
      status: notice.status || 'PUBLISHED',
      isPinned: Boolean(notice.isPinned),
      isPublic: notice.isPublic !== false,
      showOnHomepage: notice.showOnHomepage !== false,
      showInTicker: Boolean(notice.showInTicker),
      attachmentUrl: notice.attachmentUrl || '',
      attachmentFileKey: notice.attachmentFileKey || '',
      attachmentName: notice.attachmentName || '',
      sendSmsBroadcast: Boolean(notice.sendSmsBroadcast),
    };
    let res: Response;
    try {
      res = await fetch(getApiUrl('/api/notices'), { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
    } catch {
      throw new Error('Could not reach the school server. The notice was not saved.');
    }
    if (!res.ok) throw await this.noticeError(res, 'The notice could not be saved.');
    const saved = await res.json();
    if (!this.cache.notices) this.cache.notices = [];
    this.cache.notices = [saved, ...this.cache.notices.filter((n) => n.id !== saved.id)];
    this.persist();
    return saved;
  }

  async fetchNotices(params?: {
    audience?: string;
    status?: string;
    category?: string;
    noticeType?: string;
    targetClass?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ notices: Notice[]; total: number; page?: number; limit?: number; totalPages?: number }> {
    try {
      const query = new URLSearchParams();
      if (params?.audience && params.audience !== 'ALL') query.set('audience', params.audience);
      if (params?.status && params.status !== 'ALL') query.set('status', params.status);
      if (params?.category && params.category !== 'ALL') query.set('category', params.category);
      if (params?.noticeType && params.noticeType !== 'ALL') query.set('noticeType', params.noticeType);
      if (params?.targetClass && params.targetClass !== 'ALL') query.set('targetClass', params.targetClass);
      if (params?.search && params.search.trim()) query.set('search', params.search.trim());
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));

      const res = await fetch(getApiUrl(`/api/notices?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return { notices: data, total: data.length };
        }
        return {
          notices: Array.isArray(data.notices) ? data.notices : [],
          total: Number(data.total) || 0,
          page: Number(data.page) || 1,
          limit: Number(data.limit) || 20,
          totalPages: Number(data.totalPages) || 1,
        };
      }
    } catch (err) {
      console.warn('[api] Failed to fetch notices:', err);
    }
    const local = this.getNotices();
    return { notices: local, total: local.length };
  }

  /** With dryRun, lists exact duplicates without removing anything. */
  async cleanupDuplicateNotices(dryRun = false): Promise<{ success: boolean; message?: string; remainingCount?: number; removed?: number; count?: number; duplicates?: { id: string; title: string; publishDate: string; keptId: string }[] }> {
    try {
      const res = await fetch(getApiUrl('/api/notices/cleanup-duplicates'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ dryRun }),
      });
      if (res.ok) {
        const result = await res.json();
        if (!dryRun) await this.syncNotices();
        return result;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to cleanup duplicates');
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to cleanup duplicate notices');
    }
  }

  // --- SMS Center API ---
  async getSmsStats(): Promise<{
    success: boolean;
    todaySent: number;
    todayFailed: number;
    totalSent: number;
    totalFailed: number;
    activeProvider: string;
    senderId: string;
    schoolName: string;
    configured?: boolean;
    loaded?: boolean;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/sms/stats'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return { ...(await res.json()), loaded: true };
      }
    } catch (e) {
      console.warn('[api] Failed to get SMS stats:', e);
    }
    return {
      success: false,
      loaded: false,
      todaySent: 0,
      todayFailed: 0,
      totalSent: 0,
      totalFailed: 0,
      activeProvider: '',
      senderId: 'CPSKSH',
      schoolName: 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE',
    };
  }

  async getSmsHistory(params?: {
    triggerType?: string;
    status?: string;
    search?: string;
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    logs: SmsLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const query = new URLSearchParams();
      if (params?.triggerType && params.triggerType !== 'ALL') query.set('triggerType', params.triggerType);
      if (params?.status && params.status !== 'ALL') query.set('status', params.status);
      if (params?.search && params.search.trim()) query.set('search', params.search.trim());
      if (params?.date) query.set('date', params.date);
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));

      const res = await fetch(getApiUrl(`/api/sms/history?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[api] Failed to get SMS history:', e);
    }
    return {
      success: false,
      logs: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    };
  }

  async getQuickTriggerPreview(params: {
    triggerType: string;
    classId?: string;
    section?: string;
    examId?: string;
  }): Promise<{
    triggerType: string;
    title: string;
    templateMessage: string;
    sampleResolvedMessage: string;
    recipientsCount: number;
    validRecipientsCount: number;
    invalidPhonesCount: number;
    alreadySentCount: number;
    recipients: any[];
  }> {
    const query = new URLSearchParams();
    query.set('triggerType', params.triggerType);
    if (params.classId && params.classId !== 'ALL') query.set('classId', params.classId);
    if (params.section && params.section !== 'ALL') query.set('section', params.section);
    if (params.examId) query.set('examId', params.examId);

    const res = await fetch(getApiUrl(`/api/sms/quick-triggers/preview?${query.toString()}`), {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch quick trigger preview');
    }
    return await res.json();
  }

  async dispatchQuickTrigger(payload: {
    triggerType: string;
    classId?: string;
    section?: string;
    examId?: string;
    customMessage?: string;
  }): Promise<{
    success: boolean;
    total: number;
    sent: number;
    failed: number;
    duplicatesSkipped: number;
    results: any[];
  }> {
    const res = await fetch(getApiUrl('/api/sms/quick-triggers/dispatch'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to dispatch trigger SMS');
    }
    return await res.json();
  }

  async sendCustomSms(payload: {
    recipients: any[];
    message: string;
    triggerType?: string;
  }): Promise<{
    success: boolean;
    total: number;
    sent: number;
    failed: number;
    duplicatesSkipped: number;
    results: any[];
  }> {
    const res = await fetch(getApiUrl('/api/sms/send'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to send custom SMS');
    }
    return await res.json();
  }

  async checkSmsDelivery(id: string): Promise<{
    success: boolean;
    status: SmsStatus;
    provider: string;
    message: string;
    log?: SmsLog;
  }> {
    const res = await fetch(getApiUrl(`/api/sms/${id}/check-delivery`), {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to check SMS delivery status');
    }
    return await res.json();
  }

  async getStudentNotices(): Promise<Notice[]> {
    try {
      const res = await fetch(getApiUrl('/api/student/notices'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.notices || []);
        if (Array.isArray(list)) {
          this.cache.notices = list;
          return list;
        }
      }
    } catch (e) {
      console.warn('[api] getStudentNotices error:', e);
    }
    const currentUser = this.getCurrentUser();
    const stuId = currentUser.studentId || currentUser.id;
    return (this.cache.notices || []).filter((n) => {
      if ((n.status || 'PUBLISHED') !== 'PUBLISHED') return false;
      const aud = String(n.targetAudience || 'ALL').toUpperCase();
      if (aud === 'ALL' || aud === 'STUDENTS' || aud === 'PUBLIC') return true;
      if (aud === 'INDIVIDUAL' && Array.isArray(n.targetStudentIds)) {
        return n.targetStudentIds.includes(stuId);
      }
      return false;
    });
  }

  async getParentNotices(): Promise<Notice[]> {
    try {
      const res = await fetch(getApiUrl('/api/parent/notices'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.notices || []);
        if (Array.isArray(list)) {
          this.cache.notices = list;
          return list;
        }
      }
    } catch (e) {
      console.warn('[api] getParentNotices error:', e);
    }
    const currentUser = this.getCurrentUser();
    const linked = currentUser.linkedStudentIds || (currentUser.studentId ? [currentUser.studentId] : []);
    return (this.cache.notices || []).filter((n) => {
      if ((n.status || 'PUBLISHED') !== 'PUBLISHED') return false;
      const aud = String(n.targetAudience || 'ALL').toUpperCase();
      if (aud === 'ALL' || aud === 'PARENTS' || aud === 'PUBLIC') return true;
      if (aud === 'INDIVIDUAL' && Array.isArray(n.targetStudentIds)) {
        return n.targetStudentIds.some((id) => linked.includes(id));
      }
      return false;
    });
  }

  async getPublicNotices(): Promise<Notice[]> {
    try {
      const res = await fetch(getApiUrl('/api/notices/public'));
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.notices || []);
        if (Array.isArray(list)) {
          return list;
        }
      }
    } catch (e) {
      console.warn('[api] getPublicNotices error:', e);
    }
    return (this.cache.notices || []).filter((n) => {
      if ((n.status || 'PUBLISHED') !== 'PUBLISHED') return false;
      if (n.isPublic === false) return false;
      const aud = String(n.targetAudience || 'ALL').toUpperCase();
      return aud === 'ALL' || aud === 'PUBLIC';
    });
  }

  // --- Media Library ---
  async getMediaLibrary(): Promise<PublicMediaItem[]> {
    try {
      const res = await fetch(getApiUrl('/api/public/media-library'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rawItems = Array.isArray(data)
          ? data
          : data && Array.isArray(data.items)
          ? data.items
          : [];

        return rawItems.map((item: any): PublicMediaItem => {
          const resolvedFileKey = String(item.fileKey || item.id || '').replace(/^\/+/, '');
          const resolvedFileName =
            item.fileName || item.name || item.originalFileName || resolvedFileKey || 'Media File';
          const resolvedContentType = item.contentType || item.mimeType || 'application/octet-stream';
          const resolvedFileSize = Number(item.fileSize ?? item.sizeBytes) || 0;
          const resolvedUrl = item.url
            ? getFileContentUrl(item.url)
            : getFileContentUrl(resolvedFileKey);

          return {
            id: item.id || resolvedFileKey,
            fileKey: resolvedFileKey,
            fileName: resolvedFileName,
            name: resolvedFileName,
            contentType: resolvedContentType,
            mimeType: resolvedContentType,
            fileSize: resolvedFileSize,
            sizeBytes: resolvedFileSize,
            url: resolvedUrl,
            folder: item.folder || 'general',
            category: item.category || 'OTHER',
            uploadedAt: item.uploadedAt || new Date().toISOString(),
            usedIn: Array.isArray(item.usedIn) ? item.usedIn : [],
          };
        });
      }
    } catch (err) {
      console.warn('[api] Failed to get media library:', err);
    }
    return [];
  }

  async getPublicMediaLibrary(): Promise<{ items: PublicMediaItem[]; totalSizeBytes: number }> {
    const items = await this.getMediaLibrary();
    const safeItems = Array.isArray(items) ? items : [];
    const totalSizeBytes = safeItems.reduce((acc, curr) => acc + (curr.fileSize || curr.sizeBytes || 0), 0);
    return { items: safeItems, totalSizeBytes };
  }

  async deleteMediaItem(fileKey: string): Promise<boolean> {
    try {
      const cleanKey = String(fileKey || '').replace(/^\/+/, '');
      const res = await fetch(getApiUrl('/api/files'), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileKey: cleanKey }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const api = new SchoolApiService();
