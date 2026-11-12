import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, BackHandler, Animated } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { SystemBars } from '../components/SystemBars';
import { TH, FONT } from '../theme/teacherHome';
import { T } from '../components/teacher-home/T';
import { Icon, IconName } from '../components/teacher-home/Icon';
import { User } from '../types';
import { apiService } from '../services/apiService';
import { ParentChildProvider, useParentChildren } from './ParentChildContext';
import { ParentRoute, ParentStackRoute, ParentTab, isParentTab, parentBackAction } from './routes';
import { ParentHomeScreen } from './screens/ParentHomeScreen';
import { ParentChildrenScreen } from './screens/ParentChildrenScreen';
import { ParentAttendanceScreen } from './screens/ParentAttendanceScreen';
import { ParentFeesScreen } from './screens/ParentFeesScreen';
import { ParentResultsScreen } from './screens/ParentResultsScreen';
import { ParentTimetableScreen } from './screens/ParentTimetableScreen';
import { ParentExamScheduleScreen } from './screens/ParentExamScheduleScreen';
import { ParentHomeworkScreen } from './screens/ParentHomeworkScreen';
import { ParentNoticesScreen } from './screens/ParentNoticesScreen';
import { ParentDocumentsScreen } from './screens/ParentDocumentsScreen';
import { ParentMoreScreen, ParentProfileScreen } from './screens/ParentMoreScreen';
import { ParentChatScreen } from './screens/ParentChatScreen';
import { FeeDuePopup } from './FeeDuePopup';
import { setActivityNavigator } from '../services/activityNav';
import { useActivity } from '../services/activityStore';
import { CountBadge } from '../components/ui/CountBadge';
import { useKeyboardVisible } from '../hooks/useKeyboardInset';

const TABS: Array<{ id: ParentTab; label: string; icon: IconName }> = [
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'attendance', label: 'Attendance', icon: 'clipboard' },
  { id: 'fees', label: 'Fees', icon: 'wallet' },
  { id: 'results', label: 'Results', icon: 'graduation-cap' },
  { id: 'more', label: 'More', icon: 'grid' },
];

interface Props {
  user: User;
  onLogout: () => void;
  /** A tapped notification asks for this screen. */
  pushRoute?: { route: ParentRoute; nonce: number; studentId?: string } | null;
}

/** Parent portal: bottom tabs for daily items, a small stack for the rest. */
export const ParentPortal: React.FC<Props> = ({ user, onLogout, pushRoute }) => (
  <ParentChildProvider user={user}>
    <PortalBody user={user} onLogout={onLogout} pushRoute={pushRoute} />
  </ParentChildProvider>
);

const PortalBody: React.FC<Props> = ({ user, onLogout, pushRoute }) => {
  const typing = useKeyboardVisible();
  const activity = useActivity();
  const { selectChild } = useParentChildren();
  const [tab, setTab] = useState<ParentTab>('home');
  const [stack, setStack] = useState<ParentStackRoute[]>([]);
  const [schoolSession, setSchoolSession] = useState<string | undefined>(undefined);
  const fade = useRef(new Animated.Value(1)).current;

  // The school's saved current session, used as the verified default for results.
  useEffect(() => {
    let alive = true;
    apiService
      .getSchoolSettings()
      .then((r) => {
        const s = (r.data as any)?.currentAcademicSession;
        if (alive && typeof s === 'string' && s.trim()) setSchoolSession(s.trim());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const crossfade = () => {
    fade.setValue(0.6);
    Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  };

  const navigate = useCallback((r: ParentRoute) => {
    crossfade();
    if (isParentTab(r)) {
      setStack([]);
      setTab(r);
    } else {
      setStack((s) => (s[s.length - 1] === r ? s : [...s, r]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening the app from a notification: go straight to the screen it is about.
  useEffect(() => {
    if (pushRoute) {
      // A reminder for a second child opens with that child selected.
      if (pushRoute.studentId) void selectChild(pushRoute.studentId);
      navigate(pushRoute.route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushRoute?.nonce]);

  // The bell and badges open these screens.
  useEffect(() => {
    setActivityNavigator((t) => navigate(t === 'messages' ? 'chat' : t === 'notices' ? 'notices' : 'fees'));
    return () => setActivityNavigator(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = useCallback(() => {
    crossfade();
    setStack((s) => s.slice(0, -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android back: close the open screen, then go to Home, then let the app exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = parentBackAction(stack, tab);
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

  const openChildren = () => navigate('children');
  const top = stack[stack.length - 1];

  const renderTop = () => {
    switch (top) {
      case 'children':
        return <ParentChildrenScreen onBack={back} />;
      case 'timetable':
        return <ParentTimetableScreen onBack={back} onOpenChildren={openChildren} session={schoolSession} />;
      case 'exams':
        return <ParentExamScheduleScreen onBack={back} onOpenChildren={openChildren} session={schoolSession} />;
      case 'homework':
        return <ParentHomeworkScreen onBack={back} onOpenChildren={openChildren} />;
      case 'notices':
        return <ParentNoticesScreen onBack={back} />;
      case 'documents':
        return <ParentDocumentsScreen onBack={back} onOpenChildren={openChildren} onNavigate={navigate} />;
      case 'chat':
        return <ParentChatScreen onBack={back} onOpenChildren={openChildren} onOpenFees={() => navigate('fees')} />;
      case 'profile':
        return <ParentProfileScreen user={user} onNavigate={navigate} onLogout={onLogout} onBack={back} />;
      default:
        return null;
    }
  };

  const renderTab = () => {
    switch (tab) {
      case 'attendance':
        return <ParentAttendanceScreen onOpenChildren={openChildren} />;
      case 'fees':
        return <ParentFeesScreen onOpenChildren={openChildren} />;
      case 'results':
        return <ParentResultsScreen onOpenChildren={openChildren} schoolSession={schoolSession} />;
      case 'more':
        return <ParentMoreScreen user={user} onNavigate={navigate} onLogout={onLogout} />;
      case 'home':
      default:
        return <ParentHomeScreen onNavigate={navigate} sessionName={schoolSession} />;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <SystemBars color={TH.surface} style="dark" bottomColor={TH.surface} />
      <Animated.View style={[styles.body, { opacity: fade }]}>{top ? renderTop() : renderTab()}</Animated.View>
      <FeeDuePopup onPay={() => navigate('fees')} onMessage={() => navigate('chat')} />
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
                  {t.id === 'more' && <CountBadge count={activity.messages + activity.noticesNew} style={{ position: 'absolute', top: -4, right: -6 }} />}
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
  safe: { flex: 1, backgroundColor: TH.surface },
  body: { flex: 1, backgroundColor: TH.bg },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: TH.surface,
    borderTopWidth: 1,
    borderTopColor: TH.border,
  },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: TH.tile },
  tabLabel: { fontFamily: FONT.medium, fontSize: 11, color: TH.muted },
  tabLabelActive: { fontFamily: FONT.semibold, color: TH.royal },
});
