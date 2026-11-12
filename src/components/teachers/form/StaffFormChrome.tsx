import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileClock, Loader2 } from 'lucide-react';
import { formatDraftTime } from './useStaffDraft';

/** Shown when a half-filled form from an earlier visit is found. */
export const DraftRestoreBanner: React.FC<{
  draft: { savedAt: number; name: string };
  onRestore: () => void;
  onDiscard: () => void;
}> = ({ draft, onRestore, onDiscard }) => (
  <div role="region" aria-label="Saved draft" className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
    <FileClock className="w-5 h-5 text-amber-700 shrink-0" aria-hidden />
    <div className="flex-1 min-w-0 text-sm text-amber-900">
      <p className="font-semibold">You have an unfinished form{draft.name ? ` for ${draft.name}` : ''}</p>
      <p className="text-amber-800">Last saved {formatDraftTime(draft.savedAt)} on this computer. Continue from where you stopped?</p>
    </div>
    <div className="flex gap-2 shrink-0">
      <button type="button" onClick={onDiscard} className="h-10 px-4 rounded-lg border border-amber-300 bg-white text-amber-900 text-sm font-medium hover:bg-amber-100">
        Start new
      </button>
      <button type="button" onClick={onRestore} className="h-10 px-4 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800">
        Continue draft
      </button>
    </div>
  </div>
);

/** "Draft saved 10:32 pm" line for the bottom bar. */
export const DraftStatus: React.FC<{ savedAt: number | null; failed: boolean }> = ({ savedAt, failed }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);
  if (failed) {
    return <span className="text-sm text-rose-700">Draft could not be saved in this browser.</span>;
  }
  if (!savedAt) {
    return <span className="text-sm text-slate-500">Your progress is saved automatically.</span>;
  }
  return (
    <span className="text-sm text-slate-600 inline-flex items-center gap-1.5">
      <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden />
      Draft saved {new Date(savedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
    </span>
  );
};

export const SavingSpinner: React.FC = () => <Loader2 className="w-4 h-4 animate-spin" aria-hidden />;

/** Sticky row of links to each part of the form. */
export const SectionNav: React.FC<{ sections: { id: string; label: string }[] }> = ({ sections }) => {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Form sections" className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-slate-50/95 backdrop-blur border-b border-slate-200 overflow-x-auto">
      <ol className="flex gap-2 min-w-max">
        {sections.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              aria-current={active === s.id ? 'step' : undefined}
              className={`h-9 px-3 inline-flex items-center gap-2 rounded-full text-sm border transition-colors ${
                active === s.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-xs inline-flex items-center justify-center ${active === s.id ? 'bg-white/20' : 'bg-slate-100'}`}>{i + 1}</span>
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
};
