import { apiFetch } from './apiConfig';

/**
 * Browser notifications (Web Push). The person opts in with a button; the server then pushes messages,
 * notices, homework and fee reminders to this browser, even when the site is closed.
 */
export type WebPushState = 'unsupported' | 'blocked' | 'off' | 'on' | 'unavailable';

export function webPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

async function serverConfig(): Promise<{ enabled: boolean; publicKey: string | null }> {
  try {
    const r = await apiFetch('/api/push/config');
    if (!r.ok) return { enabled: false, publicKey: null };
    const j = await r.json();
    return { enabled: !!j?.web?.enabled, publicKey: j?.web?.publicKey || null };
  } catch {
    return { enabled: false, publicKey: null };
  }
}

export async function getWebPushState(): Promise<WebPushState> {
  if (!webPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const cfg = await serverConfig();
  if (!cfg.enabled) return 'unavailable';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

async function sendSubscription(sub: PushSubscription): Promise<boolean> {
  const r = await apiFetch('/api/push/register', {
    method: 'POST',
    body: JSON.stringify({ kind: 'WEB', subscription: sub.toJSON(), platform: 'web' }),
  });
  return r.ok;
}

/** Must be called from a click: the browser only shows its permission prompt for a user action. */
export async function enableWebPush(): Promise<{ ok: boolean; message: string }> {
  if (!webPushSupported()) return { ok: false, message: 'This browser does not support notifications.' };
  const cfg = await serverConfig();
  if (!cfg.enabled || !cfg.publicKey) return { ok: false, message: 'Browser notifications are not set up on the school server yet.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, message: 'Notifications are blocked. Allow them for this site in the browser settings, then try again.' };
  }
  try {
    const reg = await registration();
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as unknown as BufferSource });
    }
    if (!(await sendSubscription(sub))) return { ok: false, message: 'The school server did not accept this browser. Please try again.' };
    return { ok: true, message: 'Notifications are on for this browser.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Could not turn notifications on.' };
  }
}

/** After sign-in: if this browser already agreed, tell the server who is signed in now (keeps recipients correct). */
export async function refreshWebPushRegistration(): Promise<void> {
  try {
    if (!webPushSupported() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sendSubscription(sub);
  } catch {
    // Not critical.
  }
}

/** Before sign-out: this browser stops getting the signed-in person's alerts. Never blocks sign-out. */
export async function unregisterWebPush(): Promise<void> {
  try {
    if (!webPushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await apiFetch('/api/push/unregister', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) });
  } catch {
    // Signing out must always work.
  }
}

export async function disableWebPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await unregisterWebPush();
    await sub.unsubscribe();
  } catch {
    // ignore
  }
}

export async function sendWebPushTest(): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await apiFetch('/api/push/test', { method: 'POST', body: '{}' });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, message: 'Test sent. It should appear in a few seconds.' } : { ok: false, message: j?.error || 'The test could not be sent.' };
  } catch {
    return { ok: false, message: 'The test could not be sent.' };
  }
}
