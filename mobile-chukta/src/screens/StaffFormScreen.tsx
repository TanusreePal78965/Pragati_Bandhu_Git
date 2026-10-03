import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StaffApiError, type StaffApiErrorKey } from '../api/staffApi';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { staffApi } from '../app/services';
import { useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { getStaffUser } from '../repos/staff';
import {
  Button,
  Card,
  ErrorText,
  Field,
  Loading,
  Screen,
  ScreenHeader,
  StatusChip,
  SwitchRow,
} from '../ui/components';
import { space } from '../ui/theme';
import { validateStaffForm, type FieldErrors } from '../view/forms';

export function StaffFormScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'StaffForm'>>();
  const staffId = params?.staffId ?? null;
  const { data: existing } = useLocalData((s) => (staffId ? getStaffUser(s.db, staffId) : Promise.resolve(null)), [staffId]);
  const [name, setName] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<StaffApiErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (name !== null || existing === undefined) return;
    setName(existing?.name ?? '');
    setActive(existing ? existing.is_active === 1 : true);
  }, [existing, name]);

  if (name === null) return <Loading />;
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  async function save() {
    setApiError(null);
    const r = validateStaffForm({ isNew: !staffId, name: name ?? '', pin, pinConfirm });
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    const reactivating = !!existing && existing.is_active === 0 && active;
    if (reactivating && !r.value.pin) {
      setErrors({ pin: 'staff.error.reactivateNeedsPin' });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (!staffId) {
        await staffApi.create({ propertyId: session.propertyId as string, name: r.value.name, pin: r.value.pin as string });
      } else {
        const patch: { staffId: string; name?: string; pin?: string; isActive?: boolean } = { staffId };
        if (r.value.name !== existing?.name) patch.name = r.value.name;
        if (r.value.pin) patch.pin = r.value.pin;
        if (existing && (existing.is_active === 1) !== active) patch.isActive = active;
        if (Object.keys(patch).length > 1) await staffApi.update(patch);
      }
      await session.runSync();
      navigation.goBack();
    } catch (e) {
      setApiError(e instanceof StaffApiError ? e.key : 'staff.error.unknown');
      setBusy(false);
    }
  }

  const title = t(staffId ? 'staff.titleEdit' : 'staff.titleNew');

  return (
    <Screen header={<ScreenHeader title={title} showBack />}>
      <View style={styles.noticeWrap}>
        <StatusChip label={t('common.needsInternet')} tone="info" />
      </View>

      <Card style={styles.card}>
        <Field label={t('staff.name')} value={name} onChangeText={setName} error={err('name')} testID="name" />
        <Field label={t(staffId ? 'staff.newPin' : 'staff.pin')} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad" secureTextEntry error={err('pin')} testID="pin" />
        <Field label={t('staff.pinConfirm')} value={pinConfirm} onChangeText={(v) => setPinConfirm(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad" secureTextEntry error={err('pinConfirm')} testID="pin-confirm" />
        {staffId ? <SwitchRow label={t('staff.active')} value={active} onChange={setActive} testID="active" /> : null}
      </Card>

      <ErrorText>{apiError ? t(apiError) : null}</ErrorText>

      <Button title={t('common.save')} onPress={() => void save()} loading={busy} testID="save" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  noticeWrap: {
    paddingVertical: space.xs,
  },
  card: {
    gap: space.md,
  },
});
