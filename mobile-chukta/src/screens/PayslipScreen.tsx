import { useRoute, type RouteProp } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { RootStackParamList } from '../app/routes';
import { sessionToday, useLocalData, useManualRefresh, useSession } from '../app/session';
import { activeSettlements, lastSettledEnd } from '../domain/lock';
import type { Property, Settlement, Worker } from '../domain/types';
import { useT } from '../i18n/useT';
import { getProperty } from '../repos/properties';
import { listSettlements, parseSettlement, unlockSettlement } from '../repos/settlements';
import { getWorker } from '../repos/workers';
import { Button, EmptyState, ErrorText, Loading, Muted, Screen, ScreenHeader, StatusChip } from '../ui/components';
import { colors, space } from '../ui/theme';
import { formatDate } from '../utils/format';
import { formatRupees } from '../utils/money';
import { formatPeriod } from '../view/dueList';
import { buildPayslipView, type PayslipLine } from '../view/payslip';

// Opaque white so the shared PNG is not transparent (do not use the themed surface colour here).
const CAPTURE_BG = '#FFFFFF';

type Loaded = { row: Settlement; voided: boolean; canUnlock: boolean; newerExists: boolean; worker: Worker | null; property: Property | null } | null;

export function PayslipScreen() {
  const t = useT();
  const session = useSession();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Payslip'>>();
  const today = sessionToday(session);
  const { refreshing, onRefresh } = useManualRefresh();
  const cardRef = useRef<View>(null);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = session.identity.kind === 'owner';
  const { data, reload } = useLocalData<Loaded>(async (s) => {
    const raw = await s.db.getFirstAsync<Record<string, unknown>>('select * from settlements where id = ?', [params.settlementId]);
    if (!raw) return null;
    const row = parseSettlement(raw);
    const all = await listSettlements(s.db, row.worker_id);
    const voided = !activeSettlements(all).some((x) => x.id === row.id);
    const isLast = lastSettledEnd(all, row.worker_id) === row.period_end;
    const worker = await getWorker(s.db, row.worker_id);
    const property = await getProperty(s.db, row.property_id);
    return { row, voided, canUnlock: !voided && isLast, newerExists: !voided && !isLast, worker, property };
  }, [params.settlementId]);

  const header = <ScreenHeader title={t('payslip.title')} showBack />;
  if (data === undefined) return <Loading />;
  if (!data) {
    return (
      <Screen header={header}>
        <EmptyState icon="wallet-outline" message={t('payslip.none')} />
      </Screen>
    );
  }

  const view = buildPayslipView(data.row, data.voided);

  async function share() {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('payslip.title') });
      else Alert.alert(t('common.saveFailed'));
    } catch {
      Alert.alert(t('common.saveFailed'));
    } finally {
      busy.current = false;
    }
  }

  function unlock() {
    Alert.alert(t('payslip.unlockTitle'), t('payslip.unlockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('payslip.unlock'), style: 'destructive', onPress: () => void doUnlock() },
    ]);
  }

  async function doUnlock() {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await unlockSettlement(session.repo, params.settlementId, today);
      session.afterWrite();
      reload();
    } catch {
      setError('common.saveFailed');
    } finally {
      busy.current = false;
    }
  }

  const line = (l: PayslipLine, i: number) => (
    <View key={`${l.key}-${i}`} style={styles.line}>
      <Text style={styles.lineText}>{t(l.key, l.params)}</Text>
      {l.amountPaise !== undefined ? (
        <Text style={styles.amount}>{`${l.negative ? '−' : ''}${formatRupees(l.amountPaise)}`}</Text>
      ) : null}
    </View>
  );
  const group = (title: string, lines: PayslipLine[]) =>
    lines.length ? (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{title}</Text>
        {lines.map(line)}
      </View>
    ) : null;

  return (
    <Screen header={header} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View ref={cardRef} collapsable={false} testID="payslip-card" style={styles.card}>
        {data.property ? <Text style={styles.shop}>{data.property.name}</Text> : null}
        <View style={styles.line}>
          <Text style={styles.label}>{t('payslip.worker')}</Text>
          <Text style={styles.value}>{data.worker?.name ?? ''}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.label}>{t('payslip.period')}</Text>
          <Text style={styles.value}>{formatPeriod({ start: data.row.period_start, end: data.row.period_end }, t)}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.label}>{t('payslip.rate')}</Text>
          <Text style={styles.value}>{`${t(view.header.rateKey)} ${formatRupees(view.header.ratePaise)}`}</Text>
        </View>
        {group(t('payslip.attendance'), view.attendance)}
        {group(t('payslip.earnings'), view.earnings)}
        {group(t('payslip.deductions'), view.deductions)}
        <View style={styles.group}>{view.balance.map(line)}</View>
        <View style={styles.group}>
          <Text style={styles.carry}>{t(view.carry.key, { amount: formatRupees(view.carry.amountPaise ?? 0) })}</Text>
          <Text style={styles.lineText}>{t(view.advanceLeft.key, { amount: formatRupees(view.advanceLeft.amountPaise ?? 0) })}</Text>
        </View>
        <Text style={styles.settledOn}>{t('payslip.settledOn', { date: formatDate(view.header.settledOn, t) })}</Text>
        {view.voided ? <StatusChip label={t('payslip.unlocked')} tone="danger" /> : null}
      </View>

      <ErrorText>{error ? t(error) : null}</ErrorText>
      <Button title={t('payslip.share')} onPress={() => void share()} testID="payslip-share" />
      {isOwner && data.canUnlock ? (
        <Button title={t('payslip.unlock')} kind="secondary" onPress={unlock} testID="payslip-unlock" />
      ) : null}
      {isOwner && data.newerExists ? <Muted>{t('payslip.unlockNewerFirst')}</Muted> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: CAPTURE_BG, padding: space.lg, gap: space.sm, borderRadius: 12 },
  shop: { fontSize: 18, fontWeight: '800', color: colors.text },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  lineText: { fontSize: 14, color: colors.text, flexShrink: 1 },
  label: { fontSize: 14, color: colors.muted },
  value: { fontSize: 14, fontWeight: '700', color: colors.text },
  amount: { fontSize: 14, fontWeight: '700', color: colors.text },
  group: { gap: space.xs, marginTop: space.sm },
  groupTitle: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  carry: { fontSize: 15, fontWeight: '800', color: colors.text },
  settledOn: { fontSize: 13, color: colors.muted, marginTop: space.sm },
});
