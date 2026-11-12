import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Card, InfoRow, SectionHeading } from '../../components/teacher-home/ListParts';
import { Avatar, Screen, SPACE } from '../../parent/ui';
import { User } from '../../types';
import { ChatInbox } from '../../components/comm/ChatInbox';
import { MyStaffProfile } from '../../components/profile/MyStaffProfile';
import { useSchoolIdentity } from '../../services/schoolIdentity';
import { useActivity } from '../../services/activityStore';
import { authStorage } from '../../services/authStorage';
import { wardenApi } from '../wardenApi';
import { WardenHeader } from '../wardenUi';
import type { WardenRoute } from '../routes';

const photoOf = (user: User) => authStorage.getUser()?.avatar || user.avatar || undefined;

interface Props {
  user: User;
  onNavigate: (r: WardenRoute) => void;
  onLogout: () => void;
}

/** Secondary destinations, the warden's account and sign out. */
export const WardenMoreScreen: React.FC<Props> = ({ user, onNavigate, onLogout }) => {
  const sid = useSchoolIdentity();
  const activity = useActivity();
  return (
    <Screen header={<WardenHeader title="More" />}>
      <TouchableOpacity style={styles.account} onPress={() => onNavigate('profile')} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Open profile">
        <Avatar name={user.name} photoKey={photoOf(user)} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={styles.name} numberOfLines={1}>
            {user.name || 'Hostel Warden'}
          </T>
          <T style={styles.meta} numberOfLines={1}>
            Hostel Warden{user.employeeId ? ` · ${user.employeeId}` : ''}
          </T>
        </View>
        <Icon name="chevron" size={16} color={TH.muted} />
      </TouchableOpacity>

      <View style={{ gap: SPACE.sm }}>
        <SectionHeading title="Hostel" />
        <Card>
          <InfoRow icon="calendar" title="Leave Requests" subtitle="Requests from parents, forward to Principal" onPress={() => onNavigate('leaves')} />
          <InfoRow icon="utensils" title="Mess Menu" subtitle="Breakfast, lunch and dinner with timings" onPress={() => onNavigate('mess')} />
          <InfoRow icon="triangle-alert" title="Alerts" subtitle="Absent at night and emergencies" onPress={() => onNavigate('alerts')} />
          <InfoRow icon="history" title="Attendance History & Reports" subtitle="Daily and monthly night attendance" onPress={() => onNavigate('history')} />
          <InfoRow icon="message-circle" title="Messages" subtitle="Chat with parents of your students" badge={activity.messages > 0 ? `${activity.messages} new` : undefined} onPress={() => onNavigate('messages')} />
        </Card>
      </View>

      <View style={{ gap: SPACE.sm }}>
        <SectionHeading title="Account" />
        <Card>
          <InfoRow icon="user" title="My Profile" subtitle="Details, attendance, leave and password" onPress={() => onNavigate('profile')} />
          <InfoRow icon="id-card" title="My ID Card" subtitle="View & download" onPress={() => onNavigate('idcard')} />
          <InfoRow icon="wallet" title="My Payroll" subtitle="Salary & payslips" onPress={() => onNavigate('payroll')} />
        </Card>
      </View>

      <TouchableOpacity style={styles.signOut} onPress={onLogout} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Log out">
        <Icon name="log-out" size={18} color="#B42318" />
        <T style={styles.signOutText}>Log out</T>
      </TouchableOpacity>
      <T style={styles.footer}>{sid.name}</T>
    </Screen>
  );
};

/** The warden's own profile: the same page every staff member has (ID card, payroll, details, contact, attendance, leave, password). */
export const WardenProfileScreen: React.FC<Props & { onBack: () => void }> = ({ user, onNavigate, onLogout, onBack }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  return (
    <Screen
      header={<WardenHeader title="My Profile" onBack={onBack} />}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setRefreshKey((k) => k + 1);
      }}
    >
      <MyStaffProfile
        user={user}
        records={['my-id-card', 'my-payroll']}
        onOpen={(id) => onNavigate(id === 'my-id-card' ? 'idcard' : 'payroll')}
        onLogout={onLogout}
        refreshKey={refreshKey}
        onLoaded={() => setRefreshing(false)}
      />
    </Screen>
  );
};

/** Chats with parents (the shared staff inbox); "New chat" offers only the warden's own students. */
export const WardenMessagesScreen: React.FC<{ onBack: () => void; openStudent?: { id: string; name?: string; photo?: string } | null }> = ({ onBack, openStudent }) => {
  const [open, setOpen] = useState(openStudent || null);
  return (
    <Screen header={<WardenHeader title="Messages" subtitle="Parents of your hostel students" onBack={onBack} />}>
      <ChatInbox
        openStudent={open}
        onOpenedStudent={() => setOpen(null)}
        loadPickerStudents={async () => {
          const r = await wardenApi.students();
          return r.ok && r.data ? r.data.list : [];
        }}
      />
    </Screen>
  );
};


const styles = StyleSheet.create({
  account: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md, borderRadius: 16, borderWidth: 1, borderColor: TH.border, backgroundColor: TH.surface },
  name: { fontFamily: FONT.semibold, fontSize: 16, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  big: { fontFamily: FONT.heading, fontSize: 20, color: TH.navy },
  top: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  lines: { gap: SPACE.sm, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: TH.border },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md },
  lineLabel: { fontFamily: FONT.regular, fontSize: 14, color: TH.muted },
  lineValue: { flexShrink: 1, fontFamily: FONT.medium, fontSize: 14, color: TH.ink, textAlign: 'right' },
  signOut: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, borderRadius: 14, borderWidth: 1, borderColor: '#F4C7C3', backgroundColor: TH.surface },
  signOutText: { fontFamily: FONT.semibold, fontSize: 14, color: '#B42318' },
  footer: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted, textAlign: 'center' },
});
