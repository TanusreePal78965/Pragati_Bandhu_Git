import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useStackNav } from '../app/routes';
import { useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { Button, Muted, Row, Screen, Section } from '../ui/components';
import { formatTime } from '../utils/format';
import { PropertySection } from './settings/PropertySection';
import { StaffSection } from './settings/StaffSection';

export function SettingsScreen() {
  const t = useT();
  const { i18n } = useTranslation();
  const session = useSession();
  const navigation = useStackNav();
  const { identity, syncStatus } = session;

  const confirmLogout = () => {
    if (syncStatus.pending === 0) {
      void session.logout();
      return;
    }
    Alert.alert(t('settings.logout'), t('settings.logoutConfirm', { count: syncStatus.pending }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: () => void session.logout() },
    ]);
  };
  const who = identity.kind === 'owner' ? t('settings.ownerAccount', { phone: identity.phone }) : identity.staffName;
  const syncLine = syncStatus.running
    ? t('settings.syncing')
    : syncStatus.lastSyncedAt ? t('settings.lastSync', { time: formatTime(syncStatus.lastSyncedAt) }) : t('settings.neverSynced');

  return (
    <Screen>
      <Muted>{t('settings.loggedInAs', { name: who })}</Muted>
      <PropertySection />
      <StaffSection />
      <Section title={t('settings.sync')}>
        <Muted testID="sync-line">{syncLine}</Muted>
        {syncStatus.pending > 0 ? <Muted>{t('settings.pending', { count: syncStatus.pending })}</Muted> : null}
        {syncStatus.dead > 0 ? (
          <Row title={t('settings.issues', { count: syncStatus.dead })} onPress={() => navigation.navigate('SyncIssues')} testID="sync-issues" />
        ) : null}
        <Button kind="secondary" title={t('settings.syncNow')} onPress={() => void session.runSync()} loading={syncStatus.running} testID="sync-now" />
      </Section>
      <Section title={t('settings.language')}>
        <Row title={t(`language.${i18n.language}`)} onPress={() => navigation.navigate('Language')} testID="language" />
      </Section>
      <Button kind="danger" title={t('settings.logout')} onPress={confirmLogout} testID="logout" />
    </Screen>
  );
}
