import React, { useMemo } from 'react';
import { User } from '../types';
import { TeachingAssignmentsCard } from '../components/profile/TeachingAssignmentsCard';
import { getAuthorizedModulesForUser } from '../utils/rbac';
import { StaffProfileLayout } from './ProfileScreen';

interface TeacherProfileScreenProps {
  user: User;
  onBack: () => void;
  onOpenMenu: () => void;
  onLogout: () => void;
  onNavigateModule: (moduleId: string) => void;
}

/**
 * Teacher's own profile: the shared staff profile (ID card, payroll, details, contact, attendance, leave,
 * password) plus the teacher's classes and subjects.
 */
export const TeacherProfileScreen: React.FC<TeacherProfileScreenProps> = ({ user, onBack, onOpenMenu, onLogout, onNavigateModule }) => {
  const allowed = useMemo(() => new Set(getAuthorizedModulesForUser(user).map((m) => m.id)), [user]);
  const records = (['my-id-card', 'my-payroll'] as const).filter((id) => allowed.has(id));
  return (
    <StaffProfileLayout
      user={user}
      onBack={onBack}
      onOpenMenu={onOpenMenu}
      onLogout={onLogout}
      records={[...records]}
      onOpen={onNavigateModule}
      extra={<TeachingAssignmentsCard />}
    />
  );
};
