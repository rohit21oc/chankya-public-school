import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardFrame } from '../ui/KeyboardFrame';
import { KScrollView as ScrollView } from '../ui/KScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../teacher-home/T';
import { Icon } from '../teacher-home/Icon';
import { FONT, TH } from '../../theme/teacherHome';
import { apiService } from '../../services/apiService';
import { ChatThread } from '../ChatThread';
import { ChatMeta, PersonPhoto, ProfileSheet, classLabel } from './PersonPhoto';

/** Staff side of parent chat: my conversations, start a chat with a student's parents, open a thread. */

export function relTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff)) return '';
  const m = Math.round(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

export const ChatInbox: React.FC<{
  refreshKey?: number;
  onUnreadChange?: (n: number) => void;
  openStudent?: { id: string; name?: string; photo?: string } | null;
  onOpenedStudent?: () => void;
  /** Students offered under "New chat". Default: every active student (the server still checks access). */
  loadPickerStudents?: () => Promise<any[]>;
}> = ({ refreshKey, onUnreadChange, openStudent, onOpenedStudent, loadPickerStudents }) => {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState<{ threadId: string; name: string; sub?: string; photo?: string } | null>(null);
  const [meta, setMeta] = useState<ChatMeta>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [picker, setPicker] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [pq, setPq] = useState('');

  const load = useCallback(async () => {
    const r = await apiService.getChatThreads();
    if (r.ok) {
      setThreads(r.data);
      setError(null);
      onUnreadChange?.(r.unreadTotal);
    } else setError(r.error || 'Chats could not be loaded.');
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load, refreshKey]);

  /** Opens my thread with this student's parents (the server checks I may). */
  const startWith = async (st: { id: string; name?: string; sub?: string; photo?: string }) => {
    setStarting(true);
    const r = await apiService.startChatWithParent(st.id);
    setStarting(false);
    if (!r.ok || !r.threadId) {
      setError(r.error || 'This chat could not be opened.');
      return;
    }
    setMeta({});
    setActive({ threadId: r.threadId, name: st.name || 'Student', sub: st.sub, photo: st.photo });
  };

  // Opened from elsewhere (e.g. the Fee dues list).
  useEffect(() => {
    if (openStudent) {
      void startWith(openStudent);
      onOpenedStudent?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openStudent]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return threads.filter((t) => !s || [t.studentName, t.parentName, t.className, t.admissionNumber].some((x) => String(x || '').toLowerCase().includes(s)));
  }, [threads, q]);

  const openPicker = async () => {
    setPicker(true);
    setPq('');
    if (students.length) return;
    setStudentsLoading(true);
    if (loadPickerStudents) {
      setStudents(await loadPickerStudents().catch(() => []));
    } else {
      const r = await apiService.getAllStudents({ status: 'ACTIVE' });
      setStudents(r.ok ? r.data : []);
    }
    setStudentsLoading(false);
  };
  const pickList = useMemo(() => {
    const s = pq.trim().toLowerCase();
    const words = s.split(/\s+/).filter(Boolean);
    return students.filter((x) => !words.length || words.every((w) => [x.name, x.admissionNumber, classLabel(x), (x as any).fatherName].some((v) => String(v || '').toLowerCase().includes(w)))).slice(0, 60);
  }, [students, pq]);

  return (
    <View style={{ gap: 10 }}>
      <View style={s.toolbar}>
        <View style={s.search}>
          <Icon name="users" size={16} color={TH.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search student or parent" placeholderTextColor={TH.muted} style={s.searchInput} />
        </View>
        <Pressable onPress={openPicker} style={s.newBtn} accessibilityRole="button">
          <T style={s.newText}>New chat</T>
        </Pressable>
      </View>

      {starting && <ActivityIndicator color={TH.royal} />}
      {loading ? (
        <ActivityIndicator color={TH.royal} style={{ marginTop: 24 }} />
      ) : error ? (
        <Pressable onPress={load}><T style={s.error}>{error} Tap to retry.</T></Pressable>
      ) : list.length === 0 ? (
        <View style={s.empty}>
          <Icon name="message-circle" size={30} color={TH.muted} />
          <T style={s.emptyTitle}>{q ? 'No chat matches.' : 'No conversations yet'}</T>
          <T style={s.emptySub}>Parents' messages to you appear here. Tap New chat to message the parents of a student.</T>
        </View>
      ) : (
        <View style={s.listCard}>
          {list.map((t, i) => (
            <Pressable key={t.threadId} onPress={() => { setMeta({}); setActive({ threadId: t.threadId, name: t.studentName, sub: t.parentName, photo: t.studentPhoto }); }} style={[s.row, i > 0 && s.rowBorder]} accessibilityRole="button">
              <PersonPhoto name={t.studentName} photo={t.studentPhoto} size={46} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.rowTop}>
                  <T style={[s.name, t.unread > 0 && { fontFamily: FONT.bold }]} numberOfLines={1}>{t.studentName}</T>
                  <T style={[s.time, t.unread > 0 && { color: TH.royal }]}>{relTime(t.lastAt)}</T>
                </View>
                <T style={s.sub} numberOfLines={1}>{[t.parentName, classLabel(t), t.staffId === 'SCHOOL' ? 'School office' : null].filter(Boolean).join(' · ')}</T>
                <View style={s.rowTop}>
                  <T style={[s.preview, t.unread > 0 && { color: TH.ink, fontFamily: FONT.medium }]} numberOfLines={1}>
                    {t.lastKind === 'FEE_DUE' ? '💰 Fee due reminder' : t.lastKind === 'EMERGENCY' ? `🚨 Emergency: ${t.lastText}` : `${t.lastSide === 'SCHOOL' ? 'You: ' : ''}${t.lastText}`}
                  </T>
                  {t.unread > 0 && <View style={s.badge}><T style={s.badgeText}>{t.unread}</T></View>}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Thread */}
      <Modal visible={!!active} animationType="slide" onRequestClose={() => { setActive(null); load(); }} statusBarTranslucent navigationBarTranslucent>
        {active && (
          <SafeAreaView style={s.safe}>
            <KeyboardFrame own>
            <View style={s.head}>
              <Pressable onPress={() => { setActive(null); load(); }} style={s.back} accessibilityLabel="Back">
                <Icon name="chevron-left" size={22} color={TH.navy} />
              </Pressable>
              <PersonPhoto name={active.name} photo={active.photo || meta.student?.photo} size={38} onPress={() => setProfileOpen(true)} label="View parent profile" />
              <Pressable style={{ flex: 1 }} onPress={() => setProfileOpen(true)} accessibilityRole="button" accessibilityLabel="View parent profile">
                <T style={s.headTitle} numberOfLines={1}>{active.name}</T>
                <T style={s.sub} numberOfLines={1}>{meta.parent?.name || active.sub ? `Parent: ${meta.parent?.name || active.sub}` : 'Parent chat'}</T>
              </Pressable>
              {!!meta.parent?.phone && (
                <Pressable onPress={() => Linking.openURL(`tel:${meta.parent!.phone}`)} style={s.callBtn} accessibilityRole="button" accessibilityLabel={`Call parent ${meta.parent.phone}`}>
                  <T style={s.callText}>📞 Call</T>
                </Pressable>
              )}
            </View>
            <ChatThread key={active.threadId} threadId={active.threadId} side="SCHOOL" onMeta={setMeta} />
            <ProfileSheet visible={profileOpen} meta={meta} side="SCHOOL" onClose={() => setProfileOpen(false)} />
            </KeyboardFrame>
          </SafeAreaView>
        )}
      </Modal>

      {/* Start a chat */}
      <Modal visible={picker} animationType="slide" onRequestClose={() => setPicker(false)} statusBarTranslucent navigationBarTranslucent>
        <SafeAreaView style={s.safe}>
          <KeyboardFrame own>
          <View style={s.head}>
            <Pressable onPress={() => setPicker(false)} style={s.back} accessibilityLabel="Close">
              <Icon name="x" size={20} color={TH.navy} />
            </Pressable>
            <T style={s.headTitle}>Message a parent</T>
          </View>
          <View style={{ padding: 16, paddingBottom: 0 }}>
            <TextInput value={pq} onChangeText={setPq} autoFocus placeholder="Student name, admission no., class or father’s name" placeholderTextColor={TH.muted} style={s.input} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
            {studentsLoading ? <ActivityIndicator color={TH.royal} /> : pickList.length === 0 ? <T style={s.emptySub}>No students found.</T> : pickList.map((st) => (
              <Pressable key={st.id} style={s.person} onPress={() => { setPicker(false); void startWith({ id: st.id, name: st.name, sub: (st as any).fatherName || (st as any).parentName, photo: (st as any).photoFileKey || (st as any).photo }); }}>
                <PersonPhoto name={st.name} photo={(st as any).photoFileKey || (st as any).photo} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={s.name} numberOfLines={1}>{st.name}</T>
                  <T style={s.sub} numberOfLines={1}>{[classLabel(st), st.admissionNumber, (st as any).fatherName && `Father: ${(st as any).fatherName}`].filter(Boolean).join(' · ')}</T>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          </KeyboardFrame>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.bg },
  toolbar: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontFamily: FONT.regular, fontSize: 14, color: TH.ink, minHeight: 42 },
  newBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: TH.royal, justifyContent: 'center' },
  newText: { fontFamily: FONT.semibold, fontSize: 14, color: '#FFFFFF' },
  error: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318', textAlign: 'center', padding: 16 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 },
  emptyTitle: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  emptySub: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted, textAlign: 'center' },
  listCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' },
  rowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center' },
  avatarSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT.heading, fontSize: 14, color: TH.gold },
  name: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink, flexShrink: 1 },
  time: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  sub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  preview: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted, flexShrink: 1, marginTop: 2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: TH.royal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontFamily: FONT.bold, fontSize: 11, color: '#FFFFFF' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontFamily: FONT.bold, fontSize: 16, color: TH.navy },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontFamily: FONT.regular, fontSize: 14, color: TH.ink },
  person: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: TH.border, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  callBtn: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: TH.border, justifyContent: 'center', marginRight: 6 },
  callText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal },
});
