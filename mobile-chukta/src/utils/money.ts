function groupIndian(n: string): string {
  if (n.length <= 3) return n;
  const last3 = n.slice(-3);
  const rest = n.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Integer paise → "₹1,23,456.50" (paise part omitted when zero). */
export function formatRupees(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100).toString();
  const p = abs % 100;
  return `${sign}₹${groupIndian(rupees)}${p ? `.${p.toString().padStart(2, '0')}` : ''}`;
}

/** "1,23,456.5" → 12345650; null when not a valid non-negative amount with ≤2 decimals. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [r, d = ''] = cleaned.split('.');
  return Number(r) * 100 + Number(d.padEnd(2, '0'));
}
