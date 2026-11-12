import { User, UserRole, PermissionKey, MobileModule } from '../types';

/**
 * Initial Mobile App Permitted Modules (Scope for Initial Release):
 * Only:
 * 1. Dashboard
 * 2. Timetable (My Timetable for Teachers, Students, Parents)
 * 3. Student Attendance
 * 4. Marks Entry
 * 5. Staff Attendance (Admin/Principal/Management)
 * 6. My Payroll (Self-Service)
 * 7. My ID Card (Self-Service)
 * 8. Profile
 *
 * Unrelated modules (fees, admissions, transport, hostel, library, inventory,
 * website, settings, permissions, audit-logs) are hidden for this release.
 */
export const MOBILE_MODULES: MobileModule[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Executive campus overview, today\'s schedule & quick metrics',
    iconName: '📊',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'ACCOUNTANT',
      'TEACHER',
      'HOSTEL_WARDEN',
      'TRANSPORT_MANAGER',
      'HR_STAFF',
      'PARENT',
      'STUDENT',
    ],
    color: '#0B1F4B',
    isImplementedInPhase1: true,
  },
  {
    id: 'timetable',
    title: 'Timetable',
    description: 'Weekly period schedule, subject timings & classroom matrix',
    iconName: '📅',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'STUDENT',
      'PARENT',
      'ACCOUNTANT',
      'HR_STAFF',
    ],
    permission: 'timetable.view',
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'student-attendance',
    title: 'Student Attendance',
    description: 'Classroom daily attendance register & student tracking',
    iconName: '📋',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'STUDENT',
      'PARENT',
    ],
    permission: 'attendance.view',
    color: '#16803C',
    isImplementedInPhase1: true,
  },
  {
    id: 'marks-entry',
    title: 'Marks Entry',
    description: 'Examinations, scholastic evaluation & marks submission',
    iconName: '📝',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
    ],
    permission: 'exams.view',
    color: '#D97706',
    isImplementedInPhase1: true,
  },
  {
    id: 'staff-attendance',
    title: 'Staff Attendance',
    description: 'Faculty & staff presence tracking and administrative register',
    iconName: '👥',
    // Only the Super Admin and the Principal mark staff attendance (server enforces the same).
    roles: ['SUPER_ADMIN', 'PRINCIPAL'],
    permission: 'staff.manage',
    color: '#7C3AED',
    isImplementedInPhase1: true,
  },
  {
    id: 'my-payroll',
    title: 'My Payroll',
    description: 'Personal monthly salary slips, deductions & payment history',
    iconName: '💵',
    roles: [
      'TEACHER',
      'ACCOUNTANT',
      'HOSTEL_WARDEN',
      'TRANSPORT_MANAGER',
      'HR_STAFF',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
    ],
    color: '#0D9488',
    isImplementedInPhase1: true,
  },
  {
    id: 'my-id-card',
    title: 'My ID Card',
    description: 'Official verified digital staff identity card with QR code',
    iconName: '🪪',
    roles: [
      'TEACHER',
      'ACCOUNTANT',
      'HOSTEL_WARDEN',
      'TRANSPORT_MANAGER',
      'HR_STAFF',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
    ],
    color: '#D9A441',
    isImplementedInPhase1: true,
  },
  {
    id: 'profile',
    title: 'My Profile',
    description: 'Institutional credentials, designations & security settings',
    iconName: '👤',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'ACCOUNTANT',
      'TEACHER',
      'HOSTEL_WARDEN',
      'TRANSPORT_MANAGER',
      'HR_STAFF',
      'PARENT',
      'STUDENT',
    ],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'my-classes',
    title: 'My Classes',
    description: 'Classes you are assigned to and classes you are qualified to teach',
    iconName: '🏫',
    roles: ['TEACHER'],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'students',
    title: 'My Students',
    description: 'Classroom student rosters, details & enrollment status',
    iconName: '👥',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
    ],
    permission: 'students.view',
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'staff',
    title: 'Staff',
    description: 'Staff directory, profiles, leave, payroll and ID cards',
    iconName: '👥',
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HR_STAFF'],
    permission: 'staff.manage',
    color: '#7C3AED',
    isImplementedInPhase1: true,
  },
  {
    id: 'homework',
    title: 'Homework',
    description: 'Create, edit and view homework by class, section and subject',
    iconName: '📚',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'STUDENT',
    ],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {

    id: 'assignments',
    title: 'Assignment',
    description: 'Daily coursework, tasks, submissions & homework register',
    iconName: '📚',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'STUDENT',
      'PARENT',
    ],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'exam-schedule',
    title: 'Exam Schedule',
    description: 'Examination dates, session schedules & room allotments',
    iconName: '🗓️',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'STUDENT',
      'PARENT',
    ],
    permission: 'exams.view',
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'report-card',
    title: 'Report Card',
    description: 'Marksheets, subject scores & exam results',
    iconName: '📊',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'STUDENT',
      'PARENT',
    ],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'communication',
    title: 'Communication',
    description: 'Official campus circulars, notifications & announcements',
    iconName: '📢',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'ACCOUNTANT',
      'TEACHER',
      'HOSTEL_WARDEN',
      'TRANSPORT_MANAGER',
      'HR_STAFF',
      'PARENT',
      'STUDENT',
    ],
    permission: 'communication.view',
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'messages',
    title: 'Messages',
    description: 'Chat with parents and send fee reminders',
    iconName: '💬',
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ACCOUNTANT', 'TEACHER'],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Students, fees, attendance, staff and exam reports',
    iconName: '📊',
    // Same roles the server allows (server.ts REPORT_ROLES); fee and salary data are filtered there.
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ACCOUNTANT', 'HR_STAFF'],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'enquiries',
    title: 'Enquiries',
    description: 'Admission enquiries and quick call requests from the website',
    iconName: '📞',
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'leave-requests',
    title: 'Leave Requests',
    description: 'Approve staff & student leave, or add leave for anyone',
    iconName: '🗓️',
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HR_STAFF'],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
  {
    id: 'live-events',
    title: 'Live Events',
    description: 'School ceremonies, sports meets, live events & annual functions',
    iconName: '🎟️',
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'ACCOUNTANT',
      'TEACHER',
      'HOSTEL_WARDEN',
      'TRANSPORT_MANAGER',
      'HR_STAFF',
      'PARENT',
      'STUDENT',
    ],
    color: '#123B8C',
    isImplementedInPhase1: true,
  },
];

