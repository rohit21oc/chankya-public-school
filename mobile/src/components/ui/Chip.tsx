import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BRAND_COLORS } from '../../utils/branding';

interface Props { label: string; active?: boolean; onPress: () => void }

export const Chip: React.FC<Props> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityState={{ selected: !!active }}
  >
    <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BRAND_COLORS.borderColor, marginRight: 8 },
  chipActive: { backgroundColor: BRAND_COLORS.primaryRoyal, borderColor: BRAND_COLORS.primaryRoyal },
  text: { fontSize: 13, fontWeight: '600', color: BRAND_COLORS.textSecondary },
  textActive: { color: '#FFFFFF' },
});
