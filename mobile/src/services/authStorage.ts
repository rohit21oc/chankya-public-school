import { User } from '../types';

/**
 * Parses JWT token expiration safely without external libraries
 */
function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jsonStr =
      typeof atob === 'function'
        ? atob(base64)
        : typeof Buffer !== 'undefined'
        ? Buffer.from(base64, 'base64').toString('utf8')
        : null;

    if (!jsonStr) return null;
    const parsed = JSON.parse(jsonStr);
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Minimal async key-value store. */
interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const KEY_TOKEN = 'pds_mobile_token';
const KEY_USER = 'pds_mobile_user';
const KEY_CHILD = 'pds_mobile_active_student_id';

/**
 * Where the sign-in is kept between app launches.
 *  1. expo-secure-store (Android Keystore / iOS Keychain) - the phone app.
 *  2. localStorage - web preview and the node test scripts.
 *  3. nothing (memory only) when neither exists.
 * React Native has no localStorage, so before this the sign-in lived in memory only and every
 * app restart signed the user out.
 */
function resolveStore(): KeyValueStore | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require('expo-secure-store');
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      return {
        get: (k) => SecureStore.getItemAsync(k),
        set: (k, v) => SecureStore.setItemAsync(k, v),
        remove: (k) => SecureStore.deleteItemAsync(k),
      };
    }
  } catch {
    // not available (node tests, web) - fall through
  }
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      const ls = (globalThis as any).localStorage;
      return {
        get: async (k) => ls.getItem(k),
        set: async (k, v) => ls.setItem(k, v),
        remove: async (k) => ls.removeItem(k),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Mobile Storage Layer
 * Manages JWT tokens, user profiles, and session states.
 * Reads are synchronous (from memory); init() loads the saved sign-in once at app start and every
 * change is written through to the persistent store so the user stays signed in until the token
 * expires (30 days with "remember me") or they sign out.
 */
class AuthStorageService {
  private token: string | null = null;
  private user: User | null = null;
  private activeStudentId: string | null = null;
  private rememberMe = true;
  private store: KeyValueStore | null = null;
  private initPromise: Promise<void> | null = null;

  // In-memory key-value cache
  private memoryCache: Map<string, string> = new Map();

  constructor() {
    this.store = resolveStore();
    // Synchronous hydrate where the store is synchronous (web / node tests).
    this.hydrateFromLocalStorage();
  }

  private hydrateFromLocalStorage() {
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        const ls = (globalThis as any).localStorage;
        this.applyLoaded(ls.getItem(KEY_TOKEN), ls.getItem(KEY_USER), ls.getItem(KEY_CHILD));
      }
    } catch {}
  }

  /** Puts loaded values into memory unless the token is already expired. Returns true when a session was restored. */
  private applyLoaded(token: string | null, userJson: string | null, child: string | null): boolean {
    if (!token) return false;
    const exp = parseJwtExp(token);
    if (exp && Date.now() > exp) {
      void this.wipePersisted();
      return false;
    }
    let user: User | null = null;
    if (userJson) {
      try {
        user = JSON.parse(userJson);
      } catch {}
    }
    if (!user) return false;
    this.token = token;
    this.user = user;
    this.activeStudentId = child || null;
    this.memoryCache.set(KEY_TOKEN, token);
    this.memoryCache.set(KEY_USER, userJson as string);
    return true;
  }

  /** Loads the saved sign-in. Call once at app start and wait for it before deciding which screen to show. */
  public init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const store = this.store;
        if (!store || this.token) return;
        try {
          const [token, userJson, child] = await Promise.all([store.get(KEY_TOKEN), store.get(KEY_USER), store.get(KEY_CHILD)]);
          this.applyLoaded(token, userJson, child);
        } catch {
          // an unreadable store just means "not signed in"
        }
      })();
    }
    return this.initPromise;
  }

  private persist(key: string, value: string) {
    const store = this.store;
    if (!store) return Promise.resolve();
    return store.set(key, value).catch(() => undefined);
  }

  private async wipePersisted() {
    const store = this.store;
    if (!store) return;
    await Promise.all([store.remove(KEY_TOKEN), store.remove(KEY_USER), store.remove(KEY_CHILD)].map((p) => p.catch(() => undefined)));
  }

  public async setSession(token: string, user: User, rememberMe = true): Promise<void> {
    this.token = token;
    this.user = user;
    this.rememberMe = rememberMe;

    const userJson = JSON.stringify(user);
    this.memoryCache.set(KEY_TOKEN, token);
    this.memoryCache.set(KEY_USER, userJson);

    if (rememberMe) {
      await Promise.all([this.persist(KEY_TOKEN, token), this.persist(KEY_USER, userJson)]);
    } else {
      // Not remembered: make sure an older saved sign-in does not survive.
      await this.wipePersisted();
    }
  }

  public getToken(): string | null {
    const currentToken = this.token || this.memoryCache.get(KEY_TOKEN) || null;
    if (!currentToken) return null;

    // Verify token expiration
    const exp = parseJwtExp(currentToken);
    if (exp && Date.now() > exp) {
      void this.clearSession();
      return null;
    }

    return currentToken;
  }

  public getUser(): User | null {
    if (!this.getToken()) {
      return null;
    }
    if (!this.user) {
      const cached = this.memoryCache.get(KEY_USER);
      if (cached) {
        try {
          this.user = JSON.parse(cached);
        } catch {}
      }
    }
    return this.user;
  }

  public isTokenExpired(): boolean {
    const token = this.token || this.memoryCache.get(KEY_TOKEN);
    if (!token) return true;
    const exp = parseJwtExp(token);
    if (!exp) return false;
    return Date.now() > exp;
  }

  public updateUser(updates: Partial<User>): User | null {
    if (!this.user) return null;
    this.user = { ...this.user, ...updates };
    const userJson = JSON.stringify(this.user);
    this.memoryCache.set(KEY_USER, userJson);
    if (this.rememberMe) void this.persist(KEY_USER, userJson);
    return this.user;
  }

  public setActiveStudentId(id: string): void {
    this.activeStudentId = id;
    this.memoryCache.set(KEY_CHILD, id);
    if (this.user) {
      this.user.activeStudentId = id;
    }
    if (this.rememberMe) void this.persist(KEY_CHILD, id);
  }

  public getActiveStudentId(): string | null {
    return this.activeStudentId || this.user?.activeStudentId || this.user?.studentId || null;
  }

  public async clearSession(): Promise<void> {
    this.token = null;
    this.user = null;
    this.activeStudentId = null;
    this.memoryCache.clear();
    await this.wipePersisted();
  }

  public isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  }
}

export const authStorage = new AuthStorageService();
