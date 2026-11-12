import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  Filter,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
  FileSpreadsheet,
  Globe,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { AuditLog, UserRole } from '../../types';
import { api } from '../../services/api';
import { AuditArchivesPanel } from '../audit/AuditArchivesPanel';

interface AuditLogsViewProps {
  currentUser?: any;
  userRole?: UserRole;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ currentUser, userRole }) => {
  const activeUser = currentUser || api.getCurrentUser();
  const effectiveRole = userRole || activeUser?.role || 'SUPER_ADMIN';

  // Role-based access control
  const isPrivileged = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(effectiveRole);

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Filters & search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Sorting
  const [sortBy, setSortBy] = useState<string>('timestamp');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Logs & state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString('en-IN'));

  // School settings metadata
  const settings = useMemo(() => api.getSettings(), []);
  const academicSession =
    api.getActiveAcademicSession()?.name || settings.currentAcademicSession || '2026-2027';

  // Fetch paginated audit logs from backend MongoDB collection
  const fetchLogs = useCallback(
    async (targetPage = page, targetPageSize = pageSize) => {
      setIsLoading(true);
      try {
        const result = await api.getPaginatedAuditLogs({
          page: targetPage,
          pageSize: targetPageSize,
          search: searchTerm.trim() || undefined,
          entity: selectedEntity !== 'ALL' ? selectedEntity : undefined,
          action: selectedAction !== 'ALL' ? selectedAction : undefined,
          role: selectedRole !== 'ALL' ? selectedRole : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sortBy,
          sortOrder,
        });

        if (result && result.pagination) {
          setLogs(result.data || []);
          setTotalRecords(result.pagination.total);
          setTotalPages(result.pagination.totalPages || 1);
          setPage(result.pagination.page);
        }
        setLastRefreshedAt(new Date().toLocaleTimeString('en-IN'));
      } catch (e) {
        console.warn('[AuditLogsView] Failed to fetch authoritative logs:', e);
      } finally {
        setIsLoading(false);
      }
    },
    [page, pageSize, searchTerm, selectedEntity, selectedAction, selectedRole, dateFrom, dateTo, sortBy, sortOrder]
  );

  // Load when pagination, sorting, or active filters change
  useEffect(() => {
    fetchLogs(page, pageSize);
  }, [fetchLogs, page, pageSize, sortBy, sortOrder]);

  // Realtime update listener: refresh current page when background event occurs
  useEffect(() => {
    const handleAuditUpdate = () => {
      fetchLogs(page, pageSize);
    };

    window.addEventListener('pradnya_entity_audit_logs', handleAuditUpdate);
    window.addEventListener('pradnya_realtime_event', handleAuditUpdate);

    return () => {
      window.removeEventListener('pradnya_entity_audit_logs', handleAuditUpdate);
      window.removeEventListener('pradnya_realtime_event', handleAuditUpdate);
    };
  }, [fetchLogs, page, pageSize]);

  // Handle search & filter submit/reset
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setter(value);
    setPage(1); // Reset to first page whenever filters change
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedEntity('ALL');
    setSelectedAction('ALL');
    setSelectedRole('ALL');
    setDateFrom('');
    setDateTo('');
    setSortBy('timestamp');
    setSortOrder('desc');
    setPage(1);
  };

  const handleDatePreset = (days: number | 'all') => {
    setPage(1);
    if (days === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - days);
    const toStr = today.toISOString().split('T')[0];
    const fromStr = past.toISOString().split('T')[0];
    setDateFrom(fromStr);
    setDateTo(toStr);
  };

  const handleSortToggle = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Export current filtered view to CSV for compliance and archival
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch up to 1000 filtered logs for full audit export
      const exportData = await api.getPaginatedAuditLogs({
        page: 1,
        pageSize: 1000,
        search: searchTerm.trim() || undefined,
        entity: selectedEntity !== 'ALL' ? selectedEntity : undefined,
        action: selectedAction !== 'ALL' ? selectedAction : undefined,
        role: selectedRole !== 'ALL' ? selectedRole : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      });

      const records = exportData.data || [];
      const headers = [
        'Timestamp (IST)',
        'Operator Name',
        'Operator Role',
        'Action',
        'Target Entity',
        'Entity ID',
        'Details',
        'IP Address',
      ];

      const csvRows = records.map((l) => [
        `"${formatTimestamp(l.timestamp).replace(/"/g, '""')}"`,
        `"${(l.userName || (l as any).performedByName || 'System User').replace(/"/g, '""')}"`,
        `"${(l.role || (l as any).userRole || 'SUPER_ADMIN').replace(/"/g, '""')}"`,
        `"${(l.action || '').replace(/"/g, '""')}"`,
        `"${(l.entity || '').replace(/"/g, '""')}"`,
        `"${(l.entityId || '').replace(/"/g, '""')}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        `"${(l.ipAddress || '127.0.0.1').replace(/"/g, '""')}"`,
      ]);

      const schoolHeader = [
        `"RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR"`,
        `"SYSTEM SECURITY AUDIT LOG EXPORT"`,
        `"Academic Session: ${academicSession}"`,
        `"Export Generated At: ${new Date().toLocaleString('en-IN')}"`,
        `"Exported By: ${activeUser?.name || 'Administrator'} (${effectiveRole})"`,
        `"Total Filtered Records: ${records.length}"`,
        '',
      ].join('\n');

      const csvContent = '\uFEFF' + schoolHeader + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `PDS_Security_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[AuditLogsView] CSV export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Format timestamp in Indian Standard Time (IST)
  const formatTimestamp = (rawTime?: string): string => {
    if (!rawTime) return '-';
    try {
      const d = new Date(rawTime);
      if (isNaN(d.getTime())) return rawTime;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return rawTime;
    }
  };

  // Action badge color styling
  const getActionBadgeClass = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('DELETE') || act.includes('FAILED') || act.includes('REMOVED')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (act.includes('LOGIN') || act.includes('AUTH') || act.includes('SESSION')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (act.includes('ADMISSION') || act.includes('CREATE') || act.includes('REGISTERED') || act.includes('ENROLL')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('FEE') || act.includes('PAYMENT') || act.includes('COLLECTION') || act.includes('SALARY')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (act.includes('UPDATE') || act.includes('SETTINGS') || act.includes('PUBLISHED') || act.includes('TABULATED')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  // Role badge styling
  const getRoleBadgeClass = (roleStr: string) => {
    const r = (roleStr || '').toUpperCase();
    if (r === 'SUPER_ADMIN') return 'bg-rose-100 text-rose-800 border-rose-200';
    if (r === 'PRINCIPAL') return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (r === 'SCHOOL_ADMIN') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (r === 'TEACHER') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  // Access control restriction banner
  if (!isPrivileged) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white border border-rose-200 rounded-2xl p-8 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Restricted Institutional Access</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              System Security Audit Logs contain confidential institutional audit trails and are strictly
              restricted to <strong>SUPER_ADMIN</strong>, <strong>SCHOOL_ADMIN</strong>, and{' '}
              <strong>PRINCIPAL</strong> roles.
            </p>
          </div>
          <div className="pt-2 text-xs text-slate-400">
            RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR • Security Protocol ISO 27001
          </div>
        </div>
      </div>
    );
  }

  // Active filters count
  const activeFiltersCount =
    (searchTerm ? 1 : 0) +
    (selectedEntity !== 'ALL' ? 1 : 0) +
    (selectedAction !== 'ALL' ? 1 : 0) +
    (selectedRole !== 'ALL' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const startRecordIndex = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecordIndex = Math.min(page * pageSize, totalRecords);

  return (
    <div className="space-y-5">
      {/* Institutional Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-8 h-8 rounded-lg bg-red-50 text-red-700 flex items-center justify-center font-bold">
                <Shield className="w-4 h-4" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>System Security Audit Log</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Immutable Ledger</span>
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR • Academic Session: {academicSession}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-2 max-w-3xl leading-relaxed">
              Record of administrative actions. Every administrative,
              financial, academic, and authentication event is logged with operator identity, IP address, and timestamp.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
            <button
              onClick={() => fetchLogs(page, pageSize)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Synchronize audit records with authoritative database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{isLoading ? 'Syncing...' : 'Sync Logs'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={isExporting || totalRecords === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Export Audit CSV'}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Total Audit Records</span>
            <span className="text-base font-bold text-slate-900 font-mono">
              {totalRecords.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Current Page / Total</span>
            <span className="text-base font-bold text-slate-900 font-mono">
              {page} of {totalPages}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Active Page Size</span>
            <span className="text-base font-bold text-slate-900 font-mono">{pageSize} records / page</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Last Synchronized</span>
            <span className="text-base font-bold text-slate-900 font-mono">{lastRefreshedAt}</span>
          </div>
        </div>
      </div>

      <AuditArchivesPanel isSuperAdmin={effectiveRole === 'SUPER_ADMIN'} />

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by operator name, action, target entity, details, or IP address..."
              value={searchTerm}
              onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => handleFilterChange(setSearchTerm, '')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Range Presets */}
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">Range:</span>
            <button
              onClick={() => handleDatePreset(0)}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border transition-colors ${
                dateFrom === new Date().toISOString().split('T')[0] && dateTo === new Date().toISOString().split('T')[0]
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleDatePreset(7)}
              className="px-2.5 py-1 rounded-lg font-semibold text-[11px] border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handleDatePreset(30)}
              className="px-2.5 py-1 rounded-lg font-semibold text-[11px] border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handleDatePreset('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border transition-colors ${
                !dateFrom && !dateTo
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs pt-1">
          {/* Target Entity */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Target Entity</label>
            <select
              value={selectedEntity}
              onChange={(e) => handleFilterChange(setSelectedEntity, e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Entities</option>
              <option value="Student">Student</option>
              <option value="FeePayment">Fee Payment</option>
              <option value="FeeStructure">Fee Structure</option>
              <option value="TeacherStaff">Teacher / Staff</option>
              <option value="Attendance">Attendance</option>
              <option value="Exam">Examination</option>
              <option value="ExamMark">Exam Tabulation</option>
              <option value="Timetable">Timetable</option>
              <option value="AdminAccount">Admin Account</option>
              <option value="AcademicSession">Academic Session</option>
              <option value="SchoolSettings">School Settings</option>
            </select>
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Action Category</label>
            <select
              value={selectedAction}
              onChange={(e) => handleFilterChange(setSelectedAction, e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Actions</option>
              <option value="STUDENT_ADMISSION">Student Admission</option>
              <option value="FEE_COLLECTION">Fee Collection</option>
              <option value="STAFF_REGISTERED">Staff Registration</option>
              <option value="TIMETABLE_PUBLISHED">Timetable Published</option>
              <option value="LOGIN_SUCCESS">Login Success</option>
              <option value="LOGIN_FAILED">Login Failed</option>
              <option value="SETTINGS_CONFIGURED">Settings Configured</option>
              <option value="SESSION_INITIALIZED">Session Initialized</option>
            </select>
          </div>

          {/* Operator Role */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Operator Role</label>
            <select
              value={selectedRole}
              onChange={(e) => handleFilterChange(setSelectedRole, e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Operator Roles</option>
              <option value="SUPER_ADMIN">Super Administrator</option>
              <option value="SCHOOL_ADMIN">School Administrator</option>
              <option value="PRINCIPAL">Principal</option>
              <option value="TEACHER">Faculty / Teacher</option>
              <option value="ACCOUNTANT">Chief Accountant</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleFilterChange(setDateFrom, e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Date Range End & Reset */}
          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleFilterChange(setDateTo, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors whitespace-nowrap"
                title="Reset all filters"
              >
                Reset ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Logs Authoritative Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Top Table Control Bar */}
        <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>
              Showing <strong className="text-slate-900 font-bold">{startRecordIndex}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{endRecordIndex}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{totalRecords.toLocaleString('en-IN')}</strong> records
            </span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                Filtered
              </span>
            )}
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium text-[11px]">Records per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                setPage(1);
              }}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold select-none">
              <tr>
                <th
                  onClick={() => handleSortToggle('timestamp')}
                  className="p-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Timestamp (IST)</span>
                    {sortBy === 'timestamp' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSortToggle('userName')}
                  className="p-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Operator Identity</span>
                    {sortBy === 'userName' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </th>
                <th className="p-3.5 whitespace-nowrap">Operator Role</th>
                <th
                  onClick={() => handleSortToggle('action')}
                  className="p-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Action</span>
                    {sortBy === 'action' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSortToggle('entity')}
                  className="p-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Target Entity</span>
                    {sortBy === 'entity' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </th>
                <th className="p-3.5">Activity Details</th>
                <th className="p-3.5 whitespace-nowrap">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="font-semibold text-xs text-slate-700">
                        Loading audit log…
                      </span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <ShieldCheck className="w-10 h-10 text-slate-300" />
                      <span className="font-bold text-slate-700 text-sm">No audit records found</span>
                      <p className="text-xs text-slate-400">
                        No operations match the selected filters or query criteria. Try adjusting your search term
                        or date ranges.
                      </p>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const operatorName = log.userName || (log as any).performedByName || 'System User';
                  const roleStr = log.role || (log as any).userRole || 'SUPER_ADMIN';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Timestamp */}
                      <td className="p-3.5 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                        {formatTimestamp(log.timestamp)}
                      </td>

                      {/* Operator Identity */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-200">
                            {operatorName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900">{operatorName}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${getRoleBadgeClass(
                            roleStr
                          )}`}
                        >
                          {roleStr}
                        </span>
                      </td>

                      {/* Action Pill */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${getActionBadgeClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Target Entity */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{log.entity || 'System'}</span>
                          {log.entityId && log.entityId !== 'general' && (
                            <span className="font-mono text-[10px] text-slate-400">ID: {log.entityId}</span>
                          )}
                        </div>
                      </td>

                      {/* Details */}
                      <td className="p-3.5 text-slate-700 leading-snug min-w-[240px]">
                        {log.details || '-'}
                      </td>

                      {/* IP Address */}
                      <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{log.ipAddress || '127.0.0.1'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="px-5 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Page <strong className="text-slate-800">{page}</strong> of{' '}
            <strong className="text-slate-800">{totalPages}</strong> • Total Records:{' '}
            <strong className="text-slate-800">{totalRecords.toLocaleString('en-IN')}</strong>
          </div>

          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1 || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold text-slate-700 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {/* Numbered Page Buttons */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((pNum) => {
                  if (totalPages <= 7) return true;
                  if (pNum === 1 || pNum === totalPages) return true;
                  return Math.abs(pNum - page) <= 1;
                })
                .map((pNum, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && pNum - prev > 1;

                  return (
                    <React.Fragment key={pNum}>
                      {showEllipsis && <span className="px-1 text-slate-400 text-xs">...</span>}
                      <button
                        onClick={() => setPage(pNum)}
                        disabled={isLoading}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pNum === page
                            ? 'bg-blue-600 text-white font-bold shadow-2xs'
                            : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {pNum}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page >= totalPages || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold text-slate-700 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
