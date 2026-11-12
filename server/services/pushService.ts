/**
 * Push notifications: phone (Expo push, Android) and browser (Web Push / VAPID).
 *
 * This file holds the rules and the delivery loop. It knows nothing about the school data: the caller says
 * WHO may receive a push with a filter over the registered devices, so the same access rules the app already
 * uses (a parent sees only their own child's chat, notices follow the notice audience...) decide the recipients.
 *
 * Nothing here ever throws into a request: a failed push must never fail the message / notice that caused it.
 */

export type PushKind = 'EXPO' | 'FCM' | 'WEB';

export interface WebSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushDevice {
  /** Stable key: the Expo token itself, or the browser endpoint. */
  key: string;
  kind: PushKind;
  userId: string;
  role: string;
  /** Students this login may hear about (parents: linked children, students: themselves). */
  studentIds: string[];
  /** Chat identity of a staff login (see staffIdentity in engagementRoutes). */
  staffId?: string;
  /** Phone token: Expo token (EXPO) or Firebase device token (FCM) */
  token?: string;
  /** Browser subscription (WEB) */
  subscription?: WebSubscription;
  platform?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** App screen / page this opens when tapped. */
  type: 'MESSAGE' | 'NOTICE' | 'FEE_DUE' | 'HOMEWORK' | 'TEST' | 'ENQUIRY' | 'CALLBACK' | 'HOSTEL';
  /** Small, non-sensitive routing data only (ids). */
  data?: Record<string, string>;
  /** Web page to open when a browser notification is clicked. */
  url?: string;
  /** Notification category on the phone: shows action buttons (e.g. 'fee_due' has "Pay now"). */
  category?: string;
}

export interface PushTransport {
  /** Returns the keys of devices that are permanently gone (uninstalled / token revoked). */
  sendExpo(devices: PushDevice[], payload: PushPayload): Promise<string[]>;
  /** Direct Firebase Cloud Messaging (no Expo account needed). */
  sendFcm(devices: PushDevice[], payload: PushPayload): Promise<string[]>;
  sendWeb(devices: PushDevice[], payload: PushPayload): Promise<string[]>;
}

export interface PushStore {
  all(): PushDevice[];
  upsert(device: PushDevice): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

const EXPO_TOKEN_RE = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_\-]{10,60}\]$/;

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && EXPO_TOKEN_RE.test(value);
}

const FCM_TOKEN_RE = /^[A-Za-z0-9_\-:.]{40,400}$/;

/** A Firebase device token is a long opaque string (letters, digits, '_', '-', ':'). */
export function isFcmToken(value: unknown): value is string {
  return typeof value === 'string' && FCM_TOKEN_RE.test(value);
}

export function parseWebSubscription(value: unknown): WebSubscription | null {
  const v = value as any;
  if (!v || typeof v !== 'object') return null;
  const endpoint = typeof v.endpoint === 'string' ? v.endpoint.trim() : '';
  const p256dh = typeof v.keys?.p256dh === 'string' ? v.keys.p256dh.trim() : '';
  const auth = typeof v.keys?.auth === 'string' ? v.keys.auth.trim() : '';
  if (!endpoint || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  // The server will POST to this address, so it must be a real HTTPS push service, never an internal host.
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) return null;
  return { endpoint, keys: { p256dh, auth } };
}

const clean = (s: unknown, max: number): string =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Keeps a push short and plain: titles and bodies show on a lock screen. */
export function tidyPayload(p: PushPayload): PushPayload {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.data || {})) {
    if (v !== undefined && v !== null) data[clean(k, 40)] = clean(v, 200);
  }
  const body = clean(p.body, 160);
  return {
    type: p.type,
    title: clean(p.title, 70) || 'School update',
    body: body.length === 160 ? `${body.slice(0, 157)}...` : body,
    data,
    category: p.category && /^[a-z_]{1,30}$/.test(p.category) ? p.category : undefined,
    url: p.url && p.url.startsWith('/') && !p.url.startsWith('//') ? clean(p.url, 200) : undefined,
  };
}

