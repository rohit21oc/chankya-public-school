import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Text } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { SystemBars } from '../components/SystemBars';
import { SchoolHeader } from '../components/SchoolHeader';
import { StateView } from '../components/ui/StateView';
import { Icon } from '../components/teacher-home/Icon';
import { T } from '../components/teacher-home/T';
import { Badge } from '../components/teacher-home/Badge';
import { apiService } from '../services/apiService';
import { User } from '../types';
import type { TeacherAuthorizedAssignments } from '../types/teacher';
import { buildMyClasses, ClassCard, MyClassesTab } from '../utils/teacherClassesModel';
import { TH, FONT } from '../theme/teacherHome';

interface MyClassesScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  /** Opens the My Students screen (the server limits it to the teacher's classes). */
  onOpenStudents: () => void;
}

/**
 * My Classes: classes the teacher is assigned to, and classes they are only qualified to teach.
 * Everything comes from GET /api/teacher/authorized-assignments, the same source that controls
 * My Students, attendance, marks entry and the timetable.
 */
export const MyClassesScreen: React.FC<MyClassesScreenProps> = ({ user, onBack, onOpenMenu, onOpenProfile, onOpenStudents }) => {
  const [data, setData] = useState<TeacherAuthorizedAssignments | null>(null);
  const [tab, setTab] = useState<MyClassesTab>('ASSIGNED');
  const [query, setQuery] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoadState('loading');
    const res = await apiService.getTeacherAuthorizedAssignments({ force: isRefresh });
    if (!mounted.current) return;
    if (res.ok && res.data) {
      setData(res.data);
      setError('');
      setLoadState('ready');
    } else if (data) {
      setError(res.error || 'Could not refresh your classes.');
      setLoadState('ready');
    } else {
      setError(res.error || 'Could not load your classes.');
      setLoadState('error');
    }
    setRefreshing(false);
    // `data` only decides between keeping old data and showing the error state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mounted.current = true;
    load(false);
    return () => {
      mounted.current = false;
    };
  }, [load, user.id]);

  const model = useMemo(() => buildMyClasses(data, query), [data, query]);
  const list = tab === 'ASSIGNED' ? model.assigned : model.qualified;

  const renderCard = ({ item }: { item: ClassCard }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpenStudents}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.subjectsText}. ${item.studentsText}`}
    >
      <View style={styles.iconTile}>
        <Icon name="notebook" size={22} color={TH.royal} />
      </View>
      <View style={styles.cardText}>
        <View style={styles.titleRow}>
          <T style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </T>
          {item.isClassTeacher && <Badge label="Class Teacher" tone="info" />}
        </View>
        <T style={styles.cardSub} numberOfLines={2}>
          {item.subjectsText}
        </T>
        <View style={styles.countRow}>
          <Icon name="users" size={12} color={TH.muted} />
          <T style={styles.cardCount}>{item.studentsText}</T>
        </View>
      </View>
      <Icon name="chevron" size={16} color={TH.muted} />
    </TouchableOpacity>
  );

  const emptyText =
    query.trim().length > 0
      ? 'No class matches your search.'
      : tab === 'ASSIGNED'
      ? 'No classes are assigned to you yet. Ask the school office to assign your classes.'
      : 'You are not qualified for any additional classes.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <SystemBars color={TH.bg} style="dark" bottomColor={TH.surface} />
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="My Classes" compact />

      <View style={styles.tabs} accessibilityRole="tablist">
        {([
          { id: 'ASSIGNED', label: `Assigned (${model.assignedCount})` },
          { id: 'QUALIFIED', label: `Qualified (${model.qualifiedCount})` },
        ] as Array<{ id: MyClassesTab; label: string }>).map((t) => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.id)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search class or subject"
          placeholderTextColor={TH.muted}
          style={styles.searchInput}
          autoCorrect={false}
          accessibilityLabel="Search classes"
          returnKeyType="search"
        />
      </View>

      {!!error && loadState === 'ready' && (
        <View style={styles.banner} accessibilityRole="alert">
          <T style={styles.bannerText}>{error} Showing the last loaded data.</T>
        </View>
      )}

      {loadState === 'loading' ? (
        <StateView variant="loading" title="Loading your classes" />
      ) : loadState === 'error' ? (
        <StateView variant="error" title="Classes unavailable" message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.key}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<StateView variant="empty" title={emptyText} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TH.bg },
  tabs: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12, padding: 4, backgroundColor: TH.surface, borderRadius: 14, borderWidth: 1, borderColor: TH.border },
  tab: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: TH.royal },
  tabText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.muted },
  tabTextActive: { color: '#FFFFFF', fontFamily: FONT.bold },
  searchBox: { marginHorizontal: 16, marginTop: 10 },
  searchInput: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: TH.border, backgroundColor: TH.surface, paddingHorizontal: 14, fontFamily: FONT.regular, fontSize: 13, color: TH.ink },
  banner: { marginHorizontal: 16, marginTop: 10, backgroundColor: TH.goldSoft, borderRadius: 12, padding: 12 },
  bannerText: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.goldInk },
  listContent: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  card: { marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: TH.surface, borderRadius: 16, borderWidth: 1, borderColor: TH.border },
  iconTile: { width: 48, height: 48, borderRadius: 14, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flexShrink: 1, fontFamily: FONT.bold, fontSize: 15, color: TH.ink },
  cardSub: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  cardCount: { fontFamily: FONT.medium, fontSize: 11, color: TH.muted },
});
