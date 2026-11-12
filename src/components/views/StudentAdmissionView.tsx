import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
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
  ArrowLeft,
  School,
  X,
  UserPlus,
} from 'lucide-react';
import { AcademicClass, Student, AttachedDocument, SchoolSettings } from '../../types';
import { api } from '../../services/api';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { fileUploadService } from '../../services/fileUploadService';
import { PHOTO_ACCEPT, PHOTO_FORMATS_LABEL } from '../../utils/photoNormalizer';
import {
  INDIAN_STATES_AND_UTS,
  BIHAR_DISTRICTS,
  RELIGION_OPTIONS,
  OCCUPATION_OPTIONS,
} from '../../constants/admissionConstants';
import { AdmissionPreviewPage, AdmissionFormData } from '../modals/admission/AdmissionPreviewPage';
import { AdmissionConfirmModal } from '../modals/admission/AdmissionConfirmModal';
import { AdmissionSuccessPage } from '../modals/admission/AdmissionSuccessPage';
import { FeeStructureStep } from '../modals/admission/FeeStructureStep';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { classSectionOptions, sectionForClass } from '../../utils/classSections';
import { useFreshClasses } from '../../hooks/useFreshClasses';

export interface StudentAdmissionViewProps {
  settings?: SchoolSettings;
  classes?: AcademicClass[];
  onBack: () => void;
  onStudentAdmitted?: (student: Student) => void;
  onOpenProfile?: (student: Student) => void;
}

type AdmissionStep = 1 | 2 | 3 | 4 | 5 | 6;
type ViewMode = 'form' | 'preview' | 'success';

const STEP_LABELS: { step: AdmissionStep; title: string; subtitle: string }[] = [
  { step: 1, title: 'Personal', subtitle: 'Vitals & Photo' },
  { step: 2, title: 'Parents', subtitle: 'Family & Address' },
  { step: 3, title: 'Academics', subtitle: 'Class & History' },
  { step: 4, title: 'Fee & Facilities', subtitle: 'Fee Structure & Logistics' },
  { step: 5, title: 'Documents', subtitle: 'Certificates' },
  { step: 6, title: 'Portal & Access', subtitle: 'Logins & Preview' },
];

