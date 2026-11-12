import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from './T';
import { Icon, IconName } from './Icon';
import { Badge } from './Badge';

interface SectionHeadingProps {
  title: string;
  /** Right-hand text such as "2 tasks" or "View all". */
  action?: string;
  onActionPress?: () => void;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ title, action, onActionPress }) => (
  <View style={styles.heading}>
    <T style={styles.headingTitle} numberOfLines={1}>
      {title}
    </T>
    {!!action &&
      (onActionPress ? (
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.7}
          style={styles.actionTouch}
          accessibilityRole="button"
          accessibilityLabel={action}
        >
          <T style={styles.headingAction}>{action}</T>
        </TouchableOpacity>
      ) : (
        <T style={styles.headingAction}>{action}</T>
      ))}
  </View>
);

/** White rounded container used for rows and notices. */
export const Card: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 12 }) => (
  <View style={[styles.card, { gap }]}>{children}</View>
);

interface InfoRowProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  badge?: string;
  onPress?: () => void;
}

/** Icon tile + two lines of text + optional badge + chevron. */
export const InfoRow: React.FC<InfoRowProps> = ({ icon, title, subtitle, badge, onPress }) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.7}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={[title, subtitle, badge].filter(Boolean).join('. ')}
  >
    <View style={styles.iconTile}>
      <Icon name={icon} size={20} color={TH.royal} />
    </View>
    <View style={styles.rowText}>
      <T style={styles.rowTitle} numberOfLines={2}>
        {title}
      </T>
      {!!subtitle && (
        <T style={styles.rowSubtitle} numberOfLines={2}>
          {subtitle}
        </T>
      )}
    </View>
    {!!badge && <Badge label={badge} />}
    {!!onPress && <Icon name="chevron" size={16} color={TH.muted} />}
  </TouchableOpacity>
);

/** Plain message inside a card (empty states). */
export const CardMessage: React.FC<{ text: string }> = ({ text }) => <T style={styles.message}>{text}</T>;

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingTitle: { flexShrink: 1, fontFamily: FONT.heading, fontSize: 18, color: TH.navy },
  actionTouch: { minHeight: 44, justifyContent: 'center', marginVertical: -12 },
  headingAction: { fontFamily: FONT.semibold, fontSize: 11, color: TH.royal },
  card: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TH.border,
    backgroundColor: TH.surface,
    shadowColor: '#0B1F4B',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: TH.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: FONT.semibold, fontSize: 14, lineHeight: 19.6, color: TH.ink },
  rowSubtitle: { fontFamily: FONT.regular, fontSize: 11, lineHeight: 15.4, color: TH.muted },
  message: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 16.8, color: TH.muted },
});
