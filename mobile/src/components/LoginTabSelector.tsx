import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { BRAND_COLORS } from '../utils/branding';
import { LoginTabType } from '../types';

interface Props {
  activeTab: LoginTabType;
  onSelectTab: (tab: LoginTabType) => void;
  disabled?: boolean;
}

const TABS: Array<{ id: LoginTabType; title: string }> = [
  { id: 'staff', title: 'Admin / Staff' },
  { id: 'student', title: 'Student' },
  { id: 'parent', title: 'Parent' },
];

/** Segmented control with a pill that slides to the selected tab. */
export const LoginTabSelector: React.FC<Props> = ({ activeTab, onSelectTab, disabled = false }) => {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, TABS.findIndex((t) => t.id === activeTab));
  const pos = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.timing(pos, { toValue: index, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
  }, [index, pos]);

  const seg = width > 0 ? (width - 8) / TABS.length : 0;
  return (
    <View style={styles.track} onLayout={(e: any) => setWidth(e.nativeEvent.layout.width)}>
      {seg > 0 && (
        <Animated.View
          style={[styles.pill, { width: seg, transform: [{ translateX: pos.interpolate({ inputRange: [0, TABS.length - 1], outputRange: [0, seg * (TABS.length - 1)] }) }] }]}
        />
      )}
      {TABS.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={styles.tab}
          onPress={() => onSelectTab(t.id)}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: t.id === activeTab }}
        >
          <Text style={[styles.tabText, t.id === activeTab && styles.tabTextActive]} numberOfLines={1}>{t.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: '#EEF2F6', borderRadius: 14, padding: 4, marginBottom: 20 },
  pill: { position: 'absolute', top: 4, left: 4, bottom: 4, backgroundColor: '#FFFFFF', borderRadius: 11, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#667085' },
  tabTextActive: { color: BRAND_COLORS.primary, fontWeight: '700' },
});
