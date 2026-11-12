import React, { useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { BRAND_COLORS } from '../../utils/branding';
import { T } from '../../components/teacher-home/T';
import { Card, SectionHeading } from '../../components/teacher-home/ListParts';
import { LoginError, LoginField } from '../../components/LoginFields';
import { apiService } from '../../services/apiService';
import { useParentChildren, NoActiveChild } from '../../parent/ParentChildContext';
import { Avatar, ParentHeader, Screen, SPACE } from '../../parent/ui';
import { formatDisplayDate, NOT_RECORDED } from '../../utils/parentRules';
import { classRollLine } from '../../utils/studentPortalRules';

const Line: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <View style={styles.line}>
    <T style={styles.lineLabel}>{label}</T>
    <T style={styles.lineValue} numberOfLines={3}>
      {value && String(value).trim() ? String(value) : NOT_RECORDED}
    </T>
  </View>
);

const titleCase = (v?: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : '');

/** The student's own record. Phone and address can be edited here; everything else is set by the school. */
export const MyProfile: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { activeChild: s, reload } = useParentChildren();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const st: any = s || {};
  const startEdit = () => {
    setPhone(String(st.mobile || st.phone || ''));
    setAddress(String(st.address || ''));
    setError(null);
    setSaved(false);
    setEditing(true);
  };

  const save = async () => {
    const p = phone.replace(/[\s-]/g, '');
    if (p && !/^(\+?91)?[6-9]\d{9}$/.test(p)) return setError('Enter a valid 10-digit mobile number.');
    setBusy(true);
    setError(null);
    const r = await apiService.request<any>('/api/auth/profile', 'PUT', { phone: phone.trim(), address: address.trim() }, { retries: 0 });
    setBusy(false);
    if (!r.ok || r.data?.success === false) return setError(r.data?.error || r.error || 'Could not save. Please try again.');
    apiService.clearCache();
    setEditing(false);
    setSaved(true);
    reload();
  };

  return (
    <Screen header={<ParentHeader title="My Profile" onBack={onBack} />}>
      {!s ? (
        <NoActiveChild />
      ) : (
        <>
          <Card gap={SPACE.md}>
            <View style={styles.top}>
              <Avatar name={s.name} photoKey={s.photo || s.photoFileKey} size={84} />
              <T style={styles.name}>{s.name}</T>
              <T style={styles.sub}>{classRollLine(s)}</T>
            </View>
          </Card>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Student details" />
            <Card gap={SPACE.sm}>
              <Line label="Admission No." value={s.admissionNumber} />
              <Line label="Class" value={[s.className, s.section ? `Section ${s.section}` : ''].filter(Boolean).join(' · ')} />
              <Line label="Roll No." value={s.rollNumber} />
              <Line label="Date of Birth" value={s.dob ? formatDisplayDate(String(s.dob).substring(0, 10)) : ''} />
              <Line label="Gender" value={titleCase(s.gender)} />
              <Line label="Blood Group" value={st.bloodGroup} />
              <Line label="Session" value={s.academicSession} />
            </Card>
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Family" />
            <Card gap={SPACE.sm}>
              <Line label="Father's Name" value={s.fatherName} />
              <Line label="Mother's Name" value={s.motherName} />
              <Line label="Parent Contact" value={s.parentPhone || s.fatherMobile} />
            </Card>
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Contact" />
            <Card gap={SPACE.md}>
              {editing ? (
                <>
                  <LoginField label="Contact No." value={phone} onChangeText={(t) => { setPhone(t); setError(null); }} placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={14} editable={!busy} />
                  <LoginField label="Address" value={address} onChangeText={(t) => { setAddress(t); setError(null); }} placeholder="Address" autoCapitalize="none" maxLength={200} editable={!busy} />
                  <LoginError message={error} />
                  <View style={styles.btns}>
                    <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setEditing(false)} disabled={busy} accessibilityRole="button">
                      <T style={styles.btnGhostText}>Cancel</T>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={save} disabled={busy} accessibilityRole="button">
                      {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <T style={styles.btnText}>Save</T>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Line label="Contact No." value={st.mobile || st.phone} />
                  <Line label="Address" value={st.address} />
                  {saved ? <T style={styles.saved}>Saved.</T> : null}
                  <TouchableOpacity style={styles.editBtn} onPress={startEdit} accessibilityRole="button" accessibilityLabel="Edit contact details">
                    <T style={styles.editText}>Edit Profile</T>
                  </TouchableOpacity>
                </>
              )}
            </Card>
            <T style={styles.foot}>To correct your name, date of birth, class or parent details, please contact the school office.</T>
          </View>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: 6 },
  name: { fontFamily: FONT.heading, fontSize: 22, color: TH.navy, textAlign: 'center' },
  sub: { fontFamily: FONT.medium, fontSize: 13, color: TH.muted, textAlign: 'center' },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md },
  lineLabel: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  lineValue: { flexShrink: 1, fontFamily: FONT.medium, fontSize: 14, color: TH.ink, textAlign: 'right' },
  editBtn: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: BRAND_COLORS.primaryRoyal },
  editText: { fontFamily: FONT.semibold, fontSize: 14, color: '#FFFFFF' },
  btns: { flexDirection: 'row', gap: SPACE.sm },
  btn: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: BRAND_COLORS.primaryRoyal },
  btnGhost: { backgroundColor: TH.tile },
  btnText: { fontFamily: FONT.semibold, fontSize: 14, color: '#FFFFFF' },
  btnGhostText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
  saved: { fontFamily: FONT.medium, fontSize: 13, color: BRAND_COLORS.success },
  foot: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
});