/**
 * Checks if a user has a specific permission key.
 */
export function hasUserPermission(user: User, permission: PermissionKey): boolean {
  if (user.role === 'SUPER_ADMIN') return true;

  // Check explicit denied permissions
  if (user.deniedPermissions && user.deniedPermissions.includes(permission)) {
    return false;
  }

  // Check custom granted permissions
  if (user.customPermissions && user.customPermissions.includes(permission)) {
    return true;
  }

  // Check backend provided permissions array
  if (user.permissions && user.permissions.includes(permission)) {
    return true;
  }

  // Default role-inherent permissions for initial modules
  if (permission === 'timetable.view') {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT'].includes(user.role);
  }

  if (permission === 'attendance.view') {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT'].includes(user.role);
  }

  if (permission === 'exams.view') {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT'].includes(user.role);
  }

  if (permission === 'staff.manage') {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HR_STAFF'].includes(user.role);
  }

  if (permission === 'payroll.view') {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'HR_STAFF', 'TEACHER', 'HOSTEL_WARDEN', 'TRANSPORT_MANAGER'].includes(user.role);
  }

  if (permission === 'students.view') {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'TEACHER'].includes(user.role);
  }

  if (permission === 'communication.view') {
    return true;
  }

  return false;
}

/**
 * Returns strictly the authorized modules for a given user role & permissions.
 */
/** For staff these live in My Profile (top-bar profile menu), not in the drawer or the home grid. */
export const TEACHER_PROFILE_MENU_MODULE_IDS = ['profile', 'my-payroll', 'my-id-card'];

/** Modules shown in the navigation drawer. */
export function getDrawerModulesForUser(user: User): MobileModule[] {
  const modules = getAuthorizedModulesForUser(user);
  return user.role !== 'STUDENT' && user.role !== 'PARENT' ? modules.filter((m) => !TEACHER_PROFILE_MENU_MODULE_IDS.includes(m.id)) : modules;
}

export function getAuthorizedModulesForUser(user: User): MobileModule[] {
  return MOBILE_MODULES.filter((module) => {
    // 1. Must be listed in permitted roles for the module
    if (!module.roles.includes(user.role)) return false;

    // 2. Specific role scoping rules for initial release:
    // Teachers do NOT have access to administrative staff attendance
    if (module.id === 'staff-attendance' && user.role === 'TEACHER') {
      return false;
    }

    // Assignment module is removed from mobile sidebar and navigation per specification
    if (module.id === 'assignments') {
      return false;
    }


    // Students and Parents do NOT have access to staff payroll or staff ID cards
    if ((module.id === 'my-payroll' || module.id === 'my-id-card') && (user.role === 'STUDENT' || user.role === 'PARENT')) {
      return false;
    }


    // Marks entry is only for Teachers and Academic Administrators
    if (module.id === 'marks-entry' && (user.role === 'STUDENT' || user.role === 'PARENT' || user.role === 'HOSTEL_WARDEN' || user.role === 'TRANSPORT_MANAGER')) {
      return false;
    }

    // Staff Attendance: only the Super Admin and the Principal mark it.
    if (module.id === 'staff-attendance') {
      return ['SUPER_ADMIN', 'PRINCIPAL'].includes(user.role);
    }

    // If permission key is specified, check against user's actual permissions
    if (module.permission && !hasUserPermission(user, module.permission)) {
      return false;
    }

    return true;
  });
}

