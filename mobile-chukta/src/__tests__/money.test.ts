import { formatRupees, rupeesToPaise } from '../utils/money';

test('formatRupees uses Indian grouping and drops zero paise', () => {
  expect(formatRupees(0)).toBe('₹0');
  expect(formatRupees(50000)).toBe('₹500');
  expect(formatRupees(12345600)).toBe('₹1,23,456');
  expect(formatRupees(1234567850)).toBe('₹1,23,45,678.50');
  expect(formatRupees(-250005)).toBe('-₹2,500.05');
});

test('rupeesToPaise parses user input', () => {
  expect(rupeesToPaise('500')).toBe(50000);
  expect(rupeesToPaise('1,23,456.5')).toBe(12345650);
  expect(rupeesToPaise('0.05')).toBe(5);
  expect(rupeesToPaise('')).toBeNull();
  expect(rupeesToPaise('abc')).toBeNull();
  expect(rupeesToPaise('1.234')).toBeNull();
});
