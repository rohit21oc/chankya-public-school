import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Paperclip, Plus, RefreshCw, Pencil, Trash2, X, Loader2, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Homework, User } from '../../types';
import { api, HomeworkClassOption } from '../../services/api';
import { apiFetch } from '../../services/apiConfig';
import { fileUploadService, UploadResult } from '../../services/fileUploadService';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { formatDisplayDate, homeworkDueStatus, HomeworkDueStatus } from '../../utils/parentPortalRules';
import { kolkataDate } from '../../utils/parentFeeSummary';

interface Props {
  currentUser: User;
}

const WRITE_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ADMIN', 'TEACHER'];

const STATUS_UI: Record<HomeworkDueStatus, { label: string; cls: string }> = {
  DUE_TODAY: { label: 'Due today', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  UPCOMING: { label: 'Upcoming', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  PAST_DUE: { label: 'Due date passed', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  NO_DUE_DATE: { label: 'No due date', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

interface FormState {
  classId: string;
  section: string;
  subjectId: string;
  title: string;
  instructions: string;
  assignedDate: string;
  dueDate: string;
  attachmentFileKey: string;
  attachmentName: string;
  attachmentSize?: number;
}

const emptyForm = (today: string): FormState => ({
  classId: '',
  section: '',
  subjectId: '',
  title: '',
  instructions: '',
  assignedDate: today,
  dueDate: '',
  attachmentFileKey: '',
  attachmentName: '',
});

export const HomeworkView: React.FC<Props> = ({ currentUser }) => {
  const canWrite = WRITE_ROLES.includes(currentUser.role);
  const today = kolkataDate(new Date());

  const [list, setList] = useState<Homework[]>(() => api.getHomework());
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const seq = useRef(0);

  // Filters
  const [fClass, setFClass] = useState('');
  const [fSection, setFSection] = useState('');
  const [fSubject, setFSubject] = useState('');
  const [fWhen, setFWhen] = useState<'CURRENT' | 'ALL'>('CURRENT');
  const [search, setSearch] = useState('');

  // Options for the form (class -> section -> subject), server-scoped to what the user may assign
  const [options, setOptions] = useState<HomeworkClassOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Form / delete state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Homework | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(today));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [deleting, setDeleting] = useState<Homework | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoadState('loading');
    try {
      const res = await apiFetch('/api/homework');
      if (mine !== seq.current) return;
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const rows: Homework[] = Array.isArray(data) ? data : [];
      setList(rows);
      setLoadState('ready');
    } catch {
      if (mine !== seq.current) return;
      setLoadState('error');
    }
  }, []);

  const loadOptions = useCallback(async () => {
    if (!canWrite) return;
    const res = await api.fetchHomeworkOptions();
    setOptions(res.classes);
    setOptionsError(res.ok ? null : res.error || 'Could not load your classes.');
  }, [canWrite]);

  useEffect(() => {
    load();
    loadOptions();
  }, [load, loadOptions]);

  useRealtimeListener(['HOMEWORK', 'CLASS', 'SUBJECT'], () => {
    load();
    loadOptions();
  });

  // ---- Derived data ----
  const classFilterOptions = useMemo(() => {
    const m = new Map<string, string>();
    list.forEach((h) => m.set(h.classId, h.className));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [list]);
  const sectionFilterOptions = useMemo(
    () => Array.from(new Set(list.filter((h) => !fClass || h.classId === fClass).map((h) => h.section))).sort(),
    [list, fClass]
  );
  const subjectFilterOptions = useMemo(() => {
    const m = new Map<string, string>();
    list
      .filter((h) => (!fClass || h.classId === fClass) && (!fSection || h.section === fSection))
      .forEach((h) => m.set(h.subjectId || h.subjectName, h.subjectName));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [list, fClass, fSection]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list
      .map((h) => ({ ...h, dueStatus: homeworkDueStatus(h.dueDate, today) }))
      .filter((h) => (!fClass || h.classId === fClass) && (!fSection || h.section === fSection))
      .filter((h) => !fSubject || (h.subjectId || h.subjectName) === fSubject)
      .filter((h) => fWhen === 'ALL' || h.dueStatus !== 'PAST_DUE')
      .filter((h) => !q || `${h.title} ${h.subjectName} ${h.instructions}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const rank: Record<HomeworkDueStatus, number> = { DUE_TODAY: 0, UPCOMING: 1, NO_DUE_DATE: 2, PAST_DUE: 3 };
        const r = rank[a.dueStatus] - rank[b.dueStatus];
        if (r !== 0) return r;
        return a.dueStatus === 'PAST_DUE' ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate);
      });
  }, [list, fClass, fSection, fSubject, fWhen, search, today]);

  const openCount = useMemo(() => list.filter((h) => homeworkDueStatus(h.dueDate, today) !== 'PAST_DUE').length, [list, today]);

  const formSections = useMemo(() => options.find((c) => c.classId === form.classId)?.sections || [], [options, form.classId]);
  const formSubjects = useMemo(() => formSections.find((s) => s.name === form.section)?.subjects || [], [formSections, form.section]);

  // ---- Actions ----
  const openCreate = () => {
    setEditing(null);
    const first = options.length === 1 ? options[0] : undefined;
    const sec = first && first.sections.length === 1 ? first.sections[0] : undefined;
    setForm({
      ...emptyForm(today),
      classId: first?.classId || '',
      section: sec?.name || '',
      subjectId: sec && sec.subjects.length === 1 ? sec.subjects[0].id : '',
    });
    setFormError(null);
    setUploaderKey((k) => k + 1);
    setFormOpen(true);
  };

  const openEdit = (h: Homework) => {
    setEditing(h);
    setForm({
      classId: h.classId,
      section: h.section,
      subjectId: h.subjectId || '',
      title: h.title,
      instructions: h.instructions || '',
      assignedDate: h.assignedDate,
      dueDate: h.dueDate,
      attachmentFileKey: h.attachmentFileKey || '',
      attachmentName: h.attachmentName || '',
      attachmentSize: h.attachmentSize,
    });
    setFormError(null);
    setUploaderKey((k) => k + 1);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const title = form.title.trim();
    const instructions = form.instructions.trim();
    if (!form.classId) return setFormError('Select a class.');
    if (!form.section) return setFormError('Select a section.');
    if (!form.subjectId) return setFormError('Select a subject.');
    if (title.length < 3) return setFormError('Enter a title of at least 3 characters.');
    if (!instructions) return setFormError('Enter the instructions for students.');
    if (!form.dueDate) return setFormError('Select a due date.');
    if (form.dueDate < form.assignedDate) return setFormError('Due date cannot be before the assigned date.');
    setFormError(null);
    setSaving(true);
    const res = await api.saveHomeworkAsync(
      {
        classId: form.classId,
        section: form.section,
        subjectId: form.subjectId,
        title,
        instructions,
        assignedDate: form.assignedDate,
        dueDate: form.dueDate,
        attachmentFileKey: form.attachmentFileKey,
        attachmentName: form.attachmentName,
        attachmentSize: form.attachmentSize,
      },
      editing?.id
    );
    setSaving(false);
    if (!res.success) {
      setFormError(res.error || 'Could not save homework.');
      return;
    }
    setFormOpen(false);
    setEditing(null);
    setNotice({ type: 'success', text: editing ? 'Homework updated.' : 'Homework assigned.' });
    load();
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    const res = await api.deleteHomeworkAsync(deleting.id);
    setDeleteBusy(false);
    if (res.success) {
      setNotice({ type: 'success', text: 'Homework deleted.' });
      setDeleting(null);
      load();
    } else {
      setNotice({ type: 'error', text: res.error || 'Could not delete homework.' });
      setDeleting(null);
    }
  };

  const onAttachment = (r: UploadResult) => {
    setForm((f) => ({ ...f, attachmentFileKey: r.fileKey, attachmentName: r.originalFileName, attachmentSize: r.fileSize }));
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const busy = loadState === 'loading';
  const inputCls =
    'w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500';
  const labelCls = 'block text-xs font-bold text-slate-700 mb-1';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Homework</h1>
            <p className="text-xs text-slate-500">
              {canWrite
                ? currentUser.role === 'TEACHER'
                  ? 'Assign and manage homework for your classes, sections and subjects.'
                  : 'Homework assigned across all classes.'
                : 'Homework assigned to your class and section.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              load();
              loadOptions();
            }}
            disabled={busy}
            className="min-h-[40px] inline-flex items-center gap-2 px-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={openCreate}
              disabled={options.length === 0}
              title={options.length === 0 ? optionsError || 'No classes are assigned to you yet.' : 'Assign new homework'}
              className="min-h-[40px] inline-flex items-center gap-2 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Assign Homework
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-semibold ${
            notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {notice.text}
        </div>
      )}
      {canWrite && optionsError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-900 text-xs font-semibold">
          <AlertCircle className="w-4 h-4" />
          {optionsError}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-wrap items-end gap-3">
        {canWrite && (
          <>
            <div className="min-w-[140px]">
              <label className={labelCls} htmlFor="hw-f-class">Class</label>
              <select
                id="hw-f-class"
                value={fClass}
                onChange={(e) => {
                  setFClass(e.target.value);
                  setFSection('');
                  setFSubject('');
                }}
                className={inputCls}
              >
                <option value="">All classes</option>
                {classFilterOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[110px]">
              <label className={labelCls} htmlFor="hw-f-section">Section</label>
              <select
                id="hw-f-section"
                value={fSection}
                onChange={(e) => {
                  setFSection(e.target.value);
                  setFSubject('');
                }}
                className={inputCls}
              >
                <option value="">All</option>
                {sectionFilterOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="min-w-[150px]">
          <label className={labelCls} htmlFor="hw-f-subject">Subject</label>
          <select id="hw-f-subject" value={fSubject} onChange={(e) => setFSubject(e.target.value)} className={inputCls}>
            <option value="">All subjects</option>
            {subjectFilterOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className={labelCls} htmlFor="hw-search">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="hw-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title or instructions"
              className={`${inputCls} pl-9`}
            />
          </div>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Filter homework by due date">
          {(['CURRENT', 'ALL'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFWhen(f)}
              aria-pressed={fWhen === f}
              className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold ${fWhen === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              {f === 'CURRENT' ? `Current (${openCount})` : `All (${list.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loadState === 'error' ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center">
          <p className="text-sm font-bold text-slate-900">Homework could not be loaded</p>
          <p className="text-xs text-slate-500 mt-1">Please check your connection and try again.</p>
          <button type="button" onClick={load} className="mt-3 min-h-[40px] px-4 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50">
            Try again
          </button>
        </div>
      ) : loadState === 'loading' && list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading homework
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-sm font-bold text-slate-900">{list.length === 0 ? 'No homework assigned yet' : 'No homework matches these filters'}</p>
          <p className="text-xs text-slate-500 mt-1">
            {list.length === 0
              ? canWrite
                ? 'Use “Assign Homework” to post the first task.'
                : 'Homework posted for your class will appear here.'
              : fWhen === 'CURRENT'
              ? 'Past-due homework is hidden. Choose “All” to see it.'
              : 'Clear a filter to see more.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {rows.map((h) => {
            const ui = STATUS_UI[h.dueStatus];
            return (
              <li key={h.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                      {h.subjectName} · {h.className} {h.section}
                    </p>
                    <h2 className="text-sm font-bold text-slate-900 mt-0.5 break-words">{h.title}</h2>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${ui.cls}`}>{ui.label}</span>
                </div>
                {h.instructions && <p className="text-xs text-slate-700 mt-2 whitespace-pre-line break-words">{h.instructions}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                  <span>
                    Due: <strong className="text-slate-900">{formatDisplayDate(h.dueDate)}</strong>
                  </span>
                  <span>Assigned: {formatDisplayDate(h.assignedDate)}</span>
                  {h.teacherName && <span>By {h.teacherName}</span>}
                </div>
                {h.attachmentName && (
                  <div className="mt-2">
                    {h.attachmentFileKey ? (
                      <a
                        href={fileUploadService.getFileUrl(h.attachmentFileKey)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline break-all"
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" />
                        {h.attachmentName}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <Paperclip className="w-3.5 h-3.5" />
                        {h.attachmentName}
                      </span>
                    )}
                  </div>
                )}
                {canWrite && h.canManage && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => openEdit(h)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(h)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Create / edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="hw-form-title">
          <form onSubmit={submit} className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h2 id="hw-form-title" className="text-base font-bold text-slate-900">
                {editing ? 'Edit Homework' : 'Assign Homework'}
              </h2>
              <button type="button" onClick={closeForm} aria-label="Close" className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {formError && (
                <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls} htmlFor="hw-class">Class *</label>
                  <select
                    id="hw-class"
                    value={form.classId}
                    onChange={(e) => setForm({ ...form, classId: e.target.value, section: '', subjectId: '' })}
                    className={inputCls}
                  >
                    <option value="">Select class</option>
                    {options.map((c) => (
                      <option key={c.classId} value={c.classId}>{c.className}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="hw-section">Section *</label>
                  <select
                    id="hw-section"
                    value={form.section}
                    disabled={!form.classId}
                    onChange={(e) => setForm({ ...form, section: e.target.value, subjectId: '' })}
                    className={inputCls}
                  >
                    <option value="">Select section</option>
                    {formSections.map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="hw-subject">Subject *</label>
                  <select
                    id="hw-subject"
                    value={form.subjectId}
                    disabled={!form.section}
                    onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Select subject</option>
                    {formSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="hw-title">Title *</label>
                <input
                  id="hw-title"
                  value={form.title}
                  maxLength={150}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Chapter 4 exercise questions"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="hw-instructions">Instructions *</label>
                <textarea
                  id="hw-instructions"
                  value={form.instructions}
                  maxLength={5000}
                  rows={5}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="What should students do?"
                  className={`${inputCls} resize-y`}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="hw-assigned">Assigned date *</label>
                  <input
                    id="hw-assigned"
                    type="date"
                    value={form.assignedDate}
                    onChange={(e) => setForm({ ...form, assignedDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="hw-due">Due date *</label>
                  <input
                    id="hw-due"
                    type="date"
                    min={form.assignedDate}
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <span className={labelCls}>Attachment (optional)</span>
                {form.attachmentFileKey ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                    <a
                      href={fileUploadService.getFileUrl(form.attachmentFileKey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:underline break-all"
                    >
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      {form.attachmentName || form.attachmentFileKey.split('/').pop()}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...form, attachmentFileKey: '', attachmentName: '', attachmentSize: undefined });
                        setUploaderKey((k) => k + 1);
                      }}
                      className="shrink-0 font-semibold text-rose-700 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <FileUploadComponent
                    key={uploaderKey}
                    uploadType="homework"
                    acceptedFileTypes=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
                    maxSizeMB={15}
                    onUploadComplete={onAttachment}
                  />
                )}
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button type="button" onClick={closeForm} disabled={saving} className="min-h-[40px] px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[40px] inline-flex items-center gap-2 px-5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold disabled:opacity-60"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing ? 'Save Changes' : 'Assign Homework'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="hw-del-title">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h2 id="hw-del-title" className="text-base font-bold text-slate-900">Delete this homework?</h2>
            <p className="text-xs text-slate-600 mt-2 break-words">
              “{deleting.title}” for {deleting.className} {deleting.section} will be removed for all students. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} disabled={deleteBusy} className="min-h-[40px] px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} disabled={deleteBusy} className="min-h-[40px] inline-flex items-center gap-2 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold disabled:opacity-60">
                {deleteBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
