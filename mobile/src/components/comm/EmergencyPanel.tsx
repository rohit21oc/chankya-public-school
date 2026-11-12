import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { T } from '../teacher-home/T';
import { Icon } from '../teacher-home/Icon';
import { FONT, TH } from '../../theme/teacherHome';
import { apiService } from '../../services/apiService';
import { PersonPhoto, classLabel } from './PersonPhoto';

/**
 * Emergency message (Principal / admins): to every parent, chosen classes, or chosen students.
 * It lands in each parent's "School office" chat as a red Emergency card, with one phone alert per parent.
 */
export { EMERGENCY_ROLES } from '../../utils/messagesRules';

type Scope = 'ALL' | 'CLASS' | 'STUDENTS';
const RED = '#B42318';

export const EmergencyPanel: React.FC = () => {
  const [scope, setScope] = useState<Scope>('ALL');
  const [text, setText] = useState('');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classIds, setClassIds] = useState<Set<string>>(new Set());
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<any[]>([]);
  const [alsoStaff, setAlsoStaff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    void apiService.getClasses().then((r) => {
      if (r.ok) setClasses(r.data.filter((c: any) => String(c.status || 'ACTIVE').toUpperCase() === 'ACTIVE').map((c: any) => ({ id: c.id, name: c.name })));
    });
  }, []);
  useEffect(() => {
    if (scope !== 'STUDENTS' || students.length || loadingStudents) return;
    setLoadingStudents(true);
    void apiService.getAllStudents({ status: 'ACTIVE' }).then((r) => {
      setStudents(r.ok ? r.data : []);
      setLoadingStudents(false);
    });
  }, [scope, students.length, loadingStudents]);

  const matches = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const chosen = new Set(picked.map((p) => p.id));
    return students
      .filter((x) => !chosen.has(x.id))
      .filter((x) => words.every((w) => [x.name, x.admissionNumber, classLabel(x), x.fatherName].some((v) => String(v || '').toLowerCase().includes(w))))
      .slice(0, 20);
  }, [q, students, picked]);

  const ready = text.trim().length > 0 && (scope === 'ALL' || (scope === 'CLASS' ? classIds.size > 0 : picked.length > 0));
  const who =
    scope === 'ALL'
      ? 'the parents of ALL students'
      : scope === 'CLASS'
        ? `the parents of ${classes.filter((c) => classIds.has(c.id)).map((c) => c.name).join(', ')}`
        : `the parents of ${picked.length} selected student${picked.length === 1 ? '' : 's'}`;

  const send = () => {
    if (!ready || busy) return;
    Alert.alert('Send emergency message?', `To ${who}.${alsoStaff ? ' Staff will also get a phone alert.' : ''}\n\n“${text.trim()}”`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setResult(null);
          const r = await apiService.sendEmergencyMessage({ scope, text: text.trim(), classIds: [...classIds], studentIds: picked.map((p) => p.id), alsoStaff });
          setBusy(false);
          if (!r.ok) return setResult({ ok: false, msg: r.error || 'Not sent. Please try again.' });
          setResult({ ok: true, msg: `Emergency message sent to the parents of ${r.sent} student${r.sent === 1 ? '' : 's'}.` });
          setText('');
          setPicked([]);
          setClassIds(new Set());
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={s.warn}>
        <Icon name="circle-alert" size={18} color={RED} />
        <T style={s.warnText}>For urgent news only (school closed, early dismissal, safety alert). It reaches each parent’s Messages from the School office, with a phone alert.</T>
      </View>

      <T style={s.label}>Send to</T>
      <View style={s.seg}>
        {(
          [
            ['ALL', 'All parents'],
            ['CLASS', 'Classes'],
            ['STUDENTS', 'Students'],
          ] as const
        ).map(([v, l]) => (
          <Pressable key={v} onPress={() => setScope(v)} style={[s.segBtn, scope === v && s.segOn]} accessibilityRole="button" accessibilityState={{ selected: scope === v }}>
            <T style={[s.segText, scope === v && { color: RED }]}>{l}</T>
          </Pressable>
        ))}
      </View>

      {scope === 'CLASS' && (
        <View style={s.wrap}>
          {classes.length === 0 ? (
            <ActivityIndicator color={TH.royal} />
          ) : (
            classes.map((c) => {
              const on = classIds.has(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setClassIds((cur) => { const n = new Set(cur); if (on) n.delete(c.id); else n.add(c.id); return n; })}
                  style={[s.chip, on && s.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <T style={[s.chipText, on && { color: '#FFFFFF' }]}>{c.name}</T>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {scope === 'STUDENTS' && (
        <View style={{ gap: 8 }}>
          <View style={s.search}>
            <Icon name="users" size={16} color={TH.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Type student name, admission no. or class" placeholderTextColor={TH.muted} style={s.searchInput} />
          </View>
          {loadingStudents && <ActivityIndicator color={TH.royal} />}
          {matches.length > 0 && (
            <View style={s.card}>
              {matches.map((m, i) => (
                <Pressable key={m.id} onPress={() => { setPicked((cur) => [...cur, m]); setQ(''); }} style={[s.row, i > 0 && s.rowBorder]} accessibilityRole="button" accessibilityLabel={`Add ${m.name}`}>
                  <PersonPhoto name={m.name} photo={m.photoFileKey || m.photo} size={38} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={s.name} numberOfLines={1}>{m.name}</T>
                    <T style={s.meta} numberOfLines={1}>{[classLabel(m), m.admissionNumber, m.fatherName && `Father: ${m.fatherName}`].filter(Boolean).join(' · ')}</T>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          {picked.length > 0 && (
            <View style={s.wrap}>
              {picked.map((p) => (
                <View key={p.id} style={s.pill}>
                  <PersonPhoto name={p.name} photo={p.photoFileKey || p.photo} size={24} />
                  <T style={s.pillText} numberOfLines={1}>{p.name}</T>
                  <Pressable onPress={() => setPicked((cur) => cur.filter((x) => x.id !== p.id))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`}>
                    <Icon name="x" size={14} color={TH.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <T style={s.label}>Message</T>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
        placeholder="e.g. School will close at 12:00 today due to heavy rain. Please collect your child from the main gate."
        placeholderTextColor={TH.muted}
        style={s.textarea}
        accessibilityLabel="Emergency message"
      />
      <View style={s.switchRow}>
        <T style={[s.name, { flex: 1 }]}>Also alert staff on their phones</T>
        <Switch value={alsoStaff} onValueChange={setAlsoStaff} trackColor={{ true: RED, false: TH.border }} />
      </View>

      {result && <T style={[s.result, result.ok ? s.resultOk : s.resultErr]}>{result.msg}</T>}

      <Pressable onPress={send} disabled={!ready || busy} style={[s.sendBtn, (!ready || busy) && { opacity: 0.5 }]} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <T style={s.sendText}>🚨  Send emergency message</T>}
      </Pressable>
    </View>
  );
};

const s = StyleSheet.create({
  warn: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA' },
  warnText: { flex: 1, fontFamily: FONT.regular, fontSize: 13, lineHeight: 18, color: '#7A271A' },
  label: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink },
  seg: { flexDirection: 'row', backgroundColor: TH.tile, borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF' },
  segText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.muted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { backgroundColor: RED, borderColor: RED },
  chipText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  search: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontFamily: FONT.regular, fontSize: 14, color: TH.ink, minHeight: 44 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: TH.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  name: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: TH.tile, maxWidth: '100%' },
  pillText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink, flexShrink: 1 },
  textarea: { minHeight: 110, borderRadius: 14, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', padding: 12, fontFamily: FONT.regular, fontSize: 14, color: TH.ink, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: TH.border },
  result: { fontFamily: FONT.medium, fontSize: 13, padding: 10, borderRadius: 10 },
  resultOk: { color: '#067647', backgroundColor: '#ECFDF3' },
  resultErr: { color: RED, backgroundColor: '#FEF3F2' },
  sendBtn: { minHeight: 52, borderRadius: 14, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: FONT.semibold, fontSize: 15, color: '#FFFFFF' },
});
