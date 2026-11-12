import React, { useMemo, useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { BRAND_COLORS } from '../../utils/branding';
import { T } from '../../components/teacher-home/T';
import { apiService } from '../../services/apiService';
import { useChildData } from '../../parent/ParentChildContext';
import { ParentHeader, Pill, Screen, Segmented, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { formatDisplayDate, kolkataDate } from '../../utils/parentRules';
import { daysUntil, splitEvents } from '../../utils/studentPortalRules';

export const MyEvents: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [overrides, setOverrides] = useState<Record<string, { isInterested: boolean; interestedCount: number }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const today = kolkataDate();

  const events = useChildData(async () => {
    const r = await apiService.getEventsForMe();
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  });

  const { upcoming, past } = useMemo(() => splitEvents(events.data as any[], today), [events.data, today]);
  const shown = tab === 'upcoming' ? upcoming : past;

  const toggle = async (e: any) => {
    if (busyId) return;
    const cur = overrides[e.id] || { isInterested: !!e.isInterested, interestedCount: Number(e.interestedCount || 0) };
    setBusyId(e.id);
    setNote('');
    const r = await apiService.setEventInterest(e.id, !cur.isInterested);
    setBusyId(null);
    if (r.ok && r.event) setOverrides((o) => ({ ...o, [e.id]: { isInterested: !!r.event.isInterested, interestedCount: Number(r.event.interestedCount || 0) } }));
    else setNote('Could not save your response. Please try again.');
  };

  return (
    <Screen header={<ParentHeader title="Events" onBack={onBack} />} refreshing={events.refreshing} onRefresh={events.refresh}>
      <Segmented
        options={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'past', label: 'Past' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as 'upcoming' | 'past')}
      />
      {!!note && <T style={styles.note}>{note}</T>}
      {events.state === 'error' && !events.data ? (
        <StateBlock kind="error" title="Events could not be loaded" message={events.error} onRetry={events.reload} />
      ) : events.state === 'loading' && !events.data ? (
        <SkeletonList rows={3} height={120} />
      ) : shown.length === 0 ? (
        <StateBlock kind="empty" icon="calendar" title={tab === 'upcoming' ? 'No upcoming events' : 'No past events'} message={tab === 'upcoming' ? 'New school events will appear here.' : undefined} />
      ) : (
        <View style={{ gap: SPACE.md }}>
          {shown.map((e: any) => {
            const date = String(e.eventDate || e.date || '').substring(0, 10);
            const ov = overrides[e.id];
            const interested = ov ? ov.isInterested : !!e.isInterested;
            const count = ov ? ov.interestedCount : Number(e.interestedCount || 0);
            const d = daysUntil(date, today);
            return (
              <View key={e.id} style={styles.card}>
                {!!e.imageUrl && /^https?:\/\//.test(String(e.imageUrl)) ? <Image source={{ uri: String(e.imageUrl) }} style={styles.image} resizeMode="cover" /> : null}
                <View style={styles.body}>
                  <View style={styles.row}>
                    <T style={styles.title} numberOfLines={3}>
                      {e.title}
                    </T>
                    {tab === 'upcoming' ? <Pill label={d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`} tone={d <= 1 ? 'warning' : 'info'} /> : null}
                  </View>
                  <T style={styles.meta}>
                    {formatDisplayDate(date)}
                    {e.time ? ` · ${e.time}` : ''}
                  </T>
                  {!!e.location && <T style={styles.meta}>{e.location}</T>}
                  {!!e.description && (
                    <T style={styles.desc} numberOfLines={3}>
                      {e.description}
                    </T>
                  )}
                  {tab === 'upcoming' ? (
                    <TouchableOpacity style={[styles.btn, interested && styles.btnOn]} onPress={() => toggle(e)} disabled={busyId === e.id} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: interested }}>
                      <T style={[styles.btnText, interested && styles.btnTextOn]}>{interested ? 'Interested ✓' : "I'm interested"}{count > 0 ? ` · ${count}` : ''}</T>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border, overflow: 'hidden' },
  image: { width: '100%', height: 140, backgroundColor: TH.tile },
  body: { padding: SPACE.md, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.sm },
  title: { flex: 1, fontFamily: FONT.semibold, fontSize: 15, lineHeight: 21, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: BRAND_COLORS.textMuted },
  desc: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18, color: TH.ink, marginTop: 2 },
  btn: { minHeight: 44, marginTop: SPACE.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: BRAND_COLORS.primaryRoyal },
  btnOn: { backgroundColor: BRAND_COLORS.primaryRoyal },
  btnText: { fontFamily: FONT.semibold, fontSize: 13, color: BRAND_COLORS.primaryRoyal },
  btnTextOn: { color: '#FFFFFF' },
  note: { fontFamily: FONT.regular, fontSize: 12, color: BRAND_COLORS.error },
});
