import en from '../i18n/en.json';
import { explanationText, formatDate, formatMonth, formatTime, weekdayName, type Translate } from '../utils/format';

// Minimal i18next-like translator over en.json so the tests check real strings.
const t: Translate = (key, params = {}) => {
  const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en);
  if (typeof raw !== 'string') throw new Error(`missing key ${key}`);
  return raw.replace(/\{\{(\w+)\}\}/g, (_, p) => String(params[p]));
};

test('dates and months come from i18n keys', () => {
  expect(formatDate('2026-09-07', t)).toBe('7 Sep 2026');
  expect(formatMonth('2026-02', t)).toBe('February 2026');
  expect(weekdayName(0, t)).toBe('Sun');
  expect(weekdayName(null, t)).toBe('None');
});

test('formatTime uses local clock parts', () => {
  const d = new Date(2026, 8, 7, 9, 5);
  expect(formatTime(d.toISOString())).toBe('09:05');
});

test('explanation lines format money params as rupees and the month by name', () => {
  expect(explanationText({ key: 'ledger.explain.daily', params: { days: 4.5, rate: 50000 } }, t)).toBe('4.5 days × ₹500');
  expect(explanationText({ key: 'ledger.explain.monthlyPartial',
    params: { month: '2026-09', base: 1000000, deductionDays: 1, perDay: 100000, divisor: 30, eligibleDays: 10 } }, t))
    .toBe('September 2026 (10 days): ₹10,000 − 1 days × ₹1,000');
});

test('Phase 2A explanation lines format amounts as rupees', () => {
  expect(explanationText({ key: 'ledger.explain.overtime', params: { hours: 2, amount: 18750 } }, t)).toBe('2 overtime hours: ₹187.50');
  expect(explanationText({ key: 'ledger.explain.deduction', params: { amount: 20000 } }, t)).toBe('Deduction: −₹200');
  expect(explanationText({ key: 'ledger.explain.daysOffPaid', params: { days: 1.5 } }, t)).toBe('1.5 days off (paid)');
});
