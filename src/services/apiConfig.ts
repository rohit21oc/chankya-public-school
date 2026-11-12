/**
 * Centralized API Configuration & Backend Connectivity Management
 * 
 * Supports both:
 * 1. Full-stack unified deployment (backend & frontend on same domain/port)
 * 2. Static frontend deployment (Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc.)
 *    connecting to a separate remote backend server via VITE_API_URL or runtime configuration.
 */

// Storage keys
const BACKEND_URL_STORAGE_KEY = 'PDS_BACKEND_API_URL';
const DEFAULT_PROD_BACKEND_URL = 'https://residentialpdsschool.onrender.com';

declare global {
  interface Window {
    __PDS_API_URL__?: string;
  }
}

/**
 * Normalizes a URL by trimming trailing slashes and ensuring valid protocol
 */
export function normalizeUrl(url: string): string {
  let cleaned = (url || '').trim();
  if (!cleaned) return '';
  cleaned = cleaned.replace(/\/+$/, ''); // Remove trailing slashes
  if (!/^https?:\/\//i.test(cleaned) && !cleaned.startsWith('/')) {
    // If user provided a domain without protocol, default to https
    cleaned = (cleaned.startsWith('localhost') || cleaned.startsWith('127.0.0.1'))
      ? `http://${cleaned}`
      : `https://${cleaned}`;
  }
  return cleaned;
}

/**
 * Determines whether the current environment is running as an isolated static frontend
 */
export function isStaticFrontendHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  const port = window.location.port;

  // Known static hosting domains or Vite preview port 5173
  const isStaticHost =
    host.includes('vercel.app') ||
    host.includes('netlify.app') ||
    host.includes('github.io') ||
    host.includes('pages.dev') ||
    host.includes('firebaseapp.com') ||
    host.includes('web.app') ||
    host.includes('s3') ||
    host.includes('surge.sh') ||
    port === '5173' ||
    port === '4173';

  return isStaticHost;
}

/**
 * Gets the configured Backend API Base URL
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  const hostname = window.location.hostname.toLowerCase();

  // 1. If running inside AI Studio preview or local development, always use relative root ('') to hit the local full-stack server
  if (
    hostname.endsWith('.run.app') ||
    hostname.endsWith('.googleusercontent.com') ||
    hostname.endsWith('.aistudio.google') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  ) {
    return '';
  }

  // 2. Production Render Deployment Mapping:
  // Frontend: https://residentialpdsschool.in
  // Backend API: https://residentialpdsschool.onrender.com
  if (hostname.includes('residentialpdspublicschool.onrender.com') || hostname === 'residentialpdspublicschool.onrender.com') {
    return 'https://residentialpdsschool.onrender.com';
  }

  // 3. Vite environment variables (e.g. VITE_API_URL set in deployment)
  const envUrl =
    (import.meta as any).env?.VITE_API_URL ||
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl) {
    return normalizeUrl(envUrl);
  }

  // 4. Manually configured URL from user/admin saved in localStorage
  const savedUrl = localStorage.getItem(BACKEND_URL_STORAGE_KEY);
  if (savedUrl) {
    if (savedUrl.includes('.run.app') || savedUrl.includes('gx7lhrstjxjavixpw5awpd') || savedUrl.includes('33dmqmqitv4ywi35kbrwp2')) {
      localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
    } else {
      return normalizeUrl(savedUrl);
    }
  }

  // 5. Global runtime variable injected by server or deployment script
  if (window.__PDS_API_URL__) {
    return normalizeUrl(window.__PDS_API_URL__);
  }

  // 6. If running on a static hosting platform and no backend URL was supplied,
  // use the production backend URL on Render
  if (isStaticFrontendHost()) {
    return DEFAULT_PROD_BACKEND_URL;
  }

  // 7. Default to relative root (same origin) for full-stack deployment
  return '';
}

/**
 * Sets a custom backend API URL in localStorage and dispatches a notification event
 */
export function setApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeUrl(url);
  if (normalized) {
    localStorage.setItem(BACKEND_URL_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
  }
  window.dispatchEvent(
    new CustomEvent('pds:backend_url_changed', {
      detail: { url: normalized },
    })
  );
}

/**
 * Clears custom backend API URL (reverts to automatic detection)
 */
export function clearApiBaseUrl(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent('pds:backend_url_changed', {
      detail: { url: '' },
    })
  );
}

