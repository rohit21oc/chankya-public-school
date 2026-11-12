import React from 'react';
import {
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileCheck,
  Globe,
  GraduationCap,
  History,
  LayoutDashboard,
  MessageSquareText,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { User, UserRole, PermissionKey, hasPermission } from '../types';
import { fileUploadService } from '../services/fileUploadService';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  permission?: PermissionKey;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
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
  },
  {
    id: 'students',
    label: 'Students',
    icon: GraduationCap,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'TEACHER', 'PARENT', 'ACCOUNTANT'],
    permission: 'students.view',
  },
  {
    id: 'teachers',
    label: 'Teachers & Staff',
    icon: Users,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'HR_STAFF', 'ACCOUNTANT'],
    permission: 'staff.view',
  },
  {
    id: 'salary',
    label: 'Staff Salary',
    icon: Banknote,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'HR_STAFF'],
    permission: 'payroll.view',
  },
  {
    id: 'academics',
    label: 'Academic',
    icon: BookOpen,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'TEACHER'],
    permission: 'academics.view',
  },
  {
    id: 'timetable',
    label: 'Timetable',
    icon: CalendarDays,
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
    permission: 'timetable.view',
  },
  {
    // Teachers and administrators assign and manage homework; students and parents see their class's homework.
    id: 'homework',
    label: 'Homework',
    icon: BookOpen,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT'],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'PARENT',
      'STUDENT',
      'HR_STAFF',
    ],
    permission: 'attendance.view',
  },
  {
    id: 'fees',
    label: 'Fees & Accounts',
    icon: CreditCard,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'PARENT', 'STUDENT'],
    permission: 'fees.view',
  },
  {
    id: 'exams',
    label: 'Exams & Marks',
    icon: FileCheck,
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'PARENT',
      'STUDENT',
    ],
    permission: 'exams.view',
  },
  {
    id: 'documents',
    label: 'Report & ID Cards',
    icon: ShieldCheck,
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'PARENT',
      'STUDENT',
    ],
    permission: 'documents.view',
  },
  {
    id: 'hostel',
    label: 'Hostel',
    icon: Building2,
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'HOSTEL_WARDEN',
    ],
    permission: 'hostel.view',
  },
  {
    id: 'transport',
    label: 'Transport',
    icon: Bus,
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'TRANSPORT_MANAGER',
    ],
    permission: 'transport.view',
  },
  {
    id: 'communication',
    label: 'Notices',
    icon: MessageSquareText,
    roles: [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'ACADEMIC_COORDINATOR',
      'TEACHER',
      'PARENT',
      'STUDENT',
    ],
    permission: 'communication.view',
  },
  {
    // Parent ↔ staff chat (and fee-due reminders for fee roles). Same conversations as the app.
    id: 'messages',
    label: 'Messages',
    icon: MessageCircle,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ACCOUNTANT', 'TEACHER', 'HOSTEL_WARDEN', 'PARENT'],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ACCOUNTANT', 'HR_STAFF'],
    permission: 'reports.view',
  },
  {
    id: 'public-website-management',
    label: 'Public Website Management',
    icon: Globe,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    permission: 'website.manage',
  },
  {
    id: 'settings',
    label: 'School Settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    permission: 'settings.view',
  },
  {
    id: 'permissions',
    label: 'Roles & Permissions',
    icon: ShieldCheck,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    permission: 'users.view',
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    icon: History,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    permission: 'audit_logs.view',
  },
];

function isNavItemAllowed(item: NavItem, user: User, role: UserRole): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (!item.roles.includes(role)) return false;
  if (item.permission && !hasPermission(user, item.permission)) return false;
  return true;
}

/** Same rule as the sidebar: whether the signed-in user may open a module (used by dashboard shortcuts). */
export function canOpenModule(user: User, moduleId: string): boolean {
  const item = NAV_ITEMS.find((n) => n.id === moduleId);
  if (!item) return false;
  return isNavItemAllowed(item, user, user.role);
}

interface SidebarProps {
  activeModule: string;
  onSelectModule: (id: string) => void;
  userRole: UserRole;
  user: User;
  onOpenProfile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  userRole,
  user,
  onOpenProfile,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const allowedItems = NAV_ITEMS.filter((item) => isNavItemAllowed(item, user, userRole));

  const roleFormatted = user.role.replace(/_/g, ' ');

