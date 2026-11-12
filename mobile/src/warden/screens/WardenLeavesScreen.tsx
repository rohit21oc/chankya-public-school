import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Avatar, Banner, Pill, Screen, Segmented, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { wardenApi, WardenLeave } from '../wardenApi';
import { dialable, LEAVE_TONE } from '../wardenRules';
import { PrimaryButton, PromptSheet, WardenHeader } from '../wardenUi';

type Tab = 'PENDING' | 'CURRENT' | 'ALL';

const statusText = (l: WardenLeave) =>
  l.status === 'PENDING' ? (l.forwardedAt ? 'With Principal' : 'Pending') : l.status.charAt(0) + l.status.slice(1).toLowerCase();

/**
 * Leave requests the parents of the warden's students submitted (the school's existing student-leave records;
 * nothing new is created here). A warden cannot approve: they forward a request to the Principal with a note.
 * If the server ever says this login may approve, Approve / Reject appear instead.
 */
export const WardenLeavesScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tab, setTab] = useState<Tab>('PENDING');
  const [list, setList] = useState<WardenLeave[]>([]);
  const [current, setCurrent] = useState<WardenLeave[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState<WardenLeave | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    const r = await wardenApi.leaves('ALL');
    if (r.ok && r.data) {
      setList(r.data.list);
      setCurrent(r.data.current);
      setCanApprove(r.data.canApprove);
      setError(null);
    } else setError(r.error || 'Leave requests could not be loaded.');
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = tab === 'CURRENT' ? current : tab === 'PENDING' ? list.filter((l) => l.status === 'PENDING') : list;
  const pendingCount = list.filter((l) => l.status === 'PENDING').length;

  const forward = async (note: string) => {
    if (!forwarding) return;
    setBusy(true);
    setSheetError(null);
    const r = await wardenApi.forwardLeave(forwarding.id, note);
    setBusy(false);
    if (!r.ok) return setSheetError(r.error || 'The leave could not be forwarded.');
    setForwarding(null);
    void load();
  };

  const decide = (l: WardenLeave, status: 'APPROVED' | 'REJECTED') => {
    Alert.alert(status === 'APPROVED' ? 'Approve leave?' : 'Reject leave?', `${l.studentName}: ${l.startDate} to ${l.endDate}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: status === 'APPROVED' ? 'Approve' : 'Reject',
        style: status === 'REJECTED' ? 'destructive' : 'default',
        onPress: async () => {
          const r = await wardenApi.decideLeave(l.id, status);
          if (!r.ok) Alert.alert('Not saved', r.error || 'Please try again.');
          void load();
        },
      },
    ]);
  };

  return (
    <Screen header={<WardenHeader title="Leave Requests" subtitle="From parents of your hostel students" onBack={onBack} />} refreshing={refreshing} onRefresh={() => load(true)}>
      <Segmented<Tab>
        options={[
          { value: 'PENDING', label: `Pending${pendingCount ? ` (${pendingCount})` : ''}` },
          { value: 'CURRENT', label: `On leave (${current.length})` },
          { value: 'ALL', label: 'All' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {!canApprove && !loading && <Banner text="Approval is done by the Principal. Check the request and forward it with your note." />}

      {loading ? (
        <SkeletonList rows={4} height={140} />
      ) : error && !list.length ? (
        <StateBlock kind="error" title="Leave requests not available" message={error} onRetry={() => load()} />
      ) : shown.length === 0 ? (
        <StateBlock
          kind="empty"
          icon="calendar"
          title={tab === 'CURRENT' ? 'Nobody is on leave today' : tab === 'PENDING' ? 'No pending requests' : 'No leave requests yet'}
          message="Requests that parents submit in the app appear here."
        />
      ) : (
        <View style={{ gap: SPACE.md }}>
          {shown.map((l) => (
            <View key={l.id} style={styles.card}>
              <View style={styles.top}>
                <Avatar name={l.studentName} photoKey={l.studentPhoto} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={styles.name} numberOfLines={1}>
                    {l.studentName}
                  </T>
                  <T style={styles.meta} numberOfLines={1}>
                    {l.className}
                    {l.section ? `-${l.section}` : ''} · Room {l.roomNumber || '-'}
                  </T>
                </View>
                <Pill label={statusText(l)} tone={l.status === 'PENDING' && l.forwardedAt ? 'info' : LEAVE_TONE[l.status] || 'neutral'} />
              </View>

              <View style={styles.dates}>
                <View style={{ flex: 1 }}>
                  <T style={styles.k}>From</T>
                  <T style={styles.v}>{l.startDate}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T style={styles.k}>To</T>
                  <T style={styles.v}>{l.endDate}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T style={styles.k}>Days</T>
                  <T style={styles.v}>{l.daysCount ?? '-'}</T>
                </View>
              </View>
              <T style={styles.reason}>{l.reason}</T>

              <View style={styles.parent}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={styles.k}>Parent</T>
                  <T style={styles.v} numberOfLines={1}>
                    {l.parentName || l.appliedByName || '-'}
                    {l.parentPhone ? ` · ${l.parentPhone}` : ''}
                  </T>
                </View>
                {!!dialable(l.parentPhone) && (
                  <TouchableOpacity style={styles.call} onPress={() => Linking.openURL(`tel:${dialable(l.parentPhone)}`).catch(() => undefined)} accessibilityRole="button" accessibilityLabel={`Call ${l.parentName || 'parent'}`}>
                    <Icon name="phone" size={18} color={TH.royal} />
                  </TouchableOpacity>
                )}
              </View>

              {!!l.forwardedAt && (
                <T style={styles.note}>
                  Forwarded by {l.forwardedByName}
                  {l.forwardNote ? `: “${l.forwardNote}”` : ''}
                </T>
              )}
              {l.status !== 'PENDING' && !!l.approvedBy && (
                <T style={styles.note}>
                  {statusText(l)} by {l.approvedBy}
                  {l.remarks ? ` · ${l.remarks}` : ''}
                </T>
              )}

              {l.status === 'PENDING' &&
                (canApprove ? (
                  <View style={styles.btns}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton label="Reject" tone="outline" onPress={() => decide(l, 'REJECTED')} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton label="Approve" onPress={() => decide(l, 'APPROVED')} />
                    </View>
                  </View>
                ) : !l.forwardedAt ? (
                  <PrimaryButton
                    label="Forward to Principal"
                    tone="gold"
                    onPress={() => {
                      setSheetError(null);
                      setForwarding(l);
                    }}
                  />
                ) : null)}
            </View>
          ))}
        </View>
      )}

      <PromptSheet
        visible={!!forwarding}
        title="Forward to Principal"
        message={forwarding ? `${forwarding.studentName}: ${forwarding.startDate} to ${forwarding.endDate}. Add what you checked (e.g. spoke to the parent).` : undefined}
        placeholder="Your note for the Principal"
        submitLabel="Forward"
        minLength={0}
        busy={busy}
        error={sheetError}
        onClose={() => setForwarding(null)}
        onSubmit={(note) => void forward(note)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: { gap: SPACE.md, padding: SPACE.lg, borderRadius: 18, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  top: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  name: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  dates: { flexDirection: 'row', gap: SPACE.sm, padding: SPACE.md, borderRadius: 12, backgroundColor: TH.bg },
  k: { fontFamily: FONT.medium, fontSize: 11, color: TH.muted },
  v: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  reason: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: TH.ink },
  parent: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  call: { width: 44, height: 44, borderRadius: 12, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
  btns: { flexDirection: 'row', gap: SPACE.sm },
});
