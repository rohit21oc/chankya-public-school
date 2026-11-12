import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  User,
  Building2,
  Bus,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldCheck,
  Award,
  Sparkles,
  Lock,
  Edit3,
  Users,
  GraduationCap,
  HeartPulse,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { AttachedDocument, StudentFeeProfileData } from '../../../types';
import { fileUploadService } from '../../../services/fileUploadService';
import { api } from '../../../services/api';
import { getEnrollmentMonthLabel } from '../../../utils/feeDateHelper';

export interface AdmissionFormData {
  // Step 1: Personal
  firstName: string;
  middleName: string;
  lastName: string;
  name: string;
  photo: string;
  photoFileKey: string;
  dob: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup: string;
  aadhaarNumber: string;
  apaarId?: string;
  fatherAadhaar?: string;
  motherAadhaar?: string;
  category: 'GENERAL' | 'OBC' | 'SC' | 'ST' | 'EWS';
  religion: string;
  otherReligion: string;
  identificationMark: string;
  mobile: string;
  email: string;

  // Step 2: Parent / Guardian
  fatherName: string;
  fatherMobile: string;
  fatherOccupation: string;
  otherFatherOccupation: string;
  fatherEmail: string;
  motherName: string;
  motherMobile: string;
  motherOccupation: string;
  motherEmail: string;
  guardianName: string;
  guardianMobile: string;
  guardianRelationship: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  parentOccupation: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  emergencyContactName: string;
  emergencyContact: string;
  emergencyRelationship: string;

  // Step 3: Academic
  classId: string;
  className: string;
  section: string;
  academicSession: string;
  admissionDate: string;
  enrollmentDate: string;
  feeStartDate: string;
  portalEntryDate?: string;
  previousClassPassed: 'Yes' | 'No' | '';
  previousSchool: string;
  previousClass: string;
  previousMarks: string;

  // Step 4: Fee Structure & Facilities
  feeProfile?: StudentFeeProfileData;
  transportRequired: boolean;
  transportRouteId: string;
  transportStopName: string;
  transportStopId?: string;
  transportMonthlyFee?: number;
  vehicleNumber?: string;
  driverName?: string;
  driverContact?: string;
  hostelRequired: boolean;
  hostelId?: string;
  hostelName: string;
  hostelRoomId: string;
  hostelFloor?: number;
  hostelBedNumber: string;
  hostelWarden?: string;
  hostelMonthlyFee?: number;
  messMonthlyFee?: number;

  // Step 5: Documents
  documents: AttachedDocument[];
}

interface AdmissionPreviewPageProps {
  formData: AdmissionFormData;
  previewData: {
    admissionNumber: string;
    registrationNumber: string;
    rollNumber: string;
  };
  enableStudentPortal: boolean;
  studentInitialPassword: string;
  enableParentPortal: boolean;
  parentInitialPassword: string;
  onEdit: () => void;
  onConfirm: () => void;
}

