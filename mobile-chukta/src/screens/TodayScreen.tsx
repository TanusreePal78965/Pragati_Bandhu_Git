import { useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { sessionToday, useLocalData, useSession } from '../app/session';
import { effectiveAttendance } from '../domain/attendance';
import type { AttendanceStatus, Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { listAttendanceForDate, markAttendance } from '../repos/attendance';
import { listWorkers } from '../repos/workers';
import { Button, Card, ErrorText, Field, Loading, Muted, Row, Screen, Segmented } from '../ui/components';
import { DateField } from '../ui/DateField';
import { RequireProperty } from '../ui/RequireProperty';
import { space } from '../ui/theme';
import { buildTodayRows, type TodayRow } from '../view/today';

const DAY_STATUSES: AttendanceStatus[] = ['present', 'half_day', 'absent'];
const HOURS_STATUSES: AttendanceStatus[] = ['present', 'absent'];
const STATUS_KEY: Record<AttendanceStatus, string> = { present: 'today.present', half_day: 'today.halfDay', absent: 'today.absent', hours: 'today.hours' };

function parseHours(s: string): number | null {
  const v = s.trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 24 ? n : null;
}

export function TodayScreen() {
  return <RequireProperty>{(p) => <TodayBody property={p} />}</RequireProperty>;
}

function TodayBody({ property }: { property: Property }) {
  const t = useT();
  const session = useSession();
  const today = sessionToday(session);
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: rows } = useLocalData(
    async (s) => buildTodayRows(await listWorkers(s.db, property.id, true), property, await listAttendanceForDate(s.db, property.id, date), date),
    [property, date],
  );
  const writing = useRef(false);

  async function mark(workerIds: string[], status: AttendanceStatus, hours?: number) {
    if (writing.current) return;
    writing.current = true;
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
      let wrote = false;
      for (const id of workerIds) {
        const row = rows?.find((r) => r.worker.id === id);
        if (!row || row.isOff) continue;
        const list = byWorker.get(id);
        const cur = list ? effectiveAttendance(list).get(date) ?? null : null;
        const same = cur ? cur.status === status && (status !== 'hours' || cur.hours === hours) : status === 'present';
        if (same) continue;
        await markAttendance(session.repo, { propertyId: property.id, workerId: id, date, status, hours });
        wrote = true;
      }
      setSelected(new Set());
      if (wrote) session.afterWrite();
    } finally {
      writing.current = false;
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  if (!rows) return <Loading />;
  return (
    <Screen refreshControl={<RefreshControl refreshing={session.syncStatus.running} onRefresh={() => void session.runSync()} />}>
      <DateField label={t('today.title')} value={date} max={today} onChange={(d) => { setDate(d); setSelected(new Set()); }} testID="today-date" />
      <Muted>{t('today.hint')}</Muted>
      {rows.length === 0 ? <Muted>{t('today.noWorkers')}</Muted> : <Muted>{t('today.selectHint')}</Muted>}
      {selected.size > 0 ? (
        <Card>
          <Muted>{t('today.selected', { count: selected.size })}</Muted>
          <Segmented options={DAY_STATUSES.map((st) => ({ value: st, label: t(STATUS_KEY[st]) }))} value={null}
            onChange={(st) => void mark([...selected], st)} testIDPrefix="bulk" />
          <Button kind="secondary" title={t('today.clearSelection')} onPress={() => setSelected(new Set())} testID="bulk-clear" />
        </Card>
      ) : null}
      {rows.map((row) => (
        <AttendanceRow key={`${date}:${row.worker.id}`} row={row} selected={selected.has(row.worker.id)} onToggle={() => toggle(row.worker.id)}
          onMark={(st, h) => void mark([row.worker.id], st, h)} />
      ))}
    </Screen>
  );
}

function AttendanceRow({ row, selected, onToggle, onMark }: {
  row: TodayRow; selected: boolean; onToggle: () => void; onMark: (status: AttendanceStatus, hours?: number) => void;
}) {
  const t = useT();
  const id = row.worker.id;
  const [hoursText, setHoursText] = useState(row.entry?.status === 'hours' ? String(row.entry.hours) : '');
  const [hoursError, setHoursError] = useState(false);
  // Resyncs from the entry rather than relying only on the initializer above: `rows` in
  // TodayBody keeps its previous (wrong-date) value until the reload for a new `date`
  // resolves, so the key-based remount below can still mount with a stale entry for one
  // render. This effect corrects the field once the real entry for the current row arrives.
  useEffect(() => {
    setHoursText(row.entry?.status === 'hours' ? String(row.entry.hours) : '');
    setHoursError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.entry?.status, row.entry?.hours]);
  const current: AttendanceStatus | null = row.entry ? row.entry.status : 'present';
  const hoursMode = row.settings.attendanceMode === 'hours';
  const subtitle = row.isOff
    ? t('today.weeklyOff')
    : row.entry?.status === 'hours' ? t('today.hoursValue', { hours: row.entry.hours }) : undefined;

  const saveHours = () => {
    const h = parseHours(hoursText);
    setHoursError(h === null);
    if (h !== null) onMark('hours', h);
  };

  return (
    <Card>
      <Row title={row.worker.name} subtitle={subtitle} selected={selected} onLongPress={row.isOff ? undefined : onToggle}
        onPress={selected ? onToggle : undefined} testID={`row-${id}`} />
      {row.isOff ? null : (
        <>
          <Segmented options={(hoursMode ? HOURS_STATUSES : DAY_STATUSES).map((st) => ({ value: st, label: t(STATUS_KEY[st]) }))}
            value={current === 'hours' ? null : current} onChange={(st) => onMark(st)} testIDPrefix={`status-${id}`} />
          {hoursMode ? (
            <View style={styles.hours}>
              <View style={styles.hoursInput}>
                <Field label={t('today.hoursPrompt')} value={hoursText} onChangeText={setHoursText} keyboardType="decimal-pad"
                  placeholder={String(row.settings.shiftHours)} testID={`hours-${id}`} />
              </View>
              <Button kind="secondary" title={t('common.save')} onPress={saveHours} testID={`hours-save-${id}`} />
            </View>
          ) : null}
          <ErrorText>{hoursError ? t('today.hoursInvalid') : null}</ErrorText>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hours: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  hoursInput: { flex: 1 },
});
