import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { markNoticesSeen } from '../services/activityStore';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardFrame } from '../components/ui/KeyboardFrame';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { CommsTabs } from '../components/CommsTabs';
import { T } from '../components/teacher-home/T';
import { FONT, TH } from '../theme/teacherHome';
import { Icon } from '../components/teacher-home/Icon';
import { apiService } from '../services/apiService';
import {
  AUDIENCES,
  CATEGORIES,
  NoticeDraft,
  NoticeFilter,
  NoticeLike,
  audienceLabel,
  canManageNotice,
  canPublishNotices,
  categoryLabel,
  countByStatus,
  draftFrom,
  filterNotices,
  formatDay,
  indiaToday,
  previewText,
  statusOf,
  validateDraft,
} from '../utils/noticeRules';

/**
 * Notices for staff: status filters, full view, and write / edit / publish /
 * unpublish / delete for permitted staff. Parent chat and fee reminders live in
 * the separate Messages module. Every change is confirmed first and only shown
 * as done after the server agrees.
 */

interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
  /** Switches between Notices, Messages and Live Events. */
  onNavigateModule?: (moduleId: string) => void;
}

const PAGE = 20;
const GREEN = '#067647';
const AMBER = '#B54708';
const RED = '#B42318';
const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PUBLISHED: { bg: '#ECFDF3', fg: GREEN, label: 'Published' },
  DRAFT: { bg: '#F2F4F7', fg: '#344054', label: 'Draft' },
  EXPIRED: { bg: '#FFFAEB', fg: AMBER, label: 'Expired' },
};

/** Accent per notice category, so the list is easy to scan. */
const CATEGORY_ACCENT: Record<string, { bar: string; bg: string; fg: string; icon: 'graduation-cap' | 'calendar' | 'wallet' | 'circle-alert' | 'megaphone' | 'book-open' }> = {
  EXAM: { bar: '#7A5AF8', bg: '#F4F3FF', fg: '#5925DC', icon: 'book-open' },
  RESULT: { bar: '#12B76A', bg: '#ECFDF3', fg: '#067647', icon: 'graduation-cap' },
  ACADEMIC: { bar: '#2E90FA', bg: '#EFF8FF', fg: '#175CD3', icon: 'graduation-cap' },
  HOLIDAY: { bar: '#F79009', bg: '#FFFAEB', fg: '#B54708', icon: 'calendar' },
  EVENT: { bar: '#EE46BC', bg: '#FDF2FA', fg: '#C11574', icon: 'calendar' },
  FEE: { bar: '#F04438', bg: '#FEF3F2', fg: '#B42318', icon: 'wallet' },
  EMERGENCY: { bar: '#D92D20', bg: '#FEF3F2', fg: '#B42318', icon: 'circle-alert' },
};
const accentOf = (n: any) => CATEGORY_ACCENT[String(n?.noticeType || n?.category || '').toUpperCase()] || { bar: TH.royal, bg: TH.tile, fg: TH.royal, icon: 'megaphone' as const };

const Chip: React.FC<{ label: string; on: boolean; onPress: () => void }> = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on && s.chipOn]}>
    <T style={[s.chipText, on && s.chipTextOn]}>{label}</T>
  </Pressable>
);

