import React from 'react';
import { fileUploadService } from '../services/fileUploadService';

export const DEFAULT_CANONICAL_LOGO_KEY = 'school/school-logo/30a46bbd-e5b6-454b-9e47-cb3637a5f2ff.png';

/**
 * Dynamically resolves the school logo URL from Cloudflare R2 / Server storage.
 * Strictly avoids any static fallback SVG and loads the institutional school badge.
 */
export function getSchoolLogoSrc(schoolLogo?: any): string {
  let logoString = '';
  if (typeof schoolLogo === 'string') {
    logoString = schoolLogo.trim();
  } else if (typeof schoolLogo === 'object' && schoolLogo !== null) {
    logoString = (schoolLogo.schoolLogo || schoolLogo.logoFileKey || '').toString().trim();
  }

  if (!logoString) {
    logoString = DEFAULT_CANONICAL_LOGO_KEY;
  }

  // Data/blob addresses are used as they are; http(s) addresses go through the file resolver, which
  // repairs stored storage keys that were saved together with the wrong host.
  if (logoString.startsWith('data:') || logoString.startsWith('blob:')) {
    return logoString;
  }
  if (logoString.startsWith('http://') || logoString.startsWith('https://')) {
    return fileUploadService.getFileUrl(logoString) || logoString;
  }

  // Dynamic resolution via fileUploadService -> Cloudflare R2 / backend gateway
  return fileUploadService.getFileUrl(logoString) || fileUploadService.getFileUrl(DEFAULT_CANONICAL_LOGO_KEY) || '';
}

/**
 * Image error handler for dynamic logos.
 * Does NOT inject static SVGs. Hides the failed image and marks parent so clean fallback UI is shown.
 */
export function handleLogoError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const target = e.currentTarget;
  target.style.display = 'none';
  if (target.parentElement) {
    target.parentElement.classList.add('logo-load-failed');
  }
}
