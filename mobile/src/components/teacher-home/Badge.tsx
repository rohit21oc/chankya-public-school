import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from './T';

interface BadgeProps {
  label: string;
  tone?: 'info' | 'gold';
}

/** Small status label ("Due", "3 classes"). */
export const Badge: React.FC<BadgeProps> = ({ label, tone = 'info' }) => (
  <View style={[styles.badge, tone === 'gold' ? styles.gold : styles.info]}>
    <T style={[styles.text, { color: tone === 'gold' ? TH.goldInk : TH.royal }]} numberOfLines={1}>
      {label}
    </T>
  </View>
);

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  info: { backgroundColor: TH.tile },
  gold: { backgroundColor: TH.goldSoft },
  text: { fontFamily: FONT.semibold, fontSize: 11 },
});
