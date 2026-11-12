import React, { useMemo, useState } from 'react';
import {
  Inbox,
  Search,
  Phone,
  Mail,
  Download,
  MessageSquare,
  PhoneCall,
  GraduationCap,
  X,
  CalendarClock,
} from 'lucide-react';
import { AdmissionEnquiry } from '../../../types';

interface EnquiriesManagementTabProps {
  enquiries: AdmissionEnquiry[];
  onUpdateStatus: (
    id: string,
    status: AdmissionEnquiry['status'],
    notes?: string,
    followUpDate?: string
  ) => Promise<void>;
}

const STATUSES: { value: string; label: string; tone: string }[] = [
  { value: 'SUBMITTED', label: 'New', tone: 'bg-amber-100 text-amber-900' },
  { value: 'UNDER_REVIEW', label: 'Under review', tone: 'bg-blue-100 text-blue-900' },
  { value: 'CONTACTED', label: 'Contacted', tone: 'bg-violet-100 text-violet-900' },
  { value: 'VISIT_SCHEDULED', label: 'Visit scheduled', tone: 'bg-cyan-100 text-cyan-900' },
  { value: 'ADMITTED', label: 'Admitted', tone: 'bg-emerald-100 text-emerald-900' },
  { value: 'CLOSED', label: 'Closed', tone: 'bg-slate-200 text-slate-800' },
];
// Older records used these two; show them as their current equivalents.
const LEGACY: Record<string, string> = { REVIEWED: 'UNDER_REVIEW', ACCEPTED: 'ADMITTED' };
const statusOf = (s: string) => LEGACY[s] || s;

const kindOf = (e: AdmissionEnquiry): 'ENQUIRY' | 'CALLBACK' => (e.kind === 'CALLBACK' ? 'CALLBACK' : 'ENQUIRY');
const whenOf = (e: AdmissionEnquiry) => String(e.submittedAt || (e as any).createdAt || '');

