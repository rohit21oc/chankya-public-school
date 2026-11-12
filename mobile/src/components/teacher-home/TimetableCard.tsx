import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import type { TimetableView } from '../../utils/teacherHomeModel';
import { T } from './T';
import { Icon } from './Icon';
import { Badge } from './Badge';

interface TimetableCardProps {
  view: TimetableView;
  /** Opens the full timetable. Omit when the user may not open it. */
  onOpenTimetable?: () => void;
}

/** Navy "Today's Timetable" card: current (or next) period and what follows it. */
export const TimetableCard: React.FC<TimetableCardProps> = ({ view, onOpenTimetable }) => (
  <View style={styles.card}>
    <View style={styles.heading}>
      <T style={styles.title}>Today's Timetable</T>
      <Badge label={view.badge} tone="gold" />
    </View>

    {view.headline ? (
      <View style={styles.lesson}>
        <View style={styles.accent} />
        <View style={styles.lessonText}>
          <T style={styles.small}>{view.headline.timeLabel}</T>
          <T style={styles.lessonTitle} numberOfLines={2}>
            {view.headline.title}
          </T>
          <T style={styles.small}>{view.headline.meta}</T>
        </View>
      </View>
    ) : (
      <T style={styles.empty}>{view.emptyText}</T>
    )}

    {!!view.following && (
      <TouchableOpacity
        style={styles.following}
        onPress={onOpenTimetable}
        disabled={!onOpenTimetable}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${view.following}. Open timetable`}
      >
        <Icon name="clock" size={16} color={TH.gold} />
        <T style={styles.followingText} numberOfLines={1}>
          {view.following}
        </T>
        {!!onOpenTimetable && <Icon name="chevron" size={16} color="#FFFFFF" />}
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: TH.navy, borderRadius: 16, padding: 16, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontFamily: FONT.heading, fontSize: 18, color: '#FFFFFF' },
  lesson: { flexDirection: 'row', gap: 12 },
  accent: { width: 4, borderRadius: 4, backgroundColor: TH.gold },
  lessonText: { flex: 1, gap: 4 },
  small: { fontFamily: FONT.regular, fontSize: 11, lineHeight: 15.4, color: TH.onNavyMuted },
  lessonTitle: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 30.8, color: '#FFFFFF' },
  empty: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 16.8, color: TH.onNavyMuted },
  following: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: TH.onNavyPanel,
  },
  followingText: { flex: 1, fontFamily: FONT.regular, fontSize: 11, lineHeight: 15.4, color: '#FFFFFF' },
});
