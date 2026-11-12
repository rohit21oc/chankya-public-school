import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  GraduationCap,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Heart,
  QrCode,
  FileCheck,
  Download,
  Printer,
  Eye,
  ShieldCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Award,
  BookOpen,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FileText,
  UserCheck,
  Bus,
  Home,
  Check,
} from 'lucide-react';
import { SchoolSettings, Student, User } from '../../types';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { PrintableIdCardModal } from '../modals/PrintableIdCardModal';
import { PrintableReportCardModal } from '../modals/PrintableReportCardModal';
import { StudentProfileView } from '../views/StudentProfileView';
import { exportIdCardToPdf } from '../../utils/idCardPdfExporter';
import { fileUploadService } from '../../services/fileUploadService';
import { summarizeStudentFees } from '../../utils/parentFeeSummary';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity } from '../../utils/schoolIdentity';

interface ParentStudentsViewProps {
  currentUser?: User;
  settings: SchoolSettings;
  onNavigate?: (module: string) => void;
}

export const ParentStudentsView: React.FC<ParentStudentsViewProps> = ({
  currentUser: propUser,
  settings,
  onNavigate,
}) => {
  const user = propUser || authService.getCurrentUser() || authService.getStoredUser();
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [parentChildren, setParentChildren] = useState<Student[]>([]);
  const [activeChildId, setActiveChildId] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Modals state
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState<boolean>(false);
  const [isReportCardModalOpen, setIsReportCardModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Real-time listener to keep children and academic data synchronized with MongoDB Atlas
  useRealtimeListener(['STUDENT', 'ATTENDANCE', 'EXAM', 'FEE'], () => {
    refreshChildren(true);
  });

  const loadInitialChildren = useCallback(() => {
    const cachedStudents = api.getStudents();
    const linkedIds = user?.linkedStudentIds || [];
    const cleanPhone = (user?.phone || user?.username || '').replace(/\D/g, '').slice(-10);

    const matched = cachedStudents.filter((s) => {
      const matchLinked = linkedIds.includes(s.id) || linkedIds.includes(s.admissionNumber);
      if (matchLinked) return true;
      if (cleanPhone.length >= 10) {
        const pPhone = (s.parentPhone || '').replace(/\D/g, '').slice(-10);
        const fPhone = (s.fatherMobile || '').replace(/\D/g, '').slice(-10);
        const mPhone = (s.motherMobile || '').replace(/\D/g, '').slice(-10);
        const gPhone = (s.guardianMobile || '').replace(/\D/g, '').slice(-10);
        const mob = (s.mobile || '').replace(/\D/g, '').slice(-10);
        return pPhone === cleanPhone || fPhone === cleanPhone || mPhone === cleanPhone || gPhone === cleanPhone || mob === cleanPhone;
      }
      return false;
    });

    const uniqueMap = new Map<string, Student>();
    matched.forEach((s) => uniqueMap.set(s.id, s));
    return Array.from(uniqueMap.values());
  }, [user]);

  const refreshChildren = async (isManual = false) => {
    if (isManual) setSyncing(true);
    else setLoading(true);

    try {
      const serverChildren = await api.fetchLinkedChildren();
      if (Array.isArray(serverChildren) && serverChildren.length > 0) {
        setParentChildren(serverChildren);
        setActiveChildId((prev) => {
          if (prev && serverChildren.some((c) => c.id === prev)) return prev;
          if (user?.activeStudentId && serverChildren.some((c) => c.id === user.activeStudentId)) {
            return user.activeStudentId;
          }
          return serverChildren[0].id;
        });
      } else {
        // Fallback to locally cached matching children
        const localMatched = loadInitialChildren();
        if (localMatched.length > 0) {
          setParentChildren(localMatched);
          setActiveChildId((prev) => (prev ? prev : localMatched[0].id));
        }
      }
    } catch (err) {
      console.warn('[ParentStudentsView] Error refreshing children:', err);
      const fallback = loadInitialChildren();
      setParentChildren(fallback);
      if (fallback.length > 0 && !activeChildId) {
        setActiveChildId(fallback[0].id);
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    refreshChildren();
  }, []);

  const handleSelectChild = async (childId: string) => {
    if (childId === activeChildId) return;
    setActiveChildId(childId);
    try {
      await authService.switchChild(childId);
      const fresh = await api.fetchStudentDirect(childId);
      if (fresh) {
        setParentChildren((prev) => {
          const idx = prev.findIndex((p) => p.id === fresh.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = fresh;
            return next;
          }
          return [...prev, fresh];
        });
      }
    } catch (e) {
      console.warn('[ParentStudentsView] switchChild warning:', e);
    }
  };

  const selectedChild = useMemo(() => {
    if (!activeChildId) return parentChildren[0] || null;
    return parentChildren.find((c) => c.id === activeChildId) || parentChildren[0] || null;
  }, [parentChildren, activeChildId]);

  // Derived summaries for selected child
  const attendanceSummary = useMemo(() => {
    if (!selectedChild) return { percentage: 0, total: 0, present: 0, absent: 0 };
    return api.getStudentAttendanceSummary(selectedChild.id);
  }, [selectedChild]);

  const feeSummary = useMemo(() => {
    if (!selectedChild) return { totalPaid: 0, balance: 0, hasDues: false };
    // Ledger-based, identical to the Fees page (late fees and concessions included).
    const sum = summarizeStudentFees(api.getFeeLedgersSync(selectedChild.id), api.getFeePayments(selectedChild.id));
    return { totalPaid: sum.totalPaid, balance: sum.totalPending, hasDues: sum.totalPending > 0 };
  }, [selectedChild]);

  const handleDownloadIdCard = async () => {
    if (!selectedChild) return;
    try {
      setIsExportingPdf(true);
      await exportIdCardToPdf(selectedChild, settings);
    } catch (err: any) {
      console.error('[ParentStudentsView] Failed to download ID card:', err);
      alert('Unable to export ID card PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (loading && parentChildren.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl border border-slate-200 p-8">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <h3 className="text-sm font-bold text-slate-800">Loading Linked Children Records</h3>
        <p className="text-xs text-slate-500 mt-1">Loading student profiles…</p>
      </div>
    );
  }

  if (!loading && parentChildren.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">No Linked Children Found</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No registered students are linked to your parent mobile number ({user?.phone || 'Registered Phone'}). If you recently changed your contact details, please contact the school administration.
          </p>
        </div>
        <button
          onClick={() => refreshChildren(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Database</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. TOP BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold">
              <Users className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  PARENT PORTAL
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Read-Only Verified Access
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                My Children & Student Directory
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {[schoolIdentity(settings).name, affiliationText(schoolIdentity(settings))].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshChildren(true)}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          </div>
        </div>

        {/* 2. SIBLINGS / MULTI-CHILD SWITCHER */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700" />
              <span className="text-xs font-bold text-slate-900">
                Linked Sibling(s) ({parentChildren.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Select child to switch academic view
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {parentChildren.map((child) => {
              const isSelected = selectedChild?.id === child.id;
              const rawPhoto = child.photo || child.photoFileKey || (child as any).avatar || '';
              const photoSrc = rawPhoto ? fileUploadService.getFileUrl(rawPhoto) : '';

              return (
                <button
                  key={child.id}
                  onClick={() => handleSelectChild(child.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-200 hover:bg-slate-50 bg-white'
                  }`}
                >
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    {photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={child.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-sm">
                        {child.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{child.name}</h4>
                    </div>
                    <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                      {child.className} • Section {child.section || 'A'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 font-mono">
                      <span>Adm: {child.admissionNumber}</span>
                      <span>• Roll: {child.rollNumber || 'N/A'}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedChild && (
        <>
          {/* 3. SELECTED CHILD HERO IDENTITY CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-slate-800 border-2 border-white/20 shadow-md shrink-0">
                    {(() => {
                      const heroRaw = selectedChild.photo || selectedChild.photoFileKey || (selectedChild as any).avatar || '';
                      const heroPhoto = heroRaw ? fileUploadService.getFileUrl(heroRaw) : '';
                      return heroPhoto ? (
                        <img
                          src={heroPhoto}
                          alt={selectedChild.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-black text-2xl text-blue-200 bg-blue-900/40">
                          {selectedChild.name.slice(0, 2).toUpperCase()}
                        </div>
                      );
                    })()}
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500 text-white">
                      {selectedChild.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl md:text-2xl font-black tracking-tight">{selectedChild.name}</h2>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                        {selectedChild.className} - {selectedChild.section || 'A'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-2 font-medium">
                      <span>Admission No: <strong className="font-mono text-white">{selectedChild.admissionNumber}</strong></span>
                      <span>Roll No: <strong className="font-mono text-white">{selectedChild.rollNumber || 'N/A'}</strong></span>
                      <span>Session: <strong className="text-white">{selectedChild.academicSession || settings.currentAcademicSession || '2026-2027'}</strong></span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
                      <span>DOB: <strong className="text-slate-200">{selectedChild.dob || 'N/A'}</strong></span>
                      <span>• Blood: <strong className="text-slate-200">{selectedChild.bloodGroup || 'N/A'}</strong></span>
                      <span>• Category: <strong className="text-slate-200">{selectedChild.category || 'General'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Primary Student Actions for Parent */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setIsIdCardModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all cursor-pointer shadow-xs backdrop-blur-xs"
                  >
                    <QrCode className="w-3.5 h-3.5 text-blue-300" />
                    <span>Preview ID Card</span>
                  </button>

                  <button
                    onClick={handleDownloadIdCard}
                    disabled={isExportingPdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    <Download className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
                    <span>{isExportingPdf ? 'Exporting...' : 'Download ID'}</span>
                  </button>

                  <button
                    onClick={() => setIsReportCardModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Report Card</span>
                  </button>

                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full 360° Profile</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. SUMMARY METRIC STRIP */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/70 p-4 border-t border-slate-200 text-xs">
              {/* Attendance Metric */}
              <div className="p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Attendance Rate</span>
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    {attendanceSummary.total > 0 ? (
                      <>
                        <span className="text-lg font-black text-slate-900">{attendanceSummary.percentage}%</span>
                        <span className="text-[11px] text-slate-500">
                          ({attendanceSummary.present} of {attendanceSummary.total} Days)
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-slate-500">No attendance records yet</span>
                    )}
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        attendanceSummary.percentage >= 75 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${attendanceSummary.total > 0 ? Math.min(100, attendanceSummary.percentage) : 0}%` }}
                    />
                  </div>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('attendance')}
                    className="mt-2.5 text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 transition-colors cursor-pointer self-start"
                  >
                    <span>View Attendance Calendar</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Fee Status Metric */}
              <div className="p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Fee Standing</span>
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-lg font-black ${feeSummary.hasDues ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {feeSummary.hasDues ? `₹${feeSummary.balance.toLocaleString()} Due` : 'Paid in Full'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      (Paid: ₹{feeSummary.totalPaid.toLocaleString()})
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {feeSummary.hasDues ? 'Please clear outstanding dues at fee counter' : 'No overdue fees for current session'}
                  </p>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('fees')}
                    className="mt-2.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition-colors cursor-pointer self-start"
                  >
                    <span>View Fees & Accounts</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Academic Performance Metric */}
              <div className="p-3">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Academic Standing</span>
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-slate-900">Good Standing</span>
                  <span className="text-[11px] text-emerald-700 font-bold">CBSE 9-Point Scale</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Official report card available for published exams
                </p>
              </div>
            </div>
          </div>

          {/* 5. DETAILED PARTICULARS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card A: Academic & Enrolment Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Academic & Enrolment Particulars</span>
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Grade</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{selectedChild.className}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Section</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">Section {selectedChild.section || 'A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Admission Number</span>
                  <span className="font-mono font-bold text-blue-900 mt-0.5 block">{selectedChild.admissionNumber}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Roll Number</span>
                  <span className="font-mono font-bold text-slate-900 mt-0.5 block">{selectedChild.rollNumber || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registration Number</span>
                  <span className="font-mono font-bold text-slate-900 mt-0.5 block">{selectedChild.registrationNumber || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Admission Date</span>
                  <span className="font-medium text-slate-800 mt-0.5 block">{selectedChild.admissionDate || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Card B: Family & Contact Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
                <Heart className="w-4 h-4 text-rose-600" />
                <span>Parent & Family Information</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium">Father's Name</span>
                  <span className="font-bold text-slate-900">{selectedChild.fatherName || selectedChild.parentName || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium">Mother's Name</span>
                  <span className="font-bold text-slate-900">{selectedChild.motherName || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium">Registered Contact Phone</span>
                  <span className="font-mono font-bold text-blue-900">{selectedChild.parentPhone || selectedChild.fatherMobile || selectedChild.mobile || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium">Emergency Contact</span>
                  <span className="font-mono font-bold text-slate-900">{selectedChild.emergencyContact || selectedChild.parentPhone || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium block mb-0.5">Residential Address</span>
                  <span className="font-medium text-slate-800">
                    {[selectedChild.address, selectedChild.city, selectedChild.state, selectedChild.pincode].filter(Boolean).join(', ') || 'Sheohar, Bihar - 843329'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. AUTHORIZED DOCUMENTS & ID CARDS SECTION */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Authorized Student Documents & ID Card</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official school credentials issued for {selectedChild.name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Doc 1: Student ID Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                    <QrCode className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Official Student ID Card</h4>
                    <span className="text-[10px] text-slate-500">Photo ID with QR Code</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600">
                  Authorized digital identity card containing institutional seal, photograph, and candidate QR code.
                </p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                  <button
                    onClick={() => setIsIdCardModalOpen(true)}
                    className="flex-1 py-1.5 px-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
                  >
                    Preview
                  </button>
                  <button
                    onClick={handleDownloadIdCard}
                    disabled={isExportingPdf}
                    className="py-1.5 px-3 border border-slate-200 hover:bg-white text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Download
                  </button>
                </div>
              </div>

              {/* Doc 2: Report Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                    <FileCheck className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">CBSE Report Card</h4>
                    <span className="text-[10px] text-slate-500">Published Assessments</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600">
                  Official report card with 9-point grading scale, marks tabulation, principal remarks, and attendance.
                </p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                  <button
                    onClick={() => setIsReportCardModalOpen(true)}
                    className="flex-1 py-1.5 px-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
                  >
                    View Report Card
                  </button>
                </div>
              </div>

              {/* Doc 3: Transport & Residency Particulars */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    {selectedChild.hostelRequired ? (
                      <Home className="w-5 h-5 text-amber-700" />
                    ) : (
                      <Bus className="w-5 h-5 text-amber-700" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {selectedChild.hostelRequired ? 'Hostel Residency' : 'Commute & Transport'}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      {selectedChild.hostelRequired ? 'Campus Resident' : 'Day Scholar'}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600">
                  {selectedChild.hostelRequired
                    ? `Hostel: ${selectedChild.hostelName || 'Senior Hostel'} • Room: ${selectedChild.hostelRoomNumber || 'N/A'}`
                    : `Transport Route: ${selectedChild.transportRouteName || 'Standard School Route'} • Stop: ${selectedChild.transportStopName || 'Assigned Stop'}`}
                </p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
                  >
                    Review Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODALS */}
      {selectedChild && (
        <>
          <PrintableIdCardModal
            isOpen={isIdCardModalOpen}
            onClose={() => setIsIdCardModalOpen(false)}
            student={selectedChild}
            settings={settings}
          />

          <PrintableReportCardModal
            isOpen={isReportCardModalOpen}
            onClose={() => setIsReportCardModalOpen(false)}
            student={selectedChild}
            settings={settings}
          />

          {isProfileModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
              <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
                <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      PARENT PORTAL • READ-ONLY
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      360° Profile: {selectedChild.name} ({selectedChild.className} - {selectedChild.section})
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsProfileModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="p-4 sm:p-6">
                  <StudentProfileView
                    student={selectedChild}
                    settings={settings}
                    onBack={() => setIsProfileModalOpen(false)}
                    onUpdate={(updated) => {
                      setParentChildren((prev) =>
                        prev.map((c) => (c.id === updated.id ? updated : c))
                      );
                    }}
                    userRole="PARENT"
                    currentUser={user}
                    onEdit={() => {}}
                    onOpenReportCard={(s) => {
                      setIsReportCardModalOpen(true);
                    }}
                    onOpenIdCard={(s) => {
                      setIsIdCardModalOpen(true);
                    }}
                    onOpenCertificate={() => {}}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
