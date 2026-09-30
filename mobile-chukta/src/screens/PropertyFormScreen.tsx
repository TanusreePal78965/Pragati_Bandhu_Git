import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { createProperty, getProperty, updatePropertySettings } from '../repos/properties';
import { Button, ErrorText, Field, Label, Loading, Screen, Section, Segmented, WeekdayPicker } from '../ui/components';
import { ATTENDANCE_MODES, DIVISORS, PAY_BASES } from '../ui/options';
import { propertyToFormValues, validatePropertyForm, type FieldErrors, type PropertyFormValues } from '../view/forms';

export function PropertyFormScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'PropertyForm'>>();
  const editingId = params?.propertyId ?? null;
  const { data: existing } = useLocalData((s) => (editingId ? getProperty(s.db, editingId) : Promise.resolve(null)), [editingId]);
  const [values, setValues] = useState<PropertyFormValues | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Remembers a property created by an earlier, failed Save attempt, so a retry finishes writing
  // its settings instead of creating a second property.
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    if (values === null && existing !== undefined) setValues(propertyToFormValues(existing));
  }, [existing, values]);
  useLayoutEffect(() => {
    navigation.setOptions({ title: t(editingId ? 'properties.edit' : 'properties.add') });
  }, [navigation, editingId, t]);

  if (!values) return <Loading />;
  const set = (patch: Partial<PropertyFormValues>) => setValues({ ...values, ...patch });
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  async function save() {
    const r = validatePropertyForm(values!);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      if (editingId) {
        await updatePropertySettings(session.repo, editingId, r.value);
        session.afterWrite();
        navigation.goBack();
        return;
      }
      if (session.identity.kind !== 'owner') return;
      let id = createdId;
      if (!id) {
        const p = await createProperty(session.repo, { shopId: session.identity.shopId, name: r.value.name, address: r.value.address ?? undefined });
        id = p.id;
        setCreatedId(id); // a retry after this point reuses this property instead of creating another
      }
      await updatePropertySettings(session.repo, id, r.value);
      session.afterWrite();
      if (!session.propertyId) {
        await session.setPropertyId(id);
        navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
      } else {
        navigation.goBack();
      }
    } catch {
      setSaveError('common.saveFailed');
    } finally {
      setBusy(false);
    }
  }

  function archive() {
    Alert.alert(t('properties.archive'), t('properties.archiveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('properties.archive'),
        style: 'destructive',
        onPress: async () => {
          try {
            await updatePropertySettings(session.repo, editingId as string, { is_active: 0 });
            session.afterWrite();
            if (session.propertyId === editingId) {
              await session.setPropertyId(null);
              navigation.reset({ index: 0, routes: [{ name: 'Properties' }] });
            } else {
              navigation.goBack();
            }
          } catch {
            Alert.alert(t('common.saveFailed'));
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <Field label={t('properties.name')} value={values.name} onChangeText={(name) => set({ name })} error={err('name')} testID="name" />
      <Field label={t('properties.address')} value={values.address} onChangeText={(address) => set({ address })} testID="address" />
      <Section title={t('properties.defaults')}>
        <Label>{t('fields.payBasis')}</Label>
        <Segmented options={PAY_BASES.map((b) => ({ value: b, label: t(`payBasis.${b}`) }))} value={values.defaultPayBasis}
          onChange={(defaultPayBasis) => set({ defaultPayBasis })} testIDPrefix="basis" />
        <Label>{t('fields.attendanceMode')}</Label>
        <Segmented options={ATTENDANCE_MODES.map((m) => ({ value: m, label: t(`attendanceMode.${m}`) }))} value={values.defaultAttendanceMode}
          onChange={(defaultAttendanceMode) => set({ defaultAttendanceMode })} testIDPrefix="mode" />
        <Field label={t('fields.shiftHours')} value={values.shiftHours} onChangeText={(shiftHours) => set({ shiftHours })}
          keyboardType="decimal-pad" error={err('shiftHours')} testID="shift" />
        <Label>{t('fields.weeklyOff')}</Label>
        <WeekdayPicker value={values.weeklyOff} onChange={(weeklyOff) => set({ weeklyOff })} />
        <Label>{t('fields.monthlyDivisor')}</Label>
        <Segmented options={DIVISORS.map((d) => ({ value: d, label: t(`divisor.${d}`) }))} value={values.monthlyDivisor}
          onChange={(monthlyDivisor) => set({ monthlyDivisor })} testIDPrefix="divisor" />
      </Section>
      <ErrorText>{saveError ? t(saveError) : null}</ErrorText>
      <Button title={t('common.save')} onPress={() => void save()} loading={busy} testID="save" />
      {editingId && existing?.is_active === 1 ? <Button kind="danger" title={t('properties.archive')} onPress={archive} testID="archive" /> : null}
    </Screen>
  );
}
