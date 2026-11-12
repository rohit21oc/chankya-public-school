import { RealtimeConnectionStatus, RealtimeEntityType, RealtimeEvent, RealtimePollResponse } from '../types/realtime';
import { getApiUrl } from './apiConfig';
import { api } from './api';

type StatusListener = (status: RealtimeConnectionStatus, lastEvent?: RealtimeEvent) => void;
type EventListener = (event: RealtimeEvent) => void;

class RealtimeService {
  private eventSource: EventSource | null = null;
  private status: RealtimeConnectionStatus = 'DISCONNECTED';
  private statusListeners: Set<StatusListener> = new Set();
  private eventListeners: Map<string, Set<EventListener>> = new Map();
  private wildcardListeners: Set<EventListener> = new Set();

  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  // Some hosts' proxies (e.g. MilesWeb over HTTP/3) cut long-lived event streams. Each failed attempt shows a red
  // "Failed to load resource" line in the browser console, so after a few quick failures the app stays on
  // polling and only tries the live stream again every few minutes.
  private quickFailures = 0;
  private readonly maxQuickFailures = 3;
  private readonly sseRetryAfterGiveUpMs = 5 * 60 * 1000;
  private sseOpenedAt = 0;
  private warnedFallback = false;
  private reconnectTimer: any = null;
  private pollingTimer: any = null;

  private lastEventTimestamp: string = new Date().toISOString();
  private processedEventIds: Set<string> = new Set();

  private isStarted = false;
  private activeClientsCount = 1;

  public getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  public getActiveClientsCount(): number {
    return this.activeClientsCount;
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public subscribe(
    entityType: RealtimeEntityType | RealtimeEntityType[] | 'ALL',
    listener: EventListener
  ): () => void {
    if (entityType === 'ALL') {
      this.wildcardListeners.add(listener);
      return () => {
        this.wildcardListeners.delete(listener);
      };
    }

    const types = Array.isArray(entityType) ? entityType : [entityType];
    types.forEach((type) => {
      if (!this.eventListeners.has(type)) {
        this.eventListeners.set(type, new Set());
      }
      this.eventListeners.get(type)!.add(listener);
    });

    return () => {
      types.forEach((type) => {
        this.eventListeners.get(type)?.delete(listener);
      });
    };
  }

  public start(): void {
    if (this.isStarted || typeof window === 'undefined') return;
    this.isStarted = true;
    this.connectSSE();
  }

  public stop(): void {
    this.isStarted = false;
    this.closeEventSource();
    this.stopPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setStatus('DISCONNECTED');
  }

  private setStatus(newStatus: RealtimeConnectionStatus, lastEvent?: RealtimeEvent): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus, lastEvent);
        } catch (e) {
          console.error('[RealtimeService] Status listener error:', e);
        }
      });
    }
  }

  private connectSSE(): void {
    this.closeEventSource();
    this.stopPolling();

    this.setStatus('CONNECTING');

    try {
      const currentUser = api.getCurrentUser?.();
      const queryParams = new URLSearchParams();
      if (currentUser?.id) queryParams.set('userId', currentUser.id);
      if (currentUser?.role) queryParams.set('role', currentUser.role);

      const sseUrl = getApiUrl(`/api/realtime/events?${queryParams.toString()}`);
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.sseOpenedAt = Date.now();
        this.reconnectAttempts = 0;
        this.setStatus('CONNECTED');
        this.stopPolling();
      };

      this.eventSource.onmessage = (e) => {
        try {
          if (!e.data || e.data.startsWith(':')) return;
          const event: RealtimeEvent = JSON.parse(e.data);
          this.handleIncomingEvent(event);
        } catch (err) {
          console.warn('[RealtimeService] SSE message parse error:', err);
        }
      };

      this.eventSource.onerror = () => {
        // A stream that stayed open for a while and was then closed by the proxy is normal: reconnect quietly.
        const livedLong = this.sseOpenedAt > 0 && Date.now() - this.sseOpenedAt > 30_000;
        this.sseOpenedAt = 0;
        this.quickFailures = livedLong ? 0 : this.quickFailures + 1;
        this.closeEventSource();

        // Polling keeps data live while the stream is down.
        this.startFallbackPolling();

        if (this.quickFailures >= this.maxQuickFailures) {
          if (!this.warnedFallback) {
            this.warnedFallback = true;
            console.info('[RealtimeService] Live stream is not available on this network; using polling for updates.');
          }
          this.scheduleSseReconnect(this.sseRetryAfterGiveUpMs);
          return;
        }
        this.scheduleSseReconnect();
      };
    } catch (err) {
      console.warn('[RealtimeService] Failed to initialize EventSource, using polling fallback:', err);
      this.startFallbackPolling();
      this.scheduleSseReconnect();
    }
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private scheduleSseReconnect(delayOverride?: number): void {
    if (!this.isStarted || this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = delayOverride ?? Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isStarted && this.status !== 'CONNECTED') {
        if (delayOverride) this.quickFailures = this.maxQuickFailures - 1; // one fresh try; a quick failure gives up again
        this.connectSSE();
      }
    }, delay);
  }

  private startFallbackPolling(): void {
    this.setStatus('FALLBACK_POLLING');
    if (this.pollingTimer) return;

    // Trigger immediate poll
    this.executePoll();

    // Poll every 3.5 seconds
    this.pollingTimer = setInterval(() => {
      this.executePoll();
    }, 3500);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async executePoll(): Promise<void> {
    try {
      const pollUrl = getApiUrl(`/api/realtime/poll?since=${encodeURIComponent(this.lastEventTimestamp)}`);
      const res = await fetch(pollUrl);
      if (!res.ok) return;
      const data: RealtimePollResponse = await res.json();
      if (data.success && Array.isArray(data.events) && data.events.length > 0) {
        data.events.forEach((evt) => {
          this.handleIncomingEvent(evt);
        });
      }
      if (data.currentTimestamp) {
        this.lastEventTimestamp = data.currentTimestamp;
      }
    } catch {
      // Background poll silently fails
    }
  }

  private handleIncomingEvent(event: RealtimeEvent): void {
    if (!event || !event.id) return;

    // Deduplicate events across SSE and polling fallback
    if (this.processedEventIds.has(event.id)) return;
    this.processedEventIds.add(event.id);

    // Keep set bounded to last 500 IDs
    if (this.processedEventIds.size > 500) {
      const [first] = this.processedEventIds;
      this.processedEventIds.delete(first);
    }

    if (event.timestamp) {
      this.lastEventTimestamp = event.timestamp;
    }

    if (event.data?.activeClients !== undefined) {
      this.activeClientsCount = event.data.activeClients;
    }

    // 1. Process in API service to update memory cache and fetch authoritative slice
    api.handleRealtimeEvent(event).catch((err) => {
      console.warn('[RealtimeService] Error handling event in api service:', err);
    });

    // 2. Notify subscribers
    const entityListeners = this.eventListeners.get(event.entity);
    if (entityListeners) {
      entityListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (e) {
          console.error('[RealtimeService] Listener error for entity ' + event.entity, e);
        }
      });
    }

    this.wildcardListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.error('[RealtimeService] Wildcard listener error', e);
      }
    });

    // 3. Notify status listeners of last event
    this.statusListeners.forEach((listener) => {
      try {
        listener(this.status, event);
      } catch (e) {
        console.error('[RealtimeService] Status listener error', e);
      }
    });
  }
}

export const realtimeService = new RealtimeService();
