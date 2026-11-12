import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { ArrowLeft, LayoutDashboard, ShieldAlert } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar, NAV_ITEMS } from './components/Sidebar';
const DashboardView = lazy(() => import('./components/views/DashboardView').then((m) => ({ default: m.DashboardView })));
const WardenDeskView = lazy(() => import('./components/views/WardenDeskView').then((m) => ({ default: m.WardenDeskView })));
const StudentsView = lazy(() => import('./components/views/StudentsView').then((m) => ({ default: m.StudentsView })));
const TeachersView = lazy(() => import('./components/views/TeachersView').then((m) => ({ default: m.TeachersView })));
const StaffSalaryView = lazy(() => import('./components/views/StaffSalaryView').then((m) => ({ default: m.StaffSalaryView })));
const AcademicsView = lazy(() => import('./components/views/AcademicsView').then((m) => ({ default: m.AcademicsView })));
const TimetableView = lazy(() => import('./components/views/TimetableView').then((m) => ({ default: m.TimetableView })));
const ParentTimetableView = lazy(() => import('./components/parent/ParentTimetableView').then((m) => ({ default: m.ParentTimetableView })));
const ParentHomeworkView = lazy(() => import('./components/parent/ParentHomeworkView').then((m) => ({ default: m.ParentHomeworkView })));
const HomeworkView = lazy(() => import('./components/views/HomeworkView').then((m) => ({ default: m.HomeworkView })));
const AttendanceView = lazy(() => import('./components/views/AttendanceView').then((m) => ({ default: m.AttendanceView })));
const FeesView = lazy(() => import('./components/views/FeesView').then((m) => ({ default: m.FeesView })));
const ExamsView = lazy(() => import('./components/views/ExamsView').then((m) => ({ default: m.ExamsView })));
const DocumentsView = lazy(() => import('./components/views/DocumentsView').then((m) => ({ default: m.DocumentsView })));
const HostelView = lazy(() => import('./components/views/HostelView').then((m) => ({ default: m.HostelView })));
const TransportView = lazy(() => import('./components/views/TransportView').then((m) => ({ default: m.TransportView })));
const CommunicationView = lazy(() => import('./components/views/CommunicationView').then((m) => ({ default: m.CommunicationView })));
const MessagesView = lazy(() => import('./components/views/MessagesView').then((m) => ({ default: m.MessagesView })));
const ReportsView = lazy(() => import('./components/views/ReportsView').then((m) => ({ default: m.ReportsView })));
const AuditLogsView = lazy(() => import('./components/views/AuditLogsView').then((m) => ({ default: m.AuditLogsView })));
const SettingsView = lazy(() => import('./components/views/SettingsView').then((m) => ({ default: m.SettingsView })));
const ApiDocsView = lazy(() => import('./components/views/ApiDocsView').then((m) => ({ default: m.ApiDocsView })));
const PublicWebsiteManagementView = lazy(() => import('./components/views/PublicWebsiteManagementView').then((m) => ({ default: m.PublicWebsiteManagementView })));
import { LoginView } from './components/auth/LoginView';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { PublicLandingPage } from './components/public/PublicLandingPage';
import { PublicResultCheckPage } from './components/public/PublicResultCheckPage';
import { PublicAllNoticesPage } from './components/public/PublicAllNoticesPage';
import { MyProfileModal } from './components/modals/MyProfileModal';
const MyProfilePageView = lazy(() => import('./components/views/MyProfilePageView').then((m) => ({ default: m.MyProfilePageView })));
import { api } from './services/api';
import { authService } from './services/authService';
import { realtimeService } from './services/realtimeService';
import {
  parseCurrentRoute,
  navigate,
  moduleToPath,
  subscribeToRouteChanges,
  ParsedRoute,
} from './services/routerService';
import { SchoolSettings, User, hasPermission } from './types';
import { PublicLegalPage } from './components/public/PublicLegalPage';
import { applySeoToDocument, pageSeo } from './utils/seo';
import { applySchoolFavicon } from './utils/favicon';
const UserRolePermissionsView = lazy(() => import('./components/views/UserRolePermissionsView').then((m) => ({ default: m.UserRolePermissionsView })));

const VALID_MODULES = new Set([
  'dashboard',
  'students',
  'teachers',
  'academics',
  'academic',
  'timetable',
  'homework',
  'attendance',
  'fees',
  'exams',
  'documents',
  'hostel',
  'transport',
  'communication',
  'messages',
  'reports',
  'audit-logs',
  'public-website-management',
  'settings',
  'permissions',
  'rbac',
  'salary',
  'payroll',
  'staff-salary',
  'api-docs',
  'profile',
  'admission',
  'student-admission',
]);