export const StudentAdmissionView: React.FC<StudentAdmissionViewProps> = ({
  settings = api.getSettings(),
  classes: classesProp,
  onBack,
  onStudentAdmitted,
  onOpenProfile,
}) => {
  // Current classes and sections from the server (a section added in Academic Structure shows up here).
  const classes = useFreshClasses(classesProp);
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [currentStep, setCurrentStep] = useState<AdmissionStep>(1);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [admittedStudent, setAdmittedStudent] = useState<Student | null>(null);
  const [portalSetupResult, setPortalSetupResult] = useState<{
    studentEnabled: boolean;
    parentEnabled: boolean;
    studentPassword?: string;
    parentPassword?: string;
    warnings: string[];
  } | null>(null);

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
    apaarId: '',
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
    fatherAadhaar: '',
    motherName: '',
    motherMobile: '',
    motherAadhaar: '',
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
    academicSession: api.getActiveAcademicSession()?.name || settings.currentAcademicSession || '2026-2027',
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
    hostelName: 'Vivekananda Boys Hostel',
    hostelRoomId: 'HR-101',
    hostelBedNumber: 'Bed-1',
    hostelMonthlyFee: 5500,
    messMonthlyFee: 3000,

    // Step 5: Documents
    documents: [] as AttachedDocument[],
  };

  const [formData, setFormData] = useState<AdmissionFormData>(initialFormData);

  // Step 6: Portal Access Credentials
  const [enableStudentPortal, setEnableStudentPortal] = useState(true);
  const [studentInitialPassword, setStudentInitialPassword] = useState('2012-05-15');
  const [enableParentPortal, setEnableParentPortal] = useState(true);
  const [parentInitialPassword, setParentInitialPassword] = useState('PDS123');

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
    registrationNumber: 'PDS2026100009',
    rollNumber: '1',
  });

  const DRAFT_STORAGE_KEY = 'pds_student_admission_draft';

  // Time of the last automatic save, shown next to the form ("Auto-saved 09:41")
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  // Becomes true once a saved draft (if any) has been loaded, so the empty form never overwrites it
  const draftLoadedRef = useRef(false);

  // A photo preview made with URL.createObjectURL only lives as long as the page; never keep it in a draft
  const draftSafeFormData = (data: AdmissionFormData): AdmissionFormData =>
    data.photo && data.photo.startsWith('blob:') ? { ...data, photo: data.photoFileKey && !data.photoFileKey.startsWith('photo-') ? data.photoFileKey : '' } : data;

  const isFormEmpty = (data: AdmissionFormData) => JSON.stringify(data) === JSON.stringify(initialFormData);

  // Save current form draft state to localStorage. `silent` = automatic save (no green "Draft Saved" badge).
  const saveDraftToStorage = (data: AdmissionFormData, step?: AdmissionStep, silent = false) => {
    try {
      const draftPayload = {
        formData: draftSafeFormData(data),
        currentStep: step || currentStep,
        enableStudentPortal,
        studentInitialPassword,
        enableParentPortal,
        parentInitialPassword,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
      setAutoSavedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      if (!silent) {
        setSaveStatus('Draft Saved');
        setTimeout(() => setSaveStatus(null), 2500);
      }
    } catch (e) {
      console.warn('Failed to save admission draft to localStorage:', e);
    }
  };

  // Clear draft storage
  const clearDraftFromStorage = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setSaveStatus(null);
      setAutoSavedAt(null);
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
    setParentInitialPassword('PDS123');
    setSaveStatus(null);
    // Refresh preview identifiers
    const numbers = api.getNextStudentNumbers(initialFormData.classId, initialFormData.section);
    setPreviewData(numbers);
  };

  // The class list can arrive after this page opens. Keep the chosen class a real one, so the class shown in
  // the dropdown is always the class that gets saved.
  useEffect(() => {
    if (classes.length === 0) return;
    if (classes.some((c) => c.id === formData.classId)) return;
    setFormData((prev) =>
      classes.some((c) => c.id === prev.classId)
        ? prev
        : { ...prev, classId: classes[0].id, className: classes[0].name }
    );
  }, [classes, formData.classId]);

  // Dynamic preview of auto-generated identifiers
  useEffect(() => {
    const numbers = api.getNextStudentNumbers(formData.classId, formData.section);
    setPreviewData(numbers);
  }, [formData.classId, formData.section]);

  // Load draft on mount
  useEffect(() => {
    try {
      const savedDraftRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraftRaw) {
        const draft = JSON.parse(savedDraftRaw);
        if (draft && draft.formData) {
          // Fields added to the form later get their defaults; a page-only photo preview is dropped
          setFormData(draftSafeFormData({ ...initialFormData, ...draft.formData }));
          if (draft.savedAt) {
            setAutoSavedAt(new Date(draft.savedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
          }
          if (draft.currentStep) {
            setCurrentStep(draft.currentStep);
          }
          if (draft.enableStudentPortal !== undefined) setEnableStudentPortal(draft.enableStudentPortal);
          if (draft.studentInitialPassword) setStudentInitialPassword(draft.studentInitialPassword);
          if (draft.enableParentPortal !== undefined) setEnableParentPortal(draft.enableParentPortal);
          if (draft.parentInitialPassword) setParentInitialPassword(draft.parentInitialPassword);
          setSaveStatus('Draft Restored');
          setTimeout(() => setSaveStatus(null), 3000);
        }
      }
    } catch (e) {
      console.warn('Failed to load admission draft from localStorage:', e);
    }
    draftLoadedRef.current = true;
  }, []);

  // ---- Auto-save: the form is kept as a draft while it is being filled, so closing the tab, a reload,
  // a crash or a dead battery does not lose it. Opening the admission form again brings it back.
  const latestDraftRef = useRef<{ data: AdmissionFormData; step: AdmissionStep; active: boolean }>({
    data: formData,
    step: currentStep,
    active: false,
  });
  useEffect(() => {
    const active = draftLoadedRef.current && viewMode === 'form' && !isSubmitting && !isFormEmpty(formData);
    latestDraftRef.current = { data: formData, step: currentStep, active };
    if (!active) return;
    const timer = window.setTimeout(() => saveDraftToStorage(formData, currentStep, true), 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, currentStep, viewMode, isSubmitting, enableStudentPortal, studentInitialPassword, enableParentPortal, parentInitialPassword]);

  // Save immediately when the page is hidden or closed (no waiting for the 0.7 s timer)
  useEffect(() => {
    const flush = () => {
      const { data, step, active } = latestDraftRef.current;
      if (active) saveDraftToStorage(data, step, true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      flush(); // leaving the admission screen inside the app
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Student Photo Upload State & Handlers
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isPhotoDragOver, setIsPhotoDragOver] = useState(false);
  const [docUploaderKey, setDocUploaderKey] = useState(0);
  const [previewDoc, setPreviewDoc] = useState<AttachedDocument | null>(null);

  const handlePhotoFile = async (file: File) => {
    setPhotoError(null);

    // Fast client-side validation
    const validation = fileUploadService.validateFile(file, 'students/photos');
    if (!validation.valid) {
      setPhotoError(validation.error || `Please choose a photo (${PHOTO_FORMATS_LABEL}).`);
      return;
    }

    // Any photo (or the first page of a PDF) becomes a resized JPEG the browser and server both accept
    setPhotoUploading(true);
    setPhotoProgress(5);
    try {
      file = await fileUploadService.preparePhoto(file);
    } catch (prepErr: any) {
      setPhotoUploading(false);
      setPhotoError(prepErr?.message || `Please choose a photo (${PHOTO_FORMATS_LABEL}).`);
      return;
    }

    // Immediate local visual preview
    const localPreview = URL.createObjectURL(file);
    setFormData((prev) => ({
      ...prev,
      photo: localPreview,
    }));

    setPhotoUploading(true);
    setPhotoProgress(20);

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
      console.warn('Direct upload notice, falling back to base64 preservation:', err);
      try {
        const reader = new FileReader();
        reader.onload = (re) => {
          const dataUrl = re.target?.result as string;
          if (dataUrl) {
            setFormData((prev) => ({
              ...prev,
              photo: dataUrl,
              photoFileKey: `photo-${Date.now()}`,
            }));
          }
        };
        reader.readAsDataURL(file);
      } catch (readErr) {
        setPhotoError('Unable to process photo file. Please try another PNG or JPG.');
      }
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (formData.photoFileKey && !formData.photoFileKey.startsWith('photo-')) {
      fileUploadService.deleteFile(formData.photoFileKey).catch(console.warn);
    }
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
      city: newState === 'Bihar' ? 'Sheohar' : '',
    }));
  };

  // Previous Class Passed Handler
  const handlePreviousClassPassedChange = (val: 'Yes' | 'No' | '') => {
    setFormData((prev) => ({
      ...prev,
      previousClassPassed: val,
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
      if (formData.apaarId && formData.apaarId.length !== 12) {
        setValidationError('Apaar Id must be 12 digits (or leave it empty).');
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
      if (formData.fatherAadhaar && formData.fatherAadhaar.length !== 12) {
        setValidationError('Father Aadhar must be 12 digits (or leave it empty).');
        return false;
      }
      if (formData.motherAadhaar && formData.motherAadhaar.length !== 12) {
        setValidationError('Mother Aadhar must be 12 digits (or leave it empty).');
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
      setValidationError('Student First Name and Last Name are required under Step 1.');
      setCurrentStep(1);
      return false;
    }
    if (!formData.dob) {
      setValidationError('Student Date of Birth is required under Step 1.');
      setCurrentStep(1);
      return false;
    }
    if (!formData.religion) {
      setValidationError('Religion is required under Step 1.');
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
      setCurrentStep(4);
      return false;
    }

    return true;
  };

  const goToNextStep = () => {
    if (validateCurrentStep()) {
      const nextStep = Math.min(6, currentStep + 1) as AdmissionStep;
      saveDraftToStorage(formData, nextStep);
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrevStep = () => {
    setValidationError(null);
    const prevStep = Math.max(1, currentStep - 1) as AdmissionStep;
    saveDraftToStorage(formData, prevStep);
    setCurrentStep(prevStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Preview Page (does NOT create any record, persists draft)
  const handleOpenPreview = () => {
    if (validateAllFormFields()) {
      setValidationError(null);
      saveDraftToStorage(formData, currentStep);
      setViewMode('preview');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Return from Preview to Form (preserves all data)
  const handleEditFromPreview = () => {
    setViewMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ');
      const effectiveParentName =
        formData.fatherName || formData.parentName || formData.motherName || formData.guardianName || '';
      const effectivePhone =
        formData.fatherMobile?.trim() || formData.parentPhone?.trim() || formData.motherMobile?.trim() || formData.mobile?.trim() || '';
      const currentClass = classes.find((c) => c.id === formData.classId);

      const effectiveReligion =
        formData.religion === 'Other' && formData.otherReligion.trim()
          ? formData.otherReligion.trim()
          : formData.religion || '';

      const effectiveFatherOccupation =
        formData.fatherOccupation === 'Other' && formData.otherFatherOccupation.trim()
          ? formData.otherFatherOccupation.trim()
          : formData.fatherOccupation || '';

      const student = await api.admitStudentAsync({
        ...formData,
        admissionDate: formData.admissionDate,
        enrollmentDate: formData.enrollmentDate || formData.admissionDate,
        feeStartDate: formData.feeStartDate || formData.enrollmentDate || formData.admissionDate,
        portalEntryDate: formData.portalEntryDate || new Date().toISOString().substring(0, 10),
        // Admission, registration and roll numbers are allocated by the server; the banner shows a preview only.
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

      // The student is saved. Portal logins are set up next; any step that fails is reported on the
      // success screen instead of being shown as activated.
      const portalWarnings: string[] = [];
      const effectiveStudentPassword = studentInitialPassword || formData.dob;
      if (enableStudentPortal) {
        await api.updateStudentPortalStatus(student.id, { loginEnabled: true, accountStatus: 'ACTIVE' });
        if (effectiveStudentPassword) {
          const r: any = await api.resetStudentPassword(student.id, effectiveStudentPassword);
          if (!r?.success) portalWarnings.push(`Student portal password was not set: ${r?.error || r?.message || 'please set it from the student profile.'}`);
        }
      } else {
        await api.updateStudentPortalStatus(student.id, { loginEnabled: false, accountStatus: 'INACTIVE' });
      }

      const effectiveParentPassword = parentInitialPassword || 'PDS123';
      if (enableParentPortal && effectivePhone) {
        const p1: any = await api.updateParentPortalStatus(effectivePhone, { loginEnabled: true, accountStatus: 'ACTIVE' });
        const p2: any = await api.resetParentPassword(effectivePhone, effectiveParentPassword);
        if (p1?.success === false || !p2?.success) portalWarnings.push(`Parent portal login was not fully set up: ${(p2 && !p2.success && (p2.error || p2.message)) || p1?.error || 'please set it from the student profile.'}`);
      } else if (enableParentPortal && !effectivePhone) {
        portalWarnings.push('Parent portal was not set up because no parent mobile number was entered.');
      } else if (!enableParentPortal && effectivePhone) {
        await api.updateParentPortalStatus(effectivePhone, { loginEnabled: false, accountStatus: 'INACTIVE' });
      }
      setPortalSetupResult({
        studentEnabled: enableStudentPortal,
        parentEnabled: enableParentPortal && !!effectivePhone,
        studentPassword: enableStudentPortal ? effectiveStudentPassword : undefined,
        parentPassword: enableParentPortal && effectivePhone ? effectiveParentPassword : undefined,
        warnings: portalWarnings,
      });

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Admission creation failed:', err);
      setValidationError(err?.message || 'The admission could not be saved. Please try again.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishViewProfile = () => {
    if (admittedStudent) {
      if (onStudentAdmitted) onStudentAdmitted(admittedStudent);
      if (onOpenProfile) {
        onOpenProfile(admittedStudent);
        return;
      }
    }
    onBack();
  };

  const handleFinishGoToList = () => {
    if (admittedStudent && onStudentAdmitted) {
      onStudentAdmitted(admittedStudent);
    }
    onBack();
  };

  const handleAdmitAnother = () => {
    if (admittedStudent && onStudentAdmitted) {
      onStudentAdmitted(admittedStudent);
    }
    resetForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // When the class list is refreshed, keep the chosen section valid for the chosen class.
  useEffect(() => {
    const cls = classes.find((c) => c.id === formData.classId);
    if (!cls) return;
    const fixed = sectionForClass(cls, formData.section);
    if (fixed !== formData.section) setFormData((prev) => ({ ...prev, section: fixed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, formData.classId]);

  const selectedClass = classes.find((c) => c.id === formData.classId);
  // Sections come from the class (Academic Structure), not a fixed A / B / C list.
  const sectionOptions = classSectionOptions(selectedClass).length ? classSectionOptions(selectedClass) : [formData.section || 'A'];
  const logoSrc = getSchoolLogoSrc(settings);

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      {/* 1. TOP RESPONSIVE HEADER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 transition-all">
        {/* Breadcrumb / Back Link */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-700 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Students Directory</span>
          </button>

          <div className="flex items-center gap-2">
            {saveStatus ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-semibold animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                <span>{saveStatus}</span>
              </div>
            ) : (
              viewMode === 'form' &&
              autoSavedAt && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-semibold"
                  title="The form is saved as a draft on this device while you type. Close the site anytime; it opens again where you left it."
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Auto-saved {autoSavedAt}</span>
                </div>
              )
            )}
            {viewMode === 'form' && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
                title="Reset form and start fresh"
              >
                <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Reset Form</span>
              </button>
            )}
          </div>
        </div>

        {/* Title Lockup & School Branding */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white flex items-center justify-center font-bold shadow-sm shrink-0 overflow-hidden border border-blue-800">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={settings.schoolName || 'School Logo'}
                  className="w-full h-full object-contain p-1"
                  onError={handleLogoError}
                />
              ) : (
                <GraduationCap className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Student Admission & Enrollment
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  Session {formData.academicSession || settings.currentAcademicSession || '2026-2027'}
                </span>
                {viewMode === 'preview' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Verification Stage
                  </span>
                )}
                {viewMode === 'success' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Admission Confirmed
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {settings.schoolName || 'RESIDENTIAL PDS PUBLIC SCHOOL'} • Single-School Unified Ledger & Student Onboarding Desk
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {viewMode === 'form' && (
              <button
                type="button"
                onClick={handleOpenPreview}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Preview Dossier</span>
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Cancel / Exit</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE: PREVIEW */}
      {viewMode === 'preview' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 lg:p-8">
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 lg:p-8">
          <AdmissionSuccessPage
            student={admittedStudent}
            portalSetup={portalSetupResult || undefined}
            onViewProfile={handleFinishViewProfile}
            onGoToList={handleFinishGoToList}
            onAdmitAnother={handleAdmitAnother}
          />
        </div>
      )}

      {/* VIEW MODE: FORM (The 6-Step Unified Admission Wizard) */}
      {viewMode === 'form' && (
        <div className="space-y-6">
          {/* 2. AUTO-GENERATED INSTITUTIONAL IDENTIFIERS BANNER */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl shadow-sm p-4 sm:p-6 border border-slate-800">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider block">
                      Institutional Enrollment Series
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/60 border border-blue-700/50 text-blue-200 font-mono">
                      Target: {selectedClass?.name || formData.className}-{formData.section}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Official admission number, registration code, and section roll are pre-allocated automatically.
                  </p>
                </div>
              </div>

              {/* Number Badges */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 font-mono text-xs">
                <div className="bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-inner">
                  <span className="text-[10px] text-slate-400 font-sans block leading-tight">Admission No.</span>
                  <strong className="text-blue-400 text-sm sm:text-base font-bold tabular-nums block mt-0.5">
                    {previewData.admissionNumber}
                  </strong>
                </div>
                <div className="bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-inner">
                  <span className="text-[10px] text-slate-400 font-sans block leading-tight">Registration Code</span>
                  <strong className="text-slate-100 text-xs sm:text-sm font-bold truncate block mt-0.5">
                    {previewData.registrationNumber}
                  </strong>
                </div>
                <div className="bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-inner">
                  <span className="text-[10px] text-slate-400 font-sans block leading-tight">Assigned Roll</span>
                  <strong className="text-emerald-400 text-sm sm:text-base font-bold tabular-nums block mt-0.5">
                    #{previewData.rollNumber}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* 3. STEPPER PROGRESS NAVIGATION BAR */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
            {/* Mobile Step Header with Progress Meter */}
            <div className="md:hidden space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  Step {currentStep} of {STEP_LABELS.length}: <span className="text-blue-700">{STEP_LABELS[currentStep - 1]?.title}</span>
                </span>
                <span className="font-semibold text-slate-500 tabular-nums">
                  {Math.round((currentStep / STEP_LABELS.length) * 100)}% Complete
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / STEP_LABELS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Stepper Navigation: Responsive Grid / Flex */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:flex xl:items-center justify-between gap-2.5 sm:gap-3">
              {STEP_LABELS.map((s, idx) => {
                const isActive = currentStep === s.step;
                const isCompleted = currentStep > s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      if (s.step < currentStep || validateCurrentStep()) {
                        setCurrentStep(s.step);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className={`flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-100 shadow-2xs'
                        : isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isCompleted ? '✓' : s.step}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-bold leading-tight truncate ${
                          isActive ? 'text-blue-900' : isCompleted ? 'text-slate-900' : 'text-slate-600'
                        }`}
                      >
                        {s.title}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight truncate hidden sm:block">
                        {s.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Validation Error Alert */}
          {validationError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-center gap-3 animate-shake shadow-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <div className="flex-1 font-semibold">{validationError}</div>
              <button
                type="button"
                onClick={() => setValidationError(null)}
                className="text-red-400 hover:text-red-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 4. FORM STEP CONTAINER (Clean, naturally scrolling page cards) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
            {/* STEP 1: PERSONAL VITALS & PHOTO */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
                    <span>Student Personal Identity & Official Vitals</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Provide the candidate's verified legal name, date of birth, passport photograph, and demographic details.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Photo Upload Card */}
                  <div className="lg:col-span-1">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsPhotoDragOver(true);
                      }}
                      onDragLeave={() => setIsPhotoDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsPhotoDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handlePhotoFile(file);
                      }}
                      className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-3 transition-colors ${
                        isPhotoDragOver
                          ? 'border-blue-500 bg-blue-50/70'
                          : formData.photo
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept={PHOTO_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoFile(file);
                        }}
                      />

                      <div className="relative group">
                        <div className="w-28 h-32 rounded-xl bg-slate-200 border-2 border-white shadow-md flex items-center justify-center overflow-hidden">
                          {formData.photo ? (
                            <img
                              src={fileUploadService.getFileUrl(formData.photo)}
                              alt="Student Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Camera className="w-10 h-10 text-slate-400" />
                          )}
                        </div>
                        {photoUploading && (
                          <div className="absolute inset-0 bg-slate-900/60 rounded-xl flex flex-col items-center justify-center text-white text-[10px] gap-1">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{photoProgress}%</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={photoUploading}
                          onClick={() => photoInputRef.current?.click()}
                          className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{formData.photo ? 'Change Photo' : 'Upload Photo'}</span>
                        </button>

                        {formData.photo && !photoUploading && (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer"
                            title="Remove Photo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {photoError && (
                        <p className="text-[11px] text-red-600 font-semibold">{photoError}</p>
                      )}

                      <span className="text-[10px] text-slate-400 leading-tight">
                        Passport size photo • Saved at about 40 KB<br />Formats: {PHOTO_FORMATS_LABEL}
                      </span>
                    </div>
                  </div>

                  {/* Personal Fields Grid */}
                  <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">First Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Aarav"
                        value={formData.firstName}
                        onChange={(e) => handleNameChange('firstName', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Middle Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Kumar"
                        value={formData.middleName}
                        onChange={(e) => handleNameChange('middleName', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Last Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sharma"
                        value={formData.lastName}
                        onChange={(e) => handleNameChange('lastName', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Date of Birth *</label>
                      <input
                        type="date"
                        required
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Gender *</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all font-semibold"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Blood Group</label>
                      <select
                        value={formData.bloodGroup}
                        onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all font-semibold"
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
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Aadhaar Card Number</label>
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="12-digit UID"
                        value={formData.aadhaarNumber}
                        onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Apaar Id</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="12 digits"
                        value={formData.apaarId}
                        onChange={(e) => setFormData({ ...formData, apaarId: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Social Category *</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all font-semibold"
                      >
                        <option value="GENERAL">General</option>
                        <option value="OBC">OBC</option>
                        <option value="SC">SC</option>
                        <option value="ST">ST</option>
                        <option value="EWS">EWS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Religion *</label>
                      <select
                        value={formData.religion}
                        onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all font-semibold"
                      >
                        {RELIGION_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formData.religion === 'Other' && (
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Specify Other Religion *</label>
                        <input
                          type="text"
                          required
                          placeholder="Please enter religion"
                          value={formData.otherReligion}
                          onChange={(e) => setFormData({ ...formData, otherReligion: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Physical Identification Mark</label>
                      <input
                        type="text"
                        placeholder="e.g. Mole on right cheek or scar on left forehead"
                        value={formData.identificationMark}
                        onChange={(e) => setFormData({ ...formData, identificationMark: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: PARENTS, GUARDIAN & RESIDENTIAL ADDRESS */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
                    <span>Parent / Guardian Records & Residential Address</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Family contacts for portal access, fee notifications, emergency response, and verified home address.
                  </p>
                </div>

                {/* Existing Parent Match Card */}
                {existingParentMatch && existingParentMatch.found && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-blue-900 block">
                          Existing Parent Record Found: {existingParentMatch.parentName} ({existingParentMatch.parentPhone})
                        </span>
                        <span className="text-[11px] text-blue-700 block mt-0.5">
                          {existingParentMatch.childrenCount ?? (existingParentMatch.children || []).length} sibling(s) currently enrolled ({(existingParentMatch.children || []).map(c => c.name).join(', ')}).
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={applyExistingParentDetails}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Link Family Record</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Father Details */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Father's Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh Sharma"
                      value={formData.fatherName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          fatherName: val,
                          parentName: val || formData.motherName || formData.guardianName,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Father's Mobile Phone *</label>
                    <input
                      type="tel"
                      maxLength={10}
                      required
                      placeholder="10-digit mobile number"
                      value={formData.fatherMobile}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({
                          ...formData,
                          fatherMobile: val,
                          parentPhone: val || formData.motherMobile,
                        });
                        handleParentLookup(val);
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Father's Occupation *</label>
                    <select
                      value={formData.fatherOccupation}
                      onChange={(e) => setFormData({ ...formData, fatherOccupation: e.target.value, parentOccupation: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white font-semibold focus:ring-2 focus:ring-blue-600"
                    >
                      {OCCUPATION_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.fatherOccupation === 'Other' && (
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Specify Father's Occupation *</label>
                      <input
                        type="text"
                        required
                        placeholder="Please enter occupation"
                        value={formData.otherFatherOccupation}
                        onChange={(e) => setFormData({ ...formData, otherFatherOccupation: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  )}

                  <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Father Aadhar</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="12 digits"
                        value={formData.fatherAadhaar}
                        onChange={(e) => setFormData({ ...formData, fatherAadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-600"
                      />
                  </div>

                  {/* Mother Details */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Mother's Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sunita Devi"
                      value={formData.motherName}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Mother's Mobile Phone</label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={formData.motherMobile}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, motherMobile: val });
                        if (!formData.fatherMobile) handleParentLookup(val);
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Mother Aadhar</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="12 digits"
                        value={formData.motherAadhaar}
                        onChange={(e) => setFormData({ ...formData, motherAadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-600"
                      />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Parent Notification Email</label>
                    <input
                      type="email"
                      placeholder="parent@example.com"
                      value={formData.parentEmail}
                      onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {/* Residential Address */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Residential Street Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="Plot / Ward / Mohalla / Village / Post Office"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">State *</label>
                    <select
                      value={formData.state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600"
                    >
                      {INDIAN_STATES_AND_UTS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {formData.state === 'Bihar' ? 'District (Bihar) *' : 'District / City *'}
                    </label>
                    {formData.state === 'Bihar' ? (
                      <select
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600"
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
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">PIN Code *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="6-digit PIN"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: ACADEMIC ENROLLMENT & PREVIOUS SCHOOLING */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">3</span>
                    <span>Academic Enrollment & Previous School History</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Assign target academic class, section, admission date, and prior institutional credentials.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Enrolled Class *</label>
                    <select
                      value={formData.classId}
                      onChange={(e) => {
                        const sel = classes.find((c) => c.id === e.target.value);
                        setFormData({
                          ...formData,
                          classId: e.target.value,
                          className: sel ? sel.name : formData.className,
                          // Keep the section if the new class has it, otherwise its first section.
                          section: sectionForClass(sel, formData.section),
                        });
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-600"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Section *</label>
                    <select
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-600"
                    >
                      {sectionOptions.map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Admission Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.admissionDate}
                      onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">Enrollment Date *</label>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Fee Billing Starts Here
                      </span>
                    </div>
                    <input
                      type="date"
                      required
                      value={formData.enrollmentDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setFormData({
                          ...formData,
                          enrollmentDate: newDate,
                          feeStartDate: newDate,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 border border-emerald-300 bg-emerald-50/30 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 font-semibold text-slate-900"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Defaults to current date. Admin can select any past or future date. Fee calculation starts here.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">Fee Start Date</label>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        Auto-Synchronized
                      </span>
                    </div>
                    <input
                      type="date"
                      readOnly
                      value={formData.feeStartDate}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-semibold cursor-not-allowed"
                    />
                    <p className="text-[11px] text-blue-600 mt-1">
                      Fee Start Date = Enrollment Date automatically.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Academic Session</label>
                    <input
                      type="text"
                      readOnly
                      value={formData.academicSession}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-600 font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Previous Class Passed? *</label>
                    <select
                      value={formData.previousClassPassed}
                      onChange={(e) => handlePreviousClassPassedChange(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="Yes">Yes — Passed Previous Class</option>
                      <option value="No">No — Fresh Direct Admission</option>
                    </select>
                  </div>

                  {formData.previousClassPassed === 'Yes' && (
                    <>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Previous School Name & Location</label>
                        <input
                          type="text"
                          placeholder="e.g. St. Xavier's High School, Patna"
                          value={formData.previousSchool}
                          onChange={(e) => setFormData({ ...formData, previousSchool: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Previous Class</label>
                        <input
                          type="text"
                          placeholder="e.g. Class 9"
                          value={formData.previousClass}
                          onChange={(e) => setFormData({ ...formData, previousClass: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Marks Obtained / Percentage</label>
                        <input
                          type="text"
                          placeholder="e.g. 84.5% / Grade A"
                          value={formData.previousMarks}
                          onChange={(e) => setFormData({ ...formData, previousMarks: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: FEE STRUCTURE & FACILITIES */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">4</span>
                    <span>Fee Structure, Transport & Hostel Logistics</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Class-wise applicable fee schedule, one-time admission dues, discounts, transport routes, and hostel residency.
                  </p>
                </div>

                <FeeStructureStep
                  formData={formData}
                  onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
                  classes={classes}
                />
              </div>
            )}

            {/* STEP 5: DOCUMENT UPLOADS */}
            {currentStep === 5 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">5</span>
                    <span>Student Verification Documents</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Upload official proof certificates (Birth Certificate, TC, Report Cards, Aadhaar). Files are stored directly in Cloud Storage.
                  </p>
                </div>

                <FileUploadComponent
                  key={docUploaderKey}
                  uploadType="student-document"
                  label="Attach a verification document (PDF, JPG or PNG)"
                  hint="Add one file at a time, up to 15 MB each. Images and large PDFs are compressed before upload."
                  acceptedFileTypes=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                  maxSizeMB={15}
                  onUploadComplete={(res) => {
                    const name = (res.originalFileName || '').toLowerCase();
                    const newDoc: AttachedDocument = {
                      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      title: res.originalFileName || 'Admission document',
                      documentType: name.includes('birth')
                        ? 'BIRTH_CERTIFICATE'
                        : name.includes('aadhaar') || name.includes('aadhar')
                        ? 'AADHAAR'
                        : name.includes('tc') || name.includes('transfer')
                        ? 'TRANSFER_CERTIFICATE'
                        : 'OTHER',
                      originalFileName: res.originalFileName,
                      fileKey: res.fileKey,
                      fileSize: res.fileSize,
                      contentType: res.contentType,
                      uploadedAt: res.uploadedAt || new Date().toISOString(),
                      verificationStatus: 'PENDING',
                    };
                    setFormData((prev) => ({
                      ...prev,
                      documents: [...(prev.documents || []), newDoc],
                    }));
                    // Reset the upload box so the next document can be added.
                    window.setTimeout(() => setDocUploaderKey((k) => k + 1), 900);
                  }}
                />

                {formData.documents && formData.documents.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        Attached Documents ({formData.documents.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {formData.documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                            <div className="truncate">
                              <span className="font-bold text-slate-800 text-xs block truncate">
                                {doc.originalFileName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {(doc.fileSize / 1024).toFixed(1)} KB • {String(doc.documentType || 'OTHER').replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Preview Document"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                documents: prev.documents?.filter((_, i) => i !== idx),
                              }));
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Remove Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DocumentPreviewModal
              isOpen={!!previewDoc}
              onClose={() => setPreviewDoc(null)}
              document={
                previewDoc
                  ? {
                      title: previewDoc.title || previewDoc.originalFileName || 'Document',
                      fileKey: previewDoc.fileKey,
                      originalFileName: previewDoc.originalFileName,
                      contentType: previewDoc.contentType,
                    }
                  : null
              }
            />

            {/* STEP 6: PORTAL ACCESS CREDENTIALS */}
            {currentStep === 6 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">6</span>
                    <span>Student & Parent Portal Access Credentials</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage automatic ERP login provisioning for the student and parent.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Student Portal Account */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Student Portal Account</span>
                          <span className="text-[10px] text-slate-500">Self-service marks, fees & notices</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableStudentPortal}
                          onChange={(e) => setEnableStudentPortal(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {enableStudentPortal && (
                      <div className="space-y-3 pt-3 border-t border-slate-200/80 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1">Student Portal Username</label>
                          <input
                            type="text"
                            readOnly
                            value={previewData.admissionNumber}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-900 cursor-not-allowed"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Login ID is automatically the 8-digit Admission Number ({previewData.admissionNumber}).
                          </span>
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Default Initial Password</label>
                          <input
                            type="text"
                            value={studentInitialPassword}
                            onChange={(e) => setStudentInitialPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Defaults to student date of birth (YYYY-MM-DD). Student is prompted to change on first login.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Parent Portal Account */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Parent Portal Account</span>
                          <span className="text-[10px] text-slate-500">Live attendance & fee payment</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableParentPortal}
                          onChange={(e) => setEnableParentPortal(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    {enableParentPortal && (
                      <div className="space-y-3 pt-3 border-t border-slate-200/80 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1">Parent Portal Username</label>
                          <input
                            type="text"
                            readOnly
                            value={formData.parentPhone || formData.fatherMobile || '10-digit Mobile'}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-900 cursor-not-allowed"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Login ID is the verified parent mobile phone number.
                          </span>
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Default Initial Password</label>
                          <input
                            type="text"
                            value={parentInitialPassword}
                            onChange={(e) => setParentInitialPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Initial standard password. Parents can reset via SMS or WhatsApp OTP.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. STICKY ACTION FOOTER BAR */}
          {/* One compact row on phones (icons + Next), full labels from the sm breakpoint up */}
          <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg p-2.5 sm:p-4 flex flex-row items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                disabled={currentStep === 1}
                onClick={goToPrevStep}
                aria-label="Previous Step"
                title="Previous Step"
                className="px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous Step</span>
              </button>

              <button
                type="button"
                onClick={() => saveDraftToStorage(formData, currentStep)}
                aria-label="Save Draft"
                className="px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Save current progress as draft in browser"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Draft</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 justify-end">
              <button
                type="button"
                onClick={handleOpenPreview}
                aria-label="Preview Dossier"
                className="px-3 sm:px-4 py-2.5 rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Preview entire dossier"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Preview Dossier</span>
              </button>

              {currentStep < 6 ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  aria-label={`Continue to ${STEP_LABELS[currentStep]?.title || 'Next Step'}`}
                  className="px-4 sm:px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  <span className="sm:hidden">Next: {STEP_LABELS[currentStep]?.title || 'Step'}</span>
                  <span className="hidden sm:inline">Continue to {STEP_LABELS[currentStep]?.title || 'Next Step'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  aria-label="Review & Complete Admission"
                  className="px-4 sm:px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="sm:hidden">Review & Submit</span>
                  <span className="hidden sm:inline">Review & Complete Admission</span>
                </button>
              )}
            </div>
          </div>
        </div>
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
  );
};
