import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../theme';
import { Touchable } from './Touchable';

export interface SelectOption<T> {
  value: T;
  label: string;
}

interface SelectFieldProps<T> {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}

export function SelectField<T>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: SelectFieldProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const insets = useSafeAreaInsets();

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Touchable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.fieldText : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </Text>
      </Touchable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* A Modal renders outside the app's normal SafeAreaView tree, so
              it never picks up bottom-inset padding on its own — without
              this it sits flush behind the Android system nav bar. */}
          <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(_, index) => String(index)}
              renderItem={({ item }) => (
                <Touchable
                  style={[styles.option, item.value === value && styles.optionSelected]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={item.value === value ? styles.optionTextSelected : styles.optionText}>
                    {item.label}
                  </Text>
                </Touchable>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted, marginBottom: spacing.xs },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fieldText: { fontSize: 15, fontFamily: fonts.body, color: colors.text },
  placeholder: { fontSize: 15, fontFamily: fonts.body, color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
    padding: spacing.lg,
  },
  sheetTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text, marginBottom: spacing.md },
  option: { paddingVertical: spacing.md, borderRadius: radius.sm, overflow: 'hidden' },
  optionSelected: { backgroundColor: colors.primaryTint },
  optionText: { fontSize: 15, fontFamily: fonts.body, color: colors.text },
  optionTextSelected: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.primary },
  separator: { height: 1, backgroundColor: colors.border },
});
