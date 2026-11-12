import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { T } from '../teacher-home/T';
import { Icon } from '../teacher-home/Icon';
import { FONT, TH } from '../../theme/teacherHome';
import { formatShortDate, indiaToday } from '../../utils/leaveRules';

/**
 * A date field that opens a small month calendar. Pure JS (no native picker),
 * so it works in the current app build without adding a native module.
 */
interface Props {
  label: string;
  value: string; // YYYY-MM-DD or ''
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
}

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');

export const DatePickerField: React.FC<Props> = ({ label, value, onChange, min, max, placeholder = 'Choose date' }) => {
  const [open, setOpen] = useState(false);
  const seed = value || min || indiaToday();
  const [cursor, setCursor] = useState({ y: Number(seed.slice(0, 4)), m: Number(seed.slice(5, 7)) - 1 });

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
    const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const out: Array<string | null> = Array(first).fill(null);
    for (let d = 1; d <= days; d++) out.push(`${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);

  const move = (delta: number) =>
    setCursor((c) => {
      const m = c.m + delta;
      return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

  const today = indiaToday();
  return (
    <View style={{ flex: 1 }}>
      <T style={s.label}>{label}</T>
      <Pressable
        onPress={() => {
          const sd = value || min || today;
          setCursor({ y: Number(sd.slice(0, 4)), m: Number(sd.slice(5, 7)) - 1 });
          setOpen(true);
        }}
        style={s.field}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatShortDate(value) : 'not chosen'}`}
      >
        <Icon name="calendar" size={18} color={TH.royal} />
        <T style={[s.value, !value && { color: TH.muted }]} numberOfLines={1}>{value ? formatShortDate(value) : placeholder}</T>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.head}>
              <Pressable onPress={() => move(-1)} style={s.nav} accessibilityLabel="Previous month">
                <Icon name="chevron-left" size={20} color={TH.navy} />
              </Pressable>
              <T style={s.month}>{MONTHS[cursor.m]} {cursor.y}</T>
              <Pressable onPress={() => move(1)} style={s.nav} accessibilityLabel="Next month">
                <View style={{ transform: [{ rotate: '180deg' }] }}>
                  <Icon name="chevron-left" size={20} color={TH.navy} />
                </View>
              </Pressable>
            </View>
            <View style={s.grid}>
              {WEEK.map((w, i) => (
                <T key={`w${i}`} style={[s.week, i === 0 && { color: '#B42318' }]}>{w}</T>
              ))}
              {cells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={s.cell} />;
                const disabled = (!!min && d < min) || (!!max && d > max);
                const on = d === value;
                const sunday = new Date(`${d}T00:00:00Z`).getUTCDay() === 0;
                return (
                  <Pressable
                    key={d}
                    disabled={disabled}
                    onPress={() => {
                      onChange(d);
                      setOpen(false);
                    }}
                    style={[s.cell, on && s.cellOn, d === today && !on && s.cellToday]}
                    accessibilityRole="button"
                    accessibilityLabel={formatShortDate(d)}
                    accessibilityState={{ selected: on, disabled }}
                  >
                    <T style={[s.day, sunday && { color: '#B42318' }, disabled && { color: TH.border }, on && { color: '#FFFFFF' }]}>{Number(d.slice(8))}</T>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => setOpen(false)} style={s.close} accessibilityRole="button">
              <T style={s.closeText}>Close</T>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  label: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink, marginBottom: 6 },
  field: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontFamily: FONT.medium, fontSize: 14, color: TH.ink, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,75,0.45)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  nav: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.tile },
  month: { fontFamily: FONT.bold, fontSize: 16, color: TH.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  week: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: FONT.semibold, fontSize: 12, color: TH.muted, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  cellOn: { backgroundColor: TH.royal },
  cellToday: { borderWidth: 1, borderColor: TH.gold },
  day: { fontFamily: FONT.medium, fontSize: 14, color: TH.ink },
  close: { marginTop: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
});