/**
 * Resolves any relative API endpoint path to a fully qualified or clean relative URL
 * e.g. '/api/auth/login' -> 'https://backend.domain/api/auth/login' (if external backend)
 *                      or '/api/auth/login' (if same origin)
 */
export function getApiUrl(endpoint: string): string {
  if (!endpoint) return '';
  if (/^https?:\/\//i.test(endpoint) || endpoint.startsWith('blob:') || endpoint.startsWith('data:')) {
    return endpoint;
  }

  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (!base) {
    return cleanEndpoint;
  }

  return `${base}${cleanEndpoint}`;
}

/**
 * Resolves a fileKey or stored photo/document URL to an accessible view/download URL.
 * Automatically prepends the active backend API URL if needed.
 */
export function getFileContentUrl(fileKeyOrUrl?: string): string {
  if (!fileKeyOrUrl || typeof fileKeyOrUrl !== 'string' || !fileKeyOrUrl.trim()) return '';
  const clean = fileKeyOrUrl.trim();
  // A stored address like https://<any-host>/school/<folder>/<file> is a storage key that was saved
  // together with a host (often the website host, which does not serve files). Re-point it at the file API.
  const storedKeyUrl = /^https?:\/\/[^/]+\/(school\/[^?#]+)$/i.exec(clean);
  if (storedKeyUrl) {
    let key = storedKeyUrl[1];
    try { key = decodeURIComponent(key); } catch { /* keep as is */ }
    return `${getApiUrl('/api/files/content')}?key=${encodeURIComponent(key)}`;
  }
  if (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('blob:') ||
    clean.startsWith('data:')
  ) {
    return clean;
  }

  // If already formatted as /api/files/content?key=..., ensure it points to backend
  if (clean.startsWith('/api/files/content')) {
    return getApiUrl(clean);
  }

  const cleanKey = clean.replace(/^\/+/, '');
  return `${getApiUrl('/api/files/content')}?key=${encodeURIComponent(cleanKey)}`;
}

export interface BackendHealthResponse {
  status: string;
  application?: string;
  school?: string;
  code?: string;
  academicSession?: string;
  timestamp?: string;
}

export interface BackendHealthResult {
  connected: boolean;
  isConnected?: boolean;
  url: string;
  error?: string;
  message?: string;
  latencyMs?: number;
  r2Bucket?: string;
  data?: BackendHealthResponse;
}

// Aliases for component convenience
export const getBackendBaseUrl = getApiBaseUrl;
export const setCustomBackendUrl = (url: string | null): void => {
  if (!url) {
    clearApiBaseUrl();
  } else {
    setApiBaseUrl(url);
  }
};

/**
 * Checks connectivity to the backend server with a 4-second timeout and latency measurement
 */
export async function testBackendConnection(
  targetUrl?: string
): Promise<BackendHealthResult> {
  const base = targetUrl !== undefined ? normalizeUrl(targetUrl) : getApiBaseUrl();
  const testUrl = base ? `${base}/api/health` : '/api/health';

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      const msg = `Server returned HTTP ${res.status} (${contentType || 'non-JSON response'}). Ensure backend is running and CORS is enabled.`;
      return {
        connected: false,
        isConnected: false,
        url: testUrl,
        error: msg,
        message: msg,
        latencyMs,
      };
    }

    const data: BackendHealthResponse = await res.json();
    return {
      connected: true,
      isConnected: true,
      url: testUrl,
      message: `Connected successfully to ${data.school || 'School ERP Backend'}`,
      latencyMs,
      r2Bucket: 'school-management-r2',
      data,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';
    const msg = isTimeout
      ? 'Connection timed out after 4 seconds. Please check if the server is active.'
      : err.message || 'Failed to connect to backend server. Network or CORS error.';
    return {
      connected: false,
      isConnected: false,
      url: testUrl,
      error: msg,
      message: msg,
      latencyMs,
    };
  }
}

export const AUTH_TOKEN_KEY = 'pradnya_auth_token';
export const AUTH_USER_KEY = 'pradnya_auth_user';

export function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      localStorage.getItem(AUTH_USER_KEY) ||
      sessionStorage.getItem(AUTH_USER_KEY) ||
      localStorage.getItem('pradnya_erp_current_user') ||
      sessionStorage.getItem('pradnya_erp_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Validates if a JWT token has expired or is structurally invalid.
 */
export function isJwtTokenExpired(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return true;
  const clean = token.trim();
  if (!clean || clean === 'undefined' || clean === 'null') return true;

  const parts = clean.split('.');
  if (parts.length !== 3) {
    // Non-JWT token, fallback to not expiring locally
    return false;
  }

  try {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadBase64.padEnd(payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4), '=');
    const decodedStr = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf-8');
    const payload = JSON.parse(decodedStr);
    if (payload && typeof payload.exp === 'number') {
      const nowSeconds = Math.floor(Date.now() / 1000);
      // Expired if current time exceeds exp
      if (payload.exp <= nowSeconds) {
        return true;
      }
    }
    return false;
  } catch {
    // If decoding or parsing failed unexpectedly, do not prematurely expire the token; let the server validate
    return false;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Determine storage preference
  let prefStorage: Storage = localStorage;
  let fallbackStorage: Storage = sessionStorage;
  try {
    const storageType = localStorage.getItem('pradnya_auth_storage_type');
    if (storageType === 'session') {
      prefStorage = sessionStorage;
      fallbackStorage = localStorage;
    }
  } catch {}

  const candidateKeys = [AUTH_TOKEN_KEY, 'pradnya_auth_token', 'pds_auth_token'];

  // Check preferred storage first
  for (const key of candidateKeys) {
    try {
      const raw = prefStorage.getItem(key);
      if (raw) {
        let clean = raw.trim();
        if (clean.startsWith('Bearer ')) clean = clean.substring(7).trim();
        if (clean && clean !== 'undefined' && clean !== 'null') {
          if (isJwtTokenExpired(clean)) {
            prefStorage.removeItem(key);
          } else {
            return clean;
          }
        }
      }
    } catch {}
  }

  // Check fallback storage
  for (const key of candidateKeys) {
    try {
      const raw = fallbackStorage.getItem(key);
      if (raw) {
        let clean = raw.trim();
        if (clean.startsWith('Bearer ')) clean = clean.substring(7).trim();
        if (clean && clean !== 'undefined' && clean !== 'null') {
          if (isJwtTokenExpired(clean)) {
            fallbackStorage.removeItem(key);
          } else {
            return clean;
          }
        }
      }
    } catch {}
  }

  return null;
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-auth-token'] = token;
  }

  // Extract from stored user session
  try {
    const rawUser =
      localStorage.getItem(AUTH_USER_KEY) ||
      sessionStorage.getItem(AUTH_USER_KEY) ||
      localStorage.getItem('pradnya_erp_current_user') ||
      sessionStorage.getItem('pradnya_erp_current_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.id) headers['x-auth-user-id'] = String(u.id);
      if (u?.role) headers['x-auth-user-role'] = String(u.role);
      if (u?.employeeId) headers['x-auth-employee-id'] = String(u.employeeId);
    }
  } catch {}

  // If identity headers were not resolved from stored user, decode JWT payload
  if (!headers['x-auth-user-id'] && token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payloadBase64.padEnd(payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4), '=');
        const decodedStr = typeof atob === 'function'
          ? atob(padded)
          : Buffer.from(padded, 'base64').toString('utf-8');
        const payload = JSON.parse(decodedStr);
        if (payload?.userId) headers['x-auth-user-id'] = String(payload.userId);
        if (payload?.role) headers['x-auth-user-role'] = String(payload.role);
        if (payload?.employeeId) headers['x-auth-employee-id'] = String(payload.employeeId);
      }
    } catch {}
  }

  return headers;
}

/**
 * Shared Authenticated API Client / Request Interceptor
 * Guarantees that:
 * 1. Base URL is automatically resolved (local, preview, or remote Render production API)
 * 2. Proper authentication credentials (JWT Bearer token) are attached
 * 3. Never attaches fake administrative credentials or insecure bypass headers
 */
export async function apiFetch(endpointOrUrl: string, init: RequestInit = {}): Promise<Response> {
  const url = getApiUrl(endpointOrUrl);
  const authHeaders = getAuthHeaders();

  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
  };

  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        mergedHeaders[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        mergedHeaders[key] = value;
      });
    } else {
      Object.assign(mergedHeaders, init.headers);
    }
  }

  const res = await fetch(url, {
    ...init,
    headers: mergedHeaders,
  });

  // If server responded with 401 Unauthorized, clean up local session storage
  if (res.status === 401) {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {}
  }

  return res;
}

