import type { FeeLedgerEntry } from '../../types';

/** ₹1,23,456 (Indian grouping, no decimals). */
export function inr(value: number | string | undefined | null): string {
  const n = Number(value) || 0;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** "Class 2 · A" — never "Class Class 2", and plain names like "Nursery" or "ELP" stay as they are. */
export function classLabel(className?: string, section?: string): string {
  const raw = String(className || '').trim();
  const name = !raw ? 'Class not set' : /^\d+$/.test(raw) ? `Class ${raw}` : raw;
  const sec = String(section || '').trim();
  return sec && sec.toUpperCase() !== 'ALL' ? `${name} · ${sec}` : name;
}

/** 24 Oct 2026; returns the input unchanged if it is not a date. */
export function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Amount still due on an invoice. */
export function ledgerDue(l: FeeLedgerEntry): number {
  if (l.pendingAmount !== undefined && l.pendingAmount !== null) return Math.max(0, Number(l.pendingAmount) || 0);
  return Math.max(0, Number(l.total ?? l.amount ?? 0) - Number(l.paidAmount ?? 0));
}

/** What the bill is for: "October 2026", "Admission charges", or the fee type. */
export function ledgerPeriod(l: FeeLedgerEntry): string {
  if (l.billingPeriod === 'ADMISSION' || /admission/i.test(String(l.feeType || ''))) return 'Admission & one-time charges';
  return l.monthYear || l.feeMonth || l.feeType || 'Fee';
}

export type StatusTone = 'danger' | 'warning' | 'neutral' | 'success';

/** Status shown to people: Paid / Part paid / Overdue / Due / Waived. */
export function ledgerStatus(l: FeeLedgerEntry): { label: string; tone: StatusTone } {
  if (l.status === 'WAIVED') return { label: 'Waived', tone: 'neutral' };
  const due = ledgerDue(l);
  if (due <= 0) return { label: 'Paid', tone: 'success' };
  const today = new Date().toISOString().substring(0, 10);
  if (l.dueDate && String(l.dueDate).substring(0, 10) < today) return { label: 'Overdue', tone: 'danger' };
  if (Number(l.paidAmount) > 0) return { label: 'Part paid', tone: 'warning' };
  return { label: 'Due', tone: 'neutral' };
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  ONLINE_UPI: 'UPI',
  ONLINE: 'Online',
  PHONEPE: 'Online (PhonePe)',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque / DD',
};

export function methodLabel(method?: string): string {
  if (!method) return '';
  return METHOD_LABELS[String(method).toUpperCase()] || String(method).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
