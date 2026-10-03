import { useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import { sessionToday, useLocalData, useManualRefresh, useSession } from '../app/session';
import { effectiveAttendance } from '../domain/attendance';
import type { AttendanceStatus, DayOffPortion, Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { listAttendanceForDate, markAttendance } from '../repos/attendance';
import { addDayOff, listDaysOff } from '../repos/daysOff';
import { addOvertime, listOvertimeForDate } from '../repos/overtime';
import { listWorkers } from '../repos/workers';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Label,
  Loading,
  Muted,
  Row,
  Screen,
  ScreenHeader,
  Segmented,
  StatusChip,
  type StatusTone,
} from '../ui/components';
import { DateField } from '../ui/DateField';
import { RequireProperty } from '../ui/RequireProperty';
import { colors, space } from '../ui/theme';
import { paiseToInput, parseOptionalAmount, parseOvertimeHours } from '../view/forms';
import { buildTodayRows, effectiveDayOffFor, type TodayRow } from '../view/today';

const DAY_STATUSES: AttendanceStatus[] = ['present', 'half_day', 'absent'];
const HOURS_STATUSES: AttendanceStatus[] = ['present', 'absent'];
const STATUS_KEY: Record<AttendanceStatus, string> = {
  present: 'today.present',
  half_day: 'today.halfDay',
  absent: 'today.absent',
  hours: 'today.hours',
};
/** On a full day off the same statuses read as work on that day. */
const OFF_STATUS_KEY: Record<AttendanceStatus, string> = {
  present: 'today.worked',
  half_day: 'today.workedHalf',
  absent: 'today.notWorked',
  hours: 'today.hours',
};

const STATUS_TONE: Record<AttendanceStatus, StatusTone> = {
  present: 'success',
  half_day: 'warning',
  absent: 'danger',
  hours: 'info',
};

const CLOSURE_REASONS = ['bandh', 'rain', 'powerCut'] as const;

function parseHours(s: string): number | null {
  const v = s.trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 24 ? n : null;
}

/** An owner's optional custom amount: '' and 0 mean "not set" (0 is never a meaningful custom pay); invalid gives undefined. */
function parseCustomAmount(s: string): number | null | undefined {
  const p = parseOptionalAmount(s);
  return p === 0 ? null : p;
}

export function TodayScreen() {
  return <RequireProperty>{(p) => <TodayBody property={p} />}</RequireProperty>;
}

function TodayBody({ property }: { property: Property }) {
  const t = useT();
  const session = useSession();
  const today = sessionToday(session);
  const { refreshing, onRefresh } = useManualRefresh();
  // Only a date the user picked is stored; otherwise follow `today`, so a tab left open
  // overnight (bottom tabs never unmount) moves to the new day instead of writing to yesterday.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setPicked(null);
    setSelected(new Set());
  }, [today]);
  const { data, reload } = useLocalData(async (s) => {
    const daysOff = await listDaysOff(s.db, property.id);
    const rows = buildTodayRows(
      await listWorkers(s.db, property.id, true), property, await listAttendanceForDate(s.db, property.id, date), date,
      daysOff, await listOvertimeForDate(s.db, property.id, date),
    );
    return { rows, dayOff: effectiveDayOffFor(daysOff, date) };
  }, [property, date]);
  const rows = data?.rows;
  const writing = useRef(false);
  const isOwner = session.identity.kind === 'owner';

  /**
   * `customAmountPaise` undefined means "not given" (staff, or a working day): the dedupe ignores it.
   * `bulk` marks skip full days off, where a status means work on a day off.
   */
  async function mark(workerIds: string[], status: AttendanceStatus, hours?: number, customAmountPaise?: number | null, bulk = false) {
    if (writing.current) return;
    writing.current = true;
    let wrote = false;
    try {
      // Read fresh from SQLite (not the `rows` closure) so a same-status write during a
      // still-in-flight write, or a stale render, can't slip past the dedupe check.
      const fresh = await listAttendanceForDate(session.db, property.id, date);
      const byWorker = new Map<string, typeof fresh>();
      for (const e of fresh) {
        const list = byWorker.get(e.worker_id) ?? [];
        list.push(e);
        byWorker.set(e.worker_id, list);
      }
      for (const id of workerIds) {
        const row = rows?.find((r) => r.worker.id === id);
        if (!row || (bulk && row.isOff)) continue;
        const list = byWorker.get(id);
        const cur = list ? effectiveAttendance(list).get(date) ?? null : null;
        const same = cur
          ? cur.status === status && (status !== 'hours' || cur.hours === hours)
            && (customAmountPaise === undefined || (cur.custom_amount_paise ?? null) === customAmountPaise)
          : status === (row.isOff ? 'absent' : 'present') && !customAmountPaise;
        if (same) continue;
        await markAttendance(session.repo, { propertyId: property.id, workerId: id, date, status, hours, customAmountPaise });
        wrote = true;
      }
      setSelected(new Set());
    } catch {
      Alert.alert(t('common.saveFailed'));
    } finally {
      writing.current = false;
      if (wrote) session.afterWrite();
    }
  }

  async function saveOvertime(workerId: string, hours: number, customAmountPaise: number | null) {
    await addOvertime(session.repo, { propertyId: property.id, workerId, date, hours, customAmountPaise });
    session.afterWrite();
    reload();
  }

  async function saveClosure(name: string, portion: DayOffPortion) {
    await addDayOff(session.repo, { propertyId: property.id, date, name, kind: 'closure', portion, payRule: 'by_basis' });
    session.afterWrite();
    reload();
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  if (!data || !rows) return <Loading />;
  const { dayOff } = data;
  return (
    <Screen
      header={<ScreenHeader title={t('tabs.today')} subtitle={property.name} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <DateField
        label={t('today.title')}
        value={date}
        max={today}
        onChange={(d) => { setPicked(d === today ? null : d); setSelected(new Set()); }}
        testID="today-date"
      />

      {dayOff ? (
        <Card testID="dayoff-banner" style={styles.selectionCard}>
          <View style={styles.chipRow}>
            <StatusChip
              label={t(dayOff.kind === 'closure' ? 'daysOff.closure' : 'daysOff.holiday')}
              tone={dayOff.kind === 'closure' ? 'warning' : 'info'}
            />
          </View>
          <Muted>{dayOff.portion === 'half' ? t('today.dayOffHalf', { name: dayOff.name }) : dayOff.name}</Muted>
        </Card>
      ) : (
        <ClosureCard key={date} onSave={saveClosure} />
      )}

      <Muted style={styles.hintText}>{t('today.hint')}</Muted>

      {rows.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={t('workers.emptyTitle')}
          message={t('today.noWorkers')}
        />
      ) : (
        <Muted>{t('today.selectHint')}</Muted>
      )}

      {selected.size > 0 ? (
        <Card style={styles.selectionCard}>
          <View style={styles.selectionHeader}>
            <StatusChip label={t('today.selected', { count: selected.size })} tone="primary" />
          </View>
          <Segmented
            options={DAY_STATUSES.map((st) => ({ value: st, label: t(STATUS_KEY[st]) }))}
            value={null}
            onChange={(st) => void mark([...selected], st, undefined, undefined, true)}
            testIDPrefix="bulk"
          />
          <Button
            kind="secondary"
            title={t('today.clearSelection')}
            onPress={() => setSelected(new Set())}
            testID="bulk-clear"
          />
        </Card>
      ) : null}

      <View style={styles.rowsList}>
        {rows.map((row) => (
          <AttendanceRow
            key={`${date}:${row.worker.id}`}
            row={row}
            isOwner={isOwner}
            selected={selected.has(row.worker.id)}
            onToggle={() => toggle(row.worker.id)}
            onMark={(st, h, c) => void mark([row.worker.id], st, h, c)}
            onOvertime={(h, c) => saveOvertime(row.worker.id, h, c)}
          />
        ))}
      </View>
    </Screen>
  );
}

