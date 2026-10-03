import { addDays, compareDates, daysInMonth, weekday } from '../utils/dates';
import type { ResolvedSettings } from './types';

export type Period = { start: string; end: string };
type CycleSettings = Pick<ResolvedSettings, 'payCycle' | 'cycleEndWeekday'>;

/** The period that starts on `start` for this cycle (end is the month end or the next cycle-end weekday >= start). */
export function periodFrom(start: string, s: CycleSettings): Period {
  if (s.payCycle === 'monthly') {
    const [y, m] = start.split('-').map(Number);
    return { start, end: `${start.slice(0, 8)}${String(daysInMonth(y, m)).padStart(2, '0')}` };
  }
  const ahead = (s.cycleEndWeekday - weekday(start) + 7) % 7;
  return { start, end: addDays(start, ahead) };
}

/**
 * The next period to settle: starts the day after `lastSettledEnd`, end cut to leftDate.
 * With no settlement yet it catches up: it starts on joining and ends at the end of the latest period that ended before `today`
 * (or is the normal joining period when even that has not ended).
 */
export function nextPeriod(input: {
  joiningDate: string; leftDate: string | null; lastSettledEnd: string | null; settings: CycleSettings; today: string;
}): Period | null {
  const start = input.lastSettledEnd ? addDays(input.lastSettledEnd, 1) : input.joiningDate;
  if (input.leftDate && compareDates(start, input.leftDate) > 0) return null;
  let end = periodFrom(start, input.settings).end;
  if (!input.lastSettledEnd) {
    for (let i = 0; i < 1000 && !(input.leftDate && compareDates(end, input.leftDate) >= 0); i++) {
      const next = periodFrom(addDays(end, 1), input.settings).end;
      if (compareDates(next, input.today) >= 0) break;
      end = next;
    }
  }
  if (input.leftDate && compareDates(end, input.leftDate) > 0) return { start, end: input.leftDate };
  return { start, end };
}

/** True when the period can be settled on `today`: it has ended (today is after its end). */
export function isDue(period: Period, today: string): boolean {
  return compareDates(today, period.end) > 0;
}
