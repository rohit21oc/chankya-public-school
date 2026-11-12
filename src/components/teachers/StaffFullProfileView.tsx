import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorOpen,
  Download,
  Edit,
  Eye,
  File,
  FileCheck,
  FileText,
  GraduationCap,
  History,
  Info,
  Key,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  PlusCircle,
  Printer,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AcademicClass,
  AttachedDocument,
  SchoolSettings,
  StaffLeave,
  StaffPayrollRecord,
  TeacherStaff,
  UserRole,
} from '../../types';
import { api } from '../../services/api';
import { getFileContentUrl } from '../../services/apiConfig';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { fileUploadService } from '../../services/fileUploadService';
import { StaffPhotoUploader } from './form/StaffPhotoUploader';
import { AttendanceCalendar } from '../common/AttendanceCalendar';
import { SalaryDetailModal } from '../modals/SalaryDetailModal';
import { PrintableSalarySlipModal } from '../modals/PrintableSalarySlipModal';
import { MarkSalaryPaidModal } from '../modals/MarkSalaryPaidModal';
import { PrintableIdCardModal } from '../modals/PrintableIdCardModal';

interface StaffFullProfileViewProps {
  staff: TeacherStaff;
  currentUserRole: UserRole;
  settings: SchoolSettings;
  onBack: () => void;
  onEditProfile: () => void;
  onOpenIdCard: (staff: TeacherStaff) => void;
  onStaffUpdated: (updated: TeacherStaff) => void;
  onStaffDeleted: (staffId: string) => void;
}

