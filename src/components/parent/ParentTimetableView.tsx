import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, RefreshCw, Clock } from 'lucide-react';
import { SchoolSettings, TimetableSlot, User } from '../../types';
import { api } from '../../services/api';
import { apiFetch } from '../../services/apiConfig';
import { useParentChildren } from '../../hooks/useParentChildren';
import { buildChildTimetable, normalizeDay, WEEK_DAYS } from '../../utils/parentPortalRules';
import { kolkataDate } from '../../utils/parentFeeSummary';
import { classSectionLabel } from '../../utils/classLabel';
import { ParentChildSwitcher, ParentStateBlock } from './ParentChildSwitcher';

/** "204" → "Room 204"; "Room 204" stays as recorded. */
const roomLabel = (r?: string) => {
  const v = String(r || '').trim();
  if (!v) return '';
  return /^room\b/i.test(v) ? v : `Room ${v}`;
};

interface Props {
  currentUser: User;
  settings?: SchoolSettings;
}

/**
 * Read-only weekly timetable for the active child's class and section.
 * Parents previously received the admin timetable editor (save, schedule slot,
 * other classes). The server already rejects parent writes; this removes the
 * editor from their view entirely.
 */
export const ParentTimetableView: React.FC<Props> = ({ currentUser, settings }) => {
  const { children, activeChild, state: childState, reload, selectChild, switchError } = useParentChildren(currentUser);
  const session = api.getActiveAcademicSession()?.name || settings?.currentAcademicSession || '';
  const [slots, setSlots] = useState<TimetableSlot[]>(() => api.getTimetable());
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoadState('loading');
    try {
      const res = await apiFetch('/api/timetables');
      if (mine !== seq.current) return;
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const list: TimetableSlot[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setSlots(list);
      setLoadState('ready');
    } catch {
      if (mine !== seq.current) return;
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const week = useMemo(
    () => (activeChild ? buildChildTimetable(slots, activeChild, session) : null),
    [slots, activeChild, session]
  );

  const todayName = useMemo(() => {
    const d = new Date(`${kolkataDate()}T00:00:00Z`).getUTCDay(); // 0 Sunday
    return d >= 1 && d <= 6 ? WEEK_DAYS[d - 1] : null;
  }, []);

  const busy = childState === 'loading' || loadState === 'loading';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Class Timetable</h1>
              <p className="text-xs text-slate-500">
                {activeChild ? `${activeChild.name} · ${classSectionLabel(activeChild.className, activeChild.section)}` : 'Weekly periods'}
                {session ? ` · Session ${session}` : ''}
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
        <ParentChildSwitcher
          items={children}
          activeChildId={activeChild?.id}
          onSelect={selectChild}
          switchError={switchError}
        />
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
        <ParentStateBlock
          kind="error"
          title="Timetable could not be loaded"
          message="Please check your connection and try again."
          onRetry={load}
        />
      ) : loadState === 'loading' && slots.length === 0 ? (
        <ParentStateBlock kind="loading" title="Loading timetable" />
      ) : !week || week.slotCount === 0 ? (
        <ParentStateBlock
          kind="empty"
          title="No timetable published yet"
          message={`The school has not published periods for ${classSectionLabel(activeChild.className, activeChild.section)}${session ? ` in ${session}` : ''}.`}
        />
      ) : (
        <>
          {/* Phone: one card per day */}
          <div className="space-y-3 md:hidden">
            {week.days.map(({ day, slots: daySlots }) => (
              <section
                key={day}
                className={`bg-white rounded-2xl border shadow-xs ${day === todayName ? 'border-blue-400' : 'border-slate-200'}`}
              >
                <h2 className="px-4 py-2.5 border-b border-slate-100 text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span>{day}</span>
                  {day === todayName && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Today</span>}
                </h2>
                {daySlots.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-500">No periods</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {daySlots.map((s, i) => (
                      <li key={s.id || `${day}-${i}`} className="px-4 py-2.5 flex items-start gap-3">
                        <span className="text-[11px] font-bold text-slate-500 w-14 shrink-0 pt-0.5">
                          P{s.periodNumber ?? s.period}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">{s.subjectName || 'Subject not recorded'}</span>
                          <span className="block text-[11px] text-slate-600">
                            {[s.teacherName, roomLabel(s.roomNumber)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {(s.startTime || s.endTime) && (
                          <span className="text-[11px] text-slate-500 shrink-0 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {s.startTime}
                            {s.endTime ? `–${s.endTime}` : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Tablet / desktop: grid, scrolls inside its own container if wide */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th scope="col" className="text-left px-3 py-2.5 font-bold w-28">Day</th>
                  {week.periods.map((p) => (
                    <th key={p.number} scope="col" className="px-3 py-2.5 font-bold text-center">
                      Period {p.number}
                      {(p.startTime || p.endTime) && (
                        <span className="block text-[10px] font-medium text-slate-300">
                          {p.startTime}
                          {p.endTime ? ` – ${p.endTime}` : ''}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {week.days.map(({ day, slots: daySlots }) => (
                  <tr key={day} className={`border-t border-slate-100 ${day === todayName ? 'bg-blue-50/40' : ''}`}>
                    <th scope="row" className="text-left px-3 py-3 font-bold text-slate-800">
                      {day}
                      {day === todayName && <span className="block text-[10px] font-semibold text-blue-700">Today</span>}
                    </th>
                    {week.periods.map((p) => {
                      const s = daySlots.find((x) => Number(x.periodNumber ?? x.period) === p.number && normalizeDay(x.dayOfWeek || x.day) === day);
                      return (
                        <td key={p.number} className="px-2 py-2 align-top">
                          {s ? (
                            <div className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-2">
                              <div className="font-bold text-slate-900">{s.subjectName || 'Subject not recorded'}</div>
                              {s.teacherName && <div className="text-[11px] text-slate-600">{s.teacherName}</div>}
                              {s.roomNumber && <div className="text-[10px] text-slate-500">{roomLabel(s.roomNumber)}</div>}
                            </div>
                          ) : (
                            <div className="text-center text-[11px] text-slate-400 py-2">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
