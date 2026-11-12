import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Student, User } from '../types';
import { apiService } from '../services/apiService';
import { ParentChildCtx, ParentChildState } from '../parent/ParentChildContext';

/**
 * A student is their own "child": the shared screens (fees, homework, ID card …) read the active child
 * from the parent context, so this provider fills it with the signed-in student's own record.
 * The record comes from GET /api/students/:id, which the server only allows for the student themselves.
 */
export const StudentSelfProvider: React.FC<{ user: User; children: React.ReactNode }> = ({ user, children: tree }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const seq = useRef(0);
  const id = user.studentId || user.id;

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setError('');
    setStatus((s) => (student ? s : 'loading'));
    try {
      const r = await apiService.getStudentById(id);
      if (mine !== seq.current) return;
      if (r.ok && r.data) {
        setStudent(r.data);
        setStatus('ready');
      } else {
        setStatus('error');
        setError(r.status === 401 ? 'Your session has expired. Please sign in again.' : r.error || 'Could not load your details. Please check your connection.');
      }
    } catch {
      if (mine !== seq.current) return;
      setStatus('error');
      setError('Could not reach the school server. Please check your connection.');
    }
  }, [id, student]);

  useEffect(() => {
    reload();
    // Reload only when a different student signs in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const value = useMemo<ParentChildState>(
    () => ({
      children: student ? [student] : [],
      activeChild: student,
      status,
      error,
      switchingTo: null,
      switchError: '',
      reload,
      selectChild: async () => true,
    }),
    [student, status, error, reload]
  );

  return <ParentChildCtx.Provider value={value}>{tree}</ParentChildCtx.Provider>;
};

/** Things every student screen needs besides the student record. */
interface StudentPortalState {
  /** The school's saved current session, when known. */
  schoolSession?: string;
  openMenu: () => void;
  navigate: (r: import('./routes').StudentRoute) => void;
}

export const StudentPortalContext = createContext<StudentPortalState>({ openMenu: () => undefined, navigate: () => undefined });
export const useStudentPortal = () => useContext(StudentPortalContext);
