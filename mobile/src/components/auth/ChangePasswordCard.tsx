import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LoginError, LoginField } from '../LoginFields';
import { BRAND_COLORS } from '../../utils/branding';
import { apiService } from '../../services/apiService';
import { PASSWORD_RULE_TEXT, validateNewPassword } from '../../utils/passwordPolicy';

/**
 * Change password for the signed-in person. The server checks the current
 * password, the strength rule, limits wrong attempts and signs out other devices.
 */
export const ChangePasswordCard: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  };

  const submit = async () => {
    if (!current) return setError('Enter your current password.');
    const policy = validateNewPassword(next);
    if (policy) return setError(policy);
    if (next !== confirm) return setError('The new passwords do not match.');
    if (next === current) return setError('The new password must be different from the current one.');
    setBusy(true);
    const r = await apiService.changePassword(current, next);
    setBusy(false);
    if (!r.ok) return setError(r.error || 'The password could not be changed.');
    reset();
    setOpen(false);
    setDone(true);
  };

  return (
    <View style={s.card}>
      <Pressable onPress={() => { setOpen((o) => !o); setDone(false); reset(); }} style={s.head} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Password</Text>
          <Text style={s.sub}>{done ? 'Password changed. Other devices were signed out.' : 'Change the password you use to sign in'}</Text>
        </View>
        <Text style={s.toggle}>{open ? 'Close' : 'Change'}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 10 }}>
          <LoginField label="Current password" value={current} onChangeText={(t) => { setCurrent(t); setError(null); }} secure editable={!busy} returnKeyType="next" />
          <LoginField label="New password" value={next} onChangeText={(t) => { setNext(t); setError(null); }} secure editable={!busy} returnKeyType="next" />
          <LoginField label="Confirm new password" value={confirm} onChangeText={(t) => { setConfirm(t); setError(null); }} secure editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
          <Text style={s.rule}>{PASSWORD_RULE_TEXT}</Text>
          <LoginError message={error} />
          <Pressable onPress={submit} disabled={busy} style={[s.primary, busy && { opacity: 0.7 }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>Update password</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BRAND_COLORS.borderColor, padding: 14, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  title: { fontSize: 15, fontWeight: '800', color: BRAND_COLORS.textPrimary },
  sub: { fontSize: 12, color: BRAND_COLORS.textMuted, marginTop: 2 },
  toggle: { fontSize: 14, fontWeight: '700', color: BRAND_COLORS.primaryRoyal },
  rule: { fontSize: 12, color: BRAND_COLORS.textMuted, marginBottom: 6 },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: BRAND_COLORS.primaryRoyal, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
