import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, RefreshCw, Paperclip } from 'lucide-react';
import { Homework, User } from '../../types';
import { api } from '../../services/api';
import { apiFetch } from '../../services/apiConfig';
import { fileUploadService } from '../../services/fileUploadService';
import { useParentChildren } from '../../hooks/useParentChildren';
import { formatDisplayDate, homeworkForChild, HomeworkDueStatus } from '../../utils/parentPortalRules';
import { classSectionLabel } from '../../utils/classLabel';
import { ParentChildSwitcher, ParentStateBlock } from './ParentChildSwitcher';

interface Props {
  currentUser: User;
}

const STATUS_UI: Record<HomeworkDueStatus, { label: string; cls: string }> = {
  DUE_TODAY: { label: 'Due today', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  UPCOMING: { label: 'Upcoming', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  PAST_DUE: { label: 'Due date passed', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  NO_DUE_DATE: { label: 'No due date', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

type Filter = 'OPEN' | 'ALL';

/**
 * Homework set for the active child's class and section, with due dates.
 * Homework records have no submission or completion field, so the status shown
 * is based on the due date only and never claims the work was completed.
 */
export const ParentHomeworkView: React.FC<Props> = ({ currentUser }) => {
  const { children, activeChild, state: childState, reload, selectChild, switchError } = useParentChildren(currentUser);
  const [list, setList] = useState<Homework[]>(() => api.getHomework());
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState<Filter>('OPEN');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoadState('loading');
    try {
      const res = await apiFetch('/api/homework');
      if (mine !== seq.current) return;
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setList(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
      setLoadState('ready');
    } catch {
      if (mine !== seq.current) return;
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => (activeChild ? homeworkForChild(list, activeChild) : []), [list, activeChild]);
  const shown = filter === 'OPEN' ? items.filter((h) => h.dueStatus !== 'PAST_DUE') : items;
  const openCount = items.filter((h) => h.dueStatus !== 'PAST_DUE').length;
  const busy = childState === 'loading' || loadState === 'loading';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Homework</h1>
              <p className="text-xs text-slate-500">
                {activeChild ? `${activeChild.name} · ${classSectionLabel(activeChild.className, activeChild.section)}` : 'Assignments and due dates'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              reload();
              load();
            }}
            disabled={busy}
            className="min-h-[40px] inline-flex items-center gap-2 px-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <ParentChildSwitcher items={children} activeChildId={activeChild?.id} onSelect={selectChild} switchError={switchError} />
      </div>

      {childState === 'loading' && children.length === 0 ? (
        <ParentStateBlock kind="loading" title="Loading your children" />
      ) : !activeChild ? (
        <ParentStateBlock
          kind="empty"
          title="No linked child found"
          message="No student record is linked to this parent account. Please contact the school office."
          onRetry={reload}
        />
      ) : loadState === 'error' ? (
        <ParentStateBlock kind="error" title="Homework could not be loaded" message="Please check your connection and try again." onRetry={load} />
      ) : loadState === 'loading' && list.length === 0 ? (
        <ParentStateBlock kind="loading" title="Loading homework" />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Filter homework">
              {(['OPEN', 'ALL'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold ${filter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  {f === 'OPEN' ? `Current (${openCount})` : `All (${items.length})`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">Status is based on the due date. Submission is not tracked online.</p>
          </div>

          {shown.length === 0 ? (
            <ParentStateBlock
              kind="empty"
              title={items.length === 0 ? 'No homework assigned' : 'No current homework'}
              message={
                items.length === 0
                  ? `No homework has been posted for ${classSectionLabel(activeChild.className, activeChild.section)} yet.`
                  : 'All posted homework is past its due date. Choose “All” to see it.'
              }
            />
          ) : (
            <ul className="space-y-3">
              {shown.map((h) => {
                const ui = STATUS_UI[h.dueStatus];
                return (
                  <li key={h.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">{h.subjectName || 'Subject not recorded'}</p>
                        <h2 className="text-sm font-bold text-slate-900 mt-0.5 break-words">{h.title || 'Untitled homework'}</h2>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${ui.cls}`}>{ui.label}</span>
                    </div>
                    {h.instructions && <p className="text-xs text-slate-700 mt-2 whitespace-pre-line break-words">{h.instructions}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                      {h.dueDate && (
                        <span>
                          Due: <strong className="text-slate-900">{formatDisplayDate(h.dueDate)}</strong>
                        </span>
                      )}
                      {h.assignedDate && <span>Assigned: {formatDisplayDate(h.assignedDate)}</span>}
                      {h.teacherName && <span>By {h.teacherName}</span>}
                      {h.attachmentName &&
                        (h.attachmentFileKey ? (
                          <a
                            href={fileUploadService.getFileUrl(h.attachmentFileKey)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                          >
                            <Paperclip className="w-3 h-3" />
                            {h.attachmentName}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {h.attachmentName}
                          </span>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
