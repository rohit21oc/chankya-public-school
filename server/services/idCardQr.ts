import crypto from 'crypto';

/**
 * Signed QR codes for student and staff ID cards.
 *
 * The QR holds only a card type, the record id and a signature:
 *   CPS1.<S|T>.<base64url(record id)>.<signature>
 * No name, date of birth, phone number or address is inside it, so a photo of a
 * card leaks nothing. The signature is an HMAC made with a server-only secret, so
 * a QR cannot be typed up or edited to mark someone else's attendance.
 *
 * The secret comes from ID_CARD_QR_SECRET. If that is not set it is derived from
 * the JWT signing secret. Changing either one makes every printed card's QR
 * invalid, so set ID_CARD_QR_SECRET once in production and keep it.
 */

export type IdCardKind = 'STUDENT' | 'STAFF';

const PREFIX = 'CPS1';
const KIND_CODE: Record<IdCardKind, string> = { STUDENT: 'S', STAFF: 'T' };
const CODE_KIND: Record<string, IdCardKind> = { S: 'STUDENT', T: 'STAFF' };
const SIG_LENGTH = 22; // 128 bits of base64url

let qrKey: Buffer | null = null;

export function configureIdCardQrSecret(opts: { qrSecret?: string; jwtSecret: string }): void {
  const explicit = String(opts.qrSecret || '').trim();
  qrKey = explicit
    ? crypto.createHash('sha256').update(explicit).digest()
    : crypto.createHmac('sha256', opts.jwtSecret).update('id-card-qr-v1').digest();
}

function key(): Buffer {
  if (!qrKey) throw new Error('ID card QR secret is not configured.');
  return qrKey;
}

function sign(body: string): string {
  return crypto.createHmac('sha256', key()).update(body).digest('base64url').slice(0, SIG_LENGTH);
}

export function createIdCardQrToken(kind: IdCardKind, recordId: string): string {
  const id = String(recordId || '').trim();
  if (!id) throw new Error('A record id is required for an ID card QR.');
  const body = `${PREFIX}.${KIND_CODE[kind]}.${Buffer.from(id, 'utf8').toString('base64url')}`;
  return `${body}.${sign(body)}`;
}

export type ParsedIdCardQr =
  | { ok: true; kind: IdCardKind; id: string }
  | { ok: false; reason: 'LEGACY_CARD' | 'NOT_A_SCHOOL_CARD' | 'BAD_SIGNATURE' };

/** Recognises QR codes printed by the old card design (plain JSON with no signature). */
export function isLegacyCardPayload(raw: string): boolean {
  const s = raw.trim();
  return s.startsWith('{') && /VERIFIED_STUDENT_ID|OFFICIAL_STAFF_ID/.test(s);
}

export function parseIdCardQrToken(raw: unknown): ParsedIdCardQr {
  const code = typeof raw === 'string' ? raw.trim() : '';
  if (!code || code.length > 512) return { ok: false, reason: 'NOT_A_SCHOOL_CARD' };
  if (isLegacyCardPayload(code)) return { ok: false, reason: 'LEGACY_CARD' };

  const parts = code.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX || !CODE_KIND[parts[1]] || !/^[A-Za-z0-9_-]+$/.test(parts[2])) {
    return { ok: false, reason: 'NOT_A_SCHOOL_CARD' };
  }
  const body = parts.slice(0, 3).join('.');
  const given = Buffer.from(parts[3], 'utf8');
  const expected = Buffer.from(sign(body), 'utf8');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'BAD_SIGNATURE' };
  }
  const id = Buffer.from(parts[2], 'base64url').toString('utf8').trim();
  if (!id) return { ok: false, reason: 'NOT_A_SCHOOL_CARD' };
  return { ok: true, kind: CODE_KIND[parts[1]], id };
}

/** Current date (YYYY-MM-DD) and time (hh:mm AM) in India, used for scan records. */
export function indiaNow(now: Date = new Date()): { date: string; time: string } {
  const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const time = now
    .toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
    .toUpperCase();
  return { date, time };
}
