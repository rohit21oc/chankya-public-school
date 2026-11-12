/**
 * Browser origins allowed to call the API (CORS) and to be used in emailed links.
 * Extra origins can be added with CORS_ORIGINS (comma separated) or FRONTEND_URL / APP_URL.
 */
export const BASE_ALLOWED_ORIGINS = [
  'https://residentialpdsschool.in',
  'https://residentialpdsschool.onrender.com',
  'https://residentialpdssheohar.edu.in',
  'https://www.residentialpdssheohar.edu.in',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4200',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4200',
  // Expo web during development
  'http://localhost:8081',
  'http://localhost:19006',
];
export function isAllowedOrigin(origin: unknown): origin is string {
  if (typeof origin !== 'string' || !/^https?:\/\/[^/\s]+$/i.test(origin.trim().replace(/\/+$/, ''))) return false;
  const o = origin.trim().replace(/\/+$/, '').toLowerCase();
  const extra = [process.env.CORS_ORIGINS || '', process.env.FRONTEND_URL || '', process.env.APP_URL || '']
    .join(',')
    .split(',')
    .map((x) => x.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
  return BASE_ALLOWED_ORIGINS.includes(o) || extra.includes(o);
}

/** Base URL for links in emails: a known client origin, else FRONTEND_URL / APP_URL, else the production site. */
export function resetLinkBase(clientOrigin: unknown, env: { FRONTEND_URL?: string; APP_URL?: string } = process.env): string {
  const clean = (u: string) => u.trim().replace(/\/+$/, '');
  if (isAllowedOrigin(clientOrigin)) {
    const lower = clientOrigin.toLowerCase();
    if (!lower.includes('residentialpdsschool.onrender.com') && !lower.includes('localhost:8080')) return clean(clientOrigin);
  }
  const envFrontend = env.FRONTEND_URL || env.APP_URL;
  if (envFrontend && envFrontend.startsWith('http') && !envFrontend.includes('residentialpdsschool.onrender.com')) return clean(envFrontend);
  return 'https://residentialpdsschool.in';
}
