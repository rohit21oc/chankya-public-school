import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  FileText,
  Lock,
  Loader2,
  Bus,
  Building2,
  Bed,
  LogOut,
  Calendar,
  Eye,
  Wallet,
} from 'lucide-react';
import {
  AcademicClass,
  Student,
  AttachedDocument,
  StudentStatus,
  TransportRoute,
  Hostel,
  HostelRoom,
} from '../../types';
import { api } from '../../services/api';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { fileUploadService } from '../../services/fileUploadService';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { authService } from '../../services/authService';
import { StudentFeeStructureEditor } from './StudentFeeStructureEditor';
import { EditableFeeHead, normalizeFeeHeads } from '../../utils/feeProfileEdit';
import { classSectionOptions, sectionForClass } from '../../utils/classSections';
import { useFreshClasses } from '../../hooks/useFreshClasses';

interface StudentEditModalProps {
  isOpen: boolean;
  student: Student | null;
  classes: AcademicClass[];
  onClose: () => void;
  onStudentUpdated: (updated: Student) => void;
}

export const StudentEditModal: React.FC<StudentEditModalProps> = ({
  isOpen,
  student,
  classes: classesProp,
  onClose,
  onStudentUpdated,
}) => {
  // Current classes and sections from the server (a section added in Academic Structure shows up here).
  const classes = useFreshClasses(classesProp, isOpen);
  const [previewDoc, setPreviewDoc] = useState<AttachedDocument | null>(null);
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routesList, setRoutesList] = useState<TransportRoute[]>(() => api.getRoutes());
  const [hostelsList, setHostelsList] = useState<Hostel[]>(() => api.getHostels());
  const [roomsList, setRoomsList] = useState<HostelRoom[]>(() => api.getHostelRooms());
  // Fee structure (admission step 4 heads). null = the student has no fee structure of their own.
  const [feeHeads, setFeeHeads] = useState<EditableFeeHead[] | null>(null);
  const [savedFeeHeads, setSavedFeeHeads] = useState<EditableFeeHead[]>([]);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const canEditFees = authService.hasPermission('fees.structure.manage');

  useEffect(() => {
    if (isOpen) {
      api.fetchTransport().then((data) => {
        if (Array.isArray(data.routes)) setRoutesList(data.routes);
      }).catch(() => {});

      api.syncHostel().then(() => {
        setHostelsList(api.getHostels());
        setRoomsList(api.getHostelRooms());
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (student) {
      // Split name if first/last name not explicitly stored
      const nameParts = (student.name || '').split(' ');
      const firstName = student.firstName || nameParts[0] || '';
      const lastName = student.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
      const initialFatherMobile = student.fatherMobile || student.parentPhone || '';
      const initialFatherName = student.fatherName || student.parentName || '';

      const currentRooms = api.getHostelRooms();
      const currentHostels = api.getHostels();
      const matchedRoom = currentRooms.find(
        (r) => r.id === student.hostelRoomId || r.roomNumber === student.hostelRoomId
      );
      const matchedHostel = currentHostels.find(
        (h) => h.id === student.hostelId || h.name === student.hostelName || h.id === matchedRoom?.hostelId
      );

      const isHostelReq = Boolean(student.hostelRequired && student.hostelStatus !== 'VACATED');

      setFormData({
        ...student,
        firstName,
        lastName,
        fatherName: initialFatherName,
        parentName: initialFatherName,
        fatherMobile: initialFatherMobile,
        parentPhone: initialFatherMobile,
        enrollmentDate: student.enrollmentDate || student.admissionDate || '',
        feeStartDate: student.feeStartDate || student.enrollmentDate || student.admissionDate || '',
        // Campus Hostel Residency initialization
        hostelRequired: isHostelReq,
        hostelId: student.hostelId || matchedRoom?.hostelId || matchedHostel?.id || '',
        hostelName: student.hostelName || matchedHostel?.name || matchedRoom?.hostelName || '',
        hostelFloor: student.hostelFloor ?? matchedRoom?.floor ?? 1,
        hostelRoomId: student.hostelRoomId || matchedRoom?.id || '',
        hostelBedNumber: student.hostelBedNumber || '',
        hostelStatus: student.hostelStatus || (isHostelReq ? 'ACTIVE' : 'VACATED'),
        hostelAllocationDate: student.hostelAllocationDate || student.admissionDate || new Date().toISOString().substring(0, 10),
        hostelMonthlyFee: student.hostelMonthlyFee ?? matchedRoom?.monthlyFee ?? matchedHostel?.monthlyFee ?? 0,
        messMonthlyFee: student.messMonthlyFee ?? matchedHostel?.messFee ?? 0,
        hostelWarden: student.hostelWarden || matchedHostel?.wardenName || '',
      });
      setValidationError(null);
      setIsSuccess(false);
      setSuccessNote(null);
      const saved = normalizeFeeHeads(student.feeProfile?.feeHeads);
      setSavedFeeHeads(saved);
      setFeeHeads(saved.length ? saved : null);
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const handleNameChange = (field: 'firstName' | 'middleName' | 'lastName', value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      updated.name = [updated.firstName, updated.middleName, updated.lastName].filter(Boolean).join(' ');
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const effectiveName = formData.name || [formData.firstName, formData.lastName].filter(Boolean).join(' ');
    if (!effectiveName.trim()) {
      setValidationError('Student name cannot be empty.');
      return;
    }

    const effectiveParentName = formData.fatherName?.trim() || formData.parentName?.trim() || formData.motherName?.trim() || formData.guardianName?.trim() || '';
    if (!effectiveParentName) {
      setValidationError('Parent name is required.');
      return;
    }

    const effectiveParentPhone = formData.fatherMobile?.trim() || formData.parentPhone?.trim() || formData.motherMobile?.trim() || formData.mobile?.trim() || '';
    if (!effectiveParentPhone) {
      setValidationError('Parent / Father mobile number is required.');
      return;
    }
    const cleanPhoneDigits = effectiveParentPhone.replace(/\D/g, '');
    if (cleanPhoneDigits.length < 10) {
      setValidationError('Parent / Father mobile number must be at least 10 digits.');
      return;
    }
    for (const [label, value] of [
      ['Apaar Id', formData.apaarId],
      ['Father Aadhar', formData.fatherAadhaar],
      ['Mother Aadhar', formData.motherAadhaar],
    ] as const) {
      if (value && String(value).length !== 12) {
        setValidationError(`${label} must be 12 digits (or leave it empty).`);
        return;
      }
    }

    if (!formData.enrollmentDate?.trim()) {
      setValidationError('Enrollment Date is required as it controls fee billing.');
      return;
    }

    // Roll number uniqueness check within the target class & section
    const targetClassId = formData.classId || student.classId;
    const targetSection = formData.section || student.section;
    const targetRoll = formData.rollNumber || student.rollNumber;

    const allStudents = api.getStudents();
    const isDuplicateRoll = allStudents.some(
      (s) =>
        s.id !== student.id &&
        s.classId === targetClassId &&
        s.section === targetSection &&
        s.rollNumber === targetRoll
    );

    if (isDuplicateRoll) {
      setValidationError(
        `Roll Number ${targetRoll} is already allocated to another student in ${formData.className || 'this class'} Section ${targetSection}. Please choose a unique Roll Number.`
      );
      return;
    }

    if (formData.hostelRequired && formData.hostelStatus !== 'VACATED') {
      if (!formData.hostelRoomId?.trim() || !formData.hostelBedNumber?.trim()) {
        setValidationError('Please select both a Room and Bed for Campus Hostel Residency.');
        return;
      }
      const targetRoom = roomsList.find((r) => r.id === formData.hostelRoomId || r.roomNumber === formData.hostelRoomId);
      const targetBed = targetRoom?.beds?.find((b) => String(b.bedNumber) === String(formData.hostelBedNumber));
      if (targetBed && targetBed.allocatedStudentId && targetBed.allocatedStudentId !== student.id) {
        setValidationError(
          `Bed ${formData.hostelBedNumber} in Room ${targetRoom?.roomNumber} is already occupied by ${targetBed.allocatedStudentName || 'another student'}. Please choose an available bed.`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const currentClass = classes.find((c) => c.id === targetClassId);

      const photoToSave = formData.photo || student.photo;
      const photoFileKeyToSave = formData.photoFileKey || student.photoFileKey;
      const documentsToSave = (formData.documents && formData.documents.length > 0)
        ? formData.documents
        : (student.documents || []);

      const targetStudentId = student.id || (student as any)._id || student.admissionNumber;

      // Send the fee structure only when it was changed here (the server bills newly added one-time fees).
      const feeChanged =
        canEditFees && !!feeHeads && JSON.stringify(normalizeFeeHeads(feeHeads)) !== JSON.stringify(savedFeeHeads);
      const updated = await api.updateStudentAsync(targetStudentId, {
        ...formData,
        // Unchanged: leave the stored fee structure alone (a possibly older copy in this browser is not sent).
        feeProfile: feeChanged ? ({ ...(student.feeProfile || {}), feeHeads: normalizeFeeHeads(feeHeads) } as any) : undefined,
        photo: photoToSave,
        photoFileKey: photoFileKeyToSave,
        documents: documentsToSave,
        enrollmentDate: formData.enrollmentDate,
        feeStartDate: formData.feeStartDate || formData.enrollmentDate,
        name: effectiveName,
        fatherName: formData.fatherName?.trim() || effectiveParentName,
        parentName: effectiveParentName,
        fatherMobile: effectiveParentPhone,
        parentPhone: effectiveParentPhone,
        className: currentClass ? currentClass.name : (formData.className || student.className),
      });

      if (formData.photoFileKey && formData.photoFileKey !== student.photoFileKey) {
        await fileUploadService.confirmFileAssociation(formData.photoFileKey, {
          type: 'STUDENT_PHOTO',
          id: targetStudentId,
        });
      }

      const bill = (updated as any)?.feeStructureBill;
      setSuccessNote(
        bill ? `New bill ${bill.invoiceNumber} for ₹${Number(bill.total).toLocaleString('en-IN')} created for the added fees.` : null
      );
      setIsSuccess(true);
      setTimeout(() => {
        onStudentUpdated(updated);
        onClose();
      }, bill ? 2500 : 500);
    } catch (err: any) {
      console.error('[StudentEditModal] Update error:', err);
      setValidationError(err.message || 'Failed to update student record on server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === (formData.classId || student.classId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase">Edit Record</span>
              <h3 className="text-base font-bold">Edit Student Profile: {student.name}</h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Admission No: {student.admissionNumber} • Reg: {student.registrationNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Official Number Lock Badge */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Admission Number is an official immutable identifier and cannot be modified.</span>
          </div>
          <span className="font-mono font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-300">
            Adm: {student.admissionNumber}
          </span>
        </div>

        {/* Validation / Success Banner */}
        {validationError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-800 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {isSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Student profile successfully updated!{successNote ? ` ${successNote}` : ''}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Personal Particulars & Photo */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 mb-3 border-b border-slate-200">
              1. Personal Particulars & Photo
            </h4>

            {/* Student Photo Upload */}
            <div className="mb-4 bg-white p-3.5 rounded-lg border border-slate-200">
              <FileUploadComponent
                uploadType="student-photo"
                label="Update Student Photograph"
                hint="Upload a new photo to replace current avatar (JPG, PNG, or WEBP, max 5MB)."
                currentValue={formData.photo}
                currentFileKey={formData.photoFileKey}
                onUploadComplete={(res) => {
                  setFormData((prev) => ({
                    ...prev,
                    photo: res.fileKey,
                    photoFileKey: res.fileKey,
                  }));
                }}
                onRemove={() => {
                  setFormData((prev) => ({
                    ...prev,
                    photo: '',
                    photoFileKey: '',
                  }));
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName || ''}
                  onChange={(e) => handleNameChange('firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Middle Name</label>
                <input
                  type="text"
                  value={formData.middleName || ''}
                  onChange={(e) => handleNameChange('middleName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.lastName || ''}
                  onChange={(e) => handleNameChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={formData.dob || ''}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gender *</label>
                <select
                  value={formData.gender || 'MALE'}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Blood Group</label>
                <select
                  value={formData.bloodGroup || 'B+'}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
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
                <label className="block font-semibold text-slate-700 mb-1">Aadhaar / National ID</label>
                <input
                  type="text"
                  maxLength={14}
                  value={formData.aadhaarNumber || ''}
                  onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Apaar Id</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="12 digits"
                  value={formData.apaarId || ''}
                  onChange={(e) => setFormData({ ...formData, apaarId: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category || 'GENERAL'}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="GENERAL">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="EWS">EWS</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Religion</label>
                <input
                  type="text"
                  value={formData.religion || ''}
                  onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Academic Allocation & Status */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 mb-3 border-b border-slate-200">
              2. Academic Allocation & Status
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Class</label>
                <select
                  value={formData.classId || ''}
                  onChange={(e) => {
                    const sel = classes.find((c) => c.id === e.target.value);
                    setFormData({
                      ...formData,
                      classId: e.target.value,
                      className: sel ? sel.name : formData.className,
                      section: sectionForClass(sel, formData.section),
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Section</label>
                <select
                  value={formData.section || 'A'}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  {(classSectionOptions(selectedClass).length ? classSectionOptions(selectedClass) : [formData.section || 'A']).map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Session</label>
                <select
                  value={formData.academicSession || api.getActiveAcademicSession()?.name || '2026-2027'}
                  onChange={(e) => setFormData({ ...formData, academicSession: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  {api.getAcademicSessions().map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Roll Number</label>
                <input
                  type="text"
                  required
                  value={formData.rollNumber || ''}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono font-bold text-blue-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Enrollment Status</label>
                <select
                  value={formData.status || 'ACTIVE'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-semibold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="TRANSFERRED">TRANSFERRED</option>
                  <option value="WITHDRAWN">LEFT SCHOOL / WITHDRAWN</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Admission Date</label>
                <input
                  type="date"
                  value={formData.admissionDate || ''}
                  onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Enrollment Date * <span className="text-[10px] text-emerald-700 font-bold">(Controls Fee)</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.enrollmentDate || formData.admissionDate || ''}
                  onChange={(e) => {
                    const newD = e.target.value;
                    setFormData({
                      ...formData,
                      enrollmentDate: newD,
                      feeStartDate: newD, // Fee Start Date = Enrollment Date automatically
                    });
                  }}
                  className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/20 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-hidden font-semibold"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Monthly fee billing starts from this date.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Fee Start Date <span className="text-[10px] text-blue-700 font-semibold">(Auto)</span>
                </label>
                <input
                  type="date"
                  readOnly
                  value={formData.feeStartDate || formData.enrollmentDate || formData.admissionDate || ''}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
                />
                <span className="text-[10px] text-blue-600 block mt-0.5">
                  Synchronized with Enrollment Date.
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Parent Information */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 mb-3 border-b border-slate-200">
              3. Parent & Guardian Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Father's Name</label>
                <input
                  type="text"
                  value={formData.fatherName || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, fatherName: val, parentName: val || formData.parentName });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Father's Mobile <span className="text-purple-700 font-bold text-[11px]">(Parent Portal Login ID)</span>
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={formData.fatherMobile || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, fatherMobile: val, parentPhone: val });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-hidden font-mono font-semibold"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Used as the Login ID in the Parent Portal.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parent Occupation</label>
                <input
                  type="text"
                  value={formData.parentOccupation || ''}
                  onChange={(e) => setFormData({ ...formData, parentOccupation: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mother's Name</label>
                <input
                  type="text"
                  value={formData.motherName || ''}
                  onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mother's Mobile</label>
                <input
                  type="tel"
                  value={formData.motherMobile || ''}
                  onChange={(e) => setFormData({ ...formData, motherMobile: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Father Aadhar</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="12 digits"
                  value={formData.fatherAadhaar || ''}
                  onChange={(e) => setFormData({ ...formData, fatherAadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mother Aadhar</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="12 digits"
                  value={formData.motherAadhaar || ''}
                  onChange={(e) => setFormData({ ...formData, motherAadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parent Email</label>
                <input
                  type="email"
                  value={formData.parentEmail || ''}
                  onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIN Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.pincode || ''}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emergency Phone</label>
                <input
                  type="tel"
                  value={formData.emergencyContact || ''}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Attached Verification Documents */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 mb-3 border-b border-slate-200">
              4. Attached Verification Documents
            </h4>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200">
              <FileUploadComponent
                uploadType="student-document"
                label="Upload Additional Document"
                hint="Store birth certificates, transfer certificates, or medical documents securely in school records."
                onUploadComplete={(res) => {
                  const newDoc: AttachedDocument = {
                    id: `doc-${Date.now()}`,
                    title: res.originalFileName || 'Verification Document',
                    fileKey: res.fileKey,
                    originalFileName: res.originalFileName,
                    contentType: res.contentType,
                    fileSize: res.fileSize,
                    uploadedAt: res.uploadedAt,
                  };
                  setFormData((prev) => ({
                    ...prev,
                    documents: [...(prev.documents || []), newDoc],
                  }));
                }}
              />

              {(formData.documents || []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-700">Existing Uploaded Files:</span>
                  {formData.documents?.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-slate-800">{doc.originalFileName || doc.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 text-xs font-semibold px-2 py-0.5 rounded hover:bg-blue-50"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            documents: prev.documents?.filter((_, i) => i !== idx),
                          }));
                        }}
                        className="text-red-600 hover:text-red-700 text-xs font-semibold px-2 py-0.5 rounded hover:bg-red-50"
                      >
                        Remove
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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

          {/* Section 5: Campus Transport & Bus Fleet Allocation */}
          {(() => {
            const transportRoutes = (routesList.length > 0 ? routesList : api.getRoutes()).filter((r) => (r.status || 'ACTIVE') === 'ACTIVE');
            const selectedRoute = transportRoutes.find((r) => r.id === formData.transportRouteId) || transportRoutes[0];
            const availableStops = (selectedRoute?.stops || []).filter((s) => s.status !== 'INACTIVE' && s.active !== false);

            return (
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Bus className="w-4 h-4 text-amber-600" />
                    <span>5. Campus Transport Allocation</span>
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.transportRequired}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (!checked) {
                          setFormData((prev) => ({
                            ...prev,
                            transportRequired: false,
                            transportRouteId: '',
                            transportStopName: '',
                            transportStopId: '',
                            transportMonthlyFee: 0,
                            vehicleNumber: '',
                            driverName: '',
                            driverContact: '',
                          }));
                        } else {
                          const defaultRoute = selectedRoute || transportRoutes[0];
                          const stops = (defaultRoute?.stops || []).filter((s) => s.status !== 'INACTIVE' && s.active !== false);
                          const defaultStop = stops[0];
                          const fare = Number(defaultStop?.monthlyFare ?? defaultStop?.fare ?? defaultStop?.fee ?? 0);
                          setFormData((prev) => ({
                            ...prev,
                            transportRequired: true,
                            transportRouteId: defaultRoute?.id || '',
                            transportStopName: defaultStop?.stopName || '',
                            transportStopId: defaultStop?.id || '',
                            transportMonthlyFee: fare,
                            vehicleNumber: defaultRoute?.vehicleNumber || '',
                            driverName: defaultRoute?.driverName || '',
                            driverContact: defaultRoute?.driverPhone || '',
                          }));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                    />
                    <span className="ml-2 text-xs font-bold text-slate-700">
                      {formData.transportRequired ? 'Opted In' : 'Not Opted In'}
                    </span>
                  </label>
                </div>

                {formData.transportRequired ? (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Transit Route</label>
                        <select
                          value={formData.transportRouteId || selectedRoute?.id || ''}
                          onChange={(e) => {
                            const route = transportRoutes.find((r) => r.id === e.target.value);
                            const stops = (route?.stops || []).filter((s) => s.status !== 'INACTIVE' && s.active !== false);
                            const firstStop = stops[0];
                            const fare = Number(firstStop?.monthlyFare ?? firstStop?.fare ?? firstStop?.fee ?? 0);
                            setFormData((prev) => ({
                              ...prev,
                              transportRouteId: route?.id || '',
                              transportStopName: firstStop?.stopName || '',
                              transportStopId: firstStop?.id || '',
                              transportMonthlyFee: fare,
                              vehicleNumber: route?.vehicleNumber || '',
                              driverName: route?.driverName || '',
                              driverContact: route?.driverPhone || '',
                            }));
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium bg-white"
                        >
                          {transportRoutes.length === 0 ? (
                            <option value="">No active routes available</option>
                          ) : (
                            transportRoutes.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.routeName || r.name} {r.vehicleNumber ? `(${r.vehicleNumber})` : ''}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Designated Bus Stop</label>
                        <select
                          value={formData.transportStopId || formData.transportStopName || ''}
                          onChange={(e) => {
                            const stop = availableStops.find((s) => s.id === e.target.value || s.stopName === e.target.value);
                            const fare = Number(stop?.monthlyFare ?? stop?.fare ?? stop?.fee ?? 0);
                            setFormData((prev) => ({
                              ...prev,
                              transportStopName: stop?.stopName || '',
                              transportStopId: stop?.id || '',
                              transportMonthlyFee: fare,
                              vehicleNumber: selectedRoute?.vehicleNumber || '',
                              driverName: selectedRoute?.driverName || '',
                              driverContact: selectedRoute?.driverPhone || '',
                            }));
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium bg-white"
                        >
                          {availableStops.length === 0 ? (
                            <option value="">No stops configured for this route</option>
                          ) : (
                            availableStops.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.stopName} (Pickup: {s.pickupTime}, Drop: {s.dropTime}) — ₹{s.monthlyFare || s.fare || s.fee}/mo
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-amber-50/60 rounded-lg border border-amber-200 text-slate-700">
                      <div className="flex items-center gap-2">
                        <span>Assigned Bus: <strong className="font-mono text-slate-900">{formData.vehicleNumber || selectedRoute?.vehicleNumber || 'Unassigned'}</strong></span>
                        <span>•</span>
                        <span>Driver: <strong className="text-slate-900">{formData.driverName || selectedRoute?.driverName || 'Not Set'} ({formData.driverContact || selectedRoute?.driverPhone || 'N/A'})</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600 font-medium">Monthly Fare:</span>
                        <strong className="text-emerald-800 font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                          ₹{Number(formData.transportMonthlyFee || 0).toLocaleString('en-IN')} / mo
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-xs">
                    Student uses private / personal conveyance (Day Scholar).
                  </p>
                )}
              </div>
            );
          })()}

          {/* Section 6: Campus Hostel Residency */}
          {(() => {
            const activeHostels = hostelsList.filter((h) => h.status !== 'INACTIVE');
            const availableHostels = activeHostels.length > 0 ? activeHostels : hostelsList;

            // Determine currently selected hostel
            const selectedHostelId = formData.hostelId || availableHostels[0]?.id || '';
            const selectedHostel = availableHostels.find((h) => h.id === selectedHostelId) || availableHostels[0];

            // Rooms belonging to this hostel
            const hostelRooms = roomsList.filter((r) => r.hostelId === selectedHostel?.id);

            // Floors in this hostel
            const availableFloors = Array.from(
              new Set([...(selectedHostel?.floors || []), ...hostelRooms.map((r) => r.floor)])
            )
              .filter((f) => !isNaN(f) && f > 0)
              .sort((a, b) => a - b);
            const effectiveFloors = availableFloors.length > 0 ? availableFloors : [1];

            const currentFloor = formData.hostelFloor !== undefined && formData.hostelFloor !== null && !isNaN(Number(formData.hostelFloor))
              ? Number(formData.hostelFloor)
              : effectiveFloors[0];

            // Rooms on current floor
            const floorRooms = hostelRooms.filter((r) => Number(r.floor) === Number(currentFloor));
            const displayRooms = floorRooms.length > 0 ? floorRooms : hostelRooms;

            // Selected room
            const selectedRoomId = formData.hostelRoomId || displayRooms[0]?.id || '';
            const selectedRoom = displayRooms.find(
              (r) => r.id === selectedRoomId || r.roomNumber === selectedRoomId
            ) || hostelRooms.find((r) => r.id === selectedRoomId || r.roomNumber === selectedRoomId) || displayRooms[0];

            // Beds in selected room
            const roomBeds = selectedRoom?.beds || [];

            const roomRent = Number(formData.hostelMonthlyFee ?? selectedRoom?.monthlyFee ?? selectedHostel?.monthlyFee ?? 0);
            const messRent = Number(formData.messMonthlyFee ?? selectedHostel?.messFee ?? 0);
            const totalMonthlyBoarding = roomRent + messRent;

            // Handlers
            const handleHostelChange = (newHId: string) => {
              const nh = availableHostels.find((h) => h.id === newHId);
              if (!nh) return;
              const nhRooms = roomsList.filter((r) => r.hostelId === nh.id);
              const nhFloors = Array.from(new Set([...(nh.floors || []), ...nhRooms.map((r) => r.floor)]))
                .filter((f) => !isNaN(f) && f > 0)
                .sort((a, b) => a - b);
              const firstFloor = nhFloors[0] || 1;
              const firstFloorRooms = nhRooms.filter((r) => Number(r.floor) === Number(firstFloor));
              const firstRoom = firstFloorRooms[0] || nhRooms[0];
              const firstBed = (firstRoom?.beds || []).find(
                (b) => !b.allocatedStudentId || b.allocatedStudentId === student.id
              );

              setFormData((prev) => ({
                ...prev,
                hostelId: nh.id,
                hostelName: nh.name,
                hostelFloor: firstFloor,
                hostelRoomId: firstRoom?.id || '',
                hostelBedNumber: firstBed?.bedNumber || (firstRoom?.beds?.[0]?.bedNumber || 'Bed A'),
                hostelMonthlyFee: firstRoom?.monthlyFee ?? nh.monthlyFee ?? 0,
                messMonthlyFee: nh.messFee ?? 0,
                hostelWarden: nh.wardenName || '',
              }));
            };

            const handleFloorChange = (newFNum: number) => {
              const fRooms = hostelRooms.filter((r) => Number(r.floor) === Number(newFNum));
              const firstRoom = fRooms[0] || hostelRooms[0];
              const firstBed = (firstRoom?.beds || []).find(
                (b) => !b.allocatedStudentId || b.allocatedStudentId === student.id
              );

              setFormData((prev) => ({
                ...prev,
                hostelFloor: newFNum,
                hostelRoomId: firstRoom?.id || '',
                hostelBedNumber: firstBed?.bedNumber || (firstRoom?.beds?.[0]?.bedNumber || 'Bed A'),
                hostelMonthlyFee: firstRoom?.monthlyFee ?? prev.hostelMonthlyFee,
              }));
            };

            const handleRoomChange = (newRId: string) => {
              const nr = hostelRooms.find((r) => r.id === newRId || r.roomNumber === newRId);
              if (!nr) return;
              const firstBed = (nr.beds || []).find(
                (b) => !b.allocatedStudentId || b.allocatedStudentId === student.id
              );

              setFormData((prev) => ({
                ...prev,
                hostelRoomId: nr.id,
                hostelFloor: nr.floor,
                hostelBedNumber: firstBed?.bedNumber || (nr.beds?.[0]?.bedNumber || 'Bed A'),
                hostelMonthlyFee: nr.monthlyFee ?? prev.hostelMonthlyFee,
              }));
            };

            const isCurrentlyOccupied = Boolean(student.hostelRequired && student.hostelBedNumber && student.hostelStatus !== 'VACATED');

            return (
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-3 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>6. Campus Hostel Residency</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!(formData.hostelRequired && formData.hostelStatus !== 'VACATED')}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked) {
                            setFormData((prev) => ({
                              ...prev,
                              hostelRequired: false,
                              hostelStatus: 'VACATED',
                            }));
                          } else {
                            const defaultH = selectedHostel || availableHostels[0];
                            const defaultHRooms = roomsList.filter((r) => r.hostelId === defaultH?.id);
                            const defaultRoom = defaultHRooms[0];
                            const defaultBed = (defaultRoom?.beds || []).find(
                              (b) => !b.allocatedStudentId || b.allocatedStudentId === student.id
                            );

                            setFormData((prev) => ({
                              ...prev,
                              hostelRequired: true,
                              hostelStatus: 'ACTIVE',
                              hostelId: prev.hostelId || defaultH?.id || '',
                              hostelName: prev.hostelName || defaultH?.name || '',
                              hostelFloor: prev.hostelFloor ?? defaultRoom?.floor ?? 1,
                              hostelRoomId: prev.hostelRoomId || defaultRoom?.id || '',
                              hostelBedNumber: prev.hostelBedNumber || defaultBed?.bedNumber || 'Bed A',
                              hostelMonthlyFee: prev.hostelMonthlyFee ?? defaultRoom?.monthlyFee ?? defaultH?.monthlyFee ?? 0,
                              messMonthlyFee: prev.messMonthlyFee ?? defaultH?.messFee ?? 0,
                              hostelWarden: prev.hostelWarden || defaultH?.wardenName || '',
                              hostelAllocationDate: prev.hostelAllocationDate || new Date().toISOString().substring(0, 10),
                            }));
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                      />
                      <span className="ml-2 text-xs font-bold text-slate-700">
                        {formData.hostelRequired && formData.hostelStatus !== 'VACATED' ? 'Hostel Resident' : 'Day Scholar'}
                      </span>
                    </label>
                  </div>
                </div>

                {formData.hostelRequired && formData.hostelStatus !== 'VACATED' ? (
                  <div className="space-y-4 text-xs">
                    {/* Primary Selection Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {/* 1. Hostel Wing */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Hostel Wing *</label>
                        <select
                          value={selectedHostel?.id || ''}
                          onChange={(e) => handleHostelChange(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-hidden font-medium bg-white"
                        >
                          {availableHostels.length === 0 ? (
                            <option value="">No hostels configured</option>
                          ) : (
                            availableHostels.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name} ({h.type})
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* 2. Floor */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Floor *</label>
                        <select
                          value={currentFloor}
                          onChange={(e) => handleFloorChange(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-hidden font-medium bg-white"
                        >
                          {effectiveFloors.map((fl) => (
                            <option key={fl} value={fl}>
                              Floor {fl}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Room */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Room Number *</label>
                        <select
                          value={selectedRoom?.id || ''}
                          onChange={(e) => handleRoomChange(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-hidden font-medium bg-white"
                        >
                          {displayRooms.length === 0 ? (
                            <option value="">No rooms on this floor</option>
                          ) : (
                            displayRooms.map((r) => {
                              const freeBeds = (r.beds || []).filter(
                                (b) => !b.allocatedStudentId || b.allocatedStudentId === student.id
                              ).length;
                              return (
                                <option key={r.id} value={r.id}>
                                  Room {r.roomNumber} ({freeBeds} free beds • ₹{r.monthlyFee || selectedHostel?.monthlyFee || 0}/mo)
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>

                      {/* 4. Bed Identifier */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Bed Identifier *</label>
                        <select
                          value={formData.hostelBedNumber || ''}
                          onChange={(e) => setFormData({ ...formData, hostelBedNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-hidden font-mono font-medium bg-white"
                        >
                          {roomBeds.length === 0 ? (
                            <option value="">No beds configured</option>
                          ) : (
                            roomBeds.map((b) => {
                              const isOwnBed = (student.hostelRoomId === selectedRoom?.id && String(b.bedNumber) === String(student.hostelBedNumber)) || b.allocatedStudentId === student.id;
                              const isOccupiedByOther = Boolean(b.allocatedStudentId && b.allocatedStudentId !== student.id);
                              const isMaintenance = b.status === 'MAINTENANCE' || b.status === 'INACTIVE';
                              const isDisabled = isOccupiedByOther || isMaintenance;

                              return (
                                <option
                                  key={b.bedNumber}
                                  value={b.bedNumber}
                                  disabled={isDisabled && !isOwnBed}
                                >
                                  {isOwnBed
                                    ? `${b.bedNumber} ★ (Currently Assigned to Student)`
                                    : isOccupiedByOther
                                    ? `${b.bedNumber} (Occupied by ${b.allocatedStudentName || 'Student'} - Adm: ${b.allocatedAdmissionNo || '—'})`
                                    : isMaintenance
                                    ? `${b.bedNumber} (${b.status || 'Maintenance'} - Unavailable)`
                                    : `${b.bedNumber} (Available)`}
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Secondary Row: Status, Date, Warden */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Hostel Status</label>
                        <select
                          value={formData.hostelStatus || 'ACTIVE'}
                          onChange={(e) => {
                            const val = e.target.value as 'ACTIVE' | 'VACATED';
                            setFormData({
                              ...formData,
                              hostelStatus: val,
                              hostelRequired: val === 'ACTIVE',
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-hidden font-medium bg-white"
                        >
                          <option value="ACTIVE">ACTIVE (Residing in Campus)</option>
                          <option value="VACATED">VACATED (Left / Former Resident)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Allocation Date</label>
                        <input
                          type="date"
                          value={formData.hostelAllocationDate || ''}
                          onChange={(e) => setFormData({ ...formData, hostelAllocationDate: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-hidden font-medium bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Chief Warden In-Charge</label>
                        <input
                          type="text"
                          value={formData.hostelWarden || selectedHostel?.wardenName || ''}
                          onChange={(e) => setFormData({ ...formData, hostelWarden: e.target.value })}
                          placeholder="Warden Name"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-hidden font-medium bg-white"
                        />
                      </div>
                    </div>

                    {/* Financial & Rent Breakdown */}
                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                          <span>Monthly Boarding & Residency Charges</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-indigo-700 font-medium">Total Monthly:</span>
                          <strong className="text-indigo-900 font-mono font-bold bg-white px-2.5 py-0.5 rounded-md border border-indigo-200 text-xs">
                            ₹{Number(totalMonthlyBoarding).toLocaleString('en-IN')} / mo
                          </strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                        <div>
                          <label className="block text-indigo-900 font-medium mb-1">Room Rent Fee (₹ / month)</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.hostelMonthlyFee ?? roomRent}
                            onChange={(e) => setFormData({ ...formData, hostelMonthlyFee: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-indigo-900 font-medium mb-1">Mess & Dining Fee (₹ / month)</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.messMonthlyFee ?? messRent}
                            onChange={(e) => setFormData({ ...formData, messMonthlyFee: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Vacate Bed Action Button */}
                    {isCurrentlyOccupied && (
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
                        <div className="text-[11px] text-slate-500">
                          Currently Occupied: <strong className="text-slate-800">{student.hostelName || selectedHostel?.name}</strong> • Floor {student.hostelFloor || currentFloor} • Room {selectedRoom?.roomNumber || student.hostelRoomId} • Bed <strong className="font-mono text-indigo-900">{student.hostelBedNumber}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              hostelRequired: false,
                              hostelStatus: 'VACATED',
                            }));
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5 text-red-600" />
                          <span>Vacate Current Bed</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="text-slate-700 font-medium">
                        Student resides at home / personal conveyance (Day Scholar).
                      </p>
                      {student.hostelBedNumber && (
                        <p className="text-amber-700 text-[11px] mt-0.5">
                          Notice: Previously occupied Bed {student.hostelBedNumber} in Room {student.hostelRoomId} will be released back to available inventory upon save.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultH = selectedHostel || availableHostels[0];
                        const defaultHRooms = roomsList.filter((r) => r.hostelId === defaultH?.id);
                        const defaultRoom = defaultHRooms[0];
                        const defaultBed = (defaultRoom?.beds || []).find(
                          (b) => !b.allocatedStudentId || b.allocatedStudentId === student.id
                        );

                        setFormData((prev) => ({
                          ...prev,
                          hostelRequired: true,
                          hostelStatus: 'ACTIVE',
                          hostelId: defaultH?.id || '',
                          hostelName: defaultH?.name || '',
                          hostelFloor: defaultRoom?.floor || 1,
                          hostelRoomId: defaultRoom?.id || '',
                          hostelBedNumber: defaultBed?.bedNumber || 'Bed A',
                          hostelMonthlyFee: defaultRoom?.monthlyFee ?? defaultH?.monthlyFee ?? 0,
                          messMonthlyFee: defaultH?.messFee ?? 0,
                          hostelWarden: defaultH?.wardenName || '',
                          hostelAllocationDate: prev.hostelAllocationDate || new Date().toISOString().substring(0, 10),
                        }));
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs transition-colors"
                    >
                      <Bed className="w-3.5 h-3.5" />
                      <span>Allocate Campus Hostel Bed</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Section 7: Fee structure (same heads as admission step 4) */}
          {canEditFees && (
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <div className="pb-2 mb-3 border-b border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>7. Fee Structure</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  The fees this student pays, as chosen at admission. Switch a fee on or off, change its amount for this student, or add a custom fee.
                </p>
              </div>
              <StudentFeeStructureEditor
                heads={feeHeads}
                savedHeads={savedFeeHeads}
                onChange={setFeeHeads}
                classConfig={api.getEffectiveFeeConfig(
                  formData.classId || student.classId,
                  formData.section || student.section,
                  student.academicSession || api.getSettings().currentAcademicSession || '2026-2027',
                  (formData as any).category || (student as any).category
                )}
                facility={{
                  transportRequired: formData.transportRequired,
                  transportMonthlyFee: formData.transportMonthlyFee,
                  hostelRequired: formData.hostelRequired,
                  hostelStatus: formData.hostelStatus,
                  hostelMonthlyFee: formData.hostelMonthlyFee,
                  messMonthlyFee: formData.messMonthlyFee,
                }}
              />
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Student Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
