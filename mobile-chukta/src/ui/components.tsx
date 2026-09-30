import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type RefreshControlProps, type TextInputProps,
} from 'react-native';
import { useT } from '../i18n/useT';
import { weekdayName } from '../utils/format';
import { colors, radius, space } from './theme';

export function Screen({ children, refreshControl }: { children: ReactNode; refreshControl?: ReactElement<RefreshControlProps> }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export const Title = ({ children, testID }: { children: ReactNode; testID?: string }) => <Text style={styles.title} testID={testID}>{children}</Text>;
export const Label = ({ children }: { children: ReactNode }) => <Text style={styles.label}>{children}</Text>;
export const Muted = ({ children, testID }: { children: ReactNode; testID?: string }) => <Text style={styles.muted} testID={testID}>{children}</Text>;

export function ErrorText({ children }: { children?: string | null }) {
  return children ? <Text style={styles.error} accessibilityRole="alert">{children}</Text> : null;
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
}

type ButtonKind = 'primary' | 'secondary' | 'danger';
export function Button({ title, onPress, kind = 'primary', disabled, loading, testID }: {
  title: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; loading?: boolean; testID?: string;
}) {
  const off = !!disabled || !!loading;
  const textColor = kind === 'primary' ? colors.primaryText : kind === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: off }} disabled={off} onPress={onPress}
      style={[styles.button, kind === 'primary' ? styles.buttonPrimary : styles.buttonOutline, off && styles.disabled]}>
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[styles.input, error ? styles.inputError : null]} {...input} />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, testIDPrefix }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; testIDPrefix?: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined} accessibilityRole="button"
            accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={[styles.segment, on && styles.segmentOn]}>
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const NO_DAY = -1;
/** Weekly-off picker; "None" (no weekly off) is null. */
export function WeekdayPicker({ value, onChange, testIDPrefix = 'weekday' }: {
  value: number | null; onChange: (v: number | null) => void; testIDPrefix?: string;
}) {
  const t = useT();
  const options = [NO_DAY, 0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: d, label: weekdayName(d === NO_DAY ? null : d, t) }));
  return <Segmented options={options} value={value ?? NO_DAY} onChange={(d) => onChange(d === NO_DAY ? null : d)} testIDPrefix={testIDPrefix} />;
}

export function Row({ title, subtitle, right, onPress, onLongPress, selected, testID }: {
  title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; onLongPress?: () => void; selected?: boolean; testID?: string;
}) {
  const body = (
    <View style={[styles.row, selected && styles.rowSelected]}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress && !onLongPress) return <View testID={testID}>{body}</View>;
  return <Pressable testID={testID} accessibilityRole="button" onPress={onPress} onLongPress={onLongPress}>{body}</Pressable>;
}

export function SwitchRow({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowTitle, styles.rowMain]}>{label}</Text>
      <Switch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  section: { gap: space.xs },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  error: { fontSize: 13, color: colors.danger },
  button: { minHeight: 46, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  field: { gap: space.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.card, paddingHorizontal: space.md, minHeight: 46, fontSize: 16, color: colors.text },
  inputError: { borderColor: colors.danger },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  segment: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  segmentOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { color: colors.text, fontSize: 14 },
  segmentTextOn: { color: colors.primaryText, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  rowSelected: { backgroundColor: colors.primarySoft, borderRadius: radius, paddingHorizontal: space.sm },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, color: colors.text },
});
