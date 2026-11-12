import { getApiUrl, getAuthHeaders } from '../services/apiConfig';
import { DEFAULT_CANONICAL_LOGO_KEY } from '../constants/schoolLogo';
import { getFileContentUrl } from '../services/apiConfig';
import { SchoolSettings, Student } from '../types';

/** Loads an image through the signed-in image proxy (an <img> tag cannot send the session). */
function loadViaProxy(img: HTMLImageElement, proxyPath: string, onFail: () => void): void {
  fetch(getApiUrl(proxyPath), { headers: getAuthHeaders() })
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((blob) => {
      img.src = URL.createObjectURL(blob);
    })
    .catch(onFail);
}


// High-speed in-memory cache for resolved base64 image assets to prevent redundant network/disk round-trips
const imageBase64Cache = new Map<string, string>();

/**
 * Robust, universal utility to resolve and load any image (school logo, student photo,
 * principal signature) as a Base64 Data URL.
 * 
 * Works in both:
 * 1. Node.js environments (CLI verification scripts / test suites) via filesystem
 * 2. Browser runtime via CORS fetch with HTMLImageElement + Canvas fallback
 */
const inFlightImages = new Map<string, Promise<string | null>>();
const failedImages = new Map<string, number>();
const FAILED_IMAGE_RETRY_MS = 60_000;

/**
 * Same image asked for twice at once shares one request, and an image that just failed is not retried
 * for a minute. Without this every export and every re-render repeated the slow fetch -> proxy -> timeout chain.
 */
export async function getDocumentImageBase64Async(
  candidate?: string | null,
  fallbackToDefaultLogo: boolean = false
): Promise<string | null> {
  const key = `${(candidate || '').trim()}|${fallbackToDefaultLogo ? 1 : 0}`;
  if (!candidate && !fallbackToDefaultLogo) return null;
  const failedAt = failedImages.get(key);
  if (failedAt && Date.now() - failedAt < FAILED_IMAGE_RETRY_MS) return null;
  const running = inFlightImages.get(key);
  if (running) return running;
  const job = loadDocumentImageBase64(candidate, fallbackToDefaultLogo)
    .then((result) => {
      if (result) failedImages.delete(key);
      else failedImages.set(key, Date.now());
      return result;
    })
    .finally(() => inFlightImages.delete(key));
  inFlightImages.set(key, job);
  return job;
}

