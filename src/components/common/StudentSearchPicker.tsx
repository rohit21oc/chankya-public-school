import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { PersonAvatar } from './PersonAvatar';

/** The fields the picker shows and searches. Works with Student records and with lighter row objects. */
export interface PickableStudent {
  id: string;
  name: string;
  photo?: string;
  admissionNumber?: string;
  className?: string;
  section?: string;
  fatherName?: string;
  /** Extra line under the name, e.g. "₹2,400 pending". */
  note?: string;
}

interface Props {
  students: PickableStudent[];
  onSelect: (s: PickableStudent) => void;
  placeholder?: string;
  /** Ids already chosen (shown as selected and not offered again). */
  selectedIds?: Set<string> | string[];
  autoFocus?: boolean;
  /** Keep the typed text after a pick (useful when picking several). Default: clear. */
  keepQuery?: boolean;
  maxResults?: number;
  disabled?: boolean;
}

const norm = (v: unknown) => String(v ?? '').toLowerCase().trim();
/** "Class 1-A", "Nursery-A": adds "Class" only to bare numbers (records store either "1" or "Class 1"). */
export const classLabel = (s: { className?: string; section?: string }) => {
  const c = String(s.className || '').trim();
  if (!c) return '';
  const name = /^(\d+|[ivx]+)$/i.test(c) ? `Class ${c}` : c;
  return `${name}${s.section ? `-${s.section}` : ''}`;
};

/**
 * Type a student's name, admission number, class or father's name; matching students drop down with their
 * round profile photo. Arrow keys + Enter pick, Escape closes.
 */
export const StudentSearchPicker: React.FC<Props> = ({ students, onSelect, placeholder = 'Search student by name, admission no., class or father’s name', selectedIds, autoFocus, keepQuery, maxResults = 30, disabled }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const chosen = useMemo(() => (selectedIds instanceof Set ? selectedIds : new Set(selectedIds || [])), [selectedIds]);

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return students
      .filter((s) => !chosen.has(s.id))
      .filter((s) => {
        const hay = [s.name, s.admissionNumber, classLabel(s), s.className, s.fatherName].map(norm).join(' ');
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => {
        const qa = norm(a.name).startsWith(norm(q)) ? 0 : 1;
        const qb = norm(b.name).startsWith(norm(q)) ? 0 : 1;
        return qa - qb || a.name.localeCompare(b.name);
      })
      .slice(0, maxResults);
  }, [q, students, chosen, maxResults]);

  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (s: PickableStudent) => {
    onSelect(s);
    if (!keepQuery) setQ('');
    setOpen(!!keepQuery);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className={`flex items-center gap-2 rounded-xl border bg-white px-3 ${open && q ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
        <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        <input
          value={q}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setHi((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter' && open && results[hi]) {
              e.preventDefault();
              pick(results[hi]);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className="flex-1 min-w-0 py-2.5 text-sm bg-transparent focus:outline-none"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} className="p-1 rounded-md text-slate-400 hover:text-slate-700" aria-label="Clear search">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && q.trim() && (
        <div id={listId} role="listbox" className="absolute z-40 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">No student matches “{q.trim()}”.</p>
          ) : (
            results.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={i === hi}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(s)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 ${i === hi ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <PersonAvatar name={s.name} photo={s.photo} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 truncate">{s.name}</span>
                  <span className="block text-xs text-slate-500 truncate">
                    {[classLabel(s), s.admissionNumber, s.fatherName && `Father: ${s.fatherName}`].filter(Boolean).join(' · ')}
                  </span>
                  {s.note && <span className="block text-xs font-semibold text-rose-700 truncate">{s.note}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/** Maps a Student record to the picker's shape. */
export const toPickable = (s: any): PickableStudent => ({
  id: s.id,
  name: s.name,
  photo: s.photoFileKey || s.photo || s.studentPhoto || undefined,
  admissionNumber: s.admissionNumber,
  className: s.className,
  section: s.section,
  fatherName: s.fatherName,
});
