import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { activeSectionNames } from '../../utils/teacherSubjects';

interface PickerClass {
  id: string;
  name: string;
  sections?: unknown[];
  detailedSections?: Array<{ name: string; status?: string }>;
}

interface QualifiedClassesPickerProps {
  /** Active classes from the Academic Structure. */
  classes: PickerClass[];
  /** Selected class names. */
  value: string[];
  onToggle: (className: string) => void;
  /** Sections chosen per selected class, keyed by lower-case class name. */
  sectionsByClass: Record<string, string[]>;
  onSectionsChange: (className: string, sections: string[]) => void;
}

/** One selected class: a dropdown with a checkbox for every active section of that class (read live from Academics). */
const SectionDropdown: React.FC<{ className: string; options: string[]; value: string[]; onChange: (s: string[]) => void }> = ({ className, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const chosen = options.filter((o) => value.includes(o));
  const allOn = options.length > 0 && chosen.length === options.length;
  const toggle = (s: string) => onChange(value.includes(s) ? value.filter((x) => x !== s) : options.filter((o) => o === s || value.includes(o)));
  const missing = chosen.length === 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sections taught in ${className}`}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left text-xs bg-white transition-colors ${
          missing ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <span className="min-w-0 truncate">
          <span className="font-bold text-slate-900">{className}</span>
          <span className={`ml-2 ${missing ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
            {options.length === 0 ? 'No active section' : missing ? 'Select sections' : allOn ? `All sections (${chosen.join(', ')})` : `Section ${chosen.join(', ')}`}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true" className="absolute z-30 mt-1 w-full min-w-[12rem] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-1.5">
          {options.length === 0 ? (
            <div className="px-2 py-2 text-xs text-amber-700">This class has no active section. Add sections in Academics.</div>
          ) : (
            <>
              <label className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-800 border-b border-slate-100 mb-1">
                <input type="checkbox" className="w-4 h-4 accent-purple-700" checked={allOn} onChange={() => onChange(allOn ? [] : [...options])} />
                All sections
              </label>
              {options.map((s) => (
                <label key={s} role="option" aria-selected={value.includes(s)} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs text-slate-800">
                  <input type="checkbox" className="w-4 h-4 accent-purple-700" checked={value.includes(s)} onChange={() => toggle(s)} />
                  Section {s}
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * "Classes Qualified to Teach": pick the classes, then for each class the sections this teacher teaches there.
 * Sections come live from the Academic Structure, so a class with six sections shows six. The teacher gets
 * access (dashboard, students, marks for their subjects) only to the chosen class + section pairs.
 * A class already saved on the teacher that is no longer active stays visible (marked inactive) so it can be removed.
 */
export const QualifiedClassesPicker: React.FC<QualifiedClassesPickerProps> = ({ classes, value, onToggle, sectionsByClass, onSectionsChange }) => {
  const activeNames = new Set(classes.map((c) => c.name.toLowerCase()));
  const staleSelected = value.filter((v) => !activeNames.has(v.toLowerCase()));
  const selectedClasses = classes.filter((c) => value.some((v) => v.toLowerCase() === c.name.toLowerCase()));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-bold text-slate-700">
          Classes Qualified to Teach{' '}
          <span className="text-[11px] text-slate-400 font-normal">(Select every class this teacher can teach, then the sections)</span>
        </label>
        <span className="text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 shrink-0">
          {value.length} Selected
        </span>
      </div>
      <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[48px]" role="group" aria-label="Classes qualified to teach">
        {classes.length === 0 && staleSelected.length === 0 ? (
          <span className="text-xs text-amber-700">No active classes found. Create classes in Academics first.</span>
        ) : (
          <>
            {classes.map((cls) => {
              const selected = value.some((v) => v.toLowerCase() === cls.name.toLowerCase());
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => onToggle(cls.name)}
                  aria-pressed={selected}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                    selected
                      ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {selected && <Check className="w-3.5 h-3.5" />}
                  {cls.name}
                </button>
              );
            })}
            {staleSelected.map((name) => (
              <button
                key={`stale-${name}`}
                type="button"
                onClick={() => onToggle(name)}
                aria-pressed
                title="This class is no longer active. Click to remove it."
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-900 flex items-center gap-1.5"
              >
                {name} (inactive)
              </button>
            ))}
          </>
        )}
      </div>

      {selectedClasses.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-600">Sections taught in each class</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {selectedClasses.map((cls) => (
              <SectionDropdown
                key={cls.id}
                className={cls.name}
                options={activeSectionNames(cls)}
                value={sectionsByClass[cls.name.toLowerCase()] || []}
                onChange={(s) => onSectionsChange(cls.name, s)}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            The teacher sees only these class sections in the app and on the dashboard, and can enter marks only for their own subjects there.
          </p>
        </div>
      )}
    </div>
  );
};

/** Every selected class must have at least one section. Returns an error message or null. */
export function qualifiedSectionsError(
  classes: PickerClass[],
  selected: string[],
  sectionsByClass: Record<string, string[]>
): string | null {
  for (const name of selected) {
    const cls = classes.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!cls) continue; // an inactive class: nothing to choose
    if (activeSectionNames(cls).length === 0) continue;
    if (!(sectionsByClass[name.toLowerCase()] || []).length) return `Select at least one section for ${cls.name} under "Classes Qualified to Teach".`;
  }
  return null;
}

/** The payload field saved on the staff record. */
export function qualifiedSectionsPayload(selected: string[], sectionsByClass: Record<string, string[]>) {
  return selected.map((className) => ({ className, sections: sectionsByClass[className.toLowerCase()] || [] }));
}
