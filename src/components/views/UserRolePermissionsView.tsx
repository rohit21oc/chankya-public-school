import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight, Lock, RefreshCw, Search, ShieldCheck, Sliders, Users, X } from 'lucide-react';
import { User, UserRole, PERMISSION_MODULE_GROUPS, PERMISSIONS_BY_KEY, ALL_PERMISSION_KEYS, ROLE_HIERARCHY, ROLE_LABELS, DEFAULT_ROLE_PERMISSIONS } from '../../types';
import { authService } from '../../services/authService';
import { PersonAvatar } from '../common/PersonAvatar';
import { isNoLoginStaffRole } from '../../constants/staffRoles';
import { Overrides, diff, effective, grantAll, isOn, normalize, resetKeys, togglePermission } from '../../utils/rbacEditor';

/**
 * Roles & Permissions. Users tab: every account that can sign in, with its role and access; open one to change
 * the role or switch single permissions on / off for that person. Role matrix tab: what each role can do.
 * The server checks every change again (rank, self-change, delegation) and records it in the audit log.
 */

interface Props {
  currentUser: User;
}

type RoleInfo = { role: UserRole; label: string; rank: number; permissions: string[]; isCustomized?: boolean };

const TOTAL = ALL_PERMISSION_KEYS.length;
/** Roles that sign in (support staff have no login and are managed from the staff record). */
const LOGIN_ROLES = (Object.keys(ROLE_HIERARCHY) as UserRole[]).filter((r) => !isNoLoginStaffRole(r)).sort((a, b) => (ROLE_HIERARCHY[b] || 0) - (ROLE_HIERARCHY[a] || 0));

