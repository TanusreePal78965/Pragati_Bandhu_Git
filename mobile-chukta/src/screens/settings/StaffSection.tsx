import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { StaffApiError } from '../../api/staffApi';
import { useStackNav } from '../../app/routes';
import { staffApi } from '../../app/services';
import { useLocalData, useSession } from '../../app/session';
import { useT } from '../../i18n/useT';
import { listStaff } from '../../repos/staff';
import { Avatar, Button, Muted, Row, Section, StatusChip } from '../../ui/components';
import { space } from '../../ui/theme';

export function StaffSection() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const [unlocking, setUnlocking] = useState(false);
  const { data } = useLocalData((s) => (s.propertyId ? listStaff(s.db, s.propertyId) : Promise.resolve([])));
  if (session.identity.kind !== 'owner' || !session.propertyId) return null;
  const phone = session.identity.phone;

  async function unlock() {
    setUnlocking(true);
    try {
      await staffApi.unlock();
      Alert.alert(t('settings.unlock'), t('settings.unlocked'));
    } catch (e) {
      Alert.alert(t('settings.unlock'), t(e instanceof StaffApiError ? e.key : 'staff.error.unknown'));
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <Section title={t('settings.staff')}>
      <Muted>{t('settings.staffHelp', { phone })}</Muted>
      {(data ?? []).map((st) => (
        <Row
          key={st.id}
          title={st.name}
          subtitle={st.is_active ? t('staff.active') : t('staff.inactive')}
          left={<Avatar name={st.name} id={st.id} size={36} />}
          right={
            <StatusChip
              label={st.is_active ? t('staff.active') : t('staff.inactive')}
              tone={st.is_active ? 'success' : 'off'}
            />
          }
          onPress={() => navigation.navigate('StaffForm', { staffId: st.id })}
          testID={`staff-${st.id}`}
        />
      ))}
      <View style={styles.actions}>
        <Button
          kind="secondary"
          title={t('settings.addStaff')}
          onPress={() => navigation.navigate('StaffForm')}
          testID="add-staff"
        />
        <Button
          kind="secondary"
          title={t('settings.unlock')}
          onPress={() => void unlock()}
          loading={unlocking}
          testID="unlock"
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: space.sm,
    marginTop: space.xs,
  },
});
