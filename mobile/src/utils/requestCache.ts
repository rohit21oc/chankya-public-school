/**
 * Short-lived cache with in-flight de-duplication for read-only reference data.
 * - Concurrent callers share one request.
 * - Results are reused for `ttlMs`, but only for the same key (the auth token), so one
 *   user's data is never served to another session.
 * - Failed results are never cached and drop any older entry (fail closed).
 * - `force` skips the cache so pull-to-refresh always asks the server.
 */
export class SingleFlightCache<T> {
  private entry: { key: string; at: number; value: T } | null = null;
  private inflight: { key: string; promise: Promise<T> } | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly isCacheable: (value: T) => boolean = () => true,
    private readonly now: () => number = Date.now
  ) {}

  async get(key: string, load: () => Promise<T>, force = false): Promise<{ value: T; fromCache: boolean }> {
    if (!force && this.entry && this.entry.key === key && this.now() - this.entry.at < this.ttlMs) {
      return { value: this.entry.value, fromCache: true };
    }
    if (!force && this.inflight && this.inflight.key === key) {
      return { value: await this.inflight.promise, fromCache: false };
    }

    const promise = load();
    this.inflight = { key, promise };
    try {
      const value = await promise;
      if (this.inflight && this.inflight.promise === promise) {
        this.entry = this.isCacheable(value) ? { key, at: this.now(), value } : null;
      }
      return { value, fromCache: false };
    } finally {
      if (this.inflight && this.inflight.promise === promise) this.inflight = null;
    }
  }

  clear() {
    this.entry = null;
    this.inflight = null;
  }
}
