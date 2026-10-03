import type { PayCycle } from '../domain/types';
import { useT } from '../i18n/useT';
import { Label, Section, Segmented, WeekdayPicker } from './components';

export type PayCycleValue = { payCycle: PayCycle | null; cycleEndWeekday: number | null };

const INHERIT = 'inherit' as const;
type Opt = PayCycle | typeof INHERIT;
const CYCLES: { value: PayCycle; key: string }[] = [
  { value: 'by_basis', key: 'payCycle.byBasis' },
  { value: 'weekly', key: 'payCycle.weekly' },
  { value: 'monthly', key: 'payCycle.monthly' },
];

/** "Pay cycle" settings. With `allowInherit`, a "Property setting" option stores null (worker form). */
export function PayCycleFields({ value, onChange, allowInherit, testIDPrefix }: {
  value: PayCycleValue; onChange: (patch: Partial<PayCycleValue>) => void; allowInherit: boolean; testIDPrefix: string;
}) {
  const t = useT();
  const options: { value: Opt; label: string }[] = [
    ...(allowInherit ? [{ value: INHERIT as Opt, label: t('extraPay.useProperty') }] : []),
    ...CYCLES.map((c) => ({ value: c.value as Opt, label: t(c.key) })),
  ];
  return (
    <Section title={t('payCycle.title')}>
      <Label>{t('payCycle.cycle')}</Label>
      <Segmented<Opt> options={options} value={value.payCycle ?? (allowInherit ? INHERIT : null)}
        onChange={(v) => onChange({ payCycle: v === INHERIT ? null : v })} testIDPrefix={testIDPrefix} />
      {/* Only a monthly cycle ignores the week end; "as per pay type" or the property setting may still be weekly. */}
      {value.payCycle !== 'monthly' ? (
        <>
          <Label>{t('payCycle.weekEnds')}</Label>
          <WeekdayPicker value={value.cycleEndWeekday} onChange={(cycleEndWeekday) => onChange({ cycleEndWeekday })}
            noneLabel={allowInherit ? t('extraPay.useProperty') : false} testIDPrefix={`${testIDPrefix}-end`} />
        </>
      ) : null}
    </Section>
  );
}