export default function App() {
  const [settings, setSettings] = useState<SchoolSettings>(() => api.getSettings());
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getStoredUser());
  const [currentRoute, setCurrentRoute] = useState<ParsedRoute>(() => parseCurrentRoute());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [openForgotInLogin, setOpenForgotInLogin] = useState<boolean>(() => {
    return currentRoute.queryParams.get('forgot') === 'true';
  });

  // Subscribe to HTML5 browser navigation (back/forward and programmatic route changes)
  useEffect(() => {
    const unsubscribe = subscribeToRouteChanges((newRoute) => {
      setCurrentRoute(newRoute);
      if (newRoute.queryParams.get('forgot') === 'true') {
        setOpenForgotInLogin(true);
      }
    });
    return unsubscribe;
  }, []);

  // Authentication guard on route changes:
  // If an unauthenticated user navigates to a protected portal route, redirect to /login
  useEffect(() => {
    if (!currentUser && currentRoute.type === 'portal') {
      const redirectTarget = encodeURIComponent(currentRoute.fullPath);
      navigate(`/login?redirect=${redirectTarget}`, { replace: true });
    }
  }, [currentUser, currentRoute]);

  // On mount: verify active session with server (/api/auth/me) to ensure token freshness
  useEffect(() => {
    if (currentUser) {
      authService.verifyCurrentSession().then(({ success, user }) => {
        if (!success) {
          setCurrentUser(null);
        } else if (user) {
          setCurrentUser(user);
        }
      });
    }
  }, []);

  const handleNavigate = (moduleId: string, subTab?: string) => {
    const targetPath = moduleToPath(moduleId, subTab);
    navigate(targetPath);
  };

  // Sidebar responsive state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('portal_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('portal_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [profileSection, setProfileSection] = useState<'PAYROLL' | 'ID_CARD' | null>(null);
  const handleOpenProfile = (section?: 'PAYROLL' | 'ID_CARD') => {
    setProfileSection(section === 'PAYROLL' || section === 'ID_CARD' ? section : null);
    handleNavigate('profile');
    setIsMobileSidebarOpen(false);
  };

  // Synchronize settings and student records with backend server & start live real-time stream
  useEffect(() => {
    api.syncWithServer().then(({ settings: syncedSettings }) => {
      setSettings(syncedSettings);
    }).catch(() => {});

    // Launch SSE real-time sync with automatic polling fallback
    realtimeService.start();

    const handleSessionOrSettingsChange = () => {
      setSettings(api.getSettings());
    };

    window.addEventListener('academic-session-changed', handleSessionOrSettingsChange);
    window.addEventListener('cps_entity_settings', handleSessionOrSettingsChange);
    window.addEventListener('cps_entity_session', handleSessionOrSettingsChange);

    return () => {
      window.removeEventListener('academic-session-changed', handleSessionOrSettingsChange);
      window.removeEventListener('cps_entity_settings', handleSessionOrSettingsChange);
      window.removeEventListener('cps_entity_session', handleSessionOrSettingsChange);
      realtimeService.stop();
    };
  }, []);

  // Dynamically synchronize browser tab favicon with active school logo
  useEffect(() => {
    applySchoolFavicon(settings);
  }, [settings?.schoolLogo, settings?.logoFileKey]);

  // Dynamically resolve effective user with latest student/staff photo
  const effectiveUser = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.role === 'STUDENT' && currentUser.studentId) {
      const student = api.getStudentById(currentUser.studentId);
      if (student && (student.photo || student.photoFileKey)) {
        return {
          ...currentUser,
          avatar: student.photo || student.photoFileKey,
        };
      }
    } else if (currentUser.role === 'PARENT') {
      const childId = currentUser.studentId || currentUser.activeStudentId;
      if (childId) {
        const child = api.getStudentById(childId);
        if (child && (child.photo || child.photoFileKey)) {
          return {
            ...currentUser,
            avatar: child.photo || child.photoFileKey,
          };
        }
      }
    } else if (['TEACHER', 'PRINCIPAL', 'ACCOUNTANT', 'HOSTEL_WARDEN', 'TRANSPORT_MANAGER', 'HR_STAFF', 'ACADEMIC_COORDINATOR', 'VICE_PRINCIPAL'].includes(currentUser.role) || currentUser.employeeId) {
      const staff = api.getStaff().find((s) => (currentUser.employeeId && s.employeeId && s.employeeId.toLowerCase() === currentUser.employeeId.toLowerCase()) || s.id === currentUser.id || (s.email && currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase()));
      if (staff) {
        return {
          ...currentUser,
          name: staff.name || currentUser.name,
          employeeId: staff.employeeId || currentUser.employeeId,
          avatar: staff.photo || staff.photoFileKey || currentUser.avatar,
        };
      }
    }
    return currentUser;
  }, [currentUser, currentRoute.module, isProfileModalOpen]);

  // Page title, description and canonical follow navigation (the server already sends the right tags on first load).
  useEffect(() => {
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    let base = '';
    try { base = canonical?.href ? new URL(canonical.href).origin : ''; } catch { base = ''; }
    applySeoToDocument(pageSeo(currentRoute.pathname, settings as any, { signedIn: Boolean(currentUser) }), base);
  }, [currentRoute.pathname, settings.schoolName, settings.schoolAddress, settings.currentAcademicSession, Boolean(currentUser)]);

  const activeModule = currentRoute.module;

  // A new module always opens at its top; the shared scroll area otherwise keeps the previous module's offset.
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0 });
  }, [activeModule]);

  // Enforce role-based module authorization to prevent unauthorized direct URL access
  const isModuleAuthorized = useMemo(() => {
    if (!effectiveUser) return false;
    if (effectiveUser.role === 'SUPER_ADMIN') return true;

    // Direct nav item checks
    const navItem = NAV_ITEMS.find(
      (n) => n.id === activeModule || (n.id === 'academics' && activeModule === 'academic')
    );
    if (!navItem) {
      if (activeModule === 'dashboard' || activeModule === 'profile' || activeModule === 'api-docs') return true;
      if (activeModule === 'admission' || activeModule === 'student-admission') {
        return hasPermission(effectiveUser, 'students.admit') || hasPermission(effectiveUser, 'students.create');
      }
      return true;
    }

    if (!navItem.roles.includes(effectiveUser.role)) return false;
    if (navItem.permission && !hasPermission(effectiveUser, navItem.permission)) return false;
    return true;
  }, [effectiveUser, activeModule]);

  const handleUpdateSettings = (newSettings: SchoolSettings) => {
    setSettings(newSettings);
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    navigate('/login');
  };

  // 1. Password Reset Page (/reset-password?token=...)
  if (currentRoute.view === 'reset-password' || currentRoute.resetToken) {
    return (
      <ResetPasswordPage
        token={currentRoute.resetToken || ''}
        settings={settings}
        onGoToLogin={() => {
          setOpenForgotInLogin(false);
          navigate('/login');
        }}
        onRequestNewLink={() => {
          setOpenForgotInLogin(true);
          navigate('/login?forgot=true');
        }}
      />
    );
  }

  // 2. Public Results Check Page (/results)
  if (currentRoute.view === 'results') {
    return (
      <PublicResultCheckPage
        settings={settings}
        onBackToHome={() => navigate(currentUser ? '/dashboard' : '/')}
        onGoToLogin={() => navigate('/login')}
      />
    );
  }

  // 2.5. Dedicated Public Notices Page (/notices, /all-notices)
  if (currentRoute.view === 'notices') {
    return (
      <PublicAllNoticesPage
        settings={settings}
        onBackToHome={() => navigate('/')}
        onGoToLogin={() => navigate(currentUser ? '/dashboard' : '/login')}
        onGoToResults={() => navigate('/results')}
        effectiveUser={effectiveUser}
      />
    );
  }

  // 3. Login Page (/login)
  if (currentRoute.view === 'login') {
    const requestedTab = currentRoute.queryParams.get('tab') || currentRoute.subTab;
    const initialTab = (requestedTab === 'student' || requestedTab === 'parent' || requestedTab === 'staff')
      ? (requestedTab as 'staff' | 'student' | 'parent')
      : 'staff';

    return (
      <LoginView
        settings={settings}
        initialTab={initialTab}
        initialForgotMode={openForgotInLogin}
        onOpenResetToken={(token) => {
          navigate(`/reset-password?token=${encodeURIComponent(token)}`);
        }}
        onLoginSuccess={(user) => {
          setOpenForgotInLogin(false);
          setCurrentUser(user);

          // If there was a redirect query parameter, navigate back to requested path
          const redirectParam = currentRoute.queryParams.get('redirect');
          if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('/login')) {
            navigate(redirectParam);
          } else {
            navigate('/dashboard');
          }

          api.syncWithServer().then(({ settings: syncedSettings }) => {
            setSettings(syncedSettings);
          }).catch(() => {});
        }}
        onBackToWebsite={() => {
          setOpenForgotInLogin(false);
          navigate('/');
        }}
      />
    );
  }

  // 2.6. Legal pages (/privacy-policy, /cookie-policy)
  if (currentRoute.view === 'privacy' || currentRoute.view === 'cookies') {
    return (
      <PublicLegalPage
        doc={currentRoute.view === 'cookies' ? 'cookies' : 'privacy'}
        settings={settings}
        onBackToHome={() => navigate('/')}
        onNavigate={(path) => navigate(path)}
      />
    );
  }

  // 4. Public Landing Page (/ or /website or /home)
  if (currentRoute.view === 'website' || (!currentUser && currentRoute.type === 'public')) {
    return (
      <div className="relative">
        {effectiveUser && (
          <div className="relative z-50 bg-blue-900 text-white px-3 sm:px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>
                Logged in as <strong>{effectiveUser.name}</strong> ({effectiveUser.role.replace('_', ' ')})
              </span>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white text-blue-900 font-bold hover:bg-blue-50 transition-colors shadow-2xs"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Return to ERP Dashboard</span>
            </button>
          </div>
        )}
        <PublicLandingPage
          settings={settings}
          onGoToLogin={() => navigate(currentUser ? '/dashboard' : '/login')}
          onGoToResults={() => navigate('/results')}
        />
      </div>
    );
  }

  // 5. Protected ERP Portal (Requires authenticated user)
  if (!effectiveUser) {
    return null;
  }

  return (
    <div className="h-dvh max-h-dvh flex flex-col bg-slate-100/70 text-slate-800 font-sans antialiased overflow-hidden w-full">
      <Navbar
        user={effectiveUser}
        settings={settings}
        onOpenApiDocs={() => handleNavigate('api-docs')}
        onNavigate={(mod) => handleNavigate(mod)}
        onOpenProfile={handleOpenProfile}
        onOpenSettings={() => handleNavigate('settings')}
        onGoToWebsite={() => navigate('/website')}
        onLogout={handleLogout}
        onUpdateUser={(updated) => setCurrentUser(updated)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleDesktopSidebar={handleToggleSidebarCollapse}
      />

      {/* Main Workspace with Sidebar & View Area */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden relative w-full">
        {/* Sidebar */}
        <Sidebar
          activeModule={activeModule}
          onSelectModule={(id) => handleNavigate(id)}
          userRole={effectiveUser.role}
          user={effectiveUser}
          onOpenProfile={() => handleOpenProfile()}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic Content Panel */}
        <main ref={mainScrollRef} className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                  <span className="sr-only">Loading…</span>
                </div>
              }
            >
            {/* Access Restricted card for unauthorized modules */}
            {!isModuleAuthorized && VALID_MODULES.has(activeModule) && (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center max-w-lg mx-auto my-12">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
                  <ShieldAlert className="w-8 h-8 text-rose-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Access Restricted</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Your role (<strong className="capitalize">{effectiveUser.role.toLowerCase().replace(/_/g, ' ')}</strong>) is not authorized to access this module.
                </p>
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Return to Dashboard</span>
                </button>
              </div>
            )}

            {/* Hostel wardens get the warden desk (same features as the warden mobile app); other roles are unchanged. */}
            {isModuleAuthorized && activeModule === 'dashboard' && effectiveUser.role === 'HOSTEL_WARDEN' && <WardenDeskView user={effectiveUser} />}
            {isModuleAuthorized && activeModule === 'dashboard' && effectiveUser.role !== 'HOSTEL_WARDEN' && (
              <DashboardView
                user={effectiveUser}
                settings={settings}
                onNavigate={(mod) => handleNavigate(mod)}
              />
            )}

            {isModuleAuthorized && (activeModule === 'students' || activeModule === 'admission' || activeModule === 'student-admission') && (
              <StudentsView
                userRole={effectiveUser.role}
                currentUser={effectiveUser}
                settings={settings}
                subTab={effectiveUser.role === 'TEACHER' ? undefined : (activeModule === 'admission' || activeModule === 'student-admission' ? 'admission' : currentRoute.subTab)}
                onTabChange={(tab) => {
                  const targetPath = moduleToPath('students', tab);
                  navigate(targetPath);
                }}
                onNavigate={(mod) => handleNavigate(mod)}
              />
            )}

            {isModuleAuthorized && activeModule === 'teachers' && (
              <TeachersView userRole={effectiveUser.role} settings={settings} />
            )}

            {isModuleAuthorized && (activeModule === 'salary' || activeModule === 'payroll' || activeModule === 'staff-salary') && (
              <StaffSalaryView
                userRole={effectiveUser.role}
                currentUser={effectiveUser}
                settings={settings}
              />
            )}

            {isModuleAuthorized && (activeModule === 'academics' || activeModule === 'academic') && (
              <AcademicsView userRole={effectiveUser.role} currentUser={effectiveUser} />
            )}

            {isModuleAuthorized && activeModule === 'timetable' && (
              effectiveUser.role === 'PARENT' || effectiveUser.role === 'STUDENT' ? (
                // Parents get their child's read-only timetable and students their own, not the admin editor.
                <ParentTimetableView currentUser={effectiveUser} settings={settings} />
              ) : (
                <TimetableView
                  currentUser={effectiveUser}
                  userRole={effectiveUser.role}
                />
              )
            )}

            {isModuleAuthorized && activeModule === 'homework' && (
              effectiveUser.role === 'PARENT' ? (
                <ParentHomeworkView currentUser={effectiveUser} />
              ) : (
                <HomeworkView currentUser={effectiveUser} />
              )
            )}

            {isModuleAuthorized && activeModule === 'attendance' && (
              <AttendanceView
                currentUser={effectiveUser}
                settings={settings}
              />
            )}

            {isModuleAuthorized && activeModule === 'fees' && (
              <FeesView
                userRole={effectiveUser.role}
                currentUser={effectiveUser}
                settings={settings}
                initialTab={(currentRoute.subTab as any) || 'STUDENT_LEDGER'}
                onTabChange={(tab) => {
                  const targetPath = moduleToPath('fees', tab);
                  navigate(targetPath);
                }}
              />
            )}

            {isModuleAuthorized && activeModule === 'exams' && (
              <ExamsView userRole={effectiveUser.role} settings={settings} />
            )}

            {isModuleAuthorized && activeModule === 'documents' && (
              <DocumentsView
                settings={settings}
                userRole={effectiveUser.role}
                currentUser={effectiveUser}
              />
            )}

            {isModuleAuthorized && activeModule === 'hostel' && <HostelView />}

            {isModuleAuthorized && activeModule === 'transport' && <TransportView />}

            {isModuleAuthorized && activeModule === 'communication' && (
              <CommunicationView userRole={effectiveUser.role} />
            )}

            {isModuleAuthorized && activeModule === 'messages' && <MessagesView currentUser={effectiveUser} />}

            {isModuleAuthorized && activeModule === 'reports' && (
              <ReportsView
                userRole={effectiveUser.role}
                currentUser={effectiveUser}
                onNavigateModule={(mod) => navigate(mod.startsWith('/') ? mod : `/${mod}`)}
              />
            )}

            {isModuleAuthorized && activeModule === 'audit-logs' && (
              <AuditLogsView
                userRole={effectiveUser.role}
                currentUser={effectiveUser}
              />
            )}

            {isModuleAuthorized && activeModule === 'public-website-management' && (
              <PublicWebsiteManagementView
                userRole={effectiveUser.role}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {isModuleAuthorized && activeModule === 'settings' && (
              <SettingsView
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {isModuleAuthorized && (activeModule === 'permissions' || activeModule === 'rbac') && (
              <UserRolePermissionsView currentUser={effectiveUser} />
            )}

            {activeModule === 'api-docs' && <ApiDocsView />}

            {activeModule === 'profile' && (
              <MyProfilePageView
                user={effectiveUser}
                settings={settings}
                onUpdateUser={(updated) => setCurrentUser(updated)}
                onBackToDashboard={() => handleNavigate('dashboard')}
                initialSection={profileSection}
                onSectionHandled={() => setProfileSection(null)}
              />
            )}

            {!VALID_MODULES.has(activeModule) && (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center max-w-lg mx-auto my-12">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
                  404
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Module Not Found</h3>
                <p className="text-sm text-slate-500 mb-6">
                  The requested module <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-xs">{currentRoute.pathname}</code> does not exist or has moved.
                </p>
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Return to Dashboard</span>
                </button>
              </div>
            )}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Profile & Security Modal */}
      <MyProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={effectiveUser}
        settings={settings}
        onUpdateUser={(updated) => setCurrentUser(updated)}
      />
    </div>
  );
}
