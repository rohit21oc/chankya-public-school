import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, Staff, StaffAttendanceRecord } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { BRAND_COLORS, resolveFileUrl } from '../utils/branding';
import { apiService, AttendanceScanResult } from '../services/apiService';
import { ScanAttendanceModal } from '../components/ScanAttendanceModal';
import { buildStaffAttendanceMap, buildStaffSubmission, countUnmarkedStaff } from '../utils/attendanceRules';

interface StaffAttendanceScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

export const StaffAttendanceScreen: React.FC<StaffAttendanceScreenProps> = ({
  user,
  onBack,
  onOpenMenu,
  onOpenProfile,
}) => {
  // Only the Super Admin and the Principal mark staff attendance (server enforces the same).
  const isAuthorized = ['SUPER_ADMIN', 'PRINCIPAL'].includes(user.role);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE' | 'HALF_DAY'>
  >({});
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Time each saved Present / Late staff member was marked (scan or manual).
  const [inTimes, setInTimes] = useState<Record<string, { status: string; time: string }>>({});
  const timesFrom = (list: any[]) => {
    const m: Record<string, { status: string; time: string }> = {};
    for (const r of list || []) if (r?.staffId && r.checkInTime) m[r.staffId] = { status: r.status, time: r.checkInTime };
    return m;
  };

  const loadData = async () => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const [staffRes, attRes] = await Promise.all([
        apiService.getStaffList(100),
        apiService.getStaffAttendance({ date: selectedDate }),
      ]);

      if (staffRes.ok && staffRes.data) {
        setStaffList(staffRes.data);

        // Only saved records are shown. Staff without one stay Unmarked: nothing is ever preselected.
        setAttendanceMap(buildStaffAttendanceMap(attRes.ok && attRes.data ? attRes.data : []));
        setInTimes(timesFrom(attRes.ok && attRes.data ? attRes.data : []));
      } else {
        setFeedback({ type: 'error', message: staffRes.error || 'Failed to load staff roster.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Could not connect to staff attendance server.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleStatusChange = (
    staffKey: string,
    status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE' | 'HALF_DAY'
  ) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [staffKey]: status,
    }));
  };

  const handleMarkAll = (status: 'PRESENT') => {
    const updated: Record<string, 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE' | 'HALF_DAY'> = {};
    staffList.forEach((st) => {
      const key = st.id || st.employeeId;
      updated[key] = status;
    });
    setAttendanceMap(updated);
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    setFeedback(null);

    // Only explicitly marked staff are saved; unmarked staff are left unmarked.
    const records = buildStaffSubmission<Staff>(staffList, attendanceMap).map(({ member: st, status }) => ({
      staffId: st.id,
      employeeId: st.employeeId,
      staffName: st.name,
      department: st.department,
      designation: st.designation,
      status,
      remarks: '',
    }));

    if (records.length === 0) {
      setSaving(false);
      setFeedback({ type: 'error', message: 'Mark at least one staff member as Present, Absent, Leave or Late before saving.' });
      return;
    }

    try {
      const res = await apiService.saveStaffAttendance({
        date: selectedDate,
        records,
      });

      if (!res.ok || !res.success) {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to record staff attendance.',
        });
      } else {
        void apiService.getStaffAttendance({ date: selectedDate }).then((a) => {
          if (a.ok) setInTimes(timesFrom(a.data || []));
        });
        setFeedback({
          type: 'success',
          message: `Staff attendance saved successfully for ${records.length} members on ${selectedDate}.`,
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error saving staff attendance.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthorized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <SchoolHeader user={user} showBack onBack={onBack} title="Staff Attendance" />
        <View style={styles.deniedCard}>
          <Text style={styles.deniedIcon}>🔒</Text>
          <Text style={styles.deniedTitle}>Administrative Access Restricted</Text>
          <Text style={styles.deniedSubtitle}>
            Teachers are not authorized to view or manage institutional staff attendance registers.
          </Text>
          <TouchableOpacity style={styles.returnBtn} onPress={onBack}>
            <Text style={styles.returnBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const presentCount = Object.values(attendanceMap).filter((s) => s === 'PRESENT').length;
  const absentCount = Object.values(attendanceMap).filter((s) => s === 'ABSENT').length;
  const leaveCount = Object.values(attendanceMap).filter((s) => s === 'LEAVE').length;
  const lateCount = Object.values(attendanceMap).filter((s) => s === 'LATE' || s === 'HALF_DAY').length;
  const unmarkedCount = countUnmarkedStaff(staffList, attendanceMap);

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        showBack
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        title="Staff Attendance"
        subtitle={`Administrative Register (${selectedDate})`}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[BRAND_COLORS.primaryBright]}
          />
        }
      >
        {/* Date Selector Header */}
        <View style={styles.dateBar}>
          <View>
            <Text style={styles.dateLabel}>ATTENDANCE DATE</Text>
            <Text style={styles.dateValue}>📅 {selectedDate}</Text>
          </View>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>RBAC Admin Control</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.scanBtn} onPress={() => setScanOpen(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Scan staff ID card">
          <Text style={styles.scanBtnText}>Scan staff ID card</Text>
        </TouchableOpacity>
        <Text style={styles.scanHint}>Scanning marks today's attendance with the check-in time straight away.</Text>

        {/* Attendance Metrics */}
        <View style={styles.metricsBar}>
          <View style={[styles.metricBox, { backgroundColor: '#ECFDF3' }]}>
            <Text style={[styles.metricNum, { color: '#16803C' }]}>{presentCount}</Text>
            <Text style={[styles.metricLbl, { color: '#16803C' }]}>Present</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.metricNum, { color: '#D92D20' }]}>{absentCount}</Text>
            <Text style={[styles.metricLbl, { color: '#D92D20' }]}>Absent</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.metricNum, { color: '#175CD3' }]}>{leaveCount}</Text>
            <Text style={[styles.metricLbl, { color: '#175CD3' }]}>Leave</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: '#FFFAEB' }]}>
            <Text style={[styles.metricNum, { color: '#B54708' }]}>{lateCount}</Text>
            <Text style={[styles.metricLbl, { color: '#B54708' }]}>Late/Half</Text>
          </View>
        </View>

        {/* Quick Batch Actions */}
        <View style={styles.batchActionsRow}>
          <TouchableOpacity
            style={styles.batchBtn}
            onPress={() => handleMarkAll('PRESENT')}
            activeOpacity={0.7}
          >
            <Text style={styles.batchBtnText}>✓ Mark All Present</Text>
          </TouchableOpacity>
        </View>

        {/* Feedback Message */}
        {feedback && (
          <View
            style={[
              styles.feedbackBox,
              feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                feedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText,
              ]}
            >
              {feedback.type === 'success' ? '✓ ' : '⚠ '}
              {feedback.message}
            </Text>
          </View>
        )}

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={BRAND_COLORS.primaryRoyal} />
            <Text style={styles.loadingText}>Fetching faculty & staff roster...</Text>
          </View>
        )}

        {/* Staff List */}
        {!loading && (
          <View style={styles.staffContainer}>
            <Text style={styles.listHeaderTitle}>Active Staff Members ({staffList.length})</Text>
            {unmarkedCount > 0 && (
              <Text style={styles.scanHint}>{unmarkedCount} unmarked. Choose Present, Absent, Leave or Late for each.</Text>
            )}

            {staffList.map((st) => {
              const key = st.id || st.employeeId;
              const currentStatus = attendanceMap[key];
              const photoUri = st.photo ? resolveFileUrl(st.photo) : null;
              const initials = (st.name || 'Staff')
                .split(' ')
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <View key={key} style={styles.staffCard}>
                  {/* Avatar & Info */}
                  <View style={styles.staffInfoRow}>
                    <View style={styles.avatarBox}>
                      {photoUri ? (
                        <Image source={{ uri: photoUri }} style={styles.avatarImg} resizeMode="cover" />
                      ) : (
                        <Text style={styles.avatarInitials}>{initials}</Text>
                      )}
                    </View>

                    <View style={styles.staffDetails}>
                      <Text style={styles.staffName} numberOfLines={1}>
                        {st.name}
                      </Text>
                      <Text style={styles.staffRole}>
                        {st.designation || st.role} • {st.department || 'Academic'}
                      </Text>
                      <Text style={styles.staffId}>Emp ID: {st.employeeId}</Text>
                      {!!inTimes[st.id] && inTimes[st.id].status === currentStatus && (currentStatus === 'PRESENT' || currentStatus === 'LATE') && (
                        <Text style={styles.staffId}>In: {inTimes[st.id].time}</Text>
                      )}
                    </View>
                  </View>

                  {/* Status Toggle Row */}
                  <View style={styles.statusButtonsRow}>
                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        currentStatus === 'PRESENT' && styles.statusBtnPresentActive,
                      ]}
                      onPress={() => handleStatusChange(key, 'PRESENT')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          currentStatus === 'PRESENT' && styles.statusBtnTextActive,
                        ]}
                      >
                        Present
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        currentStatus === 'ABSENT' && styles.statusBtnAbsentActive,
                      ]}
                      onPress={() => handleStatusChange(key, 'ABSENT')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          currentStatus === 'ABSENT' && styles.statusBtnTextActive,
                        ]}
                      >
                        Absent
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        currentStatus === 'LEAVE' && styles.statusBtnLeaveActive,
                      ]}
                      onPress={() => handleStatusChange(key, 'LEAVE')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          currentStatus === 'LEAVE' && styles.statusBtnTextActive,
                        ]}
                      >
                        Leave
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        currentStatus === 'LATE' && styles.statusBtnLateActive,
                      ]}
                      onPress={() => handleStatusChange(key, 'LATE')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          currentStatus === 'LATE' && styles.statusBtnTextActive,
                        ]}
                      >
                        Late
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {staffList.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>No Staff Found</Text>
                <Text style={styles.emptySubtitle}>No active staff records returned from database.</Text>
              </View>
            )}
          </View>
        )}

        {/* Submit Button */}
        {staffList.length > 0 && !loading && (
          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[styles.submitButton, saving && styles.submitButtonDisabled]}
              onPress={handleSaveAttendance}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>💾 Save Staff Attendance</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <ScanAttendanceModal
        visible={scanOpen}
        kind="STAFF"
        onClose={() => setScanOpen(false)}
        onMarked={(r) => {
          const id = r.person?.id;
          if (id && r.kind === 'STAFF' && r.date === selectedDate && !r.alreadyMarked) {
            if (r.markedStatus) setAttendanceMap((prev) => ({ ...prev, [id]: r.markedStatus as any }));
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  scanBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B2CCFF',
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  scanBtnText: { fontSize: 15, fontWeight: '700', color: '#123B8C' },
  scanHint: { marginHorizontal: 16, marginTop: 6, fontSize: 12, color: '#64748B' },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: '#F3E8FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7E22CE',
  },
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  metricNum: {
    fontSize: 15,
    fontWeight: '800',
  },
  metricLbl: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  batchActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  batchBtn: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: '#ECFDF3',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A6F4C5',
    alignItems: 'center',
  },
  batchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16803C',
  },
  feedbackBox: {
    marginHorizontal: 14,
    marginVertical: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: '#ECFDF3',
    borderColor: '#A6F4C5',
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECDD3',
  },
  feedbackText: {
    fontSize: 11,
    fontWeight: '600',
  },
  feedbackSuccessText: {
    color: '#16803C',
  },
  feedbackErrorText: {
    color: '#D92D20',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748B',
  },
  staffContainer: {
    paddingHorizontal: 14,
    marginTop: 10,
  },
  listHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  staffInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  staffDetails: {
    flex: 1,
  },
  staffName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffRole: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  staffId: {
    fontSize: 10,
    color: BRAND_COLORS.primaryRoyal,
    fontWeight: '600',
    marginTop: 1,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  statusBtnPresentActive: {
    backgroundColor: '#16803C',
    borderColor: '#16803C',
  },
  statusBtnAbsentActive: {
    backgroundColor: '#D92D20',
    borderColor: '#D92D20',
  },
  statusBtnLeaveActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusBtnLateActive: {
    backgroundColor: '#B54708',
    borderColor: '#B54708',
  },
  statusBtnTextActive: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  submitContainer: {
    paddingHorizontal: 14,
    marginTop: 10,
  },
  submitButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  deniedCard: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deniedIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  deniedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  deniedSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  returnBtn: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  returnBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
