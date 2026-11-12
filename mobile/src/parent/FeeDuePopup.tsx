import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { T } from '../components/teacher-home/T';
import { Icon } from '../components/teacher-home/Icon';
import { FONT, TH } from '../theme/teacherHome';
import { apiService } from '../services/apiService';
import { useParentChildren } from './ParentChildContext';

/**
 * Popup shown when the parent opens the app (and when they switch child) while
 * that child has fee pending. "Later" hides it for the rest of this app session;
 * it comes back on the next app open until the dues are cleared.
 */
const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export const FeeDuePopup: React.FC<{ onPay: () => void; onMessage: () => void }> = ({ onPay, onMessage }) => {
  const { activeChild } = useParentChildren();
  const [dues, setDues] = useState<{ studentName: string; totalPending: number; overdue: number; items: any[]; lastAlertText?: string | null } | null>(null);
  const dismissed = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    setDues(null);
    if (!activeChild || dismissed.current.has(activeChild.id)) return;
    // A short delay so the popup does not fight the first screen's loading state.
    const t = setTimeout(async () => {
      const r = await apiService.getChildFeeDues(activeChild.id);
      if (alive && r.ok && r.totalPending > 0) {
        setDues({ studentName: activeChild.name, totalPending: r.totalPending, overdue: r.overdue, items: r.items, lastAlertText: r.lastAlertText });
      }
    }, 900);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [activeChild?.id]);

  const close = () => {
    if (activeChild) dismissed.current.add(activeChild.id);
    setDues(null);
  };

  return (
    <Modal visible={!!dues} transparent animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        {dues && (
          <View style={s.sheet}>
            <View style={s.iconWrap}>
              <Icon name="wallet" size={26} color="#B42318" />
            </View>
            <T style={s.title}>Fee pending</T>
            <T style={s.sub}>for {dues.studentName}</T>
            <T style={s.amount}>{inr(dues.totalPending)}</T>
            {dues.overdue > 0 && (
              <View style={s.overdue}>
                <Icon name="circle-alert" size={14} color="#B42318" />
                <T style={s.overdueText}>{inr(dues.overdue)} is past the due date</T>
              </View>
            )}
            <View style={s.items}>
              {dues.items.slice(0, 4).map((it, i) => (
                <View key={i} style={[s.item, i > 0 && { borderTopWidth: 1, borderTopColor: TH.border }]}>
                  <T style={s.itemLabel} numberOfLines={1}>{it.label}</T>
                  <T style={[s.itemAmt, it.overdue && { color: '#B42318' }]}>{inr(it.amount)}</T>
                </View>
              ))}
              {dues.items.length > 4 && <T style={s.more}>+ {dues.items.length - 4} more</T>}
            </View>
            <Pressable
              onPress={() => {
                close();
                onPay();
              }}
              style={s.primary}
              accessibilityRole="button"
            >
              <T style={s.primaryText}>View & pay fees</T>
            </Pressable>
            <View style={s.row}>
              <Pressable
                onPress={() => {
                  close();
                  onMessage();
                }}
                style={s.ghost}
                accessibilityRole="button"
              >
                <T style={s.ghostText}>Ask school</T>
              </Pressable>
              <Pressable onPress={close} style={s.ghost} accessibilityRole="button">
                <T style={[s.ghostText, { color: TH.muted }]}>Later</T>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,75,0.55)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, alignItems: 'center', gap: 6 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3F2', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontFamily: FONT.bold, fontSize: 18, color: TH.navy },
  sub: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  amount: { fontFamily: FONT.heading, fontSize: 34, color: '#B42318', marginTop: 4 },
  overdue: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  overdueText: { fontFamily: FONT.semibold, fontSize: 12, color: '#B42318' },
  items: { alignSelf: 'stretch', backgroundColor: TH.bg, borderRadius: 14, paddingHorizontal: 12, marginTop: 10 },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 8 },
  itemLabel: { fontFamily: FONT.regular, fontSize: 13, color: TH.ink, flexShrink: 1 },
  itemAmt: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink },
  more: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, paddingBottom: 8 },
  primary: { alignSelf: 'stretch', minHeight: 50, borderRadius: 14, backgroundColor: '#B42318', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { fontFamily: FONT.semibold, fontSize: 15, color: '#FFFFFF' },
  row: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  ghost: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
});
