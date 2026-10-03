import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useStackNav } from '../app/routes';
import { sessionToday, useLocalData, useManualRefresh, useSession } from '../app/session';
import type { Property } from '../domain/types';
import { useT } from '../i18n/useT';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Loading,
  Row,
  Screen,
  ScreenHeader,
  Section,
  SwitchRow,
} from '../ui/components';
import { RequireProperty } from '../ui/RequireProperty';
import { colors, radius, shadows, space } from '../ui/theme';
import { formatRupees } from '../utils/money';
import { formatPeriod, listDueSettlements } from '../view/dueList';
import { listWorkerSummaries } from '../view/ledgerQueries';

export function WorkersScreen() {
  return <RequireProperty>{(p) => <WorkersBody property={p} />}</RequireProperty>;
}

function WorkersBody({ property }: { property: Property }) {
  const t = useT();
  const navigation = useStackNav();
  const isOwner = useSession().identity.kind === 'owner';
  const [showLeft, setShowLeft] = useState(false);
  const { data: loaded } = useLocalData(async (s) => {
    const today = sessionToday(s);
    const [summaries, due] = await Promise.all([
      listWorkerSummaries(s.db, property, today, showLeft),
      s.identity.kind === 'owner' ? listDueSettlements(s.db, property, today) : Promise.resolve([]),
    ]);
    return { summaries, due };
  }, [property, showLeft]);
  const { refreshing, onRefresh } = useManualRefresh();

  if (!loaded) return <Loading />;
  const { summaries: data, due: dueRows } = loaded;
  return (
    <Screen
      header={<ScreenHeader title={t('tabs.workers')} subtitle={property.name} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Button
        title={t('workers.add')}
        onPress={() => navigation.navigate('WorkerForm')}
        testID="add-worker"
      />

      {isOwner && dueRows.length > 0 ? (
        <Section title={t('settle.dueTitle')}>
          {dueRows.map((d) => (
            <Row
              key={d.worker.id}
              testID={`due-${d.worker.id}`}
              title={d.worker.name}
              subtitle={t('settle.dueRow', { period: formatPeriod(d.period, t), amount: formatRupees(d.wageDuePaise) })}
              left={<Avatar name={d.worker.name} id={d.worker.id} size={36} />}
              onPress={() => navigation.navigate('Settle', { workerId: d.worker.id })}
            />
          ))}
        </Section>
      ) : null}

      {data.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={t('workers.emptyTitle')}
          message={t('workers.empty')}
        />
      ) : null}


      <View style={styles.list}>
        {data.map(({ worker, ledger }) => {
          const due = ledger.wageDuePaise;
          return (
            <Card key={worker.id} style={styles.workerCard}>
              <Row
                testID={`worker-${worker.id}`}
                title={worker.status === 'left' ? `${worker.name} · ${t('workers.left')}` : worker.name}
                subtitle={`${formatRupees(worker.rate_paise)}${t(`rateSuffix.${worker.pay_basis}`)}`}
                left={<Avatar name={worker.name} id={worker.id} size={42} />}
                onPress={() => navigation.navigate('WorkerDetail', { workerId: worker.id })}
                right={
                  <View style={styles.right}>
                    <Text style={[styles.due, due < 0 && styles.overpaid]}>
                      {due >= 0 ? `${t('workers.due')} ${formatRupees(due)}` : `${t('workers.overpaid')} ${formatRupees(-due)}`}
                    </Text>
                    {ledger.advanceOutstandingPaise > 0 ? (
                      <Text style={styles.adv}>
                        {`${t('workers.advance')} ${formatRupees(ledger.advanceOutstandingPaise)}`}
                      </Text>
                    ) : null}
                  </View>
                }
              />
            </Card>
          );
        })}
      </View>

      <SwitchRow label={t('workers.showLeft')} value={showLeft} onChange={setShowLeft} testID="show-left" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
  },
  workerCard: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  right: { alignItems: 'flex-end', gap: 2 },
  due: { fontSize: 15, fontWeight: '700', color: colors.text },
  overpaid: { color: colors.accentText },
  adv: { fontSize: 13, color: colors.primaryDark, fontWeight: '500' },
});
