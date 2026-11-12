import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { useParentChildren } from '../ParentChildContext';
import { Avatar, Banner, ParentHeader, Screen, SkeletonList, SPACE, StateBlock } from '../ui';
import { classSectionLabel } from '../../utils/parentRules';

/**
 * The single place where a parent changes the active child. Every other screen
 * follows the choice made here.
 */
export const ParentChildrenScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { children, activeChild, status, error, reload, selectChild, switchingTo, switchError } = useParentChildren();

  const choose = async (id: string) => {
    const ok = await selectChild(id);
    if (ok) onBack();
  };

  return (
    <Screen header={<ParentHeader title="My Children" onBack={onBack} />} refreshing={status === 'loading' && children.length > 0} onRefresh={reload}>
      {status === 'loading' && children.length === 0 ? (
        <SkeletonList rows={2} height={84} />
      ) : status === 'error' && children.length === 0 ? (
        <StateBlock kind="error" title="Your children could not be loaded" message={error} onRetry={reload} />
      ) : children.length === 0 ? (
        <StateBlock kind="empty" icon="users" title="No child is linked to this account" message="Please contact the school office to link your child." />
      ) : (
        <>
          {children.length > 1 && <T style={styles.hint}>Choose whose details to show. All screens update to the selected child.</T>}
          {!!switchError && <Banner text={switchError} />}
          <View style={{ gap: SPACE.md }}>
            {children.map((c) => {
              const active = c.id === activeChild?.id;
              const busy = switchingTo === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.card, active && styles.cardActive]}
                  onPress={() => choose(c.id)}
                  disabled={active || !!switchingTo}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: active || !!switchingTo }}
                  accessibilityLabel={`${c.name}, ${classSectionLabel(c.className, c.section)}${active ? ', currently selected' : ''}`}
                >
                  <Avatar name={c.name} photoKey={c.photo || c.photoFileKey} size={52} />
                  <View style={styles.text}>
                    <T style={styles.name} numberOfLines={2}>
                      {c.name}
                    </T>
                    <T style={styles.meta} numberOfLines={1}>
                      {classSectionLabel(c.className, c.section)}
                      {c.rollNumber ? ` · Roll ${c.rollNumber}` : ''}
                    </T>
                    {!!c.admissionNumber && (
                      <T style={styles.meta} numberOfLines={1}>
                        Adm. no. {c.admissionNumber}
                      </T>
                    )}
                  </View>
                  {busy ? (
                    <ActivityIndicator size="small" color={TH.royal} />
                  ) : active ? (
                    <View style={styles.selected}>
                      <Icon name="check" size={16} color="#FFFFFF" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  hint: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 19, color: TH.muted },
  card: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TH.border,
    backgroundColor: TH.surface,
  },
  cardActive: { borderColor: TH.royal, borderWidth: 2, padding: SPACE.md - 1 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: FONT.semibold, fontSize: 16, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  selected: { width: 28, height: 28, borderRadius: 14, backgroundColor: TH.royal, alignItems: 'center', justifyContent: 'center' },
});
