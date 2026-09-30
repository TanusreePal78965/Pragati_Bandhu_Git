import { useRoute, type RouteProp } from '@react-navigation/native';
import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import { resolveSettings } from '../domain/settings';
import type { Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { listAttendance } from '../repos/attendance';
import { listAdvances, listPayments, voidAdvance, voidPayment } from '../repos/money';
import { getWorker } from '../repos/workers';
import { Button, Card, Loading, Muted, Row, Screen, Section, Title } from '../ui/components';
import { MonthCalendar } from '../ui/MonthCalendar';
import { RequireProperty } from '../ui/RequireProperty';
import { colors, space } from '../ui/theme';
import { daysInMonth } from '../utils/dates';
import { explanationText, formatDate } from '../utils/format';
import { formatRupees } from '../utils/money';
import { getWorkerLedger } from '../view/ledgerQueries';
import { buildMoneyHistory, type HistoryItem } from '../view/moneyHistory';
import { buildMonthGrid, shiftMonth } from '../view/monthGrid';

const pad = (n: number) => n.toString().padStart(2, '0');

export function WorkerDetailScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'WorkerDetail'>>();
  return <RequireProperty>{(p) => <WorkerDetailBody property={p} workerId={params.workerId} />}</RequireProperty>;
}

function WorkerDetailBody({ property, workerId }: { property: Property; workerId: string }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const today = sessionToday(session);
  const [ym, setYm] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [showExplain, setShowExplain] = useState(false);
  const correcting = useRef(false);

  const { data } = useLocalData(async (s) => {
    const worker = await getWorker(s.db, workerId);
    if (!worker) return null;
    const from = `${ym.year}-${pad(ym.month)}-01`;
    const to = `${ym.year}-${pad(ym.month)}-${pad(daysInMonth(ym.year, ym.month))}`;
    const [ledger, attendance, advances, payments] = await Promise.all([
      getWorkerLedger(s.db, worker, property, today),
      listAttendance(s.db, worker.id, from, to),
      listAdvances(s.db, worker.id),
      listPayments(s.db, worker.id),
    ]);
    const grid = buildMonthGrid({
      year: ym.year, month: ym.month, settings: resolveSettings(worker, property), joiningDate: worker.joining_date,
      leftDate: worker.left_date, today, attendance,
    });
    return { worker, ledger, grid, history: buildMoneyHistory(advances, payments) };
  }, [property, workerId, ym.year, ym.month, today]);

  const worker = data?.worker ?? null;
  useLayoutEffect(() => {
    if (!worker) return;
    navigation.setOptions({
      title: worker.name,
      headerRight: () => (
        <Pressable testID="edit-worker" accessibilityRole="button" onPress={() => navigation.navigate('WorkerForm', { workerId })}>
          <Text style={styles.headerLink}>{t('common.edit')}</Text>
        </Pressable>
      ),
    });
  }, [worker, navigation, workerId, t]);

  const correct = (item: HistoryItem) => Alert.alert(t('worker.correct'), t('worker.correctConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('worker.correct'),
      style: 'destructive',
      onPress: async () => {
        if (correcting.current) return;
        correcting.current = true;
        try {
          if (item.table === 'advance_entries') await voidAdvance(session.repo, item.id);
          else await voidPayment(session.repo, item.id);
          session.afterWrite();
        } catch {
          Alert.alert(t('common.saveFailed'));
        } finally {
          correcting.current = false;
        }
      },
    },
  ]);

  if (data === undefined) return <Loading />;
  if (data === null) return <Screen><Muted>{t('worker.notFound')}</Muted></Screen>;
  const { ledger, grid, history } = data;
  const due = ledger.wageDuePaise;
  const isOwner = session.identity.kind === 'owner';

  return (
    <Screen>
      <Card>
        <Muted>{due >= 0 ? t('worker.due') : t('workers.overpaid')}</Muted>
        <Title testID="due">{formatRupees(Math.abs(due))}</Title>
        <Muted>{`${t('worker.earned')} ${formatRupees(ledger.earnedPaise)} · ${t('worker.paid')} ${formatRupees(ledger.paidPaise)}`}</Muted>
        <Muted>{`${t('worker.advance')} ${formatRupees(ledger.advanceOutstandingPaise)}`}</Muted>
        <Muted>{t('worker.joined', { date: formatDate(data.worker.joining_date, t) })}</Muted>
        {data.worker.left_date ? <Muted>{t('worker.leftOn', { date: formatDate(data.worker.left_date, t) })}</Muted> : null}
        <Pressable onPress={() => setShowExplain(!showExplain)} accessibilityRole="button" testID="explain-toggle">
          <Text style={styles.link}>{t('worker.howCalculated')}</Text>
        </Pressable>
        {showExplain ? ledger.explanation.map((line, i) => <Text key={i} style={styles.explain}>{explanationText(line, t)}</Text>) : null}
      </Card>
      <View style={styles.actions}>
        {(['advance', 'repayment', 'writeoff', 'payment'] as const).map((kind) => (
          <View key={kind} style={styles.action}>
            <Button kind="secondary" title={t(`entryType.${kind}`)} onPress={() => navigation.navigate('MoneyEntry', { workerId, kind })} testID={`add-${kind}`} />
          </View>
        ))}
      </View>
      <Section title={t('worker.calendar')}>
        <MonthCalendar grid={grid} onPrev={() => setYm(shiftMonth(ym.year, ym.month, -1))} onNext={() => setYm(shiftMonth(ym.year, ym.month, 1))} />
      </Section>
      <Section title={t('worker.history')}>
        {history.length === 0 ? <Muted>{t('worker.noHistory')}</Muted> : null}
        {history.map((item) => (
          <Row
            key={item.id}
            title={t(`entryType.${item.kind}`)}
            subtitle={[
              formatDate(item.date, t),
              item.mode ? t(`mode.${item.mode}`) : null,
              item.isVoid ? t('worker.correction') : null,
              item.isVoided ? t('worker.cancelled') : null,
              item.note,
            ].filter(Boolean).join(' · ')}
            right={
              <View style={styles.historyRight}>
                <Text style={[styles.amount, (item.isVoided || item.isVoid) && styles.struck]}>{formatRupees(item.amountPaise)}</Text>
                {isOwner && item.canCorrect ? (
                  <Button kind="secondary" title={t('worker.correct')} onPress={() => correct(item)} testID={`correct-${item.id}`} />
                ) : null}
              </View>
            }
          />
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLink: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  link: { color: colors.primary, fontSize: 14, marginTop: space.xs },
  explain: { fontSize: 13, color: colors.text },
  historyRight: { alignItems: 'flex-end', gap: space.xs },
  amount: { fontSize: 15, fontWeight: '600', color: colors.text },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: { flexGrow: 1, flexBasis: '45%' },
});
