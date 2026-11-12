import type { Express, Request, Response } from 'express';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { PushDeviceModel } from '../models/PushDevice.ts';
import {
  PushService,
  createRealTransport,
  isWebPushConfigured,
  readTransportConfig,
  type PushDevice,
  type PushStore,
  type PushTransport,
  type TransportConfig,
} from '../services/pushService.ts';

/**
 * Device registration for push notifications. MongoDB is the source of truth when it is connected; devices
 * are also kept in memory so sending is fast. Without MONGODB_URI (local preview) they live in memory only.
 */
export class DeviceStore implements PushStore {
  private items: PushDevice[] = [];
  private loaded = false;

  /** Loads saved devices once the database is connected. Safe to call often. */
  async ready(): Promise<void> {
    if (this.loaded || mongoose.connection.readyState !== 1) return;
    try {
      const docs = await PushDeviceModel.find().lean();
      const fromDb = docs.map(({ _id, __v, ...rest }: any) => rest as PushDevice);
      const known = new Set(fromDb.map((d) => d.key));
      this.items = [...fromDb, ...this.items.filter((d) => !known.has(d.key))];
      this.loaded = true;
    } catch (err: any) {
      console.warn('[Push] could not load devices, using memory:', err?.message);
    }
  }

  all(): PushDevice[] {
    return this.items;
  }

  async upsert(device: PushDevice): Promise<void> {
    const i = this.items.findIndex((d) => d.key === device.key);
    if (i === -1) this.items.push(device);
    else this.items[i] = device;
    if (mongoose.connection.readyState === 1) {
      try {
        await PushDeviceModel.updateOne({ key: device.key }, { $set: device }, { upsert: true });
      } catch (err: any) {
        console.warn('[Push] could not save device:', err?.message);
      }
    }
  }

  async remove(keys: string[]): Promise<void> {
    if (!keys.length) return;
    const gone = new Set(keys);
    this.items = this.items.filter((d) => !gone.has(d.key));
    if (mongoose.connection.readyState === 1) {
      try {
        await PushDeviceModel.deleteMany({ key: { $in: keys } });
      } catch (err: any) {
        console.warn('[Push] could not remove devices:', err?.message);
      }
    }
  }
}

type Auth = { user: any; session: any };

export interface PushRouteDeps {
  getAuthContext: (req: Request) => Auth;
  /** Which children / chat identity this login stands for (parents: linked children). */
  identityFor: (a: Auth) => { studentIds: string[]; staffId?: string };
  env?: NodeJS.ProcessEnv;
  transport?: PushTransport;
}

/**
 * Test aid: with PUSH_RECORD_FILE set, pushes are appended to that file (one JSON line per device) instead of
 * being sent, so a test can see exactly who would have been notified. Never set in production.
 */
function recordingTransport(file: string): PushTransport {
  const write = (devices: PushDevice[], payload: unknown) => {
    for (const d of devices) fs.appendFileSync(file, `${JSON.stringify({ key: d.key, kind: d.kind, userId: d.userId, payload })}\n`);
    return [] as string[];
  };
  return { sendExpo: async (devices, payload) => write(devices, payload), sendFcm: async (devices, payload) => write(devices, payload), sendWeb: async (devices, payload) => write(devices, payload) };
}

export function createPush(deps: { env?: NodeJS.ProcessEnv; transport?: PushTransport } = {}) {
  const env = deps.env || process.env;
  const store = new DeviceStore();
  const config: TransportConfig = readTransportConfig(env);
  const transport =
    deps.transport || (env.PUSH_RECORD_FILE ? recordingTransport(env.PUSH_RECORD_FILE) : createRealTransport(config, (m) => console.warn(m)));
  const service = new PushService(store, transport, (m) => console.warn(m));
  return { store, service, config };
}

export function registerPushRoutes(app: Express, push: ReturnType<typeof createPush>, d: PushRouteDeps) {
  const { store, service, config } = push;
  const lastTest = new Map<string, number>();

  const auth = (req: Request, res: Response): Auth | null => {
    const a = d.getAuthContext(req);
    if (!a.user || !a.session) {
      res.status(401).json({ success: false, error: 'Please sign in again.' });
      return null;
    }
    return a;
  };
  const roleOf = (a: Auth) => String(a.session.role || a.user.role || '').toUpperCase();

  app.get('/api/push/config', async (req, res) => {
    if (!auth(req, res)) return;
    res.json({
      success: true,
      phone: { enabled: true },
      web: { enabled: isWebPushConfigured(config), publicKey: isWebPushConfigured(config) ? config.vapidPublicKey : null },
    });
  });

  app.get('/api/push/status', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    await store.ready();
    const mine = service.devicesFor(a.user.id);
    res.json({ success: true, phone: mine.filter((x) => x.kind === 'EXPO' || x.kind === 'FCM').length, web: mine.filter((x) => x.kind === 'WEB').length });
  });

  app.post('/api/push/register', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    await store.ready();
    const kind = String(req.body?.kind || '').toUpperCase();
    if (kind !== 'EXPO' && kind !== 'FCM' && kind !== 'WEB') return res.status(400).json({ success: false, error: 'Unknown notification type.' });
    if (kind === 'WEB' && !isWebPushConfigured(config)) {
      return res.status(503).json({ success: false, error: 'Browser notifications are not set up on the server yet (VAPID keys missing).' });
    }
    const id = d.identityFor(a);
    const r = await service.register({
      kind,
      userId: a.user.id,
      role: roleOf(a),
      studentIds: id.studentIds,
      staffId: id.staffId,
      platform: String(req.body?.platform || ''),
      expoToken: req.body?.expoToken,
      fcmToken: req.body?.fcmToken,
      subscription: req.body?.subscription,
    });
    if ('error' in r) return res.status(400).json({ success: false, error: r.error });
    res.json({ success: true });
  });

  app.post('/api/push/unregister', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    await store.ready();
    const keys = [req.body?.expoToken, req.body?.fcmToken, req.body?.endpoint].filter((k) => typeof k === 'string' && k) as string[];
    const removed = keys.length ? await service.unregister(a.user.id, keys) : 0;
    res.json({ success: true, removed });
  });

  /** "Send me a test": proves the whole path to the person's own devices. */
  app.post('/api/push/test', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    await store.ready();
    const now = Date.now();
    if (now - (lastTest.get(a.user.id) || 0) < 8000) {
      return res.status(429).json({ success: false, error: 'Please wait a few seconds before sending another test.' });
    }
    lastTest.set(a.user.id, now);
    const mine = service.devicesFor(a.user.id);
    if (!mine.length) {
      return res.status(409).json({ success: false, error: 'No device on this account has notifications turned on yet.' });
    }
    const r = await service.notify((x) => x.userId === a.user.id, {
      type: 'TEST',
      title: 'Notifications are working',
      body: 'You will get school messages, notices and fee reminders here.',
      url: '/',
    });
    res.json({ success: true, devices: r.attempted });
  });
}
