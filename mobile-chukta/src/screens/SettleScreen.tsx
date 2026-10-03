import { useRoute, type RouteProp } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useLocalData, useManualRefresh, useSession } from '../app/session';
import { closingBalance } from '../domain/settlement';
import type { PaymentMode, Property, Worker } from '../domain/types';
import { useT } from '../i18n/useT';
import { getProperty } from '../repos/properties';
import { getDueSettlement, settleWorker, type DueSettlement } from '../repos/settlements';
import { getWorker } from '../repos/workers';
import { Button, Card, EmptyState, ErrorText, Field, Label, Loading, Muted, Row, Screen, ScreenHeader, Section, Segmented } from '../ui/components';
import { PAYMENT_MODES } from '../ui/options';
import { colors, space } from '../ui/theme';
import { explanationText } from '../utils/format';
import { formatRupees } from '../utils/money';
import { formatPeriod } from '../view/dueList';
import { paiseToInput, parseOptionalAmount } from '../view/forms';

type Loaded = { worker: Worker; property: Property; due: DueSettlement | null } | null;

export function SettleScreen() {
  const t = useT();
  const session = useSession();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Settle'>>();
  const today = sessionToday(session);
  const { refreshing, onRefresh } = useManualRefresh();
  const isOwner = session.identity.kind === 'owner';
  const { data, reload } = useLocalData<Loaded>(async (s) => {
    if (s.identity.kind !== 'owner') return null;
    const worker = await getWorker(s.db, params.workerId);
    const property = worker ? await getProperty(s.db, worker.property_id) : null;
    if (!worker || !property) return null;
    return { worker, property, due: await getDueSettlement(s.db, worker, property, today) };
  }, [params.workerId, today]);

  const header = <ScreenHeader title={t('settle.title')} showBack />;
  if (!isOwner) {
    return (
      <Screen header={header}>
        <EmptyState icon="wallet-outline" message={t('money.ownerOnly')} />
      </Screen>
    );
  }
  if (data === undefined) return <Loading />;
  if (!data || !data.due) {
    return (
      <Screen header={header} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <EmptyState icon="wallet-outline" message={t('settle.nothingDue')} />
      </Screen>
    );
  }
  // Keyed by period so a reloaded draft for a different period starts from fresh defaults.
  return (
    <SettleForm
      key={data.due.period.start}
      worker={data.worker}
      property={data.property}
      due={data.due}
      today={today}
      reload={reload}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

function SettleForm({ worker, property, due, today, reload, refreshControl }: {
  worker: Worker; property: Property; due: DueSettlement; today: string; reload: () => void;
  refreshControl: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
}) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { draft, period } = due;
  const hasAdvance = draft.advanceOutstandingPaise > 0;
  const [recover, setRecover] = useState(hasAdvance ? paiseToInput(draft.suggestedRecoveryPaise) : '');
  const [paid, setPaid] = useState(paiseToInput(draft.suggestedPaidNowPaise));
  const [mode, setMode] = useState<PaymentMode | null>('cash');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saving = useRef(false);

  // Empty counts as 0; undefined means the text is not a valid amount.
  const recoverPaise = hasAdvance ? parseOptionalAmount(recover) : null;
  const paidPaise = parseOptionalAmount(paid);
  const recoverValid = recoverPaise !== undefined && (recoverPaise ?? 0) <= draft.advanceOutstandingPaise;
  const preview = recoverValid && paidPaise !== undefined ? closingBalance(draft, paidPaise ?? 0, recoverPaise ?? 0) : null;
  const showMode = (paidPaise ?? 0) > 0;

  function validate(): { paidNow: number; recovered: number } | null {
    const e: Record<string, string> = {};
    if (recoverPaise === undefined) e.recover = 'settle.invalidAmount';
    else if ((recoverPaise ?? 0) > draft.advanceOutstandingPaise) e.recover = 'settle.recoverTooMuch';
    if (paidPaise === undefined) e.paid = 'settle.invalidAmount';
    else if ((paidPaise ?? 0) > 0 && !mode) e.mode = 'settle.modeRequired';
    setErrors(e);
    if (Object.keys(e).length) return null;
    return { paidNow: paidPaise ?? 0, recovered: recoverPaise ?? 0 };
  }

  function save() {
    if (saving.current) return;
    const v = validate();
    if (!v) return;
    Alert.alert(t('settle.confirmTitle'), t('settle.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settle.confirm'), onPress: () => void doSettle(v.paidNow, v.recovered) },
    ]);
  }

  async function doSettle(paidNow: number, recovered: number) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      await settleWorker(session.repo, {
        worker, property, today, periodStart: period.start, paidNowPaise: paidNow, recoveredPaise: recovered,
        mode: paidNow > 0 ? mode : null, note,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'period changed') {
        setSaveError('settle.periodChanged');
        reload();
      } else setSaveError(msg === 'nothing is due' ? 'settle.nothingDue' : 'common.saveFailed');
      saving.current = false;
      setBusy(false);
      return;
    }
    session.afterWrite();
    // Task 11 switches this to navigation.replace('Payslip', { settlementId: s.id }).
    navigation.goBack();
  }

  const err = (k: string) => (errors[k] ? t(errors[k]) : null);
  const money = (p: number) => <Text style={styles.amount}>{formatRupees(p)}</Text>;
  const opening = draft.openingBalancePaise;

  return (
    <Screen
      header={<ScreenHeader title={t('settle.title')} subtitle={`${worker.name} · ${formatPeriod(period)}`} showBack />}
      refreshControl={refreshControl}
    >
      <Card>
        {draft.summary.explanation.map((line, i) => (
          <Muted key={i}>{explanationText(line, t)}</Muted>
        ))}
      </Card>

      <Section title={t('settle.period')}>
        {opening !== 0 ? (
          <Row
            title={opening < 0 ? t('settle.openingOverpaid', { amount: formatRupees(-opening) }) : t('settle.opening')}
            right={opening > 0 ? money(opening) : undefined}
          />
        ) : null}
        <Row title={t('settle.earned')} right={money(draft.earnedPaise)} />
        <Row title={t('settle.paidInPeriod')} right={money(draft.paidInPeriodPaise)} />
        <Row title={t('settle.wageDue')} right={money(draft.wageDuePaise)} />
        <Row title={t('settle.advanceOutstanding')} right={money(draft.advanceOutstandingPaise)} />
      </Section>

      <Card style={styles.card}>
        {hasAdvance ? (
          <Field
            label={t('settle.recover')}
            value={recover}
            onChangeText={setRecover}
            keyboardType="decimal-pad"
            error={err('recover')}
            testID="settle-recover"
          />
        ) : null}
        <Field
          label={t('settle.paidNow')}
          value={paid}
          onChangeText={setPaid}
          keyboardType="decimal-pad"
          error={err('paid')}
          testID="settle-paid"
        />
        {showMode ? (
          <View style={styles.fieldWrap}>
            <Label>{t('settle.mode')}</Label>
            <Segmented
              options={PAYMENT_MODES.map((m) => ({ value: m, label: t(`mode.${m}`) }))}
              value={mode}
              onChange={setMode}
              testIDPrefix="settle-mode"
            />
            <ErrorText>{err('mode')}</ErrorText>
          </View>
        ) : null}
        <Field label={t('settle.note')} value={note} onChangeText={setNote} testID="settle-note" />
      </Card>

      {preview !== null ? (
        <Text style={styles.preview} testID="settle-preview">
          {preview > 0
            ? t('settle.previewOwed', { amount: formatRupees(preview) })
            : preview < 0
              ? t('settle.previewOverpaid', { amount: formatRupees(-preview) })
              : t('settle.previewClear')}
        </Text>
      ) : null}

      <ErrorText>{saveError ? t(saveError) : null}</ErrorText>
      <Button title={t('settle.confirm')} onPress={save} loading={busy} disabled={busy} testID="settle-save" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  fieldWrap: { gap: space.xs },
  amount: { fontSize: 15, fontWeight: '700', color: colors.text },
  preview: { fontSize: 15, fontWeight: '700', color: colors.text },
});
