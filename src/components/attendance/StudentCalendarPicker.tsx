import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Users } from 'lucide-react';
import type { Student } from '../../types';
import { PersonAvatar } from '../common/PersonAvatar';

/**
 * Attendance → Student calendar: pick a student by class / section and a search on name,
 * admission number, registration number or roll number. "All classes" searches every student the
 * user may see (teachers: only their classes, passed in `students`).
 */

export interface PickerClass {
  classId: string;
  className: string;
  sections: string[];
}

interface Props {
  students: Student[];
  classes: PickerClass[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Admission / registration numbers compared without spaces, dashes or slashes. */
const compact = (v: unknown) => String(v ?? '').toLowerCase().replace(/[\s\-/_.]/g, '');

export function matchStudent(s: Student, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const qc = compact(query);
  const name = norm(s.name || [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '));
  if (q.split(' ').every((w) => name.includes(w))) return true;
  const ids = [s.admissionNumber, (s as any).registrationNumber, (s as any).srNumber, s.id].map(compact);
  if (qc && ids.some((x) => x && x.includes(qc))) return true;
  return !!s.rollNumber && String(s.rollNumber).toLowerCase() === q;
}

const LIMIT = 100;

export const StudentCalendarPicker: React.FC<Props> = ({ students, classes, selectedId, onSelect }) => {
  const [classId, setClassId] = useState('ALL');
  const [section, setSection] = useState('ALL');
  const [query, setQuery] = useState('');

  const currentClass = classes.find((c) => c.classId === classId);
  useEffect(() => {
    if (section !== 'ALL' && !currentClass?.sections.includes(section)) setSection('ALL');
  }, [classId, currentClass, section]);

  const results = useMemo(() => {
    const list = students.filter(
      (s) =>
        (classId === 'ALL' || s.classId === classId) &&
        (classId === 'ALL' || section === 'ALL' || String(s.section || '').toUpperCase() === section.toUpperCase()) &&
        matchStudent(s, query)
    );
    return list.sort(
      (a, b) =>
        String(a.className || '').localeCompare(String(b.className || ''), 'en', { numeric: true }) ||
        String(a.section || '').localeCompare(String(b.section || '')) ||
        (Number(a.rollNumber) || 0) - (Number(b.rollNumber) || 0) ||
        String(a.name || '').localeCompare(String(b.name || ''))
    );
  }, [students, classId, section, query]);

  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[180px_140px_1fr] gap-2">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-600 mb-1">Class</span>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
            <option value="ALL">All classes</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-600 mb-1">Section</span>
          <select value={section} onChange={(e) => setSection(e.target.value)} disabled={classId === 'ALL'} className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}>
            <option value="ALL">All sections</option>
            {(currentClass?.sections || []).map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-600 mb-1">Search</span>
          <span className="relative block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, admission no., registration no. or roll no."
              className={`${inputCls} pl-9 pr-9`}
              aria-label="Search student"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
          </span>
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {results.length} student{results.length === 1 ? '' : 's'}
          {classId === 'ALL' ? ' in all classes' : ` in ${currentClass?.className || ''}${section !== 'ALL' ? `-${section}` : ''}`}
        </span>
        {results.length > LIMIT && <span>Showing the first {LIMIT}; search to narrow down</span>}
      </div>

      {results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No student matches. Check the class filter or the spelling.</div>
      ) : (
        <ul className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100" role="listbox" aria-label="Students">
          {results.slice(0, LIMIT).map((s) => {
            const active = s.id === selectedId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(s.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 ${active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <PersonAvatar name={s.name} photo={s.photo} size={34} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm truncate ${active ? 'font-bold text-blue-900' : 'font-semibold text-slate-900'}`}>{s.name}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      Adm {s.admissionNumber || '—'}
                      {(s as any).registrationNumber ? ` · Reg ${(s as any).registrationNumber}` : ''}
                      {s.rollNumber ? ` · Roll ${s.rollNumber}` : ''}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-md px-2 py-0.5 whitespace-nowrap">
                    {s.className || s.classId}-{s.section}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
