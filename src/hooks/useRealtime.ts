import { useEffect, useState } from 'react';
import { RealtimeConnectionStatus, RealtimeEntityType, RealtimeEvent } from '../types/realtime';
import { realtimeService } from '../services/realtimeService';

/**
 * Hook to monitor live real-time connection status
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<RealtimeConnectionStatus>(() => realtimeService.getStatus());
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [activeClients, setActiveClients] = useState<number>(() => realtimeService.getActiveClientsCount());

  useEffect(() => {
    const unsubscribe = realtimeService.subscribeStatus((newStatus, event) => {
      setStatus(newStatus);
      if (event) setLastEvent(event);
      setActiveClients(realtimeService.getActiveClientsCount());
    });
    return unsubscribe;
  }, []);

  return {
    status,
    isConnected: status === 'CONNECTED',
    isPollingFallback: status === 'FALLBACK_POLLING',
    isConnecting: status === 'CONNECTING',
    lastEvent,
    activeClients,
  };
}

/**
 * Hook to subscribe to real-time events for one or more entity types
 */
export function useRealtimeListener(
  entityType: RealtimeEntityType | RealtimeEntityType[] | 'ALL',
  callback: (event: RealtimeEvent) => void
) {
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe(entityType, callback);
    return unsubscribe;
  }, [Array.isArray(entityType) ? entityType.join(',') : entityType, callback]);
}
