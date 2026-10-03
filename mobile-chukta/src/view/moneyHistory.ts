import type { AdvanceEntry, EarningAdjustment, PaymentMode, WagePayment } from '../domain/types';

export type MoneyKind = 'advance' | 'repayment' | 'writeoff' | 'payment' | 'bonus' | 'deduction';
export type HistoryItem = {
  id: string; table: 'advance_entries' | 'wage_payments' | 'earning_adjustments'; kind: MoneyKind; amountPaise: number; date: string;
  mode: PaymentMode | null; note: string | null; createdAt: string;
  /** This row cancels another row. */
  isVoid: boolean;
  /** This row has been cancelled by a later row. */
  isVoided: boolean;
  canCorrect: boolean;
};

export function buildMoneyHistory(advances: AdvanceEntry[], payments: WagePayment[], adjustments: EarningAdjustment[] = []): HistoryItem[] {
  const all = [...advances, ...payments, ...adjustments];
  const voided = new Set(all.filter((r) => r.voids_id).map((r) => r.voids_id as string));
  const common = (r: AdvanceEntry | WagePayment | EarningAdjustment) => {
    const isVoid = r.voids_id !== null;
    const isVoided = voided.has(r.id);
    return { id: r.id, amountPaise: r.amount_paise, date: r.date, mode: 'mode' in r ? r.mode : null, note: r.note, createdAt: r.created_at, isVoid, isVoided, canCorrect: !isVoid && !isVoided };
  };
  const items: HistoryItem[] = [
    ...advances.map((a) => ({ ...common(a), table: 'advance_entries' as const, kind: a.type as MoneyKind })),
    ...payments.map((p) => ({ ...common(p), table: 'wage_payments' as const, kind: 'payment' as const })),
    ...adjustments.map((a) => ({ ...common(a), table: 'earning_adjustments' as const, kind: a.type as MoneyKind })),
  ];
  return items.sort((a, b) =>
    (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
    || Date.parse(b.createdAt) - Date.parse(a.createdAt)
    || (a.id < b.id ? 1 : -1));
}
