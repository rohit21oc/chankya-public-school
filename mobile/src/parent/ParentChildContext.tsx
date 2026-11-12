import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Student, User } from '../types';
import { apiService } from '../services/apiService';
import { authStorage } from '../services/authStorage';
import { authorizedChildren, chooseActiveChildId } from '../utils/parentRules';
import { SkeletonList, StateBlock } from './ui';

/**
 * The one place that knows which child a parent is looking at.
 *
 * - Children come from GET /api/students, which the server scopes to the parent,
 *   and are also filtered to the session's linked ids.
 * - The chosen child is stored with the session (authStorage) and restored only if
 *   it is still one of the authorized children.
 * - Switching goes through POST /api/auth/switch-child; if the server refuses, the
 *   previous child stays active.
 * - Every child-specific screen reads activeChild from here and reloads when it changes.
 */
interface ParentChildState {
  children: Student[];
  activeChild: Student | null;
  status: 'loading' | 'ready' | 'error';
  error: string;
  switchingTo: string | null;
  switchError: string;
  reload: () => void;
  selectChild: (id: string) => Promise<boolean>;
}

export type { ParentChildState };
export const ParentChildCtx = createContext<ParentChildState | null>(null);
const Ctx = ParentChildCtx;

export const ParentChildProvider: React.FC<{ user: User; children: React.ReactNode }> = ({ user, children: tree }) => {
  const [list, setList] = useState<Student[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState('');
  const seq = useRef(0);

  const linkedIds = useMemo(
    () => [...(user.linkedStudentIds || []), user.activeStudentId, user.studentId].filter(Boolean) as string[],
    [user.id, (user.linkedStudentIds || []).join(',')]
  );

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setStatus((s) => (list.length ? s : 'loading'));
    setError('');
    let res: Awaited<ReturnType<typeof apiService.getParentChildren>>;
    try {
      res = await apiService.getParentChildren();
    } catch {
      res = { ok: false, status: 0, data: [], error: 'Could not reach the school server. Please check your connection.' };
    }
    if (mine !== seq.current) return;
    if (!res.ok) {
      setStatus('error');
      setError(
        res.status === 401
          ? 'Your session has expired. Please sign in again.'
          : res.error || 'Could not load your children. Please check your connection.'
      );
      return;
    }
    const own = authorizedChildren(res.data, linkedIds);
    setList(own);
    const chosen = chooseActiveChildId(own, authStorage.getActiveStudentId(), user.activeStudentId || user.studentId);
    setActiveId(chosen);
    if (chosen) authStorage.setActiveStudentId(chosen);
    setStatus('ready');
  }, [linkedIds, user.activeStudentId, user.studentId, list.length]);

  useEffect(() => {
    reload();
    // Reload only when the signed-in parent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const selectChild = useCallback(
    async (id: string) => {
      if (id === activeId) return true;
      if (!list.some((c) => c.id === id) || switchingTo) return false;
      setSwitchingTo(id);
      setSwitchError('');
      const res = await apiService.switchChild(id);
      setSwitchingTo(null);
      if (!res.success) {
        setSwitchError(res.error || 'Could not switch child. Please try again.');
        return false;
      }
      // Drop anything cached for the previous child before screens reload.
      apiService.clearCache();
      authStorage.setActiveStudentId(id);
      setActiveId(id);
      return true;
    },
    [activeId, list, switchingTo]
  );

  const value = useMemo<ParentChildState>(
    () => ({
      children: list,
      activeChild: list.find((c) => c.id === activeId) || null,
      status,
      error,
      switchingTo,
      switchError,
      reload,
      selectChild,
    }),
    [list, activeId, status, error, switchingTo, switchError, reload, selectChild]
  );

  return <Ctx.Provider value={value}>{tree}</Ctx.Provider>;
};

export function useParentChildren(): ParentChildState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useParentChildren must be used inside ParentChildProvider');
  return v;
}

/**
 * Loads data for the active child. Results that arrive after the child changed are
 * dropped, and the previous child's data is cleared immediately on a switch so it
 * is never shown under another child's name.
 */
export function useChildData<T>(
  load: (child: Student, opts: { fresh: boolean }) => Promise<{ ok: boolean; status?: number; data?: T; error?: string }>,
  extraKey = ''
) {
  const { activeChild } = useParentChildren();
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  const childKey = activeChild ? `${activeChild.id}|${extraKey}` : '';
  const lastKey = useRef('');

  const run = useCallback(
    async (isRefresh = false) => {
      if (!activeChild) return;
      const mine = ++seq.current;
      if (isRefresh) setRefreshing(true);
      else setState('loading');
      setError('');
      try {
        // Pull-to-refresh always asks the server; normal loads may use the short cache.
        const res = await load(activeChild, { fresh: isRefresh });
        if (mine !== seq.current) return;
        if (res.ok) {
          setData((res.data ?? null) as T | null);
          setState('ready');
        } else {
          setState('error');
          setError(res.status === 401 ? 'Your session has expired. Please sign in again.' : res.error || 'Could not load this information.');
        }
      } catch {
        if (mine !== seq.current) return;
        setState('error');
        setError('Could not reach the school server. Please check your connection.');
      } finally {
        if (mine === seq.current) setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childKey]
  );

  useEffect(() => {
    if (lastKey.current !== childKey) {
      lastKey.current = childKey;
      setData(null); // never show the previous child's data
    }
    run(false);
  }, [run, childKey]);

  return { data, state, error, refreshing, reload: () => run(false), refresh: () => run(true) };
}

/**
 * Shown by child-specific screens when there is no active child, so they reflect
 * the real reason: children still loading, the list failed, or none are linked.
 */
export const NoActiveChild: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  const { status, error, reload } = useParentChildren();
  if (status === 'loading') return <SkeletonList rows={rows} height={88} />;
  if (status === 'error') return <StateBlock kind="error" title="Your children could not be loaded" message={error} onRetry={reload} />;
  return (
    <StateBlock
      kind="empty"
      icon="users"
      title="No child is linked to this account"
      message="Please contact the school office to link your child to this mobile number."
    />
  );
};
