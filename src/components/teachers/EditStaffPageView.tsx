import { QualifiedClassesPicker, qualifiedSectionsError, qualifiedSectionsPayload } from './QualifiedClassesPicker';
import { qualifiedClassNames, qualifiedSectionsForClass, unifiedSubjectExpertise } from '../../utils/teacherSubjects';
import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Home,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User,
  Users,
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
import {
  STAFF_PORTAL_ROLES,
  STAFF_ROLE_DESIGNATIONS,
  PortalStaffRole,
  shouldShowTeachingFields,
  getDefaultDesignationForRole,
  isNoLoginStaffRole,
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

interface EditStaffPageViewProps {
  staff: TeacherStaff;
  currentUserRole: UserRole;
  onBack: () => void;
  onStaffUpdated: (updated: TeacherStaff) => void;
}

const EMPLOYMENT_TYPES = [
  'Full Time',
  'Part Time',
  'Contract',
  'Temporary',
  'Permanent',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const EditStaffPageView: React.FC<EditStaffPageViewProps> = ({
  staff,
  currentUserRole,
  onBack,
  onStaffUpdated,
}) => {
  const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';
  const isSchoolAdmin = currentUserRole === 'SCHOOL_ADMIN';

  // Check if target staff is the Root Super Admin
  const isTargetRootSuperAdmin =
    staff.employeeId === 'PDS0001' ||
    staff.systemRole === 'SUPER_ADMIN' ||
    staff.portalRole === 'SUPER_ADMIN' ||
    staff.email?.toLowerCase() === 'superadmin@pdsschool.edu.in';

  // Protect Root Super Admin from being altered by School Admin
  if (isTargetRootSuperAdmin && isSchoolAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl border border-rose-200 text-center space-y-4 my-8">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Protected Root Account</h2>
        <p className="text-xs text-slate-600">
          School Administrators are strictly prohibited from modifying, deactivating, or altering permissions of the Root Super Administrator account.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          Return to Profile
        </button>
      </div>
    );
  }

  // Check general edit permission: only Super Admin or School Admin can edit staff
  if (!isSuperAdmin && !isSchoolAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl border border-rose-200 text-center space-y-4 my-8">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-600">
          Only Administrators have permission to edit faculty and staff profiles.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          Return to Profile
        </button>
      </div>
    );
  }

  const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>([]);
  const [academicSubjects, setAcademicSubjects] = useState<Subject[]>([]);

  // 1. Personal Information State
  const [fullName, setFullName] = useState(staff.name || '');
  const [photo, setPhoto] = useState(staff.photo || '');
  const [photoFileKey, setPhotoFileKey] = useState(staff.photoFileKey || '');
  const [fatherName, setFatherName] = useState(
    staff.fatherName || staff.fatherOrMotherName || ''
  );
  const [motherName, setMotherName] = useState(staff.motherName || '');
  const [dob, setDob] = useState(staff.dob || '1990-01-01');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>(staff.gender || 'MALE');
  const [bloodGroup, setBloodGroup] = useState(staff.bloodGroup || 'B+');
  const [mobileNumber, setMobileNumber] = useState(staff.phone || '');
  const [emailAddress, setEmailAddress] = useState(staff.email || '');
  const [alternateMobile, setAlternateMobile] = useState(staff.alternatePhone || '');

  // Address State Initialization
  const initialPermanentAddress = staff.permanentAddress || staff.address || '';
  const initialPermanentState = staff.permanentState || staff.state || 'Bihar';
  const initialPermanentCity = staff.permanentCity || staff.city || 'Sheohar';
  const initialPermanentPincode = staff.permanentPincode || staff.pincode || '843329';
  const initialSameAsPermanent = staff.sameAsPermanentAddress !== undefined
    ? staff.sameAsPermanentAddress
    : (!staff.currentAddress || staff.currentAddress === initialPermanentAddress);
  const initialCurrentAddress = initialSameAsPermanent
    ? initialPermanentAddress
    : (staff.currentAddress || initialPermanentAddress);
  const initialCurrentState = initialSameAsPermanent
    ? initialPermanentState
    : (staff.currentState || initialPermanentState);
  const initialCurrentCity = initialSameAsPermanent
    ? initialPermanentCity
    : (staff.currentCity || initialPermanentCity);
  const initialCurrentPincode = initialSameAsPermanent
    ? initialPermanentPincode
    : (staff.currentPincode || initialPermanentPincode);

  const [addressState, setAddressState] = useState<AddressState>({
    permanentAddress: initialPermanentAddress,
    permanentState: initialPermanentState,
    permanentCity: initialPermanentCity,
    permanentPincode: initialPermanentPincode,
    currentAddress: initialCurrentAddress,
    currentState: initialCurrentState,
    currentCity: initialCurrentCity,
    currentPincode: initialCurrentPincode,
    sameAsPermanentAddress: initialSameAsPermanent,
  });
  const [emergencyContact, setEmergencyContact] = useState(staff.emergencyContact || '');

  // 2. Portal Role & Designation State
  const initialRole: PortalStaffRole = (
    staff.portalRole || staff.systemRole || staff.role || 'TEACHER'
  ) as PortalStaffRole;

  const [portalRole, setPortalRole] = useState<PortalStaffRole>(
    STAFF_PORTAL_ROLES.some((r) => r.id === initialRole) ? initialRole : 'TEACHER'
  );

  // Sanitize initial designation if it was legacy HOD
  let initialDes = staff.designation || 'PGT Teacher';
  if (/head of department|\bhod\b/i.test(initialDes)) {
    initialDes = 'PGT Teacher';
  }
  const [designation, setDesignation] = useState<string>(initialDes);

  // Qualification State Initialization
  const rawQual = staff.qualification || '';
  const isStandardQual = HIGHEST_ACADEMIC_QUALIFICATIONS.includes(rawQual as any);
  const initialQual = isStandardQual ? rawQual : (rawQual ? 'Other' : 'BEd');
  const initialCustomQual = isStandardQual ? '' : (staff.customQualification || rawQual || '');
  const [highestQualification, setHighestQualification] = useState<string>(initialQual);
  const [customQualification, setCustomQualification] = useState<string>(initialCustomQual);

  const [dateOfJoining, setDateOfJoining] = useState(
    staff.joiningDate || new Date().toISOString().substring(0, 10)
  );
  const [employmentType, setEmploymentType] = useState(staff.employmentType || 'Full Time');
  const [totalExperience, setTotalExperience] = useState(
    staff.totalExperience || `${staff.experienceYears || 0} Years`
  );
  // Includes anything recorded earlier as "Additional Subjects", so saving never drops it.
  const [selectedSubjectExpertise, setSelectedSubjectExpertise] = useState<string[]>(() => unifiedSubjectExpertise(staff));
  const initialQualifiedClasses = useMemo(() => qualifiedClassNames(staff), [staff]);

  const [classesQualified, setClassesQualified] = useState<string[]>(initialQualifiedClasses);
  // Sections taught in each qualified class (lower-case class name → sections). Filled from the saved record once
  // the classes are loaded; an older record without a choice shows every active section ticked (what it had).
  const [qualifiedSections, setQualifiedSections] = useState<Record<string, string[]>>({});

  // Department State Initialization
  const rawDept = staff.department || staff.academicDepartment || '';
  const isStandardDept = DEPARTMENT_WING_OPTIONS.includes(rawDept as any);
  const initialDept = isStandardDept ? rawDept : (rawDept ? 'Other' : 'Senior Wing');
  const initialCustomDept = isStandardDept ? '' : (staff.customDepartment || rawDept || '');
  const [departmentWing, setDepartmentWing] = useState<string>(initialDept);
  const [customDepartment, setCustomDepartment] = useState<string>(initialCustomDept);

  // Certifications State Initialization
  const initialCertsList = staff.certificationsList && staff.certificationsList.length > 0
    ? staff.certificationsList
    : (staff.certifications ? staff.certifications.split(',').map((c) => c.trim()).filter(Boolean) : []);
  const [certificationsList, setCertificationsList] = useState<string[]>(initialCertsList);
  const [customCertification, setCustomCertification] = useState<string>(staff.customCertification || '');

  const [alsoPerformsTeaching, setAlsoPerformsTeaching] = useState(
    Boolean(staff.alsoPerformsTeaching)
  );
  const [academicDepartment, setAcademicDepartment] = useState(
    staff.academicDepartment || staff.department || 'Academics'
  );

  // 3. Teaching & Assignment Fields
  const initialClassTeacherOf = staff.classTeacherOf || '';
  const initialParsedClass = (() => {
    if (staff.teachingProfile?.assignedClassId) return staff.teachingProfile.assignedClassId;
    if (initialClassTeacherOf) {
      const parts = initialClassTeacherOf.split(/[-:]/);
      return parts[0].trim();
    }
    return '';
  })();
  const initialParsedSection = (() => {
    if (staff.teachingProfile?.assignedSection) return staff.teachingProfile.assignedSection;
    if (initialClassTeacherOf) {
      const parts = initialClassTeacherOf.split(/[-:]/);
      if (parts.length >= 2) return parts[1].trim().toUpperCase();
    }
    return 'A';
  })();
  const initialIsClassTeacher = staff.teachingProfile?.isClassTeacher !== undefined
    ? Boolean(staff.teachingProfile.isClassTeacher)
    : Boolean(staff.classTeacherOf);

  const [assignedClassId, setAssignedClassId] = useState<string>(initialParsedClass);
  const [assignedSection, setAssignedSection] = useState<string>(initialParsedSection);
  const [isClassTeacher, setIsClassTeacher] = useState<boolean>(initialIsClassTeacher);
  const [inchargeValue, setInchargeValue] = useState<string>(initialClassTeacherOf);
  const [assignedPrimarySubject, setAssignedPrimarySubject] = useState(
    staff.assignedPrimarySubject || ''
  );
  const [teachingWorkload, setTeachingWorkload] = useState<number>(staff.teachingWorkload ?? 24);

  // House & Club State Initialization
  const initialHouseClubList = staff.houseClubResponsibilities && staff.houseClubResponsibilities.length > 0
    ? staff.houseClubResponsibilities
    : (staff.houseClubResponsibility ? staff.houseClubResponsibility.split(',').map((h) => h.trim()).filter(Boolean) : []);
  const [houseClubResponsibilities, setHouseClubResponsibilities] = useState<string[]>(initialHouseClubList);
  const [customHouseClub, setCustomHouseClub] = useState<string>(staff.customHouseClub || '');

  // 5. Attached Documents State
  const [documents, setDocuments] = useState<AttachedDocument[]>(staff.documents || []);

  // Non-teaching fields
  const [accountingResponsibilities, setAccountingResponsibilities] = useState(
    staff.accountingResponsibilities || ''
  );
  const [hrResponsibilities, setHrResponsibilities] = useState(staff.hrResponsibilities || '');
  const [employeeManagementScope, setEmployeeManagementScope] = useState(
    staff.employeeManagementScope || ''
  );
  const [payrollHrAccessScope, setPayrollHrAccessScope] = useState(
    staff.payrollHrAccessScope || ''
  );
  const [hostelBlock, setHostelBlock] = useState(staff.hostelBlock || staff.hostelAssignment?.hostelBlock || '');
  // The hostel this warden looks after: the warden app shows only students with a bed in it.
  const [wardenHostelId, setWardenHostelId] = useState<string>(staff.hostelAssignment?.hostelId || (staff as any).hostelId || '');
  const [hostelsList, setHostelsList] = useState(() => api.getHostels());
  useEffect(() => {
    let alive = true;
    api.fetchHostels().then((d) => alive && setHostelsList(d.hostels || [])).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [wardenResponsibility, setWardenResponsibility] = useState(
    staff.wardenResponsibility || ''
  );
  const [dutyTiming, setDutyTiming] = useState(staff.dutyTiming || '08:00 AM - 04:00 PM');
  const [residentialDuty, setResidentialDuty] = useState(Boolean(staff.residentialDuty));
  const [transportResponsibility, setTransportResponsibility] = useState(
    staff.transportResponsibility || ''
  );
  const [administrativeResponsibilities, setAdministrativeResponsibilities] = useState(
    staff.administrativeResponsibilities || ''
  );

  // 4. Payroll
  // The configured salary payroll uses is monthlySalary; older records may only have salary.net/basic.
  // Nothing is assumed when no salary is on record (and roles without payroll access never receive it).
  const initialMonthlySalary: number | '' =
    Number(staff.monthlySalary) > 0
      ? Number(staff.monthlySalary)
      : typeof staff.salary === 'object'
        ? Number(staff.salary?.net || staff.salary?.basic) || ''
        : Number(staff.salary) || '';
  const [monthlySalary, setMonthlySalary] = useState<number | ''>(initialMonthlySalary);
  const salaryChanged = monthlySalary !== initialMonthlySalary;
  const [applySalaryToUnpaid, setApplySalaryToUnpaid] = useState(false);
  const initialSalaryStartDate = String(staff.salaryStartDate || '').substring(0, 10);
  const [salaryStartDate, setSalaryStartDate] = useState(initialSalaryStartDate);
  const salaryStartChanged = salaryStartDate !== initialSalaryStartDate;
  const [bankAccountNo, setBankAccountNo] = useState(staff.bankAccountNo || '');
  const [ifscCode, setIfscCode] = useState(staff.ifscCode || '');
  const [bankName, setBankName] = useState(staff.bankName || '');
  const [bankBranch, setBankBranch] = useState(staff.bankBranch || '');
  const [panNumber, setPanNumber] = useState(staff.panNumber || '');
  const [uanNumber, setUanNumber] = useState(staff.uanNumber || '');

  // 5. Status & Portal Access
  const [status, setStatus] = useState(staff.status || 'ACTIVE');
  const [enableLogin, setEnableLogin] = useState(staff.loginEnabled !== false);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    api.syncClasses().then((cls) => {
      const active = (cls || []).filter((c) => (c.status || 'ACTIVE') === 'ACTIVE');
      setAcademicClasses(active);
    });
    const cachedActive = api.getActiveClasses();
    setAcademicClasses(cachedActive);
    setAcademicSubjects(api.getSubjects());
  }, []);

  // Match assignedClassId with canonical class ID once active classes are loaded
  useEffect(() => {
    if (academicClasses.length > 0 && assignedClassId) {
      const matched = academicClasses.find(
        (c) =>
          c.id.toLowerCase() === assignedClassId.toLowerCase() ||
          c.name.toLowerCase() === assignedClassId.toLowerCase()
      );
      if (matched && matched.id !== assignedClassId) {
        setAssignedClassId(matched.id);
      }
    }
  }, [academicClasses, assignedClassId]);

  const selectedClassObj = useMemo(() => {
    return academicClasses.find(
      (c) =>
        c.id.toLowerCase() === assignedClassId.toLowerCase() ||
        c.name.toLowerCase() === assignedClassId.toLowerCase()
    );
  }, [academicClasses, assignedClassId]);

  // Class Incharge choices: active classes this teacher teaches (assigned class) or is already qualified for.
  const inchargeOptions = useMemo(
    () =>
      buildInchargeOptions(academicClasses, [
        assignedClassId,
        selectedClassObj?.name || '',
        ...classesQualified,
        initialClassTeacherOf.split(/[-:]/)[0].trim(),
      ]),
    [academicClasses, assignedClassId, selectedClassObj, classesQualified, initialClassTeacherOf]
  );

  const availableSections = useMemo(() => {
    if (!selectedClassObj) return ['A'];
    if (selectedClassObj.detailedSections && selectedClassObj.detailedSections.length > 0) {
      const activeSecs = selectedClassObj.detailedSections
        .filter((ds) => (ds.status || 'ACTIVE') === 'ACTIVE')
        .map((ds) => ds.name);
      return activeSecs.length > 0 ? activeSecs : ['A'];
    }
    return selectedClassObj.sections && selectedClassObj.sections.length > 0
      ? selectedClassObj.sections
      : ['A'];
  }, [selectedClassObj]);

  useEffect(() => {
    if (availableSections.length > 0 && !availableSections.includes(assignedSection)) {
      setAssignedSection(availableSections[0] || 'A');
    }
  }, [availableSections, assignedSection]);

  const handleRoleChange = (newRole: PortalStaffRole) => {
    setPortalRole(newRole);
    const defaultDes = getDefaultDesignationForRole(newRole);
    setDesignation(defaultDes);
  };

  const toggleSubjectExpertise = (subName: string) => {
    setSelectedSubjectExpertise((prev) =>
      prev.includes(subName) ? prev.filter((s) => s !== subName) : [...prev, subName]
    );
  };

  const toggleQualifiedClass = (clsName: string) => {
    const removing = classesQualified.includes(clsName);
    setClassesQualified((prev) =>
      prev.includes(clsName) ? prev.filter((c) => c !== clsName) : [...prev, clsName]
    );
    setQualifiedSections((prev) => {
      const next = { ...prev };
      if (removing) delete next[clsName.toLowerCase()];
      else if (!next[clsName.toLowerCase()]) next[clsName.toLowerCase()] = [];
      return next;
    });
  };
  const setSectionsFor = (clsName: string, sections: string[]) =>
    setQualifiedSections((prev) => ({ ...prev, [clsName.toLowerCase()]: sections }));
  useEffect(() => {
    if (academicClasses.length === 0) return;
    setQualifiedSections((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const name of initialQualifiedClasses) {
        const key = name.toLowerCase();
        if (key in next) continue;
        const cls = academicClasses.find((c) => c.name.toLowerCase() === key);
        if (!cls) continue;
        next[key] = qualifiedSectionsForClass(staff as any, cls as any);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [academicClasses, initialQualifiedClasses, staff]);

  const isTeachingVisible = shouldShowTeachingFields(portalRole, alsoPerformsTeaching);
  const designationList = STAFF_ROLE_DESIGNATIONS[portalRole] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSaveSuccess(false);

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

      const updates: Partial<TeacherStaff> = {
        name: fullName.trim(),
        photo: photo || staff.photo,
        photoFileKey: photoFileKey || staff.photoFileKey,
        fatherName: fatherName.trim() || undefined,
        motherName: motherName.trim() || undefined,
        fatherOrMotherName: fatherName.trim() || motherName.trim() || undefined,
        dob,
        gender,
        bloodGroup,
        phone: mobileNumber.trim(),
        email: emailAddress.trim() || undefined,
        alternatePhone: alternateMobile.trim() || undefined,
        address: addressState.permanentAddress.trim() || 'Staff Quarters, PDS Campus',
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

        // Role & Designation
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
        totalExperience,
        experienceYears: parseInt(totalExperience) || 0,
        certifications: combinedCertificationsStr || undefined,
        certificationsList,
        customCertification: customCertification.trim() || undefined,
        alsoPerformsTeaching,

        // Teaching fields
        subjectExpertise: selectedSubjectExpertise,
        specializationSubjects: selectedSubjectExpertise,
        classesQualifiedToTeach: classesQualified.join(', '),
        qualifiedClasses: classesQualified,
        qualifiedClassSections: qualifiedSectionsPayload(classesQualified, qualifiedSections),
        classTeacherOf: isTeachingVisible && isClassTeacher && inchargeValue ? inchargeValue : undefined,
        assignedClasses:
          assignedClassId && selectedClassObj
            ? [`${selectedClassObj.name}-${assignedSection}`]
            : (staff.assignedClasses || []),
        assignedPrimarySubject: assignedPrimarySubject.trim() || undefined,
        teachingWorkload: isTeachingVisible ? Math.min(50, Math.max(0, Number(teachingWorkload) || 0)) : undefined,
        houseClubResponsibility: combinedHouseClubStr || undefined,
        houseClubResponsibilities,
        customHouseClub: customHouseClub.trim() || undefined,
        documents,

        // Structured role-specific teachingProfile
        teachingProfile: isTeachingVisible
          ? {
              ...staff.teachingProfile,
              subjectExpertise: selectedSubjectExpertise,
              classesQualifiedToTeach: classesQualified,
              assignedClassId: assignedClassId || undefined,
              assignedClassName: selectedClassObj?.name || undefined,
              assignedSection: assignedClassId ? assignedSection : undefined,
              isClassTeacher: Boolean(isClassTeacher && inchargeValue && inchargeValue === `${selectedClassObj?.name}-${assignedSection}`),
              assignedPrimarySubject: assignedPrimarySubject.trim() || undefined,
              teachingWorkloadPeriods: Number(teachingWorkload) || 0,
              academicDepartment: finalDepartment,
            }
          : undefined,

        // Non-teaching fields
        accountingResponsibilities: accountingResponsibilities.trim() || undefined,
        hrResponsibilities: hrResponsibilities.trim() || undefined,
        employeeManagementScope: employeeManagementScope.trim() || undefined,
        payrollHrAccessScope: payrollHrAccessScope.trim() || undefined,
        hostelBlock: hostelBlock.trim() || undefined,
        ...(portalRole === 'HOSTEL_WARDEN'
          ? {
              hostelId: wardenHostelId || undefined,
              hostelAssignment: {
                ...(staff.hostelAssignment || {}),
                hostelId: wardenHostelId || undefined,
                hostelName: hostelsList.find((h) => h.id === wardenHostelId)?.name || '',
                hostelBlock: hostelBlock.trim() || undefined,
                shiftTiming: dutyTiming.trim() || undefined,
              },
            }
          : {}),
        wardenResponsibility: wardenResponsibility.trim() || undefined,
        dutyTiming: dutyTiming.trim() || undefined,
        residentialDuty,
        transportResponsibility: transportResponsibility.trim() || undefined,
        administrativeResponsibilities: administrativeResponsibilities.trim() || undefined,

        // Payroll: sent only when the salary was actually changed on this form.
        ...(salaryChanged && Number(monthlySalary) > 0
          ? {
              monthlySalary: Number(monthlySalary),
              salary: { basic: Number(monthlySalary), allowances: 0, deductions: 0, net: Number(monthlySalary) },
              ...(applySalaryToUnpaid ? { applySalaryToUnpaid: true } : {}),
            }
          : {}),
        ...(salaryStartChanged && salaryStartDate ? { salaryStartDate } : {}),
        // Empty text is sent as '' (not left out) so a detail can be removed.
        bankAccountNo: bankAccountNo.trim(),
        ifscCode: ifscCode.trim(),
        bankName: bankName.trim(),
        bankBranch: bankBranch.trim(),
        panNumber: panNumber.trim().toUpperCase(),
        uanNumber: uanNumber.trim(),

        status: status as any,
        loginEnabled: isNoLoginStaffRole(portalRole) ? false : enableLogin,
        accountStatus: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      };

      const updated = await api.updateStaffAsync(staff.id, updates);

      // Confirm photo file if updated
      if (photoFileKey && photoFileKey !== staff.photoFileKey) {
        await fileUploadService.confirmFileAssociation(photoFileKey, {
          type: 'STAFF',
          id: staff.id,
        });
      }

      setSaveSuccess(true);
      setIsSubmitting(false);
      onStaffUpdated(updated);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to update staff:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while saving.');
      setIsSubmitting(false);
    }
  };

  const currentRoleMeta = STAFF_PORTAL_ROLES.find((r) => r.id === portalRole);

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back to Profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">Edit Staff Record</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                {staff.employeeId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Update professional parameters, ERP portal role, and assignments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <span
            className={`px-3 py-1 rounded-xl font-bold text-xs ${
              status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Update Failed</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">Staff record and ERP portal settings updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal Details */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="w-4 h-4 text-blue-600" />
            <span>Personal Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName || ''}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
              <select
                value={gender || 'MALE'}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={dob || ''}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
              <select
                value={bloodGroup || 'B+'}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Father's Name</label>
              <input
                type="text"
                placeholder="e.g. Shri Ram Narayan Sharma"
                value={fatherName || ''}
                onChange={(e) => setFatherName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mother's Name</label>
              <input
                type="text"
                placeholder="e.g. Smt. Shanti Devi"
                value={motherName || ''}
                onChange={(e) => setMotherName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mobile Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={mobileNumber || ''}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={emailAddress || ''}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Alternate Phone</label>
              <input
                type="tel"
                value={alternateMobile || ''}
                onChange={(e) => setAlternateMobile(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div className="sm:col-span-3">
              <StaffAddressSection
                value={addressState}
                onChange={setAddressState}
              />
            </div>

            <div className="sm:col-span-3 pt-3 border-t border-slate-100">
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
        </div>

        {/* Section 2: Professional Details & Role Selection */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-600" />
              <span>Professional & Role Information</span>
            </h3>
            {currentRoleMeta && (
              <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${currentRoleMeta.badgeColor}`}>
                {currentRoleMeta.label}
              </span>
            )}
          </div>

          {/* Strict Separation: Portal Role and Designation */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-700" />
                <span>Portal Role (System Permissions)</span>
                <span className="text-rose-600">*</span>
              </label>
              <select
                value={portalRole}
                onChange={(e) => handleRoleChange(e.target.value as PortalStaffRole)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300 bg-white font-bold text-blue-900 text-xs"
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
                <span>Designation (Job Position)</span>
                <span className="text-rose-600">*</span>
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-purple-300 bg-white font-bold text-purple-900 text-xs"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Employment Type</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {EMPLOYMENT_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date of Joining</label>
              <input
                type="date"
                value={dateOfJoining}
                onChange={(e) => setDateOfJoining(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Highest Qualification <span className="text-rose-600">*</span>
              </label>
              <select
                value={highestQualification}
                onChange={(e) => setHighestQualification(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
              >
                {HIGHEST_ACADEMIC_QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Total Experience</label>
              <input
                type="text"
                value={totalExperience || ''}
                onChange={(e) => setTotalExperience(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Department / Wing <span className="text-rose-600">*</span>
              </label>
              <select
                value={departmentWing || 'Senior Wing'}
                onChange={(e) => setDepartmentWing(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
              >
                {DEPARTMENT_WING_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account Status</label>
              <select
                value={status || 'ACTIVE'}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white font-bold"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="RESIGNED">RESIGNED</option>
              </select>
            </div>
          </div>

          {/* Conditional Custom Inputs for Qualification and Department */}
          {(highestQualification === 'Other' || departmentWing === 'Other') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
              {highestQualification === 'Other' && (
                <div>
                  <label className="block text-xs font-bold text-amber-950 mb-1">
                    Specify Qualification <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter academic qualification"
                    value={customQualification || ''}
                    onChange={(e) => setCustomQualification(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-amber-300 text-xs bg-white"
                  />
                </div>
              )}
              {departmentWing === 'Other' && (
                <div>
                  <label className="block text-xs font-bold text-amber-950 mb-1">
                    Specify Department / Wing <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter custom department or unit"
                    value={customDepartment || ''}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-amber-300 text-xs bg-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* Certifications Multi-select */}
          <StaffCertificationsSelector
            selectedCertifications={certificationsList}
            onChange={setCertificationsList}
            customCertification={customCertification}
            onCustomCertificationChange={setCustomCertification}
          />

          {/* Optional teaching duties toggle for ACADEMIC_COORDINATOR and HOSTEL_WARDEN */}
          {(portalRole === 'ACADEMIC_COORDINATOR' || portalRole === 'HOSTEL_WARDEN') && (
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-950 block">Also performs teaching duties</span>
                <span className="text-[11px] text-indigo-800">
                  Enable subject expertise, class allocation, and teaching workload for this staff member.
                </span>
              </div>
              <input
                type="checkbox"
                checked={alsoPerformsTeaching}
                onChange={(e) => setAlsoPerformsTeaching(e.target.checked)}
                className="w-5 h-5 rounded-md text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Dynamic Teaching Details */}
          {isTeachingVisible && (
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Class <span className="text-emerald-600 font-semibold">(Active Only)</span>
                  </label>
                  <select
                    value={assignedClassId || ''}
                    onChange={(e) => setAssignedClassId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    <option value="">-- No Class Assigned --</option>
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
                    value={assignedSection || 'A'}
                    onChange={(e) => setAssignedSection(e.target.value)}
                    disabled={!assignedClassId}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white disabled:bg-slate-100"
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
                    Primary Subject
                  </label>
                  <select
                    value={assignedPrimarySubject || ''}
                    onChange={(e) => setAssignedPrimarySubject(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    <option value="">-- Select Subject --</option>
                    {academicSubjects.map((sub) => (
                      <option key={sub.id} value={sub.name}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Workload (Periods / Week)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      value={teachingWorkload ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTeachingWorkload(Math.min(50, Math.max(0, val)));
                      }}
                      className="w-full pl-3.5 pr-28 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs font-semibold text-slate-500">
                      periods / week
                    </div>
                  </div>
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
                      disabled={!assignedClassId && inchargeOptions.length === 0}
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
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Subject Expertise</label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {academicSubjects.map((sub) => {
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
                  })}
                </div>
              </div>
              <QualifiedClassesPicker classes={academicClasses} value={classesQualified} onToggle={toggleQualifiedClass} sectionsByClass={qualifiedSections} onSectionsChange={setSectionsFor} />
            </div>
          )}

          {/* Specific fields for Accountant */}
          {portalRole === 'ACCOUNTANT' && (
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <label className="block text-xs font-bold text-emerald-950 mb-1">
                Accounting & Financial Responsibilities
              </label>
              <textarea
                rows={2}
                value={accountingResponsibilities}
                onChange={(e) => setAccountingResponsibilities(e.target.value)}
                placeholder="Fee collection, ledger reconciliation, payroll distribution"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              />
            </div>
          )}

          {/* Specific fields for HR */}
          {portalRole === 'HR_STAFF' && (
            <div className="p-3.5 rounded-xl bg-cyan-50/60 border border-cyan-200 space-y-3">
              <label className="block text-xs font-bold text-cyan-950">
                HR Responsibilities & Access Scope
              </label>
              <textarea
                rows={2}
                value={hrResponsibilities}
                onChange={(e) => setHrResponsibilities(e.target.value)}
                placeholder="Staff onboarding, attendance verification, leaves"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              />
            </div>
          )}

          {/* Specific fields for Hostel Warden */}
          {portalRole === 'HOSTEL_WARDEN' && (
            <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 space-y-3">
              <label className="block text-xs font-bold text-teal-950">
                Hostel Assignment & Duties
              </label>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hostel Assignment <span className="text-rose-600">*</span>{' '}
                  <span className="font-normal text-slate-500">(the warden app shows only this hostel's students)</span>
                </label>
                <select
                  value={wardenHostelId}
                  onChange={(e) => setWardenHostelId(e.target.value)}
                  aria-label="Hostel assignment"
                  className={`w-full px-3 py-2 rounded-xl border text-xs bg-white ${wardenHostelId ? 'border-slate-300' : 'border-amber-400 ring-1 ring-amber-200'}`}
                >
                  <option value="">-- Select Hostel --</option>
                  {hostelsList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.type} Hostel)
                    </option>
                  ))}
                </select>
                {!wardenHostelId && <p className="text-[11px] text-amber-700 mt-1">No hostel chosen: this warden will see no students.</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Block / Wing"
                  value={hostelBlock}
                  onChange={(e) => setHostelBlock(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                />
                <input
                  type="text"
                  placeholder="Duty Timing"
                  value={dutyTiming}
                  onChange={(e) => setDutyTiming(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                />
              </div>
            </div>
          )}

          {/* Specific fields for Transport Manager */}
          {portalRole === 'TRANSPORT_MANAGER' && (
            <div className="p-3.5 rounded-xl bg-yellow-50/60 border border-yellow-200 space-y-3">
              <label className="block text-xs font-bold text-yellow-950">
                Transport & Fleet Responsibilities
              </label>
              <textarea
                rows={2}
                value={transportResponsibility}
                onChange={(e) => setTransportResponsibility(e.target.value)}
                placeholder="Route operations, driver supervision, vehicle maintenance"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              />
            </div>
          )}
        </div>

        {/* Section 3: Payroll */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <span>Payroll & Bank Account Configuration</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="edit-salary-from" className="block text-xs font-bold text-slate-700 mb-1">Salary from</label>
              <input
                id="edit-salary-from"
                type="date"
                min={dateOfJoining || undefined}
                value={salaryStartDate}
                onChange={(e) => setSalaryStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {salaryStartDate
                  ? 'Salary is created in the ERP from this date. Unpaid salary for earlier months is removed.'
                  : 'Not set: salary starts from the month this person was added to the ERP.'}
              </p>
            </div>
            <div>
              <label htmlFor="edit-monthly-salary" className="block text-xs font-bold text-slate-700 mb-1">Monthly Gross Salary (₹)</label>
              <input
                id="edit-monthly-salary"
                type="number"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
              />
              {salaryChanged && Number(monthlySalary) > 0 && (
                <p className={`mt-1 text-[11px] font-medium ${Number(monthlySalary) >= Number(initialMonthlySalary || 0) ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {initialMonthlySalary === ''
                    ? `Salary set to ₹${Number(monthlySalary).toLocaleString('en-IN')}.`
                    : `${Number(monthlySalary) >= Number(initialMonthlySalary) ? 'Increase' : 'Decrease'} of ₹${Math.abs(Number(monthlySalary) - Number(initialMonthlySalary)).toLocaleString('en-IN')} (₹${Number(initialMonthlySalary).toLocaleString('en-IN')} → ₹${Number(monthlySalary).toLocaleString('en-IN')}).`}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bank Account No</label>
              <input
                type="text"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
              <input
                type="text"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PAN Number</label>
              <input
                type="text"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">UAN Number</label>
              <input
                type="text"
                maxLength={12}
                placeholder="e.g. 100912345678"
                value={uanNumber}
                onChange={(e) => setUanNumber(e.target.value.trim())}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">12-digit Universal Account Number</span>
            </div>
          </div>

          {salaryChanged && Number(monthlySalary) > 0 && (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={applySalaryToUnpaid}
                onChange={(e) => setApplySalaryToUnpaid(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-semibold text-slate-900 block">Also change salary already calculated but not paid</span>
                The new amount always applies to months calculated from now on. Tick this to recalculate the unpaid months that already exist.
                Months already paid are never changed.
              </span>
            </label>
          )}
        </div>

        {/* Section 4: Portal Login Access */}
        {isNoLoginStaffRole(portalRole) ? (
        <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6 sm:p-8 text-xs text-stone-800" data-testid="support-staff-no-login">
          <span className="font-bold block mb-1">No app login for support staff</span>
          Support staff keep their Employee ID, ID card, attendance and payroll record but cannot sign in. Change the role to give a login.
        </div>
        ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 text-xs block">Enable Portal Account</span>
              <span className="text-[11px] text-slate-500">
                Grants system login privileges into the single-school ERP portal with role {portalRole}.
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
        </div>
        )}

        {/* Section 5: Documents & Certificates */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Documents & Verification Records</h3>
            <p className="text-[11px] text-slate-500">
              Official employee certificates and verification documents stored securely in school digital vault
            </p>
          </div>

          <StaffDocumentManager
            documents={documents}
            onChange={setDocuments}
          />
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel & Return
          </button>

          <button
            type="submit"
            disabled={isSubmitting || isPhotoUploading}
            className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Saving Changes...</span>
            ) : isPhotoUploading ? (
              <span>Uploading photo…</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Staff Profile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