// ---------------------------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------------------------

export interface RegisterInput {
  kind: PushKind;
  userId: string;
  role: string;
  studentIds: string[];
  staffId?: string;
  platform?: string;
  expoToken?: unknown;
  fcmToken?: unknown;
  subscription?: unknown;
}

export class PushService {
  constructor(
    private readonly store: PushStore,
    private readonly transport: PushTransport,
    private readonly log: (msg: string) => void = () => {}
  ) {}

  /** Saves (or refreshes) one device of one login. The same device signing in as someone else moves to them. */
  async register(input: RegisterInput): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
    const now = new Date().toISOString();
    let key = '';
    let token: string | undefined;
    let subscription: WebSubscription | undefined;
    if (input.kind === 'EXPO') {
      if (!isExpoPushToken(input.expoToken)) return { ok: false, error: 'That is not a valid phone notification token.' };
      token = input.expoToken;
      key = token;
    } else if (input.kind === 'FCM') {
      if (!isFcmToken(input.fcmToken)) return { ok: false, error: 'That is not a valid phone notification token.' };
      token = input.fcmToken;
      key = token;
    } else {
      const sub = parseWebSubscription(input.subscription);
      if (!sub) return { ok: false, error: 'That is not a valid browser notification subscription.' };
      subscription = sub;
      key = sub.endpoint;
    }
    const existing = this.store.all().find((d) => d.key === key);
    await this.store.upsert({
      key,
      kind: input.kind,
      userId: input.userId,
      role: String(input.role || '').toUpperCase(),
      studentIds: Array.from(new Set((input.studentIds || []).filter(Boolean).map(String))).slice(0, 50),
      staffId: input.staffId || undefined,
      token,
      subscription,
      platform: clean(input.platform, 30) || undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    return { ok: true, key };
  }

  /** Signing out: this login no longer receives pushes on that device. Only the owner can remove it. */
  async unregister(userId: string, keys: string[]): Promise<number> {
    const mine = this.store.all().filter((d) => d.userId === userId && keys.includes(d.key));
    if (mine.length) await this.store.remove(mine.map((d) => d.key));
    return mine.length;
  }

  devicesFor(userId: string): PushDevice[] {
    return this.store.all().filter((d) => d.userId === userId);
  }

  /**
   * Sends one push to every registered device the filter accepts. Never throws.
   * `excludeUserId` keeps the sender from being pinged about their own message.
   */
  async notify(accept: (d: PushDevice) => boolean, payload: PushPayload, excludeUserId?: string): Promise<{ attempted: number; removed: number }> {
    try {
      const tidy = tidyPayload(payload);
      const targets = this.store.all().filter((d) => d.userId !== excludeUserId && accept(d));
      if (!targets.length) return { attempted: 0, removed: 0 };
      const expo = targets.filter((d) => d.kind === 'EXPO');
      const fcm = targets.filter((d) => d.kind === 'FCM');
      const web = targets.filter((d) => d.kind === 'WEB');
      const gone: string[] = [];
      const [a, b, c] = await Promise.allSettled([
        expo.length ? this.transport.sendExpo(expo, tidy) : Promise.resolve([] as string[]),
        web.length ? this.transport.sendWeb(web, tidy) : Promise.resolve([] as string[]),
        fcm.length ? this.transport.sendFcm(fcm, tidy) : Promise.resolve([] as string[]),
      ]);
      if (a.status === 'fulfilled') gone.push(...a.value);
      else this.log(`[push] phone delivery error: ${(a.reason as any)?.message || a.reason}`);
      if (b.status === 'fulfilled') gone.push(...b.value);
      else this.log(`[push] browser delivery error: ${(b.reason as any)?.message || b.reason}`);
      if (c.status === 'fulfilled') gone.push(...c.value);
      else this.log(`[push] phone (Firebase) delivery error: ${(c.reason as any)?.message || c.reason}`);
      if (gone.length) await this.store.remove(gone);
      return { attempted: targets.length, removed: gone.length };
    } catch (e: any) {
      this.log(`[push] notify failed: ${e?.message || e}`);
      return { attempted: 0, removed: 0 };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Real transport (Expo push service + web-push)
// ---------------------------------------------------------------------------------------------

import { createSign } from 'node:crypto';

export const ANDROID_CHANNEL_ID = 'school-alerts';

export interface TransportConfig {
  expoAccessToken?: string;
  /** Firebase service-account JSON (the whole file contents, or base64 of it). */
  fcmServiceAccount?: string;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject?: string;
  fetchImpl?: typeof fetch;
}

export function readTransportConfig(env: NodeJS.ProcessEnv): TransportConfig {
  return {
    expoAccessToken: env.EXPO_ACCESS_TOKEN || undefined,
    fcmServiceAccount: env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_BASE64 || undefined,
    vapidPublicKey: env.VAPID_PUBLIC_KEY || undefined,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY || undefined,
    vapidSubject: env.VAPID_SUBJECT || undefined,
  };
}

export function isWebPushConfigured(cfg: TransportConfig): boolean {
  return !!(cfg.vapidPublicKey && cfg.vapidPrivateKey);
}

export interface FcmServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** Accepts the raw service-account JSON or its base64 (easier to keep in a one-line .env value). */
export function parseFcmServiceAccount(raw: string | undefined): FcmServiceAccount | null {
  if (!raw) return null;
  const text = raw.trim();
  const attempts = [text, (() => { try { return Buffer.from(text, 'base64').toString('utf8'); } catch { return ''; } })()];
  for (const t of attempts) {
    try {
      const j = JSON.parse(t);
      const privateKey = typeof j.private_key === 'string' ? j.private_key.replace(/\\n/g, '\n') : '';
      if (j.project_id && j.client_email && privateKey.includes('BEGIN PRIVATE KEY')) {
        return { projectId: String(j.project_id), clientEmail: String(j.client_email), privateKey };
      }
    } catch {
      // try the next form
    }
  }
  return null;
}

export function isFcmConfigured(cfg: TransportConfig): boolean {
  return !!parseFcmServiceAccount(cfg.fcmServiceAccount);
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Builds the signed request Google needs to hand out a short-lived access token (OAuth2 JWT bearer). */
export function buildFcmAssertion(sa: FcmServiceAccount, nowSec: number): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );
  const sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.privateKey);
  return `${head}.${claim}.${b64url(sig)}`;
}

export function createRealTransport(cfg: TransportConfig, log: (m: string) => void = () => {}): PushTransport {
  const doFetch = cfg.fetchImpl || fetch;
  const fcmAccount = parseFcmServiceAccount(cfg.fcmServiceAccount);
  let fcmToken: { value: string; expiresAt: number } | null = null;
  const fcmAccessToken = async (): Promise<string | null> => {
    if (!fcmAccount) return null;
    if (fcmToken && fcmToken.expiresAt - 60_000 > Date.now()) return fcmToken.value;
    const res = await doFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: buildFcmAssertion(fcmAccount, Math.floor(Date.now() / 1000)),
      }).toString(),
    });
    if (!res.ok) {
      log(`[push] Firebase sign-in answered ${res.status}`);
      return null;
    }
    const j: any = await res.json().catch(() => null);
    if (!j?.access_token) return null;
    fcmToken = { value: String(j.access_token), expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    return fcmToken.value;
  };
  let webpush: any = null;
  let webReady = false;

  return {
    async sendExpo(devices, payload) {
      const gone: string[] = [];
      for (let i = 0; i < devices.length; i += 100) {
        const chunk = devices.slice(i, i + 100);
        const messages = chunk.map((d) => ({
          to: d.token,
          title: payload.title,
          body: payload.body,
          data: { type: payload.type, ...(payload.data || {}) },
          sound: 'default',
          priority: 'high',
          channelId: ANDROID_CHANNEL_ID,
          ...(payload.category ? { categoryId: payload.category } : {}),
          ttl: 86400,
        }));
        const res = await doFetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(cfg.expoAccessToken ? { Authorization: `Bearer ${cfg.expoAccessToken}` } : {}),
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) {
          log(`[push] Expo push service answered ${res.status}`);
          continue;
        }
        const json: any = await res.json().catch(() => null);
        const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
        tickets.forEach((t, idx) => {
          if (t?.status === 'error') {
            if (t?.details?.error === 'DeviceNotRegistered') gone.push(chunk[idx].key);
            else log(`[push] Expo ticket error: ${t?.details?.error || t?.message || 'unknown'}`);
          }
        });
      }
      return gone;
    },

    async sendFcm(devices, payload) {
      if (!fcmAccount) {
        log('[push] Firebase is not set up on the server (FIREBASE_SERVICE_ACCOUNT_JSON missing); phone push skipped.');
        return [];
      }
      const access = await fcmAccessToken();
      if (!access) return [];
      const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(fcmAccount.projectId)}/messages:send`;
      const data: Record<string, string> = { type: payload.type, ...(payload.data || {}) };
      if (payload.category) data.category = payload.category;
      const gone: string[] = [];
      for (let i = 0; i < devices.length; i += 20) {
        await Promise.all(
          devices.slice(i, i + 20).map(async (d) => {
            try {
              const res = await doFetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: {
                    token: d.token,
                    notification: { title: payload.title, body: payload.body },
                    data,
                    android: { priority: 'HIGH', ttl: '86400s', notification: { channel_id: ANDROID_CHANNEL_ID, sound: 'default' } },
                  },
                }),
              });
              if (res.ok) return;
              const j: any = await res.json().catch(() => null);
              const status = j?.error?.status;
              const code = (j?.error?.details || []).find((x: any) => x?.errorCode)?.errorCode;
              // The token is dead for good (app uninstalled / data cleared). A bad request (INVALID_ARGUMENT) is
              // only treated as dead when Google says the registration token itself is invalid.
              if (status === 'NOT_FOUND' || code === 'UNREGISTERED' || (status === 'INVALID_ARGUMENT' && /registration token/i.test(j?.error?.message || ''))) gone.push(d.key);
              else log(`[push] Firebase push error ${res.status} ${status || ''}`);
            } catch (e: any) {
              log(`[push] Firebase push failed: ${e?.message || e}`);
            }
          })
        );
      }
      return gone;
    },

    async sendWeb(devices, payload) {
      if (!isWebPushConfigured(cfg)) return [];
      if (!webReady) {
        webpush = (await import('web-push')).default;
        webpush.setVapidDetails(cfg.vapidSubject || 'mailto:admin@example.com', cfg.vapidPublicKey!, cfg.vapidPrivateKey!);
        webReady = true;
      }
      const body = JSON.stringify({ title: payload.title, body: payload.body, type: payload.type, data: payload.data || {}, url: payload.url || '/' });
      const gone: string[] = [];
      await Promise.all(
        devices.map(async (d) => {
          try {
            await webpush.sendNotification(d.subscription, body, { TTL: 86400, urgency: 'high' });
          } catch (e: any) {
            if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(d.key);
            else log(`[push] browser push error ${e?.statusCode || ''}: ${e?.body || e?.message || e}`);
          }
        })
      );
      return gone;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Who gets a push: small reusable filters over the registered devices
// ---------------------------------------------------------------------------------------------

export const audience = {
  /** Parents and the student themselves, for one child. */
  familyOf: (studentId: string) => (d: PushDevice) => (d.role === 'PARENT' || d.role === 'STUDENT') && d.studentIds.includes(studentId),
  /** One staff member's own devices (chat identity). */
  staffMember: (staffId: string) => (d: PushDevice) => !!d.staffId && d.staffId === staffId,
  withRole: (isRole: (role: string) => boolean) => (d: PushDevice) => isRole(d.role),
};
