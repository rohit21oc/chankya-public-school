import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { BRAND_COLORS, SCHOOL_INFO, resolveFileUrl } from '../utils/branding';
import { User } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { NotificationBell } from './NotificationBell';
import { NOT_CONFIGURED, affiliationLine, useSchoolIdentity } from '../services/schoolIdentity';

interface SchoolHeaderProps {
  user?: User;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const SchoolHeader: React.FC<SchoolHeaderProps> = ({
  user,
  onOpenMenu,
  onOpenProfile,
  onLogout,
  onOpenNotifications,
  unreadCount = 0,
  showBack = false,
  onBack,
  title,
  subtitle,
  compact = false,
}) => {
  const sid = useSchoolIdentity();
  const avatarUri = user?.avatar ? resolveFileUrl(user.avatar) : null;
  const initials = (user?.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogoutPress = () => {
    if (!onLogout) return;
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out from Residential PDS Public School Sheohar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      {/* Left: Back button or Drawer Hamburger Menu or School Crest */}
      <View style={styles.leftAction}>
        {showBack && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
        )}
        {onOpenMenu ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onOpenMenu}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        ) : null}
        {/* The crest is always shown, including next to the menu / back button on staff screens. */}
        <SchoolLogo size={34} />
      </View>

      {/* Center: School Branding or Screen Title */}
      <View style={styles.centerCol}>
        {title ? (
          <>
            <Text style={styles.screenTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.screenSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.brandTitle} numberOfLines={1} ellipsizeMode="tail">
              {sid.name}
            </Text>
            {!!affiliationLine(sid) && (
              <Text style={styles.brandSubtitle} numberOfLines={1}>
                {affiliationLine(sid)}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Right: Notification, Logout, or Profile Avatar */}
      <View style={styles.rightAction}>
        {!!user && !onOpenNotifications && <NotificationBell tone="light" size={20} />}
        {onOpenNotifications && (
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onOpenNotifications}
            activeOpacity={0.7}
            accessibilityLabel="School notifications"
          >
            <Text style={styles.headerIconEmoji}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.notificationDot}>
                <Text style={styles.notificationDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {onLogout && (
          <TouchableOpacity
            style={[styles.headerIconButton, styles.logoutButton]}
            onPress={handleLogoutPress}
            activeOpacity={0.7}
            accessibilityLabel="Log out from campus app"
          >
            <Text style={styles.logoutIcon}>🚪</Text>
          </TouchableOpacity>
        )}

        {!onLogout && onOpenProfile && (
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={onOpenProfile}
            activeOpacity={0.8}
            accessibilityLabel="Open user profile"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  headerCompact: {
    paddingVertical: 6,
  },
  leftAction: {
    minWidth: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 22,
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 26,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  brandSubtitle: {
    color: BRAND_COLORS.accentGoldLight,
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1,
    textAlign: 'center',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  screenSubtitle: {
    color: BRAND_COLORS.accentGoldLight,
    fontSize: 9.5,
    marginTop: 1,
    textAlign: 'center',
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    minWidth: 36,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerIconEmoji: {
    fontSize: 16,
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: BRAND_COLORS.primary,
  },
  notificationDotText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  logoutIcon: {
    fontSize: 16,
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: BRAND_COLORS.accentGold,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: BRAND_COLORS.primaryRoyal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
});
