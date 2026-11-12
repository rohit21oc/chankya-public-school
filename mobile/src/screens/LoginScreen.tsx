import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Animated, Easing, Image, Linking } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { SchoolLogo } from '../components/SchoolLogo';
import { LoginTabSelector } from '../components/LoginTabSelector';
import { StaffLoginForm } from '../components/StaffLoginForm';
import { StudentLoginForm } from '../components/StudentLoginForm';
import { ParentLoginForm } from '../components/ParentLoginForm';
import { LoginTabType, User } from '../types';
import { BRAND_COLORS, SCHOOL_INFO } from '../utils/branding';
import { apiService } from '../services/apiService';
import { SystemBars } from '../components/SystemBars';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { useKeyboardVisible } from '../hooks/useKeyboardInset';
import { KScrollView } from '../components/ui/KScrollView';
import { NOT_CONFIGURED, affiliationLine, useSchoolIdentity } from '../services/schoolIdentity';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const sid = useSchoolIdentity();
  const keyboardShown = useKeyboardVisible();
  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef({ card: 0, form: 0 });
  const [activeTab, setActiveTab] = useState<LoginTabType>('staff');
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [heroUri, setHeroUri] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);

  // Entrance: crest scales in, name fades up, then the form card rises.
  const logoIn = useRef(new Animated.Value(0)).current;
  const nameIn = useRef(new Animated.Value(0)).current;
  const cardIn = useRef(new Animated.Value(0)).current;
  // Form swap: fade/slide each time the tab changes.
  const formIn = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(logoIn, { toValue: 1, duration: 450, useNativeDriver: true, easing: ease }),
      Animated.timing(nameIn, { toValue: 1, duration: 450, delay: 150, useNativeDriver: true, easing: ease }),
      Animated.timing(cardIn, { toValue: 1, duration: 500, delay: 250, useNativeDriver: true, easing: ease }),
    ]).start();
  }, [logoIn, nameIn, cardIn]);

  useEffect(() => {
    const unsubscribe = apiService.subscribeColdStart((waking) => setIsWakingUp(waking));
    // Wake the free-tier server early so sign-in is quicker; the result is not shown.
    apiService.request('/api/health', 'GET', undefined, { timeoutMs: 8000, retries: 0 }).catch(() => undefined);
    // The school's own campus photo (from the website hero) behind the crest; plain navy if there is none.
    let alive = true;
    apiService.getLoginHeroImage().then((u) => { if (alive) setHeroUri(u); }).catch(() => undefined);
    return () => { alive = false; unsubscribe(); };
  }, []);

  // When the keyboard opens, scroll so the Login ID and Password fields sit at the top of what is left.
  useEffect(() => {
    if (!keyboardShown) return;
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, formY.current.card + formY.current.form - 12), animated: true }), 150);
    return () => clearTimeout(t);
  }, [keyboardShown]);

  const selectTab = (tab: LoginTabType) => {
    if (tab === activeTab) return;
    formIn.setValue(0);
    setActiveTab(tab);
    Animated.timing(formIn, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
  };

  const helpPhone = sid.helpline || sid.phones[0] || '';
  const callSchool = () => {
    const n = helpPhone.replace(/[^\d+]/g, '');
    if (n) Linking.openURL(`tel:${n}`).catch(() => undefined);
  };
  const TITLES: Record<LoginTabType, string> = { staff: 'Admin / Staff Login', student: 'Student Login', parent: 'Parent Login' };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SystemBars bottomColor={BRAND_COLORS.primary} />
      <View style={styles.flex}>
        <KScrollView ref={scrollRef} keyboardDismissMode="on-drag" contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            {heroUri && !heroFailed ? <Image source={{ uri: heroUri }} style={styles.heroImg} resizeMode="cover" onError={() => setHeroFailed(true)} /> : null}
            <View style={styles.heroShade} />
            <Animated.View style={{ opacity: logoIn, transform: [{ scale: logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
              <View style={styles.logoRing}>
                <SchoolLogo size={84} framed={false} />
              </View>
            </Animated.View>
            <Animated.View style={{ opacity: nameIn, transform: [{ translateY: nameIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
              <Text style={styles.schoolName}>{sid.name}</Text>
            </Animated.View>
          </View>

          <Animated.View onLayout={(e) => { formY.current.card = e.nativeEvent.layout.y; }} style={[styles.card, { opacity: cardIn, transform: [{ translateY: cardIn.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
            <LoginTabSelector activeTab={activeTab} onSelectTab={selectTab} />
            <Text style={styles.title}>{TITLES[activeTab]}</Text>
            <Text style={styles.subtitle}>Login to access your account</Text>
            <Animated.View onLayout={(e) => { formY.current.form = e.nativeEvent.layout.y; }} style={{ opacity: formIn, transform: [{ translateY: formIn.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
              {activeTab === 'staff' && <StaffLoginForm onLoginSuccess={onLoginSuccess} isWakingUp={isWakingUp} />}
              {activeTab === 'student' && <StudentLoginForm onLoginSuccess={onLoginSuccess} isWakingUp={isWakingUp} />}
              {activeTab === 'parent' && <ParentLoginForm onLoginSuccess={onLoginSuccess} isWakingUp={isWakingUp} />}
            </Animated.View>
            {/* Parents and students have no "Forgot password" here: parents sign in with mobile + child's date of birth. */}
            {activeTab === 'staff' && (
              <Pressable onPress={() => setForgotOpen(true)} style={styles.forgot} accessibilityRole="button">
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            )}
            <View style={styles.helpRow}>
              <Text style={styles.helpText}>Need help? </Text>
              {helpPhone ? (
                <Pressable onPress={callSchool} accessibilityRole="link" accessibilityLabel={`Contact school on ${helpPhone}`} style={styles.helpLinkWrap}>
                  <Text style={styles.helpLink}>Contact school</Text>
                </Pressable>
              ) : (
                <Text style={styles.helpText}>Contact the school office</Text>
              )}
            </View>
            <View style={styles.swooshBox} pointerEvents="none">
              <View style={styles.swooshGold} />
              <View style={styles.swooshNavy} />
            </View>
          </Animated.View>
        </KScrollView>
      </View>
      <ForgotPasswordModal
        visible={forgotOpen}
        onClose={() => setForgotOpen(false)}
        hint="Enter your registered email or login ID. We will email you a link to set a new password."
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.primary },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: { alignItems: 'center', justifyContent: 'center', paddingTop: 40, paddingBottom: 56, paddingHorizontal: 24, overflow: 'hidden', backgroundColor: BRAND_COLORS.primary },
  heroImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,75,0.62)' },
  logoRing: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: BRAND_COLORS.accentGold },
  schoolName: { marginTop: 14, color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center', lineHeight: 24, letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '800', color: BRAND_COLORS.primary },
  subtitle: { fontSize: 13, color: '#667085', marginTop: 2, marginBottom: 18 },
  forgot: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  forgotText: { color: BRAND_COLORS.primaryRoyal, fontSize: 14, fontWeight: '700' },
  helpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 4, minHeight: 36 },
  helpText: { color: '#667085', fontSize: 13 },
  helpLinkWrap: { minHeight: 36, justifyContent: 'center' },
  helpLink: { color: BRAND_COLORS.primaryRoyal, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  swooshBox: { height: 70, marginTop: 14, marginHorizontal: -20, marginBottom: -32, overflow: 'hidden' },
  swooshGold: { position: 'absolute', left: -60, right: -60, top: 22, height: 160, borderRadius: 200, backgroundColor: BRAND_COLORS.accentGold },
  swooshNavy: { position: 'absolute', left: -60, right: -60, top: 30, height: 160, borderRadius: 200, backgroundColor: BRAND_COLORS.primary },
  card: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, minHeight: 420, overflow: 'hidden' },
});
