import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CreditCard,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Printer,
  Eye,
  FileText,
  RefreshCw,
  AlertTriangle,
  Bus,
  Home,
  ShieldCheck,
  Check,
  Search,
  Filter,
  ArrowUpRight,
  QrCode,
  Building2,
  Layers,
  Landmark,
  ChevronRight,
  FileSpreadsheet,
  Receipt,
  BookOpen,
} from 'lucide-react';
import {
  FeeLedgerEntry,
  FeePayment,
  SchoolSettings,
  Student,
  User,
  ClassFeeConfiguration,
  StudentApplicableFeeHead,
} from '../../types';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { PrintableReceiptModal } from '../modals/PrintableReceiptModal';
import { InvoiceDetailModal } from '../modals/InvoiceDetailModal';
import { exportReceiptToPdf } from '../../utils/receiptPdfExporter';
import { fileUploadService } from '../../services/fileUploadService';
import { summarizeStudentFees } from '../../utils/parentFeeSummary';
import { classLabel, classSectionLabel } from '../../utils/classLabel';
import { usePhonePe, pollOrder } from '../../hooks/usePhonePe';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity } from '../../utils/schoolIdentity';

interface ParentFeesViewProps {
  currentUser?: User;
  settings: SchoolSettings;
  onNavigate?: (module: string) => void;
}

