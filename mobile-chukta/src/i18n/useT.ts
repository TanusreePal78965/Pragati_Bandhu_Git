import { useTranslation } from 'react-i18next';
import type { Translate } from '../utils/format';

/** `t` narrowed to the plain (key, params) → string shape every screen uses. Re-renders on language change. */
export function useT(): Translate {
  const { t } = useTranslation();
  return t as unknown as Translate;
}
