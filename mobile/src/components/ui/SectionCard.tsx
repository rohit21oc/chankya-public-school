import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { BRAND_COLORS } from '../../utils/branding';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Rounded white card with an optional header row. Used for all dashboard sections. */
export const SectionCard: React.FC<SectionCardProps> = ({ title, subtitle, right, children, style }) => (
  <View style={[styles.card, style]}>
    {(!!title || !!right) && (
      <View style={styles.header}>
        <View style={styles.headerText}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {right}
      </View>
    )}
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND_COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND_COLORS.borderColor,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0B1F4B',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerText: { flex: 1, paddingRight: 8 },
  title: { fontSize: 16, fontWeight: '700', color: BRAND_COLORS.textPrimary },
  subtitle: { fontSize: 12, color: BRAND_COLORS.textMuted, marginTop: 2 },
});