export const ParentFeesView: React.FC<ParentFeesViewProps> = ({
  currentUser: propUser,
  settings,
  onNavigate,
}) => {
  const user = propUser || authService.getCurrentUser() || authService.getStoredUser();

  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [parentChildren, setParentChildren] = useState<Student[]>([]);
  const [activeChildId, setActiveChildId] = useState<string>('');

  // Child financial records
  const [ledgers, setLedgers] = useState<FeeLedgerEntry[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [classFeeConfig, setClassFeeConfig] = useState<ClassFeeConfiguration | null>(null);

  // Active view tab under summary
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'PAYMENTS' | 'STRUCTURE'>('LEDGER');

  // Search & Filters
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('ALL');
  const [paymentSearch, setPaymentSearch] = useState<string>('');

  // Modals
  const [selectedReceiptForModal, setSelectedReceiptForModal] = useState<FeePayment | null>(null);
  const [selectedLedgerForModal, setSelectedLedgerForModal] = useState<FeeLedgerEntry | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<string | null>(null);

  // Online payment (PhonePe). The fee is shown as paid only when the server has verified it with PhonePe.
  const phonepe = usePhonePe();
  const [payingLedgerId, setPayingLedgerId] = useState<string | null>(null);
  const [payingFull, setPayingFull] = useState<boolean>(false);

  // Pays everything this child owes in one payment; the server adds up the bills and issues one receipt.
  const handlePayFull = async () => {
    if (payingLedgerId || payingFull || !activeChildId) return;
    setPayingFull(true);
    const result = await phonepe.payFull(activeChildId);
    setPayingFull(false);
    // Always reload from the server: it is the only source of truth for what is paid.
    loadChildFinancials(activeChildId, true);
    if (result.status === 'PENDING' && result.orderId) setWatchOrderId(result.orderId);
  };

  const handlePayOnline = async (ledger: FeeLedgerEntry) => {
    if (payingLedgerId || payingFull) return;
    setPayingLedgerId(ledger.id);
    const result = await phonepe.payLedger(ledger.id, activeChildId);
    setPayingLedgerId(null);
    loadChildFinancials(activeChildId, true);
    if (result.status === 'PENDING' && result.orderId) setWatchOrderId(result.orderId);
  };

  // A payment the bank has not confirmed yet (or one left open when the tab was closed / refreshed):
  // ask the server, which asks PhonePe, until it is settled. The fee only changes once the server says SUCCESS.
  const [watchOrderId, setWatchOrderId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!activeChildId || !phonepe.enabled) return;
    phonepe.fetchOpenPayments(activeChildId).then((open) => {
      if (cancelled) return;
      const pending = open.find((o) => o.paymentStatus === 'PENDING');
      if (pending) {
        setWatchOrderId(pending.orderId);
        phonepe.setPaymentResult({ success: false, status: 'PENDING', orderId: pending.orderId, message: pending.message || 'A payment is being confirmed by the bank. Your fee will update automatically — please do not pay again.' });
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChildId, phonepe.enabled]);

  // Back from PhonePe's full-page PayPage (used when PhonePe's iframe script could not load): /fees?phonepeOrder=<id>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const back = params.get('phonepeOrder');
    if (!back || !/^[A-Za-z0-9_-]{1,63}$/.test(back)) return;
    params.delete('phonepeOrder');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    phonepe.setPaymentResult({ success: false, status: 'PENDING', orderId: back, message: 'Confirming your payment with PhonePe…' });
    pollOrder(back).then((r) => {
      phonepe.setPaymentResult(r);
      if (activeChildId) loadChildFinancials(activeChildId, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!watchOrderId || !activeChildId) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      if (stop) return;
      tries++;
      const r = await phonepe.refreshPayment(watchOrderId);
      if (stop) return;
      if (r.status !== 'PENDING' || tries >= 24) {
        phonepe.setPaymentResult(r);
        setWatchOrderId(null);
        loadChildFinancials(activeChildId, true);
        return;
      }
      setTimeout(tick, 10000);
    };
    const first = setTimeout(tick, 5000);
    return () => { stop = true; clearTimeout(first); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchOrderId, activeChildId]);

  // Real-time listener for financial records
  useRealtimeListener(['FEE_PAYMENT', 'FEE_LEDGER', 'STUDENT', 'FEE_CONFIG', 'SESSION'], () => {
    if (activeChildId) {
      loadChildFinancials(activeChildId, true);
    }
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
        return (
          pPhone === cleanPhone ||
          fPhone === cleanPhone ||
          mPhone === cleanPhone ||
          gPhone === cleanPhone ||
          mob === cleanPhone
        );
      }
      return false;
    });

    const uniqueMap = new Map<string, Student>();
    matched.forEach((s) => uniqueMap.set(s.id, s));
    return Array.from(uniqueMap.values());
  }, [user]);

  const loadChildFinancials = async (childId: string, isSilent = false) => {
    if (!childId) return;
    if (!isSilent) setSyncing(true);

    try {
      // 1. Fetch authoritative student fee overview from backend
      const overview = await api.getStudentFeeOverview(childId);
      if (overview && overview.success) {
        if (Array.isArray(overview.ledgers)) setLedgers(overview.ledgers);
        if (Array.isArray(overview.payments)) setPayments(overview.payments);
      } else {
        // Fallback to separate authoritative endpoints
        const [freshLedgers, freshPayments] = await Promise.all([
          api.fetchFeeLedgers({ studentId: childId }),
          api.fetchFeePayments({ studentId: childId }),
        ]);
        setLedgers(freshLedgers || []);
        setPayments(freshPayments || []);
      }

      // 2. Resolve target student particulars and Class Fee Configuration
      const targetStudent =
        parentChildren.find((c) => c.id === childId) ||
        api.getStudentById(childId) ||
        (overview?.student as Student) ||
        null;

      if (targetStudent) {
        const allConfigs = api.getFeeConfigurationsSync();
        const matched =
          allConfigs.find(
            (c) =>
              (c.classId === targetStudent.classId ||
                c.className?.toLowerCase() === targetStudent.className?.toLowerCase()) &&
              (!c.academicSession ||
                c.academicSession === (targetStudent.academicSession || settings.currentAcademicSession || '2026-2027'))
          ) ||
          allConfigs.find(
            (c) =>
              c.classId === targetStudent.classId ||
              c.className?.toLowerCase() === targetStudent.className?.toLowerCase()
          ) ||
          null;

        setClassFeeConfig(matched);
      }
    } catch (err) {
      console.warn('[ParentFeesView] Error loading child fee data:', err);
      // Fallback to local synchronous cache
      setLedgers(api.getFeeLedgersSync(childId));
      setPayments(api.getFeePayments(childId));
    } finally {
      setSyncing(false);
    }
  };

  const refreshChildrenAndData = async () => {
    setLoading(true);
    try {
      const serverChildren = await api.fetchLinkedChildren();
      let childrenList: Student[] = [];
      if (Array.isArray(serverChildren) && serverChildren.length > 0) {
        childrenList = serverChildren;
      } else {
        childrenList = loadInitialChildren();
      }

      setParentChildren(childrenList);

      const resolvedActiveId =
        (activeChildId && childrenList.some((c) => c.id === activeChildId) ? activeChildId : null) ||
        (user?.activeStudentId && childrenList.some((c) => c.id === user.activeStudentId)
          ? user.activeStudentId
          : null) ||
        (childrenList[0]?.id || '');

      setActiveChildId(resolvedActiveId);
      if (resolvedActiveId) {
        await loadChildFinancials(resolvedActiveId);
      }
    } catch (err) {
      console.warn('[ParentFeesView] Error refreshing children:', err);
      const fallback = loadInitialChildren();
      setParentChildren(fallback);
      if (fallback.length > 0) {
        const fallbackId = fallback[0].id;
        setActiveChildId(fallbackId);
        await loadChildFinancials(fallbackId);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshChildrenAndData();
  }, []);

  const handleSelectChild = async (childId: string) => {
    if (childId === activeChildId) return;
    setActiveChildId(childId);
    setLedgers([]);
    setPayments([]);
    setClassFeeConfig(null);

    try {
      await authService.switchChild(childId);
      await loadChildFinancials(childId);
    } catch (e) {
      console.warn('[ParentFeesView] Error switching child:', e);
      await loadChildFinancials(childId);
    }
  };

  const selectedChild = useMemo(() => {
    if (!activeChildId) return parentChildren[0] || null;
    return parentChildren.find((c) => c.id === activeChildId) || parentChildren[0] || null;
  }, [parentChildren, activeChildId]);

  // Same ledger-based summary used by the Dashboard and My Children (utils/parentFeeSummary).
  const financialSummary = useMemo(() => summarizeStudentFees(ledgers, payments), [ledgers, payments]);

  // Filtered Ledgers
  const filteredLedgers = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    return ledgers.filter((l) => {
      const baseAmt = Number(l.amount ?? l.total ?? 0);
      const fineAmt = Number(l.fine || 0);
      const totalAmt = Number(l.total ?? l.totalAmount ?? baseAmt + fineAmt);
      const paidAmt = Number(l.paidAmount || 0);
      const pendingAmt = Number(l.pendingAmount ?? Math.max(0, totalAmt - paidAmt));
      const isOverdue =
        l.status === 'OVERDUE' || (pendingAmt > 0 && Boolean(l.dueDate && l.dueDate < todayStr));

      if (ledgerFilter === 'PAID') {
        if (l.status !== 'PAID' && pendingAmt > 0) return false;
      } else if (ledgerFilter === 'PENDING') {
        if (pendingAmt <= 0 || isOverdue) return false;
      } else if (ledgerFilter === 'OVERDUE') {
        if (!isOverdue) return false;
      }

      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase().trim();
        const matchInv = (l.invoiceNumber || l.id || '').toLowerCase().includes(q);
        const matchType = (l.feeType || l.feeMonth || l.monthYear || '').toLowerCase().includes(q);
        return matchInv || matchType;
      }

      return true;
    });
  }, [ledgers, ledgerFilter, ledgerSearch]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (!paymentSearch.trim()) return true;
      const q = paymentSearch.toLowerCase().trim();
      const matchRec = (p.receiptNumber || p.id || '').toLowerCase().includes(q);
      const matchType = (p.feeType || '').toLowerCase().includes(q);
      const matchMode = (p.paymentMethod || '').toLowerCase().includes(q);
      const matchRef = (p.transactionReference || '').toLowerCase().includes(q);
      return matchRec || matchType || matchMode || matchRef;
    });
  }, [payments, paymentSearch]);

  const handleDownloadReceiptPdf = async (payment: FeePayment) => {
    if (!selectedChild) return;
    try {
      setIsExportingPdf(payment.id || payment.receiptNumber);
      await exportReceiptToPdf({
        payment,
        settings,
        student: selectedChild,
        ledger: ledgers.find((l) => l.id === payment.ledgerId) || null,
      });
    } catch (err) {
      console.error('[ParentFeesView] Failed to download receipt PDF:', err);
      alert('Unable to export receipt PDF. Please try again or preview receipt.');
    } finally {
      setIsExportingPdf(null);
    }
  };

  if (loading && parentChildren.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl border border-slate-200 p-8">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <h3 className="text-sm font-bold text-slate-800">Loading Student Fee Records</h3>
        <p className="text-xs text-slate-500 mt-1">Loading fee details…</p>
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
            No registered student records are linked to your parent phone number ({user?.phone || 'Registered Phone'}).
          </p>
        </div>
        <button
          onClick={() => refreshChildrenAndData()}
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
      {/* 1. TOP BANNER & CONTEXT */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
              <CreditCard className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  {user?.role === 'STUDENT' ? 'STUDENT PORTAL' : 'PARENT PORTAL'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Read-Only Financial Records
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                Fees & Accounts Ledger
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                CHANAKYA PUBLIC SCHOOL & COACHING CENTRE • Session {settings.currentAcademicSession || '2026-2027'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeChildId) loadChildFinancials(activeChildId);
                else refreshChildrenAndData();
              }}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Fee Records'}</span>
            </button>
          </div>
        </div>

        {/* 2. SIBLINGS / MULTI-CHILD SWITCHER */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-900">
                {user?.role === 'STUDENT' ? 'My Fees' : `Select Sibling to View Fees (${parentChildren.length} Linked)`}
              </span>
            </div>
            {user?.role !== 'STUDENT' && (
              <span className="text-[11px] text-slate-500">
                Click to view student-specific invoices & receipts
              </span>
            )}
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
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500'
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
                      <div className="w-full h-full flex items-center justify-center font-bold text-emerald-800 text-sm bg-emerald-100">
                        {child.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{child.name}</h4>
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
          {/* 3. SELECTED CHILD PARTICULARS & ENROLLMENT IDENTITY CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs">
                  {(() => {
                    const rawPhoto =
                      selectedChild.photo || selectedChild.photoFileKey || (selectedChild as any).avatar || '';
                    const photoSrc = rawPhoto ? fileUploadService.getFileUrl(rawPhoto) : '';
                    return photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={selectedChild.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-black text-xl text-emerald-800 bg-emerald-100">
                        {selectedChild.name.slice(0, 2).toUpperCase()}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {selectedChild.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-100 text-emerald-800">
                      {selectedChild.admissionNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {classLabel(selectedChild.className)}{selectedChild.section ? ` (${selectedChild.section})` : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 mt-2">
                    <p>
                      <span className="font-semibold text-slate-700">Father / Guardian:</span>{' '}
                      <span className="text-slate-800">
                        {selectedChild.fatherName || selectedChild.parentName || 'N/A'}
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Parent Mobile:</span>{' '}
                      <span className="font-mono text-slate-800">
                        {selectedChild.parentPhone || selectedChild.fatherMobile || selectedChild.mobile || 'N/A'}
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Academic Session:</span>{' '}
                      <span className="text-slate-800 font-medium">
                        {selectedChild.academicSession || settings.currentAcademicSession || '2026-2027'}
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Enrollment Date:</span>{' '}
                      <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {selectedChild.enrollmentDate || selectedChild.admissionDate || 'N/A'}
                      </span>
                    </p>
                  </div>

                  {/* Facilities Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                    {selectedChild.transportRequired ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                        <Bus className="w-3 h-3 text-amber-700" />
                        <span>Transport: {selectedChild.transportStopName || 'Active Route'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 text-[11px]">
                        <Bus className="w-3 h-3 text-slate-400" />
                        <span>Transport: Day Scholar</span>
                      </span>
                    )}

                    {selectedChild.hostelRequired ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-medium">
                        <Home className="w-3 h-3 text-blue-700" />
                        <span>Hostel: {selectedChild.hostelName || 'Campus Resident'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 text-[11px]">
                        <Home className="w-3 h-3 text-slate-400" />
                        <span>Hostel: Day Scholar</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. AUTHORITATIVE FINANCIAL SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Billed */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">
                Total Billed
              </span>
              <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-mono">
                ₹{financialSummary.totalBilled.toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {ledgers.length} official bill{ledgers.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Total Paid */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">
                Total Paid
              </span>
              <p className="text-lg sm:text-xl font-black text-emerald-700 mt-1 font-mono">
                ₹{financialSummary.totalPaid.toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-emerald-600 mt-1 block">
                {payments.length} verified receipt{payments.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Net Outstanding Balance */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">
                Net Outstanding
              </span>
              <p
                className={`text-lg sm:text-xl font-black mt-1 font-mono ${
                  financialSummary.totalPending > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                ₹{financialSummary.totalPending.toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {financialSummary.totalPending > 0 ? 'Pending settlement' : 'Fully Cleared'}
              </span>
            </div>

            {/* Overdue Amount */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">
                Overdue Charges
              </span>
              <p
                className={`text-lg sm:text-xl font-black mt-1 font-mono ${
                  financialSummary.overdue > 0 ? 'text-rose-700' : 'text-slate-800'
                }`}
              >
                ₹{financialSummary.overdue.toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-rose-600 mt-1 block">
                {financialSummary.overdue > 0 ? 'Past due date' : 'No overdue bills'}
              </span>
            </div>

            {/* Current Month Due */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-500 block">
                Current Month Due
              </span>
              <p className="text-lg sm:text-xl font-black text-amber-700 mt-1 font-mono">
                ₹{financialSummary.currentMonthDue.toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Quick Notice Banner if Dues are Outstanding */}
          {financialSummary.totalPending > 0 && (
            <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-orange-50 p-4 sm:p-5 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Outstanding Balance: ₹{financialSummary.totalPending.toLocaleString('en-IN')}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {financialSummary.overdue > 0
                      ? `Includes ₹${financialSummary.overdue.toLocaleString(
                          'en-IN'
                        )} in overdue charges. ${phonepe.enabled ? 'Pay online below or at the school accounts counter.' : 'Please pay at the school accounts counter or via official school bank transfer.'}`
                      : `${phonepe.enabled ? 'Pay online below or visit the school office.' : 'Student has current fee invoices pending settlement at the school office.'}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {phonepe.enabled && (
                  <button
                    onClick={handlePayFull}
                    disabled={payingFull || phonepe.paying || Boolean(payingLedgerId)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:cursor-wait"
                    title="Pay every unpaid bill in one payment and get one receipt"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{payingFull ? 'Processing…' : `Pay Full ₹${financialSummary.totalPending.toLocaleString('en-IN')}`}</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('LEDGER')}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Review Invoices
                </button>
              </div>
            </div>
          )}

          {/* Online Payment Result Toast */}
          {phonepe.paymentResult && (
            <div
              role="status"
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                phonepe.paymentResult.success
                  ? 'bg-emerald-50 border-emerald-200'
                  : phonepe.paymentResult.status === 'PENDING'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {phonepe.paymentResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className={`w-5 h-5 shrink-0 ${phonepe.paymentResult.status === 'PENDING' ? 'text-amber-600' : 'text-red-600'}`} />
                )}
                <span className={`text-sm font-semibold ${phonepe.paymentResult.success ? 'text-emerald-800' : phonepe.paymentResult.status === 'PENDING' ? 'text-amber-800' : 'text-red-800'}`}>
                  {phonepe.paymentResult.message}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {phonepe.paymentResult.success && phonepe.paymentResult.payment && (
                  <button
                    onClick={() => handleDownloadReceiptPdf(phonepe.paymentResult!.payment as FeePayment)}
                    disabled={isExportingPdf === (phonepe.paymentResult.payment.id || phonepe.paymentResult.payment.receiptNumber)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-wait"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Receipt</span>
                  </button>
                )}
                <button
                  onClick={phonepe.clearResult}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* 5. APPLICABLE CLASS-WISE FEE STRUCTURE & FEE HEADS */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Applicable Class-Wise Fee Structure & Fee Heads</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {classLabel(selectedChild.className)}{selectedChild.academicSession ? ` • Academic Session ${selectedChild.academicSession}` : ''}
                </p>
              </div>

              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                One-Time Charges vs. Recurring Monthly Fees
              </span>
            </div>

            {/* Structured Fee Heads from student.feeProfile or classFeeConfig */}
            {(() => {
              const profile = selectedChild.feeProfile;
              const heads = profile?.feeHeads?.filter((h) => h.selected) || [];

              // If student has explicit feeProfile heads
              if (heads.length > 0) {
                const oneTime = profile?.totalOneTimeFee ?? 0;
                const monthly = profile?.monthlyPayableAmount ?? 0;
                const annual = profile?.totalApplicableFee ?? 0;

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <span className="text-[10px] uppercase font-bold text-blue-700 block">
                          One-Time Admission Dues
                        </span>
                        <strong className="text-blue-950 text-base font-black font-mono">
                          ₹{oneTime.toLocaleString('en-IN')}
                        </strong>
                        <span className="text-[10px] text-blue-600 block mt-0.5">Payable once at intake</span>
                      </div>
                      <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                          Monthly Recurring Fee
                        </span>
                        <strong className="text-emerald-950 text-base font-black font-mono">
                          ₹{monthly.toLocaleString('en-IN')}/mo
                        </strong>
                        <span className="text-[10px] text-emerald-600 block mt-0.5">Regular monthly tuition</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Annual Commitment
                        </span>
                        <strong className="text-slate-900 text-base font-black font-mono">
                          ₹{annual.toLocaleString('en-IN')}
                        </strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Total for session</span>
                      </div>
                      <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                        <span className="text-[10px] uppercase font-bold text-purple-700 block">
                          Active Fee Heads
                        </span>
                        <strong className="text-purple-950 text-base font-black font-mono">
                          {heads.length} Heads
                        </strong>
                        <span className="text-[10px] text-purple-600 block mt-0.5">Applicable to student</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4">Fee Head Name</th>
                            <th className="py-2.5 px-4">Billing Category</th>
                            <th className="py-2.5 px-4">Frequency</th>
                            <th className="py-2.5 px-4 text-right">Applicable Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {heads.map((h, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 font-semibold text-slate-900">{h.head}</td>
                              <td className="py-2.5 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    h.category === 'ONE_TIME'
                                      ? 'bg-blue-100 text-blue-800'
                                      : h.category === 'MONTHLY'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {h.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">{h.frequency}</td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                                ₹{Number(h.amount).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              // Fallback to ClassFeeConfiguration
              if (classFeeConfig) {
                const admissionFee = Number(classFeeConfig.admissionFee) || 0;
                const uniformFee = Number(classFeeConfig.dressCodeFee) || 0;
                const schoolFee = Number(classFeeConfig.monthlySchoolFee || classFeeConfig.monthlyTuitionFee) || 0;
                const examFee = Number(classFeeConfig.examFee) || 0;
                const booksFee = Number(classFeeConfig.booksFee || classFeeConfig.booksStationeryFee) || 0;
                const idCardFee = Number(classFeeConfig.idCardFee) || 0;
                const computerFee = Number(classFeeConfig.computerFee || classFeeConfig.computerSmartClassFee) || 0;
                const sportsFee = Number(classFeeConfig.sportsFee) || 0;
                const annualCharges = Number(classFeeConfig.annualCharges) || 0;

                const feeRows = [
                  { head: 'Admission Fee', category: 'ONE_TIME', frequency: 'One Time (Intake)', amount: admissionFee },
                  { head: 'Uniform / Dress Code Fee', category: 'ONE_TIME', frequency: 'One Time (Intake)', amount: uniformFee },
                  { head: 'Monthly School & Tuition Fee', category: 'MONTHLY', frequency: 'Monthly', amount: schoolFee },
                  { head: 'Books & Stationery', category: 'YEARLY', frequency: 'Session Annual', amount: booksFee },
                  { head: 'Examination Fee', category: 'EXAMINATION', frequency: 'Assessment Cycle', amount: examFee },
                  { head: 'Student ID Card Fee', category: 'YEARLY', frequency: 'Session Annual', amount: idCardFee },
                  { head: 'Computer & Smart Class Fee', category: 'MONTHLY', frequency: 'Monthly', amount: computerFee },
                  { head: 'Sports & Cultural Fee', category: 'YEARLY', frequency: 'Session Annual', amount: sportsFee },
                  { head: 'Annual Development Charges', category: 'YEARLY', frequency: 'Session Annual', amount: annualCharges },
                ].filter((r) => r.amount > 0);

                const oneTimeTotal = admissionFee + uniformFee;
                const monthlyTotal = schoolFee + computerFee;

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <span className="text-[10px] uppercase font-bold text-blue-700 block">
                          One-Time Admission Heads
                        </span>
                        <strong className="text-blue-950 text-base font-black font-mono">
                          ₹{oneTimeTotal.toLocaleString('en-IN')}
                        </strong>
                        <span className="text-[10px] text-blue-600 block mt-0.5">Admission & Uniform</span>
                      </div>
                      <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                          Monthly Regular Heads
                        </span>
                        <strong className="text-emerald-950 text-base font-black font-mono">
                          ₹{monthlyTotal.toLocaleString('en-IN')}/mo
                        </strong>
                        <span className="text-[10px] text-emerald-600 block mt-0.5">Tuition & Smart Class</span>
                      </div>
                      <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                        <span className="text-[10px] uppercase font-bold text-purple-700 block">
                          Configured Heads
                        </span>
                        <strong className="text-purple-950 text-base font-black font-mono">
                          {feeRows.length} Active Heads
                        </strong>
                        <span className="text-[10px] text-purple-600 block mt-0.5">{classLabel(classFeeConfig.className)}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Academic Session
                        </span>
                        <strong className="text-slate-900 text-sm font-black font-mono">
                          {classFeeConfig.academicSession || '2026-2027'}
                        </strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{schoolIdentity(api.getSettings()).board || NOT_CONFIGURED}</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4">Fee Head</th>
                            <th className="py-2.5 px-4">Category</th>
                            <th className="py-2.5 px-4">Frequency</th>
                            <th className="py-2.5 px-4 text-right">Applicable Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {feeRows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 font-semibold text-slate-900">{r.head}</td>
                              <td className="py-2.5 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    r.category === 'ONE_TIME'
                                      ? 'bg-blue-100 text-blue-800'
                                      : r.category === 'MONTHLY'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {r.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">{r.frequency}</td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                                ₹{r.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              return (
                <div className="p-5 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  Standard class fee schedule is configured in school administration records.
                </div>
              );
            })()}
          </div>

          {/* 6. TABS: STUDENT FEE LEDGER & INVOICES vs. PAYMENT RECEIPTS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Tabs Header */}
            <div className="border-b border-slate-200 px-4 pt-3 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  id="tab-parent-ledgers"
                  onClick={() => setActiveTab('LEDGER')}
                  className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'LEDGER'
                      ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Student Fee Invoices & Ledger</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === 'LEDGER' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {ledgers.length}
                  </span>
                </button>

                <button
                  id="tab-parent-payments"
                  onClick={() => setActiveTab('PAYMENTS')}
                  className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'PAYMENTS'
                      ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>Verified Payment Receipts & History</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === 'PAYMENTS' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {payments.length}
                  </span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: INVOICES & LEDGER */}
            {activeTab === 'LEDGER' && (
              <div className="p-4 sm:p-5 space-y-4">
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search by invoice number or fee description..."
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                    {(['ALL', 'PENDING', 'OVERDUE', 'PAID'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setLedgerFilter(filter)}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                          ledgerFilter === filter
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredLedgers.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Invoice No</th>
                          <th className="py-2.5 px-4">Particulars / Period</th>
                          <th className="py-2.5 px-4">Due Date</th>
                          <th className="py-2.5 px-4 text-right">Base Amount</th>
                          <th className="py-2.5 px-4 text-right">Late Fee</th>
                          <th className="py-2.5 px-4 text-right">Total Invoiced</th>
                          <th className="py-2.5 px-4 text-right">Paid</th>
                          <th className="py-2.5 px-4 text-right">Outstanding</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLedgers.map((l) => {
                          const baseAmt = Number(l.amount ?? l.total ?? 0);
                          const fineAmt = Number(l.fine || 0);
                          const totalAmt = Number(l.total ?? l.totalAmount ?? baseAmt + fineAmt);
                          const paidAmt = Number(l.paidAmount || 0);
                          const pendingAmt = Number(l.pendingAmount ?? Math.max(0, totalAmt - paidAmt));
                          const todayStr = new Date().toISOString().substring(0, 10);
                          const isOverdue =
                            l.status === 'OVERDUE' ||
                            (pendingAmt > 0 && Boolean(l.dueDate && l.dueDate < todayStr));

                          return (
                            <tr key={l.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-mono font-bold text-blue-700">
                                {l.invoiceNumber || l.id}
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-900">
                                {l.feeType || l.feeMonth || l.monthYear || 'Fee Charge'}
                              </td>
                              <td className="py-3 px-4 text-slate-600">{l.dueDate || '—'}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-700">
                                ₹{baseAmt.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-amber-700">
                                {fineAmt > 0 ? `₹${fineAmt.toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                ₹{totalAmt.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                                ₹{paidAmt.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-black text-amber-800">
                                ₹{pendingAmt.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {l.status === 'PAID' || pendingAmt <= 0 ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    PAID
                                  </span>
                                ) : isOverdue ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                    OVERDUE
                                  </span>
                                ) : paidAmt > 0 ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                    PARTIAL
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    PENDING
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {phonepe.enabled && pendingAmt > 0 && (
                                    <button
                                      onClick={() => handlePayOnline(l)}
                                      disabled={payingLedgerId === l.id || phonepe.paying || payingFull}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold transition-colors cursor-pointer disabled:cursor-wait"
                                    >
                                      <CreditCard className="w-3 h-3" />
                                      <span>{payingLedgerId === l.id ? 'Processing…' : 'Pay Now'}</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setSelectedLedgerForModal(l)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3 text-slate-500" />
                                    <span>View Bill</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    No fee invoices matching the selected criteria. Official billing records will appear here upon generation.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: OFFICIAL PAYMENT RECEIPTS */}
            {activeTab === 'PAYMENTS' && (
              <div className="p-4 sm:p-5 space-y-4">
                {/* Search Toolbar */}
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by receipt number, payment mode, or transaction reference..."
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {filteredPayments.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Receipt No</th>
                          <th className="py-2.5 px-4">Payment Date</th>
                          <th className="py-2.5 px-4">Particulars</th>
                          <th className="py-2.5 px-4 text-right">Amount Paid</th>
                          <th className="py-2.5 px-4">Payment Mode</th>
                          <th className="py-2.5 px-4">Reference No</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-mono font-bold text-blue-700">
                              {p.receiptNumber}
                            </td>
                            <td className="py-3 px-4 text-slate-600">{p.paymentDate}</td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {p.feeType || 'Institutional Fee Payment'}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-slate-900 font-mono">
                              ₹{(Number(p.amount) || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-700">
                                {p.paymentMethod || 'CASH'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                              {p.transactionReference || 'Counter Entry'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                PAID & RECONCILED
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedReceiptForModal(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
                                  title="Preview & Print Receipt"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Preview</span>
                                </button>
                                <button
                                  onClick={() => handleDownloadReceiptPdf(p)}
                                  disabled={isExportingPdf === (p.id || p.receiptNumber)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                  title="Download Single-Page PDF"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    No payment receipts found matching your search. Official receipts issued by the school accounts counter will appear here once verified.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. OFFICIAL INSTITUTIONAL BANK ACCOUNT & UPI DETAILS */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-xl">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Official School Payment & Bank Transfer Information
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    CHANAKYA PUBLIC SCHOOL & COACHING CENTRE • Institutional Accounts Desk
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-400/30">
                Verified School Accounts
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Card 1: Bank Transfer / NEFT / IMPS */}
              <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10 space-y-2">
                <span className="text-[10px] font-bold text-blue-300 block">
                  Direct Bank Account (NEFT / RTGS / IMPS)
                </span>
                <div className="space-y-1.5 font-mono text-slate-200">
                  <p>
                    <span className="text-slate-400">Account Name:</span>{' '}
                    <strong className="text-white font-sans">
                      {settings.schoolName || 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">Bank Name:</span>{' '}
                    <strong className="text-white">
                      {(settings as any).bankDetails?.bankName || 'State Bank of India'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">Account Number:</span>{' '}
                    <strong className="text-emerald-300">
                      {(settings as any).bankDetails?.accountNumber || '39920194821'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">IFSC Code:</span>{' '}
                    <strong className="text-yellow-300">
                      {(settings as any).bankDetails?.ifscCode || 'SBIN0002931'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">Branch:</span>{' '}
                    <span className="text-slate-300">
                      {(settings as any).bankDetails?.branch || 'Sheohar Main Branch, Bihar - 843329'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Card 2: UPI / QR Payment */}
              <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10 space-y-2">
                <span className="text-[10px] font-bold text-emerald-300 block">
                  Official UPI (PhonePe / Google Pay / Paytm / BHIM)
                </span>
                <div className="space-y-1.5 font-mono text-slate-200">
                  <p>
                    <span className="text-slate-400">Virtual Payment Address (VPA):</span>{' '}
                    <strong className="text-emerald-300 font-sans block text-sm mt-0.5">
                      {(settings as any).upiDetails?.upiId || 'Not configured'}
                    </strong>
                  </p>
                  <p className="text-[11px] text-slate-300 pt-1 font-sans">
                    All major Indian banking & UPI applications are supported.
                  </p>
                </div>

                <div className="pt-2 text-[10px] text-amber-200 bg-amber-500/10 p-2.5 rounded-lg border border-amber-400/20 font-sans">
                  <strong>Important Notice for {user?.role === 'STUDENT' ? 'Students' : 'Parents'}:</strong> When transferring fees via NEFT or UPI, please specify {user?.role === 'STUDENT' ? 'your' : "your child's"} <strong>Admission Number ({selectedChild.admissionNumber})</strong> in the transaction remarks. Counter payment receipts are verified and logged by the accounts department.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODALS */}
      {selectedReceiptForModal && (
        <PrintableReceiptModal
          isOpen={Boolean(selectedReceiptForModal)}
          onClose={() => setSelectedReceiptForModal(null)}
          payment={selectedReceiptForModal}
          student={selectedChild}
          settings={settings}
        />
      )}

      {selectedLedgerForModal && (
        <InvoiceDetailModal
          isOpen={Boolean(selectedLedgerForModal)}
          onClose={() => setSelectedLedgerForModal(null)}
          ledger={selectedLedgerForModal}
          student={selectedChild}
          settings={settings}
          payments={payments}
        />
      )}
    </div>
  );
};
