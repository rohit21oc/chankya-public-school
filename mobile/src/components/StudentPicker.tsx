import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, FlatList, StyleSheet } from 'react-native';
import { KeyboardFrame } from './ui/KeyboardFrame';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Student } from '../types';
import { filterStudentsByQuery } from '../utils/reportCardRules';
import { BRAND_COLORS } from '../utils/branding';

interface StudentPickerProps {
  students: Student[];
  selectedId: string;
  onSelect: (studentId: string) => void;
  label?: string;
}

/** Dropdown that opens a searchable list (name, admission number or roll number). */
export const StudentPicker: React.FC<StudentPickerProps> = ({ students, selectedId, onSelect, label = 'Student' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = students.find((s) => s.id === selectedId);
  const results = useMemo(() => filterStudentsByQuery(students, query), [students, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={selected ? `Selected student ${selected.name}. Tap to change` : 'Select a student'}
      >
        <Text style={[styles.fieldText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? `${selected.name} (${selected.admissionNumber})` : 'Select a student'}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
        <SafeAreaView style={styles.sheet}>
          <KeyboardFrame own>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select student ({students.length})</Text>
            <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel="Close student list">
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, admission no. or roll no."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search students"
          />
          <FlatList<Student>
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No student matches “{query}”.</Text>}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[styles.row, isSelected && styles.rowActive]}
                  onPress={() => {
                    onSelect(item.id);
                    close();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    Adm {item.admissionNumber}
                    {item.rollNumber ? ` • Roll ${item.rollNumber}` : ''}
                    {item.className ? ` • ${item.className}${item.section ? `-${item.section}` : ''}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
          </KeyboardFrame>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.6, marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A' },
  placeholder: { color: '#94A3B8', fontWeight: '500' },
  caret: { fontSize: 16, color: '#475569', marginLeft: 8 },
  sheet: { flex: 1, backgroundColor: '#FFFFFF' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  close: { fontSize: 14, fontWeight: '700', color: BRAND_COLORS.primaryRoyal },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowActive: { backgroundColor: '#EFF6FF' },
  rowName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  empty: { textAlign: 'center', color: '#64748B', marginTop: 32, fontSize: 13 },
});
