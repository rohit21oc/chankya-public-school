import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { getApiUrl, getAuthHeaders, getAuthToken } from './apiConfig';

/**
 * ID card QR codes.
 *
 * The server signs a short code for each card ("PDS1.S.<id>.<signature>") and only
 * gives it to people allowed to see that card. The code holds no personal data.
 * Cards on screen ask for their code here; requests made in the same moment (for
 * example a bulk print of 40 cards) are sent to the server as one batch.
 *
 * Codes are cached per signed-in session, so a different user in the same tab
 * never reuses another user's codes.
 */
export type IdCardKind = 'STUDENT' | 'STAFF';

const tokenCache = new Map<string, Promise<string | null>>();
let queue: { key: string; kind: IdCardKind; id: string; resolve: (t: string | null) => void }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let cacheOwner = '';

function sessionKey(): string {
  const token = getAuthToken() || '';
  return token ? token.slice(-24) : '';
}

async function flush() {
  flushTimer = null;
  const batch = queue;
  queue = [];
  for (let i = 0; i < batch.length; i += 200) {
    const chunk = batch.slice(i, i + 200);
    let tokens: Record<string, string> = {};
    try {
      const res = await fetch(getApiUrl('/api/id-cards/qr-tokens'), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: chunk.map(({ kind, id }) => ({ kind, id })) }),
      });
      if (res.ok) tokens = (await res.json())?.tokens || {};
    } catch {
      tokens = {};
    }
    for (const item of chunk) {
      const t = tokens[`${item.kind}:${item.id}`];
      if (!t) tokenCache.delete(item.key); // allow a retry later (for example after reconnecting)
      item.resolve(t || null);
    }
  }
}

export function getIdCardQrToken(kind: IdCardKind, id: string): Promise<string | null> {
  const owner = sessionKey();
  if (!owner || !id) return Promise.resolve(null);
  if (owner !== cacheOwner) {
    tokenCache.clear();
    cacheOwner = owner;
  }
  const key = `${owner}|${kind}:${id}`;
  const cached = tokenCache.get(key);
  if (cached) return cached;
  const p = new Promise<string | null>((resolve) => {
    queue.push({ key, kind, id, resolve });
    if (!flushTimer) flushTimer = setTimeout(flush, 0);
  });
  tokenCache.set(key, p);
  return p;
}

export function clearIdCardQrCache(): void {
  tokenCache.clear();
}

export type IdCardQrState = { status: 'loading' | 'ready' | 'unavailable'; dataUrl: string };

/** QR image (data URL) for a card, or 'unavailable' when the server gives no code. */
export function useIdCardQr(kind: IdCardKind, id: string | undefined): IdCardQrState {
  const [state, setState] = useState<IdCardQrState>({ status: 'loading', dataUrl: '' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', dataUrl: '' });
    if (!id) {
      setState({ status: 'unavailable', dataUrl: '' });
      return;
    }
    getIdCardQrToken(kind, id)
      .then((token) =>
        token
          ? QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 1, width: 280, color: { dark: '#0B1F4B', light: '#FFFFFF' } })
          : ''
      )
      .then((url) => {
        if (alive) setState(url ? { status: 'ready', dataUrl: url } : { status: 'unavailable', dataUrl: '' });
      })
      .catch(() => {
        if (alive) setState({ status: 'unavailable', dataUrl: '' });
      });
    return () => {
      alive = false;
    };
  }, [kind, id]);
  return state;
}

// ---------------------------------------------------------------------------
// Scan to mark attendance
// ---------------------------------------------------------------------------

export interface ScanPerson {
  id: string;
  name: string;
  photo?: string;
  admissionNumber?: string;
  className?: string;
  section?: string;
  rollNumber?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
}

export interface ScanResult {
  ok: boolean;
  httpStatus: number;
  code?: string; // error code from the server, e.g. NOT_YOUR_CLASS, CONFIRM_OVERRIDE
  error?: string;
  kind?: IdCardKind;
  person?: ScanPerson;
  status?: string;
  date?: string;
  time?: string;
  alreadyMarked?: boolean;
  corrected?: boolean;
  previousStatus?: string;
}

export async function submitAttendanceScan(input: {
  code: string;
  expect?: IdCardKind;
  status?: 'PRESENT' | 'LATE';
  override?: boolean;
}): Promise<ScanResult> {
  try {
    const res = await fetch(getApiUrl('/api/attendance/scan'), {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    let json: any = {};
    try {
      json = await res.json();
    } catch {
      json = {};
    }
    return {
      ok: res.ok && json?.success === true,
      httpStatus: res.status,
      code: json?.code,
      error: res.status === 401 ? 'Your session has expired. Please sign in again.' : json?.error,
      kind: json?.kind,
      person: json?.person,
      status: json?.status,
      date: json?.date,
      time: json?.time || json?.checkInTime,
      alreadyMarked: json?.alreadyMarked === true,
      corrected: json?.corrected === true,
      previousStatus: json?.previousStatus,
    };
  } catch {
    return { ok: false, httpStatus: 0, code: 'NETWORK', error: 'Could not reach the school server. Check the connection and scan again.' };
  }
}
