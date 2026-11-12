import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardFrame } from '../components/ui/KeyboardFrame';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { T } from '../components/teacher-home/T';
import { Icon } from '../components/teacher-home/Icon';
import { FONT, TH } from '../theme/teacherHome';
import { apiService } from '../services/apiService';
import { Enquiry, STATUS_UI, countByKind, filterEnquiries, isNew, kindOf, relativeTime, statusOf, telUrl, whatsappUrl, whenOf } from '../utils/enquiryModel';

/**
 * Admission enquiries and quick call requests from the public website: the same records the web
 * admin sees. The office can call or WhatsApp, move a lead through the follow-up stages, and keep notes.
 */
interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

type KindTab = 'ALL' | 'ENQUIRY' | 'CALLBACK';
type StatusTab = 'ALL' | 'NEW' | 'OPEN' | 'DONE';
const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'NEW', label: 'New' },
  { id: 'OPEN', label: 'In progress' },
  { id: 'DONE', label: 'Closed' },
  { id: 'ALL', label: 'All' },
];

const Pill: React.FC<{ status: string }> = ({ status }) => {
  const ui = STATUS_UI.find((x) => x.value === statusOf(status));
  return (
    <View style={[s.pill, { backgroundColor: ui?.bg || '#EAECF0' }]}>
      <T style={[s.pillText, { color: ui?.fg || '#344054' }]}>{ui?.label || status}</T>
    </View>
  );
};

