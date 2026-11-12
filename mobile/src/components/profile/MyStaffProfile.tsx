import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../teacher-home/T';
import { Icon, IconName } from '../teacher-home/Icon';
import { AttendanceCalendar } from '../AttendanceCalendar';
import { LeavePanel } from '../LeavePanel';
import { ChangePasswordCard } from '../auth/ChangePasswordCard';
import { NotificationsCard } from '../NotificationsCard';
import { EditContactCard } from './EditContactCard';
import { StateView } from '../ui/StateView';
import { apiService } from '../../services/apiService';
import { User } from '../../types';
import { resolveFileUrl } from '../../utils/branding';
import { formatRoleLabel } from '../../utils/rbac';

/**
 * The signed-in staff member's own profile, the same sections as the teacher profile: identity, ID card and
 * payroll, profile details from the staff record, contact details (editable), my attendance, apply / track
 * leave, notifications, change password and sign out. Used by every staff role (incl. the hostel warden).
 * Data: GET /api/auth/profile (own record only); attendance: the caller's own staff calendar.
 */

interface Props {
  user: User;
  /** Opens "my-id-card" / "my-payroll". Leave a tile out by not passing it in `records`. */
  onOpen: (id: 'my-id-card' | 'my-payroll') => void;
  records: Array<'my-id-card' | 'my-payroll'>;
  onLogout: () => void;
  /** Extra cards shown after the profile details (e.g. teaching assignments). */
  extra?: React.ReactNode;
  /** Bumped by the screen's pull-to-refresh. */
  refreshKey?: number;
  onLoaded?: () => void;
}

