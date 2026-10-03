import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import { useStackNav } from '../app/routes';
import { useLocalData, useManualRefresh, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { listAllProperties, updatePropertySettings } from '../repos/properties';
import { Button, EmptyState, Loading, Row, Screen, ScreenHeader, Section, StatusChip } from '../ui/components';
import { Icon } from '../ui/Icon';
import { colors, space } from '../ui/theme';

export function PropertiesScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { data } = useLocalData((s) => listAllProperties(s.db));
  const { refreshing, onRefresh } = useManualRefresh();
  const [restoring, setRestoring] = useState<Set<string>>(new Set());
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
        if (restoring.has(id)) return;
        setRestoring((prev) => new Set(prev).add(id));
        try {
          await updatePropertySettings(session.repo, id, { is_active: 1 });
          session.afterWrite();
        } catch {
          Alert.alert(t('common.saveFailed'));
        } finally {
          setRestoring((prev) => { const next = new Set(prev); next.delete(id); return next; });
        }
      },
    },
  ]);

  if (data === undefined) return <Loading />;
  return (
    <Screen
      header={
        <ScreenHeader
          title={t('properties.title')}
          showBack={navigation.canGoBack()}
        />
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {data.length === 0 ? (
        <EmptyState
          icon="business-outline"
          message={session.syncStatus.lastSyncedAt ? t('properties.empty') : t('properties.waitingForSync')}
        />
      ) : null}

      <View style={styles.list}>
        {active.map((p) => {
          const isSelected = p.id === session.propertyId;
          return (
            <Row
              key={p.id}
              title={p.name}
              subtitle={p.address ?? undefined}
              selected={isSelected}
              left={<Icon name="business-outline" size={24} color={isSelected ? colors.primaryDark : colors.muted} />}
              right={isSelected ? <StatusChip label={t('properties.active')} tone="primary" /> : undefined}
              onPress={() => void choose(p.id)}
              testID={`property-${p.id}`}
            />
          );
        })}
      </View>

      <Button
        title={t('properties.add')}
        onPress={() => navigation.navigate('PropertyForm')}
        testID="add-property"
      />

      {archived.length > 0 ? (
        <Section title={t('properties.archived')}>
          {archived.map((p) => (
            <Row
              key={p.id}
              title={p.name}
              left={<Icon name="business-outline" size={22} color={colors.off} />}
              right={
                <Button
                  kind="secondary"
                  title={t('properties.restore')}
                  onPress={() => restore(p.id)}
                  loading={restoring.has(p.id)}
                  testID={`restore-${p.id}`}
                />
              }
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.xs,
  },
});