export const EnquiriesScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile }) => {
  const [list, setList] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<KindTab>('ALL');
  const [status, setStatus] = useState<StatusTab>('NEW');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Enquiry | null>(null);
  const [notes, setNotes] = useState('');
  const [follow, setFollow] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await apiService.getEnquiries({ fresh: true });
    if (r.ok) {
      setList(r.data as Enquiry[]);
      setError(null);
    } else {
      setError(r.error || 'Could not load enquiries.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => countByKind(list), [list]);
  const shown = useMemo(() => filterEnquiries(list, kind, status, query), [list, kind, status, query]);

  const show = (e: Enquiry) => {
    setOpen(e);
    setNotes(e.notes || '');
    setFollow(e.followUpDate || '');
    setMsg(null);
  };

  const save = async (patch: { status?: string; notes?: string; followUpDate?: string }, okText: string) => {
    if (!open || busy) return;
    if (patch.followUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(patch.followUpDate)) {
      setMsg({ ok: false, text: 'Use the date as YYYY-MM-DD, for example 2026-11-05.' });
      return;
    }
    setBusy(true);
    const r = await apiService.updateEnquiry(open.id, patch);
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error || 'Could not save. Please try again.' });
      return;
    }
    const next = { ...open, ...(r.enquiry || patch) } as Enquiry;
    setOpen(next);
    setList((cur) => cur.map((x) => (x.id === next.id ? next : x)));
    setMsg({ ok: true, text: okText });
  };

  const dial = (e: Enquiry) => void Linking.openURL(telUrl(e.mobile)).catch(() => undefined);
  const chat = (e: Enquiry) => void Linking.openURL(whatsappUrl(e)).catch(() => undefined);

  const renderCard = (e: Enquiry) => {
    const cb = kindOf(e) === 'CALLBACK';
    return (
      <View key={e.id} style={[s.card, isNew(e) && s.cardNew]}>
        <Pressable onPress={() => show(e)} accessibilityRole="button" accessibilityLabel={`${cb ? 'Quick call' : 'Admission enquiry'} from ${e.parentName}`} style={{ gap: 6 }}>
          <View style={s.cardTop}>
            <T style={[s.kind, { color: cb ? '#B42318' : TH.royal }]}>{cb ? 'Quick call' : 'Admission enquiry'}</T>
            <T style={s.when}>{relativeTime(whenOf(e))}</T>
          </View>
          <View style={s.cardTop}>
            <T style={s.name} numberOfLines={1}>{cb ? e.parentName : e.studentName || e.parentName}</T>
            <Pill status={e.status} />
          </View>
          <T style={s.meta} numberOfLines={1}>
            {cb ? `${e.mobile}${e.preferredTime ? ` · best time: ${e.preferredTime}` : ''}` : `${e.parentName}${e.classApplying ? ` · ${e.classApplying}` : ''}`}
          </T>
          {!!e.followUpDate && <T style={s.follow}>Follow up {e.followUpDate}</T>}
        </Pressable>
        <View style={s.actions}>
          <Pressable onPress={() => dial(e)} style={[s.btn, s.btnCall]} accessibilityRole="button" accessibilityLabel={`Call ${e.parentName}`}>
            <T style={[s.btnText, { color: '#FFFFFF' }]}>Call</T>
          </Pressable>
          <Pressable onPress={() => chat(e)} style={[s.btn, s.btnGhost]} accessibilityRole="button" accessibilityLabel={`WhatsApp ${e.parentName}`}>
            <T style={s.btnText}>WhatsApp</T>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="Enquiries" subtitle={counts.NEW > 0 ? `${counts.NEW} new` : 'All followed up'} />

      <View style={s.segment}>
        {([['ALL', 'All', counts.ALL], ['ENQUIRY', 'Admission', counts.ENQUIRY], ['CALLBACK', 'Quick calls', counts.CALLBACK]] as [KindTab, string, number][]).map(([id, label, n]) => (
          <Pressable key={id} onPress={() => setKind(id)} style={[s.segBtn, kind === id && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: kind === id }}>
            <T style={[s.segText, kind === id && s.segTextOn]}>{label}</T>
            <T style={[s.segCount, kind === id && s.segTextOn]}>{n}</T>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search name, mobile or reference" placeholderTextColor={TH.muted} style={s.input} accessibilityLabel="Search enquiries" autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATUS_TABS.map((t) => (
            <Pressable key={t.id} onPress={() => setStatus(t.id)} style={[s.chip, status === t.id && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: status === t.id }}>
              <T style={[s.chipText, status === t.id && s.chipTextOn]}>{t.label}</T>
            </Pressable>
          ))}
        </ScrollView>

        {error && (
          <View style={s.errorBox}>
            <T style={s.error}>{error}</T>
            <Pressable onPress={() => { setLoading(true); void load(); }} style={s.retry} accessibilityRole="button"><T style={s.retryText}>Retry</T></Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={TH.royal} style={{ marginTop: 32 }} />
        ) : shown.length === 0 && !error ? (
          <View style={s.empty}>
            <Icon name="check" size={28} color={TH.muted} />
            <T style={s.emptyText}>{list.length === 0 ? 'No enquiries yet. New ones from the website will appear here.' : status === 'NEW' ? 'Nothing new. Everyone has had a first response.' : 'Nothing matches.'}</T>
          </View>
        ) : (
          shown.map(renderCard)
        )}
      </ScrollView>

      <Modal visible={!!open} animationType="slide" onRequestClose={() => !busy && setOpen(null)} statusBarTranslucent navigationBarTranslucent>
        <SafeAreaView style={s.safe}>
          <KeyboardFrame own>
            {open && (
              <>
                <View style={s.pickHead}>
                  <View style={{ flex: 1 }}>
                    <T style={[s.kind, { color: kindOf(open) === 'CALLBACK' ? '#B42318' : TH.royal }]}>{kindOf(open) === 'CALLBACK' ? 'Quick call' : 'Admission enquiry'}</T>
                    <T style={s.sheetTitle} numberOfLines={1}>{kindOf(open) === 'CALLBACK' ? open.parentName : open.studentName || open.parentName}</T>
                  </View>
                  <Pressable onPress={() => setOpen(null)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }} accessibilityRole="button" accessibilityLabel="Close">
                    <T style={[s.btnText, { color: TH.royal }]}>Close</T>
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={s.content}>
                  <View style={s.actions}>
                    <Pressable onPress={() => dial(open)} style={[s.btn, s.btnCall]} accessibilityRole="button"><T style={[s.btnText, { color: '#FFFFFF' }]}>Call {open.mobile}</T></Pressable>
                    <Pressable onPress={() => chat(open)} style={[s.btn, s.btnGhost]} accessibilityRole="button"><T style={s.btnText}>WhatsApp</T></Pressable>
                  </View>

                  <View style={s.infoBox}>
                    {([
                      [kindOf(open) === 'CALLBACK' ? 'Name' : 'Parent / guardian', open.parentName],
                      ...(kindOf(open) === 'ENQUIRY' ? ([['Class applying', open.classApplying || 'Not given'], ['Previous school', open.currentSchool || 'Not given']] as [string, string][]) : [['Best time to call', open.preferredTime || 'Any time'] as [string, string]]),
                      ...(open.email ? [['Email', open.email] as [string, string]] : []),
                      ['Reference', open.referenceNumber || open.id],
                      ['Received', relativeTime(whenOf(open))],
                    ] as [string, string][]).map(([k, v]) => (
                      <View key={k} style={s.infoRow}>
                        <T style={s.infoLabel}>{k}</T>
                        <T style={s.infoValue}>{v}</T>
                      </View>
                    ))}
                  </View>

                  {!!open.message && (
                    <View style={{ gap: 4 }}>
                      <T style={s.infoLabel}>Their message</T>
                      <T style={s.messageText}>{open.message}</T>
                    </View>
                  )}

                  <T style={s.infoLabel}>Status</T>
                  <View style={s.statusWrap}>
                    {STATUS_UI.map((st) => {
                      const on = statusOf(open.status) === st.value;
                      return (
                        <Pressable key={st.value} disabled={busy} onPress={() => save({ status: st.value }, `Marked ${st.label.toLowerCase()}`)} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                          <T style={[s.chipText, on && s.chipTextOn]}>{st.label}</T>
                        </Pressable>
                      );
                    })}
                  </View>

                  <T style={s.infoLabel}>Follow-up date (YYYY-MM-DD)</T>
                  <TextInput value={follow} onChangeText={setFollow} placeholder="2026-11-05" placeholderTextColor={TH.muted} style={s.input} keyboardType="numeric" maxLength={10} accessibilityLabel="Follow-up date" />
                  <T style={s.infoLabel}>Internal notes (not shown to parents)</T>
                  <TextInput value={notes} onChangeText={setNotes} multiline style={[s.input, { minHeight: 90, paddingTop: 10, textAlignVertical: 'top' }]} maxLength={2000} accessibilityLabel="Internal notes" placeholder="What was discussed, next step" placeholderTextColor={TH.muted} />
                  <Pressable onPress={() => save({ notes, followUpDate: follow }, 'Saved')} disabled={busy} style={[s.btn, s.btnPrimary]} accessibilityRole="button">
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : <T style={[s.btnText, { color: '#FFFFFF' }]}>Save notes & date</T>}
                  </Pressable>
                  {msg && <T style={[s.msg, { color: msg.ok ? '#067647' : '#B42318' }]}>{msg.text}</T>}
                </ScrollView>
              </>
            )}
          </KeyboardFrame>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.bg },
  segment: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 6, gap: 6, borderBottomWidth: 1, borderBottomColor: TH.border },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segOn: { backgroundColor: TH.navy },
  segText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.muted },
  segCount: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  segTextOn: { color: '#FFFFFF' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontFamily: FONT.regular, fontSize: 14, color: TH.ink },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { backgroundColor: TH.royal, borderColor: TH.royal },
  chipText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  chipTextOn: { color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, padding: 14, gap: 10 },
  cardNew: { borderColor: '#F5B740' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kind: { fontFamily: FONT.semibold, fontSize: 12 },
  when: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  name: { flex: 1, fontFamily: FONT.bold, fontSize: 16, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 13, color: '#475467' },
  follow: { fontFamily: FONT.medium, fontSize: 12, color: '#0E7090' },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontFamily: FONT.semibold, fontSize: 11 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, minHeight: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnCall: { backgroundColor: '#067647' },
  btnPrimary: { backgroundColor: TH.navy },
  btnGhost: { borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF' },
  btnText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyText: { fontFamily: FONT.medium, fontSize: 14, color: TH.muted, textAlign: 'center' },
  errorBox: { backgroundColor: '#FEF3F2', borderRadius: 12, padding: 12, gap: 8 },
  error: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318' },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
  pickHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  sheetTitle: { fontFamily: FONT.bold, fontSize: 18, color: TH.navy },
  infoBox: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: TH.border, padding: 12, gap: 10 },
  infoRow: { gap: 2 },
  infoLabel: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  infoValue: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  messageText: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: '#344054', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: TH.border, padding: 12 },
  statusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  msg: { fontFamily: FONT.medium, fontSize: 13 },
});
