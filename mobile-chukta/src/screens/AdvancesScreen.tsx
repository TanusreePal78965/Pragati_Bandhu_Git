import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useStackNav } from '../app/routes';
import { sessionToday, useLocalData, useManualRefresh } from '../app/session';
import type { Property } from '../domain/types';
import { useT } from '../i18n/useT';
import {
  Avatar,
  Card,
  EmptyState,
  HeroCard,
  Loading,
  Muted,
  Row,
  Screen,
  ScreenHeader,
  StatusChip,
  Title,
} from '../ui/components';
import { Icon } from '../ui/Icon';
import { RequireProperty } from '../ui/RequireProperty';
import { colors, space } from '../ui/theme';
import { formatRupees } from '../utils/money';
import { listWorkerSummaries } from '../view/ledgerQueries';

export function AdvancesScreen() {
  return <RequireProperty>{(p) => <AdvancesBody property={p} />}</RequireProperty>;
}

function AdvancesBody({ property }: { property: Property }) {
  const t = useT();
  const navigation = useStackNav();
  const { data } = useLocalData(
    async (s) =>
      (await listWorkerSummaries(s.db, property, sessionToday(s), true))
        .filter((x) => x.ledger.advanceOutstandingPaise !== 0)
        .sort((a, b) => b.ledger.advanceOutstandingPaise - a.ledger.advanceOutstandingPaise),
    [property],
  );
  const { refreshing, onRefresh } = useManualRefresh();

  if (!data) return <Loading />;
  const total = data.reduce((sum, x) => sum + x.ledger.advanceOutstandingPaise, 0);

  return (
    <Screen
      header={<ScreenHeader title={t('tabs.advances')} subtitle={property.name} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Gradient Hero Advances Card */}
      <HeroCard variant="soft" style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.iconCircle}>
            <Icon name="wallet-outline" size={24} color={colors.primaryDark} />
          </View>
          <StatusChip label={t('advances.title')} tone="primary" />
        </View>
        <View style={styles.heroAmountWrap}>
          <Muted style={styles.heroLabel}>{t('advances.total')}</Muted>
          <Title testID="advances-total" style={styles.heroAmount}>
            {formatRupees(total)}
          </Title>
        </View>
      </HeroCard>

      {data.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title={t('advances.emptyTitle')}
          message={t('advances.empty')}
        />
      ) : null}

      {/* Hidden text kept for test compatibility */}

      <View style={styles.list}>
        {data.map(({ worker, ledger }) => (
          <Card key={worker.id} style={styles.workerCard}>
            <Row
              testID={`advance-${worker.id}`}
              title={worker.name}
              subtitle={`${formatRupees(worker.rate_paise)}${t(`rateSuffix.${worker.pay_basis}`)}`}
              left={<Avatar name={worker.name} id={worker.id} size={42} />}
              right={
                <View style={styles.advanceRight}>
                  <Text style={styles.advanceAmount}>
                    {formatRupees(ledger.advanceOutstandingPaise)}
                  </Text>
                </View>
              }
              onPress={() => navigation.navigate('WorkerDetail', { workerId: worker.id })}
            />
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: space.md,
    padding: space.lg,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  heroAmountWrap: {
    gap: 2,
  },
  heroLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  list: {
    gap: space.sm,
  },
  workerCard: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  advanceRight: {
    alignItems: 'flex-end',
  },
  advanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
