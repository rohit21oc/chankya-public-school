import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  User,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  Send,
} from 'lucide-react';
import { SmsLog, SmsStatus } from '../../../types';
import { api } from '../../../services/api';

interface SmsLogDetailsModalProps {
  log: SmsLog | null;
  onClose: () => void;
  onStatusUpdated?: (updatedLog: SmsLog) => void;
}

export const SmsLogDetailsModal: React.FC<SmsLogDetailsModalProps> = ({
  log: initialLog,
  onClose,
  onStatusUpdated,
}) => {
  const [log, setLog] = useState<SmsLog | null>(initialLog);
  const [isChecking, setIsChecking] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  if (!log) return null;

  const handleCheckDelivery = async () => {
    setIsChecking(true);
    setStatusFeedback(null);
    try {
      const res = await api.checkSmsDelivery(log.id);
      if (res && res.success) {
        setStatusFeedback(res.message || `Status verified: ${res.status}`);
        if (res.log) {
          setLog(res.log);
          onStatusUpdated?.(res.log);
        } else if (res.status) {
          const updated = { ...log, status: res.status };
          setLog(updated);
          onStatusUpdated?.(updated);
        }
      } else {
        setStatusFeedback(res?.message || 'Unable to retrieve delivery confirmation from provider.');
      }
    } catch (err: any) {
      setStatusFeedback(err?.message || 'Failed to check delivery status against SMS gateway.');
    } finally {
      setIsChecking(false);
    }
  };

  const renderStatusBadge = (status: SmsStatus) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>DELIVERED (Carrier Verified)</span>
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Send className="w-3.5 h-3.5 text-blue-600" />
            <span>SENT (Carrier Dispatched)</span>
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>SUBMITTED (Gateway Accepted)</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>FAILED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{status || 'UNKNOWN'}</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg text-white ${
                log.status === 'DELIVERED'
                  ? 'bg-emerald-600'
                  : log.status === 'SENT'
                  ? 'bg-blue-600'
                  : log.status === 'FAILED'
                  ? 'bg-rose-600'
                  : 'bg-amber-600'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">SMS Dispatch Details</h3>
              <p className="text-xs text-slate-500">
                Log ID: <span className="font-mono text-slate-700">{log.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Status & Trigger Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-slate-50 border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                Gateway & Delivery Status
              </span>
              {renderStatusBadge(log.status)}
              {log.status === 'SUBMITTED' && (
                <p className="text-[10px] text-slate-500 mt-1 italic">
                  Accepted by SMS gateway. Final carrier delivery report depends on network/DLR.
                </p>
              )}
              {log.deliveredAt && (
                <p className="text-[10px] text-emerald-700 mt-1 font-semibold">
                  Carrier confirmed delivery at: {log.deliveredAt}
                </p>
              )}
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                Trigger Type
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                {log.triggerType}
              </span>
            </div>
          </div>

          {/* Live Status Feedback Banner */}
          {statusFeedback && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Provider Verification Response:</p>
                <p className="mt-0.5 text-[11px]">{statusFeedback}</p>
              </div>
            </div>
          )}

          {/* Failure Alert if any */}
          {log.errorReason && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-0.5">
              <span className="font-bold block text-xs">Failure Reason:</span>
              <p className="text-[11px] font-mono leading-relaxed">{log.errorReason}</p>
            </div>
          )}

          {/* Recipient & Student Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Recipient</span>
              <div className="font-bold text-slate-900 mt-0.5">{log.recipientName}</div>
              <div className="font-mono text-blue-700 mt-0.5">+91 {log.recipientPhone}</div>
              <div className="text-[10px] text-slate-500">Role: {log.recipientRole || 'PARENT'}</div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Linked Student</span>
              <div className="font-bold text-slate-900 mt-0.5">{log.studentName || '—'}</div>
              {log.admissionNumber && (
                <div className="text-[11px] text-slate-600">Adm: {log.admissionNumber}</div>
              )}
              {log.className && (
                <div className="text-[11px] text-slate-600">
                  Class: {log.className} {log.section ? `(${log.section})` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Full Message Text */}
          <div className="space-y-1.5">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
              Dispatched Message Body
            </span>
            <div className="p-3.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs leading-relaxed border border-slate-800 select-text">
              {log.message}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Characters: {log.characterCount || log.message.length}</span>
              <span>Credit Units: {log.smsUnits || 1} SMS</span>
            </div>
          </div>

          {/* Technical Metadata */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Sent At Timestamp:</span>
              <span className="font-mono text-slate-700">{log.sentAt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Gateway Provider:</span>
              <span className="font-bold text-slate-800">{log.provider || 'Not recorded'}</span>
            </div>
            {log.providerMessageId && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Gateway Message ID:</span>
                <span className="font-mono text-slate-700">{log.providerMessageId}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Dispatched By:</span>
              <span className="font-semibold text-slate-800">{log.sentBy || 'System'}</span>
            </div>
            <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200">
              <span className="text-slate-500 shrink-0">Idempotency Key:</span>
              <span className="font-mono text-[10px] text-slate-600 break-all text-right">
                {log.idempotencyKey}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleCheckDelivery}
            disabled={isChecking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Verifying with Provider...' : 'Check Live Delivery Status'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
