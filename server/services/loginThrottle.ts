/**
 * Brute-force protection for the login API (web and mobile share one endpoint).
 *
 * Only FAILED sign-ins count towards a lock, so a school full of parents behind one Wi-Fi can still log in,
 * and a correct sign-in clears that person's own counter. Cooldowns double each time a lock repeats.
 *
 *   account + IP : 5 failures / 15 min  -> 1 min cooldown, doubling up to 15 min
 *   one IP       : 30 failures / 15 min -> 5 min cooldown, doubling up to 30 min   (guessing many accounts)
 *   one account  : 20 failures / 15 min -> 5 min cooldown, doubling up to 30 min   (guessing from many IPs)
 *   flood        : 120 requests / min from one IP -> 30 s pause                    (scripted hammering)
 */
interface Entry {
  fails: number;
  first: number;
  strikes: number;
  blockedUntil: number;
  seen: number;
}

interface Rule {
  max: number;
  windowMs: number;
  baseMs: number;
  capMs: number;
}

const STRIKE_MEMORY_MS = 60 * 60 * 1000;

class Tracker {
  private map = new Map<string, Entry>();
  constructor(private rule: Rule) {}

  blockedFor(key: string, now: number): number {
    const e = this.map.get(key);
    return e && e.blockedUntil > now ? Math.ceil((e.blockedUntil - now) / 1000) : 0;
  }

  fail(key: string, now: number): void {
    let e = this.map.get(key);
    if (!e || now - e.seen > STRIKE_MEMORY_MS) {
      e = { fails: 0, first: now, strikes: 0, blockedUntil: 0, seen: now };
      this.map.set(key, e);
    }
    if (now - e.first > this.rule.windowMs) {
      e.fails = 0;
      e.first = now;
    }
    e.seen = now;
    e.fails++;
    if (e.fails >= this.rule.max) {
      e.strikes++;
      e.fails = 0;
      e.first = now;
      e.blockedUntil = now + Math.min(this.rule.baseMs * 2 ** (e.strikes - 1), this.rule.capMs);
    }
    if (this.map.size > 20000) this.sweep(now);
  }

  clear(key: string): void {
    this.map.delete(key);
  }

  sweep(now: number): void {
    for (const [k, e] of this.map) if (now - e.seen > STRIKE_MEMORY_MS && e.blockedUntil < now) this.map.delete(k);
  }
}

import type { NextFunction, Request, Response } from 'express';

export type ThrottleVerdict = { blocked: false } | { blocked: true; retryAfterSec: number; message: string };

const fmtWait = (sec: number) => (sec >= 90 ? `${Math.ceil(sec / 60)} minutes` : `${sec} second${sec === 1 ? '' : 's'}`);

export class LoginThrottle {
  private acct = new Tracker({ max: 5, windowMs: 15 * 60000, baseMs: 60000, capMs: 15 * 60000 });
  private ip = new Tracker({ max: 30, windowMs: 15 * 60000, baseMs: 5 * 60000, capMs: 30 * 60000 });
  private who = new Tracker({ max: 20, windowMs: 15 * 60000, baseMs: 5 * 60000, capMs: 30 * 60000 });
  private flood = new Tracker({ max: 120, windowMs: 60000, baseMs: 30000, capMs: 30000 });

  /** Call before checking the password. Does not count anything by itself, except the request-rate flood guard. */
  check(ip: string, id: string, now = Date.now()): ThrottleVerdict {
    this.flood.fail(ip, now);
    const a = this.acct.blockedFor(`${id}|${ip}`, now);
    if (a) return { blocked: true, retryAfterSec: a, message: `Too many incorrect attempts. Please wait ${fmtWait(a)} and try again.` };
    const w = this.who.blockedFor(id, now);
    if (w) return { blocked: true, retryAfterSec: w, message: `This account is temporarily locked after repeated incorrect attempts. Please wait ${fmtWait(w)} and try again.` };
    const i = this.ip.blockedFor(ip, now);
    if (i) return { blocked: true, retryAfterSec: i, message: `Too many incorrect attempts from this network. Please wait ${fmtWait(i)} and try again.` };
    const f = this.flood.blockedFor(ip, now);
    if (f) return { blocked: true, retryAfterSec: f, message: `Too many requests. Please wait ${fmtWait(f)} and try again.` };
    return { blocked: false };
  }

  recordFailure(ip: string, id: string, now = Date.now()): void {
    this.acct.fail(`${id}|${ip}`, now);
    this.who.fail(id, now);
    this.ip.fail(ip, now);
  }

  recordSuccess(ip: string, id: string): void {
    this.acct.clear(`${id}|${ip}`);
    this.who.clear(id);
  }
}

/** Client address as seen by the nearest proxy (last X-Forwarded-For hop), so a caller cannot dodge limits by inventing earlier hops. */
export function clientAddress(req: Request): string {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : req.socket.remoteAddress || '127.0.0.1';
}

/** The account a sign-in is aimed at: a 10-digit phone is compared by its digits, anything else lower-cased. */
export function loginIdentity(body: any): string {
  const raw = String(body?.identifier || body?.username || body?.email || '').trim().toLowerCase();
  const digits = raw.replace(/\D/g, '');
  const phone = digits.length > 10 ? digits.slice(-10) : digits;
  return phone.length === 10 && /^[\d\s+()-]+$/.test(raw) ? phone : raw;
}

/** Express middleware: blocks a locked-out caller before any password check, then counts wrong sign-ins and clears on a good one. */
export function createLoginGuard(throttle: LoginThrottle) {
  return function loginThrottleGuard(req: Request, res: Response, next: NextFunction) {
    const id = loginIdentity(req.body);
    const ip = clientAddress(req);
    const verdict = throttle.check(ip, id || '-');
    if (verdict.blocked) {
      res.setHeader('Retry-After', String(verdict.retryAfterSec));
      return res.status(429).json({ success: false, code: 'LOGIN_RATE_LIMITED', retryAfterSeconds: verdict.retryAfterSec, error: verdict.message });
    }
    if (id) {
      res.on('finish', () => {
        if (res.statusCode === 200) throttle.recordSuccess(ip, id);
        else if ([400, 401, 403, 404].includes(res.statusCode)) throttle.recordFailure(ip, id);
      });
    }
    next();
  };
}
