import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, TimetableSlot } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { BRAND_COLORS, SCHOOL_INFO } from '../utils/branding';
import { apiService } from '../services/apiService';
import type { ClassItem } from '../types';

interface TimetableScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TimetableScreen: React.FC<TimetableScreenProps> = ({
  user,
  onBack,
  onOpenMenu,
  onOpenProfile,
}) => {
  // Determine today's day of week
  const todayIndex = new Date().getDay(); // 0 is Sun, 1 is Mon...
  const initialDay = todayIndex >= 1 && todayIndex <= 6 ? DAYS_OF_WEEK[todayIndex - 1] : 'Monday';

  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isTeacher = user.role === 'TEACHER';
  const isStudent = user.role === 'STUDENT';
  const isParent = user.role === 'PARENT';
  // Staff who see the whole school get a class/section filter; others already receive only their own slots.
  const needsClassFilter = !isTeacher && !isStudent && !isParent;
  const [classOptions, setClassOptions] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const screenTitle = isTeacher || isStudent || isParent ? 'My Timetable' : 'School Timetable';

  const loadTimetable = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Teachers use the server-scoped teacher timetable (own slots only).
      const res = isTeacher
        ? await apiService.getTeacherTimetable()
        : await apiService.getTimetables({});
      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to load timetable from server.');
        setSlots([]);
      } else {
        setSlots(res.data || []);
      }
    } catch {
      setErrorMessage('Could not load timetable. Please check network connection.');
      setSlots([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, [user.id]);

  useEffect(() => {
    if (!needsClassFilter) return;
    let alive = true;
    apiService.getClasses().then((res) => {
      if (alive && res.ok && Array.isArray(res.data)) setClassOptions(res.data);
    }).catch(() => {});
    return () => { alive = false; };
  }, [needsClassFilter]);

  const sectionsOfSelected = (() => {
    const cls = classOptions.find((c) => c.id === selectedClassId);
    return (cls?.sections || []).map((sec: any) => (typeof sec === 'string' ? sec : sec?.name)).filter(Boolean) as string[];
  })();

  const handleRefresh = () => {
    setRefreshing(true);
    loadTimetable();
  };

  // Filter slots for selected day and sort by periodNumber
  const currentDaySlots = slots
    .filter((slot) => {
      const slotDay = (slot.dayOfWeek || '').trim().toLowerCase();
      if (slotDay !== selectedDay.toLowerCase()) return false;
      if (needsClassFilter && selectedClassId && slot.classId !== selectedClassId) return false;
      if (needsClassFilter && selectedSection && String(slot.section || '').toUpperCase() !== selectedSection.toUpperCase()) return false;
      return true;
    })
    .sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0));

  return (
    <SafeAreaView style={styles.safeArea}>
      <SchoolHeader
        user={user}
        showBack
        onBack={onBack}
        onOpenMenu={onOpenMenu}
        onOpenProfile={onOpenProfile}
        title={screenTitle}
        subtitle={`Academic Session ${SCHOOL_INFO.currentSession}`}
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
        {needsClassFilter && classOptions.length > 0 && (
          <View style={styles.daySelectorContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPillsRow}>
              <TouchableOpacity
                style={[styles.dayPill, !selectedClassId && styles.dayPillActive]}
                onPress={() => { setSelectedClassId(''); setSelectedSection(''); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayPillText, !selectedClassId && styles.dayPillTextActive]}>All classes</Text>
              </TouchableOpacity>
              {classOptions.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.dayPill, selectedClassId === cls.id && styles.dayPillActive]}
                  onPress={() => { setSelectedClassId(cls.id); setSelectedSection(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayPillText, selectedClassId === cls.id && styles.dayPillTextActive]}>{cls.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedClassId !== '' && sectionsOfSelected.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPillsRow}>
                <TouchableOpacity
                  style={[styles.dayPill, !selectedSection && styles.dayPillActive]}
                  onPress={() => setSelectedSection('')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayPillText, !selectedSection && styles.dayPillTextActive]}>All sections</Text>
                </TouchableOpacity>
                {sectionsOfSelected.map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    style={[styles.dayPill, selectedSection === sec && styles.dayPillActive]}
                    onPress={() => setSelectedSection(sec)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayPillText, selectedSection === sec && styles.dayPillTextActive]}>Section {sec}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Day Selector Pill Bar */}
        <View style={styles.daySelectorContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPillsRow}>
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = selectedDay === day;
              const isToday = day === initialDay;

              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayPill, isSelected && styles.dayPillActive]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayPillText, isSelected && styles.dayPillTextActive]}>
                    {day.slice(0, 3)}
                  </Text>
                  {isToday && <View style={[styles.todayIndicator, isSelected && styles.todayIndicatorActive]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Day Header Banner */}
        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerDay}>{selectedDay}</Text>
            <Text style={styles.bannerMeta}>
              {currentDaySlots.length} {currentDaySlots.length === 1 ? 'Period' : 'Periods'} Scheduled
            </Text>
          </View>
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={BRAND_COLORS.primaryRoyal} />
            <Text style={styles.loadingText}>Fetching timetable schedule...</Text>
          </View>
        )}

        {/* Error State */}
        {!loading && errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadTimetable}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Slots List */}
        {!loading && !errorMessage && (
          <View style={styles.slotsContainer}>
            {currentDaySlots.map((slot) => (
              <View key={slot.id || `${slot.periodNumber}-${slot.dayOfWeek}`} style={styles.slotCard}>
                {/* Period Number & Time Column */}
                <View style={styles.periodCol}>
                  <Text style={styles.periodLabel}>Period</Text>
                  <Text style={styles.periodNum}>{slot.periodNumber || 1}</Text>
                  <Text style={styles.periodTime}>
                    {slot.startTime && slot.endTime ? `${slot.startTime} - ${slot.endTime}` : ''}
                  </Text>
                </View>

                {/* Details Column */}
                <View style={styles.detailsCol}>
                  <View style={styles.subjectRow}>
                    <Text style={styles.subjectName}>{slot.subjectName || 'Subject not set'}</Text>
                    {slot.roomNumber && (
                      <View style={styles.roomBadge}>
                        <Text style={styles.roomText}>Room {slot.roomNumber}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.infoMetaRow}>
                    <Text style={styles.infoMeta}>
                      Class: {slot.className || slot.classId} {slot.section ? `(${slot.section})` : ''}
                    </Text>
                    {slot.teacherName && (
                      <Text style={styles.infoTeacher}>{slot.teacherName}</Text>
                    )}
                  </View>
                </View>
              </View>
            ))}

            {currentDaySlots.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyTitle}>No Periods Scheduled</Text>
                <Text style={styles.emptySubtitle}>
                  There are no active classes or periods scheduled for {selectedDay}.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 24,
  },
  daySelectorContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  dayPillsRow: {
    paddingHorizontal: 12,
    gap: 8,
  },
  dayPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayPillActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dayPillTextActive: {
    color: '#FFFFFF',
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND_COLORS.accentGold,
    marginTop: 3,
  },
  todayIndicatorActive: {
    backgroundColor: BRAND_COLORS.accentGoldLight,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  bannerDay: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  bannerMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sessionBadge: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND_COLORS.primaryRoyal,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748B',
  },
  errorBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#B91C1C',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  slotsContainer: {
    padding: 16,
    gap: 12,
  },
  slotCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  periodCol: {
    width: 86,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  periodLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  periodNum: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND_COLORS.primaryRoyal,
    marginVertical: 2,
  },
  periodTime: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  detailsCol: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  roomBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginLeft: 6,
  },
  roomText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoMeta: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  infoTeacher: {
    fontSize: 12,
    color: BRAND_COLORS.primaryRoyal,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
