import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BRAND_COLORS } from '../utils/branding';
import { User } from '../types';
import { Icon, IconName } from './teacher-home/Icon';
import { getAuthorizedModulesForUser } from '../utils/rbac';

import { TeacherBottomNav } from './teacher-home/TeacherBottomNav';
import { useKeyboardVisible } from '../hooks/useKeyboardInset';


interface BottomNavBarProps {
  user: User;
  currentScreenId: string;
  onNavigate: (screenId: string) => void;
  onOpenDrawer: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  user,
  currentScreenId,
  onNavigate,
  onOpenDrawer,
}) => {
  // While typing, the bar steps aside so the form gets the room above the keyboard.
  const typing = useKeyboardVisible();
  if (typing) return null;
  // Teachers use the four-tab bar from the Figma design (Home, My Students, Attendance, Profile).
  if (user.role === 'TEACHER') {
    return <TeacherBottomNav currentScreenId={currentScreenId} onNavigate={onNavigate} />;
  }
  // Dashboard / Timetable / Attendance / Profile / More for every staff role. The Attendance tab opens
  // student attendance, or the staff register for roles that only have that one.
  const allowed = new Set(getAuthorizedModulesForUser(user).map((m) => m.id));
  const attendanceId = allowed.has('student-attendance') ? 'student-attendance' : allowed.has('staff-attendance') ? 'staff-attendance' : '';

  const tabs: Array<{ id: string; label: string; icon: IconName }> = [
    { id: 'dashboard', label: 'Dashboard', icon: 'house' },
    ...(allowed.has('timetable') ? [{ id: 'timetable', label: 'Timetable', icon: 'calendar' as IconName }] : []),
    ...(attendanceId ? [{ id: attendanceId, label: 'Attendance', icon: 'clipboard' as IconName }] : []),
    { id: 'profile', label: 'Profile', icon: 'user' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = currentScreenId === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabButton}
            onPress={() => onNavigate(tab.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Icon name={tab.icon} size={22} color={isActive ? BRAND_COLORS.primaryRoyal : '#64748B'} />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={styles.tabButton} onPress={onOpenDrawer} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="More menu">
        <Icon name="grid" size={22} color="#64748B" />
        <Text style={styles.tabLabel}>More</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabIcon: {
    fontSize: 18,
    color: '#64748B',
  },
  tabIconActive: {
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    color: BRAND_COLORS.primaryRoyal,
    fontWeight: '800',
  },
  activeIndicator: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND_COLORS.accentGold,
    marginTop: 3,
  },
});
