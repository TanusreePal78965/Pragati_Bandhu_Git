import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useStackNav } from '../app/routes';
import { useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { Avatar, Button, Card, Muted, Row, Screen, ScreenHeader, Section, StatusChip } from '../ui/components';
import { colors, radius, shadows, space } from '../ui/theme';
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
    : syncStatus.lastSyncedAt
      ? t('settings.lastSync', { time: formatTime(syncStatus.lastSyncedAt) })
      : t('settings.neverSynced');

  return (
    <Screen header={<ScreenHeader title={t('tabs.settings')} />}>
      {/* Account Info Card */}
      <Card style={styles.accountCard}>
        <Avatar name={who} id={identity.userId} size={44} />
        <View style={styles.accountInfo}>
          <Text style={styles.accountTitle}>{who}</Text>
          <Muted>{t('settings.loggedInAs', { name: who })}</Muted>
        </View>
        <StatusChip
          label={t(identity.kind === 'owner' ? 'auth.login.owner' : 'auth.login.staff')}
          tone="primary"
        />
      </Card>

      <PropertySection />
      <StaffSection />

      {/* Sync Section */}
      <Section title={t('settings.sync')}>
        <View style={styles.syncHeaderRow}>
          <View style={styles.syncBadgeWrap}>
            {syncStatus.running ? (
              <StatusChip label={t('settings.syncing')} tone="warning" />
            ) : syncStatus.dead > 0 ? (
              <StatusChip label={t('settings.issuesChip', { count: syncStatus.dead })} tone="danger" />
            ) : syncStatus.pending > 0 ? (
              <StatusChip label={t('settings.pendingChip', { count: syncStatus.pending })} tone="warning" />
            ) : (
              <StatusChip label={t('settings.synced')} tone="success" />
            )}
          </View>
          <Muted testID="sync-line" style={styles.syncLineText}>{syncLine}</Muted>
        </View>

        {syncStatus.pending > 0 ? (
          <Muted>{t('settings.pending', { count: syncStatus.pending })}</Muted>
        ) : null}

        {syncStatus.dead > 0 ? (
          <Row
            title={t('settings.issues', { count: syncStatus.dead })}
            subtitle={t('settings.tapToResolve')}
            onPress={() => navigation.navigate('SyncIssues')}
            testID="sync-issues"
            right={<StatusChip label={t('settings.actionNeeded')} tone="danger" />}
          />
        ) : null}

        <Button
          kind="secondary"
          title={t('settings.syncNow')}
          onPress={() => void session.runSync()}
          loading={syncStatus.running}
          testID="sync-now"
        />
      </Section>

      {/* Language Section */}
      <Section title={t('settings.language')}>
        <Row
          title={t(`language.${i18n.language}`)}
          subtitle={t('settings.changeLanguage')}
          onPress={() => navigation.navigate('Language')}
          testID="language"
        />
      </Section>

      {/* Logout Action */}
      <Button
        kind="danger"
        title={t('settings.logout')}
        onPress={confirmLogout}
        testID="logout"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    gap: space.md,
  },
  accountInfo: {
    flex: 1,
  },
  accountTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  syncHeaderRow: {
    gap: space.xs,
    paddingVertical: space.xs,
  },
  syncBadgeWrap: {
    alignSelf: 'flex-start',
  },
  syncLineText: {
    marginTop: 2,
  },
});
