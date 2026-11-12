import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Banner, Screen, Segmented, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { MenuBody, MessMenu, WeeklyMenu, wardenApi } from '../wardenApi';
import { indiaDate, MEAL_LABEL, MEALS, MealKind, nightLabel, parseItems, shiftDate } from '../wardenRules';
import { PrimaryButton, WardenHeader } from '../wardenUi';

type Form = Record<MealKind, { time: string; items: string }>;

const emptyForm = (): Form => ({ BREAKFAST: { time: '', items: '' }, LUNCH: { time: '', items: '' }, DINNER: { time: '', items: '' } });

const formFrom = (m: MenuBody | null | undefined): Form => {
  const f = emptyForm();
  for (const meal of m?.meals || []) f[meal.meal] = { time: meal.time || '', items: meal.items.join(', ') };
  return f;
};

const mealsFrom = (f: Form) => MEALS.map((m) => ({ meal: m, time: f[m].time.trim() || undefined, items: parseItems(f[m].items) })).filter((m) => m.items.length || m.time);

const dayLabel = (iso: string, today: string) => (iso === today ? 'Today' : iso === shiftDate(today, 1) ? 'Tomorrow' : nightLabel(iso, today));

type Editing = null | { kind: 'special' } | { kind: 'weekly'; weekday: number; name: string };

/**
 * Mess menu (no billing). The weekly menu (Monday … Sunday) is set once and repeats every week; a special
 * menu saved for one date replaces it on that day.
 */
