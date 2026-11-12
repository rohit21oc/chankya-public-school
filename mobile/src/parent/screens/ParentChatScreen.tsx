import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { FONT, TH } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { ChatThread } from '../../components/ChatThread';
import { apiService } from '../../services/apiService';
import { ChatMeta, PersonPhoto, ProfileSheet } from '../../components/comm/PersonPhoto';
import { useParentChildren, NoActiveChild } from '../ParentChildContext';
import { ParentHeader, SPACE } from '../ui';

/**
 * Parent messages for the active child: pick who to write to (the child's
 * teachers, the Principal, the Super Admin, the Chairman), then chat. Each
 * person is a separate conversation.
 */
function relTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (Number.isNaN(m)) return '';
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

const Photo = PersonPhoto;

export const ParentChatScreen: React.FC<{ onBack: () => void; onOpenChildren: () => void; onOpenFees: () => void }> = ({ onBack, onOpenChildren, onOpenFees }) => {
  const { activeChild } = useParentChildren();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<any | null>(null);
  const [meta, setMeta] = useState<ChatMeta>({});
  const [profileOpen, setProfileOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeChild) return;
    const r = await apiService.getChatContacts(activeChild.id);
    if (r.ok) {
      setContacts(r.data);
      setError(null);
    } else setError(r.error || 'Could not load. Pull down to retry.');
    setLoading(false);
    setRefreshing(false);
  }, [activeChild?.id]);

  useEffect(() => {
    setOpen(null);
    setLoading(true);
    void load();
  }, [load]);

  // Android back inside a conversation returns to the contact list first.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(null);
      void load();
      return true;
    });
    return () => sub.remove();
  }, [open, load]);

  if (open) {
    return (
      <View style={styles.screen}>
        <View style={styles.threadHead}>
          <Pressable onPress={() => { setOpen(null); load(); }} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to contacts">
            <Icon name="chevron-left" size={22} color={TH.navy} />
          </Pressable>
          <Photo name={open.name} photo={open.photo || meta.staff?.photo} size={38} onPress={() => setProfileOpen(true)} label={`View ${open.name}'s profile`} />
          <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => setProfileOpen(true)} accessibilityRole="button" accessibilityLabel={`View ${open.name}'s profile`}>
            <T style={styles.threadName} numberOfLines={1}>{open.name}</T>
            <T style={styles.threadSub} numberOfLines={1}>{open.title}{activeChild ? ` · about ${activeChild.name}` : ''}</T>
          </Pressable>
          {!!(meta.staff?.phone || open.phone) && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${meta.staff?.phone || open.phone}`)}
              style={styles.callBtn}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Call ${open.name}`}
            >
              <Icon name="phone" size={20} color={TH.royal} />
            </Pressable>
          )}
        </View>
        <ChatThread key={open.threadId} threadId={open.threadId} side="PARENT" onOpenFees={onOpenFees} onMeta={setMeta} />
        <ProfileSheet visible={profileOpen} meta={{ ...meta, staff: { name: open.name, title: open.title, ...(meta.staff || {}), photo: meta.staff?.photo || open.photo, phone: meta.staff?.phone || open.phone } }} side="PARENT" onClose={() => setProfileOpen(false)} />
      </View>
    );
  }

  // Anyone who has written (or been written to) comes first, newest on top; the rest stay grouped below.
  const byRecent = (a: any, b: any) => String(b.lastAt || '').localeCompare(String(a.lastAt || ''));
  const recent = contacts.filter((c) => c.lastAt).sort(byRecent);
  const quiet = contacts.filter((c) => !c.lastAt);
  const teachers = quiet.filter((c) => c.group === 'TEACHER');
  const leaders = quiet.filter((c) => c.group !== 'TEACHER');

  const renderRow = (c: any, i: number) => (
    <Pressable key={c.threadId} onPress={() => { setMeta({}); setOpen(c); }} style={[styles.row, i > 0 && styles.rowBorder]} accessibilityRole="button" accessibilityLabel={`Message ${c.name}, ${c.title}`}>
      <Photo name={c.name} photo={c.photo} size={46} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowTop}>
          <T style={[styles.name, c.unread > 0 && { fontFamily: FONT.bold }]} numberOfLines={1}>{c.name}</T>
          {!!c.lastAt && <T style={[styles.time, c.unread > 0 && { color: TH.royal }]}>{relTime(c.lastAt)}</T>}
        </View>
        <View style={styles.rowTop}>
          <T style={[styles.preview, c.unread > 0 && { color: TH.ink, fontFamily: FONT.medium }]} numberOfLines={1}>{c.lastText || c.title}</T>
          {c.unread > 0 && (
            <View style={styles.badge}>
              <T style={styles.badgeText}>{c.unread}</T>
            </View>
          )}
        </View>
        {!!c.lastText && <T style={styles.role} numberOfLines={1}>{c.title}</T>}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <ParentHeader title="Messages" child={activeChild} onBack={onBack} onPressChild={onOpenChildren} />
      {!activeChild ? (
        <View style={{ padding: SPACE.lg }}><NoActiveChild /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
          {loading ? (
            <ActivityIndicator color={TH.royal} style={{ marginTop: 32 }} />
          ) : error ? (
            <T style={styles.error}>{error}</T>
          ) : (
            <>
              {recent.length > 0 && (
                <>
                  <T style={styles.heading}>Recent messages</T>
                  <View style={styles.card}>{recent.map(renderRow)}</View>
                </>
              )}
              {(teachers.length > 0 || recent.length === 0) && (
                <>
                  <T style={styles.heading}>{`${activeChild.name.split(' ')[0]}'s teachers`}</T>
                  <View style={styles.card}>
                    {teachers.length === 0 ? <T style={styles.empty}>No teacher is assigned to this class yet.</T> : teachers.map(renderRow)}
                  </View>
                </>
              )}
              {(leaders.length > 0 || recent.length === 0) && (
                <>
                  <T style={styles.heading}>School management</T>
                  <View style={styles.card}>
                    {leaders.length === 0 ? <T style={styles.empty}>No one available right now.</T> : leaders.map(renderRow)}
                  </View>
                </>
              )}
              <T style={styles.note}>Messages are private between you and the person you write to.</T>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  callBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.tile },
  screen: { flex: 1, backgroundColor: TH.bg },
  content: { padding: SPACE.lg, gap: SPACE.sm, paddingBottom: 40 },
  heading: { fontFamily: FONT.semibold, fontSize: 13, color: TH.muted, marginTop: SPACE.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 68 },
  rowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink, flexShrink: 1 },
  time: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted },
  preview: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted, flexShrink: 1, marginTop: 2 },
  role: { fontFamily: FONT.regular, fontSize: 11, color: TH.royal, marginTop: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: TH.royal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontFamily: FONT.bold, fontSize: 11, color: '#FFFFFF' },
  empty: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted, padding: 14 },
  error: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318', textAlign: 'center', padding: 16 },
  note: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, textAlign: 'center', marginTop: SPACE.sm },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  threadName: { fontFamily: FONT.bold, fontSize: 16, color: TH.navy },
  threadSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
});
