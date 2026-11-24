"use client";

import { useMemo } from "react";
import { CATEGORIES } from "@/lib/categories";
import { addMonths, currentMonth } from "@/lib/month";
import { computePlan, interestByStrategy, monthTotals, type PlanCard } from "@/lib/plan";
import type { Currency } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";

/** Resumen del mes elegido (S), el anterior (P) y el plan del mes actual. Todo en pesos. */
export function useSummary() {
  const { month, user, months } = useShell();
  const { transactions, bills, cards, isBillPaid, rate, budgetFor } = useData();

  return useMemo(() => {
    const toArs = (n: number, c: Currency) => (c === "USD" ? (rate ? n * rate : 0) : n);
    const cur = currentMonth();
    const isCurrent = month === cur;
    const prevYm = addMonths(month, -1);
    const hasPrev = months.includes(prevYm);

    const S = monthTotals(transactions, month, toArs);
    const P = hasPrev ? monthTotals(transactions, prevYm, toArs) : null;
    const C = isCurrent ? S : monthTotals(transactions, cur, toArs);

    // Gastos fijos todavía no pagados este mes.
    const pendingBills = bills.filter((b) => !isBillPaid(b.id, cur));
    const pendingFixed = pendingBills.reduce((s, b) => s + toArs(Number(b.amount), b.currency), 0);

    // Presupuesto del mes actual por categoría y reserva variable (lo que falta gastar de lo presupuestado).
    const budgets = CATEGORIES.filter((c) => c.type === "out" && c.id !== "prestamo").map((c) => ({
      ...c,
      limit: budgetFor(cur, c.id).amount,
      spent: C.byCat[c.id] ?? 0,
    }));
    const reserve = budgets.filter((b) => b.kind === "var").reduce((s, b) => s + Math.max(0, b.limit - b.spent), 0);

    // Ingreso del mes: lo cargado o, si es más, lo esperado según el onboarding (sueldo + US$).
    const expected = Number(user.salary ?? 0) + toArs(Number(user.usd_income ?? 0), "USD");
    const income = Math.max(C.inc, expected);

    const planCards: PlanCard[] = cards.map((c) => ({
      id: c.id,
      name: c.name,
      balance: Number(c.balance),
      min: Number(c.min_payment),
      dueDay: c.due_day,
      tna: Number(c.tna),
    }));
    const planInput = { income, spent: C.out, pendingFixed, reserve, cards: planCards };
    const plan = computePlan({ ...planInput, strategy: user.pay_strategy });
    const interest = interestByStrategy(planInput);

    // Gasto proyectado: lo hecho más los fijos pendientes (solo en el mes actual).
    const projectedOut = S.out + (isCurrent ? pendingFixed : 0);
    const saveRate = S.inc ? (S.inc - projectedOut) / S.inc : 0;
    const prevSaveRate = P && P.inc ? (P.inc - P.out) / P.inc : 0;

    return { toArs, isCurrent, prevYm, S, P, C, pendingFixed, pendingBills, reserve, income, plan, interest, projectedOut, saveRate, prevSaveRate };
  }, [month, months, user, transactions, bills, cards, isBillPaid, rate, budgetFor]);
}
