import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon, IconName } from '../../components/teacher-home/Icon';
import { Card, SectionHeading } from '../../components/teacher-home/ListParts';
import { Avatar, Pill, Screen, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { HostelStudentProfile, wardenApi } from '../wardenApi';
import { dialable, LEAVE_TONE, nightLabel, STATUS_META } from '../wardenRules';
import { WardenHeader } from '../wardenUi';

interface Props {
  studentId: string;
  onBack: () => void;
  onMessageParent: (s: { id: string; name?: string; photo?: string }) => void;
}

const call = (phone?: string | null) => {
  const n = dialable(phone);
  if (!n) return Alert.alert('No number', 'No phone number is saved for this contact.');
  Linking.openURL(`tel:${n}`).catch(() => Alert.alert('Cannot call', 'This phone cannot start a call.'));
};

/** One resident: details, room and bed, parent and emergency contacts (call / message), recent nights and leaves. */
export const WardenStudentProfileScreen: React.FC<Props> = ({ studentId, onBack, onMessageParent }) => {
  const [p, setP] = useState<HostelStudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pull = false) => {
      if (pull) setRefreshing(true);
      const r = await wardenApi.student(studentId);
      if (r.ok && r.data) {
        setP(r.data);
        setError(null);
      } else setError(r.error || 'This student could not be opened.');
      setLoading(false);
      setRefreshing(false);
    },
    [studentId]
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen header={<WardenHeader title="Student Profile" onBack={onBack} />} refreshing={refreshing} onRefresh={() => load(true)}>
      {loading ? (
        <SkeletonList rows={4} height={90} />
      ) : !p ? (
        <StateBlock kind="error" title="Profile not available" message={error || undefined} onRetry={() => load()} />
      ) : (
        <>
          <View style={styles.hero}>
            <Avatar name={p.name} photoKey={p.photo} size={72} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T style={styles.heroName}>{p.name}</T>
              <T style={styles.heroMeta}>
                {p.className}
                {p.section ? `-${p.section}` : ''}
                {p.rollNumber ? ` · Roll ${p.rollNumber}` : ''}
              </T>
              <T style={styles.heroMeta}>Adm. {p.admissionNumber || '-'}</T>
            </View>
          </View>

          <View style={styles.roomCard}>
            <RoomFact icon="bed" label="Hostel" value={p.hostelName || '-'} />
            <RoomFact icon="house" label="Room" value={`${p.roomNumber || '-'}${p.floor ? ` · Floor ${p.floor}` : ''}`} />
            <RoomFact icon="id-card" label="Bed" value={p.bedNumber || '-'} />
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Parent" />
            <Card gap={SPACE.md}>
              <ContactLine label={p.parent.name || p.fatherName || 'Parent'} sub={p.parent.phone || 'No number saved'} />
              <View style={styles.actions}>
                <Action icon="phone" label="Call" onPress={() => call(p.parent.phone)} disabled={!dialable(p.parent.phone)} />
                <Action icon="message-circle" label="Message" onPress={() => onMessageParent({ id: p.id, name: p.name, photo: p.photo })} />
              </View>
            </Card>
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Emergency contact" />
            <Card gap={SPACE.md}>
              {p.emergency.phone || p.emergency.name ? (
                <View style={styles.contactRow}>
                  <ContactLine label={`${p.emergency.name || 'Emergency contact'}${p.emergency.relationship ? ` (${p.emergency.relationship})` : ''}`} sub={p.emergency.phone || 'No number saved'} />
                  {!!dialable(p.emergency.phone) && <Action icon="phone" label="Call" onPress={() => call(p.emergency.phone)} />}
                </View>
              ) : (
                <T style={styles.muted}>No emergency contact saved. The office can add it in the student record.</T>
              )}
              {!!(p.emergency.secondaryPhone || p.emergency.secondaryName) && (
                <View style={styles.contactRow}>
                  <ContactLine label={p.emergency.secondaryName || 'Second contact'} sub={p.emergency.secondaryPhone || '-'} />
                  {!!dialable(p.emergency.secondaryPhone) && <Action icon="phone" label="Call" onPress={() => call(p.emergency.secondaryPhone)} />}
                </View>
              )}
            </Card>
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Personal details" />
            <Card gap={SPACE.sm}>
              <Line label="Father" value={p.fatherName} />
              <Line label="Mother" value={p.motherName} />
              {!!p.guardianName && <Line label="Guardian" value={p.guardianName} />}
              <Line label="Date of birth" value={p.dob} />
              <Line label="Blood group" value={p.bloodGroup} />
              <Line label="Address" value={p.address} />
              <Line label="In hostel since" value={p.allocationDate} />
            </Card>
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Recent nights" />
            <Card gap={SPACE.sm}>
              {p.recentNights.length === 0 ? (
                <T style={styles.muted}>No night attendance saved yet.</T>
              ) : (
                p.recentNights.map((n) => (
                  <View key={n.date} style={styles.lineRow}>
                    <T style={styles.lineLabel}>{nightLabel(n.date)}</T>
                    <Pill label={STATUS_META[n.status].label} tone={STATUS_META[n.status].tone} />
                  </View>
                ))
              )}
            </Card>
          </View>

          {p.leaves.length > 0 && (
            <View style={{ gap: SPACE.sm }}>
              <SectionHeading title="Leave requests" />
              <Card gap={SPACE.sm}>
                {p.leaves.map((l) => (
                  <View key={l.id} style={styles.lineRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={styles.lineValueLeft}>
                        {l.startDate} → {l.endDate}
                      </T>
                      <T style={styles.muted} numberOfLines={1}>
                        {l.reason}
                      </T>
                    </View>
                    <Pill label={l.status === 'PENDING' && l.forwardedAt ? 'With Principal' : l.status.charAt(0) + l.status.slice(1).toLowerCase()} tone={LEAVE_TONE[l.status] || 'neutral'} />
                  </View>
                ))}
              </Card>
            </View>
          )}
        </>
      )}
    </Screen>
  );
};