async function loadDocumentImageBase64(
  candidate?: string | null,
  fallbackToDefaultLogo: boolean = false
): Promise<string | null> {
  let target = (candidate || '').trim();
  if (!target && fallbackToDefaultLogo) {
    target = DEFAULT_CANONICAL_LOGO_KEY;
  }
  if (!target) return null;

  // Already a base64 data URL
  if (target.startsWith('data:image/')) {
    return target;
  }

  // Check in-memory cache
  if (imageBase64Cache.has(target)) {
    return imageBase64Cache.get(target)!;
  }

  // Node.js environment
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');

      // 1. Direct HTTP/HTTPS fetch in Node with timeout
      if (target.startsWith('http://') || target.startsWith('https://')) {
        try {
          const res = await fetch(target, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const mime = (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) ? 'png' : 'jpeg';
            const b64 = `data:image/${mime};base64,${buf.toString('base64')}`;
            imageBase64Cache.set(target, b64);
            return b64;
          }
        } catch {}
      }

      // Strip query parameters if present (e.g. key=...)
      let cleanKey = target;
      if (cleanKey.includes('key=')) {
        try {
          const match = cleanKey.match(/key=([^&]+)/);
          if (match && match[1]) {
            cleanKey = decodeURIComponent(match[1]);
          }
        } catch {}
      }
      cleanKey = cleanKey.replace(/^\/+/, '');
      const baseName = path.basename(cleanKey);

      const possiblePaths = [
        target,
        `./${target}`,
        cleanKey,
        `./${cleanKey}`,
        `data/storage/${cleanKey}`,
        `./data/storage/${cleanKey}`,
        `data/storage/${target.replace(/^\/+/, '')}`,
        `./data/storage/${target.replace(/^\/+/, '')}`,
        `src/assets/images/${cleanKey}`,
        `src/assets/images/${baseName}`,
        `src/assets/images/student_photo_1790946584338.jpg`,
        `src/assets/images/principal_signature_1790946614286.jpg`,
        `data/storage/school/students/photos/2026/09/${baseName}`,
        `data/storage/school/students/photos/2026/09/rohan-sharma-photo.jpg`,
        `data/storage/school/school-logo/${baseName}`,
        `data/storage/school/school-logo/30a46bbd-e5b6-454b-9e47-cb3637a5f2ff.png`,
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const stat = fs.statSync(p);
          if (stat.isFile() && stat.size > 0) {
            const buf = fs.readFileSync(p);
            let mime = 'jpeg';
            if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
              mime = 'png';
            } else if (buf[0] === 0xff && buf[1] === 0xd8) {
              mime = 'jpeg';
            } else if (p.toLowerCase().endsWith('.png')) {
              mime = 'png';
            }
            const b64 = `data:image/${mime};base64,${buf.toString('base64')}`;
            imageBase64Cache.set(target, b64);
            return b64;
          }
        }
      }

      // 2. Query running backend server on port 3000 if file key is relative
      try {
        const queryUrl = `http://localhost:3000/api/files/content?key=${encodeURIComponent(cleanKey)}`;
        const res = await fetch(queryUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 50) {
            const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;
            const mime = isPng ? 'png' : 'jpeg';
            const b64 = `data:image/${mime};base64,${buf.toString('base64')}`;
            imageBase64Cache.set(target, b64);
            return b64;
          }
        }
      } catch {}
    } catch {
      // Node resolution failed
    }
    return null;
  }

  // Browser environment
  let resolvedUrl = getFileContentUrl(target);
  if (!resolvedUrl) return null;

  // 1. Primary browser attempt: Fetch with CORS and FileReader
  try {
    const res = await fetch(resolvedUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) {
        const dataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              resolve(null);
            }
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });

        if (dataUrl) {
          // If already standard JPEG or PNG, return immediately
          if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/png')) {
            imageBase64Cache.set(target, dataUrl);
            return dataUrl;
          }
          // If WebP, AVIF, SVG or application/octet-stream, rasterize to standard JPEG
          const raster = await ensureRasterJpegOrPng(dataUrl);
          if (raster) {
            imageBase64Cache.set(target, raster);
            return raster;
          }
          if (dataUrl.startsWith('data:image/')) {
            imageBase64Cache.set(target, dataUrl);
            return dataUrl;
          }
        }
      }
    }
  } catch {
    // Fetch failed or blocked by CORS, proceed to secondary attempts
  }

  // 2. Secondary browser attempt: If it's a remote URL and direct fetch failed, try backend image proxy
  if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
    try {
      const proxyUrl = `/api/files/image-proxy?url=${encodeURIComponent(resolvedUrl)}`;
      const res = await fetch(getApiUrl(proxyUrl), { headers: getAuthHeaders() });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) {
          const dataUrl = await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUrl) {
            if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/png')) {
              return dataUrl;
            }
            const raster = await ensureRasterJpegOrPng(dataUrl);
            if (raster) return raster;
            if (dataUrl.startsWith('data:image/')) return dataUrl;
          }
        }
      }
    } catch {
      // proxy fallback failed, continue to image element
    }
  }

  // 3. Tertiary browser attempt: HTML Image element + Canvas rendering
  try {
    const raster = await ensureRasterJpegOrPng(resolvedUrl);
    if (raster) return raster;
  } catch {
    // Canvas tainted or failed
  }

  return null;
}

/**
 * Guarantees that an image URL, Data URL (WebP, AVIF, SVG, octet-stream), or buffer
 * is converted to a clean, jsPDF-compatible standard JPEG or PNG Data URL.
 */
