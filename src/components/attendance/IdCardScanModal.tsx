import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';
import { AlertTriangle, CameraOff, CheckCircle2, Clock, ImageUp, Loader2, RotateCcw, ScanLine, SwitchCamera, X, XCircle } from 'lucide-react';
import { IdCardKind, ScanResult, submitAttendanceScan } from '../../services/idCardQrService';
import { getFileContentUrl } from '../../services/apiConfig';

/**
 * Camera scanner that marks today's attendance from an ID card QR code.
 *
 * - Reads QR codes with the browser's BarcodeDetector when it exists, otherwise with jsQR.
 * - The server decides everything (who may mark whom, today's date, holidays,
 *   duplicates); this screen only shows what the server answered.
 * - The same card is ignored for a few seconds after a scan so one card held in
 *   front of the camera is sent once.
 * - If a person is already marked Absent/Leave, the server asks for confirmation;
 *   the change is sent again only when the user confirms.
 * - A photo of the card can be chosen instead when no camera is available.
 */

type Props = {
  open: boolean;
  kind: IdCardKind;
  onClose: () => void;
  /** Called after the server recorded (or already had) attendance for someone. */
  onMarked?: (result: ScanResult) => void;
};

type Feedback =
  | { tone: 'success' | 'info' | 'error'; result: ScanResult; message: string }
  | { tone: 'confirm'; result: ScanResult; message: string; code: string; status: 'PRESENT' | 'LATE' };

const REPEAT_WINDOW_MS = 4000;
const CAMERA_KEY = 'cps.idScan.cameraId';

function readSavedCamera(): string {
  try {
    return window.localStorage.getItem(CAMERA_KEY) || '';
  } catch {
    return '';
  }
}
function saveCamera(id: string) {
  try {
    if (id) window.localStorage.setItem(CAMERA_KEY, id);
    else window.localStorage.removeItem(CAMERA_KEY);
  } catch {
    /* storage not available */
  }
}

