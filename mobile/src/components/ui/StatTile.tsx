import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BRAND_COLORS } from '../../utils/branding';

interface StatTileProps {
  label: string;
  value: number | string;
  tone?: 'default' | 'success' | 'warning';
}

/** Compact metric tile. Values must always come from backend data. */
export const StatTile: React.FC<StatTileProps> = ({ label, value, tone = 'default' }) => {
  const valueColor =
    tone === 'success' ? BRAND_COLORS.success : tone === 'warning' ? BRAND_COLORS.warning : BRAND_COLORS.primaryRoyal;
  return (
    <View style={styles.tile} accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: BRAND_COLORS.surfaceSoft,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND_COLORS.borderColor,
  },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 12, color: BRAND_COLORS.textSecondary, marginTop: 2 },
});
