import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setActivityNavigator } from '../services/activityNav';
import { useKeyboardVisible } from '../hooks/useKeyboardInset';
import { View, TouchableOpacity, StyleSheet, BackHandler, Animated } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { SystemBars } from '../components/SystemBars';
import { TH, FONT } from '../theme/teacherHome';
import { BRAND_COLORS } from '../utils/branding';
import { T } from '../components/teacher-home/T';
import { Icon, IconName } from '../components/teacher-home/Icon';
import { User } from '../types';
import { apiService } from '../services/apiService';
import { PortalChromeContext } from '../parent/ui';
import { ParentFeesScreen } from '../parent/screens/ParentFeesScreen';
import { ParentExamScheduleScreen } from '../parent/screens/ParentExamScheduleScreen';
import { ParentHomeworkScreen } from '../parent/screens/ParentHomeworkScreen';
import { StudentRoute, StudentStackRoute, StudentTab, isStudentTab, studentBackAction } from './routes';
import { StudentPortalContext, StudentSelfProvider } from './StudentContext';
import { StudentDrawer } from './StudentDrawer';
import { useParentChildren } from '../parent/ParentChildContext';
import { MyHome } from './screens/MyHome';
import { MyAttendance } from './screens/MyAttendance';
import { MyTimetable } from './screens/MyTimetable';
import { MyMarks } from './screens/MyMarks';
import { MyDocuments } from './screens/MyDocuments';
import { MyNotices } from './screens/MyNotices';
import { MyEvents } from './screens/MyEvents';
import { MyProfile } from './screens/MyProfile';
import { MySettings } from './screens/MySettings';

const NAV: Array<{ id: StudentTab | 'more'; label: string; icon: IconName }> = [
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'attendance', label: 'Attendance', icon: 'clipboard' },
  { id: 'timetable', label: 'Timetable', icon: 'calendar' },
  { id: 'more', label: 'More', icon: 'grid' },
];

interface Props {
  user: User;
  onLogout: () => void;
  /** A tapped notification asks for this screen. */
  pushRoute?: { route: StudentRoute; nonce: number } | null;
}

/** Student portal: bottom bar (Home, Attendance, Timetable, More), a side menu and a small stack for the rest. */
export const StudentPortal: React.FC<Props> = ({ user, onLogout, pushRoute }) => (
  <StudentSelfProvider user={user}>
    <PortalBody user={user} onLogout={onLogout} pushRoute={pushRoute} />
  </StudentSelfProvider>
);

const PortalBody: React.FC<Props> = ({ user, onLogout, pushRoute }) => {
  const typing = useKeyboardVisible();
  const { activeChild } = useParentChildren();
  const [tab, setTab] = useState<StudentTab>('home');
  const [stack, setStack] = useState<StudentStackRoute[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [schoolSession, setSchoolSession] = useState<string | undefined>(undefined);
  const fade = useRef(new Animated.Value(1)).current;

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

  const navigate = useCallback((r: StudentRoute) => {
    crossfade();
    if (isStudentTab(r)) {
      setStack([]);
      setTab(r);
    } else {
      setStack((s) => (s[s.length - 1] === r ? s : [...s, r]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setActivityNavigator((t) => navigate(t === 'fees' ? 'fees' : 'notices'));
    return () => setActivityNavigator(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pushRoute) navigate(pushRoute.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushRoute?.nonce]);

  const back = useCallback(() => {
    crossfade();
    setStack((s) => s.slice(0, -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = studentBackAction(stack, tab, drawer);
      if (action === 'close-menu') {
        setDrawer(false);
        return true;
      }
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
  }, [stack, tab, drawer, back]);

  const top = stack[stack.length - 1];
  const current: StudentRoute = top || tab;
  const openChildrenNoop = () => undefined;

  const ctx = useMemo(() => ({ schoolSession, openMenu: () => setDrawer(true), navigate }), [schoolSession, navigate]);
  const chrome = useMemo(() => ({ variant: 'student' as const, onMenu: () => setDrawer(true) }), []);

  const renderTop = () => {
    switch (top) {
      case 'marks':
        return <MyMarks onBack={back} />;
      case 'exams':
        return <ParentExamScheduleScreen onBack={back} session={schoolSession} />;
      case 'fees':
        return <ParentFeesScreen onOpenChildren={openChildrenNoop} onBack={back} />;
      case 'homework':
        return <ParentHomeworkScreen onBack={back} onOpenChildren={openChildrenNoop} />;
      case 'documents':
        return <MyDocuments onBack={back} onNavigate={navigate} />;
      case 'notices':
        return <MyNotices onBack={back} />;
      case 'events':
        return <MyEvents onBack={back} />;
      case 'profile':
        return <MyProfile onBack={back} />;
      case 'settings':
        return <MySettings onBack={back} onLogout={onLogout} />;
      default:
        return null;
    }
  };

  const renderTab = () => {
    switch (tab) {
      case 'attendance':
        return <MyAttendance />;
      case 'timetable':
        return <MyTimetable />;
      case 'home':
      default:
        return <MyHome />;
    }
  };

  return (
    <StudentPortalContext.Provider value={ctx}>
      <PortalChromeContext.Provider value={chrome}>
        <SafeAreaView style={styles.safe}>
          <SystemBars color={BRAND_COLORS.primaryRoyal} style="light" bottomColor={TH.surface} />
          <Animated.View style={[styles.body, { opacity: fade }]}>{top ? renderTop() : renderTab()}</Animated.View>
          {!typing && <View style={styles.tabBar} accessibilityRole="tablist">
            {NAV.map((t) => {
              const active = t.id === 'more' ? drawer : !top && tab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.tab}
                  onPress={() => (t.id === 'more' ? setDrawer(true) : navigate(t.id))}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityLabel={t.label}
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                    <Icon name={t.icon} size={20} color={active ? BRAND_COLORS.primaryRoyal : TH.muted} />
                  </View>
                  <T style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                    {t.label}
                  </T>
                </TouchableOpacity>
              );
            })}
          </View>}
          <StudentDrawer visible={drawer} user={user} student={activeChild} current={current} onClose={() => setDrawer(false)} onNavigate={navigate} onLogout={onLogout} />
        </SafeAreaView>
      </PortalChromeContext.Provider>
    </StudentPortalContext.Provider>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.surface },
  body: { flex: 1, backgroundColor: TH.bg },
  tabBar: { flexDirection: 'row', paddingHorizontal: 4, paddingTop: 6, paddingBottom: 8, backgroundColor: TH.surface, borderTopWidth: 1, borderTopColor: TH.border },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: TH.tile },
  tabLabel: { fontFamily: FONT.medium, fontSize: 11, color: TH.muted },
  tabLabelActive: { fontFamily: FONT.semibold, color: BRAND_COLORS.primaryRoyal },
});
