import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useCurrentProperty, useSession } from '../app/session';
import type { DayOffPayRule, DayOffPortion } from '../domain/types';
import { useT } from '../i18n/useT';
import { addDayOff, getDayOff, updateDayOff } from '../repos/daysOff';
import { Button, ErrorText, Field, Label, Loading, Screen, ScreenHeader, Segmented, StatusChip, SwitchRow } from '../ui/components';
import { DateField } from '../ui/DateField';
import { space } from '../ui/theme';
import { holidayToFormValues, validateHolidayForm, type HolidayFormValues } from '../view/forms';

const SUGGESTIONS = ['durgaPuja', 'poilaBoishakh', 'eid', 'diwali', 'holi', 'republicDay', 'independenceDay', 'christmas'] as const;

export function HolidayFormScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'HolidayForm'>>();
  const dayOffId = params?.dayOffId;
  const { property } = useCurrentProperty();
  const today = sessionToday(session);
  const [values, setValues] = useState<HolidayFormValues | null>(dayOffId ? null : holidayToFormValues(null, today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!dayOffId) return;
    void getDayOff(session.db, dayOffId).then((d) => { if (d) setValues(holidayToFormValues(d, today)); });
  }, [dayOffId, session.db, today]);

  if (!values || !property) return <Loading />;
  const set = (patch: Partial<HolidayFormValues>) => setValues({ ...values, ...patch });

  async function save() {
    const r = validateHolidayForm(values!);
    if (!r.ok) { setErrors(r.errors); return; }
    setBusy(true);
    setSaveError(null);
    try {
      const v = r.value;
      if (dayOffId) {
        await updateDayOff(session.repo, dayOffId, { name: v.name, kind: v.kind, portion: v.portion, pay_rule: v.payRule, is_active: v.isActive ? 1 : 0 });
      } else {
        await addDayOff(session.repo, { propertyId: property!.id, date: v.date, name: v.name, kind: v.kind, portion: v.portion, payRule: v.payRule });
      }
    } catch {
      setSaveError('common.saveFailed');
      setBusy(false);
      return;
    }
    session.afterWrite();
    navigation.goBack();
  }

  return (
    <Screen header={<ScreenHeader title={t(dayOffId ? 'daysOff.edit' : 'daysOff.add')} showBack />}>
      <Field label={t('daysOff.name')} value={values.name} onChangeText={(name) => { set({ name }); setErrors({}); }}
        error={errors.name ? t(errors.name) : undefined} testID="holiday-name" />
      {dayOffId ? null : (
        <>
          <Label>{t('daysOff.suggestions')}</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SUGGESTIONS.map((k) => (
              <StatusChip key={k} label={t(`daysOff.suggest.${k}`)} tone="primary" onPress={() => set({ name: t(`daysOff.suggest.${k}`) })} />
            ))}
          </ScrollView>
        </>
      )}
      <DateField label={t('daysOff.date')} value={values.date} onChange={(date) => set({ date })} disabled={!!dayOffId} testID="holiday-date" />
      <Label>{t('daysOff.portion')}</Label>
      <Segmented<DayOffPortion>
        options={[{ value: 'full', label: t('daysOff.full') }, { value: 'half', label: t('daysOff.half') }]}
        value={values.portion} onChange={(portion) => set({ portion })} testIDPrefix="portion" />
      <Label>{t('daysOff.payRule')}</Label>
      <Segmented<DayOffPayRule>
        options={[
          { value: 'by_basis', label: t('daysOff.byBasis') },
          { value: 'all_paid', label: t('daysOff.allPaid') },
          { value: 'all_unpaid', label: t('daysOff.allUnpaid') },
        ]}
        value={values.payRule} onChange={(payRule) => set({ payRule })} testIDPrefix="payRule" />
      {dayOffId ? (
        <SwitchRow label={t('daysOff.active')} value={values.isActive} onChange={(isActive) => set({ isActive })} testID="holiday-active" />
      ) : null}
      {saveError ? <ErrorText>{t(saveError)}</ErrorText> : null}
      <Button title={t('common.save')} onPress={() => void save()} disabled={busy} testID="holiday-save" />
    </Screen>
  );
}

const styles = StyleSheet.create({ chips: { gap: space.xs, paddingVertical: space.xs } });
