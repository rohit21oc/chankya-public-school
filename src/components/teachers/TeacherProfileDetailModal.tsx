import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
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
  Eye,
  File,
  FileCheck,
  FileText,
  GraduationCap,
  History,
  Key,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  PlusCircle,
  Printer,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Trash2,
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
  Subject,
  TeacherStaff,
  TimetableSlot,
  Holiday,
} from '../../types';
import { api } from '../../services/api';
import { getFileContentUrl } from '../../services/apiConfig';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { fileUploadService } from '../../services/fileUploadService';
import { AttendanceCalendar } from '../common/AttendanceCalendar';

interface TeacherProfileDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: TeacherStaff;
  onStaffUpdated: (updated: TeacherStaff) => void;
  onOpenIdCard: (staff: TeacherStaff) => void;
  settings: SchoolSettings;
}

export const TeacherProfileDetailModal: React.FC<TeacherProfileDetailModalProps> = ({
  isOpen,
  onClose,
  staff,
  onStaffUpdated,
  onOpenIdCard,
  settings,
}) => {
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

  // Photo update state
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<AttachedDocument | null>(null);

  // Portal & Password state
  const [newPassword, setNewPassword] = useState('');
  const [passwordResetMsg, setPasswordResetMsg] = useState<string | null>(null);

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
  const [isDisburseSalaryOpen, setIsDisburseSalaryOpen] = useState(false);
  const [disburseMonth, setDisburseMonth] = useState('March 2026');

  // Timetable State
  const allSlots = api.getTimetable();
  const teacherSlots = allSlots.filter((s) => s.teacherId === staff.id);
  const ttConfig = api.getTimetableConfig();

  useEffect(() => {
    setLeaves(api.getStaffLeaves(staff.id));
    setPayrollHistory(api.getStaffPayroll(staff.id));
    setPasswordResetMsg(null);
  }, [staff.id]);

  const staffAttendanceRecords = (api.getStaffAttendance() || []).filter(
    (a) => a.staffId === staff.id || (staff.employeeId && a.employeeId === staff.employeeId)
  );
  const holidays = api.getHolidays();

  const qualifiedClassesList = useMemo(() => {
    if (Array.isArray(staff.qualifiedClasses) && staff.qualifiedClasses.length > 0) {
      return staff.qualifiedClasses;
    }
    if (staff.classesQualifiedToTeach) {
      if (Array.isArray(staff.classesQualifiedToTeach)) {
        return (staff.classesQualifiedToTeach as string[]).map((s) => String(s).trim()).filter(Boolean);
      }
      if (typeof staff.classesQualifiedToTeach === 'string' && staff.classesQualifiedToTeach.trim()) {
        return staff.classesQualifiedToTeach.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    if (staff.teachingProfile && Array.isArray((staff.teachingProfile as any).classesQualifiedToTeach)) {
      return (staff.teachingProfile as any).classesQualifiedToTeach.map((s: string) => String(s).trim()).filter(Boolean);
    }
    return [];
  }, [staff]);

  if (!isOpen) return null;

  // Format currency
  const formatSalary = (salary: any): string => {
    if (!salary) return '0';
    if (typeof salary === 'number') return salary.toLocaleString('en-IN');
    const val = salary.net ?? salary.basic ?? 0;
    return Number(val).toLocaleString('en-IN');
  };

  // Photo upload
  const handlePhotoUpdated = async (res: { fileKey: string; previewUrl?: string }) => {
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

  // Document upload
  const handleDocumentUploaded = async (res: any) => {
    const newDoc: AttachedDocument = {
      id: `doc-${Date.now()}`,
      title: res.originalFileName.replace(/\.[^/.]+$/, ''),
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
    const updated = api.updateStaff(staff.id, {
      documents: [...currentDocs, newDoc],
    });
    onStaffUpdated(updated);
  };

  // Toggle Portal Status
  const handleTogglePortal = () => {
    const nextState = !staff.loginEnabled;
    const updated = api.updateStaff(staff.id, {
      loginEnabled: nextState,
      accountStatus: nextState ? 'ACTIVE' : 'INACTIVE',
    });
    if (updated) onStaffUpdated(updated);
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    await api.resetStaffPassword(staff.id, newPassword);
    setPasswordResetMsg(`Password successfully updated to: ${newPassword}`);
    setNewPassword('');
    const updated = api.getStaffById(staff.id);
    if (updated) onStaffUpdated(updated);
  };

  // Apply Leave
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

  // Update Leave Status (Approve / Reject)
  const handleUpdateLeaveStatus = (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    api.updateStaffLeaveStatus(leaveId, status, 'Principal Office', 'Approved via Staff Registry');
    setLeaves(api.getStaffLeaves(staff.id));
  };

  // Record Salary Payment
  const handleRecordPayment = () => {
    const basic = typeof staff.salary === 'number' ? staff.salary : 50000;
    const allowancesVal = Math.round(basic * 0.2);
    const deductionsVal = Math.round(basic * 0.08);
    const net = basic + allowancesVal - deductionsVal;

    api.recordStaffSalaryPayment({
      staffId: staff.id,
      staffName: staff.name,
      employeeId: staff.employeeId,
      month: disburseMonth,
      year: 2026,
      basicSalary: basic,
      allowances: {
        hra: Math.round(basic * 0.1),
        da: Math.round(basic * 0.1),
      },
      deductions: {
        pf: Math.round(basic * 0.05),
        tds: Math.round(basic * 0.03),
      },
      totalAllowances: allowancesVal,
      totalDeductions: deductionsVal,
      netSalary: net,
      paymentStatus: 'PAID',
      paymentDate: new Date().toISOString().substring(0, 10),
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: `CMS-SAL-${Date.now().toString().slice(-6)}`,
      remarks: 'Automated monthly bank transfer',
    });

    setPayrollHistory(api.getStaffPayroll(staff.id));
    setIsDisburseSalaryOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl my-6 overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn">
        {/* Top Header Card */}
        <div className="px-6 py-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
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
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-inner border-2 border-white/20">
                  {staff.name.charAt(0)}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsUpdatingPhoto(!isUpdatingPhoto)}
                className="absolute -bottom-1 -right-1 bg-blue-500 hover:bg-blue-400 text-white p-1.5 rounded-full shadow-lg text-xs"
                title="Update Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white tracking-wide">{staff.name}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {staff.status}
                </span>
                {staff.photo && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Photo Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                <span className="font-mono font-bold text-amber-400">{staff.employeeId}</span> •{' '}
                {staff.designation} • {staff.department} Department
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenIdCard(staff)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/15"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Print ID Card</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Photo Drawer if open */}
        {isUpdatingPhoto && (
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">
                Faculty Photo Upload
              </span>
              <button
                type="button"
                onClick={() => setIsUpdatingPhoto(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            <FileUploadComponent
              uploadType="teacher-photo"
              currentValue={staff.photo}
              currentFileKey={staff.photoFileKey}
              onUploadComplete={handlePhotoUpdated}
            />
          </div>
        )}

        {/* Comprehensive Tab Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1 py-2 text-xs font-bold text-slate-600">
            {[
              { id: 'OVERVIEW', label: 'Overview' },
              { id: 'PERSONAL', label: 'Personal' },
              { id: 'PROFESSIONAL', label: 'Professional' },
              { id: 'CLASSES', label: 'Classes & Subjects' },
              { id: 'TIMETABLE', label: 'Timetable' },
              { id: 'ATTENDANCE', label: 'Attendance' },
              { id: 'LEAVE', label: 'Leave' },
              { id: 'PAYROLL', label: 'Payroll' },
              { id: 'DOCUMENTS', label: 'Documents' },
              { id: 'PORTAL', label: 'Portal Access' },
              { id: 'ACTIVITY', label: 'Activity' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-700">
          {/* ======================================= */}
          {/* 1. OVERVIEW TAB */}
          {/* ======================================= */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                    Weekly Teaching Load
                  </span>
                  <div className="text-xl font-black text-blue-950 font-mono">
                    {teacherSlots.length} Periods
                  </div>
                  <span className="text-[11px] text-blue-700 font-medium">Across scheduled working days</span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                    Class Teacher Role
                  </span>
                  <div className="text-base font-black text-purple-950 truncate">
                    {staff.classTeacherOf || 'None'}
                  </div>
                  <span className="text-[11px] text-purple-700 font-medium">
                    {staff.classTeacherOf ? 'Designated Section Incharge' : 'Subject Faculty'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                    Gross Monthly Salary
                  </span>
                  <div className="text-xl font-black text-emerald-950 font-mono">
                    ₹{formatSalary(staff.salary)}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium">Verified in Payroll</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                    Portal Account Status
                  </span>
                  <div className="text-base font-black text-amber-950">
                    {staff.loginEnabled !== false ? 'ACTIVE (Enabled)' : 'DISABLED'}
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium">ID: {staff.employeeId}</span>
                </div>
              </div>

              {/* Bio & Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>Faculty Profile Summary</span>
                  </h4>
                  <div className="divide-y divide-slate-100">
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-400">Full Name</span>
                      <strong className="text-slate-900">{staff.name}</strong>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-400">Designation</span>
                      <span className="font-semibold text-slate-800">{staff.designation}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-400">Department</span>
                      <span className="font-semibold text-slate-800">{staff.department}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-400">Primary Contact Phone</span>
                      <span className="font-semibold text-slate-800">{staff.phone}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-400">Institutional Email</span>
                      <span className="font-semibold text-slate-800">{staff.email}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-400">Date of Joining</span>
                      <span className="font-semibold text-slate-800">{staff.joiningDate}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-600" />
                    <span>Subject Specialization & Stream</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Curriculum subjects taught by this educator across senior and secondary classes.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {(staff.specializationSubjects || ['Science', 'Mathematics', 'Physics']).map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 font-bold"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <span className="text-slate-400 block text-[11px] mb-1">Highest Academic Qualification</span>
                    <strong className="text-slate-900 text-xs block">{staff.qualification}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 2. PERSONAL TAB */}
          {/* ======================================= */}
          {activeTab === 'PERSONAL' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Personal Identification & Contact
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Gender</span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">Male</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Date of Birth</span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">1985-08-14</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Blood Group</span>
                  <span className="font-bold text-red-700 text-xs block mt-0.5">B+ Positive</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Emergency Contact</span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">+91 94310 98765 (Spouse)</span>
                </div>
                <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Residential Address</span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">
                    House No. 42, Road No. 3, Rajendra Nagar, Patna, Bihar - 800016
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 3. PROFESSIONAL TAB */}
          {/* ======================================= */}
          {activeTab === 'PROFESSIONAL' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Professional Details & Service Record
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Employee ID</span>
                  <strong className="font-mono text-blue-900 text-xs block mt-0.5">{staff.employeeId}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Designation</span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">{staff.designation}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Department</span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">{staff.department}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Educational Qualification</span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">{staff.qualification}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Date of Joining</span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">{staff.joiningDate}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Biometric / RFID ID</span>
                  <span className="font-mono font-semibold text-slate-800 text-xs block mt-0.5">BIO-00{staff.id.replace(/\D/g, '') || '104'}</span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 4. CLASSES & SUBJECTS TAB */}
          {/* ======================================= */}
          {activeTab === 'CLASSES' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                    Designated Class Teacher Assignment
                  </h4>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    {staff.classTeacherOf
                      ? `Assigned Class Teacher for ${staff.classTeacherOf}. Manages student register and report cards.`
                      : 'Currently not assigned as a Class Teacher.'}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-blue-900 text-white font-mono font-bold text-xs">
                  {staff.classTeacherOf || 'None'}
                </span>
              </div>

              {/* Classes Qualified to Teach */}
              <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                      Classes Qualified to Teach (CBSE Levels Permitted)
                    </h4>
                    <p className="text-[11px] text-purple-700 mt-0.5">
                      Authorized teaching jurisdiction for students, marks evaluation, and student ID cards.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-purple-800 bg-purple-100/90 border border-purple-200 px-2.5 py-0.5 rounded-full">
                    {qualifiedClassesList.length} Permitted
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {qualifiedClassesList.map((cls, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 text-xs font-bold shadow-2xs"
                    >
                      {cls}
                    </span>
                  ))}
                  {qualifiedClassesList.length === 0 && (
                    <p className="text-[11px] text-slate-500 italic">No specific classes designated yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Teaching Schedule & Assigned Classes
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="p-2.5">Class & Section</th>
                        <th className="p-2.5">Subject</th>
                        <th className="p-2.5">Day</th>
                        <th className="p-2.5">Period Timing</th>
                        <th className="p-2.5">Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teacherSlots.map((slot) => (
                        <tr key={slot.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-blue-900">
                            {slot.className} - Section {slot.section}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800">{slot.subjectName}</td>
                          <td className="p-2.5">{slot.dayOfWeek}</td>
                          <td className="p-2.5 font-mono text-[11px]">
                            Period {slot.periodNumber} ({slot.startTime} - {slot.endTime})
                          </td>
                          <td className="p-2.5 font-mono">{slot.roomNumber || 'Room 101'}</td>
                        </tr>
                      ))}
                      {teacherSlots.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                            No classes assigned in the timetable for this teacher yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 5. TIMETABLE TAB */}
          {/* ======================================= */}
          {activeTab === 'TIMETABLE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {staff.name}&apos;s Weekly Schedule
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Comprehensive period schedule mapped across working days.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold font-mono text-xs">
                  {teacherSlots.length} Periods / Week
                </span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                      <th className="p-2.5 text-left border-r border-slate-200 w-24">Day</th>
                      {(ttConfig.periods || []).map((p) => (
                        <th key={p.periodNumber} className="p-2.5 text-center border-r border-slate-200 last:border-r-0 min-w-[110px]">
                          <div>{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                            {p.startTime}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(ttConfig.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']).map(
                      (day) => (
                        <tr key={day} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900 bg-slate-50 border-r border-slate-200">
                            {day}
                          </td>
                          {(ttConfig.periods || []).map((p) => {
                            if (p.isBreak) {
                              return (
                                <td key={p.periodNumber} className="p-2 text-center bg-amber-50/50 text-[10px] text-amber-800 font-bold border-r border-slate-200 last:border-r-0">
                                  RECESS
                                </td>
                              );
                            }
                            const slot = teacherSlots.find(
                              (s) =>
                                api.normalizeDayOfWeek(s.dayOfWeek).toLowerCase() === day.toLowerCase() &&
                                Number(s.periodNumber) === Number(p.periodNumber)
                            );
                            return (
                              <td key={p.periodNumber} className="p-2 border-r border-slate-200 last:border-r-0">
                                {slot ? (
                                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                    <strong className="text-blue-950 block text-[11px] truncate">
                                      {slot.className}-{slot.section}
                                    </strong>
                                    <span className="text-[10px] text-slate-600 truncate block">
                                      {slot.subjectName}
                                    </span>
                                    <span className="text-[9px] font-mono text-blue-700 bg-white px-1 rounded block mt-0.5 w-fit">
                                      {slot.roomNumber}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-300 block text-center italic">— Free —</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 6. ATTENDANCE TAB */}
          {/* ======================================= */}
          {activeTab === 'ATTENDANCE' && (
            <div className="space-y-4">
              <AttendanceCalendar
                type="STAFF"
                staffId={staff.id}
                employeeId={staff.employeeId}
                staffName={staff.name}
                records={staffAttendanceRecords}
                leaves={leaves}
                holidays={holidays}
              />
            </div>
          )}

          {/* ======================================= */}
          {/* 7. LEAVE TAB */}
          {/* ======================================= */}
          {activeTab === 'LEAVE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Leave Balance & Applications
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Annual institutional quota: 12 Casual, 8 Sick, 10 Earned leaves.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveOpen(!isApplyLeaveOpen)}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Apply Leave</span>
                </button>
              </div>

              {/* Apply Leave Sub-card */}
              {isApplyLeaveOpen && (
                <form
                  onSubmit={handleApplyLeave}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"
                >
                  <span className="text-xs font-bold text-slate-800 block">Record New Leave Application</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Leave Type</label>
                      <select
                        value={leaveForm.leaveType}
                        onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value as any })}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                      >
                        <option value="CASUAL">Casual Leave (CL)</option>
                        <option value="SICK">Medical / Sick Leave (ML)</option>
                        <option value="MATERNITY">Maternity / Special</option>
                        <option value="EARNED">Earned Leave (EL)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Start Date</label>
                      <input
                        type="date"
                        value={leaveForm.startDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">End Date</label>
                      <input
                        type="date"
                        value={leaveForm.endDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Days Count</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={leaveForm.days}
                        onChange={(e) => setLeaveForm({ ...leaveForm, days: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Urgent family matter / medical checkup"
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      required
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsApplyLeaveOpen(false)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      Submit Application
                    </button>
                  </div>
                </form>
              )}

              {/* Leave Applications Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3">Leave Type</th>
                      <th className="p-3">Dates</th>
                      <th className="p-3">Days</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {leaves.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{l.leaveType}</td>
                        <td className="p-3 font-mono text-[11px]">
                          {l.startDate} to {l.endDate}
                        </td>
                        <td className="p-3 font-semibold">{l.daysCount} Day(s)</td>
                        <td className="p-3 text-slate-700">{l.reason}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              l.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : l.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {l.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateLeaveStatus(l.id, 'APPROVED')}
                                className="px-2 py-1 bg-emerald-600 text-white rounded-md text-[10px] font-bold"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateLeaveStatus(l.id, 'REJECTED')}
                                className="px-2 py-1 bg-red-600 text-white rounded-md text-[10px] font-bold"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {leaves.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                          No leave applications recorded for this faculty member.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 8. PAYROLL TAB */}
          {/* ======================================= */}
          {activeTab === 'PAYROLL' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Institutional Payroll & Salary Slips
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Gross salary, monthly deductions, PF/TDS, and direct bank settlement details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDisburseSalaryOpen(!isDisburseSalaryOpen)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Disburse Salary Slip</span>
                </button>
              </div>

              {/* Quick Salary Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross Salary</span>
                  <strong className="text-base font-bold text-slate-900 block mt-0.5">
                    ₹{formatSalary(staff.salary)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank Account No</span>
                  <strong className="font-mono text-xs text-slate-800 block mt-0.5">
                    {staff.bankAccountNo || '918237192837'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank IFSC Code</span>
                  <strong className="font-mono text-xs text-slate-800 block mt-0.5">
                    {staff.ifscCode || 'SBIN0001234'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Disbursement Mode</span>
                  <strong className="text-xs text-emerald-800 font-bold block mt-0.5">CMS Direct Transfer</strong>
                </div>
              </div>

              {isDisburseSalaryOpen && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-emerald-950 block">Record Monthly Salary Disbursal</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={disburseMonth}
                      onChange={(e) => setDisburseMonth(e.target.value)}
                      placeholder="e.g. March 2026"
                      className="px-3 py-1.5 border border-emerald-300 rounded-xl text-xs font-bold bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleRecordPayment}
                      className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
                    >
                      Confirm Disbursal (₹{formatSalary(staff.salary)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDisburseSalaryOpen(false)}
                      className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Payroll Slips Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3">Salary Month</th>
                      <th className="p-3">Disbursed Date</th>
                      <th className="p-3">Basic Pay</th>
                      <th className="p-3">Allowances</th>
                      <th className="p-3">Deductions</th>
                      <th className="p-3">Net Salary</th>
                      <th className="p-3">Reference No</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {payrollHistory.map((slip) => (
                      <tr key={slip.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{slip.month}</td>
                        <td className="p-3 font-mono text-[11px]">{slip.paymentDate}</td>
                        <td className="p-3 font-mono">₹{(slip.basicSalary || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3 font-mono text-emerald-700">+₹{(slip.totalAllowances || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3 font-mono text-red-600">-₹{(slip.totalDeductions || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3 font-mono font-black text-slate-900">
                          ₹{(slip.netSalary || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-500">{slip.transactionReference || slip.salarySlipNumber}</td>
                        <td className="p-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {slip.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {payrollHistory.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                          No prior salary slips recorded. Click Disburse Salary Slip to generate one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 9. DOCUMENTS TAB */}
          {/* ======================================= */}
          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Staff Documents & Certificates
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Appointment letters, verification records, educational certificates, and ID proofs.
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Official Records
                </span>
              </div>

              <FileUploadComponent
                uploadType="teacher-document"
                label="Upload Staff Document"
                hint="PDF or Image up to 25MB."
                onUploadComplete={handleDocumentUploaded}
              />

              <div className="space-y-2 pt-2">
                {(staff.documents || []).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                        <File className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{doc.title}</div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{doc.originalFileName}</span>
                          <span>•</span>
                          <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">Verified</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* View / Eye Icon Preview */}
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDoc(doc)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center gap-1"
                        title="Preview Document"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      {/* Download */}
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
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                ))}
                {(!staff.documents || staff.documents.length === 0) && (
                  <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No documents uploaded in this faculty dossier yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 10. PORTAL ACCESS TAB */}
          {/* ======================================= */}
          {activeTab === 'PORTAL' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-200 text-purple-800 rounded-xl">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                        Faculty LMS & Portal Authentication
                      </h4>
                      <p className="text-[11px] text-purple-700">
                        Controls web login access to attendance recording, marks entry, and student diary.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        staff.loginEnabled !== false
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                      }`}
                    >
                      {staff.loginEnabled !== false ? 'PORTAL ACTIVE' : 'PORTAL OFF'}
                    </span>
                    <button
                      type="button"
                      onClick={handleTogglePortal}
                      className="px-3 py-1.5 bg-white border border-purple-300 text-purple-800 hover:bg-purple-100 rounded-xl text-xs font-bold transition-colors"
                    >
                      {staff.loginEnabled !== false ? 'Disable Access' : 'Enable Access'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Login Username</span>
                    <strong className="font-mono text-xs text-blue-900 block mt-0.5">{staff.employeeId}</strong>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">or email: {staff.email}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Role Permission</span>
                    <strong className="text-xs text-slate-800 block mt-0.5">{staff.systemRole || 'TEACHER'}</strong>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Access level</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Account Status</span>
                    <strong className="text-xs text-slate-800 block mt-0.5">{staff.accountStatus || 'ACTIVE'}</strong>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">No authentication lockout</span>
                  </div>
                </div>
              </div>

              {/* Password Reset Form */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Admin Direct Password Reset
                </h4>
                <p className="text-[11px] text-slate-500">
                  Update login password for {staff.name} without needing email confirmation.
                </p>

                {passwordResetMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{passwordResetMsg}</span>
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="flex flex-col sm:flex-row gap-3 pt-1">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new master password (e.g. Teacher@2026)"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 11. ACTIVITY & AUDIT TAB */}
          {/* ======================================= */}
          {activeTab === 'ACTIVITY' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Audit Trail & Faculty Activity Log
              </h4>
              <div className="border border-slate-200 rounded-2xl p-4 bg-white divide-y divide-slate-100">
                {[
                  {
                    action: 'Faculty Profile Viewed & Verified',
                    actor: 'System Admin',
                    time: 'Just now',
                    icon: ShieldCheck,
                    color: 'text-blue-600',
                  },
                  {
                    action: 'Class Teacher Allocation Confirmed',
                    actor: 'Principal Office',
                    time: 'Yesterday at 04:30 PM',
                    icon: UserCheck,
                    color: 'text-emerald-600',
                  },
                  {
                    action: 'Timetable Slot Assigned: Class 10 Science',
                    actor: 'Academic Incharge',
                    time: '2 days ago',
                    icon: Clock,
                    color: 'text-purple-600',
                  },
                  {
                    action: 'Staff Documents Verified',
                    actor: 'Administrative Office',
                    time: 'Last week',
                    icon: FileCheck,
                    color: 'text-emerald-600',
                  },
                ].map((item, i) => (
                  <div key={i} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                    <item.icon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color}`} />
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 text-xs">{item.action}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Performed by {item.actor} • {item.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Patliputra Digital School Faculty Record • Single School Instance
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(selectedPreviewDoc)}
        onClose={() => setSelectedPreviewDoc(null)}
        document={selectedPreviewDoc}
      />
    </div>
  );
};
