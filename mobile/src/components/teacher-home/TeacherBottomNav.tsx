import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from '../ui/SafeArea';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from './T';
import { Icon, IconName } from './Icon';

interface TeacherBottomNavProps {
  currentScreenId: string;
  onNavigate: (screenId: string) => void;
}

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'Home', icon: 'house' },
  { id: 'students', label: 'My Students', icon: 'users' },
  { id: 'student-attendance', label: 'Attendance', icon: 'clipboard' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

/** Four-tab bottom navigation for teachers, as designed in Figma. */
export const TeacherBottomNav: React.FC<TeacherBottomNavProps> = ({ currentScreenId, onNavigate }) => (
  <SafeAreaView style={styles.safe}>
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = currentScreenId === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onNavigate(tab.id)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <Icon name={tab.icon} size={20} color={active ? TH.royal : TH.muted} />
            <T
              style={[styles.label, { fontFamily: active ? FONT.bold : FONT.medium, color: active ? TH.royal : TH.muted }]}
              numberOfLines={1}
            >
              {tab.label}
            </T>
          </TouchableOpacity>
        );
      })}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: { backgroundColor: TH.surface },
  bar: {
    height: 76,
    flexDirection: 'row',
    gap: 4,
    padding: 8,
    backgroundColor: TH.surface,
    borderTopWidth: 1,
    borderTopColor: TH.border,
  },
  item: { flex: 1, height: 56, gap: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemActive: { backgroundColor: TH.tile },
  label: { fontSize: 10 },
});
