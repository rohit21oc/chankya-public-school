import { UserRole } from '../types';

export type PermissionKey =
  // Students & Admissions
  | 'students.view'
  | 'students.create'
  | 'students.edit'
  | 'students.delete'
  | 'students.admit'
  // Attendance
  | 'attendance.view'
  | 'attendance.mark'
  | 'attendance.edit'
  | 'attendance.approve'
  // Exams & Grading
  | 'exams.view'
  | 'exams.create'
  | 'exams.edit'
  | 'exams.marks.enter'
  | 'exams.marks.edit'
  | 'results.publish'
  // Fees & Accounts
  | 'fees.view'
  | 'fees.structure.manage'
  | 'fees.collect'
  | 'fees.refund'
  | 'fees.waive'
  | 'fees.export'
  // Staff & HR
  | 'staff.view'
  | 'staff.manage'
  | 'hr.manage'
  | 'payroll.view'
  | 'payroll.manage'
  // Academics & Timetable
  | 'academics.view'
  | 'academics.manage'
  | 'timetable.view'
  | 'timetable.manage'
  // Hostel
  | 'hostel.view'
  | 'hostel.manage'
  // Transport
  | 'transport.view'
  | 'transport.manage'
  // Communication
  | 'communication.view'
  | 'communication.manage'
  | 'notices.publish'
  | 'sms.send'
  // Documents
  | 'documents.view'
  | 'documents.generate'
  // Reports
  | 'reports.view'
  | 'reports.export'
  // Website CMS
  | 'website.view'
  | 'website.manage'
  // Users & RBAC
  | 'users.view'
  | 'users.create'
  | 'users.manage'
  | 'roles.manage'
  | 'permissions.manage'
  // Settings
  | 'settings.view'
  | 'settings.manage'
  // Audit Logs
  | 'audit_logs.view';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  module: string;
  isSensitive?: boolean;
}

