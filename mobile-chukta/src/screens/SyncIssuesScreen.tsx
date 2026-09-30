import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { Button, Card, Loading, Muted, Screen } from '../ui/components';
import { colors, space } from '../ui/theme';
import { discardDead, listDeadGroups, requeueDead, type DeadGroup } from '../sync/deadLetters';

export function SyncIssuesScreen() {
  const t = useT();
  const session = useSession();
  const { data, reload } = useLocalData((s) => listDeadGroups(s.db));

  async function retry(g: DeadGroup) {
    try {
      await requeueDead(session.db, g.seqs);
    } catch {
      Alert.alert(t('common.saveFailed'));
      return;
    }
    session.afterWrite();
    reload();
    session.runSync().catch(() => {});
  }

  const discard = (g: DeadGroup) => Alert.alert(t('syncIssues.discard'), t('syncIssues.discardConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('syncIssues.discard'),
      style: 'destructive',
      onPress: async () => {
        try {
          await discardDead(session.db, g.seqs);
        } catch {
          Alert.alert(t('common.saveFailed'));
          return;
        }
        session.afterWrite();
        reload();
      },
    },
  ]);

  if (!data) return <Loading />;
  return (
    <Screen>
      <Muted>{data.length ? t('syncIssues.explain') : t('syncIssues.empty')}</Muted>
      {data.map((g, i) => (
        <Card key={g.error}>
          <Text style={styles.error}>{g.error}</Text>
          <Muted>{`${t('syncIssues.count', { count: g.count })} · ${g.tables.map((tb) => t(`tables.${tb}`)).join(', ')}`}</Muted>
          <View style={styles.actions}>
            <View style={styles.action}><Button title={t('syncIssues.retry')} onPress={() => void retry(g)} testID={`retry-${i}`} /></View>
            <View style={styles.action}><Button kind="danger" title={t('syncIssues.discard')} onPress={() => discard(g)} testID={`discard-${i}`} /></View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 14, color: colors.text },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
