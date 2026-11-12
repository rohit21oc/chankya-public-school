import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { SystemBars } from '../components/SystemBars';
import { TH, FONT } from '../theme/teacherHome';
import { T } from '../components/teacher-home/T';
import { Icon, IconName } from '../components/teacher-home/Icon';
import { CountBadge } from '../components/ui/CountBadge';
import { User } from '../types';
import { setActivityNavigator } from '../services/activityNav';
import { useActivity } from '../services/activityStore';
import { useKeyboardVisible } from '../hooks/useKeyboardInset';
import { isWardenTab, wardenBackAction, WardenRoute, WardenStackEntry, WardenTab } from './routes';
import { WardenHomeScreen } from './screens/WardenHomeScreen';
import { WardenStudentsScreen } from './screens/WardenStudentsScreen';
import { WardenStudentProfileScreen } from './screens/WardenStudentProfileScreen';
import { WardenAttendanceScreen } from './screens/WardenAttendanceScreen';
import { WardenHistoryScreen } from './screens/WardenHistoryScreen';
import { WardenLeavesScreen } from './screens/WardenLeavesScreen';
import { WardenMessScreen } from './screens/WardenMessScreen';
import { WardenAlertsScreen } from './screens/WardenAlertsScreen';
import { WardenMessagesScreen, WardenMoreScreen, WardenProfileScreen } from './screens/WardenMoreScreen';
import { MyIdCardScreen } from '../screens/MyIdCardScreen';
import { MyPayrollScreen } from '../screens/MyPayrollScreen';

const TABS: Array<{ id: WardenTab; label: string; icon: IconName }> = [
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'students', label: 'Students', icon: 'users' },
  { id: 'attendance', label: 'Attendance', icon: 'moon' },
  { id: 'more', label: 'More', icon: 'grid' },
];

interface Props {
  user: User;
  onLogout: () => void;
  /** A tapped notification (e.g. a parent message) asks for this screen. */
  pushRoute?: { route: WardenRoute; nonce: number } | null;
}

/** Hostel warden app: Home / Students / Attendance / More, with a small stack for the rest. */
export const WardenPortal: React.FC<Props> = ({ user, onLogout, pushRoute }) => {
  const typing = useKeyboardVisible();
  const activity = useActivity();
  const [tab, setTab] = useState<WardenTab>('home');
  const [stack, setStack] = useState<WardenStackEntry[]>([]);
  const fade = useRef(new Animated.Value(1)).current;

  const crossfade = () => {
    fade.setValue(0.6);
    Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  };

  const navigate = useCallback((r: WardenRoute, extra: Omit<WardenStackEntry, 'route'> = {}) => {
    crossfade();
    if (isWardenTab(r)) {
      setStack([]);
      setTab(r);
    } else {
      setStack((s) => [...s, { route: r, ...extra }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = useCallback(() => {
    crossfade();
    setStack((s) => s.slice(0, -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pushRoute) navigate(pushRoute.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushRoute?.nonce]);

  // The bell opens Messages (parents' chats) or Alerts.
  useEffect(() => {
    setActivityNavigator((t) => navigate(t === 'messages' ? 'messages' : 'alerts'));
    return () => setActivityNavigator(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android back: close the open screen, then go Home, then let the app exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = wardenBackAction(stack.length, tab);
      if (action === 'pop') {
        back();
        return true;
      }
      if (action === 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack, tab, back]);

  const top = stack[stack.length - 1];
  const openStudent = (id: string) => navigate('student', { studentId: id });

  const renderTop = () => {
    switch (top?.route) {
      case 'student':
        return (
          <WardenStudentProfileScreen
            key={top.studentId}
            studentId={top.studentId!}
            onBack={back}
            onMessageParent={(st) => navigate('messages', { chatStudent: st })}
          />
        );
      case 'leaves':
        return <WardenLeavesScreen onBack={back} />;
      case 'mess':
        return <WardenMessScreen onBack={back} />;
      case 'alerts':
        return <WardenAlertsScreen onBack={back} />;
      case 'history':
        return <WardenHistoryScreen onBack={back} />;
      case 'messages':
        return <WardenMessagesScreen key={top.chatStudent?.id || 'inbox'} onBack={back} openStudent={top.chatStudent || null} />;
      case 'profile':
        return <WardenProfileScreen user={user} onNavigate={navigate} onLogout={onLogout} onBack={back} />;
      case 'idcard':
        return <MyIdCardScreen user={user} onBack={back} />;
      case 'payroll':
        return <MyPayrollScreen user={user} onBack={back} />;
      default:
        return null;
    }
  };

  const renderTab = () => {
    switch (tab) {
      case 'students':
        return <WardenStudentsScreen onOpenStudent={openStudent} />;
      case 'attendance':
        return <WardenAttendanceScreen onOpenHistory={() => navigate('history')} />;
      case 'more':
        return <WardenMoreScreen user={user} onNavigate={navigate} onLogout={onLogout} />;
      case 'home':
      default:
        return <WardenHomeScreen user={user} onNavigate={navigate} />;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SystemBars color={TH.navy} style="light" bottomColor={TH.surface} />
      <Animated.View style={[styles.body, { opacity: fade }]}>{top ? renderTop() : renderTab()}</Animated.View>
      {!top && !typing && (
        <View style={styles.tabBar} accessibilityRole="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.tab}
                onPress={() => navigate(t.id)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                  <Icon name={t.icon} size={20} color={active ? TH.royal : TH.muted} />
                  {t.id === 'more' && <CountBadge count={activity.messages} style={{ position: 'absolute', top: -4, right: -6 }} />}
                </View>
                <T style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                  {t.label}
                </T>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.navy },
  body: { flex: 1, backgroundColor: TH.bg },
  tabBar: { flexDirection: 'row', paddingHorizontal: 4, paddingTop: 6, paddingBottom: 8, backgroundColor: TH.surface, borderTopWidth: 1, borderTopColor: TH.border },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: TH.tile },
  tabLabel: { fontFamily: FONT.medium, fontSize: 11, color: TH.muted },
  tabLabelActive: { fontFamily: FONT.semibold, color: TH.royal },
});
