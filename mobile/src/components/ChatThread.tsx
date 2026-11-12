import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { T } from './teacher-home/T';
import { Icon } from './teacher-home/Icon';
import { FONT, TH } from '../theme/teacherHome';
import { apiService } from '../services/apiService';
import type { ChatMeta } from './comm/PersonPhoto';
import { refreshActivity } from '../services/activityStore';
import { KeyboardFrame } from './ui/KeyboardFrame';

/**
 * One parent ↔ staff conversation (thread = student + staff member). Used by staff
 * (side SCHOOL) and by parents (side PARENT). New messages are fetched every 8 seconds while open.
 * Fee-due alerts are shown as a card with the amount.
 */
interface Props {
  threadId: string;
  side: 'SCHOOL' | 'PARENT';
  /** Parent app: opens the Fees tab from a fee-due card. */
  onOpenFees?: () => void;
  /** Called after messages load (e.g. to refresh unread counts). */
  onRead?: () => void;
  /** Who the conversation is with (student, parent card for staff, staff member). */
  onMeta?: (meta: ChatMeta) => void;
}

const POLL_MS = 8000;

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const key = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const today = key(new Date());
  const yest = key(new Date(Date.now() - 86400000));
  const k = key(d);
  if (k === today) return 'Today';
  if (k === yest) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export const ChatThread: React.FC<Props> = ({ threadId, side, onOpenFees, onRead, onMeta }) => {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const alive = useRef(true);
  // Kept in a ref so a new callback from the parent does not restart polling.
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  const onMetaRef = useRef(onMeta);
  onMetaRef.current = onMeta;

  const load = useCallback(
    async (quiet = false) => {
      const r = await apiService.getChatMessages(threadId);
      if (!alive.current) return;
      if (r.ok) {
        setMsgs(r.data);
        setError(null);
        onMetaRef.current?.({ student: r.student, parent: r.parent, staff: r.staff });
        onReadRef.current?.();
        if (!quiet) void refreshActivity(); // opening a chat marks it read: badges update
      } else if (!quiet) setError(r.error || 'Messages could not be loaded.');
      setLoading(false);
    },
    [threadId]
  );

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    void load();
    const t = setInterval(() => load(true), POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const temp = { id: `tmp-${Date.now()}`, senderSide: side, text: body, kind: 'TEXT', createdAt: new Date().toISOString(), pending: true };
    setMsgs((m) => [...m, temp]);
    setText('');
    const r = await apiService.sendChatMessage(threadId, body);
    setSending(false);
    if (r.ok && r.message) setMsgs((m) => m.map((x) => (x.id === temp.id ? r.message : x)));
    else {
      setMsgs((m) => m.map((x) => (x.id === temp.id ? { ...x, pending: false, failed: true } : x)));
      setText(body);
      setError(r.error || 'Not sent. Check your connection and try again.');
    }
  };

  // Newest first for the inverted list, with a date divider where the day changes.
  const rows = useMemo(() => {
    const out: any[] = [];
    msgs.forEach((m, i) => {
      const prev = msgs[i - 1];
      if (!prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt)) out.push({ id: `d-${m.id}`, divider: dayLabel(m.createdAt) });
      out.push(m);
    });
    return out.reverse();
  }, [msgs]);

  const renderItem = ({ item }: { item: any }) => {
    if (item.divider) {
      return (
        <View style={s.divider}>
          <T style={s.dividerText}>{item.divider}</T>
        </View>
      );
    }
    const mine = item.senderSide === side;
    if (item.kind === 'EMERGENCY') {
      return (
        <View style={[s.emCard, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
          <View style={s.feeHead}>
            <Icon name="circle-alert" size={18} color="#B42318" />
            <T style={s.feeTitle}>Emergency message</T>
          </View>
          <T style={s.emText}>{item.text}</T>
          <T style={s.time}>{timeLabel(item.createdAt)}{item.senderName ? ` · ${item.senderName}` : ''}</T>
        </View>
      );
    }
    if (item.kind === 'FEE_DUE') {
      const f = item.feeDue || {};
      return (
        <View style={[s.feeCard, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
          <View style={s.feeHead}>
            <Icon name="wallet" size={18} color="#B42318" />
            <T style={s.feeTitle}>Fee due reminder</T>
          </View>
          <T style={s.feeAmount}>{inr(f.totalPending)}</T>
          {f.overdue > 0 && <T style={s.feeOverdue}>{inr(f.overdue)} is past the due date</T>}
          {Array.isArray(f.items) &&
            f.items.slice(0, 4).map((it: any, i: number) => (
              <View key={i} style={s.feeItem}>
                <T style={s.feeItemLabel} numberOfLines={1}>{it.label}</T>
                <T style={s.feeItemAmt}>{inr(it.amount)}</T>
              </View>
            ))}
          <T style={s.feeText}>{item.text}</T>
          {side === 'PARENT' && onOpenFees && (
            <Pressable onPress={onOpenFees} style={s.payBtn} accessibilityRole="button">
              <T style={s.payText}>View & pay fees</T>
            </Pressable>
          )}
          <T style={s.time}>{timeLabel(item.createdAt)}{item.senderName ? ` · ${item.senderName}` : ''}</T>
        </View>
      );
    }
    return (
      <View style={[s.bubbleRow, mine ? s.rowMine : s.rowTheirs]}>
        <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs, item.failed && { opacity: 0.6 }]}>
          {!mine && !!item.senderName && <T style={s.sender}>{item.senderName}</T>}
          <T style={[s.msg, mine && { color: '#FFFFFF' }]}>{item.text}</T>
          <T style={[s.time, mine && { color: 'rgba(255,255,255,0.75)' }]}>
            {item.failed ? 'Not sent' : item.pending ? 'Sending…' : timeLabel(item.createdAt)}
            {mine && !item.pending && !item.failed ? ((side === 'SCHOOL' ? item.readByParentAt : item.readBySchoolAt) ? '  ✓✓' : '  ✓') : ''}
          </T>
        </View>
      </View>
    );
  };

  return (
    // Android (Expo SDK 54) draws edge-to-edge, so the window no longer shrinks for the
    // keyboard; 'padding' lifts the message box above it on both platforms. If a device
    // does resize the window, the overlap is 0 and nothing extra is added.
    <KeyboardFrame>
      {loading ? (
        <ActivityIndicator color={TH.royal} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          inverted
          keyExtractor={(m: any) => m.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            msgs.length === 0 ? (
              <View style={s.empty}>
                <Icon name="message-circle" size={28} color={TH.muted} />
                <T style={s.emptyText}>{side === 'PARENT' ? 'Write your message below. They will reply here.' : 'No messages yet. Say hello to the parent.'}</T>
              </View>
            ) : null
          }
        />
      )}
      {error && (
        <Pressable onPress={() => { setError(null); load(); }}>
          <T style={s.error}>{error}</T>
        </Pressable>
      )}
      <View style={s.composer}>
        <TextInput value={text} onChangeText={setText} placeholder="Type a message" placeholderTextColor={TH.muted} style={s.input} multiline maxLength={2000} accessibilityLabel="Message" />
        <Pressable onPress={send} disabled={!text.trim() || sending} style={[s.send, (!text.trim() || sending) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Send">
          {sending ? <ActivityIndicator color="#FFFFFF" /> : <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron-left" size={20} color="#FFFFFF" /></View>}
        </Pressable>
      </View>
    </KeyboardFrame>
  );
};

const s = StyleSheet.create({
  list: { padding: 12, gap: 6 },
  divider: { alignItems: 'center', marginVertical: 8 },
  dividerText: { fontFamily: FONT.medium, fontSize: 11, color: TH.muted, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: TH.royal, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: TH.border, borderBottomLeftRadius: 4 },
  sender: { fontFamily: FONT.semibold, fontSize: 11, color: TH.royal, marginBottom: 2 },
  msg: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: TH.ink },
  time: { fontFamily: FONT.regular, fontSize: 10, color: TH.muted, marginTop: 3, alignSelf: 'flex-end' },
  emCard: { maxWidth: '88%', backgroundColor: '#FEF3F2', borderRadius: 16, borderWidth: 1.5, borderColor: '#F97066', padding: 12, gap: 6 },
  emText: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 20, color: TH.ink },
  feeCard: { maxWidth: '88%', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: '#FDA29B', padding: 12, gap: 6 },
  feeHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feeTitle: { fontFamily: FONT.bold, fontSize: 13, color: '#B42318' },
  feeAmount: { fontFamily: FONT.heading, fontSize: 26, color: TH.navy },
  feeOverdue: { fontFamily: FONT.semibold, fontSize: 12, color: '#B42318' },
  feeItem: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: TH.border, paddingTop: 4 },
  feeItemLabel: { fontFamily: FONT.regular, fontSize: 12, color: TH.ink, flexShrink: 1 },
  feeItemAmt: { fontFamily: FONT.semibold, fontSize: 12, color: TH.ink },
  feeText: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: '#475467' },
  payBtn: { minHeight: 40, borderRadius: 10, backgroundColor: '#B42318', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  payText: { fontFamily: FONT.semibold, fontSize: 13, color: '#FFFFFF' },
  empty: { alignItems: 'center', gap: 10, padding: 32 },
  emptyText: { fontFamily: FONT.medium, fontSize: 13, color: TH.muted, textAlign: 'center' },
  error: { fontFamily: FONT.medium, fontSize: 12, color: '#B42318', textAlign: 'center', paddingVertical: 6, backgroundColor: '#FEF3F2' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: TH.border },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: TH.border, backgroundColor: TH.bg, paddingHorizontal: 16, paddingVertical: 10, fontFamily: FONT.regular, fontSize: 15, color: TH.ink },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: TH.royal, alignItems: 'center', justifyContent: 'center' },
});
