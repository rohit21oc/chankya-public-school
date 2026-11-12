import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MobileModule } from '../types';
import { BRAND_COLORS } from '../utils/branding';
import { CountBadge } from './ui/CountBadge';

interface ModuleCardProps {
  module: MobileModule;
  titleOverride?: string;
  onPress: (module: MobileModule) => void;
  disabled?: boolean;
  variant?: 'list' | 'square' | 'grid';
  /** Unread / new count shown on the card (Messages, Notices). */
  badge?: number;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  module,
  titleOverride,
  onPress,
  disabled = false,
  variant = 'list',
  badge = 0,
}) => {
  const displayTitle = titleOverride || module.title;

  if (variant === 'square' || variant === 'grid') {
    return (
      <TouchableOpacity
        style={styles.squareCard}
        onPress={() => onPress(module)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {/* Blue Icon inside soft light-blue badge */}
        <View style={styles.squareIconBox}>
          <Text style={styles.squareIconEmoji}>{module.iconName || '📄'}</Text>
          <CountBadge count={badge} style={{ position: 'absolute', top: -6, right: -8 }} />
        </View>

        {/* Clean, readable module label */}
        <Text style={styles.squareTitle} numberOfLines={2} ellipsizeMode="tail">
          {displayTitle}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(module)}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        {/* Color Accent Indicator with Icon */}
        <View style={[styles.iconBox, { backgroundColor: module.color }]}>
          <Text style={styles.iconEmoji}>{module.iconName || '📄'}</Text>
          <CountBadge count={badge} style={{ position: 'absolute', top: -6, right: -8 }} />
        </View>

        {/* Action Indicator */}
        <View style={styles.arrowPill}>
          <Text style={styles.arrowText}>→</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {displayTitle}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {module.description}
      </Text>

      <View style={styles.footerRow}>
        <Text style={styles.tapPrompt}>Open Module</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Square 3-Column Grid Card
  squareCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 102,
  },
  squareIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  squareIconEmoji: {
    fontSize: 22,
    color: BRAND_COLORS.primaryRoyal,
  },
  squareTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 2,
  },

  // Classic List Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 20,
  },
  arrowPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    minHeight: 32,
  },
  footerRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  tapPrompt: {
    fontSize: 11,
    color: BRAND_COLORS.primaryBright,
    fontWeight: '600',
  },
});