export interface PermissionModuleGroup {
  moduleId: string;
  moduleName: string;
  description: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_MODULE_GROUPS: PermissionModuleGroup[] = [
  {
    moduleId: 'students',
    moduleName: 'Students & Admissions',
    description: 'Student profiles, admission applications, directory, and enrollments',
    permissions: [
      {
        key: 'students.view',
        label: 'View Students',
        description: 'View student directory, enrolled profiles, and admission details',
        module: 'students',
      },
      {
        key: 'students.create',
        label: 'Create Students',
        description: 'Add new student records to the system directory',
        module: 'students',
      },
      {
        key: 'students.edit',
        label: 'Edit Students',
        description: 'Modify student biodata, guardians, address, and academic details',
        module: 'students',
      },
      {
        key: 'students.delete',
        label: 'Delete Students',
        description: 'Delete or archive student records (sensitive)',
        module: 'students',
        isSensitive: true,
      },
      {
        key: 'students.admit',
        label: 'Process Admissions',
        description: 'Submit and complete formal admission intake workflow',
        module: 'students',
      },
    ],
  },
  {
    moduleId: 'attendance',
    moduleName: 'Attendance Management',
    description: 'Student daily classroom attendance and staff attendance tracking',
    permissions: [
      {
        key: 'attendance.view',
        label: 'View Attendance',
        description: 'View daily attendance registers, calendars, and monthly sheets',
        module: 'attendance',
      },
      {
        key: 'attendance.mark',
        label: 'Mark Attendance',
        description: 'Take daily attendance roster for classes or staff',
        module: 'attendance',
      },
      {
        key: 'attendance.edit',
        label: 'Edit Attendance',
        description: 'Modify previously marked attendance records',
        module: 'attendance',
      },
      {
        key: 'attendance.approve',
        label: 'Approve Leaves',
        description: 'Approve or reject leave applications and attendance regularization',
        module: 'attendance',
      },
    ],
  },
  {
    moduleId: 'exams',
    moduleName: 'Examinations & Results',
    description: 'Exam scheduling, paper marks entry, grade calculation, and result publication',
    permissions: [
      {
        key: 'exams.view',
        label: 'View Exams',
        description: 'View examination lists, timetables, and mark entries',
        module: 'exams',
      },
      {
        key: 'exams.create',
        label: 'Create Exams',
        description: 'Create new assessment terms, scheduled dates, and exam papers',
        module: 'exams',
      },
      {
        key: 'exams.edit',
        label: 'Edit Exams',
        description: 'Edit exam details and schedule timings',
        module: 'exams',
      },
      {
        key: 'exams.marks.enter',
        label: 'Enter Marks',
        description: 'Input subject marks for students in scheduled exams',
        module: 'exams',
      },
      {
        key: 'exams.marks.edit',
        label: 'Edit Marks',
        description: 'Modify previously submitted exam scores and grades',
        module: 'exams',
        isSensitive: true,
      },
      {
        key: 'results.publish',
        label: 'Publish Results',
        description: 'Formally publish exam results and authorize official report cards',
        module: 'exams',
        isSensitive: true,
      },
    ],
  },
  {
    moduleId: 'fees',
    moduleName: 'Fees & Accounts',
    description: 'Fee structures, collection counters, invoices, waivers, and financial reports',
    permissions: [
      {
        key: 'fees.view',
        label: 'View Fees',
        description: 'View fee structures, ledgers, transaction records, and outstanding balances',
        module: 'fees',
      },
      {
        key: 'fees.structure.manage',
        label: 'Manage Fee Structures',
        description: 'Create and update class fee heads, amounts, and frequency configs',
        module: 'fees',
      },
      {
        key: 'fees.collect',
        label: 'Collect Payments',
        description: 'Accept counter payments (Cash/UPI/Bank) and issue official receipts',
        module: 'fees',
      },
      {
        key: 'fees.refund',
        label: 'Process Refunds',
        description: 'Issue fee refunds and reversals (sensitive audit required)',
        module: 'fees',
        isSensitive: true,
      },
      {
        key: 'fees.waive',
        label: 'Grant Waivers & Concessions',
        description: 'Waive fees or grant financial concessions (sensitive audit required)',
        module: 'fees',
        isSensitive: true,
      },
      {
        key: 'fees.export',
        label: 'Export Financial Data',
        description: 'Download financial statements, collection summaries, and tax ledgers',
        module: 'fees',
      },
    ],
  },
  {
    moduleId: 'staff',
    moduleName: 'Staff & Human Resources',
    description: 'Staff directory, designations, employee documents, leaves, and payroll',
    permissions: [
      {
        key: 'staff.view',
        label: 'View Staff',
        description: 'View staff directory, employee profiles, and designations',
        module: 'staff',
      },
      {
        key: 'staff.manage',
        label: 'Manage Staff',
        description: 'Onboard, edit employee profiles, and configure portal access',
        module: 'staff',
      },
      {
        key: 'hr.manage',
        label: 'Manage HR Workflows',
        description: 'Manage staff documents, certifications, and HR leaves',
        module: 'staff',
      },
      {
        key: 'payroll.view',
        label: 'View Payroll',
        description: 'View staff salaries, pay structures, and payroll history (confidential)',
        module: 'staff',
        isSensitive: true,
      },
      {
        key: 'payroll.manage',
        label: 'Manage Payroll',
        description: 'Calculate, process, approve, and disburse staff salaries (confidential)',
        module: 'staff',
        isSensitive: true,
      },
    ],
  },
  {
    moduleId: 'academics',
    moduleName: 'Academics & Timetables',
    description: 'Classes, sections, subjects, sessions, and master schedule matrix',
    permissions: [
      {
        key: 'academics.view',
        label: 'View Academics',
        description: 'View sessions, classes, sections, and subjects curriculum',
        module: 'academics',
      },
      {
        key: 'academics.manage',
        label: 'Manage Academics',
        description: 'Create and update academic sessions, classes, sections, and subjects',
        module: 'academics',
      },
      {
        key: 'timetable.view',
        label: 'View Timetable',
        description: 'View weekly schedules, class periods, and teacher timetables',
        module: 'academics',
      },
      {
        key: 'timetable.manage',
        label: 'Manage Timetable',
        description: 'Configure daily periods and build conflict-free timetable grids',
        module: 'academics',
      },
    ],
  },
  {
    moduleId: 'hostel',
    moduleName: 'Hostel Management',
    description: 'Hostel buildings, room allocations, beds, and residential facilities',
    permissions: [
      {
        key: 'hostel.view',
        label: 'View Hostel',
        description: 'View hostel rooms, capacity, and student allocations',
        module: 'hostel',
      },
      {
        key: 'hostel.manage',
        label: 'Manage Hostel',
        description: 'Create rooms, configure beds, and assign student allocations',
        module: 'hostel',
      },
    ],
  },
  {
    moduleId: 'transport',
    moduleName: 'Transport Management',
    description: 'Vehicles, drivers, routes, stops, and transport distance slabs',
    permissions: [
      {
        key: 'transport.view',
        label: 'View Transport',
        description: 'View transport routes, vehicles, driver assignments, and stops',
        module: 'transport',
      },
      {
        key: 'transport.manage',
        label: 'Manage Transport',
        description: 'Add vehicles, map routes, set fee slabs, and assign passenger routes',
        module: 'transport',
      },
    ],
  },
  {
    moduleId: 'communication',
    moduleName: 'Communication & Notices',
    description: 'Official notice board, circular announcements, SMS broadcasts, and logs',
    permissions: [
      {
        key: 'communication.view',
        label: 'View Notices & SMS',
        description: 'View circulars, school notices, and SMS transmission logs',
        module: 'communication',
      },
      {
        key: 'communication.manage',
        label: 'Manage Communication',
        description: 'Configure communication templates and target audience groups',
        module: 'communication',
      },
      {
        key: 'notices.publish',
        label: 'Publish Notices',
        description: 'Broadcast urgent circulars and notices to parents, students, or staff',
        module: 'communication',
      },
      {
        key: 'sms.send',
        label: 'Send SMS Alerts',
        description: 'Dispatch instant SMS notifications to student guardians',
        module: 'communication',
      },
    ],
  },
  {
    moduleId: 'documents',
    moduleName: 'Official Documents & Cards',
    description: 'Student ID cards, admit cards, transfer and character certificates',
    permissions: [
      {
        key: 'documents.view',
        label: 'View Documents',
        description: 'Access document templates, admit cards, and student certificates',
        module: 'documents',
      },
      {
        key: 'documents.generate',
        label: 'Generate & Print Documents',
        description: 'Issue official student ID cards, transfer certificates, and admit cards',
        module: 'documents',
      },
    ],
  },
  {
    moduleId: 'reports',
    moduleName: 'Reports & Analytics',
    description: 'Institutional analytics, class performance, and exportable ledgers',
    permissions: [
      {
        key: 'reports.view',
        label: 'View Reports',
        description: 'View dashboards, attendance percentages, and academic trends',
        module: 'reports',
      },
      {
        key: 'reports.export',
        label: 'Export Reports',
        description: 'Download PDF / CSV report summaries and statistical tabulations',
        module: 'reports',
      },
    ],
  },
  {
    moduleId: 'website',
    moduleName: 'Public Website CMS',
    description: 'Public landing page, hero sliders, facilities, gallery, and leadership',
    permissions: [
      {
        key: 'website.view',
        label: 'View Website CMS',
        description: 'Preview landing page sections, hero banners, and enquiries',
        module: 'website',
      },
      {
        key: 'website.manage',
        label: 'Manage Website CMS',
        description: 'Publish updates to public website slides, gallery, and leadership profiles',
        module: 'website',
      },
    ],
  },
  {
    moduleId: 'users',
    moduleName: 'User & Role Administration',
    description: 'User accounts, role assignments, and granular RBAC permissions matrix',
    permissions: [
      {
        key: 'users.view',
        label: 'View Users',
        description: 'View user accounts, login status, and account directory',
        module: 'users',
      },
      {
        key: 'users.create',
        label: 'Create Users',
        description: 'Create new user credentials and portal accounts',
        module: 'users',
      },
      {
        key: 'users.manage',
        label: 'Manage Users',
        description: 'Suspend, activate, reset passwords, or delete user accounts',
        module: 'users',
        isSensitive: true,
      },
      {
        key: 'roles.manage',
        label: 'Manage Roles',
        description: 'Assign or reassign user system roles (requires administrative authority)',
        module: 'users',
        isSensitive: true,
      },
      {
        key: 'permissions.manage',
        label: 'Manage Permissions',
        description: 'Configure and grant granular module/action permission overrides',
        module: 'users',
        isSensitive: true,
      },
    ],
  },
  {
    moduleId: 'settings',
    moduleName: 'School Settings',
    description: 'Institutional metadata, affiliation, principal signature, and payment setup',
    permissions: [
      {
        key: 'settings.view',
        label: 'View School Settings',
        description: 'View school affiliation details, contact data, and timing configs',
        module: 'settings',
      },
      {
        key: 'settings.manage',
        label: 'Manage School Settings',
        description: 'Update CBSE affiliation, bank details, UPI QR code, and signatures (sensitive)',
        module: 'settings',
        isSensitive: true,
      },
    ],
  },
  {
    moduleId: 'audit_logs',
    moduleName: 'Security Audit Logs',
    description: 'Immutable operational history, administrative actions, and security audit trail',
    permissions: [
      {
        key: 'audit_logs.view',
        label: 'View Audit Logs',
        description: 'Inspect security audit trail, administrative actions, and change logs',
        module: 'audit_logs',
        isSensitive: true,
      },
    ],
  },
];

// Flat list of all registered permission keys
export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_MODULE_GROUPS.flatMap(
  (g) => g.permissions.map((p) => p.key)
);

// Map of permissions by key
export const PERMISSIONS_BY_KEY: Record<string, PermissionDefinition> = {};
PERMISSION_MODULE_GROUPS.forEach((group) => {
  group.permissions.forEach((perm) => {
    PERMISSIONS_BY_KEY[perm.key] = perm;
  });
});

// Role hierarchy rank for authorization and delegation safeguards
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  SCHOOL_ADMIN: 80,
  PRINCIPAL: 75,
  VICE_PRINCIPAL: 70,
  ACADEMIC_COORDINATOR: 60,
  ACCOUNTANT: 50,
  HR_STAFF: 50,
  HOSTEL_WARDEN: 40,
  TRANSPORT_MANAGER: 40,
  TEACHER: 30,
  SUPPORT_STAFF: 5,
  STUDENT: 10,
  PARENT: 10,
};

