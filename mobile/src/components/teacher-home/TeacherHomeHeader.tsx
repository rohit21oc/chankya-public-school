import React, { useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from './T';
import { Icon } from './Icon';
import { SchoolLogo } from '../SchoolLogo';
import { NotificationBell } from '../NotificationBell';

interface TeacherHomeHeaderProps {
  schoolName: string;
  teacherName: string;
  /** Resolved image URL for the signed-in teacher, if any. */
  avatarUri?: string;
  initials: string;
  noticeCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenMenu: () => void;
}

/** School header bar plus the "Teacher Dashboard" page heading (fixed above the scroll area). */
export const TeacherHomeHeader: React.FC<TeacherHomeHeaderProps> = ({
  schoolName,
  teacherName,
  avatarUri,
  initials,
  noticeCount,
  onOpenNotifications,
  onOpenProfile,
  onOpenMenu,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!avatarUri && !imageFailed;

  return (
    <View>
      <View style={styles.schoolBar}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={onOpenMenu}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
        >
          <T style={styles.hamburgerIcon}>☰</T>
        </TouchableOpacity>
        <SchoolLogo size={40} />
        <T style={styles.schoolName} numberOfLines={2}>
          {schoolName}
        </T>
        <NotificationBell tone="dark" />
        <TouchableOpacity
          style={styles.avatar}
          onPress={onOpenProfile}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Open profile for ${teacherName}`}
        >
          {showImage ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" onError={() => setImageFailed(true)} />
          ) : (
            <View style={[styles.avatarImage, styles.avatarFallback]}>
              <T style={styles.avatarInitials}>{initials}</T>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.pageBar}>
        <T style={styles.pageTitle} numberOfLines={1}>
          Teacher Dashboard
        </T>
        <TouchableOpacity
          style={styles.gridButton}
          onPress={onOpenMenu}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="More modules"
        >
          <Icon name="grid" size={22} color={TH.royal} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  schoolBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: TH.surface,
  },
  hamburgerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(11, 31, 75, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: TH.navy,
  },
  monogram: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: TH.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { fontFamily: FONT.heading, fontSize: 13.68, color: TH.gold },
  schoolName: { flex: 1, fontFamily: FONT.semibold, fontSize: 10, lineHeight: 15, color: TH.navy },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', left: 28, top: 8, width: 6, height: 6, borderRadius: 4, backgroundColor: TH.gold },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: FONT.heading, fontSize: 16, color: TH.gold },
  pageBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pageTitle: { flex: 1, fontFamily: FONT.heading, fontSize: 22, color: TH.navy },
  gridButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: TH.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
