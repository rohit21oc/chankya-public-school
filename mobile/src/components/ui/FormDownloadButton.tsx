import React, { useState } from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Linking } from 'react-native';
import { Icon } from '../teacher-home/Icon';
import { apiService } from '../../services/apiService';
import { BRAND_COLORS } from '../../utils/branding';

interface Props {
  kind: 'student' | 'staff';
  label: string;
}

/** Downloads the blank printable A4 form: the server makes a 5-minute link and the phone's browser saves the PDF. */
export const FormDownloadButton: React.FC<Props> = ({ kind, label }) => {
  const [busy, setBusy] = useState(false);
  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    const r = await apiService.getBlankFormUrl(kind);
    if (!r.ok || !r.url) {
      setBusy(false);
      Alert.alert('Form unavailable', r.error || 'Please try again.');
      return;
    }
    try {
      await Linking.openURL(r.url);
    } catch {
      Alert.alert('Could not open the form', 'No app on this phone could open the PDF download.');
    }
    setBusy(false);
  };
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} disabled={busy} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}>
      {busy ? <ActivityIndicator color={BRAND_COLORS.primaryRoyal} /> : <Icon name="file-text" size={18} color={BRAND_COLORS.primaryRoyal} />}
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_COLORS.primaryRoyal,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  text: { fontSize: 13, fontWeight: '700', color: BRAND_COLORS.primaryRoyal },
});