const NOT_RECORDED = 'Not recorded';
const val = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : NOT_RECORDED);
const dateText = (v?: string) => {
  if (!v) return NOT_RECORDED;
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const TILES: Record<'my-id-card' | 'my-payroll', { label: string; sub: string; icon: IconName }> = {
  'my-id-card': { label: 'My ID Card', sub: 'View & download', icon: 'id-card' },
  'my-payroll': { label: 'My Payroll', sub: 'Salary & payslips', icon: 'wallet' },
};

export const MyStaffProfile: React.FC<Props> = ({ user, onOpen, records, onLogout, extra, refreshKey = 0, onLoaded }) => {
  const [p, setP] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [calendarKey, setCalendarKey] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);

  const load = useCallback(async () => {
    const r = await apiService.request<any>('/api/auth/profile', 'GET', undefined, { skipCache: true });
    if (!alive.current) return;
    if (r.ok && r.data?.profile) {
      setP(r.data.profile);
      setError('');
      setState('ready');
    } else {
      setError(r.data?.error || r.error || 'Could not load your profile.');
      setState((s) => (s === 'ready' ? 'ready' : 'error'));
    }
    onLoaded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    if (refreshKey) setCalendarKey((k) => k + 1);
  }, [load, refreshKey]);

  const loadCalendar = useCallback(() => apiService.getStaffCalendar(user.employeeId || user.id), [user.employeeId, user.id]);

  if (state === 'loading' && !p) return <StateView variant="loading" title="Loading your profile" />;
  if (state === 'error' && !p) return <StateView variant="error" title="Profile unavailable" message={error} onRetry={() => load()} />;

  const name = p?.name || user.name;
  const photo = !photoFailed && (p?.photo || p?.photoFileKey || user.avatar) ? resolveFileUrl(p?.photo || p?.photoFileKey || user.avatar) : '';
  const role = String(p?.systemRole || p?.portalRole || p?.role || user.role || '');
  const employeeId = user.employeeId || p?.employeeId || '';
  const hostel = p?.hostelAssignment?.hostelName || p?.hostelName;
  const address = p?.address || p?.permanentAddress || p?.currentAddress;

  return (
    <View style={styles.wrap}>
      {!!error && (
        <View style={styles.banner} accessibilityRole="alert">
          <T style={styles.bannerText}>{error} Showing the last loaded data.</T>
        </View>
      )}

      <View style={styles.hero}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} onError={() => setPhotoFailed(true)} accessibilityLabel="Profile photo" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <T style={styles.initials}>
              {String(name || 'S')
                .split(' ')
                .map((x: string) => x[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </T>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={styles.name} numberOfLines={2}>
            {name}
          </T>
          <T style={styles.designation} numberOfLines={1}>
            {val(p?.designation) === NOT_RECORDED ? formatRoleLabel(role as any) : p.designation}
          </T>
          <View style={styles.pills}>
            <View style={styles.pill}>
              <T style={styles.pillText}>{formatRoleLabel(role as any)}</T>
            </View>
            {!!employeeId && (
              <View style={[styles.pill, styles.pillGold]}>
                <T style={[styles.pillText, { color: TH.navy }]}>{employeeId}</T>
              </View>
            )}
          </View>
        </View>
      </View>

      {records.length > 0 && (
        <View style={styles.tiles}>
          {(['my-id-card', 'my-payroll'] as const).filter((id) => records.includes(id)).map((id) => (
            <TouchableOpacity key={id} style={styles.tile} onPress={() => onOpen(id)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={TILES[id].label}>
              <View style={styles.tileIcon}>
                <Icon name={TILES[id].icon} size={22} color={TH.gold} />
              </View>
              <T style={styles.tileLabel}>{TILES[id].label}</T>
              <T style={styles.tileSub}>{TILES[id].sub}</T>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <T style={styles.cardTitle}>Profile details</T>
        <T style={styles.cardSub}>From your staff record. Ask the office to change these.</T>
        <Row label="Employee ID" value={val(employeeId)} />
        <Row label="Designation" value={val(p?.designation)} />
        <Row label="Department" value={val(p?.department || p?.departmentAssignment?.departmentName)} />
        {!!hostel && <Row label="Hostel" value={hostel} />}
        {!!p?.classTeacherOf && <Row label="Class teacher of" value={p.classTeacherOf} />}
        <Row label="Date of joining" value={dateText(p?.joiningDate)} />
        <Row label="Mobile" value={val(p?.phone || user.phone)} />
        <Row label="Email" value={val(p?.email || user.email)} last />
      </View>

      {extra}

      <EditContactCard phone={p?.phone} alternatePhone={p?.alternatePhone} address={address} onSaved={() => load()} />

      <AttendanceCalendar key={calendarKey} title="My attendance" load={loadCalendar} salaryCut />
      <LeavePanel kind="staff" subjectId={user.id} employeeId={user.employeeId} onChanged={() => setCalendarKey((k) => k + 1)} />

      <NotificationsCard />
      <ChangePasswordCard />

      <TouchableOpacity style={styles.logout} onPress={onLogout} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Sign out">
        <Icon name="log-out" size={18} color="#B42318" />
        <T style={styles.logoutText}>Sign out from this device</T>
      </TouchableOpacity>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string; last?: boolean }> = ({ label, value, last }) => (
  <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
    <T style={styles.rowLabel}>{label}</T>
    <T style={[styles.rowValue, value === NOT_RECORDED && styles.notRecorded]} numberOfLines={3}>
      {value}
    </T>
  </View>
);

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  banner: { backgroundColor: TH.goldSoft, borderRadius: 12, padding: 12 },
  bannerText: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.goldInk },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: TH.navy },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: TH.gold, backgroundColor: '#FFFFFF' },
  avatarFallback: { backgroundColor: TH.royal, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: FONT.heading, fontSize: 26, color: TH.gold },
  name: { fontFamily: FONT.heading, fontSize: 20, lineHeight: 26, color: '#FFFFFF' },
  designation: { fontFamily: FONT.regular, fontSize: 13, color: TH.onNavyMuted, marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' },
  pillGold: { backgroundColor: TH.gold },
  pillText: { fontFamily: FONT.semibold, fontSize: 11, color: '#FFFFFF' },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, padding: 14, gap: 4, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  tileIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: TH.navy, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileLabel: { fontFamily: FONT.semibold, fontSize: 14, color: TH.ink },
  tileSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  card: { padding: 16, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  cardTitle: { fontFamily: FONT.heading, fontSize: 17, color: TH.navy },
  cardSub: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted, marginTop: 2, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: TH.border },
  rowLabel: { fontFamily: FONT.regular, fontSize: 13, color: TH.muted },
  rowValue: { flexShrink: 1, fontFamily: FONT.medium, fontSize: 13, color: TH.ink, textAlign: 'right' },
  notRecorded: { color: TH.muted, fontStyle: 'italic' },
  logout: { minHeight: 50, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#F4C7C3', backgroundColor: TH.surface },
  logoutText: { fontFamily: FONT.semibold, fontSize: 14, color: '#B42318' },
});
