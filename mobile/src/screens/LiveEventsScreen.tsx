import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, StyleSheet, Switch, TextInput, View } from 'react-native';
import { KeyboardFrame } from '../components/ui/KeyboardFrame';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { CommsTabs } from '../components/CommsTabs';
import { T } from '../components/teacher-home/T';
import { Icon } from '../components/teacher-home/Icon';
import { DatePickerField } from '../components/ui/DatePickerField';
import { FONT, TH } from '../theme/teacherHome';
import { apiService } from '../services/apiService';
import { resolveFileUrl } from '../utils/branding';
import { indiaToday } from '../utils/leaveRules';
import { EVENT_CATEGORIES, categoryColor, countdownLabel, dateBadge, eventEnd, eventStart, splitEvents } from '../utils/eventRules';

/**
 * Live Events: what is happening today, what is coming up (with a countdown),
 * and what already happened. Everyone can mark "Interested" so the school sees
 * expected turnout. Admins add, edit, hide or delete events, and can announce an
 * event to everyone as a notice in one tap.
 */
interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
  /** Switches between Notices, Messages and Live Events. */
  onNavigateModule?: (moduleId: string) => void;
}

const MANAGER_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN'];
type Draft = { title: string; category: string; eventDate: string; endDate: string; time: string; location: string; description: string; isFeatured: boolean };
const emptyDraft = (): Draft => ({ title: '', category: 'Cultural', eventDate: indiaToday(), endDate: '', time: '', location: '', description: '', isFeatured: false });