/** "Shop closed today": an inline card that adds a closure (paid by basis) for the selected date. */
function ClosureCard({ onSave }: { onSave: (name: string, portion: DayOffPortion) => Promise<void> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [portion, setPortion] = useState<DayOffPortion>('full');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  if (!open) {
    return <Button kind="secondary" title={t('closure.button')} onPress={() => setOpen(true)} testID="closure-open" />;
  }

  const save = async () => {
    const name = reason.trim();
    setError(!name);
    if (!name || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      await onSave(name, portion);
      setOpen(false);
      setReason('');
    } catch {
      Alert.alert(t('common.saveFailed'));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <Card style={styles.selectionCard}>
      <Label>{t('closure.title')}</Label>
      <View style={styles.chipRow}>
        {CLOSURE_REASONS.map((k) => (
          <StatusChip
            key={k}
            label={t(`closure.${k}`)}
            tone="primary"
            onPress={() => { setReason(t(`closure.${k}`)); setError(false); }}
            testID={`closure-chip-${k}`}
          />
        ))}
      </View>
      <Field
        label={t('closure.reason')}
        value={reason}
        onChangeText={setReason}
        error={error ? t('closure.reasonRequired') : undefined}
        testID="closure-reason"
      />
      <Segmented<DayOffPortion>
        options={[{ value: 'full', label: t('daysOff.full') }, { value: 'half', label: t('daysOff.half') }]}
        value={portion}
        onChange={setPortion}
        testIDPrefix="closure-portion"
      />
      <Button title={t('closure.confirm')} onPress={() => void save()} disabled={busy} testID="closure-save" />
      <Button kind="secondary" title={t('common.cancel')} onPress={() => setOpen(false)} disabled={busy} testID="closure-cancel" />
    </Card>
  );
}

function AttendanceRow({
  row,
  isOwner,
  selected,
  onToggle,
  onMark,
  onOvertime,
}: {
  row: TodayRow;
  isOwner: boolean;
  selected: boolean;
  onToggle: () => void;
  onMark: (status: AttendanceStatus, hours?: number, customAmountPaise?: number | null) => void;
  onOvertime: (hours: number, customAmountPaise: number | null) => Promise<void>;
}) {
  const t = useT();
  const id = row.worker.id;
  const [hoursText, setHoursText] = useState(row.entry?.status === 'hours' ? String(row.entry.hours) : '');
  const [hoursError, setHoursError] = useState(false);
  const entryAmount = row.entry?.custom_amount_paise ?? null;
  const [offdayAmount, setOffdayAmount] = useState(entryAmount !== null ? paiseToInput(entryAmount) : '');
  const [amountError, setAmountError] = useState(false);
  const [otOpen, setOtOpen] = useState(false);
  const otText0 = row.overtime ? String(row.overtime.hours) : '';
  const otAmount0 = row.overtime?.custom_amount_paise != null ? paiseToInput(row.overtime.custom_amount_paise) : '';
  const [otText, setOtText] = useState(otText0);
  const [otAmount, setOtAmount] = useState(otAmount0);
  const [otError, setOtError] = useState(false);
  const [otAmountError, setOtAmountError] = useState(false);
  const [otBusy, setOtBusy] = useState(false);
  const otSaving = useRef(false);

  useEffect(() => {
    setHoursText(row.entry?.status === 'hours' ? String(row.entry.hours) : '');
    setHoursError(false);
  }, [row.entry?.status, row.entry?.hours]);

  useEffect(() => {
    setOffdayAmount(entryAmount !== null ? paiseToInput(entryAmount) : '');
    setAmountError(false);
  }, [entryAmount]);

  // Keep the overtime fields on the latest entry, so editing the hours doesn't drop an owner's custom amount.
  useEffect(() => {
    setOtText(otText0);
    setOtAmount(otAmount0);
  }, [otText0, otAmount0]);

  const labelKey = (st: AttendanceStatus) => (row.isOff ? OFF_STATUS_KEY[st] : STATUS_KEY[st]);
  const current: AttendanceStatus = row.entry ? row.entry.status : row.isOff ? 'absent' : 'present';
  const hoursMode = row.settings.attendanceMode === 'hours';
  const dayOff = row.dayClass.kind === 'off' ? row.dayClass.dayOff : null;
  // Full off because of the weekly off: a half-day holiday or closure there doesn't rename the day.
  const weeklyWithHalf = row.dayClass.kind === 'off' && row.dayClass.weekly && dayOff?.portion === 'half';
  const subtitle = row.isOff
    ? dayOff && !weeklyWithHalf ? dayOff.name : t('today.weeklyOff')
    : row.entry?.status === 'hours'
      ? t('today.hoursValue', { hours: row.entry.hours })
      : dayOff ? t('today.dayOffHalf', { name: dayOff.name }) : undefined;
  const otHours = row.overtime ? row.overtime.hours : row.autoOtHours;
  const otLabel = row.overtime
    ? t('today.overtimeValue', { hours: row.overtime.hours })
    : t('today.inclOvertime', { hours: row.autoOtHours });

  /** On a full day off an owner's custom amount goes with any status that means work; invalid input blocks the write. */
  const markWith = (st: AttendanceStatus, hours?: number) => {
    if (!(row.isOff && isOwner)) return onMark(st, hours);
    const amount = st === 'absent' ? null : parseCustomAmount(offdayAmount);
    setAmountError(amount === undefined);
    if (amount !== undefined) onMark(st, hours, amount);
  };

  const saveHours = () => {
    const h = parseHours(hoursText);
    setHoursError(h === null);
    if (h !== null) markWith('hours', h);
  };

  const saveOvertime = async () => {
    const h = parseOvertimeHours(otText);
    const amount = isOwner ? parseCustomAmount(otAmount) : null;
    setOtError(h === null);
    setOtAmountError(amount === undefined);
    if (h === null || amount === undefined || otSaving.current) return;
    otSaving.current = true;
    setOtBusy(true);
    try {
      await onOvertime(h, amount);
      setOtOpen(false);
    } catch {
      Alert.alert(t('common.saveFailed'));
    } finally {
      otSaving.current = false;
      setOtBusy(false);
    }
  };

  const statusLabel = current === 'hours'
    ? t('today.hoursValue', { hours: row.entry?.hours ?? 0 })
    : t(labelKey(current));

  return (
    <Card style={styles.workerCard}>
      <Row
        title={row.worker.name}
        subtitle={subtitle}
        selected={selected}
        left={<Avatar name={row.worker.name} id={id} size={40} />}
        right={
          <View style={styles.chips}>
            <StatusChip label={statusLabel} tone={STATUS_TONE[current]} />
            {otHours > 0 ? <StatusChip label={otLabel} tone="info" testID={`ot-chip-${id}`} /> : null}
          </View>
        }
        onLongPress={row.isOff ? undefined : onToggle}
        onPress={selected ? onToggle : undefined}
        testID={`row-${id}`}
      />
      {row.isOff && isOwner ? (
        <Field
          label={t('today.customAmount')}
          value={offdayAmount}
          onChangeText={setOffdayAmount}
          keyboardType="decimal-pad"
          error={amountError ? t('today.customAmountInvalid') : undefined}
          testID={`offday-amount-${id}`}
        />
      ) : null}
      <Segmented
        options={(hoursMode ? HOURS_STATUSES : DAY_STATUSES).map((st) => ({ value: st, label: t(labelKey(st)) }))}
        value={current === 'hours' ? null : current}
        onChange={(st) => markWith(st)}
        testIDPrefix={`status-${id}`}
      />
      {hoursMode ? (
        <View style={styles.hours}>
          <View style={styles.hoursInput}>
            <Field
              label={t('today.hoursPrompt')}
              value={hoursText}
              onChangeText={setHoursText}
              keyboardType="decimal-pad"
              placeholder={String(row.settings.shiftHours)}
              testID={`hours-${id}`}
            />
          </View>
          <Button kind="secondary" title={t('common.save')} onPress={saveHours} testID={`hours-save-${id}`} />
        </View>
      ) : null}
      <ErrorText>{hoursError ? t('today.hoursInvalid') : null}</ErrorText>
      {otOpen ? (
        <View style={styles.overtime}>
          <Field
            label={t('today.overtimeHours')}
            value={otText}
            onChangeText={setOtText}
            keyboardType="decimal-pad"
            error={otError ? t('today.overtimeInvalid') : undefined}
            testID={`ot-hours-${id}`}
          />
          {isOwner ? (
            <Field
              label={t('today.customAmount')}
              value={otAmount}
              onChangeText={setOtAmount}
              keyboardType="decimal-pad"
              error={otAmountError ? t('today.customAmountInvalid') : undefined}
              testID={`ot-amount-${id}`}
            />
          ) : null}
          <Button kind="secondary" title={t('common.save')} onPress={() => void saveOvertime()} disabled={otBusy} testID={`ot-save-${id}`} />
        </View>
      ) : (
        <Button kind="secondary" title={t('today.overtime')} onPress={() => setOtOpen(true)} testID={`ot-open-${id}`} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hintText: {
    color: colors.muted,
  },
  selectionCard: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    gap: space.sm,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowsList: {
    gap: space.sm,
  },
  workerCard: {
    gap: space.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chips: { alignItems: 'flex-end', gap: space.xs },
  hours: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  hoursInput: { flex: 1 },
  overtime: { gap: space.sm },
});
