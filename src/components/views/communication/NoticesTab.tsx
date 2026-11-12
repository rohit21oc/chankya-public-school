import React, { useMemo, useState } from 'react';
import { Bell, ChevronLeft, ChevronRight, CopyX, RefreshCw, Search } from 'lucide-react';
import { Notice, UserRole } from '../../../types';
import { api } from '../../../services/api';
import { NoticeRow } from './NoticeRow';
import { NoticeComposerModal } from './NoticeComposerModal';
import { NoticeDetailsModal } from './NoticeDetailsModal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { NOTICE_CATEGORIES, canCleanupNotices, canManageNotice, canPublishNotices } from '../../../utils/communicationAccess';

interface NoticesTabProps {
  userRole: UserRole;
  notices: Notice[];
  loaded?: boolean;
  onRefresh: () => void;
  onOpenComposer: () => void;
}

type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'EXPIRED';
type Pending =
  | { kind: 'delete'; notice: Notice }
  | { kind: 'unpublish'; notice: Notice }
  | { kind: 'cleanup'; ids: string[]; titles: string[] };

const PAGE_SIZE = 10;

export const NoticesTab: React.FC<NoticesTabProps> = ({ userRole, notices, loaded = true, onRefresh, onOpenComposer }) => {
  const me = api.getCurrentUser();
  const isStaff = userRole !== 'STUDENT' && userRole !== 'PARENT';
  const mayPublish = canPublishNotices(userRole);

  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [audience, setAudience] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [checkingDupes, setCheckingDupes] = useState(false);

  const flash = (tone: 'ok' | 'error', text: string) => {
    setToast({ tone, text });
    window.setTimeout(() => setToast(null), 4500);
  };

  const counts = useMemo(() => {
    const c = { ALL: notices.length, PUBLISHED: 0, DRAFT: 0, EXPIRED: 0 } as Record<StatusFilter, number>;
    for (const n of notices) {
      const st = (n.status || 'PUBLISHED') as StatusFilter;
      if (st in c) c[st]++;
    }
    return c;
  }, [notices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notices.filter((n) => {
      if (status !== 'ALL' && (n.status || 'PUBLISHED') !== status) return false;
      if (category !== 'ALL' && String(n.noticeType || n.category || 'GENERAL').toUpperCase() !== category) return false;
      if (audience !== 'ALL' && String(n.targetAudience || 'ALL').toUpperCase() !== (audience === 'EVERYONE' ? 'ALL' : audience)) return false;
      if (q && !`${n.title} ${n.content} ${n.publishedBy || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notices, status, category, audience, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filtersOn = status !== 'ALL' || category !== 'ALL' || audience !== 'ALL' || search.trim() !== '';

  const publish = async (n: Notice) => {
    try {
      await api.updateNotice(n.id, { status: 'PUBLISHED' });
      flash('ok', `"${n.title}" is published.`);
      onRefresh();
    } catch (err: any) {
      flash('error', err?.message || 'The notice could not be published.');
    }
  };

  const runPending = async () => {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending.kind === 'delete') {
        await api.deleteNotice(pending.notice.id);
        flash('ok', `"${pending.notice.title}" was deleted.`);
      } else if (pending.kind === 'unpublish') {
        await api.updateNotice(pending.notice.id, { status: 'DRAFT' });
        flash('ok', `"${pending.notice.title}" is now a draft and hidden from students and parents.`);
      } else {
        const res = await api.cleanupDuplicateNotices(false);
        flash('ok', res.message || 'Duplicates removed.');
      }
      setPending(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const checkDuplicates = async () => {
    setCheckingDupes(true);
    try {
      const res = await api.cleanupDuplicateNotices(true);
      const list = res.duplicates || [];
      if (list.length === 0) flash('ok', 'No duplicate notices found.');
      else setPending({ kind: 'cleanup', ids: list.map((d) => d.id), titles: list.map((d) => d.title) });
    } catch (err: any) {
      flash('error', err?.message || 'Duplicates could not be checked.');
    } finally {
      setCheckingDupes(false);
    }
  };

  const chips: { id: StatusFilter; label: string; show: boolean }[] = [
    { id: 'ALL', label: 'All', show: true },
    { id: 'PUBLISHED', label: 'Published', show: true },
    { id: 'DRAFT', label: 'Drafts', show: isStaff },
    { id: 'EXPIRED', label: 'Expired', show: isStaff },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filter by status">
          {chips
            .filter((c) => c.show)
            .map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setStatus(c.id);
                  setPage(1);
                }}
                aria-pressed={status === c.id}
                className={`h-9 px-3 rounded-full text-sm font-medium whitespace-nowrap border ${
                  status === c.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {c.label} <span className="tabular-nums opacity-70">{counts[c.id]}</span>
              </button>
            ))}
        </div>
        <div className="flex flex-1 flex-wrap gap-2 lg:justify-end">
          <label className="relative flex-1 min-w-[180px] lg:max-w-xs">
            <span className="sr-only">Search notices</span>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search notices"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </label>
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-xl border border-slate-300 bg-white text-sm"
          >
            <option value="ALL">All categories</option>
            {NOTICE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {isStaff && (
            <select
              aria-label="Audience"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-xl border border-slate-300 bg-white text-sm"
            >
              <option value="ALL">Any audience</option>
              <option value="EVERYONE">Everyone</option>
              <option value="STUDENTS">Students</option>
              <option value="PARENTS">Parents</option>
              <option value="STAFF">Staff</option>
              <option value="CLASS">One class</option>
              <option value="INDIVIDUAL">Selected students</option>
            </select>
          )}
          {canCleanupNotices(userRole) && (
            <button
              onClick={checkDuplicates}
              disabled={checkingDupes}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Find notices with the same title, text, date and audience"
            >
              <CopyX className="w-4 h-4" aria-hidden="true" />
              {checkingDupes ? 'Checking…' : 'Find duplicates'}
            </button>
          )}
          <button onClick={onRefresh} className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Refresh notices">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {toast && (
          <p
            className={`text-sm rounded-xl px-3 py-2 border ${
              toast.tone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {toast.text}
          </p>
        )}
      </div>

      {!loaded && notices.length === 0 ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : pageItems.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl">
          <Bell className="w-8 h-8 mx-auto text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-700">{filtersOn ? 'No notices match these filters.' : 'No notices yet.'}</p>
          {filtersOn ? (
            <button
              onClick={() => {
                setStatus('ALL');
                setCategory('ALL');
                setAudience('ALL');
                setSearch('');
              }}
              className="mt-2 text-sm font-medium text-blue-700 hover:underline"
            >
              Clear filters
            </button>
          ) : mayPublish ? (
            <button onClick={onOpenComposer} className="mt-2 text-sm font-medium text-blue-700 hover:underline">
              Write the first notice
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {pageItems.map((n) => {
            const manage = canManageNotice(userRole, me?.id, n);
            return (
              <NoticeRow
                key={n.id}
                notice={n}
                canManage={manage}
                onView={setSelectedNotice}
                onEdit={setEditingNotice}
                onDelete={(x) => {
                  setActionError(null);
                  setPending({ kind: 'delete', notice: x });
                }}
                onPublish={publish}
                onUnpublish={(x) => {
                  setActionError(null);
                  setPending({ kind: 'unpublish', notice: x });
                }}
              />
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span className="tabular-nums">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-300 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-300 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selectedNotice && (
        <NoticeDetailsModal
          notice={selectedNotice}
          canEdit={canManageNotice(userRole, me?.id, selectedNotice)}
          onEdit={(n) => {
            setSelectedNotice(null);
            setEditingNotice(n);
          }}
          onClose={() => setSelectedNotice(null)}
        />
      )}
      {editingNotice && (
        <NoticeComposerModal
          initialNotice={editingNotice}
          onClose={() => setEditingNotice(null)}
          onSaved={() => {
            setEditingNotice(null);
            flash('ok', 'Notice saved.');
            onRefresh();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        tone={pending?.kind === 'unpublish' ? 'primary' : 'danger'}
        busy={busy}
        error={actionError}
        title={
          pending?.kind === 'delete'
            ? 'Delete this notice?'
            : pending?.kind === 'unpublish'
            ? 'Move this notice to drafts?'
            : `Remove ${pending?.kind === 'cleanup' ? pending.ids.length : 0} duplicate notice${pending?.kind === 'cleanup' && pending.ids.length === 1 ? '' : 's'}?`
        }
        message={
          pending?.kind === 'delete' ? (
            <>
              “{pending.notice.title}” will be removed for everyone. This cannot be undone.
            </>
          ) : pending?.kind === 'unpublish' ? (
            <>Students and parents will no longer see “{pending.notice.title}”. You can publish it again later.</>
          ) : pending?.kind === 'cleanup' ? (
            <>
              These are exact copies (same title, text, date and audience). The first copy of each is kept.
              <ul className="mt-2 list-disc pl-5 max-h-40 overflow-y-auto">
                {pending.titles.slice(0, 10).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
                {pending.titles.length > 10 && <li>and {pending.titles.length - 10} more</li>}
              </ul>
            </>
          ) : null
        }
        confirmLabel={pending?.kind === 'delete' ? 'Delete' : pending?.kind === 'unpublish' ? 'Move to drafts' : 'Remove duplicates'}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
};
