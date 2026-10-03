import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n/useT';
import { formatMonth, weekdayName } from '../utils/format';
import type { DayCell, MonthGrid } from '../view/monthGrid';
import { Icon } from './Icon';
import { colors, radius, shadows, space } from './theme';

function cellLabel(c: DayCell, t: (k: string, p?: Record<string, unknown>) => string): string {
  if (c.kind === 'off') return t('today.weeklyOff');
  if (c.kind !== 'working') return '';
  if (!c.entry || c.entry.status === 'present') return t('today.present');
  if (c.entry.status === 'hours') return t('today.hoursValue', { hours: c.entry.hours });
  return t(c.entry.status === 'absent' ? 'today.absent' : 'today.halfDay');
}

function cellBgColor(c: DayCell): string {
  if (c.kind === 'off') return colors.offSoft;
  if (c.kind !== 'working' || !c.entry) return colors.card;
  if (c.entry.status === 'absent') return colors.dangerSoft;
  if (c.entry.status === 'half_day') return colors.warnSoft;
  if (c.entry.status === 'hours') return colors.infoSoft;
  if (c.entry.status === 'present') return colors.successSoft;
  return colors.card;
}

function cellTextColor(c: DayCell): string {
  if (c.kind === 'off') return colors.offText;
  if (c.kind !== 'working' || !c.entry) return colors.text;
  if (c.entry.status === 'absent') return colors.dangerText;
  if (c.entry.status === 'half_day') return colors.warnText;
  if (c.entry.status === 'hours') return colors.infoText;
  if (c.entry.status === 'present') return colors.successText;
  return colors.text;
}

function cellBorderColor(c: DayCell): string {
  if (c.kind === 'off') return colors.offBorder;
  if (c.kind !== 'working' || !c.entry) return colors.border;
  if (c.entry.status === 'absent') return colors.dangerBorder;
  if (c.entry.status === 'half_day') return colors.warnBorder;
  if (c.entry.status === 'hours') return colors.infoBorder;
  if (c.entry.status === 'present') return colors.successBorder;
  return colors.border;
}

export function MonthCalendar({
  grid,
  onPrev,
  onNext,
}: {
  grid: MonthGrid;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const month = `${grid.year}-${String(grid.month).padStart(2, '0')}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          onPress={onPrev}
          accessibilityRole="button"
          accessibilityLabel={t('worker.prevMonth')}
          testID="month-prev"
          style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
        >
          <Text style={styles.nav}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{formatMonth(month, t)}</Text>
        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel={t('worker.nextMonth')}
          testID="month-next"
          style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
        >
          <Text style={styles.nav}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <Text key={`h${d}`} style={[styles.cell, styles.weekday]}>
            {weekdayName(d, t)}
          </Text>
        ))}
        {Array.from({ length: grid.leadingBlanks }, (_, i) => (
          <View key={`b${i}`} style={styles.cell} />
        ))}
        {grid.cells.map((c) => {
          const bg = cellBgColor(c);
          const textColor = cellTextColor(c);
          const borderColor = cellBorderColor(c);
          return (
            <View
              key={c.date}
              testID={`day-${c.date}`}
              accessibilityLabel={`${c.day} ${cellLabel(c, t)}`}
              style={[
                styles.cell,
                styles.day,
                { backgroundColor: bg, borderColor },
                c.halfOff && styles.halfOff,
                (c.kind === 'future' || c.kind === 'outside') && styles.faded,
              ]}
            >
              <Text style={[styles.dayNum, { color: textColor }]}>{c.day}</Text>
              {c.dayOff && c.kind === 'off' ? <Icon name="sunny-outline" size={12} color={textColor} /> : null}
              {c.workedOnOff ? <Icon name="add-outline" size={10} color={colors.primary} style={styles.badge} /> : null}
              {c.otHours > 0 ? <Text style={[styles.badge, styles.otBadge]}>{t('worker.otBadge')}</Text> : null}
              {c.entry?.status === 'hours' ? (
                <Text style={[styles.small, { color: textColor }]}>
                  {t('today.hoursValue', { hours: c.entry.hours })}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius,
    backgroundColor: colors.primarySoft,
  },
  navBtnPressed: {
    opacity: 0.7,
  },
  nav: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primaryDark,
    lineHeight: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  weekday: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    aspectRatio: undefined,
    paddingVertical: space.xs,
  },
  day: {
    borderWidth: 1,
    borderRadius: 6,
    margin: 1,
  },
  halfOff: {
    opacity: 0.5,
  },
  badge: {
    position: 'absolute',
    top: 1,
    right: 2,
  },
  otBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    top: 9,
  },
  faded: {
    opacity: 0.35,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
  },
  small: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: -2,
  },
});
