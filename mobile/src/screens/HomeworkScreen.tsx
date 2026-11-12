import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Modal, Alert, Linking } from 'react-native';
import { KeyboardFrame } from '../components/ui/KeyboardFrame';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { BRAND_COLORS, resolveFileUrl } from '../utils/branding';
import { apiService } from '../services/apiService';
import { createSubmitGuard } from '../utils/submitGuard';
import {
  HomeworkItem,
  HomeworkClassOption,
  HomeworkForm,
  DueStatus,
  addDays,
  buildHomeworkPayload,
  canAssignHomework,
  formatDisplayDate,
  sectionsFor,
  sortAndFilterHomework,
  subjectsFor,
  todayInIndia,
  validateHomeworkForm,
} from '../utils/homeworkRules';

interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

const STATUS_UI: Record<DueStatus, { label: string; bg: string; fg: string }> = {
  DUE_TODAY: { label: 'Due today', bg: BRAND_COLORS.warningLight, fg: BRAND_COLORS.warning },
  UPCOMING: { label: 'Upcoming', bg: BRAND_COLORS.infoLight, fg: BRAND_COLORS.info },
  PAST_DUE: { label: 'Due date passed', bg: '#F2F4F7', fg: '#475467' },
  NO_DUE_DATE: { label: 'No due date', bg: '#F2F4F7', fg: '#475467' },
};