// Human-readable labels for all 12 supported roles
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Administrator',
  SCHOOL_ADMIN: 'School Administrator',
  PRINCIPAL: 'Principal',
  VICE_PRINCIPAL: 'Vice Principal',
  ACADEMIC_COORDINATOR: 'Academic Coordinator',
  TEACHER: 'Teacher / Faculty',
  ACCOUNTANT: 'Accountant',
  HR_STAFF: 'HR Staff',
  HOSTEL_WARDEN: 'Hostel Warden',
  TRANSPORT_MANAGER: 'Transport Manager',
  SUPPORT_STAFF: 'Support Staff',
  STUDENT: 'Student',
  PARENT: 'Parent / Guardian',
};

// Default authoritative permissions for each of the 12 supported roles
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  SUPER_ADMIN: [...ALL_PERMISSION_KEYS],

  SCHOOL_ADMIN: [
    'students.view',
    'students.create',
    'students.edit',
    'students.delete',
    'students.admit',
    'attendance.view',
    'attendance.mark',
    'attendance.edit',
    'attendance.approve',
    'exams.view',
    'exams.create',
    'exams.edit',
    'exams.marks.enter',
    'exams.marks.edit',
    'results.publish',
    'fees.view',
    'fees.structure.manage',
    'fees.collect',
    'fees.export',
    'staff.view',
    'staff.manage',
    'payroll.view',
    'payroll.manage',
    'hr.manage',
    'academics.view',
    'academics.manage',
    'timetable.view',
    'timetable.manage',
    'hostel.view',
    'hostel.manage',
    'transport.view',
    'transport.manage',
    'communication.view',
    'communication.manage',
    'notices.publish',
    'sms.send',
    'documents.view',
    'documents.generate',
    'reports.view',
    'reports.export',
    'website.view',
    'website.manage',
    'users.view',
    'settings.view',
    'audit_logs.view',
  ],

  PRINCIPAL: [
    'students.view',
    'students.create',
    'students.edit',
    'students.admit',
    'attendance.view',
    'attendance.mark',
    'attendance.edit',
    'attendance.approve',
    'exams.view',
    'exams.create',
    'exams.edit',
    'exams.marks.enter',
    'exams.marks.edit',
    'results.publish',
    'fees.view',
    'fees.export',
    'staff.view',
    'staff.manage',
    'payroll.view',
    'payroll.manage',
    'hr.manage',
    'academics.view',
    'academics.manage',
    'timetable.view',
    'timetable.manage',
    'hostel.view',
    'transport.view',
    'communication.view',
    'communication.manage',
    'notices.publish',
    'documents.view',
    'documents.generate',
    'reports.view',
    'reports.export',
    'website.view',
    'website.manage',
    'settings.view',
    'audit_logs.view',
  ],

  VICE_PRINCIPAL: [
    'students.view',
    'students.edit',
    'attendance.view',
    'attendance.mark',
    'attendance.edit',
    'attendance.approve',
    'exams.view',
    'exams.marks.enter',
    'exams.marks.edit',
    'staff.view',
    'academics.view',
    'timetable.view',
    'timetable.manage',
    'communication.view',
    'communication.manage',
    'notices.publish',
    'documents.view',
    'documents.generate',
    'reports.view',
  ],

  ACADEMIC_COORDINATOR: [
    'students.view',
    'attendance.view',
    'exams.view',
    'exams.create',
    'exams.edit',
    'exams.marks.enter',
    'exams.marks.edit',
    'academics.view',
    'academics.manage',
    'timetable.view',
    'timetable.manage',
    'communication.view',
    'notices.publish',
    'documents.view',
    'documents.generate',
    'reports.view',
  ],

  TEACHER: [
    'students.view',
    'attendance.view',
    'attendance.mark',
    'attendance.edit',
    'exams.view',
    'exams.marks.enter',
    'exams.marks.edit',
    'academics.view',
    'timetable.view',
    'communication.view',
    'documents.view',
    'reports.view',
  ],

  ACCOUNTANT: [
    'students.view',
    'fees.view',
    'fees.structure.manage',
    'fees.collect',
    'fees.export',
    'payroll.view',
    'payroll.manage',
    'reports.view',
    'reports.export',
    'documents.view',
  ],

  HR_STAFF: [
    'staff.view',
    'staff.manage',
    'payroll.view',
    'payroll.manage',
    'hr.manage',
    'attendance.view',
    'reports.view',
  ],

  HOSTEL_WARDEN: [
    'hostel.view',
    'hostel.manage',
    'students.view',
    'communication.view',
  ],

  TRANSPORT_MANAGER: [
    'transport.view',
    'transport.manage',
    'students.view',
    'communication.view',
  ],

  // No app login: an employee/attendance record only.
  SUPPORT_STAFF: [],

  STUDENT: [
    'students.view',
    'attendance.view',
    'exams.view',
    'timetable.view',
    'fees.view',
    'communication.view',
    'documents.view',
  ],

  PARENT: [
    'students.view',
    'attendance.view',
    'exams.view',
    'timetable.view',
    'fees.view',
    'communication.view',
    'documents.view',
  ],
};