export const CommunicationScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile, onNavigateModule }) => {
  const mayPublish = canPublishNotices(user.role);
  // Opening Notices clears the "new" badge.
  useEffect(() => {
    markNoticesSeen();
  }, []);
  // Notices
  const [notices, setNotices] = useState<NoticeLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NoticeFilter>('ALL');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [detail, setDetail] = useState<NoticeLike | null>(null);
  const [form, setForm] = useState<{ id?: string; draft: NoticeDraft; originalExpiry?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string; sections: string[] }[]>([]);

  const loadNotices = useCallback(async (fresh = false) => {
    const res = await apiService.getStaffNotices({ fresh });
    if (res.ok) {
      setNotices(res.data);
      setError(null);
    } else {
      setError(res.error || 'Notices could not be loaded.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  const counts = useMemo(() => countByStatus(notices), [notices]);
  const list = useMemo(() => filterNotices(notices, filter, query), [notices, filter, query]);

  const flash = (tone: 'ok' | 'error', text: string) => {
    setBanner({ tone, text });
    setTimeout(() => setBanner(null), 4500);
  };

  const openForm = async (n?: NoticeLike) => {
    setFormError(null);
    setForm({ id: n?.id, draft: draftFrom(n), originalExpiry: n?.expiryDate || '' });
    if (classes.length === 0) {
      const res = await apiService.getClasses();
      if (res.ok) {
        setClasses(
          res.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            sections: (Array.isArray(c.sections) ? c.sections : []).map((x: any) => (typeof x === 'string' ? x : x?.name)).filter(Boolean),
          }))
        );
      }
    }
  };

  const setDraft = (patch: Partial<NoticeDraft>) => {
    setFormError(null);
    setForm((f) => (f ? { ...f, draft: { ...f.draft, ...patch } } : f));
  };

  const submitForm = async () => {
    if (!form) return;
    const invalid = validateDraft(form.draft, indiaToday(), form.originalExpiry);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setSaving(true);
    setFormError(null);
    const d = form.draft;
    const payload: Record<string, any> = {
      title: d.title.trim(),
      content: d.content.trim(),
      noticeType: d.noticeType,
      category: d.noticeType,
      targetAudience: d.targetAudience,
      targetClass: d.targetAudience === 'CLASS' ? d.targetClass : '',
      targetClassId: d.targetAudience === 'CLASS' ? classes.find((c) => c.name === d.targetClass)?.id || '' : '',
      targetSection: d.targetAudience === 'CLASS' ? d.targetSection : '',
      priority: d.priority,
      status: d.status,
      expiryDate: d.expiryDate.trim(),
    };
    const res = await apiService.saveNotice(payload, form.id);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error || 'The notice could not be saved.');
      return;
    }
    setForm(null);
    setDetail(null);
    flash('ok', form.id ? 'Notice saved.' : d.status === 'DRAFT' ? 'Draft saved.' : 'Notice published.');
    loadNotices(true);
  };

  const changeStatus = (n: NoticeLike, next: 'PUBLISHED' | 'DRAFT') => {
    const go = async () => {
      setActionBusy(true);
      const res = await apiService.saveNotice({ status: next }, n.id);
      setActionBusy(false);
      if (!res.ok) {
        flash('error', res.error || 'That did not work.');
        return;
      }
      setDetail(res.data || null);
      flash('ok', next === 'PUBLISHED' ? 'Notice published.' : 'Moved to drafts. Students and parents no longer see it.');
      loadNotices(true);
    };
    if (next === 'DRAFT') {
      Alert.alert('Move to drafts?', 'Students and parents will no longer see this notice. You can publish it again later.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move to drafts', onPress: go },
      ]);
    } else {
      go();
    }
  };

  const remove = (n: NoticeLike) => {
    Alert.alert('Delete this notice?', `"${n.title}" will be removed for everyone. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setActionBusy(true);
          const res = await apiService.deleteNotice(n.id);
          setActionBusy(false);
          if (!res.ok) {
            flash('error', res.error || 'The notice could not be deleted.');
            return;
          }
          setDetail(null);
          flash('ok', 'Notice deleted.');
          loadNotices(true);
        },
      },
    ]);
  };

  const refresh = () => {
    setRefreshing(true);
    loadNotices(true);
  };

  const renderNotice = (n: NoticeLike) => {
    const st = STATUS_STYLE[statusOf(n)];
    const pr = String(n.priority || 'NORMAL').toUpperCase();
    const ac = accentOf(n);
    const seen = Number((n as any).seenCount) || 0;
    return (
      <Pressable key={n.id} onPress={() => setDetail(n)} style={s.card} accessibilityRole="button" accessibilityLabel={`${st.label}. ${n.title}`}>
        <View style={[s.accent, { backgroundColor: ac.bar }]} />
        <View style={s.cardInner}>
          <View style={s.cardHead}>
            <View style={[s.catIcon, { backgroundColor: ac.bg }]}>
              <Icon name={ac.icon} size={16} color={ac.fg} />
            </View>
            <T style={[s.catText, { color: ac.fg }]} numberOfLines={1}>{categoryLabel(n.noticeType || n.category)}</T>
            <View style={{ flex: 1 }} />
            {pr === 'URGENT' && (
              <View style={[s.pill, { backgroundColor: '#FEF3F2' }]}>
                <T style={[s.pillText, { color: RED }]}>Urgent</T>
              </View>
            )}
            {pr === 'IMPORTANT' && (
              <View style={[s.pill, { backgroundColor: TH.goldSoft }]}>
                <T style={[s.pillText, { color: TH.goldInk }]}>Important</T>
              </View>
            )}
            <View style={[s.pill, { backgroundColor: st.bg }]}>
              <T style={[s.pillText, { color: st.fg }]}>{st.label}</T>
            </View>
          </View>
          <T style={s.title} numberOfLines={2}>{n.title}</T>
          <T style={s.preview} numberOfLines={2}>{previewText(n.content)}</T>
          <View style={s.cardFoot}>
            <T style={s.meta} numberOfLines={1}>{[audienceLabel(n), formatDay(n.publishDate || n.publishedDate || n.date)].filter(Boolean).join(' · ')}</T>
            {seen > 0 && <T style={s.meta}>👁 {seen}</T>}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="Notices" subtitle={`${notices.length} notice${notices.length === 1 ? '' : 's'}`} />
      <CommsTabs user={user} active="communication" onNavigateModule={onNavigateModule} />

      {banner && (
        <View style={[s.banner, { backgroundColor: banner.tone === 'ok' ? '#ECFDF3' : '#FEF3F2' }]} accessibilityLiveRegion="polite">
          <T style={{ fontFamily: FONT.medium, fontSize: 13, color: banner.tone === 'ok' ? GREEN : RED }}>{banner.text}</T>
        </View>
      )}

      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {(
          <>
            <View style={s.statsRow}>
              {(['ALL', 'PUBLISHED', 'DRAFT', 'EXPIRED'] as NoticeFilter[]).map((f) => (
                <Pressable key={f} onPress={() => { setFilter(f); setShown(PAGE); }} style={[s.stat, filter === f && { borderColor: TH.royal, backgroundColor: TH.tile }]} accessibilityRole="button" accessibilityState={{ selected: filter === f }}>
                  <T style={s.statLabel} numberOfLines={1}>{f === 'ALL' ? 'All' : f === 'DRAFT' ? 'Drafts' : STATUS_STYLE[f].label}</T>
                  <T style={[s.statValue, { color: f === 'ALL' ? TH.navy : STATUS_STYLE[f].fg }]}>{counts[f]}</T>
                </Pressable>
              ))}
            </View>
            <View style={s.toolbar}>
              <TextInput value={query} onChangeText={setQuery} placeholder="🔍  Search notices" placeholderTextColor={TH.muted} style={s.search} accessibilityLabel="Search notices" returnKeyType="search" />
              {mayPublish && (
                <Pressable onPress={() => openForm()} style={s.primary} accessibilityRole="button">
                  <T style={s.primaryText}>+ New</T>
                </Pressable>
              )}
            </View>

            {loading ? (
              <ActivityIndicator color={TH.royal} style={{ marginTop: 32 }} />
            ) : error ? (
              <View style={s.empty}>
                <T style={[s.emptyTitle, { color: RED }]}>{error}</T>
                <Pressable onPress={() => loadNotices(true)} style={s.secondary}>
                  <T style={s.secondaryText}>Try again</T>
                </Pressable>
              </View>
            ) : list.length === 0 ? (
              <View style={s.empty}>
                <T style={s.emptyTitle}>{query || filter !== 'ALL' ? 'No notices match.' : 'No notices yet.'}</T>
              </View>
            ) : (
              <>
                {list.slice(0, shown).map(renderNotice)}
                {list.length > shown && (
                  <Pressable onPress={() => setShown((x) => x + PAGE)} style={s.secondary}>
                    <T style={s.secondaryText}>Show more ({list.length - shown})</T>
                  </Pressable>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Notice details */}
      <Modal visible={Boolean(detail) && !form} animationType="slide" onRequestClose={() => setDetail(null)}>
        {detail && (
          <SafeAreaView style={s.safe}>
            <View style={s.modalHead}>
              <T style={s.modalTitle} numberOfLines={1}>Notice</T>
              <Pressable onPress={() => setDetail(null)} style={s.closeBtn} accessibilityRole="button">
                <T style={s.secondaryText}>Close</T>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.content}>
              <View style={s.row}>
                <View style={[s.pill, { backgroundColor: STATUS_STYLE[statusOf(detail)].bg }]}>
                  <T style={[s.pillText, { color: STATUS_STYLE[statusOf(detail)].fg }]}>{STATUS_STYLE[statusOf(detail)].label}</T>
                </View>
              </View>
              <T style={[s.title, { fontSize: 18, lineHeight: 24 }]}>{detail.title}</T>
              <T style={s.meta}>
                {[categoryLabel(detail.noticeType || detail.category), audienceLabel(detail), formatDay(detail.publishDate || detail.date), detail.publishedBy].filter(Boolean).join(' · ')}
              </T>
              {detail.expiryDate ? <T style={s.meta}>{statusOf(detail) === 'EXPIRED' ? 'Expired' : 'Shown until'} {formatDay(detail.expiryDate)}</T> : null}
              <T style={s.body}>{detail.content}</T>
            </ScrollView>
            {canManageNotice(user.role, user.id, detail) && (
              <View style={s.actions}>
                {statusOf(detail) === 'DRAFT' && (
                  <Pressable onPress={() => changeStatus(detail, 'PUBLISHED')} style={s.primary} disabled={actionBusy}>
                    <T style={s.primaryText}>Publish</T>
                  </Pressable>
                )}
                {statusOf(detail) === 'PUBLISHED' && (
                  <Pressable onPress={() => changeStatus(detail, 'DRAFT')} style={s.secondary} disabled={actionBusy}>
                    <T style={s.secondaryText}>Move to drafts</T>
                  </Pressable>
                )}
                <Pressable onPress={() => openForm(detail)} style={s.secondary} disabled={actionBusy}>
                  <T style={s.secondaryText}>Edit</T>
                </Pressable>
                <Pressable onPress={() => remove(detail)} style={s.secondary} disabled={actionBusy}>
                  <T style={[s.secondaryText, { color: RED }]}>Delete</T>
                </Pressable>
                {actionBusy && <ActivityIndicator color={TH.royal} />}
              </View>
            )}
          </SafeAreaView>
        )}
      </Modal>

      {/* New / edit notice */}
      <Modal visible={Boolean(form)} animationType="slide" onRequestClose={() => !saving && setForm(null)} statusBarTranslucent navigationBarTranslucent>
        {form && (
          <SafeAreaView style={s.safe}>
            <KeyboardFrame own>
            <View style={s.modalHead}>
              <T style={s.modalTitle}>{form.id ? 'Edit notice' : 'New notice'}</T>
              <Pressable onPress={() => setForm(null)} style={s.closeBtn} disabled={saving} accessibilityRole="button">
                <T style={s.secondaryText}>Cancel</T>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.content}>
              <T style={s.label}>Title</T>
              <TextInput value={form.draft.title} onChangeText={(v) => setDraft({ title: v })} style={s.input} maxLength={200} placeholder="e.g. Sports Day schedule" placeholderTextColor={TH.muted} accessibilityLabel="Title" />
              <T style={s.label}>Notice text</T>
              <TextInput value={form.draft.content} onChangeText={(v) => setDraft({ content: v })} style={[s.input, { minHeight: 120 }]} multiline placeholder="Write the notice" placeholderTextColor={TH.muted} accessibilityLabel="Notice text" />

              <T style={s.label}>Category</T>
              <View style={s.wrap}>
                {CATEGORIES.map((c) => (
                  <Chip key={c.value} label={c.label} on={form.draft.noticeType === c.value} onPress={() => setDraft({ noticeType: c.value })} />
                ))}
              </View>
              <T style={s.label}>Audience</T>
              <View style={s.wrap}>
                {AUDIENCES.map((a) => (
                  <Chip key={a.value} label={a.label} on={form.draft.targetAudience === a.value} onPress={() => setDraft({ targetAudience: a.value })} />
                ))}
              </View>
              {form.draft.targetAudience === 'CLASS' && (
                <>
                  <T style={s.label}>Class</T>
                  <View style={s.wrap}>
                    {classes.length === 0 ? <T style={s.meta}>Loading classes…</T> : null}
                    {classes.map((c) => (
                      <Chip key={c.id} label={c.name} on={form.draft.targetClass === c.name} onPress={() => setDraft({ targetClass: c.name, targetSection: '' })} />
                    ))}
                  </View>
                  {(classes.find((c) => c.name === form.draft.targetClass)?.sections.length || 0) > 0 && (
                    <>
                      <T style={s.label}>Section</T>
                      <View style={s.wrap}>
                        <Chip label="All sections" on={!form.draft.targetSection} onPress={() => setDraft({ targetSection: '' })} />
                        {classes
                          .find((c) => c.name === form.draft.targetClass)!
                          .sections.map((sec) => (
                            <Chip key={sec} label={sec} on={form.draft.targetSection === sec} onPress={() => setDraft({ targetSection: sec })} />
                          ))}
                      </View>
                    </>
                  )}
                </>
              )}
              <T style={s.label}>Priority</T>
              <View style={s.wrap}>
                {[
                  { v: 'NORMAL', l: 'Normal' },
                  { v: 'IMPORTANT', l: 'Important' },
                  { v: 'URGENT', l: 'Urgent' },
                ].map((p) => (
                  <Chip key={p.v} label={p.l} on={form.draft.priority === p.v} onPress={() => setDraft({ priority: p.v })} />
                ))}
              </View>
              <T style={s.label}>Show until (optional, YYYY-MM-DD)</T>
              <TextInput value={form.draft.expiryDate} onChangeText={(v) => setDraft({ expiryDate: v })} style={s.input} placeholder="Leave empty to keep it" placeholderTextColor={TH.muted} maxLength={10} keyboardType="numeric" accessibilityLabel="Show until date" />
              {!form.id && (
                <>
                  <T style={s.label}>When</T>
                  <View style={s.wrap}>
                    <Chip label="Publish now" on={form.draft.status === 'PUBLISHED'} onPress={() => setDraft({ status: 'PUBLISHED' })} />
                    <Chip label="Save as draft" on={form.draft.status === 'DRAFT'} onPress={() => setDraft({ status: 'DRAFT' })} />
                  </View>
                </>
              )}
              {formError ? <T style={s.formError}>{formError}</T> : null}
            </ScrollView>
            <View style={s.actions}>
              <Pressable onPress={submitForm} style={[s.primary, { flex: 1 }]} disabled={saving} accessibilityRole="button">
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <T style={s.primaryText}>{form.id ? 'Save changes' : form.draft.status === 'DRAFT' ? 'Save draft' : 'Publish'}</T>}
              </Pressable>
            </View>
            </KeyboardFrame>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.bg },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  tab: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', paddingHorizontal: 4 },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#D92D20', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontFamily: FONT.bold, fontSize: 10, color: '#FFFFFF' },
  accent: { width: 4 },
  cardInner: { flex: 1, padding: 14, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catText: { fontFamily: FONT.semibold, fontSize: 12, flexShrink: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  tabOn: { borderBottomColor: TH.royal },
  tabText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.muted },
  tabTextOn: { color: TH.royal },
  banner: { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 12 },
  toolbar: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontFamily: FONT.regular, fontSize: 14, color: TH.ink },
  chips: { gap: 8, paddingVertical: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { backgroundColor: TH.navy, borderColor: TH.navy },
  chipText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  chipTextOn: { color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, flexDirection: 'row', overflow: 'hidden' },
  smsCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: TH.border, padding: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillText: { fontFamily: FONT.semibold, fontSize: 12 },
  title: { fontFamily: FONT.bold, fontSize: 15, lineHeight: 20, color: TH.ink, flexShrink: 1 },
  preview: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18, color: '#475467' },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  body: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 23, color: TH.ink, marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTitle: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink, textAlign: 'center' },
  primary: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: TH.royal, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FONT.semibold, fontSize: 14, color: '#FFFFFF' },
  secondary: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: TH.border, padding: 12 },
  statLabel: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  statValue: { fontFamily: FONT.bold, fontSize: 18, color: TH.ink, marginTop: 2 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 44, paddingBottom: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  modalTitle: { fontFamily: FONT.bold, fontSize: 17, color: TH.ink },
  closeBtn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: TH.border, backgroundColor: '#FFFFFF', alignItems: 'center' },
  label: { fontFamily: FONT.semibold, fontSize: 13, color: TH.ink, marginTop: 6 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONT.regular, fontSize: 15, color: TH.ink, textAlignVertical: 'top' },
  formError: { fontFamily: FONT.medium, fontSize: 13, color: RED, marginTop: 8 },
});
