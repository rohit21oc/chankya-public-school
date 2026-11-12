import React, { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { CommsTabs } from '../components/CommsTabs';
import { T } from '../components/teacher-home/T';
import { FONT, TH } from '../theme/teacherHome';
import { ChatInbox } from '../components/comm/ChatInbox';
import { FeeDuesPanel } from '../components/comm/FeeDuesPanel';
import { EMERGENCY_ROLES, EmergencyPanel } from '../components/comm/EmergencyPanel';

/**
 * Messages module for staff: chats with parents (each staff member sees the
 * conversations addressed to them), for fee roles the Fee reminders list, and for
 * the Principal / admins an Emergency message to all parents, classes or students.
 */
interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
  /** Switches between Notices, Messages and Live Events. */
  onNavigateModule?: (moduleId: string) => void;
}

export const FEE_ALERT_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACCOUNTANT'];

export const MessagesScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile, onNavigateModule }) => {
  const mayFees = FEE_ALERT_ROLES.includes(user.role);
  const mayEmergency = EMERGENCY_ROLES.includes(user.role);
  const tabs = (['CHATS', ...(mayFees ? ['FEES'] : []), ...(mayEmergency ? ['EMERGENCY'] : [])] as Array<'CHATS' | 'FEES' | 'EMERGENCY'>);
  const [tab, setTab] = useState<'CHATS' | 'FEES' | 'EMERGENCY'>('CHATS');
  const [unread, setUnread] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openChat, setOpenChat] = useState<{ id: string; name?: string; photo?: string } | null>(null);

  return (
    <SafeAreaView style={s.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="Messages" subtitle={unread ? `${unread} unread` : 'Chat with parents'} />
      <CommsTabs user={user} active="messages" onNavigateModule={onNavigateModule} />
      {tabs.length > 1 && (
        <View style={s.tabs}>
          {tabs.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn, tab === t && t === 'EMERGENCY' && { borderBottomColor: '#B42318' }]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <T style={[s.tabText, tab === t && s.tabTextOn, t === 'EMERGENCY' && { color: '#B42318' }]}>{t === 'CHATS' ? 'Chats' : t === 'FEES' ? 'Fee reminders' : '🚨 Emergency'}</T>
              {t === 'CHATS' && unread > 0 && (
                <View style={s.badge}>
                  <T style={s.badgeText}>{unread > 99 ? '99+' : unread}</T>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => setRefreshKey((k) => k + 1)} />}>
        {tab === 'EMERGENCY' ? (
          <EmergencyPanel />
        ) : tab === 'CHATS' ? (
          <ChatInbox refreshKey={refreshKey} onUnreadChange={setUnread} openStudent={openChat} onOpenedStudent={() => setOpenChat(null)} />
        ) : (
          <FeeDuesPanel
            key={refreshKey}
            onOpenChat={(st) => {
              setOpenChat(st);
              setTab('CHATS');
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.bg },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  tab: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: TH.royal },
  tabText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.muted },
  tabTextOn: { color: TH.royal },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#D92D20', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, color: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
});
