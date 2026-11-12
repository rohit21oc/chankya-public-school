import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from '../components/ui/SafeArea';
import { User, MobileModule } from '../types';
import { SchoolHeader } from '../components/SchoolHeader';
import { UserProfileCard } from '../components/UserProfileCard';
import { ModuleCard } from '../components/ModuleCard';
import { getAuthorizedModulesForUser } from '../utils/rbac';
import { BRAND_COLORS } from '../utils/branding';
import { apiService } from '../services/apiService';
import { authStorage } from '../services/authStorage';

interface ParentDashboardScreenProps {
  user: User;
  onLogout: () => void;
  onOpenModule: (module: MobileModule) => void;
}

export const ParentDashboardScreen: React.FC<ParentDashboardScreenProps> = ({
  user,
  onLogout,
  onOpenModule,
}) => {
  const [switching, setSwitching] = useState<string | null>(null);
  const [activeChildId, setActiveChildId] = useState<string>(
    user.activeStudentId || user.studentId || (user.linkedStudentIds && user.linkedStudentIds[0]) || ''
  );

  const authorizedModules = getAuthorizedModulesForUser(user);
  const linkedChildren = user.linkedStudentIds || (user.studentId ? [user.studentId] : []);

  const handleSwitchChild = async (childId: string) => {
    if (childId === activeChildId || switching) return;
    setSwitching(childId);
    try {
      const res = await apiService.switchChild(childId);
      if (res.success) {
        setActiveChildId(childId);
      }
    } catch {}
    setSwitching(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SchoolHeader compact subtitle="Parent & Guardian Portal" />

        <UserProfileCard user={user} onLogout={onLogout} />

        {/* Multi-Child Sibling Switcher */}
        {linkedChildren.length > 0 && (
          <View style={styles.childrenCard}>
            <View style={styles.childrenHeaderRow}>
              <Text style={styles.childrenTitle}>Enrolled Children ({linkedChildren.length})</Text>
              <Text style={styles.childrenHint}>Tap to switch child profile</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childrenScroll}>
              {linkedChildren.map((childId, index) => {
                const isSelected = childId === activeChildId;
                const isThisSwitching = switching === childId;
                return (
                  <TouchableOpacity
                    key={childId}
                    style={[
                      styles.childPill,
                      isSelected && styles.childPillSelected,
                    ]}
                    onPress={() => handleSwitchChild(childId)}
                    disabled={isSelected || switching !== null}
                    activeOpacity={0.7}
                  >
                    {isThisSwitching ? (
                      <ActivityIndicator size="small" color={BRAND_COLORS.primaryBright} />
                    ) : (
                      <>
                        <View style={[styles.childDot, isSelected && styles.childDotSelected]} />
                        <Text style={[styles.childPillText, isSelected && styles.childPillTextSelected]}>
                          Child {index + 1} ({childId.slice(-8)})
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Permitted Modules */}
        <View style={styles.modulesSection}>
          <Text style={styles.sectionTitle}>Parent Portal Modules</Text>
          <Text style={styles.sectionSubtitle}>
            Track child attendance, fee payments, report cards & notices
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
  childrenCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  childrenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  childrenTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  childrenHint: {
    fontSize: 10,
    color: '#64748B',
  },
  childrenScroll: {
    flexDirection: 'row',
  },
  childPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  childPillSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: BRAND_COLORS.primaryBright,
  },
  childDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    marginRight: 6,
  },
  childDotSelected: {
    backgroundColor: BRAND_COLORS.primaryBright,
  },
  childPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  childPillTextSelected: {
    color: BRAND_COLORS.primaryBright,
    fontWeight: '700',
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
