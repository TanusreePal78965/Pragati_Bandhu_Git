import { activeMoneyRows, effectiveAttendance } from '../domain/attendance';
import type { AttendanceEntry } from '../domain/types';

const e = (id: string, date: string, status: AttendanceEntry['status'], created_at: string, hours: number | null = null): AttendanceEntry => ({
  id, property_id: 'p', worker_id: 'w', date, status, hours, note: null,
  created_by: 'u', created_by_role: 'owner', created_at, server_updated_at: null,
});

test('latest (created_at, id) wins per date', () => {
  const m = effectiveAttendance([
    e('a', '2026-09-02', 'absent', '2026-09-02T10:00:00Z'),
    e('b', '2026-09-02', 'present', '2026-09-02T11:00:00Z'),
    e('c', '2026-09-03', 'half_day', '2026-09-03T09:00:00Z'),
    e('z', '2026-09-03', 'absent', '2026-09-03T09:00:00Z'),
  ]);
  expect(m.get('2026-09-02')?.status).toBe('present');
  expect(m.get('2026-09-03')?.id).toBe('z'); // same created_at → greater id wins
});

test('activeMoneyRows drops voids and voided rows', () => {
  const rows = [
    { id: '1', voids_id: null }, { id: '2', voids_id: null }, { id: '3', voids_id: '2' },
  ];
  expect(activeMoneyRows(rows).map((r) => r.id)).toEqual(['1']);
});
