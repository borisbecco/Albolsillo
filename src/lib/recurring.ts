// Movimientos que se repiten: los marcados como recurrentes que todavía no se cargaron este mes.
// No incluye gastos fijos (tienen su propio "Pagar"), cuotas de préstamos ni de tarjeta, ni pagos de tarjeta.

import { norm } from "@/lib/entities";

type TxLike = {
  id: string;
  type: "in" | "out" | "card_payment";
  date: string;
  description: string;
  category_id: string;
  amount: string;
  currency: "ARS" | "USD";
  account_id: string | null;
  card_id: string | null;
  recurring: boolean;
  bill_id: string | null;
  loan_id: string | null;
  installment_id: string | null;
};

export type RecurringDue<T extends TxLike = TxLike> = {
  /** Identifica la serie: tipo + categoría + descripción. */
  key: string;
  /** La última vez que se cargó (de ahí salen monto, cuenta y tarjeta). */
  last: T;
  /** Día del mes en que toca. */
  day: number;
};

export const seriesKey = (t: Pick<TxLike, "type" | "category_id" | "description">) => `${t.type}|${t.category_id}|${norm(t.description)}`;

const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

/**
 * Los recurrentes que tocan hoy o antes en el mes de `today` y todavía no están cargados.
 * Una serie sigue mientras su última carga esté marcada como recurrente y sea de hace 1 o 2 meses.
 */
export function pendingRecurring<T extends TxLike>(txs: T[], today: string, skip: (t: T) => boolean = () => false): RecurringDue<T>[] {
  const month = today.slice(0, 7);
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const latest = new Map<string, T>();
  for (const t of txs) {
    if (t.type === "card_payment" || t.bill_id || t.loan_id || t.installment_id) continue;
    const k = seriesKey(t);
    const prev = latest.get(k);
    if (!prev || t.date > prev.date) latest.set(k, t);
  }
  const due: RecurringDue<T>[] = [];
  for (const [key, last] of latest) {
    if (!last.recurring || skip(last)) continue;
    const gap = monthsBetween(last.date.slice(0, 7), month);
    if (gap < 1 || gap > 2) continue; // ya cargado este mes, o la serie quedó vieja
    const day = Math.min(Number(last.date.slice(8, 10)), lastDay);
    if (Number(today.slice(8, 10)) < day) continue;
    due.push({ key, last, day });
  }
  return due.sort((a, b) => a.day - b.day);
}
