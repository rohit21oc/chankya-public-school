import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TH, FONT } from '../theme/teacherHome';
import { BRAND_COLORS } from '../utils/branding';
import { T } from '../components/teacher-home/T';
import { Icon, IconName } from '../components/teacher-home/Icon';
import { Avatar } from '../parent/ui';
import { Student, User } from '../types';
import { classRollLine } from '../utils/studentPortalRules';
import { StudentRoute } from './routes';

export const DRAWER_ITEMS: Array<{ route: StudentRoute; label: string; icon: IconName }> = [
  { route: 'home', label: 'Dashboard', icon: 'house' },
  { route: 'attendance', label: 'Attendance', icon: 'clipboard' },
  { route: 'timetable', label: 'Timetable', icon: 'calendar' },
  { route: 'exams', label: 'Exam Schedule', icon: 'calendar' },
  { route: 'marks', label: 'Marks & Results', icon: 'graduation-cap' },
  { route: 'fees', label: 'Fees & Account', icon: 'wallet' },
  { route: 'homework', label: 'Homework', icon: 'book-open' },
  { route: 'profile', label: 'My Profile', icon: 'user' },
  { route: 'documents', label: 'Documents', icon: 'file-text' },
  { route: 'notices', label: 'Notices', icon: 'megaphone' },
  { route: 'events', label: 'Events', icon: 'bell' },
];

interface Props {
  visible: boolean;
  user: User;
  student: Student | null;
  /** The route currently on screen, to highlight. */
  current: StudentRoute;
  onClose: () => void;
  onNavigate: (r: StudentRoute) => void;
  onLogout: () => void;
}

/** Slide-in side menu (Dashboard, Attendance … Events, Settings, Logout). */
export const StudentDrawer: React.FC<Props> = ({ visible, user, student, current, onClose, onNavigate, onLogout }) => {
  const width = Math.min(320, Math.round(Dimensions.get('window').width * 0.82));
  const x = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    if (visible) {
      x.setValue(-width);
      Animated.timing(x, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible, width, x]);

  const go = (r: StudentRoute) => {
    onClose();
    onNavigate(r);
  };

  const name = student?.name || user.name;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
        <Animated.View style={[styles.panel, { width, transform: [{ translateX: x }] }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.head}>
              <Avatar name={name} photoKey={student?.photo || student?.photoFileKey} size={52} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={styles.name} numberOfLines={1}>
                  {name}
                </T>
                <T style={styles.meta} numberOfLines={1}>
                  {classRollLine(student) || 'Student'}
                </T>
              </View>
              <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu">
                <Icon name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {DRAWER_ITEMS.map((it) => {
                const active = it.route === current;
                return (
                  <TouchableOpacity key={it.route} style={[styles.item, active && styles.itemOn]} onPress={() => go(it.route)} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ selected: active }}>
                    <Icon name={it.icon} size={20} color={active ? '#FFFFFF' : TH.royal} />
                    <T style={[styles.itemText, active && styles.itemTextOn]}>{it.label}</T>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.foot}>
              <TouchableOpacity style={styles.footBtn} onPress={() => go('settings')} accessibilityRole="button">
                <Icon name="grid" size={18} color={TH.royal} />
                <T style={styles.footText}>Settings</T>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footBtn} onPress={() => { onClose(); onLogout(); }} accessibilityRole="button">
                <Icon name="log-out" size={18} color="#B42318" />
                <T style={[styles.footText, { color: '#B42318' }]}>Logout</T>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,75,0.45)' },
  panel: { backgroundColor: TH.surface, height: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: BRAND_COLORS.primaryRoyal },
  name: { fontFamily: FONT.heading, fontSize: 17, color: '#FFFFFF' },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.onNavyMuted },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 4 },
  item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, borderRadius: 12 },
  itemOn: { backgroundColor: BRAND_COLORS.primaryRoyal },
  itemText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  itemTextOn: { color: '#FFFFFF' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderTopWidth: 1, borderTopColor: TH.border },
  footBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  footText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
});
