/**
 * Guards for server-side fetches of user-supplied URLs (image proxy).
 * Only public http(s) hosts; private, loopback, link-local and metadata addresses are refused.
 * Checked by scripts/verify-url-safety.ts.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

export function isPrivateAddress(ip: string): boolean {
  const a = String(ip || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIPv4(a)) {
    const [p, q] = a.split('.').map(Number);
    return (
      p === 0 || p === 10 || p === 127 || (p === 100 && q >= 64 && q <= 127) || (p === 169 && q === 254) ||
      (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168) || (p === 192 && q === 0) || (p === 198 && (q === 18 || q === 19)) || p >= 224
    );
  }
  if (net.isIPv6(a)) {
    if (a === '::' || a === '::1') return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(a);
  }
  return true; // not an IP at all
}

/** URL shape check (no DNS). */
export function parsePublicHttpUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return null;
  if ((net.isIP(host.replace(/^\[|\]$/g, '')) && isPrivateAddress(host))) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  return u;
}

/** Full check including DNS: every address the host resolves to must be public. */
export async function isSafePublicUrl(raw: unknown, lookup = dns.lookup): Promise<boolean> {
  const u = parsePublicHttpUrl(raw);
  if (!u) return false;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return !isPrivateAddress(host);
  try {
    const addrs = (await lookup(host, { all: true })) as Array<{ address: string }>;
    return addrs.length > 0 && addrs.every((x) => !isPrivateAddress(x.address));
  } catch {
    return false;
  }
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
