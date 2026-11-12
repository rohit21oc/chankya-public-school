import { getSchoolLogoSrc } from '../constants/schoolLogo';
import { api } from '../services/api';
import { getApiUrl } from '../services/apiConfig';
import { SchoolSettings } from '../types';

/**
 * Dynamically binds the browser tab favicon and touch icons to the active school logo
 * uploaded or configured in School Settings.
 *
 * Requirements satisfied:
 * - Dynamic: uses the existing logo configured in School Settings; no hardcoded fallbacks.
 * - Tab favicon: sets and updates <link rel="icon">, <link rel="shortcut icon">, <link rel="apple-touch-icon">.
 * - Supports refresh, login pages, public landing page, dashboard, and all routes.
 * - Compatible with localhost, Cloud Run, and production on Render.
 */
export function applySchoolFavicon(
  schoolLogoOrSettings?: string | Partial<SchoolSettings> | null
): string {
  if (typeof document === 'undefined') return '';

  let effectiveTarget = schoolLogoOrSettings;

  // 1. If not directly provided, inspect currently loaded API settings
  if (!effectiveTarget) {
    try {
      effectiveTarget = api.getSettings();
    } catch {
      // ignore
    }
  }

  // 2. If still empty, inspect persisted cache in localStorage
  if (!effectiveTarget) {
    try {
      const stored = localStorage.getItem('cps_school_erp');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.settings) {
          effectiveTarget = parsed.settings;
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Resolve dynamic logo URL
  let logoUrl = getSchoolLogoSrc(effectiveTarget);

  // If getSchoolLogoSrc was unable to parse, fallback to the dynamic backend favicon endpoint
  if (!logoUrl) {
    logoUrl = getApiUrl('/api/school-logo/favicon');
  }

  if (!logoUrl) return '';

  // Determine appropriate MIME type
  let type = 'image/png';
  const lower = logoUrl.toLowerCase();
  if (lower.includes('.svg') || lower.endsWith('.svg')) {
    type = 'image/svg+xml';
  } else if (lower.includes('.jpg') || lower.includes('.jpeg')) {
    type = 'image/jpeg';
  } else if (lower.includes('.webp')) {
    type = 'image/webp';
  } else if (lower.includes('.ico')) {
    type = 'image/x-icon';
  }

  // Helper to cleanly update or re-create link element so browsers eagerly re-render tab icon
  const updateLinkElement = (rel: string, id: string) => {
    let existing = document.getElementById(id) as HTMLLinkElement | null;
    if (!existing) {
      existing = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
    }

    if (existing) {
      if (existing.href !== logoUrl || existing.type !== type) {
        existing.type = type;
        existing.href = logoUrl;
      }
    } else {
      const link = document.createElement('link');
      link.id = id;
      link.rel = rel;
      link.type = type;
      link.href = logoUrl;
      document.head.appendChild(link);
    }
  };

  updateLinkElement('icon', 'dynamic-favicon');
  updateLinkElement('shortcut icon', 'dynamic-shortcut-icon');
  updateLinkElement('apple-touch-icon', 'dynamic-apple-icon');

  return logoUrl;
}
