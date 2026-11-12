import { useEffect, useState } from 'react';
import type { AcademicClass } from '../types';
import { api } from '../services/api';

/**
 * Classes for a form that picks a class and section. Starts with what the page already has, then loads
 * the current list from the server when the form opens and again when the tab is opened again, so a
 * section added in Academic Structure (on this computer or another one) shows up in the section list
 * without reloading the page. Before, the forms used the copy cached in this browser at sign-in.
 */
export function useFreshClasses(initial: AcademicClass[] | undefined, active = true): AcademicClass[] {
  const [classes, setClasses] = useState<AcademicClass[]>(() => (initial && initial.length ? initial : api.getClasses()));

  useEffect(() => {
    if (initial && initial.length) setClasses(initial);
  }, [initial]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const refresh = () => {
      api
        .syncClasses()
        .then((list) => {
          if (alive && Array.isArray(list) && list.length) setClasses([...list]);
        })
        .catch(() => {});
    };
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [active]);

  return classes;
}