/** A native detector is used only when the browser really supports QR codes (Chrome on Windows exposes the API but reads nothing). */
async function createNativeDetector(): Promise<any> {
  const BD = (window as any).BarcodeDetector;
  if (!BD) return null;
  try {
    const formats: string[] = typeof BD.getSupportedFormats === 'function' ? await BD.getSupportedFormats() : [];
    if (!Array.isArray(formats) || !formats.includes('qr_code')) return null;
    return new BD({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

function statusLabel(s?: string) {
  return String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function personLine(r: ScanResult): string {
  const p = r.person;
  if (!p) return '';
  if (r.kind === 'STAFF') return [p.employeeId, p.designation].filter(Boolean).join(' · ');
  const cls = [p.className, p.section].filter(Boolean).join(' ');
  return [cls, p.rollNumber ? `Roll ${p.rollNumber}` : '', p.admissionNumber].filter(Boolean).join(' · ');
}

export const IdCardScanModal: React.FC<Props> = ({ open, kind, onClose, onMarked }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [camera, setCamera] = useState<'starting' | 'on' | 'denied' | 'missing' | 'error'>('starting');
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [cameraId, setCameraId] = useState<string>(() => readSavedCamera());
  const [blank, setBlank] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [markLate, setMarkLate] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recent, setRecent] = useState<ScanResult[]>([]);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [feedback?.result.person?.id]);
  const markLateRef = useRef(markLate);
  markLateRef.current = markLate;
  // Keep callbacks in refs so the camera is not restarted when the parent re-renders.
  const onMarkedRef = useRef(onMarked);
  onMarkedRef.current = onMarked;

  const send = useCallback(
    async (code: string, opts: { status?: 'PRESENT' | 'LATE'; override?: boolean } = {}) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setSending(true);
      const status = opts.status || (markLateRef.current ? 'LATE' : 'PRESENT');
      const r = await submitAttendanceScan({ code, expect: kind, status, override: opts.override });
      busyRef.current = false;
      setSending(false);
      if (r.ok) {
        const name = r.person?.name || 'This person';
        const message = r.alreadyMarked
          ? `${name} is already marked ${statusLabel(r.status)} today.`
          : r.corrected
          ? `${name} changed from ${statusLabel(r.previousStatus)} to ${statusLabel(r.status)}.`
          : `${name} marked ${statusLabel(r.status)}${r.time ? ` at ${r.time}` : ''}.`;
        setFeedback({ tone: r.alreadyMarked ? 'info' : 'success', result: r, message });
        if (!r.alreadyMarked) setRecent((list) => [r, ...list.filter((x) => x.person?.id !== r.person?.id)].slice(0, 8));
        try {
          navigator.vibrate?.(r.alreadyMarked ? 40 : 90);
        } catch {
          /* vibration not supported */
        }
        onMarkedRef.current?.(r);
      } else if (r.code === 'CONFIRM_OVERRIDE') {
        setFeedback({ tone: 'confirm', result: r, message: r.error || 'Already marked today. Change it?', code, status });
      } else {
        setFeedback({ tone: 'error', result: r, message: r.error || 'Attendance could not be marked. Please try again.' });
      }
    },
    [kind]
  );

  const handleDecoded = useCallback(
    (code: string) => {
      const now = Date.now();
      if (!code || busyRef.current) return;
      if (code === lastRef.current.code && now - lastRef.current.at < REPEAT_WINDOW_MS) return;
      lastRef.current = { code, at: now };
      send(code);
    },
    [send]
  );
  const handleDecodedRef = useRef(handleDecoded);
  handleDecodedRef.current = handleDecoded;

  const frameRef = useRef(0);
  const decodeFrom = useCallback(async (source: HTMLVideoElement | HTMLImageElement, w: number, h: number): Promise<string> => {
    if (detectorRef.current) {
      try {
        const found = await detectorRef.current.detect(source);
        if (found && found[0]?.rawValue) return String(found[0].rawValue);
      } catch {
        detectorRef.current = null; // fall back to jsQR
      }
    }
    const canvas = canvasRef.current;
    if (!canvas || !w || !h) return '';
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';
    // Alternate between the whole picture and the centre square (where the frame is), so small
    // QR codes held far from a laptop camera are still read.
    const crop = frameRef.current++ % 2 === 1;
    const side = Math.min(w, h) * 0.7;
    const sx = crop ? (w - side) / 2 : 0;
    const sy = crop ? (h - side) / 2 : 0;
    const sw = crop ? side : w;
    const sh = crop ? side : h;
    const scale = Math.min(1, 800 / Math.max(sw, sh));
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
    return res?.data || '';
  }, []);

  /** True when the camera sends a flat picture (lens cover, disconnected virtual camera). */
  const isBlankFrame = useCallback((v: HTMLVideoElement): boolean => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(v, 0, 0, 32, 24);
    const d = ctx.getImageData(0, 0, 32, 24).data;
    let sum = 0;
    let sq = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += y;
      sq += y * y;
    }
    const mean = sum / n;
    return Math.sqrt(Math.max(0, sq / n - mean * mean)) < 6;
  }, []);

  // Start / stop the camera with the dialog, and again when another camera is chosen.
  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let flatFrames = 0;
    let ticks = 0;
    setFeedback(null);
    setCamera('starting');
    setBlank(false);
    lastRef.current = { code: '', at: 0 };

    const loop = async () => {
      if (stopped) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        if (ticks++ % 5 === 0) {
          flatFrames = isBlankFrame(v) ? flatFrames + 1 : 0;
          setBlank(flatFrames >= 3);
        }
        if (!busyRef.current) {
          const code = await decodeFrom(v, v.videoWidth, v.videoHeight);
          if (code && !stopped) handleDecodedRef.current(code);
        }
      }
      if (!stopped) timer = setTimeout(loop, 200);
    };

    const listCameras = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const vids = all.filter((d) => d.kind === 'videoinput');
        if (!stopped) setCameras(vids.map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` })));
      } catch {
        /* list not available */
      }
    };

    const withSize = { width: { ideal: 1280 }, height: { ideal: 720 } };
    /**
     * Tries the most specific request first and falls back step by step: some Windows camera
     * drivers refuse a requested size ("Could not start video source"), and a remembered camera
     * may be gone. Permission refusal is never retried.
     */
    const openStream = async (): Promise<MediaStream> => {
      const attempts: MediaStreamConstraints[] = [];
      if (cameraId) attempts.push({ video: { deviceId: { exact: cameraId }, ...withSize } }, { video: { deviceId: { exact: cameraId } } });
      attempts.push({ video: { facingMode: { ideal: 'environment' }, ...withSize } }, { video: true });
      let lastErr: any = null;
      const tryAll = async (list: MediaStreamConstraints[]) => {
        for (const c of list) {
          if (stopped) break;
          try {
            return await navigator.mediaDevices.getUserMedia({ ...c, audio: false });
          } catch (err: any) {
            lastErr = err;
            if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') throw err;
          }
        }
        return null;
      };
      const first = await tryAll(attempts);
      if (first) return first;
      // Last resort: every camera the browser knows about, one by one.
      try {
        const vids = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput' && d.deviceId);
        const other = await tryAll(vids.filter((d) => d.deviceId !== cameraId).map((d) => ({ video: { deviceId: { exact: d.deviceId } } })));
        if (other) return other;
      } catch (err: any) {
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') throw err;
      }
      throw lastErr || new Error('camera');
    };

    (async () => {
      setCameraError('');
      detectorRef.current = await createNativeDetector();
      if (stopped) return;
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamera('missing');
        return;
      }
      try {
        const stream = await openStream();
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setCamera('on');
        listCameras();
        loop();
      } catch (err: any) {
        if (stopped) return;
        const name = err?.name || '';
        setCameraError(name);
        setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'missing' : 'error');
        listCameras();
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, cameraId, attempt, decodeFrom, isBlankFrame]);

  const activeCameraId = (streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId as string | undefined) || cameraId;
  const chooseCamera = (id: string) => {
    saveCamera(id);
    setCameraId(id);
  };
  const nextCamera = () => {
    if (cameras.length < 2) return;
    const i = cameras.findIndex((c) => c.id === activeCameraId);
    chooseCamera(cameras[(i + 1) % cameras.length].id);
  };

  // Escape closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onPickImage = async (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('load'));
        img.src = url;
      });
      const code = await decodeFrom(img, img.naturalWidth, img.naturalHeight);
      if (code) {
        lastRef.current = { code: '', at: 0 };
        handleDecoded(code);
      } else {
        setFeedback({ tone: 'error', result: { ok: false, httpStatus: 0 }, message: 'No QR code was found in that photo. Take a clear, close photo of the card back.' });
      }
    } catch {
      setFeedback({ tone: 'error', result: { ok: false, httpStatus: 0 }, message: 'That photo could not be opened.' });
    } finally {
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!open) return null;

  const title = kind === 'STAFF' ? 'Scan staff ID card' : 'Scan student ID card';
  const fb = feedback;
  const person = fb?.result.person;
  const photo = person?.photo ? getFileContentUrl(person.photo) : '';

  const dialog = (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full sm:max-w-lg max-h-[100dvh] overflow-y-auto bg-white sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">Hold the QR code on the back of the card inside the frame. Today's attendance is marked.</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100" aria-label="Close scanner">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-900">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted aria-hidden="true" />
            {camera === 'on' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-[58%] aspect-square rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
              </div>
            )}
            {camera !== 'on' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-slate-200">
                {camera === 'starting' ? <Loader2 className="w-7 h-7 animate-spin" /> : <CameraOff className="w-7 h-7" />}
                <p className="text-sm">
                  {camera === 'starting'
                    ? 'Starting camera…'
                    : camera === 'denied'
                    ? 'Camera permission was refused. Click the camera icon in the address bar, choose Allow, then close and open the scanner again. You can also choose a photo of the card below.'
                    : camera === 'missing'
                    ? 'No camera was found (the camera needs an https page). Choose a photo of the card below.'
                    : null}
                </p>
                {camera === 'error' && (
                  <div className="max-w-sm text-left text-xs leading-5 text-slate-200">
                    <p className="text-sm text-center mb-2">The camera is blocked by this computer, so the browser cannot start it.</p>
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li>Close other tabs or apps that use the camera (another scanner tab, Zoom, Teams, Camera app).</li>
                      <li>Check the camera on/off key or the privacy shutter on the laptop.</li>
                      <li>
                        Windows: Settings → Privacy &amp; security → Camera → turn on <span className="font-semibold">Camera access</span> and{' '}
                        <span className="font-semibold">Let desktop apps access your camera</span>.
                      </li>
                    </ol>
                    {cameraError && <p className="mt-1 text-[11px] text-slate-400 text-center">Browser message: {cameraError}</p>}
                  </div>
                )}
                {camera !== 'starting' && (
                  <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="pointer-events-auto mt-1 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" /> Try again
                  </button>
                )}
              </div>
            )}
            {camera === 'on' && blank && (
              <div className="absolute inset-x-3 bottom-3 rounded-xl bg-white/95 px-3 py-2 text-xs leading-5 text-slate-800 shadow">
                This camera shows a blank picture. {cameras.length > 1 ? 'Choose another camera below, remove any lens cover, or close other apps that use the camera.' : 'Remove any lens cover, or close other apps that use the camera.'}
              </div>
            )}
            {sending && (
              <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Marking…
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {cameras.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="id-scan-camera" className="text-sm font-medium text-slate-700 shrink-0">
                Camera
              </label>
              <select
                id="id-scan-camera"
                value={cameras.some((c) => c.id === activeCameraId) ? activeCameraId : ''}
                onChange={(e) => chooseCamera(e.target.value)}
                className="min-w-0 flex-1 h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800"
              >
                {!cameras.some((c) => c.id === activeCameraId) && <option value="">Default camera</option>}
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={nextCamera}
                className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                aria-label="Switch to the next camera"
              >
                <SwitchCamera className="w-4 h-4" aria-hidden="true" /> Switch
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none min-h-[44px]">
              <input type="checkbox" className="w-4 h-4 accent-amber-600" checked={markLate} onChange={(e) => setMarkLate(e.target.checked)} />
              <Clock className="w-4 h-4 text-amber-600" aria-hidden="true" /> Mark as Late
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ImageUp className="w-4 h-4" aria-hidden="true" /> Use a photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0])} />
          </div>

          <div aria-live="polite">
            {fb && (
              <div
                className={`rounded-xl border p-3 flex gap-3 ${
                  fb.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50'
                    : fb.tone === 'info'
                    ? 'border-sky-200 bg-sky-50'
                    : fb.tone === 'confirm'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-rose-200 bg-rose-50'
                }`}
              >
                {person ? (
                  photo && !photoFailed ? (
                    <img src={photo} alt="" onError={() => setPhotoFailed(true)} className="w-12 h-12 rounded-full object-cover shrink-0 bg-slate-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full shrink-0 bg-white border border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                      {person.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                  )
                ) : fb.tone === 'error' ? (
                  <XCircle className="w-6 h-6 text-rose-600 shrink-0" aria-hidden="true" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    {fb.tone === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />}
                    {fb.tone === 'confirm' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />}
                    <span>{fb.message}</span>
                  </p>
                  {person && <p className="text-xs text-slate-600 mt-0.5">{personLine(fb.result)}</p>}
                  {fb.tone === 'confirm' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => send(fb.code, { status: fb.status, override: true })}
                        className="h-10 px-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
                      >
                        Change to {statusLabel(fb.status)}
                      </button>
                      <button type="button" onClick={() => setFeedback(null)} className="h-10 px-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-white">
                        Keep {statusLabel(fb.result.previousStatus)}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!fb && camera === 'on' && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <ScanLine className="w-4 h-4" aria-hidden="true" /> Waiting for a card…
              </p>
            )}
          </div>

          {recent.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Marked in this session</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {recent.map((r) => (
                  <li key={r.person?.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-800">{r.person?.name}</span>
                    <span className={`shrink-0 text-xs font-semibold ${r.status === 'LATE' ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {statusLabel(r.status)}
                      {r.time ? ` · ${r.time}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog;
};