export const StaffFullProfileView: React.FC<StaffFullProfileViewProps> = ({
  staff,
  currentUserRole,
  settings,
  onBack,
  onEditProfile,
  onOpenIdCard,
  onStaffUpdated,
  onStaffDeleted,
}) => {
  const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<
    | 'OVERVIEW'
    | 'PERSONAL'
    | 'PROFESSIONAL'
    | 'CLASSES'
    | 'TIMETABLE'
    | 'ATTENDANCE'
    | 'LEAVE'
    | 'PAYROLL'
    | 'DOCUMENTS'
    | 'PORTAL'
    | 'ACTIVITY'
  >('OVERVIEW');

  // Photo update state (Super Admin only)
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<AttachedDocument | null>(null);

  // Status Change State (Super Admin only)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'ACTIVE' | 'ON_LEAVE' | 'RESIGNED' | 'INACTIVE' | 'SUSPENDED' | 'LEFT_SCHOOL'>(staff.status as any);

  // Password Reset State (Super Admin only)
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordResetMsg, setPasswordResetMsg] = useState<string | null>(null);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const [isSavingProfileAction, setIsSavingProfileAction] = useState(false);

  // Resend Credentials State & Feedback
  const [isResendingCredentials, setIsResendingCredentials] = useState(false);
  const [resendStatusMsg, setResendStatusMsg] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    subtext?: string;
  } | null>(null);

  // Dedicated Staff ID Card Modal State
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState(false);

  const handleResendCredentials = async () => {
    if (!staff.id) return;
    setIsResendingCredentials(true);
    setResendStatusMsg(null);
    try {
      const res = await api.resendStaffCredentials(staff.id);
      if (res.success && res.emailDispatched) {
        setResendStatusMsg({
          type: 'success',
          text: `Credentials email dispatched successfully to ${res.email || staff.email}!`,
          subtext: `Login ID: ${res.portalUserId || res.employeeId || staff.employeeId}. A password setup link (valid for 60 minutes) was emailed.`,
        });
      } else if (!staff.email) {
        setResendStatusMsg({
          type: 'warning',
          text: `No email address on file for ${staff.name}. Please edit their profile to add a valid email first.`,
        });
      } else {
        setResendStatusMsg({
          type: 'error',
          text: res.error || res.message || 'The email could not be sent. Please check the email settings and try again.',
        });
      }
    } catch (err: any) {
      setResendStatusMsg({
        type: 'error',
        text: err?.message || 'Error occurred while contacting server to resend credentials.',
      });
    } finally {
      setIsResendingCredentials(false);
    }
  };

  // Delete Staff Modal (Super Admin only)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Leave State
  const [leaves, setLeaves] = useState<StaffLeave[]>(() => api.getStaffLeaves(staff.id));
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'CASUAL' as 'CASUAL' | 'SICK' | 'MATERNITY' | 'EARNED',
    startDate: new Date().toISOString().substring(0, 10),
    endDate: new Date().toISOString().substring(0, 10),
    days: 1,
    reason: '',
  });

  // Payroll State
  const [payrollHistory, setPayrollHistory] = useState<StaffPayrollRecord[]>(() =>
    api.getStaffPayroll(staff.id)
  );
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<StaffPayrollRecord | null>(null);
  const [selectedPrintRecord, setSelectedPrintRecord] = useState<StaffPayrollRecord | null>(null);
  const [selectedPayRecord, setSelectedPayRecord] = useState<StaffPayrollRecord | null>(null);

  // Document Upload State (Super Admin only)
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newDocType, setNewDocType] = useState('Qualification Certificate');

  // Timetable
  const allSlots = api.getTimetable();
  const teacherSlots = allSlots.filter((s) => s.teacherId === staff.id);
  const ttConfig = api.getTimetableConfig();

  useEffect(() => {
    setLeaves(api.getStaffLeaves(staff.id));
    setPayrollHistory(api.getStaffPayroll(staff.id));
    setPasswordResetMsg(null);
    api.fetchStaffPayrollAsync({ search: staff.employeeId || staff.name }).then((res) => {
      if (res && res.records) {
        const matching = res.records.filter(
          (p) =>
            p.staffId === staff.id ||
            (staff.employeeId && p.employeeId && p.employeeId.toUpperCase() === staff.employeeId.toUpperCase())
        );
        if (matching.length > 0) {
          setPayrollHistory(matching);
        }
      }
    }).catch(() => {});
  }, [staff.id, staff.employeeId, staff.name]);

  const formatSalary = (salary: any, monthlySalary?: number): string => {
    if (typeof monthlySalary === 'number' && monthlySalary > 0) {
      return monthlySalary.toLocaleString('en-IN');
    }
    if (!salary) return '30,000';
    if (typeof salary === 'number') return salary.toLocaleString('en-IN');
    const val = salary.net ?? salary.basic ?? salary.monthly ?? 0;
    return val > 0 ? Number(val).toLocaleString('en-IN') : '30,000';
  };

  const handlePhotoUpdated = async (res: { fileKey: string; previewUrl?: string }) => {
    if (!isSuperAdmin) return;
    const permanentUrl = getFileContentUrl(res.fileKey) || res.previewUrl;
    const updated = await api.updateStaffAsync(staff.id, {
      photo: permanentUrl,
      photoFileKey: res.fileKey,
    });
    await fileUploadService.confirmFileAssociation(res.fileKey, {
      type: 'STAFF',
      id: staff.id,
    });
    onStaffUpdated(updated);
    setIsUpdatingPhoto(false);
  };

  const handleStatusChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || isSavingProfileAction) return;
    setIsSavingProfileAction(true);
    setProfileActionError(null);
    try {
      const updated = await api.updateStaffAsync(staff.id, {
        status: pendingStatus as any,
        accountStatus: pendingStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      });
      onStaffUpdated(updated);
      setIsStatusModalOpen(false);
    } catch (err: any) {
      setProfileActionError(err?.message || 'Could not change the status. Please try again.');
    } finally {
      setIsSavingProfileAction(false);
    }
  };

  const handleDocumentUploaded = async (res: any) => {
    if (!isSuperAdmin) return;
    const newDoc: AttachedDocument = {
      id: `doc-${Date.now()}`,
      title: `${newDocType} - ${res.originalFileName.replace(/\.[^/.]+$/, '')}`,
      fileKey: res.fileKey,
      originalFileName: res.originalFileName,
      contentType: res.contentType,
      fileSize: res.fileSize,
      uploadedAt: res.uploadedAt,
    };
    await fileUploadService.confirmFileAssociation(res.fileKey, {
      type: 'STAFF',
      id: staff.id,
    });
    const currentDocs = staff.documents || [];
    try {
      const updated = await api.updateStaffAsync(staff.id, {
        documents: [...currentDocs, newDoc],
      });
      onStaffUpdated(updated);
      setProfileActionError(null);
    } catch (err: any) {
      setProfileActionError(err?.message || 'The document was uploaded but could not be added to the profile.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (doc: AttachedDocument) => {
    if (!isSuperAdmin) return;
    if (window.confirm(`Are you sure you want to delete "${doc.title}"? This cannot be undone.`)) {
      if (doc.fileKey) {
        await fileUploadService.deleteFile(doc.fileKey);
      }
      const updated = api.removeStaffDocument(staff.id, doc.id);
      onStaffUpdated(updated);
    }
  };

  const handleTogglePortal = async () => {
    if (!isSuperAdmin || isSavingProfileAction) return;
    const nextState = !staff.loginEnabled;
    setIsSavingProfileAction(true);
    setProfileActionError(null);
    try {
      const updated = await api.updateStaffAsync(staff.id, {
        loginEnabled: nextState,
        accountStatus: nextState ? 'ACTIVE' : 'INACTIVE',
      });
      onStaffUpdated(updated);
    } catch (err: any) {
      setProfileActionError(err?.message || 'Could not change portal access. Please try again.');
    } finally {
      setIsSavingProfileAction(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !newPassword.trim()) return;
    const result: any = await api.resetStaffPassword(staff.id, newPassword);
    if (!result?.success) {
      setPasswordResetMsg(result?.error || 'The password could not be changed.');
      return;
    }
    setPasswordResetMsg(`Password updated for ${staff.name}`);
    setTimeout(() => {
      setIsResetPasswordOpen(false);
      setPasswordResetMsg(null);
      setNewPassword('');
    }, 1500);
    const updated = api.getStaffById(staff.id);
    if (updated) onStaffUpdated(updated);
  };

  const handleDeleteStaffConfirm = async () => {
    if (!isSuperAdmin || isSavingProfileAction) return;
    setIsSavingProfileAction(true);
    setProfileActionError(null);
    try {
      await api.deleteStaffAsync(staff.id);
      onStaffDeleted(staff.id);
    } catch (err: any) {
      setProfileActionError(err?.message || 'Could not delete the staff member. Please try again.');
    } finally {
      setIsSavingProfileAction(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.reason.trim()) return;
    api.applyStaffLeave({
      staffId: staff.id,
      staffName: staff.name,
      employeeId: staff.employeeId,
      leaveType: leaveForm.leaveType,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      daysCount: Number(leaveForm.days),
      reason: leaveForm.reason.trim(),
      status: 'PENDING',
    });
    setLeaves(api.getStaffLeaves(staff.id));
    setIsApplyLeaveOpen(false);
    setLeaveForm({
      leaveType: 'CASUAL',
      startDate: new Date().toISOString().substring(0, 10),
      endDate: new Date().toISOString().substring(0, 10),
      days: 1,
      reason: '',
    });
  };

  const handleUpdateLeaveStatus = (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!isSuperAdmin && currentUserRole !== 'PRINCIPAL') {
      alert('Only Administrators can approve or reject leave requests.');
      return;
    }
    api.updateStaffLeaveStatus(leaveId, status, 'Principal Office', 'Approved via Staff Registry');
    setLeaves(api.getStaffLeaves(staff.id));
  };

  return (
    <div className="space-y-6 pb-12">
      {profileActionError && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{profileActionError}</span>
          <button type="button" onClick={() => setProfileActionError(null)} className="font-semibold underline shrink-0">
            Dismiss
          </button>
        </div>
      )}
      {/* Top Breadcrumb & Return Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Directory</span>
          </button>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="text-xs text-slate-500 truncate">
            <span>Faculty Directory</span> / <strong className="text-slate-800">{staff.name}</strong>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print/Download Profile */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
            title="Print or Save Profile as PDF"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Profile</span>
          </button>

          {/* ID Card */}
          <button
            type="button"
            onClick={() => {
              setIsIdCardModalOpen(true);
              if (onOpenIdCard) onOpenIdCard(staff);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold transition-colors cursor-pointer"
            title="Generate and Print Digital ID Card"
          >
            <QrCode className="w-4 h-4 text-purple-700" />
            <span>ID Card</span>
          </button>

          {/* View Documents shortcut */}
          <button
            type="button"
            onClick={() => setActiveTab('DOCUMENTS')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold transition-colors"
          >
            <FileCheck className="w-4 h-4 text-blue-700" />
            <span>View Documents ({staff.documents?.length || 0})</span>
          </button>

          {/* Super Admin Actions */}
          {isSuperAdmin && (
            <>
              {/* Reset Password */}
              <button
                type="button"
                onClick={() => {
                  setIsResetPasswordOpen(true);
                  setNewPassword('');
                  setPasswordResetMsg(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold transition-colors"
              >
                <KeyRound className="w-4 h-4 text-amber-700" />
                <span>Reset Password</span>
              </button>

              {/* Resend Credentials */}
              <button
                type="button"
                onClick={handleResendCredentials}
                disabled={isResendingCredentials}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-semibold transition-colors disabled:opacity-50"
                title="Send official login credentials email to staff member"
              >
                {isResendingCredentials ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-700" />
                ) : (
                  <Mail className="w-4 h-4 text-indigo-700" />
                )}
                <span>Resend Credentials</span>
              </button>

              {/* Change Status */}
              <button
                type="button"
                onClick={() => {
                  setPendingStatus(staff.status as any);
                  setIsStatusModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Change Status</span>
              </button>

              {/* Edit Profile */}
              <button
                type="button"
                onClick={onEditProfile}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>

              {/* Delete Staff */}
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors"
                title="Delete Faculty Profile (Super Admin)"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden md:inline">Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Prominent Action Feedback Banner */}
      {resendStatusMsg && (
        <div
          id="staff-credentials-feedback-banner"
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs shadow-xs transition-all animate-fadeIn ${
            resendStatusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : resendStatusMsg.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {resendStatusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : resendStatusMsg.type === 'warning' ? (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-sm">{resendStatusMsg.text}</p>
              {resendStatusMsg.subtext && (
                <p className="text-xs opacity-90 mt-0.5 font-medium">{resendStatusMsg.subtext}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setResendStatusMsg(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-black/5 cursor-pointer transition-colors"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative group shrink-0">
              {staff.photo || staff.photoFileKey ? (
                <img
                  src={
                    staff.photoFileKey
                      ? (getFileContentUrl(staff.photoFileKey) || fileUploadService.getFileUrl(staff.photoFileKey))
                      : (fileUploadService.getFileUrl(staff.photo || ''))
                  }
                  alt={staff.name}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-4 border-white/20 shadow-xl bg-slate-800"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white flex items-center justify-center font-bold text-4xl shadow-xl border-4 border-white/20">
                  {staff.name.charAt(0)}
                </div>
              )}

              {/* Super Admin photo change */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setIsUpdatingPhoto(!isUpdatingPhoto)}
                  className="absolute -bottom-2 -right-2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-full shadow-lg border-2 border-slate-900 transition-transform active:scale-95"
                  title="Update Photo (Super Admin)"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">{staff.name}</h1>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    staff.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : staff.status === 'ON_LEAVE'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {staff.status}
                </span>
                {staff.photo && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Photo Verified
                  </span>
                )}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {staff.loginEnabled !== false ? 'Portal Active' : 'Portal Inactive'}
                </span>
              </div>

              <p className="text-sm text-slate-300 font-medium">
                <span className="font-mono font-bold text-amber-400">{staff.employeeId}</span> •{' '}
                {staff.designation} • {staff.department || 'Academics'} Department
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>{staff.phone}</span>
                </div>
                {staff.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span>{staff.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>Joined {staff.joiningDate}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
            <div className="text-left md:text-right">
              <span className="text-[11px] text-slate-400 block font-medium">School Campus</span>
              <span className="text-xs font-bold text-white tracking-wide">PDS Residential Sheohar</span>
            </div>
            {staff.classTeacherOf && (
              <div className="px-3 py-1.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold text-center">
                Class Teacher of {staff.classTeacherOf}
              </div>
            )}
          </div>
        </div>

        {/* Photo Upload Drawer (Super Admin only) */}
        {isUpdatingPhoto && isSuperAdmin && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-700 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white">
                Faculty Photo Upload & Instant Preview
              </span>
              <button
                type="button"
                onClick={() => setIsUpdatingPhoto(false)}
                className="text-xs text-slate-300 hover:text-white"
              >
                ✕ Close
              </button>
            </div>
            <div className="bg-white rounded-xl p-3 text-slate-900">
              <StaffPhotoUploader
                photo={staff.photo}
                photoFileKey={staff.photoFileKey}
                onChange={(newPhoto, newFileKey) => {
                  if (newFileKey) {
                    handlePhotoUpdated({ fileKey: newFileKey, previewUrl: newPhoto });
                  }
                }}
                label="Staff Photograph"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1 text-xs font-bold text-slate-600 min-w-max">
          {[
            { id: 'OVERVIEW', label: 'Overview', icon: BookOpen },
            { id: 'PERSONAL', label: 'Personal Info', icon: User },
            { id: 'PROFESSIONAL', label: 'Professional Info', icon: GraduationCap },
            { id: 'CLASSES', label: 'Classes & Subjects', icon: Users },
            { id: 'TIMETABLE', label: 'Timetable', icon: Clock },
            { id: 'ATTENDANCE', label: 'Attendance', icon: UserCheck },
            { id: 'LEAVE', label: 'Leave', icon: Calendar },
            { id: 'PAYROLL', label: 'Salary / Payroll', icon: CreditCard },
            { id: 'DOCUMENTS', label: 'Documents', icon: FileText },
            { id: 'PORTAL', label: 'Portal Access', icon: KeyRound },
            { id: 'ACTIVITY', label: 'Activity History', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-700 text-white shadow-xs font-bold'
                    : 'hover:bg-slate-100 hover:text-slate-900 text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6 text-xs text-slate-700">
        {/* ======================================= */}
        {/* 1. OVERVIEW */}
        {/* ======================================= */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                  Weekly Teaching Load
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {teacherSlots.length} Periods
                </div>
                <span className="text-[11px] text-slate-500">Across master schedule</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 block">
                  Class Teacher Role
                </span>
                <div className="text-lg font-black text-slate-900 truncate">
                  {staff.classTeacherOf || 'Subject Faculty'}
                </div>
                <span className="text-[11px] text-slate-500">
                  {staff.classTeacherOf ? 'Assigned Class Incharge' : 'No specific class'}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Monthly Gross Salary
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  ₹{formatSalary(staff.salary, staff.monthlySalary)}
                </div>
                <span className="text-[11px] text-slate-500">School verified payroll</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                  Portal Login Status
                </span>
                <div className="text-lg font-black text-slate-900">
                  {staff.loginEnabled !== false ? 'Active & Enabled' : 'Disabled'}
                </div>
                <span className="text-[11px] text-slate-500">User ID: {staff.employeeId}</span>
              </div>
            </div>

            {/* Overview Detail Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Summary */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>Profile Overview</span>
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Full Name</span>
                    <strong className="text-slate-900">{staff.name}</strong>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Employee ID</span>
                    <span className="font-mono font-bold text-blue-700">{staff.employeeId}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Designation</span>
                    <span className="font-semibold text-slate-800">{staff.designation}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Department</span>
                    <span className="font-semibold text-slate-800">{staff.department || 'Academics'}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Qualification</span>
                    <span className="font-semibold text-slate-800">{staff.qualification}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Total Experience</span>
                    <span className="font-semibold text-slate-800">{staff.totalExperience || `${staff.experienceYears || 0} Years`}</span>
                  </div>
                </div>
              </div>

              {/* Teaching & Subject Highlights */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <span>Subject Expertise & Teaching Allocations</span>
                </h3>

                <div>
                  <span className="text-slate-500 block mb-2 font-medium">Subject Expertise:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(staff.subjectExpertise || staff.specializationSubjects || ['General']).map((sub) => (
                      <span
                        key={sub}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-semibold"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block mb-2 font-medium">Assigned Classes:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(staff.assignedClasses && staff.assignedClasses.length > 0
                      ? staff.assignedClasses
                      : ['Class 10-A', 'Class 9-A']
                    ).map((cls) => (
                      <span
                        key={cls}
                        className="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 font-semibold"
                      >
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block mb-2 font-medium">Assigned Subjects:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(staff.assignedSubjects && staff.assignedSubjects.length > 0
                      ? staff.assignedSubjects
                      : staff.subjectExpertise || ['Science']
                    ).map((sub) => (
                      <span
                        key={sub}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 2. PERSONAL INFORMATION */}
        {/* ======================================= */}
        {activeTab === 'PERSONAL' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span>Personal & Residential Information</span>
              </h3>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Personal Info</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Full Legal Name</span>
                <strong className="text-slate-900">{staff.name}</strong>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Father's Name</span>
                <span className="font-semibold text-slate-800">{staff.fatherName || staff.fatherOrMotherName || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Mother's Name</span>
                <span className="font-semibold text-slate-800">{staff.motherName || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Date of Birth</span>
                <span className="font-semibold text-slate-800">{staff.dob || '1990-01-01'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Gender</span>
                <span className="font-semibold text-slate-800">{staff.gender}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Blood Group</span>
                <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {staff.bloodGroup || 'B+'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Mobile Phone Number</span>
                <span className="font-semibold text-slate-800">{staff.phone}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Alternate Phone</span>
                <span className="font-semibold text-slate-800">{staff.alternatePhone || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Official Email</span>
                <span className="font-semibold text-slate-800">{staff.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Emergency Contact</span>
                <span className="font-semibold text-slate-800">{staff.emergencyContact || staff.phone}</span>
              </div>
            </div>

            {/* Residential / Permanent vs Current Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Residential / Permanent Address</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Permanent</span>
                </div>
                <p className="text-xs text-slate-700 font-medium">
                  {staff.permanentAddress || staff.address || 'Resident Campus, PDS Residential Public School, Sheohar'}
                </p>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 pt-1 border-t border-slate-200/60">
                  <span>District: <strong className="text-slate-800">{staff.permanentCity || staff.city || 'Sheohar'}</strong></span>
                  <span>State: <strong className="text-slate-800">{staff.permanentState || staff.state || 'Bihar'}</strong></span>
                  <span>PIN: <strong className="font-mono text-slate-800">{staff.permanentPincode || staff.pincode || '843329'}</strong></span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Current Address</span>
                  {staff.sameAsPermanentAddress !== false ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Same as Residential
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      Correspondence
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 font-medium">
                  {staff.sameAsPermanentAddress !== false
                    ? (staff.permanentAddress || staff.address || 'Resident Campus, PDS Residential Public School, Sheohar')
                    : (staff.currentAddress || staff.permanentAddress || staff.address || 'Resident Campus, PDS Residential Public School, Sheohar')}
                </p>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 pt-1 border-t border-slate-200/60">
                  <span>District: <strong className="text-slate-800">{staff.currentCity || staff.permanentCity || staff.city || 'Sheohar'}</strong></span>
                  <span>State: <strong className="text-slate-800">{staff.currentState || staff.permanentState || staff.state || 'Bihar'}</strong></span>
                  <span>PIN: <strong className="font-mono text-slate-800">{staff.currentPincode || staff.permanentPincode || staff.pincode || '843329'}</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 3. PROFESSIONAL INFORMATION */}
        {/* ======================================= */}
        {activeTab === 'PROFESSIONAL' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-600" />
                <span>Professional Qualifications & Experience</span>
              </h3>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Professional Info</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Designation</span>
                <strong className="text-slate-900">{staff.designation}</strong>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Department / Wing</span>
                <span className="font-semibold text-slate-800">
                  {staff.department === 'Other' && staff.customDepartment
                    ? `${staff.customDepartment} (Custom)`
                    : (staff.department || 'Academics')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Highest Academic Qualification</span>
                <span className="font-semibold text-slate-800">
                  {staff.qualification === 'Other' && staff.customQualification
                    ? `${staff.customQualification} (Other)`
                    : (staff.qualification || 'Not specified')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Date of Joining</span>
                <span className="font-semibold text-slate-800">{staff.joiningDate}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Employment Type</span>
                <span className="font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {staff.employmentType || 'Full Time'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Total Teaching Experience</span>
                <span className="font-semibold text-slate-800">{staff.totalExperience || `${staff.experienceYears || 0} Years`}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Teaching Workload</span>
                <span className="font-semibold text-slate-800">
                  {staff.teachingWorkload !== undefined ? `${staff.teachingWorkload} periods / week` : 'Standard'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Grades / Classes Qualified to Teach</span>
                <span className="font-semibold text-slate-800">
                  {staff.classesQualifiedToTeach || (Array.isArray(staff.qualifiedClasses) && staff.qualifiedClasses.length > 0 ? staff.qualifiedClasses.join(', ') : 'Not designated')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Professional Certifications</span>
                <span className="font-semibold text-slate-800">
                  {(staff.certificationsList && staff.certificationsList.length > 0)
                    ? staff.certificationsList.map(c => c === 'Other' && staff.customCertification ? staff.customCertification : c).join(', ')
                    : (staff.certifications || 'None')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">House / Club Responsibility</span>
                <span className="font-semibold text-slate-800">
                  {(staff.houseClubResponsibilities && staff.houseClubResponsibilities.length > 0)
                    ? staff.houseClubResponsibilities.map(h => h === 'Other' && staff.customHouseClub ? staff.customHouseClub : h).join(', ')
                    : (staff.houseClubResponsibility || 'None')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 4. ASSIGNED CLASSES & SUBJECTS */}
        {/* ======================================= */}
        {activeTab === 'CLASSES' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Assigned Classes, Sections & Subjects</span>
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Synchronized with Academic Structure & Weekly Master Timetable.
                  </p>
                </div>
                {staff.classTeacherOf && (
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">
                    Class Teacher: {staff.classTeacherOf}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-900">Teaching Classes</h4>
                  <div className="flex flex-wrap gap-2">
                    {(staff.assignedClasses && staff.assignedClasses.length > 0
                      ? staff.assignedClasses
                      : ['Class 10-A', 'Class 9-B', 'Class 11-Science']
                    ).map((c) => (
                      <div
                        key={c}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs font-semibold text-slate-800 flex items-center gap-2"
                      >
                        <DoorOpen className="w-3.5 h-3.5 text-blue-600" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-900">Assigned Subjects</h4>
                  <div className="flex flex-wrap gap-2">
                    {(staff.assignedSubjects && staff.assignedSubjects.length > 0
                      ? staff.assignedSubjects
                      : staff.subjectExpertise || ['Mathematics', 'Physics']
                    ).map((s) => (
                      <div
                        key={s}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs font-semibold text-slate-800 flex items-center gap-2"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 5. TIMETABLE */}
        {/* ======================================= */}
        {activeTab === 'TIMETABLE' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Weekly Faculty Timetable Schedule</span>
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Total teaching load: <strong className="text-blue-700 font-mono">{teacherSlots.length}</strong> periods per week.
                </p>
              </div>
            </div>

            {teacherSlots.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700">No scheduled periods allocated in Master Timetable</p>
                <p className="text-[11px] text-slate-500">
                  Slots assigned under the Academic Timetable section will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Day</th>
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">Timing</th>
                      <th className="py-2.5 px-3">Class & Section</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacherSlots.map((slot) => {
                      const pCfg = ttConfig.periods.find((p) => p.periodNumber === slot.periodNumber);
                      return (
                        <tr key={slot.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {(slot as any).day || slot.dayOfWeek}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-blue-700">
                            Period {slot.periodNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {pCfg ? `${pCfg.startTime} - ${pCfg.endTime}` : (slot.startTime ? `${slot.startTime} - ${slot.endTime}` : `Slot ${slot.periodNumber}`)}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {slot.className} - {slot.section}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-medium">
                              {slot.subjectName || (slot as any).subject || 'Assigned Subject'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500">{slot.roomNumber || 'Default Room'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* 6. ATTENDANCE */}
        {/* ======================================= */}
        {activeTab === 'ATTENDANCE' && (
          <div className="space-y-4">
            <AttendanceCalendar
              type="STAFF"
              staffId={staff.id}
              employeeId={staff.employeeId}
              staffName={staff.name}
              records={(api.getStaffAttendance() || []).filter(
                (a) =>
                  a.staffId === staff.id ||
                  (staff.employeeId && (a.employeeId === staff.employeeId || a.staffId === staff.employeeId))
              )}
              leaves={leaves}
              holidays={api.getHolidays()}
            />
          </div>
        )}

        {/* ======================================= */}
        {/* 7. LEAVE MANAGEMENT */}
        {/* ======================================= */}
        {activeTab === 'LEAVE' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>Leave Balances & History</span>
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Faculty leave ledger with application history and admin approvals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Apply Leave</span>
                </button>
              </div>

              {/* Leave Balances */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-700 uppercase">Casual Leave (CL)</span>
                  <div className="text-xl font-black text-blue-950 font-mono mt-0.5">8 / 12</div>
                  <span className="text-[10px] text-blue-600">4 days used</span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Medical / Sick (SL)</span>
                  <div className="text-xl font-black text-emerald-950 font-mono mt-0.5">10 / 10</div>
                  <span className="text-[10px] text-emerald-600">0 days used</span>
                </div>
                <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200">
                  <span className="text-[10px] font-bold text-purple-700 uppercase">Earned Leave (EL)</span>
                  <div className="text-xl font-black text-purple-950 font-mono mt-0.5">15 / 15</div>
                  <span className="text-[10px] text-purple-600">Available</span>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Duty Leave (DL)</span>
                  <div className="text-xl font-black text-amber-950 font-mono mt-0.5">2</div>
                  <span className="text-[10px] text-amber-600">Official duties</span>
                </div>
              </div>

              {/* Leaves Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">From</th>
                      <th className="py-2.5 px-3">To</th>
                      <th className="py-2.5 px-3">Days</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaves.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-400">
                          No leave requests recorded for this faculty member.
                        </td>
                      </tr>
                    ) : (
                      leaves.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">{l.leaveType}</td>
                          <td className="py-2 px-3">{l.startDate}</td>
                          <td className="py-2 px-3">{l.endDate}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{l.daysCount}</td>
                          <td className="py-2 px-3 text-slate-600 max-w-xs truncate">{l.reason}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                l.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : l.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {l.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            {l.status === 'PENDING' && (isSuperAdmin || currentUserRole === 'PRINCIPAL') && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateLeaveStatus(l.id, 'APPROVED')}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateLeaveStatus(l.id, 'REJECTED')}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Apply Leave Modal */}
            {isApplyLeaveOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h4 className="font-bold text-slate-900">Apply Leave for {staff.name}</h4>
                    <button
                      type="button"
                      onClick={() => setIsApplyLeaveOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleApplyLeave} className="space-y-3">
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Leave Type</label>
                      <select
                        value={leaveForm.leaveType}
                        onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value as any })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="CASUAL">Casual Leave (CL)</option>
                        <option value="SICK">Sick / Medical Leave (SL)</option>
                        <option value="EARNED">Earned Leave (EL)</option>
                        <option value="MATERNITY">Maternity / Paternity Leave</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">Start Date</label>
                        <input
                          type="date"
                          value={leaveForm.startDate}
                          onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">End Date</label>
                        <input
                          type="date"
                          value={leaveForm.endDate}
                          onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Number of Days</label>
                      <input
                        type="number"
                        min="1"
                        value={leaveForm.days}
                        onChange={(e) => setLeaveForm({ ...leaveForm, days: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Reason for Leave *</label>
                      <textarea
                        required
                        rows={2}
                        value={leaveForm.reason}
                        onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                        placeholder="State clear official reason..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsApplyLeaveOpen(false)}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold"
                      >
                        Submit Leave Application
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* 8. SALARY / PAYROLL */}
        {/* ======================================= */}
        {activeTab === 'PAYROLL' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>Salary Structure & Bank Details</span>
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Controlled payroll access adhering to institutional compensation regulations.
                </p>
              </div>

            </div>

            {/* Top Cards: Configured Salary and UAN Number only */}
            {(() => {
              const configuredSalary =
                typeof staff.monthlySalary === 'number' && staff.monthlySalary > 0
                  ? staff.monthlySalary
                  : typeof staff.salary === 'number' && staff.salary > 0
                  ? staff.salary
                  : typeof staff.salary === 'object' && (staff.salary.net || staff.salary.basic || staff.salary.monthly)
                  ? Number(staff.salary.net || staff.salary.basic || staff.salary.monthly)
                  : 0;
              const latestSlip = payrollHistory[0] || null;

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Configured Monthly Salary
                      </span>
                      <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                        {configuredSalary > 0 ? `₹${configuredSalary.toLocaleString('en-IN')}` : 'Not set'}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Full institutional monthly compensation
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase">
                        UAN Number
                      </span>
                      <div className="text-base font-bold text-emerald-950 font-mono mt-1">
                        {staff.uanNumber || 'Not configured'}
                      </div>
                      <span className="text-[10px] text-emerald-600">Universal Account Number</span>
                    </div>
                  </div>

                  {/* Current Month's Payroll Status */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                          Current Month's Payroll Status
                        </span>
                        <h4 className="text-base font-bold text-slate-900">
                          {latestSlip ? latestSlip.month : 'No salary calculated yet'}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {latestSlip ? (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                              latestSlip.paymentStatus === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {latestSlip.paymentStatus === 'PAID' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>PAID</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>PENDING</span>
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                            AWAITING AUTOMATED GENERATION
                          </span>
                        )}

                        {latestSlip && (
                          <button
                            type="button"
                            onClick={() => setSelectedPrintRecord(latestSlip)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Salary Slip</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {latestSlip ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold">Salary Period</span>
                          <strong className="text-slate-800 block mt-0.5 font-mono text-[11px]">
                            {latestSlip.salaryPeriodStart} to {latestSlip.salaryPeriodEnd}
                          </strong>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold">Gross / Eligible</span>
                          <strong className="text-slate-900 block mt-0.5 font-mono text-sm">
                            ₹{(latestSlip.monthlySalary || configuredSalary).toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-rose-500 block font-semibold">Late Deductions</span>
                          <strong className="text-rose-700 block mt-0.5 font-mono text-sm">
                            -₹{(latestSlip.lateDeduction || 0).toLocaleString('en-IN')}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({latestSlip.lateDays || 0} late days)
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-rose-500 block font-semibold">Absent / Not Marked</span>
                          <strong className="text-rose-700 block mt-0.5 font-mono text-sm">
                            -₹{((latestSlip.unpaidLeaveDeduction || 0) + ((latestSlip as any).notMarkedDeduction || 0)).toLocaleString('en-IN')}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({latestSlip.unpaidLeaveDays || 0} absent/leave
                            {(latestSlip as any).notMarkedDays ? `, ${(latestSlip as any).notMarkedDays} not marked` : ''})
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold">Other Deductions</span>
                          <strong className="text-slate-700 block mt-0.5 font-mono text-sm">
                            -₹{(latestSlip.otherDeductions || 0).toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                          <span className="text-[10px] text-emerald-700 block font-bold uppercase">Net Payable</span>
                          <strong className="text-emerald-950 block mt-0.5 font-mono text-base font-black">
                            ₹{(latestSlip.netSalary || 0).toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 col-span-2 sm:col-span-3">
                          <span className="text-[10px] text-slate-400 block font-semibold">Disbursement Details</span>
                          <div className="text-[11px] text-slate-700 mt-0.5 space-x-2">
                            <span>Mode: <strong>{latestSlip.paymentMethod || 'BANK_TRANSFER'}</strong></span>
                            <span>•</span>
                            <span>Ref: <strong className="font-mono">{latestSlip.transactionReference || latestSlip.salarySlipNumber}</strong></span>
                            <span>•</span>
                            <span>Date: <strong>{latestSlip.paymentDate || 'Pending'}</strong></span>
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 col-span-2 sm:col-span-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailRecord(latestSlip)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Breakdown</span>
                          </button>
                          {isSuperAdmin && latestSlip.paymentStatus !== 'PAID' && (
                            <button
                              type="button"
                              onClick={() => setSelectedPayRecord(latestSlip)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Mark as Paid</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Monthly payroll for active employees is automatically generated on the 1st of each month at 12:00 AM IST based on attendance records and configured deductions.
                      </p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Banking & Statutory Details */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
              <h4 className="font-bold text-slate-900">Direct Deposit & Banking Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Bank Account Number:</span>
                  <strong className="font-mono text-slate-900">{staff.bankAccountNo || '501004928192'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Bank Name & Branch:</span>
                  <span className="font-semibold text-slate-800">{staff.bankName || 'State Bank of India'}, {staff.bankBranch || 'Sheohar Main'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">IFSC Code:</span>
                  <strong className="font-mono text-slate-900">{staff.ifscCode || 'SBIN0001234'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">PAN Number:</span>
                  <strong className="font-mono text-slate-900">{staff.panNumber || 'ABCDE1234F'}</strong>
                </div>
              </div>
            </div>

            {/* Salary Disbursement History */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900">Historical Payroll Records & Slips</h4>
                <span className="text-xs text-slate-400 font-medium">{payrollHistory.length} recorded</span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Month</th>
                      <th className="py-2.5 px-3">Gross Salary</th>
                      <th className="py-2.5 px-3 text-rose-700">Late Ded.</th>
                      <th className="py-2.5 px-3 text-rose-700">Leave Ded.</th>
                      <th className="py-2.5 px-3 font-bold text-emerald-800">Net Payable</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Payment Date</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payrollHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400">
                          No previous salary slips generated for this academic session.
                        </td>
                      </tr>
                    ) : (
                      payrollHistory.map((pay) => (
                        <tr key={pay.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">{pay.month}</td>
                          <td className="py-2 px-3 font-mono">₹{(pay.monthlySalary || pay.grossSalary || 0).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 font-mono text-rose-600">
                            {pay.lateDeduction ? `-₹${pay.lateDeduction.toLocaleString('en-IN')}` : '₹0'}
                          </td>
                          <td className="py-2 px-3 font-mono text-rose-600">
                            {(pay.unpaidLeaveDeduction || 0) + (pay.notMarkedDeduction || 0)
                              ? `-₹${((pay.unpaidLeaveDeduction || 0) + (pay.notMarkedDeduction || 0)).toLocaleString('en-IN')}`
                              : '₹0'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                            ₹{(pay.netSalary || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                pay.paymentStatus === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {pay.paymentStatus}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                            {pay.paymentDate || 'Pending'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title="View Breakdown"
                                onClick={() => setSelectedDetailRecord(pay)}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Print Salary Slip"
                                onClick={() => setSelectedPrintRecord(pay)}
                                className="p-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              {isSuperAdmin && pay.paymentStatus !== 'PAID' && (
                                <button
                                  type="button"
                                  title="Mark as Paid"
                                  onClick={() => setSelectedPayRecord(pay)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                                >
                                  Pay
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ======================================= */}
        {/* 9. DOCUMENTS */}
        {/* ======================================= */}
        {activeTab === 'DOCUMENTS' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Staff Documents</span>
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Official certificates and verification documents: Aadhaar, Degrees, Experience Letters, and Appointment Orders.
                </p>
              </div>

              {/* Super Admin Document Upload */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setIsUploadingDoc(!isUploadingDoc)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              )}
            </div>

            {/* Document Upload Area (Super Admin only) */}
            {isUploadingDoc && isSuperAdmin && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Upload New Staff Document</span>
                  <button
                    type="button"
                    onClick={() => setIsUploadingDoc(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Document Category</label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mb-3"
                  >
                    <option value="Aadhaar / National ID Proof">Aadhaar / National ID Proof</option>
                    <option value="Qualification Degree / Marksheet">Qualification Degree / Marksheet</option>
                    <option value="Teaching Experience Certificate">Teaching Experience Certificate</option>
                    <option value="Official Appointment / Joining Letter">Official Appointment / Joining Letter</option>
                    <option value="B.Ed / CTET Certificate">B.Ed / CTET Certificate</option>
                    <option value="Other Official Document">Other Official Document</option>
                  </select>
                </div>
                <FileUploadComponent
                  uploadType="teacher-document"
                  onUploadComplete={handleDocumentUploaded}
                />
              </div>
            )}

            {/* Documents List */}
            {(!staff.documents || staff.documents.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700">No documents uploaded</p>
                <p className="text-[11px] text-slate-500">
                  {isSuperAdmin
                    ? 'Use the "Upload Document" button to attach official records.'
                    : 'Documents uploaded by the Administrator will appear here.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-xs truncate">{doc.title}</h4>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {doc.originalFileName} • {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'Verified Record'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* View / Eye Icon button */}
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDoc(doc)}
                        className="p-2 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 text-blue-700 transition-colors"
                        title="View Document Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Download button */}
                      <button
                        type="button"
                        onClick={async () => {
                          const url = await fileUploadService.getDownloadUrl(doc.fileKey);
                          if (url) {
                            const a = document.createElement('a');
                            a.href = url;
                            a.target = '_blank';
                            a.rel = 'noopener noreferrer';
                            a.download = doc.originalFileName || 'document';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }
                        }}
                        className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                        title="Download Document"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Delete Document (Super Admin only) */}
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc)}
                          className="p-2 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 transition-colors"
                          title="Delete Document (Super Admin only)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* 10. PORTAL ACCESS & CREDENTIALS */}
        {/* ======================================= */}
        {activeTab === 'PORTAL' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-purple-600" />
                  <span>Portal Login & Account</span>
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Staff member login account details and access status.
                </p>
              </div>

              {/* Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  staff.loginEnabled !== false
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                {staff.loginEnabled !== false ? 'PORTAL LOGIN ACTIVE' : 'PORTAL ACCESS DISABLED'}
              </span>
            </div>

            {/* Portal Overview Card */}
            <div className="p-5 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">Login User ID:</span>
                  <strong className="font-mono text-sm text-purple-950 font-bold">{staff.employeeId}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Assigned Role:</span>
                  <span className="font-bold text-slate-900">{staff.systemRole || staff.role || 'TEACHER'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Contact Phone:</span>
                  <span className="font-semibold text-slate-900">{staff.phone}</span>
                </div>
              </div>

              {/* Super Admin Toggle */}
              {isSuperAdmin ? (
                <div className="pt-3 border-t border-purple-200/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Portal Access Status</span>
                    <span className="text-[11px] text-slate-500">
                      Grant or revoke {staff.name}'s login access to the school portal.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTogglePortal}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      staff.loginEnabled !== false
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-purple-700 hover:bg-purple-800 text-white'
                    }`}
                  >
                    {staff.loginEnabled !== false ? 'Revoke Portal Access' : 'Enable Portal Access'}
                  </button>
                </div>
              ) : (
                <div className="pt-2 text-[11px] text-slate-500 italic">
                  Note: Only Administrators can modify portal access or update login credentials.
                </div>
              )}
            </div>

            {/* Send / Resend Login Credentials Email */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span>Official Account Credentials Email</span>
                  </h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Send an official welcome and login credentials email containing Portal User ID, Employee ID, Login URL, and initial instructions to the staff member's registered email address ({staff.email || 'No email registered'}).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResendCredentials}
                  disabled={isResendingCredentials}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xl font-bold text-xs transition-colors inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {isResendingCredentials ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-700" />
                  ) : (
                    <Mail className="w-4 h-4 text-indigo-700" />
                  )}
                  <span>Send Credentials Email</span>
                </button>
              </div>

              {resendStatusMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    resendStatusMsg.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : resendStatusMsg.type === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {resendStatusMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : resendStatusMsg.type === 'warning' ? (
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{resendStatusMsg.text}</span>
                </div>
              )}
            </div>

            {/* Password Reset (Super Admin only) */}
            {isSuperAdmin && (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Reset Password
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Directly set a new password for {staff.name}.
                </p>

                {passwordResetMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{passwordResetMsg}</span>
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (e.g. Teacher@2026)"
                    className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors shrink-0"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* 11. ACTIVITY & AUDIT TRAIL */}
        {/* ======================================= */}
        {activeTab === 'ACTIVITY' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>Activity History</span>
            </h3>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white p-4">
              {[
                {
                  action: 'Faculty Profile Viewed & Verified',
                  actor: 'School Administration',
                  time: 'Just now',
                  icon: ShieldCheck,
                  color: 'text-blue-600',
                },
                {
                  action: `Class Teacher Role: ${staff.classTeacherOf || 'Assigned'}`,
                  actor: 'Academic Incharge',
                  time: 'Academic Session 2026-2027',
                  icon: UserCheck,
                  color: 'text-purple-600',
                },
                {
                  action: 'Timetable Slots Updated',
                  actor: 'Academic Incharge',
                  time: '1 day ago',
                  icon: Clock,
                  color: 'text-emerald-600',
                },
                {
                  action: 'Staff Documents Verified',
                  actor: 'Administrative Office',
                  time: 'Active',
                  icon: FileCheck,
                  color: 'text-indigo-600',
                },
              ].map((item, i) => (
                <div key={i} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <item.icon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color}`} />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 text-xs">{item.action}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Updated by {item.actor} • {item.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Super Admin Status Change Modal */}
      {isStatusModalOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm">Change Faculty Status for {staff.name}</h4>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleStatusChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-medium text-xs mb-1.5">Select New Status</label>
                <select
                  value={pendingStatus}
                  onChange={(e) => setPendingStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                >
                  <option value="ACTIVE">ACTIVE (On Duty)</option>
                  <option value="ON_LEAVE">ON_LEAVE (Temporary Approved Leave)</option>
                  <option value="RESIGNED">RESIGNED (Voluntarily Left)</option>
                  <option value="SUSPENDED">SUSPENDED (Disciplinary Hold)</option>
                  <option value="LEFT_SCHOOL">LEFT_SCHOOL (Archived Record)</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500">
                Updating status will immediately reflect on active faculty rosters, timetable slot availability, and portal login permissions.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
                >
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Password Reset Modal */}
      {isResetPasswordOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm">Reset Password for {staff.name}</h4>
              <button
                type="button"
                onClick={() => setIsResetPasswordOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            {passwordResetMsg ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-semibold flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordResetMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-medium text-xs mb-1.5">New Master Password</label>
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="e.g. Teacher@2026"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Staff user ID remains: <strong className="font-mono">{staff.employeeId}</strong>
                  </span>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold"
                  >
                    Save Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Super Admin Delete Staff Confirmation Modal */}
      {isDeleteModalOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-rose-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-2 rounded-xl bg-rose-100">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Delete Faculty Record?</h4>
                <p className="text-xs text-rose-600">Super Administrator Privileged Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete <strong>{staff.name}</strong> (Employee ID:{' '}
              <span className="font-mono font-bold text-slate-900">{staff.employeeId}</span>)?
              This will remove their profile, timetable allocations, and document associations from the system.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStaffConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(selectedPreviewDoc)}
        onClose={() => setSelectedPreviewDoc(null)}
        document={selectedPreviewDoc}
      />

      {/* Salary Breakdown Modal */}
      {selectedDetailRecord && (
        <SalaryDetailModal
          isOpen={!!selectedDetailRecord}
          onClose={() => setSelectedDetailRecord(null)}
          record={selectedDetailRecord}
          canManage={isSuperAdmin}
          onMarkPaidClick={(rec) => {
            setSelectedDetailRecord(null);
            setSelectedPayRecord(rec);
          }}
          onPrintClick={(rec) => {
            setSelectedDetailRecord(null);
            setSelectedPrintRecord(rec);
          }}
        />
      )}

      {/* Printable Salary Slip Modal */}
      {selectedPrintRecord && (
        <PrintableSalarySlipModal
          isOpen={!!selectedPrintRecord}
          onClose={() => setSelectedPrintRecord(null)}
          record={selectedPrintRecord}
          staff={staff}
          settings={settings}
        />
      )}

      {/* Mark Salary Paid Modal */}
      {selectedPayRecord && (
        <MarkSalaryPaidModal
          isOpen={!!selectedPayRecord}
          onClose={() => setSelectedPayRecord(null)}
          record={selectedPayRecord}
          onSuccess={(updated) => {
            setPayrollHistory((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }}
        />
      )}

      {/* Staff ID Card Modal */}
      {isIdCardModalOpen && (
        <PrintableIdCardModal
          staff={staff}
          isOpen={isIdCardModalOpen}
          onClose={() => setIsIdCardModalOpen(false)}
          settings={settings}
        />
      )}
    </div>
  );
};