/**
 * Returns role-appropriate dynamic titles for modules
 */
export function getModuleTitleForUser(module: MobileModule, user: User): string {
  if (module.id === 'timetable') {
    if (user.role === 'TEACHER' || user.role === 'STUDENT' || user.role === 'PARENT') {
      return 'My Timetable';
    }
    return 'School Timetable';
  }
  if (module.id === 'student-attendance') {
    if (user.role === 'STUDENT' || user.role === 'PARENT') {
      return 'Attendance Record';
    }
    return 'Student Attendance';
  }
  if (module.id === 'students' && user.role !== 'TEACHER') {
    return 'Students';
  }
  if (module.id === 'report-card' || module.id === 'academic-performance') {
    return 'Report Card';
  }
  return module.title;
}

/**
 * Human-readable role label
 */
export function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Administrator';
    case 'SCHOOL_ADMIN':
      return 'School Administrator';
    case 'PRINCIPAL':
      return 'Principal';
    case 'VICE_PRINCIPAL':
      return 'Vice Principal';
    case 'ACADEMIC_COORDINATOR':
      return 'Academic Coordinator';
    case 'ACCOUNTANT':
      return 'Accountant';
    case 'TEACHER':
      return 'Faculty / Teacher';
    case 'HOSTEL_WARDEN':
      return 'Hostel Warden';
    case 'TRANSPORT_MANAGER':
      return 'Transport Manager';
    case 'HR_STAFF':
      return 'HR Staff';
    case 'PARENT':
      return 'Parent / Guardian';
    case 'STUDENT':
      return 'Student';
    default:
      return role;
  }
}

/**
 * Returns strictly the authorized modules for the 3-column "Do More" grid,
 * matching the exact role-based specification from the design instructions:
 * 
 * - Teacher: Profile, Timetable, Student Attendance, Marks Entry / Academic Performance, Exam Schedule, ID Card, My Students.
 * - Admin / Principal: Profile, Timetable, Teacher Attendance, Student Attendance, Marks Entry, Exam Schedule, Staff Payroll (where authorized), ID Card, My Students.
 * - Staff: Profile, Timetable (if assigned), personal payroll/salary slip (where authorized), personal ID Card preview/download.
 */
export function getDoMoreGridModules(user: User): MobileModule[] {
  const isTeacher = user.role === 'TEACHER';
  const isAdmin = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR'].includes(user.role);
  const isStudent = user.role === 'STUDENT';
  const isParent = user.role === 'PARENT';

  let targetIds: string[] = [];

  if (isTeacher) {
    // Teacher grid (Assignment module intentionally removed)

    // Profile, payroll and ID card are in the top-bar profile menu, so the grid keeps the work modules only.
    targetIds = [
      'timetable',
      'student-attendance',
      'marks-entry',
      'homework',
      'report-card',
      'exam-schedule',
      'students',
    ];
  } else if (isAdmin) {
    // Exactly 9 modules: clean 3x3 grid
    targetIds = [
      // Profile, payroll and ID card live under My Profile, so the grid keeps the work modules only.
      'students',
      'staff',
      'timetable',
      'staff-attendance',
      'student-attendance',
      'marks-entry',
      'homework',
      'report-card',
      'reports',
    ];
  } else if (isStudent) {
    targetIds = [
      'profile',
      'timetable',
      'student-attendance',
      'homework',
      'academic-performance',

      'report-card',
      'notices',
      'exam-schedule',
      'my-id-card',
    ];
  } else if (isParent) {
    targetIds = [
      'profile',
      'timetable',
      'student-attendance',
      'report-card',
      'exam-schedule',
      'my-id-card',
      'students',
    ];
  } else {
    // Non-teaching Staff (e.g. ACCOUNTANT, HR_STAFF, HOSTEL_WARDEN, TRANSPORT_MANAGER)
    targetIds = [
      'profile',
      'timetable',
    ];
    if (user.role === 'HR_STAFF' || hasUserPermission(user, 'staff.manage')) {
      targetIds.push('staff-attendance');
      targetIds.push('staff');
    }
    if (user.role === 'ACCOUNTANT' || user.role === 'HR_STAFF') targetIds.push('reports');
    targetIds.push('my-payroll');
    targetIds.push('my-id-card');
  }

  // Map to full module objects, verifying permission
  const result: MobileModule[] = [];
  for (const id of targetIds) {
    const targetModuleId = id === 'academic-performance' ? 'report-card' : id;
    const mod = MOBILE_MODULES.find((m) => m.id === targetModuleId);
    if (!mod) continue;

    // Verify user authorization for module
    if (mod.roles && !mod.roles.includes(user.role)) continue;
    if (mod.permission && !hasUserPermission(user, mod.permission)) continue;

    result.push(mod);
  }

  return result;
}

