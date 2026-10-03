import type { OtMode } from '../domain/types';
import { useT } from '../i18n/useT';
import { MULTIPLIERS } from '../view/forms';
import { Field, Label, Section, Segmented } from './components';

export type ExtraPayValue = { offdayMultiplier: number | null; otMode: OtMode | null; otMultiplier: number | null; otRate: string };

const INHERIT = 'inherit' as const;
type Opt<T> = T | typeof INHERIT;

/** "Extra pay" settings. With `allowInherit`, a "Property setting" option stores null (worker form). */
export function ExtraPayFields({ value, onChange, allowInherit, errors, testIDPrefix }: {
  value: ExtraPayValue; onChange: (patch: Partial<ExtraPayValue>) => void; allowInherit: boolean;
  errors: Record<string, string>; testIDPrefix: string;
}) {
  const t = useT();
  const inherit = allowInherit ? [{ value: INHERIT, label: t('extraPay.useProperty') }] : [];
  const mult = [...inherit, ...MULTIPLIERS.map((m) => ({ value: m, label: `${m}×` }))] as { value: Opt<number>; label: string }[];
  const fromOpt = <T,>(v: Opt<T>): T | null => (v === INHERIT ? null : v);
  const toOpt = <T,>(v: T | null): Opt<T> => (v === null ? INHERIT : v);
  return (
    <Section title={t('extraPay.title')}>
      <Label>{t('extraPay.offdayMultiplier')}</Label>
      <Segmented<Opt<number>> options={mult} value={toOpt(value.offdayMultiplier)}
        onChange={(v) => onChange({ offdayMultiplier: fromOpt(v) })} testIDPrefix={`${testIDPrefix}-offday`} />
      <Label>{t('extraPay.otMode')}</Label>
      <Segmented<Opt<OtMode>>
        options={[...inherit, { value: 'multiplier', label: t('extraPay.multiplierMode') }, { value: 'fixed', label: t('extraPay.fixedMode') }] as { value: Opt<OtMode>; label: string }[]}
        value={toOpt(value.otMode)} onChange={(v) => onChange({ otMode: fromOpt(v) })} testIDPrefix={`${testIDPrefix}-otMode`} />
      {value.otMode === 'fixed' ? (
        <Field label={t('extraPay.otRate')} value={value.otRate} onChangeText={(otRate) => onChange({ otRate })} keyboardType="decimal-pad"
          error={errors.otRate ? t(errors.otRate) : undefined} testID={`${testIDPrefix}-otRate`} />
      ) : (
        <>
          <Label>{t('extraPay.otMultiplier')}</Label>
          <Segmented<Opt<number>> options={mult} value={toOpt(value.otMultiplier)}
            onChange={(v) => onChange({ otMultiplier: fromOpt(v) })} testIDPrefix={`${testIDPrefix}-otMultiplier`} />
        </>
      )}
    </Section>
  );
}
