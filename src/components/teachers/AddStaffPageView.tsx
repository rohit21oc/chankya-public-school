import { QualifiedClassesPicker, qualifiedSectionsError, qualifiedSectionsPayload } from './QualifiedClassesPicker';
import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck,
  FileText,
  GraduationCap,
  Home,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Plus,
  School,
  Shield,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AcademicClass,
  AttachedDocument,
  Hostel,
  Subject,
  TeacherStaff,
  TransportRoute,
  TransportVehicle,
  UserRole,
} from '../../types';
import { api } from '../../services/api';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { fileUploadService } from '../../services/fileUploadService';
import {
  STAFF_PORTAL_ROLES,
  isNoLoginStaffRole,
  STAFF_ROLE_DESIGNATIONS,
  PortalStaffRole,
  shouldShowTeachingFields,
  getDefaultDesignationForRole,
} from '../../constants/staffRoles';
import {
  HIGHEST_ACADEMIC_QUALIFICATIONS,
  DEPARTMENT_WING_OPTIONS,
  getDefaultDepartmentForRole,
} from '../../constants/staffFormConstants';
import { StaffAddressSection, AddressState } from './form/StaffAddressSection';
import { StaffCertificationsSelector } from './form/StaffCertificationsSelector';
import { buildInchargeOptions } from '../../utils/classIncharge';
import { StaffDocumentManager } from './form/StaffDocumentManager';
import { StaffPhotoUploader } from './form/StaffPhotoUploader';
import { useStaffDraft } from './form/useStaffDraft';
import { DraftRestoreBanner, DraftStatus, SectionNav } from './form/StaffFormChrome';

interface AddStaffPageViewProps {
  onBack: () => void;
  onStaffAdded: (newStaff: TeacherStaff) => void;
  currentUserRole?: UserRole;
}

