import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Building2,
  Bus,
  Calendar,
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  File,
  FileCheck,
  FileText,
  History,
  KeyRound,
  Lock,
  Printer,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  User,
  Users,
  X,
  LogOut,
  Bed,
} from 'lucide-react';
import { AttachedDocument, Student, StudentStatus, CertificateType, Holiday, Exam, ExamMark } from '../../types';
import { api } from '../../services/api';
import { calculateGradeFromMarks } from '../../utils/grading';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { fileUploadService } from '../../services/fileUploadService';
import { AttendanceCalendar } from '../common/AttendanceCalendar';
import { PrintableAdmitCardModal } from './PrintableAdmitCardModal';
import { PrintableReportCardModal } from './PrintableReportCardModal';

interface StudentProfileModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Student) => void;
  onEdit?: (student: Student) => void;
  onOpenReportCard: (student: Student) => void;
  onOpenIdCard: (student: Student) => void;
  onOpenCertificate: (student: Student, certType: CertificateType) => void;
}

type TabType =
  | 'PERSONAL'
  | 'ACADEMIC'
  | 'PARENT'
  | 'ATTENDANCE'
  | 'FEES'
  | 'EXAMS'
  | 'DOCUMENTS'
  | 'TRANSPORT_HOSTEL'
  | 'PORTAL';

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  student,
  isOpen,
  onClose,
  onUpdate,
  onEdit,
  onOpenReportCard,
  onOpenIdCard,
  onOpenCertificate,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('PERSONAL');
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);

  // Portal Credentials state
  const [studentNewPassword, setStudentNewPassword] = useState('');
  const [parentNewPassword, setParentNewPassword] = useState('');
  const [portalMsg, setPortalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResettingStudentPass, setIsResettingStudentPass] = useState(false);
  const [isResettingParentPass, setIsResettingParentPass] = useState(false);

  // Hostel management state
  const [hostelActionMsg, setHostelActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isHostelVacateOpen, setIsHostelVacateOpen] = useState(false);
  const [hostelVacateRemarks, setHostelVacateRemarks] = useState('Session completed / relocated');
  const [isHostelChangeBedOpen, setIsHostelChangeBedOpen] = useState(false);
  const [hostelChangeTargetRoomId, setHostelChangeTargetRoomId] = useState('');
  const [hostelChangeTargetBedNumber, setHostelChangeTargetBedNumber] = useState('');
  const [hostelChangeRemarks, setHostelChangeRemarks] = useState('Room reassignment');
  const [isHostelAllocateOpen, setIsHostelAllocateOpen] = useState(false);
  const [hostelAllocHostelId, setHostelAllocHostelId] = useState('');
  const [hostelAllocRoomId, setHostelAllocRoomId] = useState('');
  const [hostelAllocBedNumber, setHostelAllocBedNumber] = useState('');

  // Modals for Exam Actions
  const [selectedExamForAdmitCard, setSelectedExamForAdmitCard] = useState<Exam | null>(null);
  const [selectedExamForReportCard, setSelectedExamForReportCard] = useState<Exam | null>(null);
  const [expandedExamMarksId, setExpandedExamMarksId] = useState<string | null>(null);

  // Dynamic Exams State
  const [allExams, setAllExams] = useState<Exam[]>(() => api.getExams());
  const [allStudentMarks, setAllStudentMarks] = useState<ExamMark[]>(() =>
    (api.getExamMarks('') || []).filter((m) => m.studentId === student?.id)
  );
  const [isLoadingExams, setIsLoadingExams] = useState(false);

  useEffect(() => {
    if (!isOpen || !student?.id) return;
    setIsLoadingExams(true);
    Promise.allSettled([
      api.fetchExams({ studentId: student.id }),
      api.fetchExamMarks(undefined, student.classId),
      api.syncHostel(),
    ])
      .then(([exRes, marksRes]) => {
        if (exRes.status === 'fulfilled' && Array.isArray(exRes.value)) {
          setAllExams(exRes.value);
        }
        if (marksRes.status === 'fulfilled' && Array.isArray(marksRes.value)) {
          setAllStudentMarks(marksRes.value.filter((m) => m.studentId === student.id));
        }
      })
      .catch((err) => {
        console.warn('[StudentProfileModal] Error loading exams & marks:', err);
      })
      .finally(() => {
        setIsLoadingExams(false);
      });
  }, [isOpen, student?.id, student?.classId, student?.section]);

  const studentPublishedExams = useMemo(() => {
    if (!student) return [];
    return (allExams || []).filter((exam) => {
      const isPublished = exam.status === 'PUBLISHED' || (!exam.status && (exam as any).isPublished !== false);
      if (!isPublished) return false;

      const hasClassIds = Array.isArray(exam.classIds) && exam.classIds.length > 0;
      const classIdMatches = hasClassIds
        ? (exam.classIds.includes(student.classId) || (student.className && exam.classIds.includes(student.className)))
        : ((exam as any).classId === student.classId || (student.className && (exam as any).classId === student.className));

      const scheduleMatches =
        Array.isArray(exam.schedule) &&
        exam.schedule.some((s) => {
          const cMatch =
            !s.classId ||
            s.classId === student.classId ||
            (student.className && s.className === student.className);
          const secMatch =
            !s.section ||
            s.section === 'ALL' ||
            !student.section ||
            s.section === student.section;
          return cMatch && secMatch;
        });

      const isSchoolWide = !hasClassIds && !(exam as any).classId && (!Array.isArray(exam.schedule) || exam.schedule.length === 0);

      const sectionMatches =
        !exam.section ||
        exam.section === 'ALL' ||
        !student.section ||
        exam.section === student.section;

      return (classIdMatches || scheduleMatches || isSchoolWide) && sectionMatches;
    });
  }, [allExams, student?.classId, student?.className, student?.section]);

  if (!isOpen) return null;

  const attendanceSummary = api.getStudentAttendanceSummary(student.id);
  const studentAttendanceRecords = (api.getAttendance() || []).filter((a) => a.studentId === student.id);
  const holidays = api.getHolidays();
  const feePayments = api.getFeePayments(student.id);

  const handleStatusChange = (status: StudentStatus) => {
    const updated = api.changeStudentStatus(student.id, status);
    onUpdate(updated);
  };

  const handlePhotoUpdated = async (res: { fileKey: string; previewUrl?: string }) => {
    const updated = api.updateStudent(student.id, {
      photo: res.fileKey,
      photoFileKey: res.fileKey,
    });
    await fileUploadService.confirmFileAssociation(res.fileKey, {
      type: 'STUDENT',
      id: student.id,
    });
    onUpdate(updated);
    setIsUpdatingPhoto(false);
  };

  const handleRemovePhoto = async () => {
    if (student.photoFileKey) {
      await fileUploadService.deleteFile(student.photoFileKey);
    }
    const updated = api.updateStudent(student.id, {
      photo: '',
      photoFileKey: '',
    });
    onUpdate(updated);
  };

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
    const updated = api.addStudentDocument(student.id, newDoc);
    await fileUploadService.confirmFileAssociation(res.fileKey, {
      type: 'STUDENT',
      id: student.id,
    });
    onUpdate(updated);
  };

  const handleRemoveDocument = async (doc: AttachedDocument) => {
    if (window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
      if (doc.fileKey) {
        await fileUploadService.deleteFile(doc.fileKey);
      }
      const updated = api.removeStudentDocument(student.id, doc.id);
      onUpdate(updated);
    }
  };

  const handleDownloadDocument = async (doc: AttachedDocument) => {
    try {
      const url = await fileUploadService.getDownloadUrl(doc.fileKey);
      const win = window.open(url, '_blank');
      if (!win) {
        window.location.href = url;
      }
    } catch (err: any) {
      alert(`Could not generate download URL: ${err.message}`);
    }
  };

  const handleToggleStudentPortal = async () => {
    const nextState = student.loginEnabled === false;
    const updated = await api.updateStudentPortalStatus(student.id, { loginEnabled: nextState });
    if (updated) onUpdate(updated);
    setPortalMsg({
      type: 'success',
      text: `Student portal access has been ${nextState ? 'enabled' : 'disabled'}.`,
    });
    setTimeout(() => setPortalMsg(null), 3000);
  };

  const handleResetStudentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNewPassword.trim()) return;
    setIsResettingStudentPass(true);
    try {
      const res = await api.resetStudentPassword(student.id, studentNewPassword.trim());
      setPortalMsg({ type: 'success', text: res.message || 'Student password reset successfully.' });
      setStudentNewPassword('');
    } catch {
      setPortalMsg({ type: 'error', text: 'Failed to reset student password.' });
    } finally {
      setIsResettingStudentPass(false);
      setTimeout(() => setPortalMsg(null), 3000);
    }
  };

  const handleToggleParentPortal = async () => {
    const parentPhone = student.fatherMobile || student.parentPhone;
    if (!parentPhone) {
      alert('Student does not have a registered parent phone number.');
      return;
    }
    await api.updateParentPortalStatus(parentPhone, { loginEnabled: true });
    setPortalMsg({
      type: 'success',
      text: `Parent portal access updated for Login ID: ${parentPhone}.`,
    });
    setTimeout(() => setPortalMsg(null), 3000);
  };

  const handleResetParentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parentPhone = student.fatherMobile || student.parentPhone;
    if (!parentPhone || !parentNewPassword.trim()) return;
    setIsResettingParentPass(true);
    try {
      const res = await api.resetParentPassword(parentPhone, parentNewPassword.trim());
      setPortalMsg({ type: 'success', text: res.message || 'Parent password reset successfully.' });
      setParentNewPassword('');
    } catch {
      setPortalMsg({ type: 'error', text: 'Failed to reset parent password.' });
    } finally {
      setIsResettingParentPass(false);
      setTimeout(() => setPortalMsg(null), 3000);
    }
  };

  const handlePromote = () => {
    const currentClassNum = parseInt(student.className.replace('Class ', ''), 10) || 10;
    if (currentClassNum >= 12) {
      alert('Student is already in graduating Class 12.');
      return;
    }
    const nextClass = `Class ${currentClassNum + 1}`;
    const allClasses = api.getClasses();
    const matchedClass = allClasses.find((c) => c.name === nextClass);
    if (matchedClass) {
      const updated = api.updateStudent(student.id, {
        classId: matchedClass.id,
        className: nextClass,
        rollNumber: '1',
      });
      onUpdate(updated);
      alert(`Student successfully promoted to ${nextClass}!`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header Card */}
        <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group">
              {student.photo ? (
                <img
                  src={fileUploadService.getFileUrl(student.photo)}
                  alt={student.name}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-xl object-cover border-2 border-white/20 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold text-2xl shadow-inner">
                  {student.name.charAt(0)}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsUpdatingPhoto(!isUpdatingPhoto)}
                className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-500 text-white p-1 rounded-full shadow-md text-xs"
                title="Change Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{student.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    student.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {student.status}
                </span>
                {student.photoFileKey && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Photo saved
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>Class: <strong className="text-white">{student.className}-{student.section}</strong></span>
                <span>Roll No: <strong className="text-white">{student.rollNumber}</strong></span>
                <span>Admission No: <strong className="text-white font-mono">{student.admissionNumber}</strong></span>
                <span>Reg No: <strong className="text-white font-mono">{student.registrationNumber}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(student);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-xs"
                title="Edit Student Record"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
            <button
              onClick={() => onOpenIdCard(student)}
              className="px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>ID Card</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Photo Upload Drawer */}
        {isUpdatingPhoto && (
          <div className="p-4 bg-slate-800 border-b border-slate-700 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200">
                Update Student Photo
              </span>
              <button
                type="button"
                onClick={() => setIsUpdatingPhoto(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Done
              </button>
            </div>
            <FileUploadComponent
              uploadType="student-photo"
              currentValue={student.photo}
              currentFileKey={student.photoFileKey}
              onUploadComplete={handlePhotoUpdated}
              onRemove={handleRemovePhoto}
            />
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 overflow-x-auto text-xs font-semibold text-slate-600">
          {[
            { id: 'PERSONAL', label: 'Personal Info' },
            { id: 'ACADEMIC', label: 'Academic & History' },
            { id: 'PARENT', label: 'Parent Details' },
            { id: 'ATTENDANCE', label: 'Attendance' },
            { id: 'FEES', label: 'Fees & Dues' },
            { id: 'EXAMS', label: 'Marks & Results' },
            { id: 'DOCUMENTS', label: 'Certificates & Docs' },
            { id: 'TRANSPORT_HOSTEL', label: 'Transport / Hostel' },
            { id: 'PORTAL', label: 'Portal Access & Login' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-700 text-blue-800 bg-white font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {activeTab === 'PERSONAL' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Full Name</span>
                  <span className="font-bold text-slate-800">{student.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Date of Birth</span>
                  <span className="font-semibold text-slate-800">{student.dob}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Gender</span>
                  <span className="font-semibold text-slate-800">{student.gender}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Blood Group</span>
                  <span className="font-semibold text-slate-800">{student.bloodGroup}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Mobile Number</span>
                  <span className="font-semibold text-slate-800">{student.mobile || student.parentPhone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Emergency Contact</span>
                  <span className="font-semibold text-slate-800">{student.emergencyContact || student.parentPhone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Aadhaar / National ID</span>
                  <span className="font-semibold text-slate-800 font-mono">{student.aadhaarNumber || 'Verified in Records'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Category</span>
                  <span className="font-semibold text-slate-800">{student.category || 'General'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Religion</span>
                  <span className="font-semibold text-slate-800">{student.religion || 'Hindu'}</span>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-slate-400 block text-[11px]">Residential Address</span>
                  <span className="font-semibold text-slate-800">
                    {student.address}, {student.city}, {student.state} - {student.pincode}
                  </span>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="font-bold text-slate-800">Enrollment Status Workflow</h5>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Current: <strong className="text-slate-900">{student.status}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRANSFERRED', 'WITHDRAWN'] as StudentStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        student.status === st
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {st === 'ACTIVE'
                        ? 'Active'
                        : st === 'INACTIVE'
                        ? 'Inactive / On Leave'
                        : st === 'SUSPENDED'
                        ? 'Suspended'
                        : st === 'TRANSFERRED'
                        ? 'Transferred (TC)'
                        : 'Withdrawn'}
                    </button>
                  ))}
                  <button
                    onClick={handlePromote}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Promote Student</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ACADEMIC' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Enrolled Class</span>
                  <span className="font-bold text-slate-900">{student.className}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Section</span>
                  <span className="font-bold text-slate-900">Section {student.section}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Class Roll Number</span>
                  <span className="font-bold text-slate-900">{student.rollNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Admission Number</span>
                  <span className="font-mono font-bold text-slate-900">{student.admissionNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Registration Number</span>
                  <span className="font-mono font-bold text-slate-900">{student.registrationNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Admission Date</span>
                  <span className="font-semibold text-slate-900">{student.admissionDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Enrollment Date</span>
                  <span className="font-semibold text-emerald-800">{student.enrollmentDate || student.admissionDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Fee Start Date</span>
                  <span className="font-semibold text-blue-800">{student.feeStartDate || student.enrollmentDate || student.admissionDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Academic Session</span>
                  <span className="font-semibold text-slate-900">{student.academicSession}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Previous School</span>
                  <span className="font-semibold text-slate-900">{student.previousSchool || 'Direct Admission'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PARENT' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[11px]">Parent / Guardian Name</span>
                <span className="font-bold text-slate-900">{student.parentName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Parent Mobile</span>
                <span className="font-bold text-slate-900">{student.parentPhone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Parent Email</span>
                <span className="font-semibold text-slate-900">{student.parentEmail || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Parent Occupation</span>
                <span className="font-semibold text-slate-900">{student.parentOccupation || 'Salaried / Professional'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Emergency Phone</span>
                <span className="font-semibold text-slate-900">{student.emergencyContact}</span>
              </div>
            </div>
          )}

          {activeTab === 'ATTENDANCE' && (
            <div className="space-y-4">
              <AttendanceCalendar
                type="STUDENT"
                studentId={student.id}
                studentName={student.name}
                records={studentAttendanceRecords}
                holidays={holidays}
              />
            </div>
          )}

          {activeTab === 'FEES' && (
            <div className="space-y-4">
              <div className="p-3 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-800">Enrollment Date:</span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                    {student.enrollmentDate || student.admissionDate}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="font-bold text-slate-800">Fee Start Date:</span>
                  <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">
                    {student.feeStartDate || student.enrollmentDate || student.admissionDate}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Monthly billing starts from enrollment date onward</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <span className="text-xs text-blue-900 font-bold block">Fee Account Balance</span>
                  <span className="text-xl font-bold text-blue-900">₹0 (All Current Dues Cleared)</span>
                </div>
                <button
                  onClick={() => alert(`Fee receipt generator ready for ${student.name}`)}
                  className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs"
                >
                  Pay Next Quarter
                </button>
              </div>

              <div>
                <h5 className="font-bold text-slate-800 mb-2">Payment Transaction History</h5>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 text-[11px]">
                      <tr>
                        <th className="p-2.5">Receipt No</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Fee Type</th>
                        <th className="p-2.5">Mode</th>
                        <th className="p-2.5">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {feePayments.map((fp, idx) => (
                        <tr key={`${fp.id}-${idx}`} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-blue-900">{fp.receiptNumber}</td>
                          <td className="p-2.5 text-slate-700">{fp.paymentDate}</td>
                          <td className="p-2.5 text-slate-700">{fp.feeType}</td>
                          <td className="p-2.5 text-slate-600">{fp.paymentMethod}</td>
                          <td className="p-2.5 font-bold text-slate-900">₹{(Number(fp.amount) || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'EXAMS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">Examinations, Admit Cards & Academic Marksheets</h5>
                  <p className="text-[11px] text-slate-500">
                    Official evaluation records for {student.className || `Class ${student.classId}`} ({student.section || 'A'})
                  </p>
                </div>
                <button
                  onClick={() => onOpenReportCard(student)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Official Marksheet</span>
                </button>
              </div>

              {isLoadingExams ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  Loading official examination records...
                </div>
              ) : studentPublishedExams.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Exam Name</th>
                        <th className="py-2.5 px-3">Exam Type</th>
                        <th className="py-2.5 px-3">Schedule</th>
                        <th className="py-2.5 px-3 text-center">Admit Card</th>
                        <th className="py-2.5 px-3 text-center">Marksheet / Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {studentPublishedExams.map((exam) => {
                        const examMarksForThisExam = allStudentMarks.filter((m) => m.examId === exam.id);
                        const isAdmitCardPublished = exam.admitCardStatus === 'PUBLISHED';
                        const isResultsPublished = exam.resultsStatus === 'PUBLISHED';

                        // Format exam schedule summary
                        const applicableSchedule = (exam.schedule || []).filter((item) => {
                          const classMatch = !item.classId || item.classId === student.classId || (student.className && item.className === student.className);
                          const sectionMatch = !item.section || item.section === 'ALL' || !student.section || item.section === student.section;
                          return classMatch && sectionMatch;
                        });

                        let scheduleText = 'Schedule Announced';
                        if (applicableSchedule.length > 0) {
                          const sortedPapers = [...applicableSchedule].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                          const firstDate = sortedPapers[0]?.date;
                          const lastDate = sortedPapers[sortedPapers.length - 1]?.date;
                          scheduleText = firstDate === lastDate ? firstDate : `${firstDate} to ${lastDate}`;
                        } else if (exam.startDate) {
                          scheduleText = exam.endDate && exam.endDate !== exam.startDate ? `${exam.startDate} to ${exam.endDate}` : exam.startDate;
                        }

                        const rawType = exam.examType || 'EXAMINATION';
                        const formattedType = rawType.replace(/_/g, ' ');
                        const isExpanded = expandedExamMarksId === exam.id;

                        return (
                          <React.Fragment key={exam.id}>
                            <tr className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 text-xs">
                                  {exam.name || exam.title || 'Examination'}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium">
                                  {exam.term || 'Academic Term'} • {exam.academicSession || '2026-2027'}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  {formattedType}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                <div className="flex items-center gap-1 font-medium text-slate-700">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{scheduleText}</span>
                                </div>
                                {applicableSchedule.length > 0 && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    {applicableSchedule.length} Subject Paper{applicableSchedule.length > 1 ? 's' : ''}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {isAdmitCardPublished ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedExamForAdmitCard(exam)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                                    title="View / Download Admit Card"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>View / Download Admit Card</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {isResultsPublished ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedExamForReportCard(exam)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                                      title="View / Download / Print Marksheet"
                                    >
                                      <FileCheck className="w-3.5 h-3.5" />
                                      <span>View / Download / Print Marksheet</span>
                                    </button>
                                    {examMarksForThisExam.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedExamMarksId(isExpanded ? null : exam.id)}
                                        className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                                      >
                                        {isExpanded ? 'Hide' : 'Marks'}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            </tr>

                            {/* Expandable subject marks breakdown */}
                            {isExpanded && examMarksForThisExam.length > 0 && (
                              <tr className="bg-slate-50/80">
                                <td colSpan={5} className="p-3 border-t border-b border-slate-200">
                                  <div className="space-y-1.5">
                                    <div className="text-[11px] font-bold text-slate-700">
                                      Subject Scorecard — {exam.name || exam.title}
                                    </div>
                                    <div className="border border-slate-200 rounded overflow-hidden bg-white">
                                      <table className="w-full text-left text-[11px]">
                                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                          <tr>
                                            <th className="py-1.5 px-2.5">Subject</th>
                                            <th className="py-1.5 px-2.5">Max Marks</th>
                                            <th className="py-1.5 px-2.5">Marks Scored</th>
                                            <th className="py-1.5 px-2.5">Percentage</th>
                                            <th className="py-1.5 px-2.5">Grade</th>
                                            <th className="py-1.5 px-2.5">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {examMarksForThisExam.map((m) => {
                                            const markEval = calculateGradeFromMarks(m.marksObtained, m.maxMarks);
                                            const pct = Math.round((m.marksObtained / m.maxMarks) * 100);
                                            const grade = m.grade || markEval.grade;
                                            const isPass = markEval.isPass;
                                            return (
                                              <tr key={m.id} className="hover:bg-slate-50/50">
                                                <td className="py-1.5 px-2.5 font-semibold text-slate-900">{m.subjectName}</td>
                                                <td className="py-1.5 px-2.5 text-slate-500">{m.maxMarks}</td>
                                                <td className="py-1.5 px-2.5 font-bold text-slate-900">{m.marksObtained}</td>
                                                <td className="py-1.5 px-2.5 font-bold text-blue-700">{pct}%</td>
                                                <td className="py-1.5 px-2.5">
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                    {grade}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-2.5">
                                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                    {isPass ? 'PASS' : 'FAIL'}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-xs">
                  <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                  <p className="font-semibold text-slate-700">No Published Examinations Available</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    There are no published examinations currently scheduled or conducted for {student.className || `Class ${student.classId}`} ({student.section || 'A'}).
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-5">
              {/* Cloudflare R2 Direct Upload Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">Student Document Repository</h5>
                    <p className="text-[11px] text-slate-500">
                      Upload verified student documents stored securely in school digital records.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    Digital Storage
                  </span>
                </div>

                <FileUploadComponent
                  uploadType="student-document"
                  label="Attach Verification Document (TC, Birth Certificate, Aadhaar, Medical)"
                  hint="PDF, JPEG, PNG, or WEBP up to 25MB supported."
                  onUploadComplete={handleDocumentUploaded}
                />

                {/* Stored Documents List */}
                <div className="mt-3">
                  <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Attached Verification Documents ({student.documents?.length || 0})
                  </h6>
                  {student.documents && student.documents.length > 0 ? (
                    <div className="space-y-2">
                      {student.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded bg-blue-50 text-blue-700">
                              <File className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-xs">{doc.title}</div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                <span>{doc.originalFileName}</span>
                                <span>•</span>
                                <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                                <span>•</span>
                                <span className="text-emerald-700 font-semibold">Stored</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadDocument(doc)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Download file"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDocument(doc)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                              title="Delete file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-lg text-xs">
                      No documents attached to this student record yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Printable Institutional Certificates */}
              <div>
                <h5 className="font-bold text-slate-800 mb-2">Printable Institutional Certificates</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50">
                  <div>
                    <h6 className="font-bold text-slate-900">Student Identity Card</h6>
                    <p className="text-[11px] text-slate-500">Official plastic ID card with security QR code</p>
                  </div>
                  <button
                    onClick={() => onOpenIdCard(student)}
                    className="px-3 py-1.5 rounded-md bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs"
                  >
                    View ID Card
                  </button>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50">
                  <div>
                    <h6 className="font-bold text-slate-900">Mid-Term Report Card</h6>
                    <p className="text-[11px] text-slate-500">Official CBSE format statement of marks</p>
                  </div>
                  <button
                    onClick={() => onOpenReportCard(student)}
                    className="px-3 py-1.5 rounded-md bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs"
                  >
                    View Report Card
                  </button>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50">
                  <div>
                    <h6 className="font-bold text-slate-900">Transfer Certificate (TC)</h6>
                    <p className="text-[11px] text-slate-500">Official school leaving transfer certificate</p>
                  </div>
                  <button
                    onClick={() => onOpenCertificate(student, 'TC')}
                    className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs"
                  >
                    Generate TC
                  </button>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50">
                  <div>
                    <h6 className="font-bold text-slate-900">Bonafide Certificate</h6>
                    <p className="text-[11px] text-slate-500">Study certificate for passport/visa/banking</p>
                  </div>
                  <button
                    onClick={() => onOpenCertificate(student, 'BONAFIDE')}
                    className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs"
                  >
                    Generate Bonafide
                  </button>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50 sm:col-span-2">
                  <div>
                    <h6 className="font-bold text-slate-900">Character & Conduct Certificate</h6>
                    <p className="text-[11px] text-slate-500">Institutional endorsement of moral conduct & curricular excellence</p>
                  </div>
                  <button
                    onClick={() => onOpenCertificate(student, 'CHARACTER')}
                    className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs"
                  >
                    Generate Character Cert
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}

          {activeTab === 'TRANSPORT_HOSTEL' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  <Bus className="w-4 h-4 text-cyan-700" />
                  <h6 className="font-bold text-slate-900">School Bus Transport</h6>
                </div>
                {student.transportRequired || student.transportRouteId ? (() => {
                  const routes = api.getRoutes();
                  const matchedRoute = routes.find((r) => r.id === student.transportRouteId || r.routeName === student.transportRouteId);
                  const matchedStop = (matchedRoute?.stops || []).find(
                    (s) => s.id === student.transportStopId || s.stopName === student.transportStopName || s.name === student.transportStopName
                  );
                  const fare = student.transportMonthlyFee ?? matchedStop?.monthlyFare ?? matchedStop?.fare ?? 0;
                  const busNum = student.vehicleNumber || matchedRoute?.vehicleNumber || 'Campus Bus';
                  const drvName = student.driverName || matchedRoute?.driverName || 'Designated Driver';
                  const drvPhone = student.driverContact || matchedRoute?.driverPhone;

                  return (
                    <div className="text-xs space-y-1.5 text-slate-700">
                      <div>Route: <strong className="text-slate-900">{matchedRoute?.routeName || student.transportRouteId || 'Assigned Route'}</strong></div>
                      <div>Designated Stop: <strong className="text-slate-900">{matchedStop?.stopName || student.transportStopName || 'Assigned Stop'}</strong></div>
                      <div>
                        Pickup Time: <strong className="text-blue-900">{matchedStop?.pickupTime || 'Scheduled'}</strong> • Drop Time: <strong className="text-slate-900">{matchedStop?.dropTime || 'Scheduled'}</strong>
                      </div>
                      <div>
                        Assigned Bus: <strong className="font-mono text-slate-900">{busNum}</strong> • Driver: <strong>{drvName} {drvPhone ? `(${drvPhone})` : ''}</strong>
                      </div>
                      <div className="pt-1 text-[11px] text-emerald-800 font-bold">
                        Monthly Transport Fare: ₹{Number(fare).toLocaleString('en-IN')} / month
                      </div>
                    </div>
                  );
                })() : (
                  <div className="text-xs text-slate-500">Student uses private / parent conveyance (Day Scholar).</div>
                )}
              </div>

              {(() => {
                const currentHostelRooms = api.getHostelRooms();
                const currentHostels = api.getHostels();
                const currentRoom = currentHostelRooms.find((r) => r.id === student.hostelRoomId || r.roomNumber === student.hostelRoomId);
                const currentHostel = currentHostels.find(
                  (h) => h.id === student.hostelId || h.name === student.hostelName || h.id === currentRoom?.hostelId
                );

                const handleExecuteVacate = async () => {
                  try {
                    const res = await api.vacateHostelBed(student.id, hostelVacateRemarks);
                    if (res.success && res.student) {
                      onUpdate(res.student);
                      setHostelActionMsg({ type: 'success', text: `Bed ${student.hostelBedNumber} vacated successfully.` });
                      setIsHostelVacateOpen(false);
                    } else {
                      setHostelActionMsg({ type: 'error', text: res.error || 'Failed to vacate bed.' });
                    }
                  } catch (e: any) {
                    setHostelActionMsg({ type: 'error', text: e.message || 'Error vacating bed.' });
                  }
                  setTimeout(() => setHostelActionMsg(null), 4000);
                };

                const handleExecuteChangeBed = async () => {
                  if (!hostelChangeTargetRoomId || !hostelChangeTargetBedNumber) {
                    setHostelActionMsg({ type: 'error', text: 'Select target room and bed.' });
                    return;
                  }
                  try {
                    const res = await api.changeHostelBed(
                      student.id,
                      hostelChangeTargetRoomId,
                      hostelChangeTargetBedNumber,
                      hostelChangeRemarks
                    );
                    if (res.success && res.student) {
                      onUpdate(res.student);
                      setHostelActionMsg({ type: 'success', text: `Changed to Bed ${hostelChangeTargetBedNumber} successfully.` });
                      setIsHostelChangeBedOpen(false);
                    } else {
                      setHostelActionMsg({ type: 'error', text: res.error || 'Failed to change bed.' });
                    }
                  } catch (e: any) {
                    setHostelActionMsg({ type: 'error', text: e.message || 'Error changing bed.' });
                  }
                  setTimeout(() => setHostelActionMsg(null), 4000);
                };

                const handleExecuteAllocate = async () => {
                  if (!hostelAllocRoomId || !hostelAllocBedNumber) {
                    setHostelActionMsg({ type: 'error', text: 'Select room and bed to allocate.' });
                    return;
                  }
                  try {
                    const res = await api.allocateHostelBed(
                      hostelAllocRoomId,
                      hostelAllocBedNumber,
                      student.id,
                      'Allotted from Student Profile'
                    );
                    if (res.success && res.student) {
                      onUpdate(res.student);
                      setHostelActionMsg({ type: 'success', text: `Bed ${hostelAllocBedNumber} allocated successfully.` });
                      setIsHostelAllocateOpen(false);
                    } else {
                      setHostelActionMsg({ type: 'error', text: res.error || 'Failed to allocate bed.' });
                    }
                  } catch (e: any) {
                    setHostelActionMsg({ type: 'error', text: e.message || 'Error allocating bed.' });
                  }
                  setTimeout(() => setHostelActionMsg(null), 4000);
                };

                return (
                  <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-stone-700" />
                        <h6 className="font-bold text-slate-900">Campus Hostel Residency</h6>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          student.hostelRequired && student.hostelStatus !== 'VACATED' && student.hostelRoomId
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {student.hostelRequired && student.hostelStatus !== 'VACATED' && student.hostelRoomId ? 'Hostel Resident' : 'Day Scholar'}
                      </span>
                    </div>

                    {hostelActionMsg && (
                      <div
                        className={`p-2 rounded text-xs flex items-center gap-1.5 ${
                          hostelActionMsg.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{hostelActionMsg.text}</span>
                      </div>
                    )}

                    {student.hostelRequired && student.hostelStatus !== 'VACATED' && student.hostelRoomId ? (
                      <div className="space-y-2 text-xs text-slate-700">
                        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Hostel Wing</span>
                            <strong className="text-slate-900">{student.hostelName || currentHostel?.name || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Floor & Room</span>
                            <strong className="text-slate-900">
                              Floor {student.hostelFloor || currentRoom?.floor || 1} • Room {currentRoom?.roomNumber || student.hostelRoomId}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Bed Identifier</span>
                            <strong className="text-indigo-900 font-mono font-bold">{student.hostelBedNumber || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Hostel Status</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-block">
                              {student.hostelStatus || 'ACTIVE'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Allocation Date</span>
                            <strong className="text-slate-900">{student.hostelAllocationDate || student.admissionDate || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Chief Warden</span>
                            <strong className="text-slate-900">{student.hostelWarden || currentHostel?.wardenName || '—'}</strong>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded bg-indigo-50 border border-indigo-100 text-[11px]">
                          <span className="text-indigo-900 font-medium">Monthly Boarding Fee:</span>
                          <strong className="text-indigo-950 font-bold font-mono">
                            ₹{((student.hostelMonthlyFee || currentRoom?.monthlyFee || 0) + (student.messMonthlyFee || currentHostel?.messFee || 0)).toLocaleString('en-IN')}/mo
                          </strong>
                        </div>

                        {/* Action buttons: Change Bed | Vacate Bed */}
                        <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const availRooms = currentHostelRooms.filter(
                                (r) => r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
                              );
                              setHostelChangeTargetRoomId(availRooms[0]?.id || '');
                              const firstFree = availRooms[0]?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                              setHostelChangeTargetBedNumber(firstFree?.bedNumber || '');
                              setIsHostelChangeBedOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 text-xs font-semibold cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                            <span>Change Bed</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsHostelVacateOpen(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 text-red-800 text-xs font-semibold cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5 text-red-600" />
                            <span>Vacate Bed</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <p className="text-slate-500 italic">Day scholar student (Not residing in campus hostel).</p>
                        <button
                          type="button"
                          onClick={() => {
                            const activeH = currentHostels.filter((h) => h.status !== 'INACTIVE');
                            setHostelAllocHostelId(activeH[0]?.id || '');
                            const hRooms = currentHostelRooms.filter(
                              (r) => r.hostelId === activeH[0]?.id && r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
                            );
                            setHostelAllocRoomId(hRooms[0]?.id || '');
                            const firstFree = hRooms[0]?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                            setHostelAllocBedNumber(firstFree?.bedNumber || '');
                            setIsHostelAllocateOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Bed className="w-3.5 h-3.5" />
                          <span>Allocate Hostel Bed</span>
                        </button>
                      </div>
                    )}

                    {/* Change Bed Modal Inside Profile */}
                    {isHostelChangeBedOpen && (
                      <div className="p-3 bg-white border border-blue-300 rounded-lg space-y-2 shadow-2xs mt-2">
                        <div className="font-bold text-slate-800 text-xs flex justify-between">
                          <span>Change Bed Allotment</span>
                          <button onClick={() => setIsHostelChangeBedOpen(false)} className="text-slate-400">✕</button>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Available Room</label>
                          <select
                            value={hostelChangeTargetRoomId}
                            onChange={(e) => {
                              const rId = e.target.value;
                              setHostelChangeTargetRoomId(rId);
                              const targetRoom = currentHostelRooms.find((r) => r.id === rId);
                              const firstFree = targetRoom?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                              setHostelChangeTargetBedNumber(firstFree?.bedNumber || '');
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
                          >
                            {currentHostelRooms
                              .filter((r) => r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'))
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  Room {r.roomNumber} ({r.hostelName} • Floor {r.floor})
                                </option>
                              ))}
                          </select>
                        </div>

                        {(() => {
                          const targetRoom = currentHostelRooms.find((r) => r.id === hostelChangeTargetRoomId);
                          const freeBeds = (targetRoom?.beds || []).filter(
                            (b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'
                          );

                          return (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Available Bed</label>
                              <select
                                value={hostelChangeTargetBedNumber}
                                onChange={(e) => setHostelChangeTargetBedNumber(e.target.value)}
                                className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-mono"
                              >
                                {freeBeds.map((b) => (
                                  <option key={b.bedNumber} value={b.bedNumber}>
                                    {b.bedNumber} (Free)
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsHostelChangeBedOpen(false)}
                            className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleExecuteChangeBed}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold"
                          >
                            Confirm Change
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Vacate Bed Confirm Inside Profile */}
                    {isHostelVacateOpen && (
                      <div className="p-3 bg-red-50 border border-red-300 rounded-lg space-y-2 mt-2">
                        <div className="font-bold text-red-900 text-xs">Confirm Vacating Bed</div>
                        <p className="text-[11px] text-red-800">
                          Bed {student.hostelBedNumber} will be vacated immediately and returned to available inventory.
                        </p>
                        <input
                          type="text"
                          value={hostelVacateRemarks}
                          onChange={(e) => setHostelVacateRemarks(e.target.value)}
                          placeholder="Reason for vacating"
                          className="w-full p-1.5 border border-red-300 rounded text-xs bg-white"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsHostelVacateOpen(false)}
                            className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-600 bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleExecuteVacate}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold"
                          >
                            Confirm Vacate
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Allocate Bed Modal Inside Profile for Day Scholar */}
                    {isHostelAllocateOpen && (
                      <div className="p-3 bg-white border border-stone-300 rounded-lg space-y-2 shadow-2xs mt-2">
                        <div className="font-bold text-slate-800 text-xs flex justify-between">
                          <span>Allocate Hostel Accommodation</span>
                          <button onClick={() => setIsHostelAllocateOpen(false)} className="text-slate-400">✕</button>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Select Hostel</label>
                          <select
                            value={hostelAllocHostelId}
                            onChange={(e) => {
                              const hId = e.target.value;
                              setHostelAllocHostelId(hId);
                              const hRooms = currentHostelRooms.filter(
                                (r) => r.hostelId === hId && r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE')
                              );
                              setHostelAllocRoomId(hRooms[0]?.id || '');
                              const firstFree = hRooms[0]?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                              setHostelAllocBedNumber(firstFree?.bedNumber || '');
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
                          >
                            {currentHostels.filter((h) => h.status !== 'INACTIVE').map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name} ({h.type === 'BOYS' ? 'Boys' : 'Girls'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Available Room</label>
                          <select
                            value={hostelAllocRoomId}
                            onChange={(e) => {
                              const rId = e.target.value;
                              setHostelAllocRoomId(rId);
                              const targetRoom = currentHostelRooms.find((r) => r.id === rId);
                              const firstFree = targetRoom?.beds?.find((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE');
                              setHostelAllocBedNumber(firstFree?.bedNumber || '');
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
                          >
                            {currentHostelRooms
                              .filter((r) => r.hostelId === hostelAllocHostelId && r.beds?.some((b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'))
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  Room {r.roomNumber} (Floor {r.floor} • {r.roomType || 'Standard'})
                                </option>
                              ))}
                          </select>
                        </div>

                        {(() => {
                          const targetRoom = currentHostelRooms.find((r) => r.id === hostelAllocRoomId);
                          const freeBeds = (targetRoom?.beds || []).filter(
                            (b) => !b.allocatedStudentId && b.status !== 'MAINTENANCE' && b.status !== 'INACTIVE'
                          );

                          return (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Available Bed</label>
                              <select
                                value={hostelAllocBedNumber}
                                onChange={(e) => setHostelAllocBedNumber(e.target.value)}
                                className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-mono"
                              >
                                {freeBeds.map((b) => (
                                  <option key={b.bedNumber} value={b.bedNumber}>
                                    {b.bedNumber} (Free)
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsHostelAllocateOpen(false)}
                            className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleExecuteAllocate}
                            className="px-3 py-1 bg-stone-800 text-white rounded text-xs font-semibold"
                          >
                            Confirm Allocation
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'PORTAL' && (
            <div className="space-y-6">
              {portalMsg && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                    portalMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{portalMsg.text}</span>
                </div>
              )}

              {/* Student Portal Account */}
              <div className="p-5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-200/70">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-800">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Student Portal Credentials</h4>
                      <p className="text-[11px] text-slate-500">
                        Student logs in directly using Admission Number. No separate user directory.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                        student.loginEnabled !== false
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                      }`}
                    >
                      {student.loginEnabled !== false ? 'Student Login Active' : 'Student Login Disabled'}
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleStudentPortal}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-300 bg-white hover:bg-blue-50 text-blue-700 transition-colors"
                    >
                      {student.loginEnabled !== false ? 'Disable Student Login' : 'Enable Student Login'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-blue-200/80">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Student User ID (Admission No)</span>
                    <span className="font-mono font-bold text-blue-900 text-sm block mt-0.5">
                      {student.admissionNumber}
                    </span>
                    <span className="text-[10px] text-slate-400">Fixed prefix 6401 standard</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-200/80">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Student Name</span>
                    <span className="font-semibold text-slate-800 text-sm block mt-0.5">
                      {student.name}
                    </span>
                    <span className="text-[10px] text-slate-400">{student.className}-{student.section}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-200/80">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Account Status</span>
                    <span className="font-semibold text-slate-800 text-sm block mt-0.5">
                      {student.accountStatus || 'ACTIVE'}
                    </span>
                    <span className="text-[10px] text-slate-400">{student.status}</span>
                  </div>
                </div>

                <form onSubmit={handleResetStudentPassword} className="p-3 bg-white rounded-lg border border-blue-200/80 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">Reset Student Portal Password</span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={studentNewPassword}
                      onChange={(e) => setStudentNewPassword(e.target.value)}
                      placeholder="Enter new student password (min 6 characters)"
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setStudentNewPassword('PDS123')}
                      className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                    >
                      Use "PDS123"
                    </button>
                    <button
                      type="submit"
                      disabled={isResettingStudentPass || !studentNewPassword.trim()}
                      className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg text-xs disabled:opacity-50"
                    >
                      {isResettingStudentPass ? 'Updating...' : 'Set Student Password'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Parent Portal Account */}
              <div className="p-5 bg-purple-50/50 border border-purple-200 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-purple-200/70">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-800">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Parent Portal Credentials</h4>
                      <p className="text-[11px] text-slate-500">
                        Parent logs in with registered mobile number. Multiple children automatically group under this phone.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-emerald-100 text-emerald-800 border-emerald-300">
                      Parent Login Enabled
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleParentPortal}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-300 bg-white hover:bg-purple-50 text-purple-700 transition-colors"
                    >
                      Sync Access
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-purple-200/80">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Parent User ID (Mobile No)</span>
                    <span className="font-mono font-bold text-purple-900 text-sm block mt-0.5">
                      {student.fatherMobile || student.parentPhone || 'Not Registered'}
                    </span>
                    <span className="text-[10px] text-slate-400">Used for parent portal login</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-purple-200/80">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Guardian / Parent Name</span>
                    <span className="font-semibold text-slate-800 text-sm block mt-0.5">
                      {student.parentName || student.fatherName || 'Parent'}
                    </span>
                    <span className="text-[10px] text-slate-400">Primary Contact</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-purple-200/80">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Single-School Integration</span>
                    <span className="font-semibold text-emerald-700 text-xs block mt-0.5">
                      Direct Student Link
                    </span>
                    <span className="text-[10px] text-slate-400">Auto multi-child grouping</span>
                  </div>
                </div>

                <form onSubmit={handleResetParentPassword} className="p-3 bg-white rounded-lg border border-purple-200/80 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">Reset Parent Portal Password</span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={parentNewPassword}
                      onChange={(e) => setParentNewPassword(e.target.value)}
                      placeholder="Enter new parent password (min 6 characters)"
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-purple-600 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setParentNewPassword('PDS123')}
                      className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                    >
                      Use "PDS123"
                    </button>
                    <button
                      type="submit"
                      disabled={isResettingParentPass || !parentNewPassword.trim() || !student.parentPhone}
                      className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg text-xs disabled:opacity-50"
                    >
                      {isResettingParentPass ? 'Updating...' : 'Set Parent Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Admit Card Modal */}
      {selectedExamForAdmitCard && (
        <PrintableAdmitCardModal
          student={student}
          exam={selectedExamForAdmitCard}
          isOpen={!!selectedExamForAdmitCard}
          onClose={() => setSelectedExamForAdmitCard(null)}
          settings={api.getSettings()}
        />
      )}

      {/* Dynamic Report Card / Marksheet Modal */}
      {selectedExamForReportCard && (
        <PrintableReportCardModal
          student={student}
          isOpen={!!selectedExamForReportCard}
          onClose={() => setSelectedExamForReportCard(null)}
          settings={api.getSettings()}
          examId={selectedExamForReportCard.id}
        />
      )}
    </div>
  );
};
