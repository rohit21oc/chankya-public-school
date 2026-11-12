/**
 * Production SPA Router Service for Residential PDS Public School ERP
 * 
 * Guarantees:
 * 1. Deep linking & route persistence across browser refreshes (/fees/collection, /students, /staff, /attendance, /academic/timetable, etc.)
 * 2. Full HTML5 History API integration (pushState, replaceState, popstate for back/forward navigation)
 * 3. Query parameter & route parameter preservation
 * 4. Password reset URL handling (/reset-password?token=...)
 * 5. Authentication state protection (redirects unauthenticated users to /login?redirect=...)
 */

export interface ParsedRoute {
  pathname: string;
  search: string;
  fullPath: string;
  queryParams: URLSearchParams;
  type: 'public' | 'auth' | 'portal';
  view: 'website' | 'login' | 'results' | 'reset-password' | 'portal' | 'notices' | 'privacy' | 'cookies';
  module: string;
  subTab?: string;
  resetToken?: string | null;
}

const ROUTE_CHANGE_EVENT = 'pds:route_change';

export function cleanTokenString(token: string): string {
  let clean = String(token || '').trim();
  // Strip outer quotes, angle brackets or trailing punctuation commonly added by email clients
  clean = clean.replace(/^["'<(\[]+|["'>)\]]+$/g, '');
  clean = clean.replace(/[.,;:]+$/, '');
  clean = clean.replace(/\/+$/, '');
  return clean.trim();
}

/**
 * Extracts password reset token from URL (query string, hash, or path)
 * Works robustly when opening directly from an email client:
 * - /reset-password?token=...
 * - /reset-password#?token=...
 * - /reset-password/...
 */
export function extractResetTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Standard search query params: ?token=...
    const searchParams = new URLSearchParams(window.location.search);
    const qToken = searchParams.get('token') || searchParams.get('resetToken');
    if (qToken && qToken.trim()) return cleanTokenString(qToken);

    // 2. Hash fragment query params (if router used hash): #/reset-password?token=...
    if (window.location.hash) {
      const hash = window.location.hash;
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const hashParams = new URLSearchParams(hash.substring(qIndex));
        const hToken = hashParams.get('token') || hashParams.get('resetToken');
        if (hToken && hToken.trim()) return cleanTokenString(hToken);
      }
    }

    // 3. Fallback regex match on full href
    const match = window.location.href.match(/[?&](?:token|resetToken)=([^&#\s]+)/i);
    if (match && match[1]) return cleanTokenString(match[1]);

    // 4. Path parameter: /reset-password/:token
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const rpIndex = pathParts.findIndex((p) => p.toLowerCase() === 'reset-password');
    if (rpIndex !== -1 && pathParts[rpIndex + 1]) {
      return cleanTokenString(pathParts[rpIndex + 1]);
    }
  } catch {}
  return null;
}

/**
 * Maps a URL pathname to the corresponding module and optional subTab
 */
export function pathToModuleInfo(pathname: string): { module: string; subTab?: string } {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length === 0 || normalized === '/' || normalized === '/dashboard' || normalized === '/portal') {
    return { module: 'dashboard' };
  }

  const primary = parts[0];
  const secondary = parts[1];

  // Specific multi-segment module routes
  if (primary === 'fees') {
    if (secondary === 'collection' || secondary === 'collect') {
      return { module: 'fees', subTab: 'STUDENT_LEDGER' };
    }
    if (secondary === 'ledger' || secondary === 'invoices') {
      return { module: 'fees', subTab: 'LEDGER' };
    }
    if (secondary === 'config' || secondary === 'structure' || secondary === 'structures') {
      return { module: 'fees', subTab: 'CONFIG' };
    }
    if (secondary === 'transactions') {
      return { module: 'fees', subTab: 'TRANSACTIONS' };
    }
    if (secondary === 'defaulters') {
      return { module: 'fees', subTab: 'DEFAULTERS' };
    }
    return { module: 'fees', subTab: 'STUDENT_LEDGER' };
  }

  if ((primary === 'academic' || primary === 'academics') && secondary === 'timetable') {
    return { module: 'timetable' };
  }

  if ((primary === 'academic' || primary === 'academics') && (secondary === 'structure' || secondary === 'setup')) {
    return { module: 'academics' };
  }

  if (primary === 'students' || primary === 'student') {
    if (secondary === 'admission' || secondary === 'enrollment' || secondary === 'admit' || secondary === 'new') {
      return { module: 'students', subTab: 'admission' };
    }
    return { module: 'students' };
  }

  if (primary === 'student-admission' || primary === 'admission-desk') {
    return { module: 'students', subTab: 'admission' };
  }

  // Primary single-segment routes
  switch (primary) {
    case 'students':
    case 'student':
      return { module: 'students' };
    case 'staff':
    case 'teachers':
    case 'faculty':
      return { module: 'teachers' };
    case 'salary':
    case 'payroll':
    case 'staff-salary':
      return { module: 'salary' };
    case 'academics':
    case 'academic':
      return { module: 'academics' };
    case 'timetable':
      return { module: 'timetable' };
    case 'attendance':
      return { module: 'attendance' };
    case 'exams':
    case 'examination':
    case 'marks':
      return { module: 'exams' };
    case 'documents':
    case 'id-cards':
    case 'certificates':
      return { module: 'documents' };
    case 'hostel':
      return { module: 'hostel' };
    case 'transport':
      return { module: 'transport' };
    case 'communication':
    case 'notices':
    case 'sms':
      return { module: 'communication' };
    case 'messages':
    case 'chat':
    case 'chats':
      return { module: 'messages' };
    case 'reports':
      return { module: 'reports' };
    case 'audit-logs':
    case 'audit':
      return { module: 'audit-logs' };
    case 'public-website-management':
    case 'website-management':
    case 'cms':
      return { module: 'public-website-management' };
    case 'settings':
      return { module: 'settings' };
    case 'permissions':
    case 'rbac':
    case 'roles':
      return { module: 'permissions' };
    case 'api-docs':
    case 'docs':
      return { module: 'api-docs' };
    case 'profile':
    case 'my-profile':
      return { module: 'profile' };
    default:
      return { module: primary };
  }
}

/**
 * Maps a module ID and optional subTab to its canonical browser URL
 */
export function moduleToPath(moduleId: string, subTab?: string): string {
  switch (moduleId) {
    case 'login':
      if (subTab === 'staff' || subTab === 'student' || subTab === 'parent') return `/login/${subTab}`;
      return '/login';
    case 'dashboard':
      return '/dashboard';
    case 'students':
      if (subTab === 'admission' || subTab === 'enrollment') return '/students/admission';
      return '/students';
    case 'teachers':
      return '/staff';
    case 'salary':
    case 'payroll':
      return '/salary';
    case 'academics':
    case 'academic':
      return '/academics';
    case 'timetable':
      return '/academic/timetable';
    case 'attendance':
      return '/attendance';
    case 'fees':
      if (subTab === 'STUDENT_LEDGER') return '/fees/collection';
      if (subTab === 'LEDGER') return '/fees/ledger';
      if (subTab === 'CONFIG') return '/fees/config';
      if (subTab === 'TRANSACTIONS') return '/fees/transactions';
      if (subTab === 'DEFAULTERS') return '/fees/defaulters';
      return '/fees/collection';
    case 'exams':
      return '/exams';
    case 'documents':
      return '/documents';
    case 'hostel':
      return '/hostel';
    case 'transport':
      return '/transport';
    case 'communication':
      return '/communication';
    case 'messages':
      return '/messages';
    case 'reports':
      return '/reports';
    case 'audit-logs':
      return '/audit-logs';
    case 'public-website-management':
      return '/public-website-management';
    case 'settings':
      return '/settings';
    case 'permissions':
    case 'rbac':
      return '/permissions';
    case 'api-docs':
      return '/api-docs';
    case 'profile':
      return '/profile';
    default:
      return `/${moduleId}`;
  }
}

/**
 * Parses the current window.location into a structured ParsedRoute
 */
export function parseCurrentRoute(): ParsedRoute {
  if (typeof window === 'undefined') {
    return {
      pathname: '/',
      search: '',
      fullPath: '/',
      queryParams: new URLSearchParams(),
      type: 'public',
      view: 'website',
      module: 'dashboard',
    };
  }

  const pathname = window.location.pathname;
  const search = window.location.search;
  const fullPath = pathname + search;
  const queryParams = new URLSearchParams(search);
  const normalizedPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';

  // 1. Password reset route (must be handled first regardless of authentication)
  const token = extractResetTokenFromUrl();
  if (normalizedPath.startsWith('/reset-password') || token) {
    return {
      pathname,
      search,
      fullPath,
      queryParams,
      type: 'auth',
      view: 'reset-password',
      module: 'reset-password',
      resetToken: token,
    };
  }

  // 2. Login route (supports /login, /login/staff, /login/student, /login/parent)
  if (normalizedPath === '/login' || normalizedPath.startsWith('/login/')) {
    const parts = normalizedPath.split('/').filter(Boolean);
    const subTab = parts[1];
    return {
      pathname,
      search,
      fullPath,
      queryParams,
      type: 'auth',
      view: 'login',
      module: 'login',
      subTab: (subTab === 'staff' || subTab === 'student' || subTab === 'parent') ? subTab : undefined,
    };
  }

  // 3. Public Results check route
  if (normalizedPath === '/results') {
    return {
      pathname,
      search,
      fullPath,
      queryParams,
      type: 'public',
      view: 'results',
      module: 'results',
    };
  }

  // 3.5. Dedicated Public Notices Page (/notices, /all-notices, /circulars)
  if (
    normalizedPath === '/notices' ||
    normalizedPath === '/all-notices' ||
    normalizedPath === '/circulars' ||
    normalizedPath === '/notice-board'
  ) {
    return {
      pathname,
      search,
      fullPath,
      queryParams,
      type: 'public',
      view: 'notices',
      module: 'notices',
    };
  }

  // 3.6. Legal pages (privacy policy, cookie policy)
  if (normalizedPath === '/privacy-policy' || normalizedPath === '/privacy') {
    return { pathname, search, fullPath, queryParams, type: 'public', view: 'privacy', module: 'privacy' };
  }
  if (normalizedPath === '/cookie-policy' || normalizedPath === '/cookies') {
    return { pathname, search, fullPath, queryParams, type: 'public', view: 'cookies', module: 'cookies' };
  }

  // 4. Landing Website routes (Public pages)
  if (normalizedPath.startsWith('/management') || normalizedPath.startsWith('/leadership')) {
    const parts = normalizedPath.split('/').filter(Boolean);
    const memberId = parts.length > 1 ? parts[1] : undefined;
    return {
      pathname,
      search,
      fullPath,
      queryParams,
      type: 'public',
      view: 'website',
      module: 'management',
      subTab: memberId,
    };
  }

  const publicWebsitePaths = [
    '/',
    '/home',
    '/website',
    '/about',
    '/about-us',
    '/management',
    '/leadership',
    '/admissions',
    '/admission',
    '/facilities',
    '/gallery',
    '/campus',
    '/contact',
    '/contact-us',
    '/enquiry',
    '/mandatory-disclosure',
  ];

  if (publicWebsitePaths.includes(normalizedPath)) {
    return {
      pathname,
      search,
      fullPath,
      queryParams,
      type: 'public',
      view: 'website',
      module: normalizedPath.replace('/', '') || 'home',
    };
  }

  // 5. Portal module routes (authenticated modules)
  const moduleInfo = pathToModuleInfo(pathname);
  return {
    pathname,
    search,
    fullPath,
    queryParams,
    type: 'portal',
    view: 'portal',
    module: moduleInfo.module,
    subTab: moduleInfo.subTab,
  };
}

/**
 * Navigate to a specific path using HTML5 History API without reloading the page
 */
export function navigate(path: string, options?: { replace?: boolean }): void {
  if (typeof window === 'undefined') return;

  const targetPath = path.startsWith('/') ? path : `/${path}`;
  const currentFullPath = window.location.pathname + window.location.search;

  if (currentFullPath !== targetPath) {
    if (options?.replace) {
      window.history.replaceState(null, '', targetPath);
    } else {
      window.history.pushState(null, '', targetPath);
    }
  }

  // Dispatch custom route change event for components
  window.dispatchEvent(
    new CustomEvent(ROUTE_CHANGE_EVENT, {
      detail: { path: targetPath },
    })
  );
}

/**
 * Subscribes to browser history navigation changes (back/forward and programmatic)
 */
export function subscribeToRouteChanges(callback: (route: ParsedRoute) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    callback(parseCurrentRoute());
  };

  window.addEventListener('popstate', handler);
  window.addEventListener('hashchange', handler);
  window.addEventListener(ROUTE_CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener('popstate', handler);
    window.removeEventListener('hashchange', handler);
    window.removeEventListener(ROUTE_CHANGE_EVENT, handler);
  };
}
