import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SectionCard } from './SectionCard';
import { BRAND_COLORS } from '../../utils/branding';
import { NOT_RECORDED, ProfileSection } from '../../utils/profileSections';

/** Renders profile sections as label/value cards. */
export const ProfileSections: React.FC<{ sections: ProfileSection[] }> = ({ sections }) => (
  <>
    {sections.map((sec) => (
      <SectionCard key={sec.key} title={sec.title}>
        {sec.rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Text style={styles.label}>{r.label}</Text>
            <Text style={[styles.value, r.value === NOT_RECORDED && styles.muted]}>{r.value}</Text>
          </View>
        ))}
      </SectionCard>
    ))}
  </>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BRAND_COLORS.borderColor },
  label: { fontSize: 13, color: BRAND_COLORS.textMuted, flex: 1, paddingRight: 10 },
  value: { fontSize: 13, fontWeight: '600', color: BRAND_COLORS.textPrimary, flex: 1.4, textAlign: 'right' },
  muted: { color: BRAND_COLORS.textMuted, fontWeight: '400', fontStyle: 'italic' },
});
