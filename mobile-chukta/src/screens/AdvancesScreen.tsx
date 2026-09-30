import { RefreshControl } from 'react-native';
import { useStackNav } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import type { Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { Card, Loading, Muted, Row, Screen, Title } from '../ui/components';
import { RequireProperty } from '../ui/RequireProperty';
import { formatRupees } from '../utils/money';
import { listWorkerSummaries } from '../view/ledgerQueries';

export function AdvancesScreen() {
  return <RequireProperty>{(p) => <AdvancesBody property={p} />}</RequireProperty>;
}

function AdvancesBody({ property }: { property: Property }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { data } = useLocalData(async (s) => (await listWorkerSummaries(s.db, property, sessionToday(s), true))
    .filter((x) => x.ledger.advanceOutstandingPaise !== 0)
    .sort((a, b) => b.ledger.advanceOutstandingPaise - a.ledger.advanceOutstandingPaise), [property]);
  if (!data) return <Loading />;
  const total = data.reduce((sum, x) => sum + x.ledger.advanceOutstandingPaise, 0);
  return (
    <Screen refreshControl={<RefreshControl refreshing={session.syncStatus.running} onRefresh={() => void session.runSync()} />}>
      <Card>
        <Muted>{t('advances.total')}</Muted>
        <Title testID="advances-total">{formatRupees(total)}</Title>
      </Card>
      {data.length === 0 ? <Muted>{t('advances.empty')}</Muted> : null}
      {data.map(({ worker, ledger }) => (
        <Row key={worker.id} testID={`advance-${worker.id}`} title={worker.name}
          right={<Title>{formatRupees(ledger.advanceOutstandingPaise)}</Title>}
          onPress={() => navigation.navigate('WorkerDetail', { workerId: worker.id })} />
      ))}
    </Screen>
  );
}
