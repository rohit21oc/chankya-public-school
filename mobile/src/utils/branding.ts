export const BRAND_COLORS = {
  primary: '#0B1F4B',          // Deep Institutional Navy
  primaryDark: '#051437',      // Midnight Navy
  primaryRoyal: '#123B8C',     // Royal Academic Blue
  primaryBright: '#1D5FD1',    // Vibrant Blue
  accentGold: '#D9A441',       // Heritage Gold
  accentGoldLight: '#F3D27A',  // Soft Gold Tint
  surface: '#FFFFFF',          // Pure White
  surfaceSoft: '#F7F9FC',      // Slate Tint Background
  surfaceCard: '#FFFFFF',
  textPrimary: '#101828',      // Slate 900
  textSecondary: '#344054',    // Slate 700
  textMuted: '#667085',        // Slate 500
  borderColor: '#E4E7EC',      // Slate 200
  borderDark: '#D0D5DD',
  success: '#16803C',          // Forest Emerald
  successLight: '#ECFDF3',
  warning: '#B54708',          // Amber
  warningLight: '#FFFAEB',
  error: '#D92D20',            // Crimson
  errorLight: '#FEF3F2',
  info: '#175CD3',
  infoLight: '#EFF8FF',
};

/**
 * Built-in fallbacks only for what the app needs before School Settings load:
 * the logo key and the default session. All other institute details (name, board,
 * affiliation, code, address, phones, email) come from School Settings via
 * useSchoolIdentity() in services/schoolIdentity.ts.
 */
export const SCHOOL_INFO = {
  shortName: 'PDS PUBLIC SCHOOL',
  currentSession: '2026-2027',
  canonicalLogoKey: 'school/school-logo/30a46bbd-e5b6-454b-9e47-cb3637a5f2ff.png',
};

/**
 * Resolves a cloud storage file key or URL to a full image URL
 */
let fileBaseUrl = 'https://residentialpdsschool.in';

/** Keeps photo and logo links on the same server the app talks to (set by apiService). */
export function setFileBaseUrl(url: string): void {
  const clean = (url || '').trim().replace(/\/+$/, '');
  if (clean) fileBaseUrl = clean;
}

export function resolveFileUrl(fileKeyOrUrl?: string, baseUrl = fileBaseUrl): string {
  if (!fileKeyOrUrl) {
    return `${baseUrl}/api/files/content?key=${encodeURIComponent(SCHOOL_INFO.canonicalLogoKey)}`;
  }
  const clean = fileKeyOrUrl.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
    return clean;
  }
  if (clean.startsWith('/api/files/content')) {
    return `${baseUrl}${clean}`;
  }
  return `${baseUrl}/api/files/content?key=${encodeURIComponent(clean)}`;
}
