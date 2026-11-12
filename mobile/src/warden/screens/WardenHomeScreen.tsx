import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon, IconName } from '../../components/teacher-home/Icon';
import { Card, SectionHeading } from '../../components/teacher-home/ListParts';
import { Banner, Screen, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { User } from '../../types';
import { wardenApi, WardenDashboard } from '../wardenApi';
import { QuickTile, StatTile, TONE_COLORS, WardenHeader } from '../wardenUi';
import type { WardenRoute } from '../routes';

interface Props {
  user: User;
  onNavigate: (r: WardenRoute) => void;
}

const KIND_ICON: Record<string, IconName> = {
  ATTENDANCE: 'moon',
  CORRECTION: 'history',
  ALERT: 'circle-alert',
  EMERGENCY: 'triangle-alert',
  LEAVE: 'calendar',
  MESS: 'utensils',
};

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
};

const greeting = () => {
  const h = Number(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(11, 13));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Warden home: tonight's numbers, open alerts, quick links and today's activity. Everything comes from the server. */
export const WardenHomeScreen: React.FC<Props> = ({ user, onNavigate }) => {
  const [data, setData] = useState<WardenDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    const r = await wardenApi.dashboard();
    if (r.ok && r.data) {
      setData(r.data);
      setError(null);
    } else setError(r.error || 'The dashboard could not be loaded.');
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hostelName = data?.hostels?.map((h) => h.name).join(', ');
  const st = data?.stats;

  return (
    <Screen
      header={<WardenHeader title={`${greeting()}, ${String(user.name || 'Warden').split(' ')[0]}`} subtitle={hostelName || 'Hostel Warden'} />}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      {loading ? (
        <SkeletonList rows={4} height={96} />
      ) : !data ? (
        <StateBlock kind="error" title="Dashboard not available" message={error || undefined} onRetry={() => load()} />
      ) : data.hostels.length === 0 ? (
        <StateBlock
          kind="empty"
          icon="bed"
          title="No hostel assigned to you yet"
          message="Ask the school office to choose your hostel in your staff record (Hostel assignment). Your students will appear here then."
          onRetry={() => load()}
        />
      ) : (
        <>
          {!!error && <Banner text={error} onRetry={() => load()} />}

          <View style={styles.tonight}>
            <View style={{ flex: 1 }}>
              <T style={styles.tonightLabel}>Night roll-call · {data.date}</T>
              <T style={styles.tonightValue}>
                {data.attendanceTaken ? `${st!.present} of ${st!.totalStudents} present` : 'Not taken yet'}
              </T>
              {st!.unmarked > 0 && data.attendanceTaken && <T style={styles.tonightSub}>{st!.unmarked} student(s) still to mark</T>}
            </View>
            <TouchableOpacity style={styles.tonightBtn} onPress={() => onNavigate('attendance')} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Open night attendance">
              <Icon name="moon" size={18} color={TH.navy} />
              <T style={styles.tonightBtnText}>{data.attendanceTaken ? 'Open' : 'Take now'}</T>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            <StatTile label="Total students" value={st!.totalStudents} icon="users" tone="info" onPress={() => onNavigate('students')} />
            <StatTile label="Present" value={st!.present} icon="check" tone="success" onPress={() => onNavigate('attendance')} />
            <StatTile label="Absent" value={st!.absent} icon="x" tone="danger" onPress={() => onNavigate('attendance')} />
            <StatTile label="Outside" value={st!.outside} icon="door-open" tone="warning" onPress={() => onNavigate('attendance')} />
            <StatTile label="On leave" value={Math.max(st!.onLeave, st!.onApprovedLeave)} icon="calendar" tone="info" onPress={() => onNavigate('leaves')} />
            <StatTile label="Emergency" value={st!.emergencyAlerts} icon="triangle-alert" tone={st!.emergencyAlerts > 0 ? 'danger' : 'neutral'} onPress={() => onNavigate('alerts')} />
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Quick access" />
            <View style={styles.quickRow}>
              <QuickTile label="Attendance" icon="clipboard" onPress={() => onNavigate('attendance')} />
              <QuickTile label="Students" icon="users" onPress={() => onNavigate('students')} />
              <QuickTile label="Leave Requests" icon="calendar" badge={st!.pendingLeaves} onPress={() => onNavigate('leaves')} />
              <QuickTile label="Mess Menu" icon="utensils" onPress={() => onNavigate('mess')} />
            </View>
          </View>

          {data.alerts.length > 0 && (
            <View style={{ gap: SPACE.sm }}>
              <SectionHeading title={`Open alerts (${st!.openAlerts})`} action="View all" onActionPress={() => onNavigate('alerts')} />
              <Card gap={SPACE.sm}>
                {data.alerts.slice(0, 3).map((a) => {
                  const tone = a.type === 'EMERGENCY' ? 'danger' : 'warning';
                  return (
                    <TouchableOpacity key={a.id} style={styles.alertRow} onPress={() => onNavigate('alerts')} activeOpacity={0.7} accessibilityRole="button">
                      <View style={[styles.alertIcon, { backgroundColor: TONE_COLORS[tone].bg }]}>
                        <Icon name={a.type === 'EMERGENCY' ? 'triangle-alert' : 'circle-alert'} size={18} color={TONE_COLORS[tone].fg} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T style={styles.alertTitle} numberOfLines={1}>
                          {a.type === 'EMERGENCY' ? 'Emergency' : 'Absent at night'}
                          {a.studentName ? ` · ${a.studentName}` : ''}
                        </T>
                        <T style={styles.alertMsg} numberOfLines={2}>
                          {a.message}
                        </T>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Card>
            </View>
          )}

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Today's hostel activities" />
            {data.activities.length === 0 ? (
              <StateBlock kind="empty" icon="clock" title="Nothing recorded today yet" message="Roll-call, leave requests, alerts and menu changes will show here as they happen." />
            ) : (
              <Card gap={0}>
                {data.activities.map((x, i) => (
                  <View key={`${x.at}-${i}`} style={styles.tlRow}>
                    <View style={styles.tlRail}>
                      <View style={styles.tlDot}>
                        <Icon name={KIND_ICON[x.kind] || 'clock'} size={14} color={TH.royal} />
                      </View>
                      {i < data.activities.length - 1 && <View style={styles.tlLine} />}
                    </View>
                    <View style={styles.tlBody}>
                      <T style={styles.tlTime}>{timeOf(x.at)}</T>
                      <T style={styles.tlTitle}>{x.title}</T>
                      {!!x.detail && (
                        <T style={styles.tlDetail} numberOfLines={2}>
                          {x.detail}
                        </T>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </View>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  tonight: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderRadius: 18, backgroundColor: TH.royal },
  tonightLabel: { fontFamily: FONT.medium, fontSize: 12, color: TH.onNavyMuted },
  tonightValue: { fontFamily: FONT.heading, fontSize: 22, color: '#FFFFFF', marginTop: 2 },
  tonightSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.gold, marginTop: 2 },
  tonightBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACE.md, borderRadius: 12, backgroundColor: TH.gold },
  tonightBtnText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  quickRow: { flexDirection: 'row', gap: SPACE.sm },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 52 },
  alertIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  alertMsg: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
  tlRow: { flexDirection: 'row', gap: SPACE.md },
  tlRail: { width: 28, alignItems: 'center' },
  tlDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: TH.tile, alignItems: 'center', justifyContent: 'center' },
  tlLine: { flex: 1, width: 2, backgroundColor: TH.border, marginVertical: 2 },
  tlBody: { flex: 1, minWidth: 0, paddingBottom: SPACE.md, gap: 1 },
  tlTime: { fontFamily: FONT.medium, fontSize: 11, color: TH.muted },
  tlTitle: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  tlDetail: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
});
