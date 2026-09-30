import { useState } from 'react';
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
  // Keyed by the group's first seq (unique per group) so a double-tap on one row's button is
  // ignored while it's in flight, without disabling every other row's buttons too.
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const keyOf = (g: DeadGroup) => g.seqs[0];
  const setRowBusy = (k: number, on: boolean) => setBusy((prev) => {
    const next = new Set(prev);
    if (on) next.add(k); else next.delete(k);
    return next;
  });

  async function retry(g: DeadGroup) {
    const k = keyOf(g);
    if (busy.has(k)) return;
    setRowBusy(k, true);
    try {
      await requeueDead(session.db, g.seqs);
    } catch {
      Alert.alert(t('common.saveFailed'));
      setRowBusy(k, false);
      return;
    }
    session.afterWrite();
    reload();
    session.runSync().catch(() => {});
    setRowBusy(k, false);
  }

  const discard = (g: DeadGroup) => {
    const k = keyOf(g);
    if (busy.has(k)) return;
    Alert.alert(t('syncIssues.discard'), t('syncIssues.discardConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('syncIssues.discard'),
        style: 'destructive',
        onPress: async () => {
          setRowBusy(k, true);
          try {
            await discardDead(session.db, g.seqs);
          } catch {
            Alert.alert(t('common.saveFailed'));
            setRowBusy(k, false);
            return;
          }
          session.afterWrite();
          reload();
          setRowBusy(k, false);
        },
      },
    ]);
  };

  if (!data) return <Loading />;
  return (
    <Screen>
      <Muted>{data.length ? t('syncIssues.explain') : t('syncIssues.empty')}</Muted>
      {data.map((g, i) => {
        const rowBusy = busy.has(keyOf(g));
        return (
          <Card key={g.error}>
            <Text style={styles.error}>{g.error}</Text>
            <Muted>{`${t('syncIssues.count', { count: g.count })} · ${g.tables.map((tb) => t(`tables.${tb}`)).join(', ')}`}</Muted>
            <View style={styles.actions}>
              <View style={styles.action}><Button title={t('syncIssues.retry')} onPress={() => void retry(g)} loading={rowBusy} testID={`retry-${i}`} /></View>
              <View style={styles.action}><Button kind="danger" title={t('syncIssues.discard')} onPress={() => discard(g)} loading={rowBusy} testID={`discard-${i}`} /></View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 14, color: colors.text },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
