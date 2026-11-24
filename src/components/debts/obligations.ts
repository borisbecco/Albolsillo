"use client";

import { useMemo } from "react";
import type { BankId } from "@/lib/banks";
import type { Currency } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { todayAR } from "@/components/tx/parts";

export type Obligation = {
  key: string;
  kind: "bill" | "card";
  id: string;
  name: string;
  day: number;
  amount: number;
  currency: Currency;
  categoryId: string | null;
  bank: BankId | null;
  paid: boolean;
};

/** Último día del mes (los vencimientos del 31 caen el 30 en noviembre). */
export const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Vencimientos del mes: gastos fijos (con su pago) y tarjetas (saldo a pagar). */
export function useObligations(month: string): Obligation[] {
  const { bills, cards, isBillPaid } = useData();
  return useMemo(() => {
    const last = daysInMonth(month);
    const list: Obligation[] = [
      ...bills.map((b) => ({
        key: `bill:${b.id}`,
        kind: "bill" as const,
        id: b.id,
        name: b.name,
        day: Math.min(b.due_day, last),
        amount: Number(b.amount),
        currency: b.currency,
        categoryId: b.category_id,
        bank: null,
        paid: isBillPaid(b.id, month),
      })),
      ...cards
        .filter((c) => Number(c.balance) > 0)
        .map((c) => ({
          key: `card:${c.id}`,
          kind: "card" as const,
          id: c.id,
          name: c.name,
          day: Math.min(c.due_day, last),
          amount: Number(c.balance),
          currency: "ARS" as const,
          categoryId: null,
          bank: c.bank as BankId | null,
          paid: false,
        })),
    ];
    return list.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
  }, [bills, cards, isBillPaid, month]);
}

/** Etiqueta y color del vencimiento respecto de hoy. */
export function dueInfo(month: string, day: number, paid: boolean) {
  if (paid) return { label: "Pagado", color: "var(--pos)" };
  const today = todayAR();
  const due = new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00Z`);
  const now = new Date(`${today}T00:00:00Z`);
  const d = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  if (d < 0) return { label: `Vencido hace ${-d} ${d === -1 ? "día" : "días"}`, color: "var(--red)" };
  if (d === 0) return { label: "Vence hoy", color: "var(--red)" };
  if (d === 1) return { label: "Vence mañana", color: "var(--red)" };
  if (d <= 7) return { label: `Vence en ${d} días`, color: "var(--amb)" };
  return { label: `Vence en ${d} días`, color: "var(--mut)" };
}
