import React, { useState } from 'react';
import { ActivityIndicator, Alert, View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Card, InfoRow, SectionHeading } from '../../components/teacher-home/ListParts';
import { User } from '../../types';
import { SCHOOL_INFO } from '../../utils/branding';
import { useParentChildren } from '../ParentChildContext';
import { Avatar, ParentHeader, Screen, SPACE } from '../ui';
import { classSectionLabel, NOT_RECORDED } from '../../utils/parentRules';
import type { ParentRoute } from '../routes';
import { ChangePasswordCard } from '../../components/auth/ChangePasswordCard';
import { NotificationsCard } from '../../components/NotificationsCard';
import { NOT_CONFIGURED, affiliationLine, useSchoolIdentity } from '../../services/schoolIdentity';
import { apiService } from '../../services/apiService';
import { authStorage } from '../../services/authStorage';
import { useActivity } from '../../services/activityStore';

/** The parent's own photo: the one saved this session (authStorage) wins over the login copy. */
const ownPhotoOf = (user: User) => authStorage.getUser()?.avatar || user.avatar || undefined;

interface Props {
  user: User;
  onNavigate: (r: ParentRoute) => void;
  onLogout: () => void;
}

/** Secondary destinations, the parent account and sign out. */
export const ParentMoreScreen: React.FC<Props> = ({ user, onNavigate, onLogout }) => {
  const sid = useSchoolIdentity();
  const { children, activeChild } = useParentChildren();
  const activity = useActivity();
  return (
    <Screen header={<ParentHeader title="More" />}>
      <TouchableOpacity style={styles.account} onPress={() => onNavigate('profile')} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Open profile">
        <Avatar name={user.name} photoKey={ownPhotoOf(user)} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={styles.accountName} numberOfLines={1}>
            {user.name || 'Parent'}
          </T>
          <T style={styles.accountMeta} numberOfLines={1}>
            Parent account · {children.length} {children.length === 1 ? 'child' : 'children'}
          </T>
        </View>
        <Icon name="chevron" size={16} color={TH.muted} />
      </TouchableOpacity>

      <View style={{ gap: SPACE.sm }}>
        <SectionHeading title="Your child" />
        <Card>
          <InfoRow
            icon="users"
            title="My Children"
            subtitle={activeChild ? `Viewing ${activeChild.name} · ${classSectionLabel(activeChild.className, activeChild.section)}` : 'Choose a child'}
            onPress={() => onNavigate('children')}
          />
          <InfoRow icon="calendar" title="Timetable" subtitle="Weekly class periods" onPress={() => onNavigate('timetable')} />
          <InfoRow icon="graduation-cap" title="Exam Schedule" subtitle="Dates, timings and venues" onPress={() => onNavigate('exams')} />
          <InfoRow icon="book-open" title="Homework" subtitle="Tasks and due dates" onPress={() => onNavigate('homework')} />
          <InfoRow icon="file-text" title="Report Card & Documents" subtitle="Results and student ID card" onPress={() => onNavigate('documents')} />
        </Card>
      </View>

      <View style={{ gap: SPACE.sm }}>
        <SectionHeading title="School" />
        <Card>
          <InfoRow icon="message-circle" title="Messages" subtitle="Chat with teachers, Principal, Chairman" badge={activity.messages > 0 ? `${activity.messages} new` : undefined} onPress={() => onNavigate('chat')} />
          <InfoRow icon="bell" title="Notices & Events" subtitle="Announcements, holidays and events" badge={activity.noticesNew > 0 ? `${activity.noticesNew} new` : undefined} onPress={() => onNavigate('notices')} />
        </Card>
      </View>

      <TouchableOpacity style={styles.signOut} onPress={onLogout} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Sign out">
        <Icon name="log-out" size={18} color="#B42318" />
        <T style={styles.signOutText}>Sign out</T>
      </TouchableOpacity>
      <T style={styles.footer}>{sid.name}</T>
    </Screen>
  );
};