/** "5 min ago", "Yesterday", "12 Oct": easier to scan than a full timestamp. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return '';
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined });
}

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUSES.find((x) => x.value === statusOf(status));
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s?.tone || 'bg-slate-100 text-slate-800'}`}>
      {s?.label || status}
    </span>
  );
};

const KindTag: React.FC<{ kind: 'ENQUIRY' | 'CALLBACK' }> = ({ kind }) =>
  kind === 'CALLBACK' ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800">
      <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" /> Quick call
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-800">
      <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" /> Admission enquiry
    </span>
  );

export const EnquiriesManagementTab: React.FC<EnquiriesManagementTabProps> = ({ enquiries = [], onUpdateStatus }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [kindFilter, setKindFilter] = useState<'ALL' | 'ENQUIRY' | 'CALLBACK'>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState<AdmissionEnquiry | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const safe = useMemo(() => (Array.isArray(enquiries) ? enquiries : []), [enquiries]);
  const counts = useMemo(() => {
    const c = { ALL: safe.length, ENQUIRY: 0, CALLBACK: 0, NEW: 0 };
    for (const e of safe) {
      c[kindOf(e)]++;
      if (statusOf(e.status) === 'SUBMITTED') c.NEW++;
    }
    return c;
  }, [safe]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return safe
      .filter((e) => {
        if (kindFilter !== 'ALL' && kindOf(e) !== kindFilter) return false;
        if (statusFilter !== 'ALL' && statusOf(e.status) !== statusFilter) return false;
        if (!term) return true;
        return [e.studentName, e.parentName, e.mobile, e.referenceNumber, e.classApplying].some((v) => String(v || '').toLowerCase().includes(term));
      })
      .sort((a, b) => new Date(whenOf(b)).getTime() - new Date(whenOf(a)).getTime());
  }, [safe, kindFilter, statusFilter, searchTerm]);

  const open = (e: AdmissionEnquiry) => {
    setSelected(e);
    setAdminNotes(e.notes || '');
    setFollowUp(e.followUpDate || '');
    setNotice(null);
  };

  const save = async (e: AdmissionEnquiry, status: string, notes: string | undefined, date: string | undefined, okText: string) => {
    try {
      setIsUpdating(true);
      await onUpdateStatus(e.id, status, notes, date);
      setSelected((cur) => (cur && cur.id === e.id ? { ...cur, status, notes: notes ?? cur.notes, followUpDate: date } : cur));
      setNotice({ ok: true, text: okText });
    } catch (err: any) {
      setNotice({ ok: false, text: err?.message || 'Could not save. Please try again.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const exportToCsv = () => {
    if (!filtered.length) return;
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Reference', 'Type', 'Name', 'Student', 'Class', 'Mobile', 'Email', 'Status', 'Received', 'Follow-up', 'Message'];
    const rows = filtered.map((e) =>
      [e.referenceNumber || e.id, kindOf(e) === 'CALLBACK' ? 'Quick call' : 'Admission enquiry', e.parentName, e.studentName, e.classApplying, e.mobile, e.email, statusOf(e.status), whenOf(e), e.followUpDate, e.message].map(q).join(',')
    );
    const blob = new Blob([[head.map(q).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admission_enquiries_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const waLink = (e: AdmissionEnquiry) => {
    const digits = String(e.mobile || '').replace(/\D/g, '').slice(-10);
    const about = kindOf(e) === 'CALLBACK' ? 'your call back request' : `your admission enquiry for ${e.studentName}${e.classApplying ? ` (${e.classApplying})` : ''}`;
    return `https://wa.me/91${digits}?text=${encodeURIComponent(`Namaste ${e.parentName}, this is Chanakya Public School & Coaching Centre, Sheohar regarding ${about}.`)}`;
  };

  const tabs: { id: 'ALL' | 'ENQUIRY' | 'CALLBACK'; label: string; n: number }[] = [
    { id: 'ALL', label: 'All', n: counts.ALL },
    { id: 'ENQUIRY', label: 'Admission enquiries', n: counts.ENQUIRY },
    { id: 'CALLBACK', label: 'Quick calls', n: counts.CALLBACK },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-600" aria-hidden="true" />
            Enquiries & Quick Calls
          </h3>
          <p className="text-sm text-slate-600">
            {counts.NEW > 0 ? `${counts.NEW} waiting for a first response.` : 'Everything has had a first response.'}
          </p>
        </div>
        <button
          onClick={exportToCsv}
          disabled={!filtered.length}
          className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-semibold text-sm cursor-pointer"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 self-start" role="tablist" aria-label="Type">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={kindFilter === t.id}
              onClick={() => setKindFilter(t.id)}
              className={`px-3.5 min-h-[40px] rounded-lg text-sm font-semibold cursor-pointer transition-colors ${kindFilter === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t.label} <span className="text-slate-500 font-medium">{t.n}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search enquiries"
              placeholder="Search name, mobile, reference"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Inbox className="w-9 h-9 mx-auto mb-2 text-slate-300" aria-hidden="true" />
          <p className="font-semibold text-slate-800">{safe.length ? 'Nothing matches these filters' : 'No enquiries yet'}</p>
          <p className="text-sm text-slate-500 mt-1">
            {safe.length ? 'Clear the search or choose a different status.' : 'New admission enquiries and call back requests from the website will appear here.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((e) => {
            const kind = kindOf(e);
            const isNew = statusOf(e.status) === 'SUBMITTED';
            return (
              <li key={e.id} className={`bg-white rounded-2xl border p-4 ${isNew ? 'border-amber-300' : 'border-slate-200'}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <button type="button" onClick={() => open(e)} className="flex-1 min-w-0 text-left cursor-pointer">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <KindTag kind={kind} />
                      <StatusPill status={e.status} />
                      <span className="text-xs text-slate-500">{relativeTime(whenOf(e))}</span>
                    </div>
                    <p className="mt-1.5 font-bold text-slate-900 truncate">
                      {kind === 'CALLBACK' ? e.parentName : e.studentName || e.parentName}
                    </p>
                    <p className="text-sm text-slate-600 truncate">
                      {kind === 'CALLBACK'
                        ? `${e.mobile}${e.preferredTime ? ` - best time: ${e.preferredTime}` : ''}`
                        : `${e.parentName}${e.classApplying ? ` - ${e.classApplying}` : ''}`}
                    </p>
                    {e.followUpDate && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-cyan-800">
                        <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" /> Follow up {new Date(e.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={`tel:${e.mobile}`} aria-label={`Call ${e.parentName}`} className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold">
                      <Phone className="w-4 h-4" aria-hidden="true" /> Call
                    </a>
                    <a href={waLink(e)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${e.parentName}`} className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[44px] rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold">
                      <MessageSquare className="w-4 h-4" aria-hidden="true" /> WhatsApp
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60" onClick={() => setSelected(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Enquiry details"
            onClick={(ev) => ev.stopPropagation()}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <KindTag kind={kindOf(selected)} />
                <h3 className="text-lg font-bold text-slate-900 mt-1 truncate">
                  {kindOf(selected) === 'CALLBACK' ? selected.parentName : selected.studentName || selected.parentName}
                </h3>
                <p className="text-xs text-slate-500 font-mono">{selected.referenceNumber || selected.id} - {relativeTime(whenOf(selected))}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close" className="p-2 -m-2 rounded-lg text-slate-500 hover:text-slate-900 cursor-pointer">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm">
              <div><dt className="text-xs text-slate-500">{kindOf(selected) === 'CALLBACK' ? 'Name' : 'Parent / guardian'}</dt><dd className="font-semibold text-slate-900">{selected.parentName}</dd></div>
              <div><dt className="text-xs text-slate-500">Mobile</dt><dd className="font-semibold text-slate-900">{selected.mobile}</dd></div>
              {kindOf(selected) === 'ENQUIRY' && (
                <>
                  <div><dt className="text-xs text-slate-500">Class applying</dt><dd className="font-semibold text-slate-900">{selected.classApplying || 'Not given'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Previous school</dt><dd className="font-semibold text-slate-900">{selected.currentSchool || 'Not given'}</dd></div>
                </>
              )}
              {kindOf(selected) === 'CALLBACK' && (
                <div><dt className="text-xs text-slate-500">Best time to call</dt><dd className="font-semibold text-slate-900">{selected.preferredTime || 'Any time'}</dd></div>
              )}
              {selected.email && <div className="col-span-2"><dt className="text-xs text-slate-500">Email</dt><dd className="font-semibold text-slate-900 break-all">{selected.email}</dd></div>}
            </dl>

            <div className="flex flex-wrap gap-2">
              <a href={`tel:${selected.mobile}`} className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm">
                <Phone className="w-4 h-4" aria-hidden="true" /> Call
              </a>
              <a href={waLink(selected)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-sm">
                <MessageSquare className="w-4 h-4" aria-hidden="true" /> WhatsApp
              </a>
              {selected.email && (
                <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-sm">
                  <Mail className="w-4 h-4" aria-hidden="true" /> Email
                </a>
              )}
            </div>

            {selected.message && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Their message</p>
                <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Status</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
                {STATUSES.map((s) => {
                  const on = statusOf(selected.status) === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      aria-pressed={on}
                      disabled={isUpdating}
                      onClick={() => save(selected, s.value, undefined, selected.followUpDate, `Marked ${s.label.toLowerCase()}`)}
                      className={`px-3.5 min-h-[40px] rounded-full border text-sm font-semibold cursor-pointer disabled:opacity-60 ${on ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3">
              <div>
                <label htmlFor="enq-follow" className="block text-xs font-semibold text-slate-600 mb-1">Follow-up date</label>
                <input id="enq-follow" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="px-3 min-h-[44px] rounded-xl border border-slate-300 text-sm" />
              </div>
              <div>
                <label htmlFor="enq-notes" className="block text-xs font-semibold text-slate-600 mb-1">Internal notes (not shown to parents)</label>
                <textarea id="enq-notes" rows={3} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => save(selected, selected.status, adminNotes, followUp, 'Saved')}
                  className="px-5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm cursor-pointer"
                >
                  {isUpdating ? 'Saving...' : 'Save notes & date'}
                </button>
                {notice && (
                  <span role="status" className={`text-sm font-medium ${notice.ok ? 'text-emerald-700' : 'text-red-700'}`}>{notice.text}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
