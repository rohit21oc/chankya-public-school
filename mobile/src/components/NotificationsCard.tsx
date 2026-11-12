import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND_COLORS } from '../utils/branding';
import { getPushPermission, registerDeviceForPush, type PushPermission } from '../services/pushNotifications';

/** Profile card: shows whether this phone gets school notifications, and turns them on. */
export const NotificationsCard: React.FC = () => {
  const [perm, setPerm] = useState<PushPermission>('undetermined');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getPushPermission().then(setPerm);
  }, []);
  useEffect(refresh, [refresh]);

  const turnOn = async () => {
    setBusy(true);
    setNote(null);
    if (perm === 'denied') {
      setBusy(false);
      await Linking.openSettings();
      return;
    }
    const r = await registerDeviceForPush({ askPermission: true });
    setBusy(false);
    refresh();
    setNote('message' in r ? r.message : 'Notifications are on for this phone.');
  };

  const on = perm === 'granted';
  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Notifications</Text>
          <Text style={s.sub}>
            {on ? 'On: messages, notices, homework and fee reminders reach this phone.' : perm === 'denied' ? 'Off in the phone settings.' : 'Get messages and notices on your phone, with a sound.'}
          </Text>
        </View>
        {busy ? <ActivityIndicator color={BRAND_COLORS.primary} /> : null}
      </View>
      <View style={s.row}>
        {!on ? (
          <Pressable style={s.btn} onPress={turnOn} disabled={busy} accessibilityRole="button">
            <Text style={s.btnText}>{perm === 'denied' ? 'Open settings' : 'Turn on'}</Text>
          </Pressable>
        ) : null}
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
};

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', color: '#101828' },
  sub: { fontSize: 12, color: '#667085', marginTop: 2 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { minHeight: 40, paddingHorizontal: 16, borderRadius: 10, backgroundColor: BRAND_COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  note: { fontSize: 12, color: '#344054' },
});
