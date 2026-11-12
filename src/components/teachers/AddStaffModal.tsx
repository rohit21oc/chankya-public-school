import React, { useState, useEffect, useMemo, useId } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck,
  FileText,
  GraduationCap,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  School,
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
  Subject,
  TeacherStaff,
  UserRole,
} from '../../types';
import { api } from '../../services/api';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { fileUploadService } from '../../services/fileUploadService';
import { StaffPhotoUploader } from './form/StaffPhotoUploader';
import {
  STAFF_PORTAL_ROLES,
  STAFF_ROLE_DESIGNATIONS,
  PortalStaffRole,
  getDefaultDesignationForRole,
} from '../../constants/staffRoles';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffAdded: (newStaff: TeacherStaff) => void;
  currentUserRole?: UserRole;
}

const EMPLOYMENT_TYPES = [
  'Full Time',
  'Part Time',
  'Contract',
  'Temporary',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DOCUMENT_TYPES = [
  { id: 'AADHAAR', label: 'Aadhaar / ID Proof' },
  { id: 'QUALIFICATION', label: 'Qualification Certificate' },
  { id: 'EXPERIENCE', label: 'Experience Certificate' },
  { id: 'APPOINTMENT', label: 'Joining / Appointment Letter' },
  { id: 'OTHER', label: 'Other Documents' },
];

export const AddStaffModal: React.FC<AddStaffModalProps> = ({
  isOpen,
  onClose,
  onStaffAdded,
  currentUserRole = 'SUPER_ADMIN',
}) => {
  // Check authorization for Payroll section
  const isPayrollAuthorized = [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'ACCOUNTANT',
    'HR_STAFF',
  ].includes(currentUserRole);

  // Auto-generated Employee ID
  const [employeeId, setEmployeeId] = useState<string>('');

  // Registration Summary State
  const [registrationSummary, setRegistrationSummary] = useState<{
    staff: TeacherStaff;
    employeeId: string;
    portalUserId: string;
    email?: string | null;
    emailStatus: 'SENT' | 'FAILED' | 'SKIPPED_NO_EMAIL';
    emailError?: string;
    message: string;
  } | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendStatusMessage, setResendStatusMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Dynamic Academics Data
  const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>([]);
  const [academicSubjects, setAcademicSubjects] = useState<Subject[]>([]);

  // Form State
  // 1. Personal Information
  const [fullName, setFullName] = useState('');
  const [photo, setPhoto] = useState('');
  const [photoFileKey, setPhotoFileKey] = useState('');
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [dob, setDob] = useState('1990-01-01');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [city, setCity] = useState('Sheohar');
  const [state, setState] = useState('Bihar');
  const [pincode, setPincode] = useState('843329');
  const [emergencyContact, setEmergencyContact] = useState('');

  // 2. Professional Information
  const [portalRole, setPortalRole] = useState<PortalStaffRole>('TEACHER');
  const [designation, setDesignation] = useState<string>('PGT Teacher');
  const [highestQualification, setHighestQualification] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState(
    new Date().toISOString().substring(0, 10)
  );
  const [employmentType, setEmploymentType] = useState('Full Time');
  const [totalExperience, setTotalExperience] = useState('3 Years');
  const [selectedSubjectExpertise, setSelectedSubjectExpertise] = useState<string[]>([]);
  const [classesQualified, setClassesQualified] = useState<string[]>([]);
  const [certifications, setCertifications] = useState('');

  // 3. School Assignment
  const [assignedClassId, setAssignedClassId] = useState('');
  const [assignedSection, setAssignedSection] = useState('');
  const [assignedSubjectName, setAssignedSubjectName] = useState('');
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  // 4. Payroll
  const [monthlySalary, setMonthlySalary] = useState<number>(45000);
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [uanNumber, setUanNumber] = useState('');

  // 5. Documents
  const [documents, setDocuments] = useState<AttachedDocument[]>([]);
  const [currentDocType, setCurrentDocType] = useState('AADHAAR');
  const [docCustomTitle, setDocCustomTitle] = useState('');

  // 6. Portal Access
  const [enableLogin, setEnableLogin] = useState(true);
  const [initialPassword, setInitialPassword] = useState('Cps@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LEFT_SCHOOL'>('ACTIVE');

  // UI / Validation State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formTouched, setFormTouched] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      const nextId = api.getNextStaffEmployeeId();
      setEmployeeId(nextId);
      api.syncClasses().then((cls) => {
        const active = (cls || []).filter((c) => (c.status || 'ACTIVE') === 'ACTIVE');
        setAcademicClasses(active);
      });
      setAcademicClasses(api.getActiveClasses());
      const subs = api.getSubjects();
      setAcademicSubjects(subs);
      setErrorMessage(null);
      setFormTouched(false);
    }
  }, [isOpen]);

  const handleRoleChange = (newRole: PortalStaffRole) => {
    setPortalRole(newRole);
    const defaultDes = getDefaultDesignationForRole(newRole);
    setDesignation(defaultDes);
  };

  // Selected class's sections
  const selectedClassObj = useMemo(() => {
    return academicClasses.find(
      (c) => c.id === assignedClassId || c.name === assignedClassId
    );
  }, [academicClasses, assignedClassId]);

  const availableSections = useMemo(() => {
    if (!selectedClassObj) return ['A'];
    if (selectedClassObj.detailedSections && selectedClassObj.detailedSections.length > 0) {
      const active = selectedClassObj.detailedSections
        .filter((ds) => (ds.status || 'ACTIVE') === 'ACTIVE')
        .map((ds) => ds.name);
      return active.length > 0 ? active : ['A'];
    }
    return selectedClassObj.sections || ['A'];
  }, [selectedClassObj]);

  // Reset section when class changes
  useEffect(() => {
    if (selectedClassObj && availableSections.length > 0) {
      if (!availableSections.includes(assignedSection)) {
        setAssignedSection(availableSections[0]);
      }
    } else {
      setAssignedSection('');
    }
  }, [assignedClassId, selectedClassObj, availableSections]);

  if (!isOpen) return null;

  // Toggle subject expertise
  const toggleSubjectExpertise = (subName: string) => {
    setSelectedSubjectExpertise((prev) =>
      prev.includes(subName) ? prev.filter((s) => s !== subName) : [...prev, subName]
    );
  };

  // Toggle classes qualified to teach
  const toggleQualifiedClass = (clsName: string) => {
    setClassesQualified((prev) =>
      prev.includes(clsName) ? prev.filter((c) => c !== clsName) : [...prev, clsName]
    );
  };

  // Generate strong random password
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setInitialPassword(pwd);
    setShowPassword(true);
  };

  // Handle Document Upload Complete
  const handleDocumentUploaded = (res: {
    fileKey: string;
    originalFileName?: string;
    contentType?: string;
    fileSize?: number;
    uploadedAt?: string;
  }) => {
    const typeLabel =
      DOCUMENT_TYPES.find((d) => d.id === currentDocType)?.label || 'Document';
    const newDoc: AttachedDocument = {
      id: `doc-${Date.now()}`,
      title: docCustomTitle.trim() || `${typeLabel}`,
      documentType: currentDocType as any,
      fileKey: res.fileKey,
      originalFileName: res.originalFileName || `${typeLabel}.pdf`,
      contentType: res.contentType || 'application/pdf',
      fileSize: res.fileSize || 102400,
      uploadedAt: res.uploadedAt || new Date().toISOString(),
      verificationStatus: 'PENDING',
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setDocCustomTitle('');
  };

  const handleRemoveDocument = (docId: string, fileKey?: string) => {
    if (fileKey) {
      fileUploadService.deleteFile(fileKey).catch(console.warn);
    }
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  // Validation
  const validateForm = (): boolean => {
    setFormTouched(true);
    if (!fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return false;
    }
    if (!photo) {
      setErrorMessage('Staff Photo is required. Please upload a profile photo.');
      return false;
    }
    const cleanMobile = mobileNumber.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      setErrorMessage('A valid 10-digit Mobile Number is required.');
      return false;
    }
    return true;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isPhotoUploading) {
      setErrorMessage('The photo is still uploading. Please wait for it to finish before saving.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Build assigned classes & subjects
      const assignedClassesList: string[] = [];
      const assignedSubjectsList: string[] = [];
      let classTeacherLabel: string | undefined = undefined;

      if (selectedClassObj && assignedSection) {
        const fullClassSec = `${selectedClassObj.name}-${assignedSection.toUpperCase()}`;
        assignedClassesList.push(fullClassSec);
        if (isClassTeacher) {
          classTeacherLabel = fullClassSec;
        }
      }

      if (assignedSubjectName) {
        assignedSubjectsList.push(assignedSubjectName);
      }

      // Clean email if empty
      const cleanEmail = emailAddress.trim() || undefined;

      // Construct payroll structure
      const salVal = Number(monthlySalary) || 45000;
      const salaryObj = {
        basic: Math.round(salVal * 0.7),
        allowances: Math.round(salVal * 0.3),
        deductions: 0,
        net: salVal,
      };

      const newStaffPayload = {
        name: fullName.trim(),
        photo: photo || undefined,
        photoFileKey: photoFileKey || undefined,
        documents: documents,
        gender: gender,
        dob: dob,
        phone: mobileNumber.trim(),
        email: cleanEmail,
        alternatePhone: alternateMobile.trim() || undefined,
        address: residentialAddress.trim() || 'Sheohar, Bihar, India',
        fatherName: fatherName.trim() || undefined,
        motherName: motherName.trim() || undefined,
        fatherOrMotherName: fatherName.trim() || motherName.trim() || undefined,
        bloodGroup: bloodGroup,
        emergencyContact: emergencyContact.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        designation: designation,
        qualification: highestQualification.trim() || 'Graduate',
        joiningDate: dateOfJoining,
        employmentType: employmentType,
        totalExperience: totalExperience.trim() || '0 Years',
        subjectExpertise: selectedSubjectExpertise,
        specializationSubjects: selectedSubjectExpertise,
        qualifiedClasses: classesQualified,
        classesQualifiedToTeach: classesQualified.join(', '),
        certifications: certifications.trim() || undefined,
        assignedClasses: assignedClassesList,
        assignedSubjects: assignedSubjectsList,
        classTeacherOf: classTeacherLabel,
        salary: salaryObj,
        monthlySalary: salVal,
        bankAccountNo: bankAccountNo.trim() || undefined,
        ifscCode: ifscCode.trim().toUpperCase() || undefined,
        bankName: bankName.trim() || undefined,
        bankBranch: bankBranch.trim() || undefined,
        panNumber: panNumber.trim().toUpperCase() || undefined,
        uanNumber: uanNumber.trim() || undefined,
        loginEnabled: enableLogin,
        portalRole: portalRole,
        systemRole: portalRole,
        role: portalRole,
        accountStatus: accountStatus,
      };

      // Create staff via API
      const result = await api.addStaffAsync(newStaffPayload as any);
      const createdStaff = result.staff;

      // Link photo in Cloudflare R2
      if (createdStaff.photoFileKey) {
        fileUploadService.confirmFileAssociation(createdStaff.photoFileKey, {
          type: 'STAFF',
          id: createdStaff.id,
        }).catch(console.warn);
      }

      // Link uploaded documents in Cloudflare R2
      documents.forEach((doc) => {
        if (doc.fileKey) {
          fileUploadService.confirmFileAssociation(doc.fileKey, {
            type: 'STAFF',
            id: createdStaff.id,
          }).catch(console.warn);
        }
      });

      // Securely set initial password in backend/cache (plain-text is never stored)
      if (enableLogin && initialPassword) {
        await api.resetStaffPassword(createdStaff.id, initialPassword);
      }

      setRegistrationSummary(result);
    } catch (err: any) {
      console.error('Failed to create staff member:', err);
      setErrorMessage(err.message || 'An error occurred while creating the staff record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCredentials = async () => {
    if (!registrationSummary?.staff?.id) return;
    setIsResending(true);
    setResendStatusMessage(null);
    try {
      const res = await api.resendStaffCredentials(registrationSummary.staff.id);
      if (res.success && res.emailDispatched) {
        setResendStatusMessage(
          `Credentials successfully sent to ${res.email || registrationSummary.email || 'the registered email address'}!`
        );
        setRegistrationSummary((prev) =>
          prev ? { ...prev, emailStatus: 'SENT', message: 'Credentials email sent successfully.' } : null
        );
      } else {
        setResendStatusMessage(
          res.message || res.error || 'Unable to send credentials email. Please try again later.'
        );
      }
    } catch (err: any) {
      setResendStatusMessage(err?.message || 'Error occurred while contacting server.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (registrationSummary) {
    const { staff, employeeId: empId, portalUserId, email, emailStatus } = registrationSummary;

    return (
      <div
        id="add-staff-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      >
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl my-6 flex flex-col overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 text-white relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-blue-300 block">
                    Chanakya Public School & Coaching Centre, Sheohar
                  </span>
                  <h2 className="text-xl font-black tracking-tight text-white">
                    Registration Completed
                  </h2>
                  <p className="text-xs text-slate-300 font-medium">
                    {staff.name} has been successfully added to school records.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Status Alert */}
            {emailStatus === 'SENT' && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed font-semibold">
                  Staff registered successfully. Employee ID:{' '}
                  <strong className="font-mono text-emerald-900 font-black">{empId}</strong>.
                  Login credentials have been sent to the registered email address.
                </div>
              </div>
            )}

            {emailStatus === 'SKIPPED_NO_EMAIL' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed font-semibold">
                  Staff registered successfully. Employee ID:{' '}
                  <strong className="font-mono text-amber-900 font-black">{empId}</strong>.
                  No email was provided, so login credentials were not sent by email.
                </div>
              </div>
            )}

            {emailStatus === 'FAILED' && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed font-semibold">
                  Staff registered successfully, but the credential email could not be sent. Please retry sending the credentials from the staff profile.
                </div>
              </div>
            )}

            {/* Resend Status Banner */}
            {resendStatusMessage && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{resendStatusMessage}</span>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Employee ID
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-base font-mono font-black text-slate-900">{empId}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(empId)}
                    className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs flex items-center gap-1 font-semibold"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedId ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Portal User ID
                </span>
                <span className="text-base font-mono font-black text-blue-950 block">{portalUserId}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Email Address
                </span>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {email || <span className="text-slate-400 font-normal italic">Not Provided</span>}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Credential Email Status
                </span>
                <div>
                  {emailStatus === 'SENT' && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Sent ✓</span>
                    </span>
                  )}
                  {emailStatus === 'SKIPPED_NO_EMAIL' && (
                    <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs font-bold border border-slate-200">
                      <span>Not Sent (No email)</span>
                    </span>
                  )}
                  {emailStatus === 'FAILED' && (
                    <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full text-xs font-bold border border-rose-200">
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      <span>Failed to Send ⚠</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
              >
                Return to Staff Directory
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={handleResendCredentials}
                  disabled={isResending}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isResending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-700" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-indigo-700" />
                  )}
                  <span>Resend Credentials</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onStaffAdded(staff);
                    onClose();
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>View Staff Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="add-staff-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="add-staff-modal-container"
        className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-6 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-black">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add New Faculty / Staff</h2>
              <p className="text-xs text-slate-500">
                Register complete personnel profile, academic qualifications, school allocation, and portal access.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="add-staff-modal-close-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body: 6 Structured Cards */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          
          {/* ========================================================= */}
          {/* 1. PERSONAL INFORMATION */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">* Required fields</span>
            </div>

            {/* Photo Upload */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200">
              <StaffPhotoUploader
                photo={photo}
                photoFileKey={photoFileKey}
                onUploadingChange={setIsPhotoUploading}
                onChange={(newPhoto, newFileKey) => {
                  setPhoto(newPhoto);
                  setPhotoFileKey(newFileKey);
                }}
                label="Profile Photograph"
                required={true}
              />
              {formTouched && !photo && (
                <p className="text-xs text-red-600 font-medium mt-1">
                  Profile photo is required. Please upload a photo to proceed.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Full Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar Sharma"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Father's Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Father's Name</label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="e.g. Shri Ram Narayan Sharma"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Mother's Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mother's Name</label>
                <input
                  type="text"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  placeholder="e.g. Smt. Shanti Devi"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Blood Group */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden font-mono"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="e.g. rajesh.sharma@cps.school.edu"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Alternate Mobile Number */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alternate Mobile Number</label>
                <input
                  type="tel"
                  value={alternateMobile}
                  onChange={(e) => setAlternateMobile(e.target.value)}
                  placeholder="Secondary mobile contact"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden font-mono"
                />
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="e.g. +91 94310 12345 (Spouse)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Residential Address */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  placeholder="Street address, colony, landmark"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* City */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Sheohar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* State */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Bihar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* PIN Code */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIN Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 843329"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden font-mono"
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. PROFESSIONAL INFORMATION */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <h3 className="text-sm font-bold text-slate-900">Professional Information</h3>
              </div>
              <span className="text-[11px] text-slate-500">Service background & academic credentials</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Employee ID (Auto Generated) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Employee ID (Auto Generated)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-blue-900 text-xs">
                    {employeeId || 'Generating...'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium px-2 py-1 bg-slate-100 rounded-lg">
                    System Assigned
                  </span>
                </div>
              </div>

              {/* Portal Role & Designation Selection */}
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <div>
                  <label className="block font-bold text-xs text-blue-950 mb-1">
                    Portal Role <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={portalRole}
                    onChange={(e) => handleRoleChange(e.target.value as PortalStaffRole)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-xl bg-white font-bold text-blue-900 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    {STAFF_PORTAL_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-xs text-purple-950 mb-1">
                    Designation <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-xl bg-white font-bold text-purple-900 text-xs focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                  >
                    {(STAFF_ROLE_DESIGNATIONS[portalRole] || []).map((des) => (
                      <option key={des} value={des}>
                        {des}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Highest Qualification */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Highest Qualification</label>
                <input
                  type="text"
                  value={highestQualification}
                  onChange={(e) => setHighestQualification(e.target.value)}
                  placeholder="e.g. M.Sc. Mathematics, B.Ed."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Date of Joining */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date of Joining</label>
                <input
                  type="date"
                  value={dateOfJoining}
                  onChange={(e) => setDateOfJoining(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Employment Type */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                >
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Total Experience */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Total Experience</label>
                <input
                  type="text"
                  value={totalExperience}
                  onChange={(e) => setTotalExperience(e.target.value)}
                  placeholder="e.g. 5 Years (3 Years CBSE, 2 Years State)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Subject Expertise (Dynamic from Academic Structure) */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">
                    Subject Expertise (Academic Structure Dynamic)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Select the curriculum subjects in which this educator is qualified and specialized.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {selectedSubjectExpertise.length} Selected
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {academicSubjects.length > 0 ? (
                  academicSubjects.map((sub) => {
                    const isSelected = selectedSubjectExpertise.includes(sub.name);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => toggleSubjectExpertise(sub.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        <span>{sub.name}</span>
                        {sub.code && <span className="text-[10px] opacity-75 font-mono">({sub.code})</span>}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-amber-700 italic">
                    No subjects found in Academic Structure. Please create subjects in Academics.
                  </p>
                )}
              </div>
            </div>

            {/* Classes / Grades Qualified to Teach */}
            <div className="space-y-2">
              <label className="block font-semibold text-slate-700">
                Classes / Grades Qualified to Teach
              </label>
              <div className="flex flex-wrap gap-1.5">
                {academicClasses.map((cls) => {
                  const isChecked = classesQualified.includes(cls.name);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleQualifiedClass(cls.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        isChecked
                          ? 'bg-purple-50 text-purple-900 border-purple-300 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {cls.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Professional Certifications */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Professional Certifications
              </label>
              <input
                type="text"
                value={certifications}
                onChange={(e) => setCertifications(e.target.value)}
                placeholder="e.g. CTET Paper 1 & 2, CBSE Competency Training, NEP 2020 Certified"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. SCHOOL ASSIGNMENT */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <h3 className="text-sm font-bold text-slate-900">School Assignment</h3>
              </div>
              <span className="text-[11px] text-slate-500">Initial Academic Allocation</span>
            </div>

            {/* Timetable Sync Notice */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Academic Integration Note:</strong> Subject Expertise defines the educator's domain qualifications.
                The actual Assigned Subject, Class, and Section will be managed and scheduled through the academic assignment
                and the <strong>Weekly Master Timetable system</strong>.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Assigned Class */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Class</label>
                <select
                  value={assignedClassId}
                  onChange={(e) => setAssignedClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                >
                  <option value="">-- None / Unassigned --</option>
                  {academicClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Section */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Section</label>
                <select
                  disabled={!assignedClassId}
                  value={assignedSection}
                  onChange={(e) => setAssignedSection(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Subject */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Subject</label>
                <select
                  value={assignedSubjectName}
                  onChange={(e) => setAssignedSubjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                >
                  <option value="">-- None / Unassigned --</option>
                  {academicSubjects.map((sub) => (
                    <option key={sub.id} value={sub.name}>
                      {sub.name} {sub.code ? `(${sub.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Class Teacher Responsibility */}
            {assignedClassId && assignedSection && (
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-purple-950 block">Class Teacher Responsibility</span>
                  <p className="text-[11px] text-purple-700">
                    Assign this educator as designated Class Teacher for{' '}
                    <strong>
                      {selectedClassObj?.name} - Section {assignedSection}
                    </strong>
                    .
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isClassTeacher}
                    onChange={(e) => setIsClassTeacher(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 4. PAYROLL */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  4
                </span>
                <h3 className="text-sm font-bold text-slate-900">Payroll Information</h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Lock className="w-3 h-3" />
                <span>Restricted to Authorized Admins</span>
              </div>
            </div>

            {!isPayrollAuthorized ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                <Lock className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="font-semibold text-slate-700">Payroll Fields Restricted</p>
                <p className="text-[11px] text-slate-500">
                  Only Super Admin, Principal, and Accounts Officers can configure employee salary and banking details.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Monthly Salary */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Monthly Salary (INR ₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(Number(e.target.value))}
                      placeholder="45000"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Bank Account Number */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={bankAccountNo}
                    onChange={(e) => setBankAccountNo(e.target.value)}
                    placeholder="e.g. 918237192837"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden font-mono"
                  />
                </div>

                {/* IFSC Code */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden font-mono uppercase"
                  />
                </div>

                {/* Bank Name */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. State Bank of India"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* Branch */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    placeholder="e.g. Sheohar Main Branch"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* PAN Number */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. ABCDE1234F"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden font-mono uppercase"
                  />
                </div>

                {/* UAN Number */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">UAN Number</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={uanNumber}
                    onChange={(e) => setUanNumber(e.target.value)}
                    placeholder="e.g. 100912345678"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">12-digit Universal Account Number</span>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 5. DOCUMENTS */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  5
                </span>
                <h3 className="text-sm font-bold text-slate-900">Documents</h3>
              </div>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Official Records
              </span>
            </div>

            {/* Document Uploader Tool */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Document Type</label>
                  <select
                    value={currentDocType}
                    onChange={(e) => setCurrentDocType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                  >
                    {DOCUMENT_TYPES.map((dt) => (
                      <option key={dt.id} value={dt.id}>
                        {dt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Document Title / Note</label>
                  <input
                    type="text"
                    value={docCustomTitle}
                    onChange={(e) => setDocCustomTitle(e.target.value)}
                    placeholder="e.g. Master's Degree Certificate (B.U.)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <FileUploadComponent
                uploadType="staff-document"
                label="Upload Document"
                onUploadComplete={handleDocumentUploaded}
                acceptedTypes=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                limitMB={15}
              />
            </div>

            {/* Attached Documents List */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Attached Documents ({documents.length})
                </span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {documents.map((doc) => (
                    <div key={doc.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <strong className="text-slate-900 block">{doc.title}</strong>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-600">
                              {DOCUMENT_TYPES.find((d) => d.id === doc.documentType)?.label || 'Document'}
                            </span>
                            <span>• {doc.originalFileName}</span>
                            <span>• {(doc.fileSize / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(doc.id, doc.fileKey)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="Remove Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 6. PORTAL ACCESS */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  6
                </span>
                <h3 className="text-sm font-bold text-slate-900">Portal Access & Credentials</h3>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={enableLogin}
                  onChange={(e) => setEnableLogin(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span>Enable Login</span>
              </label>
            </div>

            {enableLogin ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Read-only Portal Role derived from Step 2 */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Portal Role <span className="text-slate-400 font-normal">(From Step 2)</span>
                    </label>
                    <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-900 text-xs flex items-center justify-between">
                      <span>{STAFF_PORTAL_ROLES.find((r) => r.id === portalRole)?.label || portalRole}</span>
                    </div>
                  </div>

                  {/* Read-only Designation derived from Step 2 */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Designation <span className="text-slate-400 font-normal">(From Step 2)</span>
                    </label>
                    <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl font-bold text-purple-900 text-xs truncate">
                      {designation}
                    </div>
                  </div>

                  {/* Login ID (Auto Generated Employee ID) */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Login ID (Employee ID)</label>
                    <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-blue-900 text-xs">
                      {employeeId || 'System Generated'}
                    </div>
                  </div>

                  {/* Registered Mobile / Email */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Registered Mobile / Email</label>
                    <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-700 text-xs truncate">
                      {mobileNumber || 'Enter mobile in Section 1'}
                    </div>
                  </div>

                  {/* Password Setup */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">
                        Initial Portal Password
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[11px] text-blue-700 hover:underline font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Generate Strong Password</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={initialPassword}
                        onChange={(e) => setInitialPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Never display or store plain-text passwords once saved. Password is hashed securely.</span>
                    </p>
                  </div>

                  {/* Account Status */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                    <select
                      value={accountStatus}
                      onChange={(e) => setAccountStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="LEFT_SCHOOL">Left School</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-100 rounded-xl text-slate-500 text-xs">
                Portal login is disabled for this staff record. They will not be able to log into the ERP web application.
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs">
            <div className="text-[11px] text-slate-500">
              Review all sections carefully before saving.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="add-staff-cancel-btn"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="add-staff-submit-btn"
                disabled={isSubmitting || isPhotoUploading}
                className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : isPhotoUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Uploading photo…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Faculty Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
