import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { User } from '../types';
import { BRAND_COLORS, resolveFileUrl } from '../utils/branding';
import { formatRoleLabel } from '../utils/rbac';

interface UserProfileCardProps {
  user: User;
  onLogout: () => void;
  onRefreshSession?: () => void;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  onLogout,
  onRefreshSession,
}) => {
  const roleLabel = formatRoleLabel(user.role);
  const initials = (user.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const avatarUrl = user.avatar ? resolveFileUrl(user.avatar) : null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {/* Avatar / Initials */}
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Text style={styles.initialsText}>{initials}</Text>
          )}
        </View>

        {/* User Details */}
        <View style={styles.infoCol}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.name}
          </Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>

          <View style={styles.metaRow}>
            {user.employeeId && (
              <Text style={styles.metaText}>ID: {user.employeeId}</Text>
            )}
            {user.studentId && (
              <Text style={styles.metaText}>Adm: {user.username}</Text>
            )}
            {user.phone && (
              <Text style={styles.metaText}>📞 {user.phone}</Text>
            )}
          </View>
        </View>

        {/* Logout Action */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={onLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Session Status Footer */}
      <View style={styles.footerRow}>
        <View style={styles.statusDotRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Live Session Authenticated</Text>
        </View>
        {onRefreshSession && (
          <TouchableOpacity onPress={onRefreshSession} activeOpacity={0.6}>
            <Text style={styles.refreshLink}>Sync</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BRAND_COLORS.accentGold,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleBadge: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 3,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND_COLORS.primaryRoyal,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  metaText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  logoutButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991B1B',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: BRAND_COLORS.success,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
  },
  refreshLink: {
    fontSize: 11,
    color: BRAND_COLORS.primaryBright,
    fontWeight: '600',
  },
});