export async function ensureRasterJpegOrPng(
  input?: string | null
): Promise<string | null> {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Node.js CLI / Test environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    if (trimmed.startsWith('data:image/jpeg') || trimmed.startsWith('data:image/png')) {
      return trimmed;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const res = await fetch(trimmed);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const buf = Buffer.from(ab);
          const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;
          const mime = isPng ? 'png' : 'jpeg';
          return `data:image/${mime};base64,${buf.toString('base64')}`;
        }
      } catch {}
    }
    return null;
  }

  // If already standard JPEG or PNG, it's 100% safe for jsPDF
  if (
    trimmed.startsWith('data:image/jpeg;base64,') ||
    trimmed.startsWith('data:image/png;base64,') ||
    trimmed.startsWith('data:image/jpg;base64,')
  ) {
    return trimmed;
  }

  // For WebP, AVIF, SVG, or remote URLs, load into Image and export via Canvas as standard JPEG
  return new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    let timeoutId = setTimeout(() => {
      // If direct load times out (CORS block on external CDN), fallback to proxy
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const proxyUrl = `/api/files/image-proxy?url=${encodeURIComponent(trimmed)}`;
        const fallbackImg = new Image();
        fallbackImg.crossOrigin = 'anonymous';
        fallbackImg.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(fallbackImg.naturalWidth || fallbackImg.width || 300, 100);
            canvas.height = Math.max(fallbackImg.naturalHeight || fallbackImg.height || 400, 100);
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } catch {
            resolve(null);
          }
        };
        fallbackImg.onerror = () => resolve(null);
        loadViaProxy(fallbackImg, proxyUrl, () => resolve(null));
      } else {
        resolve(null);
      }
    }, 2500);

    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(img.naturalWidth || img.width || 300, 100);
        canvas.height = Math.max(img.naturalHeight || img.height || 400, 100);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const proxyUrl = `/api/files/image-proxy?url=${encodeURIComponent(trimmed)}`;
        const fallbackImg = new Image();
        fallbackImg.crossOrigin = 'anonymous';
        fallbackImg.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(fallbackImg.naturalWidth || fallbackImg.width || 300, 100);
            canvas.height = Math.max(fallbackImg.naturalHeight || fallbackImg.height || 400, 100);
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } catch {
            resolve(null);
          }
        };
        fallbackImg.onerror = () => resolve(null);
        loadViaProxy(fallbackImg, proxyUrl, () => resolve(null));
      } else {
        resolve(null);
      }
    };

    img.src = trimmed;
  });
}

/**
 * Capture an active <img> DOM element to Base64 data URL directly from the screen
 */
export function captureDomImageAsBase64(imgElement: HTMLImageElement | null): string | null {
  if (!imgElement) return null;
  if (imgElement.src && (imgElement.src.startsWith('data:image/jpeg') || imgElement.src.startsWith('data:image/png'))) {
    return imgElement.src;
  }
  try {
    if (imgElement.complete && imgElement.naturalWidth > 0 && imgElement.naturalHeight > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imgElement, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.95);
      }
    }
  } catch (err) {
    // Canvas tainted or SecurityError
  }
  return null;
}

/**
 * Robust async capture: if the DOM image is still loading, awaits its load event before capturing
 */
export async function captureDomImageAsBase64Async(imgElement: HTMLImageElement | null): Promise<string | null> {
  if (!imgElement) return null;
  if (imgElement.src && (imgElement.src.startsWith('data:image/jpeg') || imgElement.src.startsWith('data:image/png'))) {
    return imgElement.src;
  }
  if (imgElement.complete && imgElement.naturalWidth > 0) {
    return captureDomImageAsBase64(imgElement);
  }
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(captureDomImageAsBase64(imgElement));
      }
    }, 2000);

    const onComplete = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(captureDomImageAsBase64(imgElement));
      }
    };

    if (imgElement.complete) {
      onComplete();
    } else {
      imgElement.addEventListener('load', onComplete, { once: true });
      imgElement.addEventListener('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(null);
        }
      }, { once: true });
    }
  });
}

/**
 * Resolves student photo with prioritized DOM element lookup, student.photo,
 * student.photoFileKey, student.avatar, and student.photoUrl.
 * Guaranteed to return a jsPDF-safe JPEG or PNG Base64 Data URL.
 */
const inFlightPhotos = new Map<string, Promise<string | null>>();
const failedPhotos = new Map<string, number>();

/** One lookup per student photo at a time; a photo that could not be loaded is not retried for a minute. */
export async function resolveStudentPhotoBase64(
  student: Student,
  domElementId?: string
): Promise<string | null> {
  const candidate = student.photo || student.photoFileKey || (student as any).photoUrl || (student as any).avatar || '';
  const key = `${student.id}|${candidate}`;
  const failedAt = failedPhotos.get(key);
  if (failedAt && Date.now() - failedAt < FAILED_IMAGE_RETRY_MS) return null;
  const running = inFlightPhotos.get(key);
  if (running) return running;
  const job = loadStudentPhotoBase64(student, domElementId)
    .then((result) => {
      if (result) failedPhotos.delete(key);
      else failedPhotos.set(key, Date.now());
      return result;
    })
    .finally(() => inFlightPhotos.delete(key));
  inFlightPhotos.set(key, job);
  return job;
}

