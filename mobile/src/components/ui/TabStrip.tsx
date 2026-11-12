import React from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BRAND_COLORS } from '../../utils/branding';
import { CountBadge } from './CountBadge';

interface Props { tabs: Array<{ id: string; label: string; badge?: number }>; active: string; onChange: (id: string) => void }

/**
 * Horizontal tab strip.
 *
 * Why the wrapper View: a React Native ScrollView defaults to flexShrink: 1.
 * When it sits in a column above another ScrollView (the tab content), Yoga
 * shrinks the strip to make room and the labels get clipped ("Overview" only
 * half visible). The wrapper has flexShrink: 0 and a fixed minimum height, so
 * the strip always keeps its full size no matter how long the content is.
 */
export const TabStrip: React.FC<Props> = ({ tabs, active, onChange }) => (
  <View style={styles.wrap}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.content}>
      {tabs.map((t) => (
        <TouchableOpacity key={t.id} style={[styles.tab, active === t.id && styles.tabActive]} onPress={() => onChange(t.id)} activeOpacity={0.7} accessibilityRole="tab" accessibilityState={{ selected: active === t.id }}>
          <View style={styles.tabRow}>
            <Text style={[styles.text, active === t.id && styles.textActive]} numberOfLines={1}>{t.label}</Text>
            <CountBadge count={t.badge || 0} />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  wrap: { flexShrink: 0, flexGrow: 0, minHeight: 48, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: BRAND_COLORS.borderColor },
  strip: { flexGrow: 0, flexShrink: 0 },
  content: { paddingHorizontal: 12, alignItems: 'stretch' },
  tab: { minHeight: 47, justifyContent: 'center', paddingHorizontal: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: BRAND_COLORS.accentGold },
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: BRAND_COLORS.textMuted },
  textActive: { color: BRAND_COLORS.primary, fontWeight: '800' },
});
