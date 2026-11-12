import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { badgeText } from '../../utils/activityModel';

/** Small red count ("3", "99+"). Renders nothing for 0. Pass `style` to position it. */
export const CountBadge: React.FC<{ count: number; style?: StyleProp<ViewStyle> }> = ({ count, style }) => {
  if (!count || count < 1) return null;
  return (
    <View style={[s.badge, style]} accessible={false}>
      <Text style={s.text}>{badgeText(count)}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  badge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#B42318', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: '#FFFFFF' },
});
