import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Banknote,
  ChevronDown,
  Code2,
  ExternalLink,
  Globe,
  GraduationCap,
  IdCard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { SchoolSettings, User } from '../types';
import { fileUploadService } from '../services/fileUploadService';
import { getSchoolLogoSrc, handleLogoError } from '../constants/schoolLogo';
import { api } from '../services/api';
import { useRealtimeListener, useRealtimeStatus } from '../hooks/useRealtime';
import type { RealtimeEvent } from '../types/realtime';
import {
  disableWebPush,
  enableWebPush,
  getWebPushState,
  refreshWebPushRegistration,
  sendWebPushTest,
  type WebPushState,
} from '../services/webPush';

interface NavbarProps {
  user: User;
  settings: SchoolSettings;
  onOpenApiDocs?: () => void;
  onNavigate: (module: string) => void;
  onOpenProfile?: (section?: 'PAYROLL' | 'ID_CARD') => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  onGoToWebsite?: () => void;
  onUpdateUser?: (updated: User) => void;
  onToggleMobileSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleDesktopSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  settings,
  onOpenApiDocs,
  onNavigate,
  onOpenProfile,
  onOpenSettings,
  onLogout,
  onGoToWebsite,
  onToggleMobileSidebar,
  isSidebarCollapsed = false,
  onToggleDesktopSidebar,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const { isConnected, isPollingFallback } = useRealtimeStatus();
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ id: string; title: string; text: string; urgent: boolean; url?: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastToastId = useRef('');

