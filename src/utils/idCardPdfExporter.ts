import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Student, TeacherStaff } from '../types';

export async function exportIdCardToPdf(
  elementIdOrStudent: string | any,
  fileNameOrSettings: string | any = 'StudentIDCard.pdf'
): Promise<boolean> {
  try {
    let targetId: string = typeof elementIdOrStudent === 'string' ? elementIdOrStudent : '';
    let fileName = typeof fileNameOrSettings === 'string' ? fileNameOrSettings : 'StudentIDCard.pdf';

    if (typeof elementIdOrStudent === 'object' && elementIdOrStudent !== null) {
      const st = elementIdOrStudent;
      const adm = st.admissionNumber || st.id || 'ADM';
      const cleanName = (st.name || 'Student').replace(/\s+/g, '_');
      fileName = `StudentID_${adm}_${cleanName}.pdf`;
      targetId = `card-${st.id}-front` || `card-${st.id}` || 'parent-child-id-card-preview';
    }

    let element = targetId ? document.getElementById(targetId) : null;
    if (!element) {
      element =
        document.getElementById('parent-child-id-card-preview') ||
        document.getElementById('printable-id-card-view') ||
        document.querySelector('[id$="-front"]') as HTMLElement ||
        document.querySelector('[id*="id-card"]') as HTMLElement;
    }

    if (!element) {
      console.error(`ID Card element not found for PDF export`);
      return false;
    }

    // Capture with crisp HD resolution without choking main browser thread
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      imageTimeout: 3000,
      onclone: (clonedDoc) => {
        inlineCssInto(clonedDoc, collectPageCss());
        const zoomWrapper = clonedDoc.getElementById('printable-card-zoom-wrapper');
        if (zoomWrapper) {
          zoomWrapper.style.transform = 'none';
        }
        const clonedElement = targetId
          ? clonedDoc.getElementById(targetId)
          : element.id
          ? clonedDoc.getElementById(element.id)
          : null;
        if (clonedElement) {
          clonedElement.style.backgroundColor = 'transparent';
          clonedElement.style.border = 'none';
          clonedElement.style.boxShadow = 'none';
          clonedElement.style.padding = '0px';
          clonedElement.style.margin = '0px';
          clonedElement.style.width = 'max-content';
          clonedElement.style.maxWidth = 'none';
          clonedElement.style.overflow = 'visible';
          clonedElement.style.transform = 'none';
        }
      },
    });

    const imgData = canvas.toDataURL('image/png', 1.0);

    // Standard CR80 card or A4/Letter proportion
    // If element contains both cards side by side:
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Create PDF matching aspect ratio
    const pdf = new jsPDF({
      orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [imgWidth * 0.264583 / 3, imgHeight * 0.264583 / 3],
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // 'FAST' = lossless deflate of the image; without it jsPDF embeds raw pixels (tens of MB per card).
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    pdf.save(fileName);
    return true;
  } catch (error) {
    console.error('Error generating ID card PDF:', error);
    return false;
  }
}

// ------------------------------------------------------------------------------------------------
// Bulk cards
//
// Each card used to be captured with html2canvas re-downloading its photo, logo and signature
// (5 s timeout each) and cloning the whole app page. With many cards the server got busy, later
// photos and logos timed out and came out blank, and the export was slow. Now every image is
// downloaded once (a few at a time), kept as a data URL, and swapped into each capture; only the
// card container is cloned.
// ------------------------------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The page's CSS as text. html2canvas copies the page into a hidden frame where the stylesheet
 * <link> has to load again; when it had not finished, a card came out without its design (huge
 * logo, plain text). Putting the CSS inline in the copy avoids that.
 */
function collectPageCss(): string {
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      css += Array.from(sheet.cssRules).map((r) => r.cssText).join('\n') + '\n';
    } catch {
      /* cross-origin sheet (e.g. web fonts): skipped */
    }
  }
  return css;
}

function inlineCssInto(clonedDoc: Document, css: string) {
  if (!css) return;
  clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
    try {
      if (new URL((l as HTMLLinkElement).href).origin === location.origin) l.remove();
    } catch {
      /* keep */
    }
  });
  const style = clonedDoc.createElement('style');
  style.textContent = css;
  clonedDoc.head.appendChild(style);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url: string, timeoutMs = 20000): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) return null;
      return await blobToDataUrl(blob);
    } catch {
      if (attempt === 0) await sleep(400);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Downloads every distinct image inside `root` once and returns original URL → data URL. */
export async function inlineCardImages(root: HTMLElement, concurrency = 6): Promise<Map<string, string>> {
  const urls = Array.from(new Set(Array.from(root.querySelectorAll('img')).map((img) => img.currentSrc || img.src).filter((u) => u && !u.startsWith('data:'))));
  const map = new Map<string, string>();
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      const data = await fetchAsDataUrl(url);
      if (data) map.set(url, data);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return map;
}

/**
 * Waits until every card inside `root` is ready: QR codes generated and visible images finished
 * loading (a failed image counts as finished; the card then shows its fallback).
 */
export async function waitForCardsReady(root: HTMLElement, timeoutMs = 30000): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const qrPending = root.querySelector('[data-idcard-pending]');
    const imgs = Array.from(root.querySelectorAll('img')).filter((img) => img.style.display !== 'none' && !!img.getAttribute('src'));
    const imgsPending = imgs.some((img) => !img.complete);
    if (!qrPending && !imgsPending) return true;
    await sleep(150);
  }
  return false;
}