export const AdmissionPreviewPage: React.FC<AdmissionPreviewPageProps> = ({
  formData,
  previewData,
  enableStudentPortal,
  studentInitialPassword,
  enableParentPortal,
  parentInitialPassword,
  onEdit,
  onConfirm,
}) => {
  const calculateAge = (dobString: string): string => {
    if (!dobString) return 'N/A';
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return 'N/A';
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    const years = Math.abs(ageDt.getUTCFullYear() - 1970);
    return `${years} Years`;
  };

  const effectiveFullName =
    formData.name ||
    [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ') ||
    'Unnamed Student';

  const effectiveReligion =
    formData.religion === 'Other' && formData.otherReligion.trim()
      ? formData.otherReligion.trim()
      : formData.religion || 'Not Specified';

  const effectiveFatherOccupation =
    formData.fatherOccupation === 'Other' && formData.otherFatherOccupation.trim()
      ? formData.otherFatherOccupation.trim()
      : formData.fatherOccupation || 'Not Specified';

  const effectiveParentPhone =
    formData.parentPhone || formData.fatherMobile || formData.motherMobile || formData.mobile || 'N/A';

  return (
    <div className="space-y-6 animate-fadeIn pb-4 text-slate-800">
      {/* Review Banner Notice */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide">
              Complete Admission Review & Verification
            </h4>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Please inspect all student, family, academic, and residence particulars. Nothing is saved
              until you click <strong>Confirm & Submit Admission</strong> below.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors shadow-2xs shrink-0 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Admission</span>
        </button>
      </div>

      {/* Institutional Auto-Generated Identifiers Ribbon */}
      <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-300 block">
                Official Institutional Enrollment Credentials
              </span>
              <p className="text-[11px] text-slate-400">
                Session: {formData.academicSession} • Enrolled Class: {formData.className} (Section {formData.section})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 font-mono text-xs flex-wrap">
            <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-[9px] text-slate-400 block font-sans uppercase">Admission No.</span>
              <strong className="text-blue-400 text-sm font-bold">{previewData.admissionNumber}</strong>
            </div>
            <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-[9px] text-slate-400 block font-sans uppercase">Registration Code</span>
              <strong className="text-slate-200 text-xs font-bold">{previewData.registrationNumber}</strong>
            </div>
            <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-[9px] text-slate-400 block font-sans uppercase">Class Roll</span>
              <strong className="text-emerald-400 text-xs font-bold">#{previewData.rollNumber}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Sections: Student Info & Photo Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Photo & Core Identity */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4 flex flex-col items-center text-center">
          <div className="w-32 h-36 sm:w-36 sm:h-44 rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden shadow-xs flex items-center justify-center relative p-1">
            {formData.photo || formData.photoFileKey ? (
              <img
                src={
                  formData.photo?.startsWith('blob:') || formData.photo?.startsWith('data:')
                    ? formData.photo
                    : fileUploadService.getFileUrl(formData.photo || formData.photoFileKey)
                }
                alt={effectiveFullName}
                className="w-full h-full object-cover rounded-lg"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (formData.photoFileKey && e.currentTarget.src !== fileUploadService.getFileUrl(formData.photoFileKey)) {
                    e.currentTarget.src = fileUploadService.getFileUrl(formData.photoFileKey);
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 p-2">
                <User className="w-12 h-12 stroke-[1.5] mb-1 text-slate-300" />
                <span className="text-[11px] font-semibold">No Photo Uploaded</span>
                <span className="text-[9px] text-slate-400">(Can be added later)</span>
              </div>
            )}
          </div>

          <div className="w-full space-y-1">
            <h3 className="text-base font-black text-slate-900 leading-snug">{effectiveFullName}</h3>
            <p className="text-xs font-bold text-blue-700">
              {formData.className} • Section {formData.section}
            </p>
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                {formData.gender}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                Blood: {formData.bloodGroup}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                {formData.category}
              </span>
            </div>
          </div>

          <div className="w-full border-t border-slate-200 pt-3 text-left text-xs space-y-2">
            <div className="flex justify-between py-0.5 border-b border-slate-100">
              <span className="text-slate-500">Date of Birth:</span>
              <strong className="text-slate-900">{formData.dob} ({calculateAge(formData.dob)})</strong>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100">
              <span className="text-slate-500">Religion:</span>
              <strong className="text-slate-900 font-semibold">{effectiveReligion}</strong>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100">
              <span className="text-slate-500">Aadhaar (UIDAI):</span>
              <strong className="text-slate-900 font-mono">{formData.aadhaarNumber || 'Not Provided'}</strong>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100">
              <span className="text-slate-500">Apaar Id:</span>
              <strong className="text-slate-900 font-mono">{formData.apaarId || 'Not Provided'}</strong>
            </div>
            {formData.identificationMark && (
              <div className="flex flex-col py-0.5 border-b border-slate-100">
                <span className="text-slate-500 text-[10px]">Visible Mark:</span>
                <span className="text-slate-800 italic">{formData.identificationMark}</span>
              </div>
            )}
            {formData.mobile && (
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Student Phone:</span>
                <span className="text-slate-900 font-mono">{formData.mobile}</span>
              </div>
            )}
          </div>
        </div>

        {/* Middle & Right Columns: Parent, Academic, Address Details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Section: Parent & Family Details */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wide">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Parent & Guardian Information</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Father's Full Name</span>
                <strong className="text-slate-900 text-xs sm:text-sm">{formData.fatherName || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Father's Occupation</span>
                <strong className="text-slate-900">{effectiveFatherOccupation}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Father's Mobile</span>
                <strong className="text-slate-900 font-mono">{formData.fatherMobile || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Father Aadhar</span>
                <strong className="text-slate-900 font-mono">{formData.fatherAadhaar || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Father's Email</span>
                <span className="text-slate-700">{formData.fatherEmail || 'N/A'}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mother's Full Name</span>
                <strong className="text-slate-900">{formData.motherName || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mother's Occupation</span>
                <span className="text-slate-800">{formData.motherOccupation || 'Homemaker'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mother's Mobile</span>
                <span className="text-slate-800 font-mono">{formData.motherMobile || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mother Aadhar</span>
                <span className="text-slate-800 font-mono">{formData.motherAadhaar || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Primary Parent Phone</span>
                <strong className="text-blue-900 font-mono font-bold">{effectiveParentPhone}</strong>
              </div>

              {formData.emergencyContact && (
                <div className="sm:col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Emergency Contact:</span>
                  <span className="font-semibold text-slate-800">
                    {formData.emergencyContactName || formData.fatherName} ({formData.emergencyRelationship}) •{' '}
                    <strong className="font-mono">{formData.emergencyContact}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Residence & Address Details */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wide">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Address & Residence Particulars</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-3">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Street / Road / Plot / Mohalla Address</span>
                <strong className="text-slate-900">{formData.address || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">State</span>
                <strong className="text-slate-900">{formData.state || 'Bihar'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">District / City</span>
                <strong className="text-slate-900">{formData.city || 'Sheohar'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">PIN Code</span>
                <strong className="text-slate-900 font-mono">{formData.pincode || '843329'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Academic Allocation & History */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wide">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>Academic Allocation & Prior Schooling</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Enrolled Class</span>
            <strong className="text-slate-900 text-sm">{formData.className}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Section</span>
            <strong className="text-slate-900 text-sm">Section {formData.section}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Academic Session</span>
            <strong className="text-slate-900">{formData.academicSession}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date of Admission</span>
            <strong className="text-slate-900">{formData.admissionDate}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Enrollment Date</span>
            <strong className="text-slate-900 text-emerald-800">{formData.enrollmentDate || formData.admissionDate}</strong>
            <span className="block text-[9px] text-emerald-600 font-medium">Controlling Fee Date</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Fee Start Date</span>
            <strong className="text-slate-900 text-blue-800">{formData.feeStartDate || formData.enrollmentDate || formData.admissionDate}</strong>
            <span className="block text-[9px] text-blue-600 font-medium">Billing starts here</span>
          </div>

          <div className="col-span-2 sm:col-span-4 border-t border-slate-100 pt-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-slate-500 font-semibold text-xs">Previous Class Passed:</span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  formData.previousClassPassed === 'Yes'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {formData.previousClassPassed || 'Not Specified'}
              </span>
            </div>

            {formData.previousClassPassed === 'Yes' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Previous School Name</span>
                  <strong className="text-slate-900">{formData.previousSchool || 'Direct Entry / Not Specified'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Previous Class</span>
                  <strong className="text-slate-900">{formData.previousClass || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Marks / Grade / Division</span>
                  <strong className="text-slate-900">{formData.previousMarks || 'N/A'}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logistics & Portal Credentials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* Step 4: Fee Structure & Facilities Review */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-wide">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Step 4: Fee Structure & Facilities Review</span>
            </div>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
              {formData.feeProfile?.feeHeads?.filter((h) => h.selected).length || 'Configured'} Heads Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[10px] block uppercase font-semibold">Payable at Admission</span>
              <strong className="text-blue-900 text-sm font-mono font-black">
                ₹{(
                  Number(formData.feeProfile?.totalOneTimeFee ?? 0) + Number(formData.feeProfile?.monthlyPayableAmount ?? 0)
                ).toLocaleString('en-IN')}
              </strong>
              <span className="text-slate-500 text-[10px] block">
                One-time + {getEnrollmentMonthLabel(formData.feeStartDate || formData.enrollmentDate || formData.admissionDate) || 'first month'} fee
              </span>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[10px] block uppercase font-semibold">Monthly Payable</span>
              <strong className="text-emerald-700 text-sm font-mono font-black">
                ₹{Number(formData.feeProfile?.monthlyPayableAmount ?? 0).toLocaleString('en-IN')}/mo
              </strong>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-600 font-medium">School Bus Transport:</span>
              <strong className="text-slate-900">
                {formData.transportRequired
                  ? `Opted In • ${formData.transportStopName || 'Assigned Stop'}${formData.transportMonthlyFee ? ` (₹${Number(formData.transportMonthlyFee).toLocaleString('en-IN')}/mo)` : ''}${formData.vehicleNumber ? ` • Bus ${formData.vehicleNumber}` : ''}`
                  : 'Day Scholar (No Bus)'}
              </strong>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-600 font-medium">Campus Hostel Residency:</span>
              <strong className="text-slate-900">
                {formData.hostelRequired
                  ? `Opted In • ${formData.hostelName} (Room ${formData.hostelRoomId}, Bed ${formData.hostelBedNumber})`
                  : 'Day Scholar (Resides at Home)'}
              </strong>
            </div>
          </div>
        </div>

        {/* Portal Access Review */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-wide">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Step 6: Digital Portal Access Credentials Review</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Auto-Activated on Submission
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Student Credentials Preview */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                enableStudentPortal
                  ? 'bg-blue-50/50 border-blue-200 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-blue-950 uppercase tracking-wide">Student Portal Access</h5>
                    <span className="text-[10px] text-blue-700 font-medium">Self-service student desk</span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    enableStudentPortal
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {enableStudentPortal ? 'ON (ACTIVE)' : 'OFF (DISABLED)'}
                </span>
              </div>

              {enableStudentPortal ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Student Access ID (Auto-Assigned)
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold text-slate-600">Admission No:</span>
                      <strong className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {previewData.admissionNumber}
                      </strong>
                      <span className="text-slate-300">|</span>
                      <span className="text-[11px] font-bold text-slate-600">Registration No:</span>
                      <strong className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {previewData.registrationNumber}
                      </strong>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Student can log in using either their Admission Number or Registration Number.
                    </p>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Initial Student Password
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <strong className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                        {studentInitialPassword || formData.dob || 'Student DOB'}
                      </strong>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50/80 px-2 py-0.5 rounded">
                        Student DOB
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Student logs in with their Date of Birth (DOB) as the initial authentication key.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500 italic">
                  Student portal is disabled. Student login credentials will not be created.
                </div>
              )}
            </div>

            {/* Parent Credentials Preview */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                enableParentPortal
                  ? 'bg-purple-50/50 border-purple-200 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-purple-950 uppercase tracking-wide">Parent Portal Access</h5>
                    <span className="text-[10px] text-purple-700 font-medium">Guardian desk & fee monitoring</span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    enableParentPortal
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {enableParentPortal ? 'ON (ACTIVE)' : 'OFF (DISABLED)'}
                </span>
              </div>

              {enableParentPortal ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-purple-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Parent Access ID (Auto-Assigned)
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold text-slate-600">Registered Mobile:</span>
                      <strong className="font-mono text-xs font-black text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {effectiveParentPhone}
                      </strong>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Parent logs in using this registered 10-digit guardian mobile number.
                    </p>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-purple-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Initial Parent Password
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <strong className="font-mono text-xs font-black text-purple-900 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
                        {parentInitialPassword || 'PDS123'}
                      </strong>
                      <span className="text-[10px] text-purple-700 font-semibold bg-purple-50/80 px-2 py-0.5 rounded">
                        Default Password
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Initial parent master password is PDS123. Parents may also sign in using their child&apos;s DOB.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500 italic">
                  Parent portal is disabled. Parent access will not be activated.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Admission Fee & Ledger Schedule */}
      {(() => {
        const profile = formData.feeProfile;
        const admFee = profile ? profile.totalOneTimeFee : 0;
        const monthlyPayable = profile ? profile.monthlyPayableAmount : 0;
        const yearlyPayable = profile ? profile.totalYearlyFee : 0;
        const totalAnnual = profile ? profile.totalApplicableFee : (admFee + monthlyPayable * 12 + yearlyPayable);

        return (
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-wide">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Student Fee Structure & Ledger Schedule</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Class: {formData.className} • Section {formData.section || 'A'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">1-Time Admission Dues</span>
                <strong className="text-blue-900 text-sm font-mono font-black">₹{(admFee || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Regular Monthly Payable</span>
                <strong className="text-emerald-700 text-sm font-mono font-black">₹{(monthlyPayable || 0).toLocaleString('en-IN')}/mo</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-purple-700 block text-[10px] uppercase font-semibold">Annual / Exam Charges</span>
                <strong className="text-purple-900 text-sm font-mono font-black">₹{(yearlyPayable || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Annual Commitment</span>
                <strong className="text-slate-950 text-sm font-mono font-black">
                  ₹{(totalAnnual || 0).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-slate-600">
                Payable at Admission Desk (Initial Registration + Kit):
              </span>
              <strong className="text-base font-black text-blue-900 font-mono">
                ₹{(admFee || 0).toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        );
      })()}

      {/* Uploaded Documents List */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-wide">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Verification Documents ({formData.documents.length})</span>
          </div>
          <span className="text-[11px] text-slate-500">Verified Files</span>
        </div>

        {formData.documents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {formData.documents.map((doc, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-slate-900 block truncate">{doc.originalFileName}</span>
                    <span className="text-[10px] text-slate-500">{(doc.fileSize / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0 ml-2">
                  Pending Review
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic text-center py-2 text-xs">
            No secondary documents attached yet. Documents can also be uploaded anytime later from the student profile.
          </p>
        )}
      </div>

      {/* Action Footer: Edit Admission & Confirm & Submit Admission */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="px-4 sm:px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>← Edit Admission</span>
        </button>

        <button
          type="button"
          onClick={onConfirm}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>✓ Save & Submit Admission</span>
        </button>
      </div>
    </div>
  );
};
