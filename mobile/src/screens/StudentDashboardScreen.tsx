import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, MobileModule } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { UserProfileCard } from '../components/UserProfileCard';
import { ModuleCard } from '../components/ModuleCard';
import { getAuthorizedModulesForUser } from '../utils/rbac';
import { BRAND_COLORS, SCHOOL_INFO } from '../utils/branding';

interface StudentDashboardScreenProps {
  user: User;
  onLogout: () => void;
  onOpenModule: (module: MobileModule) => void;
}

export const StudentDashboardScreen: React.FC<StudentDashboardScreenProps> = ({
  user,
  onLogout,
  onOpenModule,
}) => {
  const authorizedModules = getAuthorizedModulesForUser(user);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SchoolHeader compact subtitle="Student Learner Portal" />

        <UserProfileCard user={user} onLogout={onLogout} />

        {/* Student Highlights Card */}
        <View style={styles.highlightsCard}>
          <Text style={styles.highlightsTitle}>Enrolled Student Record</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Admission No.</Text>
              <Text style={styles.metricValue}>{user.username}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Academic Session</Text>
              <Text style={styles.metricValue}>{SCHOOL_INFO.currentSession}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Student Status</Text>
              <Text style={[styles.metricValue, { color: BRAND_COLORS.success }]}>
                {user.status || 'ACTIVE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Permitted Modules */}
        <View style={styles.modulesSection}>
          <Text style={styles.sectionTitle}>My Learner Modules</Text>
          <Text style={styles.sectionSubtitle}>
            Access your scholastic timetable, results, admit card & notices
          </Text>

          <View style={styles.gridContainer}>
            {authorizedModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                onPress={onOpenModule}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  highlightsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  highlightsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  modulesSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  gridContainer: {
    marginTop: 4,
  },
});
