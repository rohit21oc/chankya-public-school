import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  DoorOpen,
  History,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Moon,
  Phone,
  RefreshCw,
  Search,
  Send,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { User } from '../../types';
import { apiFetch } from '../../services/apiConfig';
import { PersonAvatar } from '../common/PersonAvatar';
import { Conversation } from './MessagesView';

/**
 * Hostel Warden desk on the website: the same features and the same server APIs as the warden mobile app
 * (`/api/hostel-warden/*`, `/api/student-leaves/:id/forward`). The server decides what this login may see;
 * nothing here filters for security. Night attendance is separate from school attendance.
 */

type NightStatus = 'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'OUTSIDE';
const STATUSES: NightStatus[] = ['PRESENT', 'ABSENT', 'ON_LEAVE', 'OUTSIDE'];
const STATUS: Record<NightStatus, { label: string; short: string; on: string; pill: string }> = {
  PRESENT: { label: 'Present', short: 'P', on: 'bg-emerald-600 text-white border-emerald-600', pill: 'bg-emerald-50 text-emerald-700' },
  ABSENT: { label: 'Absent', short: 'A', on: 'bg-red-600 text-white border-red-600', pill: 'bg-red-50 text-red-700' },
  ON_LEAVE: { label: 'On Leave', short: 'L', on: 'bg-blue-700 text-white border-blue-700', pill: 'bg-blue-50 text-blue-800' },
  OUTSIDE: { label: 'Outside', short: 'O', on: 'bg-amber-600 text-white border-amber-600', pill: 'bg-amber-50 text-amber-800' },
};
type MealKind = 'BREAKFAST' | 'LUNCH' | 'DINNER';
const MEALS: MealKind[] = ['BREAKFAST', 'LUNCH', 'DINNER'];
const MEAL_LABEL: Record<MealKind, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' };

type Tab = 'home' | 'attendance' | 'students' | 'leaves' | 'mess' | 'alerts' | 'history';
const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'Night Attendance', icon: Moon },
  { id: 'students', label: 'My Students', icon: Users },
  { id: 'leaves', label: 'Leave Requests', icon: CalendarDays },
  { id: 'mess', label: 'Mess Menu', icon: UtensilsCrossed },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'history', label: 'History & Reports', icon: History },
];

// ------------------------------------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------------------------------------

async function call(url: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await apiFetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    let data: any = null;
    try {
      data = await res.json();
    } catch {}
    return { ok: res.ok && data?.success !== false, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error. Check your connection.' } };
  }
}
const errOf = (r: { data: any }, fb: string) => r.data?.error || fb;
const indiaDate = (off = 0) => new Date(Date.now() + 5.5 * 3600e3 + off * 86400e3).toISOString().slice(0, 10);
const shiftDate = (iso: string, d: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1 + by, 1)).toISOString().slice(0, 7);
};
const nightLabel = (iso: string, today = indiaDate()) =>
  iso === today ? 'Tonight' : iso === shiftDate(today, -1) ? 'Last night' : new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');
const whenOf = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');
const dialable = (p?: string | null) => {
  const c = String(p || '').replace(/[^\d+]/g, '');
  return c.replace(/\D/g, '').length >= 6 ? c : null;
};
const classOf = (s: any) => `${s.className || ''}${s.section ? `-${s.section}` : ''}`;
const matches = (s: any, q: string) => {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => [s.name, s.studentName, s.admissionNumber, s.rollNumber, s.roomNumber ? `room ${s.roomNumber}` : ''].some((v) => String(v || '').toLowerCase().includes(w)));
};

// ------------------------------------------------------------------------------------------------
// small UI parts
// ------------------------------------------------------------------------------------------------

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 ${className}`}>{children}</div>
);

const Pill: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${className}`}>{children}</span>
);

const Loading: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-16 rounded-2xl bg-slate-200/70 animate-pulse" />
    ))}
  </div>
);

const Empty: React.FC<{ title: string; message?: string; error?: boolean; onRetry?: () => void }> = ({ title, message, error, onRetry }) => (
  <div role={error ? 'alert' : undefined} className={`text-center p-8 rounded-2xl border bg-white ${error ? 'border-red-200' : 'border-slate-200'}`}>
    <div className={`text-sm font-bold ${error ? 'text-red-700' : 'text-slate-800'}`}>{title}</div>
    {message && <div className="text-xs text-slate-500 mt-1">{message}</div>}
    {onRetry && (
      <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-blue-800 hover:bg-slate-50">
        <RefreshCw className="w-3.5 h-3.5" /> Try again
      </button>
    )}
  </div>
);

const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">{children}</div>
);

const Btn: React.FC<{ onClick: () => void; children: React.ReactNode; tone?: 'navy' | 'gold' | 'outline' | 'danger'; disabled?: boolean; busy?: boolean; className?: string }> = ({ onClick, children, tone = 'navy', disabled, busy, className = '' }) => {
  const t = {
    navy: 'bg-[#0B1F4B] text-white hover:bg-[#123B8C]',
    gold: 'bg-[#D9A441] text-[#0B1F4B] hover:brightness-95',
    outline: 'bg-white text-[#0B1F4B] border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-700 text-white hover:bg-red-800',
  }[tone];
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} className={`inline-flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${t} ${className}`}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

const StatusPicker: React.FC<{ value?: NightStatus | null; onChange: (s: NightStatus) => void; disabled?: boolean; name: string }> = ({ value, onChange, disabled, name }) => (
  <div className="flex gap-1.5" role="radiogroup" aria-label={`Status for ${name}`}>
    {STATUSES.map((s) => {
      const on = value === s;
      return (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={on}
          aria-label={`${name}: ${STATUS[s].label}`}
          title={STATUS[s].label}
          disabled={disabled}
          onClick={() => onChange(s)}
          className={`w-10 h-10 rounded-lg border text-sm font-bold transition ${on ? STATUS[s].on : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'} ${disabled && !on ? 'opacity-35' : ''}`}
        >
          {STATUS[s].short}
        </button>
      );
    })}
  </div>
);

/** Modal asking for a short text (reason / note / message), optionally with a status. */
const Prompt: React.FC<{
  title: string;
  message?: string;
  placeholder: string;
  submit: string;
  minLength?: number;
  withStatus?: NightStatus | null;
  tone?: 'navy' | 'danger';
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (text: string, status?: NightStatus) => void;
}> = ({ title, message, placeholder, submit, minLength = 3, withStatus, tone = 'navy', busy, error, onClose, onSubmit }) => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<NightStatus | null>(withStatus || null);
  const ready = text.trim().length >= minLength && (withStatus === undefined || !!status);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-extrabold text-[#0B1F4B]">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        {message && <p className="text-xs text-slate-600">{message}</p>}
        {withStatus !== undefined && <StatusPicker value={status} onChange={setStatus} name="New status" />}
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={300} rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {error && <div role="alert" className="text-xs font-semibold text-red-700">{error}</div>}
        <div className="flex gap-2">
          <Btn tone="outline" onClick={onClose} className="flex-1">
            Cancel
          </Btn>
          <Btn tone={tone} busy={busy} disabled={!ready} onClick={() => onSubmit(text.trim(), status || undefined)} className="flex-1">
            {submit}
          </Btn>
        </div>
      </div>
    </div>
  );
};

