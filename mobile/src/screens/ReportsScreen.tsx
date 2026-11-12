import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { T } from '../components/teacher-home/T';
import { Icon } from '../components/teacher-home/Icon';
import { FONT, TH } from '../theme/teacherHome';
import { apiService } from '../services/apiService';
import { useSchoolIdentity } from '../services/schoolIdentity';
import { PERIOD_PRESETS, PeriodPreset, REPORT_TABS, ReportTab, classOptions, dateText, presetRange, shareText, tabView } from '../utils/reportModel';

/**
 * School reports on mobile: the same server report as the website, in a compact layout.
 * Filters (session, period, class, section) go to the server; fee and salary figures appear
 * only when the server returns them for this role. "Share" sends the visible report as text.
 */
interface Props {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

const TONE = { good: '#067647', warn: '#B54708', bad: '#B42318' } as const;

export const ReportsScreen: React.FC<Props> = ({ user, onBack, onOpenMenu, onOpenProfile }) => {
  const sid = useSchoolIdentity();
  const [tab, setTab] = useState<ReportTab>('SUMMARY');
  const [sessions, setSessions] = useState<Array<{ name: string; status?: string }>>([]);
  const [session, setSession] = useState<string>('');
  const [preset, setPreset] = useState<PeriodPreset>('SESSION');
  const [classes, setClasses] = useState<Array<{ id: string; name: string; sections: string[] }>>([]);
  const [classId, setClassId] = useState('');
  const [section, setSection] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    (async () => {
      const [ss, cl] = await Promise.all([apiService.getAcademicSessions(), apiService.getClasses()]);
      if (ss.ok) {
        setSessions(ss.data);
        const active = ss.data.find((x) => String(x.status || '').toUpperCase() === 'ACTIVE');
        if (active) setSession((cur) => cur || active.name);
      }
      if (cl.ok) setClasses(classOptions(cl.data));
    })();
  }, []);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    const r = await apiService.getOfficialReports({ academicSession: session || undefined, ...presetRange(preset, today), classId: classId || undefined, section: section || undefined });
    if (mine !== seq.current) return;
    if (r.ok) setData(r.data);
    else setError(r.error || 'The report could not be loaded.');
    setLoading(false);
    setRefreshing(false);
  }, [session, preset, classId, section]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const cls = classes.find((c) => c.id === classId);
  const view = useMemo(() => (data ? tabView(tab, data) : null), [tab, data]);
  const meta = data?.meta;
  const filtersLabel = meta
    ? `Session ${meta.academicSession} · ${dateText(meta.period?.from)} – ${dateText(meta.period?.to)} · ${cls ? `${cls.name}${section ? `-${section}` : ''}` : 'All classes'}`
    : '';

  const share = async () => {
    if (!data) return;
    try {
      await Share.share({ title: `${REPORT_TABS.find((t) => t.id === tab)!.label} report`, message: shareText(tab, data, sid, filtersLabel, user.name || '') });
    } catch {
      setError('Could not open sharing on this phone.');
    }
  };

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <T style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>{label}</T>
    </Pressable>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <SchoolHeader user={user} showBack onBack={onBack} onOpenMenu={onOpenMenu} onOpenProfile={onOpenProfile} title="Reports" subtitle={filtersLabel || 'School MIS'} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsBar} contentContainerStyle={s.tabs}>
        {REPORT_TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={[s.tab, tab === t.id && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
            <T style={[s.tabText, tab === t.id && s.tabTextOn]}>{t.label}</T>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
        {/* Filters */}
        <View style={s.filters}>
          {sessions.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
              {sessions.map((x) => (
                <Chip key={x.name} on={session === x.name} label={x.name} onPress={() => { setSession(x.name); setClassId(''); setSection(''); }} />
              ))}
            </ScrollView>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
            {PERIOD_PRESETS.map((p) => (
              <Chip key={p.id} on={preset === p.id} label={p.label} onPress={() => setPreset(p.id)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
            <Chip on={!classId} label="All classes" onPress={() => { setClassId(''); setSection(''); }} />
            {classes.map((c) => (
              <Chip key={c.id} on={classId === c.id} label={c.name} onPress={() => { setClassId(c.id); setSection(''); }} />
            ))}
          </ScrollView>
          {cls && cls.sections.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
              <Chip on={!section} label="All sections" onPress={() => setSection('')} />
              {cls.sections.map((x) => (
                <Chip key={x} on={section === x} label={`Section ${x}`} onPress={() => setSection(x)} />
              ))}
            </ScrollView>
          )}
          <View style={s.actions}>
            <Pressable onPress={() => { setLoading(true); void load(); }} style={[s.btn, s.btnGhost]} accessibilityRole="button" accessibilityLabel="Refresh report">
              <Icon name="refresh-cw" size={16} color={TH.ink} />
              <T style={s.btnText}>Refresh</T>
            </Pressable>
            <Pressable onPress={share} disabled={!data} style={[s.btn, s.btnPrimary, !data && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Share report">
              <Icon name="file-text" size={16} color="#FFFFFF" />
              <T style={[s.btnText, { color: '#FFFFFF' }]}>Share</T>
            </Pressable>
          </View>
        </View>

        {error && (
          <View style={s.errorBox} accessibilityRole="alert">
            <T style={s.errorText}>{error}</T>
            <Pressable onPress={() => { setLoading(true); void load(); }} style={s.retry}>
              <T style={s.retryText}>Try again</T>
            </Pressable>
          </View>
        )}

        {loading && !data ? (
          <View style={s.center}>
            <ActivityIndicator color={TH.royal} />
            <T style={s.muted}>Loading report…</T>
          </View>
        ) : view ? (
          <View style={{ gap: 12, opacity: loading ? 0.6 : 1 }}>
            {view.notice && (
              <View style={s.notice}>
                <T style={s.noticeText}>{view.notice}</T>
              </View>
            )}
            {view.kpis.length > 0 && (
              <View style={s.kpis}>
                {view.kpis.map((k) => (
                  <View key={k.label} style={s.kpi} accessibilityLabel={`${k.label}: ${k.value}`}>
                    <T style={s.kpiLabel} numberOfLines={1}>{k.label}</T>
                    <T style={[s.kpiValue, k.tone && { color: TONE[k.tone] }]} numberOfLines={1} adjustsFontSizeToFit>{k.value}</T>
                    {k.hint ? <T style={s.kpiHint} numberOfLines={1}>{k.hint}</T> : null}
                  </View>
                ))}
              </View>
            )}
            {view.sections.map((sec) => (
              <View key={sec.title} style={s.card}>
                <T style={s.cardTitle}>{sec.title}</T>
                {sec.note ? <T style={s.muted}>{sec.note}</T> : null}
                {sec.rows.length === 0 ? (
                  <T style={s.empty}>{sec.empty}</T>
                ) : (
                  sec.rows.map((r, i) => (
                    <View key={`${r.title}-${i}`} style={[s.listRow, i > 0 && s.listDivider]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T style={s.rowTitle} numberOfLines={1}>{r.title}</T>
                        {r.detail ? <T style={s.rowDetail} numberOfLines={2}>{r.detail}</T> : null}
                      </View>
                      <T style={[s.rowValue, r.tone && { color: TONE[r.tone] }]}>{r.value}</T>
                    </View>
                  ))
                )}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TH.bg },
  tabsBar: { flexGrow: 0, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: TH.border },
  tabs: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: { minHeight: 38, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' },
  tabOn: { backgroundColor: TH.navy },
  tabText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.muted },
  tabTextOn: { color: '#FFFFFF' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  filters: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, padding: 12, gap: 8 },
  row: { gap: 6 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { backgroundColor: TH.royal, borderColor: TH.royal },
  chipText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  chipTextOn: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnGhost: { borderWidth: 1, borderColor: TH.border, backgroundColor: '#FFFFFF' },
  btnPrimary: { backgroundColor: TH.navy },
  btnText: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  errorBox: { backgroundColor: '#FEF3F2', borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: '#FECDCA' },
  errorText: { fontFamily: FONT.medium, fontSize: 13, color: '#B42318' },
  retry: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FECDCA' },
  retryText: { fontFamily: FONT.semibold, fontSize: 13, color: '#B42318' },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  notice: { backgroundColor: TH.goldSoft, borderRadius: 12, padding: 12 },
  noticeText: { fontFamily: FONT.medium, fontSize: 13, color: TH.goldInk },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: TH.border, padding: 12 },
  kpiLabel: { fontFamily: FONT.semibold, fontSize: 11, color: TH.muted, textTransform: 'uppercase' },
  kpiValue: { fontFamily: FONT.heading, fontSize: 22, color: TH.ink, marginTop: 4 },
  kpiHint: { fontFamily: FONT.regular, fontSize: 11, color: TH.muted, marginTop: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: TH.border, padding: 14, gap: 6 },
  cardTitle: { fontFamily: FONT.bold, fontSize: 15, color: TH.ink },
  empty: { fontFamily: FONT.medium, fontSize: 13, color: TH.muted, paddingVertical: 16, textAlign: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  listDivider: { borderTopWidth: 1, borderTopColor: TH.border },
  rowTitle: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  rowDetail: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, marginTop: 1 },
  rowValue: { fontFamily: FONT.bold, fontSize: 14, color: TH.ink },
});
