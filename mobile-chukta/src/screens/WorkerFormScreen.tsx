import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import type { AttendanceMode, MonthlyDivisor, Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { createWorker, getWorker, updateWorker } from '../repos/workers';
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Loading,
  Muted,
  Screen,
  ScreenHeader,
  Section,
  Segmented,
  SwitchRow,
  WeekdayPicker,
} from '../ui/components';
import { DateField } from '../ui/DateField';
import { ATTENDANCE_MODES, DIVISORS, PAY_BASES } from '../ui/options';
import { RequireProperty } from '../ui/RequireProperty';
import { space } from '../ui/theme';
import {
  toNewWorker,
  toWorkerPatch,
  validateWorkerForm,
  workerToFormValues,
  type FieldErrors,
  type WorkerFormValues,
} from '../view/forms';

const DEFAULT = 'default';
const newWorkerValues = (p: Property, today: string): WorkerFormValues => ({
  name: '', phone: '', payBasis: p.default_pay_basis, rate: '', joiningDate: today, attendanceMode: null, shiftHours: '',
  weeklyOffOverride: false, weeklyOff: null, monthlyDivisor: null, hasLeft: false, leftDate: null,
});
const hasOverrides = (v: WorkerFormValues) => v.attendanceMode !== null || v.shiftHours !== '' || v.weeklyOffOverride || v.monthlyDivisor !== null;

export function WorkerFormScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'WorkerForm'>>();
  return <RequireProperty>{(p) => <WorkerFormBody property={p} workerId={params?.workerId ?? null} />}</RequireProperty>;
}

function WorkerFormBody({ property, workerId }: { property: Property; workerId: string | null }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const today = sessionToday(session);
  const { data: existing } = useLocalData((s) => (workerId ? getWorker(s.db, workerId) : Promise.resolve(null)), [workerId]);
  const [values, setValues] = useState<WorkerFormValues | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (values !== null || existing === undefined) return;
    const v = existing ? workerToFormValues(existing) : newWorkerValues(property, today);
    setValues(v);
    setShowOverrides(hasOverrides(v));
  }, [existing, values, property, today]);

  if (!values) return <Loading />;
  const set = (patch: Partial<WorkerFormValues>) => setValues({ ...values, ...patch });
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  const toggleOverrides = (on: boolean) => {
    setShowOverrides(on);
    if (!on) set({ attendanceMode: null, shiftHours: '', weeklyOffOverride: false, weeklyOff: null, monthlyDivisor: null });
  };

  async function save() {
    const r = validateWorkerForm(values!);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      if (workerId) await updateWorker(session.repo, workerId, toWorkerPatch(r.value));
      else await createWorker(session.repo, toNewWorker(property.id, r.value));
    } catch {
      setSaveError('common.saveFailed');
      setBusy(false);
      return;
    }
    session.afterWrite();
    navigation.goBack();
  }

  const modeOptions = [
    { value: DEFAULT, label: `${t('workerForm.useDefault')} (${t(`attendanceMode.${property.default_attendance_mode}`)})` },
    ...ATTENDANCE_MODES.map((m) => ({ value: m as string, label: t(`attendanceMode.${m}`) })),
  ];
  const divisorOptions = [
    { value: DEFAULT, label: `${t('workerForm.useDefault')} (${t(`divisor.${property.monthly_divisor}`)})` },
    ...DIVISORS.map((d) => ({ value: d as string, label: t(`divisor.${d}`) })),
  ];

  const title = t(workerId ? 'workerForm.titleEdit' : 'workerForm.titleNew');

  return (
    <Screen header={<ScreenHeader title={title} showBack />}>
      <Card style={styles.card}>
        <Field label={t('workerForm.name')} value={values.name} onChangeText={(name) => set({ name })} error={err('name')} testID="name" />
        <Field label={t('workerForm.phone')} value={values.phone} onChangeText={(phone) => set({ phone: phone.replace(/\D/g, '').slice(0, 10) })}
          keyboardType="phone-pad" error={err('phone')} testID="phone" />
        <View style={styles.fieldWrap}>
          <Label>{t('fields.payBasis')}</Label>
          <Segmented options={PAY_BASES.map((b) => ({ value: b, label: t(`payBasis.${b}`) }))} value={values.payBasis}
            onChange={(payBasis) => set({ payBasis })} testIDPrefix="basis" />
        </View>
        <Field label={t(`rateLabel.${values.payBasis}`)} value={values.rate} onChangeText={(rate) => set({ rate })} keyboardType="decimal-pad"
          error={err('rate')} testID="rate" />
        <DateField label={t('workerForm.joiningDate')} value={values.joiningDate} onChange={(joiningDate) => set({ joiningDate })} testID="joining" />
      </Card>

      <Card style={styles.card}>
        <SwitchRow label={t('workerForm.overrides')} value={showOverrides} onChange={toggleOverrides} testID="overrides" />
        <Muted>{t('workerForm.overridesHint')}</Muted>
      </Card>

      {showOverrides ? (
        <Section title={t('workerForm.overrides')}>
          {values.payBasis !== 'hourly' ? (
            <View style={styles.fieldWrap}>
              <Label>{t('fields.attendanceMode')}</Label>
              <Segmented options={modeOptions} value={values.attendanceMode ?? DEFAULT}
                onChange={(m) => set({ attendanceMode: m === DEFAULT ? null : (m as AttendanceMode) })} testIDPrefix="worker-mode" />
            </View>
          ) : null}
          <Field label={t('fields.shiftHours')} value={values.shiftHours} onChangeText={(shiftHours) => set({ shiftHours })}
            placeholder={`${t('workerForm.useDefault')} (${property.shift_hours})`} keyboardType="decimal-pad" error={err('shiftHours')} testID="shift" />
          <SwitchRow label={t('workerForm.ownWeeklyOff')} value={values.weeklyOffOverride}
            onChange={(weeklyOffOverride) => set({ weeklyOffOverride, weeklyOff: weeklyOffOverride ? property.weekly_off : null })} testID="own-weekly-off" />
          {values.weeklyOffOverride ? <WeekdayPicker value={values.weeklyOff} onChange={(weeklyOff) => set({ weeklyOff })} /> : null}
          {values.payBasis === 'monthly' ? (
            <View style={styles.fieldWrap}>
              <Label>{t('fields.monthlyDivisor')}</Label>
              <Segmented options={divisorOptions} value={values.monthlyDivisor ?? DEFAULT}
                onChange={(d) => set({ monthlyDivisor: d === DEFAULT ? null : (d as MonthlyDivisor) })} testIDPrefix="worker-divisor" />
            </View>
          ) : null}
        </Section>
      ) : null}

      {workerId ? (
        <Card style={styles.card}>
          <SwitchRow label={t('workerForm.hasLeft')} value={values.hasLeft}
            onChange={(hasLeft) => set({ hasLeft, leftDate: hasLeft ? values.leftDate ?? today : null })} testID="has-left" />
          {values.hasLeft && values.leftDate ? (
            <DateField label={t('workerForm.leftDate')} value={values.leftDate} max={today} onChange={(leftDate) => set({ leftDate })} testID="left-date" />
          ) : null}
          <ErrorText>{err('leftDate')}</ErrorText>
        </Card>
      ) : null}

      <ErrorText>{saveError ? t(saveError) : null}</ErrorText>
      <Button title={t('common.save')} onPress={() => void save()} loading={busy} testID="save" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
  },
  fieldWrap: {
    gap: space.xs,
  },
});