const ROLE_TONE: Partial<Record<UserRole, string>> = {
  SUPER_ADMIN: 'bg-purple-50 text-purple-800 ring-purple-200',
  SCHOOL_ADMIN: 'bg-blue-50 text-blue-800 ring-blue-200',
  PRINCIPAL: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  VICE_PRINCIPAL: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  ACCOUNTANT: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  HR_STAFF: 'bg-amber-50 text-amber-800 ring-amber-200',
  TEACHER: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
};
const RoleBadge: React.FC<{ role: string }> = ({ role }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ring-1 whitespace-nowrap ${ROLE_TONE[role as UserRole] || 'bg-slate-50 text-slate-700 ring-slate-200'}`}>
    {ROLE_LABELS[role as UserRole] || role}
  </span>
);
const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-500'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
    {status === 'ACTIVE' ? 'Active' : status === 'SUSPENDED' ? 'Suspended' : 'Inactive'}
  </span>
);

/** On/off switch. The label carries the meaning; colour is not the only cue. */
const Switch: React.FC<{ on: boolean; disabled?: boolean; onChange: () => void; label: string }> = ({ on, disabled, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${on ? 'bg-emerald-600' : 'bg-slate-300'} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

export const UserRolePermissionsView: React.FC<Props> = ({ currentUser }) => {
  const [tab, setTab] = useState<'users' | 'matrix'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Editor
  const [editing, setEditing] = useState<any | null>(null);
  const [role, setRole] = useState<UserRole>('TEACHER');
  const [ov, setOv] = useState<Overrides>({ granted: [], denied: [] });
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Matrix
  const [matrixRole, setMatrixRole] = useState<UserRole | 'ALL'>('ALL');
  const [matrixSearch, setMatrixSearch] = useState('');

  const isSuper = currentUser.role === 'SUPER_ADMIN';
  const actorRank = ROLE_HIERARCHY[currentUser.role] || 0;

  /** The role's template as the server applies it (customised templates included). */
  const templateOf = useCallback((r: UserRole): string[] => roles.find((x) => x.role === r)?.permissions || DEFAULT_ROLE_PERMISSIONS[r] || [], [roles]);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, r] = await Promise.all([
      authService.getRbacUsers({ search: search.trim() || undefined, role: roleFilter !== 'ALL' ? roleFilter : undefined, status: statusFilter !== 'ALL' ? statusFilter : undefined, limit: 2000 }),
      roles.length ? Promise.resolve(null) : authService.getRbacRoles(),
    ]);
    if (u.success && Array.isArray(u.users)) {
      setUsers(u.users.filter((x: any) => !isNoLoginStaffRole(x.role)));
      setLoadError(null);
    } else setLoadError(u.error || 'Users could not be loaded.');
    if (r && r.success && Array.isArray(r.roles)) setRoles(r.roles as RoleInfo[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // ------------------------------------------------------------------------------------------------
  // Editor
  // ------------------------------------------------------------------------------------------------

  const isSelf = (u: any) => !!u && (u.id === currentUser.id || (!!u.username && u.username === currentUser.username));
  const canManage = (u: any) => !!u && !isSelf(u) && (isSuper || actorRank > (ROLE_HIERARCHY[u.role as UserRole] || 0));
  const readOnly = !canManage(editing);

  const openEditor = (u: any) => {
    setEditing(u);
    setRole(u.role);
    setOv(normalize(templateOf(u.role), { granted: u.customPermissions || [], denied: u.deniedPermissions || [] }));
    setOpenModules(new Set());
    setEditError(null);
    setConfirming(false);
  };
  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setConfirming(false);
  };

  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirming) setConfirming(false);
      else closeEditor();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, confirming, saving]);

  const template = templateOf(role);
  const after = useMemo(() => effective(template, ov), [template, ov]);
  const changes = useMemo(() => (editing ? diff(editing.permissions || [], after) : { added: [], removed: [] }), [editing, after]);
  const roleChanged = !!editing && role !== editing.role;
  const dirty = roleChanged || changes.added.length > 0 || changes.removed.length > 0;
  const labelOf = (k: string) => PERMISSIONS_BY_KEY[k as keyof typeof PERMISSIONS_BY_KEY]?.label || k;

  const changeRole = (r: UserRole) => {
    setRole(r);
    setOv((o) => normalize(templateOf(r), o));
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      if (roleChanged) {
        const rr = await authService.updateUserRole(editing.id, role);
        if (!rr.success) throw new Error(rr.error || 'The role could not be changed.');
      }
      const pr = await authService.updateUserPermissions(editing.id, ov.granted, ov.denied);
      if (!pr.success) throw new Error(pr.error || 'The permissions could not be saved.');
      setFeedback({ type: 'success', message: `Saved for ${editing.name}. They will be asked to sign in again so the new access applies.` });
      setEditing(null);
      setConfirming(false);
      void load();
    } catch (e: any) {
      setEditError(e?.message || 'Could not save.');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------------------------------------
  // Matrix
  // ------------------------------------------------------------------------------------------------

  const matrixRoles = matrixRole === 'ALL' ? LOGIN_ROLES : [matrixRole];
  const matrixGroups = useMemo(() => {
    const q = matrixSearch.trim().toLowerCase();
    if (!q) return PERMISSION_MODULE_GROUPS;
    return PERMISSION_MODULE_GROUPS.map((g) => ({ ...g, permissions: g.permissions.filter((p) => [p.label, p.key, p.description, g.moduleName].some((x) => x.toLowerCase().includes(q))) })).filter((g) => g.permissions.length);
  }, [matrixSearch]);

  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Roles & Permissions</h1>
              <p className="text-sm text-slate-500 mt-0.5">Choose what each person can open and change. Every change is checked by the server and saved in the audit log.</p>
            </div>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="mt-5 flex gap-1 border-b border-slate-200 -mb-px overflow-x-auto" role="tablist">
          {(
            [
              ['users', Users, 'Users', users.length],
              ['matrix', Sliders, 'Role matrix', `${LOGIN_ROLES.length} roles · ${TOTAL} permissions`],
            ] as const
          ).map(([id, Icon, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`shrink-0 inline-flex items-center gap-2 px-3 pb-3 pt-1 text-sm font-semibold border-b-2 transition ${tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className={`text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 ${id === 'matrix' ? 'hidden sm:inline' : ''}`}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div role="status" className={`p-3.5 rounded-xl border flex items-start gap-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
          <div className="flex-1">{feedback.message}</div>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ---------------- Users ---------------- */}
      {tab === 'users' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <label className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, employee ID, mobile or email" className={`${inputCls} pl-9`} aria-label="Search users" />
            </label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputCls} aria-label="Role">
              <option value="ALL">All roles</option>
              {LOGIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls} aria-label="Status">
              <option value="ALL">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          {loading && !users.length ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading users…
            </div>
          ) : loadError && !users.length ? (
            <div className="bg-white rounded-xl border border-rose-200 p-6 text-center text-sm text-rose-700">
              {loadError}{' '}
              <button type="button" onClick={() => void load()} className="font-semibold underline">
                Try again
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No user matches these filters.</div>
          ) : (
            <>
              {/* Phone: cards */}
              <ul className="md:hidden space-y-2">
                {users.map((u) => {
                  const custom = (u.customPermissions?.length || 0) + (u.deniedPermissions?.length || 0) > 0;
                  return (
                    <li key={`${u.type}-${u.id}`}>
                      <button type="button" onClick={() => openEditor(u)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 active:bg-slate-50">
                        <PersonAvatar name={u.name || u.username} photo={u.avatar} size={44} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 truncate">{u.name || u.username}</span>
                            {isSelf(u) && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 rounded px-1.5">You</span>}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{u.employeeId || u.username}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <RoleBadge role={u.role} />
                            <StatusBadge status={u.status} />
                            <span className="text-xs text-slate-600">
                              {u.permissions?.length || 0}/{TOTAL}
                              {custom ? ' · custom' : ''}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop: table */}
              <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="text-left font-semibold px-4 py-3">User</th>
                      <th className="text-left font-semibold px-3 py-3">Role</th>
                      <th className="text-left font-semibold px-3 py-3">Status</th>
                      <th className="text-left font-semibold px-3 py-3">Access</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const n = u.permissions?.length || 0;
                      const custom = (u.customPermissions?.length || 0) + (u.deniedPermissions?.length || 0) > 0;
                      const manage = canManage(u);
                      return (
                        <tr key={`${u.type}-${u.id}`} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <PersonAvatar name={u.name || u.username} photo={u.avatar} size={38} />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                  <span className="truncate max-w-[16rem]">{u.name || u.username}</span>
                                  {isSelf(u) && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 rounded px-1.5">You</span>}
                                </div>
                                <div className="text-xs text-slate-500 truncate max-w-[20rem]">{[u.employeeId || u.username, u.email].filter(Boolean).join(' · ')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <RoleBadge role={u.role} />
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={u.status} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                                <div className="h-full bg-blue-600" style={{ width: `${Math.round((n / TOTAL) * 100)}%` }} />
                              </div>
                              <span className="text-xs text-slate-700 tabular-nums">
                                {n}/{TOTAL}
                              </span>
                              {custom && <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded px-1.5">Custom</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => openEditor(u)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${manage ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                            >
                              {manage ? <Sliders className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              {manage ? 'Edit access' : 'View'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------------- Role matrix ---------------- */}
      {tab === 'matrix' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <label className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={matrixSearch} onChange={(e) => setMatrixSearch(e.target.value)} placeholder="Search a permission or module" className={`${inputCls} pl-9`} aria-label="Search permissions" />
            </label>
            <select value={matrixRole} onChange={(e) => setMatrixRole(e.target.value as any)} className={inputCls} aria-label="Role">
              <option value="ALL">All roles</option>
              {LOGIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500 px-1">What each role can do by default. Change one person's access from the Users tab.</p>

          {/* Phone, or a single role: a simple list per module */}
          <div className={`${matrixRole === 'ALL' ? 'md:hidden' : ''} space-y-3`}>
            {matrixRole === 'ALL' && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">Choose a role above to see its permissions on a phone.</div>
            )}
            {matrixRole !== 'ALL' &&
              matrixGroups.map((g) => {
                const tpl = templateOf(matrixRole);
                const on = g.permissions.filter((p) => tpl.includes(p.key)).length;
                return (
                  <div key={g.moduleId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-900">{g.moduleName}</span>
                      <span className="text-xs text-slate-500">
                        {on}/{g.permissions.length}
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {g.permissions.map((p) => {
                        const allowed = tpl.includes(p.key);
                        return (
                          <li key={p.key} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <span className={`text-sm ${allowed ? 'text-slate-900' : 'text-slate-400'}`}>
                              {p.label}
                              {p.isSensitive && <span className="ml-1.5 text-[10px] font-bold text-rose-700">Sensitive</span>}
                            </span>
                            {allowed ? <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-label="Allowed" /> : <span className="text-xs text-slate-400 shrink-0">No</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
          </div>

          {/* Desktop, all roles: table */}
          {matrixRole === 'ALL' && (
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-slate-50 z-10 min-w-[200px]">Permission</th>
                    {matrixRoles.map((r) => (
                      <th key={r} className="px-1.5 py-3 font-semibold text-center align-bottom min-w-[64px]" title={ROLE_LABELS[r]}>
                        <span className="block leading-tight">{ROLE_LABELS[r].replace(' / Faculty', '').replace(' Administrator', ' Admin').replace(' / Guardian', '')}</span>
                        {roles.find((x) => x.role === r)?.isCustomized && <span className="block text-[10px] font-normal text-amber-700">custom</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixGroups.map((g) => (
                    <React.Fragment key={g.moduleId}>
                      <tr className="bg-slate-100/70">
                        <td colSpan={matrixRoles.length + 1} className="px-4 py-2 font-bold text-slate-800 sticky left-0 bg-slate-100/70">
                          {g.moduleName}
                        </td>
                      </tr>
                      {g.permissions.map((p) => (
                        <tr key={p.key} className="border-b border-slate-100 hover:bg-blue-50/30">
                          <td className="px-4 py-2 sticky left-0 bg-white z-10 border-r border-slate-100" title={p.description}>
                            <span className="text-slate-900">{p.label}</span>
                            {p.isSensitive && <span className="ml-1.5 text-[10px] font-bold text-rose-700">Sensitive</span>}
                          </td>
                          {matrixRoles.map((r) => {
                            const allowed = templateOf(r).includes(p.key);
                            return (
                              <td key={r} className="px-1.5 py-2 text-center">
                                {allowed ? (
                                  <span className="inline-flex w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center" aria-label={`${ROLE_LABELS[r]}: allowed`}>
                                    <Check className="w-3 h-3" strokeWidth={3} />
                                  </span>
                                ) : (
                                  <span className="text-slate-300" aria-label={`${ROLE_LABELS[r]}: not allowed`}>
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {matrixGroups.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">No permission matches “{matrixSearch}”.</div>}
        </div>
      )}

      {/* ---------------- Editor ---------------- */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-stretch sm:items-center justify-center sm:p-4" onClick={closeEditor}>
          <div role="dialog" aria-modal="true" aria-label={`Access for ${editing.name}`} className="bg-white w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
              <PersonAvatar name={editing.name || editing.username} photo={editing.avatar} size={44} />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">{editing.name || editing.username}</h2>
                <p className="text-xs text-slate-500 truncate">{[editing.employeeId || editing.username, editing.email].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={closeEditor} aria-label="Close" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50">
              {readOnly && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex gap-2">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  {isSelf(editing) ? 'You cannot change your own role or permissions. Another administrator has to do it.' : 'Only a higher role can change this account. You can view its access.'}
                </div>
              )}
              {editError && (
                <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900">
                  {editError}
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 p-4 grid sm:grid-cols-2 gap-3 items-end">
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-700 mb-1">Role</span>
                  <select value={role} disabled={readOnly} onChange={(e) => changeRole(e.target.value as UserRole)} className={`${inputCls} disabled:bg-slate-100`}>
                    {LOGIN_ROLES.map((r) => {
                      const allowed = isSuper || (ROLE_HIERARCHY[r] || 0) < actorRank || r === editing.role;
                      return (
                        <option key={r} value={r} disabled={!allowed}>
                          {ROLE_LABELS[r]}
                          {!allowed ? ' (higher than yours)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <div className="text-sm text-slate-600">
                  Access: <b className="text-slate-900">{after.length}</b> of {TOTAL} permissions
                  {(ov.granted.length > 0 || ov.denied.length > 0) && (
                    <span className="text-amber-800">
                      {' '}
                      · {ov.granted.length} extra, {ov.denied.length} removed
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">Permissions</h3>
                <div className="flex gap-3 text-xs font-semibold">
                  <button type="button" onClick={() => setOpenModules(openModules.size ? new Set() : new Set(PERMISSION_MODULE_GROUPS.map((g) => g.moduleId)))} className="text-blue-700 hover:underline">
                    {openModules.size ? 'Collapse all' : 'Expand all'}
                  </button>
                  {!readOnly && (
                    <button type="button" onClick={() => setOv({ granted: [], denied: [] })} className="text-slate-600 hover:underline">
                      Reset to role
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {PERMISSION_MODULE_GROUPS.map((g) => {
                  const keys = g.permissions.map((p) => p.key);
                  const on = keys.filter((k) => isOn(k, template, ov)).length;
                  const changed = keys.some((k) => ov.granted.includes(k) || ov.denied.includes(k));
                  const open = openModules.has(g.moduleId);
                  return (
                    <div key={g.moduleId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 sm:px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setOpenModules((s) => {
                            const n = new Set(s);
                            if (n.has(g.moduleId)) n.delete(g.moduleId);
                            else n.add(g.moduleId);
                            return n;
                          })}
                          aria-expanded={open}
                          className="flex-1 flex items-center gap-2 text-left min-w-0"
                        >
                          {open ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
                          <span className="text-sm font-semibold text-slate-900 truncate">{g.moduleName}</span>
                          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${on ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            {on}/{keys.length}
                          </span>
                          {changed && <span className="text-[11px] font-semibold text-amber-800">changed</span>}
                        </button>
                        {!readOnly && (
                          <div className="flex gap-2 text-xs font-semibold shrink-0">
                            <button type="button" onClick={() => setOv((o) => grantAll(keys, template, o))} className="text-blue-700 hover:underline">
                              All on
                            </button>
                            {changed && (
                              <button type="button" onClick={() => setOv((o) => resetKeys(keys, o))} className="text-slate-600 hover:underline">
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {open && (
                        <ul className="border-t border-slate-100 divide-y divide-slate-100">
                          {g.permissions.map((p) => {
                            const isOnNow = isOn(p.key, template, ov);
                            const extra = ov.granted.includes(p.key);
                            const removed = ov.denied.includes(p.key);
                            return (
                              <li key={p.key} className="px-3 sm:px-4 py-2.5 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-slate-900 flex flex-wrap items-center gap-1.5">
                                    {p.label}
                                    {p.isSensitive && <span className="text-[10px] font-bold text-rose-700 bg-rose-50 rounded px-1">Sensitive</span>}
                                    {extra && <span className="text-[10px] font-bold text-blue-800 bg-blue-50 rounded px-1">Extra for this user</span>}
                                    {removed && <span className="text-[10px] font-bold text-amber-800 bg-amber-50 rounded px-1">Removed for this user</span>}
                                  </div>
                                  <div className="text-xs text-slate-500">{p.description}</div>
                                </div>
                                <Switch on={isOnNow} disabled={readOnly} onChange={() => setOv((o) => togglePermission(p.key, template, o))} label={`${p.label}: ${isOnNow ? 'on' : 'off'}`} />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-white flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-slate-500">
                {dirty ? `${roleChanged ? 'Role changed · ' : ''}${changes.added.length} added, ${changes.removed.length} removed` : 'No changes'}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={closeEditor} className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
                  {readOnly ? 'Close' : 'Cancel'}
                </button>
                {!readOnly && (
                  <button type="button" onClick={() => setConfirming(true)} disabled={!dirty || saving} className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                    Review & save
                  </button>
                )}
              </div>
            </div>
          </div>

          {confirming && (
            <div className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); if (!saving) setConfirming(false); }}>
              <div role="dialog" aria-modal="true" aria-label="Confirm changes" className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-base font-bold text-slate-900">Save changes for {editing.name}?</h3>
                <div className="text-sm space-y-2 max-h-[50vh] overflow-y-auto">
                  {roleChanged && (
                    <div>
                      Role: <b>{ROLE_LABELS[editing.role as UserRole] || editing.role}</b> → <b>{ROLE_LABELS[role]}</b>
                    </div>
                  )}
                  {changes.added.length > 0 && (
                    <div>
                      <div className="font-semibold text-emerald-700">Will get ({changes.added.length})</div>
                      <div className="text-slate-700">{changes.added.map(labelOf).join(', ')}</div>
                    </div>
                  )}
                  {changes.removed.length > 0 && (
                    <div>
                      <div className="font-semibold text-rose-700">Will lose ({changes.removed.length})</div>
                      <div className="text-slate-700">{changes.removed.map(labelOf).join(', ')}</div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">The change applies at once; this person is signed out and signs in again with the new access.</p>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700">
                    Back
                  </button>
                  <button type="button" onClick={save} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5">
                    {saving && <RefreshCw className="w-4 h-4 animate-spin" />} Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
