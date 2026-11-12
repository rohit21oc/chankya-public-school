import React, { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, FileCheck2, GraduationCap, RefreshCw, ShieldAlert, Trophy, Users } from 'lucide-react';
import { SmsTriggerType, UserRole } from '../../../types';
import { api } from '../../../services/api';
import { SmsQuickTriggerModal } from './SmsQuickTriggerModal';
import { canSendSms } from '../../../utils/communicationAccess';

interface SmsCenterTabProps {
  userRole: UserRole;
  onRefreshHistory: () => void;
  onOpenComposer?: () => void;
}

type Stats = { todaySent: number; todayFailed: number; totalSent: number; configured?: boolean; loaded?: boolean; countsAvailable?: boolean };

const TRIGGERS: { type: SmsTriggerType; title: string; detail: string; icon: React.ElementType }[] = [
  { type: 'DAILY_ABSENTEE' as SmsTriggerType, title: 'Absent today', detail: "Parents of students marked absent in today's attendance", icon: Users },
  { type: 'FEE_REMINDER' as SmsTriggerType, title: 'Fee dues', detail: 'Parents of students with unpaid fees', icon: CreditCard },
  { type: 'EXAM_ANNOUNCEMENT' as SmsTriggerType, title: 'Exam schedule', detail: 'Parents of the classes in an exam', icon: GraduationCap },
  { type: 'ADMIT_CARD_PUBLISHED' as SmsTriggerType, title: 'Admit cards', detail: 'Parents, when admit cards are ready', icon: FileCheck2 },
  { type: 'RESULT_PUBLISHED' as SmsTriggerType, title: 'Results', detail: 'Parents, when results are published', icon: Trophy },
  { type: 'EMERGENCY_CIRCULAR' as SmsTriggerType, title: 'Emergency or closure', detail: 'Parents of all students, or one class', icon: ShieldAlert },
];

/**
 * Ready-made parent SMS. Each one shows the recipients and the message before
 * anything is sent. SMS go out only from here, from Custom SMS, or when a
 * notice is published with "send SMS" ticked; nothing is sent automatically.
 */
export const SmsCenterTab: React.FC<SmsCenterTabProps> = ({ userRole, onRefreshHistory, onOpenComposer }) => {
  const [activeTrigger, setActiveTrigger] = useState<SmsTriggerType | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const maySend = canSendSms(userRole);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await api.getSmsStats();
      setStats({ todaySent: res.todaySent || 0, todayFailed: res.todayFailed || 0, totalSent: res.totalSent || 0, configured: res.configured, loaded: res.loaded, countsAvailable: (res as any).countsAvailable !== false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const notConfigured = stats?.loaded && stats.configured === false;
  const sendBlocked = !maySend || notConfigured;

  return (
    <div className="space-y-4">
      {notConfigured && (
        <div className="flex gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold">SMS is not set up yet</p>
            <p className="mt-0.5">
              No SMS can be delivered until an SMS provider is added on the server (SMS_PROVIDER=FAST2SMS and SMS_API_KEY). You can still preview who would receive a message.
            </p>
          </div>
        </div>
      )}
      {!maySend && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">Your role can view SMS activity and previews but cannot send SMS.</p>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Sent today', value: stats?.todaySent, cls: 'text-slate-900' },
          { label: 'Failed today', value: stats?.todayFailed, cls: stats?.todayFailed ? 'text-rose-700' : 'text-slate-900' },
          { label: 'Sent in total', value: stats?.totalSent, cls: 'text-slate-900' },
        ].map((c) => (
          <div key={c.label} className="p-3 bg-white border border-slate-200 rounded-xl">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`mt-0.5 text-lg font-semibold tabular-nums ${c.cls}`}>{stats?.loaded === false || stats?.countsAvailable === false ? '—' : c.value ?? '…'}</p>
          </div>
        ))}
      </div>
      {(stats?.loaded === false || stats?.countsAvailable === false) && (
        <p className="text-sm text-slate-600">
          SMS figures could not be loaded.{' '}
          <button onClick={loadStats} className="font-medium text-blue-700 hover:underline">
            Try again
          </button>
        </p>
      )}

      <section className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Ready-made parent SMS</h3>
          <button onClick={loadStats} className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Refresh SMS figures">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {TRIGGERS.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.type} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-500 truncate">{t.detail}</p>
                </div>
                <button
                  onClick={() => setActiveTrigger(t.type)}
                  className="h-9 px-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50 shrink-0"
                >
                  Preview
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-slate-500">
        SMS are sent only when someone sends them here, uses Custom SMS, or ticks “send SMS” while publishing a notice. Nothing is sent automatically.
      </p>

      {activeTrigger && (
        <SmsQuickTriggerModal
          triggerType={activeTrigger}
          canDispatch={!sendBlocked}
          blockedReason={!maySend ? 'Your role cannot send SMS.' : notConfigured ? 'SMS is not set up on the server yet.' : undefined}
          onClose={() => setActiveTrigger(null)}
          onDispatched={() => {
            loadStats();
            onRefreshHistory();
          }}
        />
      )}
    </div>
  );
};
