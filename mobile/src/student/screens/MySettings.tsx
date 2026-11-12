import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { ChangePasswordCard } from '../../components/auth/ChangePasswordCard';
import { NotificationsCard } from '../../components/NotificationsCard';
import { ParentHeader, Screen, SPACE } from '../../parent/ui';

export const MySettings: React.FC<{ onBack: () => void; onLogout: () => void }> = ({ onBack, onLogout }) => (
  <Screen header={<ParentHeader title="Settings" onBack={onBack} />}>
    <NotificationsCard />
    <ChangePasswordCard />
    <TouchableOpacity style={styles.signOut} onPress={onLogout} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Sign out">
      <Icon name="log-out" size={18} color="#B42318" />
      <T style={styles.signOutText}>Logout</T>
    </TouchableOpacity>
  </Screen>
);

const styles = StyleSheet.create({
  signOut: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, borderRadius: 14, borderWidth: 1, borderColor: '#F4C7C3', backgroundColor: TH.surface },
  signOutText: { fontFamily: FONT.semibold, fontSize: 14, color: '#B42318' },
});
