import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { apiService } from './apiService';
import { User } from '../types';
import { ActivityLead, ActivityNotice, ActivityThread, BellItem, buildBellItems, countNewNotices, toActivityLeads, toActivityNotices } from '../utils/activityModel';

/**
 * Unread counts for the badges and the bell. Chats come from the server (it knows what is unread);
 * "new notice" and "cleared from the bell" are remembered on this phone per login.
 */
export interface ActivityState {
  ready: boolean;
  /** Unread chat messages in total. */
  messages: number;
  /** Notices published since the person last opened Notices. */
  noticesNew: number;
  threads: ActivityThread[];
  notices: ActivityNotice[];
  /** Website enquiries / quick calls waiting for a first response (office roles only). */
  leads: ActivityLead[];
  clearedAt: string;
  seenNoticesAt: string;
  dismissed: Record<string, string>;
  bell: BellItem[];
}

const EMPTY: ActivityState = { ready: false, messages: 0, noticesNew: 0, threads: [], notices: [], leads: [], clearedAt: '', seenNoticesAt: '', dismissed: {}, bell: [] };

let state: ActivityState = EMPTY;
let user: User | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let appSub: { remove(): void } | null = null;
let pushSub: { remove(): void } | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<ActivityState>) => {
  const next = { ...state, ...patch };
  next.messages = next.threads.reduce((n, t) => n + t.unread, 0);
  next.noticesNew = countNewNotices(next.notices, next.seenNoticesAt);
  next.bell = buildBellItems(next.threads, next.notices, next.clearedAt, Date.now(), next.dismissed, next.leads);
  state = next;
  emit();
};

// --- small per-login memory on the phone (secure store; plain memory if it is not there) -----------
const mem = new Map<string, string>();
const key = (u: User) => `cps.activity.${String(u.id).replace(/[^A-Za-z0-9._-]/g, '_')}`;
async function readSaved(u: User): Promise<{ clearedAt: string; seenNoticesAt: string; dismissed?: Record<string, string> } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const S = require('expo-secure-store');
    const raw = S?.getItemAsync ? await S.getItemAsync(key(u)) : mem.get(key(u));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function writeSaved(u: User, v: { clearedAt: string; seenNoticesAt: string; dismissed?: Record<string, string> }) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const S = require('expo-secure-store');
    if (S?.setItemAsync) await S.setItemAsync(key(u), JSON.stringify(v));
    else mem.set(key(u), JSON.stringify(v));
  } catch {
    mem.set(key(u), JSON.stringify(v));
  }
}
const persist = () => user && void writeSaved(user, { clearedAt: state.clearedAt, seenNoticesAt: state.seenNoticesAt, dismissed: state.dismissed });

// --- loading -------------------------------------------------------------------------------------
const toThreads = (rows: any[], role: string): ActivityThread[] =>
  (rows || []).map((t) => {
    const fromParent = role !== 'PARENT';
    return {
      threadId: String(t.threadId),
      from: fromParent ? t.parentName || (t.studentName ? `${t.studentName}'s parent` : 'Parent') : t.staffName || 'School',
      photo: fromParent ? t.parentPhoto || t.studentPhoto : t.staffPhoto,
      student: t.studentName,
      unread: Number(t.unread) || 0,
      lastText: t.lastKind === 'FEE_DUE' ? undefined : t.lastText,
      lastKind: t.lastKind,
      lastAt: t.lastAt || undefined,
    };
  });

export async function refreshActivity(): Promise<void> {
  const u = user;
  if (!u) return;
  const role = String(u.role);
  const OFFICE = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN'];
  const [chat, notes, leadRes] = await Promise.all([
    role === 'STUDENT' ? Promise.resolve(null) : apiService.getChatThreads().catch(() => null),
    (role === 'PARENT' ? apiService.getParentNotices({ fresh: true }) : role === 'STUDENT' ? apiService.getMyNotices({ fresh: true }) : apiService.getNotices()).catch(() => null),
    OFFICE.includes(role) ? apiService.getEnquiries({ fresh: true }).catch(() => null) : Promise.resolve(null),
  ]);
  if (user !== u) return; // signed out / switched meanwhile
  const patch: Partial<ActivityState> = { ready: true };
  if (leadRes && leadRes.ok) patch.leads = toActivityLeads(leadRes.data);
  if (chat && chat.ok) patch.threads = toThreads(chat.data, role);
  if (notes && notes.ok) {
    patch.notices = toActivityNotices(notes.data);
    // First run on this phone: everything already published counts as seen.
    if (!state.seenNoticesAt) {
      patch.seenNoticesAt = new Date().toISOString();
      void Promise.resolve().then(persist);
    }
  }
  set(patch);
}

export async function startActivity(u: User): Promise<void> {
  if (user?.id === u.id && timer) return;
  stopActivity();
  user = u;
  const saved = await readSaved(u);
  if (user !== u) return;
  state = { ...EMPTY, clearedAt: saved?.clearedAt || '', seenNoticesAt: saved?.seenNoticesAt || '', dismissed: saved?.dismissed || {} };
  emit();
  void refreshActivity();
  timer = setInterval(() => void refreshActivity(), 45000);
  appSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') void refreshActivity();
  });
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const N = require('expo-notifications');
    pushSub = N.addNotificationReceivedListener(() => void refreshActivity());
  } catch {
    // no notifications module (tests / web)
  }
}

export function stopActivity() {
  if (timer) clearInterval(timer);
  timer = null;
  appSub?.remove();
  pushSub?.remove();
  appSub = pushSub = null;
  user = null;
  state = EMPTY;
  emit();
}

/** Call when the person opens Notices: the "new" badge goes away. */
export function markNoticesSeen() {
  if (!user) return;
  set({ seenNoticesAt: new Date().toISOString() });
  persist();
}

/** Tapping a bell item reads it: it leaves the list (a newer message in that chat brings it back). */
export function dismissBellItem(id: string) {
  if (!user) return;
  const item = state.bell.find((b) => b.id === id);
  if (!item) return;
  const dismissed = { ...state.dismissed, [id]: item.at };
  // keep the saved list small: drop entries older than the notice window
  const cutoff = Date.now() - 15 * 86400000;
  for (const k of Object.keys(dismissed)) if (new Date(dismissed[k]).getTime() < cutoff) delete dismissed[k];
  set({ dismissed });
  persist();
}

/** Bell → Clear: hides what is listed there. Chats keep their unread counts; notices stay in Notices. */
export function clearBell() {
  if (!user) return;
  // Use the school's own timestamps (not this phone's clock): anything newer than the newest listed item shows again.
  const newest = state.bell.reduce((m, b) => (new Date(b.at).getTime() > m ? new Date(b.at).getTime() : m), 0);
  if (!newest) return;
  set({ clearedAt: new Date(newest).toISOString() });
  persist();
}

export function useActivity(): ActivityState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}
