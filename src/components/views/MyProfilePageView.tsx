import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorOpen,
  Download,
  Edit,
  Edit2,
  Eye,
  FileCheck,
  FileText,
  GraduationCap,
  Key,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User as UserIcon,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { AttachedDocument, SchoolSettings, User, StaffAttendanceRecord, StaffLeave, Holiday, StaffPayrollRecord, TeacherStaff } from '../../types';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { fileUploadService } from '../../services/fileUploadService';
import { AttendanceCalendar } from '../common/AttendanceCalendar';
import { apiFetch, getFileContentUrl } from '../../services/apiConfig';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { SalaryDetailModal } from '../modals/SalaryDetailModal';
import { PrintableSalarySlipModal } from '../modals/PrintableSalarySlipModal';
import { PrintableIdCardModal } from '../modals/PrintableIdCardModal';
import { validateNewPassword } from '../../utils/passwordPolicy';

interface MyProfilePageViewProps {
  user: User;
  settings: SchoolSettings;
  onUpdateUser?: (user: User) => void;
  onBackToDashboard: () => void;
  /** Opens a section straight from the top-bar profile menu. */
  initialSection?: 'PAYROLL' | 'ID_CARD' | null;
  onSectionHandled?: () => void;
}

export const MyProfilePageView: React.FC<MyProfilePageViewProps> = ({
  user,
  settings,
  onUpdateUser,
  onBackToDashboard,
  initialSection,
  onSectionHandled,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'PERSONAL' | 'PROFESSIONAL' | 'ATTENDANCE' | 'PAYROLL' | 'DOCUMENTS' | 'PORTAL' | 'PASSWORD'
  >('OVERVIEW');

  // Dynamic server profile data loaded from MongoDB
  const [profileData, setProfileData] = useState<any>(null);
  // Teachers: the classes/sections/subjects the server authorizes (same rules as attendance,
  // marks entry, timetable and My Students). Shown separately from "qualified to teach".
  const [authorizedAssignments, setAuthorizedAssignments] = useState<Array<{ classId: string; className: string; section: string; isClassTeacher?: boolean; subjects: Array<{ id: string; name: string }> }> | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Photo & Document Modals
  const [isChangingPhoto, setIsChangingPhoto] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newDocCategory, setNewDocCategory] = useState('Aadhaar / National ID Proof');
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<AttachedDocument | null>(null);

  // Edit Details Modal
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Attendance & Staff Leave State
  const [attendanceRecords, setAttendanceRecords] = useState<StaffAttendanceRecord[]>([]);
  const [staffLeavesList, setStaffLeavesList] = useState<StaffLeave[]>([]);
  const [holidaysList, setHolidaysList] = useState<Holiday[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(false);
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState<boolean>(false);
  const [leaveFilter, setLeaveFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'CASUAL' as 'CASUAL' | 'SICK' | 'MATERNITY' | 'EARNED' | 'OTHER',
    startDate: new Date().toISOString().substring(0, 10),
    endDate: new Date().toISOString().substring(0, 10),
    reason: '',
    documentFileKey: '',
    documentName: '',
  });
  const [isUploadingLeaveDoc, setIsUploadingLeaveDoc] = useState(false);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Payroll History & Salary Modals
  const [myPayrollHistory, setMyPayrollHistory] = useState<StaffPayrollRecord[]>([]);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<StaffPayrollRecord | null>(null);
  const [selectedPrintRecord, setSelectedPrintRecord] = useState<StaffPayrollRecord | null>(null);

  // Dedicated Staff ID Card State for Logged-In Teacher / Staff
  const [isMyIdCardOpen, setIsMyIdCardOpen] = useState(false);
  const [myStaffRecord, setMyStaffRecord] = useState<TeacherStaff | null>(null);
  const [isLoadingIdCard, setIsLoadingIdCard] = useState(false);

  const handleOpenMyIdCard = async () => {
    setIsLoadingIdCard(true);
    try {
      const staffId = profileData?.id || user.employeeId || user.id;
      const res = await api.fetchStaffIdCard(staffId);
      if (res.success && res.staff) {
        setMyStaffRecord(res.staff);
        setIsMyIdCardOpen(true);
      } else {
        const currentStaff = api.getStaff().find(
          (s) =>
            s.id === user.id ||
            s.id === staffId ||
            (user.employeeId && s.employeeId?.toUpperCase() === user.employeeId?.toUpperCase())
        ) || (profileData as TeacherStaff);
        if (currentStaff) {
          setMyStaffRecord(currentStaff);
          setIsMyIdCardOpen(true);
        } else {
          setProfileStatus({ type: 'error', message: res.error || 'Failed to load staff ID card.' });
        }
      }
    } catch (err: any) {
      const currentStaff = api.getStaff().find(
        (s) =>
          s.id === user.id ||
          (user.employeeId && s.employeeId?.toUpperCase() === user.employeeId?.toUpperCase())
      ) || (profileData as TeacherStaff);
      if (currentStaff) {
        setMyStaffRecord(currentStaff);
        setIsMyIdCardOpen(true);
      } else {
        setProfileStatus({ type: 'error', message: err?.message || 'Error loading staff ID card.' });
      }
    } finally {
      setIsLoadingIdCard(false);
    }
  };

  // Role permissions
  const isAdminRole = user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN';
  const isPrivilegedRole = isAdminRole || user.role === 'ACCOUNTANT' || user.role === 'PRINCIPAL';
  const isParentRole = user.role === 'PARENT';
  useEffect(() => {
    if (user.role !== 'TEACHER') return;
    let alive = true;
    apiFetch('/api/teacher/authorized-assignments')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const list = Array.isArray(d?.detailedAssignments) ? d.detailedAssignments : [];
        setAuthorizedAssignments(list.slice().sort((a: any, b: any) => `${a.className}${a.section}`.localeCompare(`${b.className}${b.section}`, 'en', { numeric: true })));
      })
      .catch(() => alive && setAuthorizedAssignments([]));
    return () => {
      alive = false;
    };
  }, [user.role]);

  // Comprehensive Form State for editing
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    alternatePhone: '',
    emergencyContact: '',
    occupation: '',
    bloodGroup: '',
    dob: '',
    gender: '',
    fatherName: '',
    motherName: '',
    fatherOrMotherName: '',
    address: '',
    permanentAddress: '',
    currentAddress: '',
    city: '',
    state: '',
    pincode: '',
    sameAsPermanentAddress: true,
    qualification: '',
    customQualification: '',
    designation: '',
    department: '',
    customDepartment: '',
    employmentType: 'Full Time',
    totalExperience: '',
    experienceYears: 0,
    classesQualifiedToTeach: '',
    teachingWorkload: 0,
    assignedPrimarySubject: '',
    classTeacherOf: '',
    houseClubResponsibility: '',
    subjectExpertise: [] as string[],
    certifications: '',
    bankAccountNo: '',
    bankName: '',
    bankBranch: '',
    ifscCode: '',
    panNumber: '',
    uanNumber: '',
    salaryAmount: 0,
  });

  const syncFormFromProfile = (prof: any, usr: User) => {
    setFormData({
      name: prof?.name || usr.name || '',
      email: prof?.email || usr.email || '',
      phone: prof?.phone || prof?.mobile || usr.phone || '',
      alternatePhone: prof?.alternatePhone || '',
      emergencyContact: prof?.emergencyContact || '',
      occupation: prof?.occupation || (usr as any).occupation || '',
      bloodGroup: prof?.bloodGroup || '',
      dob: prof?.dob || '',
      gender: prof?.gender || 'MALE',
      fatherName: prof?.fatherName || prof?.fatherOrMotherName || '',
      motherName: prof?.motherName || '',
      fatherOrMotherName: prof?.fatherName || prof?.fatherOrMotherName || '',
      address: prof?.permanentAddress || prof?.address || (usr as any).address || '',
      permanentAddress: prof?.permanentAddress || prof?.address || '',
      currentAddress: prof?.currentAddress || prof?.permanentAddress || prof?.address || '',
      city: prof?.permanentCity || prof?.city || prof?.currentCity || '',
      state: prof?.permanentState || prof?.state || prof?.currentState || 'Bihar',
      pincode: prof?.permanentPincode || prof?.pincode || prof?.currentPincode || '',
      sameAsPermanentAddress: prof?.sameAsPermanentAddress !== false,
      qualification: prof?.qualification || '',
      customQualification: prof?.customQualification || '',
      designation: prof?.designation || '',
      department: prof?.department || '',
      customDepartment: prof?.customDepartment || '',
      employmentType: prof?.employmentType || 'Full Time',
      totalExperience: prof?.totalExperience || (prof?.experienceYears ? `${prof.experienceYears} Years` : ''),
      experienceYears: prof?.experienceYears || 0,
      classesQualifiedToTeach: prof?.classesQualifiedToTeach || '',
      teachingWorkload: prof?.teachingWorkload || 0,
      assignedPrimarySubject: prof?.assignedPrimarySubject || '',
      classTeacherOf: prof?.classTeacherOf || '',
      houseClubResponsibility: prof?.houseClubResponsibility || '',
      subjectExpertise: Array.isArray(prof?.subjectExpertise) ? prof.subjectExpertise : [],
      certifications: prof?.certifications || (Array.isArray(prof?.certificationsList) ? prof.certificationsList.join(', ') : ''),
      bankAccountNo: prof?.bankAccountNo || '',
      bankName: prof?.bankName || '',
      bankBranch: prof?.bankBranch || '',
      ifscCode: prof?.ifscCode || '',
      panNumber: prof?.panNumber || '',
      uanNumber: prof?.uanNumber || '',
      salaryAmount: typeof prof?.salary === 'number' ? prof.salary : (prof?.salary?.basic || 0),
    });
  };

  // Fetch complete profile dynamically from MongoDB
  const loadDynamicProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const res = await authService.getProfile();
      if (res.success && res.profile) {
        setProfileData(res.profile);
        syncFormFromProfile(res.profile, res.user || user);
        if (res.user && onUpdateUser) {
          onUpdateUser(res.user);
        }
      } else {
        syncFormFromProfile(null, user);
      }

      const targetId = user.employeeId || user.id;
      const localPayroll = api.getStaffPayroll(targetId);
      setMyPayrollHistory(localPayroll);
      api.fetchStaffPayrollAsync({ search: targetId }).then((payRes) => {
        if (payRes && payRes.records) {
          const matched = payRes.records.filter(
            (r) =>
              r.staffId === user.id ||
              r.staffId === targetId ||
              (user.employeeId && r.employeeId && r.employeeId.toUpperCase() === user.employeeId.toUpperCase())
          );
          if (matched.length > 0) setMyPayrollHistory(matched);
        }
      }).catch(() => {});
    } catch (e) {
      console.warn('[MyProfile] Could not fetch profile from server:', e);
      syncFormFromProfile(null, user);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadAttendanceAndLeaves = async (prof?: any) => {
    const p = prof || profileData;
    const targetStaffId = p?.employeeId || p?.id || user.employeeId || user.id;
    if (!targetStaffId) return;
    setIsLoadingAttendance(true);
    try {
      const cal = await api.fetchStaffCalendar(targetStaffId);
      if (cal) {
        setAttendanceRecords(cal.records || []);
        setStaffLeavesList(cal.leaves || []);
        setHolidaysList(cal.holidays || api.getHolidays());
      } else {
        setAttendanceRecords(api.getStaffAttendance(undefined, targetStaffId));
        setStaffLeavesList(api.getStaffLeaves(targetStaffId));
        setHolidaysList(api.getHolidays());
      }
    } catch (e) {
      console.warn('[MyProfile] Error fetching staff attendance calendar:', e);
      setAttendanceRecords(api.getStaffAttendance(undefined, targetStaffId));
      setStaffLeavesList(api.getStaffLeaves(targetStaffId));
      setHolidaysList(api.getHolidays());
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  useEffect(() => {
    if (!initialSection) return;
    if (initialSection === 'PAYROLL') {
      setActiveTab('PAYROLL');
    } else if (initialSection === 'ID_CARD') {
      setActiveTab('OVERVIEW');
      void handleOpenMyIdCard();
    }
    onSectionHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  useEffect(() => {
    loadDynamicProfile();
  }, [user.id]);

  useEffect(() => {
    loadAttendanceAndLeaves();
  }, [profileData?.id, profileData?.employeeId, user.id, user.employeeId]);

  useEffect(() => {
    if (activeTab === 'ATTENDANCE') {
      loadAttendanceAndLeaves();
    }
  }, [activeTab]);

  const filteredLeaves = useMemo(() => {
    if (leaveFilter === 'ALL') return staffLeavesList;
    return staffLeavesList.filter((l) => l.status === leaveFilter);
  }, [staffLeavesList, leaveFilter]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.reason.trim()) {
      setProfileStatus({ type: 'error', message: 'Please provide a valid reason for your leave application.' });
      return;
    }
    setIsSubmittingLeave(true);
    try {
      const start = new Date(leaveForm.startDate);
      const end = new Date(leaveForm.endDate);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      await api.applyStaffLeaveAsync({
        staffId: profileData?.id || user.id,
        employeeId: profileData?.employeeId || user.employeeId || 'CPS0000',
        staffName: profileData?.name || user.name,
        leaveType: leaveForm.leaveType as any,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        daysCount: days,
        reason: leaveForm.reason.trim(),
        status: 'PENDING',
        document: leaveForm.documentFileKey || undefined,
      });

      setProfileStatus({
        type: 'success',
        message: `Leave application submitted successfully for ${days} day${days > 1 ? 's' : ''}! Current status: PENDING approval.`,
      });
      setIsApplyLeaveOpen(false);
      setLeaveForm({
        leaveType: 'CASUAL',
        startDate: new Date().toISOString().substring(0, 10),
        endDate: new Date().toISOString().substring(0, 10),
        reason: '',
        documentFileKey: '',
        documentName: '',
      });
      await loadAttendanceAndLeaves();
    } catch (err: any) {
      setProfileStatus({ type: 'error', message: err?.message || 'Failed to submit leave application.' });
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Handle Photo Upload
  const handlePhotoUpload = async (res: { fileKey: string; previewUrl?: string }) => {
    const updatedUser: User = {
      ...user,
      avatar: res.fileKey,
    };
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
    try {
      const updateRes = await authService.updateProfile({
        photo: res.fileKey,
        photoFileKey: res.fileKey,
        avatar: res.fileKey,
      });
      if (updateRes.success) {
        setProfileStatus({ type: 'success', message: 'Profile photo updated successfully!' });
        await loadDynamicProfile();
      }
    } catch (e) {
      console.warn('Could not update avatar in profile backend:', e);
    }
    setIsChangingPhoto(false);
  };

  // Handle Document Upload
  const handleDocumentUploadComplete = async (res: any) => {
    try {
      const newDoc: AttachedDocument = {
        id: `doc-${Date.now()}`,
        title: `${newDocCategory} - ${res.originalFileName || 'Document'}`,
        fileKey: res.fileKey,
        originalFileName: res.originalFileName || 'document.pdf',
        contentType: res.contentType || 'application/pdf',
        fileSize: res.fileSize || 0,
        uploadedAt: new Date().toISOString(),
      };

      await fileUploadService.confirmFileAssociation(res.fileKey, {
        type: 'STAFF',
        id: profileData?.id || user.id,
      });

      const currentDocs = profileData?.documents || [];
      const updatedDocs = [...currentDocs, newDoc];

      const saveRes = await authService.updateProfile({ documents: updatedDocs });
      if (saveRes.success) {
        setProfileStatus({ type: 'success', message: `"${newDoc.title}" uploaded and saved to your profile.` });
        await loadDynamicProfile();
      } else {
        setProfileStatus({ type: 'error', message: saveRes.error || 'Failed to save document attachment.' });
      }
    } catch (err: any) {
      setProfileStatus({ type: 'error', message: err.message || 'Error attaching document.' });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Handle Profile Details Save (Strict Role Permissions Enforced)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileStatus(null);

    try {
      const payload: any = {};

      if (isAdminRole) {
        // SUPER_ADMIN and SCHOOL_ADMIN can edit all permitted fields
        payload.name = formData.name.trim();
        payload.email = formData.email.trim();
        payload.phone = formData.phone.trim();
        payload.mobile = formData.phone.trim();
        payload.alternatePhone = formData.alternatePhone.trim();
        payload.emergencyContact = formData.emergencyContact.trim();
        payload.bloodGroup = formData.bloodGroup;
        payload.dob = formData.dob;
        payload.gender = formData.gender;
        payload.fatherName = formData.fatherName.trim();
        payload.motherName = formData.motherName.trim();
        payload.fatherOrMotherName = formData.fatherName.trim() || formData.motherName.trim();
        payload.address = formData.permanentAddress.trim() || formData.address.trim();
        payload.permanentAddress = formData.permanentAddress.trim();
        payload.currentAddress = formData.sameAsPermanentAddress ? formData.permanentAddress.trim() : formData.currentAddress.trim();
        payload.city = formData.city.trim();
        payload.permanentCity = formData.city.trim();
        payload.currentCity = formData.city.trim();
        payload.state = formData.state.trim();
        payload.permanentState = formData.state.trim();
        payload.currentState = formData.state.trim();
        payload.pincode = formData.pincode.trim();
        payload.permanentPincode = formData.pincode.trim();
        payload.currentPincode = formData.pincode.trim();
        payload.sameAsPermanentAddress = formData.sameAsPermanentAddress;
        payload.qualification = formData.qualification.trim();
        payload.customQualification = formData.customQualification.trim();
        payload.designation = formData.designation.trim();
        payload.department = formData.department.trim();
        payload.employmentType = formData.employmentType;
        payload.totalExperience = formData.totalExperience.trim();
        payload.experienceYears = Number(formData.experienceYears) || 0;
        payload.classesQualifiedToTeach = formData.classesQualifiedToTeach.trim();
        payload.teachingWorkload = Number(formData.teachingWorkload) || 0;
        payload.assignedPrimarySubject = formData.assignedPrimarySubject.trim();
        payload.classTeacherOf = formData.classTeacherOf.trim();
        payload.houseClubResponsibility = formData.houseClubResponsibility.trim();
        payload.certifications = formData.certifications.trim();
        payload.bankAccountNo = formData.bankAccountNo.trim();
        payload.bankName = formData.bankName.trim();
        payload.bankBranch = formData.bankBranch.trim();
        payload.ifscCode = formData.ifscCode.trim();
        payload.panNumber = formData.panNumber.trim();
        payload.uanNumber = formData.uanNumber.trim();
      } else {
        // Other roles can edit ONLY their allowed personal/contact fields:
        // email, phone, alternatePhone, emergencyContact, bloodGroup, qualification, address fields
        payload.email = formData.email.trim();
        payload.phone = formData.phone.trim();
        payload.mobile = formData.phone.trim();
        payload.alternatePhone = formData.alternatePhone.trim();
        payload.emergencyContact = formData.emergencyContact.trim();
        payload.bloodGroup = formData.bloodGroup;
        payload.qualification = formData.qualification.trim();
        payload.customQualification = formData.customQualification.trim();
        payload.address = formData.permanentAddress.trim() || formData.address.trim();
        payload.permanentAddress = formData.permanentAddress.trim();
        payload.currentAddress = formData.sameAsPermanentAddress ? formData.permanentAddress.trim() : formData.currentAddress.trim();
        payload.city = formData.city.trim();
        payload.permanentCity = formData.city.trim();
        payload.currentCity = formData.city.trim();
        payload.state = formData.state.trim();
        payload.permanentState = formData.state.trim();
        payload.currentState = formData.state.trim();
        payload.pincode = formData.pincode.trim();
        payload.permanentPincode = formData.pincode.trim();
        payload.currentPincode = formData.pincode.trim();
        payload.sameAsPermanentAddress = formData.sameAsPermanentAddress;
        if (isParentRole) {
          payload.occupation = formData.occupation.trim();
        }
      }

      const res = await authService.updateProfile(payload);
      if (res.success) {
        setProfileStatus({ type: 'success', message: res.message || 'Profile updated successfully in database!' });
        if (res.user && onUpdateUser) {
          onUpdateUser(res.user);
        }
        await loadDynamicProfile();
        setIsEditingProfile(false);
      } else {
        setProfileStatus({ type: 'error', message: res.error || 'Failed to update profile details.' });
      }
    } catch (err: any) {
      setProfileStatus({ type: 'error', message: err.message || 'Network error updating profile.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Secure Password Change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Current password, new password, and confirmation are all required.' });
      return;
    }
    const policyError = validateNewPassword(newPassword);
    if (policyError) {
      setPasswordStatus({ type: 'error', message: policyError });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation password do not match.' });
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordStatus(null);

    try {
      const res = await authService.changePassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordStatus({
          type: 'success',
          message: 'Account password updated successfully! Your new password is now active.',
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({ type: 'error', message: res.error || 'Failed to update password. Please check your current password.' });
      }
    } catch {
      setPasswordStatus({ type: 'error', message: 'Network or server error while changing password. Please try again.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Helper formatting for salary
  const formatSalary = (sal: any, monthlySalary?: number): string => {
    if (typeof monthlySalary === 'number' && monthlySalary > 0) {
      return `₹${monthlySalary.toLocaleString('en-IN')}`;
    }
    if (!sal) return 'Not provided';
    if (typeof sal === 'number') {
      return sal > 0 ? `₹${sal.toLocaleString('en-IN')}` : 'Not provided';
    }
    if (typeof sal === 'object') {
      const total = sal.monthly || (sal.basic || 0) + (sal.allowances || 0) || sal.net;
      return total > 0 ? `₹${total.toLocaleString('en-IN')}` : 'Not provided';
    }
    return 'Not provided';
  };

  // Mask bank account number according to security rules: show only last 4 digits for non-privileged
  const maskBankAccount = (acc?: string): string => {
    if (!acc || !acc.trim()) return 'Not provided';
    const clean = acc.trim();
    if (isPrivilegedRole) return clean;
    return clean.length > 4 ? `•••• •••• ${clean.slice(-4)}` : '••••••••';
  };

  // Mask PAN number for non-privileged
  const maskPanNumber = (pan?: string): string => {
    if (!pan || !pan.trim()) return 'Not provided';
    const clean = pan.trim();
    if (isPrivilegedRole) return clean;
    return clean.length === 10 ? `${clean.slice(0, 2)}••••••${clean.slice(-1)}` : '••••••••';
  };

  // Photo URL resolution
  const photoUrl =
    profileData?.photoFileKey || profileData?.photo || user.avatar
      ? getFileContentUrl(profileData?.photoFileKey || profileData?.photo || user.avatar) ||
        fileUploadService.getFileUrl(profileData?.photoFileKey || profileData?.photo || user.avatar)
      : '';

  const roleBadgeStyle =
    user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN'
      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      : user.role === 'PRINCIPAL'
      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
      : user.role === 'TEACHER'
      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
      : user.role === 'ACCOUNTANT'
      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';

  const roleNameFormatted = user.role.replace(/_/g, ' ');

  return (
    <div className="space-y-6 pb-12 w-full min-w-0">
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="text-xs text-slate-500 truncate">
            <span>Account Portal</span> / <strong className="text-slate-800">{profileData?.name || user.name}</strong>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Profile */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            title="Print Profile"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Print Profile</span>
          </button>

          {/* Staff ID Card Button (staff only) */}
          {user.role !== 'STUDENT' && !isParentRole && (
            <button
              type="button"
              onClick={handleOpenMyIdCard}
              disabled={isLoadingIdCard}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Preview, Download, or Print Official Staff ID Card"
            >
              {isLoadingIdCard ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-700" />
              ) : (
                <QrCode className="w-4 h-4 text-purple-700" />
              )}
              <span>Staff ID Card</span>
            </button>
          )}

          {/* View Documents Shortcut (staff only; parents have no Documents tab) */}
          {!isParentRole && (
            <button
              type="button"
              onClick={() => setActiveTab('DOCUMENTS')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileCheck className="w-4 h-4 text-blue-700" />
              <span>Documents ({profileData?.documents?.length || 0})</span>
            </button>
          )}

          {/* Change Password Button */}
          <button
            type="button"
            onClick={() => setActiveTab('PASSWORD')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition-colors cursor-pointer"
            title="Change Account Password"
          >
            <KeyRound className="w-4 h-4 text-amber-700" />
            <span>Change Password</span>
          </button>

          {/* Edit Details Button */}
          <button
            type="button"
            onClick={() => {
              syncFormFromProfile(profileData, user);
              setIsEditingProfile(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Details</span>
          </button>
        </div>
      </div>

      {/* 1. Header Banner (Matching Faculty/Staff Profile Layout) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Profile Photo */}
            <div className="relative group shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={profileData?.name || user.name}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-4 border-white/20 shadow-xl bg-slate-800"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white flex items-center justify-center font-bold text-4xl shadow-xl border-4 border-white/20">
                  {(profileData?.name || user.name || 'U').charAt(0)}
                </div>
              )}

              {/* Photo Change Button */}
              <button
                type="button"
                onClick={() => setIsChangingPhoto(!isChangingPhoto)}
                className="absolute -bottom-2 -right-2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-full shadow-lg border-2 border-slate-900 transition-transform active:scale-95 cursor-pointer"
                title="Change Profile Photo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {profileData?.name || user.name}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${roleBadgeStyle}`}>
                  {roleNameFormatted}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {profileData?.accountStatus || profileData?.status || user.status || 'ACTIVE'}
                </span>
                {photoUrl && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Photo Verified
                  </span>
                )}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {profileData?.loginEnabled !== false ? 'Portal Active' : 'Portal Inactive'}
                </span>
              </div>

              <p className="text-sm text-slate-300 font-medium">
                <span className="font-mono font-bold text-amber-400">
                  {profileData?.employeeId || user.employeeId || (profileData?.admissionNumber ? `ADM: ${profileData.admissionNumber}` : user.username)}
                </span>
                {' • '}
                {isParentRole ? (
                  'Parent / Guardian'
                ) : (
                  <>
                    {profileData?.designation || (user.role === 'SUPER_ADMIN' ? 'Super Administrator' : user.role === 'SCHOOL_ADMIN' ? 'School Administrator' : user.role === 'PRINCIPAL' ? 'Principal' : 'Faculty Member')}
                    {' • '}
                    {profileData?.department || (isAdminRole ? 'Administration' : 'Academics')} Wing
                  </>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>{profileData?.phone || profileData?.mobile || user.phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span>{profileData?.email || user.email || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>Joining: {profileData?.joiningDate || 'Recorded'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 border-t md:border-t-0 border-white/10 pt-4 md:pt-0 shrink-0">
            <div className="text-left md:text-right">
              <span className="text-[11px] text-slate-400 block font-medium">School Campus</span>
              <span className="text-xs font-bold text-white tracking-wide">
                {settings.schoolName || 'Chanakya Public School & Coaching Centre'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                Code: {settings.affiliationNumber || settings.affiliationCode || 'Not configured'}
              </span>
            </div>
            {profileData?.classTeacherOf && (
              <div className="px-3 py-1.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold text-center">
                Class Teacher of {profileData.classTeacherOf}
              </div>
            )}
          </div>
        </div>

        {/* Photo Upload Drawer */}
        {isChangingPhoto && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-700 shadow-xl backdrop-blur-md animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white">Upload New Profile Photo</span>
              <button
                type="button"
                onClick={() => setIsChangingPhoto(false)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="bg-white rounded-xl p-3 text-slate-900">
              <FileUploadComponent
                uploadType="teacher-photo"
                currentValue={profileData?.photo || user.avatar}
                onUploadComplete={handlePhotoUpload}
                acceptedTypes="image/jpeg,image/png,image/webp"
                limitMB={5}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Alerts */}
      {profileStatus && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
            profileStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {profileStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-semibold">{profileStatus.message}</div>
          <button
            type="button"
            onClick={() => setProfileStatus(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tab Navigation Bar (Matching StaffFullProfileView) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1 text-xs font-bold text-slate-600 min-w-max">
          {(isParentRole
            ? [
                { id: 'OVERVIEW', label: 'Overview', icon: BookOpen },
                { id: 'PERSONAL', label: 'Contact Details', icon: UserIcon },
                { id: 'PASSWORD', label: 'Change Password', icon: Lock },
              ]
            : [
                { id: 'OVERVIEW', label: 'Overview', icon: BookOpen },
                { id: 'PERSONAL', label: 'Personal Info', icon: UserIcon },
                { id: 'PROFESSIONAL', label: 'Professional Info', icon: GraduationCap },
                { id: 'ATTENDANCE', label: 'Attendance', icon: CalendarCheck },
                { id: 'PAYROLL', label: 'Salary / Payroll', icon: CreditCard },
                { id: 'DOCUMENTS', label: 'Documents', icon: FileText, count: profileData?.documents?.length || 0 },
                { id: 'PORTAL', label: 'Portal Access', icon: KeyRound },
                { id: 'PASSWORD', label: 'Change Password', icon: Lock },
              ]
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-700 text-white shadow-xs font-bold'
                    : 'hover:bg-slate-100 hover:text-slate-900 text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white text-blue-900' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6 text-xs text-slate-700">
        {/* ========================================================================= */}
        {/* 2. PROFILE OVERVIEW TAB                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'OVERVIEW' && (
          isParentRole ? (
            <div className="space-y-6">
              {/* 1. Parent Quick Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                    Linked Children
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                    {profileData?.children?.length || (profileData?.linkedStudentIds?.length || 1)} Enrolled
                  </div>
                  <span className="text-[11px] text-slate-500">Verified institutional records</span>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                    Registered Mobile
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">
                    {profileData?.phone || user.phone}
                  </div>
                  <span className="text-[11px] text-slate-500">Primary contact & portal login</span>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 block">
                    Academic Session
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-900">
                    {settings.currentAcademicSession || '2026-2027'}
                  </div>
                  <span className="text-[11px] text-slate-500">{settings.affiliatedBoard ? `${settings.affiliatedBoard} affiliated` : 'Recognised school'}</span>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                    Portal Status
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Active & Verified</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ID: {profileData?.id || user.id}
                  </span>
                </div>
              </div>

              {/* 2. Linked Children Cards from MongoDB */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Linked Children ({profileData?.children?.length || (profileData?.linkedStudentIds?.length || 0)})</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                    From the school records
                  </span>
                </div>

                {profileData?.children && profileData.children.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profileData.children.map((child: any) => (
                      <div
                        key={child.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-base shrink-0 overflow-hidden shadow-2xs">
                            {child.photo && fileUploadService.getFileUrl(child.photo) ? (
                              <img
                                src={fileUploadService.getFileUrl(child.photo)}
                                alt={child.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              child.name?.charAt(0) || 'S'
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 text-sm truncate">
                              {child.name}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">
                              Class: <span className="font-bold text-slate-800">{child.className}</span> • Section: <span className="font-bold text-slate-800">{child.section}</span>
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                            {child.status || 'Active'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Admission No</span>
                            <strong className="font-mono text-slate-800">{child.admissionNumber}</strong>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Roll No</span>
                            <strong className="text-slate-800">{child.rollNumber || 'N/A'}</strong>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Session</span>
                            <strong className="text-blue-700">{child.academicSession || settings.currentAcademicSession || '2026-2027'}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                    No linked student profiles found. Contact the school office to link your child.
                  </div>
                )}
              </div>

              {/* 3. Contact & Location Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Summary */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span>Parent Contact Details</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        syncFormFromProfile(profileData, user);
                        setIsEditingProfile(true);
                      }}
                      className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Contact Info</span>
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Parent / Guardian Name</span>
                      <strong className="text-slate-900">{profileData?.name || user.name}</strong>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Primary Mobile Phone</span>
                      <span className="font-semibold text-slate-900">{profileData?.phone || user.phone}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Email Address</span>
                      <span className="font-semibold text-slate-900">{profileData?.email || user.email || 'Not configured'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Alternate Phone</span>
                      <span className="font-semibold text-slate-800">{profileData?.alternatePhone || 'Not provided'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Emergency Contact</span>
                      <span className="font-semibold text-slate-800">{profileData?.emergencyContact || 'Not provided'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Occupation / Profession</span>
                      <span className="font-semibold text-slate-800">{profileData?.occupation || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                {/* Residence & Protected Institutional Record */}
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span>Residential Address</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          syncFormFromProfile(profileData, user);
                          setIsEditingProfile(true);
                        }}
                        className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <p className="text-slate-800 font-medium">
                        {profileData?.permanentAddress || profileData?.address || (user as any).address || 'Not provided'}
                      </p>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 pt-2 border-t border-slate-200/60">
                        <span>City / District: <strong className="text-slate-800">{profileData?.city || profileData?.permanentCity || 'Sheohar'}</strong></span>
                        <span>State: <strong className="text-slate-800">{profileData?.state || profileData?.permanentState || 'Bihar'}</strong></span>
                        <span>PIN: <strong className="font-mono text-slate-800">{profileData?.pincode || profileData?.permanentPincode || '843329'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Protected Institutional Fields */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <ShieldCheck className="w-4 h-4 text-blue-700" />
                        <span>Institutional Records (Locked)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Read-Only
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">Parent ID</span>
                        <span className="font-mono font-bold text-slate-800">{profileData?.id || user.id}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">Portal Role</span>
                        <span className="font-bold text-blue-800">PARENT</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Institutional fields are protected and maintained by the School Administration.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                  Weekly Teaching Load
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {profileData?.teachingWorkload !== undefined && profileData.teachingWorkload !== null
                    ? `${profileData.teachingWorkload} Periods`
                    : (isAdminRole ? 'Administrative' : 'Not provided')}
                </div>
                <span className="text-[11px] text-slate-500">Across master schedule</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 block">
                  Role / Incharge
                </span>
                <div className="text-base sm:text-lg font-black text-slate-900 truncate">
                  {profileData?.classTeacherOf ? `Class Teacher ${profileData.classTeacherOf}` : (profileData?.designation || roleNameFormatted)}
                </div>
                <span className="text-[11px] text-slate-500">
                  {profileData?.classTeacherOf ? 'Assigned Class Incharge' : 'Institutional Responsibility'}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Monthly Gross Salary
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {formatSalary(profileData?.salary, profileData?.monthlySalary)}
                </div>
                <span className="text-[11px] text-slate-500">Official institutional grade</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                  Portal Login Status
                </span>
                <div className="text-base sm:text-lg font-black text-slate-900">
                  {profileData?.loginEnabled !== false ? 'Active & Enabled' : 'Disabled'}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  User ID: {profileData?.employeeId || user.employeeId || user.username}
                </span>
              </div>
            </div>

            {/* Profile Overview Details Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Summary */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>Profile Overview</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      syncFormFromProfile(profileData, user);
                      setIsEditingProfile(true);
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Full Name</span>
                    <strong className="text-slate-900">{profileData?.name || user.name || 'Not provided'}</strong>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Employee ID</span>
                    <span className="font-mono font-bold text-blue-700">
                      {profileData?.employeeId || user.employeeId || 'Not provided'}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Designation</span>
                    <span className="font-semibold text-slate-800">
                      {profileData?.designation || 'Not provided'}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Department</span>
                    <span className="font-semibold text-slate-800">
                      {profileData?.department || 'Not provided'}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Qualification</span>
                    <span className="font-semibold text-slate-800">
                      {profileData?.qualification === 'Other' && profileData?.customQualification
                        ? profileData.customQualification
                        : (profileData?.qualification || 'Not provided')}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Total Experience</span>
                    <span className="font-semibold text-slate-800">
                      {profileData?.totalExperience || (profileData?.experienceYears ? `${profileData.experienceYears} Years` : 'Not provided')}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Date of Birth</span>
                    <span className="font-semibold text-slate-800">{profileData?.dob || 'Not provided'}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Gender</span>
                    <span className="font-semibold text-slate-800">{profileData?.gender || 'Not provided'}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Blood Group</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {profileData?.bloodGroup || 'Not provided'}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Emergency Contact</span>
                    <span className="font-semibold text-slate-800">{profileData?.emergencyContact || 'Not provided'}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Alternate Mobile</span>
                    <span className="font-semibold text-slate-800">{profileData?.alternatePhone || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Residential & Current Addresses */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>Residential & Location Details</span>
                </h3>

                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Residential Address</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Permanent</span>
                    </div>
                    <p className="text-slate-700 font-medium">
                      {profileData?.permanentAddress || profileData?.address || (user as any).address || 'Not provided'}
                    </p>
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 pt-1 border-t border-slate-200/60">
                      <span>City / District: <strong className="text-slate-800">{profileData?.permanentCity || profileData?.city || 'Not provided'}</strong></span>
                      <span>State: <strong className="text-slate-800">{profileData?.permanentState || profileData?.state || 'Not provided'}</strong></span>
                      <span>PIN: <strong className="font-mono text-slate-800">{profileData?.permanentPincode || profileData?.pincode || 'Not provided'}</strong></span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Current Address</span>
                      {profileData?.sameAsPermanentAddress !== false ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Same as Residential
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                          Correspondence
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 font-medium">
                      {profileData?.sameAsPermanentAddress !== false
                        ? (profileData?.permanentAddress || profileData?.address || 'Not provided')
                        : (profileData?.currentAddress || profileData?.permanentAddress || profileData?.address || 'Not provided')}
                    </p>
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 pt-1 border-t border-slate-200/60">
                      <span>City / District: <strong className="text-slate-800">{profileData?.currentCity || profileData?.permanentCity || profileData?.city || 'Not provided'}</strong></span>
                      <span>State: <strong className="text-slate-800">{profileData?.currentState || profileData?.permanentState || profileData?.state || 'Not provided'}</strong></span>
                      <span>PIN: <strong className="font-mono text-slate-800">{profileData?.currentPincode || profileData?.permanentPincode || profileData?.pincode || 'Not provided'}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )
        )}

        {/* ========================================================================= */}
        {/* 2. PERSONAL INFORMATION TAB                                              */}
        {/* ========================================================================= */}
        {activeTab === 'PERSONAL' && (
          isParentRole ? (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                  <span>Parent Contact & Residential Profile</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    syncFormFromProfile(profileData, user);
                    setIsEditingProfile(true);
                  }}
                  className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Contact Details</span>
                </button>
              </div>

              {/* Notice of permitted vs protected fields */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Authorized Contact Editing:</strong> You can update contact numbers, email, occupation, and residential address. Institutional fields (Parent ID, Username, Account Role, Linked Wards) are authoritative records locked by School Administration.
                </span>
              </div>

              {/* Permitted Contact Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Permitted Contact Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Parent / Guardian Name</span>
                    <strong className="text-slate-900">{profileData?.name || user.name || 'Not provided'}</strong>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Primary Mobile Phone</span>
                    <span className="font-semibold text-slate-900">{profileData?.phone || profileData?.mobile || user.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Email Address</span>
                    <span className="font-semibold text-slate-900">{profileData?.email || user.email || 'Not configured'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Alternate Phone / Mobile</span>
                    <span className="font-semibold text-slate-800">{profileData?.alternatePhone || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Emergency Contact Number</span>
                    <span className="font-semibold text-slate-800">{profileData?.emergencyContact || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Occupation / Profession</span>
                    <span className="font-semibold text-slate-800">{profileData?.occupation || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Address Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Residential Address</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Permanent</span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">
                    {profileData?.permanentAddress || profileData?.address || (user as any).address || 'Not provided'}
                  </p>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 pt-1 border-t border-slate-200/60">
                    <span>City: <strong className="text-slate-800">{profileData?.permanentCity || profileData?.city || 'Sheohar'}</strong></span>
                    <span>State: <strong className="text-slate-800">{profileData?.permanentState || profileData?.state || 'Bihar'}</strong></span>
                    <span>PIN Code: <strong className="font-mono text-slate-800">{profileData?.permanentPincode || profileData?.pincode || '843329'}</strong></span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Protected Institutional Fields</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Locked
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div>System ID: <strong className="font-mono text-slate-800">{profileData?.id || user.id}</strong></div>
                    <div>Login ID: <strong className="font-mono text-slate-800">{profileData?.username || user.username}</strong></div>
                    <div>Account Role: <strong className="text-blue-800 font-bold">PARENT</strong></div>
                    <div>Linked Children: <strong className="text-slate-800">{profileData?.children?.length || (profileData?.linkedStudentIds?.length || 1)} student(s)</strong></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-blue-600" />
                <span>Personal & Residential Information</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  syncFormFromProfile(profileData, user);
                  setIsEditingProfile(true);
                }}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Personal Info</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Full Legal Name</span>
                <strong className="text-slate-900">{profileData?.name || user.name || 'Not provided'}</strong>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Father's Name</span>
                <span className="font-semibold text-slate-800">{profileData?.fatherName || profileData?.fatherOrMotherName || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Mother's Name</span>
                <span className="font-semibold text-slate-800">{profileData?.motherName || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Date of Birth</span>
                <span className="font-semibold text-slate-800">{profileData?.dob || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Gender</span>
                <span className="font-semibold text-slate-800">{profileData?.gender || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Blood Group</span>
                <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {profileData?.bloodGroup || 'Not provided'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Mobile Phone Number</span>
                <span className="font-semibold text-slate-800">{profileData?.phone || profileData?.mobile || user.phone || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Alternate Phone / Mobile</span>
                <span className="font-semibold text-slate-800">{profileData?.alternatePhone || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Official Email</span>
                <span className="font-semibold text-slate-800">{profileData?.email || user.email || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Emergency Contact</span>
                <span className="font-semibold text-slate-800">{profileData?.emergencyContact || 'Not provided'}</span>
              </div>
            </div>

            {/* Address Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Residential / Permanent Address</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Permanent</span>
                </div>
                <p className="text-xs text-slate-700 font-medium">
                  {profileData?.permanentAddress || profileData?.address || (user as any).address || 'Not provided'}
                </p>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 pt-1 border-t border-slate-200/60">
                  <span>City / District: <strong className="text-slate-800">{profileData?.permanentCity || profileData?.city || 'Not provided'}</strong></span>
                  <span>State: <strong className="text-slate-800">{profileData?.permanentState || profileData?.state || 'Not provided'}</strong></span>
                  <span>PIN Code: <strong className="font-mono text-slate-800">{profileData?.permanentPincode || profileData?.pincode || 'Not provided'}</strong></span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Current Address</span>
                  {profileData?.sameAsPermanentAddress !== false ? (
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
                  {profileData?.sameAsPermanentAddress !== false
                    ? (profileData?.permanentAddress || profileData?.address || 'Not provided')
                    : (profileData?.currentAddress || profileData?.permanentAddress || profileData?.address || 'Not provided')}
                </p>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 pt-1 border-t border-slate-200/60">
                  <span>City / District: <strong className="text-slate-800">{profileData?.currentCity || profileData?.permanentCity || profileData?.city || 'Not provided'}</strong></span>
                  <span>State: <strong className="text-slate-800">{profileData?.currentState || profileData?.permanentState || profileData?.state || 'Not provided'}</strong></span>
                  <span>PIN Code: <strong className="font-mono text-slate-800">{profileData?.currentPincode || profileData?.permanentPincode || profileData?.pincode || 'Not provided'}</strong></span>
                </div>
              </div>
            </div>
          </div>
          )
        )}

        {/* ========================================================================= */}
        {/* 3. PROFESSIONAL INFORMATION TAB                                           */}
        {/* ========================================================================= */}
        {activeTab === 'PROFESSIONAL' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-600" />
                <span>Professional Information & Teaching Workload</span>
              </h3>
              {isAdminRole && (
                <button
                  type="button"
                  onClick={() => {
                    syncFormFromProfile(profileData, user);
                    setIsEditingProfile(true);
                  }}
                  className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Professional Info</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Employment Type</span>
                <span className="font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {profileData?.employmentType || 'Not provided'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Department / Wing</span>
                <span className="font-semibold text-slate-800">
                  {profileData?.department === 'Other' && profileData?.customDepartment
                    ? `${profileData.customDepartment} (Custom)`
                    : (profileData?.department || 'Not provided')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Highest Academic Qualification</span>
                <span className="font-semibold text-slate-800">
                  {profileData?.qualification === 'Other' && profileData?.customQualification
                    ? `${profileData.customQualification} (Other)`
                    : (profileData?.qualification || 'Not provided')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Total Experience</span>
                <span className="font-semibold text-slate-800">
                  {profileData?.totalExperience || (profileData?.experienceYears ? `${profileData.experienceYears} Years` : 'Not provided')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Date of Joining</span>
                <span className="font-semibold text-slate-800">{profileData?.joiningDate || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Teaching Workload</span>
                <span className="font-semibold text-slate-800">
                  {profileData?.teachingWorkload !== undefined && profileData.teachingWorkload !== null
                    ? `${profileData.teachingWorkload} periods / week`
                    : (isAdminRole ? 'Administrative' : 'Not provided')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Classes Qualified to Teach</span>
                <span className="font-semibold text-slate-800">
                  {profileData?.classesQualifiedToTeach || 'Not provided'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Class Teacher Role</span>
                <span className="font-semibold text-slate-800">
                  {profileData?.classTeacherOf ? `Class Teacher of ${profileData.classTeacherOf}` : 'Not provided'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Assigned Primary Subject</span>
                <span className="font-semibold text-slate-800">
                  {profileData?.assignedPrimarySubject || (profileData?.assignedSubjects?.[0] || 'Not provided')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">House / Club Responsibility</span>
                <span className="font-semibold text-slate-800">
                  {(profileData?.houseClubResponsibilities && profileData.houseClubResponsibilities.length > 0)
                    ? profileData.houseClubResponsibilities.map((h: string) => h === 'Other' && profileData.customHouseClub ? profileData.customHouseClub : h).join(', ')
                    : (profileData?.houseClubResponsibility || 'Not provided')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50 md:col-span-2">
                <span className="text-slate-500">Certifications / Additional Credentials</span>
                <span className="font-semibold text-slate-800">
                  {(profileData?.certificationsList && profileData.certificationsList.length > 0)
                    ? profileData.certificationsList.map((c: string) => c === 'Other' && profileData.customCertification ? profileData.customCertification : c).join(', ')
                    : (profileData?.certifications || 'Not provided')}
                </span>
              </div>
            </div>

            {/* Qualified to teach (staff record) vs. currently assigned (server authorization) */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div>
                <span className="text-slate-500 block mb-1 font-medium">Qualified to teach</span>
                <p className="text-[11px] text-slate-400 mb-2">From the staff record. This does not by itself give access to a class.</p>
                <div className="flex flex-wrap gap-1.5">
                  {(profileData?.subjectExpertise || profileData?.specializationSubjects)?.length ? (
                    (profileData.subjectExpertise || profileData.specializationSubjects).map((sub: string) => (
                      <span key={sub} className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-semibold">
                        {sub}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">Not provided</span>
                  )}
                </div>
              </div>

              {user.role === 'TEACHER' ? (
                <div>
                  <span className="text-slate-500 block mb-1 font-medium">Currently assigned classes & subjects</span>
                  <p className="text-[11px] text-slate-400 mb-2">Active classes, sections and subjects you are authorized for in attendance, marks entry, timetable and My Students.</p>
                  {authorizedAssignments === null ? (
                    <span className="text-slate-400 italic">Loading…</span>
                  ) : authorizedAssignments.length === 0 ? (
                    <span className="text-slate-400 italic">No class is assigned yet. Contact the academic office.</span>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {authorizedAssignments.map((a) => (
                        <div key={`${a.classId}-${a.section}`} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{a.className} – {a.section}</span>
                            {a.isClassTeacher && <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">Class teacher</span>}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">{a.subjects.length ? a.subjects.map((x) => x.name).join(', ') : 'No subject assigned'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <span className="text-slate-500 block mb-2 font-medium">Assigned Classes:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {profileData?.assignedClasses?.length ? (
                      profileData.assignedClasses.map((cls: string) => (
                        <span key={cls} className="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 font-semibold">
                          {cls}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">Not provided</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. ATTENDANCE & LEAVE REGISTER TAB                                        */}
        {/* ========================================================================= */}
        {activeTab === 'ATTENDANCE' && (
          <div className="space-y-6">
            {/* Header with Apply Leave CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      My Monthly Attendance & Duty Register
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Compliance Log
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Biometric punch records, duty attendance calendar, and official leave ledger for Employee ID:{' '}
                    <strong className="font-mono text-slate-800">
                      {profileData?.employeeId || user.employeeId || user.username}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => loadAttendanceAndLeaves()}
                  disabled={isLoadingAttendance}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Refresh attendance records from database"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAttendance ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsApplyLeaveOpen(true)}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Apply Leave</span>
                </button>
              </div>
            </div>

            {/* Attendance Calendar Component */}
            <AttendanceCalendar
              type="STAFF"
              staffId={profileData?.id || user.id}
              employeeId={profileData?.employeeId || user.employeeId}
              staffName={profileData?.name || user.name}
              records={attendanceRecords}
              leaves={staffLeavesList}
              holidays={holidaysList}
            />

            {/* Leave Applications & History Section */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>My Leave Applications & History</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Track status of applied casual, sick, and duty leaves. Approved leaves automatically reflect as 🟠 Leave (L) on your calendar.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                  {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => {
                    const count = staffLeavesList.filter((l) => {
                      if (filter === 'ALL') return true;
                      return l.status === filter;
                    }).length;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setLeaveFilter(filter)}
                        className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                          leaveFilter === filter
                            ? 'bg-white text-slate-900 shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {filter.charAt(0) + filter.slice(1).toLowerCase()} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Leave List */}
              {filteredLeaves.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-700">No {leaveFilter.toLowerCase()} leave applications found</p>
                  <p className="text-[11px] text-slate-500">
                    Click "Apply Leave" above to submit a new leave request to the Principal Office.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLeaves.map((leave) => {
                    let statusBadge = 'bg-amber-100 text-amber-800 border-amber-300';
                    let statusIcon = <Clock className="w-3.5 h-3.5 text-amber-600" />;
                    if (leave.status === 'APPROVED') {
                      statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                      statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
                    } else if (leave.status === 'REJECTED') {
                      statusBadge = 'bg-rose-100 text-rose-800 border-rose-300';
                      statusIcon = <XCircle className="w-3.5 h-3.5 text-rose-600" />;
                    }

                    return (
                      <div
                        key={leave.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              {leave.leaveType} LEAVE
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {leave.startDate} {leave.startDate !== leave.endDate ? `to ${leave.endDate}` : ''}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              ({leave.daysCount} day{leave.daysCount > 1 ? 's' : ''})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge}`}>
                              {statusIcon}
                              <span>{leave.status}</span>
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700">
                          <strong className="text-slate-900 font-semibold">Reason:</strong> {leave.reason}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                          <div>
                            Applied on: <strong className="text-slate-700">{leave.appliedAt || 'Recent'}</strong>
                          </div>

                          {leave.status !== 'PENDING' && (
                            <div className="flex items-center gap-2">
                              <span>
                                Reviewed by: <strong className="text-slate-800">{leave.approvedBy || 'Principal Office'}</strong>
                              </span>
                              {leave.approvedAt && <span>on {leave.approvedAt}</span>}
                              {leave.remarks && (
                                <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium">
                                  Remark: "{leave.remarks}"
                                </span>
                              )}
                            </div>
                          )}

                          {leave.document && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500">Attachment:</span>
                              <button
                                type="button"
                                onClick={() => setSelectedPreviewDoc({
                                  id: `doc-${leave.id}`,
                                  title: `Leave Document - ${leave.leaveType}`,
                                  fileKey: typeof leave.document === 'string' ? leave.document : (leave.document as any)?.fileKey,
                                  originalFileName: 'supporting-document.pdf',
                                  contentType: 'application/pdf',
                                  fileSize: 0,
                                  uploadedAt: leave.appliedAt,
                                })}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View Document</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Apply Leave Modal */}
        {isApplyLeaveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Apply for Faculty Leave</h3>
                    <p className="text-[11px] text-slate-300">Submit formal leave request to the Principal Office</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleApplyLeave} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Leave Type *</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-1 focus:ring-blue-500 font-semibold"
                    required
                  >
                    <option value="CASUAL">Casual Leave (CL)</option>
                    <option value="SICK">Medical / Sick Leave (SL)</option>
                    <option value="MATERNITY">Maternity / Paternity Leave</option>
                    <option value="EARNED">Earned / Privilege Leave (EL)</option>
                    <option value="OTHER">Duty / Special Institutional Leave</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">From Date *</label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-1 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">To Date *</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      min={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-1 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Estimated Duration:</span>
                  <strong className="text-blue-900 font-mono font-bold">
                    {(() => {
                      const s = new Date(leaveForm.startDate);
                      const e = new Date(leaveForm.endDate);
                      const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                      return `${diff} Day${diff > 1 ? 's' : ''}`;
                    })()}
                  </strong>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Reason for Leave *</label>
                  <textarea
                    rows={3}
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Provide details about the purpose of your leave application..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Supporting Document (Optional)</label>
                  {leaveForm.documentFileKey ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-semibold text-emerald-900 truncate">
                          {leaveForm.documentName || 'Document attached'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLeaveForm({ ...leaveForm, documentFileKey: '', documentName: '' })}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => setIsUploadingLeaveDoc(!isUploadingLeaveDoc)}
                        className="w-full py-2 px-3 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 text-slate-600 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-blue-600" />
                        <span>Upload Medical / Supporting Document (PDF / Image)</span>
                      </button>
                      {isUploadingLeaveDoc && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <FileUploadComponent
                            uploadType="teacher-document"
                            onUploadComplete={(res: any) => {
                              setLeaveForm({
                                ...leaveForm,
                                documentFileKey: res.fileKey,
                                documentName: res.originalFileName || 'document.pdf',
                              });
                              setIsUploadingLeaveDoc(false);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsApplyLeaveOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingLeave}
                    className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingLeave ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Submit Application</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. SALARY / PAYROLL TAB (Bank details protected/masked)                   */}
        {/* ========================================================================= */}
        {activeTab === 'PAYROLL' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Salary Structure & Protected Bank Information</span>
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Authorized payroll view. Bank account numbers and tax identifiers remain protected according to institutional regulations.
              </p>
            </div>

            {/* Top Cards: Configured Monthly Salary and UAN Number only */}
            {(() => {
              const configuredSalary =
                typeof profileData?.monthlySalary === 'number' && profileData.monthlySalary > 0
                  ? profileData.monthlySalary
                  : typeof profileData?.salary === 'number' && profileData.salary > 0
                  ? profileData.salary
                  : typeof profileData?.salary === 'object' && (profileData.salary.net || profileData.salary.basic || profileData.salary.monthly)
                  ? Number(profileData.salary.net || profileData.salary.basic || profileData.salary.monthly)
                  : 30000;
              const latestSlip = myPayrollHistory[0] || null;

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Configured Monthly Salary
                      </span>
                      <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                        ₹{configuredSalary.toLocaleString('en-IN')}
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
                        {profileData?.uanNumber || 'Not provided'}
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
                          {latestSlip ? latestSlip.month : 'Current Month (October 2026)'}
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
                            disabled={latestSlip.paymentStatus !== 'PAID'}
                            title={latestSlip.paymentStatus === 'PAID' ? 'Download payslip (PDF)' : 'Available after the salary is paid'}
                            onClick={async () => {
                              const r = await api.downloadPayslip(latestSlip.id);
                              setProfileStatus(r.ok ? { type: 'success', message: 'Payslip downloaded.' } : { type: 'error', message: r.error || 'Could not download the payslip.' });
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Payslip</span>
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
                            ({latestSlip.lateDays || 0} late)
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
                        <div className="p-3 bg-white rounded-xl border border-slate-200 col-span-2 sm:col-span-4">
                          <span className="text-[10px] text-slate-400 block font-semibold">Disbursement Details</span>
                          <div className="text-[11px] text-slate-700 mt-0.5 space-x-2">
                            <span>Mode: <strong>{latestSlip.paymentMethod || 'BANK_TRANSFER'}</strong></span>
                            <span>•</span>
                            <span>Ref: <strong className="font-mono">{latestSlip.transactionReference || latestSlip.salarySlipNumber}</strong></span>
                            <span>•</span>
                            <span>Date: <strong>{latestSlip.paymentDate || 'Pending'}</strong></span>
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 col-span-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailRecord(latestSlip)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Breakdown</span>
                          </button>
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

            {/* Direct Deposit & Banking Details (Protected/Masked) */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900">Direct Deposit & Banking Information</h4>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-600" /> Protected Data
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Bank Account Number:</span>
                  <strong className="font-mono text-slate-900">{maskBankAccount(profileData?.bankAccountNo)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Bank Name & Branch:</span>
                  <span className="font-semibold text-slate-800">
                    {profileData?.bankName ? `${profileData.bankName}${profileData.bankBranch ? ', ' + profileData.bankBranch : ''}` : 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">IFSC Code:</span>
                  <strong className="font-mono text-slate-900">{profileData?.ifscCode || 'Not provided'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">PAN Number:</span>
                  <strong className="font-mono text-slate-900">{maskPanNumber(profileData?.panNumber)}</strong>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                To request an update to your direct deposit account or salary configuration, please contact the Principal Office or Accounts Department with official bank verification documents.
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. DOCUMENTS TAB                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'DOCUMENTS' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>My Official Documents</span>
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Official certificates and uploaded verification documents.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadingDoc(!isUploadingDoc)}
                className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Document</span>
              </button>
            </div>

            {/* Document Upload Drawer */}
            {isUploadingDoc && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Attach New Document to My Profile</span>
                  <button
                    type="button"
                    onClick={() => setIsUploadingDoc(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Document Category</label>
                  <select
                    value={newDocCategory}
                    onChange={(e) => setNewDocCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white mb-3"
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
                  onUploadComplete={handleDocumentUploadComplete}
                />
              </div>
            )}

            {/* Documents Grid */}
            {(!profileData?.documents || profileData.documents.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700">No documents uploaded yet</p>
                <p className="text-[11px] text-slate-500">
                  Click the "Upload Document" button above to attach copies of your Aadhaar, academic degrees, or certificates.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profileData.documents.map((doc: AttachedDocument) => (
                  <div
                    key={doc.id || doc.fileKey}
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
                      {/* View Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDoc(doc)}
                        className="p-2 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 text-blue-700 transition-colors cursor-pointer"
                        title="View Document Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Download Button */}
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
                        className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                        title="Download Document"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. PORTAL ACCESS TAB                                                     */}
        {/* ========================================================================= */}
        {activeTab === 'PORTAL' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-purple-600" />
                  <span>Portal Login & Security Status</span>
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Your authenticated session credentials and portal account access parameters.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                PORTAL ACTIVE
              </span>
            </div>

            {/* Portal Overview Card */}
            <div className="p-5 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">Portal User ID:</span>
                  <strong className="font-mono text-sm text-purple-950 font-bold">
                    {profileData?.employeeId || user.employeeId || user.username}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Assigned System Role:</span>
                  <span className="font-bold text-slate-900">{roleNameFormatted}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Account Status:</span>
                  <span className="font-bold text-emerald-700">
                    {profileData?.accountStatus || profileData?.status || user.status || 'ACTIVE'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Portal Login Status:</span>
                  <span className="font-bold text-slate-900">
                    {profileData?.loginEnabled !== false ? 'Active & Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-purple-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Last Login Timestamp:</span>
                  <span className="text-[11px] text-slate-600 font-mono">
                    {profileData?.lastLoginAt ? new Date(profileData.lastLoginAt).toLocaleString() : 'Current Active Session'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('PASSWORD')}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Change Account Password
                </button>
              </div>
            </div>

            {/* Session Security Overview */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Protected Role-Based Security Rules</span>
              </h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                For administrative compliance, your Employee ID, system permissions, and administrative role are managed exclusively by the school administration. To request role or employee profile revisions, contact the Super Administrator.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 8. PASSWORD TAB (Clearly visible Change Account Password section)         */}
        {/* ========================================================================= */}
        {activeTab === 'PASSWORD' && (
          <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Enter your current password followed by your new password. After successfully changing your password, your new password takes effect immediately across all sessions.
              </p>
            </div>

            {passwordStatus && (
              <div
                className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
                  passwordStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                {passwordStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 font-semibold">{passwordStatus.message}</div>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Current Account Password *
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  New Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters, letters and numbers"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password to confirm"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Save New Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 7. PROFILE EDITING MODAL (Permitted fields strictly enforced by role)     */}
      {/* ========================================================================= */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isParentRole ? 'Edit Parent Contact Details' : 'Edit My Profile Details'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isParentRole
                      ? 'Update permitted contact numbers, email, occupation, and residential address'
                      : isAdminRole
                      ? 'Administrative Editor: Update institutional and personal profile fields'
                      : 'Update allowed personal and contact information'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-6 space-y-6">
              {isParentRole ? (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <span>
                    You can update contact details (mobile, email, alternate phone, emergency contact, occupation, and address). Institutional fields (Parent ID, Username, Role, and Linked Wards) are locked.
                  </span>
                </div>
              ) : !isAdminRole ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    You can update your personal contact, qualification, and residential address details. Protected administrative fields (Role, Employee ID, Designation, Department, Salary, Login permissions) are authoritative and locked.
                  </span>
                </div>
              ) : null}

              {/* Personal Information Fields */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-blue-800">
                  {isParentRole ? 'Parent Contact & Identity Details' : 'Personal & Contact Information'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name: editable only for admin */}
                  {isAdminRole ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name (Locked)</label>
                      <div className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-600 flex items-center justify-between">
                        <span>{formData.name}</span>
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Official Email Address *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. parent@example.com"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Primary Mobile Phone *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="10-digit primary mobile"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Alternate Phone / Mobile</label>
                    <input
                      type="tel"
                      value={formData.alternatePhone}
                      onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                      placeholder="Optional alternate mobile"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Number</label>
                    <input
                      type="tel"
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                      placeholder="Emergency contact mobile"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  {isParentRole && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Occupation / Profession</label>
                      <input
                        type="text"
                        value={formData.occupation}
                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                        placeholder="e.g. Business / Government Employee / Private Sector / Farming"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                      />
                    </div>
                  )}

                  {isAdminRole && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={formData.dob}
                          onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                        <select
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Father's Name</label>
                        <input
                          type="text"
                          value={formData.fatherName}
                          onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                          placeholder="Father's full name"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Mother's Name</label>
                        <input
                          type="text"
                          value={formData.motherName}
                          onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                          placeholder="Mother's full name"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-blue-800">
                  Residential & Correspondence Address
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Residential / Permanent Address *</label>
                    <textarea
                      rows={2}
                      value={formData.permanentAddress}
                      onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value, address: e.target.value })}
                      placeholder="Complete permanent / residential address"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City / District</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Sheohar"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="e.g. Bihar"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">PIN Code</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="6-digit PIN"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="sameAsPerm"
                      checked={formData.sameAsPermanentAddress}
                      onChange={(e) => setFormData({ ...formData, sameAsPermanentAddress: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <label htmlFor="sameAsPerm" className="text-xs font-semibold text-slate-700">
                      Current address is same as permanent
                    </label>
                  </div>

                  {!formData.sameAsPermanentAddress && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Current Correspondence Address</label>
                      <textarea
                        rows={2}
                        value={formData.currentAddress}
                        onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                        placeholder="Current address if different"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Professional & Educational Qualifications */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-blue-800">
                  Educational Qualification & Professional Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Highest Academic Qualification</label>
                    <input
                      type="text"
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      placeholder="e.g. M.Sc. Mathematics, B.Ed."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  {isAdminRole ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Official Designation</label>
                        <input
                          type="text"
                          value={formData.designation}
                          onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Department / Wing</label>
                        <input
                          type="text"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Employment Type</label>
                        <select
                          value={formData.employmentType}
                          onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        >
                          <option value="Full Time">Full Time</option>
                          <option value="Part Time">Part Time</option>
                          <option value="Contract">Contract</option>
                          <option value="Probationary">Probationary</option>
                          <option value="Permanent">Permanent</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Total Experience (Years)</label>
                        <input
                          type="text"
                          value={formData.totalExperience}
                          onChange={(e) => setFormData({ ...formData, totalExperience: e.target.value })}
                          placeholder="e.g. 5 Years"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Teaching Workload (periods/week)</label>
                        <input
                          type="number"
                          value={formData.teachingWorkload}
                          onChange={(e) => setFormData({ ...formData, teachingWorkload: Number(e.target.value) })}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Class Teacher Of</label>
                        <input
                          type="text"
                          value={formData.classTeacherOf}
                          onChange={(e) => setFormData({ ...formData, classTeacherOf: e.target.value })}
                          placeholder="e.g. Class 10-A"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Certifications / Additional Credentials</label>
                        <input
                          type="text"
                          value={formData.certifications}
                          onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                          placeholder="e.g. CTET Qualified, Subject Specialist"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden"
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Profile Details</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!selectedPreviewDoc}
        onClose={() => setSelectedPreviewDoc(null)}
        document={selectedPreviewDoc}
      />

      {/* Staff ID Card Modal for Logged-In Teacher / Staff */}
      {isMyIdCardOpen && myStaffRecord && (
        <PrintableIdCardModal
          staff={myStaffRecord}
          isOpen={isMyIdCardOpen}
          onClose={() => setIsMyIdCardOpen(false)}
          settings={settings}
        />
      )}
    </div>
  );
};
