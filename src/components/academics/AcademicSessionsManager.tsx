import React, { useState } from 'react';
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit2,
  Info,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
  AlertTriangle,
  RotateCcw,
  Check,
} from 'lucide-react';
import { AcademicSession } from '../../types';
import { api } from '../../services/api';
import { useRealtimeListener } from '../../hooks/useRealtime';

interface AcademicSessionsManagerProps {
  onSessionActivated?: (sessionName: string) => void;
  selectedSession: string;
  onSelectSession: (sessionName: string) => void;
  canManage?: boolean;
}

export const AcademicSessionsManager: React.FC<AcademicSessionsManagerProps> = ({
  onSessionActivated,
  selectedSession,
  onSelectSession,
  canManage = true,
}) => {
  const [sessions, setSessions] = useState<AcademicSession[]>(() => api.getAcademicSessions());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<AcademicSession | null>(null);
  const [sessionToActivate, setSessionToActivate] = useState<AcademicSession | null>(null);

  // Form states for Create/Edit
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    status: 'INACTIVE' as 'ACTIVE' | 'INACTIVE',
    description: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  const reloadSessions = () => {
    const updated = api.getAcademicSessions();
    setSessions(updated);
  };

  // Real-time synchronization for academic sessions across browser tabs/clients
  useRealtimeListener(['SESSION', 'SETTINGS'], () => {
    reloadSessions();
  });

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => {
      setActionSuccessMsg(null);
    }, 4000);
  };

  const showErrorNotification = (msg: string) => {
    setActionErrorMsg(msg);
    setTimeout(() => {
      setActionErrorMsg(null);
    }, 5000);
  };

  const activeSession = sessions.find((s) => s.status === 'ACTIVE') || sessions[0];
  const totalSessions = sessions.length;
  const inactiveSessions = sessions.filter((s) => s.status === 'INACTIVE').length;

  // Filtered list
  const filteredSessions = sessions.filter((ses) => {
    if (!ses) return false;
    const q = (searchQuery || '').trim().toLowerCase();
    const sesName = (ses.name || '').toLowerCase();
    const sesDesc = (ses.description || '').toLowerCase();
    const matchesSearch = !q || sesName.includes(q) || sesDesc.includes(q);
    const matchesStatus = statusFilter === 'ALL' || ses.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCreateModal = () => {
    if (!canManage) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    const defaultStart = `${currentYear}-04-01`;
    const defaultEnd = `${currentYear + 1}-03-31`;
    const defaultName = `${currentYear}-${currentYear + 1}`;

    setFormData({
      name: defaultName,
      startDate: defaultStart,
      endDate: defaultEnd,
      status: 'INACTIVE',
      description: '',
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (ses: AcademicSession) => {
    if (!canManage) return;
    setEditingSession(ses);
    setFormData({
      name: ses.name,
      startDate: ses.startDate,
      endDate: ses.endDate,
      status: ses.status,
      description: ses.description || '',
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError('Session name is required (e.g., 2026-2027).');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setFormError('Both start date and end date are required.');
      return;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      setFormError('End date must be chronologically after start date.');
      return;
    }

    try {
      if (editingSession) {
        const updated = api.updateAcademicSession(editingSession.id, {
          name: trimmedName,
          startDate: formData.startDate,
          endDate: formData.endDate,
          status: formData.status,
          description: formData.description,
        });
        reloadSessions();
        showNotification(`Session "${updated.name}" updated successfully.`);
        if (updated.status === 'ACTIVE' && onSessionActivated) {
          onSessionActivated(updated.name);
        }
      } else {
        const created = api.createAcademicSession({
          name: trimmedName,
          startDate: formData.startDate,
          endDate: formData.endDate,
          status: formData.status,
          description: formData.description,
        });
        reloadSessions();
        showNotification(`Academic session "${created.name}" created successfully.`);
        if (created.status === 'ACTIVE' && onSessionActivated) {
          onSessionActivated(created.name);
        }
      }
      setIsCreateModalOpen(false);
      setEditingSession(null);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the session.');
    }
  };

  const confirmActivate = (ses: AcademicSession) => {
    try {
      const activated = api.setActiveAcademicSession(ses.id);
      reloadSessions();
      onSelectSession(activated.name);
      if (onSessionActivated) {
        onSessionActivated(activated.name);
      }
      showNotification(`Academic session "${activated.name}" is now the ACTIVE session across the entire portal.`);
      setSessionToActivate(null);
    } catch (err: any) {
      showErrorNotification(err.message || 'Failed to activate session.');
    }
  };

  const handleDeactivate = (ses: AcademicSession) => {
    try {
      const res = api.deactivateAcademicSession(ses.id);
      reloadSessions();
      const currentActive = api.getActiveAcademicSession();
      onSelectSession(currentActive.name);
      if (onSessionActivated) {
        onSessionActivated(currentActive.name);
      }
      showNotification(res.message || `Session ${ses.name} deactivated.`);
    } catch (err: any) {
      showErrorNotification(err.message || 'Failed to deactivate session.');
    }
  };

  const confirmDelete = () => {
    if (!sessionToDelete) return;
    try {
      const res = api.deleteAcademicSession(sessionToDelete.id);
      reloadSessions();
      showNotification(res.message || `Session ${sessionToDelete.name} deleted.`);
      setSessionToDelete(null);
    } catch (err: any) {
      showErrorNotification(err.message || 'Failed to delete session.');
    }
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Success notification */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-semibold text-emerald-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error notification */}
      {actionErrorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs font-semibold text-red-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button
            onClick={() => setActionErrorMsg(null)}
            className="text-red-700 hover:text-red-900 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Session Card */}
        <div className="bg-white rounded-2xl p-5 border-2 border-emerald-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Active Portal Session
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              ACTIVE
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeSession?.name || '2026-2027'}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {formatDateString(activeSession?.startDate)} – {formatDateString(activeSession?.endDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Total Sessions */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Sessions Configured
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{totalSessions}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              1 Active Tenure • {inactiveSessions} Inactive / Archived
            </p>
          </div>
        </div>

        {/* Selected Context Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Currently Selected Context
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-indigo-950 tracking-tight">
              {selectedSession}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {selectedSession === activeSession?.name ? (
                <span className="text-emerald-700 font-bold">Matches current Active Session</span>
              ) : (
                <span className="text-amber-700 font-bold">Viewing historical / planned records</span>
              )}
            </p>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Module Scope:</span>
              <button
                onClick={() => {
                  if (activeSession) {
                    onSelectSession(activeSession.name);
                  }
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline"
              >
                Reset to Active ({activeSession?.name})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Section: Search, Filters & Action Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Academic Sessions & Institutional Tenures
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-800 rounded-full border border-blue-200">
                Single Active Policy Enforced
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {canManage ? (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Session</span>
              </button>
            ) : (
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                Read Only
              </span>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search session name or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500">Status:</span>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({sessions.length})
              </button>
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active (1)
              </button>
              <button
                onClick={() => setStatusFilter('INACTIVE')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  statusFilter === 'INACTIVE'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inactive ({inactiveSessions})
              </button>
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4">Academic Session</th>
                <th className="py-3 px-4">Tenure Start Date</th>
                <th className="py-3 px-4">Tenure End Date</th>
                <th className="py-3 px-4">Portal Status</th>
                <th className="py-3 px-4">Description / Notes</th>
                {canManage && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-8 text-center text-slate-400">
                    No academic sessions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((ses) => {
                  const isActive = ses.status === 'ACTIVE';
                  const isContextSelected = selectedSession === ses.name;

                  return (
                    <tr
                      key={ses.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isActive ? 'bg-emerald-50/30 font-medium' : ''
                      }`}
                    >
                      {/* Session Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900">
                            {ses.name}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">
                              CURRENT
                            </span>
                          )}
                          {isContextSelected && !isActive && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full">
                              VIEWING
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Start Date */}
                      <td className="py-3 px-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDateString(ses.startDate)}</span>
                        </div>
                      </td>

                      {/* End Date */}
                      <td className="py-3 px-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDateString(ses.endDate)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {ses.description || 'Standard academic tenure'}
                      </td>

                      {/* Actions */}
                      {canManage && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isActive ? (
                              <span className="px-2.5 py-1 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-bold">
                                ✓ In Use
                              </span>
                            ) : (
                              <button
                                onClick={() => setSessionToActivate(ses)}
                                title="Set as Active Academic Session"
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Set Active</span>
                              </button>
                            )}

                            <button
                              onClick={() => openEditModal(ses)}
                              title="Edit Session"
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {!isActive && (
                              <button
                                onClick={() => setSessionToDelete(ses)}
                                title="Delete Session"
                                className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Informational Banner */}
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-950 space-y-1">
            <span className="font-bold">Historical Data Integrity Policy</span>
            <p className="text-blue-800">
              When Admin switches the Active Academic Session, previous student enrollments, exam results, and fee transactions remain completely preserved. Existing records retain their historical session tag, allowing full auditing and reporting across past academic years.
            </p>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT SESSION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-900" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingSession ? 'Edit Academic Session' : 'Create Academic Session'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingSession(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Session Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. 2026-2027 or 2027-2028"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Standard format: YYYY-YYYY (e.g. 2026-2027)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Session commencement
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Session conclusion
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Session Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="INACTIVE">Inactive (Secondary / Planned)</option>
                  <option value="ACTIVE">Active (Primary Portal Session)</option>
                </select>
                {formData.status === 'ACTIVE' && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg mt-1.5">
                    <strong>Notice:</strong> Setting this session to Active will automatically set any previously active session to Inactive and immediately switch the portal to use this session.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Description / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Regular annual academic session"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingSession(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  {editingSession ? 'Update Session' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM SET ACTIVE MODAL */}
      {sessionToActivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Set "{sessionToActivate.name}" as Active Session?
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                This will automatically switch the previous active session ({activeSession?.name}) to <strong>Inactive</strong>.
                All portal operations including new Admissions, Timetables, Attendance, Fees, and Exams will immediately bind to <strong>{sessionToActivate.name}</strong>.
              </p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 text-left">
              <p className="font-bold">✓ Historical records are safe:</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Past student results and fee collections in previous sessions will remain intact and viewable.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSessionToActivate(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmActivate(sessionToActivate)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs text-xs"
              >
                Confirm & Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Delete Academic Session "{sessionToDelete.name}"?
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Are you sure you want to remove this inactive session tenure? This operation cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs text-xs"
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
