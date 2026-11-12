import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CheckCheck, IndianRupee, MessageCircle, Phone, RefreshCw, Search, Send, Siren, UserPlus, Wallet, X } from 'lucide-react';
import { User } from '../../types';
import { apiFetch } from '../../services/apiConfig';
import { useParentChildren } from '../../hooks/useParentChildren';
import { ParentChildSwitcher, ParentStateBlock } from '../parent/ParentChildSwitcher';
import { PersonAvatar } from '../common/PersonAvatar';
import { StudentSearchPicker, classLabel, toPickable, type PickableStudent } from '../common/StudentSearchPicker';
import { getFileContentUrl } from '../../services/apiConfig';
import { api } from '../../services/api';

/**
 * Messages (website). Same conversations as the mobile app.
 * - Parent: pick a child, then write to the child's teachers, Principal, Super Admin or Chairman.
 * - Staff: conversations addressed to me; start a chat with a student's parents
 *   (teachers: own students only). Fee roles also get the Fee dues list.
 * - Principal / admins: Emergency message to every parent, chosen classes or chosen students.
 * Click a photo in a conversation to see the person's profile (parents: mobile number and children).
 * New messages are fetched every 8 seconds while a conversation is open.
 */

interface Props {
  currentUser: User;
}

const FEE_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACCOUNTANT'];
/** Same list as EMERGENCY_MESSAGE_ROLES on the server. */
const EMERGENCY_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

function relTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (Number.isNaN(m)) return '';
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

async function getJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await apiFetch(url, init);
    let data: any = null;
    try {
      data = await res.json();
    } catch {}
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error. Check your connection.' } };
  }
}
const listOf = (d: any): any[] => (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);

// ---------------------------------------------------------------------------
// Profile card (click a photo in a conversation)
// ---------------------------------------------------------------------------

interface ChatMeta {
  student?: { id: string; name: string; className?: string; section?: string; admissionNumber?: string; photo?: string };
  parent?: { name?: string; phone?: string; photo?: string; children?: Array<{ id: string; name: string; className?: string; section?: string; admissionNumber?: string; photo?: string }> };
  staff?: { name?: string; title?: string; photo?: string; phone?: string };
}