const EMPLOYMENT_TYPES = [
  'Full Time',
  'Part Time',
  'Contract',
  'Temporary',
  'Permanent',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DOCUMENT_TYPES = [
  { id: 'AADHAAR', label: 'Aadhaar / ID Proof' },
  { id: 'QUALIFICATION', label: 'Qualification Certificate' },
  { id: 'EXPERIENCE', label: 'Experience Certificate' },
  { id: 'APPOINTMENT', label: 'Joining / Appointment Letter' },
  { id: 'OTHER', label: 'Other Documents' },
];

export const AddStaffPageView: React.FC<AddStaffPageViewProps> = ({
  onBack,
  onStaffAdded,
  currentUserRole = 'SUPER_ADMIN',
}) => {
  const isPayrollAuthorized = [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'ACCOUNTANT',
    'HR_STAFF',
  ].includes(currentUserRole);

  // Auto-generated Employee ID
  const [employeeId, setEmployeeId] = useState<string>('');

  // Registration Outcome Summary State
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

  // Dynamic School Structure Data
  const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>([]);
  const [academicSubjects, setAcademicSubjects] = useState<Subject[]>([]);
  const [hostelsList, setHostelsList] = useState<Hostel[]>([]);
  const [routesList, setRoutesList] = useState<TransportRoute[]>([]);
  const [vehiclesList, setVehiclesList] = useState<TransportVehicle[]>([]);

  // ========================================================
  // FORM STATE
  // ========================================================

  // 1. Personal Information
  const [fullName, setFullName] = useState('');
  const [photo, setPhoto] = useState('');
  const [photoFileKey, setPhotoFileKey] = useState('');
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [addressState, setAddressState] = useState<AddressState>({
    permanentAddress: '',
    permanentState: 'Bihar',
    permanentCity: 'Sheohar',
    permanentPincode: '843329',
    currentAddress: '',
    currentState: 'Bihar',
    currentCity: 'Sheohar',
    currentPincode: '843329',
    sameAsPermanentAddress: true,
  });
  const [emergencyContact, setEmergencyContact] = useState('');

  // 2. Professional Information & Portal Role
  const [portalRole, setPortalRole] = useState<PortalStaffRole>('TEACHER');
  const [designation, setDesignation] = useState<string>('PGT Teacher');
  const [highestQualification, setHighestQualification] = useState<string>('');
  const [customQualification, setCustomQualification] = useState<string>('');
  // Today in the school's timezone (IST), not the browser's UTC date.
  const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const [dateOfJoining, setDateOfJoining] = useState(todayIst);
  // Default "Salary from": the joining date, or the 1st of the current month for someone who joined earlier
  // (their earlier salary was paid outside the ERP). The server applies the same rule.
  const firstOfThisMonth = `${todayIst.substring(0, 7)}-01`;
  const defaultSalaryFrom = dateOfJoining && dateOfJoining > firstOfThisMonth ? dateOfJoining : firstOfThisMonth;
  const [employmentType, setEmploymentType] = useState('Full Time');
  const [totalExperience, setTotalExperience] = useState('');
  const [selectedSubjectExpertise, setSelectedSubjectExpertise] = useState<string[]>([]);
  const [classesQualified, setClassesQualified] = useState<string[]>([]);
  // Sections taught in each qualified class, keyed by lower-case class name.
  const [qualifiedSections, setQualifiedSections] = useState<Record<string, string[]>>({});
  const [certificationsList, setCertificationsList] = useState<string[]>([]);
  const [customCertification, setCustomCertification] = useState<string>('');
  const [alsoPerformsTeaching, setAlsoPerformsTeaching] = useState(false);
  const [departmentWing, setDepartmentWing] = useState<string>('Senior Wing');
  const [customDepartment, setCustomDepartment] = useState<string>('');

  // Role-specific assignment details
  const [assignedClassId, setAssignedClassId] = useState('');
  const [assignedSection, setAssignedSection] = useState('');
  const [assignedPrimarySubject, setAssignedPrimarySubject] = useState('');
  const [teachingWorkload, setTeachingWorkload] = useState<number>(24);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [inchargeValue, setInchargeValue] = useState('');
  const [houseClubResponsibilities, setHouseClubResponsibilities] = useState<string[]>([]);
  const [customHouseClub, setCustomHouseClub] = useState<string>('');

  // Non-teaching specific fields
  const [accountingResponsibilities, setAccountingResponsibilities] = useState('');
  const [hrResponsibilities, setHrResponsibilities] = useState('');
  const [employeeManagementScope, setEmployeeManagementScope] = useState('');
  const [payrollHrAccessScope, setPayrollHrAccessScope] = useState('');
  const [hostelId, setHostelId] = useState('');
  const [hostelBlock, setHostelBlock] = useState('');
  const [wardenResponsibility, setWardenResponsibility] = useState('');
  const [dutyTiming, setDutyTiming] = useState('08:00 AM - 04:00 PM');
  const [residentialDuty, setResidentialDuty] = useState(false);
  const [emergencyResponsibility, setEmergencyResponsibility] = useState('');
  const [transportResponsibility, setTransportResponsibility] = useState('');
  const [assignedRoutes, setAssignedRoutes] = useState<string[]>([]);
  const [assignedVehicles, setAssignedVehicles] = useState<string[]>([]);
  const [operationsResponsibility, setOperationsResponsibility] = useState('');
  const [academicResponsibilities, setAcademicResponsibilities] = useState('');
  const [administrativeResponsibilities, setAdministrativeResponsibilities] = useState('');

  // 4. Payroll & Bank Details
  // Empty until entered: a salary is never assumed.
  const [monthlySalary, setMonthlySalary] = useState<number | ''>('');
  // "Salary from": empty means the default (joining date, or the 1st of this month if they joined earlier).
  const [salaryStartDate, setSalaryStartDate] = useState<string>('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [uanNumber, setUanNumber] = useState('');

  // 5. Attached Documents
  const [documents, setDocuments] = useState<AttachedDocument[]>([]);
  const [currentDocType, setCurrentDocType] = useState('AADHAAR');
  const [docCustomTitle, setDocCustomTitle] = useState('');

  // 6. Portal Access
  const [enableLogin, setEnableLogin] = useState(true);
  const [initialPassword, setInitialPassword] = useState('Cps@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LEFT_SCHOOL'>('ACTIVE');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Half-filled form is kept in this browser (not the server) so closing the page loses nothing.
  const draft = useStaffDraft(
    {
    fullName: [fullName, setFullName] as const,
    photo: [photo, setPhoto] as const,
    photoFileKey: [photoFileKey, setPhotoFileKey] as const,
    fatherName: [fatherName, setFatherName] as const,
    motherName: [motherName, setMotherName] as const,
    dob: [dob, setDob] as const,
    gender: [gender, setGender] as const,
    bloodGroup: [bloodGroup, setBloodGroup] as const,
    mobileNumber: [mobileNumber, setMobileNumber] as const,
    emailAddress: [emailAddress, setEmailAddress] as const,
    alternateMobile: [alternateMobile, setAlternateMobile] as const,
    addressState: [addressState, setAddressState] as const,
    emergencyContact: [emergencyContact, setEmergencyContact] as const,
    portalRole: [portalRole, setPortalRole] as const,
    designation: [designation, setDesignation] as const,
    highestQualification: [highestQualification, setHighestQualification] as const,
    customQualification: [customQualification, setCustomQualification] as const,
    dateOfJoining: [dateOfJoining, setDateOfJoining] as const,
    employmentType: [employmentType, setEmploymentType] as const,
    totalExperience: [totalExperience, setTotalExperience] as const,
    selectedSubjectExpertise: [selectedSubjectExpertise, setSelectedSubjectExpertise] as const,
    classesQualified: [classesQualified, setClassesQualified] as const,
    qualifiedSections: [qualifiedSections, setQualifiedSections] as const,
    certificationsList: [certificationsList, setCertificationsList] as const,
    customCertification: [customCertification, setCustomCertification] as const,
    alsoPerformsTeaching: [alsoPerformsTeaching, setAlsoPerformsTeaching] as const,
    departmentWing: [departmentWing, setDepartmentWing] as const,
    customDepartment: [customDepartment, setCustomDepartment] as const,
    assignedClassId: [assignedClassId, setAssignedClassId] as const,
    assignedSection: [assignedSection, setAssignedSection] as const,
    assignedPrimarySubject: [assignedPrimarySubject, setAssignedPrimarySubject] as const,
    teachingWorkload: [teachingWorkload, setTeachingWorkload] as const,
    isClassTeacher: [isClassTeacher, setIsClassTeacher] as const,
    inchargeValue: [inchargeValue, setInchargeValue] as const,
    houseClubResponsibilities: [houseClubResponsibilities, setHouseClubResponsibilities] as const,
    customHouseClub: [customHouseClub, setCustomHouseClub] as const,
    accountingResponsibilities: [accountingResponsibilities, setAccountingResponsibilities] as const,
    hrResponsibilities: [hrResponsibilities, setHrResponsibilities] as const,
    employeeManagementScope: [employeeManagementScope, setEmployeeManagementScope] as const,
    payrollHrAccessScope: [payrollHrAccessScope, setPayrollHrAccessScope] as const,
    hostelId: [hostelId, setHostelId] as const,
    hostelBlock: [hostelBlock, setHostelBlock] as const,
    wardenResponsibility: [wardenResponsibility, setWardenResponsibility] as const,
    dutyTiming: [dutyTiming, setDutyTiming] as const,
    residentialDuty: [residentialDuty, setResidentialDuty] as const,
    emergencyResponsibility: [emergencyResponsibility, setEmergencyResponsibility] as const,
    transportResponsibility: [transportResponsibility, setTransportResponsibility] as const,
    assignedRoutes: [assignedRoutes, setAssignedRoutes] as const,
    assignedVehicles: [assignedVehicles, setAssignedVehicles] as const,
    operationsResponsibility: [operationsResponsibility, setOperationsResponsibility] as const,
    academicResponsibilities: [academicResponsibilities, setAcademicResponsibilities] as const,
    administrativeResponsibilities: [administrativeResponsibilities, setAdministrativeResponsibilities] as const,
    monthlySalary: [monthlySalary, setMonthlySalary] as const,
    salaryStartDate: [salaryStartDate, setSalaryStartDate] as const,
    bankAccountNo: [bankAccountNo, setBankAccountNo] as const,
    ifscCode: [ifscCode, setIfscCode] as const,
    bankName: [bankName, setBankName] as const,
    bankBranch: [bankBranch, setBankBranch] as const,
    panNumber: [panNumber, setPanNumber] as const,
    uanNumber: [uanNumber, setUanNumber] as const,
    documents: [documents, setDocuments] as const,
    enableLogin: [enableLogin, setEnableLogin] as const,
    accountStatus: [accountStatus, setAccountStatus] as const,
    },
    api.getCurrentUser()?.id || ''
  );
  const pendingDraft = draft.pendingDraft;
  const restoreDraft = draft.restore;
  const discardDraft = draft.discard;
  const clearDraft = draft.clear;
  const draftSavedAt = draft.savedAt;
  const draftStorageFailed = draft.storageFailed;

  // Load initial data
  useEffect(() => {
    const nextId = api.getNextStaffEmployeeId();
    setEmployeeId(nextId);
    api.syncClasses().then((cls) => {
      const active = (cls || []).filter((c) => (c.status || 'ACTIVE') === 'ACTIVE');
      setAcademicClasses(active);
    });
    setAcademicClasses(api.getActiveClasses());
    setAcademicSubjects(api.getSubjects());
    setHostelsList(api.getHostels());
    // The cached list can be empty when the Hostel page was never opened: load it from the server.
    api.fetchHostels().then((d) => setHostelsList(d.hostels || [])).catch(() => {});
    setRoutesList(api.getRoutes());
    setVehiclesList(api.getVehicles());
  }, []);

  // Handle Portal Role Selection Change
  const handleRoleChange = (newRole: PortalStaffRole) => {
    setPortalRole(newRole);
    const defaultDes = getDefaultDesignationForRole(newRole);
    setDesignation(defaultDes);
    setDepartmentWing(getDefaultDepartmentForRole(newRole));
    // Support staff never get an app login; switching back to a login role turns it on again.
    setEnableLogin(!isNoLoginStaffRole(newRole));

    // Reset optional teaching toggle for warden / academic coordinator
    if (newRole !== 'ACADEMIC_COORDINATOR' && newRole !== 'HOSTEL_WARDEN') {
      setAlsoPerformsTeaching(false);
    }
  };

  const selectedClassObj = useMemo(() => {
    return academicClasses.find(
      (c) => c.id === assignedClassId || c.name === assignedClassId
    );
  }, [academicClasses, assignedClassId]);

  const inchargeOptions = useMemo(
    () => buildInchargeOptions(academicClasses, assignedClassId ? [assignedClassId, selectedClassObj?.name || ''] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [academicClasses, assignedClassId, selectedClassObj]
  );

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

  useEffect(() => {
    if (selectedClassObj && availableSections.length > 0) {
      if (!availableSections.includes(assignedSection)) {
        setAssignedSection(availableSections[0]);
      }
    } else {
      setAssignedSection('');
    }
  }, [assignedClassId, selectedClassObj, availableSections]);

  const toggleSubjectExpertise = (subName: string) => {
    setSelectedSubjectExpertise((prev) =>
      prev.includes(subName) ? prev.filter((s) => s !== subName) : [...prev, subName]
    );
  };

  const toggleQualifiedClass = (className: string) => {
    const removing = classesQualified.includes(className);
    setClassesQualified((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
    setQualifiedSections((prev) => {
      const next = { ...prev };
      if (removing) delete next[className.toLowerCase()];
      else if (!next[className.toLowerCase()]) next[className.toLowerCase()] = [];
      return next;
    });
  };
  const setSectionsFor = (className: string, sections: string[]) =>
    setQualifiedSections((prev) => ({ ...prev, [className.toLowerCase()]: sections }));

  const toggleRouteAssignment = (routeId: string) => {
    setAssignedRoutes((prev) =>
      prev.includes(routeId) ? prev.filter((r) => r !== routeId) : [...prev, routeId]
    );
  };

  const toggleVehicleAssignment = (vehicleId: string) => {
    setAssignedVehicles((prev) =>
      prev.includes(vehicleId) ? prev.filter((v) => v !== vehicleId) : [...prev, vehicleId]
    );
  };

  const handleDocumentUploaded = (res: {
    fileKey: string;
    originalFileName: string;
    contentType?: string;
    fileSize?: number;
    uploadedAt: string;
  }) => {
    const docTypeObj = DOCUMENT_TYPES.find((d) => d.id === currentDocType);
    const title = docCustomTitle.trim() || docTypeObj?.label || res.originalFileName;

    const newDoc: AttachedDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title,
      documentType: currentDocType as any,
      fileKey: res.fileKey,
      originalFileName: res.originalFileName,
      fileSize: res.fileSize || 0,
      contentType: res.contentType || 'application/pdf',
      uploadedAt: res.uploadedAt || new Date().toISOString(),
      verificationStatus: 'PENDING',
    };

    setDocuments((prev) => [...prev, newDoc]);
    setDocCustomTitle('');
  };

  const handleRemoveDocument = async (id: string, fileKey?: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (fileKey) {
      try {
        await fileUploadService.deleteFile(fileKey);
      } catch (e) {
        console.warn('Could not delete detached file from storage', e);
      }
    }
  };

  // Check whether teaching fields are visible
  const isTeachingVisible = shouldShowTeachingFields(portalRole, alsoPerformsTeaching);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isPhotoUploading) {
      setErrorMessage('The photo is still uploading. Please wait for it to finish before saving.');
      return;
    }

    const sectionsErr = isTeachingVisible ? qualifiedSectionsError(academicClasses, classesQualified, qualifiedSections) : null;
    if (sectionsErr) {
      setErrorMessage(sectionsErr);
      return;
    }
    if (!fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }
    if (!mobileNumber.trim()) {
      setErrorMessage('Mobile Number is required.');
      return;
    }
    if (mobileNumber.replace(/\D/g, '').slice(-10).length < 10) {
      setErrorMessage('Mobile number must have 10 digits.');
      return;
    }
    if (!gender) {
      setErrorMessage('Please select the gender.');
      return;
    }
    if (!dob) {
      setErrorMessage('Date of birth is required.');
      return;
    }
    if (!highestQualification) {
      setErrorMessage('Please select the highest academic qualification.');
      return;
    }
    if (!designation.trim()) {
      setErrorMessage('Designation is required.');
      return;
    }
    if (!addressState.permanentAddress.trim()) {
      setErrorMessage('Residential / Permanent Address is required.');
      return;
    }
    if (!addressState.permanentPincode.trim() || addressState.permanentPincode.trim().length !== 6) {
      setErrorMessage('A valid 6-digit PIN Code is required for Residential Address.');
      return;
    }
    if (!addressState.sameAsPermanentAddress) {
      if (!addressState.currentAddress.trim()) {
        setErrorMessage('Current Address is required when not same as Residential Address.');
        return;
      }
      if (!addressState.currentPincode.trim() || addressState.currentPincode.trim().length !== 6) {
        setErrorMessage('A valid 6-digit PIN Code is required for Current Address.');
        return;
      }
    }
    if (isPayrollAuthorized && dateOfJoining && (salaryStartDate || defaultSalaryFrom) < dateOfJoining) {
      setErrorMessage('"Salary from" cannot be before the date of joining.');
      return;
    }
    if (isPayrollAuthorized && !(Number(monthlySalary) > 0)) {
      setErrorMessage('Please enter the monthly salary. Payroll is not generated for staff without a salary.');
      return;
    }
    if (highestQualification === 'Other' && !customQualification.trim()) {
      setErrorMessage('Please specify your custom Highest Academic Qualification.');
      return;
    }
    if (departmentWing === 'Other' && !customDepartment.trim()) {
      setErrorMessage('Please specify your custom Department / Wing.');
      return;
    }
    if (certificationsList.includes('Other') && !customCertification.trim()) {
      setErrorMessage('Please specify your custom Certification.');
      return;
    }
    if (isTeachingVisible && isClassTeacher && !inchargeOptions.some((o) => o.value === inchargeValue)) {
      setErrorMessage('Select a valid Class Incharge class and section, or turn off Assign as Class Incharge.');
      return;
    }

    setIsSubmitting(true);

    try {
      const assignedClassesList: string[] = [];
      if (assignedClassId) {
        const clsName = selectedClassObj ? selectedClassObj.name : assignedClassId;
        assignedClassesList.push(assignedSection ? `${clsName}-${assignedSection}` : clsName);
      }

      const assignedSubjectsList: string[] = [];
      if (assignedPrimarySubject) assignedSubjectsList.push(assignedPrimarySubject);
      // Every subject in Subject Expertise is a subject this teacher can handle.
      selectedSubjectExpertise.forEach((s) => {
        if (!assignedSubjectsList.includes(s)) assignedSubjectsList.push(s);
      });

      const selectedHostelObj = hostelsList.find((h) => h.id === hostelId);

      const finalQualification = highestQualification === 'Other' ? 'Other' : highestQualification;
      const finalDepartment = departmentWing === 'Other' ? 'Other' : departmentWing;

      const combinedCertificationsStr = [
        ...certificationsList.filter((c) => c !== 'Other'),
        ...(certificationsList.includes('Other') && customCertification.trim() ? [`Other: ${customCertification.trim()}`] : []),
      ].join(', ');

      const combinedHouseClubStr = [
        ...houseClubResponsibilities.filter((h) => h !== 'Other'),
        ...(houseClubResponsibilities.includes('Other') && customHouseClub.trim() ? [`Other: ${customHouseClub.trim()}`] : []),
      ].join(', ');

      const staffData: Partial<TeacherStaff> & any = {
        name: fullName.trim(),
        // The employee ID shown on this page is a preview; the server allocates the final one.
        employeeId: undefined,
        photo: photo || undefined,
        photoFileKey: photoFileKey || undefined,
        documents: documents.length > 0 ? documents : undefined,
        fatherName: fatherName.trim() || undefined,
        motherName: motherName.trim() || undefined,
        fatherOrMotherName: fatherName.trim() || motherName.trim() || undefined,
        dob,
        gender,
        bloodGroup: bloodGroup || undefined,
        phone: mobileNumber.trim(),
        email: emailAddress.trim() || undefined,
        alternatePhone: alternateMobile.trim() || undefined,
        address: addressState.permanentAddress.trim() || 'Staff Quarters, School Campus',
        city: addressState.permanentCity || 'Sheohar',
        state: addressState.permanentState || 'Bihar',
        pincode: addressState.permanentPincode || '843329',
        permanentAddress: addressState.permanentAddress.trim(),
        permanentCity: addressState.permanentCity || 'Sheohar',
        permanentState: addressState.permanentState || 'Bihar',
        permanentPincode: addressState.permanentPincode || '843329',
        currentAddress: addressState.sameAsPermanentAddress
          ? addressState.permanentAddress.trim()
          : (addressState.currentAddress.trim() || addressState.permanentAddress.trim()),
        currentCity: addressState.sameAsPermanentAddress
          ? addressState.permanentCity
          : (addressState.currentCity || 'Sheohar'),
        currentState: addressState.sameAsPermanentAddress
          ? addressState.permanentState
          : (addressState.currentState || 'Bihar'),
        currentPincode: addressState.sameAsPermanentAddress
          ? addressState.permanentPincode
          : (addressState.currentPincode || '843329'),
        sameAsPermanentAddress: addressState.sameAsPermanentAddress,
        emergencyContact: emergencyContact.trim() || mobileNumber.trim(),

        // Role & Designation Separation
        portalRole,
        systemRole: portalRole,
        role: portalRole,
        designation,
        department: finalDepartment,
        customDepartment: departmentWing === 'Other' ? customDepartment.trim() : undefined,
        academicDepartment: finalDepartment,
        qualification: finalQualification,
        customQualification: highestQualification === 'Other' ? customQualification.trim() : undefined,
        joiningDate: dateOfJoining,
        employmentType,
        totalExperience: totalExperience.trim() || undefined,
        experienceYears: parseInt(totalExperience) || 0,
        certifications: combinedCertificationsStr || undefined,
        certificationsList,
        customCertification: customCertification.trim() || undefined,
        alsoPerformsTeaching,

        // Academic fields
        subjectExpertise: selectedSubjectExpertise.length > 0 ? selectedSubjectExpertise : undefined,
        specializationSubjects: selectedSubjectExpertise.length > 0 ? selectedSubjectExpertise : undefined,
        classesQualifiedToTeach: classesQualified.length > 0 ? classesQualified.join(', ') : undefined,
        qualifiedClasses: classesQualified,
        qualifiedClassSections: qualifiedSectionsPayload(classesQualified, qualifiedSections),
        assignedClasses: assignedClassesList,
        assignedSubjects: assignedSubjectsList,
        assignedPrimarySubject: assignedPrimarySubject || undefined,
        teachingWorkload: isTeachingVisible ? Math.min(50, Math.max(0, Number(teachingWorkload) || 0)) : undefined,
        classTeacherOf: isTeachingVisible && isClassTeacher && inchargeValue ? inchargeValue : undefined,
        houseClubResponsibility: combinedHouseClubStr || undefined,
        houseClubResponsibilities,
        customHouseClub: customHouseClub.trim() || undefined,
        academicResponsibilities: academicResponsibilities.trim() || undefined,
        administrativeResponsibilities: administrativeResponsibilities.trim() || undefined,

        // Department-specific non-teaching fields
        accountingResponsibilities: accountingResponsibilities.trim() || undefined,
        hrResponsibilities: hrResponsibilities.trim() || undefined,
        employeeManagementScope: employeeManagementScope.trim() || undefined,
        payrollHrAccessScope: payrollHrAccessScope.trim() || undefined,
        hostelId: hostelId || undefined,
        hostelName: selectedHostelObj?.name || undefined,
        hostelBlock: hostelBlock.trim() || undefined,
        wardenResponsibility: wardenResponsibility.trim() || undefined,
        dutyTiming: dutyTiming.trim() || undefined,
        residentialDuty,
        emergencyResponsibility: emergencyResponsibility.trim() || undefined,
        transportResponsibility: transportResponsibility.trim() || undefined,
        assignedRoutes: assignedRoutes.length > 0 ? assignedRoutes : undefined,
        assignedVehicles: assignedVehicles.length > 0 ? assignedVehicles : undefined,
        operationsResponsibility: operationsResponsibility.trim() || undefined,

        // Structured role-specific profiles for clean persistence
        teachingProfile: isTeachingVisible
          ? {
              subjectExpertise: selectedSubjectExpertise,
              classesQualifiedToTeach: classesQualified,
              assignedClassId,
              assignedClassName: selectedClassObj?.name || '',
              assignedSection,
              assignedPrimarySubject,
              teachingWorkloadPeriods: Number(teachingWorkload) || 0,
              academicDepartment: finalDepartment,
              isClassTeacher: Boolean(isClassTeacher && inchargeValue && inchargeValue === `${selectedClassObj?.name}-${assignedSection}`),
              houseClubResponsibility: combinedHouseClubStr || undefined,
            }
          : undefined,
        departmentAssignment: {
          departmentName: finalDepartment,
          responsibilities: administrativeResponsibilities || academicResponsibilities,
        },
        hostelAssignment:
          portalRole === 'HOSTEL_WARDEN'
            ? {
                hostelId,
                hostelName: selectedHostelObj?.name || '',
                hostelBlock,
                wardenResponsibility,
                shiftTiming: dutyTiming,
                residentialDuty,
                emergencyResponsibility,
              }
            : undefined,
        transportAssignment:
          portalRole === 'TRANSPORT_MANAGER'
            ? {
                assignedRouteIds: assignedRoutes,
                assignedVehicleIds: assignedVehicles,
                transportResponsibility,
                dutyTiming,
                operationsResponsibility,
              }
            : undefined,
        payrollInformation: {
          monthlyGrossSalary: Number(monthlySalary) > 0 ? Number(monthlySalary) : undefined,
          bankAccountNo: bankAccountNo.trim() || undefined,
          ifscCode: ifscCode.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankBranch: bankBranch.trim() || undefined,
          panNumber: panNumber.trim().toUpperCase() || undefined,
          uanNumber: uanNumber.trim() || undefined,
          accountingResponsibilities: accountingResponsibilities.trim() || undefined,
        },
        hrProfile:
          portalRole === 'HR_STAFF'
            ? {
                hrResponsibilities,
                employeeManagementScope,
                payrollHrAccessScope,
              }
            : undefined,

        // Payroll
        monthlySalary: Number(monthlySalary) > 0 ? Number(monthlySalary) : undefined,
        salaryStartDate: isPayrollAuthorized ? salaryStartDate || defaultSalaryFrom : undefined,
        salary:
          Number(monthlySalary) > 0
            ? { basic: Number(monthlySalary), allowances: 0, deductions: 0, net: Number(monthlySalary) }
            : undefined,
        bankAccountNo: bankAccountNo.trim() || undefined,
        ifscCode: ifscCode.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankBranch: bankBranch.trim() || undefined,
        panNumber: panNumber.trim().toUpperCase() || undefined,
        uanNumber: uanNumber.trim() || undefined,

        status: 'ACTIVE',
        loginEnabled: isNoLoginStaffRole(portalRole) ? false : enableLogin,
        initialPassword: isNoLoginStaffRole(portalRole) ? undefined : initialPassword.trim() || 'Cps@2026',
        accountStatus,
      };

      const result = await api.addStaffAsync(staffData);
      const newStaff = result.staff;

      // Confirm Cloudflare R2 file associations
      if (photoFileKey) {
        await fileUploadService.confirmFileAssociation(photoFileKey, {
          type: 'STAFF',
          id: newStaff.id,
        });
      }

      for (const doc of documents) {
        if (doc.fileKey) {
          await fileUploadService.confirmFileAssociation(doc.fileKey, {
            type: 'STAFF',
            id: newStaff.id,
          });
        }
      }

      clearDraft();
      setRegistrationSummary(result);
      setIsSubmitting(false);
      onStaffAdded(newStaff);
    } catch (err: any) {
      console.error('Failed to add staff member:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while saving staff.');
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
          `Login details email accepted for delivery to ${res.email || registrationSummary.email || 'the registered email address'}.`
        );
        setRegistrationSummary((prev) =>
          prev ? { ...prev, emailStatus: 'SENT', message: 'Login details email accepted for delivery.' } : null
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

  // Outcome Summary View after successful creation
  if (registrationSummary) {
    const { staff, employeeId: empId, portalUserId, email, emailStatus } = registrationSummary;

    return (
      <div className="max-w-3xl mx-auto space-y-6 py-4 pb-16">
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Staff Registered Successfully!</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                The staff profile and single-school ERP portal account have been created.
              </p>
            </div>
          </div>

          {/* Account Credential Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Single-School ERP Login Credentials
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-medium text-slate-400 block">Staff Name</span>
                <span className="text-sm font-bold text-slate-900">{staff.name}</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-medium text-slate-400 block">Portal Role & Designation</span>
                <span className="text-sm font-bold text-blue-700">
                  {staff.systemRole || staff.portalRole} • {staff.designation}
                </span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Portal User ID / Employee ID</span>
                  <span className="text-sm font-mono font-bold text-purple-700">{portalUserId || empId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(portalUserId || empId)}
                  className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Copy User ID"
                >
                  {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-medium text-slate-400 block">Initial Temporary Password</span>
                <span className="text-sm font-mono font-bold text-slate-800">
                  {isNoLoginStaffRole(staff.systemRole || staff.portalRole) ? 'No app login (support staff)' : initialPassword}
                </span>
              </div>
            </div>

            {/* Email Dispatch Status */}
            <div className="pt-2 border-t border-slate-200">
              {emailStatus === 'SENT' && (
                <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Login details email accepted for delivery to <strong>{email}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResendCredentials}
                    disabled={isResending}
                    className="text-emerald-800 font-semibold underline text-xs disabled:opacity-50"
                  >
                    {isResending ? 'Sending...' : 'Resend Email'}
                  </button>
                </div>
              )}

              {emailStatus === 'SKIPPED_NO_EMAIL' && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No email address provided. Please provide credentials to the employee manually.</span>
                </div>
              )}

              {emailStatus === 'FAILED' && (
                <div className="flex items-center justify-between text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Email delivery failed for <strong>{email}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResendCredentials}
                    disabled={isResending}
                    className="text-rose-800 font-semibold underline text-xs disabled:opacity-50"
                  >
                    {isResending ? 'Retrying...' : 'Retry Email'}
                  </button>
                </div>
              )}

              {resendStatusMessage && (
                <p className="mt-2 text-xs font-medium text-slate-600 bg-slate-100 p-2.5 rounded-lg">
                  {resendStatusMessage}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Staff Directory</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRegistrationSummary(null);
                setFullName('');
                setEmailAddress('');
                setMobileNumber('');
                setEmployeeId(api.getNextStaffEmployeeId());
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Register Another Staff</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentRoleMeta = STAFF_PORTAL_ROLES.find((r) => r.id === portalRole);
  const designationList = STAFF_ROLE_DESIGNATIONS[portalRole] || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back to Directory"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">Faculty & Staff Registration</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                Single-School ERP
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chanakya Public School & Coaching Centre • Complete employee profile and access provisioning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Auto Employee ID:</span>
          <span className="px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 font-mono font-bold text-xs">
            {employeeId || 'CPS...'}
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Validation Alert</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {pendingDraft && (
        <DraftRestoreBanner draft={pendingDraft} onRestore={restoreDraft} onDiscard={discardDraft} />
      )}

      <SectionNav
        sections={[
          { id: 'staff-sec-personal', label: 'Personal' },
          { id: 'staff-sec-professional', label: 'Professional' },
          { id: 'staff-sec-assignment', label: isTeachingVisible ? 'Classes' : 'Work' },
          ...(isPayrollAuthorized ? [{ id: 'staff-sec-payroll', label: 'Salary & bank' }] : []),
          { id: 'staff-sec-documents', label: 'Documents' },
          { id: 'staff-sec-access', label: 'Login' },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ======================================================== */}
        {/* SECTION 1: PERSONAL INFORMATION */}
        {/* ======================================================== */}
        <div id="staff-sec-personal" className="scroll-mt-16 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Personal Information</h2>
              <p className="text-[11px] text-slate-500">Employee legal identity, contact, and residential parameters</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar Jha"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gender <span className="text-rose-600">*</span>
              </label>
              <select
                value={gender}
                required
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="" disabled>Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date of Birth <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Blood Group
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="">Not known</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Father's Name
              </label>
              <input
                type="text"
                placeholder="e.g. Shri Ram Narayan Sharma"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mother's Name
              </label>
              <input
                type="text"
                placeholder="e.g. Smt. Shanti Devi"
                value={motherName}
                onChange={(e) => setMotherName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Primary Mobile Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="10-digit mobile"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address <span className="text-slate-400 font-normal">(For portal credentials delivery)</span>
              </label>
              <input
                type="email"
                placeholder="staff@chanakyaschool.example"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alternate Mobile / Emergency Contact
              </label>
              <input
                type="tel"
                placeholder="Secondary phone"
                value={alternateMobile}
                onChange={(e) => setAlternateMobile(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-3">
              <StaffAddressSection
                value={addressState}
                onChange={setAddressState}
              />
            </div>
          </div>

          {/* Staff Photo Upload */}
          <div className="pt-3 border-t border-slate-100">
            <StaffPhotoUploader
              photo={photo}
              photoFileKey={photoFileKey}
              onUploadingChange={setIsPhotoUploading}
              onChange={(newPhoto, newFileKey) => {
                setPhoto(newPhoto);
                setPhotoFileKey(newFileKey);
              }}
              label="Staff Photograph"
            />
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 2: PROFESSIONAL INFORMATION (ROLE & DESIGNATION) */}
        {/* ======================================================== */}
        <div id="staff-sec-professional" className="scroll-mt-16 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Professional Information & Portal Role</h2>
                <p className="text-[11px] text-slate-500">
                  Strict separation: Portal Role determines ERP permissions; Designation defines job title
                </p>
              </div>
            </div>
            {currentRoleMeta && (
              <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${currentRoleMeta.badgeColor}`}>
                {currentRoleMeta.label}
              </span>
            )}
          </div>

          {/* Primary Portal Role and Designation Selection */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-700" />
                <span>Portal Role (System Access & Permissions)</span>
                <span className="text-rose-600">*</span>
              </label>
              <select
                value={portalRole}
                onChange={(e) => handleRoleChange(e.target.value as PortalStaffRole)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300 bg-white font-bold text-blue-900 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                {STAFF_PORTAL_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              {currentRoleMeta && (
                <p className="text-[11px] text-slate-500 mt-1">{currentRoleMeta.description}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-purple-700" />
                <span>Designation (Employee Job Position)</span>
                <span className="text-rose-600">*</span>
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-purple-300 bg-white font-bold text-purple-900 text-xs focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
              >
                {designationList.map((des) => (
                  <option key={des} value={des}>
                    {des}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Dynamic options based on {currentRoleMeta?.label || 'Portal Role'}
              </p>
            </div>
          </div>

          {/* Standard Professional Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Employment Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                {EMPLOYMENT_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Highest Academic Qualification <span className="text-rose-600">*</span>
              </label>
              <select
                value={highestQualification}
                required
                onChange={(e) => setHighestQualification(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="" disabled>Select</option>
                {HIGHEST_ACADEMIC_QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date of Joining <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={dateOfJoining}
                onChange={(e) => setDateOfJoining(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Experience
              </label>
              <input
                type="text"
                placeholder="e.g. 5 Years"
                value={totalExperience}
                onChange={(e) => setTotalExperience(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Conditional Custom Qualification input */}
          {highestQualification === 'Other' && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1 animate-in fade-in">
              <label className="block text-xs font-bold text-amber-950">
                Specify Qualification <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter specific academic qualification or doctoral degree"
                value={customQualification}
                onChange={(e) => setCustomQualification(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-amber-300 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden bg-white"
              />
            </div>
          )}

          {/* Department / Wing & Certifications */}
          <div className="space-y-4 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department / Wing <span className="text-rose-600">*</span>
                </label>
                <select
                  value={departmentWing}
                  onChange={(e) => setDepartmentWing(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  {DEPARTMENT_WING_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {departmentWing === 'Other' ? (
                <div>
                  <label className="block text-xs font-bold text-amber-950 mb-1">
                    Specify Department / Wing <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter custom department or specialized unit"
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 text-xs bg-white focus:ring-2 focus:ring-amber-600 focus:outline-hidden"
                  />
                </div>
              ) : (
                <div className="flex items-center text-xs text-slate-500 pt-6">
                  <span>Standard school division aligned with staff role</span>
                </div>
              )}
            </div>

            <StaffCertificationsSelector
              selectedCertifications={certificationsList}
              onChange={setCertificationsList}
              customCertification={customCertification}
              onCustomCertificationChange={setCustomCertification}
            />
          </div>

          {/* Dynamic "Also performs teaching duties" for ACADEMIC_COORDINATOR and HOSTEL_WARDEN */}
          {(portalRole === 'ACADEMIC_COORDINATOR' || portalRole === 'HOSTEL_WARDEN') && (
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-950 block">
                  Also performs teaching duties
                </span>
                <span className="text-[11px] text-indigo-800">
                  Enable this to unlock subject expertise, class allocation, and timetable workload for this employee.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoPerformsTeaching}
                  onChange={(e) => setAlsoPerformsTeaching(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          )}

          {/* Dynamic Subject & Class Qualifications for Teaching-capable roles */}
          {isTeachingVisible && (
            <>
              {/* Subject Expertise Multi-select */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">
                  Subject Expertise <span className="text-[11px] text-slate-400 font-normal">(Select subjects from school academic curriculum)</span>
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[48px]">
                  {academicSubjects.length === 0 ? (
                    <span className="text-xs text-slate-400">Loading academic subjects...</span>
                  ) : (
                    academicSubjects.map((sub) => {
                      const isSelected = selectedSubjectExpertise.includes(sub.name);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => toggleSubjectExpertise(sub.name)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-blue-700 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {sub.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Classes Qualified to Teach Multi-select */}
              <QualifiedClassesPicker classes={academicClasses} value={classesQualified} onToggle={toggleQualifiedClass} sectionsByClass={qualifiedSections} onSectionsChange={setSectionsFor} />
            </>
          )}
        </div>

        {/* ======================================================== */}
        {/* SECTION 3: ROLE-SPECIFIC ASSIGNMENT */}
        {/* ======================================================== */}
        <div id="staff-sec-assignment" className="scroll-mt-16 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isTeachingVisible
                  ? 'Academic & Classroom Assignment'
                  : 'Department & Work Assignment'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isTeachingVisible
                  ? 'Initial classroom allocation, primary subject, and teaching workload'
                  : 'Operational responsibilities, fleet/dormitory allocation, and administrative scope'}
              </p>
            </div>
          </div>

          {/* If teaching capable: Show Academic Classroom & Teaching fields */}
          {isTeachingVisible && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Class
                  </label>
                  <select
                    value={assignedClassId}
                    onChange={(e) => setAssignedClassId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                  >
                    <option value="">-- No Initial Class --</option>
                    {academicClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Section
                  </label>
                  <select
                    value={assignedSection}
                    onChange={(e) => setAssignedSection(e.target.value)}
                    disabled={!assignedClassId}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white disabled:bg-slate-100 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                  >
                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Primary Subject
                  </label>
                  <select
                    value={assignedPrimarySubject}
                    onChange={(e) => setAssignedPrimarySubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                  >
                    <option value="">-- Select Primary Subject --</option>
                    {academicSubjects.map((sub) => (
                      <option key={sub.id} value={sub.name}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teaching Workload (Periods Per Week)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      value={teachingWorkload}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTeachingWorkload(Math.min(50, Math.max(0, val)));
                      }}
                      className="w-full pl-3.5 pr-28 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs font-semibold text-slate-500">
                      periods / week
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Weekly teaching schedule allocation (0 - 50 periods/week)
                  </span>
                </div>

              </div>

              {/* Class Incharge */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">Assign as Class Incharge</span>
                    <span className="text-[11px] text-emerald-800">
                      The Class Incharge marks attendance for that class and section.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isClassTeacher}
                      onChange={(e) => {
                        setIsClassTeacher(e.target.checked);
                        if (!e.target.checked) setInchargeValue('');
                      }}
                      disabled={!assignedClassId}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                {isClassTeacher && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Class Incharge (Class &amp; Section)</label>
                    <select
                      value={inchargeValue}
                      onChange={(e) => setInchargeValue(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                    >
                      <option value="">-- Select class &amp; section --</option>
                      {inchargeOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {inchargeOptions.length === 0 && (
                      <span className="text-[11px] text-amber-700 mt-1 block">Select an Assigned Class first. Only active classes this teacher teaches are listed.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACCOUNTANT specific assignment */}
          {portalRole === 'ACCOUNTANT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-950">Accounting & Finance Responsibilities</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Financial Responsibilities
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Student fee collection, fee receipt generation, day-book balancing, salary disbursement, vendor ledger reconciliation"
                    value={accountingResponsibilities}
                    onChange={(e) => setAccountingResponsibilities(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* HR_STAFF specific assignment */}
          {portalRole === 'HR_STAFF' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-cyan-50/60 border border-cyan-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-700" />
                  <span className="text-xs font-bold text-cyan-950">Human Resources & Staff Oversight</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Employee Management Scope
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Teaching and Non-Teaching Staff"
                      value={employeeManagementScope}
                      onChange={(e) => setEmployeeManagementScope(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-cyan-600 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payroll & HR Access Scope
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Attendance & Leave verification, Monthly Muster Roll"
                      value={payrollHrAccessScope}
                      onChange={(e) => setPayrollHrAccessScope(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-cyan-600 focus:outline-hidden"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    HR Responsibilities Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Staff onboarding, document verification, biometric attendance sync, leaves management"
                    value={hrResponsibilities}
                    onChange={(e) => setHrResponsibilities(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-cyan-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* HOSTEL_WARDEN specific assignment */}
          {portalRole === 'HOSTEL_WARDEN' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 space-y-4">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold text-teal-950">Hostel & Dormitory Assignment</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Hostel Assignment (From Hostel Module)
                    </label>
                    <select
                      value={hostelId}
                      onChange={(e) => setHostelId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                    >
                      <option value="">-- Select Hostel --</option>
                      {hostelsList.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.type} Hostel)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Hostel Block / Wing
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Block A, First Floor"
                      value={hostelBlock}
                      onChange={(e) => setHostelBlock(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Shift / Duty Timing
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Night Shift 07:00 PM - 07:00 AM"
                      value={dutyTiming}
                      onChange={(e) => setDutyTiming(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Warden Responsibility
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Student roll call, night security, discipline"
                      value={wardenResponsibility}
                      onChange={(e) => setWardenResponsibility(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Emergency Responsibility
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Medical emergency contact & hostel hospital escort"
                      value={emergencyResponsibility}
                      onChange={(e) => setEmergencyResponsibility(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="residentialDuty"
                    checked={residentialDuty}
                    onChange={(e) => setResidentialDuty(e.target.checked)}
                    className="w-4 h-4 rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="residentialDuty" className="text-xs font-semibold text-slate-800">
                    Residential Duty (Resides on-campus in warden quarters)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TRANSPORT_MANAGER specific assignment */}
          {portalRole === 'TRANSPORT_MANAGER' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-yellow-50/60 border border-yellow-200 space-y-4">
                <div className="flex items-center gap-2">
                  <Bus className="w-4 h-4 text-yellow-800" />
                  <span className="text-xs font-bold text-yellow-950">Transport & Fleet Management</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Transport Operations Responsibility
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bus route scheduling, driver attendance, fuel logs"
                      value={transportResponsibility}
                      onChange={(e) => setTransportResponsibility(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Duty Timing
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 06:00 AM - 09:30 AM & 01:30 PM - 05:00 PM"
                      value={dutyTiming}
                      onChange={(e) => setDutyTiming(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Route Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Bus Routes (From Transport Module)
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                    {routesList.length === 0 ? (
                      <span className="text-xs text-slate-400">No active transport routes configured</span>
                    ) : (
                      routesList.map((r) => {
                        const isSelected = assignedRoutes.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => toggleRouteAssignment(r.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              isSelected
                                ? 'bg-yellow-600 text-white'
                                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {r.routeName} ({r.vehicleRegNumber || 'Fleet'})
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Fleet / Vehicles Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Vehicles
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                    {vehiclesList.length === 0 ? (
                      <span className="text-xs text-slate-400">No vehicles registered in fleet</span>
                    ) : (
                      vehiclesList.map((v) => {
                        const isSelected = assignedVehicles.includes(v.id);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => toggleVehicleAssignment(v.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              isSelected
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {v.registrationNumber} ({v.vehicleType})
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN roles (SCHOOL_ADMIN & SUPER_ADMIN) specific assignment */}
          {(portalRole === 'SCHOOL_ADMIN' || portalRole === 'SUPER_ADMIN') && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-bold text-purple-950">Administrative Authority & Scope</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Institutional Responsibilities
                  </label>
                  <textarea
                    rows={3}
                    placeholder="General school governance, academic scheduling, departmental coordination, staff monitoring"
                    value={administrativeResponsibilities}
                    onChange={(e) => setAdministrativeResponsibilities(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* SECTION 4: PAYROLL & BANK DETAILS */}
        {/* ======================================================== */}
        <div id="staff-sec-payroll" className="scroll-mt-16 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                4
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Payroll & Bank Details</h2>
                <p className="text-[11px] text-slate-500">Monthly gross salary, bank parameters, and statutory identifiers</p>
              </div>
            </div>
            {!isPayrollAuthorized && (
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                Managed by Accounts/HR
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="staff-salary-from" className="block text-xs font-bold text-slate-700 mb-1">
                Salary from {isPayrollAuthorized && <span className="text-rose-600">*</span>}
              </label>
              <input
                id="staff-salary-from"
                type="date"
                disabled={!isPayrollAuthorized}
                min={dateOfJoining || undefined}
                value={salaryStartDate || defaultSalaryFrom}
                onChange={(e) => setSalaryStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Salary is created in the ERP from this date. Earlier months are treated as already paid.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Monthly Gross Salary (₹) {isPayrollAuthorized && <span className="text-rose-600">*</span>}
              </label>
              <input
                type="number"
                disabled={!isPayrollAuthorized}
                min={0}
                step={500}
                value={monthlySalary}
                placeholder={isPayrollAuthorized ? 'e.g. 25000' : 'Set by payroll staff'}
                onChange={(e) => setMonthlySalary(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bank Account Number
              </label>
              <input
                type="text"
                disabled={!isPayrollAuthorized}
                placeholder="e.g. 5010023456789"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                disabled={!isPayrollAuthorized}
                placeholder="e.g. SBIN0001234"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono uppercase disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                disabled={!isPayrollAuthorized}
                placeholder="e.g. State Bank of India"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Branch Name
              </label>
              <input
                type="text"
                disabled={!isPayrollAuthorized}
                placeholder="e.g. Sheohar Main Branch"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                PAN Card Number
              </label>
              <input
                type="text"
                disabled={!isPayrollAuthorized}
                placeholder="e.g. ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono uppercase disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                UAN Number
              </label>
              <input
                type="text"
                disabled={!isPayrollAuthorized}
                maxLength={12}
                placeholder="e.g. 100912345678"
                value={uanNumber}
                onChange={(e) => setUanNumber(e.target.value.trim())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono disabled:bg-slate-100"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">12-digit Universal Account Number</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 5: DOCUMENTS & CERTIFICATES */}
        {/* ======================================================== */}
        <div id="staff-sec-documents" className="scroll-mt-16 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              5
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Documents & Certificates</h2>
              <p className="text-[11px] text-slate-500">
                Official employee verification records and certificates stored securely in school digital vault
              </p>
            </div>
          </div>

          <StaffDocumentManager
            documents={documents}
            onChange={setDocuments}
          />
        </div>

        {/* ======================================================== */}
        {/* SECTION 6: ERP PORTAL ACCESS & LOGIN CREDENTIALS */}
        {/* ======================================================== */}
        <div id="staff-sec-access" className="scroll-mt-16 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
              6
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">ERP Portal Access & Login Credentials</h2>
              <p className="text-[11px] text-slate-500">
                Single-school portal access strictly derived from Step 2 configuration
              </p>
            </div>
          </div>

          {isNoLoginStaffRole(portalRole) ? (
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800 space-y-1" data-testid="support-staff-no-login">
              <span className="font-bold block">No app login for support staff</span>
              <span>
                This person gets an Employee ID ({employeeId || 'auto'}), an ID card and a staff attendance and payroll record.
                They cannot sign in to the website or the mobile app. To give them a login later, change the role.
              </span>
            </div>
          ) : (
          <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-purple-950 text-xs block">Enable Portal Account</span>
                <span className="text-[11px] text-purple-800">
                  Allow employee to authenticate into their assigned single-school ERP portal module.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableLogin}
                  onChange={(e) => setEnableLogin(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {enableLogin && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-purple-200">
                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1">Portal User ID</span>
                  <div className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-purple-900 text-xs">
                    {employeeId || 'CPS0001'}
                  </div>
                </div>

                {/* Read-only Portal Role derived from Step 2 */}
                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1">
                    Portal Role <span className="text-slate-400 font-normal">(From Step 2)</span>
                  </span>
                  <div className="px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 font-bold text-blue-900 text-xs flex items-center justify-between">
                    <span>{currentRoleMeta?.label || portalRole}</span>
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                  </div>
                </div>

                {/* Read-only Designation derived from Step 2 */}
                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1">
                    Designation <span className="text-slate-400 font-normal">(From Step 2)</span>
                  </span>
                  <div className="px-3.5 py-2.5 rounded-xl border border-purple-200 bg-purple-50 font-bold text-purple-900 text-xs truncate">
                    {designation}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1">Initial Password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono pr-10 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Bottom Submission Bar */}
        <div className="sticky bottom-0 z-20 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={onBack}
              className="hidden sm:inline-flex w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Back to directory
            </button>
            <DraftStatus savedAt={draftSavedAt} failed={draftStorageFailed} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isPhotoUploading}
            className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Staff Record...</span>
              </>
            ) : isPhotoUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading photo…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Registration & Save Staff</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
