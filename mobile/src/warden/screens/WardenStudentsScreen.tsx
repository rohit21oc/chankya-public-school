import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TH, FONT } from '../../theme/teacherHome';
import { T } from '../../components/teacher-home/T';
import { Icon } from '../../components/teacher-home/Icon';
import { Avatar, Banner, Pill, Screen, SkeletonList, SPACE, StateBlock } from '../../parent/ui';
import { HostelStudent, wardenApi } from '../wardenApi';
import { filterStudents, STATUS_META } from '../wardenRules';
import { SearchBox, WardenHeader } from '../wardenUi';

interface Props {
  onOpenStudent: (id: string) => void;
  onBack?: () => void;
}

/** Only the students living in the warden's own hostel (the server sends nothing else). */
export const WardenStudentsScreen: React.FC<Props> = ({ onOpenStudent, onBack }) => {
  const [list, setList] = useState<HostelStudent[]>([]);
  const [classes, setClasses] = useState<Array<{ classId: string; className: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cls, setCls] = useState('ALL');

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    const r = await wardenApi.students();
    if (r.ok && r.data) {
      setList(r.data.list);
      setClasses(r.data.classes);
      setError(null);
    } else setError(r.error || 'Students could not be loaded.');
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => filterStudents(list, search, cls), [list, search, cls]);

  return (
    <Screen header={<WardenHeader title="My Hostel Students" subtitle={loading ? undefined : `${list.length} resident(s)`} onBack={onBack} />} refreshing={refreshing} onRefresh={() => load(true)}>
      <SearchBox value={search} onChange={setSearch} placeholder="Search name, admission no. or room" />
      {classes.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.sm }}>
          {[{ classId: 'ALL', className: 'All classes' }, ...classes].map((c) => {
            const on = cls === (c.classId || c.className);
            return (
              <TouchableOpacity
                key={c.classId || c.className}
                onPress={() => setCls(c.classId || c.className)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <T style={[styles.chipText, on && styles.chipTextOn]}>{c.className}</T>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <SkeletonList rows={6} height={76} />
      ) : error && !list.length ? (
        <StateBlock kind="error" title="Students not available" message={error} onRetry={() => load()} />
      ) : list.length === 0 ? (
        <StateBlock kind="empty" icon="bed" title="No students in your hostel" message="Students appear here once the office allocates them a bed in your hostel." />
      ) : (
        <>
          {!!error && <Banner text={error} onRetry={() => load()} />}
          {shown.length === 0 ? (
            <StateBlock kind="empty" icon="search" title="No student matches" message="Try another name, admission number, room or class." />
          ) : (
            <View style={{ gap: SPACE.sm }}>
              {shown.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.row}
                  onPress={() => onOpenStudent(s.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name}, ${s.className} ${s.section || ''}, room ${s.roomNumber}, bed ${s.bedNumber}`}
                >
                  <Avatar name={s.name} photoKey={s.photo} size={48} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <T style={styles.name} numberOfLines={1}>
                      {s.name}
                    </T>
                    <T style={styles.meta} numberOfLines={2}>
                      Adm. {s.admissionNumber || '-'} · {s.className}
                      {s.section ? `-${s.section}` : ''}
                      {s.rollNumber ? ` · Roll ${s.rollNumber}` : ''}
                    </T>
                    <View style={styles.roomLine}>
                      <Icon name="bed" size={14} color={TH.royal} />
                      <T style={styles.room} numberOfLines={1}>
                        Room {s.roomNumber || '-'} · {s.bedNumber || '-'}
                      </T>
                    </View>
                  </View>
                  {s.tonightStatus ? <Pill label={STATUS_META[s.tonightStatus].label} tone={STATUS_META[s.tonightStatus].tone} /> : null}
                  <Icon name="chevron" size={16} color={TH.muted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: TH.border, backgroundColor: TH.surface },
  chipOn: { backgroundColor: TH.navy, borderColor: TH.navy },
  chipText: { fontFamily: FONT.medium, fontSize: 13, color: TH.ink },
  chipTextOn: { color: '#FFFFFF', fontFamily: FONT.semibold },
  row: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md, borderRadius: 16, backgroundColor: TH.surface, borderWidth: 1, borderColor: TH.border },
  name: { fontFamily: FONT.semibold, fontSize: 15, color: TH.ink },
  meta: { fontFamily: FONT.regular, fontSize: 12, color: TH.muted },
  roomLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  room: { flex: 1, fontFamily: FONT.medium, fontSize: 12, color: TH.royal },
});
