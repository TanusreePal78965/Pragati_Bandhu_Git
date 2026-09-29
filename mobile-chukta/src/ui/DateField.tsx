import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n/useT';
import { todayLocal } from '../utils/dates';
import { formatDate } from '../utils/format';
import { Label } from './components';
import { colors, radius, space } from './theme';

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** A YYYY-MM-DD value shown in the current language; opens the native date picker. */
export function DateField({ label, value, onChange, max, testID }: {
  label: string; value: string; onChange: (date: string) => void; max?: string; testID?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Label>{label}</Label>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.input}>
        <Text style={styles.text}>{formatDate(value, t)}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          maximumDate={max ? toDate(max) : undefined}
          onChange={(e: DateTimePickerEvent, date?: Date) => {
            setOpen(false);
            if (e.type === 'set' && date) onChange(todayLocal(date));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.card, paddingHorizontal: space.md, minHeight: 46, justifyContent: 'center' },
  text: { fontSize: 16, color: colors.text },
});
