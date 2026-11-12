import React, { useEffect, useMemo, useState } from 'react';
import { markNoticesSeen } from '../../services/activityStore';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { BRAND_COLORS } from '../../utils/branding';
import { T } from '../../components/teacher-home/T';
import { Card } from '../../components/teacher-home/ListParts';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren } from '../../parent/ParentChildContext';
import { ParentHeader, Pill, Screen, Segmented, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { formatDisplayDate, kolkataDate } from '../../utils/parentRules';
import { isNewNotice, NoticeTab, noticesForTab } from '../../utils/studentPortalRules';

/** Collapsed preview: drop divider lines such as "=====" that notices use for layout. */
const previewText = (text: string) => text.split('\n').filter((l) => !/^\s*[=\-_*~]{3,}\s*$/.test(l)).join('\n').trim();
const noticeDate = (n: any) => String(n.publishedDate || n.publishDate || n.date || n.createdAt || '').substring(0, 10);

export const MyNotices: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { activeChild } = useParentChildren();
  const [tab, setTab] = useState<NoticeTab>('ALL');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    markNoticesSeen();
  }, []);
  const today = kolkataDate();

  const notices = useChildData(async (_c, o) => {
    const r = await apiService.getMyNotices(o);
    return { ok: r.ok, status: r.status, error: r.error, data: r.data };
  });

  const list = useMemo(() => noticesForTab(notices.data as any[], tab), [notices.data, tab]);

  return (
    <Screen header={<ParentHeader title="Notices" onBack={onBack} />} refreshing={notices.refreshing} onRefresh={notices.refresh}>
      <Segmented
        options={[
          { value: 'ALL', label: 'All' },
          { value: 'ACADEMIC', label: 'Academic' },
          { value: 'GENERAL', label: 'General' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as NoticeTab)}
      />
      {!activeChild && notices.state === 'loading' ? (
        <SkeletonList rows={4} height={72} />
      ) : notices.state === 'error' && !notices.data ? (
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
              <TouchableOpacity key={n.id} onPress={() => setOpen(expanded ? null : n.id)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${n.title || 'Notice'}. ${expanded ? 'Collapse' : 'Read more'}`}>
                <Card gap={SPACE.sm}>
                  <View style={styles.top}>
                    <T style={styles.title} numberOfLines={expanded ? undefined : 3}>
                      {n.title || 'Notice'}
                    </T>
                    {isNewNotice(n, today) ? <Pill label="New" tone="danger" /> : n.isUrgent ? <Pill label="Urgent" tone="danger" /> : null}
                  </View>
                  {!!n.content && (
                    <T style={styles.body} numberOfLines={expanded ? undefined : 2}>
                      {expanded ? n.content : previewText(String(n.content))}
                    </T>
                  )}
                  <T style={styles.meta}>
                    {formatDisplayDate(noticeDate(n))}
                    {n.publishedBy || n.author ? ` · ${n.publishedBy || n.author}` : ''}
                  </T>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.sm },
  title: { flex: 1, fontFamily: FONT.semibold, fontSize: 15, lineHeight: 21, color: TH.ink },
  body: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 19, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: BRAND_COLORS.textMuted },
});