/**
 * Calculates effective permissions for a user given their role,
 * custom granted permissions, and explicitly denied permissions.
 */
export function getEffectivePermissions(
  role: UserRole,
  customPermissions: string[] = [],
  deniedPermissions: string[] = [],
  roleOverrides?: Record<UserRole, PermissionKey[]>
): string[] {
  if (role === 'SUPER_ADMIN') {
    return [...ALL_PERMISSION_KEYS];
  }

  const roleBase = roleOverrides?.[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
  const set = new Set<string>(roleBase);

  // Add custom grants
  if (Array.isArray(customPermissions)) {
    customPermissions.forEach((p) => {
      if (p) set.add(p);
    });
  }

  // Remove explicit denies
  if (Array.isArray(deniedPermissions)) {
    deniedPermissions.forEach((p) => {
      set.delete(p);
    });
  }

  return Array.from(set);
}

/**
 * Checks if a user has a specific permission.
 */
export function hasPermission(
  user: { role: UserRole; permissions?: string[] } | null | undefined,
  permission: PermissionKey | string
): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  // Use effective permissions array if attached
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    if (user.permissions.includes('*')) return true;
    if (user.permissions.includes(permission)) return true;

    // Check wildcard match e.g. "students.*"
    const [mod] = permission.split('.');
    if (mod && user.permissions.includes(`${mod}.*`)) return true;

    return false;
  }

  // Fallback to role default
  const defaultList = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  return defaultList.includes(permission as PermissionKey);
}

