import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KScrollView as ScrollView } from './ui/KScrollView';
import { T } from './teacher-home/T';
import { Icon, IconName } from './teacher-home/Icon';
import { FONT, TH } from '../theme/teacherHome';
import { PersonPhoto } from './comm/PersonPhoto';
import { clearBell, dismissBellItem, refreshActivity, useActivity } from '../services/activityStore';
import { openActivityTarget } from '../services/activityNav';
import { BellItem, badgeText } from '../utils/activityModel';

const RED = '#B42318';

const relTime = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(m)) return '';
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
};

const ICON: Record<BellItem['kind'], { name: IconName; color: string; bg: string }> = {
  MESSAGE: { name: 'message-circle', color: TH.royal, bg: '#EEF2FF' },
  FEE: { name: 'wallet', color: RED, bg: '#FEF3F2' },
  EMERGENCY: { name: 'circle-alert', color: RED, bg: '#FEF3F2' },
  NOTICE: { name: 'megaphone', color: '#B54708', bg: '#FFFAEB' },
  ENQUIRY: { name: 'graduation-cap', color: TH.royal, bg: '#EEF2FF' },
  CALLBACK: { name: 'users', color: RED, bg: '#FEF3F2' },
};

/**
 * Bell for the header: a badge with how many new things there are, and a list of them (new messages with
 * how many, notices, fee reminders with Pay now). "Clear" removes them from this list only; chats keep
 * their unread count and notices stay in Notices.
 */
export const NotificationBell: React.FC<{ tone?: 'light' | 'dark'; size?: number }> = ({ tone = 'light', size = 22 }) => {
  const [open, setOpen] = useState(false);
  const a = useActivity();
  const count = a.bell.length;
  const color = tone === 'light' ? '#FFFFFF' : TH.royal;
  const go = (it: BellItem) => {
    setOpen(false);
    dismissBellItem(it.id); // read: it leaves the list
    openActivityTarget(it.target);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
          void refreshActivity();
        }}
        style={[s.btn, tone === 'light' && s.btnLight]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `Notifications, ${count} new` : 'Notifications'}
      >
        <Icon name="bell" size={size} color={color} />
        {count > 0 && (
          <View style={s.badge}>
            <T style={s.badgeText}>{badgeText(count)}</T>
          </View>
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={s.safe}>
          <View style={s.head}>
            <Pressable onPress={() => setOpen(false)} style={s.close} accessibilityRole="button" accessibilityLabel="Close notifications">
              <Icon name="x" size={20} color={TH.navy} />
            </Pressable>
            <T style={s.title}>Notifications</T>
            {count > 0 && (
              <Pressable onPress={clearBell} style={s.clear} accessibilityRole="button" accessibilityLabel="Clear all notifications">
                <T style={s.clearText}>Clear all</T>
              </Pressable>
            )}
          </View>
          <ScrollView contentContainerStyle={s.body}>
            {count === 0 ? (
              <View style={s.empty}>
                <Icon name="bell" size={30} color={TH.muted} />
                <T style={s.emptyTitle}>You’re all caught up</T>
                <T style={s.emptySub}>New messages, notices and fee reminders will show here.</T>
              </View>
            ) : (
              <>
                {a.bell.map((it) => {
                  const ic = ICON[it.kind];
                  return (
                    <Pressable key={it.id} onPress={() => go(it)} style={[s.item, it.kind === 'EMERGENCY' && { borderColor: '#FECDCA' }]} accessibilityRole="button" accessibilityLabel={it.title}>
                      {it.photo ? <PersonPhoto name={it.title} photo={it.photo} size={42} /> : (
                        <View style={[s.iconBox, { backgroundColor: ic.bg }]}>
                          <Icon name={ic.name} size={20} color={ic.color} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T style={s.itemTitle} numberOfLines={2}>{it.title}</T>
                        {!!it.sub && <T style={[s.itemSub, it.kind === 'FEE' && { color: RED, fontFamily: FONT.semibold }]} numberOfLines={1}>{it.sub}</T>}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <T style={s.time}>{relTime(it.at)}</T>
                        {it.kind === 'FEE' && (
                          <View style={s.pay}>
                            <T style={s.payText}>Pay now</T>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                <T style={s.note}>Clear only removes these from the list. Your chats and notices stay where they are.</T>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const s = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  btnLight: { backgroundColor: 'rgba(255,255,255,0.12)', width: 40, height: 40, borderRadius: 10 },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, lineHeight: 13, color: '#FFFFFF' },
  safe: { flex: 1, backgroundColor: TH.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: FONT.bold, fontSize: 18, color: TH.navy },
  clear: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: TH.border },
  iconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  itemSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, marginTop: 2 },
  time: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  pay: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: RED },
  payText: { fontFamily: FONT.semibold, fontSize: 11, color: '#FFFFFF' },
  empty: { alignItems: 'center', gap: 8, paddingTop: 80 },
  emptyTitle: { fontFamily: FONT.semibold, fontSize: 16, color: TH.ink },
  emptySub: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted, textAlign: 'center', paddingHorizontal: 30 },
  note: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, textAlign: 'center', marginTop: 8 },
});