const emptyForm = (today: string): HomeworkForm => ({
  classId: '',
  section: '',
  subjectId: '',
  title: '',
  instructions: '',
  assignedDate: today,
  dueDate: '',
});

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void; disabled?: boolean }> = ({ label, active, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.5 }]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: active }}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export const HomeworkScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile }) => {
  const canWrite = canAssignHomework(user.role);
  const today = todayInIndia();
  const submitGuard = useRef(createSubmitGuard()).current;
  const loadSeq = useRef(0);

  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [options, setOptions] = useState<HomeworkClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [includePast, setIncludePast] = useState(false);
  const [filterClass, setFilterClass] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HomeworkItem | null>(null);
  const [form, setForm] = useState<HomeworkForm>(() => emptyForm(today));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setError(null);
    const [hw, opt] = await Promise.all([
      apiService.getHomework(),
      canWrite ? apiService.getHomeworkOptions() : Promise.resolve({ ok: true, classes: [] as any[], error: undefined }),
    ]);
    if (seq !== loadSeq.current) return;
    if (!hw.ok) {
      setError(hw.error || 'Homework could not be loaded. Please check your connection and try again.');
      setItems([]);
    } else {
      setItems(hw.data as HomeworkItem[]);
    }
    if (canWrite) {
      setOptions(opt.classes as HomeworkClassOption[]);
      setOptionsError(opt.ok ? null : opt.error || 'Could not load your classes.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [canWrite]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => sortAndFilterHomework(items, today, { includePast, classId: filterClass || undefined }),
    [items, today, includePast, filterClass]
  );
  const openCount = useMemo(() => sortAndFilterHomework(items, today, { includePast: false }).length, [items, today]);
  const classChips = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((h) => m.set(h.classId, h.className));
    return Array.from(m.entries());
  }, [items]);

  const formSections = sectionsFor(options, form.classId);
  const formSubjects = subjectsFor(options, form.classId, form.section);

  const openCreate = () => {
    const first = options.length === 1 ? options[0] : undefined;
    const sec = first && first.sections.length === 1 ? first.sections[0] : undefined;
    setEditing(null);
    setForm({
      ...emptyForm(today),
      classId: first?.classId || '',
      section: sec?.name || '',
      subjectId: sec && sec.subjects.length === 1 ? sec.subjects[0].id : '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (h: HomeworkItem) => {
    setEditing(h);
    setForm({
      classId: h.classId,
      section: h.section,
      subjectId: h.subjectId || '',
      title: h.title,
      instructions: h.instructions || '',
      assignedDate: h.assignedDate,
      dueDate: h.dueDate,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    const problem = validateHomeworkForm(form, options);
    if (problem) {
      setFormError(problem);
      return;
    }
    if (!submitGuard.tryEnter()) return;
    setFormError(null);
    setSaving(true);
    try {
      const res = await apiService.saveHomework(buildHomeworkPayload(form), editing?.id);
      if (!res.ok || !res.success) {
        setFormError(res.error || 'Could not save homework. Please try again.');
        return;
      }
      setFormOpen(false);
      setEditing(null);
      setNotice({ type: 'success', text: editing ? 'Homework updated.' : 'Homework assigned.' });
      load();
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      submitGuard.leave();
      setSaving(false);
    }
  };

  const confirmDelete = (h: HomeworkItem) => {
    Alert.alert('Delete homework?', `“${h.title}” will be removed for all students of ${h.className} ${h.section}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await apiService.deleteHomework(h.id);
          if (res.ok && res.success) {
            setNotice({ type: 'success', text: 'Homework deleted.' });
            load();
          } else {
            setNotice({ type: 'error', text: res.error || 'Could not delete homework.' });
          }
        },
      },
    ]);
  };

  const openAttachment = (key?: string) => {
    if (!key) return;
    Linking.openURL(resolveFileUrl(key)).catch(() => setNotice({ type: 'error', text: 'Could not open the attachment.' }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        showBack
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        title="Homework"
        subtitle={canWrite ? (user.role === 'TEACHER' ? 'Your classes and subjects' : 'All classes') : 'Your class and section'}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[BRAND_COLORS.primaryBright]}
          />
        }
      >
        {canWrite && (
          <TouchableOpacity
            style={[styles.primaryBtn, options.length === 0 && { opacity: 0.5 }]}
            onPress={openCreate}
            disabled={options.length === 0}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Assign homework"
          >
            <Text style={styles.primaryBtnText}>+ Assign Homework</Text>
          </TouchableOpacity>
        )}
        {canWrite && optionsError && (
          <View style={[styles.banner, styles.bannerWarn]}>
            <Text style={[styles.bannerText, { color: BRAND_COLORS.warning }]}>{optionsError}</Text>
          </View>
        )}
        {canWrite && !optionsError && !loading && options.length === 0 && (
          <View style={[styles.banner, styles.bannerWarn]}>
            <Text style={[styles.bannerText, { color: BRAND_COLORS.warning }]}>No classes are assigned to you yet, so homework cannot be created.</Text>
          </View>
        )}
        {notice && (
          <View style={[styles.banner, notice.type === 'success' ? styles.bannerOk : styles.bannerErr]}>
            <Text style={[styles.bannerText, { color: notice.type === 'success' ? BRAND_COLORS.success : BRAND_COLORS.error }]}>{notice.text}</Text>
          </View>
        )}

        <View style={styles.filterRow}>
          <Chip label={`Current (${openCount})`} active={!includePast} onPress={() => setIncludePast(false)} />
          <Chip label={`All (${items.length})`} active={includePast} onPress={() => setIncludePast(true)} />
        </View>
        {canWrite && classChips.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Chip label="All classes" active={!filterClass} onPress={() => setFilterClass('')} />
            {classChips.map(([id, name]) => (
              <Chip key={id} label={name} active={filterClass === id} onPress={() => setFilterClass(id)} />
            ))}
          </ScrollView>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={BRAND_COLORS.primaryRoyal} />
            <Text style={styles.muted}>Loading homework...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Homework could not be loaded</Text>
            <Text style={styles.muted}>{error}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.secondaryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>{items.length === 0 ? 'No homework assigned yet' : 'No current homework'}</Text>
            <Text style={styles.muted}>
              {items.length === 0
                ? canWrite
                  ? 'Tap “Assign Homework” to post the first task.'
                  : 'Homework posted for your class will appear here.'
                : 'Past-due homework is hidden. Choose “All” to see it.'}
            </Text>
          </View>
        ) : (
          shown.map((h) => {
            const ui = STATUS_UI[h.status];
            return (
              <View key={h.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subject} numberOfLines={1}>
                      {h.subjectName} · {h.className} {h.section}
                    </Text>
                    <Text style={styles.title}>{h.title}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: ui.bg }]}>
                    <Text style={[styles.pillText, { color: ui.fg }]}>{ui.label}</Text>
                  </View>
                </View>
                {!!h.instructions && <Text style={styles.body}>{h.instructions}</Text>}
                <Text style={styles.meta}>
                  Due {formatDisplayDate(h.dueDate)} · Assigned {formatDisplayDate(h.assignedDate)}
                  {h.teacherName ? ` · By ${h.teacherName}` : ''}
                </Text>
                {!!h.attachmentName && (
                  <TouchableOpacity
                    onPress={() => openAttachment(h.attachmentFileKey)}
                    disabled={!h.attachmentFileKey}
                    accessibilityRole="button"
                    accessibilityLabel={`Open attachment ${h.attachmentName}`}
                    style={styles.attachRow}
                  >
                    <Text style={[styles.attachText, !h.attachmentFileKey && { color: BRAND_COLORS.textMuted }]} numberOfLines={1}>
                      📎 {h.attachmentName}
                    </Text>
                  </TouchableOpacity>
                )}
                {canWrite && h.canManage && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => openEdit(h)} accessibilityRole="button" accessibilityLabel={`Edit ${h.title}`}>
                      <Text style={styles.secondaryBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.secondaryBtn, styles.dangerBtn]} onPress={() => confirmDelete(h)} accessibilityRole="button" accessibilityLabel={`Delete ${h.title}`}>
                      <Text style={[styles.secondaryBtnText, { color: BRAND_COLORS.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={formOpen} animationType="slide" onRequestClose={closeForm} statusBarTranslucent navigationBarTranslucent>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardFrame own>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{editing ? 'Edit Homework' : 'Assign Homework'}</Text>
              <TouchableOpacity onPress={closeForm} accessibilityRole="button" accessibilityLabel="Close form" style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              {!!formError && (
                <View style={[styles.banner, styles.bannerErr]}>
                  <Text style={[styles.bannerText, { color: BRAND_COLORS.error }]}>{formError}</Text>
                </View>
              )}

              <Text style={styles.label}>Class *</Text>
              <View style={styles.chipWrap}>
                {options.map((c) => (
                  <Chip key={c.classId} label={c.className} active={form.classId === c.classId} onPress={() => setForm({ ...form, classId: c.classId, section: '', subjectId: '' })} />
                ))}
              </View>

              <Text style={styles.label}>Section *</Text>
              <View style={styles.chipWrap}>
                {form.classId === '' && <Text style={styles.muted}>Select a class first.</Text>}
                {formSections.map((s) => (
                  <Chip key={s.name} label={s.name} active={form.section === s.name} onPress={() => setForm({ ...form, section: s.name, subjectId: '' })} />
                ))}
              </View>

              <Text style={styles.label}>Subject *</Text>
              <View style={styles.chipWrap}>
                {form.section === '' && <Text style={styles.muted}>Select a section first.</Text>}
                {formSubjects.map((s) => (
                  <Chip key={s.id} label={s.name} active={form.subjectId === s.id} onPress={() => setForm({ ...form, subjectId: s.id })} />
                ))}
              </View>

              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={(t) => setForm({ ...form, title: t })}
                placeholder="e.g. Chapter 4 exercise questions"
                placeholderTextColor={BRAND_COLORS.textMuted}
                maxLength={150}
                accessibilityLabel="Homework title"
              />

              <Text style={styles.label}>Instructions *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.instructions}
                onChangeText={(t) => setForm({ ...form, instructions: t })}
                placeholder="What should students do?"
                placeholderTextColor={BRAND_COLORS.textMuted}
                multiline
                maxLength={5000}
                accessibilityLabel="Homework instructions"
              />

              <Text style={styles.label}>Assigned date * (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={form.assignedDate}
                onChangeText={(t) => setForm({ ...form, assignedDate: t })}
                placeholder="2026-10-21"
                placeholderTextColor={BRAND_COLORS.textMuted}
                keyboardType="numeric"
                maxLength={10}
                accessibilityLabel="Assigned date"
              />

              <Text style={styles.label}>Due date * (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={form.dueDate}
                onChangeText={(t) => setForm({ ...form, dueDate: t })}
                placeholder="2026-10-24"
                placeholderTextColor={BRAND_COLORS.textMuted}
                keyboardType="numeric"
                maxLength={10}
                accessibilityLabel="Due date"
              />
              <View style={styles.chipWrap}>
                <Chip label="Tomorrow" active={false} onPress={() => setForm({ ...form, dueDate: addDays(today, 1) })} />
                <Chip label="In 3 days" active={false} onPress={() => setForm({ ...form, dueDate: addDays(today, 3) })} />
                <Chip label="In 1 week" active={false} onPress={() => setForm({ ...form, dueDate: addDays(today, 7) })} />
              </View>

              {editing?.attachmentName ? (
                <Text style={styles.muted}>Attachment “{editing.attachmentName}” stays as it is. Attachments are added or replaced from the web.</Text>
              ) : (
                <Text style={styles.muted}>Attachments can be added from the web version.</Text>
              )}
            </ScrollView>
            <View style={styles.formFooter}>
              <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={closeForm} disabled={saving}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 2, marginTop: 0 }, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving} accessibilityRole="button">
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryBtnText}>{editing ? 'Save Changes' : 'Assign Homework'}</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardFrame>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.surfaceSoft },
  content: { padding: 16, paddingBottom: 40 },
  primaryBtn: { minHeight: 48, borderRadius: 12, backgroundColor: BRAND_COLORS.primaryRoyal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 12 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: BRAND_COLORS.borderDark, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryBtnText: { color: BRAND_COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  dangerBtn: { borderColor: '#FDA29B', backgroundColor: BRAND_COLORS.errorLight },
  banner: { borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1 },
  bannerOk: { backgroundColor: BRAND_COLORS.successLight, borderColor: '#A6F4C5' },
  bannerErr: { backgroundColor: BRAND_COLORS.errorLight, borderColor: '#FECDCA' },
  bannerWarn: { backgroundColor: BRAND_COLORS.warningLight, borderColor: '#FEDF89' },
  bannerText: { fontSize: 13, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, paddingRight: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: BRAND_COLORS.borderDark, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: BRAND_COLORS.primaryRoyal, borderColor: BRAND_COLORS.primaryRoyal },
  chipText: { fontSize: 13, fontWeight: '600', color: BRAND_COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  center: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  muted: { fontSize: 12, color: BRAND_COLORS.textMuted, lineHeight: 18 },
  stateCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: BRAND_COLORS.borderColor, padding: 20, alignItems: 'center', gap: 8 },
  stateTitle: { fontSize: 15, fontWeight: '700', color: BRAND_COLORS.textPrimary, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: BRAND_COLORS.borderColor, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  subject: { fontSize: 11, fontWeight: '800', color: BRAND_COLORS.success, textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontSize: 15, fontWeight: '700', color: BRAND_COLORS.textPrimary, marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 10, fontWeight: '800' },
  body: { fontSize: 13, color: BRAND_COLORS.textSecondary, marginTop: 8, lineHeight: 19 },
  meta: { fontSize: 11, color: BRAND_COLORS.textMuted, marginTop: 8 },
  attachRow: { minHeight: 36, justifyContent: 'center', marginTop: 4 },
  attachText: { fontSize: 13, fontWeight: '600', color: BRAND_COLORS.primaryBright },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: BRAND_COLORS.borderColor, backgroundColor: '#FFFFFF' },
  formTitle: { fontSize: 17, fontWeight: '800', color: BRAND_COLORS.textPrimary },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, color: BRAND_COLORS.textSecondary },
  formContent: { padding: 16, paddingBottom: 24 },
  formFooter: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: BRAND_COLORS.borderColor, backgroundColor: '#FFFFFF' },
  label: { fontSize: 12, fontWeight: '700', color: BRAND_COLORS.textSecondary, marginBottom: 6, marginTop: 4 },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: BRAND_COLORS.borderDark, backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontSize: 15, color: BRAND_COLORS.textPrimary, marginBottom: 12 },
  textArea: { minHeight: 120, paddingTop: 12 },
});
