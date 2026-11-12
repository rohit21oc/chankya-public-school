/**
 * Turns text into rows of dark runs so a QR code can be drawn with plain Views
 * (the mobile project has no SVG or canvas package). One View per run keeps
 * the view count low.
 */
import QRCode from 'qrcode';

export interface QrRun { row: number; start: number; len: number }
export interface QrMatrix { count: number; runs: QrRun[] }

export function buildQrMatrix(value: string, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'): QrMatrix {
  const qr = QRCode.create(value, { errorCorrectionLevel });
  const size: number = qr.modules.size;
  const data = qr.modules.data;
  const runs: QrRun[] = [];
  for (let row = 0; row < size; row++) {
    let start = -1;
    for (let col = 0; col <= size; col++) {
      const dark = col < size && !!data[row * size + col];
      if (dark && start === -1) start = col;
      if (!dark && start !== -1) {
        runs.push({ row, start, len: col - start });
        start = -1;
      }
    }
  }
  return { count: size, runs };
}