  const handleModuleClick = (id: string) => {
    onSelectModule(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleProfileClick = () => {
    onOpenProfile();
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  // Nav list rendering helper
  const renderNavItems = (collapsed: boolean) => (
    <nav className="space-y-1">
      {allowedItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeModule === item.id || (item.id === 'academics' && activeModule === 'academic');
        const displayLabel = (() => {
          if (userRole === 'TEACHER') {
            if (item.id === 'dashboard') return 'Teacher Dashboard';
            if (item.id === 'students') return 'My Students';
            if (item.id === 'timetable') return 'My Timetable';
            if (item.id === 'attendance') return 'Student Attendance';
            if (item.id === 'exams') return 'Marks & Exams';
            if (item.id === 'academics') return 'Academic Structure';
            if (item.id === 'documents') return 'Student Documents';
            if (item.id === 'communication') return 'Notices & Circulars';
          }
          return item.label;
        })();

        return (
          <button
            key={item.id}
            id={`sidebar-link-${item.id}`}
            onClick={() => handleModuleClick(item.id)}
            title={collapsed ? displayLabel : undefined}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
            } rounded-xl text-xs font-semibold transition-all group relative ${
              isActive
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
              }`}
            />
            {!collapsed && <span className="truncate">{displayLabel}</span>}

            {/* Hover Tooltip when collapsed */}
            {collapsed && (
              <span className="absolute left-full ml-2.5 px-2.5 py-1.5 rounded-lg bg-slate-950 text-white text-xs font-medium whitespace-nowrap shadow-xl border border-slate-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {displayLabel}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  // Compact Logged-in User Profile Component
  const renderUserProfileCard = (collapsed: boolean) => (
    <div className="p-2 border-t border-slate-800/80 shrink-0 bg-slate-900/95">
      <button
        type="button"
        id="sidebar-user-profile-btn"
        onClick={handleProfileClick}
        title={collapsed ? `${user.name} (${roleFormatted}) - Click to view profile` : 'View My Profile'}
        className={`w-full flex items-center ${
          collapsed ? 'justify-center p-2' : 'gap-3 p-2.5'
        } rounded-xl hover:bg-slate-800/90 text-left transition-all group relative cursor-pointer border border-transparent hover:border-slate-700/60`}
      >
        {/* Profile Avatar */}
        <div className="relative shrink-0">
          {user.avatar && fileUploadService.getFileUrl(user.avatar) ? (
            <img
              src={fileUploadService.getFileUrl(user.avatar)}
              alt={user.name}
              className="w-9 h-9 rounded-xl object-cover border border-slate-700 shadow-xs group-hover:ring-2 group-hover:ring-blue-500 transition-all"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs group-hover:ring-2 group-hover:ring-blue-500 transition-all">
              {user.name.charAt(0)}
            </div>
          )}
          {/* Active Status Indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900"></span>
        </div>

        {/* User Info (Expanded only) */}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate leading-tight group-hover:text-blue-400 transition-colors">
              {user.name}
            </div>
            <div className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
              {roleFormatted}
            </div>
            <div className="text-[10px] text-blue-400/90 font-semibold mt-0.5 flex items-center gap-1">
              <span>My Profile</span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        )}

        {/* Tooltip when collapsed */}
        {collapsed && (
          <span className="absolute left-full ml-2.5 px-3 py-2 rounded-xl bg-slate-950 text-white text-xs whitespace-nowrap shadow-2xl border border-slate-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
            <div className="font-bold text-white">{user.name}</div>
            <div className="text-[10px] text-slate-400">{roleFormatted}</div>
            <div className="text-[10px] text-blue-400 font-semibold mt-0.5">Click to view My Profile</div>
          </span>
        )}
      </button>
    </div>
  );

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP PERMANENT SIDEBAR (Hidden on mobile/tablet < 1024px) */}
      {/* ========================================================================= */}
      <aside
        className={`hidden lg:flex flex-col justify-between shrink-0 h-full bg-slate-900 text-slate-300 select-none print:hidden border-r border-slate-800/80 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Navigation Section (Independently Scrollable) */}
        <div className="flex-1 overflow-y-auto min-h-0 py-3 px-3">
          {/* Section Header & Collapse Toggle */}
          <div
            className={`px-2 mb-2 flex items-center ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            {!isCollapsed ? (
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Main Modules
              </span>
            ) : null}

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 text-blue-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Nav items */}
          {renderNavItems(isCollapsed)}
        </div>

        {/* Logged-in User Profile Area (Compact & Clickable) */}
        {renderUserProfileCard(isCollapsed)}
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE / TABLET SLIDE-IN DRAWER (< 1024px) */}
      {/* ========================================================================= */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <aside className="relative w-72 max-w-[85vw] h-full bg-slate-900 text-slate-300 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-300 border-r border-slate-800">
            {/* Drawer Header with Title and Close Button */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-white">Campus Portal Menu</span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close Navigation Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Section */}
            <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1">
              <div className="px-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Navigation Modules
              </div>
              {renderNavItems(false)}
            </div>

            {/* Logged-in User Profile Area */}
            {renderUserProfileCard(false)}
          </aside>
        </div>
      )}
    </>
  );
};
