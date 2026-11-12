import React from 'react';
import { Users, CheckCircle2 } from 'lucide-react';
import { Student } from '../../types';
import { classSectionLabel } from '../../utils/classLabel';

interface Props {
  items: Student[];
  activeChildId?: string;
  onSelect: (id: string) => void;
  switchError?: string;
}

/** Sibling cards used by the parent Timetable, Homework and Events screens. */
export const ParentChildSwitcher: React.FC<Props> = ({ items, activeChildId, onSelect, switchError }) => {
  if (items.length <= 1) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
        <Users className="w-4 h-4 text-blue-600" />
        <span>Select child ({items.length} linked)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {items.map((c) => {
          const active = c.id === activeChildId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-pressed={active}
              className={`min-h-[56px] text-left p-3 rounded-xl border transition-colors flex items-center gap-3 ${
                active ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-blue-300'
              }`}
            >
              <span className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                {(c.name || '?').slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900 truncate">{c.name}</span>
                <span className="block text-[11px] text-slate-600 truncate">
                  {classSectionLabel(c.className, c.section)}
                  {c.rollNumber ? ` • Roll ${c.rollNumber}` : ''}
                </span>
              </span>
              {active && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {switchError && (
        <p className="text-xs text-rose-700" role="alert">
          {switchError}
        </p>
      )}
    </div>
  );
};

/** Loading / empty / error block shared by the parent screens. */
export const ParentStateBlock: React.FC<{
  kind: 'loading' | 'empty' | 'error';
  title: string;
  message?: string;
  onRetry?: () => void;
}> = ({ kind, title, message, onRetry }) => (
  <div
    className={`rounded-2xl border p-8 text-center ${
      kind === 'error' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
    }`}
    role={kind === 'error' ? 'alert' : undefined}
    aria-busy={kind === 'loading' || undefined}
  >
    {kind === 'loading' && (
      <div className="w-7 h-7 mx-auto mb-3 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" aria-hidden="true" />
    )}
    <h3 className={`text-sm font-bold ${kind === 'error' ? 'text-rose-900' : 'text-slate-800'}`}>{title}</h3>
    {message && <p className={`text-xs mt-1 ${kind === 'error' ? 'text-rose-800' : 'text-slate-500'}`}>{message}</p>}
    {onRetry && kind !== 'loading' && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-[40px] px-4 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
      >
        Try again
      </button>
    )}
  </div>
);
