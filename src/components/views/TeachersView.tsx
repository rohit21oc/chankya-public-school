import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  KeyRound,
  Loader2,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  PlusCircle,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { SchoolSettings, TeacherStaff, UserRole } from '../../types';
import { api } from '../../services/api';
import { PrintableIdCardModal } from '../modals/PrintableIdCardModal';
import { fileUploadService } from '../../services/fileUploadService';
import { downloadBlankForm } from '../../utils/blankFormsPdf';
import { StaffFullProfileView } from '../teachers/StaffFullProfileView';
import { AddStaffPageView } from '../teachers/AddStaffPageView';
import { EditStaffPageView } from '../teachers/EditStaffPageView';
import { useRealtimeListener } from '../../hooks/useRealtime';

interface TeachersViewProps {
  userRole: UserRole;
  settings: SchoolSettings;
}

type SortField = 'name' | 'employeeId' | 'designation' | 'joiningDate' | 'status';
type SortOrder = 'asc' | 'desc';

export const TeachersView: React.FC<TeachersViewProps> = ({
  userRole,
  settings,
}) => {
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  // Navigation View State
  const [viewMode, setViewMode] = useState<'DIRECTORY' | 'PROFILE' | 'ADD_STAFF' | 'EDIT_STAFF'>('DIRECTORY');
  const [activeStaff, setActiveStaff] = useState<TeacherStaff | null>(null);

  // Staff List State
  const [staffList, setStaffList] = useState<TeacherStaff[]>(() => api.getStaff());

  // After a page reload the list is built before the server data arrives: fetch it and show it.
  useEffect(() => {
    let cancelled = false;
    api.syncStaff().then((fresh) => {
      if (!cancelled && Array.isArray(fresh)) setStaffList([...fresh]);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time synchronization listener for Staff/Teachers
  useRealtimeListener(['TEACHER', 'SESSION'], () => {
    const updated = api.getStaff();
    setStaffList([...updated]);
    if (activeStaff) {
      const fresh = updated.find((s) => s.id === activeStaff.id);
      if (fresh) setActiveStaff(fresh);
    }
  });

  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedDesignation, setSelectedDesignation] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('employeeId');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ID Card Modal
  const [staffForIdCard, setStaffForIdCard] = useState<TeacherStaff | null>(null);

  // Quick Action Modals (Super Admin only)
  const [staffToDelete, setStaffToDelete] = useState<TeacherStaff | null>(null);
  const [staffForStatusChange, setStaffForStatusChange] = useState<TeacherStaff | null>(null);
  const [targetStatus, setTargetStatus] = useState<'ACTIVE' | 'ON_LEAVE' | 'RESIGNED' | 'INACTIVE' | 'SUSPENDED' | 'LEFT_SCHOOL'>('ACTIVE');
  const [staffForResetPassword, setStaffForResetPassword] = useState<TeacherStaff | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSavingStaffAction, setIsSavingStaffAction] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Quick Resend Credentials State
  const [resendingStaffId, setResendingStaffId] = useState<string | null>(null);
  const [credentialsNotice, setCredentialsNotice] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    subtext?: string;
  } | null>(null);

  const handleRowResendCredentials = async (staffMember: TeacherStaff) => {
    if (!staffMember.id || resendingStaffId) return;
    setResendingStaffId(staffMember.id);
    setCredentialsNotice(null);

    try {
      const res = await api.resendStaffCredentials(staffMember.id);
      if (res.success && res.emailDispatched) {
        setCredentialsNotice({
          type: 'success',
          text: `Credentials email dispatched to ${res.email || staffMember.email}!`,
          subtext: `Login ID: ${res.portalUserId || res.employeeId || staffMember.employeeId}. A password setup link (valid for 60 minutes) was emailed.`,
        });
        showToast(`Credentials sent to ${staffMember.name}`);
      } else if (!staffMember.email) {
        setCredentialsNotice({
          type: 'warning',
          text: `No email address on file for ${staffMember.name}. Please edit their profile to add a valid email first.`,
        });
      } else {
        setCredentialsNotice({
          type: 'error',
          text: res.error || res.message || 'The email could not be sent. Please check the email settings and try again.',
        });
      }
    } catch (err: any) {
      setCredentialsNotice({
        type: 'error',
        text: err?.message || 'Error occurred while contacting server to resend credentials.',
      });
    } finally {
      setResendingStaffId(null);
    }
  };

  // Departments & Designations from database
  const departments = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [staffList]);

  const designations = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.designation) set.add(s.designation);
    });
    return Array.from(set).sort();
  }, [staffList]);

  // Overall metric counts
  const activeCount = staffList.filter((s) => s.status === 'ACTIVE').length;
  const onLeaveCount = staffList.filter((s) => s.status === 'ON_LEAVE').length;
  const inactiveCount = staffList.filter((s) => s.status !== 'ACTIVE' && s.status !== 'ON_LEAVE').length;

  // Filter & Search Logic
  const filteredStaff = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return staffList.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.employeeId.toLowerCase().includes(q) ||
        (s.designation && s.designation.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.qualification && s.qualification.toLowerCase().includes(q)) ||
        (s.subjectExpertise && s.subjectExpertise.some((sub) => sub.toLowerCase().includes(q))) ||
        (s.assignedSubjects && s.assignedSubjects.some((sub) => sub.toLowerCase().includes(q))) ||
        (s.specializationSubjects && s.specializationSubjects.some((sub) => sub.toLowerCase().includes(q)));

      const matchesDept = selectedDept === 'ALL' || s.department === selectedDept;
      const matchesDesig = selectedDesignation === 'ALL' || s.designation === selectedDesignation;
      const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;

      return matchesSearch && matchesDept && matchesDesig && matchesStatus;
    });
  }, [staffList, searchTerm, selectedDept, selectedDesignation, selectedStatus]);

  // Sorting Logic
  const sortedStaff = useMemo(() => {
    return [...filteredStaff].sort((a, b) => {
      let valA: string = '';
      let valB: string = '';

      if (sortField === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (sortField === 'employeeId') {
        valA = a.employeeId || '';
        valB = b.employeeId || '';
      } else if (sortField === 'designation') {
        valA = a.designation || '';
        valB = b.designation || '';
      } else if (sortField === 'joiningDate') {
        valA = a.joiningDate || '';
        valB = b.joiningDate || '';
      } else if (sortField === 'status') {
        valA = a.status || '';
        valB = b.status || '';
      }

      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredStaff, sortField, sortOrder]);

  // Pagination Calculations
  const totalItems = sortedStaff.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedStaff = sortedStaff.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedDept('ALL');
    setSelectedDesignation('ALL');
    setSelectedStatus('ALL');
    setCurrentPage(1);
  };

  // View Profile Action
  const handleViewProfile = (staff: TeacherStaff) => {
    setActiveStaff(staff);
    setViewMode('PROFILE');
  };

  // Edit Profile Action (Super Admin)
  const handleOpenEdit = (staff: TeacherStaff) => {
    if (!isSuperAdmin) return;
    setActiveStaff(staff);
    setViewMode('EDIT_STAFF');
  };

  // Callback when a staff member is updated
  const handleStaffUpdated = (updated: TeacherStaff) => {
    setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setActiveStaff(updated);
    setViewMode('PROFILE');
    showToast(`Staff profile for ${updated.name} successfully updated.`);
  };

  // Callback when a new staff member is added
  const handleStaffAdded = (newStaff: TeacherStaff) => {
    setStaffList(api.getStaff());
    setActiveStaff(newStaff);
    setViewMode('PROFILE');
    showToast(`Faculty member ${newStaff.name} (ID: ${newStaff.employeeId}) registered successfully.`);
  };

  // Callback when staff is deleted
  const handleStaffDeleted = (staffId: string) => {
    setStaffList(api.getStaff());
    setActiveStaff(null);
    setViewMode('DIRECTORY');
    showToast('Faculty record successfully deleted.');
  };

  // Quick Status Change Confirm
  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !staffForStatusChange || isSavingStaffAction) return;
    setIsSavingStaffAction(true);
    try {
      const updated = await api.updateStaffAsync(staffForStatusChange.id, {
        status: targetStatus as any,
        accountStatus: targetStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      });
      setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (activeStaff && activeStaff.id === updated.id) {
        setActiveStaff(updated);
      }
      setStaffForStatusChange(null);
      showToast(`Status changed to ${targetStatus} for ${updated.name}.`);
    } catch (err: any) {
      showToast(err?.message || 'Could not change the status. Please try again.');
    } finally {
      setIsSavingStaffAction(false);
    }
  };

  // Quick Reset Password Confirm
  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !staffForResetPassword || !resetPasswordInput.trim()) return;
    setIsResettingPassword(true);
    try {
      await api.resetStaffPassword(staffForResetPassword.id, resetPasswordInput.trim());
      showToast(`Password successfully updated for ${staffForResetPassword.name} (${staffForResetPassword.employeeId})`);
      setStaffForResetPassword(null);
      setResetPasswordInput('');
    } catch {
      showToast('Failed to reset faculty password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Quick Delete Confirm
  const handleConfirmDelete = async () => {
    if (!isSuperAdmin || !staffToDelete || isSavingStaffAction) return;
    setIsSavingStaffAction(true);
    try {
      await api.deleteStaffAsync(staffToDelete.id);
      setStaffList((prev) => prev.filter((s) => s.id !== staffToDelete.id));
      if (activeStaff && activeStaff.id === staffToDelete.id) {
        setActiveStaff(null);
        setViewMode('DIRECTORY');
      }
      showToast(`Record for ${staffToDelete.name} was removed.`);
      setStaffToDelete(null);
    } catch (err: any) {
      showToast(err?.message || 'Could not delete the staff member. Please try again.');
      setStaffToDelete(null);
    } finally {
      setIsSavingStaffAction(false);
    }
  };

  // =========================================================================
  // SUB-VIEW: FULL-PAGE PROFILE
  // =========================================================================
  if (viewMode === 'PROFILE' && activeStaff) {
    return (
      <StaffFullProfileView
        staff={activeStaff}
        currentUserRole={userRole}
        settings={settings}
        onBack={() => setViewMode('DIRECTORY')}
        onEditProfile={() => handleOpenEdit(activeStaff)}
        onOpenIdCard={(st) => setStaffForIdCard(st)}
        onStaffUpdated={handleStaffUpdated}
        onStaffDeleted={handleStaffDeleted}
      />
    );
  }

  // =========================================================================
  // SUB-VIEW: FULL-PAGE ADD NEW FACULTY / STAFF
  // =========================================================================
  if (viewMode === 'ADD_STAFF') {
    return (
      <AddStaffPageView
        onBack={() => setViewMode('DIRECTORY')}
        onStaffAdded={handleStaffAdded}
        currentUserRole={userRole}
      />
    );
  }

  // =========================================================================
  // SUB-VIEW: FULL-PAGE EDIT FACULTY / STAFF (SUPER ADMIN ONLY)
  // =========================================================================
  if (viewMode === 'EDIT_STAFF' && activeStaff) {
    return (
      <EditStaffPageView
        staff={activeStaff}
        currentUserRole={userRole}
        onBack={() => setViewMode('PROFILE')}
        onStaffUpdated={handleStaffUpdated}
      />
    );
  }

  // =========================================================================
  // MAIN VIEW: CLEAN HORIZONTAL ROW/TABLE DIRECTORY LAYOUT
  // =========================================================================
  // Row actions, shared by the desktop table and the phone cards.
  const renderStaffActions = (staff: TeacherStaff, touch: boolean) => {
    const iconBtn = touch ? 'inline-flex items-center justify-center w-10 h-10' : 'p-1.5';
    return (
                        <div className={`flex items-center gap-1.5 ${touch ? "flex-wrap justify-start" : "justify-end"}`}>
                          {/* View/Details Button (Opens Full Page Profile) */}
                          <button
                            type="button"
                            onClick={() => handleViewProfile(staff)}
                            className={`inline-flex items-center gap-1 px-2.5 ${touch ? "min-h-10" : "py-1.5"} rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold text-xs transition-colors`}
                            title="View Full Staff Profile"
                            aria-label="View Full Staff Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {/* ID Card Button */}
                          <button
                            type="button"
                            onClick={() => setStaffForIdCard(staff)}
                            className={`${iconBtn} rounded-lg text-purple-700 hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-colors`}
                            title="Print Staff ID Card"
                            aria-label="Print Staff ID Card"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {/* Super Admin Privileged Actions */}
                          {isSuperAdmin && (
                            <>
                              {/* Quick Reset Password */}
                              <button
                                type="button"
                                onClick={() => {
                                  setStaffForResetPassword(staff);
                                  setResetPasswordInput('');
                                }}
                                className={`${iconBtn} rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors`}
                                title="Reset Staff Password (Super Admin)"
                            aria-label="Reset Staff Password (Super Admin)"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Quick Resend Credentials */}
                              <button
                                type="button"
                                onClick={() => handleRowResendCredentials(staff)}
                                disabled={resendingStaffId === staff.id}
                                className={`${iconBtn} rounded-lg text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-colors disabled:opacity-50 cursor-pointer`}
                                title={`Resend Login Credentials Email to ${staff.name}`}
                                aria-label={`Resend login details to ${staff.name}`}
                              >
                                {resendingStaffId === staff.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-700" />
                                ) : (
                                  <Mail className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* Quick Change Status */}
                              <button
                                type="button"
                                onClick={() => {
                                  setStaffForStatusChange(staff);
                                  setTargetStatus(staff.status as any);
                                }}
                                className={`${iconBtn} rounded-lg text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors`}
                                title="Change Status (Super Admin)"
                            aria-label="Change Status (Super Admin)"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Profile */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(staff)}
                                className={`${iconBtn} rounded-lg text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-300 transition-colors`}
                                title="Edit Staff Profile (Super Admin)"
                            aria-label="Edit Staff Profile (Super Admin)"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Profile */}
                              <button
                                type="button"
                                onClick={() => setStaffToDelete(staff)}
                                className={`${iconBtn} rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors`}
                                title="Delete Staff Profile (Super Admin)"
                            aria-label="Delete Staff Profile (Super Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 w-full min-w-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Metric Summary Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-black tracking-tight text-slate-900">Faculty & Staff Directory</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {staffList.length} Total
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              {activeCount} Active
            </span>
            {onLeaveCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                {onLeaveCount} On Leave
              </span>
            )}
            {inactiveCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                {inactiveCount} Other
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Session: {api.getActiveAcademicSession()?.name || settings.currentAcademicSession || 'Active'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official faculty and staff directory with employee IDs, timetable allocations, documents, and portal access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { void downloadBlankForm('staff', settings); }}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all active:scale-95 shrink-0"
            title="Download a blank A4 staff onboarding form (PDF) to print and fill by hand"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Onboarding Form (PDF)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('ADD_STAFF')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Faculty / Staff</span>
          </button>
        </div>
      </div>

      {/* Search, Filters, and Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, employee ID, mobile, email, subject expertise, designation..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Department */}
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 border border-slate-300 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Designation */}
            <select
              value={selectedDesignation}
              onChange={(e) => {
                setSelectedDesignation(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 border border-slate-300 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium"
            >
              <option value="ALL">All Designations</option>
              {designations.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 border border-slate-300 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_LEAVE">ON LEAVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="RESIGNED">RESIGNED</option>
            </select>

            {/* Clear Filters Button */}
            {(searchTerm || selectedDept !== 'ALL' || selectedDesignation !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                title="Reset Search and Filters"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Info & Active Results Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <div>
            Showing <strong className="text-slate-800 font-bold">{totalItems}</strong> matching staff member{totalItems === 1 ? '' : 's'}
            {totalItems < staffList.length && (
              <span> (filtered from {staffList.length} total)</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">Sort By:</span>
            <button
              type="button"
              onClick={() => handleSort('name')}
              className={`min-h-8 px-1.5 font-semibold hover:text-blue-700 ${sortField === 'name' ? 'text-blue-700 font-bold' : ''}`}
            >
              Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleSort('employeeId')}
              className={`min-h-8 px-1.5 font-semibold hover:text-blue-700 ${sortField === 'employeeId' ? 'text-blue-700 font-bold' : ''}`}
            >
              ID {sortField === 'employeeId' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleSort('designation')}
              className={`min-h-8 px-1.5 font-semibold hover:text-blue-700 ${sortField === 'designation' ? 'text-blue-700 font-bold' : ''}`}
            >
              Designation {sortField === 'designation' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>
      </div>

      {/* Credentials Action Feedback Notice */}
      {credentialsNotice && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs shadow-xs transition-all ${
            credentialsNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : credentialsNotice.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {credentialsNotice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : credentialsNotice.type === 'warning' ? (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-sm">{credentialsNotice.text}</p>
              {credentialsNotice.subtext && (
                <p className="text-xs opacity-90 mt-0.5 font-medium">{credentialsNotice.subtext}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCredentialsNotice(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-black/5 cursor-pointer transition-colors"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Clean Horizontal Table Layout */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full min-w-0">
        {/* Phone layout: one card per staff member */}
        <ul className="md:hidden divide-y divide-slate-100" aria-label="Staff list">
          {paginatedStaff.length === 0 ? (
            <li className="py-10 text-center text-slate-500 text-xs">No faculty or staff found. Try changing your search or filters.</li>
          ) : (
            paginatedStaff.map((staff) => (
              <li key={`card-${staff.id}`} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                    {(staff.photo || staff.photoFileKey) && fileUploadService.getFileUrl(staff.photo || staff.photoFileKey) ? (
                      <img src={fileUploadService.getFileUrl(staff.photo || staff.photoFileKey)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-slate-600">{staff.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => handleViewProfile(staff)} className="text-left text-sm font-bold text-slate-900 hover:text-blue-700 break-words">
                      {staff.name}
                    </button>
                    <div className="text-xs text-slate-600 break-words">{staff.designation}{staff.department ? ` • ${staff.department}` : ''}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-blue-900">{staff.employeeId}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          staff.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : staff.status === 'ON_LEAVE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {staff.status}
                      </span>
                    </div>
                    {staff.phone && (
                      <a href={`tel:${staff.phone}`} className="mt-1 inline-flex items-center gap-1.5 min-h-8 text-xs text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {staff.phone}
                      </a>
                    )}
                  </div>
                </div>
                {renderStaffActions(staff, true)}
              </li>
            ))
          )}
        </ul>

        <div className="hidden md:block overflow-x-auto w-full min-w-0">
          <table className="w-full min-w-[820px] text-left text-xs border-collapse">
            {/* Table Header */}
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-3.5 px-4 w-14 text-center">Photo</th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('employeeId')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee ID</span>
                    {sortField === 'employeeId' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('designation')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Designation</span>
                    {sortField === 'designation' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-4">Mobile</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Subject Expertise</th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    {sortField === 'status' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right pr-6">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 space-y-2">
                    <Users className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700 text-sm">No faculty or staff found</p>
                    <p className="text-xs text-slate-400">Try changing your search terms or active filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((staff) => {
                  const expertiseList =
                    staff.subjectExpertise ||
                    staff.specializationSubjects ||
                    staff.assignedSubjects ||
                    [];

                  return (
                    <tr
                      key={staff.id}
                      className="hover:bg-blue-50/40 transition-colors group"
                    >
                      {/* 1. Photo */}
                      <td className="py-3 px-4 text-center">
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs mx-auto flex items-center justify-center">
                          {(staff.photo || staff.photoFileKey) && fileUploadService.getFileUrl(staff.photo || staff.photoFileKey) ? (
                            <img
                              src={fileUploadService.getFileUrl(staff.photo || staff.photoFileKey)}
                              alt={staff.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm flex items-center justify-center">
                              {staff.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 2. Name */}
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => handleViewProfile(staff)}
                          className="text-left font-bold text-slate-900 hover:text-blue-700 transition-colors block"
                        >
                          {staff.name}
                        </button>
                        {staff.classTeacherOf ? (
                          <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mt-0.5">
                            Class Teacher: {staff.classTeacherOf}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {staff.qualification || 'Faculty'}
                          </span>
                        )}
                      </td>

                      {/* 3. Employee ID */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-200">
                          {staff.employeeId}
                        </span>
                      </td>

                      {/* 4. Designation */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block text-xs">{staff.designation}</span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {staff.department || 'Academics'}
                        </span>
                      </td>

                      {/* 5. Mobile */}
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        <a
                          href={`tel:${staff.phone}`}
                          className="inline-flex items-center gap-1.5 hover:text-blue-700 transition-colors"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{staff.phone}</span>
                        </a>
                      </td>

                      {/* 6. Email */}
                      <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate">
                        {staff.email ? (
                          <a
                            href={`mailto:${staff.email}`}
                            className="inline-flex items-center gap-1.5 hover:text-blue-700 transition-colors truncate"
                            title={staff.email}
                          >
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{staff.email}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* 7. Subject Expertise */}
                      <td className="py-3 px-4">
                        {expertiseList.length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">General</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {expertiseList.slice(0, 2).map((sub) => (
                              <span
                                key={sub}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-semibold border border-slate-200 whitespace-nowrap"
                              >
                                {sub}
                              </span>
                            ))}
                            {expertiseList.length > 2 && (
                              <span
                                className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200"
                                title={expertiseList.slice(2).join(', ')}
                              >
                                +{expertiseList.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 8. Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            staff.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : staff.status === 'ON_LEAVE'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              staff.status === 'ACTIVE'
                                ? 'bg-emerald-600'
                                : staff.status === 'ON_LEAVE'
                                ? 'bg-amber-600'
                                : 'bg-rose-600'
                            }`}
                          />
                          <span>{staff.status}</span>
                        </span>
                      </td>

                      {/* 9. Actions */}
                      <td className="py-3 px-4 text-right pr-6 whitespace-nowrap">
                        {renderStaffActions(staff, false)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-900 font-bold">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{endIndex}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{totalItems}</strong> entries
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Page Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-semibold transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (totalPages <= 5) return true;
                return Math.abs(page - safeCurrentPage) <= 1 || page === 1 || page === totalPages;
              })
              .map((page, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && page - prev > 1;
                return (
                  <React.Fragment key={page}>
                    {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        safeCurrentPage === page
                          ? 'bg-blue-700 text-white'
                          : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-semibold transition-colors flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ID Card Modal */}
      {staffForIdCard && (
        <PrintableIdCardModal
          staff={staffForIdCard}
          isOpen={!!staffForIdCard}
          onClose={() => setStaffForIdCard(null)}
          settings={settings}
        />
      )}

      {/* Super Admin Quick Status Change Modal */}
      {staffForStatusChange && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm">
                Change Status: {staffForStatusChange.name}
              </h4>
              <button
                type="button"
                onClick={() => setStaffForStatusChange(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmStatusChange} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-medium text-xs mb-1.5">Select New Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold"
                >
                  <option value="ACTIVE">ACTIVE (On Duty)</option>
                  <option value="ON_LEAVE">ON_LEAVE (Approved Leave)</option>
                  <option value="RESIGNED">RESIGNED (Left School)</option>
                  <option value="INACTIVE">INACTIVE (Temporarily Disabled)</option>
                  <option value="SUSPENDED">SUSPENDED (Disciplinary Hold)</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500">
                This will immediately update their teaching directory badge and portal access status.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStaffForStatusChange(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
                >
                  Confirm Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Quick Reset Staff Password Modal */}
      {staffForResetPassword && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Reset Faculty Password</h4>
                  <p className="text-xs text-slate-500">Super Administrator Privileged Action</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStaffForResetPassword(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <div>Faculty: <strong className="text-slate-900">{staffForResetPassword.name}</strong></div>
              <div>Employee ID / Login ID: <strong className="font-mono text-purple-700">{staffForResetPassword.employeeId}</strong></div>
              {staffForResetPassword.email && (
                <div>Email: <strong className="text-slate-800">{staffForResetPassword.email}</strong></div>
              )}
            </div>

            <form onSubmit={handleConfirmResetPassword} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-medium text-xs mb-1.5">New Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={resetPasswordInput}
                    onChange={(e) => setResetPasswordInput(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setResetPasswordInput('teacher123')}
                    className="px-2.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold shrink-0"
                  >
                    teacher123
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Directly activates their portal credentials and unlocks account if previously disabled.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStaffForResetPassword(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword || !resetPasswordInput.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {isResettingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Delete Staff Confirmation Modal */}
      {staffToDelete && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-rose-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-2.5 rounded-xl bg-rose-100">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Delete Staff Profile?</h4>
                <p className="text-xs text-rose-600">Super Administrator Privileged Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete <strong>{staffToDelete.name}</strong> (Employee ID:{' '}
              <span className="font-mono font-bold text-slate-900">{staffToDelete.employeeId}</span>)?
              This action cannot be undone and will remove all their records.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
