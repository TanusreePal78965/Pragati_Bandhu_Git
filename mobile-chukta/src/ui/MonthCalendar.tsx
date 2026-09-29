import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n/useT';
import { formatMonth, weekdayName } from '../utils/format';
import type { DayCell, MonthGrid } from '../view/monthGrid';
import { colors, radius, space } from './theme';

function cellLabel(c: DayCell, t: (k: string, p?: Record<string, unknown>) => string): string {
  if (c.kind === 'off') return t('today.weeklyOff');
  if (c.kind !== 'working') return '';
  if (!c.entry || c.entry.status === 'present') return t('today.present');
  if (c.entry.status === 'hours') return t('today.hoursValue', { hours: c.entry.hours });
  return t(c.entry.status === 'absent' ? 'today.absent' : 'today.halfDay');
}

function cellColor(c: DayCell): string {
  if (c.kind === 'off') return colors.offSoft;
  if (c.kind !== 'working' || !c.entry) return colors.card;
  if (c.entry.status === 'absent') return colors.dangerSoft;
  if (c.entry.status === 'half_day') return colors.warnSoft;
  if (c.entry.status === 'hours') return colors.infoSoft;
  return colors.card;
}

export function MonthCalendar({ grid, onPrev, onNext }: { grid: MonthGrid; onPrev: () => void; onNext: () => void }) {
  const t = useT();
  const month = `${grid.year}-${String(grid.month).padStart(2, '0')}`;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel={t('worker.prevMonth')} testID="month-prev"><Text style={styles.nav}>‹</Text></Pressable>
        <Text style={styles.title}>{formatMonth(month, t)}</Text>
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel={t('worker.nextMonth')} testID="month-next"><Text style={styles.nav}>›</Text></Pressable>
      </View>
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5, 6].map((d) => <Text key={`h${d}`} style={[styles.cell, styles.weekday]}>{weekdayName(d, t)}</Text>)}
        {Array.from({ length: grid.leadingBlanks }, (_, i) => <View key={`b${i}`} style={styles.cell} />)}
        {grid.cells.map((c) => (
          <View key={c.date} testID={`day-${c.date}`} accessibilityLabel={`${c.day} ${cellLabel(c, t)}`}
            style={[styles.cell, styles.day, { backgroundColor: cellColor(c) }, (c.kind === 'future' || c.kind === 'outside') && styles.faded]}>
            <Text style={styles.dayNum}>{c.day}</Text>
            {c.entry?.status === 'hours' ? <Text style={styles.small}>{c.entry.hours}h</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { fontSize: 28, color: colors.primary, paddingHorizontal: space.md },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontSize: 12, color: colors.muted, textAlign: 'center', aspectRatio: undefined, paddingVertical: space.xs },
  day: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius / 2 },
  faded: { opacity: 0.35 },
  dayNum: { fontSize: 14, color: colors.text },
  small: { fontSize: 10, color: colors.muted },
});
