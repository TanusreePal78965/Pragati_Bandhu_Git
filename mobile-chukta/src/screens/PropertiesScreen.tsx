import { useCallback, useEffect } from 'react';
import { Alert, RefreshControl } from 'react-native';
import { useStackNav } from '../app/routes';
import { useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { listAllProperties, updatePropertySettings } from '../repos/properties';
import { Button, Loading, Muted, Row, Screen, Section } from '../ui/components';

export function PropertiesScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { data } = useLocalData((s) => listAllProperties(s.db));
  const active = (data ?? []).filter((p) => p.is_active === 1);
  const archived = (data ?? []).filter((p) => p.is_active === 0);

  const choose = useCallback(async (id: string) => {
    await session.setPropertyId(id);
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }, [session, navigation]);

  const onlyId = active.length === 1 ? active[0].id : null;
  useEffect(() => {
    if (!session.propertyId && onlyId) void choose(onlyId);
  }, [session.propertyId, onlyId, choose]);

  const restore = (id: string) => Alert.alert(t('properties.restore'), t('properties.restoreNote'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('properties.restore'),
      onPress: async () => {
        try {
          await updatePropertySettings(session.repo, id, { is_active: 1 });
          session.afterWrite();
        } catch {
          Alert.alert(t('common.saveFailed'));
        }
      },
    },
  ]);

  if (data === undefined) return <Loading />;
  return (
    <Screen refreshControl={<RefreshControl refreshing={session.syncStatus.running} onRefresh={() => void session.runSync()} />}>
      {data.length === 0 ? <Muted>{session.syncStatus.lastSyncedAt ? t('properties.empty') : t('properties.waitingForSync')}</Muted> : null}
      {active.map((p) => (
        <Row key={p.id} title={p.name} subtitle={p.address ?? undefined} selected={p.id === session.propertyId}
          onPress={() => void choose(p.id)} testID={`property-${p.id}`} />
      ))}
      <Button title={t('properties.add')} onPress={() => navigation.navigate('PropertyForm')} testID="add-property" />
      {archived.length > 0 ? (
        <Section title={t('properties.archived')}>
          {archived.map((p) => (
            <Row key={p.id} title={p.name}
              right={<Button kind="secondary" title={t('properties.restore')} onPress={() => restore(p.id)} testID={`restore-${p.id}`} />} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
