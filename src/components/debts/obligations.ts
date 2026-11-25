"use client";

import { useMemo } from "react";
import type { BankId } from "@/lib/banks";
import type { Currency } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { todayAR } from "@/lib/month";

export type Obligation = {
  key: string;
  kind: "bill" | "card" | "loan";
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

/** Vencimientos del mes: gastos fijos y préstamos (con su pago) y tarjetas (saldo a pagar). */
export function useObligations(month: string): Obligation[] {
  const { bills, cards, loans, isBillPaid, rate } = useData();
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
        .filter((c) => Number(c.balance) > 0 || Number(c.balance_usd) > 0)
        .map((c) => {
          // Pesos + dólares; queda pagada cuando lo pagado del ciclo cubre el resumen.
          const total = Number(c.balance) + Number(c.balance_usd) * (rate ?? 0);
          const paid = Number(c.cycle_paid) + Number(c.cycle_paid_usd) * (rate ?? 0);
          return {
            key: `card:${c.id}`,
            kind: "card" as const,
            id: c.id,
            name: c.name,
            day: Math.min(c.due_day, last),
            amount: total,
            currency: "ARS" as const,
            categoryId: null,
            bank: c.bank as BankId | null,
            paid: total > 0 && paid >= total - 0.5,
          };
        }),
      ...loans
        .filter((l) => l.n < l.of || l.last_paid_month === month)
        .map((l) => ({
          key: `loan:${l.id}`,
          kind: "loan" as const,
          id: l.id,
          name: l.name,
          day: Math.min(l.due_day, last),
          amount: Number(l.installment),
          currency: "ARS" as const,
          categoryId: "prestamo",
          bank: null,
          paid: l.last_paid_month === month,
        })),
    ];
    return list.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
  }, [bills, cards, loans, isBillPaid, month, rate]);
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

/** Estado de un préstamo en el mes: Terminado, Cuota pagada, Vencida, Vence hoy, Vence en N d. */
export function loanStatus(month: string, l: { n: number; of: number; due_day: number; last_paid_month: string | null }) {
  if (l.last_paid_month === month) return { label: "Cuota pagada", color: "var(--pos)", canPay: false, done: false };
  if (l.n >= l.of) return { label: "Terminado", color: "var(--pos)", canPay: false, done: true };
  const day = Math.min(l.due_day, daysInMonth(month));
  const due = new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00Z`);
  const now = new Date(`${todayAR()}T00:00:00Z`);
  const d = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  const s =
    d < 0
      ? { label: `Vencida hace ${-d} d`, color: "var(--red)" }
      : d === 0
        ? { label: "Vence hoy", color: "var(--red)" }
        : d <= 7
          ? { label: `Vence en ${d} d`, color: "var(--amb)" }
          : { label: `Vence el ${day}`, color: "var(--mut)" };
  return { ...s, canPay: true, done: false };
}
