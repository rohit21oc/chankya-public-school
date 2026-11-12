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
import { MobileModule, User, Student, Staff, SchoolSettings, Exam } from '../types';
import { BRAND_COLORS, SCHOOL_INFO } from '../utils/branding';
import { hasUserPermission } from '../utils/rbac';
import { apiService } from '../services/apiService';
import { NOT_CONFIGURED, affiliationLine, useSchoolIdentity } from '../services/schoolIdentity';

interface ModuleDetailScreenProps {
  module: MobileModule;
  user: User;
  onBack: () => void;
}

export const ModuleDetailScreen: React.FC<ModuleDetailScreenProps> = ({
  module,
  user,
  onBack,
}) => {
  const sid = useSchoolIdentity();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  const loadData = async () => {
    setErrorMessage(null);
    setIsAccessDenied(false);

    // 1. Enforce client-side RBAC check before network call
    if (module.permission && !hasUserPermission(user, module.permission)) {
      setIsAccessDenied(true);
      setErrorMessage(`Access Denied: Your assigned role (${user.role}) is not authorized to access ${module.title}.`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (module.id === 'students') {
        const res = await apiService.getStudents(50);
        if (!res.ok) {
          if (res.status === 403) setIsAccessDenied(true);
          setErrorMessage(res.error || (res.status === 403 ? 'Access Denied: You do not have permission to view student records.' : 'Could not load student records.'));
          setStudents([]);
        } else {
          let list = res.data;
          // Apply strict role scoping on client side in addition to backend
          if (user.role === 'STUDENT' && user.studentId) {
            list = list.filter((s) => s.id === user.studentId || s.admissionNumber === user.username);
          } else if (user.role === 'PARENT') {
            const linked = user.linkedStudentIds || (user.studentId ? [user.studentId] : []);
            list = list.filter((s) => linked.includes(s.id) || linked.includes(s.admissionNumber));
          }
          setStudents(list);
        }
      } else if (module.id === 'teachers') {
        const res = await apiService.getStaffList(50);
        if (!res.ok) {
          if (res.status === 403) setIsAccessDenied(true);
          setErrorMessage(res.error || (res.status === 403 ? 'Access Denied: You do not have permission to view faculty records.' : 'Could not load faculty directory.'));
          setStaffList([]);
        } else {
          setStaffList(res.data);
        }
      } else if (module.id === 'communication') {
        const res = await apiService.getNotices();
        if (!res.ok) {
          setErrorMessage(res.error || 'Could not load notices from server.');
          setNotices([]);
        } else {
          setNotices(res.data);
        }
      } else if (module.id === 'live-events') {
        const res = await apiService.getEvents();
        if (!res.ok) {
          setErrorMessage(res.error || 'Could not load events from school server.');
          setEvents([]);
        } else {
          setEvents(res.data);
        }
      } else if (module.id === 'assignments' || module.id === 'assignment') {
        const res = await apiService.getAssignments();
        if (!res.ok) {
          setErrorMessage(res.error || 'Could not load assignments from school server.');
          setAssignments([]);
        } else {
          setAssignments(res.data);
        }
      } else if (module.id === 'exam-schedule') {
        const res = await apiService.getExams();
        if (!res.ok) {
          setErrorMessage(res.error || 'Could not load exam data from school server.');
          setExams([]);
        } else {
          setExams(res.data);
        }
      } else if (module.id === 'settings') {
        const res = await apiService.getSchoolSettings();
        if (!res.ok || !res.data) {
          if (res.status === 403) setIsAccessDenied(true);
          setErrorMessage(res.error || 'Could not load institutional settings.');
          setSettings(null);
        } else {
          setSettings(res.data);
        }
      }
    } catch {
      setErrorMessage('Could not load records from school server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [module.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle} numberOfLines={1}>
            {user.role === 'TEACHER' && module.id === 'students' ? 'My Assigned Students' : module.title}
          </Text>
          <Text style={styles.navSubtitle}>Phase 1 Verified View</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

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
        {/* Banner */}
        <View style={styles.moduleBanner}>
          <Text style={styles.bannerTitle}>{module.title}</Text>
          <Text style={styles.bannerDesc}>{module.description}</Text>
          <View style={styles.bannerMetaRow}>
            <Text style={styles.bannerMeta}>Role: {user.role}</Text>
            <Text style={styles.bannerMeta}>•</Text>
            <Text style={styles.bannerMeta}>Session: {SCHOOL_INFO.currentSession}</Text>
          </View>
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={BRAND_COLORS.primaryBright} />
            <Text style={styles.loadingText}>Fetching verified records from server...</Text>
          </View>
        )}

        {/* Access Denied or Error State */}
        {isAccessDenied ? (
          <View style={styles.accessDeniedCard}>
            <View style={styles.lockBadge}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
            <Text style={styles.accessDeniedTitle}>Access Denied</Text>
            <Text style={styles.accessDeniedMessage}>{errorMessage}</Text>
            <Text style={styles.accessDeniedSubtext}>
              Backend security policies restrict access to this module for your role ({user.role}).
            </Text>
            <TouchableOpacity style={styles.backHomeButton} onPress={onBack} activeOpacity={0.8}>
              <Text style={styles.backHomeText}>Return to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadData}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Module Content */}
        {!loading && !errorMessage && (
          <View style={styles.contentContainer}>
            {/* 1. Students Module */}
            {module.id === 'students' && (
              <View>
                <View style={styles.listHeaderRow}>
                  <Text style={styles.listCountText}>
                    Showing {students.length} {user.role === 'TEACHER' ? 'Assigned' : 'Enrolled'} Students
                  </Text>
                  {user.role === 'TEACHER' && (
                    <View style={styles.readOnlyBadge}>
                      <Text style={styles.readOnlyText}>View Only</Text>
                    </View>
                  )}
                </View>

                {students.map((student) => (
                  <View key={student.id || student.admissionNumber} style={styles.itemCard}>
                    <View style={styles.itemTopRow}>
                      <View>
                        <Text style={styles.itemName}>{student.name}</Text>
                        <Text style={styles.itemMeta}>
                          Class: {student.className || student.classId} - Sec {student.section} | Roll: {student.rollNumber || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>{student.status}</Text>
                      </View>
                    </View>

                    <View style={styles.itemDetailsRow}>
                      <Text style={styles.detailText}>Adm No: {student.admissionNumber}</Text>
                      {student.parentPhone && (
                        <Text style={styles.detailText}>Parent: {student.parentPhone}</Text>
                      )}
                    </View>
                  </View>
                ))}

                {students.length === 0 && (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No Students Found</Text>
                    <Text style={styles.emptySubtitle}>
                      {user.role === 'TEACHER'
                        ? 'No students enrolled in your assigned classes/sections.'
                        : 'No student records returned from server.'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 2. Teachers & Staff Module */}
            {module.id === 'teachers' && (
              <View>
                <Text style={styles.listCountText}>Faculty & Staff Roster ({staffList.length})</Text>
                {staffList.map((staff) => (
                  <View key={staff.id || staff.employeeId} style={styles.itemCard}>
                    <View style={styles.itemTopRow}>
                      <View>
                        <Text style={styles.itemName}>{staff.name}</Text>
                        <Text style={styles.itemMeta}>
                          {staff.designation || staff.role} • {staff.department || 'Academic'}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={[styles.statusPillText, { color: '#16A34A' }]}>{staff.status || 'ACTIVE'}</Text>
                      </View>
                    </View>
                    <View style={styles.itemDetailsRow}>
                      <Text style={styles.detailText}>Emp ID: {staff.employeeId}</Text>
                      {staff.phone && <Text style={styles.detailText}>📞 {staff.phone}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* 3. Communication / Notices Module */}
            {module.id === 'communication' && (
              <View>
                <Text style={styles.listCountText}>Official Circulars & Notices ({notices.length})</Text>
                {notices.map((notice, idx) => (
                  <View key={notice.id || (notice as any)._id || idx} style={styles.itemCard}>
                    <Text style={styles.itemName}>{notice.title}</Text>
                    <Text style={styles.noticeBody}>{notice.content || notice.description}</Text>
                    <View style={styles.itemDetailsRow}>
                      <Text style={styles.detailText}>Date: {notice.publishDate || notice.date || 'Active'}</Text>
                      <Text style={styles.detailText}>Target: {notice.targetRole || 'ALL'}</Text>
                    </View>
                  </View>
                ))}
                {notices.length === 0 && (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No Notices Published</Text>
                    <Text style={styles.emptySubtitle}>All institutional circulars will appear here.</Text>
                  </View>
                )}
              </View>
            )}

            {/* 4. Settings Module */}
            {module.id === 'settings' && (
              <View style={styles.settingsContainer}>
                <Text style={styles.listCountText}>Institutional Profile & Board Affiliation</Text>
                <View style={styles.itemCard}>
                  <Text style={styles.settingLabel}>School Name</Text>
                  <Text style={styles.settingValue}>{sid.name || NOT_CONFIGURED}</Text>

                  <Text style={styles.settingLabel}>Affiliation Board & Code</Text>
                  <Text style={styles.settingValue}>
                    {sid.board || NOT_CONFIGURED} (Code: {sid.affiliationNo || NOT_CONFIGURED})
                  </Text>

                  <Text style={styles.settingLabel}>School Code</Text>
                  <Text style={styles.settingValue}>{sid.schoolCode || NOT_CONFIGURED}</Text>

                  <Text style={styles.settingLabel}>Campus Address</Text>
                  <Text style={styles.settingValue}>{sid.address || NOT_CONFIGURED}</Text>

                  <Text style={styles.settingLabel}>Institutional Contact</Text>
                  <Text style={styles.settingValue}>
                    {[sid.phones.join(', '), sid.email].filter(Boolean).join(' | ') || NOT_CONFIGURED}
                  </Text>

                  <Text style={styles.settingLabel}>Current Academic Session</Text>
                  <Text style={styles.settingValue}>{sid.session || NOT_CONFIGURED}</Text>
                </View>
              </View>
            )}

            {/* 5. Live Events Module */}
            {module.id === 'live-events' && (
              <View>
                <Text style={styles.listCountText}>Campus Functions & Live Events ({events.length})</Text>
                {events.map((evt, idx) => (
                  <View key={evt.id || idx} style={styles.itemCard}>
                    <View style={styles.itemTopRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.itemName}>{evt.title}</Text>
                        <Text style={styles.itemMeta}>
                          {evt.date || evt.eventDate || 'Upcoming'} {evt.time ? `• ${evt.time}` : ''}
                          {evt.venue ? ` • Venue: ${evt.venue}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: '#EFF6FF' }]}>
                        <Text style={[styles.statusPillText, { color: '#175CD3' }]}>
                          {evt.isActive !== false ? 'ACTIVE' : 'COMPLETED'}
                        </Text>
                      </View>
                    </View>
                    {evt.description && <Text style={styles.noticeBody}>{evt.description}</Text>}
                  </View>
                ))}
                {events.length === 0 && (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No Live Events Scheduled</Text>
                    <Text style={styles.emptySubtitle}>
                      Official school programs, ceremonies, and campus events will be broadcast here.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 6. Assignments / Homework Module */}
            {(module.id === 'assignments' || module.id === 'assignment') && (
              <View>
                <Text style={styles.listCountText}>Curriculum Homework & Tasks ({assignments.length})</Text>
                {assignments.map((item, idx) => (
                  <View key={item.id || idx} style={styles.itemCard}>
                    <View style={styles.itemTopRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.itemName}>{item.title}</Text>
                        <Text style={styles.itemMeta}>
                          Class: {item.className || item.classId} {item.section ? `(${item.section})` : ''} • Subject: {item.subjectName || item.subjectId || 'All'}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: '#FEF3F2' }]}>
                        <Text style={[styles.statusPillText, { color: '#B42318' }]}>
                          Due: {item.dueDate || 'Ongoing'}
                        </Text>
                      </View>
                    </View>
                    {item.description && <Text style={styles.noticeBody}>{item.description}</Text>}
                    <View style={styles.itemDetailsRow}>
                      <Text style={styles.detailText}>Assigned: {item.assignedDate || 'Today'}</Text>
                    </View>
                  </View>
                ))}
                {assignments.length === 0 && (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No Assignments Posted</Text>
                    <Text style={styles.emptySubtitle}>
                      Classroom homework, coursework, and projects will be listed here.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 7. Exam Schedule Module */}
            {module.id === 'exam-schedule' && (
              <View>
                <Text style={styles.listCountText}>Term Examinations & Schedules ({exams.length})</Text>
                {exams.map((exam, idx) => (
                  <View key={exam.id || idx} style={styles.itemCard}>
                    <View style={styles.itemTopRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.itemName}>{exam.name}</Text>
                        <Text style={styles.itemMeta}>
                          Session: {exam.academicSession || SCHOOL_INFO.currentSession}
                          {exam.startDate ? ` • ${exam.startDate}` : ''}
                          {exam.endDate ? ` to ${exam.endDate}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={[styles.statusPillText, { color: '#16A34A' }]}>
                          {exam.status || 'SCHEDULED'}
                        </Text>
                      </View>
                    </View>
                    {[...(exam.schedule || [])]
                      .sort((a, b) => `${a.date} ${a.startTime || ''}`.localeCompare(`${b.date} ${b.startTime || ''}`))
                      .map((paper, pIdx) => (
                        <View key={paper.id || `${exam.id}-${pIdx}`} style={styles.itemDetailsRow}>
                          <Text style={[styles.detailText, { flex: 1 }]}>
                            {paper.date} • {paper.subjectName}
                            {paper.className ? ` (${paper.className}${paper.section && paper.section !== 'ALL' ? `-${paper.section}` : ''})` : ''}
                          </Text>
                          <Text style={styles.detailText}>
                            {paper.startTime ? `${paper.startTime}${paper.endTime ? `–${paper.endTime}` : ''}` : ''}
                            {paper.maxMarks ? ` • ${paper.maxMarks} marks` : ''}
                            {paper.roomNumber ? ` • Room ${paper.roomNumber}` : ''}
                          </Text>
                        </View>
                      ))}
                    {(!exam.schedule || exam.schedule.length === 0) && (
                      <Text style={styles.detailText}>Paper-wise timetable not released yet.</Text>
                    )}
                  </View>
                ))}
                {exams.length === 0 && (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No Exam Schedules Published</Text>
                    <Text style={styles.emptySubtitle}>
                      Upcoming examination dates and scholastic schedules will appear here once released by the academic coordinator.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {!['students', 'teachers', 'communication', 'settings', 'live-events', 'assignments', 'assignment', 'exam-schedule', 'report-card', 'academic-performance'].includes(module.id) && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{module.title}</Text>
                <Text style={styles.emptySubtitle}>
                  This module is authorized for your role ({user.role}).
                </Text>
                <Text style={styles.subNote}>
                  Live database endpoints are active on the campus server.
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
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  navTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  navTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  navSubtitle: {
    color: BRAND_COLORS.accentGoldLight,
    fontSize: 10,
    marginTop: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  moduleBanner: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  bannerDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  bannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  bannerMeta: {
    fontSize: 11,
    color: BRAND_COLORS.primaryRoyal,
    fontWeight: '600',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 10,
  },
  errorBox: {
    backgroundColor: BRAND_COLORS.errorLight,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
  },
  errorText: {
    color: BRAND_COLORS.error,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: BRAND_COLORS.error,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    padding: 16,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  listCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  readOnlyBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  readOnlyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: BRAND_COLORS.primaryRoyal,
  },
  itemDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  detailText: {
    fontSize: 11,
    color: '#475569',
  },
  noticeBody: {
    fontSize: 12,
    color: '#334155',
    marginVertical: 6,
    lineHeight: 18,
  },
  settingsContainer: {
    marginTop: 4,
  },
  settingLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 10,
  },
  settingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  subNote: {
    fontSize: 11,
    color: BRAND_COLORS.primaryBright,
    textAlign: 'center',
    marginTop: 10,
  },
  accessDeniedCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  lockBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  lockIcon: {
    fontSize: 24,
  },
  accessDeniedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 8,
  },
  accessDeniedMessage: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  accessDeniedSubtext: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 18,
  },
  backHomeButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  backHomeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
