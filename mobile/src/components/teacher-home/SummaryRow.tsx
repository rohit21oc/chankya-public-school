import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import type { SummaryCardData } from '../../utils/teacherHomeModel';
import { T } from './T';

/** Four compact metric cards. Values come from the backend's quickStats. */
export const SummaryRow: React.FC<{ cards: SummaryCardData[] }> = ({ cards }) => (
  <View style={styles.row}>
    {cards.map((c) => (
      <View key={c.id} style={styles.card} accessible accessibilityLabel={`${c.label}: ${c.value}`}>
        <T style={styles.value} numberOfLines={1}>
          {c.value}
        </T>
        <T style={styles.label} numberOfLines={2}>
          {c.label}
        </T>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1,
    gap: 4,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TH.border,
    backgroundColor: TH.surface,
  },
  value: { fontFamily: FONT.heading, fontSize: 24, lineHeight: 33.6, color: TH.ink },
  label: { fontFamily: FONT.regular, fontSize: 9, lineHeight: 12.6, color: TH.muted },
});
