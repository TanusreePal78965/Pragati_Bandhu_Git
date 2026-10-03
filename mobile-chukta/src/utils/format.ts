import type { ExplanationLine } from '../domain/types';
import { formatRupees } from './money';

export type Translate = (key: string, params?: Record<string, unknown>) => string;

const pad = (n: number) => n.toString().padStart(2, '0');
const MONEY_PARAMS = new Set(['rate', 'base', 'perDay', 'amount']);

/** "2026-09-07" → "7 Sep 2026" in the current language (month names come from i18n, never Intl). */
export function formatDate(date: string, t: Translate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${t(`months.short.m${m}`)} ${y}`;
}

/** "2026-09" → "September 2026". */
export function formatMonth(month: string, t: Translate): string {
  const [y, m] = month.split('-').map(Number);
  return `${t(`months.long.m${m}`)} ${y}`;
}

export function weekdayName(n: number | null, t: Translate): string {
  return n === null ? t('weekdays.none') : t(`weekdays.d${n}`);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function explanationText(line: ExplanationLine, t: Translate): string {
  const params: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(line.params)) {
    params[k] = MONEY_PARAMS.has(k) && typeof v === 'number' ? formatRupees(v) : k === 'month' && typeof v === 'string' ? formatMonth(v, t) : v;
  }
  return t(line.key, params);
}
