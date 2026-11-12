import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, MobileModule } from '../types';
import { authStorage } from '../services/authStorage';
import { apiService } from '../services/apiService';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { TimetableScreen } from '../screens/TimetableScreen';
import { StudentAttendanceScreen } from '../screens/StudentAttendanceScreen';
import { MarksEntryScreen } from '../screens/MarksEntryScreen';
import { MyStudentsScreen } from '../screens/MyStudentsScreen';
import { MyClassesScreen } from '../screens/MyClassesScreen';
import { StudentManagementScreen } from '../screens/StudentManagementScreen';
import { StaffManagementScreen } from '../screens/StaffManagementScreen';
import { TeacherProfileScreen } from '../screens/TeacherProfileScreen';
import { StaffAttendanceScreen } from '../screens/StaffAttendanceScreen';
import { MyPayrollScreen } from '../screens/MyPayrollScreen';
import { MyIdCardScreen } from '../screens/MyIdCardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ReportCardScreen } from '../screens/ReportCardScreen';
import { HomeworkScreen } from '../screens/HomeworkScreen';
import { ModuleDetailScreen } from '../screens/ModuleDetailScreen';
import { CommunicationScreen } from '../screens/CommunicationScreen';
import { LeaveRequestsScreen } from '../screens/LeaveRequestsScreen';
import { EnquiriesScreen } from '../screens/EnquiriesScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { LiveEventsScreen } from '../screens/LiveEventsScreen';
import { AppDrawer } from '../components/AppDrawer';
import { ParentPortal } from '../parent/ParentPortal';
import { StudentPortal } from '../student/StudentPortal';
import { WardenPortal } from '../warden/WardenPortal';
import { usesWardenPortal, type WardenRoute } from '../warden/routes';
import type { StudentRoute } from '../student/routes';
import { BottomNavBar } from '../components/BottomNavBar';
import { BRAND_COLORS, SCHOOL_INFO } from '../utils/branding';
import { getAuthorizedModulesForUser, MOBILE_MODULES } from '../utils/rbac';
import { ExamScheduleScreen } from '../screens/ExamScheduleScreen';
import { resolveBackAction, nextHistory, stepBack } from '../utils/backNavigation';
import { SystemBars } from '../components/SystemBars';
import { ScreenTransition } from '../components/ui/ScreenTransition';
import { useAppReady } from '../components/AnimatedSplash';
import {
  configureNotifications,
  onNotificationTapped,
  registerDeviceForPush,
  takeLaunchNotificationData,
  unregisterDeviceForPush,
} from '../services/pushNotifications';
import { startActivity, stopActivity } from '../services/activityStore';
import { setActivityNavigator } from '../services/activityNav';
import { moduleForPush, parentRouteForPush, studentRouteForPush, type ParentPushRoute } from '../utils/pushRouting';