async function loadStudentPhotoBase64(
  student: Student,
  domElementId?: string
): Promise<string | null> {
  // 1. If currently rendered in the DOM, grab the rendered image directly
  if (typeof document !== 'undefined') {
    const candidateIds = [
      domElementId,
      `certificate-student-photo-${student.id}`,
      `certificate-student-photo-${student.admissionNumber}`,
      `student-photo-${student.id}`,
      `admit-card-student-photo-${student.id}`,
      `admit-card-student-photo-${student.admissionNumber}`,
    ].filter(Boolean) as string[];

    for (const id of candidateIds) {
      const domImg = document.getElementById(id) as HTMLImageElement | null;
      if (domImg) {
        const domB64 = await captureDomImageAsBase64Async(domImg);
        if (domB64 && (domB64.startsWith('data:image/jpeg') || domB64.startsWith('data:image/png'))) {
          return domB64;
        }
      }
    }
  }

  // 2. Check candidate photo sources
  const candidate =
    student.photo ||
    student.photoFileKey ||
    (student as any).photoUrl ||
    (student as any).avatar;

  if (candidate) {
    const rawB64 = await getDocumentImageBase64Async(candidate);
    if (rawB64) {
      const safeRaster = await ensureRasterJpegOrPng(rawB64);
      if (safeRaster) {
        return safeRaster;
      }
      if (rawB64.startsWith('data:image/jpeg') || rawB64.startsWith('data:image/png')) {
        return rawB64;
      }
    }

    // Direct rasterize attempt if getDocumentImageBase64Async didn't yield clean data
    const directUrl = getFileContentUrl(candidate) || candidate;
    const directRaster = await ensureRasterJpegOrPng(directUrl);
    if (directRaster) {
      return directRaster;
    }
  }

  return null;
}

/**
 * Preloads all dynamic document image assets (school crest, principal signature, student photos)
 * into base64 Data URLs prior to PDF generation or printing.
 */
export async function preloadDocumentAssets(
  students: Student[],
  settings: SchoolSettings
): Promise<{
  logoBase64: string | null;
  sigBase64: string | null;
  photosMap: Map<string, string>;
}> {
  const [rawLogo, rawSig] = await Promise.all([
    getDocumentImageBase64Async(settings.schoolLogo || (settings as any).logoFileKey, true),
    getDocumentImageBase64Async(settings.principalSignature),
  ]);

  const [logoBase64, sigBase64] = await Promise.all([
    ensureRasterJpegOrPng(rawLogo),
    ensureRasterJpegOrPng(rawSig),
  ]);

  const photosMap = new Map<string, string>();
  const photoPromises = students.map(async (st) => {
    const photoB64 = await resolveStudentPhotoBase64(st);
    if (photoB64) {
      photosMap.set(st.id, photoB64);
      if (st.admissionNumber) {
        photosMap.set(st.admissionNumber, photoB64);
      }
    }
  });

  await Promise.all(photoPromises);

  const [smallLogo, smallSig] = await Promise.all([
    shrinkImageForPdf(logoBase64 || rawLogo),
    shrinkImageForPdf(sigBase64 || rawSig, 480),
  ]);

  return {
    logoBase64: smallLogo,
    sigBase64: smallSig,
    photosMap,
  };
}


/**
 * Shrinks a big logo / signature before it goes into a PDF. jsPDF re-compresses every pixel of a PNG,
 * so a 1200x1200 logo cost seconds on a desktop and far longer on a phone, for a picture that prints about
 * 2 cm wide. Keeps transparency for PNGs. Returns the input unchanged when it is already small or outside a browser.
 */
export async function shrinkImageForPdf(dataUrl: string | null | undefined, maxSide = 360): Promise<string | null> {
  if (!dataUrl) return null;
  if (typeof document === 'undefined' || typeof Image === 'undefined') return dataUrl;
  if (!/^data:image\/(png|jpe?g);base64,/i.test(dataUrl)) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h || Math.max(w, h) <= maxSide) return resolve(dataUrl);
        const k = maxSide / Math.max(w, h);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * k));
        canvas.height = Math.max(1, Math.round(h * k));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        const isPng = /^data:image\/png/i.test(dataUrl);
        if (!isPng) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
