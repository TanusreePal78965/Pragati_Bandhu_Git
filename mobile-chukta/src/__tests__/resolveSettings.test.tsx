import { effectiveDaysOff, latestByDate } from '../domain/latest';
import { resolveSettings } from '../domain/settings';
import { property, worker } from './helpers/fixtures';
import type { DayOff } from '../domain/types';

const dayOff = (id: string, date: string, over: Partial<DayOff> = {}): DayOff => ({
  id, property_id: 'p1', date, name: 'H', kind: 'holiday', portion: 'full', pay_rule: 'by_basis', is_active: 1,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});

test('extra-pay settings come from the property unless the worker overrides them', () => {
  const p = property({ offday_multiplier: 1.5, ot_mode: 'fixed', ot_multiplier: 1, ot_rate_paise: 6000 });
  expect(resolveSettings(worker(), p)).toMatchObject({ offdayMultiplier: 1.5, otMode: 'fixed', otMultiplier: 1, otRatePaise: 6000 });
  const w = worker({ offday_multiplier: 2, ot_mode: 'multiplier', ot_multiplier: 1.5, ot_rate_paise: null });
  expect(resolveSettings(w, p)).toMatchObject({ offdayMultiplier: 2, otMode: 'multiplier', otMultiplier: 1.5, otRatePaise: 6000 });
});

test('defaults when nothing is set', () => {
  expect(resolveSettings(worker(), property())).toMatchObject({ offdayMultiplier: 1, otMode: 'multiplier', otMultiplier: 1, otRatePaise: null });
});

test('latestByDate keeps the newest row per date (created_at, then id)', () => {
  const rows = [
    dayOff('b', '2026-09-10', { created_at: '2026-09-10T09:00:00Z' }),
    dayOff('a', '2026-09-10', { created_at: '2026-09-10T11:00:00Z' }),
    dayOff('c', '2026-09-11', { created_at: '2026-09-11T10:00:00Z' }),
    dayOff('d', '2026-09-11', { created_at: '2026-09-11T10:00:00Z' }),
  ];
  const m = latestByDate(rows);
  expect([m.get('2026-09-10')?.id, m.get('2026-09-11')?.id]).toEqual(['a', 'd']);
});

test('effectiveDaysOff ignores deactivated rows, so an older active row can apply', () => {
  const rows = [
    dayOff('old', '2026-09-10', { name: 'Closure', kind: 'closure', created_at: '2026-09-10T08:00:00Z' }),
    dayOff('new', '2026-09-10', { is_active: 0, created_at: '2026-09-10T12:00:00Z' }),
  ];
  expect(effectiveDaysOff(rows).get('2026-09-10')?.id).toBe('old');
});
