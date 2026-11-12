import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarHeart, PartyPopper, Sun } from 'lucide-react';
import { api } from '../../services/api';
import { apiFetch } from '../../services/apiConfig';
import { formatDisplayDate, upcomingCalendar, HolidayLike, EventLike } from '../../utils/parentPortalRules';
import { ParentStateBlock } from './ParentChildSwitcher';

/** Upcoming holidays and school events for parents, from the school's own records. */
export const ParentEventsPanel: React.FC = () => {
  const [holidays, setHolidays] = useState<HolidayLike[]>(() => api.getHolidays() as HolidayLike[]);
  const [events, setEvents] = useState<EventLike[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState('loading');
    const [h, e] = await Promise.allSettled([apiFetch('/api/holidays'), apiFetch('/api/public/events')]);
    if (mine !== seq.current) return;
    let ok = false;
    if (h.status === 'fulfilled' && h.value.ok) {
      const data = await h.value.json().catch(() => null);
      if (Array.isArray(data)) {
        setHolidays(data);
        ok = true;
      }
    }
    if (e.status === 'fulfilled' && e.value.ok) {
      const data = await e.value.json().catch(() => null);
      const list = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : Array.isArray(data?.data) ? data.data : null;
      if (list) {
        setEvents(list);
        ok = true;
      }
    }
    setState(ok ? 'ready' : 'error');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => upcomingCalendar(holidays, events), [holidays, events]);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3" aria-labelledby="parent-events-title">
      <div className="flex items-center gap-2">
        <CalendarHeart className="w-4 h-4 text-rose-600" />
        <h2 id="parent-events-title" className="text-sm font-bold text-slate-900">
          Holidays & Upcoming Events
        </h2>
      </div>
      {state === 'loading' && items.length === 0 ? (
        <ParentStateBlock kind="loading" title="Loading school calendar" />
      ) : state === 'error' && items.length === 0 ? (
        <ParentStateBlock kind="error" title="School calendar could not be loaded" message="Please try again." onRetry={load} />
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 py-3">No upcoming holidays or events have been announced.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((it) => (
            <li key={it.id} className="py-2.5 flex items-start gap-3">
              <span
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  it.kind === 'HOLIDAY' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                }`}
                aria-hidden="true"
              >
                {it.kind === 'HOLIDAY' ? <Sun className="w-4 h-4" /> : <PartyPopper className="w-4 h-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 break-words">{it.title}</span>
                <span className="block text-[11px] text-slate-600">
                  {it.kind === 'HOLIDAY' ? 'Holiday' : 'Event'} · {formatDisplayDate(it.date)}
                  {it.endDate && it.endDate !== it.date ? ` – ${formatDisplayDate(it.endDate)}` : ''}
                </span>
                {it.detail && <span className="block text-[11px] text-slate-500 mt-0.5 break-words">{it.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