const DateStepper: React.FC<{ value: string; label: string; onChange: (d: string) => void; max?: string }> = ({ value, label, onChange, max }) => (
  <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 p-2">
    <button type="button" aria-label="Previous day" onClick={() => onChange(shiftDate(value, -1))} className="w-10 h-10 rounded-xl bg-blue-50 text-[#0B1F4B] flex items-center justify-center hover:bg-blue-100">
      <ChevronLeft className="w-5 h-5" />
    </button>
    <div className="flex-1 text-center">
      <div className="font-extrabold text-[#0B1F4B]">{label}</div>
      <div className="text-[11px] text-slate-500">{value}</div>
    </div>
    <button
      type="button"
      aria-label="Next day"
      disabled={!!max && value >= max}
      onClick={() => onChange(shiftDate(value, 1))}
      className="w-10 h-10 rounded-xl bg-blue-50 text-[#0B1F4B] flex items-center justify-center hover:bg-blue-100 disabled:opacity-30"
    >
      <ChevronRight className="w-5 h-5" />
    </button>
  </div>
);

// ------------------------------------------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------------------------------------------

const HomeTab: React.FC<{ go: (t: Tab) => void }> = ({ go }) => {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call('/api/hostel-warden/dashboard');
    if (r.ok) {
      setD(r.data);
      setError(null);
    } else setError(errOf(r, 'The dashboard could not be loaded.'));
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading rows={5} />;
  if (!d) return <Empty error title="Dashboard not available" message={error || undefined} onRetry={load} />;
  if (!d.hostels?.length)
    return <Empty title="No hostel assigned to you yet" message="Ask the school office to choose your hostel in your staff record (Hostel assignment). Your students will appear here then." onRetry={load} />;
  const st = d.stats;
  const tiles: Array<{ label: string; value: number; icon: React.ComponentType<{ className?: string }>; cls: string; tab: Tab }> = [
    { label: 'Total students', value: st.totalStudents, icon: Users, cls: 'bg-blue-50 text-blue-800', tab: 'students' },
    { label: 'Present', value: st.present, icon: Check, cls: 'bg-emerald-50 text-emerald-700', tab: 'attendance' },
    { label: 'Absent', value: st.absent, icon: X, cls: 'bg-red-50 text-red-700', tab: 'attendance' },
    { label: 'Outside', value: st.outside, icon: DoorOpen, cls: 'bg-amber-50 text-amber-800', tab: 'attendance' },
    { label: 'On leave', value: Math.max(st.onLeave, st.onApprovedLeave), icon: CalendarDays, cls: 'bg-blue-50 text-blue-800', tab: 'leaves' },
    { label: 'Emergency', value: st.emergencyAlerts, icon: AlertTriangle, cls: st.emergencyAlerts ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500', tab: 'alerts' },
  ];
  return (
    <div className="space-y-5">
      {error && <Notice>{error}</Notice>}
      <div className="rounded-2xl bg-[#123B8C] p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <div className="text-xs text-blue-100">Night roll-call · {d.date}</div>
          <div className="text-2xl font-extrabold text-white">{d.attendanceTaken ? `${st.present} of ${st.totalStudents} present` : 'Not taken yet'}</div>
          {d.attendanceTaken && st.unmarked > 0 && <div className="text-xs text-[#D9A441] mt-0.5">{st.unmarked} student(s) still to mark</div>}
        </div>
        <Btn tone="gold" onClick={() => go('attendance')}>
          <Moon className="w-4 h-4" /> {d.attendanceTaken ? 'Open' : 'Take now'}
        </Btn>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <button key={t.label} type="button" onClick={() => go(t.tab)} className="text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-300 transition" aria-label={`${t.label}: ${t.value}`}>
            <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center ${t.cls}`}>
              <t.icon className="w-4 h-4" />
            </span>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{t.value}</div>
            <div className="text-xs font-medium text-slate-500">{t.label}</div>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-extrabold text-[#0B1F4B] mb-2">Quick access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            ['Attendance', ClipboardCheck, 'attendance', 0],
            ['Students', Users, 'students', 0],
            ['Leave Requests', CalendarDays, 'leaves', st.pendingLeaves],
            ['Mess Menu', UtensilsCrossed, 'mess', 0],
          ] as const).map(([label, Icon, tab, badge]) => (
            <button key={label} type="button" onClick={() => go(tab)} className="relative bg-white rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-2 hover:border-blue-300 transition">
              <span className="w-12 h-12 rounded-2xl bg-[#0B1F4B] text-[#D9A441] flex items-center justify-center">
                <Icon className="w-6 h-6" />
              </span>
              <span className="text-sm font-semibold text-slate-800">{label}</span>
              {badge > 0 && <span className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-extrabold text-[#0B1F4B]">Open alerts ({st.openAlerts})</h3>
            <button type="button" onClick={() => go('alerts')} className="text-xs font-semibold text-blue-800 hover:underline">
              View all
            </button>
          </div>
          {d.alerts.length === 0 ? (
            <Empty title="No open alerts" message="Students marked absent at roll-call raise an alert here automatically." />
          ) : (
            <Card className="divide-y divide-slate-100">
              {d.alerts.slice(0, 5).map((a: any) => (
                <div key={a.id} className="p-3 flex gap-3">
                  <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${a.type === 'EMERGENCY' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      {a.type === 'EMERGENCY' ? 'Emergency' : 'Absent at night'}
                      {a.studentName ? ` · ${a.studentName}` : ''}
                    </div>
                    <div className="text-xs text-slate-500">{a.message}</div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-[#0B1F4B] mb-2">Today's hostel activities</h3>
          {d.activities.length === 0 ? (
            <Empty title="Nothing recorded today yet" message="Roll-call, leave requests, alerts and menu changes show here as they happen." />
          ) : (
            <Card className="p-4">
              <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
                {d.activities.map((x: any, i: number) => (
                  <li key={`${x.at}-${i}`} className="ml-4">
                    <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-[#123B8C] border-2 border-white" />
                    <div className="text-[11px] text-slate-500">{timeOf(x.at)}</div>
                    <div className="text-sm font-semibold text-slate-900">{x.title}</div>
                    {x.detail && <div className="text-xs text-slate-500">{x.detail}</div>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Night attendance
// ------------------------------------------------------------------------------------------------

const AttendanceTab: React.FC<{ go: (t: Tab) => void }> = ({ go }) => {
  const today = indiaDate();
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, NightStatus>>({});
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [fix, setFix] = useState<any>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixErr, setFixErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call(`/api/hostel-warden/attendance?date=${date}`);
    if (r.ok) {
      setSheet(r.data);
      setError(null);
    } else setError(errOf(r, 'The attendance sheet could not be loaded.'));
    setLoading(false);
  }, [date]);
  useEffect(() => {
    setLoading(true);
    setDraft({});
    setFlash(null);
    void load();
  }, [load]);

  const rows: any[] = sheet?.rows || [];
  const shown = rows.filter((r) => matches(r, q));
  const toSend = rows.filter((r) => !r.record && draft[r.id]).map((r) => ({ studentId: r.id, status: draft[r.id] }));
  const left = rows.filter((r) => !r.record && !draft[r.id]).length;
  const counts = rows.reduce(
    (c, r) => {
      const s: NightStatus | undefined = r.record?.status || draft[r.id];
      if (s === 'PRESENT') c.p++;
      else if (s === 'ABSENT') c.a++;
      else if (s === 'ON_LEAVE') c.l++;
      else if (s === 'OUTSIDE') c.o++;
      else c.u++;
      return c;
    },
    { p: 0, a: 0, l: 0, o: 0, u: 0 }
  );

  const submit = async () => {
    if (!toSend.length) return;
    if (left > 0 && !window.confirm(`${left} student(s) have no status yet. Save the others now and mark them later?`)) return;
    setSaving(true);
    const r = await call('/api/hostel-warden/attendance', 'POST', { date, entries: toSend });
    setSaving(false);
    if (!r.ok) {
      setFlash(errOf(r, 'Night attendance could not be saved.'));
      if (r.status === 409) {
        setDraft({});
        void load();
      }
      return;
    }
    const absent = toSend.filter((e) => e.status === 'ABSENT').length;
    setDraft({});
    setFlash(`${r.data.saved} student(s) saved.${absent ? ` ${absent} absent: the office has been alerted.` : ''}`);
    void load();
  };

  const saveFix = async (reason: string, status?: NightStatus) => {
    if (!fix?.record || !status) return;
    setFixBusy(true);
    setFixErr(null);
    const r = await call(`/api/hostel-warden/attendance/${encodeURIComponent(fix.record.id)}`, 'PUT', { status, reason });
    setFixBusy(false);
    if (!r.ok) return setFixErr(errOf(r, 'The correction could not be saved.'));
    setFix(null);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="sm:w-80">
          <DateStepper value={date} label={nightLabel(date, today)} onChange={setDate} max={today} />
        </div>
        <div className="grid grid-cols-5 flex-1 bg-white rounded-2xl border border-slate-200 p-3 text-center">
          {(
            [
              ['Present', counts.p, 'text-slate-900'],
              ['Absent', counts.a, 'text-red-700'],
              ['Leave', counts.l, 'text-blue-800'],
              ['Outside', counts.o, 'text-amber-700'],
              ['Left', counts.u, 'text-slate-500'],
            ] as const
          ).map(([l, v, c]) => (
            <div key={l}>
              <div className={`text-lg font-extrabold ${c}`}>{v}</div>
              <div className="text-[11px] text-slate-500">{l}</div>
            </div>
          ))}
        </div>
        <Btn tone="outline" onClick={() => go('history')}>
          <History className="w-4 h-4" /> History
        </Btn>
      </div>

      {loading ? (
        <Loading rows={6} />
      ) : !sheet ? (
        <Empty error title="Sheet not available" message={error || undefined} onRetry={load} />
      ) : rows.length === 0 ? (
        <Empty title="No students in your hostel" message="Students appear here once the office allocates them a bed in your hostel." />
      ) : (
        <>
          {flash && <div role="status" className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-900">{flash}</div>}
          {sheet.submitted && <Notice>{sheet.canCorrect ? 'Saved students are locked. Use "Correct" to change one; the reason is kept in the history and audit log.' : sheet.correctionNote || 'This night can no longer be changed by the warden.'}</Notice>}
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1 flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3">
              <Search className="w-4 h-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, admission no. or room" className="flex-1 py-2.5 text-sm outline-none bg-transparent" />
            </label>
            {left > 0 && (
              <Btn
                tone="outline"
                onClick={() => {
                  const next = { ...draft };
                  for (const r of rows) if (!r.record && !next[r.id]) next[r.id] = r.suggested || 'PRESENT';
                  setDraft(next);
                }}
              >
                <Check className="w-4 h-4" /> Mark remaining {left} Present
              </Btn>
            )}
          </div>
          {left > 0 && <p className="text-[11px] text-slate-500 -mt-2">Students with approved leave are set to On Leave.</p>}

          <div className="grid md:grid-cols-2 gap-3">
            {shown.map((r) => {
              const saved: NightStatus | undefined = r.record?.status;
              return (
                <div key={r.id} className={`rounded-2xl border border-slate-200 p-3 space-y-3 ${saved ? 'bg-slate-50' : 'bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={r.name} photo={r.photo} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{r.name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        Room {r.roomNumber || '-'} · {r.bedNumber || '-'} · {classOf(r)}
                      </div>
                    </div>
                    {saved ? <Pill className={STATUS[saved].pill}>{STATUS[saved].label}{r.record.corrected ? ' · corrected' : ''}</Pill> : r.approvedLeave ? <Pill className="bg-blue-50 text-blue-800">Approved leave</Pill> : null}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusPicker value={saved || draft[r.id] || null} disabled={!!saved} name={r.name} onChange={(s) => setDraft((d) => ({ ...d, [r.id]: s }))} />
                    {saved && sheet.canCorrect && (
                      <button
                        type="button"
                        onClick={() => {
                          setFixErr(null);
                          setFix(r);
                        }}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-blue-800 hover:bg-white"
                      >
                        Correct
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {shown.length === 0 && <Empty title="No student matches" />}
          {toSend.length > 0 && (
            <div className="sticky bottom-3 z-10">
              <Btn onClick={submit} busy={saving} className="w-full shadow-lg">
                <Check className="w-4 h-4" /> Submit {toSend.length} student(s)
              </Btn>
            </div>
          )}
        </>
      )}
      {fix && (
        <Prompt
          title={`Correct · ${fix.name}`}
          message={`Saved as ${STATUS[fix.record.status as NightStatus].label}. Choose the right status and write why it is being changed.`}
          placeholder="Reason (e.g. returned at 9:40 pm)"
          submit="Save correction"
          withStatus={fix.record.status}
          busy={fixBusy}
          error={fixErr}
          onClose={() => setFix(null)}
          onSubmit={saveFix}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Students + profile
// ------------------------------------------------------------------------------------------------

const StudentsTab: React.FC<{ onChat: (s: any) => void }> = ({ onChat }) => {
  const [list, setList] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('ALL');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call('/api/hostel-warden/students');
    if (r.ok) {
      setList(r.data.data || []);
      setClasses(r.data.classes || []);
      setError(null);
    } else setError(errOf(r, 'Students could not be loaded.'));
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = list.filter((s) => (cls === 'ALL' || s.classId === cls || s.className === cls) && matches(s, q));

  if (openId) return <StudentProfile id={openId} onBack={() => setOpenId(null)} onChat={onChat} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <label className="flex-1 flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, admission no. or room" className="flex-1 py-2.5 text-sm outline-none bg-transparent" />
        </label>
        <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
          <option value="ALL">All classes</option>
          {classes.map((c) => (
            <option key={c.classId || c.className} value={c.classId || c.className}>
              {c.className}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <Loading rows={6} />
      ) : error && !list.length ? (
        <Empty error title="Students not available" message={error} onRetry={load} />
      ) : list.length === 0 ? (
        <Empty title="No students in your hostel" message="Students appear here once the office allocates them a bed in your hostel." />
      ) : shown.length === 0 ? (
        <Empty title="No student matches" message="Try another name, admission number, room or class." />
      ) : (
        <>
          {/* Phone: cards. Desktop: table. */}
          <div className="grid gap-3 md:hidden">
            {shown.map((s) => (
              <button key={s.id} type="button" onClick={() => setOpenId(s.id)} className="text-left bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
                <PersonAvatar name={s.name} photo={s.photo} size={46} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    Adm. {s.admissionNumber || '-'} · {classOf(s)}
                    {s.rollNumber ? ` · Roll ${s.rollNumber}` : ''}
                  </div>
                  <div className="text-xs font-medium text-blue-800">
                    Room {s.roomNumber || '-'} · {s.bedNumber || '-'}
                  </div>
                </div>
                {s.tonightStatus && <Pill className={STATUS[s.tonightStatus as NightStatus].pill}>{STATUS[s.tonightStatus as NightStatus].label}</Pill>}
              </button>
            ))}
          </div>
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Student</th>
                  <th className="text-left font-semibold px-3 py-3">Adm. no.</th>
                  <th className="text-left font-semibold px-3 py-3">Class</th>
                  <th className="text-left font-semibold px-3 py-3">Roll</th>
                  <th className="text-left font-semibold px-3 py-3">Hostel / Room</th>
                  <th className="text-left font-semibold px-3 py-3">Bed</th>
                  <th className="text-left font-semibold px-3 py-3">Tonight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((s) => (
                  <tr key={s.id} onClick={() => setOpenId(s.id)} className="hover:bg-blue-50/40 cursor-pointer">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={s.name} photo={s.photo} size={34} />
                        <button type="button" className="font-semibold text-slate-900 hover:underline text-left">
                          {s.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{s.admissionNumber || '-'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{classOf(s)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{s.rollNumber || '-'}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {s.hostelName} · {s.roomNumber}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{s.bedNumber}</td>
                    <td className="px-3 py-2.5">{s.tonightStatus ? <Pill className={STATUS[s.tonightStatus as NightStatus].pill}>{STATUS[s.tonightStatus as NightStatus].label}</Pill> : <span className="text-xs text-slate-400">Not marked</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
};

const StudentProfile: React.FC<{ id: string; onBack: () => void; onChat: (s: any) => void }> = ({ id, onBack, onChat }) => {
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call(`/api/hostel-warden/students/${encodeURIComponent(id)}`);
    if (r.ok) setP(r.data.data);
    else setError(errOf(r, 'This student could not be opened.'));
    setLoading(false);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const Line = ({ k, v }: { k: string; v?: string | null }) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-900 text-right">{v || 'Not recorded'}</span>
    </div>
  );
  const CallBtn = ({ phone, label = 'Call' }: { phone?: string | null; label?: string }) =>
    dialable(phone) ? (
      <a href={`tel:${dialable(phone)}`} className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-xl bg-blue-50 text-blue-900 text-sm font-semibold hover:bg-blue-100">
        <Phone className="w-4 h-4" /> {label}
      </a>
    ) : null;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-800 hover:underline">
        <ChevronLeft className="w-4 h-4" /> All students
      </button>
      {loading ? (
        <Loading rows={4} />
      ) : !p ? (
        <Empty error title="Profile not available" message={error || undefined} onRetry={load} />
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="space-y-4">
            <Card className="p-5 flex items-center gap-4">
              <PersonAvatar name={p.name} photo={p.photo} size={72} />
              <div className="min-w-0">
                <div className="text-xl font-extrabold text-[#0B1F4B]">{p.name}</div>
                <div className="text-sm text-slate-500">
                  {classOf(p)}
                  {p.rollNumber ? ` · Roll ${p.rollNumber}` : ''}
                </div>
                <div className="text-sm text-slate-500">Adm. {p.admissionNumber || '-'}</div>
              </div>
            </Card>
            <div className="rounded-2xl bg-[#0B1F4B] p-4 grid grid-cols-3 gap-2 text-white">
              {(
                [
                  ['Hostel', p.hostelName],
                  ['Room', `${p.roomNumber || '-'}${p.floor ? ` · Floor ${p.floor}` : ''}`],
                  ['Bed', p.bedNumber],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <BedDouble className="w-4 h-4 text-[#D9A441]" />
                  <div className="text-[11px] text-blue-100 mt-1">{k}</div>
                  <div className="text-sm font-semibold">{v || '-'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-extrabold text-[#0B1F4B]">Parent</h3>
              <div>
                <div className="font-semibold text-slate-900">{p.parent?.name || p.fatherName || 'Parent'}</div>
                <div className="text-sm text-slate-500">{p.parent?.phone || 'No number saved'}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <CallBtn phone={p.parent?.phone} />
                <Btn tone="navy" onClick={() => onChat({ id: p.id, name: p.name, photo: p.photo, sub: p.parent?.name })}>
                  <MessageCircle className="w-4 h-4" /> Message
                </Btn>
              </div>
            </Card>
            <Card className="p-4 space-y-2">
              <h3 className="text-sm font-extrabold text-[#0B1F4B]">Emergency contact</h3>
              {p.emergency?.phone || p.emergency?.name ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {p.emergency.name || 'Emergency contact'}
                      {p.emergency.relationship ? ` (${p.emergency.relationship})` : ''}
                    </div>
                    <div className="text-sm text-slate-500">{p.emergency.phone || '-'}</div>
                  </div>
                  <CallBtn phone={p.emergency.phone} />
                </div>
              ) : (
                <p className="text-sm text-slate-500">No emergency contact saved. The office can add it in the student record.</p>
              )}
              {(p.emergency?.secondaryPhone || p.emergency?.secondaryName) && (
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <div className="font-semibold text-slate-900">{p.emergency.secondaryName || 'Second contact'}</div>
                    <div className="text-sm text-slate-500">{p.emergency.secondaryPhone || '-'}</div>
                  </div>
                  <CallBtn phone={p.emergency.secondaryPhone} />
                </div>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-extrabold text-[#0B1F4B] mb-1">Personal details</h3>
              <Line k="Father" v={p.fatherName} />
              <Line k="Mother" v={p.motherName} />
              {p.guardianName && <Line k="Guardian" v={p.guardianName} />}
              <Line k="Date of birth" v={p.dob} />
              <Line k="Blood group" v={p.bloodGroup} />
              <Line k="Address" v={p.address} />
              <Line k="In hostel since" v={p.allocationDate} />
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="text-sm font-extrabold text-[#0B1F4B] mb-2">Recent nights</h3>
              {p.recentNights.length === 0 ? (
                <p className="text-sm text-slate-500">No night attendance saved yet.</p>
              ) : (
                p.recentNights.map((n: any) => (
                  <div key={n.date} className="flex justify-between items-center py-1.5 text-sm">
                    <span className="text-slate-600">{nightLabel(n.date)}</span>
                    <Pill className={STATUS[n.status as NightStatus].pill}>{STATUS[n.status as NightStatus].label}</Pill>
                  </div>
                ))
              )}
            </Card>
            {p.leaves.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-extrabold text-[#0B1F4B] mb-2">Leave requests</h3>
                {p.leaves.map((l: any) => (
                  <div key={l.id} className="flex justify-between items-center gap-3 py-1.5">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {l.startDate} → {l.endDate}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{l.reason}</div>
                    </div>
                    <Pill className={LEAVE_PILL[l.status] || 'bg-slate-100 text-slate-600'}>{l.status === 'PENDING' && l.forwardedAt ? 'With Principal' : l.status}</Pill>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Leave requests
// ------------------------------------------------------------------------------------------------

const LEAVE_PILL: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

const LeavesTab: React.FC = () => {
  const [view, setView] = useState<'PENDING' | 'CURRENT' | 'ALL'>('PENDING');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fwd, setFwd] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call('/api/hostel-warden/leaves?status=ALL');
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else setError(errOf(r, 'Leave requests could not be loaded.'));
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const all: any[] = data?.data || [];
  const current: any[] = data?.currentlyOnLeave || [];
  const shown = view === 'CURRENT' ? current : view === 'PENDING' ? all.filter((l) => l.status === 'PENDING') : all;
  const pending = all.filter((l) => l.status === 'PENDING').length;

  const forward = async (note: string) => {
    setBusy(true);
    setSheetErr(null);
    const r = await call(`/api/student-leaves/${encodeURIComponent(fwd.id)}/forward`, 'PUT', { note });
    setBusy(false);
    if (!r.ok) return setSheetErr(errOf(r, 'The leave could not be forwarded.'));
    setFwd(null);
    void load();
  };
  const decide = async (l: any, status: 'APPROVED' | 'REJECTED') => {
    if (!window.confirm(`${status === 'APPROVED' ? 'Approve' : 'Reject'} leave for ${l.studentName} (${l.startDate} to ${l.endDate})?`)) return;
    const r = await call(`/api/student-leaves/${encodeURIComponent(l.id)}/status`, 'PUT', { status });
    if (!r.ok) window.alert(errOf(r, 'Not saved.'));
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex p-1 rounded-xl bg-slate-100 w-full sm:w-auto">
        {(
          [
            ['PENDING', `Pending${pending ? ` (${pending})` : ''}`],
            ['CURRENT', `On leave today (${current.length})`],
            ['ALL', 'All'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold ${view === v ? 'bg-white shadow text-[#0B1F4B]' : 'text-slate-500'}`}>
            {l}
          </button>
        ))}
      </div>
      {data && !data.canApprove && <Notice>Approval is done by the Principal. Check the request and forward it with your note.</Notice>}
      {loading ? (
        <Loading rows={3} />
      ) : error && !data ? (
        <Empty error title="Leave requests not available" message={error} onRetry={load} />
      ) : shown.length === 0 ? (
        <Empty title={view === 'CURRENT' ? 'Nobody is on leave today' : view === 'PENDING' ? 'No pending requests' : 'No leave requests yet'} message="Requests that parents submit in the app appear here." />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((l) => (
            <Card key={l.id} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <PersonAvatar name={l.studentName} photo={l.studentPhoto} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{l.studentName}</div>
                  <div className="text-xs text-slate-500">
                    {classOf(l)} · Room {l.roomNumber || '-'}
                  </div>
                </div>
                <Pill className={l.status === 'PENDING' && l.forwardedAt ? 'bg-blue-50 text-blue-800' : LEAVE_PILL[l.status]}>{l.status === 'PENDING' && l.forwardedAt ? 'With Principal' : l.status}</Pill>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <div>
                  <div className="text-[11px] text-slate-500">From</div>
                  <div className="font-semibold">{l.startDate}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">To</div>
                  <div className="font-semibold">{l.endDate}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Days</div>
                  <div className="font-semibold">{l.daysCount ?? '-'}</div>
                </div>
              </div>
              <p className="text-sm text-slate-800">{l.reason}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500">Parent</div>
                  <div className="text-sm font-semibold truncate">
                    {l.parentName || l.appliedByName || '-'}
                    {l.parentPhone ? ` · ${l.parentPhone}` : ''}
                  </div>
                </div>
                {dialable(l.parentPhone) && (
                  <a href={`tel:${dialable(l.parentPhone)}`} aria-label="Call parent" className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center">
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
              {l.forwardedAt && (
                <div className="text-xs text-slate-500">
                  Forwarded by {l.forwardedByName}
                  {l.forwardNote ? `: “${l.forwardNote}”` : ''}
                </div>
              )}
              {l.status !== 'PENDING' && l.approvedBy && (
                <div className="text-xs text-slate-500">
                  {l.status} by {l.approvedBy}
                  {l.remarks ? ` · ${l.remarks}` : ''}
                </div>
              )}
              {l.status === 'PENDING' &&
                (data.canApprove ? (
                  <div className="flex gap-2">
                    <Btn tone="outline" onClick={() => decide(l, 'REJECTED')} className="flex-1">
                      Reject
                    </Btn>
                    <Btn onClick={() => decide(l, 'APPROVED')} className="flex-1">
                      Approve
                    </Btn>
                  </div>
                ) : !l.forwardedAt ? (
                  <Btn
                    tone="gold"
                    onClick={() => {
                      setSheetErr(null);
                      setFwd(l);
                    }}
                    className="w-full"
                  >
                    <Send className="w-4 h-4" /> Forward to Principal
                  </Btn>
                ) : null)}
            </Card>
          ))}
        </div>
      )}
      {fwd && (
        <Prompt
          title="Forward to Principal"
          message={`${fwd.studentName}: ${fwd.startDate} to ${fwd.endDate}. Add what you checked (e.g. spoke to the parent).`}
          placeholder="Your note for the Principal"
          submit="Forward"
          minLength={0}
          busy={busy}
          error={sheetErr}
          onClose={() => setFwd(null)}
          onSubmit={(t) => void forward(t)}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Mess menu
// ------------------------------------------------------------------------------------------------

type MealForm = Record<MealKind, { time: string; items: string }>;
const emptyMealForm = (): MealForm => ({ BREAKFAST: { time: '', items: '' }, LUNCH: { time: '', items: '' }, DINNER: { time: '', items: '' } });
const mealFormFrom = (menu: any): MealForm => {
  const f = emptyMealForm();
  for (const m of menu?.meals || []) f[m.meal as MealKind] = { time: m.time || '', items: (m.items || []).join(', ') };
  return f;
};
const mealsFromForm = (f: MealForm) =>
  MEALS.map((m) => ({ meal: m, time: f[m].time.trim() || undefined, items: f[m].items.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 20) })).filter((m) => m.items.length || m.time);

/** Breakfast / Lunch / Dinner cards (read only). */
const MealCards: React.FC<{ menu: any; compact?: boolean }> = ({ menu, compact }) => (
  <div className={`grid gap-3 ${compact ? '' : 'md:grid-cols-3'}`}>
    {MEALS.map((m) => {
      const meal = (menu?.meals || []).find((x: any) => x.meal === m);
      return (
        <Card key={m} className={compact ? 'p-3 space-y-2' : 'p-4 space-y-3'}>
          <div className="flex items-center gap-3">
            <span className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl bg-[#0B1F4B] text-[#D9A441] flex items-center justify-center`}>
              <UtensilsCrossed className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </span>
            <div>
              <div className="font-extrabold text-[#0B1F4B] text-sm">{MEAL_LABEL[m]}</div>
              <div className="text-xs text-slate-500">{meal?.time || 'Time not set'}</div>
            </div>
          </div>
          {meal?.items?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {meal.items.map((it: string, i: number) => (
                <span key={`${it}-${i}`} className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 text-xs font-medium">
                  {it}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Not set</div>
          )}
        </Card>
      );
    })}
  </div>
);

/** Breakfast / Lunch / Dinner form with timings. */
const MealEditor: React.FC<{ title: string; initial: any; onCancel: () => void; onSave: (meals: any[], notice: string) => Promise<string | null> }> = ({ title, initial, onCancel, onSave }) => {
  const [form, setForm] = useState<MealForm>(() => mealFormFrom(initial));
  const [notice, setNotice] = useState<string>(initial?.notice || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(await onSave(mealsFromForm(form), notice.trim()));
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <h3 className="font-extrabold text-[#0B1F4B]">{title}</h3>
      <div className="grid md:grid-cols-3 gap-3">
        {MEALS.map((m) => (
          <Card key={m} className="p-4 space-y-2">
            <h4 className="font-bold text-[#0B1F4B] text-sm">{MEAL_LABEL[m]}</h4>
            <input value={form[m].time} onChange={(e) => setForm((f) => ({ ...f, [m]: { ...f[m], time: e.target.value } }))} placeholder="Time (e.g. 7:30 AM – 8:15 AM)" aria-label={`${MEAL_LABEL[m]} time`} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={form[m].items} onChange={(e) => setForm((f) => ({ ...f, [m]: { ...f[m], items: e.target.value } }))} rows={3} placeholder="Items, separated by commas" aria-label={`${MEAL_LABEL[m]} items`} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </Card>
        ))}
      </div>
      <input value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="Note for students (optional)" aria-label="Note" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      {err && <div role="alert" className="text-sm font-semibold text-red-700">{err}</div>}
      <div className="flex gap-2 justify-end">
        <Btn tone="outline" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={save} busy={busy}>
          Save menu
        </Btn>
      </div>
    </div>
  );
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MessTab: React.FC = () => {
  const today = indiaDate();
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(today);
  const [menus, setMenus] = useState<any[]>([]);
  const [weekData, setWeekData] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | { kind: 'special' } | { kind: 'weekly'; weekday: number }>(null);

  const load = useCallback(async () => {
    const [d, w] = await Promise.all([call(`/api/hostel-warden/mess?date=${date}`), call('/api/hostel-warden/mess/weekly')]);
    if (d.ok) setMenus(d.data.data || []);
    if (w.ok) setWeekData(w.data.data || []);
    setError(!d.ok ? errOf(d, 'The mess menu could not be loaded.') : !w.ok ? errOf(w, 'The weekly menu could not be loaded.') : null);
    setLoading(false);
  }, [date]);
  useEffect(() => {
    setLoading(true);
    setEditing(null);
    void load();
  }, [load]);

  const cur = menus[idx] || menus[0];
  const week = weekData.find((w) => w.hostelId === cur?.hostelId) || weekData[0];
  const label = date === today ? 'Today' : date === shiftDate(today, 1) ? 'Tomorrow' : nightLabel(date, today);

  const saveSpecial = async (meals: any[], notice: string) => {
    const r = await call('/api/hostel-warden/mess', 'PUT', { hostelId: cur.hostelId, date, meals, notice });
    if (!r.ok) return errOf(r, 'The menu could not be saved.');
    setEditing(null);
    void load();
    return null;
  };
  const saveWeekly = (weekday: number) => async (meals: any[], notice: string) => {
    const r = await call('/api/hostel-warden/mess/weekly', 'PUT', { hostelId: cur.hostelId, weekday, meals, notice });
    if (!r.ok) return errOf(r, 'The weekly menu could not be saved.');
    setEditing(null);
    void load();
    return null;
  };
  const removeSpecial = async () => {
    if (!window.confirm(`Remove the special menu for ${date}? The weekly menu will show again.`)) return;
    const r = await call(`/api/hostel-warden/mess?hostelId=${encodeURIComponent(cur.hostelId)}&date=${date}`, 'DELETE');
    if (!r.ok) return window.alert(errOf(r, 'The menu could not be deleted.'));
    void load();
  };
  const clearWeekday = async (weekday: number) => {
    if (!window.confirm(`Clear the weekly menu for ${WEEKDAYS[weekday - 1]}?`)) return;
    const r = await call(`/api/hostel-warden/mess/weekly?hostelId=${encodeURIComponent(cur.hostelId)}&weekday=${weekday}`, 'DELETE');
    if (!r.ok) return window.alert(errOf(r, 'Could not clear.'));
    void load();
  };

  const sourceNote = (m: any) =>
    m.source === 'SPECIAL'
      ? { cls: 'bg-[#D9A441] text-[#0B1F4B]', text: `Special menu for ${m.date}` }
      : m.source === 'WEEKLY'
        ? { cls: 'bg-blue-50 text-blue-900', text: `Weekly menu · ${m.weekdayName}` }
        : m.source === 'EARLIER'
          ? { cls: 'bg-amber-50 text-amber-900', text: `No weekly menu yet. Showing the menu from ${m.carriedFrom}.` }
          : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 w-full sm:w-auto">
          {(
            [
              ['day', 'Day view'],
              ['week', 'Weekly menu'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setMode(v); setEditing(null); }} aria-pressed={mode === v} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold ${mode === v ? 'bg-white shadow text-[#0B1F4B]' : 'text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
        {menus.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {menus.map((m, i) => (
              <button key={m.hostelId} type="button" onClick={() => setIdx(i)} className={`px-3 py-2 rounded-full text-sm font-semibold border ${i === idx ? 'bg-[#0B1F4B] text-white border-[#0B1F4B]' : 'bg-white border-slate-300'}`}>
                {m.hostelName}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <Loading rows={3} />
      ) : !cur ? (
        <Empty error={!!error} title={error ? 'Menu not available' : 'No hostel assigned'} message={error || undefined} onRetry={load} />
      ) : mode === 'week' ? (
        editing?.kind === 'weekly' ? (
          <MealEditor
            title={`Weekly menu · ${WEEKDAYS[editing.weekday - 1]}`}
            initial={week?.days?.[editing.weekday - 1]?.menu}
            onCancel={() => setEditing(null)}
            onSave={saveWeekly(editing.weekday)}
          />
        ) : (
          <>
            <Notice>Set the menu for each day of the week once. It repeats every week. For a festival or a special day, add a special menu for that date in Day view.</Notice>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(week?.days || []).map((d: any) => (
                <div key={d.weekday} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-extrabold ${d.weekday === Number(cur.weekday) && date === today ? 'text-[#123B8C]' : 'text-[#0B1F4B]'}`}>
                      {d.name}
                      {d.weekday === Number(cur.weekday) && date === today ? ' · today' : ''}
                    </h3>
                    <div className="flex gap-1">
                      {d.menu && (
                        <button type="button" onClick={() => clearWeekday(d.weekday)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50">
                          Clear
                        </button>
                      )}
                      <button type="button" onClick={() => setEditing({ kind: 'weekly', weekday: d.weekday })} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-900 hover:bg-blue-100">
                        {d.menu ? 'Edit' : 'Set menu'}
                      </button>
                    </div>
                  </div>
                  {d.menu ? <MealCards menu={d.menu} compact /> : <Empty title="Not set" message="Tap Set menu to add this day's meals." />}
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          <div className="sm:w-80">
            <DateStepper value={date} label={label} onChange={setDate} />
          </div>
          {editing?.kind === 'special' ? (
            <MealEditor title={`Special menu for ${date}`} initial={cur.source === 'SPECIAL' ? cur.menu : cur.menu} onCancel={() => setEditing(null)} onSave={saveSpecial} />
          ) : (
            <>
              {!cur.menu ? (
                <Empty
                  title={`No menu for ${cur.weekdayName}`}
                  message={cur.hasWeekly ? `Set the ${cur.weekdayName} menu in Weekly menu, or add a special menu for this date.` : 'Set the weekly menu once (Monday to Sunday) and it repeats every week.'}
                />
              ) : (
                <>
                  {sourceNote(cur) && <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${sourceNote(cur)!.cls}`}>{sourceNote(cur)!.text}</span>}
                  <MealCards menu={cur.menu} />
                  {cur.menu.notice && <Notice>{cur.menu.notice}</Notice>}
                  {cur.menu.updatedByName && <div className="text-xs text-slate-500 text-center">Updated by {cur.menu.updatedByName}</div>}
                </>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {cur.source === 'SPECIAL' && (
                  <Btn tone="outline" onClick={removeSpecial}>
                    <X className="w-4 h-4" /> Remove special menu
                  </Btn>
                )}
                <Btn tone="outline" onClick={() => setMode('week')}>
                  <CalendarDays className="w-4 h-4" /> {cur.hasWeekly ? 'Edit weekly menu' : 'Set weekly menu'}
                </Btn>
                <Btn tone="gold" onClick={() => setEditing({ kind: 'special' })}>
                  <UtensilsCrossed className="w-4 h-4" /> {cur.source === 'SPECIAL' ? 'Edit special menu' : 'Special menu for this day'}
                </Btn>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Alerts
// ------------------------------------------------------------------------------------------------

const AlertsTab: React.FC = () => {
  const [view, setView] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raise, setRaise] = useState(false);
  const [resolving, setResolving] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call(`/api/hostel-warden/alerts?status=${view}`);
    if (r.ok) {
      setList(r.data.data || []);
      setError(null);
    } else setError(errOf(r, 'Alerts could not be loaded.'));
    setLoading(false);
  }, [view]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const send = async (message: string) => {
    setBusy(true);
    setSheetErr(null);
    const r = await call('/api/hostel-warden/alerts', 'POST', { message });
    setBusy(false);
    if (!r.ok) return setSheetErr(errOf(r, 'The alert could not be sent.'));
    setRaise(false);
    setView('OPEN');
    void load();
  };
  const resolve = async (resolution: string) => {
    setBusy(true);
    setSheetErr(null);
    const r = await call(`/api/hostel-warden/alerts/${encodeURIComponent(resolving.id)}/resolve`, 'PUT', { resolution });
    setBusy(false);
    if (!r.ok) return setSheetErr(errOf(r, 'Could not save.'));
    setResolving(null);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex p-1 rounded-xl bg-slate-100">
          {(['OPEN', 'RESOLVED'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`px-4 py-2 rounded-lg text-sm font-semibold ${view === v ? 'bg-white shadow text-[#0B1F4B]' : 'text-slate-500'}`}>
              {v === 'OPEN' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
        <Btn
          tone="danger"
          onClick={() => {
            setSheetErr(null);
            setRaise(true);
          }}
        >
          <AlertTriangle className="w-4 h-4" /> Raise emergency alert
        </Btn>
      </div>
      {loading ? (
        <Loading rows={3} />
      ) : error && !list.length ? (
        <Empty error title="Alerts not available" message={error} onRetry={load} />
      ) : list.length === 0 ? (
        <Empty title={view === 'OPEN' ? 'No open alerts' : 'No resolved alerts yet'} message={view === 'OPEN' ? 'Students marked absent at night roll-call raise an alert here automatically.' : undefined} />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {list.map((a) => (
            <Card key={a.id} className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.type === 'EMERGENCY' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                  {a.type === 'EMERGENCY' ? <AlertTriangle className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{a.type === 'EMERGENCY' ? 'Emergency' : 'Absent at night'}</div>
                  <div className="text-xs text-slate-500">
                    {whenOf(a.createdAt)} · {a.createdByName || 'System'}
                  </div>
                </div>
                <Pill className={a.status === 'OPEN' ? (a.type === 'EMERGENCY' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800') : 'bg-emerald-50 text-emerald-700'}>{a.status === 'OPEN' ? 'Open' : 'Resolved'}</Pill>
              </div>
              <p className="text-sm text-slate-800">{a.message}</p>
              {a.status === 'RESOLVED' ? (
                <div className="text-xs text-slate-500">
                  Resolved {whenOf(a.resolvedAt)} by {a.resolvedByName}: {a.resolution}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSheetErr(null);
                    setResolving(a);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-900 text-xs font-semibold"
                >
                  <Check className="w-3.5 h-3.5" /> Mark resolved
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
      {raise && (
        <Prompt
          title="Emergency alert"
          message="The Principal and the office get a notification right away. For a student, mention their name and room."
          placeholder="What happened?"
          submit="Send alert"
          tone="danger"
          minLength={5}
          busy={busy}
          error={sheetErr}
          onClose={() => setRaise(false)}
          onSubmit={(t) => void send(t)}
        />
      )}
      {resolving && (
        <Prompt title="Mark resolved" message={resolving.message} placeholder="How was it resolved?" submit="Resolve" busy={busy} error={sheetErr} onClose={() => setResolving(null)} onSubmit={(t) => void resolve(t)} />
      )}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// History & reports
// ------------------------------------------------------------------------------------------------

const HistoryTab: React.FC = () => {
  const today = indiaDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [mode, setMode] = useState<'daily' | 'monthly'>('daily');
  const [records, setRecords] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [h, m] = await Promise.all([call(`/api/hostel-warden/attendance/history?from=${month}-01&to=${month}-31`), call(`/api/hostel-warden/attendance/report?type=monthly&month=${month}`)]);
    if (h.ok) setRecords(h.data.data || []);
    if (m.ok) setReport(m.data);
    setError(!h.ok ? errOf(h, 'History could not be loaded.') : !m.ok ? errOf(m, 'The report could not be loaded.') : null);
    setLoading(false);
  }, [month]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const byDate = useMemo(() => {
    const out: Record<string, any[]> = {};
    for (const r of records) (out[r.date] = out[r.date] || []).push(r);
    return out;
  }, [records]);
  const dates = Object.keys(byDate).sort().reverse();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 p-2 sm:w-80">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center font-extrabold text-[#0B1F4B]">{monthLabel(month)}</div>
          <button type="button" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))} className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-slate-100">
          {(
            [
              ['daily', 'Daily'],
              ['monthly', 'Monthly report'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setMode(v)} aria-pressed={mode === v} className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === v ? 'bg-white shadow text-[#0B1F4B]' : 'text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <Loading rows={4} />
      ) : error && !records.length && !report ? (
        <Empty error title="Could not load" message={error} onRetry={load} />
      ) : mode === 'daily' ? (
        dates.length === 0 ? (
          <Empty title="No roll-call this month" message="Saved night attendance will appear here." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {dates.map((d) => {
              const list = byDate[d];
              const notPresent = list.filter((r) => r.status !== 'PRESENT');
              return (
                <Card key={d} className="p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-slate-900">{nightLabel(d, today)}</div>
                    <div className="text-xs text-slate-500">
                      {list.length - notPresent.length} present · {notPresent.length} not present
                    </div>
                  </div>
                  {notPresent.length === 0 ? (
                    <div className="text-sm text-slate-500">Everyone was present.</div>
                  ) : (
                    notPresent.map((r) => (
                      <div key={r.id} className="flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{r.studentName}</div>
                          <div className="text-xs text-slate-500">
                            Room {r.roomNumber || '-'}
                            {r.remarks ? ` · ${r.remarks}` : ''}
                          </div>
                        </div>
                        <Pill className={STATUS[r.status as NightStatus].pill}>{STATUS[r.status as NightStatus].label}</Pill>
                      </div>
                    ))
                  )}
                  {list.some((r) => r.corrected) && (
                    <div className="text-xs text-slate-500 border-t border-slate-100 pt-2">
                      Corrected:{' '}
                      {list
                        .filter((r) => r.corrected)
                        .map((r) => `${r.studentName} → ${STATUS[r.status as NightStatus].label} (${r.history?.[r.history.length - 1]?.reason || ''})`)
                        .join('; ')}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : !report || report.nightsTaken === 0 ? (
        <Empty title="No roll-call this month" message="The report fills in as night attendance is saved." />
      ) : (
        <Card className="overflow-x-auto">
          <div className="px-4 pt-4 text-sm font-bold text-slate-900">{report.nightsTaken} night(s) taken · {monthLabel(month)}</div>
          <table className="w-full text-sm mt-2 min-w-[420px]">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Student</th>
                <th className="text-left px-3 py-2 font-semibold">Room</th>
                <th className="px-3 py-2 font-semibold">Present</th>
                <th className="px-3 py-2 font-semibold">Absent</th>
                <th className="px-3 py-2 font-semibold">On leave</th>
                <th className="px-3 py-2 font-semibold">Outside</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.perStudent.map((p: any) => (
                <tr key={p.studentId}>
                  <td className="px-4 py-2 font-semibold text-slate-900">{p.name}</td>
                  <td className="px-3 py-2 text-slate-600">{p.roomNumber || '-'}</td>
                  <td className="px-3 py-2 text-center">{p.present}</td>
                  <td className={`px-3 py-2 text-center ${p.absent ? 'text-red-700 font-bold' : ''}`}>{p.absent}</td>
                  <td className="px-3 py-2 text-center">{p.onLeave}</td>
                  <td className="px-3 py-2 text-center">{p.outside}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Desk
// ------------------------------------------------------------------------------------------------

export const WardenDeskView: React.FC<{ user: User }> = ({ user }) => {
  const [tab, setTab] = useState<Tab>('home');
  const [hostels, setHostels] = useState<string>('');
  const [chat, setChat] = useState<{ threadId: string; name: string; sub?: string; photo?: string } | null>(null);
  const [chatErr, setChatErr] = useState<string | null>(null);

  useEffect(() => {
    if (!chat) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setChat(null);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [chat]);

  useEffect(() => {
    call('/api/hostel-warden/me').then((r) => r.ok && setHostels((r.data.hostels || []).map((h: any) => h.name).join(', ')));
  }, []);

  const openChat = async (s: { id: string; name: string; photo?: string; sub?: string }) => {
    setChatErr(null);
    const r = await call(`/api/parent-chat/start?studentId=${encodeURIComponent(s.id)}`);
    if (!r.ok || !r.data?.threadId) return setChatErr(errOf(r, 'This chat could not be opened.'));
    setChat({ threadId: r.data.threadId, name: s.name, sub: s.sub ? `Parent: ${s.sub}` : 'Parent', photo: s.photo });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#0B1F4B] px-5 py-4 flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-white/10 text-[#D9A441] flex items-center justify-center shrink-0">
          <BedDouble className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-extrabold text-white truncate">Hostel Warden · {String(user.name || '').split(' ')[0]}</h1>
          <p className="text-xs text-blue-100 truncate">{hostels || 'Your hostel'} · night attendance is separate from school attendance</p>
        </div>
      </div>

      <nav aria-label="Warden sections" className="-mx-1 overflow-x-auto">
        <div className="flex gap-2 px-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition ${tab === t.id ? 'bg-[#123B8C] text-white border-[#123B8C]' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {chatErr && <Notice>{chatErr}</Notice>}

      {tab === 'home' && <HomeTab go={setTab} />}
      {tab === 'attendance' && <AttendanceTab go={setTab} />}
      {tab === 'students' && <StudentsTab onChat={openChat} />}
      {tab === 'leaves' && <LeavesTab />}
      {tab === 'mess' && <MessTab />}
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'history' && <HistoryTab />}

      {chat && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-stretch sm:items-center justify-center sm:p-4" onClick={() => setChat(null)}>
          <div role="dialog" aria-modal="true" aria-label={`Chat about ${chat.name}`} className="bg-white w-full sm:max-w-lg h-full sm:h-[80vh] sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end px-3 pt-2 bg-white">
              <button type="button" onClick={() => setChat(null)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100" aria-label="Close chat">
                <X className="w-4 h-4" /> Close
              </button>
            </div>
            <Conversation threadId={chat.threadId} side="SCHOOL" title={chat.name} subtitle={chat.sub} photo={chat.photo} onBack={() => setChat(null)} />
          </div>
        </div>
      )}
    </div>
  );
};
