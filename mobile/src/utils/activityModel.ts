/**
 * What the school has told this person lately: unread chats and new notices. Pure functions, so the
 * rules (what counts as new, what the bell lists, what Clear removes) can be tested without a phone.
 */
export type BellKind = 'MESSAGE' | 'FEE' | 'EMERGENCY' | 'NOTICE' | 'ENQUIRY' | 'CALLBACK';

export interface ActivityThread {
  threadId: string;
  /** Who wrote: the staff member (for a parent) or the parent / student (for staff). */
  from: string;
  photo?: string;
  student?: string;
  unread: number;
  lastText?: string;
  lastKind?: string;
  lastAt?: string;
}

export interface ActivityNotice {
  id: string;
  title: string;
  /** ISO time the notice was published. */
  at: string;
}

export interface BellItem {
  id: string;
  kind: BellKind;
  title: string;
  sub?: string;
  at: string;
  photo?: string;
  count?: number;
  /** Where tapping it goes. */
  target: 'messages' | 'notices' | 'fees' | 'enquiries';
}

/** A website lead the office has not responded to yet (status still New). */
export interface ActivityLead {
  id: string;
  kind: 'ENQUIRY' | 'CALLBACK';
  name: string;
  sub?: string;
  at: string;
}

const MAX_NOTICE_AGE_DAYS = 14;

const ts = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** When a notice was published, from whichever date field the server filled. */
export function noticeTime(n: any): string {
  const v = n?.createdAt || n?.publishedAt || n?.publishedDate || n?.publishDate || n?.date || '';
  return ts(v) ? new Date(ts(v)).toISOString() : '';
}

export function toActivityNotices(list: any[]): ActivityNotice[] {
  return (list || [])
    .filter((n) => n && n.id && (!n.status || n.status === 'PUBLISHED'))
    .map((n) => ({ id: String(n.id), title: String(n.title || 'Notice'), at: noticeTime(n) }))
    .filter((n) => n.at)
    .sort((a, b) => ts(b.at) - ts(a.at));
}

/** Notices published after the person last opened Notices. */
export function countNewNotices(notices: ActivityNotice[], seenAt: string): number {
  const seen = ts(seenAt);
  return notices.filter((n) => ts(n.at) > seen).length;
}

/**
 * The bell lists unread chats and new notices that arrived after the last Clear. Clearing only hides them
 * here; chats keep their unread count and the notices stay in Notices.
 */
export function buildBellItems(threads: ActivityThread[], notices: ActivityNotice[], clearedAt: string, now: number = Date.now(), dismissed: Record<string, string> = {}, leads: ActivityLead[] = []): BellItem[] {
  const cleared = ts(clearedAt);
  // A tapped item stays gone until something newer arrives under the same id.
  const hidden = (id: string, at?: string) => !!dismissed[id] && ts(at) <= ts(dismissed[id]);
  const items: BellItem[] = [];
  for (const t of threads) {
    if (t.unread <= 0 || ts(t.lastAt) <= cleared || hidden(`m-${t.threadId}`, t.lastAt)) continue;
    const fee = t.lastKind === 'FEE_DUE';
    const emergency = t.lastKind === 'EMERGENCY';
    items.push({
      id: `m-${t.threadId}`,
      kind: emergency ? 'EMERGENCY' : fee ? 'FEE' : 'MESSAGE',
      title: emergency ? `Emergency message from ${t.from}` : fee ? `Fee payment due${t.student ? ` · ${t.student}` : ''}` : t.unread > 1 ? `${t.unread} new messages from ${t.from}` : `New message from ${t.from}`,
      sub: fee ? 'Tap to pay now' : t.lastText,
      at: t.lastAt || '',
      photo: t.photo,
      count: t.unread,
      target: fee ? 'fees' : 'messages',
    });
  }
  for (const n of notices) {
    if (ts(n.at) <= cleared || hidden(`n-${n.id}`, n.at) || now - ts(n.at) > MAX_NOTICE_AGE_DAYS * 86400000) continue;
    items.push({ id: `n-${n.id}`, kind: 'NOTICE', title: n.title, sub: 'New notice', at: n.at, target: 'notices' });
  }
  for (const l of leads) {
    if (ts(l.at) <= cleared || hidden(`e-${l.id}`, l.at) || now - ts(l.at) > MAX_NOTICE_AGE_DAYS * 86400000) continue;
    items.push({
      id: `e-${l.id}`,
      kind: l.kind,
      title: l.kind === 'CALLBACK' ? `Call back requested: ${l.name}` : `New admission enquiry: ${l.name}`,
      sub: l.sub,
      at: l.at,
      target: 'enquiries',
    });
  }
  return items.sort((a, b) => ts(b.at) - ts(a.at));
}

/** Leads still waiting for a first response, newest first (kept short: the Enquiries screen has the rest). */
export function toActivityLeads(rows: any[], limit = 10): ActivityLead[] {
  return (rows || [])
    .filter((e) => e && e.id && (e.status === 'SUBMITTED' || !e.status))
    .map((e): ActivityLead => {
      const cb = e.kind === 'CALLBACK';
      return {
        id: String(e.id),
        kind: cb ? 'CALLBACK' : 'ENQUIRY',
        name: String((cb ? e.parentName : e.studentName || e.parentName) || 'Website visitor'),
        sub: cb ? String(e.mobile || '') : [e.parentName, e.classApplying].filter(Boolean).join(' · '),
        at: String(e.submittedAt || e.createdAt || ''),
      };
    })
    .filter((l) => ts(l.at))
    .sort((a, b) => ts(b.at) - ts(a.at))
    .slice(0, limit);
}

export const badgeText = (n: number) => (n > 99 ? '99+' : String(n));
