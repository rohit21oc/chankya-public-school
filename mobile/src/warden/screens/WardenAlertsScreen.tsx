import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Pill, Screen, Segmented, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { HostelAlert, wardenApi } from '../wardenApi';
import { PrimaryButton, PromptSheet, TONE_COLORS, WardenHeader } from '../wardenUi';

const when = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
};

/** Hostel alerts: absent-at-night (raised automatically by roll-call) and emergencies the warden raises. */
export const WardenAlertsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tab, setTab] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [list, setList] = useState<HostelAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raise, setRaise] = useState(false);
  const [resolving, setResolving] = useState<HostelAlert | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const load = useCallback(
    async (pull = false) => {
      if (pull) setRefreshing(true);
      const r = await wardenApi.alerts(tab);
      if (r.ok) {
        setList(r.data || []);
        setError(null);
      } else setError(r.error || 'Alerts could not be loaded.');
      setLoading(false);
      setRefreshing(false);
    },
    [tab]
  );
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const submitEmergency = async (message: string) => {
    setBusy(true);
    setSheetError(null);
    const r = await wardenApi.raiseEmergency(message);
    setBusy(false);
    if (!r.ok) return setSheetError(r.error || 'The alert could not be sent.');
    setRaise(false);
    setTab('OPEN');
    void load();
  };

  const submitResolve = async (text: string) => {
    if (!resolving) return;
    setBusy(true);
    setSheetError(null);
    const r = await wardenApi.resolveAlert(resolving.id, text);
    setBusy(false);
    if (!r.ok) return setSheetError(r.error || 'Could not save.');
    setResolving(null);
    void load();
  };

  return (
    <Screen header={<WardenHeader title="Alerts" subtitle="Absent at night and emergencies" onBack={onBack} />} refreshing={refreshing} onRefresh={() => load(true)}>
      <PrimaryButton
        label="Raise emergency alert"
        icon="triangle-alert"
        tone="danger"
        onPress={() => {
          setSheetError(null);
          setRaise(true);
        }}
      />
      <Segmented<'OPEN' | 'RESOLVED'> options={[{ value: 'OPEN', label: 'Open' }, { value: 'RESOLVED', label: 'Resolved' }]} value={tab} onChange={setTab} />
      {loading ? (
        <SkeletonList rows={3} height={100} />
      ) : error && !list.length ? (
        <StateBlock kind="error" title="Alerts not available" message={error} onRetry={() => load()} />
      ) : list.length === 0 ? (
        <StateBlock kind="empty" icon="check" title={tab === 'OPEN' ? 'No open alerts' : 'No resolved alerts yet'} message={tab === 'OPEN' ? 'Students marked absent at night roll-call raise an alert here automatically.' : undefined} />
      ) : (
        <View style={{ gap: SPACE.md }}>
          {list.map((a) => {
            const tone = a.type === 'EMERGENCY' ? 'danger' : 'warning';
            return (
              <View key={a.id} style={styles.card}>
                <View style={styles.top}>
                  <View style={[styles.icon, { backgroundColor: TONE_COLORS[tone].bg }]}>
                    <Icon name={a.type === 'EMERGENCY' ? 'triangle-alert' : 'moon'} size={20} color={TONE_COLORS[tone].fg} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={styles.title}>{a.type === 'EMERGENCY' ? 'Emergency' : 'Absent at night'}</T>
                    <T style={styles.meta}>
                      {when(a.createdAt)} · {a.createdByName || 'System'}
                    </T>
                  </View>
                  <Pill label={a.status === 'OPEN' ? 'Open' : 'Resolved'} tone={a.status === 'OPEN' ? tone : 'success'} />
                </View>
                <T style={styles.msg}>{a.message}</T>
                {a.status === 'RESOLVED' ? (
                  <T style={styles.meta}>
                    Resolved {when(a.resolvedAt)} by {a.resolvedByName}: {a.resolution}
                  </T>
                ) : (
                  <TouchableOpacity
                    style={styles.resolve}
                    onPress={() => {
                      setSheetError(null);
                      setResolving(a);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Mark resolved"
                  >
                    <Icon name="check" size={16} color={TH.royal} />
                    <T style={styles.resolveText}>Mark resolved</T>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      <PromptSheet
        visible={raise}
        title="Emergency alert"
        message="The Principal and the office get a notification right away. For a student, mention their name and room."
        placeholder="What happened?"
        submitLabel="Send alert"
        tone="danger"
        minLength={5}
        busy={busy}
        error={sheetError}
        onClose={() => setRaise(false)}
        onSubmit={(t) => void submitEmergency(t)}
      />
      <PromptSheet
        visible={!!resolving}
        title="Mark resolved"
        message={resolving?.message}
        placeholder="How was it resolved?"
        submitLabel="Resolve"
        busy={busy}
        error={sheetError}
        onClose={() => setResolving(null)}
        onSubmit={(t) => void submitResolve(t)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: { gap: SPACE.sm, padding: SPACE.lg, borderRadius: 18, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  top: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
  msg: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: TH.ink },
  resolve: { alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACE.md, borderRadius: 10, backgroundColor: TH.tile },
  resolveText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal },
});