export const WardenMessScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const today = indiaDate();
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(today);
  const [menus, setMenus] = useState<MessMenu[]>([]);
  const [weeks, setWeeks] = useState<WeeklyMenu[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (pull = false) => {
      if (pull) setRefreshing(true);
      const [d, w] = await Promise.all([wardenApi.mess(date), wardenApi.weeklyMess()]);
      if (d.ok) setMenus(d.data || []);
      if (w.ok) setWeeks(w.data || []);
      setError(!d.ok ? d.error || 'The mess menu could not be loaded.' : !w.ok ? w.error || 'The weekly menu could not be loaded.' : null);
      setLoading(false);
      setRefreshing(false);
    },
    [date]
  );
  useEffect(() => {
    setLoading(true);
    setEditing(null);
    void load();
  }, [load]);

  const cur = menus[idx] || menus[0];
  const week = weeks.find((w) => w.hostelId === cur?.hostelId) || weeks[0];

  const startEdit = (e: Exclude<Editing, null>, initial: MenuBody | null | undefined) => {
    setForm(formFrom(initial));
    setNotice(initial?.notice || '');
    setEditing(e);
  };

  const save = async () => {
    if (!cur || !editing) return;
    setSaving(true);
    const meals = mealsFrom(form);
    const r =
      editing.kind === 'special'
        ? await wardenApi.saveMess({ hostelId: cur.hostelId, date, meals, notice: notice.trim() })
        : await wardenApi.saveWeeklyMess({ hostelId: cur.hostelId, weekday: editing.weekday, meals, notice: notice.trim() });
    setSaving(false);
    if (!r.ok) return Alert.alert('Menu not saved', r.error || 'Please try again.');
    setEditing(null);
    void load();
  };

  const removeSpecial = () => {
    if (!cur) return;
    Alert.alert('Remove special menu?', `The weekly menu will show again on ${date}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const r = await wardenApi.deleteMess(cur.hostelId, date);
          if (!r.ok) Alert.alert('Not removed', r.error || 'Please try again.');
          void load();
        },
      },
    ]);
  };

  const clearWeekday = (weekday: number, name: string) => {
    if (!cur) return;
    Alert.alert(`Clear ${name}?`, `The weekly menu for ${name} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const r = await wardenApi.clearWeeklyMess(cur.hostelId, weekday);
          if (!r.ok) Alert.alert('Not cleared', r.error || 'Please try again.');
          void load();
        },
      },
    ]);
  };

  const sourceText = (m: MessMenu) =>
    m.source === 'SPECIAL' ? `Special menu for ${m.date}` : m.source === 'WEEKLY' ? `Weekly menu · ${m.weekdayName}` : m.source === 'EARLIER' ? `No weekly menu yet. Showing the menu from ${m.carriedFrom}.` : null;

  const editor = editing && (
    <>
      <T style={styles.editTitle}>{editing.kind === 'special' ? `Special menu for ${date}` : `Weekly menu · ${editing.name}`}</T>
      {MEALS.map((m) => (
        <View key={m} style={styles.card}>
          <T style={styles.mealTitle}>{MEAL_LABEL[m]}</T>
          <TextInput
            value={form[m].time}
            onChangeText={(v) => setForm((f) => ({ ...f, [m]: { ...f[m], time: v } }))}
            placeholder="Time (e.g. 7:30 AM – 8:15 AM)"
            placeholderTextColor={TH.muted}
            style={styles.input}
            accessibilityLabel={`${MEAL_LABEL[m]} time`}
          />
          <TextInput
            value={form[m].items}
            onChangeText={(v) => setForm((f) => ({ ...f, [m]: { ...f[m], items: v } }))}
            placeholder="Items, separated by commas"
            placeholderTextColor={TH.muted}
            style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
            multiline
            accessibilityLabel={`${MEAL_LABEL[m]} items`}
          />
        </View>
      ))}
      <TextInput value={notice} onChangeText={setNotice} placeholder="Note for students (optional)" placeholderTextColor={TH.muted} style={styles.input} accessibilityLabel="Note" />
      <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Cancel" tone="outline" onPress={() => setEditing(null)} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Save menu" busy={saving} onPress={save} />
        </View>
      </View>
    </>
  );

  return (
    <Screen header={<WardenHeader title="Mess Menu" subtitle={cur?.hostelName} onBack={onBack} />} refreshing={refreshing} onRefresh={() => load(true)}>
      <Segmented<'day' | 'week'>
        options={[
          { value: 'day', label: 'Day view' },
          { value: 'week', label: 'Weekly menu' },
        ]}
        value={mode}
        onChange={(v) => {
          setMode(v);
          setEditing(null);
        }}
      />

      {menus.length > 1 && (
        <View style={styles.hostelRow}>
          {menus.map((m, i) => (
            <TouchableOpacity key={m.hostelId} onPress={() => setIdx(i)} style={[styles.hChip, i === idx && styles.hChipOn]} accessibilityRole="button" accessibilityState={{ selected: i === idx }}>
              <T style={[styles.hChipText, i === idx && { color: '#FFFFFF' }]}>{m.hostelName}</T>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <SkeletonList rows={3} height={110} />
      ) : !cur ? (
        <StateBlock kind={error ? 'error' : 'empty'} icon="utensils" title={error ? 'Menu not available' : 'No hostel assigned'} message={error || undefined} onRetry={() => load()} />
      ) : editing ? (
        editor
      ) : mode === 'week' ? (
        <>
          <Banner text="Set each day's menu once. It repeats every week. For a festival or special day, add a special menu for that date in Day view." />
          {(week?.days || []).map((d) => (
            <View key={d.weekday} style={styles.card}>
              <View style={styles.dayHead}>
                <T style={styles.mealTitle}>
                  {d.name}
                  {d.weekday === cur.weekday && date === today ? ' · today' : ''}
                </T>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {!!d.menu && (
                    <TouchableOpacity onPress={() => clearWeekday(d.weekday, d.name)} style={styles.smallBtn} accessibilityRole="button" accessibilityLabel={`Clear ${d.name}`}>
                      <T style={[styles.smallBtnText, { color: '#B42318' }]}>Clear</T>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => startEdit({ kind: 'weekly', weekday: d.weekday, name: d.name }, d.menu)}
                    style={[styles.smallBtn, { backgroundColor: TH.tile }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.menu ? 'Edit' : 'Set'} ${d.name}`}
                  >
                    <T style={styles.smallBtnText}>{d.menu ? 'Edit' : 'Set menu'}</T>
                  </TouchableOpacity>
                </View>
              </View>
              {d.menu ? <MealSummary menu={d.menu} /> : <T style={styles.mealTime}>Not set</T>}
            </View>
          ))}
        </>
      ) : (
        <>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dBtn} onPress={() => setDate(shiftDate(date, -1))} accessibilityRole="button" accessibilityLabel="Previous day">
              <Icon name="chevron-left" size={20} color={TH.navy} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <T style={styles.dTitle}>{dayLabel(date, today)}</T>
              <T style={styles.dSub}>
                {cur.weekdayName} · {date}
              </T>
            </View>
            <TouchableOpacity style={styles.dBtn} onPress={() => setDate(shiftDate(date, 1))} accessibilityRole="button" accessibilityLabel="Next day">
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon name="chevron-left" size={20} color={TH.navy} />
              </View>
            </TouchableOpacity>
          </View>
          {!!error && <Banner text={error} onRetry={() => load()} />}
          {!cur.menu ? (
            <StateBlock
              kind="empty"
              icon="utensils"
              title={`No menu for ${cur.weekdayName}`}
              message={cur.hasWeekly ? `Set the ${cur.weekdayName} menu in Weekly menu, or add a special menu for this date.` : 'Set the weekly menu once (Monday to Sunday) and it repeats every week.'}
            />
          ) : (
            <>
              {!!sourceText(cur) && (
                <View style={[styles.source, cur.source === 'SPECIAL' && { backgroundColor: TH.gold }]}>
                  <T style={styles.sourceText}>{sourceText(cur)}</T>
                </View>
              )}
              {MEALS.map((m) => {
                const meal = cur.menu!.meals.find((x) => x.meal === m);
                return (
                  <View key={m} style={styles.card}>
                    <View style={styles.mealHead}>
                      <View style={styles.mealIcon}>
                        <Icon name="utensils" size={18} color={TH.gold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <T style={styles.mealTitle}>{MEAL_LABEL[m]}</T>
                        <T style={styles.mealTime}>{meal?.time || 'Time not set'}</T>
                      </View>
                    </View>
                    {meal?.items.length ? <Items items={meal.items} /> : <T style={styles.mealTime}>Not set</T>}
                  </View>
                );
              })}
              {!!cur.menu.notice && <Banner text={cur.menu.notice} />}
              {!!cur.menu.updatedByName && <T style={styles.updated}>Updated by {cur.menu.updatedByName}</T>}
            </>
          )}
          <PrimaryButton
            label={cur.source === 'SPECIAL' ? 'Edit special menu' : 'Special menu for this day'}
            icon="utensils"
            tone="gold"
            onPress={() => startEdit({ kind: 'special' }, cur.menu)}
          />
          <PrimaryButton label={cur.hasWeekly ? 'Edit weekly menu' : 'Set weekly menu'} icon="calendar" tone="outline" onPress={() => setMode('week')} />
          {cur.source === 'SPECIAL' && <PrimaryButton label="Remove special menu" tone="outline" icon="x" onPress={removeSpecial} />}
        </>
      )}
    </Screen>
  );
};

const Items: React.FC<{ items: string[] }> = ({ items }) => (
  <View style={styles.items}>
    {items.map((it, i) => (
      <View key={`${it}-${i}`} style={styles.item}>
        <T style={styles.itemText}>{it}</T>
      </View>
    ))}
  </View>
);

/** Compact Breakfast / Lunch / Dinner lines for the weekly list. */
const MealSummary: React.FC<{ menu: MenuBody }> = ({ menu }) => (
  <View style={{ gap: SPACE.sm }}>
    {MEALS.map((m) => {
      const meal = menu.meals.find((x) => x.meal === m);
      return (
        <View key={m} style={{ gap: 4 }}>
          <T style={styles.summaryHead}>
            {MEAL_LABEL[m]}
            {meal?.time ? ` · ${meal.time}` : ''}
          </T>
          {meal?.items.length ? <Items items={meal.items} /> : <T style={styles.mealTime}>Not set</T>}
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.sm, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  dBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.tile },
  dTitle: { fontFamily: FONT.heading, fontSize: 18, color: TH.navy },
  dSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  hostelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  hChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: TH.border, backgroundColor: TH.surface },
  hChipOn: { backgroundColor: TH.navy, borderColor: TH.navy },
  hChipText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  card: { gap: SPACE.md, padding: SPACE.lg, borderRadius: 18, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  smallBtn: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10 },
  smallBtnText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  mealIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center' },
  mealTitle: { fontFamily: FONT.heading, fontSize: 17, color: TH.navy },
  mealTime: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  summaryHead: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink },
  editTitle: { fontFamily: FONT.heading, fontSize: 18, color: TH.navy },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  item: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: TH.goldSoft },
  itemText: { fontFamily: FONT.medium, fontSize: 13, color: TH.goldInk },
  source: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: TH.tile },
  sourceText: { fontFamily: FONT.semibold, fontSize: 12, color: TH.navy },
  updated: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, textAlign: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderColor: TH.border, borderRadius: 12, paddingHorizontal: SPACE.md, paddingVertical: 10, fontFamily: FONT.regular, fontSize: 14, color: TH.ink, backgroundColor: TH.surface },
});
