import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { KScrollView as ScrollView } from '../components/ui/KScrollView';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, Student } from '../types';
import type { TeacherAuthorizedAssignments } from '../types/teacher';
import { SchoolHeader } from '../components/SchoolHeader';
import { StateView } from '../components/ui/StateView';
import { apiService } from '../services/apiService';
import { BRAND_COLORS, resolveFileUrl } from '../utils/branding';

interface MyStudentsScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
}

interface SectionTarget {
  key: string;
  classId: string;
  className: string;
  section: string;
}

const ALL_KEY = 'ALL';

const initialsOf = (name?: string) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || 'S';

/**
 * Students the teacher is assigned to teach. Sections come from the server's
 * authorized-assignments response, and student lists come from the server's
 * section-scoped query. The server returns 403 for any other section.
 */
export const MyStudentsScreen: React.FC<MyStudentsScreenProps> = ({
  user,
  onBack,
  onOpenMenu,
  onOpenProfile,
}) => {
  const [sections, setSections] = useState<SectionTarget[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(ALL_KEY);
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [partialWarning, setPartialWarning] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const buildSections = (a: TeacherAuthorizedAssignments): SectionTarget[] =>
    a.classes.flatMap((c) =>
      c.sections.map((s) => ({
        key: `${c.classId}|${s}`,
        classId: c.classId,
        className: c.className,
        section: s,
      }))
    );

  const loadStudents = useCallback(
    async (targets: SectionTarget[], selected: string) => {
      const chosen = selected === ALL_KEY ? targets : targets.filter((t) => t.key === selected);
      if (chosen.length === 0) {
        setStudents([]);
        setLoadState('ready');
        return;
      }

      const results = await Promise.all(
        chosen.map((t) => apiService.getStudentsForSection(t.classId, t.section))
      );

      const failed = results.filter((r) => !r.ok).length;
      const byId = new Map<string, Student>();
      results.forEach((r) => r.ok && r.data.forEach((st) => byId.set(st.id, st)));

      const list = Array.from(byId.values()).sort((a, b) => {
        const ra = Number(a.rollNumber) || Number.MAX_SAFE_INTEGER;
        const rb = Number(b.rollNumber) || Number.MAX_SAFE_INTEGER;
        return ra - rb || (a.name || '').localeCompare(b.name || '');
      });

      setStudents(list);
      setPartialWarning(
        failed > 0 ? `${failed} section(s) could not be loaded. Pull down to retry.` : ''
      );
      setLoadState('ready');
    },
    []
  );

  const loadAll = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoadState('loading');
      const res = await apiService.getTeacherAuthorizedAssignments();
      if (!res.ok || !res.data) {
        setLoadError(res.error || 'Could not verify your assigned classes.');
        setSections([]);
        setStudents([]);
        setLoadState('error');
        setRefreshing(false);
        return;
      }
      const targets = buildSections(res.data);
      setSections(targets);
      await loadStudents(targets, selectedKey);
      setRefreshing(false);
    },
    // selectedKey is intentionally read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadStudents, selectedKey]
  );

  useEffect(() => {
    loadAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const onSelectSection = (key: string) => {
    setSelectedKey(key);
    setExpandedId(null);
    setLoadState('loading');
    loadStudents(sections, key);
  };

  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.admissionNumber || '').toLowerCase().includes(q) ||
        String(s.rollNumber || '').toLowerCase().includes(q)
    );
  }, [students, query]);

  const renderStudent = ({ item }: { item: Student }) => {
    const expanded = expandedId === item.id;
    const photoSource = item.photo || item.photoFileKey;
    const photoUrl = photoSource ? resolveFileUrl(photoSource) : '';
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => setExpandedId(expanded ? null : item.id)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.className} ${item.section}`}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} accessibilityLabel={`Photo of ${item.name}`} />
        ) : (
          <View style={[styles.photo, styles.photoFallback]}>
            <Text style={styles.photoInitials}>{initialsOf(item.name)}</Text>
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.className && `${item.className}-${item.section}`, item.rollNumber && `Roll ${item.rollNumber}`, item.admissionNumber]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {expanded && (
            <View style={styles.details}>
              <DetailLine label="Father" value={item.fatherName} />
              <DetailLine label="Parent phone" value={item.parentPhone || item.fatherMobile} />
              <DetailLine label="Gender" value={item.gender} />
              <DetailLine label="Status" value={item.status} />
            </View>
          )}
        </View>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </TouchableOpacity>
    );
  };

  const chips = [{ key: ALL_KEY, label: 'All my sections' }, ...sections.map((s) => ({ key: s.key, label: `${s.className}-${s.section}` }))];

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        title="My Students"
        showBack
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
      />

      {loadState === 'error' ? (
        <StateView
          variant="error"
          title="Students unavailable"
          message={loadError}
          onRetry={() => loadAll(false)}
        />
      ) : (
        <>
          <View style={styles.controls}>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, admission no. or roll no."
              placeholderTextColor={BRAND_COLORS.textMuted}
              autoCorrect={false}
              accessibilityLabel="Search students"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {chips.map((c) => {
                const active = c.key === selectedKey;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onSelectSection(c.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {!!partialWarning && <Text style={styles.warn}>{partialWarning}</Text>}
            <Text style={styles.count}>
              {loadState === 'loading' ? 'Loading…' : `${visibleStudents.length} student(s)`}
            </Text>
          </View>

          {loadState === 'loading' && students.length === 0 ? (
            <StateView variant="loading" title="Loading students" />
          ) : visibleStudents.length === 0 ? (
            <StateView
              variant="empty"
              title={query ? 'No matching students' : 'No students in your sections'}
              message={query ? 'Try a different search.' : 'Students appear here once they are enrolled in your assigned sections.'}
            />
          ) : (
            <FlatList
              data={visibleStudents}
              keyExtractor={(item) => item.id}
              renderItem={renderStudent}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadAll(true);
                  }}
                  colors={[BRAND_COLORS.primaryBright]}
                />
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const DetailLine: React.FC<{ label: string; value?: string }> = ({ label, value }) =>
  value ? (
    <Text style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}: </Text>
      {value}
    </Text>
  ) : null;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.surfaceSoft },
  controls: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  search: {
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.borderDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    fontSize: 14,
    color: BRAND_COLORS.textPrimary,
  },
  chipRow: { paddingVertical: 10, gap: 8 },
  chip: {
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.borderDark,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: 'center',
    marginRight: 8,
  },
  chipActive: { backgroundColor: BRAND_COLORS.primaryRoyal, borderColor: BRAND_COLORS.primaryRoyal },
  chipText: { fontSize: 13, color: BRAND_COLORS.primaryRoyal, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  warn: { fontSize: 12, color: BRAND_COLORS.warning, marginBottom: 4 },
  count: { fontSize: 12, color: BRAND_COLORS.textMuted, marginBottom: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: BRAND_COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_COLORS.borderColor,
    padding: 12,
    marginBottom: 10,
  },
  photo: { width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND_COLORS.surfaceSoft },
  photoFallback: { backgroundColor: BRAND_COLORS.primaryRoyal, alignItems: 'center', justifyContent: 'center' },
  photoInitials: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  rowText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '700', color: BRAND_COLORS.textPrimary },
  meta: { fontSize: 12, color: BRAND_COLORS.textMuted, marginTop: 2 },
  details: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND_COLORS.borderColor,
  },
  detailLine: { fontSize: 13, color: BRAND_COLORS.textSecondary, marginTop: 3 },
  detailLabel: { fontWeight: '700', color: BRAND_COLORS.textPrimary },
  chevron: { fontSize: 14, color: BRAND_COLORS.textMuted, marginLeft: 8, marginTop: 2 },
});
