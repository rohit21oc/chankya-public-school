import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../teacher-home/T';
import { Icon } from '../teacher-home/Icon';
import { FONT, TH } from '../../theme/teacherHome';
import { resolveFileUrl } from '../../utils/branding';

/** Shared bits for Messages: round photos, class labels and the profile sheet opened from a chat. */

export const initialsOf = (n?: string) =>
  String(n || '?')
    .split(/\s+/)
    .map((x) => x[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

export { classLabel } from '../../utils/messagesRules';
import { classLabel } from '../../utils/messagesRules';

/** Round profile photo; initials when there is no photo or it fails to load. */
export const PersonPhoto: React.FC<{ name?: string; photo?: string | null; size?: number; onPress?: () => void; label?: string }> = ({ name, photo, size = 44, onPress, label }) => {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [photo]);
  const round = { width: size, height: size, borderRadius: size / 2 };
  const body =
    photo && !bad ? (
      <Image source={{ uri: resolveFileUrl(photo) }} style={[round, { backgroundColor: TH.tile }]} onError={() => setBad(true)} />
    ) : (
      <View style={[round, s.fallback]}>
        <T style={{ fontFamily: FONT.heading, fontSize: Math.max(11, Math.round(size * 0.36)), color: TH.gold }}>{initialsOf(name)}</T>
      </View>
    );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label || `View ${name || 'profile'}`}>
      {body}
    </Pressable>
  );
};

export interface ChatMeta {
  student?: { id: string; name: string; className?: string; section?: string; admissionNumber?: string; photo?: string };
  parent?: { name?: string; phone?: string; photo?: string; children?: Array<{ id: string; name: string; className?: string; section?: string; admissionNumber?: string; photo?: string }> };
  staff?: { name?: string; title?: string; photo?: string; phone?: string };
}

/**
 * Who is on the other side of a chat. Staff (side SCHOOL) see the parent: photo, mobile (tap to call)
 * and every child of theirs here. Parents (side PARENT) see the staff member's photo, title and mobile (tap to call).
 * Tap the big photo to see it full screen.
 */
export const ProfileSheet: React.FC<{ visible: boolean; meta: ChatMeta; side: 'SCHOOL' | 'PARENT'; onClose: () => void }> = ({ visible, meta, side, onClose }) => {
  const [zoom, setZoom] = useState(false);
  const person =
    side === 'SCHOOL'
      ? { name: meta.parent?.name || 'Parent / Guardian', sub: 'Parent / Guardian', photo: meta.parent?.photo }
      : { name: meta.staff?.name || 'School', sub: meta.staff?.title || 'Staff', photo: meta.staff?.photo };
  const kids = side === 'SCHOOL' ? (meta.parent?.children?.length ? meta.parent.children : meta.student ? [meta.student] : []) : [];
  // Staff see the parent's number; parents see the teacher's / office's number. Both can tap to call.
  const phone = side === 'SCHOOL' ? meta.parent?.phone : meta.staff?.phone;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={zoom ? () => setZoom(false) : onClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.head}>
          <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Close profile">
            <Icon name="x" size={20} color="#FFFFFF" />
          </Pressable>
          <PersonPhoto name={person.name} photo={person.photo} size={120} onPress={person.photo ? () => setZoom(true) : undefined} label="View full photo" />
          <T style={s.name}>{person.name}</T>
          <T style={s.sub}>{person.sub}</T>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          {side === 'SCHOOL' && (
            <>
              <T style={s.label}>Mobile number</T>
              {phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${phone}`)} style={s.call} accessibilityRole="button" accessibilityLabel={`Call ${phone}`}>
                  <T style={s.callText}>📞  {phone}</T>
                  <T style={s.callHint}>Tap to call</T>
                </Pressable>
              ) : (
                <T style={s.muted}>Not on record</T>
              )}
              <T style={[s.label, { marginTop: 18 }]}>{kids.length > 1 ? `Children (${kids.length})` : 'Child'}</T>
              {kids.map((c) => (
                <View key={c.id} style={s.child}>
                  <PersonPhoto name={c.name} photo={c.photo} size={42} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={s.childName} numberOfLines={1}>{c.name}</T>
                    <T style={s.muted} numberOfLines={1}>{[classLabel(c), c.admissionNumber].filter(Boolean).join(' · ')}</T>
                  </View>
                </View>
              ))}
            </>
          )}
          {side === 'PARENT' && (
            <>
              <T style={s.label}>Mobile number</T>
              {phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${phone}`)} style={s.call} accessibilityRole="button" accessibilityLabel={`Call ${person.name} on ${phone}`}>
                  <T style={s.callText}>📞  {phone}</T>
                  <T style={s.callHint}>Tap to call</T>
                </Pressable>
              ) : (
                <T style={s.muted}>Not on record. You can send a message instead.</T>
              )}
            </>
          )}
          {side === 'PARENT' && meta.student && (
            <T style={s.muted}>
              Conversation about {meta.student.name}
              {classLabel(meta.student) ? ` (${classLabel(meta.student)})` : ''}.
            </T>
          )}
        </ScrollView>
      </SafeAreaView>
      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <Pressable style={s.zoomBg} onPress={() => setZoom(false)} accessibilityRole="button" accessibilityLabel="Close photo">
          {!!person.photo && <Image source={{ uri: resolveFileUrl(person.photo) }} style={s.zoomImg} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </Modal>
  );
};

const s = StyleSheet.create({
  fallback: { backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1, backgroundColor: TH.bg },
  head: { backgroundColor: TH.navy, alignItems: 'center', paddingTop: 20, paddingBottom: 20, gap: 6 },
  close: { position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 2 },
  name: { fontFamily: FONT.bold, fontSize: 19, color: '#FFFFFF', marginTop: 8, paddingHorizontal: 16, textAlign: 'center' },
  sub: { fontFamily: FONT.regular, fontSize: 13, color: TH.onNavyMuted },
  body: { padding: 16, gap: 8, paddingBottom: 40 },
  label: { fontFamily: FONT.semibold, fontSize: 12, color: TH.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: TH.border },
  callText: { fontFamily: FONT.bold, fontSize: 17, color: TH.royal, flex: 1 },
  callHint: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  child: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: TH.border },
  childName: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  muted: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  zoomBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  zoomImg: { width: '100%', height: '80%' },
});