/**
 * Checks if a user has ANY of the specified permissions.
 */
export function hasAnyPermission(
  user: { role: UserRole; permissions?: string[] } | null | undefined,
  permissions: (PermissionKey | string)[]
): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return permissions.some((p) => hasPermission(user, p));
}

/**
 * Checks if a user has ALL of the specified permissions.
 */
export function hasAllPermissions(
  user: { role: UserRole; permissions?: string[] } | null | undefined,
  permissions: (PermissionKey | string)[]
): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return permissions.every((p) => hasPermission(user, p));
}

/**
 * Validates whether the acting user has authority to assign or change a target role.
 */
export function canAssignRole(
  actorRole: UserRole,
  targetRoleToAssign: UserRole,
  isSelf = false
): { allowed: boolean; reason?: string } {
  if (isSelf) {
    return { allowed: false, reason: 'Users cannot change or elevate their own role' };
  }

  if (actorRole === 'SUPER_ADMIN') {
    return { allowed: true };
  }

  const actorRank = ROLE_HIERARCHY[actorRole] || 0;
  const targetRank = ROLE_HIERARCHY[targetRoleToAssign] || 0;

  if (targetRank >= actorRank) {
    return {
      allowed: false,
      reason: `You cannot assign the role ${ROLE_LABELS[targetRoleToAssign]} (rank ${targetRank}) because it is equal to or higher than your current rank (${actorRank})`,
    };
  }

  return { allowed: true };
}

/**
 * Validates whether the acting user has authority to manage a target user.
 */
export function canManageUserAccount(
  actorRole: UserRole,
  targetUserRole: UserRole,
  isSelf = false
): { allowed: boolean; reason?: string } {
  if (actorRole === 'SUPER_ADMIN') {
    return { allowed: true };
  }

  if (isSelf) {
    return { allowed: false, reason: 'You cannot manage your own role or permission configuration' };
  }

  const actorRank = ROLE_HIERARCHY[actorRole] || 0;
  const targetRank = ROLE_HIERARCHY[targetUserRole] || 0;

  if (targetRank >= actorRank) {
    return {
      allowed: false,
      reason: `You cannot manage accounts with role ${ROLE_LABELS[targetUserRole]} as their rank is equal to or higher than yours`,
    };
  }

  return { allowed: true };
}
