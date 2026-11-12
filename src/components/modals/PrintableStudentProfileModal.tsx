import React from 'react';
import { Download, Printer, X, ShieldCheck, Award, FileText, UserCheck, Phone, Mail, MapPin, Calendar, HeartPulse, GraduationCap } from 'lucide-react';
import { SchoolSettings, Student } from '../../types';
import { fileUploadService } from '../../services/fileUploadService';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity } from '../../utils/schoolIdentity';

interface PrintableStudentProfileModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
}

export const PrintableStudentProfileModal: React.FC<PrintableStudentProfileModalProps> = ({
  student,
  isOpen,
  onClose,
  settings,
}) => {
  if (!isOpen || !student) return null;

  const handlePrint = () => {
    window.print();
  };

  const calculateAge = (dobString: string): string => {
    if (!dobString) return 'N/A';
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return 'N/A';
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    const years = Math.abs(ageDt.getUTCFullYear() - 1970);
    return `${years} Years`;
  };

  return (
    <div
      id="printable-student-profile-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto backdrop-blur-xs"
    >
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[92vh] flex flex-col">
        {/* Modal Controls Bar (Hidden in Print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-lg text-blue-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Student 360° Profile Dossier (A4 Printable)</h3>
              <p className="text-xs text-slate-400">
                Official institutional record for {student.name} • Adm: {student.admissionNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-50 print:p-0 print:bg-white text-slate-900">
          <div className="max-w-[210mm] mx-auto bg-white p-8 sm:p-10 border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-4 rounded-xl print:rounded-none">
            {/* School Header */}
            <div className="border-b-2 border-slate-900 pb-5 mb-6 text-center">
              <div className="flex items-center justify-center gap-4 mb-2">
                {getSchoolLogoSrc(settings.schoolLogo) ? (
                  <img
                    src={getSchoolLogoSrc(settings.schoolLogo)}
                    alt={settings.schoolName}
                    className="w-16 h-16 object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                    onError={handleLogoError}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-blue-900 text-amber-300 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-8 h-8 text-amber-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase font-serif">
                    {settings.schoolName || 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE'}
                  </h1>
                  <p className="text-xs font-medium text-slate-700">
                    {settings.schoolAddress || NOT_CONFIGURED}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Affiliation Code: <strong>{settings.affiliationCode || settings.affiliationNumber || NOT_CONFIGURED}</strong> • Contact: {settings.contactNumber || NOT_CONFIGURED} • Session: {student.academicSession || settings.currentAcademicSession}
                  </p>
                </div>
              </div>
              <div className="inline-block mt-2 px-4 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-bold uppercase tracking-wider text-slate-800">
                OFFICIAL STUDENT 360° PROFILE RECORD / ADMISSION DOSSIER
              </div>
            </div>

            {/* Student Header Summary Box */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 mb-6 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
              <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-lg bg-slate-200 border-2 border-slate-400 overflow-hidden shrink-0 flex items-center justify-center">
                {student.photo && fileUploadService.getFileUrl(student.photo) ? (
                  <img
                    src={fileUploadService.getFileUrl(student.photo)}
                    alt={student.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-3xl font-bold text-slate-400">{student.name.charAt(0)}</span>
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-xl font-bold text-slate-950">{student.name}</h2>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold border border-slate-400 bg-white text-slate-800 uppercase">
                    Status: {student.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700 pt-1">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Class & Section</span>
                    <strong className="text-slate-900 font-semibold">{student.className}-{student.section}</strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Roll Number</span>
                    <strong className="text-slate-900 font-mono font-semibold">{student.rollNumber}</strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Admission No.</span>
                    <strong className="text-blue-700 font-mono font-bold">{student.admissionNumber}</strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Registration No.</span>
                    <strong className="text-slate-900 font-mono text-[11px] font-semibold">{student.registrationNumber}</strong>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 pt-1">
                  <span>Admission Date: <strong>{student.admissionDate}</strong></span>
                  <span>Academic Session: <strong>{student.academicSession}</strong></span>
                  <span>System Identifier: <strong className="font-mono text-[10px]">{student.id}</strong></span>
                </div>
              </div>
            </div>

            {/* Section 1: Personal Information */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider bg-slate-200 px-3 py-1 rounded-t border-b border-slate-300">
                1. Personal Particulars & Vital Details
              </h3>
              <table className="w-full text-xs border border-slate-300 border-t-0">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/4 p-2 bg-slate-50 font-semibold text-slate-600">Date of Birth</td>
                    <td className="w-1/4 p-2 font-medium">{student.dob} ({calculateAge(student.dob)})</td>
                    <td className="w-1/4 p-2 bg-slate-50 font-semibold text-slate-600">Gender</td>
                    <td className="w-1/4 p-2 font-medium">{student.gender}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Blood Group</td>
                    <td className="p-2 font-bold text-red-700">{student.bloodGroup || 'N/A'}</td>
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Aadhaar No. (Masked)</td>
                    <td className="p-2 font-mono">{student.aadhaarNumber ? `XXXX-XXXX-${student.aadhaarNumber.slice(-4)}` : 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Category</td>
                    <td className="p-2 font-medium">{student.category || 'GENERAL'}</td>
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Religion</td>
                    <td className="p-2 font-medium">{student.religion || 'Hindu'}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Student Contact</td>
                    <td className="p-2 font-medium">{student.mobile || student.parentPhone || 'N/A'}</td>
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Student Email</td>
                    <td className="p-2 font-medium">{student.email || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Identification Mark</td>
                    <td colSpan={3} className="p-2 text-slate-700">{student.identificationMark || 'None reported'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Parent / Guardian Information */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider bg-slate-200 px-3 py-1 rounded-t border-b border-slate-300">
                2. Parent & Guardian Particulars
              </h3>
              <table className="w-full text-xs border border-slate-300 border-t-0">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/4 p-2 bg-slate-50 font-semibold text-slate-600">Father's Name</td>
                    <td className="w-1/4 p-2 font-medium">{student.fatherName || student.parentName || 'N/A'}</td>
                    <td className="w-1/4 p-2 bg-slate-50 font-semibold text-slate-600">Father's Mobile</td>
                    <td className="w-1/4 p-2 font-mono font-medium">{student.fatherMobile || student.parentPhone || 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Father's Occupation</td>
                    <td className="p-2 font-medium">{student.fatherOccupation || student.parentOccupation || 'N/A'}</td>
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Father's Email</td>
                    <td className="p-2 font-medium">{student.fatherEmail || student.parentEmail || 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Mother's Name</td>
                    <td className="p-2 font-medium">{student.motherName || 'N/A'}</td>
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Mother's Mobile</td>
                    <td className="p-2 font-mono font-medium">{student.motherMobile || 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Mother's Occupation</td>
                    <td className="p-2 font-medium">{student.motherOccupation || 'Homemaker / Professional'}</td>
                    <td className="p-2 bg-slate-50 font-semibold text-slate-600">Guardian Name (if any)</td>
                    <td className="p-2 font-medium">{student.guardianName || 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Residential Address & Emergency Contact */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider bg-slate-200 px-3 py-1 rounded-t border-b border-slate-300">
                3. Residential Address & Emergency Contacts
              </h3>
              <table className="w-full text-xs border border-slate-300 border-t-0">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/4 p-2 bg-slate-50 font-semibold text-slate-600">Residential Address</td>
                    <td colSpan={3} className="p-2 font-medium">
                      {student.address}, {student.city || 'Sheohar'}, {student.state || 'Bihar'} - {student.pincode || '843329'}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/4 p-2 bg-slate-50 font-semibold text-slate-600">Primary Emergency Contact</td>
                    <td className="w-1/4 p-2 font-medium">
                      {student.emergencyContactName || student.parentName} ({student.emergencyRelationship || 'Parent'}) - <strong className="font-mono">{student.emergencyContact || student.parentPhone}</strong>
                    </td>
                    <td className="w-1/4 p-2 bg-slate-50 font-semibold text-slate-600">Secondary Contact</td>
                    <td className="w-1/4 p-2 font-medium">
                      {student.secondaryEmergencyName || 'Secondary'}: <span className="font-mono">{student.secondaryEmergencyContact || 'N/A'}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 4: Academic History & Medical Record */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider bg-slate-200 px-3 py-1 rounded-t border-b border-slate-300">
                  4. Academic Background
                </h3>
                <div className="border border-slate-300 border-t-0 p-3 text-xs space-y-1.5 bg-white">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Previous School:</span>
                    <strong className="text-slate-900">{student.previousSchool || 'Admitted directly'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Previous Class & Marks:</span>
                    <strong className="text-slate-900">{student.previousClass || 'Class 9'} ({student.previousMarks || '88.5%'})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Admission Date:</span>
                    <strong className="text-slate-900">{student.admissionDate}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Transport / Hostel:</span>
                    <strong className="text-slate-900">
                      {student.transportRequired ? `Bus Route (${student.transportStopName || 'Assigned'})` : student.hostelRequired ? `Hostel (${student.hostelName || 'Enrolled'})` : 'Day Scholar (Self)'}
                    </strong>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider bg-slate-200 px-3 py-1 rounded-t border-b border-slate-300">
                  5. Medical Care & Emergency Protocol
                </h3>
                <div className="border border-slate-300 border-t-0 p-3 text-xs space-y-1.5 bg-white">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Allergies:</span>
                    <strong className="text-slate-900">{student.allergies || 'None reported'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Known Conditions:</span>
                    <strong className="text-slate-900">{student.medicalConditions || 'Clinically Fit'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Regular Medication:</span>
                    <strong className="text-slate-900">{student.medications || 'None'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Medical Consultant:</span>
                    <strong className="text-slate-900">{student.doctorName || 'Not provided'} ({student.doctorContact || 'Not provided'})</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Signatures & Stamp */}
            <div className="pt-8 border-t-2 border-slate-300 mt-8">
              <div className="grid grid-cols-3 gap-8 text-center text-xs">
                <div>
                  <div className="h-14 flex items-end justify-center border-b border-slate-400 pb-1">
                    <span className="text-slate-400 font-serif italic">Verified Record</span>
                  </div>
                  <p className="mt-1 font-bold text-slate-800">Class Teacher Signature</p>
                  <p className="text-[10px] text-slate-500">CHANAKYA PUBLIC SCHOOL & COACHING CENTRE</p>
                </div>

                <div>
                  <div className="h-14 flex items-end justify-center border-b border-slate-400 pb-1">
                    <div className="w-16 h-12 border border-dashed border-slate-400 rounded flex items-center justify-center text-[9px] text-slate-400 uppercase">
                      Official Seal
                    </div>
                  </div>
                  <p className="mt-1 font-bold text-slate-800">Registrar / Exam Controller</p>
                  <p className="text-[10px] text-slate-500">Student Records Section</p>
                </div>

                <div>
                  <div className="h-14 flex items-end justify-center border-b border-slate-400 pb-1">
                    <span className="font-serif italic font-bold text-slate-800">{settings.principalName || ""}</span>
                  </div>
                  <p className="mt-1 font-bold text-slate-800">Principal Signature</p>
                  <p className="text-[10px] text-slate-500">CHANAKYA PUBLIC SCHOOL & COACHING CENTRE</p>
                </div>
              </div>

              <div className="mt-6 text-center text-[10px] text-slate-400 border-t border-slate-200 pt-2">
                This document is a computer-generated Student 360° Profile record printed on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.
                {letterheadLine(schoolIdentity(settings))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
