/**
 * Admission enquiries and quick call requests from the public website. Pure functions, so the rules
 * (what is "new", how a list is filtered, which number a call or WhatsApp opens) can be tested offline.
 */
export type EnquiryKind = 'ENQUIRY' | 'CALLBACK';
export type EnquiryStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'CONTACTED' | 'VISIT_SCHEDULED' | 'ADMITTED' | 'CLOSED';

export interface Enquiry {
  id: string;
  kind?: EnquiryKind;
  referenceNumber?: string;
  parentName: string;
  studentName?: string;
  mobile: string;
  email?: string;
  classApplying?: string;
  currentSchool?: string;
  message?: string;
  preferredTime?: string;
  status: string;
  submittedAt?: string;
  createdAt?: string;
  notes?: string;
  followUpDate?: string;
}

export const STATUS_UI: { value: EnquiryStatus; label: string; fg: string; bg: string }[] = [
  { value: 'SUBMITTED', label: 'New', fg: '#93370D', bg: '#FEF0C7' },
  { value: 'UNDER_REVIEW', label: 'Under review', fg: '#1849A9', bg: '#D1E9FF' },
  { value: 'CONTACTED', label: 'Contacted', fg: '#5925DC', bg: '#EBE9FE' },
  { value: 'VISIT_SCHEDULED', label: 'Visit scheduled', fg: '#0E7090', bg: '#CFF9FE' },
  { value: 'ADMITTED', label: 'Admitted', fg: '#067647', bg: '#D1FADF' },
  { value: 'CLOSED', label: 'Closed', fg: '#344054', bg: '#EAECF0' },
];

const LEGACY: Record<string, EnquiryStatus> = { REVIEWED: 'UNDER_REVIEW', ACCEPTED: 'ADMITTED' };

export const statusOf = (s: string): string => LEGACY[s] || s;
export const kindOf = (e: Enquiry): EnquiryKind => (e.kind === 'CALLBACK' ? 'CALLBACK' : 'ENQUIRY');
export const whenOf = (e: Enquiry): string => String(e.submittedAt || e.createdAt || '');
export const isNew = (e: Enquiry): boolean => statusOf(e.status) === 'SUBMITTED';

const ts = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = ts(iso);
  if (!t) return '';
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

/** The 10 digits a call or WhatsApp should use, whatever way it was typed (+91, 0, spaces). */
export function dialDigits(mobile: string): string {
  const d = String(mobile || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}

export const telUrl = (mobile: string) => `tel:${dialDigits(mobile)}`;

export function whatsappUrl(e: Enquiry): string {
  const about = kindOf(e) === 'CALLBACK' ? 'your call back request' : `your admission enquiry${e.studentName ? ` for ${e.studentName}` : ''}`;
  const text = `Namaste ${e.parentName}, this is Residential PDS Public School, Sheohar regarding ${about}.`;
  return `https://wa.me/91${dialDigits(e.mobile)}?text=${encodeURIComponent(text)}`;
}

export function countByKind(list: Enquiry[]) {
  const c = { ALL: list.length, ENQUIRY: 0, CALLBACK: 0, NEW: 0 };
  for (const e of list) {
    c[kindOf(e)]++;
    if (isNew(e)) c.NEW++;
  }
  return c;
}

/** Newest first; new ones are not pushed to the top, so the list order stays predictable. */
export function filterEnquiries(list: Enquiry[], kind: 'ALL' | EnquiryKind, status: 'ALL' | 'NEW' | 'OPEN' | 'DONE', query: string): Enquiry[] {
  const q = query.trim().toLowerCase();
  return list
    .filter((e) => {
      if (kind !== 'ALL' && kindOf(e) !== kind) return false;
      const st = statusOf(e.status);
      if (status === 'NEW' && st !== 'SUBMITTED') return false;
      if (status === 'OPEN' && (st === 'ADMITTED' || st === 'CLOSED')) return false;
      if (status === 'DONE' && st !== 'ADMITTED' && st !== 'CLOSED') return false;
      if (!q) return true;
      return [e.parentName, e.studentName, e.mobile, e.referenceNumber, e.classApplying].some((v) => String(v || '').toLowerCase().includes(q));
    })
    .sort((a, b) => ts(whenOf(b)) - ts(whenOf(a)));
}
