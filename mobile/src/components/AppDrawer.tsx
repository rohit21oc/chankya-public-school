import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, MobileModule } from '../types';
import { BRAND_COLORS, SCHOOL_INFO, resolveFileUrl } from '../utils/branding';
import { getDrawerModulesForUser, getModuleTitleForUser, formatRoleLabel } from '../utils/rbac';
import { NOT_CONFIGURED, affiliationLine, useSchoolIdentity } from '../services/schoolIdentity';
import { CountBadge } from './ui/CountBadge';
import { useActivity } from '../services/activityStore';

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  user: User;
  currentScreenId: string;
  onNavigate: (moduleId: string) => void;
  onLogout: () => void;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  visible,
  onClose,
  user,
  currentScreenId,
  onNavigate,
  onLogout,
}) => {
  const sid = useSchoolIdentity();
  const activity = useActivity();
  const avatarUri = user.avatar ? resolveFileUrl(user.avatar) : null;
  const roleName = formatRoleLabel(user.role);
  const authorizedModules = getDrawerModulesForUser(user);

  const initials = (user.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleItemPress = (moduleId: string) => {
    onClose();
    onNavigate(moduleId);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop touch to close */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Drawer Content */}
        <SafeAreaView style={styles.drawerContainer}>
          <View style={styles.drawerInner}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.headerTop}>
                <View style={styles.schoolBadge}>
                  <Image source={require('../../assets/school-logo.png')} style={styles.schoolLogo} resizeMode="contain" />
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                  accessibilityLabel="Close navigation"
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.schoolName}>{sid.name}</Text>
              {!!affiliationLine(sid) && <Text style={styles.affiliation}>{affiliationLine(sid)}</Text>}

              {/* User Profile Summary */}
              <View style={styles.userCard}>
                <View style={styles.avatarBox}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                  ) : (
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>{roleName}</Text>
                  </View>
                  {user.employeeId && (
                    <Text style={styles.userSubId}>Emp ID: {user.employeeId}</Text>
                  )}
                  {user.studentId && (
                    <Text style={styles.userSubId}>Adm No: {user.username}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Navigation Modules List */}
            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionHeading}>CAMPUS MODULES</Text>

              {authorizedModules.map((module) => {
                const isActive = currentScreenId === module.id;
                const title = getModuleTitleForUser(module, user);

                return (
                  <TouchableOpacity
                    key={module.id}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => handleItemPress(module.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={title}
                    accessibilityState={{ selected: isActive }}
                  >
                    <View
                      style={[
                        styles.menuIconBox,
                        { backgroundColor: isActive ? BRAND_COLORS.accentGold : 'rgba(255,255,255,0.08)' },
                      ]}
                    >
                      <Text style={styles.menuEmoji}>{module.iconName}</Text>
                    </View>
                    <View style={styles.menuTextCol}>
                      <Text
                        style={[
                          styles.menuTitle,
                          isActive && styles.menuTitleActive,
                        ]}
                        numberOfLines={1}
                      >
                        {title}
                      </Text>
                    </View>
                    <CountBadge count={module.id === 'messages' ? activity.messages : module.id === 'communication' ? activity.noticesNew : 0} />
                    {isActive && (
                      <View style={styles.activeDot} />
                    )}
                  </TouchableOpacity>
                );
              })}

              <View style={styles.divider} />

              {/* Institutional Support info */}
              <View style={styles.supportBox}>
                <Text style={styles.supportDetails}>
                  {[sid.address, (sid.helpline || sid.phones[0]) ? `Helpline: ${sid.helpline || sid.phones[0]}` : '', `Session: ${sid.session || SCHOOL_INFO.currentSession}`].filter(Boolean).join('\n')}
                </Text>
              </View>
            </ScrollView>

            {/* Drawer Footer: Logout */}
            <View style={styles.drawerFooter}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => {
                  onClose();
                  onLogout();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutIcon}>🚪</Text>
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  drawerContainer: {
    width: '84%',
    maxWidth: 340,
    height: '100%',
    backgroundColor: BRAND_COLORS.primary,
  },
  drawerInner: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  schoolBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BRAND_COLORS.accentGold,
  },
  schoolLogo: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  schoolName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  affiliation: {
    color: BRAND_COLORS.accentGoldLight,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.primaryRoyal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BRAND_COLORS.accentGold,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rolePill: {
    backgroundColor: BRAND_COLORS.accentGold,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  rolePillText: {
    color: '#0B1F4B',
    fontSize: 9,
    fontWeight: '800',
  },
  userSubId: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionHeading: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderLeftWidth: 3,
    borderLeftColor: BRAND_COLORS.accentGold,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuEmoji: {
    fontSize: 16,
  },
  menuTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  menuTitleActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_COLORS.accentGold,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
    marginHorizontal: 6,
  },
  supportBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 4,
    marginBottom: 16,
  },
  supportTitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  supportDetails: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  drawerFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  logoutIcon: {
    fontSize: 16,
  },
  logoutText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
});
