import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Small confirmation dialog used before actions that change or remove records.
 * Escape and the Cancel button close it; the confirm button shows progress and
 * cannot be pressed twice.
 */
type Props = {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog: React.FC<Props> = ({ open, title, message, confirmLabel, tone = 'primary', busy, error, onConfirm, onCancel }) => {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  const danger = tone === 'danger';
  const node = (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/50 p-0 sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl p-5 space-y-4">
        <div className="flex gap-3">
          {danger && (
            <div className="w-10 h-10 shrink-0 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <h3 id="confirm-title" className="text-base font-semibold text-slate-900">{title}</h3>
            {message ? <div className="mt-1 text-sm text-slate-600 leading-relaxed">{message}</div> : null}
          </div>
        </div>
        {error ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p> : null}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-10 px-4 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-700 hover:bg-blue-800'}`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
};
