import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from './T';
import { Icon, IconName } from './Icon';
import { CountBadge } from '../ui/CountBadge';

export interface QuickActionItem {
  id: string;
  /** Two-line label as designed, e.g. "Mark\nAttendance". */
  label: string;
  icon: IconName;
  /** New / unread count on the tile. */
  badge?: number;
  onPress: () => void;
}

/** Row of icon shortcuts. Only actions the user may open should be passed in. */
export const QuickActions: React.FC<{ actions: QuickActionItem[] }> = ({ actions }) => (
  <View style={styles.row}>
    {actions.map((a) => (
      <TouchableOpacity
        key={a.id}
        style={styles.action}
        onPress={a.onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={a.label.replace('\n', ' ')}
      >
        <View style={styles.tile}>
          <Icon name={a.icon} size={22} color={TH.royal} />
          <CountBadge count={a.badge || 0} style={{ position: 'absolute', top: -5, right: -5 }} />
        </View>
        <T style={styles.label}>{a.label}</T>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  action: { width: '25%', alignItems: 'center', gap: 8 },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: TH.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: FONT.semibold, fontSize: 10, lineHeight: 14, color: TH.navy, textAlign: 'center' },
});
