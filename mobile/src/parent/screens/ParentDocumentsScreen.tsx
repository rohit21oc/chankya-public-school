import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Card, SectionHeading, InfoRow } from '../../components/teacher-home/ListParts';
import { IdCard } from '../../components/IdCard';
import { buildStudentIdCardModel } from '../../utils/idCardModel';
import { apiService } from '../../services/apiService';
import { useChildData, useParentChildren, NoActiveChild } from '../ParentChildContext';
import { ParentHeader, Screen, Skeleton, SPACE, StateBlock } from '../ui';
import type { ParentRoute } from '../routes';

export const ParentDocumentsScreen: React.FC<{ onBack: () => void; onOpenChildren: () => void; onNavigate: (r: ParentRoute) => void }> = ({ onBack, onOpenChildren, onNavigate }) => {
  const { activeChild } = useParentChildren();

  const card = useChildData(async (c) => {
    const r = await apiService.getChildIdCard(c.id);
    // Show the card only from the server's record, so the QR always matches a verified child.
    return { ok: r.ok && !!r.student, status: r.status, error: r.error, data: { student: r.student, settings: r.settings || {}, qrToken: r.qrToken } };
  });

  const st: any = card.data?.student;
  const settings: any = card.data?.settings || {};
  const [side, setSide] = useState<'front' | 'back'>('front');
  useEffect(() => setSide('front'), [activeChild?.id]);

  return (
    <Screen header={<ParentHeader title="Documents" onBack={onBack} child={activeChild} onPressChild={onOpenChildren} />} refreshing={card.refreshing} onRefresh={card.refresh}>
      {!activeChild ? (
        <NoActiveChild />
      ) : (
        <>
          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Report card" />
            <Card>
              <InfoRow icon="graduation-cap" title="Exam results" subtitle="Subject-wise marks, grades and result for each published exam" onPress={() => onNavigate('results')} />
            </Card>
          </View>

          <View style={{ gap: SPACE.sm }}>
            <SectionHeading title="Student ID card" />
            {card.state === 'loading' && !card.data ? (
              <Skeleton height={420} radius={16} />
            ) : card.state === 'error' && !card.data ? (
              <StateBlock kind="error" title="ID card could not be loaded" message={card.error} onRetry={card.reload} />
            ) : st ? (
              <View style={{ gap: SPACE.sm }}>
                <IdCard model={buildStudentIdCardModel(st, settings, card.data?.qrToken)} side={side} onToggle={() => setSide((x) => (x === 'front' ? 'back' : 'front'))} />
                <View style={styles.sideRow}>
                  {(['front', 'back'] as const).map((s2) => (
                    <Pressable
                      key={s2}
                      onPress={() => setSide(s2)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: side === s2 }}
                      style={[styles.sideBtn, side === s2 && styles.sideBtnOn]}
                    >
                      <T style={[styles.sideText, side === s2 && styles.sideTextOn]}>{s2 === 'front' ? 'Front' : 'Back'}</T>
                    </Pressable>
                  ))}
                </View>
                <T style={styles.hint}>Tap the card to turn it over.</T>
              </View>
            ) : null}
            <T style={styles.note}>Printable PDF copies of the ID card and report cards are available on the school website parent portal.</T>
          </View>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  sideRow: { flexDirection: 'row', alignSelf: 'center', marginTop: SPACE.sm, backgroundColor: TH.border, borderRadius: 999, padding: 3 },
  sideBtn: { minHeight: 44, minWidth: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingHorizontal: 16 },
  sideBtnOn: { backgroundColor: TH.navy },
  sideText: { fontFamily: FONT.semibold, fontSize: 13, color: TH.muted },
  sideTextOn: { color: '#FFFFFF' },
  hint: { textAlign: 'center', fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  note: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17, color: TH.muted },
});
