import { useRoute, type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import { activeMoneyRows } from '../domain/attendance';
import { useT } from '../i18n/useT';
import { addAdvance, addPayment, listAdvances } from '../repos/money';
import { getWorker } from '../repos/workers';
import {
  Avatar,
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Loading,
  Muted,
  Screen,
  ScreenHeader,
  Segmented,
  StatusChip,
} from '../ui/components';
import { DateField } from '../ui/DateField';
import { PAYMENT_MODES } from '../ui/options';
import { colors, radius, shadows, space } from '../ui/theme';
import { formatRupees, rupeesToPaise } from '../utils/money';
import { validateMoneyForm, type FieldErrors, type MoneyFormValues } from '../view/forms';

export function MoneyEntryScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'MoneyEntry'>>();
  const today = sessionToday(session);
  // A write-off moves no money, so it has no payment mode.
  const isWriteoff = params.kind === 'writeoff';
  const [values, setValues] = useState<MoneyFormValues>({ kind: params.kind, amount: '', date: today, mode: isWriteoff ? null : 'cash', note: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { data: worker } = useLocalData((s) => getWorker(s.db, params.workerId), [params.workerId]);
  // Only repayments and write-offs can overshoot what's actually owed; advances and payments never do.
  const tracksAdvance = params.kind === 'repayment' || params.kind === 'writeoff';
  const { data: advances } = useLocalData((s) => (tracksAdvance ? listAdvances(s.db, params.workerId) : Promise.resolve(null)), [params.workerId, tracksAdvance]);

  if (worker === undefined) return <Loading />;
  const set = (patch: Partial<MoneyFormValues>) => setValues({ ...values, ...patch });
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  const outstandingPaise = advances
    ? activeMoneyRows(advances).reduce((sum, a) => sum + (a.type === 'advance' ? a.amount_paise : -a.amount_paise), 0)
    : null;
  const enteredPaise = rupeesToPaise(values.amount);
  // A warning, not a block: the owner may have a real reason (e.g. a final settlement) to record more.
  const exceedsAdvance = tracksAdvance && outstandingPaise !== null && enteredPaise !== null && enteredPaise > Math.max(outstandingPaise, 0);

  async function save() {
    const r = validateMoneyForm(values);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    if (!worker) return;
    setBusy(true);
    setSaveError(null);
    const base = {
      propertyId: worker.property_id, workerId: worker.id, amountPaise: r.value.amountPaise, date: r.value.date,
      mode: isWriteoff ? undefined : r.value.mode ?? undefined, note: r.value.note ?? undefined,
    };
    try {
      if (params.kind === 'payment') await addPayment(session.repo, base);
      else await addAdvance(session.repo, { ...base, type: params.kind });
    } catch {
      setSaveError('common.saveFailed');
      setBusy(false);
      return;
    }
    session.afterWrite();
    navigation.goBack();
  }

  const title = t(`entryType.${params.kind}`);

  return (
    <Screen header={<ScreenHeader title={title} showBack />}>
      {worker ? (
        <Card style={styles.workerHeaderCard}>
          <Avatar name={worker.name} id={worker.id} size={42} />
          <View style={styles.workerInfo}>
            <Text style={styles.workerName}>{worker.name}</Text>
            <Muted>{worker.phone || t('worker.noPhone')}</Muted>
          </View>
          <StatusChip label={title} tone="primary" />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Field
          label={t('money.amount')}
          value={values.amount}
          onChangeText={(amount) => set({ amount })}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={err('amount')}
          testID="amount"
        />

        {exceedsAdvance ? (
          <View style={styles.warningBox}>
            <Muted testID="exceeds-advance" style={styles.warningText}>
              {t('money.exceedsAdvance', { outstanding: formatRupees(outstandingPaise as number) })}
            </Muted>
          </View>
        ) : null}

        <DateField
          label={t('money.date')}
          value={values.date}
          max={today}
          onChange={(date) => set({ date })}
          testID="money-date"
        />

        {isWriteoff ? null : (
          <View style={styles.fieldWrap}>
            <Label>{t('money.mode')}</Label>
            <Segmented
              options={PAYMENT_MODES.map((m) => ({ value: m, label: t(`mode.${m}`) }))}
              value={values.mode}
              onChange={(mode) => set({ mode })}
              testIDPrefix="mode"
            />
          </View>
        )}

        <Field
          label={t('money.note')}
          value={values.note}
          onChangeText={(note) => set({ note })}
          placeholder={t('money.notePlaceholder')}
          error={err('note')}
          testID="note"
        />
      </Card>

      <ErrorText>{saveError ? t(saveError) : null}</ErrorText>
      <Button title={t('common.save')} onPress={() => void save()} loading={busy} testID="save" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  workerHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    gap: space.md,
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  card: {
    gap: space.md,
  },
  fieldWrap: {
    gap: space.xs,
  },
  warningBox: {
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: colors.warnBorder,
    borderRadius: radius,
    padding: space.sm,
  },
  warningText: {
    color: colors.warnText,
    fontWeight: '600',
  },
});