export const AppNavigator: React.FC = () => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [currentScreenId, setCurrentScreenId] = useState<string>('dashboard');
  // Screens the person came through, so Back goes one step back instead of straight to the dashboard.
  const [history, setHistory] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const markAppReady = useAppReady();
  // A tapped notification asks the parent portal to open a screen (nonce makes the same tap work twice).
  const [parentPushRoute, setParentPushRoute] = useState<{ route: ParentPushRoute; nonce: number; studentId?: string } | null>(null);
  const [studentPushRoute, setStudentPushRoute] = useState<{ route: StudentRoute; nonce: number } | null>(null);
  const [wardenPushRoute, setWardenPushRoute] = useState<{ route: WardenRoute; nonce: number } | null>(null);
  const authUserRef = useRef<User | null>(null);
  const launchHandled = useRef(false);

  // Tell the animated launch splash (App.tsx) that the saved sign-in has been restored.
  useEffect(() => {
    if (!isInitializing) markAppReady();
  }, [isInitializing, markAppReady]);

  // Check stored session on mount
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Load the saved sign-in from the phone's secure storage before choosing the first screen.
        await authStorage.init();
        const storedUser = authStorage.getUser();
        const storedToken = authStorage.getToken();

        if (storedToken && storedUser) {
          setAuthUser(storedUser);
          setCurrentScreenId('dashboard');

          // Verify session in background
          apiService.verifyCurrentSession().then((res) => {
            if (!res.valid) {
              setAuthUser(null);
            } else if (res.user) {
              setAuthUser(res.user);
            }
          }).catch(() => {});
        } else {
          setAuthUser(null);
        }
      } catch {
        setAuthUser(null);
      } finally {
        setIsInitializing(false);
      }
    };

    bootstrap();
  }, []);

  // An expired or revoked session (any 401) returns to the login screen.
  useEffect(() => apiService.onSessionExpired(() => {
    setIsDrawerOpen(false);
    setAuthUser(null);
    setCurrentScreenId('dashboard');
    setHistory([]);
  }), []);

  authUserRef.current = authUser;

  // Notifications: set up the Android channel once; after sign-in register this phone with the server
  // (asks the system for permission the first time); a tap opens the matching screen.
  useEffect(() => {
    configureNotifications().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    registerDeviceForPush().catch(() => undefined);
  }, [authUser?.id]);

  // Unread counts for the badges and the bell follow the signed-in person.
  useEffect(() => {
    if (!authUser) {
      stopActivity();
      return;
    }
    void startActivity(authUser);
    return () => stopActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  // The bell opens Messages / Notices in the staff app (parents and students register their own).
  useEffect(() => {
    if (!authUser || authUser.role === 'PARENT' || authUser.role === 'STUDENT' || usesWardenPortal(authUser.role)) return;
    setActivityNavigator((t) => handleNavigate(t === 'notices' ? 'communication' : t === 'enquiries' ? 'enquiries' : 'messages'));
    return () => setActivityNavigator(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser) return;
    const open = (data: Record<string, any>) => {
      const me = authUserRef.current;
      if (!me) return;
      if (me.role === 'PARENT') {
        const route = parentRouteForPush(data?.type);
        if (route) setParentPushRoute({ route, nonce: Date.now(), studentId: typeof data?.studentId === 'string' ? data.studentId : undefined });
      } else if (me.role === 'STUDENT') {
        const route = studentRouteForPush(data?.type);
        if (route) setStudentPushRoute({ route, nonce: Date.now() });
      } else if (usesWardenPortal(me.role)) {
        if (data?.type === 'MESSAGE') setWardenPushRoute({ route: 'messages', nonce: Date.now() });
        else if (data?.type === 'HOSTEL') setWardenPushRoute({ route: 'alerts', nonce: Date.now() });
      } else {
        const moduleId = moduleForPush(data?.type, data?.kind);
        if (moduleId) handleNavigate(moduleId);
      }
    };
    if (!launchHandled.current) {
      launchHandled.current = true;
      takeLaunchNotificationData().then((d) => { if (d) open(d); }).catch(() => undefined);
    }
    return onNotificationTapped(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  const handleLoginSuccess = (user: User) => {
    setAuthUser(user);
    setCurrentScreenId('dashboard');
    setHistory([]);
  };

  const handleLogout = async () => {
    setIsDrawerOpen(false);
    await unregisterDeviceForPush(); // while the session is still valid, so this phone stops getting this login's alerts
    await apiService.logout();
    setAuthUser(null);
    setCurrentScreenId('dashboard');
    setHistory([]);
  };

  const openScreen = (id: string) => {
    if (id === currentScreenId) return;
    setHistory((h) => nextHistory(h, currentScreenId, id));
    setCurrentScreenId(id);
  };

  const goBack = () => {
    const step = stepBack(history);
    setHistory(step.history);
    setCurrentScreenId(step.screen);
  };

  const handleNavigate = (moduleId: string) => {
    if (!authUser) return;

    // RBAC validation: Check if user is authorized for this module
    if (moduleId !== 'dashboard' && moduleId !== 'profile') {
      const authorized = getAuthorizedModulesForUser(authUser);
      const isPermitted = authorized.some((m) => m.id === moduleId);

      if (!isPermitted) {
        Alert.alert(
          'Access Restricted',
          `Your role (${authUser.role}) does not have permission to access this module.`
        );
        return;
      }
    }

    openScreen(moduleId);
  };

  // Android hardware back: close the drawer, then return to the dashboard, and only
  // then let the OS leave the app. Without this, back exits from any screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = resolveBackAction({
        isAuthenticated: !!authUser,
        isDrawerOpen,
        currentScreenId,
        historyLength: history.length,
      });
      if (action === 'close-drawer') {
        setIsDrawerOpen(false);
        return true;
      }
      if (action === 'go-back' || action === 'go-dashboard') {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, isDrawerOpen, currentScreenId, history]);

  if (isInitializing) {
    // The animated splash overlay is covering the screen while the session is restored.
    return <View style={styles.bootBlank} />;
  }

  // Not logged in -> Show authentication portal
  if (!authUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Parents get the dedicated parent portal (its own tabs, child selector and back handling).
  // Staff keep the existing screens below.
  if (authUser.role === 'PARENT') {
    return <ParentPortal user={authUser} onLogout={handleLogout} pushRoute={parentPushRoute} />;
  }

  // Hostel wardens get the warden portal (Home / Students / Attendance / More). Other staff are unchanged.
  if (usesWardenPortal(authUser.role)) {
    return <WardenPortal user={authUser} onLogout={handleLogout} pushRoute={wardenPushRoute} />;
  }

  // Students get their own portal (bottom bar, side menu, calendar, marks, fees …).
  if (authUser.role === 'STUDENT') {
    return <StudentPortal user={authUser} onLogout={handleLogout} pushRoute={studentPushRoute} />;
  }

  // Render the current screen with RBAC enforcement
  const renderCurrentScreen = () => {
    switch (currentScreenId) {
      case 'timetable':
        return (
          <TimetableScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'homework':
        return (
          <HomeworkScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'student-attendance':
        return (
          <StudentAttendanceScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'marks-entry':
        return (
          <MarksEntryScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'staff-attendance':
        return (
          <StaffAttendanceScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'my-payroll':
        return (
          <MyPayrollScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'my-id-card':
        return (
          <MyIdCardScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'profile':
        if (authUser.role === 'TEACHER') {
          return (
            <TeacherProfileScreen
              user={authUser}
              onBack={goBack}
              onOpenMenu={() => setIsDrawerOpen(true)}
              onLogout={handleLogout}
              onNavigateModule={handleNavigate}
            />
          );
        }
        return (
          <ProfileScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onLogout={handleLogout}
            onNavigateModule={handleNavigate}
          />
        );

      case 'students':
        if (authUser.role === 'TEACHER') {
          return (
            <MyStudentsScreen
              user={authUser}
              onBack={goBack}
              onOpenMenu={() => setIsDrawerOpen(true)}
              onOpenProfile={() => openScreen('profile')}
            />
          );
        }
        return (
          <StudentManagementScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'my-classes':
        return (
          <MyClassesScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
            onOpenStudents={() => handleNavigate('students')}
          />
        );

      case 'staff':
        return (
          <StaffManagementScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
            onNavigateModule={handleNavigate}
          />
        );
      case 'report-card':
      case 'academic-performance':
        return (
          <ReportCardScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'messages':
        return (
          <MessagesScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
            onNavigateModule={handleNavigate}
          />
        );

      case 'reports':
        return (
          <ReportsScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'enquiries':
        return <EnquiriesScreen user={authUser} onBack={goBack} onOpenMenu={() => setIsDrawerOpen(true)} onOpenProfile={() => openScreen('profile')} />;

      case 'leave-requests':
        return (
          <LeaveRequestsScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'live-events':
        return (
          <LiveEventsScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
            onNavigateModule={handleNavigate}
          />
        );

      case 'exam-schedule':
        return (
          <ExamScheduleScreen
            user={authUser}
            onBack={goBack}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
          />
        );

      case 'communication':
        // Staff get the full Notices & SMS screen; students and parents keep their notice list.
        if (authUser.role !== 'STUDENT' && authUser.role !== 'PARENT') {
          return (
            <CommunicationScreen
              user={authUser}
              onBack={goBack}
              onOpenMenu={() => setIsDrawerOpen(true)}
              onOpenProfile={() => openScreen('profile')}
              onNavigateModule={handleNavigate}
            />
          );
        }
      // falls through
      {
        const mod = MOBILE_MODULES.find((m) => m.id === currentScreenId) || {
          id: currentScreenId,
          title: currentScreenId,
          description: '',
          iconName: '📄',
          roles: [authUser.role],
          color: '#123B8C',
          isImplementedInPhase1: true,
        };
        return (
          <ModuleDetailScreen
            module={mod}
            user={authUser}
            onBack={goBack}
          />
        );
      }

      case 'dashboard':
      default:
        return (
          <DashboardScreen
            user={authUser}
            onLogout={handleLogout}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenProfile={() => openScreen('profile')}
            onNavigateModule={handleNavigate}
          />
        );
    }
  };

  return (
    <View style={styles.appContainer}>
      {/* Active Screen */}
      <View style={styles.screenWrapper}>
        <ScreenTransition id={currentScreenId}>{renderCurrentScreen()}</ScreenTransition>
      </View>

      {/* Bottom Quick Navigation Bar */}
      <BottomNavBar
        user={authUser}
        currentScreenId={currentScreenId}
        onNavigate={handleNavigate}
        onOpenDrawer={() => setIsDrawerOpen(true)}
      />

      {/* Mobile Drawer / Sidebar Overlay */}
      <AppDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={authUser}
        currentScreenId={currentScreenId}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  screenWrapper: {
    flex: 1,
  },
  bootBlank: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  splashSubtext: {
    color: BRAND_COLORS.accentGoldLight,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
});
