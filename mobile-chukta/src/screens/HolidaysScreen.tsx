import { StyleSheet, View } from 'react-native';
import { useStackNav } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import type { DayOff, Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { listDaysOff } from '../repos/daysOff';
import { Button, EmptyState, Loading, Row, Screen, ScreenHeader, Section, StatusChip } from '../ui/components';
import { RequireProperty } from '../ui/RequireProperty';
import { space } from '../ui/theme';
import { formatDate } from '../utils/format';

export function HolidaysScreen() {
  return <RequireProperty>{(p) => <HolidaysBody property={p} />}</RequireProperty>;
}

function HolidaysBody({ property }: { property: Property }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const today = sessionToday(session);
  const { data } = useLocalData((s) => listDaysOff(s.db, property.id), [property]);
  if (!data) return <Loading />;
  const upcoming = data.filter((d) => d.date >= today).reverse(); // soonest first
  const past = data.filter((d) => d.date < today);

  const item = (d: DayOff) => (
    <Row
      key={d.id}
      title={d.name}
      subtitle={[formatDate(d.date, t), d.portion === 'half' ? t('daysOff.half') : null].filter(Boolean).join(' · ')}
      right={
        <View style={styles.chips}>
          <StatusChip label={t(d.kind === 'closure' ? 'daysOff.closure' : 'daysOff.holiday')} tone={d.kind === 'closure' ? 'warning' : 'info'} />
          {d.is_active ? null : <StatusChip label={t('daysOff.removed')} tone="danger" />}
        </View>
      }
      onPress={() => navigation.navigate('HolidayForm', { dayOffId: d.id })}
      testID={`dayoff-${d.id}`}
    />
  );

  return (
    <Screen header={<ScreenHeader title={t('daysOff.title')} subtitle={property.name} showBack />}>
      <Button title={t('daysOff.add')} onPress={() => navigation.navigate('HolidayForm')} testID="add-holiday" />
      {data.length === 0 ? <EmptyState icon="sunny-outline" title={t('daysOff.title')} message={t('daysOff.empty')} /> : null}
      {upcoming.length ? <Section title={t('daysOff.upcoming')}>{upcoming.map(item)}</Section> : null}
      {past.length ? <Section title={t('daysOff.past')}>{past.map(item)}</Section> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ chips: { flexDirection: 'row', gap: space.xs } });