const ProfileCard: React.FC<{ meta: ChatMeta; side: 'PARENT' | 'SCHOOL'; onClose: () => void }> = ({ meta, side, onClose }) => {
  // Staff look at the parent (with the child); parents look at the staff member.
  const person =
    side === 'SCHOOL'
      ? { name: meta.parent?.name || 'Parent / Guardian', sub: 'Parent / Guardian', photo: meta.parent?.photo }
      : { name: meta.staff?.name || 'School', sub: meta.staff?.title || 'Staff', photo: meta.staff?.photo };
  const big = person.photo ? getFileContentUrl(person.photo) : '';
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (zoom ? setZoom(false) : onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom, onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${person.name} profile`} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-[#0B1F4B] px-5 pt-6 pb-5 text-center shrink-0">
          <button type="button" onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
          {big ? (
            <button type="button" onClick={() => setZoom(true)} className="mx-auto block rounded-full ring-4 ring-white/20" aria-label="View full photo">
              <PersonAvatar name={person.name} photo={person.photo} size={112} />
            </button>
          ) : (
            <PersonAvatar name={person.name} photo={person.photo} size={112} className="mx-auto ring-4 ring-white/20" />
          )}
          <div className="mt-3 text-lg font-bold text-white">{person.name}</div>
          <div className="text-xs text-blue-200">{person.sub}</div>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          {side === 'SCHOOL' && (
            <>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Mobile number</div>
                {meta.parent?.phone ? (
                  <a href={`tel:${meta.parent.phone}`} className="inline-flex items-center gap-2 text-base font-semibold text-blue-800 hover:underline">
                    <Phone className="w-4 h-4" /> {meta.parent.phone}
                  </a>
                ) : (
                  <span className="text-sm text-slate-500">Not on record</span>
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">{(meta.parent?.children?.length || 0) > 1 ? 'Children' : 'Child'}</div>
                <div className="space-y-2">
                  {(meta.parent?.children?.length ? meta.parent.children : meta.student ? [meta.student] : []).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                      <PersonAvatar name={c.name} photo={c.photo} size={40} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
                        <div className="text-xs text-slate-500 truncate">{[classLabel(c), c.admissionNumber].filter(Boolean).join(' · ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {side === 'PARENT' && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Mobile number</div>
              {meta.staff?.phone ? (
                <a href={`tel:${meta.staff.phone}`} className="inline-flex items-center gap-2 text-base font-semibold text-blue-800 hover:underline" aria-label={`Call ${person.name} on ${meta.staff.phone}`}>
                  <Phone className="w-4 h-4" /> {meta.staff.phone}
                </a>
              ) : (
                <span className="text-sm text-slate-500">Not on record. You can send a message instead.</span>
              )}
            </div>
          )}
          {side === 'PARENT' && meta.student && (
            <p className="text-sm text-slate-600">
              Conversation about <span className="font-semibold text-slate-900">{meta.student.name}</span>
              {classLabel(meta.student) ? ` (${classLabel(meta.student)})` : ''}.
            </p>
          )}
        </div>
      </div>
      {zoom && big && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setZoom(false); }}>
          <img src={big} alt={person.name} className="max-w-full max-h-full rounded-xl object-contain" referrerPolicy="no-referrer" />
          <button type="button" onClick={() => setZoom(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center" aria-label="Close photo">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Conversation pane (shared)
// ---------------------------------------------------------------------------

export const Conversation: React.FC<{ threadId: string; side: 'PARENT' | 'SCHOOL'; title: string; subtitle?: string; photo?: string; onBack?: () => void; onRead?: () => void }> = ({ threadId, side, title, subtitle, photo, onBack, onRead }) => {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [meta, setMeta] = useState<ChatMeta>({});
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  const lastCount = useRef(0);

  const load = useCallback(async (quiet = false) => {
    const r = await getJson(`/api/parent-chat/threads/${encodeURIComponent(threadId)}/messages`);
    if (r.ok) {
      setMsgs(listOf(r.data));
      setMeta({ student: r.data?.student, parent: r.data?.parent, staff: r.data?.staff });
      setError(null);
      onReadRef.current?.();
    } else if (!quiet) setError(r.data?.error || 'Messages could not be loaded.');
    setLoading(false);
  }, [threadId]);

  useEffect(() => {
    setLoading(true);
    setMsgs([]);
    lastCount.current = 0;
    void load();
    const t = setInterval(() => load(true), 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (msgs.length !== lastCount.current) {
      lastCount.current = msgs.length;
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [msgs]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const r = await getJson(`/api/parent-chat/threads/${encodeURIComponent(threadId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body }),
    });
    setSending(false);
    if (r.ok && r.data?.message) {
      setText('');
      setMsgs((m) => [...m, r.data.message]);
    } else setError(r.data?.error || 'Not sent. Please try again.');
  };

  let lastDay = '';
  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
        {onBack && (
          <button type="button" onClick={onBack} className="lg:hidden w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
        )}
        <PersonAvatar
          name={title}
          photo={photo || (side === 'SCHOOL' ? meta.student?.photo : meta.staff?.photo)}
          size={40}
          onClick={() => setShowProfile(true)}
          label={side === 'SCHOOL' ? 'View parent profile' : `View ${title}'s profile`}
        />
        <button type="button" onClick={() => setShowProfile(true)} className="min-w-0 text-left">
          <div className="text-sm font-bold text-slate-900 truncate">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
        </button>
        {side === 'PARENT' && meta.staff?.phone && (
          <a href={`tel:${meta.staff.phone}`} className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50" aria-label={`Call ${title} ${meta.staff.phone}`}>
            <Phone className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Call</span>
          </a>
        )}
        {side === 'SCHOOL' && meta.parent?.phone && (
          <a href={`tel:${meta.parent.phone}`} className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50" aria-label={`Call parent ${meta.parent.phone}`}>
            <Phone className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{meta.parent.phone}</span>
          </a>
        )}
      </div>
      {showProfile && <ProfileCard meta={meta} side={side} onClose={() => setShowProfile(false)} />}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
        {loading && <div className="w-7 h-7 mx-auto mt-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />}
        {!loading && msgs.length === 0 && (
          <div className="text-center text-sm text-slate-500 mt-16">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            {side === 'PARENT' ? 'Write your message below. They will reply here.' : 'No messages yet. Say hello to the parent.'}
          </div>
        )}
        {msgs.map((m) => {
          const day = dayOf(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.senderSide === side;
          return (
            <React.Fragment key={m.id}>
              {showDay && (
                <div className="flex justify-center py-1">
                  <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-0.5">{day}</span>
                </div>
              )}
              {m.kind === 'EMERGENCY' ? (
                <div className={`max-w-md rounded-2xl border-2 border-red-300 bg-red-50 p-4 ${mine ? 'ml-auto' : ''}`}>
                  <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" /> Emergency message
                  </div>
                  <p className="text-sm text-slate-900 mt-1.5 whitespace-pre-wrap break-words">{m.text}</p>
                  <div className="text-[10px] text-slate-500 mt-1 text-right">{timeOf(m.createdAt)}{m.senderName ? ` · ${m.senderName}` : ''}</div>
                </div>
              ) : m.kind === 'FEE_DUE' ? (
                <div className={`max-w-md rounded-2xl border-2 border-rose-200 bg-white p-4 ${mine ? 'ml-auto' : ''}`}>
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                    <Wallet className="w-4 h-4" /> Fee due reminder
                  </div>
                  <div className="text-2xl font-extrabold text-[#0B1F4B] mt-1">{inr(m.feeDue?.totalPending)}</div>
                  {m.feeDue?.overdue > 0 && <div className="text-xs font-semibold text-rose-700">{inr(m.feeDue.overdue)} is past the due date</div>}
                  <div className="mt-2 divide-y divide-slate-100">
                    {(m.feeDue?.items || []).slice(0, 4).map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs py-1">
                        <span className="text-slate-700 truncate">{it.label}</span>
                        <span className="font-semibold text-slate-900">{inr(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">{m.text}</p>
                  <div className="text-[10px] text-slate-400 mt-1 text-right">{timeOf(m.createdAt)}{m.senderName ? ` · ${m.senderName}` : ''}</div>
                </div>
              ) : (
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-[#123B8C] text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'}`}>
                    {!mine && m.senderName && <div className="text-[11px] font-semibold text-blue-700 mb-0.5">{m.senderName}</div>}
                    <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
                    <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${mine ? 'text-blue-100' : 'text-slate-400'}`}>
                      {timeOf(m.createdAt)}
                      {mine && ((side === 'SCHOOL' ? m.readByParentAt : m.readBySchoolAt) ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />)}
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && (
        <button type="button" onClick={() => { setError(null); load(); }} className="text-xs text-rose-700 bg-rose-50 py-1.5">
          {error}
        </button>
      )}
      <form
        className="flex items-end gap-2 p-3 bg-white border-t border-slate-200"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Type a message (Enter to send, Shift+Enter for a new line)"
          aria-label="Message"
          className="flex-1 resize-none max-h-32 min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" disabled={!text.trim() || sending} className="w-11 h-11 rounded-full bg-[#123B8C] text-white flex items-center justify-center disabled:opacity-50" aria-label="Send">
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

const ParentMessages: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { children, activeChild, state: childState, reload, selectChild, switchError } = useParentChildren(currentUser);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!activeChild) return;
    const r = await getJson(`/api/parent-chat/contacts?studentId=${encodeURIComponent(activeChild.id)}`);
    if (r.ok) {
      setContacts(listOf(r.data));
      setError(null);
    } else setError(r.data?.error || 'Could not load.');
    setLoading(false);
  }, [activeChild?.id]);

  useEffect(() => {
    setOpen(null);
    setLoading(true);
    void load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  if (childState === 'loading') return <ParentStateBlock kind="loading" title="Loading your children" />;
  if (childState === 'error') return <ParentStateBlock kind="error" title="Your children could not be loaded" onRetry={reload} />;
  if (!activeChild) return <ParentStateBlock kind="empty" title="No child linked to this account" />;

  const groups: Array<{ title: string; items: any[] }> = [
    { title: `${activeChild.name.split(' ')[0]}'s teachers`, items: contacts.filter((c) => c.group === 'TEACHER') },
    { title: 'School management', items: contacts.filter((c) => c.group !== 'TEACHER') },
  ];

  return (
    <div className="space-y-4">
      <ParentChildSwitcher items={children} activeChildId={activeChild.id} onSelect={selectChild} switchError={switchError} />
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden grid lg:grid-cols-[340px_1fr] h-[calc(100vh-220px)] min-h-[520px]">
        <div className={`border-r border-slate-200 overflow-y-auto ${open ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="w-7 h-7 mx-auto mt-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
          ) : error ? (
            <p className="p-4 text-sm text-rose-700">{error}</p>
          ) : (
            groups.map((g) => (
              <div key={g.title}>
                <div className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{g.title}</div>
                {g.items.length === 0 && <p className="px-4 py-2 text-xs text-slate-500">No one available.</p>}
                {g.items.map((c) => (
                  <button
                    key={c.threadId}
                    type="button"
                    onClick={() => setOpen(c)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 ${open?.threadId === c.threadId ? 'bg-blue-50' : ''}`}
                  >
                    <PersonAvatar name={c.name} photo={c.photo} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2">
                        <span className={`text-sm truncate ${c.unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{c.name}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">{relTime(c.lastAt)}</span>
                      </span>
                      <span className="flex justify-between gap-2 items-center">
                        <span className="text-xs text-slate-500 truncate">{c.lastText || c.title}</span>
                        {c.unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center">{c.unread}</span>}
                      </span>
                      {c.lastText && <span className="block text-[11px] text-blue-700 truncate">{c.title}</span>}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <div className={`min-h-0 ${open ? '' : 'hidden lg:flex'} lg:flex flex-col`}>
          {open ? (
            <Conversation key={open.threadId} threadId={open.threadId} side="PARENT" title={open.name} photo={open.photo} subtitle={`${open.title} · about ${activeChild.name}`} onBack={() => { setOpen(null); load(); }} onRead={load} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm p-8 text-center">
              <MessageCircle className="w-10 h-10 mb-2 text-slate-300" />
              Choose a teacher or a member of the school management to start a conversation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const FeeDues: React.FC<{ onOpenChat: (s: { id: string; name: string; photo?: string }) => void }> = ({ onOpenChat }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cls, setCls] = useState('All');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await getJson('/api/fee-dues/summary');
    if (r.ok) {
      setRows(listOf(r.data));
      setError(null);
    } else setError(r.data?.error || 'Fee dues could not be loaded.');
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const classes = useMemo(() => ['All', ...Array.from(new Set(rows.map((r) => r.className).filter(Boolean))).sort((a: any, b: any) => String(a).localeCompare(String(b), 'en', { numeric: true }))], [rows]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = rows.filter(
    (r) =>
      (cls === 'All' || r.className === cls) &&
      (!onlyOverdue || r.overdue > 0) &&
      (!words.length || words.every((w) => [r.studentName, r.admissionNumber, r.fatherName, r.className && `class ${r.className}`].some((x) => String(x || '').toLowerCase().includes(w))))
  );
  const allOn = list.length > 0 && list.every((r) => sel.has(r.studentId));
  const total = list.reduce((s, r) => s + r.totalPending, 0);
  const overdue = list.reduce((s, r) => s + r.overdue, 0);

  const send = async () => {
    // Everyone ticked, even if the current search or class filter hides some of them.
    const ids = rows.filter((r) => sel.has(r.studentId)).map((r) => r.studentId);
    if (!ids.length || !window.confirm(`Send a fee reminder to the parents of ${ids.length} student(s)?`)) return;
    setBusy(true);
    const r = await getJson('/api/fee-dues/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentIds: ids, note: note.trim() || undefined }) });
    setBusy(false);
    if (!r.ok) return setResult(r.data?.error || 'Not sent.');
    let msg = `Reminder sent to ${r.data.sent} parent(s).`;
    if (r.data.skipped) msg += ` ${r.data.skipped} skipped (no dues).`;
    setResult(msg);
    setSel(new Set());
    setNote('');
    load();
  };

  if (loading) return <ParentStateBlock kind="loading" title="Loading fee dues" />;
  if (error) return <ParentStateBlock kind="error" title="Fee dues unavailable" message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#0B1F4B] text-white p-4">
          <div className="text-xs text-blue-200">Total pending</div>
          <div className="text-2xl font-extrabold">{inr(total)}</div>
          <div className="text-xs text-blue-200">{list.length} students</div>
        </div>
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4">
          <div className="text-xs text-rose-700">Overdue</div>
          <div className="text-2xl font-extrabold text-rose-700">{inr(overdue)}</div>
          <div className="text-xs text-rose-600">past due date</div>
        </div>
      </div>
      {result && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3">{result}</div>}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
        <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student, admission no. or father’s name" aria-label="Search students with fee due" className="flex-1 py-2.5 text-sm focus:outline-none" />
        {q && (
          <button type="button" onClick={() => setQ('')} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <button key={c} type="button" onClick={() => setCls(c)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${cls === c ? 'bg-[#123B8C] text-white border-[#123B8C]' : 'bg-white border-slate-200 text-slate-700'}`}>
            {c === 'All' ? 'All classes' : classLabel({ className: c })}
          </button>
        ))}
        <button type="button" onClick={() => setOnlyOverdue((x) => !x)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${onlyOverdue ? 'bg-rose-700 text-white border-rose-700' : 'bg-white border-slate-200 text-slate-700'}`}>
          Overdue only
        </button>
      </div>
      {list.length === 0 ? (
        <ParentStateBlock kind="empty" title={q.trim() ? `No student with fee due matches “${q.trim()}”` : 'No pending fee here'} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="p-3 w-10 text-left">
                  <input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(list.map((r) => r.studentId)))} aria-label="Select all" />
                </th>
                <th className="p-3 text-left">Student</th>
                <th className="p-3 text-left hidden sm:table-cell">Last reminder</th>
                <th className="p-3 text-right">Pending</th>
                <th className="p-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => (
                <tr key={r.studentId} className="hover:bg-slate-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={sel.has(r.studentId)}
                      onChange={() => setSel((s) => { const n = new Set(s); n.has(r.studentId) ? n.delete(r.studentId) : n.add(r.studentId); return n; })}
                      aria-label={`Select ${r.studentName}`}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={r.studentName} photo={r.studentPhoto} size={36} />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{r.studentName}</div>
                        <div className="text-xs text-slate-500 truncate">{[classLabel(r), r.admissionNumber, r.fatherName && `Father: ${r.fatherName}`].filter(Boolean).join(' · ')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-slate-500 hidden sm:table-cell">{r.lastAlertAt ? `${relTime(r.lastAlertAt)} ago` : '—'}</td>
                  <td className="p-3 text-right">
                    <div className="font-bold text-[#0B1F4B]">{inr(r.totalPending)}</div>
                    {r.overdue > 0 && <div className="text-[11px] font-semibold text-rose-700">{inr(r.overdue)} overdue</div>}
                  </td>
                  <td className="p-3">
                    <button type="button" onClick={() => onOpenChat({ id: r.studentId, name: r.studentName, photo: r.studentPhoto })} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center" aria-label={`Chat with parent of ${r.studentName}`}>
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sel.size > 0 && (
        <div className="sticky bottom-0 bg-white rounded-2xl border border-slate-200 shadow-lg p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Add a note (optional), e.g. Last date 30 Oct" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button type="button" onClick={send} disabled={busy} className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-60">
            <IndianRupee className="w-4 h-4" /> {busy ? 'Sending…' : `Send reminder to ${sel.size}`}
          </button>
        </div>
      )}
    </div>
  );
};

const Emergency: React.FC = () => {
  const [scope, setScope] = useState<'ALL' | 'CLASS' | 'STUDENTS'>('ALL');
  const [text, setText] = useState('');
  const [classIds, setClassIds] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<PickableStudent[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [alsoStaff, setAlsoStaff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const classes = useMemo(
    () => api.getClasses().filter((c: any) => String(c.status || 'ACTIVE').toUpperCase() === 'ACTIVE').sort((a: any, b: any) => (a.numericOrder || 0) - (b.numericOrder || 0)),
    []
  );

  useEffect(() => {
    if (scope !== 'STUDENTS' || students.length) return;
    void getJson('/api/students?limit=5000').then((r) => setStudents(listOf(r.data).filter((s: any) => String(s.status || 'ACTIVE').toUpperCase() === 'ACTIVE')));
  }, [scope, students.length]);
  const pickable = useMemo(() => students.map(toPickable), [students]);

  const ready = text.trim().length > 0 && (scope === 'ALL' || (scope === 'CLASS' ? classIds.size > 0 : picked.length > 0));
  const who =
    scope === 'ALL'
      ? 'the parents of ALL students'
      : scope === 'CLASS'
        ? `the parents of ${classes.filter((c: any) => classIds.has(c.id)).map((c: any) => c.name).join(', ')}`
        : `the parents of ${picked.length} selected student(s)`;

  const send = async () => {
    if (!ready || busy) return;
    if (!window.confirm(`Send this EMERGENCY message to ${who}?${alsoStaff ? ' Staff will also get a phone alert.' : ''}\n\n"${text.trim()}"`)) return;
    setBusy(true);
    setResult(null);
    const r = await getJson('/api/parent-chat/emergency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, text: text.trim(), classIds: [...classIds], studentIds: picked.map((p) => p.id), alsoStaff }),
    });
    setBusy(false);
    if (!r.ok) return setResult({ ok: false, msg: r.data?.error || 'Not sent. Please try again.' });
    setResult({ ok: true, msg: `Emergency message sent to the parents of ${r.data.sent} student(s). They also get a phone / browser alert.` });
    setText('');
    setPicked([]);
    setClassIds(new Set());
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 max-w-3xl">
      <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-3">
        <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
        <p className="text-sm text-red-900">Use for urgent news only (school closed, early dismissal, safety alert). It arrives in each parent’s Messages from the School office, with a phone alert.</p>
      </div>
      <fieldset>
        <legend className="text-sm font-bold text-slate-900 mb-2">Send to</legend>
        <div className="inline-flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1">
          {([['ALL', 'All parents'], ['CLASS', 'Selected classes'], ['STUDENTS', 'Individual students']] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${scope === v ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600'}`}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      {scope === 'CLASS' && (
        <div className="flex flex-wrap gap-2">
          {classes.map((c: any) => {
            const on = classIds.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setClassIds((cur) => { const n = new Set(cur); on ? n.delete(c.id) : n.add(c.id); return n; })}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${on ? 'bg-red-700 text-white border-red-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
              >
                {c.name}
              </button>
            );
          })}
          {classes.length === 0 && <p className="text-sm text-slate-500">No classes found.</p>}
        </div>
      )}
      {scope === 'STUDENTS' && (
        <div className="space-y-3">
          {students.length === 0 ? (
            <p className="text-sm text-slate-500">Loading students…</p>
          ) : (
            <StudentSearchPicker students={pickable} selectedIds={picked.map((p) => p.id)} onSelect={(st) => setPicked((cur) => [...cur, st])} keepQuery />
          )}
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {picked.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-slate-100 text-sm">
                  <PersonAvatar name={p.name} photo={p.photo} size={26} />
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="text-xs text-slate-500">{classLabel(p)}</span>
                  <button type="button" onClick={() => setPicked((cur) => cur.filter((x) => x.id !== p.id))} className="text-slate-400 hover:text-slate-700" aria-label={`Remove ${p.name}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div>
        <label htmlFor="emergency-text" className="text-sm font-bold text-slate-900">Message</label>
        <textarea
          id="emergency-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="e.g. School will close at 12:00 today due to heavy rain. Please collect your child from the main gate."
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <div className="text-right text-[11px] text-slate-400">{text.length}/2000</div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={alsoStaff} onChange={(e) => setAlsoStaff(e.target.checked)} /> Also send a phone alert to staff
      </label>
      {result && <div className={`rounded-xl text-sm p-3 border ${result.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{result.msg}</div>}
      <button type="button" onClick={send} disabled={!ready || busy} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold text-sm disabled:opacity-50">
        <Siren className="w-4 h-4" /> {busy ? 'Sending…' : 'Send emergency message'}
      </button>
    </div>
  );
};

const StaffMessages: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const mayFees = FEE_ROLES.includes(currentUser.role);
  const mayEmergency = EMERGENCY_ROLES.includes(currentUser.role);
  const [tab, setTab] = useState<'CHATS' | 'FEES' | 'EMERGENCY'>('CHATS');
  const [threads, setThreads] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<{ threadId: string; name: string; sub?: string; photo?: string } | null>(null);
  const [picker, setPicker] = useState(false);
  const [students, setStudents] = useState<any[]>([]);

  const load = useCallback(async () => {
    const r = await getJson('/api/parent-chat/threads');
    if (r.ok) {
      setThreads(listOf(r.data));
      setUnread(Number(r.data?.unreadTotal) || 0);
      setError(null);
    } else setError(r.data?.error || 'Chats could not be loaded.');
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const startWith = async (st: { id: string; name: string; sub?: string; photo?: string }) => {
    const r = await getJson(`/api/parent-chat/start?studentId=${encodeURIComponent(st.id)}`);
    if (!r.ok || !r.data?.threadId) return setError(r.data?.error || 'This chat could not be opened.');
    setTab('CHATS');
    setPicker(false);
    setOpen({ threadId: r.data.threadId, name: st.name, sub: st.sub, photo: st.photo });
  };

  const [pickerLoaded, setPickerLoaded] = useState(false);
  const openPicker = async () => {
    setPicker(true);
    if (students.length) return;
    // A hostel warden can chat only with parents of the students living in their hostel.
    const r = currentUser.role === 'HOSTEL_WARDEN' ? await getJson('/api/hostel-warden/students') : await getJson('/api/students?limit=2000');
    setStudents(listOf(r.data).filter((s: any) => String(s.status || 'ACTIVE').toUpperCase() === 'ACTIVE'));
    setPickerLoaded(true);
  };

  const shown = threads.filter((t) => !q.trim() || [t.studentName, t.parentName, t.className, t.admissionNumber].some((x) => String(x || '').toLowerCase().includes(q.trim().toLowerCase())));
  const pickable = useMemo(() => students.map(toPickable), [students]);

  return (
    <div className="space-y-4">
      {(mayFees || mayEmergency) && (
        <div className="inline-flex flex-wrap bg-white border border-slate-200 rounded-xl p-1">
          {(['CHATS', ...(mayFees ? (['FEES'] as const) : []), ...(mayEmergency ? (['EMERGENCY'] as const) : [])] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${tab === t ? (t === 'EMERGENCY' ? 'bg-red-700 text-white' : 'bg-[#0B1F4B] text-white') : t === 'EMERGENCY' ? 'text-red-700' : 'text-slate-600'}`}>
              {t === 'EMERGENCY' && <Siren className="w-4 h-4" />}
              {t === 'CHATS' ? 'Chats' : t === 'FEES' ? 'Fee reminders' : 'Emergency'}
              {t === 'CHATS' && unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center">{unread}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === 'EMERGENCY' ? (
        <Emergency />
      ) : tab === 'FEES' ? (
        <FeeDues onOpenChat={(s) => startWith({ id: s.id, name: s.name, photo: s.photo })} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden grid lg:grid-cols-[360px_1fr] h-[calc(100vh-230px)] min-h-[520px]">
          <div className={`border-r border-slate-200 flex flex-col min-h-0 ${open ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-3 flex gap-2 border-b border-slate-100">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student or parent" className="flex-1 py-2 text-sm focus:outline-none" />
              </div>
              <button type="button" onClick={openPicker} className="px-3 rounded-xl bg-[#123B8C] text-white text-sm font-semibold flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" /> New
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="w-7 h-7 mx-auto mt-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
              ) : error ? (
                <p className="p-4 text-sm text-rose-700">{error}</p>
              ) : shown.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Parents' messages to you appear here. Click New to message the parents of a student.
                </div>
              ) : (
                shown.map((t) => (
                  <button
                    key={t.threadId}
                    type="button"
                    onClick={() => setOpen({ threadId: t.threadId, name: t.studentName, photo: t.studentPhoto, sub: [t.parentName, classLabel(t)].filter(Boolean).join(' · ') })}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${open?.threadId === t.threadId ? 'bg-blue-50' : ''}`}
                  >
                    <PersonAvatar name={t.studentName} photo={t.studentPhoto} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2">
                        <span className={`text-sm truncate ${t.unread ? 'font-bold' : 'font-semibold'} text-slate-900`}>{t.studentName}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">{relTime(t.lastAt)}</span>
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">{[t.parentName, classLabel(t), t.staffId === 'SCHOOL' ? 'School office' : null].filter(Boolean).join(' · ')}</span>
                      <span className="flex justify-between gap-2 items-center">
                        <span className={`text-xs truncate ${t.unread ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>{t.lastKind === 'FEE_DUE' ? 'Fee due reminder' : t.lastKind === 'EMERGENCY' ? `Emergency: ${t.lastText}` : `${t.lastSide === 'SCHOOL' ? 'You: ' : ''}${t.lastText}`}</span>
                        {t.unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center">{t.unread}</span>}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className={`min-h-0 ${open ? 'flex' : 'hidden lg:flex'} flex-col`}>
            {open ? (
              <Conversation key={open.threadId} threadId={open.threadId} side="SCHOOL" title={open.name} photo={open.photo} subtitle={open.sub ? `Parent chat · ${open.sub}` : 'Parent chat'} onBack={() => { setOpen(null); load(); }} onRead={load} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm p-8 text-center">
                <MessageCircle className="w-10 h-10 mb-2 text-slate-300" />
                Select a conversation, or click New to message a parent.
              </div>
            )}
          </div>
        </div>
      )}

      {picker && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => setPicker(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Message a parent</h3>
              <button type="button" onClick={() => setPicker(false)} className="text-sm font-semibold text-blue-700">Close</button>
            </div>
            <div className="p-4 pb-6 min-h-[320px]">
              {students.length === 0 ? (
                <p className="text-sm text-slate-500">{pickerLoaded ? (currentUser.role === 'HOSTEL_WARDEN' ? 'No students in your hostel yet.' : 'No students found.') : 'Loading students…'}</p>
              ) : (
                <StudentSearchPicker
                  autoFocus
                  students={pickable}
                  onSelect={(st) => startWith({ id: st.id, name: st.name, sub: st.fatherName, photo: st.photo })}
                  placeholder="Type student name, admission no., class or father’s name"
                />
              )}
              <p className="mt-3 text-xs text-slate-500">Pick a student to open a private chat with their parents.</p>
              {/* A hostel warden has a short list (only their hostel's students): show it straight away. */}
              {currentUser.role === 'HOSTEL_WARDEN' && pickable.length > 0 && (
                <div className="mt-3 max-h-[40vh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl" aria-label="Students in your hostel">
                  {pickable.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => startWith({ id: st.id, name: st.name, sub: st.fatherName, photo: st.photo })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50"
                    >
                      <PersonAvatar name={st.name} photo={st.photo} size={34} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 truncate">{st.name}</span>
                        <span className="block text-xs text-slate-500 truncate">
                          {classLabel(st)}
                          {(st as any).roomNumber ? ` · Room ${(st as any).roomNumber}` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MessagesView: React.FC<Props> = ({ currentUser }) => (
  <div className="space-y-4">
    <div>
      <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-blue-700" /> Messages
      </h1>
      <p className="text-sm text-slate-500">
        {currentUser.role === 'PARENT' ? 'Write to your child’s teachers, the Principal, the Super Admin or the Chairman.' : 'Conversations with parents. Each conversation is private to you and the parent.'}
      </p>
    </div>
    {currentUser.role === 'PARENT' ? <ParentMessages currentUser={currentUser} /> : <StaffMessages currentUser={currentUser} />}
  </div>
);
