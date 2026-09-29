import en from '../i18n/en.json';
import bn from '../i18n/bn.json';
import hi from '../i18n/hi.json';

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  ).sort();
}

test('bn and hi have exactly the en keys', () => {
  expect(keys(bn)).toEqual(keys(en));
  expect(keys(hi)).toEqual(keys(en));
});

test('no empty strings', () => {
  for (const dict of [en, bn, hi]) {
    for (const k of keys(dict)) {
      const v = k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], dict);
      expect(typeof v === 'string' && v.trim().length > 0).toBe(true);
    }
  }
});
