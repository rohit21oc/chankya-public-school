import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LoginError, LoginField } from '../LoginFields';
import { BRAND_COLORS } from '../../utils/branding';
import { apiService } from '../../services/apiService';

/**
 * Self-service contact details. Only phone, alternate phone and address are sent;
 * employee ID, role, designation, salary and assignments cannot be changed here and
 * the server rejects them anyway.
 */
export const EditContactCard: React.FC<{ phone?: string; alternatePhone?: string; address?: string; onSaved?: () => void }> = ({ phone, alternatePhone, address, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ phone: phone || '', alternatePhone: alternatePhone || '', address: address || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const save = async () => {
    const p = v.phone.replace(/[\s-]/g, '');
    if (p && !/^(\+?91)?[6-9]\d{9}$/.test(p)) return setError('Enter a valid 10-digit mobile number.');
    setBusy(true);
    setError(null);
    const r = await apiService.request<any>('/api/auth/profile', 'PUT', { phone: v.phone.trim(), alternatePhone: v.alternatePhone.trim(), address: v.address.trim() }, { retries: 0 });
    setBusy(false);
    if (!r.ok || r.data?.success === false) return setError(r.data?.error || r.error || 'Could not save.');
    setOpen(false);
    setDone(true);
    onSaved?.();
  };

  return (
    <View style={s.card}>
      <Pressable onPress={() => { setOpen((o) => !o); setDone(false); }} style={s.head} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Contact details</Text>
          <Text style={s.sub}>{done ? 'Saved.' : 'Update your phone number and address'}</Text>
        </View>
        <Text style={s.toggle}>{open ? 'Close' : 'Edit'}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 10 }}>
          <LoginField label="Mobile number" value={v.phone} onChangeText={(t) => setV((x) => ({ ...x, phone: t }))} keyboardType="phone-pad" maxLength={14} editable={!busy} />
          <LoginField label="Alternate phone" value={v.alternatePhone} onChangeText={(t) => setV((x) => ({ ...x, alternatePhone: t }))} keyboardType="phone-pad" maxLength={15} editable={!busy} />
          <LoginField label="Address" value={v.address} onChangeText={(t) => setV((x) => ({ ...x, address: t }))} maxLength={300} editable={!busy} />
          <Text style={s.note}>Employee ID, designation, salary and class assignments are managed by the school office.</Text>
          <LoginError message={error} />
          <Pressable onPress={save} disabled={busy} style={[s.primary, busy && { opacity: 0.7 }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>Save</Text>}
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
  note: { fontSize: 12, color: BRAND_COLORS.textMuted, marginBottom: 6 },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: BRAND_COLORS.primaryRoyal, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