/** Parent account details; children are managed from My Children. */
export const ParentProfileScreen: React.FC<Props & { onBack: () => void }> = ({ user, onNavigate, onLogout, onBack }) => {
  const { children } = useParentChildren();
  const [photo, setPhoto] = useState<string | undefined>(() => ownPhotoOf(user));
  const [uploading, setUploading] = useState(false);

  /** Pick a square photo from the gallery and save it as this parent's profile photo (seen by staff in chat). */
  const changePhoto = async () => {
    if (uploading) return;
    let picker: any;
    try {
      // Loaded on demand: an app build without the photo picker shows a message instead of crashing.
      picker = require('expo-image-picker');
    } catch {
      Alert.alert('Update the app', 'Please install the latest version of the app to change your photo.');
      return;
    }
    try {
      const res = await picker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (res.canceled || !res.assets?.[0]) return;
      setUploading(true);
      const r = await apiService.uploadOwnProfilePhoto(res.assets[0]);
      setUploading(false);
      if (!r.ok) return Alert.alert('Photo not saved', r.error || 'Please try again.');
      setPhoto(r.fileKey);
    } catch {
      setUploading(false);
      Alert.alert('Photo not saved', 'The photo could not be opened. Please try again.');
    }
  };

  return (
    <Screen header={<ParentHeader title="Profile" onBack={onBack} />}>
      <Card gap={SPACE.md}>
        <View style={styles.profileTop}>
          <TouchableOpacity onPress={changePhoto} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Change profile photo">
            <Avatar name={user.name} photoKey={photo} size={72} />
            <View style={styles.camBadge}>
              {uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="refresh-cw" size={13} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T style={styles.profileName}>{user.name || 'Parent'}</T>
            <T style={styles.accountMeta}>Parent / guardian</T>
            <TouchableOpacity onPress={changePhoto} disabled={uploading} accessibilityRole="button">
              <T style={styles.photoLink}>{uploading ? 'Saving photo…' : photo ? 'Change photo' : 'Add your photo'}</T>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.lines}>
          <Line label="Mobile" value={user.phone || NOT_RECORDED} />
          <Line label="Email" value={user.email || NOT_RECORDED} />
        </View>
      </Card>

      <View style={{ gap: SPACE.sm }}>
        <SectionHeading title={`Linked children (${children.length})`} action="Manage" onActionPress={() => onNavigate('children')} />
        <Card>
          {children.map((c) => (
            <View key={c.id} style={styles.childRow}>
              <Avatar name={c.name} photoKey={c.photo || c.photoFileKey} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={styles.childName} numberOfLines={1}>
                  {c.name}
                </T>
                <T style={styles.accountMeta} numberOfLines={1}>
                  {classSectionLabel(c.className, c.section)}
                </T>
              </View>
            </View>
          ))}
        </Card>
        <T style={styles.footer}>To change your mobile number or link another child, please contact the school office.</T>
      </View>

      <NotificationsCard />
        <ChangePasswordCard />
      <TouchableOpacity style={styles.signOut} onPress={onLogout} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Sign out">
        <Icon name="log-out" size={18} color="#B42318" />
        <T style={styles.signOutText}>Sign out</T>
      </TouchableOpacity>
    </Screen>
  );
};

const Line: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.line}>
    <T style={styles.lineLabel}>{label}</T>
    <T style={styles.lineValue} numberOfLines={2}>
      {value}
    </T>
  </View>
);

const styles = StyleSheet.create({
  account: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md, borderRadius: 16, borderWidth: 1, borderColor: TH.border, backgroundColor: TH.surface },
  accountName: { fontFamily: FONT.semibold, fontSize: 16, color: TH.ink },
  accountMeta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  signOut: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, borderRadius: 14, borderWidth: 1, borderColor: '#F4C7C3', backgroundColor: TH.surface },
  signOutText: { fontFamily: FONT.semibold, fontSize: 14, color: '#B42318' },
  footer: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted, textAlign: 'center' },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  camBadge: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: TH.royal, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  photoLink: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal, marginTop: 4 },
  profileName: { fontFamily: FONT.heading, fontSize: 20, color: TH.navy },
  lines: { gap: SPACE.sm, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: TH.border },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md },
  lineLabel: { fontFamily: FONT.regular, fontSize: 14, color: TH.muted },
  lineValue: { flexShrink: 1, fontFamily: FONT.medium, fontSize: 14, color: TH.ink, textAlign: 'right' },
  childRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  childName: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
});
