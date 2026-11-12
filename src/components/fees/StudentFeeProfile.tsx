import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  PlusCircle,
  CreditCard,
  Printer,
  FileText,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Phone,
  Home,
  Bus,
  Download,
  Eye,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import { Student, FeeLedgerEntry, FeePayment, SchoolSettings } from '../../types';
import { api } from '../../services/api';
import { fileUploadService } from '../../services/fileUploadService';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { formatDateDisplay } from '../../utils/feeDateHelper';
import { classLabel, inr, ledgerStatus } from './feeFormat';
import { StatusPill } from '../modals/CollectPaymentModal';
import { exportReceiptToPdf } from '../../utils/receiptPdfExporter';
import { InvoiceDetailModal } from '../modals/InvoiceDetailModal';
import { AddBillModal } from '../modals/AddBillModal';
import { CollectPaymentModal } from '../modals/CollectPaymentModal';
import { GenerateInvoiceModal } from '../modals/GenerateInvoiceModal';
import { PrintableReceiptModal } from '../modals/PrintableReceiptModal';

interface StudentFeeProfileProps {
  studentId: string;
  onBack: () => void;
  onSelectStudent?: (studentId: string) => void;
  settings: SchoolSettings;
}

export const StudentFeeProfile: React.FC<StudentFeeProfileProps> = ({
  studentId,
  onBack,
  onSelectStudent,
  settings,
}) => {
  // 1. Dynamic Student Profile from Backend / MongoDB
  const [student, setStudent] = useState<Student | null>(() => {
    return api.getStudents().find((s) => s.id === studentId) || null;
  });
  const [isLoadingStudent, setIsLoadingStudent] = useState<boolean>(!student);

  // Dynamic photo resolution from student/storage API
  const studentPhotoCandidate =
    student?.photo ||
    student?.photoFileKey ||
    (student as any)?.avatar ||
    (student as any)?.profilePhoto;
  const studentPhotoUrl = studentPhotoCandidate
    ? fileUploadService.getFileUrl(studentPhotoCandidate)
    : '';
  const [photoError, setPhotoError] = useState<boolean>(false);

  useEffect(() => {
    setPhotoError(false);
  }, [studentId, studentPhotoUrl]);

  // Load student data dynamically from existing student backend API
  useEffect(() => {
    let isMounted = true;
    const loadDynamicStudent = async () => {
      try {
        const fullStudent = await api.fetchStudentDirect(studentId);
        if (isMounted && fullStudent) {
          setStudent(fullStudent);
        }
      } catch (err) {
        console.warn('Could not load dynamic student:', err);
      } finally {
        if (isMounted) setIsLoadingStudent(false);
      }
    };
    loadDynamicStudent();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  // Overall ledgers & payments for financial summary calculations & modals
  const [allLedgers, setAllLedgers] = useState<FeeLedgerEntry[]>(() =>
    api.getFeeLedgersSync(studentId)
  );
  const [allPayments, setAllPayments] = useState<FeePayment[]>(() =>
    api.getFeePayments().filter((p) => p.studentId === studentId)
  );
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Active Tab: Under Outstanding Balance, separated into 2 independent pages/tabs
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'PAYMENTS'>('LEDGER');

  // Tab 1: Student Fee Ledger & Invoices (Server-Side Paginated)
  const [ledgerRows, setLedgerRows] = useState<FeeLedgerEntry[]>([]);
  const [ledgerPagination, setLedgerPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(false);

  // Tab 2: Payment & Receipt History (Server-Side Paginated)
  const [paymentRows, setPaymentRows] = useState<FeePayment[]>([]);
  const [paymentPagination, setPaymentPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [paymentSearch, setPaymentSearch] = useState<string>('');
  const [isPaymentLoading, setIsPaymentLoading] = useState<boolean>(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  // Modals state
  const [isCollectModalOpen, setIsCollectModalOpen] = useState<boolean>(false);
  const [isPayFullMode, setIsPayFullMode] = useState<boolean>(false);
  const [selectedLedgerForPayment, setSelectedLedgerForPayment] = useState<FeeLedgerEntry | null>(null);
  const [isAddBillModalOpen, setIsAddBillModalOpen] = useState<boolean>(false);
  const [isGenerateInvoiceModalOpen, setIsGenerateInvoiceModalOpen] = useState<boolean>(false);
  const [selectedLedgerForInvoiceModal, setSelectedLedgerForInvoiceModal] =
    useState<FeeLedgerEntry | null>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<FeePayment | null>(null);

  // Quick switcher search input
  const [switcherQuery, setSwitcherQuery] = useState<string>('');
  const [isSwitcherOpen, setIsSwitcherOpen] = useState<boolean>(false);
  const students = api.getStudents();

  // Load Tab 1: Student Fee Ledger & Invoices
  const fetchLedgersPaginated = useCallback(
    async (page = ledgerPagination.page, filter = invoiceFilter, search = ledgerSearch) => {
      setIsLedgerLoading(true);
      try {
        const res = await api.getStudentFeeLedgersPaginated(studentId, {
          page,
          limit: ledgerPagination.limit,
          status: filter,
          search: search.trim() || undefined,
        });
        if (res && res.data) {
          setLedgerRows(res.data);
          setLedgerPagination(res.pagination);
        }
      } catch (err) {
        console.warn('Failed to fetch paginated fee ledgers:', err);
      } finally {
        setIsLedgerLoading(false);
      }
    },
    [studentId, ledgerPagination.limit, ledgerPagination.page, invoiceFilter, ledgerSearch]
  );

  // Load Tab 2: Payment & Receipt History
  const fetchPaymentsPaginated = useCallback(
    async (page = paymentPagination.page, search = paymentSearch) => {
      setIsPaymentLoading(true);
      try {
        const res = await api.fetchFeePaymentsPaginated({
          studentId,
          page,
          limit: paymentPagination.limit,
          search: search.trim() || undefined,
        });
        if (res && res.data) {
          setPaymentRows(res.data);
          setPaymentPagination(res.pagination);
        }
      } catch (err) {
        console.warn('Failed to fetch paginated fee payments:', err);
      } finally {
        setIsPaymentLoading(false);
      }
    },
    [studentId, paymentPagination.limit, paymentPagination.page, paymentSearch]
  );

  // Comprehensive data refresh
  const refreshData = useCallback(async () => {
    try {
      setIsLoadingSummary(true);
      await api.getFeeLedgers();
      const updatedAllLedgers = api.getFeeLedgersSync(studentId);
      setAllLedgers(updatedAllLedgers);

      const updatedPayments = await api.fetchFeePayments({ studentId });
      setAllPayments(updatedPayments || []);

      // Refresh both tabs with fresh server data
      await Promise.all([
        fetchLedgersPaginated(ledgerPagination.page, invoiceFilter, ledgerSearch),
        fetchPaymentsPaginated(paymentPagination.page, paymentSearch),
      ]);
    } catch (e) {
      console.warn('Error refreshing student fee profile:', e);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [studentId, fetchLedgersPaginated, fetchPaymentsPaginated, ledgerPagination.page, invoiceFilter, ledgerSearch, paymentPagination.page, paymentSearch]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [studentId]);

  // Re-fetch ledger tab when filter or search changes
  useEffect(() => {
    fetchLedgersPaginated(1, invoiceFilter, ledgerSearch);
  }, [invoiceFilter, ledgerSearch]);

  // Re-fetch payments tab when search changes
  useEffect(() => {
    fetchPaymentsPaginated(1, paymentSearch);
  }, [paymentSearch]);

  // Real-time listener for live fee and payment sync
  useRealtimeListener(['FEE_LEDGER', 'FEE_PAYMENT', 'STUDENT'], () => {
    refreshData();
  });

  // Calculate Financial Summaries dynamically from real MongoDB allLedgers
  const financialSummary = useMemo(() => {
    let totalFee = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let overdue = 0;
    let currentMonthDue = 0;

    const todayStr = new Date().toISOString().substring(0, 10);
    const currentMonthLabel = new Date().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    allLedgers.forEach((l) => {
      const billTotal = Number(l.total ?? l.amount ?? 0);
      const billPaid = Number(l.paidAmount ?? 0);
      const billPending = Number(
        l.pendingAmount ?? Math.max(0, billTotal - billPaid)
      );

      totalFee += billTotal;
      totalPaid += billPaid;
      totalPending += billPending;

      if (billPending > 0 && l.dueDate && l.dueDate < todayStr) {
        overdue += billPending;
      }

      if (
        billPending > 0 &&
        (l.feeMonth === currentMonthLabel ||
          l.monthYear === currentMonthLabel ||
          (l.feeType && l.feeType.includes(currentMonthLabel)))
      ) {
        currentMonthDue += billPending;
      }
    });

    return {
      totalFee,
      totalPaid,
      totalPending,
      overdue,
      currentMonthDue,
    };
  }, [allLedgers]);

  // Transport & Hostel fee helpers
  const studentTransportFee = useMemo(() => {
    if (!student?.transportRequired) return 0;
    if (student.transportMonthlyFee) return Number(student.transportMonthlyFee);
    const slabs = api.getTransportSlabsSync();
    const slab = slabs.find((s) => s.id === student.transportSlabId || s.id === student.transportRouteId);
    return slab ? Number(slab.monthlyFee || slab.monthlyAmount || 0) : 0;
  }, [student]);

  const studentHostelFee = useMemo(() => {
    if (!student?.hostelRequired) return 0;
    const cfg = api.getEffectiveFeeConfig(student.classId, student.section, student.academicSession, student.category);
    const hostelAmt = Number(student.hostelMonthlyFee ?? cfg?.hostelFee ?? 0);
    const messAmt = Number(student.messMonthlyFee ?? cfg?.messFee ?? 0);
    return hostelAmt + messAmt;
  }, [student]);

  // Matching students for quick switcher
  const matchingSwitcherStudents = useMemo(() => {
    if (!switcherQuery.trim()) return [];
    const q = switcherQuery.toLowerCase().trim();
    return students
      .filter(
        (s) =>
          Boolean(
            s &&
            s.id !== studentId &&
            (((s.name || '').toLowerCase().includes(q)) ||
              ((s.admissionNumber || '').toLowerCase().includes(q)) ||
              (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)))
          )
      )
      .slice(0, 5);
  }, [students, switcherQuery, studentId]);

  // Loading state when initial student is being fetched
  if (isLoadingStudent && !student) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-800">Loading Student Fee Profile...</h3>
        <p className="text-xs text-slate-500 mt-1">Fetching student records and fee ledger from database.</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Student Record Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">
          The requested student ID could not be loaded from the database.
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
        >
          Return to Fee Ledger
        </button>
      </div>
    );
  }

  // Quick Pay Full Due handler: opens existing Collect Fee modal with full outstanding amount populated
  const handlePayFullDue = () => {
    if (financialSummary.totalPending <= 0) return;
    setSelectedLedgerForPayment(null);
    setIsPayFullMode(true);
    setIsCollectModalOpen(true);
  };

  // Direct PDF Download Handler
  const handleDownloadPdfDirect = async (payment: FeePayment) => {
    setDownloadingReceiptId(payment.id);
    try {
      const matchingLedger = allLedgers.find(
        (l) => l.id === payment.ledgerId || l.invoiceNumber === payment.invoiceNumber || l.receiptNumber === payment.receiptNumber
      ) || null;

      await exportReceiptToPdf({
        payment,
        student,
        ledger: matchingLedger,
        settings,
      });
      setNotification(`Downloaded PDF receipt #${payment.receiptNumber}`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      alert('Failed to generate PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Back + quick switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          id="btn-back-to-search"
          type="button"
          onClick={onBack}
          className="h-10 self-start inline-flex items-center gap-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          All students
        </button>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="text"
            value={switcherQuery}
            onChange={(e) => {
              setSwitcherQuery(e.target.value);
              setIsSwitcherOpen(true);
            }}
            onFocus={() => setIsSwitcherOpen(true)}
            placeholder="Open another student"
            aria-label="Open another student"
            className="w-full h-10 pl-9 pr-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
          />
          {isSwitcherOpen && matchingSwitcherStudents.length > 0 && (
            <div className="absolute right-0 mt-1 w-full sm:w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-30 divide-y divide-slate-100 overflow-hidden">
              {matchingSwitcherStudents.map((ms) => (
                <button
                  key={ms.id}
                  type="button"
                  onClick={() => {
                    if (onSelectStudent) onSelectStudent(ms.id);
                    setSwitcherQuery('');
                    setIsSwitcherOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{ms.name}</span>
                    <span className="block text-xs text-slate-500">
                      {ms.admissionNumber} · {classLabel(ms.className, ms.section)}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Student card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            {studentPhotoUrl && !photoError ? (
              <img
                src={studentPhotoUrl}
                alt=""
                className="w-16 h-16 rounded-full object-cover border border-slate-200 shrink-0"
                referrerPolicy="no-referrer"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-semibold text-lg shrink-0">
                {student.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">{student.name}</h1>
                {student.status && student.status !== 'ACTIVE' && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {String(student.status).charAt(0) + String(student.status).slice(1).toLowerCase()}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600">
                {classLabel(student.className, student.section)} · Adm. no. {student.admissionNumber}
              </p>
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-slate-500">Parent</dt>
                  <dd className="text-slate-900">{student.fatherName || student.parentName || student.guardianName || 'Not recorded'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-500">Mobile</dt>
                  <dd className="text-slate-900 tabular-nums">{student.fatherMobile || student.parentPhone || student.mobile || 'Not recorded'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-500">Session</dt>
                  <dd className="text-slate-900">{student.academicSession || settings.currentAcademicSession}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-500">Fees from</dt>
                  <dd className="text-slate-900">{formatDateDisplay(student.feeStartDate || student.enrollmentDate || student.admissionDate)}</dd>
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <dt className="text-slate-500">Facilities</dt>
                  <dd className="text-slate-900">
                    {[
                      student.transportRequired &&
                        `Bus${student.transportStopName ? ` (${student.transportStopName})` : ''} · ${inr(studentTransportFee)}/month`,
                      student.hostelRequired &&
                        `Hostel${student.hostelName ? ` (${student.hostelName})` : ''} · ${inr(studentHostelFee)}/month`,
                    ]
                      .filter(Boolean)
                      .join('; ') || 'Day scholar'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-col gap-2 shrink-0 lg:w-44">
            <button
              id="btn-profile-collect-payment"
              type="button"
              onClick={() => {
                setSelectedLedgerForPayment(null);
                setIsCollectModalOpen(true);
              }}
              className="h-10 flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
            >
              <CreditCard className="w-4 h-4" aria-hidden />
              Collect fee
            </button>
            <button
              id="btn-profile-add-bill"
              type="button"
              onClick={() => setIsAddBillModalOpen(true)}
              className="h-10 flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium"
            >
              <PlusCircle className="w-4 h-4" aria-hidden />
              Add bill
            </button>
            <button
              id="btn-profile-generate-invoice"
              type="button"
              onClick={() => setIsGenerateInvoiceModalOpen(true)}
              className="h-10 flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium"
            >
              <FileText className="w-4 h-4" aria-hidden />
              Monthly invoice
            </button>
          </div>
        </div>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Billed', value: financialSummary.totalFee, note: `${allLedgers.length} bill${allLedgers.length === 1 ? '' : 's'}` },
          { label: 'Paid', value: financialSummary.totalPaid, note: `${allPayments.length} receipt${allPayments.length === 1 ? '' : 's'}` },
          { label: 'Due', value: financialSummary.totalPending, danger: financialSummary.totalPending > 0 },
          { label: 'Overdue', value: financialSummary.overdue, danger: financialSummary.overdue > 0, note: financialSummary.overdue > 0 ? 'Past the due date' : undefined },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-600">{c.label}</p>
            <p className={`text-xl font-semibold tabular-nums ${c.danger ? 'text-rose-700' : 'text-slate-900'}`}>{inr(c.value)}</p>
            {c.note && <p className="text-xs text-slate-500">{c.note}</p>}
          </div>
        ))}
      </div>

      {/* 3. Under Outstanding Balance: Two Independent Pages/Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="border-b border-slate-200 px-4 pt-3 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              id="tab-btn-ledger"
              onClick={() => setActiveTab('LEDGER')}
              className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'LEDGER'
                  ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Bills</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'LEDGER' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {ledgerPagination.total}
              </span>
            </button>

            <button
              id="tab-btn-payments"
              onClick={() => setActiveTab('PAYMENTS')}
              className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'PAYMENTS'
                  ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4 text-blue-600" />
              <span>Payments</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'PAYMENTS' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {paymentPagination.total}
              </span>
            </button>
          </div>

        </div>

        {/* TAB 1 CONTENT: Student Fee Ledger & Invoices */}
        {activeTab === 'LEDGER' && (
          <div>
            {/* Toolbar: Filters & Search */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                {(['ALL', 'PENDING', 'OVERDUE', 'PAID'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setInvoiceFilter(f)}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      invoiceFilter === f
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f === 'ALL'
                      ? 'All'
                      : f === 'PENDING'
                      ? 'Pending'
                      : f === 'OVERDUE'
                      ? 'Overdue'
                      : 'Paid'}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search invoice no, month..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto relative">
              {isLedgerLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs z-10 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading Invoices...</span>
                  </div>
                </div>
              )}

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-xs">
                  <tr>
                    <th className="p-3.5">Billing Period</th>
                    <th className="p-3.5">Invoice No</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5 text-right">Total Bill (₹)</th>
                    <th className="p-3.5 text-right">Fine (₹)</th>
                    <th className="p-3.5 text-right">Discount (₹)</th>
                    <th className="p-3.5 text-right">Paid (₹)</th>
                    <th className="p-3.5 text-right">Balance Due (₹)</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-10 text-center text-slate-400">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-600">
                          {ledgerSearch ? 'No bill matches this search.' : 'No bills with this status.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((ledger) => {
                      const total = Number(ledger.total ?? ledger.amount ?? 0);
                      const paid = Number(ledger.paidAmount ?? 0);
                      const balance = Number(
                        ledger.pendingAmount ?? Math.max(0, total - paid)
                      );
                      const fineAmt = Number(ledger.fine || 0);
                      const discountAmt = Number(ledger.discount || 0);
                      const isPastDue = ledger.dueDate
                        ? new Date(ledger.dueDate) < new Date(new Date().toDateString())
                        : false;

                      return (
                        <tr
                          key={ledger.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="p-3.5 font-bold text-slate-900">
                            {ledger.feeMonth || ledger.monthYear || ledger.billingPeriod || 'School Fee'}
                          </td>
                          <td className="p-3.5 font-mono text-slate-600">
                            {ledger.invoiceNumber || ledger.id}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`text-[11px] ${
                                isPastDue && balance > 0
                                  ? 'text-rose-700 font-bold'
                                  : 'text-slate-600'
                              }`}
                            >
                              {ledger.dueDate || 'N/A'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                            ₹{total.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5 text-right font-mono text-rose-600">
                            {fineAmt > 0 ? `+₹${fineAmt.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="p-3.5 text-right font-mono text-emerald-600">
                            {discountAmt > 0 ? `-₹${discountAmt.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="p-3.5 text-right font-mono text-emerald-700 font-bold">
                            ₹{paid.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5 text-right font-mono font-black">
                            <span
                              className={
                                balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                              }
                            >
                              ₹{balance.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <StatusPill {...ledgerStatus(ledger)} />
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {balance > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedLedgerForPayment(ledger);
                                    setIsCollectModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                                >
                                  Collect
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedLedgerForInvoiceModal(ledger)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="View Invoice & Breakdown"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {(() => {
                                const saved = allPayments.find(
                                  (p) =>
                                    (p as any).ledgerId === ledger.id ||
                                    (ledger.receiptNumber && p.receiptNumber === ledger.receiptNumber) ||
                                    String((p as any).invoiceNumber || '').split(', ').includes(String(ledger.invoiceNumber))
                                );
                                return paid > 0 && saved ? (
                                  <button
                                    type="button"
                                    onClick={() => setReceiptToPrint(saved)}
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                                    title="Print receipt"
                                    aria-label="Print receipt"
                                  >
                                    <Printer className="w-4 h-4" aria-hidden />
                                  </button>
                                ) : null;
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Server-Side Pagination Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>
                  Showing{' '}
                  <strong>
                    {ledgerPagination.total === 0
                      ? 0
                      : (ledgerPagination.page - 1) * ledgerPagination.limit + 1}
                  </strong>{' '}
                  to{' '}
                  <strong>
                    {Math.min(
                      ledgerPagination.page * ledgerPagination.limit,
                      ledgerPagination.total
                    )}
                  </strong>{' '}
                  of <strong>{ledgerPagination.total}</strong> invoices
                </span>
                <span className="text-slate-300">|</span>
                <span>Page {ledgerPagination.page} of {ledgerPagination.totalPages}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fetchLedgersPaginated(ledgerPagination.page - 1)}
                  disabled={ledgerPagination.page <= 1 || isLedgerLoading}
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="px-2 font-bold font-mono text-emerald-800">
                  {ledgerPagination.page}
                </div>

                <button
                  onClick={() => fetchLedgersPaginated(ledgerPagination.page + 1)}
                  disabled={
                    ledgerPagination.page >= ledgerPagination.totalPages || isLedgerLoading
                  }
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2 CONTENT: Payment & Receipt History */}
        {activeTab === 'PAYMENTS' && (
          <div>
            {/* Toolbar: Search */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <div>
                <h3 className="text-xs font-bold text-slate-800">
                  Receipts & Payment Transactions
                </h3>
                <p className="text-[11px] text-slate-500">
                  Verified payments recorded for {student.name}. Instant Preview, Download & Print available.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  placeholder="Search receipt no, txn ref..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto relative">
              {isPaymentLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs z-10 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading Payments...</span>
                  </div>
                </div>
              )}

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-xs">
                  <tr>
                    <th className="p-3.5">Receipt No</th>
                    <th className="p-3.5">Payment Date</th>
                    <th className="p-3.5">Purpose / Head</th>
                    <th className="p-3.5">Mode</th>
                    <th className="p-3.5">Transaction Ref</th>
                    <th className="p-3.5 text-right">Amount (₹)</th>
                    <th className="p-3.5 text-right">Remaining Balance (₹)</th>
                    <th className="p-3.5">Collected By</th>
                    <th className="p-3.5 text-center">Receipt Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-slate-400">
                        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-600">No payment receipts logged</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {paymentSearch ? 'No receipts match your search query' : 'Collected fees will appear here with instant A4 receipts'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paymentRows.map((p, idx) => {
                      const balanceDue = (p as any).balanceDue !== undefined ? Number((p as any).balanceDue) : 0;
                      return (
                        <tr key={`${p.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-emerald-900">
                            {p.receiptNumber}
                          </td>
                          <td className="p-3.5 text-slate-700">{p.paymentDate}</td>
                          <td className="p-3.5 text-slate-800 font-medium">{p.feeType}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {p.paymentMethod}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-500 text-[11px]">
                            {p.transactionReference || 'Counter Cash'}
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-emerald-700 text-sm">
                            ₹{Number(p.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-700">
                            {balanceDue > 0 ? (
                              <span className="text-amber-800">₹{balanceDue.toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-emerald-700 text-[11px]">₹0 (Cleared)</span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-600">{p.collectedBy || ''}</td>
                          <td className="p-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => setReceiptToPrint(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] transition-colors shadow-2xs cursor-pointer"
                                title="Preview & Print A4 Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Preview / Print</span>
                              </button>

                              <button
                                onClick={() => handleDownloadPdfDirect(p)}
                                disabled={downloadingReceiptId === p.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                                title="Download Vector A4 PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>{downloadingReceiptId === p.id ? 'Saving...' : 'PDF'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Server-Side Pagination Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>
                  Showing{' '}
                  <strong>
                    {paymentPagination.total === 0
                      ? 0
                      : (paymentPagination.page - 1) * paymentPagination.limit + 1}
                  </strong>{' '}
                  to{' '}
                  <strong>
                    {Math.min(
                      paymentPagination.page * paymentPagination.limit,
                      paymentPagination.total
                    )}
                  </strong>{' '}
                  of <strong>{paymentPagination.total}</strong> payments
                </span>
                <span className="text-slate-300">|</span>
                <span>Page {paymentPagination.page} of {paymentPagination.totalPages}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fetchPaymentsPaginated(paymentPagination.page - 1)}
                  disabled={paymentPagination.page <= 1 || isPaymentLoading}
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="px-2 font-bold font-mono text-blue-800">
                  {paymentPagination.page}
                </div>

                <button
                  onClick={() => fetchPaymentsPaginated(paymentPagination.page + 1)}
                  disabled={
                    paymentPagination.page >= paymentPagination.totalPages || isPaymentLoading
                  }
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {/* 1. Collect Payment Modal */}
      <CollectPaymentModal
        isOpen={isCollectModalOpen}
        onClose={() => {
          setIsCollectModalOpen(false);
          setSelectedLedgerForPayment(null);
          setIsPayFullMode(false);
        }}
        student={student}
        ledgers={allLedgers}
        initialSelectedLedger={selectedLedgerForPayment}
        initialPayFull={isPayFullMode}
        onPaymentSuccess={(payment, updatedLedger) => {
          setReceiptToPrint(payment);
          refreshData();
          setNotification(
            `Payment of ₹${Number(payment.amount).toLocaleString(
              'en-IN'
            )} received successfully! Receipt #${payment.receiptNumber} generated.`
          );
        }}
      />

      {/* 2. Add New Bill Modal */}
      <AddBillModal
        isOpen={isAddBillModalOpen}
        onClose={() => setIsAddBillModalOpen(false)}
        student={student}
        onBillAdded={(newLedger, message) => {
          refreshData();
          setNotification(
            message ||
              `New bill "${newLedger.feeType}" (₹${newLedger.total.toLocaleString(
                'en-IN'
              )}) posted to ${student.name}'s ledger.`
          );
        }}
      />

      {/* 3. Generate Monthly Invoice Modal */}
      <GenerateInvoiceModal
        isOpen={isGenerateInvoiceModalOpen}
        onClose={() => setIsGenerateInvoiceModalOpen(false)}
        student={student}
        existingLedgers={allLedgers}
        onInvoiceGenerated={(newLedger) => {
          refreshData();
          setSelectedLedgerForInvoiceModal(newLedger);
          setNotification(
            `Invoice for ${newLedger.feeMonth || newLedger.feeType} (₹${newLedger.total.toLocaleString(
              'en-IN'
            )}) generated successfully.`
          );
        }}
      />

      {/* 4. Invoice Detail Modal */}
      <InvoiceDetailModal
        isOpen={!!selectedLedgerForInvoiceModal}
        onClose={() => setSelectedLedgerForInvoiceModal(null)}
        ledger={selectedLedgerForInvoiceModal}
        student={student}
        settings={settings}
        payments={allPayments}
        onCollectPayment={(l) => {
          setSelectedLedgerForPayment(l);
          setIsCollectModalOpen(true);
        }}
      />

      {/* 5. A4 Printable Dual-Slip Receipt Modal */}
      <PrintableReceiptModal
        isOpen={!!receiptToPrint}
        onClose={() => setReceiptToPrint(null)}
        payment={receiptToPrint}
        student={student}
        settings={settings}
      />
    </div>
  );
};