  // A new notice pops up under the bell for 2 seconds, then hides itself.
  // The live event is only a "changed" signal (it carries no notice text), so the notice itself is read from
  // this user's own, already permission-filtered notice list once that list has refreshed.
  const onNoticeEvent = useCallback((event: RealtimeEvent) => {
    if (event.action !== 'CREATE') return;
    const eventTime = Date.parse(event.timestamp) || Date.now();
    let tries = 0;
    const look = () => {
      const fresh = api
        .getNotices()
        .find((n: any) => {
          if (!n?.id || n.id === lastToastId.current || n.status === 'DRAFT') return false;
          const created = Date.parse(n.createdAt || '');
          return !Number.isNaN(created) && Math.abs(created - eventTime) < 30000;
        }) as any;
      if (fresh) {
        lastToastId.current = fresh.id;
        setShowNotifMenu(false);
        setToast({
          id: String(fresh.id),
          title: String(fresh.title || 'New notice'),
          text: String(fresh.content || ''),
          urgent: !!fresh.isUrgent,
        });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2000);
      } else if (++tries < 10) {
        setTimeout(look, 400);
      }
    };
    look();
  }, []);
  useRealtimeListener('NOTICE', onNoticeEvent);

  // Browser notifications: state of this browser, and the popup for a push that arrives while the site is open.
  const [webPush, setWebPush] = useState<WebPushState>('unsupported');
  const [webPushNote, setWebPushNote] = useState<string | null>(null);
  const [webPushBusy, setWebPushBusy] = useState(false);
  useEffect(() => {
    refreshWebPushRegistration();
    getWebPushState().then(setWebPush);
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const m: any = e.data;
      if (m?.type !== 'SCHOOL_PUSH' || !m.payload) return;
      if (m.payload.kind === 'NOTICE') return; // notices already pop up from the live connection
      setShowNotifMenu(false);
      setToast({ id: `push-${Date.now()}`, title: String(m.payload.title || 'New message'), text: String(m.payload.body || ''), urgent: false, url: String(m.payload.url || '') });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2000);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);
  const runWebPush = async (action: () => Promise<{ ok: boolean; message: string } | void>) => {
    setWebPushBusy(true);
    setWebPushNote(null);
    const r = await action();
    if (r) setWebPushNote(r.message);
    setWebPush(await getWebPushState());
    setWebPushBusy(false);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // Profile / notification menus close on a click or tap outside them, and on Esc.
  useEffect(() => {
    if (!showProfileMenu && !showNotifMenu) return;
    const onPointerDown = (e: Event) => {
      const target = e.target as Node | null;
      if (showProfileMenu && profileRef.current && target && !profileRef.current.contains(target)) setShowProfileMenu(false);
      if (showNotifMenu && notifRef.current && target && !notifRef.current.contains(target)) setShowNotifMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProfileMenu(false);
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showProfileMenu, showNotifMenu]);

  // Compute clean role-specific subtitle strictly for the logged-in user
  let identitySubtitle = user.role.replace(/_/g, ' ');
  if (user.role === 'SUPER_ADMIN') {
    identitySubtitle = 'Super Administrator';
  } else if (user.role === 'PRINCIPAL') {
    identitySubtitle = 'Principal & Head';
  } else if (user.role === 'TEACHER') {
    identitySubtitle = user.employeeId ? `Faculty • ${user.employeeId}` : 'Faculty Member';
  } else if (user.role === 'STUDENT') {
    identitySubtitle = user.studentId ? `Student • ${user.studentId}` : 'Student Portal';
  } else if (user.role === 'PARENT') {
    identitySubtitle = 'Parent Portal';
  }

  const handleProfileClick = (section?: 'PAYROLL' | 'ID_CARD') => {
    setShowProfileMenu(false);
    if (onOpenProfile) {
      onOpenProfile(section);
    } else {
      onNavigate('profile');
    }
  };
  const isStaffUser = user.role !== 'STUDENT' && user.role !== 'PARENT';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs print:hidden w-full max-w-full shrink-0">
      <div className="flex items-center justify-between px-2.5 sm:px-4 lg:px-6 h-16 min-h-[4rem] w-full min-w-0">
        {/* ========================================================================= */}
        {/* LEFT: Sidebar Toggles & Responsive School Branding */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Mobile Hamburger Toggle (< 1024px) */}
          {onToggleMobileSidebar && (
            <button
              type="button"
              id="navbar-mobile-toggle-btn"
              onClick={onToggleMobileSidebar}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors lg:hidden shrink-0"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Desktop Sidebar Collapse Toggle (>= 1024px) */}
          {onToggleDesktopSidebar && (
            <button
              type="button"
              id="navbar-desktop-collapse-btn"
              onClick={onToggleDesktopSidebar}
              className="hidden lg:flex p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors shrink-0"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label="Toggle Sidebar"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-blue-600" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}

          {/* School Crest Logo */}
          <div className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white text-white font-bold tracking-wider shadow-2xs border border-slate-200 overflow-hidden shrink-0">
            {getSchoolLogoSrc(settings.schoolLogo) ? (
              <img
                src={getSchoolLogoSrc(settings.schoolLogo)}
                alt="Logo"
                className="w-full h-full object-contain p-0.5 bg-white"
                referrerPolicy="no-referrer"
                onError={handleLogoError}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-blue-900 text-amber-300 font-bold text-xs p-1">
                <GraduationCap className="w-4 h-4 text-amber-400" />
              </div>
            )}
          </div>

          {/* School Name & Affiliation */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-sm md:text-base font-bold text-slate-900 leading-tight truncate">
                {settings.schoolName}
              </h1>
              {settings.affiliatedBoard && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  {settings.affiliatedBoard}
                </span>
              )}
            </div>
            <p className="hidden md:block text-[11px] text-slate-500 font-medium truncate">
              {settings.affiliationNumber ? `${settings.affiliatedBoard ? `${settings.affiliatedBoard} ` : ''}Affiliation No: ${settings.affiliationNumber} • ` : ''}School ERP
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT: Responsive Actions & Logged-in User Profile */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
          {/* Public Website Link (Desktop Large only) */}
          {onGoToWebsite && (
            <button
              type="button"
              id="nav-view-website-btn"
              onClick={onGoToWebsite}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
              title="View Public School Website"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>Website</span>
            </button>
          )}

          {/* Active Session Badge (Desktop & Tablet) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="whitespace-nowrap">Session {settings.currentAcademicSession}</span>
          </div>

          {/* Live Data Real-Time Sync Indicator */}
          <div
            id="navbar-live-sync-indicator"
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shrink-0 transition-colors ${
              isConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : isPollingFallback
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
            title={
              isConnected || isPollingFallback
                ? 'Changes made by others appear automatically'
                : 'Connecting…'
            }
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : isPollingFallback
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-slate-400'
              }`}
            />
            <span className="whitespace-nowrap">
              {isConnected || isPollingFallback ? 'Live' : 'Connecting'}
            </span>
          </div>

          {/* Quick Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              id="nav-notifications-btn"
              onClick={() => {
                setShowProfileMenu(false);
                setToast(null);
                setShowNotifMenu((open) => !open);
              }}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors relative border border-transparent hover:border-slate-200"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {api.getNotices().length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white"></span>
              )}
            </button>

            {toast && !showNotifMenu && (
              <button
                type="button"
                id="nav-notice-toast"
                role="status"
                onClick={() => {
                  const url = toast.url;
                  setToast(null);
                  if (url && url.startsWith('/')) window.location.assign(url);
                  else onNavigate('communication');
                }}
                className="notif-toast fixed top-[4.25rem] left-3 right-3 sm:left-auto sm:right-4 sm:w-80 text-left bg-white rounded-2xl shadow-xl border border-blue-200 p-3 z-50"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 line-clamp-1">{toast.title}</span>
                  {toast.urgent && (
                    <span className="px-1.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-800 shrink-0">URGENT</span>
                  )}
                </span>
                {toast.text && <span className="block text-[11px] text-slate-500 mt-0.5 line-clamp-2">{toast.text}</span>}
              </button>
            )}

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in duration-150">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Official Notices</span>
                  <span
                    className="text-[11px] text-blue-600 font-semibold cursor-pointer hover:underline"
                    onClick={() => {
                      setShowNotifMenu(false);
                      onNavigate('communication');
                    }}
                  >
                    View all ({api.getNotices().length})
                  </span>
                </div>
                <div className="divide-y divide-slate-100 text-xs max-h-72 overflow-y-auto">
                  {api.getNotices().length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      No active notices published at this moment.
                    </div>
                  ) : (
                    api.getNotices().slice(0, 4).map((n) => (
                      <div
                        key={n.id}
                        className="p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setShowNotifMenu(false);
                          onNavigate('communication');
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-slate-800 line-clamp-1">{n.title}</p>
                          {n.isUrgent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-800 shrink-0">
                              URGENT
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-2">{n.content}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {n.publishDate || n.publishedDate || n.date}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {(webPush === 'off' || webPush === 'on' || webPush === 'blocked') && (
                  <div className="px-4 py-3 border-t border-slate-100 text-xs space-y-2">
                    {webPush === 'off' && (
                      <>
                        <p className="text-slate-600">Get messages and notices on this device, even when the site is closed.</p>
                        <button
                          type="button"
                          disabled={webPushBusy}
                          onClick={() => runWebPush(enableWebPush)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold"
                        >
                          {webPushBusy ? 'Turning on...' : 'Turn on alerts'}
                        </button>
                      </>
                    )}
                    {webPush === 'on' && (
                      <>
                        <p className="text-emerald-700 font-semibold">Alerts are on for this browser.</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={webPushBusy}
                            onClick={() => runWebPush(sendWebPushTest)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-60 font-semibold text-slate-700"
                          >
                            Send a test
                          </button>
                          <button
                            type="button"
                            disabled={webPushBusy}
                            onClick={() => runWebPush(async () => { await disableWebPush(); return { ok: true, message: 'Alerts are off for this browser.' }; })}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-60 font-semibold text-slate-700"
                          >
                            Turn off
                          </button>
                        </div>
                      </>
                    )}
                    {webPush === 'blocked' && (
                      <p className="text-amber-700">Alerts are blocked for this site. Allow notifications in the browser's site settings to turn them on.</p>
                    )}
                    {webPushNote && <p className="text-slate-500">{webPushNote}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ======================================================================= */}
          {/* LOGGED-IN USER PROFILE BUTTON & DROPDOWN (Strictly Current User Only)   */}
          {/* ======================================================================= */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              id="nav-profile-dropdown-btn"
              onClick={() => {
                setShowNotifMenu(false);
                setShowProfileMenu((open) => !open);
              }}
              aria-expanded={showProfileMenu}
              aria-haspopup="menu"
              className="flex items-center gap-2 p-1 sm:p-1.5 sm:pr-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              title={`${user.name} (${identitySubtitle})`}
              aria-label="User Account Menu"
            >
              {user.avatar && fileUploadService.getFileUrl(user.avatar) ? (
                <img
                  src={fileUploadService.getFileUrl(user.avatar)}
                  alt={user.name}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover border border-slate-300 shrink-0 shadow-2xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                  {user.name.charAt(0)}
                </div>
              )}

              {/* Desktop Name & Subtitle */}
              <div className="text-left hidden md:block max-w-[140px] lg:max-w-[190px]">
                <div className="text-xs font-bold text-slate-900 leading-none truncate">
                  {user.name}
                </div>
                <div className="text-[10px] font-medium text-slate-500 truncate mt-0.5">
                  {identitySubtitle}
                </div>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* User Identity Header */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/70">
                  {user.avatar && fileUploadService.getFileUrl(user.avatar) ? (
                    <img
                      src={fileUploadService.getFileUrl(user.avatar)}
                      alt={user.name}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-300 shadow-2xs shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-2xs shrink-0">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                      {user.role.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{identitySubtitle}</p>
                  </div>
                </div>

                {/* Profile Navigation Links */}
                <div className="py-1">
                  <button
                    type="button"
                    id="dropdown-my-profile-btn"
                    onClick={() => handleProfileClick()}
                    className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors font-semibold"
                  >
                    <UserIcon className="w-4 h-4 text-blue-600" />
                    <span>My Profile</span>
                  </button>

                  {isStaffUser && (
                    <>
                      <button
                        type="button"
                        id="dropdown-my-payroll-btn"
                        onClick={() => handleProfileClick('PAYROLL')}
                        className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors font-medium"
                      >
                        <Banknote className="w-4 h-4 text-emerald-600" />
                        <span>My Payroll &amp; Payslips</span>
                      </button>
                      <button
                        type="button"
                        id="dropdown-my-id-card-btn"
                        onClick={() => handleProfileClick('ID_CARD')}
                        className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors font-medium"
                      >
                        <IdCard className="w-4 h-4 text-indigo-600" />
                        <span>My ID Card</span>
                      </button>
                    </>
                  )}

                  {onOpenSettings && (user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN' || user.role === 'PRINCIPAL') && (
                    <button
                      type="button"
                      id="dropdown-settings-btn"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenSettings();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors font-medium"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>School Settings</span>
                    </button>
                  )}

                  {onGoToWebsite && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onGoToWebsite();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors font-medium"
                    >
                      <ExternalLink className="w-4 h-4 text-emerald-600" />
                      <span>School Website</span>
                    </button>
                  )}
                </div>

                {/* Sign Out */}
                {onLogout && (
                  <div className="p-2 border-t border-slate-100">
                    <button
                      type="button"
                      id="dropdown-logout-btn"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Direct Sign Out Button (Visible on Desktop & Tablet) */}
          {onLogout && (
            <button
              type="button"
              id="nav-logout-btn"
              onClick={onLogout}
              className="hidden sm:flex p-2 rounded-xl border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600 transition-colors shrink-0"
              title="Sign Out of Portal"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
