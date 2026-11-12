/**
 * Photo and document compression in the browser, before upload.
 *
 * Profile photos (students and staff):
 *   Any common image (JPG, JPEG, PNG, WEBP, also GIF, BMP, JFIF, AVIF, and HEIC where the browser can open
 *   it) or a PDF (first page) becomes a passport-size JPEG of about 40 KB. The server only stores
 *   JPEG/PNG/WEBP photos, and small photos load fast on lists, ID cards and the mobile app.
 *
 * Documents (student / staff verification documents):
 *   Images become a readable JPEG of at most ~300 KB. A large PDF is rebuilt from page images when
 *   that makes it smaller (scanned PDFs shrink a lot). Word / Excel files are uploaded as they are.
 */

/** For <input type="file" accept=...> on photo pickers. */
export const PHOTO_ACCEPT =
  'image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.jfif,.avif,.heic,.heif,.pdf,application/pdf';

/** Shown under photo pickers. */
export const PHOTO_FORMATS_LABEL = 'JPG, JPEG, PNG, WEBP or PDF';

/** Target size of a profile photo after compression. */
export const PHOTO_TARGET_BYTES = 40 * 1024;

const MAX_INPUT_BYTES = 25 * 1024 * 1024;

// Profile photo: passport size, ~40 KB
const PHOTO_START_SIDE = 600;
const PHOTO_MIN_SIDE = 240;

// Document image: readable scan, ~300 KB
const DOC_IMAGE_TARGET_BYTES = 300 * 1024;
const DOC_START_SIDE = 1800;
const DOC_MIN_SIDE = 1000;

// Document PDF: only rebuilt when larger than this and the result is smaller
const DOC_PDF_MIN_BYTES = 500 * 1024;
const DOC_PDF_MAX_PAGES = 30;

export function isPdfFile(file: File): boolean {
  return file.type.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isImageLikeFile(file: File): boolean {
  return file.type.toLowerCase().startsWith('image/') || /\.(jpe?g|jfif|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name);
}

function baseName(name: string): string {
  return (name || 'file').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'file';
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The image could not be prepared.'))), 'image/jpeg', quality)
  );
}

/** Draws onto a white canvas whose longest side is at most `maxSide` (never upscales). */
function drawScaled(source: CanvasImageSource, width: number, height: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The image could not be prepared on this device.');
  ctx.fillStyle = '#ffffff'; // transparent PNG backgrounds become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Lowers JPEG quality, then size, until the image fits `targetBytes`.
 * Returns the smallest result reached if the target cannot be met above `minSide`.
 */
async function encodeToTarget(
  source: CanvasImageSource,
  width: number,
  height: number,
  opts: { targetBytes: number; startSide: number; minSide: number }
): Promise<Blob> {
  const qualities = [0.86, 0.78, 0.7, 0.62, 0.55, 0.48, 0.42];
  let side = Math.min(opts.startSide, Math.max(width, height));
  let best: Blob | null = null;
  for (;;) {
    const canvas = drawScaled(source, width, height, side);
    for (const q of qualities) {
      const blob = await toBlob(canvas, q);
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= opts.targetBytes) return blob;
    }
    if (side <= opts.minSide) return best!;
    side = Math.max(opts.minSide, Math.round(side * 0.82));
  }
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  // createImageBitmap also honours the photo's EXIF rotation in current browsers
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close?.() };
    } catch {
      // fall back to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('unreadable'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    const isHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
    throw new Error(
      isHeic
        ? 'This browser cannot open HEIC (iPhone) photos. Please choose a JPG or PNG, or set the iPhone camera to "Most Compatible".'
        : 'This file could not be opened as an image. Please choose a JPG, JPEG, PNG or WEBP file.'
    );
  }
}

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    // Vite bundles the pdf.js worker as its own module worker
    const PdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
  }
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

async function renderPdfPage(doc: any, pageNo: number, maxSide: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, maxSide / Math.max(base.width, base.height)) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

function pdfError(err: any): Error {
  console.warn('[photoNormalizer] PDF could not be read:', err);
  if (/password/i.test(String(err?.message || err?.name || ''))) {
    return new Error('This PDF is password protected. Please choose an unlocked PDF.');
  }
  return new Error('This PDF could not be opened. Please choose another file.');
}

const asJpegFile = (blob: Blob, name: string) =>
  new File([blob], `${baseName(name)}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });

/**
 * Profile photo: any supported image or PDF -> passport-size JPEG of about 40 KB.
 * Throws an Error with a message that can be shown to the user.
 */
export async function normalizePhotoFile(file: File): Promise<File> {
  if (!file || file.size === 0) throw new Error('The selected file is empty. Please choose another photo.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('The file is larger than 25 MB. Please choose a smaller photo.');
  const target = { targetBytes: PHOTO_TARGET_BYTES, startSide: PHOTO_START_SIDE, minSide: PHOTO_MIN_SIDE };

  if (isPdfFile(file)) {
    let doc: any;
    try {
      doc = await loadPdf(file);
      const canvas = await renderPdfPage(doc, 1, 1200);
      return asJpegFile(await encodeToTarget(canvas, canvas.width, canvas.height, target), file.name);
    } catch (err) {
      throw pdfError(err);
    } finally {
      doc?.destroy?.();
    }
  }

  const img = await decodeImage(file);
  try {
    return asJpegFile(await encodeToTarget(img.source, img.width, img.height, target), file.name);
  } finally {
    img.done();
  }
}

/**
 * Document: images -> JPEG of at most ~300 KB; a large PDF is rebuilt from compressed page images when
 * that makes it smaller; anything else (Word, Excel...) or anything that cannot be read is returned as is.
 */
export async function compressDocumentFile(file: File): Promise<File> {
  if (!file || file.size === 0) return file;

  if (isImageLikeFile(file)) {
    if (file.size <= DOC_IMAGE_TARGET_BYTES && /jpe?g/i.test(file.type)) return file;
    try {
      const img = await decodeImage(file);
      try {
        const blob = await encodeToTarget(img.source, img.width, img.height, {
          targetBytes: DOC_IMAGE_TARGET_BYTES,
          startSide: DOC_START_SIDE,
          minSide: DOC_MIN_SIDE,
        });
        return blob.size < file.size ? asJpegFile(blob, file.name) : file;
      } finally {
        img.done();
      }
    } catch {
      return file; // leave unreadable images to the server's own checks
    }
  }

  if (isPdfFile(file) && file.size > DOC_PDF_MIN_BYTES) {
    let doc: any;
    try {
      doc = await loadPdf(file);
      if (doc.numPages > DOC_PDF_MAX_PAGES) return file;
      const { jsPDF } = await import('jspdf');
      let pdf: any = null;
      for (let n = 1; n <= doc.numPages; n++) {
        const canvas = await renderPdfPage(doc, n, 1600);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const orientation = canvas.width > canvas.height ? 'l' : 'p';
        const size: [number, number] = [canvas.width, canvas.height];
        if (!pdf) pdf = new jsPDF({ orientation, unit: 'px', format: size, compress: true });
        else pdf.addPage(size, orientation);
        pdf.addImage(dataUrl, 'JPEG', 0, 0, canvas.width, canvas.height);
      }
      const out: Blob = pdf.output('blob');
      return out.size < file.size * 0.9
        ? new File([out], `${baseName(file.name)}.pdf`, { type: 'application/pdf', lastModified: Date.now() })
        : file;
    } catch (err) {
      console.warn('[photoNormalizer] PDF left uncompressed:', err);
      return file;
    } finally {
      doc?.destroy?.();
    }
  }

  return file;
}
