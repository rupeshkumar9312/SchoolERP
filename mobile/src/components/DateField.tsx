import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, fonts, radius, spacing } from '../theme';
import { toIsoDate } from '../utils/format';
import { Touchable } from './Touchable';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Select a date',
  minimumDate,
  maximumDate,
}: DateFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android's picker is an imperative dialog — it's gone as soon as the
    // user taps a button, so this always closes regardless of outcome.
    setOpen(false);
    if (event.type === 'set' && selected) {
      onChange(toIsoDate(selected));
    }
  };

  // An empty field defaults to today — but if that falls outside a given
  // min/max bound (e.g. "repeat until" bounded by an already-future due
  // date), clamp to the bound instead so the picker doesn't open on a date
  // it won't even let you pick.
  const defaultDate = () => {
    const now = new Date();
    if (minimumDate && now < minimumDate) return minimumDate;
    if (maximumDate && now > maximumDate) return maximumDate;
    return now;
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Touchable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={value ? styles.fieldText : styles.placeholder}>{value || placeholder}</Text>
      </Touchable>

      {open && (
        <DateTimePicker
          value={value ? new Date(`${value}T00:00:00`) : defaultDate()}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      )}
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
});
