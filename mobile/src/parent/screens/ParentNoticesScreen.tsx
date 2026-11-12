import React, { useEffect, useMemo, useState } from 'react';
import { markNoticesSeen } from '../../services/activityStore';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Card, CardMessage } from '../../components/teacher-home/ListParts';
import { Icon } from '../../components/teacher-home/Icon';
import { apiService } from '../../services/apiService';
import { useChildData } from '../ParentChildContext';
import { ParentHeader, Pill, Screen, Segmented, SkeletonList, SPACE, StateBlock } from '../ui';
import { formatDisplayDate, upcomingCalendar } from '../../utils/parentRules';

/** Collapsed preview: drop divider lines such as "=====" that notices use for layout. */
const previewText = (text: string) => text.split('\n').filter((l) => !/^\s*[=\-_*~]{3,}\s*$/.test(l)).join('\n').trim();

const noticeDate = (n: any) => String(n.publishedDate || n.publishDate || n.date || n.createdAt || '').substring(0, 10);

export const ParentNoticesScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tab, setTab] = useState<'notices' | 'calendar'>('notices');
  useEffect(() => {
    markNoticesSeen();
  }, []);
  const [open, setOpen] = useState<string | null>(null);

  const notices = useChildData(async (_c, o) => {
    const r = await apiService.getParentNotices(o);
    const list = (r.data || [])
      .filter((n: any) => !n.status || n.status === 'PUBLISHED')
      .sort((a: any, b: any) => Number(!!b.isPinned) - Number(!!a.isPinned) || noticeDate(b).localeCompare(noticeDate(a)));
    return { ok: r.ok, status: r.status, error: r.error, data: list };
  });

  const calendar = useChildData(async () => {
    const [h, e] = await Promise.all([apiService.getHolidays(), apiService.getEvents()]);
    if (!h.ok && !e.ok) return { ok: false, status: h.status, error: h.error || e.error };
    return { ok: true, data: upcomingCalendar(h.ok ? h.data : [], e.ok ? e.data : []) };
  });

  const active = tab === 'notices' ? notices : calendar;
  const list = useMemo(() => (notices.data as any[]) || [], [notices.data]);

  return (
    <Screen header={<ParentHeader title="Notices & Events" onBack={onBack} />} refreshing={active.refreshing} onRefresh={active.refresh}>
      <Segmented
        options={[
          { value: 'notices', label: 'Notices' },
          { value: 'calendar', label: 'Holidays & events' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as 'notices' | 'calendar')}
      />

      {tab === 'notices' ? (
        notices.state === 'error' && !notices.data ? (
          <StateBlock kind="error" title="Notices could not be loaded" message={notices.error} onRetry={notices.reload} />
        ) : notices.state === 'loading' && !notices.data ? (
          <SkeletonList rows={4} height={72} />
        ) : list.length === 0 ? (
          <StateBlock kind="empty" icon="megaphone" title="No notices right now" />
        ) : (
          <View style={{ gap: SPACE.md }}>
            {list.map((n: any) => {
              const expanded = open === n.id;
              return (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => setOpen(expanded ? null : n.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${n.title || 'Notice'}. ${expanded ? 'Collapse' : 'Read more'}`}
                >
                  <Card gap={SPACE.sm}>
                    <View style={styles.top}>
                      <T style={styles.date}>{formatDisplayDate(noticeDate(n))}</T>
                      {n.isUrgent ? <Pill label="Urgent" tone="danger" /> : n.isImportant ? <Pill label="Important" tone="warning" /> : null}
                    </View>
                    <T style={styles.title}>{n.title || 'Notice'}</T>
                    {!!n.content && (
                      <T style={styles.body} numberOfLines={expanded ? undefined : 3}>
                        {expanded ? n.content : previewText(String(n.content))}
                      </T>
                    )}
                    {!!n.author && <T style={styles.meta}>{n.author}</T>}
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )
      ) : calendar.state === 'error' && !calendar.data ? (
        <StateBlock kind="error" title="School calendar could not be loaded" message={calendar.error} onRetry={calendar.reload} />
      ) : calendar.state === 'loading' && !calendar.data ? (
        <SkeletonList rows={4} height={56} />
      ) : (
        <Card gap={0}>
          {((calendar.data as any[]) || []).length === 0 ? (
            <CardMessage text="No upcoming holidays or events have been announced." />
          ) : (
            ((calendar.data as any[]) || []).map((it: any, i: number) => (
              <View key={it.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={[styles.rowIcon, it.kind === 'HOLIDAY' && { backgroundColor: TH.goldSoft }]}>
                  <Icon name={it.kind === 'HOLIDAY' ? 'calendar' : 'megaphone'} size={18} color={it.kind === 'HOLIDAY' ? TH.goldInk : TH.royal} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <T style={styles.rowTitle}>{it.title}</T>
                  <T style={styles.meta}>
                    {it.kind === 'HOLIDAY' ? 'Holiday' : 'Event'} · {formatDisplayDate(it.date)}
                    {it.endDate && it.endDate !== it.date ? ` – ${formatDisplayDate(it.endDate)}` : ''}
                  </T>
                  {!!it.detail && (
                    <T style={styles.meta} numberOfLines={3}>
                      {it.detail}
                    </T>
                  )}
                </View>
              </View>
            ))
          )}
        </Card>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  date: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  title: { fontFamily: FONT.semibold, fontSize: 16, lineHeight: 22, color: TH.ink },
  body: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingVertical: SPACE.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: TH.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
});
