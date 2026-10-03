import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useStackNav } from '../app/routes';
import { sessionToday, useLocalData, useManualRefresh } from '../app/session';
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
  SwitchRow,
} from '../ui/components';
import { RequireProperty } from '../ui/RequireProperty';
import { colors, radius, shadows, space } from '../ui/theme';
import { formatRupees } from '../utils/money';
import { listWorkerSummaries } from '../view/ledgerQueries';

export function WorkersScreen() {
  return <RequireProperty>{(p) => <WorkersBody property={p} />}</RequireProperty>;
}

function WorkersBody({ property }: { property: Property }) {
  const t = useT();
  const navigation = useStackNav();
  const [showLeft, setShowLeft] = useState(false);
  const { data } = useLocalData((s) => listWorkerSummaries(s.db, property, sessionToday(s), showLeft), [property, showLeft]);
  const { refreshing, onRefresh } = useManualRefresh();

  if (!data) return <Loading />;
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

      {data.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={t('workers.emptyTitle')}
          message={t('workers.empty')}
        />
      ) : null}

      {/* Hidden text kept for test assertion compatibility */}

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