export const LiveEventsScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile, onNavigateModule }) => {
  const canManage = MANAGER_ROLES.includes(user.role);
  const today = indiaToday();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'UPCOMING' | 'PAST'>('UPCOMING');
  const [cat, setCat] = useState<string>('All');
  const [open, setOpen] = useState<any | null>(null);
  const [form, setForm] = useState<{ id?: string; d: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    let r = await apiService.getEventsForMe(canManage);
    if (!r.ok && r.status === 404) {
      // Older server without the signed-in list: fall back to the public list.
      const p = await apiService.getEvents();
      r = { ok: p.ok, status: p.status, data: p.data, error: p.error };
    }
    if (r.ok) {
      setEvents(r.data);
      setError(null);
    } else setError(r.error || 'Events could not be loaded.');
    setLoading(false);
    setRefreshing(false);
  }, [canManage]);
  useEffect(() => {
    void load();
  }, [load]);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 3500);
  };

  const visible = useMemo(() => events.filter((e) => cat === 'All' || e.category === cat), [events, cat]);
  const { live, upcoming, past } = useMemo(() => splitEvents(visible, today), [visible, today]);
  const cats = useMemo(() => ['All', ...EVENT_CATEGORIES.filter((c) => events.some((e) => e.category === c))], [events]);

  const toggleInterest = async (e: any) => {
    const want = !e.isInterested;
    setEvents((list) => list.map((x) => (x.id === e.id ? { ...x, isInterested: want, interestedCount: Math.max(0, (x.interestedCount || 0) + (want ? 1 : -1)) } : x)));
    setOpen((o: any) => (o && o.id === e.id ? { ...o, isInterested: want, interestedCount: Math.max(0, (o.interestedCount || 0) + (want ? 1 : -1)) } : o));
    const r = await apiService.setEventInterest(e.id, want);
    if (!r.ok) {
      flash(r.error || 'Could not save. Please try again.');
      load();
    } else if (r.event) {
      setEvents((list) => list.map((x) => (x.id === e.id ? { ...x, ...r.event } : x)));
    }
  };

  const openForm = (e?: any) => {
    setFormErr(null);
    setForm({
      id: e?.id,
      d: e
        ? { title: e.title || '', category: e.category || 'Cultural', eventDate: eventStart(e), endDate: e.endDate || '', time: e.time || '', location: e.location || e.venue || '', description: e.description || '', isFeatured: !!e.isFeatured }
        : emptyDraft(),
    });
  };
  const setD = (p: Partial<Draft>) => setForm((f) => (f ? { ...f, d: { ...f.d, ...p } } : f));

  const save = async () => {
    if (!form) return;
    const d = form.d;
    if (!d.title.trim()) return setFormErr('Give the event a title.');
    if (!d.eventDate) return setFormErr('Choose the event date.');
    if (d.endDate && d.endDate < d.eventDate) return setFormErr('End date cannot be before the start date.');
    setSaving(true);
    const r = await apiService.saveEvent(
      { title: d.title.trim(), category: d.category, eventDate: d.eventDate, endDate: d.endDate || '', time: d.time.trim(), location: d.location.trim(), description: d.description.trim(), isFeatured: d.isFeatured, isActive: true },
      form.id
    );
    setSaving(false);
    if (!r.ok) return setFormErr(r.error || 'The event could not be saved.');
    setForm(null);
    setOpen(null);
    flash(form.id ? 'Event updated.' : 'Event added.');
    load();
  };

  const setActive = async (e: any, active: boolean) => {
    const r = await apiService.saveEvent({ isActive: active }, e.id);
    if (!r.ok) return Alert.alert('Could not update', r.error || 'Please try again.');
    setOpen(null);
    flash(active ? 'Event is visible again.' : 'Event hidden from students and parents.');
    load();
  };

  const remove = (e: any) =>
    Alert.alert('Delete event?', `"${e.title}" will be removed from the app and website.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await apiService.deleteEvent(e.id);
          if (!r.ok) return Alert.alert('Could not delete', r.error || 'Please try again.');
          setOpen(null);
          flash('Event deleted.');
          load();
        },
      },
    ]);

  const announce = (e: any) =>
    Alert.alert('Announce to everyone?', 'A notice about this event will be published for all students, parents and staff.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Publish notice',
        onPress: async () => {
          const when = [eventStart(e), e.endDate && e.endDate !== eventStart(e) ? `to ${e.endDate}` : '', e.time].filter(Boolean).join(' ');
          const r = await apiService.saveNotice({
            title: e.title,
            content: [e.description, `When: ${when}`, e.location ? `Where: ${e.location}` : ''].filter(Boolean).join('\n\n'),
            noticeType: 'EVENT',
            category: 'EVENT',
            targetAudience: 'ALL',
            priority: 'IMPORTANT',
            status: 'PUBLISHED',
            expiryDate: eventEnd(e) || '',
          });
          if (!r.ok) return Alert.alert('Could not publish', r.error || 'Please try again.');
          flash('Notice published for everyone.');
        },
      },
    ]);

  const renderCard = (e: any, big = false) => {
    const start = eventStart(e);
    const b = dateBadge(start);
    const cc = categoryColor(e.category);
    const img = e.imageFileKey || e.imageUrl || e.image;
    const isLive = live.includes(e);
    return (
      <Pressable key={e.id} onPress={() => setOpen(e)} style={[s.card, isLive && s.cardLive, e.isActive === false && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`${e.title}, ${countdownLabel(e, today)}`}>
        {big && img ? <Image source={{ uri: resolveFileUrl(img) }} style={s.hero} resizeMode="cover" /> : null}
        <View style={s.cardRow}>
          <View style={[s.dateBox, isLive && { backgroundColor: '#B42318' }]}>
            <T style={[s.dateMonth, isLive && { color: '#FFE4E2' }]}>{b.month}</T>
            <T style={[s.dateDay, isLive && { color: '#FFFFFF' }]}>{b.day}</T>
            <T style={[s.dateWk, isLive && { color: '#FFE4E2' }]}>{b.weekday}</T>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={s.tagRow}>
              {isLive ? (
                <View style={[s.tag, { backgroundColor: '#FEF3F2' }]}>
                  <View style={s.liveDot} />
                  <T style={[s.tagText, { color: '#B42318' }]}>LIVE TODAY</T>
                </View>
              ) : (
                <View style={[s.tag, { backgroundColor: TH.tile }]}>
                  <T style={[s.tagText, { color: TH.royal }]}>{countdownLabel(e, today)}</T>
                </View>
              )}
              {!!e.category && (
                <View style={[s.tag, { backgroundColor: cc.bg }]}>
                  <T style={[s.tagText, { color: cc.fg }]}>{e.category}</T>
                </View>
              )}
              {e.isActive === false && (
                <View style={[s.tag, { backgroundColor: '#F2F4F7' }]}>
                  <T style={[s.tagText, { color: '#344054' }]}>Hidden</T>
                </View>
              )}
            </View>
            <T style={s.title} numberOfLines={2}>{e.title}</T>
            {!!e.time && (
              <View style={s.metaRow}>
                <Icon name="clock" size={14} color={TH.muted} />
                <T style={s.meta} numberOfLines={1}>{e.time}</T>
              </View>
            )}
            {!!(e.location || e.venue) && (
              <View style={s.metaRow}>
                <Icon name="house" size={14} color={TH.muted} />
                <T style={s.meta} numberOfLines={1}>{e.location || e.venue}</T>
              </View>
            )}
          </View>
        </View>
        {tab === 'UPCOMING' || isLive ? (
          <View style={s.cardFoot}>
            <T style={s.going}>{e.interestedCount ? `${e.interestedCount} interested` : 'Be the first to join'}</T>
            <Pressable onPress={() => toggleInterest(e)} style={[s.interest, e.isInterested && s.interestOn]} accessibilityRole="button" accessibilityState={{ selected: !!e.isInterested }}>
              {e.isInterested && <Icon name="check" size={14} color="#FFFFFF" />}
              <T style={[s.interestText, e.isInterested && { color: '#FFFFFF' }]}>{e.isInterested ? 'Interested' : "I'm interested"}</T>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const list = tab === 'UPCOMING' ? upcoming : past;

  return (
    <SafeAreaView style={s.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="Live Events" subtitle={`${live.length ? `${live.length} live · ` : ''}${upcoming.length} upcoming`} />
      <CommsTabs user={user} active="live-events" onNavigateModule={onNavigateModule} />
      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {toast && <T style={s.toast}>{toast}</T>}

        {live.length > 0 && (
          <View style={{ gap: 10 }}>
            <T style={s.section}>Happening today</T>
            {live.map((e) => renderCard(e, true))}
          </View>
        )}

        <View style={s.segment}>
          {(['UPCOMING', 'PAST'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[s.segBtn, tab === t && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <T style={[s.segText, tab === t && s.segTextOn]}>{t === 'UPCOMING' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}</T>
            </Pressable>
          ))}
        </View>

        {cats.length > 2 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {cats.map((c) => (
              <Pressable key={c} onPress={() => setCat(c)} style={[s.chip, cat === c && s.chipOn]}>
                <T style={[s.chipText, cat === c && s.chipTextOn]}>{c}</T>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {canManage && (
          <Pressable onPress={() => openForm()} style={s.addBtn} accessibilityRole="button">
            <T style={s.addText}>+ Add event</T>
          </Pressable>
        )}

        {loading ? (
          <ActivityIndicator color={TH.royal} style={{ marginTop: 32 }} />
        ) : error ? (
          <Pressable onPress={load} style={s.empty}>
            <T style={[s.emptyText, { color: '#B42318' }]}>{error} Tap to retry.</T>
          </Pressable>
        ) : list.length === 0 ? (
          <View style={s.empty}>
            <Icon name="calendar" size={30} color={TH.muted} />
            <T style={s.emptyText}>{tab === 'UPCOMING' ? 'No upcoming events yet.' : 'No past events.'}</T>
          </View>
        ) : (
          list.map((e) => renderCard(e))
        )}
      </ScrollView>

      {/* Event details */}
      <Modal visible={!!open && !form} animationType="slide" onRequestClose={() => setOpen(null)}>
        {open && (
          <SafeAreaView style={s.safe}>
            <View style={s.modalHead}>
              <T style={s.modalTitle} numberOfLines={1}>Event</T>
              <Pressable onPress={() => setOpen(null)} style={s.headBtn}>
                <T style={s.headBtnText}>Close</T>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
              {!!(open.imageFileKey || open.imageUrl || open.image) && (
                <Image source={{ uri: resolveFileUrl(open.imageFileKey || open.imageUrl || open.image) }} style={[s.hero, { borderRadius: 16 }]} resizeMode="cover" />
              )}
              <View style={s.tagRow}>
                <View style={[s.tag, { backgroundColor: TH.tile }]}>
                  <T style={[s.tagText, { color: TH.royal }]}>{countdownLabel(open, today)}</T>
                </View>
                {!!open.category && (
                  <View style={[s.tag, { backgroundColor: categoryColor(open.category).bg }]}>
                    <T style={[s.tagText, { color: categoryColor(open.category).fg }]}>{open.category}</T>
                  </View>
                )}
              </View>
              <T style={[s.title, { fontSize: 20, lineHeight: 26 }]}>{open.title}</T>
              <View style={s.detailBox}>
                <DetailRow icon="calendar" label="Date" value={[eventStart(open), open.endDate && open.endDate !== eventStart(open) ? `to ${open.endDate}` : ''].filter(Boolean).join(' ') || 'To be announced'} />
                {!!open.time && <DetailRow icon="clock" label="Time" value={open.time} />}
                {!!(open.location || open.venue) && <DetailRow icon="house" label="Venue" value={open.location || open.venue} />}
                <DetailRow icon="users" label="Interested" value={`${open.interestedCount || 0} people`} />
              </View>
              {!!open.description && <T style={s.body}>{open.description}</T>}
            </ScrollView>
            <View style={s.footer}>
              {canManage && (
                <View style={s.adminRow}>
                  <Pressable onPress={() => openForm(open)} style={s.ghost}><T style={s.ghostText}>Edit</T></Pressable>
                  <Pressable onPress={() => announce(open)} style={s.ghost}><T style={s.ghostText}>Announce</T></Pressable>
                  <Pressable onPress={() => setActive(open, open.isActive === false)} style={s.ghost}><T style={s.ghostText}>{open.isActive === false ? 'Show' : 'Hide'}</T></Pressable>
                  <Pressable onPress={() => remove(open)} style={s.ghost}><T style={[s.ghostText, { color: '#B42318' }]}>Delete</T></Pressable>
                </View>
              )}
              {eventEnd(open) >= today && (
                <Pressable onPress={() => toggleInterest(open)} style={[s.primary, open.isInterested && { backgroundColor: '#067647' }]}>
                  <T style={s.primaryText}>{open.isInterested ? '✓ You are interested' : "I'm interested"}</T>
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* Add / edit event */}
      <Modal visible={!!form} animationType="slide" onRequestClose={() => !saving && setForm(null)} statusBarTranslucent navigationBarTranslucent>
        {form && (
          <SafeAreaView style={s.safe}>
            <KeyboardFrame own>
            <View style={s.modalHead}>
              <T style={s.modalTitle}>{form.id ? 'Edit event' : 'New event'}</T>
              <Pressable onPress={() => setForm(null)} style={s.headBtn} disabled={saving}>
                <T style={s.headBtnText}>Cancel</T>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                <T style={s.label}>Title</T>
                <TextInput value={form.d.title} onChangeText={(v) => setD({ title: v })} style={s.input} placeholder="e.g. Annual Sports Day" placeholderTextColor={TH.muted} maxLength={150} />
                <T style={s.label}>Category</T>
                <View style={s.wrap}>
                  {EVENT_CATEGORIES.map((c) => (
                    <Pressable key={c} onPress={() => setD({ category: c })} style={[s.chip, form.d.category === c && s.chipOn]}>
                      <T style={[s.chipText, form.d.category === c && s.chipTextOn]}>{c}</T>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <DatePickerField label="Date" value={form.d.eventDate} onChange={(v) => setD({ eventDate: v, endDate: form.d.endDate && form.d.endDate < v ? '' : form.d.endDate })} />
                  <DatePickerField label="Ends (optional)" value={form.d.endDate} min={form.d.eventDate} onChange={(v) => setD({ endDate: v })} placeholder="Same day" />
                </View>
                <T style={s.label}>Time</T>
                <TextInput value={form.d.time} onChangeText={(v) => setD({ time: v })} style={s.input} placeholder="e.g. 09:30 AM - 02:30 PM" placeholderTextColor={TH.muted} maxLength={60} />
                <T style={s.label}>Venue</T>
                <TextInput value={form.d.location} onChangeText={(v) => setD({ location: v })} style={s.input} placeholder="e.g. School main ground" placeholderTextColor={TH.muted} maxLength={120} />
                <T style={s.label}>Details</T>
                <TextInput value={form.d.description} onChangeText={(v) => setD({ description: v })} style={[s.input, { minHeight: 110, paddingTop: 10 }]} multiline placeholder="What will happen, what to bring, dress code…" placeholderTextColor={TH.muted} maxLength={1500} />
                <View style={s.switchRow}>
                  <View style={{ flex: 1 }}>
                    <T style={s.label}>Featured on website</T>
                    <T style={s.meta}>Shown at the top of the website events list.</T>
                  </View>
                  <Switch value={form.d.isFeatured} onValueChange={(v) => setD({ isFeatured: v })} trackColor={{ true: TH.royal, false: TH.border }} />
                </View>
                {formErr && <T style={{ fontFamily: FONT.medium, fontSize: 13, color: '#B42318' }}>{formErr}</T>}
              </ScrollView>
            </View>
            <View style={s.footer}>
              <Pressable onPress={save} style={s.primary} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <T style={s.primaryText}>{form.id ? 'Save changes' : 'Add event'}</T>}
              </Pressable>
            </View>
            </KeyboardFrame>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
};

const DetailRow: React.FC<{ icon: 'calendar' | 'clock' | 'house' | 'users'; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={s.detailRow}>
    <View style={s.detailIcon}>
      <Icon name={icon} size={16} color={TH.royal} />
    </View>
    <View style={{ flex: 1 }}>
      <T style={s.meta}>{label}</T>
      <T style={s.detailValue}>{value}</T>
    </View>
  </View>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  toast: { fontFamily: FONT.medium, fontSize: 13, color: '#067647', backgroundColor: '#ECFDF3', padding: 10, borderRadius: 10 },
  section: { fontFamily: FONT.bold, fontSize: 15, color: TH.navy },
  segment: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: TH.border },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: TH.navy },
  segText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.muted },
  segTextOn: { color: '#FFFFFF' },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { backgroundColor: TH.royal, borderColor: TH.royal },
  chipText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  chipTextOn: { color: '#FFFFFF' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addBtn: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: TH.royal, alignItems: 'center', justifyContent: 'center', backgroundColor: TH.tile },
  addText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, padding: 12, gap: 10, overflow: 'hidden' },
  cardLive: { borderColor: '#FDA29B', borderWidth: 1.5 },
  hero: { width: '100%', height: 150, borderRadius: 12, backgroundColor: TH.tile },
  cardRow: { flexDirection: 'row', gap: 12 },
  dateBox: { width: 58, borderRadius: 12, backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  dateMonth: { fontFamily: FONT.semibold, fontSize: 11, color: TH.gold, letterSpacing: 1 },
  dateDay: { fontFamily: FONT.heading, fontSize: 24, color: '#FFFFFF', lineHeight: 28 },
  dateWk: { fontFamily: FONT.regular, fontSize: 11, color: TH.onNavyMuted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontFamily: FONT.semibold, fontSize: 11 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F04438' },
  title: { fontFamily: FONT.bold, fontSize: 15, lineHeight: 20, color: TH.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, flexShrink: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: TH.border, paddingTop: 10 },
  going: { fontFamily: FONT.medium, fontSize: 12, color: TH.muted },
  interest: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: TH.royal, flexDirection: 'row', alignItems: 'center', gap: 6 },
  interestOn: { backgroundColor: TH.royal },
  interestText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.royal },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyText: { fontFamily: FONT.medium, fontSize: 14, color: TH.muted, textAlign: 'center' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  modalTitle: { fontFamily: FONT.bold, fontSize: 17, color: TH.navy },
  headBtn: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  headBtnText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.royal },
  detailBox: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, padding: 12, gap: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  detailValue: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  body: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 23, color: TH.ink },
  footer: { padding: 16, gap: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: TH.border },
  adminRow: { flexDirection: 'row', gap: 8 },
  ghost: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: TH.border, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink },
  primary: { minHeight: 50, borderRadius: 14, backgroundColor: TH.royal, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FONT.semibold, fontSize: 15, color: '#FFFFFF' },
  label: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontFamily: FONT.regular, fontSize: 14, color: TH.ink, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: TH.border, padding: 12 },
});
