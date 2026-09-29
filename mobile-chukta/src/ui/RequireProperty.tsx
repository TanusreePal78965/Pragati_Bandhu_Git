import type { ReactNode } from 'react';
import { useStackNav } from '../app/routes';
import { useCurrentProperty, useSession } from '../app/session';
import type { Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { Button, Loading, Muted, Screen } from './components';

/** Renders children with the current property, or a prompt: the owner chooses one, staff wait for the first sync. */
export function RequireProperty({ children }: { children: (property: Property) => ReactNode }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { property, loading } = useCurrentProperty();
  if (property) return <>{children(property)}</>;
  if (loading) return <Loading />;
  const owner = session.identity.kind === 'owner';
  return (
    <Screen>
      <Muted>{owner ? t('properties.choose') : t('properties.waitingForSync')}</Muted>
      {owner ? <Button title={t('properties.switch')} onPress={() => navigation.navigate('Properties')} testID="choose-property" /> : null}
    </Screen>
  );
}