export async function exportMultipleCardsToPdf(
  cardContainerIds: string[],
  fileName: string = 'All_Student_ID_Cards.pdf',
  onProgress?: (current: number, total: number, stage?: 'preparing' | 'cards') => void,
  stageId = 'bulk-cards-print-stage'
): Promise<boolean> {
  try {
    if (cardContainerIds.length === 0) return false;
    const stage = document.getElementById(stageId) || document.body;

    onProgress?.(0, cardContainerIds.length, 'preparing');
    await waitForCardsReady(stage);
    const images = await inlineCardImages(stage);

    const SCALE = 2;
    const pageCss = collectPageCss();
    const capture = (el: HTMLElement, keepId: string) =>
      html2canvas(el, {
        scale: SCALE,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        // Do not copy the (large) app behind the dialog for every card.
        // and only copy the card being captured, not every card in the dialog.
        ignoreElements: (node) => node.id === 'root' || (/^bulk-card-\d+$/.test(node.id) && node.id !== keepId),
        onclone: (clonedDoc) => {
          inlineCssInto(clonedDoc, pageCss);
          const c = el.id ? clonedDoc.getElementById(el.id) : null;
          if (!c) return;
          c.style.boxShadow = 'none';
          c.style.transform = 'none';
          c.querySelectorAll('img').forEach((img) => {
            const data = images.get(img.currentSrc || img.src) || images.get(img.src);
            if (data) {
              img.removeAttribute('crossorigin');
              img.src = data;
            }
          });
        },
      });

    // Real card size (CR80, 54 x 85.6 mm), front and back side by side, so a print at 100 % gives
    // cards that only need cutting. Every page has the same size.
    const CARD_W = 54;
    const CARD_H = 85.6;
    const GAP = 4;
    const MARGIN = 4;
    let pdf: jsPDF | null = null;

    for (let i = 0; i < cardContainerIds.length; i++) {
      const id = cardContainerIds[i];
      const wrapper = document.getElementById(id);
      if (!wrapper) continue;
      onProgress?.(i + 1, cardContainerIds.length, 'cards');
      // Let the progress text paint between cards.
      await sleep(0);

      // One capture per card (both faces), then cut out each face.
      const faces = [document.getElementById(`${id}-front`), document.getElementById(`${id}-back`)].filter(Boolean) as HTMLElement[];
      const holder = faces[0]?.parentElement || wrapper;
      if (!holder.id) holder.id = `${id}-faces`;
      const full = await capture(holder, id);
      const base = holder.getBoundingClientRect();
      const sx = full.width / base.width;
      const sy = full.height / base.height;
      const shots: HTMLCanvasElement[] = faces.length
        ? faces.map((f) => {
            const r = f.getBoundingClientRect();
            const c = document.createElement('canvas');
            c.width = Math.round(r.width * sx);
            c.height = Math.round(r.height * sy);
            c.getContext('2d')!.drawImage(full, Math.round((r.left - base.left) * sx), Math.round((r.top - base.top) * sy), c.width, c.height, 0, 0, c.width, c.height);
            return c;
          })
        : [full];

      const pageW = MARGIN * 2 + shots.length * CARD_W + (shots.length - 1) * GAP;
      const pageH = MARGIN * 2 + CARD_H;
      if (!pdf) pdf = new jsPDF({ orientation: pageW > pageH ? 'landscape' : 'portrait', unit: 'mm', format: [pageW, pageH], compress: true });
      else pdf.addPage([pageW, pageH], pageW > pageH ? 'landscape' : 'portrait');

      shots.forEach((canvas, k) => {
        // Fit each face into the card box keeping its ratio.
        const r = Math.min(CARD_W / canvas.width, CARD_H / canvas.height);
        const w = canvas.width * r;
        const h = canvas.height * r;
        const x = MARGIN + k * (CARD_W + GAP) + (CARD_W - w) / 2;
        const y = MARGIN + (CARD_H - h) / 2;
        pdf!.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, w, h, undefined, 'FAST');
      });
    }

    if (pdf) {
      pdf.save(fileName);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to export multiple cards PDF', err);
    return false;
  }
}
