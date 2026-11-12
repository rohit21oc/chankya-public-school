import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { T } from '../teacher-home/T';
import { Icon } from '../teacher-home/Icon';
import { FONT, TH } from '../../theme/teacherHome';
import { apiService } from '../../services/apiService';
import { relTime } from './ChatInbox';
import { PersonPhoto, classLabel } from './PersonPhoto';

/**
 * Students with pending fee, and a one-tap "fee due" alert to their parents.
 * The alert lands in the parent's chat, and the parent app shows a popup while
 * any fee is pending, with a Pay now button.
 */
const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export const FeeDuesPanel: React.FC<{ onOpenChat: (s: { id: string; name: string; photo?: string }) => void }> = ({ onOpenChat }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cls, setCls] = useState('All');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiService.getFeeDuesSummary();
    if (r.ok) {
      setRows(r.data);
      setError(null);
    } else setError(r.error || 'Fee dues could not be loaded.');
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const classes = useMemo(() => ['All', ...Array.from(new Set(rows.map((r) => r.className).filter(Boolean))).sort((a: any, b: any) => String(a).localeCompare(String(b), 'en', { numeric: true }))], [rows]);
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter(
      (r) =>
        (cls === 'All' || r.className === cls) &&
        (!onlyOverdue || r.overdue > 0) &&
        (!words.length || words.every((w) => [r.studentName, r.admissionNumber, r.fatherName, classLabel(r)].some((x) => String(x || '').toLowerCase().includes(w))))
    );
  }, [rows, cls, onlyOverdue, q]);
  const total = useMemo(() => list.reduce((s, r) => s + r.totalPending, 0), [list]);
  const overdueTotal = useMemo(() => list.reduce((s, r) => s + r.overdue, 0), [list]);
  const allOn = list.length > 0 && list.every((r) => selected.has(r.studentId));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // Select all acts on the students shown; ticks on hidden students (other search / class) stay.
  const toggleAll = () =>
    setSelected((cur) => {
      const n = new Set(cur);
      list.forEach((r) => (allOn ? n.delete(r.studentId) : n.add(r.studentId)));
      return n;
    });

  const send = () => {
    const ids = rows.filter((r) => selected.has(r.studentId)).map((r) => r.studentId);
    if (!ids.length) return;
    Alert.alert(
      `Send fee reminder to ${ids.length} parent${ids.length > 1 ? 's' : ''}?`,
      'They will get a phone notification with a Pay now button, a message in their chat, and a popup in the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            const r = await apiService.sendFeeDueAlerts(ids, { note: note.trim() || undefined });
            setSending(false);
            if (!r.ok) return Alert.alert('Not sent', r.error || 'Please try again.');
            let msg = `Reminder sent to ${r.sent} parent${r.sent === 1 ? '' : 's'}.`;
            if (r.skipped) msg += ` ${r.skipped} skipped (no dues).`;
            setResult(msg);
            setSelected(new Set());
            setNote('');
            load();
          },
        },
      ]
    );
  };

  if (loading) return <ActivityIndicator color={TH.royal} style={{ marginTop: 24 }} />;
  if (error)
    return (
      <Pressable onPress={load}>
        <T style={s.error}>{error} Tap to retry.</T>
      </Pressable>
    );

  return (
    <View style={{ gap: 12 }}>
      <View style={s.summary}>
        <View style={{ flex: 1 }}>
          <T style={s.sumLabel}>Total pending</T>
          <T style={s.sumValue}>{inr(total)}</T>
          <T style={s.sumSub}>{list.length} student{list.length === 1 ? '' : 's'}</T>
        </View>
        <View style={s.sumDivider} />
        <View style={{ flex: 1 }}>
          <T style={s.sumLabel}>Overdue</T>
          <T style={[s.sumValue, { color: '#FDA29B' }]}>{inr(overdueTotal)}</T>
          <T style={s.sumSub}>past due date</T>
        </View>
      </View>

      {selected.size > 0 && (
        <View style={s.topBar}>
          <T style={s.topBarText}>{selected.size} selected</T>
          <Pressable onPress={send} disabled={sending} style={s.topSend} accessibilityRole="button" accessibilityLabel={`Send fee reminder to ${selected.size} parents`}>
            {sending ? <ActivityIndicator color="#FFFFFF" /> : <T style={s.topSendText}>Send reminder</T>}
          </Pressable>
        </View>
      )}

      {result && <T style={s.ok}>{result}</T>}

      <View style={s.search}>
        <Icon name="users" size={16} color={TH.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search student, admission no. or father’s name" placeholderTextColor={TH.muted} style={s.searchInput} accessibilityLabel="Search students with fee due" />
        {!!q && (
          <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Icon name="x" size={16} color={TH.muted} />
          </Pressable>
        )}
      </View>

      <View style={s.wrap}>
        {classes.slice(0, 16).map((c) => (
          <Pressable key={c} onPress={() => setCls(c)} style={[s.chip, cls === c && s.chipOn]}>
            <T style={[s.chipText, cls === c && s.chipTextOn]}>{c === 'All' ? 'All classes' : classLabel({ className: c })}</T>
          </Pressable>
        ))}
        <Pressable onPress={() => setOnlyOverdue((x) => !x)} style={[s.chip, onlyOverdue && { backgroundColor: '#B42318', borderColor: '#B42318' }]}>
          <T style={[s.chipText, onlyOverdue && s.chipTextOn]}>Overdue only</T>
        </Pressable>
      </View>

      {list.length === 0 ? (
        <View style={s.empty}>
          <Icon name="check" size={30} color="#067647" />
          <T style={s.emptyText}>{q.trim() ? `No student with fee due matches “${q.trim()}”.` : 'No pending fee here. 🎉'}</T>
        </View>
      ) : (
        <View style={s.card}>
          <Pressable onPress={toggleAll} style={[s.row, { backgroundColor: TH.bg }]}>
            <View style={[s.check, allOn && s.checkOn]}>{allOn && <Icon name="check" size={14} color="#FFFFFF" />}</View>
            <T style={[s.name, { flex: 1 }]}>Select all ({list.length})</T>
          </Pressable>
          {list.map((r) => {
            const on = selected.has(r.studentId);
            return (
              <View key={r.studentId} style={[s.row, s.rowBorder]}>
                <Pressable onPress={() => toggle(r.studentId)} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <View style={[s.check, on && s.checkOn]}>{on && <Icon name="check" size={14} color="#FFFFFF" />}</View>
                </Pressable>
                <PersonPhoto name={r.studentName} photo={r.studentPhoto} size={38} />
                <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => toggle(r.studentId)}>
                  <T style={s.name} numberOfLines={1}>{r.studentName}</T>
                  <T style={s.meta} numberOfLines={1}>
                    {[classLabel(r), r.admissionNumber, r.fatherName && `Father: ${r.fatherName}`].filter(Boolean).join(' · ')}
                  </T>
                  {!!r.lastAlertAt && <T style={s.meta} numberOfLines={1}>{`Reminded ${relTime(r.lastAlertAt)} ago`}</T>}
                </Pressable>
                <View style={{ alignItems: 'flex-end' }}>
                  <T style={s.amt}>{inr(r.totalPending)}</T>
                  {r.overdue > 0 && <T style={s.overdue}>{inr(r.overdue)} overdue</T>}
                </View>
                <Pressable onPress={() => onOpenChat({ id: r.studentId, name: r.studentName, photo: r.studentPhoto })} style={s.chatBtn} accessibilityLabel={`Chat with parent of ${r.studentName}`}>
                  <Icon name="message-circle" size={16} color={TH.royal} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {selected.size > 0 && (
        <View style={s.sendBox}>
          <TextInput value={note} onChangeText={setNote} placeholder="Add a note (optional), e.g. Last date 30 Oct" placeholderTextColor={TH.muted} style={s.input} maxLength={300} />
          <Pressable onPress={send} disabled={sending} style={s.sendBtn} accessibilityRole="button">
            {sending ? <ActivityIndicator color="#FFFFFF" /> : <T style={s.sendText}>Send fee reminder to {selected.size} parent{selected.size > 1 ? 's' : ''}</T>}
          </Pressable>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 14, borderRadius: 14, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA' },
  topBarText: { flex: 1, fontFamily: FONT.semibold, fontSize: 14, color: '#7A271A' },
  topSend: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#B42318', alignItems: 'center', justifyContent: 'center' },
  topSendText: { fontFamily: FONT.semibold, fontSize: 14, color: '#FFFFFF' },
  summary: { flexDirection: 'row', backgroundColor: TH.navy, borderRadius: 18, padding: 16, gap: 12 },
  sumLabel: { fontFamily: FONT.medium, fontSize: 12, color: TH.onNavyMuted },
  sumValue: { fontFamily: FONT.heading, fontSize: 24, color: '#FFFFFF', marginTop: 2 },
  sumSub: { fontFamily: FONT.regular, fontSize: 11, color: TH.onNavyMuted },
  sumDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  ok: { fontFamily: FONT.medium, fontSize: 13, color: '#067647', backgroundColor: '#ECFDF3', padding: 10, borderRadius: 10 },
  error: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318', textAlign: 'center', padding: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  search: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontFamily: FONT.regular, fontSize: 14, color: TH.ink, minHeight: 44 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { backgroundColor: TH.royal, borderColor: TH.royal },
  chipText: { fontFamily: FONT.medium, fontSize: 12, color: TH.ink },
  chipTextOn: { color: '#FFFFFF' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyText: { fontFamily: FONT.medium, fontSize: 14, color: TH.muted },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: TH.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkOn: { backgroundColor: TH.royal, borderColor: TH.royal },
  name: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  amt: { fontFamily: FONT.bold, fontSize: 14, color: TH.navy },
  overdue: { fontFamily: FONT.semibold, fontSize: 11, color: '#B42318' },
  chatBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  sendBox: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, padding: 12, gap: 10 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: TH.bg, paddingHorizontal: 12, fontFamily: FONT.regular, fontSize: 14, color: TH.ink },
  sendBtn: { minHeight: 50, borderRadius: 14, backgroundColor: '#B42318', alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: FONT.semibold, fontSize: 15, color: '#FFFFFF' },
});
