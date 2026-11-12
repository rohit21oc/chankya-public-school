import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Avatar, Banner, Pill, Screen, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { RollRow, RollSheet, wardenApi } from '../wardenApi';
import { Draft, fillRemaining, indiaDate, liveCounts, nightLabel, NightStatus, pendingEntries, shiftDate, STATUS_META, unmarkedCount } from '../wardenRules';
import { PrimaryButton, PromptSheet, SearchBox, StatusPicker, WardenHeader } from '../wardenUi';
import { filterStudents } from '../wardenRules';

interface Props {
  onOpenHistory: () => void;
  onBack?: () => void;
}

/**
 * Night roll-call. Tap P / A / L / O for each student, then Submit once. A saved student is locked: changing it
 * is a correction with a reason, which the server records in the history and the audit log.
 * Stored apart from school attendance.
 */
export const WardenAttendanceScreen: React.FC<Props> = ({ onOpenHistory, onBack }) => {
  const today = indiaDate();
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState<RollSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [fixing, setFixing] = useState<RollRow | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);

  const load = useCallback(
    async (pull = false) => {
      if (pull) setRefreshing(true);
      const r = await wardenApi.rollSheet(date);
      if (r.ok && r.data) {
        setSheet(r.data);
        setError(null);
      } else setError(r.error || 'The attendance sheet could not be loaded.');
      setLoading(false);
      setRefreshing(false);
    },
    [date]
  );

  useEffect(() => {
    setLoading(true);
    setDraft({});
    void load();
  }, [load]);

  const rows = sheet?.rows || [];
  const shown = useMemo(() => filterStudents(rows, search, 'ALL'), [rows, search]);
  const counts = liveCounts(rows, draft);
  const toSend = pendingEntries(rows, draft);
  const left = unmarkedCount(rows, draft);

  const submit = () => {
    if (!toSend.length) return;
    const go = async () => {
      setSaving(true);
      const r = await wardenApi.submitNight(date, toSend);
      setSaving(false);
      if (!r.ok) {
        Alert.alert(r.status === 409 ? 'Already saved' : 'Not saved', r.error || 'Please try again.');
        if (r.status === 409) {
          setDraft({});
          void load();
        }
        return;
      }
      setDraft({});
      await load();
      const absent = toSend.filter((e) => e.status === 'ABSENT').length;
      Alert.alert('Night attendance saved', `${r.data?.saved} student(s) saved.${absent ? ` ${absent} absent: the office has been alerted.` : ''}`);
    };
    if (left > 0) {
      Alert.alert('Some students are not marked', `${left} student(s) have no status yet. Save the others now and mark them later?`, [
        { text: 'Go back', style: 'cancel' },
        { text: 'Save', onPress: () => void go() },
      ]);
    } else void go();
  };

  const saveFix = async (reason: string, status?: NightStatus) => {
    if (!fixing?.record || !status) return;
    setFixBusy(true);
    setFixError(null);
    const r = await wardenApi.correctNight(fixing.record.id, status, reason);
    setFixBusy(false);
    if (!r.ok) {
      setFixError(r.error || 'The correction could not be saved.');
      return;
    }
    setFixing(null);
    void load();
  };

  const canGoForward = date < today;

  return (
    <Screen
      header={
        <WardenHeader
          title="Night Attendance"
          subtitle="Hostel roll-call · separate from school attendance"
          onBack={onBack}
          right={
            <TouchableOpacity onPress={onOpenHistory} style={styles.headerAction} accessibilityRole="button" accessibilityLabel="History and reports">
              <Icon name="history" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          }
        />
      }
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(shiftDate(date, -1))} accessibilityRole="button" accessibilityLabel="Previous night">
          <Icon name="chevron-left" size={20} color={TH.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T style={styles.dateTitle}>{nightLabel(date, today)}</T>
          <T style={styles.dateSub}>{date}</T>
        </View>
        <TouchableOpacity
          style={[styles.dateBtn, !canGoForward && { opacity: 0.3 }]}
          disabled={!canGoForward}
          onPress={() => setDate(shiftDate(date, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next night"
        >
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="chevron-left" size={20} color={TH.navy} />
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonList rows={6} height={72} />
      ) : !sheet ? (
        <StateBlock kind="error" title="Sheet not available" message={error || undefined} onRetry={() => load()} />
      ) : rows.length === 0 ? (
        <StateBlock kind="empty" icon="bed" title="No students in your hostel" message="Students appear here once the office allocates them a bed in your hostel." />
      ) : (
        <>
          {!!error && <Banner text={error} onRetry={() => load()} />}
          <View style={styles.counts} accessibilityRole="summary">
            <Count label="Present" value={counts.present} color={TH.ink} />
            <Count label="Absent" value={counts.absent} color="#B42318" />
            <Count label="Leave" value={counts.onLeave} color={TH.royal} />
            <Count label="Outside" value={counts.outside} color={TH.goldInk} />
            <Count label="Left" value={counts.unmarked} color={TH.muted} />
          </View>

          {sheet.submitted && (
            <Banner
              text={
                sheet.canCorrect
                  ? 'Saved students are locked. Tap "Correct" to change one; the reason is kept in the history.'
                  : sheet.correctionNote || 'This night can no longer be changed by the warden.'
              }
            />
          )}

          <SearchBox value={search} onChange={setSearch} placeholder="Search name, admission no. or room" />

          {left > 0 && (
            <TouchableOpacity style={styles.fillAll} onPress={() => setDraft(fillRemaining(rows, draft, 'PRESENT'))} accessibilityRole="button">
              <Icon name="check" size={16} color={TH.royal} />
              <View style={{ flex: 1 }}>
                <T style={styles.fillAllText}>Mark remaining {left} as Present</T>
                <T style={styles.fillAllSub}>Students with approved leave are set to On Leave</T>
              </View>
            </TouchableOpacity>
          )}

          <View style={{ gap: SPACE.sm }}>
            {shown.map((r) => {
              const saved = r.record?.status;
              const value = saved || draft[r.id] || null;
              return (
                <View key={r.id} style={[styles.row, saved && styles.rowSaved]}>
                  <View style={styles.rowTop}>
                    <Avatar name={r.name} photoKey={r.photo} size={40} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={styles.name} numberOfLines={1}>
                        {r.name}
                      </T>
                      <T style={styles.meta} numberOfLines={1}>
                        Room {r.roomNumber || '-'} · {r.bedNumber || '-'} · {r.className}
                        {r.section ? `-${r.section}` : ''}
                      </T>
                    </View>
                    {saved ? <Pill label={`${STATUS_META[saved].label}${r.record?.corrected ? ' · corrected' : ''}`} tone={STATUS_META[saved].tone} /> : r.approvedLeave ? <Pill label="Approved leave" tone="info" /> : null}
                  </View>
                  <View style={styles.rowBottom}>
                    <StatusPicker value={value} disabled={!!saved} name={r.name} onChange={(st) => setDraft((d) => ({ ...d, [r.id]: st }))} />
                    {saved && sheet.canCorrect && (
                      <TouchableOpacity
                        style={styles.fixBtn}
                        onPress={() => {
                          setFixError(null);
                          setFixing(r);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Correct ${r.name}`}
                      >
                        <T style={styles.fixText}>Correct</T>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {shown.length === 0 && <StateBlock kind="empty" title="No student matches" message="Try another name, admission number or room." />}
          </View>

          {toSend.length > 0 && (
            <PrimaryButton label={`Submit ${toSend.length} student(s)`} icon="check" busy={saving} onPress={submit} />
          )}
        </>
      )}

      <PromptSheet
        visible={!!fixing}
        title={`Correct · ${fixing?.name || ''}`}
        message={`Saved as ${fixing?.record ? STATUS_META[fixing.record.status].label : ''}. Choose the right status and write why it is being changed.`}
        placeholder="Reason (e.g. returned at 9:40 pm)"
        submitLabel="Save correction"
        withStatus={fixing?.record?.status || null}
        busy={fixBusy}
        error={fixError}
        onClose={() => setFixing(null)}
        onSubmit={saveFix}
      />
    </Screen>
  );
};

const Count: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={styles.count} accessibilityLabel={`${label}: ${value}`}>
    <T style={[styles.countValue, { color }]}>{value}</T>
    <T style={styles.countLabel}>{label}</T>
  </View>
);

const styles = StyleSheet.create({
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.sm, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  dateBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.tile },
  dateTitle: { fontFamily: FONT.heading, fontSize: 18, color: TH.navy },
  dateSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  counts: { flexDirection: 'row', padding: SPACE.md, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  count: { flex: 1, alignItems: 'center', gap: 2 },
  countValue: { fontFamily: FONT.bold, fontSize: 18 },
  countLabel: { fontFamily: FONT.medium, fontSize: 11, color: TH.muted },
  fillAll: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: 12, backgroundColor: TH.tile },
  fillAllText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal },
  fillAllSub: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  row: { gap: SPACE.sm, padding: SPACE.md, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  rowSaved: { backgroundColor: '#FBFCFE' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  name: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  fixBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: SPACE.md, borderRadius: 10, borderWidth: 1, borderColor: TH.border },
  fixText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal },
});
