"use client";

import { useMemo } from "react";
import { CATEGORIES } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { currentMonth } from "@/lib/month";
import { monthTotals } from "@/lib/plan";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { useObligations } from "@/components/debts/obligations";
import { todayAR } from "@/components/tx/parts";

export type Alert = { key: string; icon: string; title: string; sub: string; color: string; order: number; open?: "detected" };

const when = (d: number) => (d < 0 ? `Vencido hace ${-d} ${d === -1 ? "día" : "días"}` : d === 0 ? "Hoy" : d === 1 ? "Mañana" : `En ${d} días`);

/**
 * Alertas activas: vencimientos dentro de la anticipación elegida (y vencidos sin pagar)
 * y presupuestos al 80% o más.
 */
export function useAlerts(): Alert[] {
  const { user } = useShell();
  const { transactions, budgetFor, rate, detected } = useData();
  const month = currentMonth();
  const obligations = useObligations(month);

  return useMemo(() => {
    const today = Number(todayAR().slice(8));
    const list: Alert[] = [];
    // Gastos detectados para revisar: primero.
    if (detected.length) {
      list.push({
        key: "detected",
        icon: "bolt",
        title: detected.length === 1 ? "1 gasto detectado para revisar" : `${detected.length} gastos detectados para revisar`,
        sub: "Tocá para confirmarlos o descartarlos",
        color: "var(--acc)",
        order: -100,
        open: "detected",
      });
    }
    for (const o of obligations) {
      if (o.paid) continue;
      const d = o.day - today;
      if (d > user.alert_days) continue;
      list.push({
        key: o.key,
        icon: o.kind === "card" ? "credit_card" : o.kind === "loan" ? "account_balance" : "receipt_long",
        title: o.kind === "card" ? `Vence ${o.name}` : o.kind === "loan" ? `Cuota de ${o.name}` : o.name,
        sub: `${when(d)} · ${formatMoney(o.amount, o.currency)}`,
        color: d <= 1 ? "var(--red)" : "var(--amb)",
        order: d,
      });
    }
    const totals = monthTotals(transactions, month, (n, c) => (c === "USD" ? (rate ? n * rate : 0) : n));
    for (const c of CATEGORIES) {
      if (c.type !== "out" || c.id === "prestamo") continue;
      const limit = budgetFor(month, c.id).amount;
      const spent = totals.byCat[c.id] ?? 0;
      if (!limit || spent < limit * 0.8) continue;
      const over = spent >= limit;
      list.push({
        key: `budget:${c.id}`,
        icon: c.icon,
        title: over ? `Presupuesto excedido: ${c.name}` : `${c.name} al ${Math.round((spent / limit) * 100)}%`,
        sub: `Gastaste ${formatMoney(spent, "ARS")} de ${formatMoney(limit, "ARS")}`,
        color: over ? "var(--red)" : "var(--amb)",
        order: over ? 50 : 60,
      });
    }
    return list.sort((a, b) => a.order - b.order);
  }, [obligations, user.alert_days, transactions, budgetFor, rate, month, detected.length]);
}
