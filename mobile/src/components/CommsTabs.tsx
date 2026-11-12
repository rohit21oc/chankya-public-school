import React, { useMemo } from 'react';
import { User } from '../types';
import { TabStrip } from './ui/TabStrip';
import { getAuthorizedModulesForUser } from '../utils/rbac';
import { useActivity } from '../services/activityStore';

export type CommsTabId = 'communication' | 'messages' | 'live-events';

const ALL_TABS: Array<{ id: CommsTabId; label: string }> = [
  { id: 'communication', label: 'Notices' },
  { id: 'messages', label: 'Messages' },
  { id: 'live-events', label: 'Live Events' },
];

interface CommsTabsProps {
  user: User;
  active: CommsTabId;
  onNavigateModule?: (moduleId: string) => void;
}

/**
 * Notices, Messages and Live Events as one "Notifications & Messages" area. Each tab opens the existing screen,
 * and only tabs the signed-in user is allowed to open are shown.
 */
export const CommsTabs: React.FC<CommsTabsProps> = ({ user, active, onNavigateModule }) => {
  const a = useActivity();
  const tabs = useMemo(() => {
    const allowed = new Set(getAuthorizedModulesForUser(user).map((m) => m.id));
    const badge: Record<string, number> = { communication: a.noticesNew, messages: a.messages };
    return ALL_TABS.filter((t) => allowed.has(t.id)).map((t) => ({ ...t, badge: badge[t.id] || 0 }));
  }, [user, a.noticesNew, a.messages]);
  if (!onNavigateModule || tabs.length < 2) return null;
  return <TabStrip tabs={tabs} active={active} onChange={(id) => id !== active && onNavigateModule(id)} />;
};
