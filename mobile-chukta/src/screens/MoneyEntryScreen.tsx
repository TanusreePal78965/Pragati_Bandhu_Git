import { useRoute, type RouteProp } from '@react-navigation/native';
import { useLayoutEffect, useState } from 'react';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { addAdvance, addPayment } from '../repos/money';
import { getWorker } from '../repos/workers';
import { Button, Field, Label, Loading, Muted, Screen, Segmented } from '../ui/components';
import { DateField } from '../ui/DateField';
import { PAYMENT_MODES } from '../ui/options';
import { validateMoneyForm, type FieldErrors, type MoneyFormValues } from '../view/forms';

export function MoneyEntryScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'MoneyEntry'>>();
  const today = sessionToday(session);
  const [values, setValues] = useState<MoneyFormValues>({ kind: params.kind, amount: '', date: today, mode: 'cash', note: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const { data: worker } = useLocalData((s) => getWorker(s.db, params.workerId), [params.workerId]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t(`entryType.${params.kind}`) });
  }, [navigation, params.kind, t]);

  if (worker === undefined) return <Loading />;
  const set = (patch: Partial<MoneyFormValues>) => setValues({ ...values, ...patch });
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  async function save() {
    const r = validateMoneyForm(values);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    if (!worker) return;
    setBusy(true);
    const base = {
      propertyId: worker.property_id, workerId: worker.id, amountPaise: r.value.amountPaise, date: r.value.date,
      mode: r.value.mode ?? undefined, note: r.value.note ?? undefined,
    };
    if (params.kind === 'payment') await addPayment(session.repo, base);
    else await addAdvance(session.repo, { ...base, type: params.kind });
    session.afterWrite();
    navigation.goBack();
  }

  return (
    <Screen>
      {worker ? <Muted>{worker.name}</Muted> : null}
      <Field label={t('money.amount')} value={values.amount} onChangeText={(amount) => set({ amount })} keyboardType="decimal-pad"
        error={err('amount')} testID="amount" />
      <DateField label={t('money.date')} value={values.date} max={today} onChange={(date) => set({ date })} testID="money-date" />
      <Label>{t('money.mode')}</Label>
      <Segmented options={PAYMENT_MODES.map((m) => ({ value: m, label: t(`mode.${m}`) }))} value={values.mode}
        onChange={(mode) => set({ mode })} testIDPrefix="mode" />
      <Field label={t('money.note')} value={values.note} onChangeText={(note) => set({ note })} error={err('note')} testID="note" />
      <Button title={t('common.save')} onPress={() => void save()} loading={busy} testID="save" />
    </Screen>
  );
}
