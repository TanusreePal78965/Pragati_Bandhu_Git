import { useStackNav } from '../../app/routes';
import { useCurrentProperty, useSession } from '../../app/session';
import { useT } from '../../i18n/useT';
import { Row, Section } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { colors } from '../../ui/theme';

export function PropertySection() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { property } = useCurrentProperty();
  const fallback = session.identity.kind === 'staff' ? session.identity.propertyName : '—';

  return (
    <Section title={t('settings.property')}>
      <Row
        title={property?.name ?? fallback}
        subtitle={property?.address ?? undefined}
        left={<Icon name="business-outline" size={24} color={colors.primary} />}
      />
      {session.identity.kind === 'owner' ? (
        <>
          {property ? (
            <Row
              title={t('properties.edit')}
              onPress={() => navigation.navigate('PropertyForm', { propertyId: property.id })}
              testID="edit-property"
            />
          ) : null}
          <Row
            title={t('properties.switch')}
            onPress={() => navigation.navigate('Properties')}
            testID="switch-property"
          />
        </>
      ) : null}
    </Section>
  );
}
