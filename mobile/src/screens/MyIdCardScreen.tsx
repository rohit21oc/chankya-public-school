import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, Staff } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { BRAND_COLORS } from '../utils/branding';
import { IdCard } from '../components/IdCard';
import { buildStaffIdCardModel } from '../utils/idCardModel';
import { apiService } from '../services/apiService';
import { StateView } from '../components/ui/StateView';
import { buildIdCardView, ownStaffIdentifier } from '../utils/teacherProfileRules';

interface MyIdCardScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

export const MyIdCardScreen: React.FC<MyIdCardScreenProps> = ({
  user,
  onBack,
  onOpenMenu,
  onOpenProfile,
}) => {
  const [staffRecord, setStaffRecord] = useState<Staff | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);
  const [qrToken, setQrToken] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');

  const staffIdentifier = ownStaffIdentifier(user);

  const loadIdCard = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // The identifier always comes from the signed-in session, never from navigation input.
      if (!staffIdentifier) {
        setStaffRecord(null);
        setErrorMessage('Your staff identity is not linked to this account.');
      } else {
        const res = await apiService.getStaffIdCard(staffIdentifier);
        if (res.ok && res.staff) {
          setStaffRecord(res.staff);
          setSchoolSettings(res.settings);
          setQrToken(res.qrToken);
        } else {
          // Show the real failure. Do not fall back to a card built from session data.
          setStaffRecord(null);
          setErrorMessage(res.error || 'Your ID card could not be loaded.');
        }
      }
    } catch {
      setStaffRecord(null);
      setErrorMessage('Could not reach the school server. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadIdCard();
  }, [user.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadIdCard();
  };

  const idView = buildIdCardView(staffRecord, user);

  // No verified record: show the real state, never a card with placeholder data.
  if (loading && !staffRecord) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="My ID Card" subtitle="Digital Campus Identity" />
        <StateView variant="loading" title="Loading your ID card" />
      </SafeAreaView>
    );
  }
  if (!idView.available) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="My ID Card" subtitle="Digital Campus Identity" />
        <StateView
          variant="error"
          title="ID card unavailable"
          message={errorMessage || 'Your ID card could not be loaded.'}
          onRetry={loadIdCard}
        />
      </SafeAreaView>
    );
  }

  const model = buildStaffIdCardModel(staffRecord, schoolSettings, user, qrToken);
  const toggleSide = () => setSide((prev) => (prev === 'front' ? 'back' : 'front'));

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        showBack
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        title="My ID Card"
        subtitle="Digital Campus Identity"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[BRAND_COLORS.primaryBright]}
          />
        }
      >
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={BRAND_COLORS.primaryRoyal} />
            <Text style={styles.loadingText}>Refreshing…</Text>
          </View>
        )}

        <IdCard model={model} side={side} onToggle={toggleSide} />

        <View style={styles.sideSwitch}>
          {(['front', 'back'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sideBtn, side === s && styles.sideBtnActive]}
              onPress={() => setSide(s)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={s === 'front' ? 'Show card front' : 'Show card back'}
            >
              <Text style={[styles.sideBtnText, side === s && styles.sideBtnTextActive]}>
                {s === 'front' ? 'Front' : 'Back'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.flipHint}>Tap the card to flip it</Text>
      </ScrollView>
      <Text style={styles.webOnlyNote}>
        Printing and downloading this card are available on the school web portal.
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FC' },
  scrollContent: { flexGrow: 1, paddingTop: 16, paddingBottom: 24 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 10 },
  loadingText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  sideSwitch: {
    flexDirection: 'row', alignSelf: 'center', marginTop: 16, backgroundColor: '#E2E8F0', borderRadius: 999, padding: 3,
  },
  sideBtn: { minHeight: 44, minWidth: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingHorizontal: 16 },
  sideBtnActive: { backgroundColor: '#0B2545' },
  sideBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  sideBtnTextActive: { color: '#FFFFFF' },
  flipHint: { textAlign: 'center', fontSize: 11, color: '#64748B', marginTop: 8 },
  webOnlyNote: { textAlign: 'center', fontSize: 11, color: '#64748B', paddingHorizontal: 16, paddingVertical: 8 },
});
