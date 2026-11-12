import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  AlertCircle,
  FileText,
  CheckCircle2,
  Users,
  Lock,
  ChevronRight,
  ChevronLeft,
  Building2,
  Bus,
  Eye,
  Camera,
  Search,
  Link2,
  RotateCw,
  Trash2,
  Loader2,
  Upload,
  GraduationCap,
  Key,
  ShieldCheck,
  CreditCard,
  Receipt,
  Save,
  Check,
} from 'lucide-react';
import { AcademicClass, Student, AttachedDocument } from '../../types';
import { api } from '../../services/api';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { fileUploadService } from '../../services/fileUploadService';
import {
  INDIAN_STATES_AND_UTS,
  BIHAR_DISTRICTS,
  RELIGION_OPTIONS,
  OCCUPATION_OPTIONS,
} from '../../constants/admissionConstants';
import { AdmissionPreviewPage, AdmissionFormData } from './admission/AdmissionPreviewPage';
import { AdmissionConfirmModal } from './admission/AdmissionConfirmModal';
import { AdmissionSuccessPage } from './admission/AdmissionSuccessPage';
import { FeeStructureStep } from './admission/FeeStructureStep';
import { classSectionOptions, sectionForClass } from '../../utils/classSections';
import { useFreshClasses } from '../../hooks/useFreshClasses';

interface StudentAdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdmitted: (student: Student) => void;
  classes: AcademicClass[];
}

type AdmissionStep = 1 | 2 | 3 | 4 | 5 | 6;
type ModalViewMode = 'form' | 'preview' | 'success';

const STEP_LABELS: { step: AdmissionStep; title: string; subtitle: string }[] = [
  { step: 1, title: 'Personal', subtitle: 'Vitals & Photo' },
  { step: 2, title: 'Parents', subtitle: 'Family & Address' },
  { step: 3, title: 'Academics', subtitle: 'Class & History' },
  { step: 4, title: 'Fee & Facilities', subtitle: 'Fee Structure & Logistics' },
  { step: 5, title: 'Documents', subtitle: 'Certificates' },
  { step: 6, title: 'Portal & Access', subtitle: 'Logins & Preview' },
];

