import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Student, User } from '../types';
import { api } from '../services/api';
import { authService } from '../services/authService';

/**
 * Linked children for the signed-in parent and the active child.
 * The list comes from GET /api/students, which the server scopes to the parent's
 * own children; switching goes through POST /api/auth/switch-child, which the
 * server rejects for a child of another family. Nothing here widens access.
 */
export function useParentChildren(user: User | null | undefined) {
  const [children, setChildren] = useState<Student[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeChildId, setActiveChildId] = useState<string>(user?.activeStudentId || user?.studentId || '');
  const [switchError, setSwitchError] = useState<string>('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState('loading');
    try {
      const list = await api.fetchLinkedChildren();
      if (mine !== seq.current) return;
      const linked = new Set([...(user?.linkedStudentIds || []), user?.activeStudentId, user?.studentId].filter(Boolean) as string[]);
      // Defence in depth: never show a record the session is not linked to.
      const own = (list || []).filter((s) => linked.size === 0 || linked.has(s.id) || linked.has(s.admissionNumber));
      setChildren(own);
      setActiveChildId((prev) => {
        if (prev && own.some((c) => c.id === prev)) return prev;
        return own[0]?.id || '';
      });
      setState('ready');
    } catch {
      if (mine !== seq.current) return;
      setState('error');
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const selectChild = useCallback(
    async (childId: string) => {
      if (childId === activeChildId || !children.some((c) => c.id === childId)) return;
      const previous = activeChildId;
      setSwitchError('');
      setActiveChildId(childId);
      const res = await authService.switchChild(childId);
      if (!res.success) {
        setActiveChildId(previous);
        setSwitchError(res.error || 'Could not switch child. Please try again.');
      }
    },
    [activeChildId, children]
  );

  const activeChild = useMemo(
    () => children.find((c) => c.id === activeChildId) || children[0] || null,
    [children, activeChildId]
  );

  return { children, activeChild, state, reload: load, selectChild, switchError };
}
