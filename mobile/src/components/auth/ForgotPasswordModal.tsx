import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LoginError, LoginField } from '../LoginFields';
import { BRAND_COLORS } from '../../utils/branding';
import { apiService } from '../../services/apiService';

/**
 * Forgot password: sends a time-limited, single-use reset link to the account's
 * registered email. The link opens the school website, where the new password is
 * set. The answer is the same whether or not an account matches.
 */
export const ForgotPasswordModal: React.FC<{ visible: boolean; onClose: () => void; hint: string }> = ({ visible, onClose, hint }) => {
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setId('');
    setError(null);
    setDone(null);
    onClose();
  };

  const submit = async () => {
    if (!id.trim()) return setError('Enter your registered email or login ID.');
    setBusy(true);
    setError(null);
    const r = await apiService.forgotPassword(id);
    setBusy(false);
    if (r.ok) setDone(r.message || 'If an account matches, a reset link has been sent to its registered email.');
    else setError(r.error || 'Could not send the request. Please try again.');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={s.backdrop} behavior="padding">
        <View style={s.sheet}>
          <Text style={s.title}>Forgot password?</Text>
          {done ? (
            <>
              <View style={s.okBox}>
                <Text style={s.okText}>{done}</Text>
              </View>
              <Text style={s.sub}>The link works for 15 minutes and can be used once. Open it on this phone or a computer to set a new password.</Text>
              <Pressable onPress={close} style={s.primary} accessibilityRole="button">
                <Text style={s.primaryText}>Back to sign in</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.sub}>{hint}</Text>
              <LoginField label="Email or login ID" value={id} onChangeText={(t) => { setId(t); setError(null); }} placeholder="name@example.com" editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
              <LoginError message={error} />
              <Pressable onPress={submit} disabled={busy} style={[s.primary, busy && { opacity: 0.7 }]} accessibilityRole="button">
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>Send reset link</Text>}
              </Pressable>
              <Pressable onPress={close} style={s.link} accessibilityRole="button">
                <Text style={s.linkText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,75,0.55)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20 },
  title: { fontSize: 19, fontWeight: '800', color: BRAND_COLORS.primary, marginBottom: 6 },
  sub: { fontSize: 13, lineHeight: 19, color: BRAND_COLORS.textMuted, marginBottom: 14 },
  okBox: { backgroundColor: BRAND_COLORS.successLight, borderRadius: 12, padding: 12, marginBottom: 12 },
  okText: { fontSize: 14, lineHeight: 20, color: BRAND_COLORS.success, fontWeight: '600' },
  primary: { minHeight: 50, borderRadius: 14, backgroundColor: BRAND_COLORS.primaryRoyal, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  linkText: { color: BRAND_COLORS.primaryRoyal, fontSize: 14, fontWeight: '600' },
});