export const StudentAdmissionModal: React.FC<StudentAdmissionModalProps> = ({
  isOpen,
  onClose,
  onStudentAdmitted,
  classes: classesProp,
}) => {
  // Current classes and sections from the server (a section added in Academic Structure shows up here).
  const classes = useFreshClasses(classesProp, isOpen);
  const [viewMode, setViewMode] = useState<ModalViewMode>('form');
  const [currentStep, setCurrentStep] = useState<AdmissionStep>(1);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [admittedStudent, setAdmittedStudent] = useState<Student | null>(null);

  const initialFormData: AdmissionFormData = {
    // Step 1: Personal
    firstName: '',
    middleName: '',
    lastName: '',
    name: '',
    photo: '',
    photoFileKey: '',
    dob: '2012-05-15',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    bloodGroup: 'B+',
    aadhaarNumber: '',
    category: 'GENERAL' as 'GENERAL' | 'OBC' | 'SC' | 'ST' | 'EWS',
    religion: 'Hindu',
    otherReligion: '',
    identificationMark: '',
    mobile: '',
    email: '',

    // Step 2: Parent / Guardian
    fatherName: '',
    fatherMobile: '',
    fatherOccupation: 'Business',
    otherFatherOccupation: '',
    fatherEmail: '',
    motherName: '',
    motherMobile: '',
    motherOccupation: '',
    motherEmail: '',
    guardianName: '',
    guardianMobile: '',
    guardianRelationship: 'Guardian',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    parentOccupation: 'Business',
    address: '',
    state: 'Bihar',
    city: 'Sheohar',
    pincode: '843329',
    emergencyContactName: '',
    emergencyContact: '',
    emergencyRelationship: 'Father',

    // Step 3: Academic
    classId: classes[0]?.id || 'c-10',
    className: classes[0]?.name || 'Class 10',
    section: 'A',
    academicSession: api.getActiveAcademicSession()?.name || api.getSettings().currentAcademicSession || '2026-2027',
    admissionDate: new Date().toISOString().substring(0, 10),
    enrollmentDate: new Date().toISOString().substring(0, 10),
    feeStartDate: new Date().toISOString().substring(0, 10),
    portalEntryDate: new Date().toISOString().substring(0, 10),
    previousClassPassed: 'Yes',
    previousSchool: '',
    previousClass: '',
    previousMarks: '',

    // Step 4: Fee Structure & Facilities
    feeProfile: undefined,
    transportRequired: false,
    transportRouteId: '',
    transportStopName: '',
    transportStopId: '',
    transportMonthlyFee: 0,
    vehicleNumber: '',
    driverName: '',
    driverContact: '',
    hostelRequired: false,
    hostelId: '',
    hostelName: '',
    hostelRoomId: '',
    hostelFloor: undefined,
    hostelBedNumber: '',
    hostelWarden: '',
    hostelMonthlyFee: 0,
    messMonthlyFee: 0,

    // Step 5: Documents
    documents: [] as AttachedDocument[],
  };

  const [formData, setFormData] = useState<AdmissionFormData>(initialFormData);

  // Step 6: Portal Access Credentials
  const [enableStudentPortal, setEnableStudentPortal] = useState(true);
  const [studentInitialPassword, setStudentInitialPassword] = useState('2012-05-15');
  const [enableParentPortal, setEnableParentPortal] = useState(true);
  const [parentInitialPassword, setParentInitialPassword] = useState('CPS123');

  // Automatically keep student initial password in sync with student DOB
  useEffect(() => {
    if (formData.dob) {
      setStudentInitialPassword(formData.dob);
    }
  }, [formData.dob]);

  // Existing Parent Search & Linking
  const [existingParentMatch, setExistingParentMatch] = useState<{
    found: boolean;
    parentName: string;
    parentPhone: string;
    parentEmail?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    childrenCount: number;
    children: Student[];
  } | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState({
    admissionNumber: '64010009',
    registrationNumber: 'CPS2026100009',
    rollNumber: '1',
  });

  const DRAFT_STORAGE_KEY = 'cps_student_admission_draft';

  // Save current form draft state to localStorage
  const saveDraftToStorage = (data: AdmissionFormData, step?: AdmissionStep) => {
    try {
      const draftPayload = {
        formData: data,
        currentStep: step || currentStep,
        enableStudentPortal,
        studentInitialPassword,
        enableParentPortal,
        parentInitialPassword,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
      setSaveStatus('Draft Saved');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (e) {
      console.warn('Failed to save admission draft to localStorage:', e);
    }
  };

  // Clear draft storage
  const clearDraftFromStorage = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setSaveStatus(null);
    } catch (e) {
      console.warn('Failed to clear admission draft:', e);
    }
  };

  // Reset form completely for a new student
  const resetForm = () => {
    clearDraftFromStorage();
    setFormData(initialFormData);
    setCurrentStep(1);
    setViewMode('form');
    setShowConfirmModal(false);
    setIsSubmitting(false);
    setAdmittedStudent(null);
    setValidationError(null);
    setPhotoError(null);
    setPhotoUploading(false);
    setPhotoProgress(0);
    setIsPhotoDragOver(false);
    setExistingParentMatch(null);
    setEnableStudentPortal(true);
    setStudentInitialPassword('2012-05-15');
    setEnableParentPortal(true);
    setParentInitialPassword('CPS123');
    setSaveStatus(null);
    // Refresh preview identifiers
    const numbers = api.getNextStudentNumbers(initialFormData.classId, initialFormData.section);
    setPreviewData(numbers);
  };

  // Dynamic preview of auto-generated identifiers
  useEffect(() => {
    if (isOpen) {
      const numbers = api.getNextStudentNumbers(formData.classId, formData.section);
      setPreviewData(numbers);
    }
  }, [isOpen, formData.classId, formData.section]);

  // Handle modal state when opened: check for existing draft or restore
  useEffect(() => {
    if (isOpen) {
      setViewMode('form');
      setShowConfirmModal(false);
      setIsSubmitting(false);
      setAdmittedStudent(null);
      setValidationError(null);
      setPhotoError(null);
      setPhotoUploading(false);
      setPhotoProgress(0);
      setIsPhotoDragOver(false);

      // Check if a saved draft exists
      try {
        const savedDraftRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraftRaw) {
          const draft = JSON.parse(savedDraftRaw);
          if (draft && draft.formData) {
            setFormData(draft.formData);
            if (draft.currentStep) {
              setCurrentStep(draft.currentStep);
            }
            if (draft.enableStudentPortal !== undefined) setEnableStudentPortal(draft.enableStudentPortal);
            if (draft.studentInitialPassword) setStudentInitialPassword(draft.studentInitialPassword);
            if (draft.enableParentPortal !== undefined) setEnableParentPortal(draft.enableParentPortal);
            if (draft.parentInitialPassword) setParentInitialPassword(draft.parentInitialPassword);
            setSaveStatus('Draft Restored');
            setTimeout(() => setSaveStatus(null), 3000);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to load admission draft from localStorage:', e);
      }

      // If no draft, start on step 1
      setCurrentStep(1);
    }
  }, [isOpen]);

  // Student Photo Upload State & Handlers
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(() => formData.photo ? fileUploadService.getFileUrl(formData.photo) : '');
  const [photoPreviewError, setPhotoPreviewError] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isPhotoDragOver, setIsPhotoDragOver] = useState(false);

  // Clean up blob URL on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handlePhotoFile = async (file: File) => {
    setPhotoError(null);
    setPhotoPreviewError(false);

    if (!file) return;

    // 1. Strict Format Validation (PNG, JPG, JPEG, WEBP)
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/pjpeg', 'image/x-png'];
    const isMimeValid = allowedMimes.includes(file.type.toLowerCase()) || file.type.startsWith('image/');
    const isExtValid = !!file.name.match(/\.(jpe?g|png|webp)$/i);

    if (!isMimeValid && !isExtValid) {
      setPhotoError('Unsupported format. Please select a valid PNG, JPG, or WEBP photo.');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    // 2. Strict File Size Validation (Max 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Photo file size exceeds the 10 MB limit. Please select a smaller photo.');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    // 3. Immediate Visual Preview before network upload
    try {
      const localPreviewUrl = URL.createObjectURL(file);
      setPhotoPreview(localPreviewUrl);
      setFormData((prev) => ({
        ...prev,
        photo: localPreviewUrl,
      }));
    } catch (createErr) {
      console.warn('URL.createObjectURL failed, relying on FileReader:', createErr);
    }

    // Also read as Data URL for ultra-resilient base64 storage and mobile compatibility
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setPhotoPreview(dataUrl);
          setFormData((prev) => ({
            ...prev,
            photo: prev.photoFileKey ? prev.photo : dataUrl,
          }));
        }
      };
      reader.readAsDataURL(file);
    } catch (readErr) {
      console.warn('FileReader preview error:', readErr);
    }

    // 4. Background Stream Upload to Cloudflare R2 / Server Gateway
    setPhotoUploading(true);
    setPhotoProgress(15);

    try {
      const result = await fileUploadService.uploadDirectToR2({
        file,
        folder: 'students/photos',
        onProgress: (evt) => {
          setPhotoProgress(evt.percentage);
        },
      });

      setFormData((prev) => ({
        ...prev,
        photo: result.fileKey,
        photoFileKey: result.fileKey,
      }));
      setPhotoProgress(100);
      setPhotoUploading(false);
    } catch (err: any) {
      console.warn('[StudentAdmissionModal] Direct upload notice, preserving visual preview & local data:', err);
      // Even if remote upload encountered a transient issue, keep base64 preview so photo is preserved
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (formData.photoFileKey && !formData.photoFileKey.startsWith('photo-')) {
      fileUploadService.deleteFile(formData.photoFileKey).catch(console.warn);
    }
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview('');
    setPhotoPreviewError(false);
    setFormData((prev) => ({
      ...prev,
      photo: '',
      photoFileKey: '',
    }));
    setPhotoError(null);
    setPhotoProgress(0);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  // Real-time parent lookup when father or mother phone is entered
  const handleParentLookup = (phone: string) => {
    const cleanPhone = phone.trim();
    if (cleanPhone.length >= 10) {
      const match = api.findExistingParent(cleanPhone);
      setExistingParentMatch(match);
    } else {
      setExistingParentMatch(null);
    }
  };

  const applyExistingParentDetails = () => {
    if (!existingParentMatch || !existingParentMatch.found) return;
    setFormData((prev) => ({
      ...prev,
      fatherName: prev.fatherName || existingParentMatch.parentName,
      parentName: existingParentMatch.parentName,
      fatherMobile: prev.fatherMobile || existingParentMatch.parentPhone,
      parentPhone: existingParentMatch.parentPhone,
      parentEmail: existingParentMatch.parentEmail || prev.parentEmail,
      fatherEmail: existingParentMatch.parentEmail || prev.fatherEmail,
      address: existingParentMatch.address || prev.address,
      state: existingParentMatch.state || prev.state,
      city: existingParentMatch.city || prev.city,
      pincode: existingParentMatch.pincode || prev.pincode,
    }));
  };

  const handleNameChange = (field: 'firstName' | 'middleName' | 'lastName', value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      updated.name = [updated.firstName, updated.middleName, updated.lastName].filter(Boolean).join(' ');
      return updated;
    });
  };

  // State Change Handler with District Dependency Logic
  const handleStateChange = (newState: string) => {
    setFormData((prev) => ({
      ...prev,
      state: newState,
      // If State = Bihar: default District = Sheohar
      // If another State is selected: reset previously selected district, do not keep Sheohar!
      city: newState === 'Bihar' ? 'Sheohar' : '',
    }));
  };

  // Previous Class Passed Handler
  const handlePreviousClassPassedChange = (val: 'Yes' | 'No' | '') => {
    setFormData((prev) => ({
      ...prev,
      previousClassPassed: val,
      // If No, clear dependent previous class details
      previousSchool: val === 'No' ? '' : prev.previousSchool,
      previousClass: val === 'No' ? '' : prev.previousClass,
      previousMarks: val === 'No' ? '' : prev.previousMarks,
    }));
  };

  // Validate only the active step when clicking "Next Step"
  const validateCurrentStep = (): boolean => {
    setValidationError(null);

    if (currentStep === 1) {
      const effectiveName = formData.name || [formData.firstName, formData.lastName].filter(Boolean).join(' ');
      if (!effectiveName.trim()) {
        setValidationError('Student First Name and Last Name are required.');
        return false;
      }
      if (!formData.dob) {
        setValidationError('Student Date of Birth is required.');
        return false;
      }
      if (formData.religion === 'Other' && !formData.otherReligion.trim()) {
        setValidationError('Please enter Religion as "Other" was selected.');
        return false;
      }
    }

    if (currentStep === 2) {
      const effectiveParentName =
        formData.parentName || formData.fatherName || formData.motherName || formData.guardianName;
      if (!effectiveParentName.trim()) {
        setValidationError('Please enter Father Name, Mother Name, or Guardian Name.');
        return false;
      }
      const effectivePhone = formData.parentPhone || formData.fatherMobile || formData.motherMobile;
      if (!effectivePhone.trim()) {
        setValidationError('Primary Parent Contact Phone Number is required.');
        return false;
      }
      const digitsOnly = effectivePhone.replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        setValidationError('Parent Mobile Phone Number must contain at least 10 digits.');
        return false;
      }
      if (formData.fatherOccupation === 'Other' && !formData.otherFatherOccupation.trim()) {
        setValidationError("Please enter Father's Occupation as \"Other\" was selected.");
        return false;
      }
      if (!formData.address.trim()) {
        setValidationError('Residential Street Address is required.');
        return false;
      }
      if (!formData.state.trim()) {
        setValidationError('State is required.');
        return false;
      }
      if (!formData.city.trim()) {
        setValidationError(formData.state === 'Bihar' ? 'District is required.' : 'District / City is required.');
        return false;
      }
      if (!formData.pincode.trim()) {
        setValidationError('PIN Code is required.');
        return false;
      }
      if (!/^\d{6}$/.test(formData.pincode.trim())) {
        setValidationError('PIN Code must be exactly 6 numeric digits.');
        return false;
      }
    }

    if (currentStep === 3) {
      if (!formData.classId) {
        setValidationError('Enrolled Class is required.');
        return false;
      }
      if (!formData.previousClassPassed) {
        setValidationError('Please specify whether Previous Class was Passed (Yes or No).');
        return false;
      }
    }

    return true;
  };

  // Full validation before opening Preview Page
  const validateAllFormFields = (): boolean => {
    setValidationError(null);

    // Step 1: Personal
    const effectiveName = formData.name || [formData.firstName, formData.lastName].filter(Boolean).join(' ');
    if (!effectiveName.trim()) {
      setValidationError('Student First Name and Last Name are required.');
      setCurrentStep(1);
      return false;
    }
    if (!formData.dob) {
      setValidationError('Student Date of Birth is required.');
      setCurrentStep(1);
      return false;
    }
    if (!formData.religion) {
      setValidationError('Religion is required.');
      setCurrentStep(1);
      return false;
    }
    if (formData.religion === 'Other' && !formData.otherReligion.trim()) {
      setValidationError('Please enter candidate Religion under Step 1.');
      setCurrentStep(1);
      return false;
    }

    // Step 2: Parent & Address
    const effectiveParentName =
      formData.parentName || formData.fatherName || formData.motherName || formData.guardianName;
    if (!effectiveParentName.trim()) {
      setValidationError('Please enter Father Name, Mother Name, or Guardian Name under Step 2.');
      setCurrentStep(2);
      return false;
    }
    const effectivePhone = formData.parentPhone || formData.fatherMobile || formData.motherMobile;
    if (!effectivePhone.trim()) {
      setValidationError('Primary Parent Contact Phone Number is required under Step 2.');
      setCurrentStep(2);
      return false;
    }
    const digitsOnly = effectivePhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setValidationError('Parent Mobile Phone Number must contain at least 10 digits.');
      setCurrentStep(2);
      return false;
    }
    if (formData.fatherOccupation === 'Other' && !formData.otherFatherOccupation.trim()) {
      setValidationError("Please enter Father's Occupation under Step 2.");
      setCurrentStep(2);
      return false;
    }
    if (!formData.address.trim()) {
      setValidationError('Residential Street Address is required under Step 2.');
      setCurrentStep(2);
      return false;
    }
    if (!formData.state.trim()) {
      setValidationError('State is required under Step 2.');
      setCurrentStep(2);
      return false;
    }
    if (!formData.city.trim()) {
      setValidationError(formData.state === 'Bihar' ? 'District is required under Step 2.' : 'District / City is required under Step 2.');
      setCurrentStep(2);
      return false;
    }
    if (!formData.pincode.trim()) {
      setValidationError('PIN Code is required under Step 2.');
      setCurrentStep(2);
      return false;
    }
    if (!/^\d{6}$/.test(formData.pincode.trim())) {
      setValidationError('PIN Code must be exactly 6 numeric digits under Step 2.');
      setCurrentStep(2);
      return false;
    }

    // Step 3: Academic
    if (!formData.classId) {
      setValidationError('Enrolled Class is required under Step 3.');
      setCurrentStep(3);
      return false;
    }
    if (!formData.enrollmentDate?.trim()) {
      setValidationError('Enrollment Date is required under Step 3 as it controls fee billing.');
      setCurrentStep(3);
      return false;
    }
    if (!formData.previousClassPassed) {
      setValidationError('Please select whether Previous Class was Passed (Yes or No) under Step 3.');
      setCurrentStep(3);
      return false;
    }

    // Step 4: Fee Structure & Facilities
    if (formData.transportRequired && (!formData.transportRouteId || !formData.transportStopName.trim())) {
      setValidationError('Please select an active Transit Route and Designated Bus Stop under Step 4.');
      setCurrentStep(4);
      return false;
    }
    if (formData.hostelRequired && (!formData.hostelRoomId.trim() || !formData.hostelBedNumber.trim())) {
      setValidationError('Hostel Room Number and Bed Number are required when Hostel Residency is opted in under Step 4.');
      return false;
    }

    return true;
  };

  const goToNextStep = () => {
    if (validateCurrentStep()) {
      const nextStep = Math.min(6, currentStep + 1) as AdmissionStep;
      saveDraftToStorage(formData, nextStep);
      setCurrentStep(nextStep);
    }
  };

  const goToPrevStep = () => {
    setValidationError(null);
    const prevStep = Math.max(1, currentStep - 1) as AdmissionStep;
    saveDraftToStorage(formData, prevStep);
    setCurrentStep(prevStep);
  };

  // Open Preview Page (does NOT create any record, persists draft)
  const handleOpenPreview = () => {
    if (validateAllFormFields()) {
      setValidationError(null);
      saveDraftToStorage(formData, currentStep);
      setViewMode('preview');
    }
  };

  // Return from Preview to Form (preserves all data)
  const handleEditFromPreview = () => {
    setViewMode('form');
  };

  // Open Confirmation Modal from Preview Page
  const handleRequestFinalConfirm = () => {
    setShowConfirmModal(true);
  };

  // Final Execution of Student Admission
  const handleFinalSubmit = async () => {
    if (isSubmitting) return;

    if (!validateAllFormFields()) {
      setShowConfirmModal(false);
      setViewMode('form');
      return;
    }

    setIsSubmitting(true);
    try {
      const effectiveName =
        formData.name ||
        [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ') ||
        'Unnamed Student';
      const effectiveParentName =
        formData.fatherName || formData.parentName || formData.motherName || formData.guardianName || 'Parent';
      const effectivePhone =
        formData.fatherMobile?.trim() || formData.parentPhone?.trim() || formData.motherMobile?.trim() || formData.mobile?.trim() || '';
      const currentClass = classes.find((c) => c.id === formData.classId);

      const effectiveReligion =
        formData.religion === 'Other' && formData.otherReligion.trim()
          ? formData.otherReligion.trim()
          : formData.religion || 'Hindu';

      const effectiveFatherOccupation =
        formData.fatherOccupation === 'Other' && formData.otherFatherOccupation.trim()
          ? formData.otherFatherOccupation.trim()
          : formData.fatherOccupation || 'Business';

      const student = await api.admitStudentAsync({
        ...formData,
        admissionDate: formData.admissionDate,
        enrollmentDate: formData.enrollmentDate || formData.admissionDate,
        feeStartDate: formData.feeStartDate || formData.enrollmentDate || formData.admissionDate,
        portalEntryDate: formData.portalEntryDate || new Date().toISOString().substring(0, 10),
        admissionNumber: previewData.admissionNumber,
        registrationNumber: previewData.registrationNumber,
        rollNumber: previewData.rollNumber,
        name: effectiveName,
        fatherName: formData.fatherName || effectiveParentName,
        parentName: effectiveParentName,
        fatherMobile: formData.fatherMobile || effectivePhone,
        parentPhone: effectivePhone,
        religion: effectiveReligion,
        fatherOccupation: effectiveFatherOccupation,
        parentOccupation: effectiveFatherOccupation,
        className: currentClass ? currentClass.name : formData.className,
        previousClassPassed: formData.previousClassPassed,
        loginEnabled: enableStudentPortal,
        accountStatus: enableStudentPortal ? 'ACTIVE' : 'INACTIVE',
      });

      // Automatically create and activate Student Portal account if enabled
      const effectiveStudentPassword = studentInitialPassword || formData.dob;
      if (enableStudentPortal) {
        await api.updateStudentPortalStatus(student.id, { loginEnabled: true, accountStatus: 'ACTIVE' });
        if (effectiveStudentPassword) {
          await api.resetStudentPassword(student.id, effectiveStudentPassword);
        }
      } else {
        await api.updateStudentPortalStatus(student.id, { loginEnabled: false, accountStatus: 'INACTIVE' });
      }

      // Automatically create and activate Parent Portal account if enabled
      const effectiveParentPassword = parentInitialPassword || 'CPS123';
      if (enableParentPortal && effectivePhone) {
        await api.updateParentPortalStatus(effectivePhone, { loginEnabled: true, accountStatus: 'ACTIVE' });
        await api.resetParentPassword(effectivePhone, effectiveParentPassword);
      } else if (!enableParentPortal && effectivePhone) {
        await api.updateParentPortalStatus(effectivePhone, { loginEnabled: false, accountStatus: 'INACTIVE' });
      }

      if (student.photoFileKey) {
        await fileUploadService.confirmFileAssociation(student.photoFileKey, {
          type: 'STUDENT_PHOTO',
          id: student.id,
        });
      }

      if (formData.documents && formData.documents.length > 0) {
        for (const doc of formData.documents) {
          if (doc.fileKey) {
            await fileUploadService.confirmFileAssociation(doc.fileKey, {
              type: 'STUDENT_DOCUMENT',
              id: student.id,
            });
          }
        }
      }

      setAdmittedStudent(student);
      setShowConfirmModal(false);
      clearDraftFromStorage();
      setViewMode('success');
    } catch (err) {
      console.error('Admission creation failed:', err);
      setValidationError('Failed to complete admission. Please try again.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishViewProfile = () => {
    if (admittedStudent) {
      onStudentAdmitted(admittedStudent);
    }
    onClose();
  };

  const handleFinishGoToList = () => {
    if (admittedStudent) {
      onStudentAdmitted(admittedStudent);
    }
    onClose();
  };

  const handleAdmitAnother = () => {
    if (admittedStudent) {
      onStudentAdmitted(admittedStudent);
    }
    resetForm();
  };

  // When the class list is refreshed, keep the chosen section valid for the chosen class.
  useEffect(() => {
    const cls = classes.find((c) => c.id === formData.classId);
    if (!cls) return;
    const fixed = sectionForClass(cls, formData.section);
    if (fixed !== formData.section) setFormData((prev) => ({ ...prev, section: fixed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, formData.classId]);

  if (!isOpen) return null;

  const selectedClass = classes.find((c) => c.id === formData.classId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-4 overflow-hidden flex flex-col max-h-[94vh] animate-fadeIn">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase">
                {viewMode === 'preview' ? 'Verification Stage' : viewMode === 'success' ? 'Confirmed' : 'Central Onboarding'}
              </span>
              <h3 className="text-base font-bold tracking-tight">
                {viewMode === 'preview'
                  ? 'Student Admission Dossier — Final Verification'
                  : viewMode === 'success'
                  ? 'Student Admission Completed'
                  : 'Student Admission & Enrollment Master'}
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              CHANAKYA PUBLIC SCHOOL & COACHING CENTRE • Single-School Unified System
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                <span>{saveStatus}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* VIEW MODE: PREVIEW */}
        {viewMode === 'preview' && (
          <div className="p-6 overflow-y-auto flex-1">
            <AdmissionPreviewPage
              formData={formData}
              previewData={previewData}
              enableStudentPortal={enableStudentPortal}
              studentInitialPassword={studentInitialPassword}
              enableParentPortal={enableParentPortal}
              parentInitialPassword={parentInitialPassword}
              onEdit={handleEditFromPreview}
              onConfirm={handleRequestFinalConfirm}
            />
          </div>
        )}

        {/* VIEW MODE: SUCCESS */}
        {viewMode === 'success' && admittedStudent && (
          <div className="p-6 overflow-y-auto flex-1">
            <AdmissionSuccessPage
              student={admittedStudent}
              onViewProfile={handleFinishViewProfile}
              onGoToList={handleFinishGoToList}
              onAdmitAnother={handleAdmitAnother}
            />
          </div>
        )}

        {/* VIEW MODE: FORM */}
        {viewMode === 'form' && (
          <>
            {/* Auto-Generated Institutional Identifiers Ribbon */}
            <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 text-white px-6 py-3 shrink-0 border-b border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-blue-500/20 text-blue-400 rounded">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider block">
                      Student Institutional Identifiers
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Official school enrollment series assigned to this student profile.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <div className="bg-slate-800/90 px-3 py-1 rounded-md border border-slate-700">
                    <span className="text-[10px] text-slate-400 font-sans block">Admission No.</span>
                    <strong className="text-blue-400 text-sm font-bold">{previewData.admissionNumber}</strong>
                  </div>
                  <div className="bg-slate-800/90 px-3 py-1 rounded-md border border-slate-700">
                    <span className="text-[10px] text-slate-400 font-sans block">Registration Code</span>
                    <strong className="text-slate-200 text-xs font-bold">{previewData.registrationNumber}</strong>
                  </div>
                  <div className="bg-slate-800/90 px-3 py-1 rounded-md border border-slate-700">
                    <span className="text-[10px] text-slate-400 font-sans block">Roll No.</span>
                    <strong className="text-emerald-400 text-sm font-bold">#{previewData.rollNumber}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Stepper Wizard Navigation Bar */}
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 shrink-0 overflow-x-auto">
              <div className="flex items-center justify-between min-w-[620px]">
                {STEP_LABELS.map((s, idx) => {
                  const isActive = currentStep === s.step;
                  const isCompleted = currentStep > s.step;
                  return (
                    <div key={s.step} className="flex items-center flex-1 last:flex-none">
                      <button
                        type="button"
                        onClick={() => {
                          if (s.step < currentStep || validateCurrentStep()) {
                            setCurrentStep(s.step);
                          }
                        }}
                        className="flex items-center gap-2 text-left group cursor-pointer focus:outline-hidden"
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-md ring-4 ring-blue-100'
                              : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                          }`}
                        >
                          {isCompleted ? '✓' : s.step}
                        </div>
                        <div>
                          <div
                            className={`text-xs font-bold leading-none ${
                              isActive ? 'text-blue-600' : isCompleted ? 'text-slate-900' : 'text-slate-500'
                            }`}
                          >
                            {s.title}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 leading-none">{s.subtitle}</div>
                        </div>
                      </button>
                      {idx < STEP_LABELS.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 mx-3 rounded transition-colors ${
                            currentStep > s.step ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Form Container */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* STEP 1: PERSONAL VITALS & PHOTO */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Step 1: Student Personal Identity & Vitals
                      </h4>
                      <p className="text-slate-500 mt-0.5">Core biological and official identification credentials</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                    {/* Student Photo Upload Card */}
                    <div className="sm:col-span-1 flex flex-col items-center">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp,image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handlePhotoFile(e.target.files[0]);
                          }
                        }}
                      />

                      <div
                        id="admission-photo-dropzone"
                        role="button"
                        tabIndex={0}
                        onClick={() => !photoUploading && photoInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            photoInputRef.current?.click();
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsPhotoDragOver(true);
                        }}
                        onDragLeave={() => setIsPhotoDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsPhotoDragOver(false);
                          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            handlePhotoFile(e.dataTransfer.files[0]);
                          }
                        }}
                        className={`w-36 h-44 sm:w-40 sm:h-48 rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center relative group shadow-xs select-none touch-manipulation ${
                          isPhotoDragOver
                            ? 'border-blue-600 bg-blue-50 scale-102 ring-4 ring-blue-100'
                            : (photoPreview || formData.photo) && !photoPreviewError
                            ? 'border-emerald-500 bg-slate-900 ring-2 ring-emerald-100'
                            : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40'
                        }`}
                        title="Click to select PNG or JPG photo"
                      >
                        {(photoPreview || formData.photo) && !photoPreviewError ? (
                          <>
                            <img
                              src={photoPreview || fileUploadService.getFileUrl(formData.photo)}
                              alt="Student Preview"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={() => {
                                console.warn('[StudentPhoto] Error rendering photo preview');
                                if (photoPreview && (formData.photo && photoPreview !== formData.photo)) {
                                  // Fallback to local preview if remote URL failed
                                  setFormData((prev) => ({ ...prev, photo: photoPreview }));
                                } else {
                                  setPhotoPreviewError(true);
                                }
                              }}
                            />

                            {/* Seamless Bottom Upload Progress Overlay (does not obscure the photo!) */}
                            {photoUploading && (
                              <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 backdrop-blur-xs px-2.5 py-1.5 text-white flex flex-col items-center">
                                <div className="flex items-center justify-between w-full text-[10px] text-white font-semibold mb-1">
                                  <span className="flex items-center gap-1.5">
                                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                    <span>Uploading…</span>
                                  </span>
                                  <span className="font-mono text-blue-200">{photoProgress}%</span>
                                </div>
                                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-150"
                                    style={{ width: `${photoProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Hover overlay for changing */}
                            {!photoUploading && (
                              <div className="absolute inset-0 bg-slate-950/65 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity gap-1.5 p-2 text-center">
                                <RotateCw className="w-5 h-5 text-blue-300" />
                                <span className="text-[11px] font-bold">Change Photo</span>
                                <span className="text-[9px] text-slate-300">Click to select new PNG/JPG</span>
                              </div>
                            )}
                          </>
                        ) : photoPreviewError ? (
                          <div className="text-center p-3 text-red-500 flex flex-col items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-red-400 mb-1" />
                            <span className="text-xs font-bold text-red-700">Preview Error</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">Click to choose another photo</span>
                          </div>
                        ) : (
                          <div className="text-center p-3 text-slate-400 group-hover:text-blue-600 transition-colors">
                            <div className="w-11 h-11 rounded-full bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110">
                              <Camera className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold block text-slate-800 group-hover:text-blue-600">
                              Upload Photo
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                              PNG / JPG / WEBP
                            </span>
                            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Click to Select
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Photo Actions & Feedback */}
                      <div className="w-full mt-2.5 space-y-1.5 flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            id="btn-select-admission-photo"
                            disabled={photoUploading}
                            onClick={() => photoInputRef.current?.click()}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[34px]"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{(photoPreview || formData.photo) ? 'Change Photo' : 'Select Photo (PNG/JPG)'}</span>
                          </button>

                          {(photoPreview || formData.photo) && !photoUploading && (
                            <button
                              type="button"
                              id="btn-remove-admission-photo"
                              onClick={handleRemovePhoto}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                              title="Remove Photo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {(photoPreview || formData.photo) && !photoUploading && !photoPreviewError && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Photo Ready for Submission</span>
                          </div>
                        )}

                        {photoError && (
                          <div className="w-full p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] text-center flex flex-col items-center gap-1">
                            <span>{photoError}</span>
                            <button
                              type="button"
                              onClick={() => photoInputRef.current?.click()}
                              className="text-[10px] font-bold text-red-800 underline hover:text-red-900 cursor-pointer"
                            >
                              Try Again
                            </button>
                          </div>
                        )}

                        <span className="text-[10px] text-slate-400 text-center leading-tight">
                          Passport size • Max 10 MB<br />Formats: PNG, JPG, WEBP
                        </span>
                      </div>
                    </div>

                    {/* Personal Information Fields */}
                    <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">First Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Siddharth"
                          value={formData.firstName}
                          onChange={(e) => handleNameChange('firstName', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Middle Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Kumar"
                          value={formData.middleName}
                          onChange={(e) => handleNameChange('middleName', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Last Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Verma"
                          value={formData.lastName}
                          onChange={(e) => handleNameChange('lastName', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Date of Birth *</label>
                        <input
                          type="date"
                          required
                          value={formData.dob}
                          onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Gender *</label>
                        <select
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Blood Group</label>
                        <select
                          value={formData.bloodGroup}
                          onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600"
                        >
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

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Aadhaar (UIDAI National ID)</label>
                        <input
                          type="text"
                          maxLength={14}
                          placeholder="12-digit Aadhaar number"
                          value={formData.aadhaarNumber}
                          onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Social Category</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="GENERAL">General</option>
                          <option value="OBC">OBC</option>
                          <option value="SC">SC</option>
                          <option value="ST">ST</option>
                          <option value="EWS">EWS (Economically Weaker Section)</option>
                        </select>
                      </div>

                      {/* 1. Religion Dropdown with Other text input */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Religion *</label>
                        <select
                          value={formData.religion}
                          onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600"
                        >
                          {RELIGION_OPTIONS.map((rel) => (
                            <option key={rel} value={rel}>
                              {rel}
                            </option>
                          ))}
                        </select>

                        {formData.religion === 'Other' && (
                          <div className="mt-2 animate-fadeIn">
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Enter Religion *
                            </label>
                            <input
                              type="text"
                              placeholder="Enter Religion"
                              value={formData.otherReligion}
                              onChange={(e) => setFormData({ ...formData, otherReligion: e.target.value })}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600"
                            />
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Visible Identification Mark</label>
                        <input
                          type="text"
                          placeholder="e.g. Small mole on right collarbone"
                          value={formData.identificationMark}
                          onChange={(e) => setFormData({ ...formData, identificationMark: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: PARENTS & ADDRESS (WITH STATE/DISTRICT & PIN VALIDATION) */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Step 2: Parents, Guardian & Residential Address
                      </h4>
                      <p className="text-slate-500 mt-0.5">
                        Parent phone number automatically links sibling students under a unified family portal
                      </p>
                    </div>
                  </div>

                  {/* Existing Parent Smart Lookup Notice */}
                  {existingParentMatch && existingParentMatch.found && (
                    <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold">
                          <Link2 className="w-5 h-5 text-emerald-700" />
                          <span>Existing Family Record Found! ({existingParentMatch.parentName})</span>
                        </div>
                        <span className="text-[11px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded">
                          {existingParentMatch.childrenCount ?? (existingParentMatch.children || []).length} Existing Child(ren) Enrolled
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Parent phone <strong>{existingParentMatch.parentPhone}</strong> is already registered to:{' '}
                        {(existingParentMatch.children || []).map((c) => `${c.name} (${c.className}-${c.section})`).join(', ')}.
                        This new student will be automatically linked to the same parent account.
                      </p>
                      <button
                        type="button"
                        onClick={applyExistingParentDetails}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Auto-Fill Address & Family Information
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Father's Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rajesh Verma"
                        value={formData.fatherName}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            fatherName: e.target.value,
                            parentName: e.target.value || formData.parentName,
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Father's Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="10-digit mobile phone"
                        value={formData.fatherMobile}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData({
                            ...formData,
                            fatherMobile: val,
                            parentPhone: val || formData.parentPhone,
                          });
                          handleParentLookup(val);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    {/* 2. Father's Occupation Dropdown */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Father's Occupation</label>
                      <select
                        value={formData.fatherOccupation}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fatherOccupation: e.target.value,
                            parentOccupation: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600"
                      >
                        {OCCUPATION_OPTIONS.map((occ) => (
                          <option key={occ} value={occ}>
                            {occ}
                          </option>
                        ))}
                      </select>

                      {formData.fatherOccupation === 'Other' && (
                        <div className="mt-2 animate-fadeIn">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Enter Occupation
                          </label>
                          <input
                            type="text"
                            placeholder="Enter Occupation"
                            value={formData.otherFatherOccupation}
                            onChange={(e) =>
                              setFormData({ ...formData, otherFatherOccupation: e.target.value })
                            }
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Mother's Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Sunita Verma"
                        value={formData.motherName}
                        onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Mother's Mobile Number</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile phone"
                        value={formData.motherMobile}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData({ ...formData, motherMobile: val });
                          if (!formData.fatherMobile) handleParentLookup(val);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Parent Email</label>
                      <input
                        type="email"
                        placeholder="parent@example.com"
                        value={formData.parentEmail}
                        onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block font-bold text-slate-700 mb-1">Residential Street Address *</label>
                      <input
                        type="text"
                        required
                        placeholder="Plot / Ward / Mohalla / Village / Road"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    {/* 3. State Dropdown (All Indian States and Union Territories) */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">State *</label>
                      <select
                        value={formData.state}
                        onChange={(e) => handleStateChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600"
                      >
                        {INDIAN_STATES_AND_UTS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* District Field Dependent on State */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {formData.state === 'Bihar' ? 'District (Bihar) *' : 'District / City *'}
                      </label>
                      {formData.state === 'Bihar' ? (
                        <select
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600"
                        >
                          {BIHAR_DISTRICTS.map((dist) => (
                            <option key={dist} value={dist}>
                              {dist}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Enter District / City"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600"
                        />
                      )}
                    </div>

                    {/* 4. PIN Code with 6-digit numeric enforcement */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-700">PIN Code *</label>
                        <span className="text-[10px] font-mono text-slate-400">
                          {formData.pincode.length}/6 digits
                        </span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter 6-digit PIN Code"
                        value={formData.pincode}
                        onChange={(e) => {
                          const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setFormData({ ...formData, pincode: numericOnly });
                        }}
                        className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:ring-2 ${
                          formData.pincode && formData.pincode.length !== 6
                            ? 'border-amber-400 bg-amber-50/40 focus:ring-amber-400'
                            : 'border-slate-300 focus:ring-blue-600'
                        }`}
                      />
                      {formData.pincode && formData.pincode.length !== 6 && (
                        <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
                          PIN Code must be exactly 6 digits (currently {formData.pincode.length})
                        </span>
                      )}
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block font-bold text-slate-700 mb-1">Emergency Contact Phone Number</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="Emergency phone number"
                        value={formData.emergencyContact || formData.fatherMobile}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData({ ...formData, emergencyContact: val });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: ACADEMIC ALLOCATION & PREVIOUS EDUCATION */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Step 3: Academic Allocation & Prior Education
                      </h4>
                      <p className="text-slate-500 mt-0.5">Class level assignment and previous school records</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Enrolling Into Class *</label>
                      <select
                        value={formData.classId}
                        onChange={(e) => {
                          const c = classes.find((cl) => cl.id === e.target.value);
                          setFormData({
                            ...formData,
                            classId: e.target.value,
                            className: c ? c.name : formData.className,
                            section: sectionForClass(c, formData.section),
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                      >
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Section *</label>
                      <select
                        value={formData.section}
                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                      >
                        {(classSectionOptions(selectedClass).length ? classSectionOptions(selectedClass) : [formData.section || 'A']).map((sec) => (
                          <option key={sec} value={sec}>
                            Section {sec}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Academic Session *</label>
                      <select
                        value={formData.academicSession}
                        onChange={(e) => setFormData({ ...formData, academicSession: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800"
                      >
                        {api.getAcademicSessions().map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name} {s.status === 'ACTIVE' ? '(Current Active)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Admission Date</label>
                      <input
                        type="date"
                        value={formData.admissionDate}
                        onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-700 text-xs">Enrollment Date *</label>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Fee Billing Start
                        </span>
                      </div>
                      <input
                        type="date"
                        required
                        value={formData.enrollmentDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            enrollmentDate: val,
                            feeStartDate: val,
                          });
                        }}
                        className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/20 rounded-lg text-xs font-semibold"
                      />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Default: today. Admin can pick any past/future date.
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-700 text-xs">Fee Start Date</label>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          Auto-Linked
                        </span>
                      </div>
                      <input
                        type="date"
                        readOnly
                        value={formData.feeStartDate}
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 font-semibold cursor-not-allowed"
                      />
                      <span className="text-[10px] text-blue-600 block mt-1">
                        Automatically matches Enrollment Date.
                      </span>
                    </div>

                    {/* 5. Previous Class Passed (Yes / No dropdown) */}
                    <div className="sm:col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="block font-bold text-slate-800 text-xs">
                            Previous Class Passed *
                          </label>
                          <p className="text-[11px] text-slate-500">
                            Has the candidate completed and passed a previous academic class in a recognized institution?
                          </p>
                        </div>
                        <select
                          value={formData.previousClassPassed}
                          onChange={(e) =>
                            handlePreviousClassPassedChange(e.target.value as 'Yes' | 'No' | '')
                          }
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold text-slate-800 shrink-0 focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="">Select (Yes / No)</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>

                      {/* Dependent Previous Education Details */}
                      {formData.previousClassPassed === 'Yes' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 animate-fadeIn">
                          <div className="sm:col-span-3">
                            <label className="block font-bold text-slate-700 mb-1 text-xs">
                              Previous School Name
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. St. Xavier's High School / Direct Entry"
                              value={formData.previousSchool}
                              onChange={(e) => setFormData({ ...formData, previousSchool: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block font-bold text-slate-700 mb-1 text-xs">
                              Previous Class
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Class 9"
                              value={formData.previousClass}
                              onChange={(e) => setFormData({ ...formData, previousClass: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1 text-xs">
                              Marks / Percentage / Division
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 89.2% First Div"
                              value={formData.previousMarks}
                              onChange={(e) => setFormData({ ...formData, previousMarks: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: FEE STRUCTURE & FACILITIES */}
              {currentStep === 4 && (
                <FeeStructureStep
                  formData={formData}
                  onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
                  classes={classes}
                />
              )}

              {/* STEP 5: DOCUMENTS (CLOUDFLARE R2 VAULT) */}
              {currentStep === 5 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Step 5: Student Documents & Certificates
                      </h4>
                      <p className="text-slate-500 mt-0.5">
                        Attach Birth Certificate, Transfer Certificate (TC), Marksheets, or Aadhaar scans
                      </p>
                    </div>
                  </div>

                  <FileUploadComponent
                    uploadType="student-document"
                    label="Attach Verification Document (PDF, JPG, PNG)"
                    hint="Upload PDF or image files up to 25MB."
                    onUploadComplete={(res) => {
                      const newDoc: AttachedDocument = {
                        id: `doc-${Date.now()}`,
                        title: res.originalFileName || 'Admission Document',
                        fileKey: res.fileKey,
                        originalFileName: res.originalFileName,
                        contentType: res.contentType,
                        fileSize: res.fileSize,
                        uploadedAt: res.uploadedAt,
                        verificationStatus: 'PENDING',
                      };
                      setFormData((prev) => ({
                        ...prev,
                        documents: [...prev.documents, newDoc],
                      }));
                    }}
                  />

                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-slate-800 block">
                      Attached Documents ({formData.documents.length}):
                    </span>
                    {formData.documents.length > 0 ? (
                      formData.documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <div>
                              <strong className="text-slate-900 block">{doc.originalFileName}</strong>
                              <span className="text-[10px] text-slate-500">
                                {(doc.fileSize / 1024).toFixed(1)} KB • Pending Admin Verification
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Verification
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-slate-400">
                        No documents attached yet. Documents can also be added anytime later via the Student 360° Profile.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 6: PORTAL ACCESS & REVIEW */}
              {currentStep === 6 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Lock className="w-4 h-4 text-blue-600" />
                        Step 6: Portal Access Credentials & Final Review
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure institutional digital access credentials for student and parent portals prior to submission review.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full shrink-0">
                      Step 6 of 6 • Final Step
                    </span>
                  </div>

                  {/* Portal Configuration Dual Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* 1. Student Portal Access Card */}
                    <div
                      className={`p-5 rounded-2xl border transition-all ${
                        enableStudentPortal
                          ? 'bg-blue-50/40 border-blue-200 shadow-2xs'
                          : 'bg-slate-50/80 border-slate-200'
                      }`}
                    >
                      {/* Header with Switch */}
                      <div className="flex items-center justify-between pb-3 border-b border-blue-100">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${enableStudentPortal ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'}`}>
                            <GraduationCap className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-slate-900 uppercase tracking-wide">Student Portal Access</h5>
                            <p className="text-[11px] text-slate-500">Student self-service & LMS dashboard</p>
                          </div>
                        </div>

                        {/* Interactive Toggle Switch */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enableStudentPortal}
                            onClick={() => setEnableStudentPortal(!enableStudentPortal)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              enableStudentPortal ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                enableStudentPortal ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                              enableStudentPortal
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                          >
                            {enableStudentPortal ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>

                      {/* Content Area */}
                      {enableStudentPortal ? (
                        <div className="pt-4 space-y-3.5 text-xs">
                          {/* Student Access ID */}
                          <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Student Access ID (Automatic)
                              </label>
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                Auto-Generated
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium">
                              Automatically use <strong>Admission Number / Registration Number</strong> as Student Login ID.
                            </p>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <span className="text-[9px] text-slate-500 block uppercase font-bold">Admission Number</span>
                                <strong className="font-mono text-xs font-black text-blue-900 block mt-0.5">
                                  {previewData.admissionNumber}
                                </strong>
                              </div>
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <span className="text-[9px] text-slate-500 block uppercase font-bold">Registration Number</span>
                                <strong className="font-mono text-xs font-black text-blue-900 block mt-0.5">
                                  {previewData.registrationNumber}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {/* Initial Student Password */}
                          <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Initial Student Password
                              </label>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Student DOB
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium">
                              Automatically use Student <strong>DOB</strong> (Date of Birth) as the default password.
                            </p>
                            <div className="relative mt-1">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Key className="w-3.5 h-3.5" />
                              </div>
                              <input
                                type="text"
                                value={studentInitialPassword || formData.dob || ''}
                                onChange={(e) => setStudentInitialPassword(e.target.value)}
                                placeholder="Student DOB (e.g. 2012-05-15)"
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              Synced from Student Date of Birth in Step 1 ({formData.dob || 'Not set'}). Student logs in with this DOB.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-4 pb-2 text-center text-slate-500 text-xs">
                          <p className="italic">Student portal access will remain disabled for this student.</p>
                          <p className="text-[11px] text-slate-400 mt-1">Access can be enabled later from the Student Directory.</p>
                        </div>
                      )}
                    </div>

                    {/* 2. Parent Portal Access Card */}
                    <div
                      className={`p-5 rounded-2xl border transition-all ${
                        enableParentPortal
                          ? 'bg-purple-50/40 border-purple-200 shadow-2xs'
                          : 'bg-slate-50/80 border-slate-200'
                      }`}
                    >
                      {/* Header with Switch */}
                      <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${enableParentPortal ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'}`}>
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-slate-900 uppercase tracking-wide">Parent Portal Access</h5>
                            <p className="text-[11px] text-slate-500">Guardian fee records & attendance portal</p>
                          </div>
                        </div>

                        {/* Interactive Toggle Switch */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enableParentPortal}
                            onClick={() => setEnableParentPortal(!enableParentPortal)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              enableParentPortal ? 'bg-purple-600' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                enableParentPortal ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                              enableParentPortal
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                          >
                            {enableParentPortal ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>

                      {/* Content Area */}
                      {enableParentPortal ? (
                        <div className="pt-4 space-y-3.5 text-xs">
                          {/* Parent Access ID */}
                          <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Parent Access ID (Automatic)
                              </label>
                              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                Mobile Auth
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium">
                              Automatically use <strong>Parent/Guardian Mobile Number</strong> as Parent Login ID.
                            </p>
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1">
                              <span className="text-[9px] text-slate-500 block uppercase font-bold">Registered Guardian Mobile</span>
                              <strong className="font-mono text-xs font-black text-purple-900 block mt-0.5">
                                {formData.parentPhone || formData.fatherMobile || formData.motherMobile || formData.guardianMobile || formData.mobile || 'Please provide parent mobile in Step 2'}
                              </strong>
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              Parent enters this 10-digit mobile number on the login page to access all linked children.
                            </span>
                          </div>

                          {/* Initial Parent Password */}
                          <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Initial Parent Password
                              </label>
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                Institutional Default
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium">
                              Initial Parent Password: <strong>CPS123</strong>.
                            </p>
                            <div className="relative mt-1">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Key className="w-3.5 h-3.5" />
                              </div>
                              <input
                                type="text"
                                value={parentInitialPassword}
                                onChange={(e) => setParentInitialPassword(e.target.value)}
                                placeholder="CPS123"
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-purple-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              Standard initial master password is CPS123. Parents can also sign in with their child&apos;s DOB.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-4 pb-2 text-center text-slate-500 text-xs">
                          <p className="italic">Parent portal access will remain disabled for this guardian.</p>
                          <p className="text-[11px] text-slate-400 mt-1">Access can be enabled later from Parent Management.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Admission Fee & Ledger Preview */}
                  {(() => {
                    const transportSlabs = api.getTransportSlabsSync();
                    const matchedConfig = api.getEffectiveFeeConfig(
                      formData.classId,
                      formData.section,
                      formData.academicSession,
                      formData.category
                    );
                    const admFee = matchedConfig ? Number(matchedConfig.admissionFee || 0) : 0;
                    const monthlySchool = matchedConfig ? Number(matchedConfig.monthlySchoolFee || matchedConfig.monthlyTuitionFee || 0) : 0;
                    const dressKit = formData.dressCodeSelected !== false ? (matchedConfig ? Number(matchedConfig.dressCodeFee || 0) : 0) : 0;
                    const booksKit = formData.booksSelected ? (matchedConfig ? Number(matchedConfig.booksFee || matchedConfig.booksStationeryFee || 0) : 0) : 0;
                    const idCard = matchedConfig ? Number(matchedConfig.idCardFee || 0) : 0;
                    let transport = 0;
                    if (formData.transportRequired) {
                      transport = Number(formData.transportMonthlyFee) || 0;
                      if (!transport && (formData.transportRouteId || formData.transportSlabId)) {
                        const matchedSlab = transportSlabs.find((s) => s.id === formData.transportRouteId || s.id === formData.transportSlabId);
                        transport = matchedSlab ? Number(matchedSlab.monthlyFee || matchedSlab.monthlyAmount || 0) : 0;
                      }
                    }
                    let hostelAndMess = 0;
                    if (formData.hostelRequired) {
                      const hostelAmt = Number(formData.hostelMonthlyFee ?? matchedConfig?.hostelFee ?? 0);
                      const messAmt = Number(formData.messMonthlyFee ?? matchedConfig?.messFee ?? 0);
                      hostelAndMess = hostelAmt + messAmt;
                    }
                    const totalPayable =
                      admFee + monthlySchool + dressKit + booksKit + idCard + transport + hostelAndMess;

                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-emerald-600" />
                            <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                              Initial Admission Fee & Invoicing Schedule
                            </h5>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            Class: {formData.className}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">1-Time Admission</span>
                            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                              ₹{(admFee || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-blue-600 block uppercase font-bold">1st Month Tuition</span>
                            <span className="font-bold text-blue-700 text-sm mt-0.5 block">
                              ₹{(monthlySchool || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">Uniform & Books</span>
                            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                              ₹{(dressKit + booksKit + idCard).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">Transport & Hostel</span>
                            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                              {transport + hostelAndMess > 0
                                ? `₹${(transport + hostelAndMess).toLocaleString('en-IN')}`
                                : '—'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <span className="text-slate-600">
                            Total Initial Dues (Generated in Student Ledger upon Admission):
                          </span>
                          <strong className="text-base font-black text-slate-900">
                            ₹{(totalPayable || 0).toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Submission Safeguard Callout Banner */}
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-bold text-amber-950 text-xs uppercase tracking-wider">
                          Final Verification & Activation Protocol
                        </h5>
                        <p className="text-[11px] text-amber-900 mt-0.5">
                          <strong>No student or login accounts are created</strong> until you review the complete dossier and click <strong>Confirm & Submit Admission</strong>.
                        </p>
                        <p className="text-[10px] text-amber-800 mt-0.5">
                          On final submission, student and parent accounts will be automatically provisioned and activated.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save & Proceed to Submit</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper Footer Controls */}
            <div className="flex items-center justify-between p-4 px-6 border-t border-slate-200 shrink-0 bg-white">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={goToPrevStep}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Step</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}

              <div className="flex items-center gap-2">
                {/* Quick Preview Button (available from any step) */}
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="px-3.5 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Preview entire admission form"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Admission</span>
                </button>

                {currentStep < 6 ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save & Continue to {STEP_LABELS[currentStep]?.title || 'Next Step'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenPreview}
                    className="px-6 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save & Review Submission</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Confirmation Modal Overlay */}
        <AdmissionConfirmModal
          isOpen={showConfirmModal}
          isSubmitting={isSubmitting}
          studentName={
            formData.name ||
            [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ') ||
            'Candidate'
          }
          className={formData.className}
          section={formData.section}
          onCancel={() => setShowConfirmModal(false)}
          onConfirm={handleFinalSubmit}
        />
      </div>
    </div>
  );
};