const RoomFact: React.FC<{ icon: IconName; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.fact}>
    <Icon name={icon} size={18} color={TH.gold} />
    <T style={styles.factLabel}>{label}</T>
    <T style={styles.factValue} numberOfLines={2}>
      {value}
    </T>
  </View>
);

const ContactLine: React.FC<{ label: string; sub: string }> = ({ label, sub }) => (
  <View style={{ flex: 1, minWidth: 0 }}>
    <T style={styles.contactName} numberOfLines={1}>
      {label}
    </T>
    <T style={styles.muted}>{sub}</T>
  </View>
);

const Action: React.FC<{ icon: IconName; label: string; onPress: () => void; disabled?: boolean }> = ({ icon, label, onPress, disabled }) => (
  <TouchableOpacity style={[styles.action, disabled && { opacity: 0.45 }]} onPress={onPress} disabled={disabled} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={label}>
    <Icon name={icon} size={18} color={TH.royal} />
    <T style={styles.actionText}>{label}</T>
  </TouchableOpacity>
);

const Line: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <View style={styles.lineRow}>
    <T style={styles.lineLabel}>{label}</T>
    <T style={styles.lineValue} numberOfLines={3}>
      {value || 'Not recorded'}
    </T>
  </View>
);

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderRadius: 18, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  heroName: { fontFamily: FONT.heading, fontSize: 21, color: TH.navy },
  heroMeta: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  roomCard: { flexDirection: 'row', gap: SPACE.sm, padding: SPACE.md, borderRadius: 18, backgroundColor: TH.navy },
  fact: { flex: 1, gap: 2, alignItems: 'flex-start', padding: SPACE.sm },
  factLabel: { fontFamily: FONT.medium, fontSize: 11, color: TH.onNavyMuted, marginTop: 4 },
  factValue: { fontFamily: FONT.semibold, fontSize: 14, color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: SPACE.sm },
  action: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, borderRadius: 12, backgroundColor: TH.tile, paddingHorizontal: SPACE.md },
  actionText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  contactName: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  muted: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18, color: TH.muted },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, minHeight: 32 },
  lineLabel: { fontFamily: FONT.regular, fontSize: 14, color: TH.muted },
  lineValue: { flexShrink: 1, fontFamily: FONT.medium, fontSize: 14, color: TH.ink, textAlign: 'right' },
  lineValueLeft: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
});
