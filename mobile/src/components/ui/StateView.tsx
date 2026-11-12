import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { BRAND_COLORS } from '../../utils/branding';

interface StateViewProps {
  variant: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Shared loading / empty / error presentation for data-backed screens.
 * Every data screen should use this rather than ad-hoc text so states look consistent.
 */
export const StateView: React.FC<StateViewProps> = ({
  variant,
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
}) => {
  const isError = variant === 'error';
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      {variant === 'loading' ? (
        <ActivityIndicator size="large" color={BRAND_COLORS.primaryBright} />
      ) : (
        <View style={[styles.badge, isError ? styles.badgeError : styles.badgeEmpty]}>
          <Text style={[styles.badgeText, { color: isError ? BRAND_COLORS.error : BRAND_COLORS.textMuted }]}>
            {isError ? '!' : '—'}
          </Text>
        </View>
      )}
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!message && <Text style={styles.message}>{message}</Text>}
      {isError && !!onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.8}
          accessibilityLabel={retryLabel}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeError: { backgroundColor: BRAND_COLORS.errorLight },
  badgeEmpty: { backgroundColor: BRAND_COLORS.surfaceSoft },
  badgeText: { fontSize: 18, fontWeight: '700' },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: BRAND_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: BRAND_COLORS.primaryBright,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
