import { UserRole } from '../types';

/**
 * EXACT 10 PORTAL ROLES FOR FACULTY & STAFF
 * Residential PDS Public School Sheohar
 */
export type PortalStaffRole =
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
  | 'SUPPORT_STAFF';

export interface PortalRoleMeta {
  id: PortalStaffRole;
  label: string;
  badgeColor: string;
  description: string;
}

export const STAFF_PORTAL_ROLES: PortalRoleMeta[] = [
  {
    id: 'SUPER_ADMIN',
    label: 'Super Admin',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    description: 'Complete institutional system authority, user and security management',
  },
  {
    id: 'SCHOOL_ADMIN',
    label: 'School Admin',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Broad school-management and administrative operations oversight',
  },
  {
    id: 'PRINCIPAL',
    label: 'Principal',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Institutional leadership, academics, faculty and classroom supervision',
  },
  {
    id: 'VICE_PRINCIPAL',
    label: 'Vice Principal',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
    description: 'Academic administration, faculty coordination and senior teaching',
  },
  {
    id: 'TEACHER',
    label: 'Teacher',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Classroom teaching, attendance, examinations, grading and student records',
  },
  {
    id: 'ACCOUNTANT',
    label: 'Accountant',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Fee collection, payroll, financial ledger, receipts and bank reconciliations',
  },
  {
    id: 'HR_STAFF',
    label: 'HR Staff',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'Employee lifecycle, onboarding, staff attendance and leave management',
  },
  {
    id: 'HOSTEL_WARDEN',
    label: 'Hostel Warden',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    description: 'Residential dormitories, hostel rooms, boarding attendance and student welfare',
  },
  {
    id: 'TRANSPORT_MANAGER',
    label: 'Transport Manager',
    badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    description: 'School bus fleet, transit routes, driver scheduling and vehicle safety',
  },
  {
    id: 'ACADEMIC_COORDINATOR',
    label: 'Academic Coordinator',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Curriculum alignment, period scheduling, timetable and academic standards',
  },
  {
    id: 'SUPPORT_STAFF',
    label: 'Support Staff (no app login)',
    badgeColor: 'bg-stone-100 text-stone-800 border-stone-200',
    description: 'Cleaning, driver, guard, cook and other staff: employee ID, ID card and attendance only, no app login',
  },
];

/** Roles whose staff get an employee ID, ID card, attendance and payroll record but never an app/website login. */
export const NO_LOGIN_STAFF_ROLES: readonly string[] = ['SUPPORT_STAFF'];

export function isNoLoginStaffRole(role: unknown): boolean {
  return NO_LOGIN_STAFF_ROLES.includes(String(role || '').toUpperCase());
}

/**
 * EXACT DESIGNATIONS DYNAMICALLY PER PORTAL ROLE
 * Note: HEAD_OF_DEPARTMENT is completely removed.
 */
export const STAFF_ROLE_DESIGNATIONS: Record<PortalStaffRole, string[]> = {
  SUPER_ADMIN: [
    'Super Administrator',
    'System Administrator',
  ],
  SCHOOL_ADMIN: [
    'School Administrator',
    'School Admin',
    'Administrative Manager',
    'Office Administrator',
  ],
  PRINCIPAL: [
    'Principal',
    'Principal & Senior Teacher',
    'Principal & Academic Head',
  ],
  VICE_PRINCIPAL: [
    'Vice Principal',
    'Vice Principal & Senior Teacher',
    'Vice Principal & Academic Coordinator',
  ],
  TEACHER: [
    'PGT Teacher',
    'TGT Teacher',
    'PRT Teacher',
    'Special Educator',
    'Subject Teacher',
    'Assistant Teacher',
    'Computer Teacher',
    'Physical Education Teacher',
    'Other Teaching Staff',
  ],
  ACCOUNTANT: [
    'Accountant',
    'Senior Accountant',
    'Accounts Assistant',
    'Cashier',
    'Finance & Accounts Officer',
  ],
  HR_STAFF: [
    'HR Manager',
    'HR Executive',
    'HR Assistant',
    'HR Coordinator',
    'HR & Administrative Officer',
  ],
  HOSTEL_WARDEN: [
    'Hostel Warden',
    'Senior Hostel Warden',
    'Assistant Hostel Warden',
    'Hostel Supervisor',
  ],
  TRANSPORT_MANAGER: [
    'Transport Manager',
    'Transport Coordinator',
    'Transport Supervisor',
    'Fleet Manager',
  ],
  ACADEMIC_COORDINATOR: [
    'Academic Coordinator',
    'Senior Academic Coordinator',
    'Academic Coordinator & Teacher',
  ],
  SUPPORT_STAFF: [
    'Cleaning Staff',
    'Sweeper',
    'Driver',
    'Conductor / Bus Helper',
    'Peon / Attendant',
    'Security Guard',
    'Gardener (Mali)',
    'Cook',
    'Kitchen Helper',
    'Ayah / Maid',
    'Electrician',
    'Plumber',
    'Lab Attendant',
    'Office Boy',
    'Helper',
    'Other Support Staff',
  ],
};

/**
 * Checks if a portal role naturally teaches or can teach
 */
export function isTeachingRole(role: PortalStaffRole): boolean {
  return role === 'TEACHER' || role === 'PRINCIPAL' || role === 'VICE_PRINCIPAL';
}

/**
 * Checks if teaching fields should be shown for this role and configuration
 */
export function shouldShowTeachingFields(
  role: PortalStaffRole,
  alsoPerformsTeaching?: boolean
): boolean {
  if (role === 'TEACHER' || role === 'PRINCIPAL' || role === 'VICE_PRINCIPAL') {
    return true;
  }
  if (role === 'ACADEMIC_COORDINATOR' || role === 'HOSTEL_WARDEN') {
    return Boolean(alsoPerformsTeaching);
  }
  return false;
}

/**
 * Get default designation for a portal role
 */
export function getDefaultDesignationForRole(role: PortalStaffRole): string {
  const list = STAFF_ROLE_DESIGNATIONS[role];
  return list && list.length > 0 ? list[0] : 'Teaching Staff';
}

/**
 * Who may mark staff attendance (register, "Mark all present" and ID card scan). School decision:
 * only the Super Admin and the Principal. Everyone else, the Vice Principal included, cannot.
 */
export const STAFF_ATTENDANCE_MARK_ROLES: readonly string[] = ['SUPER_ADMIN', 'PRINCIPAL'];
export const canMarkStaffAttendance = (role?: string | null): boolean => !!role && STAFF_ATTENDANCE_MARK_ROLES.includes(String(role).toUpperCase());
